import type { DocType, LegalDoc } from "./types"
import type { FormatIssue } from "./format-check"

/**
 * 文种规范（单一事实源）。
 * 现状问题：prompt.ts 的 DOC_TYPE_FORMAT_REQUIREMENTS 与 review/format-rules.ts
 * 的 registry 双写同一份文种知识（请示结尾语、批复收悉语、报告禁请示语、函协商语气、
 * 通告无主送、纪要名单…），改一处漏一处。本文件把两份知识合并到这一个数据源，
 * prompt.ts 与 format-rules.ts 均从这里取，杜绝再次分叉。
 *
 * 迁移原则：文本逐字搬运（prompt 要求字符串不变）、规则逐条搬运（code/field/消息不变），
 * 行为完全不变由现有 346 测试兜底。
 */

export interface DocTypeSpec {
  /** 文种枚举（Record 的 key）。 */
  docType: DocType
  /** 文种中文名，如 "通知"。prompt 传给 LLM、错误提示展示用。 */
  name: string
  /** 附加到用户 prompt 的格式指令（原 prompt.ts DOC_TYPE_FORMAT_REQUIREMENTS 值）。 */
  promptRequirement: string
  /** L2 文种规范规则（原 format-rules.ts 各文种规则 + 通用规则）。 */
  rules: DocFormatRequirement[]
}

export interface DocFormatRequirement {
  code: string
  field: string
  check: (doc: LegalDoc) => FormatIssue | null
}

function issue(
  code: string,
  field: string,
  message: string,
): FormatIssue {
  return { field, code, message }
}

/** 全文（标题 + 正文）是否出现任一关键词。 */
function docContainsAny(doc: LegalDoc, keywords: string[]): boolean {
  const texts = [
    doc.title,
    ...doc.body.map((paragraph) => paragraph.text),
  ]
  return texts.some((text) =>
    keywords.some((keyword) => text.includes(keyword))
  )
}

/** 正文段落（type 为 p 的）是否出现任一关键词。 */
function bodyContainsAny(doc: LegalDoc, keywords: string[]): boolean {
  return doc.body.some((paragraph) =>
    keywords.some((keyword) => paragraph.text.includes(keyword))
  )
}

/** 从《书名号》对提取书名号内文本。 */
function extractTitles(text: string): string[] {
  const matches = text.match(/《([^》]+)》/g)
  if (!matches) return []
  return matches.map((match) => match.replace(/[《》]/g, ""))
}

/** 去掉附件名的公文文档后缀，仅保留核心名。 */
function coreAttachmentName(name: string): string {
  const stripped = name
    .replace(/[《》]/g, "")
    .replace(
      /(?:方案|办法|细则|规定|意见|通知|条例|规则|标准|规定(?:试行)?|(?:草案))$/g,
      "",
    )
    .replace(/\s+/g, "")
  return stripped.length > 0 ? stripped : name
}

function mentionedTitleCore(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/(?:方案|办法|细则|规定|意见|通知|条例|规则|标准)$/g, "")
}

/**
 * 附件一致性：正文用《书名号》提及的名称与 attachments[] 交叉核对。
 * 只有当文档明确声明了 attachments 时才判定"漏列"——正文引用的《××请示》这类
 * 引述（未声明附件）属于正常行文，不报；反之未声明 attachments 也无从谈起漏列。
 * 仅当"正文提到的《X》的核心名在任一附件核心名中完全找得到"才判定为已列入。
 */
function buildAttachmentMismatchRule(): DocFormatRequirement {
  const code = "ATTACHMENT_MISMATCH"
  const field = "attachments"
  const check = (doc: LegalDoc): FormatIssue | null => {
    const attachments = doc.attachments ?? []
    if (attachments.length === 0) return null
    const attachmentCores = attachments.map(coreAttachmentName)
    const mentioned = new Set<string>()
    for (const paragraph of doc.body) {
      for (const title of extractTitles(paragraph.text)) {
        const core = mentionedTitleCore(title)
        if (attachmentCores.includes(core)) continue
        if (!mentioned.has(core)) mentioned.add(core)
      }
    }
    if (mentioned.size === 0) return null
    return issue(
      code,
      field,
      `正文提到《${[...mentioned].join("》《")}》，但未列入 attachments。请核对是否遗漏附件，或将附件名称补充到 attachments 数组。`,
    )
  }
  return { code, field, check }
}

