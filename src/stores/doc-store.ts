import { create } from "zustand"
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware"
import { useSettingsStore } from "./settings-store"

const DOC_STORAGE_KEY = "ezdoc-document"

// autoSave=false 时普通编辑不落盘（开关语义：关闭自动保存 = 内容不自动持久化），
// 仅显式 Ctrl+S（saveManually）放行一次。armed 由 saveManually 置位，
// 下一次 storage.setItem 消费后复位。
let manualSaveArmed = false

const docStorage: StateStorage = {
  getItem: (name) => {
    if (typeof localStorage === "undefined") return null
    return localStorage.getItem(name)
  },
  setItem: (name, value) => {
    if (typeof localStorage === "undefined") return
    // 自动保存关闭且非显式手动保存 → 抑制写盘。已落盘的旧值保留，
    // 刷新恢复到"最后一次落盘"状态（手动保存语义）。
    const autoSave = useSettingsStore.getState().autoSave
    if (!autoSave && !manualSaveArmed) return
    manualSaveArmed = false
    localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    if (typeof localStorage === "undefined") return
    localStorage.removeItem(name)
  },
}

/** 空白文档占位标题：与 toMarkdown 的空标题兜底一致，保证 A4 预览不为空。 */
export const BLANK_DOCUMENT = "# 未命名公文"

interface DocState {
  content: string
  html: string
  title: string
  isDirty: boolean
  lastSaved: string | null
  /** 最近一次显式 Ctrl+S 的时间（区别于自动保存的 lastSaved）。 */
  manualSaveAt: string | null

  setContent: (content: string) => void
  updateHtml: (html: string) => void
  setTitle: (title: string) => void
  save: () => void
  saveManually: () => void
  load: () => void
  reset: () => void
  /** 新建空白文档：清空正文并保留未命名标题占位。 */
  newDocument: () => void
  /** 仅剩默认未命名标题（无正文），视为"空白"文档。 */
  isBlankDocument: () => boolean

  getWordCount: () => number
  getCharCount: () => number
}

export const useDocStore = create<DocState>()(
  persist(
    (set, get) => ({
      content: "",
      html: "",
      title: "",
      isDirty: false,
      lastSaved: null,
      manualSaveAt: null,

      setContent(content) {
        // 值未变化时跳过 isDirty 置位：newDocument 后 App 的同步 effect 用相同
        // 内容再调一次 setContent，若无条件置脏，新建空白文档会误报"未保存"。
        if (get().content === content) return
        set({ content, isDirty: true })
      },

      updateHtml(html) {
        set({ html })
      },

      setTitle(title) {
        set({ title, isDirty: true })
      },

      save() {
        set({ isDirty: false, lastSaved: new Date().toISOString() })
        // persist handles localStorage; this just clears the dirty flag
      },

      saveManually() {
        const now = new Date().toISOString()
        // 显式保存必须落盘：放行下一次 storage.setItem（即使 autoSave=false）。
        manualSaveArmed = true
        set({ isDirty: false, lastSaved: now, manualSaveAt: now })
      },

      load() {
        // State is auto-hydrated by zustand persist. No-op.
      },

      reset() {
        set({
          content: "",
          html: "",
          title: "",
          isDirty: false,
          lastSaved: null,
          manualSaveAt: null,
        })
      },

      newDocument() {
        const title = "# 未命名公文"
        set({
          content: title,
          html: "",
          title,
          isDirty: false,
          lastSaved: null,
          manualSaveAt: null,
        })
      },

      isBlankDocument() {
        const text = get().content.trim()
        return text === "" || text === "# 未命名公文"
      },

      getWordCount() {
        const text = get().content
        if (!text) return 0
        const plainText = text
          .replace(/!\[.*?\]\(.*?\)/g, "")
          .replace(/\[(.*?)\]\(.*?\)/g, "$1")
          .replace(/[#*_`~]/g, "")
          .trim()
        const chineseChars = plainText.match(/[一-龥]/g) || []
        const textWithoutChinese = plainText.replace(/[一-龥]/g, "")
        const englishWords = textWithoutChinese.match(/[a-zA-Z0-9]+/g) || []
        return chineseChars.length + englishWords.length
      },

      getCharCount() {
        return get().content.length
      },
    }),
    {
      name: DOC_STORAGE_KEY,
      storage: createJSONStorage(() => docStorage),
      partialize: (state) => ({
        content: state.content,
        html: state.html,
        title: state.title,
        lastSaved: state.lastSaved,
      }),
    }
  )
)
