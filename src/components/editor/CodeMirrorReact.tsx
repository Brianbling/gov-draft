import { useEffect, useRef, useImperativeHandle, forwardRef } from "react"
import { EditorView } from "@codemirror/view"
import { undo, redo, undoDepth, redoDepth } from "@codemirror/commands"
import { createEditorState } from "./core/build-extensions"
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
}

export interface CodeMirrorHandle {
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
  format: (action: FormatAction) => boolean
}

const CodeMirrorReact = forwardRef<CodeMirrorHandle, CodeMirrorReactProps>(
  function CodeMirrorReact({ value, onChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)

    const editorSettings = useSettingsStore((s) => s.editorSettings)
    // Snapshot of the settings the view was last configured with, so the
    // effect below only reconfigures compartments that actually changed.
    const appliedSettingsRef = useRef<EditorSettings | null>(null)

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

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
        return executeFormat(viewRef.current, action)
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
        view.dispatch({
          changes: {
            from: 0,
            to: current.length,
            insert: value,
          },
        })
      }
    }, [value])

    return (
      <div ref={containerRef} className="codemirror-wrapper min-h-0 flex-1" />
    )
  }
)

export default CodeMirrorReact
