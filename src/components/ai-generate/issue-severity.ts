/**
 * 优先用 FormatIssue.severity（legal-doc 新加的字段，缺省视为 warning）；
 * 对还没有标注 severity 的 issue 按 code 后缀兜底分类。
 * _EMPTY 只有缺标题/空正文属于结构性硬伤（error），附件名为空等仅格式瑕疵（warning）。
 * 兜底一律 warning：未知 code 也不该被灰色 info 弱化掩盖格式问题（info 仅由 REPAIR_* 显式 severity 提供）。
 * 纯展示，不改数据。
 */
export type IssueSeverity = "error" | "warning" | "info"

export function severityOfIssue(issue: {
  code: string
  severity?: "info" | "warning" | "error"
}): IssueSeverity {
  if (issue.severity) return issue.severity
  const code = issue.code
  if (code.startsWith("REPAIR_")) return "info"
  if (code.endsWith("_EMPTY")) {
    return code === "TITLE_EMPTY" || code === "PARAGRAPH_EMPTY"
      ? "error"
      : "warning"
  }
  return "warning"
}
