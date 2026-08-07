/**
 * Pagination performance benchmark — models the layout-measurement cost of
 * `paginateBlocks` (src/hooks/use-paginator.ts).
 *
 * jsdom never runs layout, so a real scrollHeight is always 0. To exercise the
 * same algorithm paths a browser layout engine drives (page breaks, oversized
 * splits, binary search), the measure element models scrollHeight as growing
 * with text length at realistic A4 metrics. This measures the ALGORITHM cost
 * (block iteration + innerHTML DOM parsing + split budget), not the raw reflow
 * seconds of Chromium — for real reflow numbers run the app and observe, the
 * before/after delta here is the load-bearing signal.
 *
 * Run: bun bench/paginate-bench.ts
 */
import { Bench } from "tinybench"
import { JSDOM } from "jsdom"
import { paginateBlocks } from "../src/hooks/use-paginator"
import { collectBlocks } from "../src/lib/pagination-block-utils"

// --- browser-ish globals for module + collectBlocks --------------------------
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" })
;(globalThis as Record<string, unknown>).window = dom.window
;(globalThis as Record<string, unknown>).document = dom.window.document
;(globalThis as Record<string, unknown>).navigator = dom.window.navigator
// pagination-block-utils references the Node / Element globals directly.
;(globalThis as Record<string, unknown>).Node = dom.window.Node
;(globalThis as Record<string, unknown>).Element = dom.window.Element

// Realistic A4 公文 metrics.
const PAGE_CONTENT_HEIGHT_PX = 870
const CHARS_PER_LINE = 40
const LINE_HEIGHT_PX = 38.6
const TOLERANCE_PX = 0.35

// Overflow model: scrollHeight grows with the number of lines the text would
// occupy, i.e. ceil(chars / chars-per-line) * line-height.
function makeMeasure(): HTMLElement {
  const el = dom.window.document.createElement("div")
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: PAGE_CONTENT_HEIGHT_PX,
  })
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get() {
      const len = (el.textContent ?? "").length
      const lines = Math.max(1, Math.ceil(len / CHARS_PER_LINE))
      return lines * LINE_HEIGHT_PX
    },
  })
  return el
}

const options = {
  overflowTolerancePx: TOLERANCE_PX,
  maxSplitIterations: 1000,
  styleWrapperTagNames: new Set<string>(),
  localStyleContainerClassName: "",
}

const PARAGRAPH =
  "各部门要充分认识本次工作的重要意义，按照统一部署，扎实推进各项任务落实，确保取得实效。" +
  "要加强组织领导，明确责任分工，建立健全工作机制，形成齐抓共管的良好局面。"

function makeDocument(chars: number): string {
  const blocks: string[] = ["# 关于进一步加强工作的通知"]
  let total = blocks[0]!.length
  while (total < chars) {
    if (blocks.length % 5 === 0) blocks.push(`## 第${blocks.length / 5 + 1}部分 工作要求`)
    if (blocks.length % 5 === 2) blocks.push("### 具体措施")
    blocks.push(PARAGRAPH)
    total += PARAGRAPH.length
  }
  return blocks.join("\n\n")
}

// html → blocks once per document, then measure paginateBlocks only.
function paginateDocument(markdown: string): () => void {
  const blocks = collectBlocks(markdown)
  const measure = makeMeasure()
  return () => {
    void paginateBlocks(blocks, measure, options)
  }
}

const doc3000 = makeDocument(3000)
const doc6000 = makeDocument(6000)
const doc12000 = makeDocument(12000)

const bench = new Bench({ iterations: 3 })
bench.add("paginate: ~3000字 公文", paginateDocument(doc3000))
bench.add("paginate: ~6000字 公文", paginateDocument(doc6000))
bench.add("paginate: ~12000字 公文", paginateDocument(doc12000))

await bench.run()

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length))
const padStart = (s: string, n: number) => (s.length >= n ? s : " ".repeat(n - s.length) + s)
const us = (ms: number) => `${(ms * 1000).toFixed(1)}µs`

function median(samples: number[]): number {
  if (samples.length === 0) return Number.NaN
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

console.log()
console.log(`  Pagination benchmark — jsdom proxy layout — ${process.version} on ${process.platform}`)
console.log()
console.log("  " + pad("task", 30) + padStart("median", 10) + padStart("mean", 10) + padStart("p99", 10))
console.log("  " + "-".repeat(60))
for (const task of bench.tasks) {
  const r = task.result
  if (!r) continue
  console.log(
    "  " +
      pad(task.name, 30) +
      padStart(us(median(r.samples)), 10) +
      padStart(us(r.mean), 10) +
      padStart(us(r.p99), 10),
  )
}
console.log()
console.log("  NOTE: scrollHeight is modeled (jsdom has no layout). The delta before/after")
console.log("  reflects algorithm + innerHTML cost; real Chromium reflow savings will be larger.")
console.log()
