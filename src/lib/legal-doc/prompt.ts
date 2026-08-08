import type { DocType, LegalDoc } from "./types"
import { DOC_TYPES } from "./types"
import { DOC_TYPE_SPECS } from "./doc-type-spec"

const SYSTEM_PROMPT = `你是一名资深的党政机关公文写作助手。请根据用户的写作要求，生成一篇符合 GB/T 9704-2012《党政机关公文格式》精神的公文。

你必须严格输出一个 JSON 对象，不要输出任何其他文字、注释或 Markdown 代码块围栏。JSON 必须符合以下结构：

{
  "docType": "gongwen" | "decision" | "order" | "gazette" | "communique" | "opinion" | "request" | "report" | "reply" | "proposal" | "resolution" | "letter" | "minutes" | "announcement",
  "title": "公文标题（必填，作为文件标题/红头）",
  "docNumber": "发文字号，如：国发〔2026〕12号（可选）",
  "copyNumber": "份号（涉密公文才填，如：0001，可选）",
  "issuingOrg": "发文机关标志（红头，如：××市人民政府文件，可选）",
  "securityLevel": "密级，仅限：秘密 / 机密 / 绝密（可选）",
  "urgency": "紧急程度，仅限：特急 / 加急（可选）",
  "recipient": "主送机关（可选）",
  "signer": "签发人（仅请示/报告等上行文填写，如：×××，可选）",
  "body": [
    {
      "type": "p" | "h1" | "h2",
      "text": "段落内容（非空）"
    }
  ],
  "attachments": ["附件名称列表（可选）"],
  "issuer": "发文机关署名（可选）",
  "date": "成文日期，ISO 格式如 2026-07-31（可选）",
  "annotation": "附注（如：（此件公开发布）），可选",
  "cc": ["抄送机关列表（可选）"],
  "printingOffice": "印发机关（可选）",
  "printingDate": "印发日期（可选）",
  "attendees": ["出席人员名单（仅 docType 为 minutes 时必填，如“张三（单位）”）"],
  "absentees": ["请假人员名单（仅 minutes，没有则省略）"],
  "observers": ["列席人员名单（仅 minutes，没有则省略）"],
  "seal": "是否需要加盖公章（布尔值，可选，默认 false）"
}

字段说明：
- docType 取值与中文文种对应：gongwen=通知，decision=决定，order=命令（令），gazette=公报，communique=通报，opinion=意见，request=请示，report=报告，reply=批复，proposal=议案，resolution=决议，letter=函，minutes=会议纪要，announcement=通告/公告。
- copyNumber（份号）仅涉密公文填写（如"0001"），普通公文省略。
- **红头（issuingOrg）与发文字号（docNumber）成对出现**：issuingOrg（发文机关标志，红头，如"××市人民政府文件"）和 docNumber（发文字号，如"渝府发〔2026〕12号"）必须同时填写或同时不填。红头是版心最上方要素（红色小标宋），文号排在红头之下空二行。**只有红头没有文号、或只有文号没有红头都是格式错误**。意见/函等机关行文若无红头格式则两者都不填；其他有红头格式的文种两者都必填。红头内容为"机关全称/规范化简称+文件"，如"重庆市人民政府文件"。
- **红头机关名与文号机关代字必须一致**：机关代字是发文字号第一段（如"国发"），必须对应发文机关——国务院发"国发"、国务院办公厅发"国办发"、省人民政府发"×政发"、省人民政府办公厅发"×政办发"。红头写"国务院办公厅文件"时文号必须是"国办发〔20××〕×号"，**绝不能**配"国发〔20××〕×号"（国发是国务院的代字）。请先确定发文机关，再按机关给出匹配的代字。
- **发文字号格式（GB/T 9704 §7.2.5）**：年份用四位阿拉伯数字全称、六角括号括入（如〔2026〕）；发文顺序号用阿拉伯数字、**前不加"第"字、不编虚位**（1 不写成 01）、后加"号"字。即"国发〔2026〕12号"，绝不能是"国发〔2026〕第12号"或"国发〔2026〕12"或"国发〔2026〕02号"。
- **上行文（请示/报告）**：发文字号居左空一字编排（非居中），右侧同排签发人——在 signer 字段填写签发人姓名（如"×××"）。下行文（通知等）发文字号居中编排。
- **标题（title）严禁包含发文机关名称**：红头已经写明发文机关，标题只写事由+文种（如"关于印发《×××》的通知"），不得写成"重庆市人民政府关于印发《×××》的通知"（机关名+标题重复是常见格式错误）。
- **命令（令，docType=order）的标题即"×××令"式标志**：发文机关标志（issuingOrg）填"机关全称+令"（如"××市人民政府令"），标题（title）填"×××令"（如"××市人民政府令"），**不要**写成"关于公布《×××》的命令"——命令文种标题就是发文机关全称加"令"字（GB/T 9704 §10.2）。
- **决议（docType=resolution）/公报（docType=gazette）需题注**：标题下须居中排"（会议名称 通过日期）"题注。决议把会议名称写进 title（如"××会议关于…的决议"），issuer 填会议全称（如"××市第×届人民代表大会第×次会议"），date 填通过日期；公报 issuer 填发布机关、date 填发布日期。
- annotation（附注）如"（此件公开发布）"在成文日期下一行编排，仅在确有附注时填写。
- body 至少 1 段。type 只能取 p（正文段落）、h1（一级标题，如“一、总体要求”层级的标题）、h2（二级标题，如“（一）加强统筹”层级的标题）。
- **序号由排版引擎自动生成，标题 text 严禁自带序号**：h1 的 text 只能写“总体要求”，绝不能写成“一、总体要求”；h2 只能写“统筹推进”，绝不能写“（一）统筹推进”。否则会渲染成“一、一、总体要求”。
- 正文段落（type 为 p）不要写“一、二、三、”这类序号开头，需要分条列项时改用 h1/h2 标题层级。
- 当 docType 为 minutes（会议纪要）时，必须填写 attendees（出席人员名单）、absentees（请假人员名单）、observers（列席人员名单），格式为“单位、姓名”，人名之间用“、”连接。
- securityLevel 和 urgency 仅在用户明确要求时填写。
- 所有标题和段落文本要求完整成句，不要使用省略号代替内容。

标点规范（GB/T 15834《标点符号用法》）：
- 正文必须使用全角中文标点：引号用“”（中文弯引号）、括号用（）、逗号用，、句号用。、冒号用：，禁止在中文语境混入半角英文标点（如 " ' ( ) , . : ）。
- 英文、数字、网址等语境下可保留半角标点，不得把数字写成全角。

正文风格要求：
- 党政机关公文正式文风，语言严谨、庄重、简明，使用规范书面语。
- 段落完整，意思表达清楚，不写空洞口号。
- 段落之间逻辑连贯，结构层次分明。`

