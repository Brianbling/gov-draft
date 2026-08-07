import { useTranslation } from "react-i18next"
import { AlertDialog } from "radix-ui"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiMagicIcon,
  Upload01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"

const WELCOME_SEEN_KEY = "ezdoc-welcome-seen"

export function hasSeenWelcome(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_SEEN_KEY) === "1"
  } catch {
    return false
  }
}

export function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1")
  } catch {
    // ignore storage failures
  }
}

interface WelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 主入口：打开 AI 生成对话框。 */
  onGenerate: () => void
  /** 次入口：触发导入现有公文。 */
  onImport: () => void
}

/**
 * P0-1 首启引导层：首次启动弹一层欢迎/引导，讲清
 * 「输入需求 → AI 生成 → 实时预览 → 导出」四步，并放两个主入口按钮。
 * localStorage 记录 seen，之后不再弹出。
 */
export function WelcomeDialog({
  open,
  onOpenChange,
  onGenerate,
  onImport,
}: WelcomeDialogProps) {
  const { t } = useTranslation()

  const closeForever = () => {
    markWelcomeSeen()
    onOpenChange(false)
  }

  const handleGenerate = () => {
    markWelcomeSeen()
    onOpenChange(false)
    onGenerate()
  }

  const handleImport = () => {
    markWelcomeSeen()
    onOpenChange(false)
    onImport()
  }

  const steps = [
    { title: t("app.welcome.steps.one"), desc: t("app.welcome.steps.oneDesc") },
    { title: t("app.welcome.steps.two"), desc: t("app.welcome.steps.twoDesc") },
    {
      title: t("app.welcome.steps.three"),
      desc: t("app.welcome.steps.threeDesc"),
    },
    {
      title: t("app.welcome.steps.four"),
      desc: t("app.welcome.steps.fourDesc"),
    },
  ]

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-overlay/80 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-background p-6 text-foreground shadow-2xl duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex items-start justify-between gap-4">
            <div>
              <AlertDialog.Title className="text-base font-semibold">
                {t("app.welcome.title")}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-1 text-xs text-muted-foreground">
                {t("app.welcome.subtitle")}
              </AlertDialog.Description>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("app.welcome.skip")}
              onClick={closeForever}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </div>

          <ol className="mt-4 grid grid-cols-2 gap-2.5">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="grid gap-0.5 rounded-2xl border border-border bg-muted/20 p-3"
              >
                <span className="text-xs font-semibold text-primary">
                  {index + 1}. {step.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {step.desc}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-col gap-2">
            <Button type="button" size="lg" onClick={handleGenerate}>
              <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} />
              {t("app.welcome.generateCta")}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleImport}
              >
                <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                {t("app.welcome.importCta")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={closeForever}
              >
                {t("app.welcome.skip")}
              </Button>
            </div>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export default WelcomeDialog
