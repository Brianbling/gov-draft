import { describe, expect, it, vi } from "vitest"
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

// i18n：不加载真实语言包，t 原样返回 key。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

let mockFormErrors: string[] = []
vi.mock("@/hooks/use-generate-document", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/use-generate-document")>()
  return {
    ...actual,
    useGenerateDocument: () => ({
      prompt: "生成一份通知",
      setPrompt: vi.fn(),
      docType: "gongwen",
      setDocType: vi.fn(),
      formValues: { title: "通知" },
      setFormValues: vi.fn(),
      status: "error",
      errorCode: "FORM_REQUIRED_GONGWEN",
      formErrors: mockFormErrors,
      issues: [],
      generate: vi.fn(),
      reset: vi.fn(),
    }),
  }
})

const { AiGenerateDialog } = await import("../AiGenerateDialog")

describe("AiGenerateDialog · FORM_REQUIRED 错误详情", () => {
  it("错误态下逐条列出缺失的必填字段", () => {
    mockFormErrors = ["aiGenerate.field.title", "aiGenerate.field.recipient"]
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    // 两条缺失字段都渲染进错误块
    expect(screen.getByText(/aiGenerate.field.title/)).toBeTruthy()
    expect(screen.getByText(/aiGenerate.field.recipient/)).toBeTruthy()
  })

  it("无缺失字段时不渲染字段列表", () => {
    mockFormErrors = []
    render(<AiGenerateDialog open onOpenChange={vi.fn()} />)
    // 错误文案仍在，但不出现字段列表条目（无 '· ' 前缀的 li）
    expect(screen.getByText(/aiGenerate.errors.formRequired/)).toBeTruthy()
    expect(screen.queryByText(/^· /)).toBeNull()
  })
})
