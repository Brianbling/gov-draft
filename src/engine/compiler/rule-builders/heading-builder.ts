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
  resolveHeadingTargets,
  styleRule,
} from "../compiler-internals"

export function buildHeadingRules(
  config: RuleConfig,
  host: HostSelectors
): StyleNode[] {
  const rules: StyleNode[] = []
  const headingTargets = resolveHeadingTargets(config.content)

  headingTargets.forEach((headingTarget) => {
    const level = headingTarget.level
    const selectors = headingTarget.selectors

    const headingConfig = config.content[level]
    const charsPerLine = headingConfig?.paragraph.charsPerLine
    const letterSpacing = buildCharGridLetterSpacing(level, charsPerLine)
    const gridTrailing = buildCharGridTrailingCompensation(level, charsPerLine)
    // 字格 letter-spacing 的 fallback（未覆盖时用的 calc 表达式原文）。
    const letterSpacingVarPath = `content.${level}.paragraph.letterSpacing`
    const letterSpacingVar = toCssCustomProperty(letterSpacingVarPath)
    // 容器级字号覆盖（如标题按字数缩字号）会重算字格 calc——字号缩小 → calc 增大
    // （22pt→16pt 时 442/20−字号 从 +0.1pt 暴增到 +6.1pt），字距反而撑大、抵消
    // "缩字号省空间"的目的。与 body 的 .local-style-container 规则（body-builder.ts）
    // 同构：这里消费 content.{level}.paragraph.letterSpacing 变量，`: : :` 描述符
    // 可显式覆盖字距；变量未设置时回退到字格 calc（默认行为不变）。
    const gridExpression = charsPerLine
      ? buildCharGridExpression(level, charsPerLine)
      : null

    rules.push(
      styleRule(scopeSelectors(selectors, host.rootContent), [
        declaration(
          "font-family",
          `var(${toCssCustomProperty(`content.${level}.fonts.cjkFamily`)})`
        ),
        declaration(
          "font-size",
          `var(${toCssCustomProperty(`content.${level}.style.size`)})`
        ),
        declaration(
          "font-weight",
          `var(${toCssCustomProperty(`content.${level}.style.weight`)})`
        ),
        declaration(
          "text-align",
          `var(${toCssCustomProperty(`content.${level}.paragraph.align`)})`
        ),
        declaration(
          "text-indent",
          `var(${toCssCustomProperty(`content.${level}.paragraph.indent`)})`
        ),
        declaration(
          "line-height",
          `var(${toCssCustomProperty(`content.${level}.paragraph.spacing.lineHeight`)})`
        ),
        declaration(
          "color",
          `var(${toCssCustomProperty(`content.${level}.style.colors.text`)})`
        ),
        declaration(
          "margin-top",
          `var(${toCssCustomProperty(`content.${level}.paragraph.spacing.before`)})`
        ),
        declaration(
          "margin-bottom",
          `var(${toCssCustomProperty(`content.${level}.paragraph.spacing.after`)})`
        ),
        ...(letterSpacing
          ? [
              declaration(
                "letter-spacing",
                `var(${letterSpacingVar}, ${letterSpacing.value})`
              ),
            ]
          : []),
      ])
    )

    if (gridTrailing && gridExpression) {
      // ::after 尾距补偿与 letter-spacing 同步：字格 calc 在行末字符后附加一个
      // spacing，::after 负 margin-right 抵消。容器覆盖 letter-spacing（如标题
      // 缩字号后设 0em 避免字距撑大）时，补偿必须用同一个变量覆盖值，否则
      // ::after 仍按字格 calc 补偿，与行内实际字距不一致。
      rules.push(
        styleRule(
          scopeSelectors(
            selectors.map((selector) => `${selector}::after`),
            host.rootContent
          ),
          [
            declaration("content", '""'),
            declaration(
              "margin-right",
              `calc(-1 * (var(${letterSpacingVar}, ${gridExpression})))`
            ),
          ]
        )
      )
    }

    const latinSelectors = selectors.map(
      (selector) => `${selector} .latin-text`
    )
    rules.push(
      styleRule(scopeSelectors(latinSelectors, host.rootContent), [
        declaration(
          "font-family",
          buildFontFamilyValue(
            buildContentFontPath(level, "latinFamily"),
            buildContentFontPath(level, "cjkFamily")
          )
        ),
        ...(letterSpacing ? [declaration("letter-spacing", "0")] : []),
      ])
    )

    const quoteSelectors = selectors.map((selector) => `${selector} .cn-quote`)
    rules.push(
      styleRule(scopeSelectors(quoteSelectors, host.rootContent), [
        declaration(
          "font-family",
          buildFontFamilyValue(
            buildContentFontPath(level, "cnQuoteFamily"),
            buildContentFontPath(level, "cjkFamily")
          )
        ),
        ...(letterSpacing ? [declaration("letter-spacing", "0")] : []),
      ])
    )

    const bookTitleSelectors = selectors.map(
      (selector) => `${selector} .cn-book-title`
    )
    rules.push(
      styleRule(scopeSelectors(bookTitleSelectors, host.rootContent), [
        declaration(
          "font-family",
          buildFontFamilyValue(
            buildContentFontPath(level, "cnBookTitleFamily"),
            buildContentFontPath(level, "cjkFamily")
          )
        ),
        ...(letterSpacing ? [declaration("letter-spacing", "0")] : []),
      ])
    )
  })

  return rules
}
