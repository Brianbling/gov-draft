import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type { ParserConfig } from '../schema'
import type { ParseResult, ParserPipeline } from './types'
import { syntaxStripper } from './processors/preprocess/syntax-stripper'
import { lineBreakNormalizer } from './processors/preprocess/line-break-normalizer'
import { localStyleContainerPlugin } from './processors/md-plugins/local-style-container'
import { textFontScopePlugin } from './processors/md-plugins/text-font-scope'
import { fastLinkifyPlugin } from './processors/md-plugins/fast-linkify'
import { headingNumberingProcessor } from './processors/token/heading-numbering'
import { BlockCache } from './block-cache'

export type MarkdownOptions = ParserConfig

const defaultOptions: MarkdownOptions = {
  html: false,
  enterStyle: 'paragraph',
  linkify: true,
  typographer: true,
  headingNumbering: true,
  disabledSyntax: ['codeBlock', 'blockquote', 'unorderedList', 'horizontalRule'],
  localStyleAliases: {}
}

export const DEFAULT_PIPELINE: ParserPipeline = {
  preprocessors: [syntaxStripper, lineBreakNormalizer],
  mdPlugins: [localStyleContainerPlugin, textFontScopePlugin, fastLinkifyPlugin],
  tokenProcessors: [headingNumberingProcessor],
  htmlPostprocessors: [],
}

function requiresMarkdownItRebuild(previous: MarkdownOptions, next: MarkdownOptions): boolean {
  if (
    previous.html !== next.html ||
    previous.enterStyle !== next.enterStyle ||
    previous.linkify !== next.linkify ||
    previous.typographer !== next.typographer
  ) {
    return true
  }

  const prevDisabled = previous.disabledSyntax ?? []
  const nextDisabled = next.disabledSyntax ?? []
  if (prevDisabled.length !== nextDisabled.length || prevDisabled.some((item, i) => item !== nextDisabled[i])) {
    return true
  }

  return previous.localStyleAliases !== next.localStyleAliases
}

export class MarkdownParser {
  private md: MarkdownIt
  private options: MarkdownOptions
  private pipeline: ParserPipeline
  private blockCache = new BlockCache()

  constructor(pipeline: ParserPipeline = DEFAULT_PIPELINE, options: Partial<MarkdownOptions> = {}) {
    this.pipeline = pipeline
    this.options = {
      ...defaultOptions,
      ...options,
      disabledSyntax: options.disabledSyntax ?? defaultOptions.disabledSyntax,
      localStyleAliases: options.localStyleAliases ?? defaultOptions.localStyleAliases
    }
    this.md = this.createMarkdownIt(this.options)
  }

  parse(markdown: string): ParseResult {
    if (!markdown || typeof markdown !== 'string') {
      return { html: '', tokens: [] }
    }

    try {
      // 1. Preprocessors — always full-text (unavoidable O(n) text scan)
      const preprocessed = this.pipeline.preprocessors.reduce(
        (input, preprocessor) => preprocessor.process(input, this.options),
        markdown,
      )

      // 2. Tokenization — block-cached when beneficial, full-doc otherwise
      let tokens: Token[]
      const cached = this.blockCache.diffAndMerge(preprocessed, (block, env) =>
        this.md.parse(block, env),
      )

      if (cached !== null) {
        // Cache-hit path: only changed blocks were re-tokenized
        tokens = cached
      } else {
        // Fallback: full-document parse (small doc, cold cache, or
        // unsafe container boundaries)
        tokens = this.md.parse(preprocessed, {})
        this.blockCache.seed(preprocessed, (block, env) =>
          this.md.parse(block, env),
        )
      }

      // 3. Token processors (heading numbering — always full sweep)
      const processedTokens = this.pipeline.tokenProcessors.reduce(
        (tokens, processor) => processor.process(tokens, this.options),
        tokens,
      )

      // 4. Render to HTML
      const renderedHtml = this.md.renderer.render(
        processedTokens,
        this.md.options,
        {},
      )

      // 5. HTML postprocessors
      const html = this.pipeline.htmlPostprocessors.reduce(
        (input, postprocessor) => postprocessor.process(input, this.options),
        renderedHtml,
      )

      return { html, tokens: processedTokens }
    } catch (error) {
      console.error(`MARKDOWN_PARSE_ERROR: ${String(error)}`, error)
      throw new Error(
        `MARKDOWN_PARSE_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      )
    }
  }

  setOptions(options: Partial<MarkdownOptions>): void {
    const previous = this.options
    const next: MarkdownOptions = {
      ...this.options,
      ...options,
      disabledSyntax: options.disabledSyntax ?? this.options.disabledSyntax,
      localStyleAliases: options.localStyleAliases ?? this.options.localStyleAliases
    }
    this.options = next

    // Only construction-affecting options trigger a rebuild; live options
    // (headingNumbering/headingStyles) are read by token processors at parse
    // time, so per-keystroke parses avoid reconstructing the parser.
    if (requiresMarkdownItRebuild(previous, next)) {
      this.md = this.createMarkdownIt(next)
      // Cached tokens were produced by the old MarkdownIt instance with
      // potentially different rules/plugins — they are no longer valid.
      this.blockCache.invalidate()
    }
  }

  private createMarkdownIt(options: MarkdownOptions): MarkdownIt {
    const parser = new MarkdownIt({
      html: options.html,
      breaks: options.enterStyle === 'lineBreak',
      linkify: options.linkify,
      typographer: options.typographer
    })
    const disabledSyntax = Array.isArray(options.disabledSyntax) ? options.disabledSyntax : []

    for (const plugin of this.pipeline.mdPlugins) {
      parser.use(plugin, options)
    }

    if (disabledSyntax.includes('codeBlock')) {
      parser.disable(['fence', 'code'])
    }
    if (disabledSyntax.includes('blockquote')) {
      parser.disable('blockquote')
    }
    if (disabledSyntax.includes('horizontalRule')) {
      parser.disable('hr')
    }

    return parser
  }
}
