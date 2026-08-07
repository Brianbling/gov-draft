import { describe, expect, it } from 'vitest'
import { MarkdownParser } from '../markdown-parser'
import { BlockCache } from '../block-cache'
import MarkdownIt from 'markdown-it'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(paragraphs: number): string {
  const blocks: string[] = ['# 关于进一步加强工作的通知']
  for (let i = 0; i < paragraphs; i += 1) {
    if (i % 5 === 0) blocks.push(`## 第${i / 5 + 1}部分 工作要求`)
    if (i % 5 === 2) blocks.push(`### 具体措施`)
    blocks.push(
      '各部门要充分认识本次工作的重要意义，按照统一部署，扎实推进各项任务落实，确保取得实效。' +
        '要加强组织领导，明确责任分工，建立健全工作机制，形成齐抓共管的良好局面。',
    )
  }
  return blocks.join('\n\n')
}

function makeDocWithContainers(blocks: number): string {
  const out: string[] = ['# 通知']
  for (let i = 0; i < blocks; i += 1) {
    out.push(
      [
        '::: body.paragraph.indent: 0em',
        '各部门要充分认识本次工作的重要意义，确保取得实效。',
        ':::',
      ].join('\n'),
    )
  }
  return out.join('\n\n')
}

const parserConfig = {
  headingNumbering: true,
  disabledSyntax: ['codeBlock', 'blockquote', 'unorderedList', 'horizontalRule'] as string[],
  headingStyles: {
    h2: '{zhHansIndex}、',
    h3: '（{zhHansIndex}）',
  },
}

// ---------------------------------------------------------------------------
// Integration tests — cache is transparent to the public API
// ---------------------------------------------------------------------------

