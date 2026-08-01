// engine/index.ts — public API entry point

// Pure functions
export { compileRule } from './compiler/compiler'
export { validateRule } from './compiler/validator'
export { getBuiltinRules } from './builtin-rules'

// Classes
export { MarkdownParser } from './parser/markdown-parser'

// Default host selectors
export { DEFAULT_HOST } from './compiler/default-host'

// Types
export type { RuleConfig } from './schema'
export type {
  CompiledRule,
  ValidationResult,
  ValidationIssue,
  ValidationErrorCode,
  HostSelectors,
} from './compiler/types'
export type { ParseResult, ParseErrorCode } from './parser/types'
