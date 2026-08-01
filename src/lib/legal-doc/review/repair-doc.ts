import type { LegalDoc } from "../types"
import type { FormatIssue } from "../format-check"

/**
 * 保守修复带：在 normalizeDoc 之后、reviewDocument 之前调用。
 * 只修“正则 + 文种知识联合判定到 100% 确定”的模式，宁可少修不误改；
 * 每个自动修复同时返回一条 info 级 RepaintInfo（field 取 "auto"，供 issues 展示）。
 * 有争议、需要判断语义的项绝不修（如 recipient 含顿号是否多头主送）。
 */

export interface RepairInfo {
  code: string
  message: string
}

export interface RepairResult {
  doc: LegalDoc
  repairs: RepairInfo[]
}

function makeRepair(code: string, message: string): RepairInfo {
  return { code, message }
}

/** 主送机关末尾应带全角冒号（通告/公告无主送机关，不适用）。 */
function repairRecipientColon(
  doc: LegalDoc,
  repairs: RepairInfo[],
): LegalDoc {
  if (doc.docType === "announcement") return doc
  if (!doc.recipient) return doc
  if (/:|：/.test(doc.recipient.trimEnd())) return doc
  const repaired = {
    ...doc,
    recipient: doc.recipient.trimEnd() + "：",
  }
  repairs.push(
    makeRepair(
      "REPAIR_RECIPIENT_COLON",
      "主送机关末尾缺少全角冒号，已自动补上“：”。",
    ),
  )
  return repaired
}

const ATTACHMENT_PARAGRAPH_PATTERN = /^附件[：:]\s*(.+)$/

/** 正文 type:"p" 且整段形如 `^附件[:：]` 且 attachments 为空 → 提取为附件条目并从正文移除。 */
function extractAttachmentParagraphs(
  doc: LegalDoc,
  repairs: RepairInfo[],
): LegalDoc {
  if ((doc.attachments ?? []).length > 0) return doc
  const added: string[] = []
  const remainingBody = doc.body.filter((paragraph) => {
    if (paragraph.type !== "p") return true
    const match = paragraph.text.trim().match(ATTACHMENT_PARAGRAPH_PATTERN)
    if (!match) return true
    const name = match[1].trim()
    if (name.length === 0) return true
    added.push(name)
    return false
  })
  if (added.length === 0) return doc
  const repaired = {
    ...doc,
    attachments: [...added],
    body: remainingBody,
  }
  repairs.push(
    makeRepair(
      "REPAIR_EXTRACT_ATTACHMENT",
      `正文中“附件：…”段落已提取为附件条目（${added.join("、")}），避免版记与正文重复。`,
    ),
  )
  return repaired
}

/** 正文 p 段首序号残留（如 `一、…`）→ 只剥离序号，不升级为标题（避免改变层级）。 */
function stripParagraphLeadingNumber(
  doc: LegalDoc,
  repairs: RepairInfo[],
): LegalDoc {
  const pattern = /^[一二三四五六七八九十]+、/
  let changed = false
  const body = doc.body.map((paragraph) => {
    if (paragraph.type !== "p") return paragraph
    const stripped = paragraph.text.replace(pattern, "").trim()
    if (stripped === paragraph.text) return paragraph
    changed = true
    return { ...paragraph, text: stripped }
  })
  if (!changed) return doc
  const repaired = { ...doc, body }
  repairs.push(
    makeRepair(
      "REPAIR_STRIP_PARAGRAPH_ORDER",
      "正文段落开头的序号残留（如“一、”）已剥离；若需分层请改用 h1/h2 标题。",
    ),
  )
  return repaired
}

/** 文号年份括号 [2026] / (2026) → 统一为六角括号 〔2026〕。 */
function normalizeDocNumberYearBracket(
  doc: LegalDoc,
  repairs: RepairInfo[],
): LegalDoc {
  if (!doc.docNumber) return doc
  const repairedNumber = doc.docNumber.replace(
    /[[(](\d{4})[\])]/,
    "〔$1〕",
  )
  if (repairedNumber === doc.docNumber) return doc
  const repaired = { ...doc, docNumber: repairedNumber }
  repairs.push(
    makeRepair(
      "REPAIR_DOC_NUMBER_YEAR_BRACKET",
      `发文字号年份括号已统一为中文六角括号：${repairedNumber}。`,
    ),
  )
  return repaired
}

/**
 * 依次执行全部保守修复（顺序敏感：先补 recipient 冒号，再提取附件段，再剥序号，
 * 最后统一文号括号）。返回修复后的 doc 与所有本次执行的修复说明。
 */
export function repairDoc(doc: LegalDoc): RepairResult {
  const repairs: RepairInfo[] = []
  let current = doc
  current = repairRecipientColon(current, repairs)
  current = extractAttachmentParagraphs(current, repairs)
  current = stripParagraphLeadingNumber(current, repairs)
  current = normalizeDocNumberYearBracket(current, repairs)
  return { doc: current, repairs }
}

/** 把修复说明转成与 FormatIssue 兼容的 info 级 issue（repairs 以 REPAIR_ 前缀追加）。 */
export function repairsToIssues(repairs: RepairInfo[]): FormatIssue[] {
  return repairs.map((repair) => ({
    field: "auto",
    code: repair.code,
    message: repair.message,
    severity: "info",
  }))
}
