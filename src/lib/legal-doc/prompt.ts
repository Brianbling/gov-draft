import type { DocType, LegalDoc } from "./types"
import { DOC_TYPES } from "./types"
import { DOC_TYPE_SPECS } from "./doc-type-spec"

const SYSTEM_PROMPT = `你是一名资深的党政机关公文写作助手。请根据用户的写作要求，生成一篇符合 GB/T 9704-2012《党政机关公文格式》精神的公文。

你必须严格输出一个 JSON 对象，不要输出任何其他文字、注释或 Markdown 代码块围栏。JSON 必须符合以下结构：

{
  "docType": "gongwen" | "decision" | "opinion" | "request" | "report" | "reply" | "letter" | "minutes" | "announcement",
  "title": "公文标题（必填，作为文件标题/红头）",
  "docNumber": "发文字号，如：国发〔2026〕12号（可选）",
  "securityLevel": "密级，仅限：秘密 / 机密 / 绝密（可选）",
  "urgency": "紧急程度，仅限：特急 / 加急（可选）",
  "recipient": "主送机关（可选）",
  "body": [
    {
      "type": "p" | "h1" | "h2",
      "text": "段落内容（非空）"
    }
  ],
  "attachments": ["附件名称列表（可选）"],
  "issuer": "发文机关署名（可选）",
  "date": "成文日期，ISO 格式如 2026-07-31（可选）",
  "cc": ["抄送机关列表（可选）"],
  "printingOffice": "印发机关（可选）",
  "printingDate": "印发日期（可选）",
  "attendees": ["出席人员名单（仅 docType 为 minutes 时必填，如“张三（单位）”）"],
  "absentees": ["请假人员名单（仅 minutes，没有则省略）"],
  "observers": ["列席人员名单（仅 minutes，没有则省略）"],
  "seal": "是否需要加盖公章（布尔值，可选，默认 false）"
}

字段说明：
- docType 取值与中文文种对应：gongwen=通知，decision=决定，opinion=意见，request=请示，report=报告，reply=批复，letter=函，minutes=会议纪要，announcement=通告/公告。
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
  decision: { ...EXAMPLE_GONGWEN, docType: "decision" },
  opinion: { ...EXAMPLE_GONGWEN, docType: "opinion" },
  report: { ...EXAMPLE_GONGWEN, docType: "report" },
  reply: { ...EXAMPLE_GONGWEN, docType: "reply" },
  letter: { ...EXAMPLE_GONGWEN, docType: "letter" },
  announcement: { ...EXAMPLE_GONGWEN, docType: "announcement" },
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

  const userContent = instructions.length > 0
    ? `${userDescription.trim()}\n\n附加格式要求：\n${instructions.join("\n")}`
    : userDescription.trim()

  const docType = extractDocType(userDescription)
  const spec = docType ? DOC_TYPE_SPECS[docType] : null
  const exampleDoc = docType ? EXAMPLE_OUTPUTS[docType] : EXAMPLE_OUTPUTS.gongwen
  const example = JSON.stringify(exampleDoc, null, 2)
  const selectedExample = `${exampleDoc.title}（${spec?.name ?? "通知"}）\n${example}`
  // 用 split/join 而非 replace：replace 会把用户描述里的 $& / $1 等当替换模式吞掉
  const prompt = USER_PROMPT_TEMPLATE.split("{userDescription}").join(userContent)
  return `${prompt}

示例输出（仅作格式参考，内容需按本次要求重写）：
${selectedExample}`
}
