import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DOC_STORAGE_KEY = 'ezdoc-document'

interface DocState {
  content: string
  html: string
  title: string
  isDirty: boolean
  lastSaved: string | null

  setContent: (content: string) => void
  updateHtml: (html: string) => void
  setTitle: (title: string) => void
  save: () => void
  load: () => void
  reset: () => void

  getWordCount: () => number
  getCharCount: () => number
}

export const useDocStore = create<DocState>()(
  persist(
    (set, get) => ({
      content: '',
      html: '',
      title: '',
      isDirty: false,
      lastSaved: null,

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

      load() {
        // State is auto-hydrated by zustand persist. No-op.
      },

      reset() {
        set({ content: '', html: '', title: '', isDirty: false, lastSaved: null })
      },

      getWordCount() {
        const text = get().content
        if (!text) return 0
        const plainText = text
          .replace(/!\[.*?\]\(.*?\)/g, '')
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          .replace(/[#*_`~]/g, '')
          .trim()
        const chineseChars = plainText.match(/[一-龥]/g) || []
        const textWithoutChinese = plainText.replace(/[一-龥]/g, '')
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
    },
  ),
)
