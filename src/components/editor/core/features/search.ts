import { search, searchKeymap } from "@codemirror/search"
import { keymap } from "@codemirror/view"
import type { Extension } from "@codemirror/state"

export const searchExtension: Extension[] = [
  search({ top: true }),
  keymap.of(searchKeymap),
]
