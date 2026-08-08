import { describe, expect, it } from "vitest"
import { paginateBlocks } from "../use-paginator"

/**
 * jsdom never runs layout, so every HTMLElement reports scrollHeight === 0 and
 * isOverflowing() would always be false. To exercise the paginator's overflow
 * detection and binary-search splitting, model scrollHeight as growing with
 * the node's text length. This is a proxy for real reflow, but it drives the
 * exact same algorithm paths (page breaks, splits, degradation).
 */
function makeMeasure(clientHeight: number, lineHeight: number): HTMLElement {
  const el = document.createElement("div")
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: clientHeight,
  })
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get() {
      const len = (el.textContent ?? "").length
      return Math.max(1, Math.ceil((len + 1) / 10) * lineHeight)
    },
  })
  return el
}

const baseOptions = {
  overflowTolerancePx: 0.35,
  maxSplitIterations: 1000,
  styleWrapperTagNames: new Set<string>(),
  localStyleContainerClassName: "",
}

function textOf(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent ?? ""
}

describe("paginateBlocks", () => {
  it("keeps all fitting blocks on a single page", () => {
    const measure = makeMeasure(1000, 20)
    const pages = paginateBlocks(
      ["<p>a</p>", "<p>b</p>", "<p>c</p>"],
      measure,
      baseOptions
    )
    expect(pages).toHaveLength(1)
    expect(pages[0]).toBe("<p>a</p><p>b</p><p>c</p>")
  })

  it("H1 能放下时不再强制换页（版头独占页修复：红头+标题 H1 可同页）", () => {
    const measure = makeMeasure(1000, 20)
    const pages = paginateBlocks(
      ["<h1>t</h1>", "<p>b</p>"],
      measure,
      baseOptions
    )
    expect(pages).toHaveLength(1)
    expect(pages[0]).toContain("<h1>t</h1>")
  })

  it("H1 放不下时才换页（内容填满后 H1 正常分页）", () => {
    const measure = makeMeasure(1000, 20)
    const blocks = [
      `<p>${"x".repeat(600)}</p>`,
      "<h1>标题</h1>",
      "<p>b</p>",
    ]
    const pages = paginateBlocks(blocks, measure, baseOptions)
    expect(pages.length).toBeGreaterThan(1)
    const joined = pages.map(textOf).join("")
    expect(joined).toBe(`${"x".repeat(600)}标题b`)
  })

  it("splits an oversized paragraph across pages without losing content", () => {
    const measure = makeMeasure(1000, 20)
    const body = "x".repeat(600)
    const pages = paginateBlocks([`<p>${body}</p>`], measure, baseOptions)
    expect(pages.length).toBeGreaterThan(1)
    const joined = pages.map(textOf).join("")
    expect(joined).toBe(body)
  })

  it("preserves content across child-node splits", () => {
    const measure = makeMeasure(1000, 20)
    const child = `<b>${"y".repeat(300)}</b>`
    const body = `<p>${"x".repeat(500)}${child}${"z".repeat(300)}</p>`
    const pages = paginateBlocks([body], measure, baseOptions)
    expect(pages.length).toBeGreaterThan(1)
    const joined = pages.map(textOf).join("")
    expect(joined).toBe(
      `${"x".repeat(500)}${"y".repeat(300)}${"z".repeat(300)}`
    )
  })

  it("degrades to whole-block pages instead of throwing when the split budget is exhausted", () => {
    const measure = makeMeasure(1000, 20)
    const body = "x".repeat(1500)
    const options = { ...baseOptions, maxSplitIterations: 1 }
    const pages = paginateBlocks([`<p>${body}</p>`], measure, options)
    // Split budget exhausted after the first split: the remainder is flushed
    // whole (one oversized page) rather than split again — 2 pages, no throw.
    expect(pages.length).toBe(2)
    const joined = pages.map(textOf).join("")
    expect(joined).toBe(body)
  })

  it("keep-together 块不可拆分：超大落款整块独占一页（不拆散署名与日期）", () => {
    const measure = makeMeasure(1000, 20)
    const body = "x".repeat(500)
    const block = `<div class="keep-together"><p>${body}</p><p>date</p></div>`
    const pages = paginateBlocks([block], measure, baseOptions)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toContain(`<p>${body}</p>`)
    expect(pages[0]).toContain("<p>date</p>")
  })

  it("同尺寸普通段落会拆分、keep-together 块不会（对照）", () => {
    const measure = makeMeasure(1000, 20)
    const body = "x".repeat(500)
    const plainPages = paginateBlocks([`<p>${body}</p>`], measure, baseOptions)
    expect(plainPages.length).toBeGreaterThan(1)
    const keptPages = paginateBlocks(
      [`<div class="keep-together"><p>${body}</p></div>`],
      measure,
      baseOptions
    )
    expect(keptPages).toHaveLength(1)
  })

  it("当前页有内容时，keep-together 块溢出后整块移到下一页（不被拆分）", () => {
    const measure = makeMeasure(1000, 20)
    const block = `<div class="keep-together"><p>${"x".repeat(500)}</p><p>date</p></div>`
    const pages = paginateBlocks([`<p>filler</p>`, block], measure, baseOptions)
    expect(pages.length).toBe(2)
    expect(pages[0]).toContain("<p>filler</p>")
    expect(pages[1]).toContain(`<p>${"x".repeat(500)}</p>`)
    expect(pages[1]).toContain("<p>date</p>")
  })
})
