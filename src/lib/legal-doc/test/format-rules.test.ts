import { describe, expect, it } from "vitest"
import { checkDocFormat } from "../review/format-rules"
import type { LegalDoc } from "../types"

function buildDoc(overrides: Partial<LegalDoc> = {}): LegalDoc {
  return {
    docType: "gongwen",
    title: "关于加强数字政府建设的通知",
    recipient: "各省、自治区、直辖市人民政府：",
    body: [
      {
        type: "p",
        text: "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设。",
      },
    ],
    ...overrides,
  }
}

function codes(issues: { code: string }[]): string[] {
  return issues.map((i) => i.code).sort()
}

describe("checkDocFormat · minutes 会议纪要", () => {
  it("attendees 非空时通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "minutes",
        attendees: ["张三（市委办公厅）", "李四（市政府办）"],
      })
    )
    expect(issues).toEqual([])
  })

  it("attendees 缺失时给出 MINUTES_ATTENDEES_MISSING", () => {
    const issues = checkDocFormat(buildDoc({ docType: "minutes" }))
    expect(codes(issues)).toEqual(["MINUTES_ATTENDEES_MISSING"])
    expect(issues[0].field).toBe("attendees")
  })

  it("attendees 为空数组时同样给出缺失提示", () => {
    const issues = checkDocFormat(
      buildDoc({ docType: "minutes", attendees: [] })
    )
    expect(codes(issues)).toEqual(["MINUTES_ATTENDEES_MISSING"])
  })
})

describe("checkDocFormat · request 请示", () => {
  it("recipient 非空且含“妥否，请批示”时通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "request",
        recipient: "省人民政府：",
        body: [
          { type: "p", text: "我厅拟购置一批办公设备，妥否，请批示。" },
        ],
      })
    )
    expect(issues).toEqual([])
  })

  it("recipient 缺失时给出 REQUEST_RECIPIENT_MISSING", () => {
    const issues = checkDocFormat(
      buildDoc({ docType: "request", recipient: undefined })
    )
    expect(codes(issues)).toContain("REQUEST_RECIPIENT_MISSING")
  })

  it("结尾无“请批示”用语时给出 REQUEST_CLOSING_MISSING", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "request",
        recipient: "省人民政府：",
        body: [{ type: "p", text: "现申请采购设备，望批准。" }],
      })
    )
    expect(codes(issues)).toContain("REQUEST_CLOSING_MISSING")
  })
})

describe("checkDocFormat · reply 批复", () => {
  it("recipient 非空且正文含“收悉”时通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "reply",
        recipient: "市财政局：",
        body: [
          { type: "p", text: "你局《关于申请追加预算的请示》收悉。现批复如下。" },
        ],
      })
    )
    expect(issues).toEqual([])
  })

  it("recipient 缺失时给出 REPLY_RECIPIENT_MISSING", () => {
    const issues = checkDocFormat(
      buildDoc({ docType: "reply", recipient: undefined })
    )
    expect(codes(issues)).toContain("REPLY_RECIPIENT_MISSING")
  })

  it("正文无“收悉”或“现批复如下”时给出 REPLY_OPENING_MISSING", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "reply",
        recipient: "市财政局：",
        body: [{ type: "p", text: "同意你局请示事项。" }],
      })
    )
    expect(codes(issues)).toContain("REPLY_OPENING_MISSING")
  })
})

describe("checkDocFormat · report 报告", () => {
  it("正文不以“妥否，请批示”结尾时通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "report",
        body: [{ type: "p", text: "现将有关情况报告如下。" }],
      })
    )
    expect(issues).toEqual([])
  })

  it("误用请示结尾用语时给出 REPORT_REQUEST_CLOSING_MISUSED", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "report",
        body: [{ type: "p", text: "以上报告，妥否，请批示。" }],
      })
    )
    expect(codes(issues)).toEqual(["REPORT_REQUEST_CLOSING_MISUSED"])
  })
})

describe("checkDocFormat · announcement 通告/公告", () => {
  it("recipient 为空时通过", () => {
    const issues = checkDocFormat(
      buildDoc({ docType: "announcement", recipient: undefined })
    )
    expect(issues).toEqual([])
  })

  it("填写了 recipient 时给出 ANNOUNCEMENT_RECIPIENT_SHOULD_BE_EMPTY", () => {
    const issues = checkDocFormat(
      buildDoc({ docType: "announcement", recipient: "各区人民政府：" })
    )
    expect(codes(issues)).toEqual(["ANNOUNCEMENT_RECIPIENT_SHOULD_BE_EMPTY"])
  })
})

describe("checkDocFormat · decision 决定", () => {
  it("正文含至少一个 h1 时通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "decision",
        body: [
          { type: "p", text: "经研究，作出如下决定。" },
          { type: "h1", text: "加强组织领导" },
          { type: "p", text: "各级党委要高度重视。" },
        ],
      })
    )
    expect(issues).toEqual([])
  })

  it("正文全为 p 无 h1 时给出 DECISION_NO_H1_HEADING", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "decision",
        body: [{ type: "p", text: "经研究，决定如下：一、…二、…" }],
      })
    )
    expect(codes(issues)).toEqual(["DECISION_NO_H1_HEADING"])
  })
})

describe("checkDocFormat · gongwen 通知", () => {
  it("普通通知（标题无批转/转发/印发）通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "gongwen",
        title: "关于加强数字政府建设的通知",
      })
    )
    expect(issues).toEqual([])
  })

  it("转发/印发型通知引述被转文件标题时通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "gongwen",
        title: "关于印发《××工作办法》的通知",
        body: [{ type: "p", text: "现将《××工作办法》印发给你们，请认真贯彻执行。" }],
      })
    )
    expect(issues).toEqual([])
  })

  it("转发型通知未引述被转文件时给出 GONGWEN_TRANSFER_REFERENCE_MISSING", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "gongwen",
        title: "关于转发加强安全管理工作的通知",
        body: [{ type: "p", text: "现将该通知转发给你们，请认真贯彻执行。" }],
      })
    )
    expect(codes(issues)).toEqual(["GONGWEN_TRANSFER_REFERENCE_MISSING"])
  })
})

describe("checkDocFormat · opinion 意见", () => {
  it("正文提出具体处理办法时通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "opinion",
        body: [
          { type: "p", text: "为进一步加强安全生产工作，现提出如下意见。" },
          { type: "p", text: "要建立健全安全生产责任体系。" },
        ],
      })
    )
    expect(issues).toEqual([])
  })

  it("正文只有背景陈述、无处理办法时给出 OPINION_NO_MEASURES", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "opinion",
        body: [
          {
            type: "p",
            text: "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设。",
          },
        ],
      })
    )
    expect(codes(issues)).toEqual(["OPINION_NO_MEASURES"])
  })
})

describe("checkDocFormat · letter 函", () => {
  it("语气协商、无命令式用语时通过", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "letter",
        body: [
          {
            type: "p",
            text: "现商请贵局就有关合作事项予以支持，盼复。",
          },
        ],
      })
    )
    expect(issues).toEqual([])
  })

  it("使用命令式用语时给出 LETTER_IMPERATIVE_TONE", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "letter",
        body: [{ type: "p", text: "以上事项，必须执行，不得有误。" }],
      })
    )
    expect(codes(issues)).toEqual(["LETTER_IMPERATIVE_TONE"])
  })
})
