import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { EditorView } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import {
  toggleBold,
  toggleHeading,
  toggleUnorderedList,
  toggleOrderedList,
  executeFormat,
  setParagraphAlign,
  adjustParagraphIndent,
} from "../format-commands"

let container: HTMLDivElement

function mkView(doc: string, anchor: number, head?: number): EditorView {
  const state = EditorState.create({
    doc,
    selection: { anchor, head: head ?? anchor },
  })
  return new EditorView({ state, parent: container })
}

function doc(view: EditorView): string {
  return view.state.doc.toString()
}

beforeEach(() => {
  container = document.createElement("div")
})
afterEach(() => {
  container.remove()
})

describe("toggleBold", () => {
  it("wraps selected text with ** markers", () => {
    const view = mkView("hello world", 0, 5)
    toggleBold(view)
    expect(doc(view)).toBe("**hello** world")
  })

  it("removes ** markers when selection is already bold", () => {
    const view = mkView("**hello** world", 0, 9)
    toggleBold(view)
    expect(doc(view)).toBe("hello world")
  })

  it("inserts **** and places cursor between them when no selection", () => {
    const view = mkView("abc", 3)
    toggleBold(view)
    expect(doc(view)).toBe("abc****")
    // cursor should be at position 5 (3 + 2)
    expect(view.state.selection.main.anchor).toBe(5)
  })
})

describe("toggleHeading", () => {
  it("adds heading prefix to a plain line", () => {
    const view = mkView("A line", 0)
    toggleHeading(view, 2)
    expect(doc(view)).toBe("## A line")
  })

  it("removes prefix when same level", () => {
    const view = mkView("## A line", 0)
    toggleHeading(view, 2)
    expect(doc(view)).toBe("A line")
  })

  it("replaces prefix when different level", () => {
    const view = mkView("## A line", 0)
    toggleHeading(view, 3)
    expect(doc(view)).toBe("### A line")
  })

  it("operates on all lines in selection range", () => {
    const view = mkView("line1\nline2\nline3", 0, 17)
    toggleHeading(view, 1)
    expect(doc(view)).toBe("# line1\n# line2\n# line3")
  })
})

describe("toggleUnorderedList", () => {
  it('adds "- " prefix', () => {
    const view = mkView("item", 0)
    toggleUnorderedList(view)
    expect(doc(view)).toBe("- item")
  })

  it('removes "- " prefix', () => {
    const view = mkView("- item", 0)
    toggleUnorderedList(view)
    expect(doc(view)).toBe("item")
  })

  it("handles multiple lines", () => {
    const view = mkView("a\nb", 0, 3)
    toggleUnorderedList(view)
    expect(doc(view)).toBe("- a\n- b")
  })
})

describe("toggleOrderedList", () => {
  it('adds "1. " prefix to single line', () => {
    const view = mkView("item", 0)
    toggleOrderedList(view)
    expect(doc(view)).toBe("1. item")
  })

  it('removes "N. " prefix', () => {
    const view = mkView("3. item", 0)
    toggleOrderedList(view)
    expect(doc(view)).toBe("item")
  })

  it("assigns incremental numbers across multiple lines", () => {
    const view = mkView("a\nb\nc", 0, 5)
    toggleOrderedList(view)
    expect(doc(view)).toBe("1. a\n2. b\n3. c")
  })
})

describe("executeFormat", () => {
  it('dispatches to toggleBold for "bold" action', () => {
    const view = mkView("hello", 0, 5)
    executeFormat(view, "bold")
    expect(doc(view)).toBe("**hello**")
  })

  it('dispatches to toggleHeading for "h1" action', () => {
    const view = mkView("hello", 0)
    executeFormat(view, "h1")
    expect(doc(view)).toBe("# hello")
  })

  it("dispatches for ul and ol", () => {
    const view1 = mkView("x", 0)
    executeFormat(view1, "ul")
    expect(doc(view1)).toBe("- x")

    const view2 = mkView("x", 0)
    executeFormat(view2, "ol")
    expect(doc(view2)).toBe("1. x")
  })

  it("dispatches align actions", () => {
    const view = mkView("段落", 0)
    executeFormat(view, "alignCenter")
    expect(doc(view)).toBe(
      "::: content.body.paragraph.align: center;\n段落\n:::"
    )
  })

  it("dispatches indent increase/decrease", () => {
    const view = mkView("段落", 0)
    executeFormat(view, "indentIncrease")
    expect(doc(view)).toBe("::: content.body.paragraph.indent: 2em;\n段落\n:::")
  })
})

describe("setParagraphAlign", () => {
  it("wraps the paragraph in an align container with a closing line", () => {
    const view = mkView("段落", 0)
    setParagraphAlign(view, "center")
    expect(doc(view)).toBe(
      "::: content.body.paragraph.align: center;\n段落\n:::"
    )
  })

  it("replaces an existing align value in the enclosing container", () => {
    const view = mkView("::: body.paragraph.align:left\n段落\n:::", 11)
    setParagraphAlign(view, "right")
    expect(doc(view)).toBe("::: body.paragraph.align: right\n段落\n:::")
  })
})

describe("adjustParagraphIndent", () => {
  it("wraps the paragraph in an indent container on increase", () => {
    const view = mkView("段落", 0)
    adjustParagraphIndent(view, 2)
    expect(doc(view)).toBe("::: content.body.paragraph.indent: 2em;\n段落\n:::")
  })

  it("bumps an existing indent value by the delta", () => {
    const view = mkView("::: body.paragraph.indent:2em\n段落\n:::", 12)
    adjustParagraphIndent(view, 2)
    expect(doc(view)).toBe("::: body.paragraph.indent: 4em\n段落\n:::")
  })

  it("clamps indent at zero on decrease", () => {
    const view = mkView("::: body.paragraph.indent:1em\n段落\n:::", 12)
    adjustParagraphIndent(view, -2)
    expect(doc(view)).toBe("::: body.paragraph.indent: 0em\n段落\n:::")
  })
})
