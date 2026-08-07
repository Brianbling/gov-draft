import { describe, expect, it } from "vitest"
import { checkDocFormat } from "../review/format-rules"
import { DOC_TYPE_SPECS } from "../doc-type-spec"
import { buildUserPrompt } from "../prompt"
import { DOC_TYPES, type LegalDoc } from "../types"

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
        body: [{ type: "p", text: "我厅拟购置一批办公设备，妥否，请批示。" }],
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
          {
            type: "p",
            text: "你局《关于申请追加预算的请示》收悉。现批复如下。",
          },
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
        body: [
          { type: "p", text: "现将《××工作办法》印发给你们，请认真贯彻执行。" },
        ],
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

describe("checkDocFormat · 新 L2 通用规则", () => {
  it("请示/批复 recipient 含顿号（多头主送）时给出 MULTI_RECIPIENT", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "request",
        recipient: "省人民政府、省财政厅：",
        body: [{ type: "p", text: "现申请采购设备，妥否，请批示。" }],
      })
    )
    expect(codes(issues)).toContain("MULTI_RECIPIENT")
  })

  it("请示/批复 recipient 单一机关（无顿号）时不报 MULTI_RECIPIENT", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "request",
        recipient: "省人民政府：",
        body: [{ type: "p", text: "现申请采购设备，妥否，请批示。" }],
      })
    )
    expect(codes(issues)).not.toContain("MULTI_RECIPIENT")
  })

  it("docNumber 序号带前导 0（〔2026〕05号）时给出 DOC_NUMBER_LEADING_ZERO", () => {
    const issues = checkDocFormat(buildDoc({ docNumber: "国发〔2026〕05号" }))
    expect(codes(issues)).toContain("DOC_NUMBER_LEADING_ZERO")
  })

  it("docNumber 无前导 0（〔2026〕5号）时不报 DOC_NUMBER_LEADING_ZERO", () => {
    const issues = checkDocFormat(buildDoc({ docNumber: "国发〔2026〕5号" }))
    expect(codes(issues)).not.toContain("DOC_NUMBER_LEADING_ZERO")
  })

  it("正文含口语化词时给出 COLLOQUIAL_WORD", () => {
    const issues = checkDocFormat(
      buildDoc({
        body: [{ type: "p", text: "大家要提高认识，赶紧落实。" }],
      })
    )
    expect(codes(issues)).toContain("COLLOQUIAL_WORD")
  })

  it("“抓紧制定”“抓紧抓实”是标准公文用语，不报 COLLOQUIAL_WORD", () => {
    const issues = checkDocFormat(
      buildDoc({
        body: [{ type: "p", text: "要抓紧制定实施方案，抓紧抓实各项任务。" }],
      })
    )
    expect(codes(issues)).not.toContain("COLLOQUIAL_WORD")
  })

  it("正文纯书面语时不报 COLLOQUIAL_WORD", () => {
    const issues = checkDocFormat(
      buildDoc({
        body: [
          { type: "p", text: "各单位要进一步提高认识，扎实做好贯彻落实工作。" },
        ],
      })
    )
    expect(codes(issues)).not.toContain("COLLOQUIAL_WORD")
  })

  it("纪要正文用“会议决定”时给出 MINUTES_USES_DECISION", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "minutes",
        attendees: ["张三（市委办）"],
        body: [{ type: "p", text: "会议决定，组织开展专项整治行动。" }],
      })
    )
    expect(codes(issues)).toContain("MINUTES_USES_DECISION")
  })

  it("纪要正文用“会议确定/议定”时不报 MINUTES_USES_DECISION", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "minutes",
        attendees: ["张三（市委办）"],
        body: [{ type: "p", text: "会议确定，组织开展专项整治行动。" }],
      })
    )
    expect(codes(issues)).not.toContain("MINUTES_USES_DECISION")
  })

  it("正文提到《X》但未列入声明的 attachments 时给出 ATTACHMENT_MISMATCH", () => {
    const issues = checkDocFormat(
      buildDoc({
        attachments: ["年度工作要点"],
        body: [
          { type: "p", text: "现将《绩效考核方案》一并印发，请遵照执行。" },
        ],
      })
    )
    expect(codes(issues)).toContain("ATTACHMENT_MISMATCH")
  })

  it("引述语境（批复“你局《××请示》收悉”）不参与附件核对，不误报 ATTACHMENT_MISMATCH", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "reply",
        recipient: "市财政局：",
        attachments: ["批复意见"],
        body: [
          {
            type: "p",
            text: "你局《关于申请追加预算的请示》收悉。现批复如下。",
          },
        ],
      })
    )
    expect(codes(issues)).not.toContain("ATTACHMENT_MISMATCH")
  })

  it("同一段既含引述词又声明“附件：”时，附件声明仍参与核对", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "reply",
        recipient: "市财政局：",
        attachments: ["批复意见"],
        body: [
          {
            type: "p",
            text: "你局来文收悉。另附《实施方案》一份，请一并查收。",
          },
        ],
      })
    )
    expect(codes(issues)).toContain("ATTACHMENT_MISMATCH")
  })

  it("附件段落（“附件：《××清单》”）不受引述词影响，仍参与核对", () => {
    const issues = checkDocFormat(
      buildDoc({
        attachments: ["批复意见"],
        body: [
          {
            type: "p",
            text: "你局来文收悉。附件：《实施方案》",
          },
        ],
      })
    )
    expect(codes(issues)).toContain("ATTACHMENT_MISMATCH")
  })

  it("非引述语境的法律依据引用（依据《××条例》）不属于附件声明，不报 ATTACHMENT_MISMATCH", () => {
    const issues = checkDocFormat(
      buildDoc({
        attachments: ["年度工作要点"],
        body: [
          {
            type: "p",
            text: "依据《行政处罚法》第二十一条，现就有关工作通知如下。",
          },
        ],
      })
    )
    expect(codes(issues)).not.toContain("ATTACHMENT_MISMATCH")
  })

  it("引述词仅在引述来文书名号之后（《××请示》请查收）时，该《》不报，但同段附件声明仍报", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "reply",
        recipient: "市财政局：",
        attachments: ["批复意见"],
        body: [
          {
            type: "p",
            text: "《关于申请追加预算的请示》请查收，另附《实施方案》一并办理。",
          },
        ],
      })
    )
    expect(codes(issues)).toContain("ATTACHMENT_MISMATCH")
  })

  it("正文声明附件（“附件：××清单”）但 attachments 未列该名时给出 ATTACHMENT_MISMATCH", () => {
    const issues = checkDocFormat(
      buildDoc({
        attachments: ["批复意见"],
        body: [{ type: "p", text: "附件：《××清单》" }],
      })
    )
    expect(codes(issues)).toContain("ATTACHMENT_MISMATCH")
  })

  it("正文 p 段首“一、”序号时给出 P_LEADING_ORDER_SUGGESTION（只提示不自动改）", () => {
    const issues = checkDocFormat(
      buildDoc({
        body: [
          { type: "p", text: "一、加强组织领导，压实工作责任。" },
          { type: "p", text: "二、强化督促检查。" },
        ],
      })
    )
    expect(codes(issues)).toContain("P_LEADING_ORDER_SUGGESTION")
    expect(
      issues.find((i) => i.code === "P_LEADING_ORDER_SUGGESTION")?.severity
    ).toBe("warning")
  })

  it("“一体化推进”这类纯中文词开头的段落不报 P_LEADING_ORDER_SUGGESTION", () => {
    const issues = checkDocFormat(
      buildDoc({ body: [{ type: "p", text: "一体化推进政务服务改革。" }] })
    )
    expect(codes(issues)).not.toContain("P_LEADING_ORDER_SUGGESTION")
  })

  it("正文计量单位用普通数字 m2/m3 时给出 UNIT_SUPERSCRIPT_SUGGESTION（warning）", () => {
    const issues = checkDocFormat(
      buildDoc({
        body: [{ type: "p", text: "本项目占地约 1200m2，建筑面积 800m3。" }],
      })
    )
    expect(codes(issues)).toContain("UNIT_SUPERSCRIPT_SUGGESTION")
    expect(
      issues.find((i) => i.code === "UNIT_SUPERSCRIPT_SUGGESTION")?.severity
    ).toBe("warning")
  })

  it("已用上标 m²/m³ 或规范全称时（平方米/立方米）不报 UNIT_SUPERSCRIPT_SUGGESTION", () => {
    const issues = checkDocFormat(
      buildDoc({
        body: [{ type: "p", text: "占地约 1200m²，建筑面积 800 立方米。" }],
      })
    )
    expect(codes(issues)).not.toContain("UNIT_SUPERSCRIPT_SUGGESTION")
  })

  it("m2/m3 出现在字母编号或缩写语境（如 m2 模块）时不误报", () => {
    const issues = checkDocFormat(
      buildDoc({
        body: [{ type: "p", text: "请参照 m2 模块与 m3 接口实现。" }],
      })
    )
    expect(codes(issues)).not.toContain("UNIT_SUPERSCRIPT_SUGGESTION")
  })

  it("h1/h2 标题段首序号不报 P_LEADING_ORDER_SUGGESTION（只查 p）", () => {
    const issues = checkDocFormat(
      buildDoc({
        body: [{ type: "h1", text: "一、总体要求" }],
      })
    )
    expect(codes(issues)).not.toContain("P_LEADING_ORDER_SUGGESTION")
  })

  it("正文提到的《X》已列入 attachments（去书名号/后缀模糊匹配）时不报", () => {
    const issues = checkDocFormat(
      buildDoc({
        attachments: ["绩效考核方案"],
        body: [
          { type: "p", text: "现将《绩效考核方案》一并印发，请遵照执行。" },
        ],
      })
    )
    expect(codes(issues)).not.toContain("ATTACHMENT_MISMATCH")
  })

  it("未声明 attachments 时正文引用《××请示》属正常引述，不报 ATTACHMENT_MISMATCH", () => {
    const issues = checkDocFormat(
      buildDoc({
        docType: "reply",
        recipient: "市财政局：",
        body: [
          {
            type: "p",
            text: "你局《关于申请追加预算的请示》收悉。现批复如下。",
          },
        ],
      })
    )
    expect(codes(issues)).not.toContain("ATTACHMENT_MISMATCH")
  })

  it("正文未提任何《书名号》时不报 ATTACHMENT_MISMATCH", () => {
    const issues = checkDocFormat(
      buildDoc({
        attachments: ["年度工作要点"],
        body: [{ type: "p", text: "现就有关工作通知如下，请遵照执行。" }],
      })
    )
    expect(codes(issues)).not.toContain("ATTACHMENT_MISMATCH")
  })
})

describe("单一事实源 · DOC_TYPE_SPECS 覆盖全部文种且与 prompt/规则一致", () => {
  it("DOC_TYPE_SPECS 的 key 覆盖全部 9 个 DOC_TYPES", () => {
    expect(Object.keys(DOC_TYPE_SPECS).sort()).toEqual([...DOC_TYPES].sort())
  })

  it("prompt 要求的格式字符串直接取自 DOC_TYPE_SPECS（不再双写）", () => {
    for (const docType of DOC_TYPES) {
      const prompt = buildUserPrompt(`${docType}\n测试内容`)
      expect(prompt).toContain(DOC_TYPE_SPECS[docType].promptRequirement)
    }
  })

  it("checkDocFormat 对全部注册规则逐一执行且不抛错（registry 同源）", () => {
    for (const docType of DOC_TYPES) {
      const spec = DOC_TYPE_SPECS[docType]
      expect(spec.rules.length).toBeGreaterThan(0)
      for (const rule of spec.rules) {
        expect(typeof rule.check).toBe("function")
        expect(() => checkDocFormat(buildDoc({ docType }))).not.toThrow()
      }
    }
  })
})
