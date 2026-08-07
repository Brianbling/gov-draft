import { EditorView } from "@codemirror/view"

export type FormatAction =
  | "bold"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "indentIncrease"
  | "indentDecrease"

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

const PARAGRAPH_ALIGN_VALUES: Record<"left" | "center" | "right", string> = {
  left: "left",
  center: "center",
  right: "right",
}

interface EnclosingContainer {
  openLine: { from: number; to: number; text: string }
}

/** 找到光标所在段落的内层 `:::` 容器（有则返回其 open 行，无则 null）。 */
function findEnclosingContainer(
  view: EditorView,
  lineNumber: number
): EnclosingContainer | null {
  const stack: Array<{ from: number; text: string }> = []
  for (let no = 1; no < lineNumber; no++) {
    const line = view.state.doc.line(no)
    if (/^\s*:::\s+\S/.test(line.text)) {
      stack.push({ from: line.from, text: line.text })
    } else if (/^\s*:::\s*$/.test(line.text) && stack.length > 0) {
      stack.pop()
    }
  }
  // 光标所在行自身是 open 行
  const cursorLine = view.state.doc.line(lineNumber)
  if (/^\s*:::\s+\S/.test(cursorLine.text)) {
    stack.push({ from: cursorLine.from, text: cursorLine.text })
  }

  if (stack.length === 0) return null
  const open = stack[stack.length - 1]!
  return {
    openLine: {
      from: open.from,
      to: open.from + open.text.length,
      text: open.text,
    },
  }
}

/** 在 descriptor 中设置/替换 align 段，返回新 descriptor。 */
function withAlignSegment(descriptor: string, align: string): string {
  let replaced = false
  const segments = descriptor.split(/[;；]/).map((segment) => {
    const parts = segment.split(/[:：]/)
    const key = parts[0]?.trim() ?? ""
    if ((key.endsWith(".align") || key === "align") && !replaced) {
      replaced = true
      return `${key}: ${align}`
    }
    return segment
  })
  if (replaced) return segments.join("; ")
  return `${descriptor}${descriptor ? "; " : ""}${"content.body.paragraph.align"}: ${align}`
}

/** 在 descriptor 中调整 indent 段，返回新 descriptor。 */
function withIndentDelta(descriptor: string, delta: number): string | null {
  let replaced = false
  const segments = descriptor.split(/[;；]/).map((segment) => {
    const parts = segment.split(/[:：]/)
    const key = parts[0]?.trim() ?? ""
    if ((key.endsWith(".indent") || key === "indent") && !replaced) {
      replaced = true
      const value = parts.slice(1).join(":").trim()
      const currentEm = parseFloat(value)
      if (Number.isFinite(currentEm)) {
        const next = Math.max(0, currentEm + delta)
        return `${key}: ${next}em`
      }
    }
    return segment
  })
  if (!replaced) return null
  return segments.join("; ")
}

/**
 * 段落对齐：修改光标所在段落内层 `:::` 容器的 align 值；不在容器内时
 * 在段首包一个新容器（含闭合 `:::`）。
 */
export function setParagraphAlign(
  view: EditorView,
  align: "left" | "center" | "right"
): boolean {
  const { state } = view
  const { from } = state.selection.main
  const cursorLine = state.doc.lineAt(from)
  const enclosing = findEnclosingContainer(view, cursorLine.number)

  if (enclosing) {
    const descriptor = enclosing.openLine.text.trim().slice(3)
    const newDescriptor = withAlignSegment(descriptor, align)
    view.dispatch({
      changes: {
        from: enclosing.openLine.from,
        to: enclosing.openLine.to,
        insert: `::: ${newDescriptor}`,
      },
    })
    return true
  }

  view.dispatch({
    changes: [
      {
        from: cursorLine.from,
        insert: `::: content.body.paragraph.align: ${PARAGRAPH_ALIGN_VALUES[align]};\n`,
      },
      { from: cursorLine.to, insert: "\n:::" },
    ],
  })
  return true
}

/** 缩进增加/减少：修改光标所在段落内层 `:::` 容器的 indent 值。 */
export function adjustParagraphIndent(
  view: EditorView,
  delta: number
): boolean {
  const { state } = view
  const { from } = state.selection.main
  const cursorLine = state.doc.lineAt(from)
  const enclosing = findEnclosingContainer(view, cursorLine.number)

  if (enclosing) {
    const descriptor = enclosing.openLine.text.trim().slice(3)
    const newDescriptor = withIndentDelta(descriptor, delta)
    if (newDescriptor !== null) {
      view.dispatch({
        changes: {
          from: enclosing.openLine.from,
          to: enclosing.openLine.to,
          insert: `::: ${newDescriptor}`,
        },
      })
      return true
    }
    // 无 indent 段时新增
    view.dispatch({
      changes: {
        from: enclosing.openLine.from,
        to: enclosing.openLine.to,
        insert: `::: ${descriptor}${descriptor ? "; " : ""}content.body.paragraph.indent: ${Math.max(0, delta)}em`,
      },
    })
    return true
  }

  view.dispatch({
    changes: [
      {
        from: cursorLine.from,
        insert: `::: content.body.paragraph.indent: ${Math.max(0, delta)}em;\n`,
      },
      { from: cursorLine.to, insert: "\n:::" },
    ],
  })
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
    case "alignLeft":
      return setParagraphAlign(view, "left")
    case "alignCenter":
      return setParagraphAlign(view, "center")
    case "alignRight":
      return setParagraphAlign(view, "right")
    case "indentIncrease":
      return adjustParagraphIndent(view, 2)
    case "indentDecrease":
      return adjustParagraphIndent(view, -2)
  }
}
