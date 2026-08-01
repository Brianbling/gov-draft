import { Compartment } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import type { Extension } from "@codemirror/state"

export const lineWrapCompartment = new Compartment()

export function lineWrapExtension(enabled: boolean): Extension {
  return lineWrapCompartment.of(enabled ? EditorView.lineWrapping : [])
}
