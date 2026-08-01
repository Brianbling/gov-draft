import { describe, expect, it } from "vitest"
import { severityOfIssue } from "../issue-severity"

describe("severityOfIssue · severity 分级兜底", () => {
  it("issue.severity 显式存在时优先使用，不做兜底分类", () => {
    expect(severityOfIssue({ code: "REPAIR_X", severity: "info" })).toBe("info")
    expect(
      severityOfIssue({ code: "ATTACHMENT_EMPTY", severity: "warning" })
    ).toBe("warning")
  })

  it("TITLE_EMPTY / PARAGRAPH_EMPTY 为结构性硬伤 → error", () => {
    expect(severityOfIssue({ code: "TITLE_EMPTY" })).toBe("error")
    expect(severityOfIssue({ code: "PARAGRAPH_EMPTY" })).toBe("error")
  })

  it("其余 _EMPTY（如 ATTACHMENT_EMPTY）仅为格式瑕疵 → warning", () => {
    expect(severityOfIssue({ code: "ATTACHMENT_EMPTY" })).toBe("warning")
  })

  it("_MISSING / _INVALID / _TOO_LONG / _MISUSED 等兜底 → warning", () => {
    expect(severityOfIssue({ code: "REQUEST_RECIPIENT_MISSING" })).toBe(
      "warning"
    )
    expect(severityOfIssue({ code: "SECURITY_LEVEL_INVALID" })).toBe("warning")
    expect(severityOfIssue({ code: "TITLE_TOO_LONG" })).toBe("warning")
    expect(severityOfIssue({ code: "REPORT_REQUEST_CLOSING_MISUSED" })).toBe(
      "warning"
    )
  })

  it("5 条新 L2 规则兜底 → warning（不再落 info 灰色）", () => {
    expect(severityOfIssue({ code: "MULTI_RECIPIENT" })).toBe("warning")
    expect(severityOfIssue({ code: "COLLOQUIAL_WORD" })).toBe("warning")
    expect(severityOfIssue({ code: "DOC_NUMBER_LEADING_ZERO" })).toBe("warning")
    expect(severityOfIssue({ code: "ATTACHMENT_MISMATCH" })).toBe("warning")
    expect(severityOfIssue({ code: "MINUTES_USES_DECISION" })).toBe("warning")
  })

  it("REPAIR_*（自动修复说明）仍为 info", () => {
    expect(severityOfIssue({ code: "REPAIR_RECIPIENT_COLON" })).toBe("info")
    expect(severityOfIssue({ code: "REPAIR_EXTRACT_ATTACHMENT" })).toBe("info")
    expect(severityOfIssue({ code: "REPAIR_DOC_NUMBER_YEAR_BRACKET" })).toBe(
      "info"
    )
  })

  it("未知 code 兜底 → warning（不落 info 灰色掩盖格式问题）", () => {
    expect(severityOfIssue({ code: "SOME_FUTURE_CODE" })).toBe("warning")
  })
})
