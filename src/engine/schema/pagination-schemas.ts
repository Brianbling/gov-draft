import { z } from "zod"
import {
  CssColorSchema,
  CssLengthSchema,
  FontWeightValueSchema,
  NumberStyleSchema,
  PaginationFormatSchema,
  PaginationHorizontalAnchorSchema,
  PaginationVerticalAnchorSchema,
} from "./primitives"
import { TextFontConfigSchema } from "./content-schemas"

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
export type PaginationPositionConfig = z.infer<
  typeof PaginationPositionConfigSchema
>

export const PaginationConfigSchema = z.object({
  enabled: z.boolean(),
  format: PaginationFormatSchema,
  numberStyle: NumberStyleSchema.optional(),
  style: PaginationStyleConfigSchema,
  position: PaginationPositionConfigSchema,
  /** 首页（第 1 页）不显示页码。GB/T 9704-2012 §7.5 与 10.1：版头页（信函/命令）首页不编页码。 */
  hideFirstPage: z.boolean().optional(),
})
export type PaginationConfig = z.infer<typeof PaginationConfigSchema>
