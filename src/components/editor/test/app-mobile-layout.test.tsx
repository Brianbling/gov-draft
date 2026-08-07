import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import i18n from "@/locales"
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

// matchMedia polyfill：默认 mock 掉，测试里按需切换 isMobile。
const mediaListeners = new Map<string, (e: MediaQueryListEvent) => void>()
let matchesMobile = false
function installMatchMedia() {
  window.matchMedia = (query: string) => {
    const mql = {
      matches: matchesMobile,
      media: query,
      addEventListener: (
        _type: string,
        cb: EventListenerOrEventListenerObject
      ) => {
        if (typeof cb === "function") {
          mediaListeners.set(query, cb)
        }
      },
      removeEventListener: (
        _type: string,
        cb: EventListenerOrEventListenerObject
      ) => {
        if (mediaListeners.get(query) === cb) mediaListeners.delete(query)
      },
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }
    return mql as MediaQueryList
  }
}

const { useDocStore } = await import("@/stores/doc-store")
const { App } = await import("@/App")

function renderApp() {
  return render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  )
}

describe("App 移动端响应式布局", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installMatchMedia()
    matchesMobile = true
    // 标记欢迎层已看过，避免 Radix alertdialog 模态拦截可访问性查询
    window.localStorage.setItem("ezdoc-welcome-seen", "1")
    useDocStore.getState().reset()
  })

  afterEach(() => {
    matchesMobile = false
    mediaListeners.clear()
    vi.restoreAllMocks()
  })

  it("移动端（<768px）：显示编辑/预览 tab 切换，无 resizer", () => {
    renderApp()
    const editTab = screen.getByRole("button", { name: "编辑" })
    const previewTab = screen.getByRole("button", { name: "预览" })
    expect(editTab).toBeDefined()
    expect(previewTab).toBeDefined()
    // 移动端不渲染桌面 resizer
    expect(document.querySelector(".resizer")).toBeNull()
    // 默认显示编辑器
    expect(screen.getByLabelText("editor")).toBeDefined()
  })

  it("移动端切到预览 tab：隐藏编辑器，显示预览面板", () => {
    renderApp()
    fireEvent.click(screen.getByRole("button", { name: "预览" }))
    // 编辑器在预览 tab 下被隐藏
    expect(document.querySelector(".editor-panel")).toBeNull()
    expect(document.querySelector(".preview-panel")).toBeDefined()
  })

  it("移动端切回编辑 tab：编辑器恢复", () => {
    renderApp()
    fireEvent.click(screen.getByRole("button", { name: "预览" }))
    fireEvent.click(screen.getByRole("button", { name: "编辑" }))
    expect(document.querySelector(".editor-panel")).toBeDefined()
    expect(screen.getByLabelText("editor")).toBeDefined()
  })

  it("桌面端（≥768px）：并排 split-pane，无 tab 切换，有 resizer", () => {
    matchesMobile = false
    renderApp()
    // 桌面端不显示移动 tab
    expect(screen.queryByRole("button", { name: "编辑" })).toBeNull()
    expect(screen.queryByRole("button", { name: "预览" })).toBeNull()
    // 并排显示编辑器 + 预览，带 resizer
    expect(document.querySelector(".editor-panel")).toBeDefined()
    expect(document.querySelector(".preview-panel")).toBeDefined()
    expect(document.querySelector(".resizer")).toBeDefined()
  })
})
