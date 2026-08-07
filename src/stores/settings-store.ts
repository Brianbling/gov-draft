import { create } from "zustand"
import { persist } from "zustand/middleware"

const SETTINGS_STORAGE_KEY = "ezdoc-settings"

export type ColorMode = "light" | "dark"

export interface EditorSettings {
  fontSize: number
  lineNumbers: boolean
  wordWrap: boolean
  tabSize: number
  /** 显示 `:::` 排版代码（默认隐藏折叠，展开显示原始 descriptor 行）。 */
  showLayoutCode?: boolean
}

export interface PreviewSettings {
  zoom: number
}

interface SettingsState {
  editorSettings: EditorSettings
  previewSettings: PreviewSettings
  autoSave: boolean
  autoSaveInterval: number
  chromiumPath: string
  /** 内测分发：LLM API key 存在本地 localStorage，不打包进前端 bundle。 */
  llmApiKey: string
  /** LLM 服务地址/模型覆盖（空 = 使用代码默认 DeepSeek）。 */
  llmEndpoint: string
  llmModel: string

  updateEditorSettings: (settings: Partial<EditorSettings>) => void
  updatePreviewSettings: (settings: Partial<PreviewSettings>) => void
  setAutoSave: (enabled: boolean) => void
  setAutoSaveInterval: (interval: number) => void
  setChromiumPath: (path: string) => void
  setLlmApiKey: (key: string) => void
  setLlmEndpoint: (endpoint: string) => void
  setLlmModel: (model: string) => void
  resetSettings: () => void
}

const DEFAULT_EDITOR: EditorSettings = {
  fontSize: 18,
  lineNumbers: true,
  wordWrap: true,
  tabSize: 2,
  showLayoutCode: false,
}

const DEFAULT_PREVIEW: PreviewSettings = {
  zoom: 100,
}

const DEFAULT_AUTO_SAVE = true
const DEFAULT_AUTO_SAVE_INTERVAL = 30000
const DEFAULT_CHROMIUM_PATH = ""
const DEFAULT_LLM_API_KEY = ""
const DEFAULT_LLM_ENDPOINT = ""
const DEFAULT_LLM_MODEL = ""

/**
 * Bounds for the numeric settings, matching the min/max on their form inputs.
 * Clamping happens here rather than only in the form because this is the
 * persistence boundary: a value like `zoom: 0` (an emptied number input yields
 * `Number("") === 0`) would otherwise be written to localStorage and blank the
 * preview until storage is cleared by hand.
 */
const LIMITS = {
  fontSize: { min: 8, max: 48 },
  tabSize: { min: 1, max: 8 },
  zoom: { min: 30, max: 200 },
} as const

/** Clamp into range; non-finite input falls back to the previous value. */
function clamp(
  value: number,
  fallback: number,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      editorSettings: { ...DEFAULT_EDITOR },
      previewSettings: { ...DEFAULT_PREVIEW },
      autoSave: DEFAULT_AUTO_SAVE,
      autoSaveInterval: DEFAULT_AUTO_SAVE_INTERVAL,
      chromiumPath: DEFAULT_CHROMIUM_PATH,
      llmApiKey: DEFAULT_LLM_API_KEY,
      llmEndpoint: DEFAULT_LLM_ENDPOINT,
      llmModel: DEFAULT_LLM_MODEL,

      updateEditorSettings(settings) {
        set((s) => {
          const merged = { ...s.editorSettings, ...settings }
          return {
            editorSettings: {
              ...merged,
              fontSize: clamp(
                merged.fontSize,
                s.editorSettings.fontSize,
                LIMITS.fontSize.min,
                LIMITS.fontSize.max
              ),
              tabSize: clamp(
                merged.tabSize,
                s.editorSettings.tabSize,
                LIMITS.tabSize.min,
                LIMITS.tabSize.max
              ),
            },
          }
        })
      },

      updatePreviewSettings(settings) {
        set((s) => {
          const merged = { ...s.previewSettings, ...settings }
          return {
            previewSettings: {
              ...merged,
              zoom: clamp(
                merged.zoom,
                s.previewSettings.zoom,
                LIMITS.zoom.min,
                LIMITS.zoom.max
              ),
            },
          }
        })
      },

      setAutoSave(enabled) {
        set({ autoSave: enabled })
      },

      setAutoSaveInterval(interval) {
        if (interval < 1000) return
        set({ autoSaveInterval: interval })
      },

      setChromiumPath(path) {
        set({ chromiumPath: path.trim() })
      },

      setLlmApiKey(key) {
        set({ llmApiKey: key.trim() })
      },

      setLlmEndpoint(endpoint) {
        set({ llmEndpoint: endpoint.trim() })
      },

      setLlmModel(model) {
        set({ llmModel: model.trim() })
      },

      resetSettings() {
        set({
          editorSettings: { ...DEFAULT_EDITOR },
          previewSettings: { ...DEFAULT_PREVIEW },
          autoSave: DEFAULT_AUTO_SAVE,
          autoSaveInterval: DEFAULT_AUTO_SAVE_INTERVAL,
          chromiumPath: DEFAULT_CHROMIUM_PATH,
          llmApiKey: DEFAULT_LLM_API_KEY,
          llmEndpoint: DEFAULT_LLM_ENDPOINT,
          llmModel: DEFAULT_LLM_MODEL,
        })
      },
    }),
    { name: SETTINGS_STORAGE_KEY }
  )
)
