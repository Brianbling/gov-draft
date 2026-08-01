import { DOC_TYPE_SPECS, type FormFieldKey } from "./doc-type-spec"
import type { DocType, LegalDoc } from "./types"

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

const STRING_KEYS = [
  "title",
  "docNumber",
  "recipient",
  "issuer",
  "date",
  "securityLevel",
  "urgency",
] as const

const ARRAY_KEYS = [
  "attachments",
  "cc",
  "attendees",
  "absentees",
  "observers",
] as const

const BOOLEAN_KEY = "seal" as const

/**
 * 要素面板的字段"形状"以 LegalDoc schema 为准，而不是 formFields 的 type：
 * 历史上 attachments/cc 在 formFields 里曾声明为 text 但 IR 里是数组（已对齐为
 * arrayField），此处仍按 schema 的数组/文本/布尔集合取形状，双保险避免再次分叉
 * 时把数组当字符串处理。编辑面板的对象始终是 FormValues，写回时还原为 LegalDoc。
 */
const EDIT_ARRAY_KEYS = new Set<FormFieldKey>(ARRAY_KEYS)
const EDIT_TEXT_KEYS = new Set<FormFieldKey>([...STRING_KEYS])

/**
 * 把 AI 生成的 LegalDoc 拍平成要素编辑面板的 FormValues（#29）。
 * 只取当前文种 formFields 里定义过的字段，防止把 schema 中与文种无关的字段
 * （如纪要名单混进普通通知）塞进面板；缺失值归一为 undefined，面板显示空占位。
 * 单一 IR：面板编辑对象仍是 FormValues，写回时经 applyFormValuesToDoc 还原为 LegalDoc，
 * 不会出现第二份文档结构。
 */
export function docToFormValues(doc: LegalDoc): FormValues {
  const values: FormValues = {}
  // 同 applyFormValuesToDoc：FormFieldKey 联合键按 string 记录写入，避免严格模式
  // 下联合键取值类型各异（string vs string[]）无法赋值。
  const target = values as unknown as Record<string, unknown>
  const fields = DOC_TYPE_SPECS[doc.docType].formFields
  for (const field of fields) {
    const key = field.key
    if (key === BOOLEAN_KEY) {
      target[key] = doc.seal === true
      continue
    }
    if (EDIT_ARRAY_KEYS.has(key)) {
      const arr = doc[key] as string[] | undefined
      target[key] = arr && arr.length > 0 ? [...arr] : []
      continue
    }
    if (EDIT_TEXT_KEYS.has(key)) {
      const value = doc[key] as string | undefined
      target[key] = value ? value.trim() : ""
    }
  }
  return values
}

/**
 * 把要素编辑面板的值应用回 LegalDoc（#29）。只写面板定义过的字段——
 * formFields 是各文种"可编辑要素子集"，不在子集内的字段（正文段落、版记印发
 * 机关/日期等）保持 AI 原样不动，避免面板误删生成内容。
 * array 类型空数组 → undefined（渲染时空壳段落由 toMarkdown 已处理，但 IR 里
 * 应保留 schema 语义）；text 空串 → undefined。返回浅拷贝，不改原 doc。
 */
export function applyFormValuesToDoc(doc: LegalDoc, values: FormValues): LegalDoc {
  const next: LegalDoc = { ...doc }
  // formFields 的 key 都是合法 LegalDoc 字段（doc-type-spec-form 测试兜底），
  // 但 FormFieldKey 是字符串联合，直接 next[key]= 赋值在严格模式下无法通过
  // （联合键的取值类型各异），经 Record<string, unknown> 中转是安全的窄化逃生口。
  const target = next as unknown as Record<string, unknown>
  const fields = DOC_TYPE_SPECS[doc.docType].formFields
  for (const field of fields) {
    const key = field.key
    // 未出现在 values 里的键跳过：面板每次提交全量 formFields，但函数本身也应
    // 支持部分更新（只改传入的字段），避免把没触碰的字段抹成 undefined。
    if (values[key] === undefined) continue
    if (key === BOOLEAN_KEY) {
      next.seal = values.seal === true
      continue
    }
    if (EDIT_ARRAY_KEYS.has(key)) {
      const arr = values[key] as string[] | undefined
      target[key] = arr && arr.length > 0 ? [...arr] : undefined
      continue
    }
    if (EDIT_TEXT_KEYS.has(key)) {
      const raw = values[key] as string | undefined
      target[key] = raw && raw.trim().length > 0 ? raw.trim() : undefined
    }
  }
  return next
}
