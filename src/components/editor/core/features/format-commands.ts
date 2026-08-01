import { EditorView } from "@codemirror/view"

export type FormatAction = "bold" | "h1" | "h2" | "h3" | "ul" | "ol"

type ChangeSpec = { from: number; to?: number; insert?: string }

/** 加粗:选区被 `**` 包裹则取消,否则包裹;无选区则插入 `****` 并置光标于中间。 */
export function toggleBold(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main

  if (from === to) {
    view.dispatch({
      changes: { from, insert: "****" },
      selection: { anchor: from + 2 },
    })
    return true
  }

  const selected = state.sliceDoc(from, to)
  const isBold =
    selected.startsWith("**") && selected.endsWith("**") && selected.length >= 4

  if (isBold) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(2, -2) },
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: `**${selected}**` },
    })
  }
  return true
}

/** 标题 toggle:已有同级标题取消,不同级替换,无标题添加。作用于选区所在全部行。 */
export function toggleHeading(view: EditorView, level: number): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const prefix = "#".repeat(level) + " "
  const changes: ChangeSpec[] = []

  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to)

  for (let no = startLine.number; no <= endLine.number; no++) {
    const line = state.doc.line(no)
    const m = line.text.match(/^(#{1,6})\s/)
    if (m && m[1].length === level) {
      changes.push({ from: line.from, to: line.from + m[0].length })
    } else if (m) {
      changes.push({
        from: line.from,
        to: line.from + m[0].length,
        insert: prefix,
      })
    } else {
      changes.push({ from: line.from, insert: prefix })
    }
  }

  if (changes.length === 0) return false
  view.dispatch({ changes })
  return true
}

/** 无序列表 toggle:已有 `- ` 前缀取消,否则添加。作用于选区所在全部行。 */
export function toggleUnorderedList(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const changes: ChangeSpec[] = []

  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to)

  for (let no = startLine.number; no <= endLine.number; no++) {
    const line = state.doc.line(no)
    const m = line.text.match(/^-\s/)
    if (m) {
      changes.push({ from: line.from, to: line.from + m[0].length })
    } else {
      changes.push({ from: line.from, insert: "- " })
    }
  }

  if (changes.length === 0) return false
  view.dispatch({ changes })
  return true
}

/** 有序列表 toggle:已有 `N. ` 前缀取消,否则按 1. 2. 3. 递增添加。作用于选区所在全部行。 */
export function toggleOrderedList(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const changes: ChangeSpec[] = []

  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to)

  let counter = 1
  for (let no = startLine.number; no <= endLine.number; no++) {
    const line = state.doc.line(no)
    const m = line.text.match(/^\d+\.\s/)
    if (m) {
      changes.push({ from: line.from, to: line.from + m[0].length })
    } else {
      changes.push({ from: line.from, insert: `${counter}. ` })
      counter++
    }
  }

  if (changes.length === 0) return false
  view.dispatch({ changes })
  return true
}

/** 格式化分派:工具栏按钮通过 CodeMirrorHandle 调用此函数。 */
export function executeFormat(view: EditorView, action: FormatAction): boolean {
  switch (action) {
    case "bold":
      return toggleBold(view)
    case "h1":
      return toggleHeading(view, 1)
    case "h2":
      return toggleHeading(view, 2)
    case "h3":
      return toggleHeading(view, 3)
    case "ul":
      return toggleUnorderedList(view)
    case "ol":
      return toggleOrderedList(view)
  }
}
