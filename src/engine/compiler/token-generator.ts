import type { RuleConfig } from '../schema'
import { toCssCustomProperty } from './css-variable'
import { sanitizeCssValue } from '../utils/css-sanitize-utils'
import { resolvePageDimensions } from '../utils/page-metrics-utils'
import { isContentItemConfig, normalizeParagraphSpacing } from './compiler-internals'

function setToken(tokens: Record<string, string>, path: string, value: unknown): void {
  tokens[toCssCustomProperty(path)] = sanitizeCssValue(value)
}

function setParagraphSpacingToken(tokens: Record<string, string>, path: string, value: unknown): void {
  tokens[toCssCustomProperty(path)] = normalizeParagraphSpacing(value)
}

export function generateRuleTokens(config: RuleConfig): Record<string, string> {
  const tokens: Record<string, string> = {}
  const pageDimensions = resolvePageDimensions(config.page.size, config.page.orientation, config.page.dimensions)

  Object.entries(config.content).forEach(([level, value]) => {
    if (!isContentItemConfig(value)) {
      return
    }

    const item = value
    setToken(tokens, `content.${level}.fonts.latinFamily`, item.fonts.latinFamily)
    setToken(tokens, `content.${level}.fonts.cjkFamily`, item.fonts.cjkFamily)
    setToken(tokens, `content.${level}.fonts.cnQuoteFamily`, item.fonts.cnQuoteFamily ?? item.fonts.cjkFamily)
    setToken(tokens, `content.${level}.fonts.cnBookTitleFamily`, item.fonts.cnBookTitleFamily ?? item.fonts.cjkFamily)

    setToken(tokens, `content.${level}.style.size`, item.style.size)
    setToken(tokens, `content.${level}.style.weight`, item.style.weight)
    setToken(tokens, `content.${level}.style.colors.text`, item.style.colors.text)
    setToken(tokens, `content.${level}.style.colors.background`, item.style.colors.background)

    setToken(tokens, `content.${level}.paragraph.align`, item.paragraph.align)
    setToken(tokens, `content.${level}.paragraph.indent`, item.paragraph.indent)
    setToken(tokens, `content.${level}.paragraph.spacing.lineHeight`, item.paragraph.spacing.lineHeight)
    setParagraphSpacingToken(tokens, `content.${level}.paragraph.spacing.before`, item.paragraph.spacing.before)
    setParagraphSpacingToken(tokens, `content.${level}.paragraph.spacing.after`, item.paragraph.spacing.after)
  })

  setToken(tokens, 'page.size', config.page.size ?? 'A4')
  setToken(tokens, 'page.orientation', config.page.orientation ?? 'portrait')
  setToken(tokens, 'page.margins.top', config.page.margins.top)
  setToken(tokens, 'page.margins.right', config.page.margins.right)
  setToken(tokens, 'page.margins.bottom', config.page.margins.bottom)
  setToken(tokens, 'page.margins.left', config.page.margins.left)
  setToken(tokens, 'page.dimension.width', pageDimensions.width)
  setToken(tokens, 'page.dimension.height', pageDimensions.height)

  return tokens
}
