import type { RuleConfig } from '../../schema'
import type { StyleNode } from '../types'
import { sanitizeCssValue } from '../../utils/css-sanitize-utils'
import { resolvePageDimensions } from '../../utils/page-metrics-utils'
import { atRule, buildPageSizeValue, declaration } from '../compiler-internals'

export function buildPageRule(config: RuleConfig): StyleNode[] {
  const pageDimensions = resolvePageDimensions(config.page.size, config.page.orientation, config.page.dimensions)
  const pageSizeValue = buildPageSizeValue(config.page, pageDimensions)
  const pageMarginValue = `${sanitizeCssValue(config.page.margins.top)} ${sanitizeCssValue(config.page.margins.right)} ${sanitizeCssValue(config.page.margins.bottom)} ${sanitizeCssValue(config.page.margins.left)}`

  return [
    atRule('page', {
      declarations: [
        declaration('size', pageSizeValue),
        declaration('margin', pageMarginValue)
      ]
    })
  ]
}
