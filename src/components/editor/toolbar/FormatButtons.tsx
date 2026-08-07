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
}

const actions: {
  action: FormatAction
  icon: typeof TextBoldIcon
  titleKey: string
  labelKey: string
}[] = [
  {
    action: "bold",
    icon: TextBoldIcon,
    titleKey: "toolbar.formatBoldTitle",
    labelKey: "toolbar.formatBold",
  },
  {
    action: "h1",
    icon: Heading01Icon,
    titleKey: "toolbar.formatH1Title",
    labelKey: "toolbar.formatH1",
  },
  {
    action: "h2",
    icon: Heading02Icon,
    titleKey: "toolbar.formatH2Title",
    labelKey: "toolbar.formatH2",
  },
  {
    action: "h3",
    icon: Heading03Icon,
    titleKey: "toolbar.formatH3Title",
    labelKey: "toolbar.formatH3",
  },
  {
    action: "ul",
    icon: LeftToRightListBulletIcon,
    titleKey: "toolbar.formatUlTitle",
    labelKey: "toolbar.formatUl",
  },
  {
    action: "ol",
    icon: LeftToRightListNumberIcon,
    titleKey: "toolbar.formatOlTitle",
    labelKey: "toolbar.formatOl",
  },
  {
    action: "alignLeft",
    icon: TextAlignLeftIcon,
    titleKey: "toolbar.alignLeftTitle",
    labelKey: "toolbar.alignLeft",
  },
  {
    action: "alignCenter",
    icon: TextAlignCenterIcon,
    titleKey: "toolbar.alignCenterTitle",
    labelKey: "toolbar.alignCenter",
  },
  {
    action: "alignRight",
    icon: TextAlignRightIcon,
    titleKey: "toolbar.alignRightTitle",
    labelKey: "toolbar.alignRight",
  },
  {
    action: "indentIncrease",
    icon: ListIndentIncreaseIcon,
    titleKey: "toolbar.indentIncreaseTitle",
    labelKey: "toolbar.indentIncrease",
  },
  {
    action: "indentDecrease",
    icon: ListIndentDecreaseIcon,
    titleKey: "toolbar.indentDecreaseTitle",
    labelKey: "toolbar.indentDecrease",
  },
]

export function FormatButtons({ editorRef }: FormatButtonsProps) {
  const { t } = useTranslation()

  return (
    <>
      {actions.map(({ action, icon, titleKey, labelKey }) => (
        <Button
          key={action}
          variant="ghost"
          size="sm"
          title={t(titleKey)}
          aria-label={t(labelKey)}
          onClick={() => editorRef.current?.format(action)}
        >
          <HugeiconsIcon icon={icon} />
        </Button>
      ))}
    </>
  )
}

export default FormatButtons
