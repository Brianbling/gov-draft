import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import { FolderOpenIcon } from "@hugeicons/core-free-icons"
import { open } from "@tauri-apps/plugin-dialog"
import { isTauri, trackedInvoke } from "@/lib/tauri"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { EditorSettings, PreviewSettings } from "@/stores/settings-store"

export interface EditorSettingsDraft {
  editorSettings: EditorSettings
  previewSettings: PreviewSettings
  autoSave: boolean
  autoSaveInterval: number
  chromiumPath: string
  llmApiKey: string
  llmEndpoint: string
  llmModel: string
}

interface EditorSettingsFormProps {
  draft: EditorSettingsDraft
  onChange: (next: EditorSettingsDraft) => void
}

/**
 * Parse a number input, returning null for an empty or partial value.
 *
 * `Number("")` is 0, so passing the raw value straight through would persist a
 * zero font size or zoom the moment the field is cleared mid-edit. Callers skip
 * the update on null and leave the previous value in place.
 */
function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function EditorSettingsForm({
  draft,
  onChange,
}: EditorSettingsFormProps) {
  const { t } = useTranslation()

  // 自动检测系统 Chromium 路径，未手动设置时自动填入
  useEffect(() => {
    if (!isTauri()) return
    // 用户已手动设置过路径 → 不覆盖
    if (draft.chromiumPath.trim().length > 0) return

    let cancelled = false
    trackedInvoke<string | null>("detect_chromium")
      .then((result) => {
        if (!cancelled && result) {
          onChange({ ...draft, chromiumPath: result })
        }
      })
      .catch(() => {
        // 检测失败，忽略
      })

    return () => {
      cancelled = true
    }
  }, [])

  const setEditor = (patch: Partial<EditorSettings>) =>
    onChange({
      ...draft,
      editorSettings: { ...draft.editorSettings, ...patch },
    })
  const setPreview = (patch: Partial<PreviewSettings>) =>
    onChange({
      ...draft,
      previewSettings: { ...draft.previewSettings, ...patch },
    })

  return (
    <div className="grid gap-3">
      <section className="grid gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("settings.editorGroup")}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>{t("settings.editorFontSize")}</span>
            <Input
              type="number"
              min={8}
              max={48}
              step={1}
              value={draft.editorSettings.fontSize}
              onChange={(e) => {
                const fontSize = parseNumber(e.target.value)
                if (fontSize !== null) setEditor({ fontSize })
              }}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>{t("settings.editorTabSize")}</span>
            <Input
              type="number"
              min={1}
              max={8}
              step={1}
              value={draft.editorSettings.tabSize}
              onChange={(e) => {
                const tabSize = parseNumber(e.target.value)
                if (tabSize !== null) setEditor({ tabSize })
              }}
            />
          </label>
        </div>
        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={draft.editorSettings.lineNumbers}
            onCheckedChange={(v) => setEditor({ lineNumbers: v === true })}
          />
          <span>{t("settings.editorLineNumbers")}</span>
        </Label>
        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={draft.editorSettings.wordWrap}
            onCheckedChange={(v) => setEditor({ wordWrap: v === true })}
          />
          <span>{t("settings.editorWordWrap")}</span>
        </Label>
      </section>

      <section className="grid gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("settings.previewGroup")}
        </span>
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span>{t("settings.previewZoom")}</span>
          <Input
            type="number"
            min={30}
            max={200}
            step={5}
            value={draft.previewSettings.zoom}
            onChange={(e) => {
              const zoom = parseNumber(e.target.value)
              if (zoom !== null) setPreview({ zoom })
            }}
          />
        </label>
      </section>

      <section className="grid gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("settings.autoSaveGroup")}
        </span>
        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={draft.autoSave}
            onCheckedChange={(v) =>
              onChange({ ...draft, autoSave: v === true })
            }
          />
          <span>{t("settings.autoSaveEnabled")}</span>
        </Label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span>{t("settings.autoSaveInterval")}</span>
          <Input
            type="number"
            min={1}
            max={600}
            step={1}
            value={Math.round(draft.autoSaveInterval / 1000)}
            onChange={(e) => {
              const seconds = parseNumber(e.target.value)
              if (seconds === null) return
              onChange({
                ...draft,
                autoSaveInterval: Math.min(600, Math.max(1, seconds)) * 1000,
              })
            }}
          />
        </label>
      </section>

      {isTauri() && (
        <section className="grid gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("settings.pdfGroup")}
          </span>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>{t("settings.chromiumPath")}</span>
            <div className="flex gap-1">
              <Input
                type="text"
                className="flex-1"
                placeholder={t("settings.chromiumPathPlaceholder")}
                value={draft.chromiumPath}
                onChange={(e) =>
                  onChange({ ...draft, chromiumPath: e.target.value })
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={async () => {
                  const path = await open({
                    title: t("settings.chromiumPath"),
                  })
                  if (path) {
                    onChange({ ...draft, chromiumPath: path })
                  }
                }}
              >
                <HugeiconsIcon icon={FolderOpenIcon} className="size-3.5" />
              </Button>
            </div>
          </label>
        </section>
      )}
    </div>
  )
}

export default EditorSettingsForm
