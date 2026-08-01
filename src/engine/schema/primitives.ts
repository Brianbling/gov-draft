import { z } from 'zod'
import {
  CSS_LENGTH_PATTERN,
  CSS_LINE_HEIGHT_PATTERN,
  CSS_PARAGRAPH_SPACING_PATTERN,
  CSS_COLOR_PATTERN,
  PAGINATION_EXPRESSION_ALLOWED_PATTERN,
} from '../patterns/css-patterns'
import {
  LOCAL_STYLE_TARGET_PATH_PATTERN,
  UNSAFE_PATH_SEGMENT_SET,
} from '../patterns/local-style-patterns'

// ─── CSS length ─────────────────────────────────────────────────────────────

/** number 0 | '0' | '-?N.N(unit)' */
export const CssLengthSchema = z.union([
  z.literal(0),
  z.string().regex(CSS_LENGTH_PATTERN, 'Must be a valid CSS length (e.g. 16pt, 2em, 0)'),
])
export type CssLength = z.infer<typeof CssLengthSchema>

/** Bare unitless number string OR any CSS length — used for line-height */
export const CssLineHeightSchema = z
  .string()
  .regex(CSS_LINE_HEIGHT_PATTERN, 'Must be a unitless number or valid CSS length')
export type CssLineHeight = z.infer<typeof CssLineHeightSchema>

/** '' | 0 | CSS length | '${N}lines' */
export const CssParagraphSpacingSchema = z.union([
  z.literal(''),
  z.literal(0),
  z
    .string()
    .regex(
      CSS_PARAGRAPH_SPACING_PATTERN,
      'Must be empty, 0, a CSS length, or a line-count value (e.g. 2lines)',
    ),
])
export type CssParagraphSpacing = z.infer<typeof CssParagraphSpacingSchema>

// ─── Color ──────────────────────────────────────────────────────────────────

export const CssColorSchema = z
  .string()
  .regex(CSS_COLOR_PATTERN, 'Must be a valid CSS color (hex, rgb, rgba, hsl, hsla)')
export type CssColor = z.infer<typeof CssColorSchema>

// ─── Typography ─────────────────────────────────────────────────────────────

export const FontWeightValueSchema = z.union([
  z.literal(100),
  z.literal(200),
  z.literal(300),
  z.literal(400),
  z.literal(500),
  z.literal(600),
  z.literal(700),
  z.literal(800),
  z.literal(900),
])
export type FontWeightValue = z.infer<typeof FontWeightValueSchema>

export const TextAlignSchema = z.enum(['left', 'center', 'right', 'justify'])
export type TextAlign = z.infer<typeof TextAlignSchema>

// ─── Parser enums ────────────────────────────────────────────────────────────

export const EnterStyleSchema = z.enum(['paragraph', 'lineBreak'])
export type EnterStyle = z.infer<typeof EnterStyleSchema>

export const NumberStyleSchema = z.enum(['arabic', 'roman', 'zhHans', 'zhHant'])
export type NumberStyle = z.infer<typeof NumberStyleSchema>

// ─── Page enums ──────────────────────────────────────────────────────────────

export const PageOrientationSchema = z.enum(['portrait', 'landscape'])
export type PageOrientation = z.infer<typeof PageOrientationSchema>

// ─── Pagination enums ────────────────────────────────────────────────────────

export const PaginationVerticalAnchorSchema = z.enum(['top', 'bottom'])
export type PaginationVerticalAnchor = z.infer<typeof PaginationVerticalAnchorSchema>

export const PaginationHorizontalAnchorSchema = z.enum(['left', 'center', 'right', 'outside', 'inside'])
export type PaginationHorizontalAnchor = z.infer<typeof PaginationHorizontalAnchorSchema>

// ─── Pagination format ───────────────────────────────────────────────────────

/**
 * Non-empty string; each {expression} must be a syntactically valid arithmetic
 * expression using the variables currentPage / totalPage.
 */
export const PaginationFormatSchema = z
  .string()
  .min(1, 'Pagination format must be a non-empty string')
  .superRefine((val, ctx) => {
    for (const match of val.matchAll(/\{([^{}]+)\}/g)) {
      const expression = (match[1] ?? '').trim()
      if (!expression || !PAGINATION_EXPRESSION_ALLOWED_PATTERN.test(expression)) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid pagination expression: {${expression}}`,
        })
      }
    }
  })
export type PaginationFormat = z.infer<typeof PaginationFormatSchema>

// ─── Local style path ────────────────────────────────────────────────────────

/**
 * A dot-separated identifier path that must start with 'content.' and must
 * not contain prototype-poisoning segments.
 */
export const LocalStyleTargetPathSchema = z
  .string()
  .min(1)
  .regex(LOCAL_STYLE_TARGET_PATH_PATTERN, 'Must be a dot-separated identifier path (e.g. content.body.paragraph.indent)')
  .refine((v) => v.startsWith('content.'), 'Local style path must start with "content."')
  .refine(
    (v) => !v.split('.').some((seg) => UNSAFE_PATH_SEGMENT_SET.has(seg)),
    'Local style path contains an unsafe segment',
  )
export type LocalStyleTargetPath = z.infer<typeof LocalStyleTargetPathSchema>
