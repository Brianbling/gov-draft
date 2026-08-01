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
  /** 表单辅助模式下可编辑的要素子集（不含 body，正文走自然语言）。 */
  formFields: FormField[]
  /** 该文种默认是否加盖公章（GB/T 9704 §6.4 落款盖章惯例：决定/请示/批复/函等须盖章）。 */
  sealDefault: boolean
}

export interface DocFormatRequirement {
  code: string
  field: string
  check: (doc: LegalDoc) => FormatIssue | null
}

/** 表单辅助模式下可编辑的要素子集（按 GB/T 9704 各文种要素构成，不含 body——正文走自然语言）。 */
export type FormFieldKey =
  | "title"
  | "docNumber"
  | "recipient"
  | "issuer"
  | "date"
  | "securityLevel"
  | "urgency"
  | "attachments"
  | "cc"
  | "attendees"
  | "absentees"
  | "observers"
  | "seal"

export interface FormField {
  /** 映射的 LegalDoc 字段名。 */
  key: FormFieldKey
  /** 中文标签（表单展示用）。 */
  label: string
  /** 控件类型：text 单行、array 多值、boolean 开关。 */
  type: "text" | "array" | "boolean"
  /** 该文种此要素是否必填（表单校验提示用）。 */
  required?: boolean
  placeholder?: string
}

