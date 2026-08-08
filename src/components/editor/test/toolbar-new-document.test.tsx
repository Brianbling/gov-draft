import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
if (typeof globalThis.localStorage === "undefined") {
  const backing = new Map<string, string>()
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
    },
  })
}

vi.mock("@/hooks/use-markdown", () => ({
  useMarkdown: () => ({}),
}))
vi.mock("@/hooks/use-auto-save", () => ({
  useAutoSave: () => ({}),
}))
vi.mock("@/components/editor/CodeMirrorReact", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/editor/CodeMirrorReact")>()
  return {
    ...actual,
    default: (props: { value: string; onChange: (value: string) => void }) => (
      <textarea
        aria-label="editor"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    ),
  }
})

const { useDocStore } = await import("@/stores/doc-store")
const { App } = await import("@/App")

describe("toolbar new-document (+) button", () => {
  it("dispatches the new-document event on window (listener contract)", () => {
    const listener = vi.fn()
    window.addEventListener("ezdoc:new-document", listener)
    try {
      render(<App />)
      // Toolbar "+" button: title = 新建文档
      const btn = screen.getByTitle("新建文档 (Ctrl+N)")
      expect(btn).toBeTruthy()
      fireEvent.click(btn)
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener("ezdoc:new-document", listener)
    }
  })

  it("new-document event resets a non-blank document (blank → confirm dialog, non-blank path)", () => {
    render(<App />)
    const editor = screen.getByLabelText("editor") as HTMLTextAreaElement

    // Seed a non-blank document, then click "+".
    fireEvent.change(editor, { target: { value: "正文内容" } })
    expect(useDocStore.getState().isBlankDocument()).toBe(false)

    const btn = screen.getByTitle("新建文档 (Ctrl+N)")
    fireEvent.click(btn)

    // Non-blank → confirm dialog should appear (not silent reset).
    expect(screen.getByText("新建空白文档？")).toBeTruthy()
  })
})
