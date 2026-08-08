import type { ParserConfig } from "../../../schema"
import type { MdPluginWithOptions } from "../../types"
import { toCssCustomProperty } from "../../../compiler/css-variable"
import { sanitizeCssValue } from "../../../utils/css-sanitize-utils"
import { resolveCanonicalLocalStylePath } from "../../../utils/local-style-path-utils"

function findDescriptorSeparatorIndex(descriptor: string): number {
  const colonIndex = descriptor.indexOf(":")
  const fullWidthColonIndex = descriptor.indexOf("：")

  if (colonIndex === -1) {
    return fullWidthColonIndex
  }
  if (fullWidthColonIndex === -1) {
    return colonIndex
  }

  return Math.min(colonIndex, fullWidthColonIndex)
}

function normalizeLocalStyleValue(rawValue: string): string {
  const sanitizedValue = sanitizeCssValue(rawValue)
  if (!sanitizedValue) {
    return ""
  }

  const firstChar = sanitizedValue[0]
  const lastChar = sanitizedValue[sanitizedValue.length - 1]
  const isQuoted =
    (firstChar === "'" && lastChar === "'") ||
    (firstChar === '"' && lastChar === '"')
  if (!isQuoted) {
    return sanitizedValue
  }

  return sanitizedValue.slice(1, -1).trim()
}

function resolveLocalStyleTargetPath(
  key: string,
  options: ParserConfig
): string | null {
  const directPath = resolveCanonicalLocalStylePath(key)
  if (directPath) {
    return directPath
  }

  const aliasMapping = options.localStyleAliases ?? {}
  if (!Object.prototype.hasOwnProperty.call(aliasMapping, key)) {
    return null
  }

  const aliasTarget = aliasMapping[key]
  if (typeof aliasTarget !== "string") {
    return null
  }

  return resolveCanonicalLocalStylePath(aliasTarget)
}

export type LocalStyleDescriptorIssueReason =
  | "badSeparator"
  | "emptyValue"
  | "unknownKey"

export interface LocalStyleDescriptorIssue {
  segment: string
  reason: LocalStyleDescriptorIssueReason
}

type SegmentParseResult =
  | { kind: "ok"; declaration: string }
  | { kind: "skip"; reason: LocalStyleDescriptorIssueReason }

/**
 * 容器附加 class 段（如 `class: keep-together`）：不产出 CSS 变量，而是给
 * 容器 div 追加 class。用于版式结构标记——分页器据此把落款保持为整块
 * （keep-together）、上行文文号/签发人同行（doc-number-line）、红色分隔线
 * （red-rule-line）。在 descriptor 解析前剥离，不落入 CSS 变量、也不上报
 * unknownKey 告警。
 */
const CONTAINER_CLASS_SEGMENT_PATTERN = /^class\s*[:：]\s*(.+)$/

export function isClassSegment(segment: string): boolean {
  return CONTAINER_CLASS_SEGMENT_PATTERN.test(segment.trim())
}

export function extractClassSegments(descriptor: string): string[] {
  return descriptor
    .split(/[;；]/)
    .map((segment) => segment.trim())
    .filter(isClassSegment)
    .map((segment) => {
      const match = segment.match(CONTAINER_CLASS_SEGMENT_PATTERN)
      return match?.[1]?.trim() ?? ""
    })
    .filter(Boolean)
}

function parseLocalStyleSegment(
  segment: string,
  options: ParserConfig
): SegmentParseResult {
  if (isClassSegment(segment)) {
    // 类段由 extractClassSegments 处理，不进入 CSS 变量声明。
    return { kind: "skip", reason: "unknownKey" }
  }
  const separatorIndex = findDescriptorSeparatorIndex(segment)
  if (separatorIndex <= 0) {
    return { kind: "skip", reason: "badSeparator" }
  }

  const key = segment.slice(0, separatorIndex).trim()
  const rawValue = segment.slice(separatorIndex + 1).trim()
  if (!key || !rawValue) {
    return { kind: "skip", reason: "emptyValue" }
  }

  const normalizedValue = normalizeLocalStyleValue(rawValue)
  if (!normalizedValue) {
    return { kind: "skip", reason: "emptyValue" }
  }

  const targetPath = resolveLocalStyleTargetPath(key, options)
  if (!targetPath) {
    return { kind: "skip", reason: "unknownKey" }
  }

  const cssVariable = toCssCustomProperty(targetPath)
  return { kind: "ok", declaration: `${cssVariable}: ${normalizedValue};` }
}

