import type { DocType, LegalDoc } from "../types"
import type { FormatIssue } from "../format-check"

/**
 * L2 文种规范审查：按 GB/T 9704-2012 各文种格式要求逐条校验。
 * 一个可扩展的 registry：`Record<DocType, DocFormatRequirement[]>`。
 * 规则字段：
 * - code    机器可读错误码（供 i18n/测试定位）；
 * - field   问题归属字段（展示定位用）；
 * - check   纯函数，返回 Issue 或 null。
 */

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

const minutesRules: DocFormatRequirement[] = [
  {
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
  },
]

const requestRules: DocFormatRequirement[] = [
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
]

const replyRules: DocFormatRequirement[] = [
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
]

const reportRules: DocFormatRequirement[] = [
  {
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
  },
]

const announcementRules: DocFormatRequirement[] = [
  {
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
  },
]

const decisionRules: DocFormatRequirement[] = [
  {
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
  },
]

/**
 * 通知（gongwen）。条例第八条（八）：适用于发布、传达要求下级机关执行和
 * 有关单位和个人周知或者执行的事项，批转、转发公文。
 * 批转/转发型通知正文必须先引述被批转文件的标题。
 */
const gongwenRules: DocFormatRequirement[] = [
  {
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
  },
]

/**
 * 意见（opinion）。条例第八条（七）：适用于对重要问题提出见解和处理办法。
 * 正文应针对问题给出原则性要求与可操作的处理办法。
 */
const opinionRules: DocFormatRequirement[] = [
  {
    code: "OPINION_NO_MEASURES",
    field: "body",
    check: (doc) => {
      const texts = doc.body.map((paragraph) => paragraph.text)
      const hasMeasures = texts.some(
        (text) =>
          /(要|应当|必须|建立健全|完善|加强|推进|抓好|严格落实)/.test(text) &&
          !/^(关于|根据|为(了)?|依据)/.test(text)
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
  },
]

/**
 * 函（letter）。条例第八条（十四）：适用于不相隶属机关之间商洽工作、
 * 询问和答复问题、请求批准和答复审批事项。
 * 函是平行文，语气协商，不使用命令式/指示性用语。
 */
const letterRules: DocFormatRequirement[] = [
  {
    code: "LETTER_IMPERATIVE_TONE",
    field: "body",
    check: (doc) => {
      if (docContainsAny(doc, ["必须执行", "应立即执行", "责令", "务必照办"])) {
        return issue(
          "LETTER_IMPERATIVE_TONE",
          "body",
          "函属于平行文（不相隶属机关之间），不应使用“必须执行”“责令”等命令式用语，应语气协商、平和。",
        )
      }
      return null
    },
  },
]

/**
 * 文种 → 格式要求 registry，覆盖全部 9 个文种。
 * 规则依据《党政机关公文处理工作条例》第八条各文种的定义（见上方注释）。
 */
const DOC_FORMAT_REQUIREMENTS: Partial<Record<DocType, DocFormatRequirement[]>> = {
  minutes: minutesRules,
  request: requestRules,
  reply: replyRules,
  report: reportRules,
  announcement: announcementRules,
  decision: decisionRules,
  gongwen: gongwenRules,
  opinion: opinionRules,
  letter: letterRules,
}

/**
 * 对给定 LegalDoc 执行 L2 文种规范审查。文种未注册或规则通过时返回空数组。
 */
export function checkDocFormat(doc: LegalDoc): FormatIssue[] {
  const rules = DOC_FORMAT_REQUIREMENTS[doc.docType] ?? []
  const issues: FormatIssue[] = []
  for (const rule of rules) {
    const found = rule.check(doc)
    if (found) issues.push(found)
  }
  return issues
}