/** 口语化词表：出现在公文正文（title/正文）中的非书面语。 */
const COLLOQUIAL_WORDS = [
  "大家",
  "咱们",
  "搞定",
  "抓紧",
  "赶紧",
  "挺好的",
  "不错",
  "差不多",
  "算了",
  "行吧",
  "好吧",
  "挺多",
  "蛮好",
  "拉倒",
  "咋办",
  "估摸",
  "合计着",
  "打算盘",
  "土办法",
  "两码事",
  "没辙",
  "想辙",
  "使劲儿",
  "麻溜儿",
]

/** 文号序号前导 0：〔2026〕0号 或 〔2026〕07号 这类非法写法（GB/T 15835 §7.4）。 */
const DOC_NUMBER_LEADING_ZERO_PATTERN = /〔\d{4}〕0\d*号/

function buildDocNumberLeadingZeroRule(): DocFormatRequirement {
  return {
    code: "DOC_NUMBER_LEADING_ZERO",
    field: "docNumber",
    check: (doc) => {
      if (
        doc.docNumber &&
        DOC_NUMBER_LEADING_ZERO_PATTERN.test(doc.docNumber)
      ) {
        return issue(
          "DOC_NUMBER_LEADING_ZERO",
          "docNumber",
          "发文字号序号不应有前导 0（如“〔2026〕05号”应为“〔2026〕5号”）。",
        )
      }
      return null
    },
  }
}

function buildColloquialRule(): DocFormatRequirement {
  const hit = (doc: LegalDoc): string | null => {
    for (const paragraph of doc.body) {
      for (const word of COLLOQUIAL_WORDS) {
        if (paragraph.text.includes(word)) return word
      }
    }
    return null
  }
  return {
    code: "COLLOQUIAL_WORD",
    field: "body",
    check: (doc) => {
      const word = hit(doc)
      if (word) {
        return issue(
          "COLLOQUIAL_WORD",
          "body",
          `正文含口语化表达“${word}”，请替换为规范书面语。`,
        )
      }
      return null
    },
  }
}

function buildMinutesDecisionRule(): DocFormatRequirement {
  return {
    code: "MINUTES_USES_DECISION",
    field: "body",
    check: (doc) => {
      if (bodyContainsAny(doc, ["会议决定"])) {
        return issue(
          "MINUTES_USES_DECISION",
          "body",
          "会议纪要是对会议的记载而非决定文书，正文不宜用“会议决定”，应改用“会议确定”“会议议定”。",
        )
      }
      return null
    },
  }
}

/** 全部文种共享的通用规则（L2 尾部执行）。 */
function buildUniversalRules(docType: DocType): DocFormatRequirement[] {
  const rules: DocFormatRequirement[] = [
    buildDocNumberLeadingZeroRule(),
    buildColloquialRule(),
    buildAttachmentMismatchRule(),
  ]
  if (docType === "minutes") {
    rules.push(buildMinutesDecisionRule())
  }
  return rules
}

