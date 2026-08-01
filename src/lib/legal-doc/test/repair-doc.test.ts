import { describe, expect, it } from "vitest"
import { repairDoc } from "../review/repair-doc"
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
        text: "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设。",
      },
    ],
    ...overrides,
  }
}

describe("repairDoc · 保守修复带", () => {
  it("recipient 末尾缺全角冒号时补上，并返回 REPAIR_RECIPIENT_COLON", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({ recipient: "各区人民政府" })
    )
    expect(doc.recipient).toBe("各区人民政府：")
    expect(repairs).toEqual([
      expect.objectContaining({ code: "REPAIR_RECIPIENT_COLON" }),
    ])
  })

  it("recipient 已带全角冒号时不重复补", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({ recipient: "各区人民政府：" })
    )
    expect(doc.recipient).toBe("各区人民政府：")
    expect(repairs).toHaveLength(0)
  })

  it("通告/公告（无主送机关）不补冒号", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({ docType: "announcement", recipient: undefined })
    )
    expect(doc.recipient).toBeUndefined()
    expect(repairs).toHaveLength(0)
  })

  it("正文“附件：…”段落提取为 attachments 并从正文移除", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({
        body: [
          { type: "p", text: "现将有关事项通知如下。" },
          { type: "p", text: "附件：年度重点任务清单" },
        ],
      })
    )
    expect(doc.attachments).toEqual(["年度重点任务清单"])
    expect(doc.body).toHaveLength(1)
    expect(doc.body[0].text).toBe("现将有关事项通知如下。")
    expect(repairs).toEqual([
      expect.objectContaining({ code: "REPAIR_EXTRACT_ATTACHMENT" }),
    ])
  })

  it("attachments 已有条目时不提取正文“附件：…”段", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({
        attachments: ["年度重点任务清单"],
        body: [{ type: "p", text: "附件：年度重点任务清单" }],
      })
    )
    expect(doc.attachments).toEqual(["年度重点任务清单"])
    expect(doc.body).toHaveLength(1)
    expect(repairs).toHaveLength(0)
  })

  it("正文 p 段首“一、”序号残留被剥离（不改层级）", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({
        body: [
          { type: "p", text: "一、加强组织领导，压实工作责任。" },
          { type: "p", text: "二、强化督促检查。" },
        ],
      })
    )
    expect(doc.body.map((p) => p.text)).toEqual([
      "加强组织领导，压实工作责任。",
      "强化督促检查。",
    ])
    expect(repairs).toEqual([
      expect.objectContaining({ code: "REPAIR_STRIP_PARAGRAPH_ORDER" }),
    ])
  })

  it("“一体化推进”这类纯中文词开头的段落不被误剥序号", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({ body: [{ type: "p", text: "一体化推进政务服务改革。" }] })
    )
    expect(doc.body[0].text).toBe("一体化推进政务服务改革。")
    expect(repairs).toHaveLength(0)
  })

  it("h1/h2 标题段不参与序号剥离（只处理 p）", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({
        body: [{ type: "h1", text: "一、总体要求" }],
      })
    )
    expect(doc.body[0].text).toBe("一、总体要求")
    expect(repairs).toHaveLength(0)
  })

  it("docNumber 年份括号 [2026]/(2026) 统一为六角括号", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({ docNumber: "国发[2026]12号" })
    )
    expect(doc.docNumber).toBe("国发〔2026〕12号")
    expect(repairs).toEqual([
      expect.objectContaining({ code: "REPAIR_DOC_NUMBER_YEAR_BRACKET" }),
    ])
  })

  it("docNumber 已是六角括号时不改", () => {
    const { doc, repairs } = repairDoc(
      buildDoc({ docNumber: "国发〔2026〕12号" })
    )
    expect(doc.docNumber).toBe("国发〔2026〕12号")
    expect(repairs).toHaveLength(0)
  })

  it("无任何命中时返回原 doc（repairs 为空）", () => {
    const input = buildDoc()
    const { doc, repairs } = repairDoc(input)
    expect(doc).toEqual(input)
    expect(repairs).toHaveLength(0)
  })
})
