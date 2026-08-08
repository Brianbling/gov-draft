import type { RuleConfig } from "../../schema"
import type { HostSelectors, StyleNode } from "../types"
import { scopeSelectors } from "../css-scope"
import { toCssCustomProperty } from "../css-variable"
import {
  buildCharGridExpression,
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
  // 字格 letter-spacing 的 fallback（未覆盖时用的 calc 表达式原文）。容器级
  // 字号覆盖（红头 48px/版记 14pt）会把 --content-body-style-size 换成容器值，
  // calc 随字号变号（红头 28 格下 48px → 负字距重叠）。`: : :` 描述符通过
  // content.body.paragraph.letterSpacing 覆盖字距；这里消费该变量，变量未设时
  // 回退到字格 calc（默认行为不变）。::after 尾距补偿必须用同一变量覆盖值，
  // 否则仍按字格 calc 补偿、与行内实际字距不一致（→ 居中行被 +26.94px 的
  // ::after 压偏 13.5px，红头与文号对不齐）。
  const letterSpacingVar = toCssCustomProperty(
    "content.body.paragraph.letterSpacing"
  )
  const gridExpression = config.content.body.paragraph.charsPerLine
    ? buildCharGridExpression("body", config.content.body.paragraph.charsPerLine)
    : null
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
    // 容器覆盖 letter-spacing（红头 4pt）时，补偿用同一变量覆盖值——否则 ::after
    // 仍按字格 calc 补偿，与行内实际字距不一致，把居中行压偏半字距（见上）。
    ...(bodyGridTrailing && gridExpression
      ? [
          styleRule(scopeSelectors(["p::after"], host.rootContent), [
            declaration("content", '""'),
            declaration(
              "margin-right",
              `calc(-1 * (var(${letterSpacingVar}, ${gridExpression})))`
            ),
          ]),
        ]
      : []),
    // Local-style containers must inherit body typography so container-level font
    // overrides (cjkFamily/size/weight/line-height) cascade to the inner paragraphs.
    // Without these, a container that sets e.g. --content-body-style-size: 14pt only
    // changes color/background; the text keeps the root body font. GB/T 9704 uses
    // container-level font overrides for 版记 (14pt 抄送/印发) and 红头.
    //
    // letter-spacing: the char-grid rule below applies `calc(版心宽/charsPerLine − 字号)`
    // to every body `p`. A container that overrides font-size (e.g. 红头 22pt) keeps
    // the body charsPerLine:28, so the inherited calc goes negative (442pt/28−22pt≈−6.2pt)
    // and the red characters overlap. The container rule consumes
    // --content-body-paragraph-letter-spacing so a `:::` descriptor can override the
    // letter-spacing without fighting the char-grid calc. When the variable is unset
    // the root body value (the char-grid calc) is the fallback, so non-overriding
    // containers (版记 etc.) keep their current spacing. Only emitted when the body
    // actually enables the char grid — otherwise no letter-spacing exists to override.
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
      ...(bodyLetterSpacing
        ? [
            declaration(
              "letter-spacing",
              `var(${toCssCustomProperty("content.body.paragraph.letterSpacing")}, ${bodyLetterSpacing.value})`
            ),
          ]
        : []),
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
      ...(bodyLetterSpacing
        ? [
            declaration(
              "letter-spacing",
              `var(${letterSpacingVar}, ${bodyLetterSpacing.value})`
            ),
          ]
        : []),
    ]),
    // 红色分隔线（红头红线，GB/T 9704 §7.2.6）：通栏红色横线，位于发文字号
    // 下 4mm 处。由 red-rule-line 插件把 `---` 渲染为 `<hr class="red-rule-line">`。
    // border-top 2px 红色 + 上下 4mm 间距（上 4mm = 红线距上方要素、即文号）。
    styleRule(scopeSelectors([".red-rule-line"], host.rootContent), [
      declaration("border", "none"),
      declaration("border-top", "2px solid #e60012"),
      declaration("margin", "4mm 0"),
    ]),
    // 落款（署名+日期）原子块：分页器对 keep-together 容器整体处理、不拆分。
    // doc-number-line 标记上行文文号/签发人同行的容器（见 pagination-block-utils）。
    styleRule(scopeSelectors([".keep-together"], host.rootContent), [
      declaration("break-inside", "avoid"),
      declaration("page-break-inside", "avoid"),
    ]),
    // 上行文文号 + 签发人同行：flex 两端对齐（文号居左空一字、签发人靠右）。
    styleRule(scopeSelectors([".doc-number-line"], host.rootContent), [
      declaration("display", "flex"),
      declaration("justify-content", "space-between"),
    ]),
  ]
}
