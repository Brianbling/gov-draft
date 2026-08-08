/**
 * 红头生成稳定性批量采样：多种文种 × 多提示词，各生成一次。
 * 与真实 UI 一致：buildUserPrompt 首行解析 docType → 注入该文种专属
 * promptRequirement + 示例输出。统计红头/文号/标题机关名三个维度的失败率。
 * 用真实 API，目的是暴露"一言难尽"的真实问题分布。
 *
 * DEEPSEEK_API_KEY=sk-xxx bun run scripts/sample-red-head.ts
 */
import { generateDocument } from "../src/lib/llm"
import {
  parseLegalDoc,
  toMarkdown,
  buildSystemPrompt,
  buildUserPrompt,
  checkFormat,
} from "../src/lib/legal-doc"
import { repairDoc } from "../src/lib/legal-doc/review/repair-doc"
import { writeFileSync, mkdirSync } from "node:fs"
import type { DocType } from "../src/lib/legal-doc"

const OUT_DIR = ".claude/tmp/wenshu-sample"
const SYSTEM_PROMPT = buildSystemPrompt()

interface SampleCase {
  name: string
  docType: DocType
  prompt: string
}

// 覆盖 11 文种 × 各 1-3 次，共 16 次调用。首行 docType → 与真实 UI 一致走文种专属指令。
const CASES: SampleCase[] = [
  { name: "gongwen-1", docType: "gongwen", prompt: "重庆市人民政府\n写一份关于印发《重庆市数字经济发展行动计划》的通知，主送各区县（自治县）人民政府、市政府各部门，落款重庆市人民政府。" },
  { name: "gongwen-2", docType: "gongwen", prompt: "国家统计局\n写一份关于开展2026年统计执法检查的通知，主送各省、自治区、直辖市统计局。" },
  { name: "gongwen-3", docType: "gongwen", prompt: "××市人民政府办公厅\n写一份关于加强城市防洪排涝工作的通知，主送各区人民政府，市政府各部门。" },
  { name: "decision-1", docType: "decision", prompt: "××省人民政府\n写一份关于表彰全省劳动模范的决定，主送各市人民政府、省政府各部门。" },
  { name: "decision-2", docType: "decision", prompt: "××市住建局\n写一份关于公布2026年度建设工程质量检测机构名单的决定。" },
  { name: "report-1", docType: "report", prompt: "市发展改革委\n写一份关于上半年经济运行情况的报告，主送市人民政府。" },
  { name: "report-2", docType: "report", prompt: "××市财政局\n写一份关于2026年上半年预算执行情况的报告，主送市人民政府。" },
  { name: "opinion-1", docType: "opinion", prompt: "××市市场监督管理局\n写一份关于规范校外培训机构收费管理的意见，主送各区市场监管局。" },
  { name: "opinion-2", docType: "opinion", prompt: "××省卫生健康委\n写一份关于加强基层医疗卫生服务体系建设的意见，主送各市卫生健康局。" },
  { name: "reply-1", docType: "reply", prompt: "省人民政府\n写一份关于同意××市调整部分行政区划的批复，主送××市人民政府。" },
  { name: "reply-2", docType: "reply", prompt: "××市住建局\n写一份关于同意××公司开展物业管理服务的批复，主送××公司。" },
  { name: "request-1", docType: "request", prompt: "××市司法局\n写一份关于请求增加行政执法编制的请示，主送省司法厅。" },
  { name: "communique-1", docType: "communique", prompt: "××市人民政府办公厅\n写一份关于表扬全市政务服务工作先进单位的通报，主送各区人民政府、市政府各部门，落款××市人民政府办公厅。" },
  { name: "order-1", docType: "order", prompt: "××市人民政府\n写一份公布《××市城镇燃气管理条例》的政府令，市长签发。" },
  { name: "proposal-1", docType: "proposal", prompt: "××市人民政府\n写一份提请市人大常委会审议《××市数据条例（草案）》的议案。" },
  { name: "resolution-1", docType: "resolution", prompt: "××市人民代表大会\n写一份关于批准市人民政府工作报告的决议。" },
]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const rows: string[] = []
  let redHeadMissing = 0
  let docNumberMissing = 0
  let titleHasOrg = 0
  // 仅文件式红头文种（通知/通报）要求红头+文号成对；意见/批复/请示/报告/函等
  // 无文件式红头，红头缺失属正常，不算失败。
  const fileRedHead = new Set<DocType>(["gongwen", "communique"])

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i]
    process.stdout.write(`[${i + 1}/${CASES.length}] ${c.name} ... `)
    // 与真实 UI 一致：首行 docType，buildUserPrompt 解析出文种专属指令 + 示例
    const userPrompt = buildUserPrompt(`${c.docType}\n${c.prompt}`)
    const raw = await generateDocument({
      prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
    }).catch(() => null)
    if (!raw) {
      process.stdout.write(`调用失败\n`)
      continue
    }
    let doc
    try {
      doc = parseLegalDoc(raw)
    } catch {
      rows.push(`${c.name}\tJSON解析失败`)
      process.stdout.write(`解析失败\n`)
      writeFileSync(`${OUT_DIR}/${c.name}.json`, raw)
      continue
    }

    const hasRedHead = Boolean(doc.issuingOrg && doc.issuingOrg.trim())
    const hasDocNumber = Boolean(doc.docNumber)
    const expectsRedHead = fileRedHead.has(c.docType)
    const title = doc.title.trim()
    const orgInTitle =
      hasRedHead && title.includes(doc.issuingOrg!.replace(/文件$/, ""))
    const { doc: repaired } = repairDoc(doc)
    const issues = checkFormat(repaired)
    const issueCodes = issues.map((x) => x.code).join(",")

    // 红头/文号成对检查只对文件式红头文种计数；其余文种红头缺失不算缺陷。
    const redHeadOk = !expectsRedHead || hasRedHead
    const docNumberOk = !expectsRedHead || hasDocNumber
    if (!redHeadOk) redHeadMissing++
    if (!docNumberOk) docNumberMissing++
    if (orgInTitle) titleHasOrg++

    const flags = [
      redHeadOk ? (expectsRedHead ? "红头✓" : "红头(无)") : "红头✗",
      docNumberOk ? (expectsRedHead ? "文号✓" : "文号(无)") : "文号✗",
      orgInTitle ? "标题含机关名✗" : "",
      issueCodes ? `issues:${issueCodes}` : "",
    ]
      .filter(Boolean)
      .join(" ")
    process.stdout.write(`${doc.docType} ${flags}\n`)
    rows.push(
      `${c.name}\t${doc.docType}\t${hasRedHead ? "有" : "无"}\t${hasDocNumber ? "有" : "无"}\t${orgInTitle ? "是" : "否"}\t${issueCodes}`
    )
    writeFileSync(`${OUT_DIR}/${c.name}.md`, toMarkdown(doc))
  }

  const n = CASES.length
  console.log(`\n===== 汇总 (${n} 次调用) =====`)
  console.log(`红头缺失(仅计文件式红头文种): ${redHeadMissing}/${n}`)
  console.log(`文号缺失(仅计文件式红头文种): ${docNumberMissing}/${n}`)
  console.log(`标题含机关名: ${titleHasOrg}/${n}`)
  console.log(`\n明细:\n${rows.join("\n")}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
