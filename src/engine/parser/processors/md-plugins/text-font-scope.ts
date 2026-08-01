import type { ParserConfig } from '../../../schema'
import type { MdPluginWithOptions } from '../../types'

const TEXT_TOKEN_PATTERN = /[A-Za-z0-9]+|[“”‘’]|[《》〈〉]/g

function wrapTextScopes(content: string, escapeHtml: (source: string) => string): string {
  let cursor = 0
  let result = ''

  content.replace(TEXT_TOKEN_PATTERN, (matched, offset) => {
    if (offset > cursor) {
      result += escapeHtml(content.slice(cursor, offset))
    }

    if (/^[A-Za-z0-9]+$/.test(matched)) {
      result += `<span class="latin-text">${escapeHtml(matched)}</span>`
    } else if (/^[“”‘’]$/.test(matched)) {
      result += `<span class="cn-quote">${escapeHtml(matched)}</span>`
    } else {
      result += `<span class="cn-book-title">${escapeHtml(matched)}</span>`
    }

    cursor = offset + matched.length
    return matched
  })

  if (cursor < content.length) {
    result += escapeHtml(content.slice(cursor))
  }

  return result
}

export const textFontScopePlugin: MdPluginWithOptions<ParserConfig> = (md) => {
  const fallbackTextRenderer = md.renderer.rules.text

  md.renderer.rules.text = (tokens, index, options, env, self) => {
    const defaultRenderer = fallbackTextRenderer ?? ((rawTokens, tokenIndex) => self.renderToken(rawTokens, tokenIndex, options))
    const token = tokens[index]
    if (!token || token.type !== 'text') {
      return defaultRenderer(tokens, index, options, env, self)
    }

    const content = token.content ?? ''
    if (!content) {
      return ''
    }

    return wrapTextScopes(content, md.utils.escapeHtml)
  }
}
