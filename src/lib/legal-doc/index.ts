export {
  DOC_TYPES,
  LegalParagraphSchema,
  LegalDocSchema,
  parseLegalDoc,
  LegalDocParseError,
  LEGAL_DOC_PARSE_FAILED,
  LEGAL_DOC_MISSING_FIELD,
  LEGAL_DOC_UNSUPPORTED_TYPE,
  LEGAL_DOC_MISSING_TITLE,
  LEGAL_DOC_EMPTY_BODY,
} from "./types"
export type { DocType, LegalParagraph, LegalDoc } from "./types"
export { buildSystemPrompt, buildUserPrompt } from "./prompt"
export { toMarkdown, patchMarkdownElements } from "./to-markdown"
export { checkFormat } from "./format-check"
export type { FormatIssue } from "./format-check"
export {
  reviewDocument,
  checkDocFormat,
  normalizeText,
  normalizeDoc,
  repairDoc,
  repairsToIssues,
} from "./review"
export type { DocFormatRequirement, RepairInfo } from "./review"
