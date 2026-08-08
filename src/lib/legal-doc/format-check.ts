import type { LegalDoc } from "./types"

const MAX_TITLE_LENGTH = 30
const DOC_NUMBER_YEAR_PATTERN = /〔\d{4}〕/
const SECURITY_LEVELS = ["秘密", "机密", "绝密"] as const
const URGENCIES = ["特急", "加急"] as const

export const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * ISO 日期是否真实存在（月 1-12、日在当月实有天数内）。审查与渲染共用同一判定，
 * 保证 checkFormat 与 formatChineseDate 对同一输入给出一致结论（如 2026-13-40、
 * 2026-04-31 均判为无效）。
 */
export function isValidIsoDate(iso: string): boolean {
  const match = iso.match(ISO_DATE_PATTERN)
  if (!match) return false
  const month = Number(match[2])
  const day = Number(match[3])
  return (
    month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1]
  )
}

export interface FormatIssue {
  field: string
  code: string
  message: string
  /**
   * 严重程度：error 为结构性硬伤（缺标题/空段落），warning 为格式瑕疵（默认），
   * info 为自动修复的提示（repairDoc 产物）。缺省视为 warning。
   */
  severity?: "info" | "warning" | "error"
}

function textLength(value: string): number {
  return Array.from(value.trim()).length
}

/**
 * Pure structural self-check of a generated LegalDoc. No DOM, no parsing — the
 * produced issues are meant to be surfaced to the user before the doc is
 * committed to the editor content.
 */
export function checkFormat(doc: LegalDoc): FormatIssue[] {
  const issues: FormatIssue[] = []

  if (doc.title.trim().length === 0) {
    issues.push({
      field: "title",
      code: "TITLE_EMPTY",
      message: "公文标题不能为空或纯空格。",
      severity: "error",
    })
  }

  // 决议标题须写明通过决议的会议名称（如"××市第×届人民代表大会第×次会议
  // 关于批准××报告的决议"），天然较长，放宽到 50 字；其余文种 30 字。
  const titleLimit = doc.docType === "resolution" ? 50 : MAX_TITLE_LENGTH
  if (textLength(doc.title) > titleLimit) {
    issues.push({
      field: "title",
      code: "TITLE_TOO_LONG",
      message: `标题超过 ${titleLimit} 字（当前 ${textLength(doc.title)} 字），公文标题宜简短醒目。`,
    })
  }

  // 发文字号年份括号：仅适用于使用发文字号式文号的文种。命令（令）的文号是
  // 顺序号"第×号"（如"主席令第×号"），无年份括号，跳过该检查。
  if (
    doc.docType !== "order" &&
    doc.docNumber &&
    !DOC_NUMBER_YEAR_PATTERN.test(doc.docNumber)
  ) {
    issues.push({
      field: "docNumber",
      code: "DOC_NUMBER_YEAR_MISSING",
      message: "发文字号应包含中文方括号年份，如“国发〔2026〕12号”。",
    })
  }

  // 红头（发文机关标志）+ 发文字号成对：仅通知（gongwen）、通报（communique）
  // 使用文件式红头版头。其他文种（意见/请示/批复/函/决议/命令/公报/议案等）
  // 无文件式红头格式，有文号无红头属正常，不强制成对。
  const usesFileRedHead = doc.docType === "gongwen" || doc.docType === "communique"
  if (usesFileRedHead) {
    if (doc.docNumber && !doc.issuingOrg) {
      issues.push({
        field: "issuingOrg",
        code: "DOC_NUMBER_WITHOUT_RED_HEAD",
        message:
          "发文字号“" +
          doc.docNumber +
          "”上方缺少发文机关标志（红头，如“××市人民政府文件”），文号将顶在版心首行。",
        severity: "error",
      })
    }

    if (doc.issuingOrg && !doc.docNumber) {
      issues.push({
        field: "docNumber",
        code: "RED_HEAD_WITHOUT_DOC_NUMBER",
        message:
          "已有红头“" +
          doc.issuingOrg +
          "”但缺少发文字号（如“渝府发〔2026〕12号”），红头下应空二行编排文号。",
        severity: "error",
      })
    }
  }

  if (
    doc.securityLevel &&
    !(SECURITY_LEVELS as readonly string[]).includes(doc.securityLevel)
  ) {
    issues.push({
      field: "securityLevel",
      code: "SECURITY_LEVEL_INVALID",
      message: `密级只能是“${SECURITY_LEVELS.join("、")}”之一，当前为“${doc.securityLevel}”。`,
    })
  }

  if (doc.urgency && !(URGENCIES as readonly string[]).includes(doc.urgency)) {
    issues.push({
      field: "urgency",
      code: "URGENCY_INVALID",
      message: `紧急程度只能是“${URGENCIES.join("、")}”之一，当前为“${doc.urgency}”。`,
    })
  }

  if (doc.date && !isValidIsoDate(doc.date)) {
    issues.push({
      field: "date",
      code: "DATE_FORMAT_INVALID",
      message: `成文日期应为真实存在的 ISO 日期（如 2026-07-31），当前为“${doc.date}”。`,
    })
  }

  doc.body.forEach((paragraph, index) => {
    if (paragraph.text.trim().length === 0) {
      issues.push({
        field: `body[${index}].text`,
        code: "PARAGRAPH_EMPTY",
        message: "正文段落内容为空，请补充完整表述。",
        severity: "error",
      })
    }
  })

  const attachments = doc.attachments ?? []
  attachments.forEach((attachment, index) => {
    if (attachment.trim().length === 0) {
      issues.push({
        field: `attachments[${index}]`,
        code: "ATTACHMENT_EMPTY",
        message: "附件名称不能为空。",
        // 附件名为空是格式瑕疵，非缺标题/空正文那样的结构性硬伤。
        severity: "warning",
      })
    }
  })

  return issues
}
