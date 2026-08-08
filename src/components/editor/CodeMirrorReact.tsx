import { useEffect, useRef, useImperativeHandle, forwardRef } from "react"
import { EditorView } from "@codemirror/view"
import { undo, redo, undoDepth, redoDepth } from "@codemirror/commands"
import { createEditorState, replaceDocument } from "./core/build-extensions"
import { applyEditorSettings } from "./core/features/editor-config"
import {
  executeFormat,
  type FormatAction,
} from "./core/features/format-commands"
import { useSettingsStore } from "@/stores/settings-store"
import type { EditorSettings } from "@/stores/settings-store"

interface CodeMirrorReactProps {
  value: string
  onChange: (value: string) => void
  /** 光标/选区移动时上报当前行标题层级（`#` 数量，非标题行为 0）。 */
  onActiveHeadingChange?: (level: number) => void
}

export interface CodeMirrorHandle {
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
  format: (action: FormatAction) => boolean
}

const CodeMirrorReact = forwardRef<CodeMirrorHandle, CodeMirrorReactProps>(
  function CodeMirrorReact({ value, onChange, onActiveHeadingChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onActiveHeadingChangeRef = useRef(onActiveHeadingChange)

    const editorSettings = useSettingsStore((s) => s.editorSettings)
    // Snapshot of the settings the view was last configured with, so the
    // effect below only reconfigures compartments that actually changed.
    const appliedSettingsRef = useRef<EditorSettings | null>(null)

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
      onActiveHeadingChangeRef.current = onActiveHeadingChange
    }, [onActiveHeadingChange])

    useImperativeHandle(ref, () => ({
      undo: () => {
        if (!viewRef.current) return false
        return undo(viewRef.current)
      },
      redo: () => {
        if (!viewRef.current) return false
        return redo(viewRef.current)
      },
      canUndo: () => {
        if (!viewRef.current) return false
        return undoDepth(viewRef.current.state) > 0
      },
      canRedo: () => {
        if (!viewRef.current) return false
        return redoDepth(viewRef.current.state) > 0
      },
      format: (action: FormatAction) => {
        if (!viewRef.current) return false
        // 点击工具栏 <button> 会把 DOM 焦点移出编辑器，后续打字/Ctrl+Z
        // （historyKeymap 只在编辑器聚焦时响应）全部失效。dispatch 后回焦。
        const applied = executeFormat(viewRef.current, action)
        if (applied) viewRef.current.focus()
        return applied
      },
    }))

    useEffect(() => {
      if (!containerRef.current) return
      // Read the store directly: the mount effect wants the latest settings
      // without listing them as a dependency (that would rebuild the view).
      const initialSettings = useSettingsStore.getState().editorSettings
      const state = createEditorState({
        content: value,
        onChange: (newValue: string) => {
          onChangeRef.current(newValue)
        },
        settings: initialSettings,
        // 光标/选区变化上报当前行标题层级，驱动工具栏按钮激活态。
        onActiveHeadingChange: (level) => {
          onActiveHeadingChangeRef.current?.(level)
        },
      })
      const view = new EditorView({
        state,
        parent: containerRef.current,
      })
      viewRef.current = view
      appliedSettingsRef.current = initialSettings
      return () => {
        view.destroy()
        viewRef.current = null
        appliedSettingsRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Apply editor settings changes (font size, line numbers, tab size, wrap)
    // to the live view without rebuilding it.
    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      applyEditorSettings(view, appliedSettingsRef.current, editorSettings)
      appliedSettingsRef.current = editorSettings
    }, [editorSettings])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      const current = view.state.doc.toString()
      if (current !== value) {
        replaceDocument(view, value)
      }
    }, [value])

    return (
      <div ref={containerRef} className="codemirror-wrapper min-h-0 flex-1" />
    )
  }
)

export default CodeMirrorReact
