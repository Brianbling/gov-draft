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

export function FormatButtons({
  editorRef,
  activeHeadingLevel,
}: FormatButtonsProps) {
  const { t } = useTranslation()

  return (
    <>
      {actions.map(({ action, icon, titleKey, labelKey, headingLevel }) => {
        const active =
          headingLevel !== null && activeHeadingLevel === headingLevel
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

export default FormatButtons
