import { useMemo } from "react"
import { SchemaFormContext } from "./schema-form-context"
import type { SchemaFormContextValue } from "./schema-form-context"
import { getDeep, setDeep } from "./deep-path"
import { SchemaFormField } from "./SchemaFormField"
import type { SettingsSection } from "./nav-sections"

interface RuleSettingsFormProps {
  section: SettingsSection
  model: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  /** Pristine builtin rule the reset controls compare against. */
  baseline: Record<string, unknown> | null
}

/**
 * Renders one section of the rule editor.
 *
 * The whole schema is descriptor-driven, so a section is just the subset of
 * descriptors the nav selected; value access goes through a dot-path context so
 * nested fields stay decoupled from the model shape.
 */
export function RuleSettingsForm({
  section,
  model,
  onChange,
  baseline,
}: RuleSettingsFormProps) {
  const ctx: SchemaFormContextValue = useMemo(
    () => ({
      getValue: (path) => getDeep(model, path),
      setValue: (path, value) => onChange(setDeep(model, path, value)),
      getBaseline: (path) => (baseline ? getDeep(baseline, path) : undefined),
    }),
    [model, onChange, baseline]
  )

  return (
    <SchemaFormContext.Provider value={ctx}>
      <div className="grid gap-3">
        {section.fields.map((descriptor) => (
          <section
            key={descriptor.path}
            className="grid gap-2"
          >
            <SchemaFormField descriptor={descriptor} />
          </section>
        ))}
      </div>
    </SchemaFormContext.Provider>
  )
}

export default RuleSettingsForm
