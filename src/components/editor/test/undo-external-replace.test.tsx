import { describe, it, expect, afterEach } from "vitest"
import { EditorView } from "@codemirror/view"
import { undo, undoDepth, isolateHistory } from "@codemirror/commands"
import type { EditorSettings } from "@/stores/settings-store"
import { createEditorState, replaceDocument } from "../core/build-extensions"

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 16,
  lineNumbers: true,
  wordWrap: true,
  tabSize: 2,
  showLayoutCode: false,
}

const views: EditorView[] = []

function mkView(content = ""): EditorView {
  const state = createEditorState({
    content,
    onChange: () => {},
    settings: DEFAULT_SETTINGS,
  })
  const view = new EditorView({ state })
  views.push(view)
  return view
}

afterEach(() => {
  for (const view of views.splice(0)) view.destroy()
})

function doc(view: EditorView): string {
  return view.state.doc.toString()
}

function typeSeparate(view: EditorView, text: string): void {
  const from = view.state.selection.main.head
  view.dispatch({
    changes: { from, insert: text },
    selection: { anchor: from + text.length },
    userEvent: "input.type",
    annotations: [isolateHistory.of("after")],
  })
}

describe("外部整篇替换 vs 撤销历史（M5）", () => {
  it("外部替换后一次 undo 恢复手动内容，再 undo 逐条回退手动击键", () => {
    const view = mkView("")
    typeSeparate(view, "第一段\n")
    typeSeparate(view, "第二段\n")
    typeSeparate(view, "第三段")
    expect(doc(view)).toBe("第一段\n第二段\n第三段")
    expect(undoDepth(view.state)).toBe(3)

    replaceDocument(view, "AI 生成的整篇内容")
    expect(doc(view)).toBe("AI 生成的整篇内容")

    undo(view)
    expect(doc(view)).toBe("第一段\n第二段\n第三段")

    undo(view)
    expect(doc(view)).toBe("第一段\n第二段\n")

    undo(view)
    expect(doc(view)).toBe("第一段\n")

    undo(view)
    expect(doc(view)).toBe("")
    expect(undoDepth(view.state)).toBe(0)
  })

  it("AI 生成替换是单条撤销记录：一次 undo 撤掉整次生成", () => {
    const view = mkView("手动编辑的内容")
    replaceDocument(view, "AI 生成的整篇内容")
    expect(doc(view)).toBe("AI 生成的整篇内容")

    undo(view)
    expect(doc(view)).toBe("手动编辑的内容")
    expect(undoDepth(view.state)).toBe(0)
  })

  it("替换内容与当前文档相同则不产生多余撤销记录", () => {
    const view = mkView("原文")
    const end = view.state.doc.length
    view.dispatch({
      changes: { from: end, insert: "A" },
      selection: { anchor: end + 1 },
      userEvent: "input.type",
    })
    expect(doc(view)).toBe("原文A")
    const depthBefore = undoDepth(view.state)

    replaceDocument(view, "原文A")
    expect(doc(view)).toBe("原文A")
    expect(undoDepth(view.state)).toBe(depthBefore)
  })

  it("纯手动编辑的撤销行为不受影响（回归）", () => {
    const view = mkView("")
    typeSeparate(view, "abc")
    expect(undoDepth(view.state)).toBe(1)
    undo(view)
    expect(doc(view)).toBe("")
    expect(undoDepth(view.state)).toBe(0)
  })
})
