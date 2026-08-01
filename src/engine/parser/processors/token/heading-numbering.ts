import type Token from 'markdown-it/lib/token.mjs'
import type { ParserConfig } from '../../../schema'
import type { HeadingLevel } from '../../../compiler/types'
import { formatByStyle } from '../../../utils/number-format-utils'
import type { TokenProcessor } from '../../types'

type NumberingPlaceholder =
  | '{number}'
  | '{arabicIndex}'
  | '{zhHansIndex}'
  | '{zhHantIndex}'
  | '{romanIndex}'
  | '{romanUpperIndex}'
  | '{romanLowerIndex}'

const HEADING_INDEX_DISABLED_VALUE = '0lines'

const PLACEHOLDER_FORMATTERS: Record<NumberingPlaceholder, (index: number) => string> = {
  '{number}': (index) => formatByStyle(index, 'arabic'),
  '{arabicIndex}': (index) => formatByStyle(index, 'arabic'),
  '{zhHansIndex}': (index) => formatByStyle(index, 'zhHans'),
  '{zhHantIndex}': (index) => formatByStyle(index, 'zhHant'),
  '{romanIndex}': (index) => formatByStyle(index, 'roman'),
  '{romanUpperIndex}': (index) => formatByStyle(index, 'roman'),
  '{romanLowerIndex}': (index) => formatByStyle(index, 'roman').toLowerCase()
}

const NUMBERING_PLACEHOLDERS = Object.keys(PLACEHOLDER_FORMATTERS) as NumberingPlaceholder[]

function getDefaultHeadingStyle(level: HeadingLevel): string {
  if (level === 'h2') {
    return '{zhHansIndex}'
  }
  if (level === 'h3') {
    return '  {zhHansIndex}'
  }
  if (level === 'h4') {
    return '{arabicIndex}'
  }
  return ''
}

function formatHeadingPrefix(currentIndex: number, style: string | undefined): string {
  const template = String(style ?? '').trim()
  if (!template || template === HEADING_INDEX_DISABLED_VALUE) {
    return ''
  }

  let formatted = template
  let hasPlaceholder = false
  for (const placeholder of NUMBERING_PLACEHOLDERS) {
    if (formatted.includes(placeholder)) {
      hasPlaceholder = true
      formatted = formatted.split(placeholder).join(PLACEHOLDER_FORMATTERS[placeholder](currentIndex))
    }
  }

  if (hasPlaceholder) {
    return formatted
  }

  return `${template}${currentIndex}`
}

export const headingNumberingProcessor: TokenProcessor = {
  name: 'heading-numbering',
  process(tokens: Token[], options: ParserConfig): Token[] {
    if (!options.headingNumbering) {
      return tokens
    }

    const headingStyles = options.headingStyles
    const counters = [0, 0, 0, 0]

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]
      if (!token || token.type !== 'heading_open') {
        continue
      }

      const level = Number(token.tag.replace('h', ''))
      if (Number.isNaN(level) || level < 1 || level > 4) {
        continue
      }

      const counterIndex = level - 1
      const currentCount = counters[counterIndex] ?? 0
      counters[counterIndex] = currentCount + 1
      for (let resetLevel = level; resetLevel < counters.length; resetLevel += 1) {
        counters[resetLevel] = 0
      }

      const inlineToken = tokens[index + 1]
      if (!inlineToken || inlineToken.type !== 'inline') {
        continue
      }

      const headingLevel = `h${level}` as HeadingLevel
      const style = headingStyles?.[headingLevel] ?? getDefaultHeadingStyle(headingLevel)
      const prefix = formatHeadingPrefix(counters[counterIndex] ?? 0, style)
      if (!prefix) {
        continue
      }

      inlineToken.content = `${prefix}${inlineToken.content}`
      const firstTextChild = inlineToken.children?.find((child) => child.type === 'text')
      if (firstTextChild) {
        firstTextChild.content = `${prefix}${firstTextChild.content}`
      }
    }

    return tokens
  },
}
