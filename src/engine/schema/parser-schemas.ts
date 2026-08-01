import { z } from 'zod'
import { EnterStyleSchema, LocalStyleTargetPathSchema } from './primitives'

export const ParserConfigSchema = z.object({
  html: z.boolean().default(false),
  enterStyle: EnterStyleSchema.default('paragraph'),
  linkify: z.boolean().default(true),
  typographer: z.boolean().default(true),
  headingNumbering: z.boolean().default(false),
  disabledSyntax: z.array(z.string().min(1, 'Syntax item must be a non-empty string')).default([]),
  localStyleAliases: z
    .record(z.string().min(1), LocalStyleTargetPathSchema)
    .optional()
    .default({}),
  headingStyles: z.record(z.string(), z.string()).optional(),
})
export type ParserConfig = z.infer<typeof ParserConfigSchema>
