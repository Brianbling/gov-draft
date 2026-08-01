import { describe, expect, it, vi } from "vitest"
import { MarkdownParser, getBuiltinRules } from "@/engine"
import { parseLegalDoc, toMarkdown, checkFormat, buildUserPrompt, type LegalDoc } from "../index"
import { generateDocument } from "@/lib/llm"

// 真实的 LLM 输出样例：一段合法 LegalDoc JSON 字符串，
// 覆盖标题/发文字号/主送/正文(含 h1/h2)/附件/落款/版记全字段。
const SAMPLE_LLM_OUTPUT = JSON.stringify({
  docType: "gongwen",
  title: "市政府关于推进城市数字化转型的实施意见",
  docNumber: "X府发〔2026〕27号",
  securityLevel: "秘密",
  urgency: "加急",
  recipient: "各区人民政府，市政府各委、办、局：",
  body: [
    {
      type: "p",
      text: "为深入贯彻党中央、国务院关于网络强国、数字中国的战略部署，加快推进城市数字化转型，经市政府同意，现提出如下实施意见。",
    },
    {
      type: "h1",
      text: "总体要求",
    },
    {
      type: "p",
      text: "以推动高质量发展为主题，统筹发展和安全，坚持整体性转变、全方位赋能，打造具有国际影响力的数字之都。",
    },
    {
      type: "h2",
      text: "夯实数字底座",
    },
    {
      type: "p",
      text: "加快构建城市数字基座，完善感知、网络、算力、安全一体化布局。",
    },
  ],
  attachments: ["城市数字化转型重点任务清单"],
  issuer: "市人民政府",
  date: "2026-07-31",
  cc: ["市委办公厅"],
  printingOffice: "市人民政府办公厅",
  printingDate: "2026-08-01",
})

function withFencedJson(doc: LegalDoc): string {
  return "```json\n" + JSON.stringify(doc, null, 2) + "\n```"
}

function buildParser(): MarkdownParser {
  // 生产路径同 use-markdown.ts：取 GB/T 9704 规则的 parser 配置 + headingStyles
  const rule = getBuiltinRules().find((r) => r.name.includes("9704")) ?? getBuiltinRules()[0]!
  return new MarkdownParser(undefined, {
    ...rule.parser,
    headingStyles: {
      h1: rule.content.h1.style.index ?? "0lines",
      h2: rule.content.h2.style.index ?? "0lines",
      h3: rule.content.h3.style.index ?? "0lines",
      h4: rule.content.h4.style.index ?? "0lines",
    },
  })
}

/**
 * 端到端集成：mock generateDocument（不真实调 API），
 * 走 解析 → 转 Markdown → GB/T 9704 渲染 → 格式自检 全链路。
 */
describe("AI 生成公文 · 自然语言到渲染全链路集成", () => {
  it("mock LLM 返回 → parseLegalDoc → toMarkdown → checkFormat 全链路无严重问题", () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("integration test must not reach the network")
    )
    try {
      expect(typeof generateDocument).toBe("function")

      const parsed = parseLegalDoc(SAMPLE_LLM_OUTPUT)
      expect(parsed.title).toBe("市政府关于推进城市数字化转型的实施意见")

      const markdown = toMarkdown(parsed)
      expect(markdown).toContain("# 市政府关于推进城市数字化转型的实施意见")
      expect(markdown).toContain("## 总体要求")
      expect(markdown).toContain("### 夯实数字底座")
      expect(markdown).toContain(
        "以推动高质量发展为主题，统筹发展和安全，坚持整体性转变、全方位赋能，打造具有国际影响力的数字之都。"
      )
      expect(markdown).toContain("附件：城市数字化转型重点任务清单")
      expect(markdown).toContain("市人民政府\n2026年7月31日")
      expect(markdown).toContain("抄送：市委办公厅")

      const issues = checkFormat(parsed)
      expect(issues).toEqual([])
    } finally {
      vi.restoreAllMocks()
    }
  })

  it("代码块围栏包裹的 JSON（真实 LLM 常返回的形态）也能走通全链路", () => {
    const parsed = parseLegalDoc(withFencedJson(parseLegalDoc(SAMPLE_LLM_OUTPUT)))
    const markdown = toMarkdown(parsed)
    expect(markdown).toContain("# 市政府关于推进城市数字化转型的实施意见")
    expect(markdown).not.toContain("```")
    expect(checkFormat(parsed)).toEqual([])
  })

  it("渲染后的 HTML 含正确层级的 h1/h2/h3（对应红头/一级/二级标题）", () => {
    const parser = buildParser()
    const markdown = toMarkdown(parseLegalDoc(SAMPLE_LLM_OUTPUT))
    const html = parser.parse(markdown).html

    expect(html).toContain("<h1>市政府关于推进城市数字化转型的实施意见</h1>")
    expect(html).toContain("<h2>一、总体要求</h2>")
    expect(html).toContain("<h3>（一）夯实数字底座</h3>")
    expect(html).toContain("附件：城市数字化转型重点任务清单")
    expect(html).toContain("市人民政府")
  })

  it("生成提示词不触发网络调用", async () => {
    const spy = vi.spyOn(globalThis, "fetch")
    try {
      const prompt = buildUserPrompt("帮我写一份关于垃圾分类的通知")
      expect(typeof prompt).toBe("string")
      expect(prompt.length).toBeGreaterThan(0)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
  })
})
