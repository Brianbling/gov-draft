import { z } from 'zod'
import {
  CssColorSchema,
  CssLengthSchema,
  CssLineHeightSchema,
  CssParagraphSpacingSchema,
  FontWeightValueSchema,
  TextAlignSchema,
} from './primitives'

// ─── Fonts ───────────────────────────────────────────────────────────────────

export const TextFontConfigSchema = z.object({
  latinFamily: z.string().min(1),
  cjkFamily: z.string().min(1),
  cnQuoteFamily: z.string().min(1).optional(),
  cnBookTitleFamily: z.string().min(1).optional(),
})
export type TextFontConfig = z.infer<typeof TextFontConfigSchema>

// ─── Style ────────────────────────────────────────────────────────────────────

export const TextStyleColorsSchema = z.object({
  text: CssColorSchema,
  background: CssColorSchema,
})
export type TextStyleColors = z.infer<typeof TextStyleColorsSchema>

export const TextStyleConfigSchema = z.object({
  size: CssLengthSchema,
  weight: FontWeightValueSchema,
  colors: TextStyleColorsSchema,
  /** Optional heading index template, e.g. '{zhHansIndex}、' or null to suppress */
  index: z.string().nullable().optional(),
})
export type TextStyleConfig = z.infer<typeof TextStyleConfigSchema>

// ─── Paragraph ───────────────────────────────────────────────────────────────

export const ParagraphSpacingConfigSchema = z.object({
  lineHeight: CssLineHeightSchema,
  before: CssParagraphSpacingSchema,
  after: CssParagraphSpacingSchema,
})
export type ParagraphSpacingConfig = z.infer<typeof ParagraphSpacingConfigSchema>

export const ParagraphConfigSchema = z.object({
  align: TextAlignSchema,
  indent: CssLengthSchema,
  spacing: ParagraphSpacingConfigSchema,
  /**
   * Target characters per line for a CJK character grid. When set, the compiler
   * emits a calc()-based letter-spacing (版心宽 / charsPerLine − 字号) so each
   * line holds exactly this many full-width characters. Omit for natural wrapping.
   */
  charsPerLine: z.number().int().positive().nullable().optional(),
})
export type ParagraphConfig = z.infer<typeof ParagraphConfigSchema>

// ─── Content items ────────────────────────────────────────────────────────────

export const ContentItemConfigSchema = z.object({
  fonts: TextFontConfigSchema,
  style: TextStyleConfigSchema,
  paragraph: ParagraphConfigSchema,
})
export type ContentItemConfig = z.infer<typeof ContentItemConfigSchema>

// ─── Content config ──────────────────────────────────────────────────────────

/**
 * Requires body + h1–h4; allows additional custom heading levels via catchall.
 */
export const ContentConfigSchema = z
  .object({
    body: ContentItemConfigSchema,
    h1: ContentItemConfigSchema,
    h2: ContentItemConfigSchema,
    h3: ContentItemConfigSchema,
    h4: ContentItemConfigSchema,
  })
  .catchall(ContentItemConfigSchema)
export type ContentConfig = z.infer<typeof ContentConfigSchema>