/** 各文种专属规则（不含通用规则，通用规则由 buildUniversalRules 统一附加）。 */
function buildDocTypeRules(docType: DocType): DocFormatRequirement[] {
  const rules: DocFormatRequirement[] = []
  switch (docType) {
    case "gongwen": {
      rules.push({
        code: "GONGWEN_TRANSFER_REFERENCE_MISSING",
        field: "body",
        check: (doc) => {
          if (
            /(批转|转发|印发)/.test(doc.title) &&
            !docContainsAny(doc, ["《"])
          ) {
            return issue(
              "GONGWEN_TRANSFER_REFERENCE_MISSING",
              "body",
              "批转/转发型通知正文应引述被批转（转发）文件的标题，如“现将《××办法》转发给你们”。",
            )
          }
          return null
        },
      })
      break
    }
    case "decision": {
      rules.push({
        code: "DECISION_NO_H1_HEADING",
        field: "body",
        check: (doc) => {
          if (!doc.body.some((paragraph) => paragraph.type === "h1")) {
            return issue(
              "DECISION_NO_H1_HEADING",
              "body",
              "决定正文应分条列项（至少一个一级标题 h1），不宜通篇为无层级段落。",
            )
          }
          return null
        },
      })
      break
    }
    case "opinion": {
      rules.push({
        code: "OPINION_NO_MEASURES",
        field: "body",
        check: (doc) => {
          const texts = doc.body.map((paragraph) => paragraph.text)
          const hasMeasures = texts.some(
            (text) =>
              /(要|应当|必须|建立健全|完善|加强|推进|抓好|严格落实)/.test(
                text,
              ) &&
              !/^(关于|根据|为(了)?|依据)/.test(text),
          )
          if (!hasMeasures) {
            return issue(
              "OPINION_NO_MEASURES",
              "body",
              "意见正文应提出具体处理办法或要求，如“要建立健全…”“应当加强…”。",
            )
          }
          return null
        },
      })
      break
    }
    case "request": {
      rules.push(
        {
          code: "REQUEST_RECIPIENT_MISSING",
          field: "recipient",
          check: (doc) => {
            if (!doc.recipient || doc.recipient.trim().length === 0) {
              return issue(
                "REQUEST_RECIPIENT_MISSING",
                "recipient",
                "请示必须写明单一主送机关（上级机关），主送机关不能为空。",
              )
            }
            return null
          },
        },
        {
          code: "REQUEST_CLOSING_MISSING",
          field: "body",
          check: (doc) => {
            if (!docContainsAny(doc, ["妥否，请批示", "请批示"])) {
              return issue(
                "REQUEST_CLOSING_MISSING",
                "body",
                "请示结尾应使用“妥否，请批示”等请求批示用语。",
              )
            }
            return null
          },
        },
        {
          code: "MULTI_RECIPIENT",
          field: "recipient",
          check: (doc) => {
            if (doc.recipient && doc.recipient.includes("、")) {
              return issue(
                "MULTI_RECIPIENT",
                "recipient",
                "请示应单一主送机关（一个上级机关），用顿号列出多个主送机关不符合行文规则。",
              )
            }
            return null
          },
        },
      )
      break
    }
    case "report": {
      rules.push({
        code: "REPORT_REQUEST_CLOSING_MISUSED",
        field: "body",
        check: (doc) => {
          if (docContainsAny(doc, ["妥否，请批示", "请批示"])) {
            return issue(
              "REPORT_REQUEST_CLOSING_MISUSED",
              "body",
              "报告属于汇报性公文，不应以请示用语“妥否，请批示”结尾。",
            )
          }
          return null
        },
      })
      break
    }
    case "reply": {
      rules.push(
        {
          code: "REPLY_RECIPIENT_MISSING",
          field: "recipient",
          check: (doc) => {
            if (!doc.recipient || doc.recipient.trim().length === 0) {
              return issue(
                "REPLY_RECIPIENT_MISSING",
                "recipient",
                "批复必须写明单一主送机关（请示机关），主送机关不能为空。",
              )
            }
            return null
          },
        },
        {
          code: "REPLY_OPENING_MISSING",
          field: "body",
          check: (doc) => {
            if (!docContainsAny(doc, ["收悉", "现批复如下"])) {
              return issue(
                "REPLY_OPENING_MISSING",
                "body",
                "批复正文开头应引述来文并注明“收悉”，如“你局《××请示》收悉。现批复如下”。",
              )
            }
            return null
          },
        },
        {
          code: "MULTI_RECIPIENT",
          field: "recipient",
          check: (doc) => {
            if (doc.recipient && doc.recipient.includes("、")) {
              return issue(
                "MULTI_RECIPIENT",
                "recipient",
                "批复应单一主送机关（一个下级机关），用顿号列出多个主送机关不符合行文规则。",
              )
            }
            return null
          },
        },
      )
      break
    }
    case "letter": {
      rules.push({
        code: "LETTER_IMPERATIVE_TONE",
        field: "body",
        check: (doc) => {
          if (
            docContainsAny(doc, [
              "必须执行",
              "应立即执行",
              "责令",
              "务必照办",
            ])
          ) {
            return issue(
              "LETTER_IMPERATIVE_TONE",
              "body",
              "函属于平行文（不相隶属机关之间），不应使用“必须执行”“责令”等命令式用语，应语气协商、平和。",
            )
          }
          return null
        },
      })
      break
    }
    case "minutes": {
      rules.push({
        code: "MINUTES_ATTENDEES_MISSING",
        field: "attendees",
        check: (doc) => {
          if ((doc.attendees ?? []).length === 0) {
            return issue(
              "MINUTES_ATTENDEES_MISSING",
              "attendees",
              "会议纪要应注明出席人员名单（attendees），格式为“出席：单位、姓名”。",
            )
          }
          return null
        },
      })
      break
    }
    case "announcement": {
      rules.push({
        code: "ANNOUNCEMENT_RECIPIENT_SHOULD_BE_EMPTY",
        field: "recipient",
        check: (doc) => {
          if (doc.recipient && doc.recipient.trim().length > 0) {
            return issue(
              "ANNOUNCEMENT_RECIPIENT_SHOULD_BE_EMPTY",
              "recipient",
              "通告/公告面向社会公开发布，不应填写主送机关（recipient 应为空）。",
            )
          }
          return null
        },
      })
      break
    }
  }
  return rules
}

