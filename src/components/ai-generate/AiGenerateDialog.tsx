import { useTranslation } from "react-i18next"
import { Dialog } from "radix-ui"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiMagicIcon,
  Cancel01Icon,
  CheckmarkCircleIcon,
  AlertCircleIcon,
  Alert02Icon,
  InformationCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useGenerateDocument,
} from "@/hooks/use-generate-document"
import {
  DOC_TYPES,
  type DocType,
} from "@/lib/legal-doc"
import {
  DOC_TYPE_SPECS,
  type FormField,
} from "@/lib/legal-doc/doc-type-spec"
import { severityOfIssue, type IssueSeverity } from "./issue-severity"
import {
  hasFormValues,
  type FormValues,
} from "@/lib/legal-doc/form-adaptor"

const DOC_TYPE_ITEMS: DocType[] = [...DOC_TYPES]

/** 必填要素缺失时的表单校验错误（非 LLM 调用错误）。 */
const FORM_REQUIRED_I18N = "aiGenerate.errors.formRequired"

interface AiGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ISSUE_VISUAL: Record<
  IssueSeverity,
  { icon: typeof AlertCircleIcon; className: string }
> = {
  error: {
    icon: AlertCircleIcon,
    className: "text-destructive",
  },
  warning: {
    icon: Alert02Icon,
    className: "text-warning-foreground",
  },
  info: {
    icon: InformationCircleIcon,
    className: "text-muted-foreground",
  },
}

/** 表单错误码 → i18n key（复用错误文案区）。 */
function formErrorKey(code: string): string {
  return code.startsWith("FORM_REQUIRED_") ? FORM_REQUIRED_I18N : code
}

/** 表单值读取：array 字段存顿号分隔字符串，提交时按 顿号/逗号 拆成数组。 */
function formValueString(values: FormValues, field: FormField): string {
  if (field.type === "array") {
    const arr = values[field.key] as string[] | undefined
    return arr ? arr.join("、") : ""
  }
  return (values[field.key] as string | undefined) ?? ""
}

function setFormValueString(
  values: FormValues,
  field: FormField,
  next: string,
): FormValues {
  if (field.type === "array") {
    const parts = next
      .split(/[，,、;；]/)
      .map((p) => p.trim())
      .filter(Boolean)
    return { ...values, [field.key]: parts.length > 0 ? parts : [] }
  }
  return { ...values, [field.key]: next }
}

function AiGeneratePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const {
    prompt,
    setPrompt,
    docType,
    setDocType,
    formValues,
    setFormValues,
    status,
    errorCode,
    issues,
    generate,
    reset,
  } = useGenerateDocument()

  const fields = DOC_TYPE_SPECS[docType].formFields

  const handleGenerate = async () => {
    await generate()
  }

  // 切换文种时重置表单：不同文种的要素集与盖章默认不同，
  // 残留的旧文种值会误触发必填校验（hasFormValues 只看有没有值，不看是否属于当前文种）。
  const handleDocTypeChange = (next: DocType) => {
    setDocType(next)
    setFormValues({})
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const isGenerating = status === "generating"
  const isDone = status === "done"
  const isError = status === "error"
  // 表单已填写（任一要素非空）或自然语言描述非空时，生成按钮才可用；
  // 必填要素缺失时由 hook 校验拦截并给出错误提示。
  const hasContent = prompt.trim().length > 0 || hasFormValues(formValues)

  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Dialog.Title className="text-base font-semibold">
            {t("aiGenerate.title")}
          </Dialog.Title>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("aiGenerate.close")}
          onClick={handleClose}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {isGenerating && (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            <HugeiconsIcon
              icon={AiMagicIcon}
              strokeWidth={2}
              className="size-4 animate-spin text-primary"
            />
            <span className="font-medium text-foreground">
              {t("aiGenerate.generatingBanner")}
            </span>
            <span className="text-xs">{t("aiGenerate.generatingHint")}</span>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>{t("aiGenerate.docTypeLabel")}</Label>
          <Select
            value={docType}
            onValueChange={(v) => handleDocTypeChange(v as DocType)}
            disabled={isGenerating}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder={t("aiGenerate.docTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPE_ITEMS.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`aiGenerate.docType.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ai-generate-prompt">
            {t("aiGenerate.promptLabel")}
          </Label>
          <Input
            id="ai-generate-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("aiGenerate.promptPlaceholder")}
            disabled={isGenerating}
          />
          <p className="text-xs text-muted-foreground">
            {t("aiGenerate.promptHint")}
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label>{t("aiGenerate.formFieldsLabel")}</Label>
          <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3">
            {fields.map((field) => {
              if (field.type === "boolean") {
                const checked =
                  formValues[field.key] === true
                return (
                  <div
                    key={field.key}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`ai-generate-${field.key}`}
                      checked={checked}
                      onCheckedChange={(c) =>
                        setFormValues({
                          ...formValues,
                          [field.key]: c === true,
                        })
                      }
                      disabled={isGenerating}
                    />
                    <Label
                      htmlFor={`ai-generate-${field.key}`}
                      className="text-sm leading-none"
                    >
                      {field.label}
                    </Label>
                  </div>
                )
              }
              return (
                <div key={field.key} className="grid gap-1.5">
                  <Label
                    htmlFor={`ai-generate-${field.key}`}
                    className="text-sm"
                  >
                    {field.label}
                    {field.required && (
                      <span className="ml-0.5 text-destructive">*</span>
                    )}
                  </Label>
                  <Input
                    id={`ai-generate-${field.key}`}
                    value={formValueString(formValues, field)}
                    onChange={(e) =>
                      setFormValues(
                        setFormValueString(formValues, field, e.target.value)
                      )
                    }
                    placeholder={field.placeholder}
                    disabled={isGenerating}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {isError && (
          <div className="grid gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>{t(formErrorKey(errorCode ?? "UNKNOWN"))}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasContent}
                onClick={handleGenerate}
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  strokeWidth={2}
                  className="size-3.5"
                />
                {t("aiGenerate.retry")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("aiGenerate.retryHint")}
              </p>
            </div>
          </div>
        )}

        {isDone && (
          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-xs text-success-foreground">
              <HugeiconsIcon
                icon={CheckmarkCircleIcon}
                className="size-3.5 shrink-0"
              />
              {t("aiGenerate.success")}
            </p>

            <div className="rounded-2xl border border-border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-medium">
                {t("aiGenerate.issuesTitle")}
              </p>
              {issues.length > 0 ? (
                <ul className="grid gap-1.5">
                  {issues.map((issue) => {
                    const severity = severityOfIssue(issue)
                    const visual = ISSUE_VISUAL[severity]
                    return (
                      <li
                        key={`${issue.field}-${issue.code}`}
                        className="flex items-start gap-1.5 text-xs"
                      >
                        <HugeiconsIcon
                          icon={visual.icon}
                          className={cn(
                            "mt-0.5 size-3.5 shrink-0",
                            visual.className
                          )}
                        />
                        <span className={cn("leading-5", visual.className)}>
                          {issue.message}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("aiGenerate.issuesEmpty")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t px-4 py-3">
        {isDone ? (
          <Button type="button" size="sm" onClick={handleClose}>
            {t("aiGenerate.close")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isGenerating}
              onClick={handleClose}
            >
              {t("aiGenerate.close")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isGenerating || !hasContent}
              onClick={handleGenerate}
            >
              {isGenerating ? (
                <HugeiconsIcon
                  icon={AiMagicIcon}
                  strokeWidth={2}
                  className="animate-spin"
                />
              ) : (
                <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} />
              )}
              {isGenerating
                ? t("aiGenerate.generating")
                : t("aiGenerate.generate")}
            </Button>
          </>
        )}
      </footer>
    </>
  )
}

export function AiGenerateDialog({
  open,
  onOpenChange,
}: AiGenerateDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/80 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          aria-label={t("aiGenerate.dialogAria")}
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-background text-foreground shadow-2xl duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <AiGeneratePanel onClose={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default AiGenerateDialog
