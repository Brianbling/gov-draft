import { z } from 'zod'
import { ContentConfigSchema } from './content-schemas'
import { PageConfigSchema } from './page-schemas'
import { PaginationConfigSchema } from './pagination-schemas'
import { ParserConfigSchema } from './parser-schemas'

export * from './primitives'
export * from './content-schemas'
export * from './page-schemas'
export * from './parser-schemas'
export * from './pagination-schemas'
export * from './schema-traversal'

export const EditorSettingsSchema = z.object({
  fontSize: z.number().min(8).max(48).default(18),
  lineNumbers: z.boolean().default(true),
  wordWrap: z.boolean().default(true),
  tabSize: z.number().min(1).max(8).default(2),
})

export const PreviewSettingsSchema = z.object({
  zoom: z.number().min(30).max(200).default(100),
})

export const AutoSaveConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().min(1000).default(30000),
})

export const RuleConfigSchema = z.object({
  name: z.string().min(1, 'Rule name must be non-empty'),
  version: z.string().min(1, 'Rule version must be non-empty'),
  description: z.string().optional(),
  content: ContentConfigSchema,
  page: PageConfigSchema,
  pagination: PaginationConfigSchema.optional(),
  parser: ParserConfigSchema,
  editor: EditorSettingsSchema.optional(),
  preview: PreviewSettingsSchema.optional(),
  autoSave: AutoSaveConfigSchema.optional(),
})

export type RuleConfig = z.infer<typeof RuleConfigSchema>
