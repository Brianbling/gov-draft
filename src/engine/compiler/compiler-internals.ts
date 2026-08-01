import type { AtRule, StyleDeclaration, StyleRule } from './types'
import type { ContentItemConfig, PageConfig, RuleConfig } from '../schema'
import { toCssCustomProperty } from './css-variable'
import { sanitizeCssProperty, sanitizeCssValue } from '../utils/css-sanitize-utils'

export const PARAGRAPH_LINES_PATTERN = /^(-?\d+(\.\d+)?)lines$/

export type HeadingStyleTarget = {
  level: string
  selectors: string[]
}

export function normalizeParagraphSpacing(value: unknown): string {
  const normalized = sanitizeCssValue(value)
  if (!normalized) {
    return '0'
  }
  const matched = normalized.match(PARAGRAPH_LINES_PATTERN)
  if (!matched) {
    return normalized
  }

  const lines = matched[1] ?? '0'
  return `${lines}lh`
}

export function isContentItemConfig(value: unknown): value is ContentItemConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  const style = candidate.style
  const paragraph = candidate.paragraph

  return (
    !!candidate.fonts &&
    typeof candidate.fonts === 'object' &&
    !!style &&
    typeof style === 'object' &&
    !!(style as Record<string, unknown>).colors &&
    typeof (style as Record<string, unknown>).colors === 'object' &&
    !!paragraph &&
    typeof paragraph === 'object' &&
    !!(paragraph as Record<string, unknown>).spacing &&
    typeof (paragraph as Record<string, unknown>).spacing === 'object'
  )
}

export function declaration(property: string, value: unknown): StyleDeclaration {
  return {
    property: sanitizeCssProperty(property),
    value: sanitizeCssValue(value)
  }
}

export function styleRule(selectors: string[], declarations: StyleDeclaration[]): StyleRule {
  return {
    type: 'style',
    selectors,
    declarations
  }
}

export function atRule(name: string, options: Omit<AtRule, 'type' | 'name'> = {}): AtRule {
  return {
    type: 'at-rule',
    name,
    ...options
  }
}

export function buildFontFamilyValue(primaryPath: string, fallbackPath: string): string {
  return `var(${toCssCustomProperty(primaryPath)}, var(${toCssCustomProperty(fallbackPath)}))`
}

export function buildContentFontPath(level: string, suffix: string): string {
  return `content.${level}.fonts.${suffix}`
}

export function resolveHeadingTargets(content: RuleConfig['content']): HeadingStyleTarget[] {
  return Object.keys(content)
    .map((level): HeadingStyleTarget | null => {
      if (level === 'body') {
        return null
      }

      const matched = /^h(\d+)$/.exec(level)
      if (!matched) {
        return null
      }

      const headingIndex = Number.parseInt(matched[1] ?? '', 10)
      if (!Number.isFinite(headingIndex) || headingIndex < 1) {
        return null
      }

      if (headingIndex === 4) {
        return {
          level,
          selectors: ['h4', 'h5', 'h6']
        }
      }

      if (headingIndex > 6) {
        return {
          level,
          selectors: ['h6']
        }
      }

      return {
        level,
        selectors: [`h${headingIndex}`]
      }
    })
    .filter((item): item is HeadingStyleTarget => item !== null)
    .sort((left, right) => {
      const leftRank = Number.parseInt(left.level.slice(1), 10)
      const rightRank = Number.parseInt(right.level.slice(1), 10)
      return leftRank - rightRank
    })
}

export function buildPageSizeValue(page: PageConfig, dimensions: { width: string; height: string }): string {
  const size = sanitizeCssValue(page.size)
  const orientation = sanitizeCssValue(page.orientation ?? 'portrait')

  if (size.length > 0) {
    return `${size} ${orientation}`.trim()
  }

  return `${dimensions.width} ${dimensions.height}`
}

export function mapTokensToDeclarations(tokens: Record<string, string>): StyleDeclaration[] {
  return Object.entries(tokens).map(([property, value]) => declaration(property, value))
}

// Emits a CJK character-grid letter-spacing for the given content level when
// charsPerLine is set. The browser computes (版心宽 / charsPerLine − 字号) at
// layout time, so each line holds exactly charsPerLine full-width characters.
// The value depends only on page width, margins, and font size — never on the
// rendered content — so heading numbering prefixes and .latin-text spans do
// not perturb the grid. Returns null when charsPerLine is unset.
export function buildCharGridLetterSpacing(level: string, charsPerLine: number | null | undefined): StyleDeclaration | null {
  if (typeof charsPerLine !== 'number' || !Number.isInteger(charsPerLine) || charsPerLine <= 0) {
    return null
  }

  const contentWidth = `(var(${toCssCustomProperty('page.dimension.width')}) - var(${toCssCustomProperty('page.margins.left')}) - var(${toCssCustomProperty('page.margins.right')}))`
  const fontSize = `var(${toCssCustomProperty(`content.${level}.style.size`)})`

  return declaration('letter-spacing', `calc(${contentWidth} / ${charsPerLine} - ${fontSize})`)
}