function issue(
  code: string,
  field: string,
  message: string,
  severity?: "info" | "warning" | "error",
): FormatIssue {
  return { field, code, message, ...(severity ? { severity } : {}) }
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
 * 引述语境分两类：
 * - 前置引述词：书名号前的引述/依据词（"你局报送的《××请示》"、"依据《××法》"）；
 * - 后置收尾词：书名号后的收尾语（"《××请示》收悉"、"此复"）。
 * 依据/遵照等词常出现在书名号之后（"…一并印发，请遵照执行"），若作为后置词会把真实
 * 附件声明误判为引述，因此只作前置词。前置窗口 12 字已限定近距，无需锚定。
 */
const CITATION_BEFORE_PATTERN =
  /(?:你局|你单位|你厅|你部|你公司|你处|贵局|来文|依据|根据|按照|遵照|参照)/
const CITATION_AFTER_PATTERN = /^(?:收悉|此复)/

/**
 * 判断单个书名号是否处于引述语境（引述来文/法规名则跳过附件核对）：
 * 1. 书名号前紧邻"附件："或"另附"/"附" → 真实附件声明，无论附近有无引述词都参与核对；
 * 2. 书名号前 12 字内出现前置引述词（"你局报送的《××请示》"、"依据《××法》" → 引述）；
 * 3. 书名号后 12 字内出现后置收尾词（"《××请示》收悉" → 引述，"《××请示》请查收"不是）。
 * 同一段里真实声明的"附件：《实施方案》"仍参与核对。
 */
function isCitationTitle(paragraph: string, title: string): boolean {
  const idx = paragraph.indexOf(`《${title}》`)
  if (idx < 0) return false
  const before6 = paragraph.slice(Math.max(0, idx - 6), idx)
  if (/附件[：:]?$|另附$|附$/.test(before6)) return false
  const before = paragraph.slice(Math.max(0, idx - 12), idx)
  if (CITATION_BEFORE_PATTERN.test(before)) return true
  const after = paragraph.slice(idx + title.length + 2, idx + title.length + 2 + 12)
  return CITATION_AFTER_PATTERN.test(after)
}

/**
 * 附件一致性：正文用《书名号》提及的名称与 attachments[] 交叉核对。
 * 只有当文档明确声明了 attachments 时才判定"漏列"——正文引用的《××请示》这类
 * 引述（未声明附件）属于正常行文，不报；反之未声明 attachments 也无从谈起漏列。
 * 引述语境（如批复"你局《××请示》收悉"）的《》名按逐条书名号判定，仅跳过真正
 * 引述来文的书名号；同一段里真实声明的"附件：《实施方案》"仍参与核对。宁可漏报不误报。
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
        if (isCitationTitle(paragraph.text, title)) continue
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

/** 正文 p 段首“一、”等序号残留：只提示不自动改（信息保留，避免误剥合法列举）。 */
const PARAGRAPH_LEADING_ORDER_PATTERN = /^[一二三四五六七八九十]+、/

function buildParagraphLeadingOrderRule(): DocFormatRequirement {
  return {
    code: "P_LEADING_ORDER_SUGGESTION",
    field: "body",
    check: (doc) => {
      const hit = doc.body.find(
        (paragraph) =>
          paragraph.type === "p" &&
          PARAGRAPH_LEADING_ORDER_PATTERN.test(paragraph.text),
      )
      if (hit) {
        return issue(
          "P_LEADING_ORDER_SUGGESTION",
          "body",
          "正文段首的“一、”序号建议改用 h1/h2 标题层级，避免渲染时序号与段落混排。",
          "warning",
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
    buildParagraphLeadingOrderRule(),
  ]
  if (docType === "minutes") {
    rules.push(buildMinutesDecisionRule())
  }
  return rules
}

/** 表单字段构造器：单行文本。 */
function textField(
  key: FormFieldKey,
  label: string,
  opts?: { required?: boolean; placeholder?: string },
): FormField {
  return { key, label, type: "text", ...opts }
}

/** 表单字段构造器：多值数组。 */
function arrayField(
  key: FormFieldKey,
  label: string,
  opts?: { required?: boolean; placeholder?: string },
): FormField {
  return { key, label, type: "array", ...opts }
}

/** 表单字段构造器：布尔开关。 */
function booleanField(
  key: FormFieldKey,
  label: string,
  opts?: { required?: boolean },
): FormField {
  return { key, label, type: "boolean", ...opts }
}

/**
 * 各文种表单可编辑要素（v2 表单辅助模式用）。
 * 按 GB/T 9704 各文种要素构成差异化：gongwen 要素全（通用下行文）；decision 决定事项靠正文，
 * 不设附件/抄送；opinion 意见可抄送相关单位；request/reply 主送必填且单一；report 汇报性通常
 * 不盖章；letter 平行文要素全；minutes 名单类；announcement 面向社会无主送机关。
 */
function buildFormFields(docType: DocType): FormField[] {
  switch (docType) {
    case "gongwen":
      return [
        textField("title", "标题", { required: true, placeholder: "关于…的通知" }),
        textField("docNumber", "发文字号", { placeholder: "×政发〔2026〕×号" }),
        textField("recipient", "主送机关", { placeholder: "各区人民政府，市政府各委、办、局" }),
        textField("issuer", "发文机关署名"),
        textField("date", "成文日期", { placeholder: "2026-08-01" }),
        arrayField("attachments", "附件"),
        arrayField("cc", "抄送机关"),
        booleanField("seal", "加盖公章"),
      ]
    case "decision":
      return [
        textField("title", "标题", { required: true, placeholder: "关于…的决定" }),
        textField("docNumber", "发文字号", { placeholder: "×政发〔2026〕×号" }),
        textField("recipient", "主送机关"),
        textField("date", "成文日期", { placeholder: "2026-08-01" }),
        booleanField("seal", "加盖公章"),
      ]
    case "opinion":
      return [
        textField("title", "标题", { required: true, placeholder: "关于…的意见" }),
        textField("docNumber", "发文字号", { placeholder: "×政发〔2026〕×号" }),
        textField("recipient", "主送机关"),
        textField("date", "成文日期", { placeholder: "2026-08-01" }),
        arrayField("cc", "抄送机关"),
      ]
    case "request":
      return [
        textField("title", "标题", { required: true, placeholder: "关于…的请示" }),
        textField("docNumber", "发文字号", { placeholder: "×政发〔2026〕×号" }),
        textField("recipient", "主送机关", { required: true, placeholder: "省人民政府" }),
        textField("issuer", "发文机关署名"),
        textField("date", "成文日期", { placeholder: "2026-08-01" }),
        arrayField("attachments", "附件"),
        booleanField("seal", "加盖公章"),
      ]
    case "report":
      return [
        textField("title", "标题", { required: true, placeholder: "关于…的报告" }),
        textField("docNumber", "发文字号", { placeholder: "×政发〔2026〕×号" }),
        textField("recipient", "主送机关", { placeholder: "市人民政府" }),
        textField("issuer", "发文机关署名"),
        textField("date", "成文日期", { placeholder: "2026-08-01" }),
        arrayField("attachments", "附件"),
      ]
    case "reply":
      return [
        textField("title", "标题", { required: true, placeholder: "关于同意…的批复" }),
        textField("docNumber", "发文字号", { placeholder: "×政函〔2026〕×号" }),
        textField("recipient", "主送机关", { required: true, placeholder: "市财政局" }),
        textField("issuer", "发文机关署名"),
        textField("date", "成文日期", { placeholder: "2026-08-01" }),
        booleanField("seal", "加盖公章"),
      ]
    case "letter":
      return [
        textField("title", "标题", { required: true, placeholder: "关于商请…的函" }),
        textField("docNumber", "发文字号", { placeholder: "×政函〔2026〕×号" }),
        textField("recipient", "主送机关", { placeholder: "××大学" }),
        textField("issuer", "发文机关署名"),
        textField("date", "成文日期", { placeholder: "2026-08-01" }),
        arrayField("attachments", "附件"),
        booleanField("seal", "加盖公章"),
      ]
    case "minutes":
      return [
        textField("title", "标题", { required: true, placeholder: "××会议纪要" }),
        arrayField("attendees", "出席人员", { required: true, placeholder: "张三（市委办）" }),
        arrayField("absentees", "请假人员", { placeholder: "李四（市政府办）" }),
        arrayField("observers", "列席人员", { placeholder: "王五（列席）" }),
        textField("date", "会议日期", { placeholder: "2026-08-01" }),
        booleanField("seal", "加盖公章"),
      ]
    case "announcement":
      return [
        textField("title", "标题", { required: true, placeholder: "关于…的通告" }),
        textField("docNumber", "发文字号", { placeholder: "×府发〔2026〕×号" }),
        textField("issuer", "发布机关署名"),
        textField("date", "发布日期", { placeholder: "2026-08-01" }),
        arrayField("attachments", "附件"),
        booleanField("seal", "加盖公章"),
      ]
  }
}

/** 各文种默认盖章：决定/请示/批复/函/意见等依惯例盖章，通告/纪要/报告一般用版记替代。 */
function buildSealDefault(docType: DocType): boolean {
  switch (docType) {
    case "decision":
    case "request":
    case "reply":
    case "letter":
      return true
    default:
      return false
  }
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
    formFields: buildFormFields("gongwen"),
    sealDefault: buildSealDefault("gongwen"),
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
    formFields: buildFormFields("decision"),
    sealDefault: buildSealDefault("decision"),
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
    formFields: buildFormFields("opinion"),
    sealDefault: buildSealDefault("opinion"),
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
    formFields: buildFormFields("request"),
    sealDefault: buildSealDefault("request"),
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
    formFields: buildFormFields("report"),
    sealDefault: buildSealDefault("report"),
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
    formFields: buildFormFields("reply"),
    sealDefault: buildSealDefault("reply"),
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
    formFields: buildFormFields("letter"),
    sealDefault: buildSealDefault("letter"),
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
    formFields: buildFormFields("minutes"),
    sealDefault: buildSealDefault("minutes"),
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
    formFields: buildFormFields("announcement"),
    sealDefault: buildSealDefault("announcement"),
  },
}
