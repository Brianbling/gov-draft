import type { LegalDoc } from "./types"

const SEPARATOR = "\n"

const CENTERED =
  "content.body.paragraph.align: center; content.body.paragraph.indent: 0em"
const RIGHT_ALIGNED =
  "content.body.paragraph.align: right; content.body.paragraph.indent: 0em"
const FLUSH_LEFT = "content.body.paragraph.indent: 0em"
const BODY_INDENT = "content.body.paragraph.indent: 2em"
const LETTERHEAD =
  "content.body.paragraph.align: center; content.body.paragraph.indent: 0em; content.body.fonts.cjkFamily: 黑体, SimHei, STHeiti, sans-serif; content.body.style.weight: 700"

function container(descriptor: string, lines: string[]): string[] {
  return [`::: ${descriptor}`, ...lines, ":::"]
}

/**
 * 剥离标题文本开头的序号前缀。引擎对 h2/h3/h4 会按样式自动加序号
 * （gb-t-9704.yaml：h2 `{zhHansIndex}、`、h3 `（{zhHansIndex}）`、h4 `{arabicIndex}．`）。
 * LLM 若把"一、""（一）""1．"写进了 h1/h2/h3 的 text，会渲染成"一、一、"双号，
 * 这里防御性剥掉段首序号，避免与引擎编号叠加。
 * 注意三个分支都必须带分隔符（、．）或成对括号：纯"一"（如"一体化"）不剥。
 */
const ORDER_PREFIX_PATTERN =
  /^(?:[一二三四五六七八九十百]+、|\d+[．.、]|[（(][一二三四五六七八九十百\d]+[）)])/

function stripLeadingOrder(text: string): string {
  return text.replace(ORDER_PREFIX_PATTERN, "").trim()
}

/** 落款/日期文本里被 LLM 误写的盖章占位（应走 seal:true 由系统生成）。 */
const SEAL_PLACEHOLDER_PATTERN = /[（(]此处加盖公章[）)]/g

function stripSealPlaceholder(text: string): string {
  return text.replace(SEAL_PLACEHOLDER_PATTERN, "").trim()
}

/**
 * 成文日期/印发日期在落款版记中按 GB/T 9704-2012 §6.5 编排：
 * “用阿拉伯数字将年、月、日标全，月、日不编虚位”，即 2026-08-01 → 2026年8月1日。
 * 输入非 ISO 日期（YYYY-MM-DD）时原样返回，避免把 LLM 已写好的中文日期改坏。
 */
export function formatChineseDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return iso
  const [, year, month, day] = match
  const monthNum = Number(month)
  const dayNum = Number(day)
  // 月/日越界或超出当月实有天数属无效日期，原样返回，不产生“2026年4月31日”这类错误日期。
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (
    monthNum < 1 ||
    monthNum > 12 ||
    dayNum < 1 ||
    dayNum > daysInMonth[monthNum - 1]
  )
    return iso
  return `${year}年${monthNum}月${dayNum}日`
}

function renderBody(doc: LegalDoc): string[][] {
  const blocks: string[][] = []
  let pendingParagraphs: string[] = []

  const flushParagraphs = (): void => {
    if (pendingParagraphs.length > 0) {
      blocks.push(container(BODY_INDENT, pendingParagraphs))
      pendingParagraphs = []
    }
  }

  for (const paragraph of doc.body) {
    if (paragraph.type === "p") {
      pendingParagraphs.push(paragraph.text)
    } else if (paragraph.type === "h1") {
      flushParagraphs()
      blocks.push([`## ${stripLeadingOrder(paragraph.text)}`])
    } else {
      flushParagraphs()
      blocks.push([`### ${stripLeadingOrder(paragraph.text)}`])
    }
  }
  flushParagraphs()

  return blocks
}

/**
 * Convert a LegalDoc into the Markdown source the ezdoc pipeline renders
 * through the GB/T 9704 rule. `#` triggers the red-head title (h1),
 * `##`/`###` map to engine h2/h3 (一级/二级标题), and canonical-path `:::`
 * containers carry the body indent and 版记 alignment overrides.
 */
export function toMarkdown(doc: LegalDoc): string {
  const blocks: string[][] = []

  const letterheadLines = [doc.securityLevel, doc.urgency].filter(
    (value): value is string => Boolean(value)
  )
  if (letterheadLines.length > 0) {
    blocks.push(container(LETTERHEAD, letterheadLines))
  }

  blocks.push([`# ${doc.title}`])

  if (doc.docNumber) {
    blocks.push(container(CENTERED, [doc.docNumber]))
  }

  if (doc.recipient) {
    blocks.push(container(FLUSH_LEFT, [doc.recipient]))
  }

  blocks.push(...renderBody(doc))

  if (doc.attachments && doc.attachments.length > 0) {
    const lines =
      doc.attachments.length > 1
        ? doc.attachments.map(
            (attachment, index) => `附件：${index + 1}．${attachment}`
          )
        : [`附件：${doc.attachments[0]}`]
    blocks.push(container(BODY_INDENT, lines))
  }

  // 会议纪要出席/请假/列席名单：按 GB/T 9704-2012 第 10.3 条"纪要格式"，
  // 正文或附件说明下空一行，左空二字编排"出席：…"（回行对齐冒号后首字）。
  // 现有引擎容器只表达 indent（2em = 左空二字）；"出席"二字黑体、姓名仿宋
  // 属版式层字体建模，留待 v2，此处用标准正文缩进容器。
  if (doc.docType === "minutes") {
    if (doc.attendees && doc.attendees.length > 0) {
      blocks.push(container(BODY_INDENT, [`出席：${doc.attendees.join("、")}`]))
    }
    if (doc.absentees && doc.absentees.length > 0) {
      blocks.push(container(BODY_INDENT, [`请假：${doc.absentees.join("、")}`]))
    }
    if (doc.observers && doc.observers.length > 0) {
      blocks.push(container(BODY_INDENT, [`列席：${doc.observers.join("、")}`]))
    }
  }

  const signatureLines: string[] = []
  if (doc.issuer) signatureLines.push(stripSealPlaceholder(doc.issuer))
  if (doc.date) signatureLines.push(stripSealPlaceholder(formatChineseDate(doc.date)))
  if (signatureLines.length > 0) {
    blocks.push(container(RIGHT_ALIGNED, signatureLines))
  }

  // seal=true 且落款处未带盖章标记时，在落款下方补一行盖章占位。
  if (
    doc.seal === true &&
    !signatureLines.some((line) => line.includes("盖章"))
  ) {
    blocks.push(container(RIGHT_ALIGNED, ["（此处加盖公章）"]))
  }

  if (doc.cc && doc.cc.length > 0) {
    blocks.push(container(FLUSH_LEFT, [`抄送：${doc.cc.join("、")}`]))
  }

  const printingLines: string[] = []
  if (doc.printingOffice) printingLines.push(doc.printingOffice)
  if (doc.printingDate) printingLines.push(formatChineseDate(doc.printingDate))
  if (printingLines.length > 0) {
    blocks.push(container(FLUSH_LEFT, printingLines))
  }

  return blocks.map((block) => block.join(SEPARATOR)).join(SEPARATOR)
}
