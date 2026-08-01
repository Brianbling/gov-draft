import { describe, expect, it } from "vitest"
import { buildSystemPrompt, buildUserPrompt } from "../prompt"
import { DOC_TYPE_SPECS } from "../doc-type-spec"
import { DOC_TYPES } from "../types"

describe("buildUserPrompt", () => {
  it("keeps the user description when no docType-specific requirement applies", () => {
    const prompt = buildUserPrompt("帮我写一份加强城市绿化的通知")
    expect(prompt).toContain("帮我写一份加强城市绿化的通知")
    expect(prompt).not.toContain("附加格式要求")
  })

  it("appends the request-specific format requirement when docType is request", () => {
    const prompt = buildUserPrompt("request\n我处拟购置一批办公设备")
    expect(prompt).toContain("文种为请示")
    expect(prompt).toContain("妥否，请批示")
    expect(prompt).toContain("主送机关")
  })

  it("appends the reply-specific format requirement when docType is reply", () => {
    const prompt = buildUserPrompt("reply\n同意你局关于组建综合执法队的请示")
    expect(prompt).toContain("你（单位）《××请示》收悉。现批复如下")
  })

  it("appends the minutes-specific format requirement when docType is minutes", () => {
    const prompt = buildUserPrompt("minutes\n关于召开安全生产工作会议的纪要")
    expect(prompt).toContain("会议名称、时间、地点、参加人员")
  })

  it("appends the announcement-specific format requirement when docType is announcement", () => {
    const prompt = buildUserPrompt("announcement\n关于城区限行通告")
    expect(prompt).toContain("面向社会公开发布")
    expect(prompt).toContain("无主送机关")
  })

  it("covers every DOC_TYPES enum with a format requirement", () => {
    for (const docType of DOC_TYPES) {
      const prompt = buildUserPrompt(`${docType}\n测试内容`)
      expect(prompt).toContain("附加格式要求")
    }
  })

  it("adds a seal instruction when seal option is true", () => {
    const prompt = buildUserPrompt("gongwen\n举办培训班的通知", {
      seal: true,
    })
    expect(prompt).toContain("该公文需要加盖公章")
    expect(prompt).toContain("（此处加盖公章）")
  })

  it("omits the seal instruction when seal option is false or absent", () => {
    expect(buildUserPrompt("gongwen\n举办培训班的通知")).not.toContain(
      "该公文需要加盖公章"
    )
    expect(
      buildUserPrompt("gongwen\n举办培训班的通知", { seal: false })
    ).not.toContain("该公文需要加盖公章")
  })

  it("still emits the JSON structure instruction", () => {
    const prompt = buildUserPrompt("gongwen\n测试")
    expect(prompt).toContain("请严格按照系统提示中的 JSON 结构输出")
    expect(prompt).toContain('"docType"')
  })

  it("用户描述含换行时不破坏 prompt 结构", () => {
    const prompt = buildUserPrompt("帮我写一份通知\n关于垃圾分类\n请正式一些")
    expect(prompt).toContain("帮我写一份通知\n关于垃圾分类\n请正式一些")
    expect(prompt).toContain("JSON")
  })

  it("用户描述含引号与反斜杠时仍为合法字符串", () => {
    const description = '写一份含"引号"和\\反斜杠的通知'
    const prompt = buildUserPrompt(description)
    expect(prompt).toContain(description)
    expect(prompt).toContain("JSON")
  })

  it("用户描述含 $& 特殊序列时不被字符串替换破坏（回归：String.replace 的 $ 模式）", () => {
    // 已知缺陷：buildUserPrompt 用 String.replace(search, replacement)，
    // replacement 中的 `$&` 会被替换为整个匹配串 `{userDescription}`，
    // `$1` 被替换为空串 → 用户描述被破坏、占位符残留。
    // 修复方向：用 split/join 或带 replaceAll 的 safeReplace。
    // bug agent 确认修复后去掉 it.skip。
    const description = "预算 $& 项目，经费 $1 万元"
    const prompt = buildUserPrompt(description)
    expect(prompt).not.toContain("{userDescription}")
    expect(prompt).toContain("预算 $& 项目")
    expect(prompt).toContain("经费 $1 万元")
  })
})

describe("buildSystemPrompt", () => {
  it("包含严格 JSON 输出约束", () => {
    const system = buildSystemPrompt()
    expect(system).toContain("JSON")
    expect(system).toContain("严格")
  })

  it("包含字段说明", () => {
    const system = buildSystemPrompt()
    expect(system).toContain("docType")
    expect(system).toContain("title")
    expect(system).toContain("body")
  })

  it("包含 GB/T 9704 规范引用", () => {
    const system = buildSystemPrompt()
    expect(system).toContain("GB/T 9704-2012")
  })
})