const USER_PROMPT_TEMPLATE = `请根据以下要求撰写公文：

{userDescription}

请严格按照系统提示中的 JSON 结构输出。`

const EXAMPLE_GONGWEN: LegalDoc = {
  docType: "gongwen",
  title: "关于加强数字政府建设的通知",
  docNumber: "国发〔2026〕12号",
  recipient: "各省、自治区、直辖市人民政府，国务院各部委、各直属机构：",
  body: [
    {
      type: "p",
      text: "为深入贯彻落实党中央、国务院关于建设网络强国、数字中国的决策部署，加快推进数字政府建设，经国务院同意，现就有关工作通知如下。",
    },
    {
      type: "h1",
      text: "总体要求",
    },
    {
      type: "p",
      text: "以习近平新时代中国特色社会主义思想为指导，全面贯彻党的二十大精神，坚持以人民为中心的发展思想。",
    },
    {
      type: "h1",
      text: "主要任务",
    },
    {
      type: "h2",
      text: "提升政务服务水平",
    },
    {
      type: "p",
      text: "推动政务服务事项网上办、掌上办，持续优化办事流程。",
    },
    {
      type: "h2",
      text: "强化数据安全保障",
    },
    {
      type: "p",
      text: "落实数据分类分级保护制度，加强重要数据安全防护。",
    },
  ],
  issuer: "国务院办公厅",
  date: "2026-07-31",
}

