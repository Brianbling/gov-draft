import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSchemaForm } from "./schema-form-context"
import { matchPreset, type FontPreset } from "./font-presets"

const CUSTOM_VALUE = "__custom__"

interface FontFamilyFieldProps {
  path: string
  presets: FontPreset[]
}

/**
 * A font-stack field: preset dropdown above the raw text input.
 *
 * Picking a preset overwrites the field with its full fallback chain. The input
 * stays editable for stacks the presets do not cover, in which case the select
 * shows "custom".
 */
export function FontFamilyField({ path, presets }: FontFamilyFieldProps) {
  const { t } = useTranslation()
  const { getValue, setValue } = useSchemaForm()

  const raw = getValue(path)
  const value = raw != null ? String(raw) : ""
  const matched = matchPreset(presets, value)

  return (
    <div className="grid gap-1">
      <Select
        value={matched ? matched.id : CUSTOM_VALUE}
        onValueChange={(id) => {
          if (id === CUSTOM_VALUE) return
          const preset = presets.find((p) => p.id === id)
          if (preset) setValue(path, preset.stack)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {t(`fontPreset.${preset.id}`)}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>{t("fontPreset.custom")}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="text"
        className="font-mono text-xs"
        value={value}
        onChange={(e) => setValue(path, e.target.value)}
      />
    </div>
  )
}

export default FontFamilyField
