/**
 * 标准合规审计：用真实 LLM API 按"专业公文用户"的用法生成 14 个文种各一份，
 * 走完整管线（LLM → parse → repairDoc → checkFormat → toMarkdown → GB/T 9704 渲染 → HTML），
 * 落盘供审计 agent 对照 GB/T 9704-2012 全本核对。
 *
 * 用法：API key 用环境变量 DEEPSEEK_API_KEY 传入（不落盘、不进 git）。
 * `DEEPSEEK_API_KEY=sk-xxx bun run scripts/gen-standards-audit.ts`
 */
import { generateDocument } from "../src/lib/llm"
import {
  parseLegalDoc,
  toMarkdown,
  buildSystemPrompt,
  buildUserPrompt,
  checkFormat,
  repairDoc,
} from "../src/lib/legal-doc"
import { getBuiltinRules, MarkdownParser } from "../src/engine"
import { writeFileSync, mkdirSync } from "node:fs"

const OUT_DIR = ".claude/tmp/standards-audit"

interface Scenario {
  label: string
  request: string
}

const SCENARIOS: Scenario[] = [
  {
    label: "01-gongwen-通知(印发类)",
    request:
      "重庆市人民政府要印发《重庆市数字经济发展行动计划（2026—2028年）》，写一份通知，主送各区县（自治县）人民政府、市政府各部门、有关单位，正文写清总体目标、重点任务、保障措施，要求各区县各部门结合实际认真贯彻落实。落款重庆市人民政府，成文日期2026年7月31日，印发机关重庆市人民政府办公厅，印发日期2026年8月1日。",
  },
  {
    label: "02-decision-决定",
    request:
      "××市人民政府拟表彰2025年度安全生产先进单位和先进个人，写一份决定。正文分条列项写评选范围、表彰名单（简写）、希望要求。落款××市人民政府，成文日期2026年7月20日，加盖公章。印发机关××市人民政府办公厅。",
  },
  {
    label: "03-order-命令",
    request:
      "××市人民政府公布一部政府规章《××市户外广告设施设置管理办法》，写一份命令（令）公布。命令用令号（××市人民政府令第25号），正文说明规章经××市人民政府第××次常务会议审议通过、现予公布、自2026年10月1日起施行。市长署名，成文日期2026年7月15日。",
  },
  {
    label: "04-gazette-公报",
    request:
      "××省统计局发布2025年××省国民经济和社会发展统计公报，写一份公报。正文分综合、农业、工业和建筑业、固定资产投资、国内贸易、对外经济、财政金融、人民生活和社会保障、教育科学技术等部分（每部分简写两三条）。无主送机关，落款××省统计局，成文日期2026年3月15日。",
  },
  {
    label: "05-communique-通报",
    request:
      "××市人民政府办公厅通报表扬在2026年防汛抗洪救灾中表现突出的单位和个人，写一份通报。正文写清表现情况、表扬决定、希望要求。落款××市人民政府办公厅，成文日期2026年7月25日，抄送市委办公厅、市人大常委会办公厅、市政协办公厅。",
  },
  {
    label: "06-opinion-意见",
    request:
      "××市市场监督管理局要出台规范校外培训机构收费管理的意见，写一份意见，主送各区市场监管局。正文从严格收费公示、规范价格行为、强化监督检查等方面提出措施要求。落款××市市场监督管理局，成文日期2026年8月1日，加盖公章。",
  },
  {
    label: "07-request-请示",
    request:
      "××市文化和旅游局拟举办2026××国际文化旅游节，需申请财政专项经费，向××市人民政府写一份请示。正文写清举办缘由、主要内容、经费预算（约500万元）、请求批准事项，结尾用妥否请批示。签发人张明（局长），落款××市文化和旅游局，成文日期2026年7月10日。",
  },
  {
    label: "08-report-报告",
    request:
      "××市卫生健康委员会向××市人民政府报告2026年上半年全市卫生健康工作情况，写一份报告。正文写上半年主要工作、存在问题、下半年工作打算。签发人李华（主任），落款××市卫生健康委员会，成文日期2026年7月28日。",
  },
  {
    label: "09-reply-批复",
    request:
      "××市人民政府对××市文化和旅游局《关于举办2026××国际文化旅游节的请示》作出批复，同意举办。正文明确原则同意、要求精心组织确保安全、所需经费按程序核拨。主送××市文化和旅游局，落款××市人民政府，成文日期2026年7月22日。",
  },
  {
    label: "10-proposal-议案",
    request:
      "××市人民政府向××市人民代表大会提请审议《××市城镇燃气管理条例（草案）》，写一份议案。正文说明立法必要性、起草过程、主要内容，提请审议。主送××市人民代表大会，落款××市人民政府，成文日期2026年6月20日。",
  },
  {
    label: "11-resolution-决议",
    request:
      "××市第×届人民代表大会第×次会议审议通过××市人民政府工作报告的决议，写一份决议。标题写明会议名称。正文表述会议听取和审议了工作报告、同意报告提出的目标任务、决定批准报告。落款××市第×届人民代表大会第×次会议，成文日期2026年1月18日。",
  },
  {
    label: "12-letter-函",
    request:
      "××市住房和城乡建设局商请××市自然资源和规划局协助提供中心城区部分地块的规划控制指标，写一份函。正文说明来函缘由、需协助事项、回复要求，结尾用盼复。落款××市住房和城乡建设局，成文日期2026年6月30日。",
  },
  {
    label: "13-minutes-会议纪要",
    request:
      "写一份××市人民政府第××次常务会议纪要。会议研究审议了《××市优化营商环境若干措施》、听取上半年经济运行情况汇报。出席：市长王强，副市长×××、×××；请假：×××（出差）；列席：×××等。纪要给市政府办公厅存档并印发各区县政府、市政府各部门。落款会议名称，成文日期2026年7月5日。",
  },
  {
    label: "14-announcement-公告",
    request:
      "××市市场监督管理局发布2026年食品安全监督抽检情况公告，写一份公告。正文公布抽检总体情况（抽检2000批次、不合格23批次）、不合格产品处理情况、消费提示。无主送机关，落款××市市场监督管理局，成文日期2026年7月30日。",
  },
]

