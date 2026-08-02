import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertDialog, Dialog } from "radix-ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon, Download01Icon } from "@hugeicons/core-free-icons"
import { stringify as yamlStringify } from "yaml"
import { RuleConfigSchema, traverseSchema } from "@/engine/schema"
import type { RuleConfig } from "@/engine"
import { useRuleStore } from "@/stores/rule-store"
import { useSettingsStore } from "@/stores/settings-store"
import { Button } from "@/components/ui/button"
import { RuleSettingsForm } from "./RuleSettingsForm"
import { EditorSettingsForm } from "./EditorSettingsForm"
import type { EditorSettingsDraft } from "./EditorSettingsForm"
import { AiSettingsForm } from "./AiSettingsForm"
import { SettingsNav } from "./SettingsNav"
import { SectionHeader } from "./SectionHeader"
import {
  buildNavEntries,
  buildSearchIndex,
  searchFields,
  isGroup,
  lastSegment,
  EDITOR_SECTION_ID,
  AI_SECTION_ID,
  type SettingsNavEntry,
  type SettingsSection,
} from "./nav-sections"
import { parseRuleYaml, RuleParseError } from "@/engine/schema/yaml-mapper"
import { buildLevelTemplate } from "./level-template"

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function settingsDirty(
  draft: SettingsDraft,
  snapshot: SettingsDraft
): boolean {
  if (!jsonEqual(draft.rule, snapshot.rule)) return true
  if (!jsonEqual(draft.editor, snapshot.editor)) return true
  return false
}

interface SettingsDraft {
  rule: Record<string, unknown> | null
  /** Pristine builtin rule of the same name, for per-field reset. */
  baseline: Record<string, unknown> | null
  editor: EditorSettingsDraft
}

/**
 * Snapshot the current rule + settings from the shared (persisted) stores once,
 * synchronously, for lazy state initialization. `initializeRule()` is
 * idempotent, so running it here (rather than in an effect) is safe and avoids
 * a setState-in-effect cascade.
 */
function bootstrapDraft(): SettingsDraft {
  const ruleStore = useRuleStore.getState()
  ruleStore.initializeRule()
  const rule = useRuleStore.getState().currentRule
  const builtin = useRuleStore
    .getState()
    .availableRules.find((r) => r.name === rule?.name)
  const s = useSettingsStore.getState()

  // Prefer editor settings stored alongside the rule (imported YAML) over the
  // settings store, then fall back to defaults from the settings store.
  const ruleEditor = rule?.editor as Record<string, unknown> | undefined
  const rulePreview = rule?.preview as Record<string, unknown> | undefined
  const ruleAutoSave = rule?.autoSave as Record<string, unknown> | undefined

  return {
    rule: rule ? (clone(rule) as Record<string, unknown>) : null,
    baseline: builtin ? (clone(builtin) as Record<string, unknown>) : null,
    editor: {
      editorSettings: {
        fontSize:
          typeof ruleEditor?.fontSize === "number"
            ? ruleEditor.fontSize
            : s.editorSettings.fontSize,
        lineNumbers:
          typeof ruleEditor?.lineNumbers === "boolean"
            ? ruleEditor.lineNumbers
            : s.editorSettings.lineNumbers,
        wordWrap:
          typeof ruleEditor?.wordWrap === "boolean"
            ? ruleEditor.wordWrap
            : s.editorSettings.wordWrap,
        tabSize:
          typeof ruleEditor?.tabSize === "number"
            ? ruleEditor.tabSize
            : s.editorSettings.tabSize,
      },
      previewSettings: {
        zoom:
          typeof rulePreview?.zoom === "number"
            ? rulePreview.zoom
            : s.previewSettings.zoom,
      },
      autoSave:
        typeof ruleAutoSave?.enabled === "boolean"
          ? ruleAutoSave.enabled
          : s.autoSave,
      autoSaveInterval:
        typeof ruleAutoSave?.interval === "number"
          ? ruleAutoSave.interval
          : s.autoSaveInterval,
      chromiumPath: s.chromiumPath,
      llmApiKey: s.llmApiKey,
      llmEndpoint: s.llmEndpoint,
      llmModel: s.llmModel,
    },
  }
}

