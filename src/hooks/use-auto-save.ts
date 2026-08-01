import { useEffect } from "react"
import { useDocStore } from "@/stores/doc-store"
import { useSettingsStore } from "@/stores/settings-store"

/**
 * Periodically flush the document when auto-save is enabled.
 *
 * The doc-store persists content on every edit via zustand-persist; `save()`
 * only clears the dirty flag and stamps `lastSaved`. This hook runs that flush
 * on the configured interval so `lastSaved`/`isDirty` reflect reality and the
 * StatusBar can surface save state.
 */
export function useAutoSave(): void {
  const autoSave = useSettingsStore((s) => s.autoSave)
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval)

  useEffect(() => {
    if (!autoSave) return
    const interval = Math.max(1000, autoSaveInterval)
    const timer = window.setInterval(() => {
      const doc = useDocStore.getState()
      if (doc.isDirty) doc.save()
    }, interval)
    return () => window.clearInterval(timer)
  }, [autoSave, autoSaveInterval])
}
