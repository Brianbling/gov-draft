import { EditorState, type Extension } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  isolateHistory,
} from "@codemirror/commands"
import {
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap,
  placeholder,
} from "@codemirror/view"
import i18n from "@/locales"
import type { EditorSettings } from "@/stores/settings-store"

import { syntaxHighlightingExtension } from "./features/syntax-highlight"
import { searchExtension } from "./features/search"
import { autoPairExtension } from "./features/auto-pair"
import { highlightActiveLine } from "./features/active-line"
import { lineWrapExtension } from "./features/line-wrap"
import { getCurrentHeadingLevel } from "./features/format-commands"
import {
  fontSizeExtension,
  lineNumbersExtension,
  tabSizeExtension,
} from "./features/editor-config"
import { sugarFoldExtension } from "./features/syntax-fold"

interface CreateEditorStateOptions {
  content: string
  onChange: (value: string) => void
  settings: EditorSettings
  /** 光标/选区变化时上报当前行标题层级（`#` 数量，非标题行为 0）。 */
  onActiveHeadingChange?: (level: number) => void
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
    // 折叠 `:::` 排版代码：showLayoutCode=false（默认）折叠隐藏，true 显示原始行。
    sugarFoldExtension(!settings.showLayoutCode),
    // 空文档占位提示：与 store 默认文档逻辑无关，纯展示层
    placeholder(i18n.t("codemirror.emptyEditorHint")),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      options.onChange(update.state.doc.toString())
    }),
    EditorView.updateListener.of((update) => {
      if (!options.onActiveHeadingChange) return
      if (update.selectionSet || update.docChanged) {
        options.onActiveHeadingChange(getCurrentHeadingLevel(update.view))
      }
    }),
    EditorView.contentAttributes.of({
      "aria-label": i18n.t("codemirror.editorAria"),
    }),
  ]

  return EditorState.create({ doc: options.content, extensions })
}

/**
 * 外部整篇替换（AI 生成 / 导入 / store 回灌）的唯一入口。
 * 用 isolateHistory("full") 让替换自身成为撤销栈里一条独立记录：
 * 一次 Ctrl+Z 撤掉整篇替换回到替换前文档，再 Ctrl+Z 继续沿用户手动击键历史回退。
 * 若直接 dispatch 全量 replace，CodeMirror 会把替换与最后一条手动击键合并成一条
 * 撤销记录，用户一次 Ctrl+Z 就把整篇新内容连同手动历史一起清空（M5 缺陷）。
 */
export function replaceDocument(view: EditorView, content: string): void {
  if (content === view.state.doc.toString()) return
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
    annotations: [isolateHistory.of("full")],
  })
}
