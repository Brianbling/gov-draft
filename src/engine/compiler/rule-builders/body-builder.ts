import type { RuleConfig } from "../../schema"
import type { HostSelectors, StyleNode } from "../types"
import { scopeSelectors } from "../css-scope"
import { toCssCustomProperty } from "../css-variable"
import {
  buildCharGridLetterSpacing,
  buildCharGridTrailingCompensation,
  buildContentFontPath,
  buildFontFamilyValue,
  declaration,
  styleRule,
} from "../compiler-internals"

export function buildBodyRules(
  config: RuleConfig,
  host: HostSelectors
): StyleNode[] {
  // Justified CJK text cannot stretch around an unbreakable Latin run, so a long
  // word drops to the next line and leaves a visible gap. break-all lets the run
  // break at the line edge to fill the line; non-justified text has no gap to fill.
  const bodyWordBreak =
    config.content.body.paragraph.align === "justify" ? "break-all" : "normal"
  const bodyLetterSpacing = buildCharGridLetterSpacing(
    "body",
    config.content.body.paragraph.charsPerLine
  )
  const bodyGridTrailing = buildCharGridTrailingCompensation(
    "body",
    config.content.body.paragraph.charsPerLine
  )
  return [
    styleRule(host.rootContent, [
      declaration(
        "font-family",
        `var(${toCssCustomProperty("content.body.fonts.cjkFamily")})`
      ),
      declaration(
        "font-size",
        `var(${toCssCustomProperty("content.body.style.size")})`
      ),
      declaration(
        "font-weight",
        `var(${toCssCustomProperty("content.body.style.weight")})`
      ),
      declaration(
        "line-height",
        `var(${toCssCustomProperty("content.body.paragraph.spacing.lineHeight")})`
      ),
      declaration(
        "color",
        `var(${toCssCustomProperty("content.body.style.colors.text")})`
      ),
      declaration(
        "background-color",
        `var(${toCssCustomProperty("content.body.style.colors.background")})`
      ),
      declaration("overflow-wrap", "break-word"),
    ]),
    styleRule(host.paperContent, [
      declaration(
        "padding",
        `var(${toCssCustomProperty("page.margins.top")}) var(${toCssCustomProperty("page.margins.right")}) var(${toCssCustomProperty("page.margins.bottom")}) var(${toCssCustomProperty("page.margins.left")})`
      ),
    ]),
    styleRule(scopeSelectors([".latin-text"], host.rootContent), [
      declaration(
        "font-family",
        buildFontFamilyValue(
          buildContentFontPath("body", "latinFamily"),
          buildContentFontPath("body", "cjkFamily")
        )
      ),
    ]),
    styleRule(scopeSelectors([".cn-quote"], host.rootContent), [
      declaration(
        "font-family",
        buildFontFamilyValue(
          buildContentFontPath("body", "cnQuoteFamily"),
          buildContentFontPath("body", "cjkFamily")
        )
      ),
    ]),
    styleRule(scopeSelectors([".cn-book-title"], host.rootContent), [
      declaration(
        "font-family",
        buildFontFamilyValue(
          buildContentFontPath("body", "cnBookTitleFamily"),
          buildContentFontPath("body", "cjkFamily")
        )
      ),
    ]),
    // 字格 letter-spacing 只应由 CJK 正文字符计（每格一字符）。内联 span
    // （.latin-text/.cn-quote/.cn-book-title）继承整行 letter-spacing 会被拉宽，
    // 显式重置为 0，保证字格由 CJK 行计、拉丁词/数字/引号不被拉伸（M3 ②）。
    // 仅当本内容级启用了字格（charsPerLine）时才需要重置。
    ...(bodyLetterSpacing
      ? [
          styleRule(scopeSelectors([".latin-text"], host.rootContent), [
            declaration("letter-spacing", "0"),
          ]),
          styleRule(scopeSelectors([".cn-quote"], host.rootContent), [
            declaration("letter-spacing", "0"),
          ]),
          styleRule(scopeSelectors([".cn-book-title"], host.rootContent), [
            declaration("letter-spacing", "0"),
          ]),
        ]
      : []),
    // 字格末字补偿：letter-spacing 在行末字符后仍附加一个 spacing，整行等宽行
    // 会因此把第 N 字挤到换行位（off-by-one）。::after 零宽元素用负 margin-right
    // 抵消该尾距（M3 ①）。与 buildCharGridLetterSpacing 成对出现，无字格时不生成。
    // 容器级字号覆盖（版记 14pt、红头 22pt）会同时覆盖 --content-body-style-size，
    // 补偿公式里的 fontSize 与 letter-spacing 同步更新，容器内仍然一致，无需特判。
    ...(bodyGridTrailing
      ? [
          styleRule(scopeSelectors(["p::after"], host.rootContent), [
            declaration("content", '""'),
            bodyGridTrailing,
          ]),
        ]
      : []),
    // Local-style containers must inherit body typography so container-level font
    // overrides (cjkFamily/size/weight/line-height) cascade to the inner paragraphs.
    // Without these, a container that sets e.g. --content-body-style-size: 14pt only
    // changes color/background; the text keeps the root body font. GB/T 9704 uses
    // container-level font overrides for 版记 (14pt 抄送/印发) and 红头.
    styleRule(scopeSelectors([".local-style-container"], host.rootContent), [
      declaration(
        "font-family",
        `var(${toCssCustomProperty("content.body.fonts.cjkFamily")})`
      ),
      declaration(
        "font-size",
        `var(${toCssCustomProperty("content.body.style.size")})`
      ),
      declaration(
        "font-weight",
        `var(${toCssCustomProperty("content.body.style.weight")})`
      ),
      declaration(
        "line-height",
        `var(${toCssCustomProperty("content.body.paragraph.spacing.lineHeight")})`
      ),
      declaration(
        "color",
        `var(${toCssCustomProperty("content.body.style.colors.text")})`
      ),
      declaration(
        "background-color",
        `var(${toCssCustomProperty("content.body.style.colors.background")})`
      ),
    ]),
    styleRule(scopeSelectors(["p"], host.rootContent), [
      declaration(
        "margin-top",
        `var(${toCssCustomProperty("content.body.paragraph.spacing.before")})`
      ),
      declaration(
        "margin-bottom",
        `var(${toCssCustomProperty("content.body.paragraph.spacing.after")})`
      ),
      declaration(
        "text-indent",
        `var(${toCssCustomProperty("content.body.paragraph.indent")})`
      ),
      declaration(
        "text-align",
        `var(${toCssCustomProperty("content.body.paragraph.align")})`
      ),
      declaration(
        "line-height",
        `var(${toCssCustomProperty("content.body.paragraph.spacing.lineHeight")})`
      ),
      declaration("word-break", bodyWordBreak),
      ...(bodyLetterSpacing ? [bodyLetterSpacing] : []),
    ]),
  ]
}
