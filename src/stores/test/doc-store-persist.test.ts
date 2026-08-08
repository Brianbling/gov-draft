import { describe, it, expect, beforeEach } from "vitest"

// zustand persist 在模块求值期读 localStorage；jsdom 无此实现，先装内存 shim。
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

const { useDocStore } = await import("../doc-store")
const { useSettingsStore } = await import("../settings-store")

const DOC_KEY = "ezdoc-document"

function persistedContent(): string | null {
  const raw = window.localStorage.getItem(DOC_KEY)
  if (!raw) return null
  return JSON.parse(raw).state.content as string
}

describe("doc-store 持久化 · autoSave 开关", () => {
  beforeEach(() => {
    window.localStorage.clear()
    useDocStore.getState().reset()
    useSettingsStore.setState({ autoSave: true })
  })

  it("autoSave=true 时每次编辑落盘", () => {
    useDocStore.getState().setContent("自动保存的内容")
    expect(persistedContent()).toBe("自动保存的内容")
  })

  it("autoSave=false 时普通编辑不落盘（保留最后一次落盘值）", () => {
    useDocStore.getState().setContent("旧内容")
    expect(persistedContent()).toBe("旧内容")

    useSettingsStore.setState({ autoSave: false })
    useDocStore.getState().setContent("未保存的编辑")

    // 落盘值仍是最新落盘的旧内容
    expect(persistedContent()).toBe("旧内容")
    // 内存 state 是新内容（用户正在编辑）
    expect(useDocStore.getState().content).toBe("未保存的编辑")
  })

  it("autoSave=false 时显式 Ctrl+S 放行落盘一次", () => {
    useSettingsStore.setState({ autoSave: false })
    useDocStore.getState().setContent("未保存的编辑")
    expect(persistedContent()).toBeNull()

    useDocStore.getState().saveManually()
    expect(persistedContent()).toBe("未保存的编辑")

    // 手动保存只放行一次：后续普通编辑再次被抑制
    useDocStore.getState().setContent("又一次未保存的编辑")
    expect(persistedContent()).toBe("未保存的编辑")
  })
})
