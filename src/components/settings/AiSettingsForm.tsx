import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import type { EditorSettingsDraft } from "./EditorSettingsForm"

interface AiSettingsFormProps {
  draft: EditorSettingsDraft
  onChange: (next: EditorSettingsDraft) => void
}

/**
 * Dedicated "AI 服务" settings section: the LLM API key is the must-configure
 * step on first run, so it gets its own nav entry instead of being buried at
 * the bottom of the editor settings form.
 */
export function AiSettingsForm({ draft, onChange }: AiSettingsFormProps) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3">
      <section className="grid gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("settings.llmGroup")}
        </span>
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span>{t("settings.llmApiKey")}</span>
          <Input
            type="password"
            className="flex-1"
            placeholder={t("settings.llmApiKeyPlaceholder")}
            value={draft.llmApiKey}
            onChange={(e) => onChange({ ...draft, llmApiKey: e.target.value })}
          />
          <span className="text-[11px] text-muted-foreground/70">
            {t("settings.llmApiKeyHint")}
          </span>
        </label>
      </section>
    </div>
  )
}

export default AiSettingsForm
