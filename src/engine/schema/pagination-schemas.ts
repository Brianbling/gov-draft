import { z } from 'zod'
import {
  CssColorSchema,
  CssLengthSchema,
  FontWeightValueSchema,
  NumberStyleSchema,
  PaginationFormatSchema,
  PaginationHorizontalAnchorSchema,
  PaginationVerticalAnchorSchema,
} from './primitives'
import { TextFontConfigSchema } from './content-schemas'

export const PaginationStyleColorsSchema = z.object({
  text: CssColorSchema,
})
export type PaginationStyleColors = z.infer<typeof PaginationStyleColorsSchema>

export const PaginationStyleConfigSchema = z.object({
  fonts: TextFontConfigSchema,
  size: CssLengthSchema,
  weight: FontWeightValueSchema,
  colors: PaginationStyleColorsSchema,
})
export type PaginationStyleConfig = z.infer<typeof PaginationStyleConfigSchema>

export const PaginationPositionConfigSchema = z.object({
  vertical: z.object({
    anchor: PaginationVerticalAnchorSchema,
    offset: CssLengthSchema,
  }),
  horizontal: z.object({
    anchor: PaginationHorizontalAnchorSchema,
    offset: CssLengthSchema,
  }),
})
export type PaginationPositionConfig = z.infer<typeof PaginationPositionConfigSchema>

export const PaginationConfigSchema = z.object({
  enabled: z.boolean(),
  format: PaginationFormatSchema,
  numberStyle: NumberStyleSchema.optional(),
  style: PaginationStyleConfigSchema,
  position: PaginationPositionConfigSchema,
})
export type PaginationConfig = z.infer<typeof PaginationConfigSchema>
