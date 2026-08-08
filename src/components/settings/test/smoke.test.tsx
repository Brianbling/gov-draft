import { describe, it, expect } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"

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

function renderOverlay(open: boolean) {
  return render(
    <I18nextProvider i18n={i18n}>
      <SettingsOverlay open={open} onOpenChange={() => {}} />
    </I18nextProvider>
  )
}

describe("SettingsOverlay smoke", () => {
  it("renders nothing when closed", () => {
    renderOverlay(false)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("renders the nav with a section per content level when open", () => {
    renderOverlay(true)

    expect(screen.getByRole("dialog")).toBeTruthy()
    const nav = screen.getByRole("navigation")
    const items = within(nav).getAllByRole("button")
    const labels = items.map((el) => el.textContent)

    // basic + ai + 5 builtin content levels + page/pagination/parser + editor
    expect(labels).toContain("基础")
    expect(labels).toContain("AI 服务")
    expect(labels).toContain("正文")
    expect(labels).toContain("一级标题")
    expect(labels).toContain("页面")
    expect(labels).toContain("编辑器与预览")
  })

  it("first run (no API key) opens on the AI section showing the key field", () => {
    renderOverlay(true)

    // The must-configure API key input is front and center on first run.
    expect(screen.getByText("API Key")).toBeTruthy()
    // A rule field must not be rendered while AI 服务 is selected.
    expect(screen.queryByDisplayValue(/^GB\/T /)).toBeNull()
  })

  it("switches the detail pane when a nav section is selected", () => {
    renderOverlay(true)
    const nav = screen.getByRole("navigation")

    fireEvent.click(within(nav).getByRole("button", { name: "正文" }))

    expect(screen.getByText("每行字数")).toBeTruthy()
    expect(screen.getByText("字体")).toBeTruthy()
  })

  it("filters to matching fields when searching", () => {
    renderOverlay(true)
    const nav = screen.getByRole("navigation")

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "每行字数" },
    })

    // One hit per content level, and the section list is replaced by results.
    expect(within(nav).getAllByText("每行字数")).toHaveLength(5)
    expect(within(nav).queryByRole("button", { name: "页面" })).toBeNull()
  })
})
