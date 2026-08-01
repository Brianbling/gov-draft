import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  File01Icon,
  Settings01Icon,
  AiMagicIcon,
  UndoIcon,
  RedoIcon,
} from "@hugeicons/core-free-icons"
import { SettingsOverlay } from "@/components/settings/SettingsOverlay"
import { AiGenerateDialog } from "@/components/ai-generate/AiGenerateDialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useFileSystem } from "@/hooks/use-file-system"
import { usePdfExport } from "@/hooks/use-pdf-export"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CodeMirrorHandle } from "./CodeMirrorReact"
import { FormatButtons } from "./toolbar/FormatButtons"
import { LineWrapToggle } from "./toolbar/LineWrapToggle"

interface ToolbarProps {
  editorRef: React.RefObject<CodeMirrorHandle | null>
}

export function Toolbar({ editorRef }: ToolbarProps) {
  const { t } = useTranslation()
  const { importFile, exportMarkdown, exportHtml } = useFileSystem()
  const { exportPdf, isSupported: pdfSupported } = usePdfExport()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false)

  const handleImport = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".md,.markdown"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        await importFile(file)
      } catch (err) {
        console.error("Import failed:", err)
      }
    }
    input.click()
  }

  return (
    <div
      className="toolbar flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-1.5"
      role="toolbar"
      aria-label={t("toolbar.aria")}
    >
      {/* Undo / Redo */}
      <Button
        variant="ghost"
        size="sm"
        title={t("toolbar.undoTitle")}
        aria-label={t("toolbar.undoTitle")}
        onClick={() => editorRef.current?.undo()}
      >
        <HugeiconsIcon icon={UndoIcon} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title={t("toolbar.redoTitle")}
        aria-label={t("toolbar.redoTitle")}
        onClick={() => editorRef.current?.redo()}
      >
        <HugeiconsIcon icon={RedoIcon} />
      </Button>

      <span className="mx-1 h-4 w-px bg-border" />

      {/* Format buttons */}
      <FormatButtons editorRef={editorRef} />

      {/* AI document generation */}
      <Button
        variant="ghost"
        size="sm"
        title={t("toolbar.aiGenerate")}
        aria-label={t("toolbar.aiGenerate")}
        onClick={() => setAiGenerateOpen(true)}
      >
        <HugeiconsIcon icon={AiMagicIcon} />
      </Button>

      <span className="mx-1 h-4 w-px bg-border" />

      {/* File operations */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            title={t("toolbar.file")}
            aria-label={t("toolbar.file")}
          >
            <HugeiconsIcon icon={File01Icon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={handleImport}>
            {t("toolbar.import")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => exportMarkdown()}>
            {t("toolbar.exportMarkdown")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportHtml()}>
            {t("toolbar.exportHtml")}
          </DropdownMenuItem>
          {pdfSupported ? (
            <DropdownMenuItem onSelect={() => exportPdf()}>
              {t("toolbar.exportPdf")}
            </DropdownMenuItem>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <DropdownMenuItem disabled>
                    {t("toolbar.exportPdf")}
                  </DropdownMenuItem>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("toolbar.pdfExportDisabled")}</TooltipContent>
            </Tooltip>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="mx-1 h-4 w-px bg-border" />

      {/* Line-wrap toggle */}
      <LineWrapToggle />

      <span className="mx-1 h-4 w-px bg-border" />

      {/* Settings */}
      <Button
        variant="ghost"
        size="sm"
        title={t("toolbar.settings")}
        aria-label={t("toolbar.settings")}
        onClick={() => setSettingsOpen(true)}
      >
        <HugeiconsIcon icon={Settings01Icon} />
      </Button>

      <SettingsOverlay open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AiGenerateDialog
        open={aiGenerateOpen}
        onOpenChange={setAiGenerateOpen}
      />
    </div>
  )
}

export default Toolbar
