import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

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

// i18n：不加载真实语言包，t 原样返回 key（按钮文案断言用 key 定位）。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// mock 生成 hook：错误态（status=error）下验证重试按钮的空 prompt 守卫。
let mockPrompt = ""
vi.mock("@/hooks/use-generate-document", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/use-generate-document")>()
  return {
    ...actual,
    useGenerateDocument: () => ({
      prompt: mockPrompt,
      setPrompt: vi.fn(),
      docType: "gongwen",
      setDocType: vi.fn(),
      seal: false,
      setSeal: vi.fn(),
      status: "error",
      errorCode: "LLM_EMPTY_RESULT",
      issues: [],
      generate: vi.fn(),
      reset: vi.fn(),
    }),
  }
})

const { AiGenerateDialog } = await import("../AiGenerateDialog")

describe("AiGenerateDialog · 重试按钮空 prompt 守卫", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrompt = ""
  })

  it("生成失败且 prompt 为空时，重试按钮不可点（不会以空 prompt 调 LLM）", () => {
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    const retry = screen.getByRole("button", { name: "aiGenerate.retry" })
    expect(retry).toHaveProperty("disabled", true)
  })

  it("生成失败且 prompt 有内容时，重试按钮可点", () => {
    mockPrompt = "重新生成一份通知"
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    const retry = screen.getByRole("button", { name: "aiGenerate.retry" })
    expect(retry).toHaveProperty("disabled", false)
  })
})
