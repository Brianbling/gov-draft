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
function repairRecipientColon(doc: LegalDoc, repairs: RepairInfo[]): LegalDoc {
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
      "主送机关末尾缺少全角冒号，已自动补上“：”。"
    )
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
  repairs: RepairInfo[]
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
      `正文中“附件：…”段落已提取为附件条目（${added.join("、")}），避免版记与正文重复。`
    )
  )
  return repaired
}

/** 文号年份括号 [2026] / (2026) → 统一为六角括号 〔2026〕。 */
function normalizeDocNumberYearBracket(
  doc: LegalDoc,
  repairs: RepairInfo[]
): LegalDoc {
  if (!doc.docNumber) return doc
  const repairedNumber = doc.docNumber.replace(/[[(](\d{4})[\])]/, "〔$1〕")
  if (repairedNumber === doc.docNumber) return doc
  const repaired = { ...doc, docNumber: repairedNumber }
  repairs.push(
    makeRepair(
      "REPAIR_DOC_NUMBER_YEAR_BRACKET",
      `发文字号年份括号已统一为中文六角括号：${repairedNumber}。`
    )
  )
  return repaired
}

/**
 * 红头缺失兜底：有发文字号（docNumber）但无发文机关标志（issuingOrg）时，
 * 用 issuer（发文机关署名）推导红头。红头 = 机关全称/规范化简称 + “文件”，
 * 署名本身就是同一机关名，故红头 = issuer + “文件”（GB/T 9704 §7.2.4）。
 * 只在 issuer 明确存在且不带“文件”字样时推导，其余交给 format-check 提示用户。
 */
function inferRedHeadFromIssuer(
  doc: LegalDoc,
  repairs: RepairInfo[]
): LegalDoc {
  if (doc.issuingOrg) return doc
  if (!doc.docNumber) return doc
  // 会议纪要的版头是“××会议纪要”而非“××文件”，不适用文件式红头推导
  if (doc.docType === "minutes") return doc
  const issuer = doc.issuer?.trim() ?? ""
  if (issuer.length === 0) return doc
  if (issuer.includes("文件")) return doc
  const redHead = `${issuer}文件`
  const repaired = { ...doc, issuingOrg: redHead }
  repairs.push(
    makeRepair(
      "REPAIR_INFER_RED_HEAD",
      `未提供红头（发文机关标志），已根据发文机关署名“${issuer}”推导为“${redHead}”。`
    )
  )
  return repaired
}

// 公文正文收尾语（可作段末一句话独立成段）。LLM 常把“抄送：××”直接跟在收尾语后。

/** 从“抄送：”内容拆出抄送机关列表（顿号/逗号/分号/换行分隔，去尾部句号，过滤空项）。 */
function splitCcContent(content: string): string[] {
  return content
    .replace(/[。\.]$/, "")
    .split(/[、，,;；\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

/**
 * 正文里混入的“抄送：××”提取到 cc 字段并从正文移除。
 * 覆盖两种真实写法：
 * - 整段以“抄送：”开头（LLM 把版记要素写进正文）→ 整段提取
 * - “特此通知。抄送：××”（收尾语紧跟抄送）→ 收尾语保留为正文段，抄送提取
 * 只有 doc.cc 为空时提取；段内“抄送：”之前存在非收尾语正文时绝不提取
 * （避免把正文句子里作为普通用词的“抄送”误提取）。
 */
function extractCcParagraph(doc: LegalDoc, repairs: RepairInfo[]): LegalDoc {
  if ((doc.cc ?? []).length > 0) return doc
  const added: string[] = []
  const remainingBody: LegalDoc["body"] = []
  for (const paragraph of doc.body) {
    if (paragraph.type !== "p") {
      remainingBody.push(paragraph)
      continue
    }
    const text = paragraph.text.trim()
    // 整段以“抄送：”开头
    const whole = text.match(/^抄送[:：]\s*(.+)$/)
    if (whole) {
      const names = splitCcContent(whole[1])
      if (names.length > 0) {
        added.push(...names)
        continue
      }
    }
    // 收尾语紧跟“抄送：”（如“特此通知。抄送：××”）
    const trailing = text.match(
      /^(特此通知|特此函告|特此公告|特此通告|特此批复|特此请示|此复|此告|特此)[。\.]?\s*抄送[:：]\s*(.+)$/
    )
    if (trailing) {
      const names = splitCcContent(trailing[2])
      if (names.length > 0) {
        added.push(...names)
        remainingBody.push({ ...paragraph, text: `${trailing[1]}。` })
        continue
      }
    }
    remainingBody.push(paragraph)
  }
  if (added.length === 0) return doc
  const repaired = {
    ...doc,
    cc: [...added],
    body: remainingBody,
  }
  repairs.push(
    makeRepair(
      "REPAIR_EXTRACT_CC",
      `正文中的“抄送：…”已提取到版记抄送栏（${added.join("、")}），避免抄送混入正文。`
    )
  )
  return repaired
}

/**
 * 依次执行全部保守修复（顺序敏感：先补 recipient 冒号，再提取附件段，
 * 再补红头兜底，再提取抄送段，最后统一文号括号）。返回修复后的 doc 与所有本次执行的修复说明。
 */
export function repairDoc(doc: LegalDoc): RepairResult {
  const repairs: RepairInfo[] = []
  let current = doc
  current = repairRecipientColon(current, repairs)
  current = extractAttachmentParagraphs(current, repairs)
  current = inferRedHeadFromIssuer(current, repairs)
  current = extractCcParagraph(current, repairs)
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
