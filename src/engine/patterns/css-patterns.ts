/**
 * CSS value validation patterns — single source of truth.
 * validator.ts and primitives.ts both import from here.
 */
export const CSS_LENGTH_PATTERN = /^0$|^-?\d+(\.\d+)?(mm|cm|in|pt|px|em|rem|%)$/

/**
 * 无单位数字标量（`16` / `28.95` / `-5`）。YAML 把 `size: 16` 解析成 number，
 * schema 的 UnitlessNumericToCssScalar 把这类值归一成字符串再持久化；validator
 * 必须接受同一集合，否则"过 zod 却挂 validateRule"会在 loadRule throw → 重启
 * 静默丢弃用户规则（M-2）。
 */
export const CSS_UNITLESS_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/

export const CSS_LINE_HEIGHT_PATTERN =
  /^-?\d+(\.\d+)?$|^0$|^-?\d+(\.\d+)?(mm|cm|in|pt|px|em|rem|%)$/

export const CSS_PARAGRAPH_SPACING_PATTERN =
  /^0$|^-?\d+(\.\d+)?(mm|cm|in|pt|px|em|rem|%)$|^-?\d+(\.\d+)?lines$/

export const CSS_COLOR_PATTERN =
  /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgb\(.+\)|rgba\(.+\)|hsl\(.+\)|hsla\(.+\))$/

export const PAGINATION_EXPRESSION_ALLOWED_PATTERN = /^[0-9()+\-*/.\sA-Za-z_]+$/
