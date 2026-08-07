import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { BracketsIcon } from "@hugeicons/core-free-icons"
import { useSettingsStore } from "@/stores/settings-store"

/** 显示/隐藏 `:::` 排版代码。隐藏时容器折叠为单行，正文像纯文本可改。 */
export function LayoutCodeToggle() {
  const { t } = useTranslation()
  const showLayoutCode = useSettingsStore(
    (s) => s.editorSettings.showLayoutCode
  )
  const updateEditorSettings = useSettingsStore((s) => s.updateEditorSettings)

  const handleToggle = useCallback(() => {
    updateEditorSettings({ showLayoutCode: !showLayoutCode })
  }, [showLayoutCode, updateEditorSettings])

  return (
    <Button
      variant={showLayoutCode ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={showLayoutCode}
      title={t("toolbar.toggleLayoutCode")}
      aria-label={t("toolbar.toggleLayoutCode")}
      onClick={handleToggle}
    >
      <HugeiconsIcon icon={BracketsIcon} />
    </Button>
  )
}

export default LayoutCodeToggle
