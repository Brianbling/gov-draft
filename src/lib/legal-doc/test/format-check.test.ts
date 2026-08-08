import { describe, expect, it } from "vitest"
import { checkFormat } from "../format-check"
import type { LegalDoc } from "../types"

function buildDoc(overrides: Partial<LegalDoc> = {}): LegalDoc {
  return {
    docType: "gongwen",
    title: "关于加强数字政府建设的通知",
    issuingOrg: "××市人民政府文件",
    docNumber: "国发〔2026〕12号",
    securityLevel: "秘密",
    urgency: "加急",
    date: "2026-07-31",
    body: [
      {
        type: "p",
        text: "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设。",
      },
    ],
    attachments: ["数字政府建设任务清单"],
    ...overrides,
  }
}

describe("checkFormat", () => {
  it("returns no issues for a well-formed document", () => {
    expect(checkFormat(buildDoc())).toEqual([])
  })

  it("flags a title longer than 30 characters", () => {
    const issues = checkFormat(
      buildDoc({
        title:
          "关于进一步加强和完善新时代基层数字政府建设工作若干重大事项的通知",
      })
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ field: "title", code: "TITLE_TOO_LONG" })
  })

  it("flags a whitespace-only title (belt-and-suspenders)", () => {
    const issues = checkFormat(buildDoc({ title: "   " }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ field: "title", code: "TITLE_EMPTY" })
  })

  it("flags a docNumber without a bracketed year", () => {
    const issues = checkFormat(buildDoc({ docNumber: "国发2026年12号" }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "docNumber",
      code: "DOC_NUMBER_YEAR_MISSING",
    })
  })

  it("accepts a valid bracketed year docNumber", () => {
    expect(checkFormat(buildDoc({ docNumber: "X政发〔2026〕3号" }))).toEqual([])
  })

  it("flags a docNumber without a red head (issuingOrg)", () => {
    const issues = checkFormat(
      buildDoc({ issuingOrg: undefined, docNumber: "国发〔2026〕12号" })
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "issuingOrg",
      code: "DOC_NUMBER_WITHOUT_RED_HEAD",
      severity: "error",
    })
  })

  it("accepts a docNumber with a red head", () => {
    expect(checkFormat(buildDoc())).toEqual([])
  })

  it.each(["秘密", "机密", "绝密"])(
    "accepts security level %s",
    (securityLevel) => {
      expect(checkFormat(buildDoc({ securityLevel }))).toEqual([])
    }
  )

  it("flags an invalid security level", () => {
    const issues = checkFormat(buildDoc({ securityLevel: "公开" }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "securityLevel",
      code: "SECURITY_LEVEL_INVALID",
    })
  })

  it.each(["特急", "加急"])("accepts urgency %s", (urgency) => {
    expect(checkFormat(buildDoc({ urgency }))).toEqual([])
  })

  it("flags an invalid urgency", () => {
    const issues = checkFormat(buildDoc({ urgency: "平急" }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "urgency",
      code: "URGENCY_INVALID",
    })
  })

  it("flags a non-ISO date", () => {
    const issues = checkFormat(buildDoc({ date: "2026年7月31日" }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "date",
      code: "DATE_FORMAT_INVALID",
    })
  })

  it("accepts an ISO date", () => {
    expect(checkFormat(buildDoc({ date: "2026-07-31" }))).toEqual([])
  })

  it("flags an ISO-shaped but non-existent date (2026-13-40)", () => {
    const issues = checkFormat(buildDoc({ date: "2026-13-40" }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "date",
      code: "DATE_FORMAT_INVALID",
    })
  })

  it("flags ISO-shaped dates that exceed the month's real day count (2026-04-31)", () => {
    const issues = checkFormat(buildDoc({ date: "2026-04-31" }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "date",
      code: "DATE_FORMAT_INVALID",
    })
  })

  it("accepts real edge dates: 1月1日 / 12月31日", () => {
    expect(checkFormat(buildDoc({ date: "2026-01-01" }))).toEqual([])
    expect(checkFormat(buildDoc({ date: "2026-12-31" }))).toEqual([])
  })

  it("flags an empty body paragraph", () => {
    const issues = checkFormat(buildDoc({ body: [{ type: "p", text: "   " }] }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "body[0].text",
      code: "PARAGRAPH_EMPTY",
    })
  })

  it("flags an empty attachment name", () => {
    const issues = checkFormat(
      buildDoc({ attachments: ["数字政府建设任务清单", "  "] })
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      field: "attachments[1]",
      code: "ATTACHMENT_EMPTY",
      // 附件名为空是格式瑕疵，非缺标题/空正文那样的结构性硬伤
      severity: "warning",
    })
  })

  it("accumulates multiple distinct issues", () => {
    const issues = checkFormat(
      buildDoc({
        title:
          "关于进一步加强和完善新时代基层数字政府建设工作若干重大事项的通知",
        securityLevel: "公开",
        date: "7月31日",
      })
    )
    const codes = issues.map((issue) => issue.code).sort()
    expect(codes).toEqual([
      "DATE_FORMAT_INVALID",
      "SECURITY_LEVEL_INVALID",
      "TITLE_TOO_LONG",
    ])
  })

  it("L1 结构性错误（空正文段落/空标题）标为 severity=error", () => {
    const issues = checkFormat(buildDoc({ body: [{ type: "p", text: "   " }] }))
    expect(issues[0]).toMatchObject({
      field: "body[0].text",
      code: "PARAGRAPH_EMPTY",
      severity: "error",
    })

    const titleIssues = checkFormat(buildDoc({ title: "   " }))
    expect(titleIssues[0]).toMatchObject({
      code: "TITLE_EMPTY",
      severity: "error",
    })
  })

  it("非结构性格式问题（如日期格式）缺省 severity 视为 warning", () => {
    const issues = checkFormat(buildDoc({ date: "2026年7月31日" }))
    expect(issues[0].severity).toBeUndefined()
  })
})
