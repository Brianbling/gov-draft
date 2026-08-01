import { EditorState, type Extension } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"
import {
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap,
} from "@codemirror/view"
import i18n from "@/locales"
import type { EditorSettings } from "@/stores/settings-store"

import { syntaxHighlightingExtension } from "./features/syntax-highlight"
import { searchExtension } from "./features/search"
import { autoPairExtension } from "./features/auto-pair"
import { highlightActiveLine } from "./features/active-line"
import { lineWrapExtension } from "./features/line-wrap"
import {
  fontSizeExtension,
  lineNumbersExtension,
  tabSizeExtension,
} from "./features/editor-config"

interface CreateEditorStateOptions {
  content: string
  onChange: (value: string) => void
  settings: EditorSettings
}

const MIN_LINE_NUMBER_DIGITS = 2

function syncLineNumberDigits(view: EditorView): void {
  const lineCount = view.state.doc.lines
  const digits = Math.max(MIN_LINE_NUMBER_DIGITS, String(lineCount).length)
  view.dom.style.setProperty("--cm-line-number-digits", String(digits))
}

const lineNumberDigitsPlugin = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      syncLineNumberDigits(view)
    }
    update(update: ViewUpdate): void {
      if (!update.docChanged) return
      syncLineNumberDigits(update.view)
    }
  }
)

export function createEditorState(
  options: CreateEditorStateOptions
): EditorState {
  const { settings } = options
  const extensions: Extension[] = [
    history(),
    keymap.of([indentWithTab, ...historyKeymap, ...defaultKeymap]),
    tabSizeExtension(settings.tabSize),
    lineNumbersExtension(settings.lineNumbers),
    lineNumberDigitsPlugin,
    fontSizeExtension(settings.fontSize),
    markdown(),
    syntaxHighlightingExtension,
    ...searchExtension,
    ...autoPairExtension,
    highlightActiveLine(),
    lineWrapExtension(settings.wordWrap),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      options.onChange(update.state.doc.toString())
    }),
    EditorView.contentAttributes.of({
      "aria-label": i18n.t("codemirror.editorAria"),
    }),
  ]

  return EditorState.create({ doc: options.content, extensions })
}
