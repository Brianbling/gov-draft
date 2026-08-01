import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import type { Extension } from "@codemirror/state"

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "bold", fontSize: "1.3em" },
  { tag: tags.heading2, fontWeight: "bold", fontSize: "1.15em" },
  { tag: tags.heading3, fontWeight: "bold", fontSize: "1.05em" },
  { tag: tags.heading4, fontWeight: "bold" },
  { tag: tags.heading5, fontWeight: "bold", color: "var(--muted-foreground)" },
  { tag: tags.heading6, fontWeight: "bold", color: "var(--muted-foreground)" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  {
    tag: tags.monospace,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--primary)",
  },
  { tag: tags.url, color: "var(--primary)", textDecoration: "underline" },
  { tag: tags.list, color: "var(--primary)" },
  { tag: tags.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: tags.contentSeparator, color: "var(--muted-foreground)" },
  { tag: tags.link, color: "var(--primary)", textDecoration: "underline" },
])

export const syntaxHighlightingExtension: Extension = syntaxHighlighting(
  markdownHighlightStyle
)
