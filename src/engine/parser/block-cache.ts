import Token from 'markdown-it/lib/token.mjs'

const BLOCK_SPLIT_RE = /\n\n+/
const MIN_BLOCK_COUNT = 20
const CONTAINER_MARKER = ':::'

// 引用定义块（reference link definition，如 `[gb]: url`）是跨块状态：
// 该块被缓存命中跳过 parse 时，env 里就缺定义，引用块会渲染成字面
// `[文本][gb]`。这类块必须每次重 parse，确保 env 的引用定义始终最新。
const REFERENCE_DEFINITION_RE = /^\[[^\]]+\]:\s+\S+/m
// 引用使用块（`[文本][id]` / `[id][]`）渲染时从 env 查定义；若被缓存命中
// 跳过 parse，其 href 固化为旧值。改定义 URL 后引用仍指向旧链接。
// 使用块同样必须每次重 parse，与定义块一起保持 env 的引用一致。
const REFERENCE_USE_RE = /\[[^\]\[]+\]\[[^\]]+\]|\[[^\]\[]+\]\[\]/m

function isReferenceDefinitionBlock(blockText: string): boolean {
  return REFERENCE_DEFINITION_RE.test(blockText)
}

function isReferenceUsingBlock(blockText: string): boolean {
  return REFERENCE_USE_RE.test(blockText)
}

function cloneToken(t: Token): Token {
  const c = new Token(t.type, t.tag, t.nesting)
  c.content = t.content
  c.markup = t.markup
  c.info = t.info
  c.meta = t.meta
  c.block = t.block
  c.hidden = t.hidden
  c.level = t.level
  if (t.map) c.map = [t.map[0], t.map[1]]
  if (t.attrs) {
    c.attrs = t.attrs.map(([k, v]) => [k, v] as [string, string])
  }
  if (t.children) {
    c.children = t.children.map((child) => cloneToken(child))
  }
  return c
}

function cloneTokens(tokens: Token[]): Token[] {
  return tokens.map((t) => cloneToken(t))
}

function splitBlocks(preprocessed: string): string[] {
  return preprocessed.split(BLOCK_SPLIT_RE).filter((b) => b.length > 0)
}

/**
 * Content-addressable per-block token cache for incremental markdown parsing.
 * Internal to MarkdownParser — not part of the engine's public API.
 */
export class BlockCache {
  private readonly store = new Map<string, Token[]>()

  invalidate(): void {
    this.store.clear()
  }

  /**
   * Split preprocessed markdown into blocks, re-parse only changed blocks,
   * and return the merged token array.  Returns null when caching is
   * unsuitable (too few blocks, or ::: crossing block boundaries).
   *
   * A shared `env` object flows through all per-block parseBlock calls so
   * that cross-block state (reference link definitions, footnotes, etc.)
   * accumulates correctly — matching full-document parse semantics.
   */
  diffAndMerge(
    preprocessed: string,
    parseBlock: (blockText: string, env: Record<string, unknown>) => Token[],
  ): Token[] | null {
    const blocks = splitBlocks(preprocessed)

    if (blocks.length < MIN_BLOCK_COUNT) {
      return null
    }

    // ezdoc 主流程（gongwen/paragraph）的 toMarkdown 输出大量 `:::` 容器，
    // 经 lineBreakNormalizer 后常被拆成奇数 `:::` 块 → 下面立即回退全量解析。
    // 缓存只对"无容器、纯手写 markdown"的大文档有意义；含容器时直接禁缓存，
    // 避免引入"缓存命中跳过跨块状态"的错误面，也省掉逐块扫描。
    if (preprocessed.includes(CONTAINER_MARKER)) {
      return null
    }

    // Shared env so cross-block state (reference definitions, etc.)
    // accumulates across all per-block parses.
    const env: Record<string, unknown> = {}
    const result: Token[] = []

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!
      const cacheable =
        !isReferenceDefinitionBlock(block) && !isReferenceUsingBlock(block)
      const cached = cacheable ? this.store.get(block) : undefined
      if (cached !== undefined) {
        // Clone on read so token processors can mutate freely without
        // corrupting the cache.
        result.push(...cloneTokens(cached))
        continue
      }

      const tokens = parseBlock(block, env)
      result.push(...tokens)

      if (cacheable) {
        // Clone on store — the same Token objects live in `result` and
        // will be mutated in-place by token processors (e.g. heading
        // numbering).  The cache must hold an independent copy.
        this.store.set(block, cloneTokens(tokens))
      }
    }

    return result
  }

  /** Warm the cache from a full-doc parse fallback. */
  seed(
    preprocessed: string,
    parseBlock: (blockText: string, env: Record<string, unknown>) => Token[],
  ): void {
    const blocks = splitBlocks(preprocessed)

    if (blocks.length < MIN_BLOCK_COUNT) return

    // Shared env so per-block parses see the same cross-block state.
    const env: Record<string, unknown> = {}

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!
      if (block.includes(CONTAINER_MARKER)) continue
      if (isReferenceDefinitionBlock(block)) continue
      if (isReferenceUsingBlock(block)) continue
      if (!this.store.has(block)) {
        this.store.set(block, cloneTokens(parseBlock(block, env)))
      }
    }
  }
}
