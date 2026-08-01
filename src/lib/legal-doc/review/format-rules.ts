import type { LegalDoc } from "../types"
import type { FormatIssue } from "../format-check"
import { DOC_TYPE_SPECS } from "../doc-type-spec"
/**
 * L2 文种规范审查：按 GB/T 9704-2012 各文种格式要求逐条校验。
 * 规则数据（DocFormatRequirement）的唯一事实源在 ../doc-type-spec.ts 的
 * DOC_TYPE_SPECS（与 prompt 格式要求合并成一份），本文件只保留暴露层：
 * 类型 + checkDocFormat 执行入口，不在此定义任何规则，避免双写分叉。
 * 规则字段：
 * - code    机器可读错误码（供 i18n/测试定位）；
 * - field   问题归属字段（展示定位用）；
 * - check   纯函数，返回 Issue 或 null。
 */

export type { DocFormatRequirement } from "../doc-type-spec"

/**
 * 对给定 LegalDoc 执行 L2 文种规范审查。文种未注册或规则通过时返回空数组。
 */
export function checkDocFormat(doc: LegalDoc): FormatIssue[] {
  const spec = DOC_TYPE_SPECS[doc.docType]
  if (!spec) return []
  const issues: FormatIssue[] = []
  for (const rule of spec.rules) {
    const found = rule.check(doc)
    if (found) issues.push(found)
  }
  return issues
}
