import { describe, expect, it } from "vitest"
import { compileRule } from "../compiler"
import { DEFAULT_HOST } from "../default-host"
import { getBuiltinRules } from "../../builtin-rules"
import type { HostSelectors } from "../types"
import { createValidRule } from "./fixtures"

describe("compileRule", () => {
  it("compiles valid rule into tokens/rules/cssText", () => {
    const validRule = createValidRule()
    const compiled = compileRule(validRule, DEFAULT_HOST)
    const expectedPageMargin = `${validRule.page.margins.top} ${validRule.page.margins.right} ${validRule.page.margins.bottom} ${validRule.page.margins.left}`

    expect(Object.keys(compiled.tokens).length).toBeGreaterThan(10)
    expect(compiled.rules.length).toBeGreaterThan(0)
    expect(compiled.cssText).toContain(":root")
    expect(compiled.cssText).toContain("--content-body-fonts-latin-family")
    expect(compiled.cssText).toContain("--content-body-fonts-cjk-family")
    expect(compiled.cssText).toContain("--content-body-paragraph-indent")
    expect(compiled.cssText).toContain("--content-h2-paragraph-indent")
    expect(compiled.cssText).toContain("--content-h2-paragraph-spacing-before")
    expect(compiled.cssText).toContain(
      "--content-h1-paragraph-spacing-before: 2lh;"
    )
    expect(compiled.cssText).toContain(
      "--content-h1-paragraph-spacing-after: 1lh;"
    )
    expect(compiled.cssText).toContain(".cn-quote")
    expect(compiled.cssText).toContain(".cn-book-title")
    expect(compiled.cssText).toContain(".latin-text")
    expect(compiled.cssText).toContain("@page")
    expect(compiled.cssText).toContain(
      ".paper-sheet.preview-content, .export-document"
    )
    expect(compiled.cssText).toContain(
      "padding: var(--page-margins-top) var(--page-margins-right) var(--page-margins-bottom) var(--page-margins-left);"
    )
    expect(compiled.cssText).toContain(`margin: ${expectedPageMargin};`)
    expect(compiled.cssText).toContain(
      ".preview-content .local-style-container"
    )
    // 容器必须继承正文排版（font/size/weight/line-height），否则容器级字体覆盖
    // （版记 14pt、红头等）不会级联到内部段落——audit §7.2.4/§7.4.2 依赖此行为。
    expect(compiled.cssText).toContain(
      ".preview-content .local-style-container, .export-document .local-style-container"
    )
    expect(compiled.cssText).toContain(
      "font-size: var(--content-body-style-size);"
    )
    expect(compiled.cssText).toContain(
      "font-weight: var(--content-body-style-weight);"
    )
    expect(compiled.cssText).toContain(
      "line-height: var(--content-body-paragraph-spacing-line-height);"
    )
    expect(compiled.cssText).toContain("break-inside: auto;")
  })

  it("provides builtin rules from yaml source", () => {
    const rules = getBuiltinRules()
    expect(rules.length).toBeGreaterThan(1)
    expect(rules[0]?.name).toContain("GB/T 33476-2016")
    expect(rules.some((rule) => rule.name.includes("GB/T 9704-2012"))).toBe(
      true
    )
  })

  it("generates tokens for custom content level without adding new style rules", () => {
    const baseRule = createValidRule()
    const baseCompiled = compileRule(baseRule, DEFAULT_HOST)

    const customRule = createValidRule()
    const appendix = JSON.parse(JSON.stringify(customRule.content.body))
    appendix.paragraph.indent = "3em"
    customRule.content.appendix = appendix

    const compiled = compileRule(customRule, DEFAULT_HOST)
    expect(compiled.tokens["--content-appendix-paragraph-indent"]).toBe("3em")
    expect(compiled.cssText).toContain(
      "--content-appendix-paragraph-indent: 3em;"
    )
    expect(compiled.rules).toHaveLength(baseCompiled.rules.length)
  })

  it("emits a calc-based letter-spacing grid when charsPerLine is set", () => {
    // The builtin rule (33476) sets body charsPerLine=28 and h1 charsPerLine=20.
    // The grid value depends only on page width/margins/font-size, never on
    // rendered content, so heading numbering prefixes cannot perturb it.
    const compiled = compileRule(createValidRule(), DEFAULT_HOST)

    expect(compiled.cssText).toContain(
      "letter-spacing: var(--content-body-paragraph-letter-spacing, calc((var(--page-dimension-width) - var(--page-margins-left) - var(--page-margins-right)) / 28 - var(--content-body-style-size)));"
    )
    // 标题 h1 的字格 calc 以 content.h1.paragraph.letterSpacing 变量为优先
    // （容器级字号覆盖后需要同步覆盖字距，见 heading-builder），未覆盖时回退到 calc。
    expect(compiled.cssText).toContain(
      "letter-spacing: var(--content-h1-paragraph-letter-spacing, calc((var(--page-dimension-width) - var(--page-margins-left) - var(--page-margins-right)) / 20 - var(--content-h1-style-size)));"
    )
  })

  it("M3：字格 letter-spacing 生成末字尾距补偿（p::after / h1::after 负 margin-right）", () => {
    // letter-spacing 在行末字符后仍附加一个 spacing，整行等宽行会把第 N 字挤到
    // 换行位（off-by-one）。::after 零宽元素用负 margin-right 抵消该尾距。
    const compiled = compileRule(createValidRule(), DEFAULT_HOST)

    expect(compiled.cssText).toContain(
      ".preview-content p::after, .export-document p::after"
    )
    expect(compiled.cssText).toContain('content: "";')
    expect(compiled.cssText).toContain(
      "margin-right: calc(-1 * (var(--content-body-paragraph-letter-spacing, (var(--page-dimension-width) - var(--page-margins-left) - var(--page-margins-right)) / 28 - var(--content-body-style-size))));"
    )
    // 标题 h1（charsPerLine=20）同样有尾距补偿，与 letter-spacing 同变量同步
    expect(compiled.cssText).toContain(
      "margin-right: calc(-1 * (var(--content-h1-paragraph-letter-spacing, (var(--page-dimension-width) - var(--page-margins-left) - var(--page-margins-right)) / 20 - var(--content-h1-style-size))));"
    )
  })

  it("M3：字格下内联 span（.latin-text 等）显式重置 letter-spacing: 0，避免继承字格被拉宽", () => {
    const compiled = compileRule(createValidRule(), DEFAULT_HOST)

    expect(compiled.cssText).toContain(
      ".preview-content .latin-text, .export-document .latin-text"
    )
    expect(compiled.cssText).toContain("letter-spacing: 0;")
    // 标题行内的 span 同样重置（h1 .latin-text）
    expect(compiled.cssText).toContain(
      ".preview-content h1 .latin-text, .export-document h1 .latin-text"
    )
  })

  it("omits letter-spacing when charsPerLine is unset", () => {
    const rule = createValidRule()
    Object.values(rule.content).forEach((item) => {
      delete (item as { paragraph: { charsPerLine?: number } }).paragraph
        .charsPerLine
    })
    const compiled = compileRule(rule, DEFAULT_HOST)

    expect(compiled.cssText).not.toContain("letter-spacing")
    // 无字格时也不生成 ::after 尾距补偿与 span 重置（避免为无字格文档注入无用规则）
    expect(compiled.cssText).not.toContain("p::after")
    expect(compiled.cssText).not.toContain("margin-right")
  })

  it("uses injected custom host selectors instead of defaults", () => {
    const customHost: HostSelectors = {
      rootContent: [".custom-preview", ".custom-export"],
      paperSheet: [".custom-sheet"],
      exportDocument: [".custom-export"],
      appShell: ["#custom-app"],
      printContainer: [".custom-print"],
      paperContent: [".custom-sheet.custom-preview", ".custom-export"],
    }
    const compiled = compileRule(createValidRule(), customHost)

    expect(compiled.cssText).toContain(".custom-preview .latin-text")
    expect(compiled.cssText).toContain(".custom-export .latin-text")
    expect(compiled.cssText).not.toContain(".preview-content")
  })
})