const EXAMPLE_OUTPUTS: Record<DocType, LegalDoc> = {
  gongwen: EXAMPLE_GONGWEN,
  request: {
    docType: "request",
    title: "关于解决基层办公设备不足问题的请示",
    recipient: "省人民政府：",
    body: [
      {
        type: "p",
        text: "近年来，随着基层治理任务不断加重，我局部分办公设备老化严重，已难以满足日常工作需要。现申请更新购置一批办公设备，妥否，请批示。",
      },
      {
        type: "p",
        text: "下一步，我局将严格落实政府采购有关规定，确保设备购置工作公开、透明、规范。",
      },
    ],
    issuer: "市财政局",
    date: "2026-07-31",
  },
  minutes: {
    docType: "minutes",
    title: "全市安全生产工作会议纪要",
    body: [
      {
        type: "p",
        text: "2026年7月20日，全市安全生产工作会议在市政府会议室召开，会议由副市长××主持。",
      },
      {
        type: "p",
        text: "会议听取了市应急管理局关于上半年安全生产工作的汇报，并对下半年重点任务进行了部署。",
      },
      {
        type: "h1",
        text: "议定事项",
      },
      {
        type: "p",
        text: "会议确定，深入开展安全生产大排查大整治，坚决防范和遏制重特大事故发生。",
      },
    ],
    attendees: ["××（市应急管理局）", "××（市住建局）"],
    absentees: ["××（市教育局）"],
    observers: ["××（市消防支队）"],
  },
  decision: {
    docType: "decision",
    title: "关于对××公司违规经营行为的处理决定",
    recipient: "××公司，各相关部门：",
    body: [
      {
        type: "p",
        text: "经查，××公司存在未按规定履行信息公示义务等违规经营行为。为维护市场秩序，现作出如下处理决定。",
      },
      {
        type: "h1",
        text: "责令限期改正",
      },
      {
        type: "p",
        text: "责令××公司自收到本决定之日起三十日内完成整改，并将整改情况书面报告我局。",
      },
      {
        type: "h1",
        text: "依法给予处罚",
      },
      {
        type: "p",
        text: "依据《××条例》有关规定，对××公司处以罚款，并纳入经营异常名录。",
      },
    ],
    issuer: "××市市场监督管理局",
    date: "2026-07-31",
  },
  resolution: {
    docType: "resolution",
    title: "××市第十六届人民代表大会第三次会议关于××的决议",
    body: [
      {
        type: "p",
        text: "××市第十六届人民代表大会第三次会议听取和审议了市发展改革委关于××的报告。会议同意报告提出的目标任务，决定批准该报告。",
      },
      {
        type: "h1",
        text: "原则要求",
      },
      {
        type: "p",
        text: "会议认为，全市上下要坚定信心、真抓实干，确保完成年度各项目标任务。",
      },
      {
        type: "h1",
        text: "保障措施",
      },
      {
        type: "p",
        text: "会议强调，各级各部门要强化责任担当，加强统筹协调，推动各项部署落地见效。",
      },
    ],
    issuer: "××市第十六届人民代表大会第三次会议",
    date: "2026-07-31",
  },
  order: {
    docType: "order",
    title: "××市人民政府令",
    issuingOrg: "××市人民政府令",
    docNumber: "第×号",
    recipient: "各区人民政府，市政府各部门：",
    body: [
      {
        type: "p",
        text: "《××市城镇燃气管理条例》已经2026年7月15日市人民政府第×次常务会议审议通过，现予公布，自2026年10月1日起施行。",
      },
      {
        type: "p",
        text: "市长 ×××",
      },
    ],
    issuer: "×××",
    date: "2026-07-31",
  },
  gazette: {
    docType: "gazette",
    title: "××市2026年上半年经济运行情况公报",
    body: [
      {
        type: "p",
        text: "上半年，全市上下认真贯彻落实党中央、国务院决策部署，经济运行总体平稳、稳中有进。",
      },
      {
        type: "h1",
        text: "主要经济指标",
      },
      {
        type: "p",
        text: "地区生产总值同比增长百分之六，固定资产投资增长百分之八，社会消费品零售总额增长百分之五。",
      },
      {
        type: "h1",
        text: "下一步安排",
      },
      {
        type: "p",
        text: "持续巩固经济回升向好态势，确保完成全年经济社会发展目标任务。",
      },
    ],
    issuer: "××市统计局",
    date: "2026-07-31",
  },
  communique: {
    docType: "communique",
    title: "关于对2025年度全省政务服务工作先进单位的通报",
    recipient: "各市人民政府，省政府各部门：",
    body: [
      {
        type: "p",
        text: "2025年，全省各级各部门深入推进政务服务标准化、规范化、便利化建设，涌现出一批先进典型。为表扬先进、树立导向，经研究，决定对××等30家单位予以通报表扬。",
      },
      {
        type: "h1",
        text: "表扬对象",
      },
      {
        type: "p",
        text: "××市人民政府政务服务中心等30家单位被评为2025年度全省政务服务工作先进单位。",
      },
      {
        type: "h1",
        text: "工作要求",
      },
      {
        type: "p",
        text: "希望受表扬单位珍惜荣誉、再接再厉，各地各部门要以先进为榜样，持续提升政务服务水平。",
      },
    ],
    issuer: "××省人民政府办公厅",
    date: "2026-07-31",
  },
  proposal: {
    docType: "proposal",
    title: "关于提请审议《××市数据条例（草案）》的议案",
    recipient: "市人民代表大会：",
    body: [
      {
        type: "p",
        text: "为促进数据要素市场健康发展，规范数据处理活动，市人民政府组织起草了《××市数据条例（草案）》，业经市人民政府第×次常务会议审议通过。现提请市人大常委会审议。",
      },
      {
        type: "p",
        text: "请予审议。",
      },
    ],
    issuer: "××市人民政府",
    date: "2026-07-31",
  },
  opinion: {
    docType: "opinion",
    title: "关于进一步加强基层社会治理工作的意见",
    recipient: "各区人民政府，市政府各委、办、局：",
    body: [
      {
        type: "p",
        text: "为深入贯彻落实党中央、国务院关于加强基层治理体系和治理能力现代化建设的决策部署，现就进一步加强基层社会治理工作提出如下意见。",
      },
      {
        type: "p",
        text: "要健全党组织领导的基层治理体系，推动治理重心下移、资源下沉。",
      },
      {
        type: "p",
        text: "应当完善社区议事协商机制，引导群众积极参与基层治理。",
      },
    ],
    issuer: "××市人民政府",
    date: "2026-07-31",
  },
  report: {
    docType: "report",
    title: "关于上半年经济运行情况的报告",
    recipient: "市人民政府：",
    body: [
      {
        type: "p",
        text: "按照工作部署，现将全市上半年经济运行情况报告如下。",
      },
      {
        type: "p",
        text: "上半年，全市地区生产总值同比增长百分之六，经济运行总体平稳、稳中有进。",
      },
      {
        type: "p",
        text: "下一步，我们将坚持稳中求进工作总基调，全力完成全年目标任务。",
      },
    ],
    issuer: "市发展改革委",
    date: "2026-07-31",
  },
  reply: {
    docType: "reply",
    title: "关于同意××公司开展××业务的批复",
    recipient: "××公司：",
    body: [
      {
        type: "p",
        text: "你公司《关于申请开展××业务的请示》收悉。经研究，现批复如下。",
      },
      {
        type: "p",
        text: "同意你公司在××范围内开展××业务，请严格按照相关法律法规组织实施。",
      },
      {
        type: "p",
        text: "此复。",
      },
    ],
    issuer: "××市××局",
    date: "2026-07-31",
  },
  letter: {
    docType: "letter",
    title: "关于商请协助办理××事项的函",
    recipient: "××大学：",
    body: [
      {
        type: "p",
        text: "为进一步深化产学研合作，我局拟组织科技人员赴贵校开展调研交流，商请贵校予以支持。",
      },
      {
        type: "p",
        text: "如蒙同意，请函复我局，以便安排后续行程。",
      },
    ],
    issuer: "××市科学技术局",
    date: "2026-07-31",
  },
  announcement: {
    docType: "announcement",
    title: "关于加强城区机动车限行管理的通告",
    body: [
      {
        type: "p",
        text: "为进一步改善城区道路交通环境，减少机动车污染物排放，现就加强城区机动车限行管理有关事项通告如下。",
      },
      {
        type: "p",
        text: "自2026年9月1日起，每日7时至22时，对号牌尾号为单、双数的机动车在限行区域内实行交替限行。",
      },
      {
        type: "p",
        text: "执行任务的军车、警车、消防车、救护车、工程救险车及公共交通车辆不受限行措施限制。",
      },
      {
        type: "p",
        text: "对违反限行规定的，由公安机关交通管理部门依法处理。请广大市民合理安排出行。",
      },
    ],
    issuer: "××市公安局交通管理局",
    date: "2026-07-31",
  },
}

