import {
  Compartment,
  EditorState,
  type Extension,
  type Text,
} from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import {
  foldEffect,
  foldGutter,
  foldKeymap,
  foldService,
  foldState,
  unfoldEffect,
} from "@codemirror/language"

/**
 * Syntax-sugar folding for `::: descriptor` container blocks.
 *
 * A container is an opening line `::: <descriptor>` followed by any number of
 * lines and closed by a line whose trimmed text is exactly `:::` (nested
 * containers are allowed). When folded, the whole block collapses to a single
 * line showing `::: <descriptor>` plus the standard `…` fold placeholder;
 * clicking the placeholder or the gutter marker expands it back.
 *
 * Folding is purely visual — the document text is never modified.
 */

const SUGAR_OPEN_PATTERN = /^\s*:::\s+\S/
const SUGAR_CLOSE_PATTERN = /^\s*:::\s*$/

export interface SugarBlock {
  from: number
  to: number
  descriptor: string
}

/** Scan the document and pair `::: descriptor` openers with their `:::` closers. */
export function findSugarBlocks(doc: Text): SugarBlock[] {
  const blocks: SugarBlock[] = []
  const stack: Array<{ from: number; descriptor: string }> = []

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber)
    const lineText = line.text

    if (SUGAR_OPEN_PATTERN.test(lineText)) {
      const descriptor = lineText.replace(/^\s*:::\s*/, "").trim()
      stack.push({ from: line.from, descriptor })
      continue
    }

    if (SUGAR_CLOSE_PATTERN.test(lineText) && stack.length > 0) {
      const open = stack.pop()
      if (open) {
        blocks.push({
          from: open.from,
          to: line.from,
          descriptor: open.descriptor,
        })
      }
    }
  }

  return blocks
}

/**
 * Fold service: given a line that starts a `:::` container, return the range to
 * collapse — from the start of the closing `:::` line to the end of that line.
 * The opening descriptor line stays visible as the fold's first visible line.
 */
export function sugarFoldRange(
  state: EditorState,
  lineStart: number,
  lineEnd: number
): { from: number; to: number } | null {
  const line = state.doc.lineAt(lineStart)
  if (!SUGAR_OPEN_PATTERN.test(line.text)) return null

  const blocks = findSugarBlocks(state.doc)
  for (const block of blocks) {
    if (block.from >= lineStart && block.from <= lineEnd) {
      const closeLine = state.doc.lineAt(block.to)
      if (closeLine.to > block.from) {
        return { from: closeLine.from, to: closeLine.to }
      }
      return null
    }
  }

  return null
}

/** The extensions that enable `:::` folding. Mounted/unmounted via the compartment. */
export function sugarFoldEnabledExtensions(): Extension[] {
  return [foldService.of(sugarFoldRange), foldGutter(), keymap.of(foldKeymap)]
}

/** Live-reconfigurable compartment holding the sugar-fold extension. */
export const sugarFoldCompartment = new Compartment()

/** The fold extension itself (gutter + service + keymap). Disabled by default. */
export function sugarFoldExtension(enabled: boolean): Extension {
  return sugarFoldCompartment.of(enabled ? sugarFoldEnabledExtensions() : [])
}

/**
 * Fold/unfold every `:::` container, matching the settings toggle state.
 *
 * 只对 findSugarBlocks 找到的 `:::` 容器发 foldEffect —— 不能用 foldAll：那会连
 * markdown 自带的 h1-h6 标题折叠也一起执行，长文档从 `# 标题` 一路折到文末，
 * 整篇文本肉眼消失（M-7）。展开侧同样只解 sugar 折叠的 range，保留用户手动
 * 折叠的标题。
 */
export function refoldSugar(view: EditorView, enabled: boolean): void {
  const { state } = view
  const blocks = findSugarBlocks(state.doc)

  if (enabled) {
    if (blocks.length === 0) return
    const effects = blocks
      .map((block) => {
        const closeLine = state.doc.lineAt(block.to)
        if (closeLine.to <= block.from) return null
        return foldEffect.of({ from: closeLine.from, to: closeLine.to })
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
    if (effects.length > 0) view.dispatch({ effects })
    return
  }

  const field = view.state.field(foldState, false)
  if (!field || field.size === 0) return
  const effects: Array<ReturnType<typeof unfoldEffect.of>> = []
  for (const block of blocks) {
    const closeLine = state.doc.lineAt(block.to)
    const range = { from: closeLine.from, to: closeLine.to }
    let containsFolded = false
    field.between(range.from, range.to, () => {
      containsFolded = true
      return undefined
    })
    if (containsFolded) effects.push(unfoldEffect.of(range))
  }
  if (effects.length > 0) view.dispatch({ effects })
}