/**
 * The settings form itself. Mounted only while the overlay is open (Radix
 * unmounts `Dialog.Content` when closed), so every open starts from a fresh
 * snapshot of the stores without an extra sync effect.
 */
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()

  const [draft, setDraft] = useState<SettingsDraft>(bootstrapDraft)
  // First run has no LLM API key yet — land on the AI section so the
  // must-configure step is the first thing the user sees. Returning users
  // (key already set) land on 基础 as before.
  const defaultSectionId =
    draft.editor.llmApiKey.trim().length === 0 ? AI_SECTION_ID : "basic"
  const [selectedId, setSelectedId] = useState(defaultSectionId)
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Guarded close: when the draft drifted from the persisted stores (rule or
   * editor/AI fields), ask for confirmation before discarding; otherwise close.
   * Import replaces the draft wholesale, so importing always ends in a clean
   * (implicitly accepted) state.
   */
  const closeIfClean = () => {
    if (settingsDirty(draft, bootstrapDraft())) {
      setPendingClose(true)
      return
    }
    onClose()
  }

  const descriptors = useMemo(() => traverseSchema(RuleConfigSchema), [])

  const setRuleModel = (rule: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, rule }))
  const setEditorDraft = (editor: EditorSettingsDraft) =>
    setDraft((d) => ({ ...d, editor }))

  const entries = useMemo(
    () => buildNavEntries(descriptors, draft.rule ?? {}),
    [descriptors, draft.rule]
  )

  /** Nav labels: prefer an i18n key, fall back to the raw model key. */
  const labelFor = (entry: SettingsNavEntry): string => {
    if (i18n.exists(entry.labelKey)) return t(entry.labelKey)
    return isGroup(entry) ? entry.labelKey : (entry.labelFallback ?? entry.id)
  }

  const fieldLabelFor = (path: string): string => {
    const key = `ruleField.${lastSegment(path)}`
    return i18n.exists(key) ? t(key) : lastSegment(path)
  }

  const searchIndex = useMemo(
    () => buildSearchIndex(entries, fieldLabelFor, labelFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, i18n.language]
  )
  const hits = useMemo(
    () => searchFields(searchIndex, query),
    [searchIndex, query]
  )

  const selected = entries.find(
    (e): e is SettingsSection => !isGroup(e) && e.id === selectedId
  )

  /** Add a custom content level, seeded from the body level so it is valid. */
  const handleAddLevel = () => {
    if (!draft.rule) return
    const content = draft.rule.content
    if (typeof content !== "object" || content === null) return

    const existing = content as Record<string, unknown>
    let index = 1
    while (`custom${index}` in existing) index += 1
    const key = `custom${index}`

    setRuleModel({
      ...draft.rule,
      content: { ...existing, [key]: buildLevelTemplate(existing) },
    })
    setSelectedId(`content.${key}`)
  }

  const handleRemoveLevel = (contentKey: string) => {
    if (!draft.rule) return
    const content = draft.rule.content
    if (typeof content !== "object" || content === null) return

    const next = { ...(content as Record<string, unknown>) }
    delete next[contentKey]
    setRuleModel({ ...draft.rule, content: next })
    setSelectedId("content.body")
  }

  const handleRenameLevel = (contentKey: string, nextKey: string) => {
    const trimmed = nextKey.trim()
    if (!draft.rule || trimmed === contentKey || trimmed.length === 0) return
    const content = draft.rule.content
    if (typeof content !== "object" || content === null) return

    const existing = content as Record<string, unknown>
    if (trimmed in existing) return

    // Rebuild in insertion order so the renamed level keeps its nav position.
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(existing)) {
      next[k === contentKey ? trimmed : k] = v
    }
    setRuleModel({ ...draft.rule, content: next })
    setSelectedId(`content.${trimmed}`)
  }

  const handleExport = () => {
    if (!draft.rule) return
    // editor / preview / autoSave are now proper fields of the rule schema,
    // so the YAML output is a complete, self-contained export.
    const yaml = yamlStringify(draft.rule, { lineWidth: 0 })
    const name =
      typeof draft.rule.name === "string"
        ? draft.rule.name
        : "ezdoc-rule"
    const filename = `${name.replace(/[^a-zA-Z0-9一-鿿_-]/g, "_")}.yaml`
    const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      let parsed: RuleConfig
      try {
        parsed = parseRuleYaml(text)
      } catch (e) {
        // Distinguish "malformed YAML" from "valid YAML that fails the rule
        // schema" so a missing quote around a numeric scalar is not reported
        // as a corrupt file.
        if (e instanceof RuleParseError) {
          if (e.parseError !== undefined) {
            setError(t("settings.importInvalidYaml", { message: String(e.parseError) }))
            return
          }
          const details =
            e.zodError?.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ") ?? e.message
          setError(t("settings.importInvalidRule", { details }))
          return
        }
        throw e
      }
      const rule = parsed as Record<string, unknown>

      // Extract editor / preview / autosave from the imported rule.
      const editor = rule.editor as Record<string, unknown> | undefined
      const preview = rule.preview as Record<string, unknown> | undefined
      const autoSaveConfig = rule.autoSave as Record<string, unknown> | undefined

      const editorSettings = {
        fontSize:
          typeof editor?.fontSize === "number"
            ? editor.fontSize
            : draft.editor.editorSettings.fontSize,
        lineNumbers:
          typeof editor?.lineNumbers === "boolean"
            ? editor.lineNumbers
            : draft.editor.editorSettings.lineNumbers,
        wordWrap:
          typeof editor?.wordWrap === "boolean"
            ? editor.wordWrap
            : draft.editor.editorSettings.wordWrap,
        tabSize:
          typeof editor?.tabSize === "number"
            ? editor.tabSize
            : draft.editor.editorSettings.tabSize,
      }
      const previewSettings = {
        zoom:
          typeof preview?.zoom === "number"
            ? preview.zoom
            : draft.editor.previewSettings.zoom,
      }
      const autoSave =
        typeof autoSaveConfig?.enabled === "boolean"
          ? autoSaveConfig.enabled
          : draft.editor.autoSave
      const autoSaveInterval =
        typeof autoSaveConfig?.interval === "number"
          ? autoSaveConfig.interval
          : draft.editor.autoSaveInterval

      setDraft({
        rule,
        baseline: null,
        editor: { editorSettings, previewSettings, autoSave, autoSaveInterval, chromiumPath: draft.editor.chromiumPath, llmApiKey: draft.editor.llmApiKey, llmEndpoint: draft.editor.llmEndpoint, llmModel: draft.editor.llmModel },
      })
      setSelectedId("basic")
      setError("")
    } catch {
      setError(t("settings.importFailed"))
    } finally {
      // Reset so re-importing the same file re-fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = () => {
    if (!draft.rule) return
    setSaving(true)
    setError("")
    try {
      // Merge editor / preview / autoSave into the rule so the persisted
      // YAML is a complete, self-contained export snapshot.
      const merged = {
        ...draft.rule,
        editor: { ...draft.editor.editorSettings },
        preview: { ...draft.editor.previewSettings },
        autoSave: {
          enabled: draft.editor.autoSave,
          interval: draft.editor.autoSaveInterval,
        },
      }
      const parsed = RuleConfigSchema.safeParse(merged)
      if (!parsed.success) {
        setError(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
        )
        return
      }
      const nextRule: RuleConfig = parsed.data

      // Persist + compile the rule; the preview recompiles off the store.
      useRuleStore.getState().loadRule(nextRule)

      const settings = useSettingsStore.getState()
      settings.updateEditorSettings(draft.editor.editorSettings)
      settings.updatePreviewSettings(draft.editor.previewSettings)
      settings.setAutoSave(draft.editor.autoSave)
      settings.setAutoSaveInterval(draft.editor.autoSaveInterval)
      settings.setChromiumPath(draft.editor.chromiumPath)
      settings.setLlmApiKey(draft.editor.llmApiKey)
      settings.setLlmEndpoint(draft.editor.llmEndpoint)
      settings.setLlmModel(draft.editor.llmModel)

      onClose()
    } catch {
      setError(t("settings.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Dialog.Title className="text-base font-semibold">
            {t("settings.title")}
          </Dialog.Title>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={handleExport}
            disabled={!draft.rule}
          >
            <HugeiconsIcon icon={Download01Icon} className="size-3.5" />
            {t("settings.exportRule")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={handleImportClick}
          >
            <HugeiconsIcon icon={Upload01Icon} className="size-3.5" />
            {t("settings.importRule")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={closeIfClean}
          >
            {t("settings.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !draft.rule}
            onClick={handleSave}
          >
            {saving ? t("settings.saving") : t("settings.saveAndApply")}
          </Button>
        </div>
      </header>

      <AlertDialog.Root open={pendingClose} onOpenChange={setPendingClose}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-overlay/80 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <AlertDialog.Content
            className="fixed top-1/2 left-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-background p-5 text-foreground shadow-2xl duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <AlertDialog.Title className="text-sm font-semibold">
              {t("settings.confirmDiscardTitle")}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-1.5 text-xs text-muted-foreground">
              {t("settings.confirmDiscardMessage")}
            </AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Cancel
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Button type="button" variant="secondary" size="sm">
                  {t("settings.keepEditing")}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action
                asChild
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
              >
                <Button type="button" variant="destructive" size="sm">
                  {t("settings.discardChanges")}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {draft.rule ? (
        <div className="flex min-h-0 flex-1">
          <SettingsNav
            entries={entries}
            selectedId={selectedId}
            onSelect={setSelectedId}
            query={query}
            onQueryChange={setQuery}
            hits={hits}
            onAddLevel={handleAddLevel}
            labelFor={labelFor}
          />

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {selected ? (
              <div className="grid max-w-2xl gap-3">
                <SectionHeader
                  section={selected}
                  label={labelFor(selected)}
                  onRename={handleRenameLevel}
                  onRemove={handleRemoveLevel}
                />
                {selected.id === EDITOR_SECTION_ID ? (
                  <EditorSettingsForm
                    draft={draft.editor}
                    onChange={setEditorDraft}
                  />
                ) : selected.id === AI_SECTION_ID ? (
                  <AiSettingsForm
                    draft={draft.editor}
                    onChange={setEditorDraft}
                  />
                ) : (
                  <RuleSettingsForm
                    section={selected}
                    model={draft.rule}
                    onChange={setRuleModel}
                    baseline={draft.baseline}
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("settings.selectSection")}
              </p>
            )}

            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          </div>
        </div>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          {t("settings.loading")}
        </p>
      )}
    </>
  )
}

interface SettingsOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Full-bleed settings layer over the main window.
 *
 * Built on the Dialog primitive directly rather than `ui/sheet` — the overlay
 * covers the whole window, so the sheet's side/width classes would all need
 * overriding. Radix still provides Esc-to-close, the focus trap and scroll lock.
 */
export function SettingsOverlay({ open, onOpenChange }: SettingsOverlayProps) {
  const { t } = useTranslation()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/80 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          aria-label={t("settings.dialogAria")}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        >
          <SettingsPanel onClose={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default SettingsOverlay
