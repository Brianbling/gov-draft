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
    const letterSpacing = buildCharGridLetterSpacing(
      level,
      headingConfig?.paragraph.charsPerLine
    )
    const gridTrailing = buildCharGridTrailingCompensation(
      level,
      headingConfig?.paragraph.charsPerLine
    )

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
        ...(letterSpacing ? [letterSpacing] : []),
      ])
    )

    if (gridTrailing) {
      rules.push(
        styleRule(
          scopeSelectors(
            selectors.map((selector) => `${selector}::after`),
            host.rootContent
          ),
          [declaration("content", '""'), gridTrailing]
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
