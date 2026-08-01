import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { TextWrapIcon } from "@hugeicons/core-free-icons"
import { useSettingsStore } from "@/stores/settings-store"

export function LineWrapToggle() {
  const { t } = useTranslation()
  const isWrapped = useSettingsStore((s) => s.editorSettings.wordWrap)
  const updateEditorSettings = useSettingsStore((s) => s.updateEditorSettings)

  const handleToggle = useCallback(() => {
    updateEditorSettings({ wordWrap: !isWrapped })
  }, [isWrapped, updateEditorSettings])

  return (
    <Button
      variant={isWrapped ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={isWrapped}
      title={t("toolbar.toggleLineWrap")}
      aria-label={t("toolbar.toggleLineWrap")}
      onClick={handleToggle}
    >
      <HugeiconsIcon icon={TextWrapIcon} />
    </Button>
  )
}

export default LineWrapToggle
