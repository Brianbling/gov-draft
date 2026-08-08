import type { FormatIssue } from "./format-check"

/**
 * 机关名称 ↔ 机关代字（发文字号前缀）映射（GB/T 9704 §7.2.5）。
 *
 * 机关代字是发文字号的第一段，代表发文机关。文秘验收问题 1：红头
 * "国务院办公厅文件"配文号"国发〔2026〕15号"——国发是国务院的代字
 * （红头应"国务院文件"），国办发才是国务院办公厅的代字，两者混用即
 * 属错误。本表用于：① 由红头机关名推断应配的代字；② 反向校验文号代字
 * 与红头机关是否一致。
 *
 * 机关名按"规范化简称"收录（去"文件"后缀后比对）。含 × 占位符的机关
 * 名用于模糊匹配：红头里的占位机关名（如"××市人民政府文件"）与文号
 * 里的占位代字（"×政发"）无法精确验证，用占位符替换一致性兜底。
 */
export const ORG_CODE_ENTRIES: Array<{
  orgName: string
  code: string
}> = [
  // 中央机关
  { orgName: "国务院", code: "国发" },
  { orgName: "国务院办公厅", code: "国办发" },
  // 部门（代字多为部名+发）
  { orgName: "外交部", code: "外发" },
  { orgName: "国家发展改革委", code: "发改" },
  { orgName: "教育部", code: "教发" },
  { orgName: "公安部", code: "公发" },
  { orgName: "财政部", code: "财发" },
  { orgName: "人力资源社会保障部", code: "人社发" },
  { orgName: "生态环境部", code: "环发" },
  { orgName: "住房城乡建设部", code: "建发" },
  { orgName: "交通运输部", code: "交发" },
  { orgName: "农业农村部", code: "农发" },
  { orgName: "商务部", code: "商发" },
  { orgName: "文化和旅游部", code: "文旅发" },
  { orgName: "国家卫生健康委", code: "卫健发" },
  { orgName: "中国人民银行", code: "银发" },
  { orgName: "国家市场监督管理总局", code: "市场监管发" },
  // 省/市/区高频通用模式（占位机关名模糊匹配）
  { orgName: "×人民政府", code: "×政发" },
  { orgName: "×人民政府办公厅", code: "×政办发" },
]

/** 发文字号中的机关代字段（如"国发〔2026〕12号" → "国发"）。 */
const DOC_CODE_PATTERN = /^([^\d〔【\s]+)(〔|【|\[|\()/

function extractDocCode(docNumber: string): string | null {
  const match = docNumber.match(DOC_CODE_PATTERN)
  return match ? match[1]! : null
}

/** 红头机关名（"××市人民政府文件" → "××市人民政府"）。 */
function stripFileSuffix(orgName: string): string {
  return orgName.replace(/文件$/, "").trim()
}

/**
 * 校验红头机关名与文号机关代字是否匹配（文秘验收问题 1 双向校验）。
 *
 * 判定优先级：
 * 1. 机关名精确命中表项 → 其 code 为期望代字，必须与文号代字完全相等；
 * 2. 机关名未知但代字精确命中表项 → 代字对应的机关名必须与红头机关名相等；
 *    机关名含占位符 ×（模板文档）时视为不可精确验证，放行（× 是任意机关名的占位）；
 * 3. 双侧都不在表内 → 无法验证，返回 null（不误报）。
 *
 * 占位模板（任一侧含 ×，如"××市人民政府文件" + "×政发〔2026〕3号"）不做字符比对——
 * 占位机关名与代字结构不同（"××市人民政府" 与 "×政发" 本就不是同层文本），
 * 强校验必误报。只有真实机关名 + 真实代字（如 国务院办公厅 + 国发）才校验并报错。
 */
export function matchOrgCode(
  issuingOrg: string,
  docNumber: string
): FormatIssue | null {
  const orgName = stripFileSuffix(issuingOrg.trim())
  const docCode = extractDocCode(docNumber.trim())
  if (!orgName || !docCode) return null

  // 1. 机关名精确命中 → 期望代字必须等于文号代字。
  const orgEntry = ORG_CODE_ENTRIES.find(
    (entry) => entry.orgName === orgName
  )
  if (orgEntry) {
    if (orgEntry.code === docCode) return null
    return {
      field: "docNumber",
      code: "ORG_CODE_MISMATCH",
      message: `红头“${issuingOrg.trim()}”对应的机关代字应为“${orgEntry.code}”，但发文字号“${docNumber.trim()}”用的是“${docCode}”。请改为“${orgEntry.code}〔年份〕序号号”。`,
      severity: "error",
    }
  }

  // 2. 机关名未知但代字精确命中 → 代字对应机关必须与红头机关一致。
  const codeEntry = ORG_CODE_ENTRIES.find((entry) => entry.code === docCode)
  if (codeEntry) {
    if (orgName === codeEntry.orgName) return null
    // 机关名是占位模板（××…）时，代字再具体也无法反推真实机关，放行。
    if (orgName.includes("×")) return null
    return {
      field: "issuingOrg",
      code: "ORG_CODE_MISMATCH",
      message: `发文字号“${docNumber.trim()}”的机关代字“${docCode}”对应发文机关为“${codeEntry.orgName}”，但红头写的是“${issuingOrg.trim()}”。请统一红头机关名与文号代字。`,
      severity: "error",
    }
  }

  // 3. 双侧未知 → 无法验证（占位模板或未收录机关，不误报）。
  return null
}

/** 由机关名推导标准机关代字（供 prompt/表单提示用）。未命中返回 null。 */
export function inferDocCode(orgName: string): string | null {
  const normalized = stripFileSuffix(orgName.trim())
  if (!normalized) return null
  return (
    ORG_CODE_ENTRIES.find((entry) => entry.orgName === normalized)?.code ?? null
  )
}
