import { useRef, useEffect, useCallback } from 'react'
import { MarkdownParser } from '@/engine'
import type { ParserConfig } from '@/engine/schema'
import { useDocStore } from '@/stores/doc-store'
import { useRuleStore } from '@/stores/rule-store'

const DEFAULT_THROTTLE_MS = 100

/** index 允许 string|null：null = suppress 序号。UI 清空输入框写 ''，
 * 若保留空串则与 null 语义不一致，归一为禁用哨兵 '0lines'。 */
export function normalizeHeadingIndex(
  index: string | null | undefined,
): string {
  return index == null || index.trim() === '' ? '0lines' : index
}

function buildHeadingStyles(
  content: { h1?: { style?: { index?: string | null } }; h2?: { style?: { index?: string | null } }; h3?: { style?: { index?: string | null } }; h4?: { style?: { index?: string | null } } } | undefined,
): Record<string, string> | undefined {
  if (!content) return undefined
  return {
    h1: normalizeHeadingIndex(content.h1?.style?.index),
    h2: normalizeHeadingIndex(content.h2?.style?.index),
    h3: normalizeHeadingIndex(content.h3?.style?.index),
    h4: normalizeHeadingIndex(content.h4?.style?.index),
  }
}

export function useMarkdown(throttleMs = DEFAULT_THROTTLE_MS) {
  const parserRef = useRef<MarkdownParser | null>(null)
  if (parserRef.current === null) parserRef.current = new MarkdownParser()
  const lastRunRef = useRef<number>(0)
  const trailingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const docStore = useDocStore()
  const ruleStore = useRuleStore()
  const parserConfig = ruleStore.currentRule?.parser
  const ruleContent = ruleStore.currentRule?.content
  const updateHtml = docStore.updateHtml

  const parse = useCallback(
    (markdown: string): string => {
      if (parserConfig) {
        const headingStyles = buildHeadingStyles(ruleContent)
        parserRef.current!.setOptions({ ...parserConfig, headingStyles })
      }
      const result = parserRef.current!.parse(markdown)
      return result.html
    },
    [parserConfig, ruleContent],
  )

  const setOptions = useCallback((options: Partial<ParserConfig>) => {
    parserRef.current!.setOptions(options)
  }, [])

  // Throttle (leading + trailing): parses immediately on first keystroke,
  // then at most once per throttleMs, with a final trailing parse after the
  // last change.
  useEffect(() => {
    const now = performance.now()
    const elapsed = now - lastRunRef.current

    if (trailingRef.current !== null) {
      clearTimeout(trailingRef.current)
      trailingRef.current = null
    }

    const run = () => {
      lastRunRef.current = performance.now()
      try {
        const html = parse(docStore.content)
        updateHtml(html)
      } catch (error) {
        console.error('Markdown parse failed:', error)
      }
    }

    if (elapsed >= throttleMs) {
      run()
    } else {
      trailingRef.current = setTimeout(run, throttleMs - elapsed)
    }

    return () => {
      if (trailingRef.current !== null) {
        clearTimeout(trailingRef.current)
        trailingRef.current = null
      }
    }
  }, [docStore.content, throttleMs, parse, updateHtml])

  return { parse, setOptions }
}
