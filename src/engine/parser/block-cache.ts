import Token from 'markdown-it/lib/token.mjs'

const BLOCK_SPLIT_RE = /\n\n+/
const MIN_BLOCK_COUNT = 20
const CONTAINER_MARKER = ':::'

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

    // If any block has an odd count of ::: the container fence crosses a
    // blank-line boundary — fall back to full-doc parse.
    // Fast-path: skip the per-block scan when no ::: exists anywhere.
    if (preprocessed.includes(CONTAINER_MARKER)) {
      for (let i = 0; i < blocks.length; i++) {
        const count = blocks[i]!.split(CONTAINER_MARKER).length - 1
        if (count % 2 !== 0) {
          return null
        }
      }
    }

    // Shared env so cross-block state (reference definitions, etc.)
    // accumulates across all per-block parses.
    const env: Record<string, unknown> = {}
    const result: Token[] = []

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!
      const volatile = block.includes(CONTAINER_MARKER)

      if (!volatile) {
        const cached = this.store.get(block)
        if (cached !== undefined) {
          // Clone on read so token processors can mutate freely without
          // corrupting the cache.
          result.push(...cloneTokens(cached))
          continue
        }
      }

      const tokens = parseBlock(block, env)
      result.push(...tokens)

      if (!volatile) {
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
      if (!this.store.has(block)) {
        this.store.set(block, cloneTokens(parseBlock(block, env)))
      }
    }
  }
}
