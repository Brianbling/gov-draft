import { DOC_TYPE_SPECS, type FormFieldKey } from "./doc-type-spec"
import type { DocType } from "./types"

/**
 * 表单辅助 → 统一 IR 的适配器（v2）。
 * 用户在生成对话框填写的结构化要素（标题/文号/主送/署名/日期/名单/盖章等）与自然语言
 * 正文描述是两个入口，统一合成到 buildUserPrompt：表单值作为"必须遵守的硬约束"写进
 * 用户 prompt，让 LLM 在生成 LegalDoc 时严格落在用户已填的要素上，正文仍由自然语言驱动。
 * 这样表单与自然语言最终产出同一个 LegalDoc schema（单一 IR），不产生第二份数据结构。
 */

export interface FormValues {
  title?: string
  docNumber?: string
  recipient?: string
  issuer?: string
  date?: string
  securityLevel?: string
  urgency?: string
  attachments?: string[]
  cc?: string[]
  attendees?: string[]
  absentees?: string[]
  observers?: string[]
  seal?: boolean
}

const FORM_FIELD_LABELS: Record<FormFieldKey, string> = {
  title: "标题",
  docNumber: "发文字号",
  recipient: "主送机关",
  issuer: "发文机关署名",
  date: "成文日期",
  securityLevel: "密级",
  urgency: "紧急程度",
  attachments: "附件",
  cc: "抄送机关",
  attendees: "出席人员",
  absentees: "请假人员",
  observers: "列席人员",
  seal: "是否盖章",
}

const NONEMPTY_KEYS = [
  "title",
  "docNumber",
  "recipient",
  "issuer",
  "date",
  "securityLevel",
  "urgency",
] as const

/** 只取该文种 formFields 里定义过、且用户填了值的字段，避免把无关字段塞进 prompt。 */
function serializeValues(
  docType: DocType,
  values: FormValues,
): Array<[FormFieldKey, string]> {
  const fields = DOC_TYPE_SPECS[docType].formFields
  const allowed = new Set<FormFieldKey>(fields.map((f) => f.key))
  const out: Array<[FormFieldKey, string]> = []
  for (const key of NONEMPTY_KEYS) {
    if (!allowed.has(key)) continue
    const value = values[key]
    if (value && value.trim().length > 0) out.push([key, value.trim()])
  }
  return out
}

/**
 * 把表单值合成一句"已确定的要素"指令，追加到用户 prompt：
 * "已确定的公文要素：标题=…，主送机关=…。请严格按上述要素生成，不要自行改动。"
 * 无表单值时返回空串（不改变既有自然语言路径行为）。
 */
export function buildFormRequirement(
  docType: DocType,
  values: FormValues,
): string {
  const filled = serializeValues(docType, values)
  const arrayEntries: Array<[string, string]> = []
  const fields = DOC_TYPE_SPECS[docType].formFields
  const allowed = new Set<FormFieldKey>(fields.map((f) => f.key))
  for (const key of ["attachments", "cc", "attendees", "absentees", "observers"] as const) {
    if (!allowed.has(key)) continue
    const arr = values[key]
    if (arr && arr.length > 0) {
      arrayEntries.push([FORM_FIELD_LABELS[key], arr.join("、")])
    }
  }
  const sealField = fields.find((f) => f.key === "seal")
  const sealLines: string[] = []
  // 只有用户显式切换过盖章开关才写进约束（undefined 表示未动，交给 sealDefault 决定，
  // 否则"默认不盖章"的文种会在用户未触碰时被塞入 seal=false 噪音）。
  if (sealField && values.seal !== undefined) {
    sealLines.push(`seal=${values.seal === true}`)
  }

  if (filled.length === 0 && arrayEntries.length === 0 && sealLines.length === 0) {
    return ""
  }

  const parts: string[] = []
  for (const [key, value] of filled) {
    parts.push(`${FORM_FIELD_LABELS[key]}=${value}`)
  }
  for (const [label, value] of arrayEntries) {
    parts.push(`${label}=${value}`)
  }
  parts.push(...sealLines)

  return `已确定的公文要素：${parts.join("，")}。请严格按上述要素生成，不要自行改动这些字段的值。`
}

/**
 * 校验表单必填项是否齐全。返回缺失字段的中文 label 列表（空数组 = 通过）。
 * minutes 的 attendees、其余文种的 title 在 formFields 里标记 required。
 */
export function validateFormRequired(
  docType: DocType,
  values: FormValues,
): string[] {
  const missing: string[] = []
  for (const field of DOC_TYPE_SPECS[docType].formFields) {
    if (!field.required) continue
    if (field.type === "boolean") continue
    const raw = values[field.key]
    const isEmpty =
      field.type === "array"
        ? !raw || (raw as string[]).length === 0
        : typeof raw !== "string" || raw.trim().length === 0
    if (isEmpty) missing.push(field.label)
  }
  return missing
}

/** 表单值是否为空（无任何要素填写）——决定对话框是否仍可用自然语言纯文本生成。 */
export function hasFormValues(values: FormValues): boolean {
  return (
    NONEMPTY_KEYS.some(
      (key) => typeof values[key] === "string" && values[key].trim().length > 0,
    ) ||
    (["attachments", "cc", "attendees", "absentees", "observers"] as const).some(
      (key) => {
        const arr = values[key] as string[] | undefined
        return arr !== undefined && arr.length > 0
      },
    )
  )
}
