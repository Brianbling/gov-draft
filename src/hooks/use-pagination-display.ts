import type { PageRenderMeta } from './use-paginator'
import type { PaginationConfig } from '@/engine/schema'
import { evaluateNumericTemplateExpression } from '@/engine/utils/template-expression-utils'
import { formatByStyle } from '@/engine/utils/number-format-utils'

const EXPR_PATTERN = /\{([^{}]+)\}/g

function formatNumber(value: number, config: PaginationConfig | null): string {
  const style = config?.numberStyle ?? 'arabic'
  if (!Number.isFinite(value)) return ''
  if (!Number.isInteger(value)) return String(Number(value.toFixed(2)))
  return formatByStyle(value, style)
}

function evalExpression(
  expr: string,
  ctx: Record<string, number>,
  config: PaginationConfig | null,
): string {
  const evaluated = evaluateNumericTemplateExpression(expr, ctx)
  if (evaluated === null) return ''
  return formatNumber(evaluated, config)
}

function clampToMargin(offset: string | number, marginVar: string): string {
  return `min(${offset}, var(${marginVar}))`
}

export function getPaginationText(meta: PageRenderMeta): string {
  const cfg = meta.pagination
  if (!cfg) return ''
  const ctx = {
    currentPage: meta.globalPage,
    CurrentPage: meta.globalPage,
    totalPage: meta.globalTotal,
    TotalPage: meta.globalTotal,
  }
  return cfg.format.replace(EXPR_PATTERN, (_m, expr: string) =>
    evalExpression(expr, ctx, cfg),
  )
}

export function getPaginationInlineStyle(
  meta: PageRenderMeta,
  pageIndex: number,
): Record<string, string> {
  const cfg = meta.pagination
  if (!cfg) return {}
  const style: Record<string, string> = {
    fontFamily: cfg.style.fonts.cjkFamily,
    fontSize: String(cfg.style.size),
    fontWeight: String(cfg.style.weight),
    color: cfg.style.colors.text,
  }
  const { vertical, horizontal } = cfg.position
  // The vertical offset is measured from the content-area (版心) edge,
  // positive pointing downward (toward the bottom of the paper).
  if (vertical.anchor === 'top') {
    // 0 sits at the content top edge; growing offset moves down into the page.
    style.top = `calc(var(--page-margins-top) + ${vertical.offset})`
  } else {
    // 0 sits at the content bottom edge; growing offset moves down into the margin.
    style.bottom = `calc(var(--page-margins-bottom) - ${vertical.offset})`
  }
  if (horizontal.anchor === 'center') {
    style.left = `calc(50% + ${horizontal.offset})`
    style.transform = 'translateX(-50%)'
    return style
  }
  if (horizontal.anchor === 'left') {
    style.left = clampToMargin(horizontal.offset, '--page-margins-left')
    return style
  }
  if (horizontal.anchor === 'right') {
    style.right = clampToMargin(horizontal.offset, '--page-margins-right')
    return style
  }
  const isOdd = (pageIndex + 1) % 2 === 1
  const useRight = horizontal.anchor === 'outside' ? isOdd : !isOdd
  if (useRight) {
    style.right = clampToMargin(horizontal.offset, '--page-margins-right')
  } else {
    style.left = clampToMargin(horizontal.offset, '--page-margins-left')
  }
  return style
}
