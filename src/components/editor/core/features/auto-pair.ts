import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { bracketMatching } from "@codemirror/language"
import { keymap } from "@codemirror/view"
import type { Extension } from "@codemirror/state"

export const autoPairExtension: Extension[] = [
  closeBrackets(),
  bracketMatching(),
  keymap.of(closeBracketsKeymap),
]
