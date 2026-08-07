import { useTranslation } from "react-i18next"
import { useDocStore } from "@/stores/doc-store"

/** Format an ISO timestamp as local HH:mm, or null if unparseable. */
function formatSavedAt(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function StatusBar() {
  const { t } = useTranslation()
  const wordCount = useDocStore((state) => state.getWordCount())
  const charCount = useDocStore((state) => state.getCharCount())
  const title = useDocStore((state) => state.title)
  const isDirty = useDocStore((state) => state.isDirty)
  const lastSaved = useDocStore((state) => state.lastSaved)
  const manualSaveAt = useDocStore((state) => state.manualSaveAt)

  const savedAt = formatSavedAt(lastSaved)
  const manualAt = formatSavedAt(manualSaveAt)

  // P0-4：语义从"未保存"报警改为"自动保存中/已自动保存 HH:mm"。
  // 显式 Ctrl+S 用"已保存 HH:mm"反馈；自动保存用独立文案，不报警。
  let saveLabel: string
  if (isDirty) {
    saveLabel = t("toolbar.autoSaving")
  } else if (manualAt && savedAt && manualAt === savedAt) {
    saveLabel = t("toolbar.savedAt", { time: manualAt })
  } else if (savedAt) {
    saveLabel = t("toolbar.autoSavedAt", { time: savedAt })
  } else {
    saveLabel = t("toolbar.unsaved")
  }

  return (
    <div
      className="status-bar flex items-center gap-2 border-t px-3 py-1"
      role="status"
      aria-label={t("toolbar.statsAria")}
    >
      <span className="min-w-0 flex-1 truncate text-xs whitespace-nowrap text-muted-foreground">
        {t("toolbar.documentName", {
          title: title || t("toolbar.newDocument"),
        })}
      </span>
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {t("toolbar.wordCount", { count: wordCount })}
        {" · "}
        {t("toolbar.charCount", { count: charCount })}
      </span>
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {saveLabel}
      </span>
    </div>
  )
}

export default StatusBar
