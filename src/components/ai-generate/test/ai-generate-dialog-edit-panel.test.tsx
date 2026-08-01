import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// zustand persist 在模块求值期读取 localStorage；jsdom 无此实现，先装内存 shim。
// doc-store 必须在此之后动态 import，否则 persist middleware 拿到的 localStorage 为 undefined。
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

// i18n：不加载真实语言包，t 原样返回 key（文案断言用 key 定位）。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// mock 生成 hook：返回 done 态 + 可注入 result/applyEdit，验证编辑面板渲染与回填。
let mockApplyEdit: ((next: unknown) => string | null) | null = null
let mockResult: unknown = null
vi.mock("@/hooks/use-generate-document", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/use-generate-document")>()
  return {
    ...actual,
    useGenerateDocument: () => ({
      prompt: "",
      setPrompt: vi.fn(),
      docType: "gongwen",
      setDocType: vi.fn(),
      formValues: {
        title: "关于推进垃圾分类工作的通知",
        recipient: "各区人民政府",
        docNumber: "国发〔2026〕12号",
      },
      setFormValues: vi.fn(),
      status: "done",
      errorCode: null,
      issues: [],
      result: mockResult,
      generate: vi.fn(),
      applyEdit: (next: unknown) => mockApplyEdit?.(next) ?? null,
      reset: vi.fn(),
    }),
  }
})

const { AiGenerateDialog } = await import("../AiGenerateDialog")
const { useDocStore } = await import("@/stores/doc-store")

describe("AiGenerateDialog · 生成后要素编辑面板（#29）", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDocStore.getState().reset()
    mockResult = {
      docType: "gongwen",
      title: "关于推进垃圾分类工作的通知",
      docNumber: "国发〔2026〕12号",
      recipient: "各区人民政府",
      body: [{ type: "p", text: "正文内容" }],
    }
    mockApplyEdit = null
  })

  it("done 态渲染编辑面板（表单区切为可编辑要素，标题输入框初值来自 result）", () => {
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    // 必填要素 label 带 * 后缀（标题必填），用正则匹配 label 文本
    const titleInput = screen.getByLabelText(/标题/)
    expect((titleInput as HTMLInputElement).value).toBe(
      "关于推进垃圾分类工作的通知",
    )
    expect((screen.getByLabelText(/发文字号/) as HTMLInputElement).value).toBe(
      "国发〔2026〕12号",
    )
    // done 态下要素区切换为"编辑面板"标题（i18n mock 原样返回 key）
    expect(screen.getByText("aiGenerate.editFieldsLabel")).toBeDefined()
    expect(screen.queryByText("aiGenerate.formFieldsLabel")).toBeNull()
  })

  it("修改要素输入 → 实时调用 applyEdit 回填编辑器", () => {
    const applied: unknown[] = []
    mockApplyEdit = (next) => {
      applied.push(next)
      return "# 新标题"
    }
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    const titleInput = screen.getByLabelText(/标题/)
    fireEvent.change(titleInput, { target: { value: "新标题" } })
    expect(applied.length).toBeGreaterThan(0)
    expect(applied[0]).toMatchObject({ title: "新标题" })
  })

  it("编辑面板的标题改动实时写入 doc-store（编辑器随输入更新）", () => {
    mockApplyEdit = (next) => {
      const v = next as { title?: string }
      const title = v.title ?? "关于推进垃圾分类工作的通知"
      useDocStore.getState().setTitle(title)
      useDocStore.getState().setContent(`# ${title}\n正文`)
      return `# ${title}\n正文`
    }
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/标题/), {
      target: { value: "关于深化改革的决定" },
    })
    expect(useDocStore.getState().title).toBe("关于深化改革的决定")
  })
})
