/**
 * 真实生成红头验收：用真实 DeepSeek API 生成多份公文，
 * 走完整管线（LLM → parse → repairDoc → toMarkdown → GB/T 9704 渲染 → HTML），
 * 落盘 markdown + HTML 供人工/文秘 agent 检查红头渲染。
 *
 * 用法：API key 用环境变量 DEEPSEEK_API_KEY 传入（不落盘、不进 git）。
 * `DEEPSEEK_API_KEY=sk-xxx bun run scripts/gen-real-docs.ts`
 */
import { generateDocument } from "../src/lib/llm"
import { parseLegalDoc, toMarkdown, buildSystemPrompt, buildUserPrompt } from "../src/lib/legal-doc"
import { repairDoc } from "../src/lib/legal-doc/review/repair-doc"
import { getBuiltinRules, MarkdownParser } from "../src/engine"
import { writeFileSync, mkdirSync } from "node:fs"

const OUT_DIR = ".claude/tmp/wenshu-real"

const PROMPTS = [
  "重庆市人民政府\n写一份关于印发《重庆市数字经济发展行动计划（2026—2028年）》的通知，主送各区县（自治县）人民政府、市政府各部门，要求明确总体目标、重点任务、保障措施，落款重庆市人民政府，2026年7月31日印发。",
  "国家统计局\n写一份关于开展2026年统计执法检查的通知，主送各省、自治区、直辖市统计局，写明检查范围、检查内容、时间安排，落款国家统计局，2026年7月28日。",
  "××市市场监督管理局\n写一份关于规范校外培训机构收费管理的意见，主送各区市场监管局，提出规范收费、明码标价、专项整治等措施，落款××市市场监督管理局，2026年8月1日。",
]

function render(markdown: string): string {
  const rule = getBuiltinRules().find((r) => r.name.includes("9704")) ?? getBuiltinRules()[0]!
  const parser = new MarkdownParser(undefined, {
    ...rule.parser,
    headingStyles: {
      h1: rule.content.h1.style.index ?? "0lines",
      h2: rule.content.h2.style.index ?? "0lines",
      h3: rule.content.h3.style.index ?? "0lines",
      h4: rule.content.h4.style.index ?? "0lines",
    },
  })
  return parser.parse(markdown).html
}

function extractRedHeadCss(html: string): string | null {
  const match = html.match(
    /--content-body-paragraph-align: center[^>]*--content-body-style-colors-text: (#[0-9a-fA-F]+)[^>]*--content-body-style-size: (\d+pt)/,
  )
  return match ? `color=${match[1]} size=${match[2]}` : null
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error("缺少 DEEPSEEK_API_KEY 环境变量")
    process.exit(1)
  }
  mkdirSync(OUT_DIR, { recursive: true })

  const systemPrompt = buildSystemPrompt()

  for (let i = 0; i < PROMPTS.length; i++) {
    const userPrompt = buildUserPrompt(PROMPTS[i])
    const prompt = `${systemPrompt}\n\n${userPrompt}`

    process.stdout.write(`[${i + 1}/${PROMPTS.length}] 生成中: ${PROMPTS[i].split("\n")[0]} ... `)
    const raw = await generateDocument({
      prompt,
      apiKey,
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
    })

    let doc
    try {
      doc = parseLegalDoc(raw)
    } catch (err) {
      process.stdout.write(`解析失败: ${(err as Error).message}\n`)
      writeFileSync(`${OUT_DIR}/${i + 1}-raw.json`, raw)
      continue
    }
    writeFileSync(`${OUT_DIR}/${i + 1}-raw.json`, raw)

    // 修复前（raw 直接渲染，无 repairDoc）——复现"一言难尽"
    const rawMarkdown = toMarkdown(doc)
    writeFileSync(`${OUT_DIR}/${i + 1}-raw.md`, rawMarkdown)
    writeFileSync(`${OUT_DIR}/${i + 1}-raw.html`, render(rawMarkdown))

    // 修复后（repairDoc 推导红头 + 提取抄送）
    const { doc: repaired, repairs } = repairDoc(doc)
    const repairedMarkdown = toMarkdown(repaired)
    writeFileSync(`${OUT_DIR}/${i + 1}-repaired.md`, repairedMarkdown)
    writeFileSync(`${OUT_DIR}/${i + 1}-repaired.html`, render(repairedMarkdown))

    const redHeadInfo = extractRedHeadCss(render(repairedMarkdown))
    process.stdout.write(
      `issuingOrg=${repaired.issuingOrg ?? "缺失"} repairs=${repairs.length} 红头样式=${redHeadInfo ?? "未检出"}\n`,
    )
  }

  console.log(`\n产物在 ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
