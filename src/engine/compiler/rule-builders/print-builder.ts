import type { RuleConfig } from '../../schema'
import type { HostSelectors, StyleNode } from '../types'
import { scopeSelectors } from '../css-scope'
import { toCssCustomProperty } from '../css-variable'
import { sanitizeCssValue } from '../../utils/css-sanitize-utils'
import { resolvePageDimensions } from '../../utils/page-metrics-utils'
import { atRule, buildPageSizeValue, declaration, styleRule } from '../compiler-internals'

export function buildPrintRules(config: RuleConfig, host: HostSelectors): StyleNode[] {
  const pageDimensions = resolvePageDimensions(config.page.size, config.page.orientation, config.page.dimensions)
  const pageSizeValue = buildPageSizeValue(config.page, pageDimensions)
  const pageMarginValue = `${sanitizeCssValue(config.page.margins.top)} ${sanitizeCssValue(config.page.margins.right)} ${sanitizeCssValue(config.page.margins.bottom)} ${sanitizeCssValue(config.page.margins.left)}`

  return [
    atRule('media', {
      prelude: 'print',
      children: [
        styleRule(['html', 'body', ...host.appShell], [declaration('height', 'auto'), declaration('background', '#fff')]),
        styleRule(['body'], [declaration('margin', '0'), declaration('padding', '0')]),
        styleRule(host.exportDocument, [declaration('max-width', '100%')]),
        styleRule(host.paperSheet, [
          declaration('width', `var(${toCssCustomProperty('page.dimension.width')})`),
          declaration('height', `var(${toCssCustomProperty('page.dimension.height')})`),
          declaration('min-height', `var(${toCssCustomProperty('page.dimension.height')})`),
          declaration('margin', '0 auto'),
          declaration(
            'padding',
            `var(${toCssCustomProperty('page.margins.top')}) var(${toCssCustomProperty('page.margins.right')}) var(${toCssCustomProperty('page.margins.bottom')}) var(${toCssCustomProperty('page.margins.left')})`
          ),
          declaration('box-shadow', 'none'),
          declaration('border-radius', '0'),
          declaration('break-after', 'page'),
          declaration('page-break-after', 'always')
        ]),
        styleRule(host.paperSheet.map((selector) => `${selector}:last-child`), [declaration('break-after', 'auto'), declaration('page-break-after', 'auto')]),
        styleRule(host.printContainer, [
          declaration('color', '#000'),
          declaration('background', '#fff'),
          declaration('break-inside', 'auto')
        ]),
        atRule('page', {
          declarations: [
            declaration('size', pageSizeValue),
            declaration('margin', pageMarginValue)
          ]
        }),
        styleRule(scopeSelectors(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], host.exportDocument), [declaration('page-break-after', 'avoid')]),
        styleRule(scopeSelectors(['p', 'li'], host.exportDocument), [declaration('orphans', '3'), declaration('widows', '3')])
      ]
    })
  ]
}
