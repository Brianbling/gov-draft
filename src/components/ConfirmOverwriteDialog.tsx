import { useTranslation } from "react-i18next"
import { AlertDialog } from "radix-ui"
import { Button } from "@/components/ui/button"

interface ConfirmOverwriteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 覆盖当前内容（继续生成）。 */
  onConfirm: () => void
  /** 保留并新建（走新建文档路径）。 */
  onNewDocument: () => void
}

/**
 * P0-5 防覆盖确认：已有内容且被手动改过时，二次生成前弹确认，
 * 避免误点一次即清空手动微调成果。
 */
export function ConfirmOverwriteDialog({
  open,
  onOpenChange,
  onConfirm,
  onNewDocument,
}: ConfirmOverwriteDialogProps) {
  const { t } = useTranslation()

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-overlay/80 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-background p-5 text-foreground shadow-2xl duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <AlertDialog.Title className="text-sm font-semibold">
            {t("aiGenerate.confirmOverwriteTitle")}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-xs text-muted-foreground">
            {t("aiGenerate.confirmOverwriteMessage")}
          </AlertDialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" size="sm">
                {t("aiGenerate.close")}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild onClick={onNewDocument}>
              <Button type="button" variant="outline" size="sm">
                {t("aiGenerate.confirmOverwriteNew")}
              </Button>
            </AlertDialog.Action>
            <AlertDialog.Action asChild onClick={onConfirm}>
              <Button type="button" size="sm">
                {t("aiGenerate.confirmOverwriteOverwrite")}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export default ConfirmOverwriteDialog
