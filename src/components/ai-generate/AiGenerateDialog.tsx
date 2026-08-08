import type { ReactNode } from "react"
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
import { Textarea } from "@/components/ui/textarea"
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
  errorCodeToI18nKey,
  errorCodeToI18nActionKey,
  shouldShowSettingsCta,
  httpStatusFromCode,
} from "@/hooks/use-generate-document"
import { DOC_TYPES, type DocType } from "@/lib/legal-doc"
import { DOC_TYPE_SPECS, type FormField } from "@/lib/legal-doc/doc-type-spec"
import { severityOfIssue, type IssueSeverity } from "./issue-severity"
import { hasFormValues, type FormValues } from "@/lib/legal-doc/form-adaptor"

interface AiGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** P0-3 未配置 API Key 时一键跳设置（由 Toolbar 传入）。 */
  onOpenSettings?: () => void
}

const DOC_TYPE_ITEMS: DocType[] = [...DOC_TYPES]

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

/** 文种 → 描述区引导文案 key。placeholder 提示"写什么"，hint 提示"怎么组织"。 */
function promptGuideKey(docType: DocType, part: "placeholder" | "hint") {
  return `aiGenerate.prompt.${docType}.${part}`
}

/** 分区小标题：描述区/表单区共用同风格，形成一致的卡片式分区视觉。 */
function SectionLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-xs font-medium text-muted-foreground"
    >
      {children}
    </Label>
  )
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
  next: string
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

/**
 * 单个要素控件（text/array 用 Input、boolean 用 Checkbox）。
 * 生成前约束表单与生成后编辑面板共用同一渲染，唯一差异是 onChange：
 * 生成前走 setFormValues（写 prompt 约束），生成后走 applyEdit（实时回填 markdown）。
 * 这样保证两处对字段的展示语义一致，不产生第二份字段定义。
 */
function FieldControl({
  field,
  values,
  disabled,
  onChange,
}: {
  field: FormField
  values: FormValues
  disabled?: boolean
  onChange: (next: FormValues) => void
}) {
  if (field.type === "boolean") {
    const checked = values[field.key] === true
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={`ai-generate-${field.key}`}
          checked={checked}
          onCheckedChange={(c) =>
            onChange({ ...values, [field.key]: c === true })
          }
          disabled={disabled}
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
    <div className="grid gap-1.5">
      <Label htmlFor={`ai-generate-${field.key}`} className="text-sm">
        {field.label}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={`ai-generate-${field.key}`}
        value={formValueString(values, field)}
        onChange={(e) =>
          onChange(setFormValueString(values, field, e.target.value))
        }
        placeholder={field.placeholder}
        disabled={disabled}
      />
    </div>
  )
}

function AiGeneratePanel({
  onClose,
  onOpenSettings,
}: {
  onClose: () => void
  onOpenSettings?: () => void
}) {
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
    formErrors,
    issues,
    result,
    generate,
    applyEdit,
    reset,
  } = useGenerateDocument()

  const fields = DOC_TYPE_SPECS[docType].formFields
  // 生成后的编辑面板按"实际生成的文种"取字段：用户此时若切换了文种下拉，
  // 编辑对象仍是已生成的 LegalDoc（result.docType），字段集跟着 result 走，
  // 避免按下拉文种渲染导致与编辑对象错位。
  const editingFields = result
    ? DOC_TYPE_SPECS[result.docType].formFields
    : fields

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

  // 要素编辑面板输入变化 → 实时回填编辑器（#29）。
  // 1) setFormValues 先更新受控输入（否则每次击键后输入框回退到旧值）；
  // 2) applyEdit 把新值应用到最近一次生成的 LegalDoc 并重渲 markdown。
  // formValues 初值由 hook 在 generate 成功后拍平 result 提供。
  const handleEditFieldChange = (next: FormValues) => {
    setFormValues(next)
    if (!result) return
    applyEdit(next)
  }

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
            disabled={isGenerating || isDone}
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

        <div className="grid gap-2">
          <SectionLabel htmlFor="ai-generate-prompt">
            {t("aiGenerate.promptLabel")}
          </SectionLabel>
          <div className="grid gap-2 rounded-2xl border border-border bg-muted/20 p-3">
            <Textarea
              id="ai-generate-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t(promptGuideKey(docType, "placeholder"))}
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              {t(promptGuideKey(docType, "hint"))}
            </p>
          </div>
        </div>

        {/* 生成前：表单辅助约束；生成后：要素编辑面板（同一组 FieldControl，仅 onChange 语义不同） */}
        <div className="grid gap-2">
          <SectionLabel>
            {t(
              isDone
                ? "aiGenerate.editFieldsLabel"
                : "aiGenerate.formFieldsLabel"
            )}
          </SectionLabel>
          <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3">
            {(isDone ? editingFields : fields).map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                values={formValues}
                disabled={isGenerating}
                onChange={isDone ? handleEditFieldChange : setFormValues}
              />
            ))}
          </div>
        </div>

        {isError && errorCode && (
          <div className="grid gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>
                {errorCodeToI18nKey(errorCode) ===
                "aiGenerate.errors.llmHttpError"
                  ? t(errorCodeToI18nKey(errorCode), {
                      status: httpStatusFromCode(errorCode) ?? "?",
                    })
                  : t(errorCodeToI18nKey(errorCode))}
              </span>
            </p>
            {errorCodeToI18nActionKey(errorCode) && (
              <p className="flex items-start gap-1.5 pl-5 text-xs text-muted-foreground">
                <span>{t(errorCodeToI18nActionKey(errorCode)!)}</span>
              </p>
            )}
            {formErrors.length > 0 && (
              <ul className="grid gap-0.5 pl-5 text-xs text-destructive">
                {formErrors.map((label) => (
                  <li key={label}>· {label}</li>
                ))}
              </ul>
            )}
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
              {shouldShowSettingsCta(errorCode) && onOpenSettings && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onOpenSettings}
                >
                  {t("aiGenerate.goToSettings")}
                </Button>
              )}
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
          <>
            <Button type="button" size="sm" onClick={handleClose}>
              {t("aiGenerate.close")}
            </Button>
            {/* 3.7: 重开弹窗续编时 isDone 状态下也要能发起全新生成，
                否则用户被卡在编辑面板，想重生成只能关窗再开 */}
            <Button
              type="button"
              size="sm"
              disabled={!hasContent}
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
                : t("aiGenerate.regenerate")}
            </Button>
          </>
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
  onOpenSettings,
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
          <AiGeneratePanel
            onClose={() => onOpenChange(false)}
            onOpenSettings={onOpenSettings}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default AiGenerateDialog
