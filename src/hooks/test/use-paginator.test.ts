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

  it("starts a new page before an H1 heading", () => {
    const measure = makeMeasure(1000, 20)
    const pages = paginateBlocks(
      ["<p>a</p>", "<h1>t</h1>", "<p>b</p>"],
      measure,
      baseOptions
    )
    expect(pages).toHaveLength(2)
    expect(pages[0]).toContain("<p>a</p>")
    expect(pages[1]).toContain("<h1>t</h1>")
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
})
