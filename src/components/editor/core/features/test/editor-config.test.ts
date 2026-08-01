import { describe, it, expect, vi } from "vitest"
import { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { applyEditorSettings, tabSizeExtension } from "../editor-config"
import type { EditorSettings } from "@/stores/settings-store"

const BASE: EditorSettings = {
  fontSize: 16,
  lineNumbers: true,
  wordWrap: true,
  tabSize: 2,
}

/** Minimal EditorView stand-in: only `dispatch` is exercised. */
function fakeView() {
  const dispatch = vi.fn()
  return { view: { dispatch } as unknown as EditorView, dispatch }
}

describe("applyEditorSettings", () => {
  it("dispatches all four compartments on first apply (prev = null)", () => {
    const { view, dispatch } = fakeView()
    applyEditorSettings(view, null, BASE)
    expect(dispatch).toHaveBeenCalledTimes(1)
    const { effects } = dispatch.mock.calls[0]![0]
    expect(effects).toHaveLength(4)
  })

  it("does not dispatch when nothing changed", () => {
    const { view, dispatch } = fakeView()
    applyEditorSettings(view, BASE, { ...BASE })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("dispatches only the changed compartment", () => {
    const { view, dispatch } = fakeView()
    applyEditorSettings(view, BASE, { ...BASE, fontSize: 20 })
    expect(dispatch).toHaveBeenCalledTimes(1)
    const { effects } = dispatch.mock.calls[0]![0]
    expect(effects).toHaveLength(1)
  })

  it("dispatches multiple compartments when several change", () => {
    const { view, dispatch } = fakeView()
    applyEditorSettings(view, BASE, {
      ...BASE,
      lineNumbers: false,
      wordWrap: false,
    })
    const { effects } = dispatch.mock.calls[0]![0]
    expect(effects).toHaveLength(2)
  })
})

describe("tabSizeExtension", () => {
  it("keeps the configured tab size", () => {
    const state = EditorState.create({ extensions: tabSizeExtension(4) })
    expect(state.tabSize).toBe(4)
  })

  it("clamps 0 to 1 so column arithmetic never divides by zero", () => {
    const state = EditorState.create({ extensions: tabSizeExtension(0) })
    expect(state.tabSize).toBe(1)
  })
})
