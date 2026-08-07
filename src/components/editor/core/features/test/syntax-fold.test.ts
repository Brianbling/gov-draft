import { describe, expect, it, beforeEach } from "vitest"
import { EditorState, Text } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { foldState } from "@codemirror/language"
import {
  findSugarBlocks,
  refoldSugar,
  sugarFoldRange,
  sugarFoldEnabledExtensions,
} from "../syntax-fold"

// M-7 回归：refoldSugar(enable) 只折叠 `:::` 容器，不得动用 markdown 自带
// h1-h6 折叠——foldAll 会把 `# 标题` 一路折到文末，整篇文本肉眼消失。
describe("refoldSugar（M-7：只折叠 :: 容器，不碰标题折叠）", () => {
  let mount: HTMLDivElement
  let view: EditorView

  beforeEach(() => {
    mount = document.createElement("div")
    document.body.appendChild(mount)
  })

  function makeView(doc: string): EditorView {
    return new EditorView({
      doc,
      parent: mount,
      extensions: [...sugarFoldEnabledExtensions()],
    })
  }

  function closeView(v: EditorView): void {
    v.destroy()
    mount.remove()
  }

  function readFoldedRanges(v: EditorView): Array<{ from: number; to: number }> {
    const field = v.state.field(foldState, false)
    if (!field) return []
    const ranges: Array<{ from: number; to: number }> = []
    field.between(0, v.state.doc.length, (f, t) => {
      ranges.push({ from: f, to: t })
      return undefined
    })
    return ranges
  }

  it("有 :: 容器 + h1 标题的文档，启用折叠只折容器不折标题", () => {
    const doc = [
      "# 关于加强政务服务的通知",
      "",
      "::: content.body.paragraph.indent: 2em",
      "第一段正文。",
      ":::",
      "",
      "## 总体要求",
      "正文第二段。",
    ].join("\n")
    view = makeView(doc)
    refoldSugar(view, true)

    const ranges = readFoldedRanges(view)
    expect(ranges.length).toBeGreaterThan(0)
    // 折叠范围只覆盖 :: 闭合行（":::" 3 字符），不是从 # 标题到文末
    for (const r of ranges) {
      expect(doc.slice(r.from, r.to).trim()).toBe(":::")
      expect(r.to - r.from).toBeLessThanOrEqual(4)
    }
    closeView(view)
  })

  it("纯手写长文（无 ::）启用折叠不产生任何折叠", () => {
    view = makeView("# 标题\n\n正文一\n\n正文二")
    refoldSugar(view, true)
    expect(readFoldedRanges(view)).toHaveLength(0)
    closeView(view)
  })
})

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
