import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { useSchemaForm } from "./schema-form-context"

interface FieldShellProps {
  path: string
  label: string
  children: React.ReactNode
}

/** Deep value equality, enough for the JSON-shaped rule model. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  if (typeof a !== "object" || typeof b !== "object") return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Label + control + a reset affordance.
 *
 * The reset button only appears when the field differs from the builtin
 * baseline, so it doubles as a "you changed this" marker — useful when scanning
 * a section to see what has been touched.
 */
export function FieldShell({ path, label, children }: FieldShellProps) {
  const { t } = useTranslation()
  const { getValue, setValue, getBaseline } = useSchemaForm()

  const baseline = getBaseline(path)
  const changed = baseline !== undefined && !sameValue(getValue(path), baseline)

  return (
    <div className="grid gap-1">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {changed && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-5 text-muted-foreground"
            title={t("settings.resetField")}
            aria-label={t("settings.resetField")}
            onClick={() => setValue(path, baseline)}
          >
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />
          </Button>
        )}
      </div>
      {children}
    </div>
  )
}

export default FieldShell