/** 文种 → 规范（含通用规则）。key 覆盖全部 9 个 DOC_TYPES。 */
export const DOC_TYPE_SPECS: Record<DocType, DocTypeSpec> = {
  gongwen: {
    docType: "gongwen",
    name: "通知",
    promptRequirement:
      "文种为通知，采用标准正文式结构，正文开头写明目的依据，结尾可使用“特此通知”。",
    rules: [
      ...buildDocTypeRules("gongwen"),
      ...buildUniversalRules("gongwen"),
    ],
  },
  decision: {
    docType: "decision",
    name: "决定",
    promptRequirement:
      "文种为决定，正文须分条列项写明决定事项：每条用一个 type:\"h1\" 标题（一级标题，text 不带序号，引擎自动编号），标题下用 p 段落写明政策依据与执行要求，语气庄重、明确。",
    rules: [
      ...buildDocTypeRules("decision"),
      ...buildUniversalRules("decision"),
    ],
  },
  opinion: {
    docType: "opinion",
    name: "意见",
    promptRequirement:
      "文种为意见，正文应分条提出原则性要求或工作建议，语气平实、可操作。",
    rules: [
      ...buildDocTypeRules("opinion"),
      ...buildUniversalRules("opinion"),
    ],
  },
  request: {
    docType: "request",
    name: "请示",
    promptRequirement:
      "文种为请示，主送机关（recipient）必填且只写一个上级机关；正文写明请示事项、理由与建议，结尾使用“妥否，请批示”。",
    rules: [
      ...buildDocTypeRules("request"),
      ...buildUniversalRules("request"),
    ],
  },
  report: {
    docType: "report",
    name: "报告",
    promptRequirement:
      "文种为报告，主送机关填写上级机关；正文汇报工作情况、存在问题及下一步打算，结尾不使用请示用语。",
    rules: [
      ...buildDocTypeRules("report"),
      ...buildUniversalRules("report"),
    ],
  },
  reply: {
    docType: "reply",
    name: "批复",
    promptRequirement:
      "文种为批复，主送机关（recipient）必填且为单一下级机关；正文开头采用“你（单位）《××请示》收悉。现批复如下”，随后给出明确的批复意见。",
    rules: [
      ...buildDocTypeRules("reply"),
      ...buildUniversalRules("reply"),
    ],
  },
  letter: {
    docType: "letter",
    name: "函",
    promptRequirement:
      "文种为函，用于平行或不相隶属机关之间商洽工作、询问答复，语气协商、平和，不使用命令式表述。",
    rules: [
      ...buildDocTypeRules("letter"),
      ...buildUniversalRules("letter"),
    ],
  },
  minutes: {
    docType: "minutes",
    name: "会议纪要",
    promptRequirement:
      "文种为会议纪要，正文开头须写明会议名称、时间、地点、参加人员（或主持人），随后按议题分条记录议定事项；必须在 attendees、absentees、observers 三个字段中分别给出出席、请假、列席人员名单（格式为“单位、姓名”，多人用“、”连接），正文末尾的版记按“出席：…\n请假：…\n列席：…”顺序编排。",
    rules: [
      ...buildDocTypeRules("minutes"),
      ...buildUniversalRules("minutes"),
    ],
  },
  announcement: {
    docType: "announcement",
    name: "通告/公告",
    promptRequirement:
      "文种为通告/公告，面向社会公开发布，无主送机关（recipient 留空）；正文写明发布事项、时间、范围及要求。",
    rules: [
      ...buildDocTypeRules("announcement"),
      ...buildUniversalRules("announcement"),
    ],
  },
}
