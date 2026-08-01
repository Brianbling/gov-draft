/**
 * CSS value validation patterns — single source of truth.
 * validator.ts and primitives.ts both import from here.
 */
export const CSS_LENGTH_PATTERN = /^0$|^-?\d+(\.\d+)?(mm|cm|in|pt|px|em|rem|%)$/

export const CSS_LINE_HEIGHT_PATTERN =
  /^-?\d+(\.\d+)?$|^0$|^-?\d+(\.\d+)?(mm|cm|in|pt|px|em|rem|%)$/

export const CSS_PARAGRAPH_SPACING_PATTERN =
  /^0$|^-?\d+(\.\d+)?(mm|cm|in|pt|px|em|rem|%)$|^-?\d+(\.\d+)?lines$/

export const CSS_COLOR_PATTERN =
  /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgb\(.+\)|rgba\(.+\)|hsl\(.+\)|hsla\(.+\))$/

export const PAGINATION_EXPRESSION_ALLOWED_PATTERN = /^[0-9()+\-*/.\sA-Za-z_]+$/
