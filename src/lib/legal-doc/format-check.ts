import type { LegalDoc } from "./types"

const MAX_TITLE_LENGTH = 30
const DOC_NUMBER_YEAR_PATTERN = /〔\d{4}〕/
const SECURITY_LEVELS = ["秘密", "机密", "绝密"] as const
const URGENCIES = ["特急", "加急"] as const
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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

  if (textLength(doc.title) > MAX_TITLE_LENGTH) {
    issues.push({
      field: "title",
      code: "TITLE_TOO_LONG",
      message: `标题超过 ${MAX_TITLE_LENGTH} 字（当前 ${textLength(doc.title)} 字），公文标题宜简短醒目。`,
    })
  }

  if (doc.docNumber && !DOC_NUMBER_YEAR_PATTERN.test(doc.docNumber)) {
    issues.push({
      field: "docNumber",
      code: "DOC_NUMBER_YEAR_MISSING",
      message: "发文字号应包含中文方括号年份，如“国发〔2026〕12号”。",
    })
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

  if (doc.date && !ISO_DATE_PATTERN.test(doc.date)) {
    issues.push({
      field: "date",
      code: "DATE_FORMAT_INVALID",
      message: `成文日期应为 ISO 格式（如 2026-07-31），当前为“${doc.date}”。`,
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
      })
    }
  })

  return issues
}
