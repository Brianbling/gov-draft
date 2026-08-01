/**
 * 分层公文审查管线（L1 结构 / L2 文种规范 / L3 标点文字规范）。
 * L1 复用 checkFormat（结构自检）；L2 为文种格式 registry；
 * L3 为纯文本规范化（自动修复），作用于渲染前的 LegalDoc 文本字段。
 */
export { checkFormat, type FormatIssue } from "../format-check"
export {
  checkDocFormat,
  type DocFormatRequirement,
} from "./format-rules"
export { normalizeText } from "./normalize-text"
export { normalizeDoc } from "./normalize-doc"
export { repairDoc, repairsToIssues } from "./repair-doc"
export type { RepairInfo } from "./repair-doc"

import type { LegalDoc } from "../types"
import type { FormatIssue } from "../format-check"
import { checkFormat } from "../format-check"
import { checkDocFormat } from "./format-rules"

/**
 * 合并执行 L1 结构审查 + L2 文种规范审查。
 * 对已规范化的 doc 调用（L3 normalize 在 parse 后先做），
 * 返回展示给用户的 FormatIssue 列表（顺序：L1 在前，L2 在后）。
 */
export function reviewDocument(doc: LegalDoc): FormatIssue[] {
  return [...checkFormat(doc), ...checkDocFormat(doc)]
}
