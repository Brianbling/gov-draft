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

/** 主送机关末尾应带全角冒号（通告/公告无主送机关，不适用）。
 * 只在末尾确为机关名（非标点）且非纯空白时补，避免把“省人民政府。”补成“省人民政府。：”，
 * 也避免纯空白主送被“修复”成“：”掩盖缺失（缺失由 L2 规则上报）。 */
function repairRecipientColon(
  doc: LegalDoc,
  repairs: RepairInfo[],
): LegalDoc {
  if (doc.docType === "announcement") return doc
  if (!doc.recipient) return doc
  const trimmed = doc.recipient.trimEnd()
  if (trimmed.length === 0) return doc
  if (/[:：]/.test(trimmed)) return doc
  if (/[。、；，？！]$/.test(trimmed)) return doc
  const repaired = {
    ...doc,
    recipient: trimmed + "：",
  }
  repairs.push(
    makeRepair(
      "REPAIR_RECIPIENT_COLON",
      "主送机关末尾缺少全角冒号，已自动补上“：”。",
    ),
  )
  return repaired
}

// 附件说明行：识别“附件：×××”以及“附件1：×××”“附件1. ×××”“附件1、×××”
// （GB/T 9704 首行应写“附件：”，LLM 常误带序号，提取时归一为无序号条目）。
const ATTACHMENT_PARAGRAPH_PATTERN = /^附件\s*\d*[：:．.\、]?\s*(.+)$/

/** 从“附件N：”变体里剥掉附件序号前缀，只留名称。 */
function stripAttachmentPrefix(name: string): string {
  return name.replace(/^附件\s*\d+[：:．.\、]?\s*/, "").trim()
}

/**
 * 按编号结构拆分附件内容并去序号前缀。覆盖三种真实写法：
 * - 编号列表（分号/逗号/顿号分隔）："1.任务清单；2.责任分工表" → ["任务清单", "责任分工表"]
 * - 单编号项："1.任务清单" → ["任务清单"]
 * - 无编号："任务清单" 或 "任务清单；责任分工表" → 整段作为一个附件（不拆、不丢内容）
 * 只有全部项都带编号前缀才拆，避免把普通句段误拆成多个附件。
 */
function splitAttachments(content: string): string[] {
  const rawParts = content
    .split(/[；;\n，,、]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  const allNumbered = rawParts.every((part) => /^\d+[．.、]/.test(part))
  if (rawParts.length > 1 && allNumbered)
    return rawParts.map((part) => part.replace(/^\d+[．.、]/, "").trim())
  if (rawParts.length === 1 && /^\d+[．.、]/.test(rawParts[0]))
    return [rawParts[0].replace(/^\d+[．.、]/, "").trim()]
  return [content]
}

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
    // “附件：×××”整段（含“附件1：”变体）都归入附件条目，从正文移除，避免版记与正文重复
    const name = match[1].trim()
    if (name.length === 0) return true
    added.push(...splitAttachments(stripAttachmentPrefix(name)))
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
 * 依次执行全部保守修复（顺序敏感：先补 recipient 冒号，再提取附件段，
 * 最后统一文号括号）。返回修复后的 doc 与所有本次执行的修复说明。
 */
export function repairDoc(doc: LegalDoc): RepairResult {
  const repairs: RepairInfo[] = []
  let current = doc
  current = repairRecipientColon(current, repairs)
  current = extractAttachmentParagraphs(current, repairs)
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
