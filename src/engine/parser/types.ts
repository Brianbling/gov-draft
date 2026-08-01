import type Token from 'markdown-it/lib/token.mjs'
import type { ParserConfig } from '../schema'

export const ParseErrorCode = {
  MARKDOWN_PARSE_ERROR: 'MARKDOWN_PARSE_ERROR',
  MARKDOWN_PARSE_FAILED: 'MARKDOWN_PARSE_FAILED',
} as const
export type ParseErrorCode = (typeof ParseErrorCode)[keyof typeof ParseErrorCode]

export interface ParseResult {
  html: string
  tokens: Token[]
}

export interface Preprocessor {
  name: string
  process(markdown: string, options: ParserConfig): string
}

export interface TokenProcessor {
  name: string
  process(tokens: Token[], options: ParserConfig): Token[]
}

export interface HtmlPostprocessor {
  name: string
  process(html: string, options: ParserConfig): string
}

/**
 * Mirrors `MarkdownIt.PluginWithOptions<T>`. Uses `import()` type
 * expression to access the namespace member without a top-level
 * `import type`, which is incompatible with erasableSyntaxOnly /
 * verbatimModuleSyntax.
 */
export type MdPluginWithOptions<T = unknown> =
  import('markdown-it').PluginWithOptions<T>

export interface ParserPipeline {
  preprocessors: Preprocessor[]
  mdPlugins: MdPluginWithOptions<ParserConfig>[]
  tokenProcessors: TokenProcessor[]
  htmlPostprocessors: HtmlPostprocessor[]
}
