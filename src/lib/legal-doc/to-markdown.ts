import type { LegalDoc } from "./types"
import { isValidIsoDate } from "./format-check"

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

/** 落款/日期文本里被 LLM 误写的盖章占位（应走 seal 由系统排版，不打印任何盖章字样）。 */
const SEAL_PLACEHOLDER_PATTERN =
  /[（(]?(?:此处加盖公章|此处盖章|盖章处|加盖公章处|加盖公章)[）)]?/g

function stripSealPlaceholder(text: string): string {
  return text.replace(SEAL_PLACEHOLDER_PATTERN, "").trim()
}

/**
 * 成文日期/印发日期在落款版记中按 GB/T 9704-2012 §6.5 编排：
 * “用阿拉伯数字将年、月、日标全，月、日不编虚位”，即 2026-08-01 → 2026年8月1日。
 * 判定逻辑与 checkFormat 共用（真实存在的 ISO 日期）；非 ISO 或月/日越界
 * （含超出当月实有天数）的输入原样返回，避免把 LLM 已写好的中文日期改坏、
 * 也不产生“2026年4月31日”这类错误日期。
 */
export function formatChineseDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso
  const [, year, month, day] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)!
  return `${year}年${Number(month)}月${Number(day)}日`
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

  // 标题空缺（LLM 未给出、且用户关闭表单必填门槛时）不输出幽灵红头 `# `，
  // 而是输出一个可见占位标题，让生成的文档始终有可辨识的标题行；空缺本身
  // 由 checkFormat 的 TITLE_EMPTY（error 级）在结果面板显著提示。
  if (doc.title.trim().length > 0) {
    blocks.push([`# ${doc.title}`])
  } else {
    blocks.push([`# 未命名公文`])
  }

  if (doc.docNumber) {
    blocks.push(container(CENTERED, [doc.docNumber]))
  }

  if (doc.recipient) {
    blocks.push(container(FLUSH_LEFT, [doc.recipient]))
  }

  blocks.push(...renderBody(doc))

  if (doc.attachments && doc.attachments.length > 0) {
    // GB/T 9704-2012 §7.3.4：附件说明排在正文下空一行、左空二字。单个附件不编号
    // （“附件：×××”），多个附件用阿拉伯数字标注顺序号，续行序号与首行序号对齐
    // （“附件：”3 字，续行以 3 个全角空格占位，U+3000 非可折叠空白、浏览器保留）。
    const lines =
      doc.attachments.length === 1
        ? [`附件：${doc.attachments[0]}`]
        : doc.attachments.map(
            (attachment, index) =>
              `${index === 0 ? "附件：" : "　　　"}${index + 1}．${attachment}`,
          )
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
    if (doc.seal === true) {
      // 需盖章：署名与成文日期分别右对齐，署名上方 spacing.before 在正文末与落款之间
      // 留出印章空间（15mm）。印章由用户打印后手工加盖（骑年盖月），仅预留位置，
      // 绝不打印“此处盖章”字样。spacing.before 只加在署名容器，避免撑开署名与日期间距。
      if (doc.issuer) {
        blocks.push(
          container(
            `${RIGHT_ALIGNED}; content.body.paragraph.spacing.before: 15mm`,
            [signatureLines[0]],
          ),
        )
      }
      if (doc.date) {
        blocks.push(container(RIGHT_ALIGNED, [signatureLines[signatureLines.length - 1]]))
      }
    } else {
      // 不加盖公章：署名与成文日期按 GB/T 9704-2012 §7.3.5.2 靠右编排——两者右对齐、
      // 右空四字（尾部 4 个全角空格，U+3000 非可折叠空白、浏览器渲染保留），不居中。
      if (doc.issuer) {
        blocks.push(
          container(RIGHT_ALIGNED, [`${signatureLines[0]}　　　　`]),
        )
      }
      if (doc.date) {
        blocks.push(
          container(RIGHT_ALIGNED, [`${signatureLines[signatureLines.length - 1]}　　　　`]),
        )
      }
    }
  }

  // 不再输出“（此处加盖公章）”占位文字——所有情况都禁止该字样出现。

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
