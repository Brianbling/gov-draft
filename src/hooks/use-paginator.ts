import { useState, useRef, useCallback, useMemo } from 'react'
import type { PaginationConfig } from '@/engine/schema'
import { getBuiltinRules } from '@/engine'
import { getPageContentHeightPx, getPageContentWidthPx } from '@/engine/utils/page-metrics-utils'
import {
  collectBlocks,
  DEFAULT_LOCAL_STYLE_CONTAINER_CLASS_NAME,
  DEFAULT_STYLE_WRAPPER_TAG_NAMES,
} from '@/lib/pagination-block-utils'
import { useRuleStore } from '@/stores/rule-store'

export interface PageRenderMeta {
  globalPage: number
  globalTotal: number
  pagination: PaginationConfig | null
}

interface UsePaginatorOptions {
  overflowTolerancePx?: number
  maxSplitIterations?: number
  styleWrapperTagNames?: ReadonlySet<string>
  localStyleContainerClassName?: string
}

interface ResolvedPaginatorOptions {
  overflowTolerancePx: number
  maxSplitIterations: number
  styleWrapperTagNames: ReadonlySet<string>
  localStyleContainerClassName: string
}

const DEFAULT_OPTIONS: ResolvedPaginatorOptions = {
  overflowTolerancePx: 0.35,
  maxSplitIterations: 2000,
  styleWrapperTagNames: DEFAULT_STYLE_WRAPPER_TAG_NAMES,
  localStyleContainerClassName: DEFAULT_LOCAL_STYLE_CONTAINER_CLASS_NAME,
}

const DEFAULT_PAGE_CONFIG = getBuiltinRules()[0]!.page

function isOverflowing(el: HTMLElement, tolerance: number): boolean {
  const scrollOverflow = el.scrollHeight - el.clientHeight
  if (scrollOverflow > tolerance) return true
  const lastElement = el.lastElementChild as HTMLElement | null
  if (!lastElement) return false
  const containerRect = el.getBoundingClientRect()
  const lastRect = lastElement.getBoundingClientRect()
  if (containerRect.height <= 0 || lastRect.height <= 0) return false
  const computed = window.getComputedStyle(lastElement)
  const marginBottom = Number.parseFloat(computed.marginBottom || '0')
  const contentBottom = lastRect.bottom + (Number.isFinite(marginBottom) ? marginBottom : 0)
  return contentBottom - containerRect.bottom > tolerance
}

function canFit(html: string, measure: HTMLElement, tolerance: number, prefixHtml = ''): boolean {
  measure.innerHTML = `${prefixHtml}${html}`
  return !isOverflowing(measure, tolerance)
}

function isH1Block(block: string): boolean {
  return /<h1(\s|>)/.test(block)
}

function buildElementHtmlWithChildRange(
  element: Element,
  childNodes: ChildNode[],
  start: number,
  end: number,
): string {
  const cloned = element.cloneNode(false) as Element
  for (let i = start; i < end; i++) {
    const child = childNodes[i]
    if (child) cloned.appendChild(child.cloneNode(true))
  }
  return cloned.outerHTML
}