describe('BlockCache integration (via MarkdownParser)', () => {
  it('produces identical output on repeated parse of the same document', () => {
    const doc = makeDoc(30)
    const parser = new MarkdownParser(undefined, parserConfig)

    const first = parser.parse(doc)
    const second = parser.parse(doc)

    expect(second.html).toBe(first.html)
    expect(second.tokens.length).toBe(first.tokens.length)
  })

  it('edit at end: cached output matches fresh-parser output', () => {
    const doc = makeDoc(30)
    const edited = doc + '。'

    // Parser A: warm cache, then parse the edit (uses block cache)
    const cached = new MarkdownParser(undefined, parserConfig)
    cached.parse(doc) // warm
    const cachedResult = cached.parse(edited)

    // Parser B: fresh, no cache — full parse
    const fresh = new MarkdownParser(undefined, parserConfig)
    const freshResult = fresh.parse(edited)

    expect(cachedResult.html).toBe(freshResult.html)
    expect(cachedResult.tokens.length).toBe(freshResult.tokens.length)
  })

  it('edit in middle: cached output matches fresh-parser output', () => {
    const doc = makeDoc(30)
    const docBlocks = doc.split('\n\n')
    // Edit the 15th block
    docBlocks[15] = docBlocks[15] + '（修订）'
    const edited = docBlocks.join('\n\n')

    const cached = new MarkdownParser(undefined, parserConfig)
    cached.parse(doc) // warm
    const cachedResult = cached.parse(edited)

    const fresh = new MarkdownParser(undefined, parserConfig)
    const freshResult = fresh.parse(edited)

    expect(cachedResult.html).toBe(freshResult.html)
    expect(cachedResult.tokens.length).toBe(freshResult.tokens.length)
  })

  it('correctly handles documents with ::: local-style containers', () => {
    const doc = makeDocWithContainers(25)

    const cached = new MarkdownParser(undefined, parserConfig)
    cached.parse(doc) // warm
    const cachedResult = cached.parse(doc + '。')

    const fresh = new MarkdownParser(undefined, parserConfig)
    const freshResult = fresh.parse(doc + '。')

    expect(cachedResult.html).toBe(freshResult.html)
    expect(cachedResult.tokens.length).toBe(freshResult.tokens.length)
  })

  it('correctly handles small documents (bypasses cache internally)', () => {
    const doc = makeDoc(5) // well below 20-block threshold

    const parser = new MarkdownParser(undefined, parserConfig)
    const first = parser.parse(doc)
    const second = parser.parse(doc + '。')

    const fresh = new MarkdownParser(undefined, parserConfig)
    const freshResult = fresh.parse(doc + '。')

    // Small docs bypass the cache — but correctness must be the same
    expect(second.html).toBe(freshResult.html)
    expect(first.html.length).toBeGreaterThan(0)
  })

  it('invalidates cache when setOptions rebuilds markdown-it', () => {
    const doc = makeDoc(30)
    const parser = new MarkdownParser(undefined, parserConfig)
    parser.parse(doc) // warm cache

    // Changing linkify forces a markdown-it rebuild → cache must invalidate
    parser.setOptions({ ...parserConfig, linkify: false })

    // After invalidation, parse should still produce correct output
    const result = parser.parse(doc)
    expect(result.html.length).toBeGreaterThan(0)
    // With linkify off, URLs should not become links
    const withUrl = parser.parse('详见 https://example.com')
    expect(withUrl.html).not.toContain('<a href')
  })

  it('heading numbering still works correctly with cached blocks', () => {
    const doc = makeDoc(30)
    const parser = new MarkdownParser(undefined, parserConfig)

    // Warm cache
    parser.parse(doc)
    // Parse again — heading numbers should still be sequential
    const result = parser.parse(doc)

    // Check that h2 headings have sequential numbering
    const h2Matches = result.html.match(/<h2>/g)
    expect(h2Matches).not.toBeNull()
    // The first h2 should contain "一、" (zhHansIndex for 1)
    expect(result.html).toContain('一、')
  })

  it('reference links resolve across block boundaries', () => {
    // Definition in one block, usage in another — cross-block reference.
    const doc = Array.from({ length: 30 }, (_, i) => {
      if (i === 5) return '[gb]: https://www.gov.cn/guobiao'
      if (i === 15) return '参见[国家标准][gb]相关要求。'
      return `段落${i + 1}：各部门要充分认识本次工作的重要意义，按照统一部署，扎实推进各项任务落实。`
    }).join('\n\n')

    const cached = new MarkdownParser(undefined, parserConfig)
    cached.parse(doc) // warm
    const cachedResult = cached.parse(doc + '。')

    const fresh = new MarkdownParser(undefined, parserConfig)
    const freshResult = fresh.parse(doc + '。')

    // Both must produce the same HTML — reference must resolve to a link
    expect(cachedResult.html).toBe(freshResult.html)
    expect(cachedResult.html).toContain('<a href="https://www.gov.cn/guobiao"')
  })

  it('reference links survive cold-to-warm cache transition', () => {
    // First parse goes through fallback + seed, second through cache hits.
    const doc = Array.from({ length: 30 }, (_, i) => {
      if (i === 3) return '[ref]: https://example.com'
      if (i === 20) return '链接：[点击这里][ref]'
      return `段落${i + 1}：各部门要充分认识本次工作的重要意义。`
    }).join('\n\n')

    const parser = new MarkdownParser(undefined, parserConfig)

    // Cold: fallback path (diffAndMerge returns null → seed)
    const cold = parser.parse(doc)
    // Warm: cache-hit path
    const warm = parser.parse(doc)

    // Both must resolve the reference link — seed() must not store
    // per-block tokens that lose the cross-block reference.
    expect(warm.html).toBe(cold.html)
    expect(warm.html).toContain('<a href="https://example.com"')
  })

  it('re-editing a definition URL updates cached reference uses (M-4 regression)', () => {
    // 无容器纯手写大文档（缓存唯一生效域）改定义 URL 后，引用使用块必须重 parse，
    // 不能再命中缓存返回旧 href。
    const makeDoc = (url: string) =>
      Array.from({ length: 30 }, (_, i) => {
        if (i === 3) return `[gb]: ${url}`
        if (i === 20) return '参见[国家标准][gb]相关要求。'
        return `段落${i + 1}：各部门要充分认识本次工作的重要意义。`
      }).join('\n\n')

    const parser = new MarkdownParser(undefined, parserConfig)

    parser.parse(makeDoc('https://www.gov.cn/guobiao')) // warm, v1
    const edited = parser.parse(makeDoc('https://www.gov.cn/guobiao-v2'))

    // 引用使用块重 parse 后必须读到新定义（v2），不能是缓存里的旧 href（v1）。
    expect(edited.html).toContain('https://www.gov.cn/guobiao-v2')
    expect(edited.html).not.toContain('<a href="https://www.gov.cn/guobiao"')
  })
})

