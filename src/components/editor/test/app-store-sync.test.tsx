import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
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

vi.mock("@/hooks/use-markdown", () => ({
  useMarkdown: () => ({}),
}))

vi.mock("@/hooks/use-auto-save", () => ({
  useAutoSave: () => ({}),
}))

// CodeMirror 的 contenteditable 在 jsdom 里无法模拟输入，用真实 <textarea> 替代，
// 以便测 App 的 store↔编辑器 同步闭环（这正是要验证的 bug）。
vi.mock("@/components/editor/CodeMirrorReact", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/editor/CodeMirrorReact")>()
  return {
    ...actual,
    default: (props: { value: string; onChange: (value: string) => void }) => (
      <textarea
        aria-label="editor"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    ),
  }
})

const { useDocStore } = await import("@/stores/doc-store")
const { App } = await import("@/App")

describe("App store→编辑器 回灌", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDocStore.getState().reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("外部写 store（AI 生成）后编辑器内容更新", () => {
    render(<App />)
    const editor = screen.getByLabelText("editor") as HTMLTextAreaElement
    expect(editor).toBeDefined()

    // AI 生成走 setContent 写入 store
    act(() => {
      useDocStore
        .getState()
        .setContent("# 关于推进垃圾分类工作的通知\n\n正文内容")
    })
    expect(editor.value).toContain("关于推进垃圾分类工作的通知")
  })

  it("编辑器输入 → store 同步，不回灌循环（无 Maximum update depth）", () => {
    render(<App />)
    const editor = screen.getByLabelText("editor") as HTMLTextAreaElement
    fireEvent.change(editor, {
      target: { value: "用户手动输入的内容" },
    })
    expect(useDocStore.getState().content).toContain("用户手动输入的内容")

    // 关键：编辑器输入不应触发 store→editor 反向回灌（否则无限循环）
    expect(editor.value).toBe("用户手动输入的内容")
  })

  it("编辑后外部写 store → 编辑器显示 store 新值", () => {
    render(<App />)
    const editor = screen.getByLabelText("editor") as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: "手动编辑的内容" } })
    expect(useDocStore.getState().content).toContain("手动编辑的内容")

    act(() => {
      useDocStore.getState().setContent("# AI 新文档\n\nAI 生成正文")
    })
    expect(editor.value).toContain("AI 新文档")
  })
})
