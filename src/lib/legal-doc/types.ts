import { z } from "zod"

/**
 * 公文文种（DocType）枚举 → 中文文种名对应关系：
 * - gongwen      → 通知
 * - decision     → 决定
 * - opinion      → 意见
 * - request      → 请示
 * - report       → 报告
 * - reply        → 批复
 * - letter       → 函
 * - minutes      → 会议纪要
 * - announcement → 通告/公告
 */
export const DOC_TYPES = [
  "gongwen",
  "decision",
  "opinion",
  "request",
  "report",
  "reply",
  "letter",
  "minutes",
  "announcement",
] as const
export type DocType = (typeof DOC_TYPES)[number]

export const LegalParagraphSchema = z.object({
  type: z.enum(["p", "h1", "h2"]),
  text: z.string().min(1, "Paragraph text must be non-empty"),
})
export type LegalParagraph = z.infer<typeof LegalParagraphSchema>

/**
 * Structured representation of a generated official document (公文).
 * Mirrors the GB/T 9704-2012 layout: 版头 (security/urgency/docNumber),
 * 标题, 主送机关, 正文, 版记 (attachments/issuer/date/cc/printing).
 */
export const LegalDocSchema = z.object({
  docType: z.enum(DOC_TYPES),
  title: z.string().min(1, "Title must be non-empty"),
  docNumber: z.string().optional(),
  securityLevel: z.string().optional(),
  urgency: z.string().optional(),
  recipient: z.string().optional(),
  body: z
    .array(LegalParagraphSchema)
    .min(1, "Body must contain at least one paragraph"),
  attachments: z.array(z.string().min(1)).optional(),
  issuer: z.string().optional(),
  date: z.string().optional(),
  cc: z.array(z.string().min(1)).optional(),
  printingOffice: z.string().optional(),
  printingDate: z.string().optional(),
  /** 会议纪要（minutes）专用：出席人员名单，如“张三（单位）”。 */
  attendees: z.array(z.string().min(1)).optional(),
  /** 会议纪要（minutes）专用：请假人员名单。 */
  absentees: z.array(z.string().min(1)).optional(),
  /** 会议纪要（minutes）专用：列席人员名单。 */
  observers: z.array(z.string().min(1)).optional(),
  /** 是否需要加盖公章。LLM 输出中可省略该字段（默认不盖章）。 */
  seal: z.boolean().optional(),
})
export type LegalDoc = z.infer<typeof LegalDocSchema>

export const LEGAL_DOC_PARSE_FAILED = "LEGAL_DOC_PARSE_FAILED"
export const LEGAL_DOC_MISSING_FIELD = "LEGAL_DOC_MISSING_FIELD"
export const LEGAL_DOC_UNSUPPORTED_TYPE = "LEGAL_DOC_UNSUPPORTED_TYPE"
export const LEGAL_DOC_MISSING_TITLE = "LEGAL_DOC_MISSING_TITLE"
export const LEGAL_DOC_EMPTY_BODY = "LEGAL_DOC_EMPTY_BODY"

export class LegalDocParseError extends Error {
  readonly code: string
  readonly issues?: z.ZodIssue[]

  constructor(code: string, message: string, issues?: z.ZodIssue[]) {
    super(message)
    this.name = "LegalDocParseError"
    this.code = code
    this.issues = issues
  }
}

function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?```$/, "")
    .trim()
}

/**
 * Parse an LLM-produced JSON blob into a LegalDoc. Accepts raw JSON text or a
 * markdown fenced block (```json ... ```). Throws LegalDocParseError with a
 * machine-readable code on any failure.
 */
export function parseLegalDoc(raw: string): LegalDoc {
  const source = stripCodeFence(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    throw new LegalDocParseError(
      LEGAL_DOC_PARSE_FAILED,
      `LegalDoc JSON is not valid: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const result = LegalDocSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues

    // 顶层非对象（数组/字符串/null 等）：zod 的 invalid_type issue path 为空，
    // 若走通用分支会拼出 "Missing or invalid field(s): " 的空列表，给明确提示。
    if (issues.some((issue) => issue.path.length === 0)) {
      throw new LegalDocParseError(
        LEGAL_DOC_PARSE_FAILED,
        "Response must be a JSON object matching the LegalDoc schema",
        issues,
      )
    }

    const byPath = new Map<string, z.ZodIssue>()
    for (const issue of issues) {
      byPath.set(issue.path.join("."), issue)
    }
    const hasIssue = (path: string) => byPath.has(path)

    // 细分错误码，让空正文/缺标题/非法文种落到专属 i18n 文案，而非通用"解析失败"。
    if (hasIssue("docType") && !hasIssue("title")) {
      throw new LegalDocParseError(
        LEGAL_DOC_UNSUPPORTED_TYPE,
        `Unsupported or missing docType`,
        issues,
      )
    }
    if (hasIssue("title") && !hasIssue("body")) {
      throw new LegalDocParseError(
        LEGAL_DOC_MISSING_TITLE,
        `Missing or invalid field(s): title`,
        issues,
      )
    }
    if (hasIssue("body")) {
      throw new LegalDocParseError(
        LEGAL_DOC_EMPTY_BODY,
        `Missing or invalid field(s): body`,
        issues,
      )
    }

    const missing = issues
      .filter((issue) => issue.code === "invalid_type")
      .map((issue) => issue.path.join("."))
    const code =
      missing.length > 0 ? LEGAL_DOC_MISSING_FIELD : LEGAL_DOC_PARSE_FAILED
    const detail =
      missing.length > 0
        ? `Missing or invalid field(s): ${missing.join(", ")}`
        : `LegalDoc failed schema validation: ${issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`
    throw new LegalDocParseError(code, detail, issues)
  }

  return result.data
}