/** 从用户描述首行解析出文种枚举值。 */
function extractDocType(userDescription: string): DocType | null {
  const firstLine = userDescription.trim().split("\n")[0].trim()
  return (DOC_TYPES as readonly string[]).includes(firstLine)
    ? (firstLine as DocType)
    : null
}

function buildFormatRequirement(userDescription: string): string {
  const docType = extractDocType(userDescription)
  return docType ? DOC_TYPE_SPECS[docType].promptRequirement : ""
}

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildUserPrompt(
  userDescription: string,
  options?: { seal?: boolean }
): string {
  const formatRequirement = buildFormatRequirement(userDescription)
  const sealRequirement =
    options?.seal === true
      ? "该公文需要加盖公章，请在 JSON 中把 seal 置为 true（勿在 issuer 或 date 文本中写“（此处加盖公章）”等占位，盖章位置由系统自动生成）。"
      : ""
  const instructions = [formatRequirement, sealRequirement].filter(Boolean)

  const userContent =
    instructions.length > 0
      ? `${userDescription.trim()}\n\n附加格式要求：\n${instructions.join("\n")}`
      : userDescription.trim()

  const docType = extractDocType(userDescription)
  const spec = docType ? DOC_TYPE_SPECS[docType] : null
  const exampleDoc = docType
    ? EXAMPLE_OUTPUTS[docType]
    : EXAMPLE_OUTPUTS.gongwen
  const example = JSON.stringify(exampleDoc, null, 2)
  const selectedExample = `${exampleDoc.title}（${spec?.name ?? "通知"}）\n${example}`
  // 用 split/join 而非 replace：replace 会把用户描述里的 $& / $1 等当替换模式吞掉
  const prompt =
    USER_PROMPT_TEMPLATE.split("{userDescription}").join(userContent)
  return `${prompt}

示例输出（仅作格式参考，内容需按本次要求重写）：
${selectedExample}`
}
