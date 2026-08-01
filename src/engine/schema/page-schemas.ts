import { z } from 'zod'
import { CssLengthSchema, PageOrientationSchema } from './primitives'

export const PageMarginsSchema = z.object({
  top: CssLengthSchema,
  right: CssLengthSchema,
  bottom: CssLengthSchema,
  left: CssLengthSchema,
})
export type PageMargins = z.infer<typeof PageMarginsSchema>

export const PageDimensionsSchema = z.object({
  width: CssLengthSchema,
  height: CssLengthSchema,
})
export type PageDimensions = z.infer<typeof PageDimensionsSchema>

export const PageConfigSchema = z
  .object({
    size: z.string().min(1).optional(),
    orientation: PageOrientationSchema.default('portrait'),
    dimensions: PageDimensionsSchema.optional(),
    margins: PageMarginsSchema,
  })
  .refine((data) => !!(data.size ?? data.dimensions), {
    message: 'Either page.size or page.dimensions must be specified',
    path: ['size'],
  })
export type PageConfig = z.infer<typeof PageConfigSchema>
