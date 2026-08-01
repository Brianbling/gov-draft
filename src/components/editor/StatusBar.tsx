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
  const isDirty = useDocStore((state) => state.isDirty)
  const lastSaved = useDocStore((state) => state.lastSaved)

  const savedAt = formatSavedAt(lastSaved)

  return (
    <div
      className="status-bar flex items-center gap-2 border-t px-3 py-1"
      role="status"
      aria-label={t("toolbar.statsAria")}
    >
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {t("toolbar.wordCount", { count: wordCount })}
        {" · "}
        {t("toolbar.charCount", { count: charCount })}
      </span>
      <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">
        {isDirty || !savedAt
          ? t("toolbar.unsaved")
          : t("toolbar.savedAt", { time: savedAt })}
      </span>
    </div>
  )
}

export default StatusBar
