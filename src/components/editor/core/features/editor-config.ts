import {
  Compartment,
  EditorState,
  type Extension,
  type StateEffect,
} from "@codemirror/state"
import { EditorView, lineNumbers } from "@codemirror/view"
import { indentUnit } from "@codemirror/language"
import type { EditorSettings } from "@/stores/settings-store"
import { lineWrapCompartment } from "./line-wrap"
import {
  refoldSugar,
  sugarFoldCompartment,
  sugarFoldEnabledExtensions,
} from "./syntax-fold"

/**
 * Live-reconfigurable editor settings, driven by the settings-store.
 *
 * Each user-tunable option lives in its own Compartment so the settings window
 * can reconfigure a running EditorView without rebuilding the whole state.
 * (Line wrapping keeps its dedicated compartment in `line-wrap.ts`.)
 */

export const fontSizeCompartment = new Compartment()
export const lineNumbersCompartment = new Compartment()
export const tabSizeCompartment = new Compartment()

/** A theme that only sets the editor font size (px). */
function fontSizeTheme(fontSize: number): Extension {
  return EditorView.theme({
    "&": { fontSize: `${fontSize}px` },
  })
}

export function fontSizeExtension(fontSize: number): Extension {
  return fontSizeCompartment.of(fontSizeTheme(fontSize))
}

export function lineNumbersExtension(enabled: boolean): Extension {
  return lineNumbersCompartment.of(enabled ? lineNumbers() : [])
}

/**
 * A tab size of 0 makes CodeMirror's column arithmetic divide by zero
 * (`countColumn` computes `n % tabSize`), so clamp before it reaches either
 * `EditorState.tabSize` or the indent unit.
 */
function tabSizeConfig(tabSize: number): Extension[] {
  const size = Math.max(1, tabSize)
  return [EditorState.tabSize.of(size), indentUnit.of(" ".repeat(size))]
}

export function tabSizeExtension(tabSize: number): Extension {
  return tabSizeCompartment.of(tabSizeConfig(tabSize))
}

/**
 * Apply changed editor settings to a live view. Only reconfigures the
 * compartments whose value actually changed to avoid redundant dispatches.
 */
export function applyEditorSettings(
  view: EditorView,
  prev: EditorSettings | null,
  next: EditorSettings
): void {
  const effects: StateEffect<unknown>[] = []
  const showLayoutCodeChanged =
    !prev || prev.showLayoutCode !== next.showLayoutCode

  if (!prev || prev.fontSize !== next.fontSize) {
    effects.push(fontSizeCompartment.reconfigure(fontSizeTheme(next.fontSize)))
  }
  if (!prev || prev.lineNumbers !== next.lineNumbers) {
    effects.push(
      lineNumbersCompartment.reconfigure(next.lineNumbers ? lineNumbers() : [])
    )
  }
  if (!prev || prev.tabSize !== next.tabSize) {
    effects.push(tabSizeCompartment.reconfigure(tabSizeConfig(next.tabSize)))
  }
  if (!prev || prev.wordWrap !== next.wordWrap) {
    effects.push(
      lineWrapCompartment.reconfigure(
        next.wordWrap ? EditorView.lineWrapping : []
      )
    )
  }
  if (showLayoutCodeChanged) {
    effects.push(
      sugarFoldCompartment.reconfigure(
        !next.showLayoutCode ? sugarFoldEnabledExtensions() : []
      )
    )
  }

  if (effects.length > 0) {
    view.dispatch({ effects })
  }

  // Refold after the compartment change lands so the fold state matches the new
  // setting (fold-all when the layout code is hidden, unfold-all when shown).
  if (showLayoutCodeChanged && prev) {
    refoldSugar(view, !next.showLayoutCode)
  }
}
