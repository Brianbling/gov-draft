import { describe, expect, it } from "vitest"
import { toMarkdown } from "../to-markdown"
import type { LegalDoc } from "../types"

function buildDoc(overrides: Partial<LegalDoc> = {}): LegalDoc {
  return {
    docType: "gongwen",
    title: "关于加强数字政府建设的通知",
    docNumber: "国发〔2026〕12号",
    recipient: "各省、自治区、直辖市人民政府，国务院各部委、各直属机构：",
    body: [
      {
        type: "p",
        text: "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设，经国务院同意，现就有关工作通知如下。",
      },
      {
        type: "h1",
        text: "总体要求",
      },
      {
        type: "p",
        text: "以习近平新时代中国特色社会主义思想为指导，坚持稳中求进工作总基调。",
      },
      {
        type: "h2",
        text: "统筹推进",
      },
      {
        type: "p",
        text: "各地区各部门要加强组织领导，确保各项任务落地见效。",
      },
    ],
    issuer: "国务院办公厅",
    date: "2026-07-31",
    ...overrides,
  }
}

describe("toMarkdown", () => {
  it("renders the title as a level-1 heading", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).toContain("# 关于加强数字政府建设的通知")
  })

  it("renders docNumber in a centered container below the title", () => {
    const markdown = toMarkdown(buildDoc())
    const docNumberLine =
      "::: content.body.paragraph.align: center; content.body.paragraph.indent: 0em"
    const blockIndex = markdown.indexOf(docNumberLine)
    const titleIndex = markdown.indexOf("# 关于加强数字政府建设的通知")
    expect(blockIndex).toBeGreaterThan(-1)
    expect(blockIndex).toBeGreaterThan(titleIndex)
    expect(markdown).toContain("国发〔2026〕12号")
  })

  it("renders the recipient flush-left without indentation", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).toContain("::: content.body.paragraph.indent: 0em")
    expect(markdown).toContain(
      "各省、自治区、直辖市人民政府，国务院各部委、各直属机构："
    )
  })

  it("wraps body paragraphs in an indented container", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).toContain("::: content.body.paragraph.indent: 2em")
    expect(markdown).toContain(
      "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设，经国务院同意，现就有关工作通知如下。"
    )
  })

  it("maps h1 body blocks to level-2 headings and h2 to level-3", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).toContain("## 总体要求")
    expect(markdown).toContain("### 统筹推进")
  })

  it("renders the letterhead when securityLevel or urgency is present", () => {
    const markdown = toMarkdown(
      buildDoc({ securityLevel: "秘密", urgency: "加急" })
    )
    expect(markdown).toContain(
      "::: content.body.paragraph.align: center; content.body.paragraph.indent: 0em; content.body.fonts.cjkFamily: 黑体, SimHei, STHeiti, sans-serif; content.body.style.weight: 700"
    )
    expect(markdown).toContain("秘密")
    expect(markdown).toContain("加急")
  })

  it("omits the letterhead when neither securityLevel nor urgency is set", () => {
    const markdown = toMarkdown(
      buildDoc({ securityLevel: undefined, urgency: undefined })
    )
    expect(markdown).not.toContain("黑体, SimHei, STHeiti, sans-serif")
  })

  it("renders attachments, signature and printing block", () => {
    const markdown = toMarkdown(
      buildDoc({
        attachments: ["数字政府建设任务清单"],
        cc: ["中共中央办公厅"],
        printingOffice: "国务院办公厅",
        printingDate: "2026-08-01",
      })
    )
    expect(markdown).toContain("附件：数字政府建设任务清单")
    expect(markdown).toContain(
      "::: content.body.paragraph.align: right; content.body.paragraph.indent: 0em"
    )
    expect(markdown).toContain("国务院办公厅")
    expect(markdown).toContain("2026-07-31")
    expect(markdown).toContain("抄送：中共中央办公厅")
    expect(markdown).toContain("国务院办公厅\n2026-08-01")
  })

  it("numbers multiple attachments", () => {
    const markdown = toMarkdown(
      buildDoc({ attachments: ["任务清单", "工作台账"] })
    )
    expect(markdown).toContain("附件：1．任务清单")
    expect(markdown).toContain("附件：2．工作台账")
  })

  it("adds a seal placeholder below the signature when seal is true", () => {
    const markdown = toMarkdown(buildDoc({ seal: true }))
    const sealIndex = markdown.indexOf("（此处加盖公章）")
    expect(sealIndex).toBeGreaterThan(-1)
    expect(markdown.indexOf("国务院办公厅")).toBeLessThan(sealIndex)
  })

  it("omits the seal placeholder when seal is false or unset", () => {
    expect(toMarkdown(buildDoc())).not.toContain("（此处加盖公章）")
    expect(toMarkdown(buildDoc({ seal: false }))).not.toContain(
      "（此处加盖公章）"
    )
  })

  it("does not duplicate a seal placeholder when the signature already marks 盖章", () => {
    const markdown = toMarkdown(
      buildDoc({ seal: true, issuer: "国务院办公厅（盖章处）" })
    )
    const matches = markdown.match(/（此处加盖公章）/g)
    expect(matches).toBeNull()
    expect(markdown).toContain("国务院办公厅（盖章处）")
  })

  it("标题含 Markdown 特殊字符（#、*）时不破坏标题结构", () => {
    const markdown = toMarkdown(buildDoc({ title: "关于 #1 重点任务 *清单* 的通知" }))
    // 标题必须仍是单行 # 一级标题，不能被解析成多个标题或加粗
    expect(markdown).toContain("# 关于 #1 重点任务 *清单* 的通知")
    expect(markdown).not.toContain("## 关于")
    expect(markdown).not.toContain("**清单**")
  })

  it("body 为空数组时仍输出标题不崩溃", () => {
    const doc = buildDoc()
    const emptyBodyDoc = { ...doc, body: [] as never[] } as unknown as LegalDoc
    const markdown = toMarkdown(emptyBodyDoc)
    expect(markdown).toContain("# 关于加强数字政府建设的通知")
    expect(markdown).toContain("国发〔2026〕12号")
  })

  it("attachments/cc 为空数组时不输出空壳段落", () => {
    const markdown = toMarkdown(
      buildDoc({ attachments: [], cc: [], printingOffice: undefined, printingDate: undefined })
    )
    expect(markdown).not.toContain("附件：")
    expect(markdown).not.toContain("抄送：")
  })

  it("正文含全角标点与长段落时正常换行", () => {
    const longParagraph =
      "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设，全面提升政务服务效能，持续优化营商环境，切实增强企业和群众的获得感、幸福感，经国务院同意，现就有关工作通知如下：第一，坚持系统观念；第二，坚持问题导向；第三，坚持改革创新；第四，坚持统筹推进，确保各项任务落地见效。"
    const markdown = toMarkdown(buildDoc({ body: [{ type: "p", text: longParagraph }] }))
    expect(markdown).toContain(longParagraph)
    // 长段落落在缩进容器内，且不含被 markdown 误解的分隔
    expect(markdown).toContain("::: content.body.paragraph.indent: 2em")
    expect(markdown).not.toContain("\n\n:::\n\n")
  })

  it("h1/h2 标题自带序号前缀时剥离，避免与引擎自动编号叠加成双号", () => {
    const markdown = toMarkdown(
      buildDoc({
        body: [
          { type: "h1", text: "一、总体要求" },
          { type: "p", text: "正文" },
          { type: "h1", text: "二、主要任务" },
          { type: "h2", text: "（一）提升服务" },
          { type: "p", text: "正文" },
          { type: "h2", text: "1．强化保障" },
          { type: "p", text: "正文" },
        ],
      })
    )
    expect(markdown).toContain("## 总体要求")
    expect(markdown).toContain("## 主要任务")
    expect(markdown).toContain("### 提升服务")
    expect(markdown).toContain("### 强化保障")
    // 不应残留 LLM 手写的序号
    expect(markdown).not.toContain("## 一、")
    expect(markdown).not.toContain("### （一）")
    expect(markdown).not.toContain("### 1．")
  })

  it("标题以纯中文词开头（如“一体化”）不被误剥序号", () => {
    const markdown = toMarkdown(
      buildDoc({ body: [{ type: "h1", text: "一体化推进" }] })
    )
    expect(markdown).toContain("## 一体化推进")
  })

  it("落款/日期文本里的盖章占位被剥离（应走 seal:true 由系统生成）", () => {
    const markdown = toMarkdown(
      buildDoc({
        issuer: "国务院（此处加盖公章）",
        date: "2026年7月31日（此处加盖公章）",
      })
    )
    expect(markdown).toContain("国务院")
    expect(markdown).toContain("2026年7月31日")
    // 占位被剥离后，seal 未显式置 true → 不再额外补盖章行
    expect(markdown).not.toContain("（此处加盖公章）")
  })

  it("会议纪要渲染出席/请假/列席名单（正文后、版记前，左空二字）", () => {
    const markdown = toMarkdown(
      buildDoc({
        docType: "minutes",
        attendees: ["张三（市委办公厅）", "李四（市政府办）"],
        absentees: ["王五（市教育局）"],
        observers: ["赵六（列席）"],
      })
    )
    expect(markdown).toContain("出席：张三（市委办公厅）、李四（市政府办）")
    expect(markdown).toContain("请假：王五（市教育局）")
    expect(markdown).toContain("列席：赵六（列席）")
    // 名单在正文段落之后
    const bodyIndex = markdown.indexOf("各地区各部门要加强组织领导")
    const attendeeIndex = markdown.indexOf("出席：")
    expect(attendeeIndex).toBeGreaterThan(bodyIndex)
    // 名单使用正文缩进容器（左空二字 = indent:2em）
    expect(markdown).toContain(
      "::: content.body.paragraph.indent: 2em\n出席：张三（市委办公厅）、李四（市政府办）\n:::"
    )
  })

  it("非纪要文种不渲染出席名单", () => {
    const markdown = toMarkdown(
      buildDoc({
        docType: "gongwen",
        attendees: ["张三（市委办公厅）"],
      })
    )
    expect(markdown).not.toContain("出席：")
  })

  it("纪要不含任何名单时（attendees 为空/缺省）不输出空壳段落", () => {
    const markdown = toMarkdown(buildDoc({ docType: "minutes" }))
    expect(markdown).not.toContain("出席：")
    expect(markdown).not.toContain("请假：")
    expect(markdown).not.toContain("列席：")
  })
})
