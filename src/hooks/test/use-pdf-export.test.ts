import { describe, it, expect } from "vitest"
import { collectRenderedPages } from "../use-pdf-export"

describe("collectRenderedPages", () => {
  it("提取每个 .paper-sheet 的内容 div 与 .paper-pagination 页码 div", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <div class="paper-stack">
        <article class="paper-sheet"><div><p>one</p></div><div class="paper-pagination">1</div></article>
        <article class="paper-sheet"><div><p>two</p></div></article>
      </div>`
    const pages = collectRenderedPages(root)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toContain("<p>one</p>")
    expect(pages[0]).toContain("paper-pagination")
    expect(pages[0]).toContain("1")
    expect(pages[1]).toContain("<p>two</p>")
    expect(pages[1]).not.toContain("paper-pagination")
  })

  it("无 paper-sheet 时返回空数组", () => {
    const root = document.createElement("div")
    expect(collectRenderedPages(root)).toEqual([])
  })

  it("无 .paper-pagination 时仅返回内容 div", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <div class="paper-stack">
        <article class="paper-sheet"><div><p>solo</p></div></article>
      </div>`
    const pages = collectRenderedPages(root)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toContain("<p>solo</p>")
    expect(pages[0]).not.toContain("paper-pagination")
  })

  it("忽略 .paper-stack 之外的隐藏测量 sheet", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <div class="paper-stack">
        <article class="paper-sheet"><div><p>visible</p></div></article>
      </div>
      <div class="paper-measure">
        <article class="paper-sheet"><div><p>hidden measure</p></div></article>
      </div>`
    const pages = collectRenderedPages(root)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toContain("visible")
    expect(pages[0]).not.toContain("hidden measure")
  })
})