function parseMultiLocalStyleDescriptors(
  descriptor: string,
  options: ParserConfig
): string {
  const segments = descriptor
    .split(/[;；]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (segments.length === 0) {
    return ""
  }

  const declarations: string[] = []
  for (const segment of segments) {
    const result = parseLocalStyleSegment(segment, options)
    if (result.kind === "ok") {
      declarations.push(result.declaration)
    }
  }

  return declarations.length > 0 ? declarations.join(" ") : ""
}

/**
 * Report which segments of a `:::` descriptor failed to resolve, so the editor
 * can surface a visible warning instead of the render path silently dropping
 * them. Engine-only: reasons are i18n-free codes; the UI layer translates.
 */
export function collectLocalStyleDescriptorIssues(
  descriptor: string,
  options: ParserConfig
): LocalStyleDescriptorIssue[] {
  const segments = descriptor
    .split(/[;；]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (segments.length === 0) {
    return []
  }

  const issues: LocalStyleDescriptorIssue[] = []
  for (const segment of segments) {
    if (isClassSegment(segment)) {
      continue
    }
    const result = parseLocalStyleSegment(segment, options)
    if (result.kind === "skip") {
      issues.push({ segment, reason: result.reason })
    }
  }
  return issues
}

/**
 * Minimal interface capturing the StateBlock shape used by this plugin.
 * Narrower than markdown-it's full StateBlock — only declares the
 * members we actually access.
 */
interface RuleBlockState {
  src: string
  bMarks: number[]
  tShift: number[]
  eMarks: number[]
  line: number
  push(
    type: string,
    tag: string,
    nesting: number
  ): import("markdown-it/lib/token.mjs").default
  md: {
    block: {
      tokenize(state: RuleBlockState, startLine: number, endLine: number): void
    }
  }
}

export const localStyleContainerPlugin: MdPluginWithOptions<ParserConfig> = (
  md,
  options
) => {
  const parserOptions = options as ParserConfig

  const ruleHandler = (
    state: RuleBlockState,
    startLine: number,
    endLine: number,
    silent: boolean
  ): boolean => {
    const startPos =
      (state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0)
    const maxPos = state.eMarks[startLine] ?? startPos
    const firstLine = state.src.slice(startPos, maxPos).trim()

    if (!firstLine.startsWith(":::")) {
      return false
    }

    const descriptor = firstLine.slice(3).trim()
    const classSegments = extractClassSegments(descriptor)
    const styleText = parseMultiLocalStyleDescriptors(descriptor, parserOptions)
    if (!styleText && classSegments.length === 0) {
      return false
    }

    let nesting = 1
    let nextLine = startLine + 1
    while (nextLine < endLine) {
      const lineStart =
        (state.bMarks[nextLine] ?? 0) + (state.tShift[nextLine] ?? 0)
      const lineEnd = state.eMarks[nextLine] ?? lineStart
      const lineText = state.src.slice(lineStart, lineEnd).trim()
      if (lineText.startsWith(":::")) {
        const innerDescriptor = lineText.slice(3).trim()
        if (innerDescriptor) {
          nesting += 1
        } else {
          nesting -= 1
          if (nesting === 0) {
            break
          }
        }
      }
      nextLine += 1
    }

    if (nextLine >= endLine) {
      return false
    }

    if (silent) {
      return true
    }

    const open = state.push("local_style_container_open", "div", 1)
    open.block = true
    open.map = [startLine, nextLine]
    open.attrSet(
      "class",
      ["local-style-container", ...classSegments].join(" ")
    )
    if (styleText) {
      open.attrSet("style", styleText)
    }

    state.md.block.tokenize(state, startLine + 1, nextLine)

    const close = state.push("local_style_container_close", "div", -1)
    close.block = true

    state.line = nextLine + 1
    return true
  }

  md.block.ruler.before("fence", "local_style_container", ruleHandler, {
    alt: ["paragraph", "reference", "blockquote"],
  })
}