function trySplitElementByChildNodes(
  element: Element,
  measure: HTMLElement,
  tolerance: number,
  prefixHtml = '',
): { fittingHtml: string; remainingHtml: string } | null {
  const childNodes = Array.from(element.childNodes)
  if (childNodes.length < 2) return null
  let low = 1
  let high = childNodes.length - 1
  let best = 0
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = buildElementHtmlWithChildRange(element, childNodes, 0, mid)
    if (canFit(candidate, measure, tolerance, prefixHtml)) {
      best = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  if (best <= 0 || best >= childNodes.length) return null

  // When the first non-fitting child is a text node, try to include
  // as many of its characters as possible so we don't waste space
  // pushing the entire trailing text to the next page.
  // This is essential for paragraphs that contain inline elements
  // (e.g. <span class="latin-text"> or <span class="cn-book-title">)
  // followed by a long CJK text run.
  const overflowChild = childNodes[best]
  if (
    overflowChild &&
    overflowChild.nodeType === Node.TEXT_NODE &&
    (overflowChild.textContent?.length ?? 0) > 0
  ) {
    const textChars = Array.from(overflowChild.textContent!)
    let charLow = 0
    let charHigh = textChars.length
    let charBest = 0
    while (charLow <= charHigh) {
      const charMid = Math.floor((charLow + charHigh) / 2)
      const testEl = element.cloneNode(false) as Element
      for (let i = 0; i < best; i++) {
        testEl.appendChild(childNodes[i].cloneNode(true))
      }
      if (charMid > 0) {
        testEl.appendChild(
          document.createTextNode(textChars.slice(0, charMid).join('')),
        )
      }
      if (canFit(testEl.outerHTML, measure, tolerance, prefixHtml)) {
        charBest = charMid
        charLow = charMid + 1
      } else {
        charHigh = charMid - 1
      }
    }

    if (charBest > 0) {
      const fittingEl = element.cloneNode(false) as Element
      for (let i = 0; i < best; i++) {
        fittingEl.appendChild(childNodes[i].cloneNode(true))
      }
      fittingEl.appendChild(
        document.createTextNode(textChars.slice(0, charBest).join('')),
      )

      const remainingEl = element.cloneNode(false) as Element
      if (charBest < textChars.length) {
        remainingEl.appendChild(
          document.createTextNode(textChars.slice(charBest).join('')),
        )
      }
      for (let i = best + 1; i < childNodes.length; i++) {
        remainingEl.appendChild(childNodes[i].cloneNode(true))
      }

      // Continuation of a split paragraph — suppress text-indent to
      // avoid double indentation.
      remainingEl.setAttribute('data-split-from', 'child-text')
      ;(remainingEl as HTMLElement).style.setProperty('text-indent', '0')

      if (remainingEl.childNodes.length === 0) return null
      const fittingHtml = fittingEl.outerHTML
      const remainingHtml = remainingEl.outerHTML
      if (fittingHtml && remainingHtml) return { fittingHtml, remainingHtml }
    }
  }

  const fittingHtml = buildElementHtmlWithChildRange(element, childNodes, 0, best)
  const remainingHtml = buildElementHtmlWithChildRange(element, childNodes, best, childNodes.length)
  if (!fittingHtml || !remainingHtml) return null
  return { fittingHtml, remainingHtml }
}

function trySplitElementByTextContent(
  element: Element,
  measure: HTMLElement,
  tolerance: number,
  prefixHtml = '',
): { fittingHtml: string; remainingHtml: string } | null {
  const text = element.textContent ?? ''
  const chars = Array.from(text)
  if (chars.length < 2) return null
  let low = 1
  let high = chars.length - 1
  let best = 0
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const fittingEl = element.cloneNode(false) as Element
    fittingEl.textContent = chars.slice(0, mid).join('')
    if (canFit(fittingEl.outerHTML, measure, tolerance, prefixHtml)) {
      best = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  if (best <= 0 || best >= chars.length) return null
  const fittingEl = element.cloneNode(false) as Element
  fittingEl.textContent = chars.slice(0, best).join('')
  const remainingEl = element.cloneNode(false) as Element
  remainingEl.textContent = chars.slice(best).join('')
  remainingEl.setAttribute('data-split-from', 'text-content')
  ;(remainingEl as HTMLElement).style.setProperty('text-indent', '0')
  return { fittingHtml: fittingEl.outerHTML, remainingHtml: remainingEl.outerHTML }
}

function trySplitOversizedBlock(
  block: string,
  measure: HTMLElement,
  tolerance: number,
  prefixHtml = '',
): { fittingHtml: string; remainingHtml: string } | null {
  const container = document.createElement('div')
  container.innerHTML = block
  const element = container.firstElementChild
  if (!element) return null
  const tagName = element.tagName.toUpperCase()
  if (tagName === 'H1') return null
  // Headings (H2–H6) have inline children whose boundaries don't align
  // with page breaks — a child-node split orphans numbering prefixes.
  // Use character-level text-content split instead.
  const childSplit = tagName.startsWith('H')
    ? null
    : trySplitElementByChildNodes(element, measure, tolerance, prefixHtml)
  if (childSplit) return childSplit
  return trySplitElementByTextContent(element, measure, tolerance, prefixHtml)
}

function paginateBlocks(
  blocks: string[],
  measure: HTMLElement,
  options: ResolvedPaginatorOptions,
): string[] {
  const result: string[] = []
  let currentPageHtml = ''
  const pending = [...blocks]
  let splitIterations = 0

  const pushPage = () => {
    if (currentPageHtml.length > 0) {
      result.push(currentPageHtml)
      currentPageHtml = ''
    }
  }

  while (pending.length > 0) {
    splitIterations++
    if (splitIterations > options.maxSplitIterations) {
      throw new Error(`Pagination exceeded max iterations: ${options.maxSplitIterations}`)
    }
    const block = pending.shift()!
    if (isH1Block(block) && currentPageHtml.length > 0) pushPage()

    const candidate = `${currentPageHtml}${block}`
    measure.innerHTML = candidate
    if (!isOverflowing(measure, options.overflowTolerancePx)) {
      currentPageHtml = candidate
      continue
    }
    if (currentPageHtml.length > 0) {
      const split = trySplitOversizedBlock(
        block,
        measure,
        options.overflowTolerancePx,
        currentPageHtml,
      )
      if (split) {
        currentPageHtml = `${currentPageHtml}${split.fittingHtml}`
        pushPage()
        pending.unshift(split.remainingHtml)
        measure.innerHTML = ''
        continue
      }
      pushPage()
      pending.unshift(block)
      measure.innerHTML = ''
      continue
    }
    const split = trySplitOversizedBlock(block, measure, options.overflowTolerancePx)
    if (split) {
      currentPageHtml = split.fittingHtml
      pushPage()
      pending.unshift(split.remainingHtml)
      measure.innerHTML = ''
      continue
    }
    currentPageHtml = block
    pushPage()
    measure.innerHTML = ''
  }
  pushPage()
  return result
}

function buildPageMetas(
  pageCount: number,
  pagination: PaginationConfig | undefined,
): PageRenderMeta[] {
  const resolved = pagination?.enabled ? pagination : null
  return Array.from({ length: pageCount }, (_, i) => ({
    globalPage: i + 1,
    globalTotal: pageCount,
    pagination: resolved,
  }))
}

export function usePaginator(options: UsePaginatorOptions = {}) {
  const {
    overflowTolerancePx = DEFAULT_OPTIONS.overflowTolerancePx,
    maxSplitIterations = DEFAULT_OPTIONS.maxSplitIterations,
    styleWrapperTagNames = DEFAULT_OPTIONS.styleWrapperTagNames,
    localStyleContainerClassName = DEFAULT_OPTIONS.localStyleContainerClassName,
  } = options
  const resolved = useMemo<ResolvedPaginatorOptions>(
    () => ({
      overflowTolerancePx,
      maxSplitIterations,
      styleWrapperTagNames,
      localStyleContainerClassName,
    }),
    [overflowTolerancePx, maxSplitIterations, styleWrapperTagNames, localStyleContainerClassName],
  )
  const ruleStore = useRuleStore()
  const [pages, setPages] = useState<string[]>([''])
  const [pageMetas, setPageMetas] = useState<PageRenderMeta[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const measureRef = useRef<HTMLDivElement | null>(null)

  const getPageHeight = useCallback(() => {
    const pageConfig = ruleStore.currentRule?.page ?? DEFAULT_PAGE_CONFIG
    return getPageContentHeightPx(pageConfig)
  }, [ruleStore.currentRule])

  const getPageWidth = useCallback(() => {
    const pageConfig = ruleStore.currentRule?.page ?? DEFAULT_PAGE_CONFIG
    return getPageContentWidthPx(pageConfig)
  }, [ruleStore.currentRule])

  const goToPage = useCallback(
    (page: number) => {
      const count = pages.length
      const clamped = count > 0 ? Math.min(Math.max(page, 1), count) : 1
      setCurrentPage(clamped)
      const target = document.querySelector(`[data-page-index="${clamped}"]`) as HTMLElement | null
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [pages.length],
  )

  const paginate = useCallback(
    async (html: string) => {
      const measure = measureRef.current
      if (!measure) return
      const pageHeight = getPageHeight()
      const pageWidth = getPageWidth()
      measure.style.display = 'flow-root'
      measure.style.overflow = 'hidden'
      measure.style.boxSizing = 'content-box'
      measure.style.width = `${pageWidth}px`
      measure.style.height = `${pageHeight}px`

      try {
        const blocks = collectBlocks(html, {
          styleWrapperTagNames: resolved.styleWrapperTagNames,
          localStyleContainerClassName: resolved.localStyleContainerClassName,
        })
        if (blocks.length === 0) {
          setPages([''])
          setPageMetas([])
          return
        }

        const paginated = paginateBlocks(blocks, measure, resolved)
        const metas = buildPageMetas(paginated.length, ruleStore.currentRule?.pagination)
        setPages(paginated.length > 0 ? paginated : [''])
        setPageMetas(metas)
        setCurrentPage((prev) => Math.max(1, Math.min(prev, paginated.length || 1)))
      } finally {
        measure.innerHTML = ''
      }
    },
    [getPageHeight, getPageWidth, resolved, ruleStore.currentRule],
  )

  return {
    pages,
    pageMetas,
    pageCount: pages.length,
    currentPage,
    measureRef,
    paginate,
    goToPage,
    nextPage: () => goToPage(currentPage + 1),
    previousPage: () => goToPage(currentPage - 1),
  }
}