function render(markdown: string): string {
  const rule =
    getBuiltinRules().find((r) => r.name.includes("9704")) ??
    getBuiltinRules()[0]!
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

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error("缺少 DEEPSEEK_API_KEY 环境变量")
    process.exit(1)
  }
  mkdirSync(OUT_DIR, { recursive: true })

  const systemPrompt = buildSystemPrompt()

  let okCount = 0
  for (const scenario of SCENARIOS) {
    const userPrompt = buildUserPrompt(scenario.request)
    const prompt = `${systemPrompt}\n\n${userPrompt}`
    const safeLabel = scenario.label.replace(/[^\w-]/g, "_")

    process.stdout.write(`[${scenario.label}] 生成中 ... `)
    try {
      const raw = await generateDocument({
        prompt,
        apiKey,
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      })
      writeFileSync(`${OUT_DIR}/${safeLabel}.raw.json`, raw)

      let doc
      try {
        doc = parseLegalDoc(raw)
      } catch (err) {
        writeFileSync(
          `${OUT_DIR}/${safeLabel}.parse-error.txt`,
          (err as Error).message
        )
        process.stdout.write(`解析失败: ${(err as Error).message}\n`)
        continue
      }

      const issues = checkFormat(doc)
      const { doc: repaired, repairs } = repairDoc(doc)
      const markdown = toMarkdown(repaired)
      writeFileSync(`${OUT_DIR}/${safeLabel}.md`, markdown)
      writeFileSync(`${OUT_DIR}/${safeLabel}.html`, render(markdown))
      writeFileSync(
        `${OUT_DIR}/${safeLabel}.issues.json`,
        JSON.stringify(
          {
            docType: repaired.docType,
            hasRedHead: Boolean(
              repaired.issuingOrg && repaired.issuingOrg.trim()
            ),
            hasDocNumber: Boolean(repaired.docNumber),
            hasSigner: Boolean(repaired.signer),
            hasSeal: repaired.seal === true,
            formatIssues: issues,
            repairs,
          },
          null,
          2
        )
      )
      okCount += 1
      process.stdout.write(
        `OK docType=${repaired.docType} issuingOrg=${repaired.issuingOrg ?? "—"} docNumber=${repaired.docNumber ?? "—"} signer=${repaired.signer ?? "—"} issues=${issues.length}\n`
      )
    } catch (err) {
      process.stdout.write(`API 失败: ${String(err)}\n`)
    }
  }

  console.log(`\n成功 ${okCount}/${SCENARIOS.length} 份，产物在 ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
