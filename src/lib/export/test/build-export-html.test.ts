import { describe, it, expect } from "vitest"
import { buildExportHtml } from "../build-export-html"

describe("buildExportHtml", () => {
  it("每页包裹 .paper-sheet 并在页间插入分页符", () => {
    const html = buildExportHtml({
      pages: ["<p>page one</p>", "<p>page two</p>"],
      ruleCssText: ".body { color: red }",
    })
    const sheets = html.match(/class="paper-sheet[ "]/g) ?? []
    expect(sheets).toHaveLength(2)
    expect(html).toContain("page one")
    expect(html).toContain("page two")
    expect(html).toContain("break-after: page")
    expect(html).toContain("box-sizing: border-box")
  })

  it("注入 .paper-sheet 相对定位与 .paper-pagination 绝对定位,供页码正确显示", () => {
    const html = buildExportHtml({
      pages: ["<p>x</p>"],
      ruleCssText: "",
    })
    expect(html).toContain(".paper-pagination { position: absolute")
    expect(html).toContain("position: relative")
  })

  it("注入规则 CSS 与 @page(默认 A4 portrait,margin 0)", () => {
    const html = buildExportHtml({
      pages: ["<p>x</p>"],
      ruleCssText: ".body { color: red }",
    })
    expect(html).toContain(".body { color: red }")
    expect(html).toContain("@page")
    expect(html).toContain("size: A4 portrait")
    expect(html).toContain("margin: 0")
  })

  it("透传 pageSize / orientation / lang", () => {
    const html = buildExportHtml({
      pages: ["<p>x</p>"],
      ruleCssText: "",
      pageSize: "A3",
      orientation: "landscape",
      lang: "en",
    })
    expect(html).toContain("size: A3 landscape")
    expect(html).toContain('<html lang="en">')
  })

  it("最后一页不产生多余空白页(break-after: auto)", () => {
    const html = buildExportHtml({
      pages: ["<p>a</p>", "<p>b</p>"],
      ruleCssText: "",
    })
    expect(html).toContain(".paper-sheet:last-child")
    expect(html).toContain("break-after: auto")
  })

  it("空 pages 返回带空 body 的合法文档", () => {
    const html = buildExportHtml({ pages: [], ruleCssText: "" })
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).not.toContain('class="paper-sheet"')
  })
})