describe("buildUserPrompt · 中文文种名 + 分文种 few-shot", () => {
  it("解析出文种时，示例行携带该文种的中文名", () => {
    const prompt = buildUserPrompt("request\n我处拟购置一批办公设备")
    expect(prompt).toContain("关于解决基层办公设备不足问题的请示（请示）")
  })

  it("未解析出文种（自然语言描述）时默认用通知示例", () => {
    const prompt = buildUserPrompt("帮我写一份加强城市绿化的通知")
    expect(prompt).toContain("关于加强数字政府建设的通知（通知）")
  })

  it("request 文种给出请示专属示例，且示例中出现的文种名取自 DOC_TYPE_SPECS", () => {
    const prompt = buildUserPrompt("request\n我处拟购置一批办公设备")
    expect(prompt).toContain("关于解决基层办公设备不足问题的请示")
    expect(prompt).toContain(DOC_TYPE_SPECS.request.name)
    expect(prompt).toContain("妥否，请批示")
  })

  it("minutes 文种给出纪要专属示例（含 attendees/absentees/observers）", () => {
    const prompt = buildUserPrompt("minutes\n关于召开安全生产工作会议的纪要")
    expect(prompt).toContain("全市安全生产工作会议纪要")
    expect(prompt).toContain("attendees")
    expect(prompt).toContain("absentees")
    expect(prompt).toContain("observers")
  })

  it("announcement 文种示例符合自身规则：recipient 留空、通告式标题与正文", () => {
    const prompt = buildUserPrompt("announcement\n关于城区限行通告")
    const example = JSON.parse(
      prompt.split("示例输出")[1]!.match(/\{[\s\S]*\}/)?.[0] ?? "{}"
    )
    // 不得克隆通知示例：无主送机关，标题为通告式，而非“关于加强数字政府建设的通知”
    expect(prompt).not.toContain("关于加强数字政府建设的通知")
    expect(example.recipient).toBeUndefined()
    expect(example.title).toBe("关于加强城区机动车限行管理的通告")
    expect(example.body.some((p: { text: string }) => p.text.includes("通告如下"))).toBe(true)
  })

  it("reply 文种示例符合自身规则：单一主送 + “收悉。现批复如下”开头 + 批复意见", () => {
    const prompt = buildUserPrompt("reply\n同意你局关于组建综合执法队的请示")
    const example = JSON.parse(
      prompt.split("示例输出")[1]!.match(/\{[\s\S]*\}/)?.[0] ?? "{}"
    )
    // 不得克隆通知示例
    expect(prompt).not.toContain("关于加强数字政府建设的通知")
    expect(example.recipient).toBe("××公司：")
    expect(
      example.body.some((p: { text: string }) =>
        p.text.includes("《关于申请开展××业务的请示》收悉")
      )
    ).toBe(true)
    expect(
      example.body.some((p: { text: string }) => p.text.startsWith("同意"))
    ).toBe(true)
  })

  it("decision/opinion/report/letter 文种示例不再克隆通知，各具文种特征", () => {
    const decisionPrompt = buildUserPrompt("decision\n处理决定")
    expect(decisionPrompt).not.toContain("关于加强数字政府建设的通知")
    const decision = JSON.parse(
      decisionPrompt.split("示例输出")[1]!.match(/\{[\s\S]*\}/)?.[0] ?? "{}"
    )
    expect(decision.body.some((p: { type: string }) => p.type === "h1")).toBe(true)

    const opinionPrompt = buildUserPrompt("opinion\n加强基层治理意见")
    const opinion = JSON.parse(
      opinionPrompt.split("示例输出")[1]!.match(/\{[\s\S]*\}/)?.[0] ?? "{}"
    )
    expect(opinion.body.some((p: { text: string }) => p.text.startsWith("要"))).toBe(true)

    const reportPrompt = buildUserPrompt("report\n经济运行报告")
    const report = JSON.parse(
      reportPrompt.split("示例输出")[1]!.match(/\{[\s\S]*\}/)?.[0] ?? "{}"
    )
    expect(report.title).toContain("报告")
    expect(report.body.some((p: { text: string }) => p.text.includes("报告如下"))).toBe(true)

    const letterPrompt = buildUserPrompt("letter\n商洽合作函")
    const letter = JSON.parse(
      letterPrompt.split("示例输出")[1]!.match(/\{[\s\S]*\}/)?.[0] ?? "{}"
    )
    expect(letter.title).toContain("函")
    expect(letter.body.some((p: { text: string }) => p.text.includes("商请"))).toBe(true)
  })

  it("landmine：示例输出 JSON 的键/值引号必须是 ASCII 双引号，不得出现全角引号", () => {
    for (const docType of DOC_TYPES) {
      const prompt = buildUserPrompt(`${docType}\n测试内容`)
      // 示例 JSON 段的键引号必须是 ASCII "；全角 “/” 出现在键/值外侧即破坏 JSON.parse
      const exampleSection = prompt.split("示例输出")[1] ?? ""
      expect(exampleSection).not.toContain("“docType”")
      expect(exampleSection).toContain('"docType"')
      // 示例 JSON 段整体可被 JSON.parse 解析（不含全角引号混入）
      const jsonBlock = exampleSection.match(/\{[\s\S]*\}/)?.[0]
      expect(jsonBlock).toBeTruthy()
      if (jsonBlock) expect(() => JSON.parse(jsonBlock)).not.toThrow()
    }
  })
})
