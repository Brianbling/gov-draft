import { describe, expect, it } from "vitest"
import { normalizeText } from "../review/normalize-text"
import { normalizeDoc } from "../review/normalize-doc"
import type { LegalDoc } from "../types"

describe("normalizeText · 引号成对转换", () => {
  it("半角双引号奇数次开、偶数次闭，转换为中文引号", () => {
    expect(normalizeText('他说"今天开会"并强调"务必准时"')).toBe(
      "他说“今天开会”并强调“务必准时”"
    )
  })

  it("半角单引号成对转换为中文单引号", () => {
    expect(normalizeText("会议明确'三个重点'工作")).toBe(
      "会议明确‘三个重点’工作"
    )
  })

  it("已含中文引号时不重复转换，后续半角引号与之配对", () => {
    expect(normalizeText('“总体要求"已经明确')).toBe("“总体要求”已经明确")
  })

  it("英文语境（两侧为字母数字）的半角引号保留", () => {
    expect(normalizeText('the "quick" fox')).toBe('the "quick" fox')
    expect(normalizeText("It's fine")).toBe("It's fine")
  })

  it("中英混合：英文单词内引号保留，中文语境的转换", () => {
    expect(normalizeText('强调"open"精神')).toBe("强调“open”精神")
  })

  it("引号内容为英文但外侧是中文时转全角（中文语境优先）", () => {
    expect(normalizeText('会议提出"AI 赋能"要求')).toBe("会议提出“AI 赋能”要求")
  })

  it("英文缩略撇号（如 It's）不误转", () => {
    expect(normalizeText("It's a plan")).toBe("It's a plan")
  })

  it("结尾悬挂的开引号按单元决策（英文保留、中文转全角）", () => {
    expect(normalizeText('中文引号"未闭合')).toBe("中文引号“未闭合")
    expect(normalizeText("test 'abc'")).toBe("test 'abc'")
  })
})

describe("normalizeText · 括号/逗号/冒号/句号", () => {
  it("半角圆括号内含中文时整对转全角", () => {
    expect(normalizeText("(一)统筹推进")).toBe("（一）统筹推进")
    expect(normalizeText("(2019年)")).toBe("（2019年）")
    expect(normalizeText("请注意(安全)事项")).toBe("请注意（安全）事项")
  })

  it("英文括号内容不误转", () => {
    expect(normalizeText("see (the docs) here")).toBe("see (the docs) here")
    expect(normalizeText("url(a.com)")).toBe("url(a.com)")
  })

  it("半角逗号在中文语境转全角，英文保留", () => {
    expect(normalizeText("研究,部署,落实")).toBe("研究，部署，落实")
    expect(normalizeText("red, green, blue")).toBe("red, green, blue")
  })

  it("半角冒号在中文语境转全角，时间/网址保留", () => {
    expect(normalizeText("会议议程如下:第一项")).toBe("会议议程如下：第一项")
    expect(normalizeText("9:30 开始")).toBe("9:30 开始")
    expect(normalizeText("https://example.com")).toBe("https://example.com")
  })

  it("半角句号在中文语境转全角，小数/版本号/网址不误伤", () => {
    expect(normalizeText("会议圆满结束.")).toBe("会议圆满结束。")
    expect(normalizeText("推进2.0版建设")).toBe("推进2.0版建设")
    expect(normalizeText("v2.3.4 已发布")).toBe("v2.3.4 已发布")
    expect(normalizeText("比例达12.5%")).toBe("比例达12.5%")
    expect(normalizeText("www.example.com")).toBe("www.example.com")
    expect(normalizeText("数据.分析")).toBe("数据。分析")
  })
})

describe("normalizeText · 重复标点压缩", () => {
  it("压缩连续重复的全角标点", () => {
    expect(normalizeText("立即执行。。")).toBe("立即执行。")
    expect(normalizeText("务必、务必、、落实")).toBe("务必、务必、落实")
    expect(normalizeText("真的吗？？")).toBe("真的吗？")
  })
})

describe("normalizeText · 混合场景", () => {
  it("标题/正文常见半角污染一次归一", () => {
    const input = '关于"数字政府"建设的通知:第一,加强领导.第二,落实责任.'
    expect(normalizeText(input)).toBe(
      "关于“数字政府”建设的通知：第一，加强领导。第二，落实责任。"
    )
  })

  it("中文引号内嵌英文不破坏引号配对", () => {
    expect(normalizeText("“Click OK”即可")).toBe("“Click OK”即可")
  })

  it("空串/纯英文原样返回", () => {
    expect(normalizeText("")).toBe("")
    expect(normalizeText("Hello, world. https://a.com")).toBe(
      "Hello, world. https://a.com"
    )
  })
})

describe("normalizeText · 计量单位规范化（GB/T 3100）", () => {
  it("口语化单位“平米/公分”转换为正式名称“平方米/厘米”", () => {
    expect(normalizeText("项目占地 120 平米。")).toBe("项目占地 120 平方米。")
    expect(normalizeText("路基宽度 8 公分。")).toBe("路基宽度 8 厘米。")
    expect(normalizeText("建筑面积约 1500 平米，管道直径 3 公分。")).toBe(
      "建筑面积约 1500 平方米，管道直径 3 厘米。"
    )
  })

  it("规范单位（公里/公斤/厘米）不受影响", () => {
    expect(normalizeText("全长 15 公里")).toBe("全长 15 公里")
    expect(normalizeText("载重 2 公斤")).toBe("载重 2 公斤")
    expect(normalizeText("长 5 厘米")).toBe("长 5 厘米")
  })

  it("平方米/米等标准写法原样保留", () => {
    expect(normalizeText("占地 100 平方米")).toBe("占地 100 平方米")
    expect(normalizeText("距离 10 米")).toBe("距离 10 米")
  })
})

describe("normalizeDoc · 覆盖所有文本字段", () => {
  const doc: LegalDoc = {
    docType: "minutes",
    title: '关于"安全生产"工作会议的纪要',
    recipient: "各有关单位:",
    body: [
      { type: "p", text: "会议指出,要落实责任." },
      { type: "h1", text: "重点工作" },
    ],
    attachments: ["任务清单."],
    issuer: "市安委会",
    date: "2026-07-31",
    cc: ["市委办,"],
    attendees: ["张三(市委办)", "李四(市政府)"],
  }

  it("返回新对象，原对象不被修改", () => {
    const normalized = normalizeDoc(doc)
    expect(normalized).not.toBe(doc)
    expect(doc.title).toBe('关于"安全生产"工作会议的纪要')
    expect(doc.body[0].text).toBe("会议指出,要落实责任.")
  })

  it("title/段落/附件/cc/名单全部规范化", () => {
    const normalized = normalizeDoc(doc)
    expect(normalized.title).toBe("关于“安全生产”工作会议的纪要")
    expect(normalized.body[0].text).toBe("会议指出，要落实责任。")
    expect(normalized.attachments?.[0]).toBe("任务清单。")
    expect(normalized.cc?.[0]).toBe("市委办，")
    expect(normalized.attendees).toEqual(["张三（市委办）", "李四（市政府）"])
    expect(normalized.recipient).toBe("各有关单位：")
  })

  it("日期字段不被标点规则破坏", () => {
    const normalized = normalizeDoc(doc)
    expect(normalized.date).toBe("2026-07-31")
  })
})