// ---------------------------------------------------------------------------
// Unit tests — BlockCache internals
// ---------------------------------------------------------------------------

describe('BlockCache unit', () => {
  const md = new MarkdownIt({ html: false, breaks: false, linkify: false, typographer: false })
  const parseBlock = (block: string) => md.parse(block, {})

  it('diffAndMerge returns null for documents below the block threshold', () => {
    const cache = new BlockCache()
    const small = Array.from({ length: 19 }, (_, i) => `段落${i + 1}`).join('\n\n')
    const result = cache.diffAndMerge(small, parseBlock)
    expect(result).toBeNull()
  })

  it('diffAndMerge returns null when a block has unbalanced :::', () => {
    const cache = new BlockCache()
    // 25 blocks, but one has an odd ::: count
    const blocks = Array.from({ length: 25 }, (_, i) => {
      if (i === 10) return '::: body.paragraph.indent:0em\n内容'
      return `段落${i + 1}`
    })
    const doc = blocks.join('\n\n')
    const result = cache.diffAndMerge(doc, parseBlock)
    expect(result).toBeNull()
  })

  it('diffAndMerge returns null when the doc contains any ::: container (cache disabled)', () => {
    const cache = new BlockCache()
    // 含 ::: 的文档整体禁缓存（M1/H2：容器与跨块状态冲突），一律回退全量解析。
    // 即使容器成对闭合也如此——主流程（gongwen/paragraph）toMarkdown 输出大量 :::，
    // 缓存只对"无容器、纯手写 markdown"的大文档有意义。
    const blocks = Array.from({ length: 25 }, (_, i) => {
      if (i === 10) return '::: body.paragraph.indent:0em\n内容\n:::'
      return `段落${i + 1}`
    })
    const doc = blocks.join('\n\n')
    const result = cache.diffAndMerge(doc, parseBlock)
    expect(result).toBeNull()
  })

  it('invalidate clears the store so subsequent calls miss cache', () => {
    const cache = new BlockCache()
    const doc = Array.from({ length: 25 }, (_, i) => `段落${i + 1}`).join('\n\n')

    // First call warms the cache (all misses → parsed and stored)
    cache.diffAndMerge(doc, parseBlock)
    // Second call should hit cache for all blocks
    const result2 = cache.diffAndMerge(doc, parseBlock)
    expect(result2).not.toBeNull()

    // Invalidate
    cache.invalidate()

    // After invalidation, all blocks should miss again
    // (We can't directly observe misses, but the result must still be correct)
    const result3 = cache.diffAndMerge(doc, parseBlock)
    expect(result3).not.toBeNull()
    expect(result3!.length).toBe(result2!.length)
  })

  it('seed populates cache so next diffAndMerge hits', () => {
    const cache = new BlockCache()
    const doc = Array.from({ length: 25 }, (_, i) => `段落${i + 1}`).join('\n\n')

    // Seed without going through diffAndMerge
    cache.seed(doc, parseBlock)

    // Now diffAndMerge should hit all cached blocks
    const result = cache.diffAndMerge(doc, parseBlock)
    expect(result).not.toBeNull()
    expect(result!.length).toBeGreaterThan(0)
  })

  it('含引用定义的文档 diffAndMerge 不因缓存命中丢 env', () => {
    // 无 ::: 的纯文本大文档走缓存；引用定义块永不缓存（每次重 parse），
    // 确保跨块引用在缓存命中路径下仍能看到最新定义（H2 修复）。
    const cache = new BlockCache()
    const blocks = Array.from({ length: 25 }, (_, i) => {
      if (i === 3) return '[gb]: https://www.gov.cn/guobiao'
      if (i === 12) return '参见[国家标准][gb]相关要求。'
      return `段落${i + 1}`
    })
    const doc = blocks.join('\n\n')

    // 第一次全 miss → 定义块被 parse 进 env
    const first = cache.diffAndMerge(doc, parseBlock)
    expect(first).not.toBeNull()
    // 第二次定义块重 parse（不缓存）→ 引用块仍能看到定义
    const second = cache.diffAndMerge(doc, parseBlock)
    expect(second).not.toBeNull()
    expect(second!.length).toBe(first!.length)
  })
})
