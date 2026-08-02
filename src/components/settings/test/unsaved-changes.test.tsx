import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"

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

const { I18nextProvider } = await import("react-i18next")
const i18n = (await import("@/locales")).default
const { SettingsOverlay } = await import("../SettingsOverlay")
const { useSettingsStore } = await import("@/stores/settings-store")

function renderOverlay(open: boolean, onOpenChange = () => {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <SettingsOverlay open={open} onOpenChange={onOpenChange} />
    </I18nextProvider>
  )
}

describe("SettingsOverlay unsaved-changes guard", () => {
  it("closes without a prompt when the editor settings are untouched", () => {
    let open = true
    renderOverlay(open, () => (open = false))

    fireEvent.click(screen.getByRole("button", { name: "取消" }))

    expect(open).toBe(false)
    expect(screen.queryByText("放弃未保存的更改？")).toBeNull()
  })

  it("prompts before discarding an edited font size, and discarding closes", () => {
    let open = true
    renderOverlay(open, () => (open = false))

    fireEvent.click(screen.getByRole("button", { name: "编辑器与预览" }))
    fireEvent.change(screen.getByDisplayValue("18"), {
      target: { value: "24" },
    })

    fireEvent.click(screen.getByRole("button", { name: "取消" }))
    expect(open).toBe(true)
    expect(screen.getByText("放弃未保存的更改？")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "放弃更改" }))
    expect(open).toBe(false)
  })

  it("keep editing keeps the overlay open", () => {
    let open = true
    renderOverlay(open, () => (open = false))

    fireEvent.click(screen.getByRole("button", { name: "编辑器与预览" }))
    fireEvent.change(screen.getByDisplayValue("18"), {
      target: { value: "24" },
    })

    fireEvent.click(screen.getByRole("button", { name: "取消" }))
    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }))

    expect(open).toBe(true)
    expect(screen.queryByText("放弃未保存的更改？")).toBeNull()
  })

  it("does not prompt for a pristine rule draft opened on a previous setting value", () => {
    useSettingsStore.getState().setLlmApiKey("prefilled-key")
    let open = true
    renderOverlay(open, () => (open = false))

    // No edits at all — closing must not ask.
    fireEvent.click(screen.getByRole("button", { name: "取消" }))

    expect(open).toBe(false)
    expect(screen.queryByText("放弃未保存的更改？")).toBeNull()
  })

  it("confirmation buttons stop propagation so the underlying dialog does not also close", () => {
    let open = true
    renderOverlay(open, () => (open = false))

    fireEvent.click(screen.getByRole("button", { name: "编辑器与预览" }))
    fireEvent.change(screen.getByDisplayValue("18"), {
      target: { value: "24" },
    })
    fireEvent.click(screen.getByRole("button", { name: "取消" }))

    // Keep editing: overlay stays open (underlying dialog would otherwise fire).
    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }))
    expect(open).toBe(true)
    expect(screen.queryByText("放弃未保存的更改？")).toBeNull()
  })

  it("the discard dialog is a separate role from the overlay dialog", () => {
    renderOverlay(true)
    fireEvent.click(screen.getByRole("button", { name: "编辑器与预览" }))
    fireEvent.change(screen.getByDisplayValue("18"), {
      target: { value: "24" },
    })
    fireEvent.click(screen.getByRole("button", { name: "取消" }))

    // The overlay dialog stays in the DOM but is aria-hidden by Radix once the
    // alert dialog stacks on top; the discard prompt is its own alertdialog.
    expect(screen.getByRole("dialog", { hidden: true })).toBeTruthy()
    expect(screen.getByRole("alertdialog")).toBeTruthy()
    expect(
      within(screen.getByRole("alertdialog")).getByText("放弃未保存的更改？")
    ).toBeTruthy()
  })
})
