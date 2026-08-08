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

function renderOverlay() {
  return render(
    <I18nextProvider i18n={i18n}>
      <SettingsOverlay open={true} onOpenChange={() => {}} />
    </I18nextProvider>
  )
}

describe("add-level (新增 Level) button", () => {
  it("renders a new custom level section after clicking the add button", () => {
    useRuleStore.getState().initializeRule()
    renderOverlay()

    // The add button lives under the content group header.
    const addBtn = screen.getByRole("button", { name: "新增 Level" })
    expect(addBtn).toBeTruthy()

    fireEvent.click(addBtn)

    // A new removable section keyed content.custom1 must appear in the nav.
    expect(screen.getByText("custom1")).toBeTruthy()
  })
})
