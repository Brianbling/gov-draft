import type { ParserConfig } from '../../../schema'
import type { Preprocessor } from '../../types'

const MANUAL_BREAK_SUFFIX_PATTERN = /\s*\/\/\s*$/
const EMPTY_PARAGRAPH_PLACEHOLDER = '&nbsp;'

function normalizeSingleLineBreaks(lines: string[]): string {
  const paragraphs: string[] = []
  let paragraphLines: string[] = []

  const flushParagraph = (): void => {
    if (paragraphLines.length === 0) {
      return
    }

    const hasContent = paragraphLines.some((line) => line.trim().length > 0)
    if (hasContent) {
      paragraphs.push(paragraphLines.join('\n'))
    }

    paragraphLines = []
  }

  for (const line of lines) {
    if (line.trim().length === 0) {
      flushParagraph()
      paragraphs.push(EMPTY_PARAGRAPH_PLACEHOLDER)
      continue
    }

    if (MANUAL_BREAK_SUFFIX_PATTERN.test(line)) {
      paragraphLines.push(line.replace(MANUAL_BREAK_SUFFIX_PATTERN, '  '))
      continue
    }

    paragraphLines.push(line)
    flushParagraph()
  }

  flushParagraph()

  return paragraphs.join('\n\n')
}

export const lineBreakNormalizer: Preprocessor = {
  name: 'line-break-normalizer',
  process(markdown: string, options: ParserConfig): string {
    if (options.enterStyle !== 'paragraph') {
      return markdown
    }

    return normalizeSingleLineBreaks(markdown.split('\n'))
  },
}
