import { describe, it, expect } from "vitest"
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

const { I18nextProvider } = await import("react-i18next")
const i18n = (await import("@/locales")).default
const { SettingsOverlay } = await import("../SettingsOverlay")
const { useRuleStore } = await import("@/stores/rule-store")

function renderOverlay(open: boolean, onOpenChange = () => {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <SettingsOverlay open={open} onOpenChange={onOpenChange} />
    </I18nextProvider>
  )
}

describe("SettingsOverlay font-weight save", () => {
  it("clearing the weight field resets to the default 400 and saves", () => {
    let open = true
    renderOverlay(open, () => (open = false))

    fireEvent.click(screen.getByRole("button", { name: "正文" }))

    // Builtin body weight is 400. Clear the box: the draft must not end up with
    // an empty string, which the schema's 100-900 literal union would reject.
    // The weight input is the only control in the body section showing 400.
    const weightInput = screen.getByDisplayValue("400")
    fireEvent.change(weightInput, { target: { value: "" } })

    fireEvent.click(screen.getByRole("button", { name: "保存并应用" }))

    expect(open).toBe(false)
    expect(screen.queryByText("保存失败，请检查输入格式")).toBeNull()
    expect(useRuleStore.getState().currentRule?.content.body.style.weight).toBe(
      400
    )
  })
})
