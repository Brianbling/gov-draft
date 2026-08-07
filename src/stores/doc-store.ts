import { create } from "zustand"
import { persist } from "zustand/middleware"

const DOC_STORAGE_KEY = "ezdoc-document"

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
      partialize: (state) => ({
        content: state.content,
        html: state.html,
        title: state.title,
        lastSaved: state.lastSaved,
      }),
    }
  )
)
