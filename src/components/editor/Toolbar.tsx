import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  File01Icon,
  Settings01Icon,
  AiMagicIcon,
  UndoIcon,
  RedoIcon,
  Upload01Icon,
  Add01Icon,
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
import { ResponsiveFormatButtons } from "./toolbar/FormatButtons"
import { LineWrapToggle } from "./toolbar/LineWrapToggle"
import { LayoutCodeToggle } from "./toolbar/LayoutCodeToggle"

const OPEN_AI_EVENT = "ezdoc:open-ai-generate"
const OPEN_IMPORT_EVENT = "ezdoc:open-import"

interface ToolbarProps {
  editorRef: React.RefObject<CodeMirrorHandle | null>
  /** 光标所在行标题层级，转发给 FormatButtons 显示激活态。 */
  activeHeadingLevel?: number
}

export function Toolbar({ editorRef, activeHeadingLevel }: ToolbarProps) {
  const { t } = useTranslation()
  const { importFile, exportMarkdown, exportHtml } = useFileSystem()
  const { exportPdf, isSupported: pdfSupported } = usePdfExport()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false)

  const openAiGenerate = () =>
    window.dispatchEvent(new CustomEvent(OPEN_AI_EVENT))
  const openSettings = () => setSettingsOpen(true)

  // 首启引导层 / 覆盖确认弹窗通过全局事件触发 AI 生成对话框与导入。
  useEffect(() => {
    const handleOpenAi = () => setAiGenerateOpen(true)
    const handleOpenImport = () => handleImport()
    window.addEventListener(OPEN_AI_EVENT, handleOpenAi)
    window.addEventListener(OPEN_IMPORT_EVENT, handleOpenImport)
    return () => {
      window.removeEventListener(OPEN_AI_EVENT, handleOpenAi)
      window.removeEventListener(OPEN_IMPORT_EVENT, handleOpenImport)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleImport = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".md,.markdown,.docx"
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

  const handleOpenExample = () => {
    void importFile(exampleFile())
  }

  return (
    <div
      className="toolbar flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-1.5"
      role="toolbar"
      aria-label={t("toolbar.aria")}
    >
      {/* 主操作：AI 生成公文（实色文字按钮 + 快捷键，置于最左） */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="px-3.5"
            title={t("toolbar.aiGenerateShortcut")}
            aria-label={t("toolbar.aiGenerateAria")}
            onClick={openAiGenerate}
          >
            <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} />
            {t("toolbar.aiGenerate")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("toolbar.aiGenerateShortcut")}</TooltipContent>
      </Tooltip>

      <span className="mx-1 h-4 w-px bg-border" />

      {/* 新建文档 */}
      <Button
        variant="ghost"
        size="sm"
        title={t("toolbar.newDocumentTitle")}
        aria-label={t("toolbar.newDocumentTitle")}
        onClick={() =>
          window.dispatchEvent(new CustomEvent("ezdoc:new-document"))
        }
      >
        <HugeiconsIcon icon={Add01Icon} />
      </Button>

      <span className="mx-1 h-4 w-px bg-border" />

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

      {/* Format buttons：桌面端平铺，移动端折叠为"格式"下拉，避免挤压编辑区 */}
      <ResponsiveFormatButtons
        editorRef={editorRef}
        activeHeadingLevel={activeHeadingLevel ?? 0}
      />
      <LayoutCodeToggle />

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
            <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
            {t("toolbar.import")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleOpenExample}>
            {t("toolbar.openExample")}
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
        title={t("toolbar.settingsTitle")}
        aria-label={t("toolbar.settingsTitle")}
        onClick={openSettings}
      >
        <HugeiconsIcon icon={Settings01Icon} />
      </Button>

      <SettingsOverlay open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AiGenerateDialog
        open={aiGenerateOpen}
        onOpenChange={setAiGenerateOpen}
        onOpenSettings={openSettings}
      />
    </div>
  )
}

function exampleFile(): File {
  const sample = `# 关于举办宣讲抗战精神学习培训班的通知

为深入学习贯彻习近平新时代中国特色社会主义思想，弘扬伟大抗战精神，经省委办公厅研究，决定举办宣讲抗战精神学习培训班。现将有关事项通知如下：

## 培训时间与地点
培训时间：2025年10月9日至11日。
培训地点：省委会议中心。

## 培训内容
### 省委常委、秘书长XXX同志出席开班式并讲话；
### 组织参训人员交流学习体会；

## 相关事项
各单位应将参培人员信息于9月29日前报省委办公厅。
联系人：XXX
联系电话：18888888888

::: body.paragraph.align:right
山北省委政府办公厅
2025年9月26日
:::`
  return new File([sample], "示例公文.md", {
    type: "text/markdown;charset=utf-8",
  })
}

export default Toolbar
