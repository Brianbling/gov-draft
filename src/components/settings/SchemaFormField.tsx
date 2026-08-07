import { useTranslation } from "react-i18next"
import type { SchemaFieldDescriptor } from "@/engine/schema"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSchemaForm } from "./schema-form-context"
import { FieldShell } from "./FieldShell"
import { FontFamilyField } from "./FontFamilyField"
import { presetsForPath } from "./font-presets"

interface SchemaFormFieldProps {
  descriptor: SchemaFieldDescriptor
}

export function SchemaFormField({ descriptor }: SchemaFormFieldProps) {
  const { t, i18n } = useTranslation()
  const { getValue, setValue } = useSchemaForm()

  const segments = descriptor.path.split(".")
  const lastSeg = segments[segments.length - 1] ?? descriptor.path
  const labelKey = `ruleField.${lastSeg}`
  const label = i18n.exists(labelKey) ? t(labelKey) : lastSeg

  const raw = getValue(descriptor.path)

  // ═══ Leaf: Boolean ═══
  if (descriptor.fieldType === "boolean") {
    return (
      <FieldShell path={descriptor.path} label="">
        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={raw === true}
            onCheckedChange={(v) => setValue(descriptor.path, v === true)}
          />
          <span>{label}</span>
        </Label>
      </FieldShell>
    )
  }

  // ═══ Leaf: Font stack (preset dropdown + free text) ═══
  const fontPresets = presetsForPath(descriptor.path)
  if (descriptor.fieldType === "string" && fontPresets) {
    return (
      <FieldShell path={descriptor.path} label={label}>
        <FontFamilyField path={descriptor.path} presets={fontPresets} />
      </FieldShell>
    )
  }

  // ═══ Leaf: Enum ═══
  if (descriptor.fieldType === "enum") {
    return (
      <FieldShell path={descriptor.path} label={label}>
        <Select
          value={raw != null ? String(raw) : undefined}
          onValueChange={(v) => setValue(descriptor.path, v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {descriptor.enumValues?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>
    )
  }

  // ═══ Leaf: Font Weight ═══
  // Clearing the box resets to the default weight 400 rather than writing an
  // invalid value: the schema is a 100-900 literal union with no nullable, so a
  // persisted "" would fail RuleConfigSchema.safeParse and block saving.
  if (descriptor.fieldType === "fontWeight") {
    return (
      <FieldShell path={descriptor.path} label={label}>
        <Input
          type="number"
          min={100}
          max={900}
          step={100}
          value={raw != null ? Number(raw) : 400}
          onChange={(e) =>
            setValue(
              descriptor.path,
              e.target.value === "" ? 400 : Number(e.target.value)
            )
          }
        />
      </FieldShell>
    )
  }

  // ═══ Leaf: Number (nullable — empty clears the field) ═══
  if (descriptor.fieldType === "number") {
    return (
      <FieldShell path={descriptor.path} label={label}>
        <Input
          type="number"
          value={typeof raw === "number" ? raw : ""}
          onChange={(e) =>
            setValue(
              descriptor.path,
              e.target.value === "" ? null : Number(e.target.value)
            )
          }
        />
      </FieldShell>
    )
  }

  // ═══ Leaf: String / cssLength / cssColor ═══
  if (
    descriptor.fieldType === "string" ||
    descriptor.fieldType === "cssLength" ||
    descriptor.fieldType === "cssColor"
  ) {
    return (
      <FieldShell path={descriptor.path} label={label}>
        <Input
          type="text"
          value={raw != null ? String(raw) : ""}
          onChange={(e) => setValue(descriptor.path, e.target.value)}
        />
      </FieldShell>
    )
  }

  // ═══ Leaf: Array (comma-separated) ═══
  if (descriptor.fieldType === "array") {
    const arrayAsString = Array.isArray(raw) ? raw.join(", ") : ""
    return (
      <FieldShell path={descriptor.path} label={label}>
        <Input
          type="text"
          value={arrayAsString}
          onChange={(e) =>
            setValue(
              descriptor.path,
              e.target.value
                .split(/[，,]/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
            )
          }
        />
      </FieldShell>
    )
  }

  // Non-leaf branches are rendered by SchemaFormComplexField (below).
  return <SchemaFormComplexField descriptor={descriptor} label={label} />
}

export default SchemaFormField

interface ComplexFieldProps {
  descriptor: SchemaFieldDescriptor
  label: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function SchemaFormComplexField({ descriptor, label }: ComplexFieldProps) {
  const { t } = useTranslation()
  const { getValue, setValue } = useSchemaForm()

  // ═══ Record (dynamic key-value) ═══
  if (descriptor.fieldType === "record") {
    const record = asRecord(getValue(descriptor.path))
    const entries = Object.entries(record)

    const addEntry = () => {
      const next = { ...record }
      let idx = 1
      while (`key${idx}` in next) idx += 1
      next[`key${idx}`] = ""
      setValue(descriptor.path, next)
    }
    const removeEntry = (key: string) => {
      const next = { ...record }
      delete next[key]
      setValue(descriptor.path, next)
    }
    const renameEntry = (oldKey: string, newKey: string) => {
      if (oldKey === newKey || newKey.trim().length === 0) return
      const next = { ...record }
      const val = next[oldKey]
      delete next[oldKey]
      next[newKey.trim()] = val
      setValue(descriptor.path, next)
    }
    const updateEntry = (key: string, val: string) => {
      setValue(descriptor.path, { ...record, [key]: val })
    }

    return (
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {label}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addEntry}
          >
            +
          </Button>
        </div>
        {entries.map(([rKey, rVal]) => (
          <div key={rKey} className="flex items-end gap-2">
            <label className="grid flex-1 gap-1 text-xs text-muted-foreground">
              <span>key</span>
              <Input
                type="text"
                defaultValue={rKey}
                onBlur={(e) => renameEntry(rKey, e.target.value)}
              />
            </label>
            <label className="grid flex-1 gap-1 text-xs text-muted-foreground">
              <span>value</span>
              <Input
                type="text"
                value={String(rVal ?? "")}
                onChange={(e) => updateEntry(rKey, e.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeEntry(rKey)}
            >
              {t("settings.delete")}
            </Button>
          </div>
        ))}
      </div>
    )
  }

  return <SchemaFormObjectField descriptor={descriptor} label={label} />
}

/**
 * A nested object: a labelled group whose scalar children sit in a two-column
 * grid and whose object children recurse.
 *
 * Catchall keys (custom content levels) are NOT handled here — the settings nav
 * owns adding, renaming and removing them, so this only ever sees the schema's
 * declared children.
 */
function SchemaFormObjectField({ descriptor, label }: ComplexFieldProps) {
  // ═══ Object (flat group — no border) ═══
  if (descriptor.fieldType === "object" && descriptor.children) {
    const leafChildren = descriptor.children.filter(
      (c) => c.fieldType !== "object"
    )
    const objectChildren = descriptor.children.filter(
      (c) => c.fieldType === "object"
    )

    return (
      <div className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">
          {label}
        </span>

        {leafChildren.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {leafChildren.map((leaf) => (
              <SchemaFormField key={leaf.path} descriptor={leaf} />
            ))}
          </div>
        )}

        {objectChildren.map((objChild) => (
          <SchemaFormField key={objChild.path} descriptor={objChild} />
        ))}
      </div>
    )
  }

  // Fallback: unknown field type — render nothing.
  return null
}
