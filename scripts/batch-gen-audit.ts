/**
 * 批量生成审计：调真实 LLM API 生成大量公文，走完整管线，聚合发现。
 * 用法：DEEPSEEK_API_KEY=sk-xxx bun run scripts/batch-gen-audit.ts
 * 产物：.claude/tmp/batch-audit/（每份 .raw.json/.md/.html/.issues.json）+ 聚合 report.jsonl
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
import { writeFileSync, mkdirSync, appendFileSync } from "node:fs"

const OUT_DIR = ".claude/tmp/batch-audit"

interface Scenario {
  id: string
  docType: string
  request: string
}

// 14 文种 × 3-4 变体 = 48 场景
const SCENARIOS: Scenario[] = [
  // ---- gongwen 通知 ----
  { id: "gongwen-01", docType: "gongwen", request: "××市人民政府要印发《××市城市更新行动方案（2026—2030年）》，写一份通知，主送各区人民政府、市政府各部门、有关单位，正文写清总体要求、重点任务、保障措施。落款××市人民政府，成文日期2026年8月1日。" },
  { id: "gongwen-02", docType: "gongwen", request: "××省人民政府办公厅转发《国务院办公厅关于加强医疗保障基金监管的意见》，写一份通知。主送各市人民政府、省政府各部门。落款××省人民政府办公厅，成文日期2026年7月18日。" },
  { id: "gongwen-03", docType: "gongwen", request: "××市人民政府办公室印发《××市防汛应急预案（2026年修订）》，写一份通知，主送各县（市、区）人民政府、市政府各部门、各直属机构。落款××市人民政府办公室，成文日期2026年6月10日。" },
  { id: "gongwen-04", docType: "gongwen", request: "××市教育局要印发《××市义务教育阶段作业管理办法（试行）》，写一份通知，主送各县（市、区）教育局、市直各学校。落款××市教育局，成文日期2026年5月20日。" },
  { id: "gongwen-05", docType: "gongwen", request: "××市人民政府办公厅转发《××省人民政府办公厅关于进一步做好当前防汛救灾工作的通知》，写一份通知，主送各区县人民政府、市政府各部门。落款××市人民政府办公厅，成文日期2026年7月28日。" },
  { id: "gongwen-06", docType: "gongwen", request: "××市卫生健康委员会印发《××市基本公共卫生服务项目实施方案》，写一份通知，主送各县（市、区）卫生健康局。落款××市卫生健康委员会，成文日期2026年4月15日。" },
  { id: "gongwen-07", docType: "gongwen", request: "××市人民政府印发《××市优化营商环境行动方案》，写一份通知，主送各县（市、区）人民政府、市政府各部门。落款××市人民政府，成文日期2026年8月2日。" },
  { id: "gongwen-08", docType: "gongwen", request: "××省教育厅印发《××省中小学校园安全管理办法》，写一份通知，主送各市教育局、各省属学校。落款××省教育厅，成文日期2026年7月10日。" },

  // ---- decision 决定 ----
  { id: "decision-01", docType: "decision", request: "××市人民政府关于授予×××等同志××市劳动模范荣誉称号的决定，正文写清授予名单、希望要求。落款××市人民政府，成文日期2026年4月30日，加盖公章。" },
  { id: "decision-02", docType: "decision", request: "××省人民政府关于××年度科技进步奖获奖项目的决定，正文写清获奖名单、表彰要求。落款××省人民政府，成文日期2026年3月15日。" },
  { id: "decision-03", docType: "decision", request: "××市市场监督管理局关于对××公司违法行为的行政处罚决定，正文写清违法事实、处罚依据、处罚内容、救济途径。落款××市市场监督管理局，成文日期2026年6月25日。" },
  { id: "decision-04", docType: "decision", request: "××市人民政府关于调整××市城镇土地使用税税额标准的决定，正文写清调整内容、执行时间。落款××市人民政府，成文日期2026年2月10日。" },

  // ---- order 命令 ----
  { id: "order-01", docType: "order", request: "××市人民政府公布《××市城市市容和环境卫生管理条例实施办法》，写一份命令（令）公布。用令号××市人民政府令第32号，正文说明审议通过、现予公布、施行时间。市长署名，成文日期2026年5月20日。" },
  { id: "order-02", docType: "order", request: "××市人民政府公布《××市生活垃圾分类管理办法》，写一份命令（令）公布。用令号第18号，正文说明审议通过、公布、自2026年9月1日起施行。市长署名，成文日期2026年6月30日。" },
  { id: "order-03", docType: "order", request: "××市人民政府公布《××市停车场建设管理办法》，写一份命令（令）公布。令号第7号，正文说明经第××次常务会议审议通过、现予公布、自2026年12月1日起施行。市长署名，成文日期2026年8月5日。" },
  { id: "order-04", docType: "order", request: "××市人民政府公布《××市政务服务大厅管理办法》，写一份命令（令）公布。令号第25号，正文说明审议通过、公布、施行。市长署名，成文日期2026年7月1日。" },

  // ---- gazette 公报 ----
  { id: "gazette-01", docType: "gazette", request: "××市统计局发布2026年上半年××市经济运行情况公报，正文分主要指标、工业、投资、消费、财政金融等部分（每部分两三条）。无主送机关，落款××市统计局，成文日期2026年7月20日。" },
  { id: "gazette-02", docType: "gazette", request: "××省统计局发布2025年××省国民经济和社会发展统计公报，正文分综合、农业、工业、投资、贸易、财政金融、人民生活等部分。无主送机关，落款××省统计局，成文日期2026年2月28日。" },
  { id: "gazette-03", docType: "gazette", request: "××市气象局发布2026年××市汛期气候公报，正文分气候概况、主要天气气候事件、影响评价、展望建议。无主送机关，落款××市气象局，成文日期2026年6月30日。" },

  // ---- communique 通报 ----
  { id: "communique-01", docType: "communique", request: "××市人民政府办公厅关于对2025年度全市安全生产先进单位和先进个人进行通报表扬的通知，写一份通报。主送各县（市、区）人民政府、市政府各部门。落款××市人民政府办公厅，成文日期2026年3月20日。" },
  { id: "communique-02", docType: "communique", request: "××省人民政府办公厅关于全省政务服务工作情况暨2026年第一季度工作情况的通报，写一份通报。主送各市人民政府、省政府各部门。落款××省人民政府办公厅，成文日期2026年4月10日。" },
  { id: "communique-03", docType: "communique", request: "××市纪律检查委员会关于×××等同志违反工作纪律问题的通报，写一份通报。主送各县（市、区）纪委、市直各单位。落款××市纪律检查委员会，成文日期2026年5月8日。" },
  { id: "communique-04", docType: "communique", request: "××市人民政府办公室关于2026年6月全市政务信息报送情况的通报，写一份通报。主送各县（市、区）人民政府、市政府各部门。落款××市人民政府办公室，成文日期2026年7月5日。" },

  // ---- opinion 意见 ----
  { id: "opinion-01", docType: "opinion", request: "××市发展和改革委员会关于加强投资项目审批服务工作的意见，写一份意见。主送各县（市、区）发展改革委。正文从优化流程、压缩时限、加强监管等方面提出措施。落款××市发展和改革委员会，成文日期2026年6月12日。" },
  { id: "opinion-02", docType: "opinion", request: "××市人民政府关于加快推动现代物流业高质量发展的实施意见，写一份意见。主送各县（市、区）人民政府、市政府各部门。正文从壮大市场主体、完善基础设施、优化政策环境等提出措施。落款××市人民政府，成文日期2026年5月25日。" },
  { id: "opinion-03", docType: "opinion", request: "××市农业农村局关于加强高标准农田建设管理的意见，写一份意见。主送各县（市、区）农业农村局。正文从规划布局、建设标准、建后管护等方面提出要求。落款××市农业农村局，成文日期2026年7月22日。" },

  // ---- request 请示 ----
  { id: "request-01", docType: "request", request: "××市水利局拟实施××市城区防洪排涝工程，需向××市人民政府申请立项并安排建设资金（约8000万元），写一份请示。正文写清项目必要性、主要内容、投资估算、请求事项。签发人王××（局长），落款××市水利局，成文日期2026年6月8日。" },
  { id: "request-02", docType: "request", request: "××市文化广电旅游体育局拟举办2026年××国际马拉松赛，需向××市人民政府申请批准并给予经费保障，写一份请示。签发人刘××（局长），落款××市文化广电旅游体育局，成文日期2026年4月18日。" },
  { id: "request-03", docType: "request", request: "××市自然资源和规划局拟组建××市国土空间规划编制工作领导小组，需向××市人民政府请示批准，写一份请示。签发人陈××（局长），落款××市自然资源和规划局，成文日期2026年7月12日。" },

  // ---- report 报告 ----
  { id: "report-01", docType: "report", request: "××市应急管理局向××市人民政府报告2026年上半年全市安全生产工作情况，写一份报告。正文写上主要工作、存在问题、下一步打算。签发人赵××（局长），落款××市应急管理局，成文日期2026年7月15日。" },
  { id: "report-02", docType: "report", request: "××市财政局向××市人民政府报告2025年度财政决算情况，写一份报告。正文写收支总体情况、主要特点、下一步措施。签发人孙××（局长），落款××市财政局，成文日期2026年3月30日。" },
  { id: "report-03", docType: "report", request: "××市工业和信息化局向××市人民政府报告2026年上半年工业经济运行情况，写一份报告。正文写主要指标、运行特点、存在问题、工作建议。签发人周××（局长），落款××市工业和信息化局，成文日期2026年7月20日。" },

  // ---- reply 批复 ----
  { id: "reply-01", docType: "reply", request: "××市人民政府对××市水利局《关于××市城区防洪排涝工程立项的请示》作出批复，原则同意立项。主送××市水利局。落款××市人民政府，成文日期2026年6月20日。" },
  { id: "reply-02", docType: "reply", request: "××市人民政府对××市文化广电旅游体育局《关于举办2026年××国际马拉松赛的请示》作出批复，同意举办。主送××市文化广电旅游体育局。落款××市人民政府，成文日期2026年4月30日。" },
  { id: "reply-03", docType: "reply", request: "××市人民政府对××县《关于调整××县城镇土地使用税税额标准的请示》作出批复，同意调整。主送××县人民政府。落款××市人民政府，成文日期2026年2月20日。" },
  { id: "reply-04", docType: "reply", request: "××市人民政府对××市自然资源和规划局《关于组建××市国土空间规划编制工作领导小组的请示》作出批复，同意组建。主送××市自然资源和规划局。落款××市人民政府，成文日期2026年7月25日。" },

  // ---- proposal 议案 ----
  { id: "proposal-01", docType: "proposal", request: "××市人民政府向××市人民代表大会提请审议《××市地方立法条例（草案）》，写一份议案。正文说明立法必要性、起草过程、主要内容。主送××市人民代表大会，落款××市人民政府，成文日期2026年3月5日。" },
  { id: "proposal-02", docType: "proposal", request: "××市人民政府向××市人民代表大会常务委员会提请审议《××市养老服务条例（草案）》，写一份议案。正文说明必要性、过程、内容。主送××市人民代表大会常务委员会，落款××市人民政府，成文日期2026年5月28日。" },
  { id: "proposal-03", docType: "proposal", request: "××市人民政府向××市人民代表大会提请审议××市2025年财政决算报告和2026年财政预算草案，写一份议案。正文说明情况、提请审议。主送××市人民代表大会，落款××市人民政府，成文日期2026年1月15日。" },

  // ---- resolution 决议 ----
  { id: "resolution-01", docType: "resolution", request: "××市第×届人民代表大会第×次会议通过关于××市人民政府工作报告的决议，写一份决议。标题写明会议名称。正文表述会议听取和审议了报告、同意目标任务、决定批准。落款××市第×届人民代表大会第×次会议，成文日期2026年1月20日。" },
  { id: "resolution-02", docType: "resolution", request: "××市第×届人民代表大会常务委员会第×次会议通过关于××市2026年国民经济和社会发展计划的决议，写一份决议。标题写明会议名称。落款××市第×届人民代表大会常务委员会第×次会议，成文日期2026年3月28日。" },
  { id: "resolution-03", docType: "resolution", request: "××市第×届人民代表大会第×次会议通过关于××市中级人民法院工作报告的决议，写一份决议。标题写明会议名称。落款××市第×届人民代表大会第×次会议，成文日期2026年1月22日。" },

  // ---- letter 函 ----
  { id: "letter-01", docType: "letter", request: "××市生态环境局商请××市水利局协助开展××河流域水环境联合监测，写一份函。正文说明缘由、需协助事项、回复要求。落款××市生态环境局，成文日期2026年6月15日。" },
  { id: "letter-02", docType: "letter", request: "××市科学技术局致函××大学商请合作共建××市智能制造研究院，写一份函。正文说明合作意向、具体事项、期望回复。落款××市科学技术局，成文日期2026年5月10日。" },
  { id: "letter-03", docType: "letter", request: "××市住房和城乡建设局致函××市自然资源和规划局，商请提供中心城区部分地块控规指标，写一份函。落款××市住房和城乡建设局，成文日期2026年7月8日。" },
  { id: "letter-04", docType: "letter", request: "××市市场监督管理局复函××市生态环境局，就××市环境保护设施运行监督管理暂行办法征求意见的函复，写一份复函。落款××市市场监督管理局，成文日期2026年4月25日。" },

  // ---- minutes 会议纪要 ----
  { id: "minutes-01", docType: "minutes", request: "写一份××市人民政府第×次常务会议纪要。会议审议了《××市优化营商环境若干措施》、听取上半年经济运行情况汇报。出席：市长王强，副市长×××、×××；请假：×××；列席：×××等。落款××市人民政府常务会议，成文日期2026年7月5日。" },
  { id: "minutes-02", docType: "minutes", request: "写一份××市安全生产委员会全体会议纪要。会议通报了上半年安全生产形势、部署下半年工作。出席：主任×××，副主任×××，成员单位×××等；请假：×××。落款××市安全生产委员会，成文日期2026年6月18日。" },
  { id: "minutes-03", docType: "minutes", request: "写一份××市乡村振兴工作专题会议纪要。会议研究了高标准农田建设、农村人居环境整治等事项。出席：×××、×××；列席：××县×××等。落款××市农业农村局，成文日期2026年5月30日。" },
  { id: "minutes-04", docType: "minutes", request: "写一份××市重点项目推进工作调度会议纪要。会议调度了××机场改扩建、××产业园等重点项目。出席：市长×××，副市长×××，各项目责任单位主要负责人。落款××市人民政府，成文日期2026年8月3日。" },

  // ---- announcement 公告 ----
  { id: "announcement-01", docType: "announcement", request: "××市市场监督管理局发布2026年上半年流通领域商品质量抽查检验结果公告，写一份公告。正文公布抽检情况、不合格产品处理、消费提示。无主送机关，落款××市市场监督管理局，成文日期2026年7月30日。" },
  { id: "announcement-02", docType: "announcement", request: "××市人民政府发布关于征收××片区土地的决定公告，写一份公告。正文公布征收范围、补偿标准、办理时限。无主送机关，落款××市人民政府，成文日期2026年6月20日。" },
  { id: "announcement-03", docType: "announcement", request: "××市卫生健康委员会发布2026年国家医师资格考试××考区有关事项公告，写一份公告。正文公布报名时间、考试时间、报名条件、咨询电话。无主送机关，落款××市卫生健康委员会，成文日期2026年3月10日。" },
  { id: "announcement-04", docType: "announcement", request: "××市住房和城乡建设局发布××市公共租赁住房分配有关事项公告，写一份公告。正文公布房源情况、申请条件、分配方式。无主送机关，落款××市住房和城乡建设局，成文日期2026年8月1日。" },
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
  appendFileSync(`${OUT_DIR}/report.jsonl`, "", { flag: "a" })

  let okCount = 0
  let failCount = 0
  for (const scenario of SCENARIOS) {
    process.stdout.write(`[${scenario.id}] 生成中 ... `)
    try {
      const raw = await generateDocument({
        prompt: `${systemPrompt}\n\n${buildUserPrompt(scenario.request)}`,
        apiKey,
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      })
      let doc
      try {
        doc = parseLegalDoc(raw)
      } catch (err) {
        writeFileSync(
          `${OUT_DIR}/${scenario.id}.parse-error.txt`,
          (err as Error).message
        )
        process.stdout.write(`解析失败: ${(err as Error).message}\n`)
        failCount += 1
        continue
      }
      const issues = checkFormat(doc)
      const { doc: repaired, repairs } = repairDoc(doc)
      const markdown = toMarkdown(repaired)
      writeFileSync(`${OUT_DIR}/${scenario.id}.raw.json`, raw)
      writeFileSync(`${OUT_DIR}/${scenario.id}.md`, markdown)
      writeFileSync(`${OUT_DIR}/${scenario.id}.html`, render(markdown))
      writeFileSync(
        `${OUT_DIR}/${scenario.id}.issues.json`,
        JSON.stringify(
          {
            docType: repaired.docType,
            hasRedHead: Boolean(repaired.issuingOrg?.trim()),
            hasDocNumber: Boolean(repaired.docNumber),
            hasSigner: Boolean(repaired.signer),
            hasSeal: repaired.seal === true,
            hasAttachments: Boolean(repaired.attachments?.length),
            hasCc: Boolean(repaired.cc?.length),
            formatIssues: issues,
            repairs,
          },
          null,
          2
        )
      )
      // 聚合行
      const summary = {
        id: scenario.id,
        docType: repaired.docType,
        title: repaired.title,
        issuingOrg: repaired.issuingOrg ?? "",
        docNumber: repaired.docNumber ?? "",
        signer: repaired.signer ?? "",
        seal: repaired.seal === true,
        issueCodes: issues.map((i) => i.code),
        repairCount: repairs.length,
      }
      appendFileSync(`${OUT_DIR}/report.jsonl`, JSON.stringify(summary) + "\n")
      okCount += 1
      process.stdout.write(
        `OK docType=${repaired.docType} docNumber=${repaired.docNumber ?? "—"} signer=${repaired.signer ?? "—"} issues=${issues.length} repairs=${repairs.length}\n`
      )
    } catch (err) {
      process.stdout.write(`API 失败: ${String(err)}\n`)
      failCount += 1
    }
  }
  console.log(`\n成功 ${okCount}/${SCENARIOS.length}，失败 ${failCount}，产物在 ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
