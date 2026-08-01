import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SettingsSection } from "./nav-sections"

interface SectionHeaderProps {
  section: SettingsSection
  label: string
  onRename: (contentKey: string, nextKey: string) => void
  onRemove: (contentKey: string) => void
}

/**
 * Title row of the detail pane. A custom content level additionally gets a
 * rename field and a remove button, since those actions apply to the level as a
 * whole rather than to any single field.
 */
export function SectionHeader({
  section,
  label,
  onRename,
  onRemove,
}: SectionHeaderProps) {
  const { t } = useTranslation()

  if (!section.removable || !section.contentKey) {
    return <h2 className="text-sm font-semibold">{label}</h2>
  }

  const contentKey = section.contentKey

  return (
    <div className="flex items-end justify-between gap-2">
      <label className="grid gap-1 text-xs text-muted-foreground">
        <span>{t("settings.levelKey")}</span>
        <Input
          type="text"
          className="h-8 w-48 text-xs"
          defaultValue={contentKey}
          key={contentKey}
          onBlur={(e) => onRename(contentKey, e.target.value)}
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemove(contentKey)}
      >
        {t("settings.delete")}
      </Button>
    </div>
  )
}

export default SectionHeader
