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
  errorCodeToI18nKey,
} from "@/hooks/use-generate-document"
import { DOC_TYPES, type DocType } from "@/lib/legal-doc"

const DOC_TYPE_ITEMS: DocType[] = [...DOC_TYPES]

interface AiGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 优先用 FormatIssue.severity（legal-doc 新加的字段，缺省视为 warning）；
 * 对还没有标注 severity 的 issue 按 code 前缀兜底分类。
 * 纯展示，不改数据。
 */
type IssueSeverity = "error" | "warning" | "info"

function severityOfIssue(issue: {
  code: string
  severity?: "info" | "warning" | "error"
}): IssueSeverity {
  if (issue.severity) return issue.severity
  const code = issue.code
  if (code.endsWith("_EMPTY")) return "error"
  if (
    code.endsWith("_MISSING") ||
    code.includes("_INVALID") ||
    code.endsWith("_TOO_LONG") ||
    code.endsWith("_MISUSED") ||
    code.endsWith("_SHOULD_BE_EMPTY") ||
    code.endsWith("_NO_H1_HEADING") ||
    code.endsWith("_NO_MEASURES") ||
    code.endsWith("_TONE")
  ) {
    return "warning"
  }
  return "info"
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

function AiGeneratePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const {
    prompt,
    setPrompt,
    docType,
    setDocType,
    seal,
    setSeal,
    status,
    errorCode,
    issues,
    generate,
    reset,
  } = useGenerateDocument()

  const handleGenerate = async () => {
    await generate()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const isGenerating = status === "generating"
  const isDone = status === "done"
  const isError = status === "error"

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
            onValueChange={(v) => setDocType(v as DocType)}
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

        <div className="flex items-center gap-2">
          <Checkbox
            id="ai-generate-seal"
            checked={seal}
            onCheckedChange={(checked) => setSeal(checked === true)}
            disabled={isGenerating}
          />
          <Label
            htmlFor="ai-generate-seal"
            className="text-sm leading-none"
          >
            {t("aiGenerate.sealLabel")}
          </Label>
        </div>

        {isError && (
          <div className="grid gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>{t(errorCodeToI18nKey(errorCode ?? "UNKNOWN"))}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
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
              disabled={isGenerating || prompt.trim().length === 0}
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
