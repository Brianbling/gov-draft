import { describe, expect, it } from "vitest"
import { EditorState, Text } from "@codemirror/state"
import { findSugarBlocks, sugarFoldRange } from "../syntax-fold"

describe("findSugarBlocks", () => {
  it("pairs a single container", () => {
    const doc = Text.of([
      "::: content.body.paragraph.align: center",
      "居中段落",
      ":::",
    ])
    const blocks = findSugarBlocks(doc)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.descriptor).toBe("content.body.paragraph.align: center")
  })

  it("handles nested containers", () => {
    const doc = Text.of([
      "::: body.paragraph.indent:2em",
      "外层",
      "::: body.paragraph.align:right",
      "内层",
      ":::",
      "外层2",
      ":::",
    ])
    const blocks = findSugarBlocks(doc)
    expect(blocks).toHaveLength(2)
    // Inner block is recorded first (pops on its close).
    expect(blocks[0]!.descriptor).toBe("body.paragraph.align:right")
    expect(blocks[1]!.descriptor).toBe("body.paragraph.indent:2em")
  })

  it("ignores unclosed openers", () => {
    const doc = Text.of(["::: body.paragraph.indent:2em", "没有闭合"])
    const blocks = findSugarBlocks(doc)
    expect(blocks).toHaveLength(0)
  })

  it("ignores plain ::: closing lines without an open", () => {
    const doc = Text.of([":::", "普通段落"])
    const blocks = findSugarBlocks(doc)
    expect(blocks).toHaveLength(0)
  })
})

describe("sugarFoldRange", () => {
  function rangeFor(
    docText: string,
    anchor: number
  ): { from: number; to: number } | null {
    const state = EditorState.create({ doc: docText })
    const line = state.doc.lineAt(anchor)
    return sugarFoldRange(state, line.from, line.to)
  }

  it("returns the closing line range for an open line", () => {
    const doc = "::: content.body.paragraph.align: center\n居中段落\n:::"
    const range = rangeFor(doc, 0)
    // Closing `:::` line spans ":::" (3 chars) after the newline.
    expect(range).not.toBeNull()
    expect(doc.slice(range!.from, range!.to)).toBe(":::")
  })

  it("returns null for non-container lines", () => {
    const doc = "普通段落\n:::"
    expect(rangeFor(doc, 0)).toBeNull()
  })

  it("returns null for an unclosed container", () => {
    const doc = "::: body.paragraph.indent:2em\n没有闭合"
    expect(rangeFor(doc, 0)).toBeNull()
  })
})
