import type { PageRenderMeta } from "./use-paginator"
import type { PaginationConfig } from "@/engine/schema"
import { evaluateNumericTemplateExpression } from "@/engine/utils/template-expression-utils"
import { formatByStyle } from "@/engine/utils/number-format-utils"

const EXPR_PATTERN = /\{([^{}]+)\}/g

function formatNumber(value: number, config: PaginationConfig | null): string {
  const style = config?.numberStyle ?? "arabic"
  if (!Number.isFinite(value)) return ""
  if (!Number.isInteger(value)) return String(Number(value.toFixed(2)))
  return formatByStyle(value, style)
}

function evalExpression(
  expr: string,
  ctx: Record<string, number>,
  config: PaginationConfig | null
): string {
  const evaluated = evaluateNumericTemplateExpression(expr, ctx)
  if (evaluated === null) return ""
  return formatNumber(evaluated, config)
}

export function getPaginationText(
  meta: PageRenderMeta,
  pageIndex?: number
): string {
  const cfg = meta.pagination
  if (!cfg) return ""
  // GB/T 9704-2012 10.1（信函/命令）与 5.2.1 版心惯例：首页（第 1 页）不编页码。
  if (cfg.hideFirstPage === true && pageIndex === 0) return ""
  const ctx = {
    currentPage: meta.globalPage,
    CurrentPage: meta.globalPage,
    totalPage: meta.globalTotal,
    TotalPage: meta.globalTotal,
  }
  return cfg.format.replace(EXPR_PATTERN, (_m, expr: string) =>
    evalExpression(expr, ctx, cfg)
  )
}

export function getPaginationInlineStyle(
  meta: PageRenderMeta,
  pageIndex: number
): Record<string, string> {
  const cfg = meta.pagination
  if (!cfg) return {}
  const style: Record<string, string> = {
    fontFamily: cfg.style.fonts.cjkFamily,
    fontSize: String(cfg.style.size),
    fontWeight: String(cfg.style.weight),
    color: cfg.style.colors.text,
    // 页码行高必须归 1：正文行高 28.95pt 会撑大元素盒，使"距版心下边缘"按盒高
    // 而不是行框计算，垂直定位整体失真；nowrap 防止溢出到换行。
    lineHeight: "1",
    whiteSpace: "nowrap",
  }
  const { vertical, horizontal } = cfg.position
  // The vertical offset is measured from the content-area (版心) edge,
  // positive pointing downward (toward the bottom of the paper).
  if (vertical.anchor === "top") {
    // 0 sits at the content top edge; growing offset moves down into the page.
    style.top = `calc(var(--page-margins-top) + ${vertical.offset})`
  } else {
    // 0 sits at the content bottom edge; growing offset moves down into the margin.
    // 版心下边缘在纸底上方 page-margins-bottom 处，bottom 减去 offset 即让元素
    // 底缘落在版心下边缘下方 offset 处（GB/T 9704 §7.5：一字线上距版心下边缘 7mm）。
    style.bottom = `calc(var(--page-margins-bottom) - ${vertical.offset})`
  }
  if (horizontal.anchor === "center") {
    style.left = `calc(50% + ${horizontal.offset})`
    style.transform = "translateX(-50%)"
    return style
  }
  // 空一字（offset，如 14pt）相对版心边缘起算：left 定位到版心盒左缘再右移 offset，
  // 即"双页码居左空一字"。定位基准是版心盒（.preview-content，其 padding 即页边距），
  // 而非纸面边缘——否则数字会落入左边距贴纸边（靠左顶格）。
  if (horizontal.anchor === "left") {
    style.left = `calc(var(--page-margins-left) + ${horizontal.offset})`
    return style
  }
  if (horizontal.anchor === "right") {
    style.right = `calc(var(--page-margins-right) + ${horizontal.offset})`
    return style
  }
  const isOdd = (pageIndex + 1) % 2 === 1
  const useRight = horizontal.anchor === "outside" ? isOdd : !isOdd
  if (useRight) {
    style.right = `calc(var(--page-margins-right) + ${horizontal.offset})`
  } else {
    style.left = `calc(var(--page-margins-left) + ${horizontal.offset})`
  }
  return style
}
