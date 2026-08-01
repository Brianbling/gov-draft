import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// zustand persist 在模块求值期读取 localStorage；jsdom 无此实现，先装内存 shim。
if (typeof globalThis.localStorage === "undefined") {
  const backing = new Map<string, string>()
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
    },
  })
}

// i18n：不加载真实语言包，t 原样返回 key（placeholder 断言用 key 定位）。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// mock 生成 hook：可注入 docType，验证描述区 placeholder/hint 随文种变化。
let mockDocType: string = "gongwen"
let mockPrompt = ""
const mockSetPrompt = vi.fn()
vi.mock("@/hooks/use-generate-document", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/use-generate-document")>()
  return {
    ...actual,
    useGenerateDocument: () => ({
      prompt: mockPrompt,
      setPrompt: mockSetPrompt,
      docType: mockDocType,
      setDocType: vi.fn(),
      formValues: {},
      setFormValues: vi.fn(),
      status: "idle",
      errorCode: null,
      issues: [],
      result: null,
      generate: vi.fn(),
      reset: vi.fn(),
    }),
  }
})

const { AiGenerateDialog } = await import("../AiGenerateDialog")

describe("AiGenerateDialog · 描述栏结构化需求面板", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDocType = "gongwen"
    mockPrompt = ""
  })

  it("描述输入是多行 textarea（非单行 Input），id 为 ai-generate-prompt", () => {
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByLabelText("aiGenerate.promptLabel", {
      selector: "textarea",
    })
    expect(textarea.tagName).toBe("TEXTAREA")
    expect(textarea.getAttribute("id")).toBe("ai-generate-prompt")
  })

  it("placeholder/hint 随文种变化（t mock 原样返回 key，断言落到对应文种 key）", () => {
    mockDocType = "request"
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByLabelText("aiGenerate.promptLabel", {
      selector: "textarea",
    })
    expect(textarea.getAttribute("placeholder")).toBe(
      "aiGenerate.prompt.request.placeholder",
    )
    // hint 文本随之变化
    expect(
      screen.getByText("aiGenerate.prompt.request.hint"),
    ).toBeDefined()
  })

  it("通知文种的 placeholder 指向通知引导语", () => {
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByLabelText("aiGenerate.promptLabel", {
      selector: "textarea",
    })
    expect(textarea.getAttribute("placeholder")).toBe(
      "aiGenerate.prompt.gongwen.placeholder",
    )
  })

  it("受控输入：击键更新 prompt 且不重置光标（标准受控 textarea 语义）", () => {
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByLabelText("aiGenerate.promptLabel", {
      selector: "textarea",
    })
    fireEvent.change(textarea, { target: { value: "拟一份通知" } })
    expect(mockSetPrompt).toHaveBeenCalledWith("拟一份通知")
  })
})
