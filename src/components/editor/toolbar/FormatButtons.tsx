import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  TextBoldIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  ListIndentIncreaseIcon,
  ListIndentDecreaseIcon,
} from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-is-mobile"
import type { CodeMirrorHandle } from "../CodeMirrorReact"
import type { FormatAction } from "../core/features/format-commands"

interface FormatButtonsProps {
  editorRef: React.RefObject<CodeMirrorHandle | null>
  /** 光标所在行标题层级（`#` 数量，非标题行为 0）。 */
  activeHeadingLevel: number
}

const actions: {
  action: FormatAction
  icon: typeof TextBoldIcon
  titleKey: string
  labelKey: string
  /** 该按钮对应的 markdown 标题层级；非标题按钮为 null，永不显示激活态。 */
  headingLevel: number | null
}[] = [
  {
    action: "bold",
    icon: TextBoldIcon,
    titleKey: "toolbar.formatBoldTitle",
    labelKey: "toolbar.formatBold",
    headingLevel: null,
  },
  {
    action: "h1",
    icon: Heading01Icon,
    titleKey: "toolbar.formatH1Title",
    labelKey: "toolbar.formatH1",
    headingLevel: 2,
  },
  {
    action: "h2",
    icon: Heading02Icon,
    titleKey: "toolbar.formatH2Title",
    labelKey: "toolbar.formatH2",
    headingLevel: 3,
  },
  {
    action: "h3",
    icon: Heading03Icon,
    titleKey: "toolbar.formatH3Title",
    labelKey: "toolbar.formatH3",
    headingLevel: 4,
  },
  {
    action: "ul",
    icon: LeftToRightListBulletIcon,
    titleKey: "toolbar.formatUlTitle",
    labelKey: "toolbar.formatUl",
    headingLevel: null,
  },
  {
    action: "ol",
    icon: LeftToRightListNumberIcon,
    titleKey: "toolbar.formatOlTitle",
    labelKey: "toolbar.formatOl",
    headingLevel: null,
  },
  {
    action: "alignLeft",
    icon: TextAlignLeftIcon,
    titleKey: "toolbar.alignLeftTitle",
    labelKey: "toolbar.alignLeft",
    headingLevel: null,
  },
  {
    action: "alignCenter",
    icon: TextAlignCenterIcon,
    titleKey: "toolbar.alignCenterTitle",
    labelKey: "toolbar.alignCenter",
    headingLevel: null,
  },
  {
    action: "alignRight",
    icon: TextAlignRightIcon,
    titleKey: "toolbar.alignRightTitle",
    labelKey: "toolbar.alignRight",
    headingLevel: null,
  },
  {
    action: "indentIncrease",
    icon: ListIndentIncreaseIcon,
    titleKey: "toolbar.indentIncreaseTitle",
    labelKey: "toolbar.indentIncrease",
    headingLevel: null,
  },
  {
    action: "indentDecrease",
    icon: ListIndentDecreaseIcon,
    titleKey: "toolbar.indentDecreaseTitle",
    labelKey: "toolbar.indentDecrease",
    headingLevel: null,
  },
]

function isHeadingActive(
  headingLevel: number | null,
  activeHeadingLevel: number,
): boolean {
  return headingLevel !== null && activeHeadingLevel === headingLevel
}

/** 桌面端：11 个格式按钮平铺。 */
export function FormatButtons({
  editorRef,
  activeHeadingLevel,
}: FormatButtonsProps) {
  const { t } = useTranslation()

  return (
    <>
      {actions.map(({ action, icon, titleKey, labelKey, headingLevel }) => {
        const active = isHeadingActive(headingLevel, activeHeadingLevel)
        return (
          <Button
            key={action}
            variant={active ? "secondary" : "ghost"}
            size="sm"
            title={t(titleKey)}
            aria-label={t(labelKey)}
            aria-pressed={active}
            onClick={() => editorRef.current?.format(action)}
          >
            <HugeiconsIcon icon={icon} />
          </Button>
        )
      })}
    </>
  )
}

/** 移动端：11 个格式工具收进单个"格式"下拉，保留激活态指示。 */
export function FormatDropdown({
  editorRef,
  activeHeadingLevel,
}: FormatButtonsProps) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title={t("toolbar.formatGroupLabel")}
          aria-label={t("toolbar.formatGroupAria")}
        >
          <HugeiconsIcon icon={TextBoldIcon} />
          <span className="ml-1 text-xs">{t("toolbar.formatGroupLabel")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
        {actions.map(({ action, icon, labelKey, headingLevel }) => {
          const active = isHeadingActive(headingLevel, activeHeadingLevel)
          return (
            <DropdownMenuItem
              key={action}
              aria-label={t(labelKey)}
              aria-pressed={active}
              onSelect={() => editorRef.current?.format(action)}
            >
              <HugeiconsIcon icon={icon} />
              <span className="ml-2">{t(labelKey)}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 响应式格式工具：桌面端平铺，移动端折叠为下拉。 */
export function ResponsiveFormatButtons(props: FormatButtonsProps) {
  const isMobile = useIsMobile()
  return isMobile ? (
    <FormatDropdown {...props} />
  ) : (
    <FormatButtons {...props} />
  )
}

export default FormatButtons
