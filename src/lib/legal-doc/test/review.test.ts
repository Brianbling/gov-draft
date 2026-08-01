import { describe, expect, it } from "vitest"
import {
  reviewDocument,
  parseLegalDoc,
  normalizeDoc,
  toMarkdown,
} from "../index"
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

describe("reviewDocument · L1+L2 合并", () => {
  it("正常公文无问题", () => {
    expect(reviewDocument(buildDoc())).toEqual([])
  })

  it("L1 与 L2 问题按 L1 在前、L2 在后的顺序合并", () => {
    const issues = reviewDocument(
      buildDoc({
        docType: "request",
        recipient: undefined,
        title:
          "关于进一步加强和完善新时代基层数字政府建设工作若干重大事项的通知",
        body: [{ type: "p", text: "现申请采购设备。" }],
      })
    )
    const codes = issues.map((i) => i.code)
    // L1：TITLE_TOO_LONG；L2：REQUEST_RECIPIENT_MISSING + REQUEST_CLOSING_MISSING
    expect(codes).toEqual([
      "TITLE_TOO_LONG",
      "REQUEST_RECIPIENT_MISSING",
      "REQUEST_CLOSING_MISSING",
    ])
  })

  it("会议纪要缺 attendees 时给出 MINUTES_ATTENDEES_MISSING", () => {
    const issues = reviewDocument(buildDoc({ docType: "minutes" }))
    expect(issues.map((i) => i.code)).toContain("MINUTES_ATTENDEES_MISSING")
  })
})

describe("schema 扩展 · 纪要名单字段", () => {
  it("parseLegalDoc 解析 attendees/absentees/observers 字段", () => {
    const doc = parseLegalDoc(
      JSON.stringify({
        docType: "minutes",
        title: "安全生产工作会议纪要",
        body: [{ type: "p", text: "会议议定如下。" }],
        attendees: ["张三（市委办）"],
        absentees: ["李四（教育局）"],
        observers: ["王五"],
      })
    )
    expect(doc.attendees).toEqual(["张三（市委办）"])
    expect(doc.absentees).toEqual(["李四（教育局）"])
    expect(doc.observers).toEqual(["王五"])
  })

  it("非纪要文种不填名单字段也不报错", () => {
    const doc = parseLegalDoc(
      JSON.stringify({
        docType: "gongwen",
        title: "关于 XX 的通知",
        body: [{ type: "p", text: "正文。" }],
      })
    )
    expect(doc.attendees).toBeUndefined()
  })

  it("名单字段为空数组时解析为 []（缺省合法）", () => {
    const doc = parseLegalDoc(
      JSON.stringify({
        docType: "minutes",
        title: "安全生产工作会议纪要",
        body: [{ type: "p", text: "会议议定如下。" }],
        attendees: [],
      })
    )
    expect(doc.attendees).toEqual([])
  })
})

describe("端到端 · normalize → toMarkdown 渲染规范化内容", () => {
  it("半角标点经 normalizeDoc 后渲染为全角", () => {
    const raw = parseLegalDoc(
      JSON.stringify({
        docType: "gongwen",
        title: '关于"安全生产"工作的通知',
        body: [{ type: "p", text: "会议指出,要落实责任." }],
      })
    )
    const normalized = normalizeDoc(raw)
    const markdown = toMarkdown(normalized)
    expect(markdown).toContain("# 关于“安全生产”工作的通知")
    expect(markdown).toContain("会议指出，要落实责任。")
    expect(markdown).not.toContain("会议指出,")
  })

  it("纪律名单也经 normalizeDoc 规范化", () => {
    const raw = parseLegalDoc(
      JSON.stringify({
        docType: "minutes",
        title: "安全生产工作会议纪要",
        body: [{ type: "p", text: "会议议定如下。" }],
        attendees: ["张三(市委办)"],
      })
    )
    const markdown = toMarkdown(normalizeDoc(raw))
    expect(markdown).toContain("出席：张三（市委办）")
  })
})
