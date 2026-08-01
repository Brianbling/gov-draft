import { ValidationErrorCode } from './types'
import type { ValidationIssue, ValidationResult, ValidationErrorCode as ErrorCode } from './types'
import { isConvertibleCssLength } from '../utils/page-metrics-utils'
import { evaluateNumericTemplateExpression } from '../utils/template-expression-utils'
import { validateLocalStyleTargetPath } from '../utils/local-style-path-utils'
import {
  CSS_LENGTH_PATTERN,
  CSS_LINE_HEIGHT_PATTERN,
  CSS_PARAGRAPH_SPACING_PATTERN,
  CSS_COLOR_PATTERN,
  PAGINATION_EXPRESSION_ALLOWED_PATTERN,
} from '../patterns/css-patterns'

const FONT_WEIGHT_SET = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900])
const ALIGN_SET = new Set(['left', 'center', 'right', 'justify'])
const ENTER_STYLE_SET = new Set(['paragraph', 'lineBreak'])
const PAGE_ORIENTATION_SET = new Set(['portrait', 'landscape'])
const PAGINATION_VERTICAL_ANCHOR_SET = new Set(['top', 'bottom'])
const PAGINATION_HORIZONTAL_ANCHOR_SET = new Set(['left', 'center', 'right', 'outside', 'inside'])
const PAGINATION_NUMBER_STYLE_SET = new Set(['arabic', 'roman', 'zhHans', 'zhHant'])

type AnyRecord = Record<string, unknown>

type Validator = (value: unknown, path: string, issues: ValidationIssue[]) => void

function patternValidator(pattern: RegExp, code: ErrorCode): Validator {
  return (value, path, issues) => {
    if (typeof value !== 'string' || !pattern.test(value.trim())) {
      pushError(issues, path, code)
    }
  }
}

function setValidator(validSet: Set<string | number>, code: ErrorCode): Validator {
  return (value, path, issues) => {
    if (!validSet.has(value as never)) {
      pushError(issues, path, code)
    }
  }
}

function typeValidator(expectedType: string, code: ErrorCode): Validator {
  return (value, path, issues) => {
    if (typeof value !== expectedType) {
      pushError(issues, path, code)
    }
  }
}

export function validateRule(ruleConfig: unknown): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!ruleConfig) {
    pushError(issues, 'rule', ValidationErrorCode.RULE_CONFIG_EMPTY)
    return buildValidationResult(issues)
  }

  if (typeof ruleConfig !== 'object') {
    pushError(issues, 'rule', ValidationErrorCode.RULE_CONFIG_OBJECT)
    return buildValidationResult(issues)
  }

  const rule = ruleConfig as AnyRecord

  validateString(rule.name, 'name', issues)
  validateString(rule.version, 'version', issues)

  validateContent(rule.content, issues)
  validatePage(rule.page, 'page', issues)
  validatePagination(rule.pagination, issues)
  validateParser(rule.parser, issues, 'parser')

  return buildValidationResult(issues)
}

function buildValidationResult(issues: ValidationIssue[]): ValidationResult {
  const errors = issues
    .filter((issue) => issue.level === 'error')
    .map((issue) => `${issue.path}: ${issue.code}`)

  return {
    valid: errors.length === 0,
    errors,
    issues
  }
}

function pushError(
  issues: ValidationIssue[],
  path: string,
  code: ErrorCode,
  params?: Record<string, unknown>,
): void {
  issues.push({
    level: 'error',
    path,
    code,
    message: '',
    params,
  })
}

function isObject(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    pushError(issues, path, ValidationErrorCode.NON_EMPTY_STRING)
  }
}

function validateCssLength(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value === 'number' && value === 0) {
    return
  }

  if (typeof value !== 'string' || !CSS_LENGTH_PATTERN.test(value.trim())) {
    pushError(issues, path, ValidationErrorCode.CSS_LENGTH)
  }
}

const validateCssLineHeight = patternValidator(CSS_LINE_HEIGHT_PATTERN, ValidationErrorCode.CSS_LINE_HEIGHT)

const validateCssColor = patternValidator(CSS_COLOR_PATTERN, ValidationErrorCode.CSS_COLOR)

const validateFontWeight = setValidator(FONT_WEIGHT_SET, ValidationErrorCode.FONT_WEIGHT)

const validateTextAlign = setValidator(ALIGN_SET, ValidationErrorCode.TEXT_ALIGN)

const validateBoolean = typeValidator('boolean', ValidationErrorCode.BOOLEAN)

const validateEnterStyle = setValidator(ENTER_STYLE_SET, ValidationErrorCode.ENTER_STYLE)

// Kept custom: '' and numeric-0 are accepted as valid spacing values, which a
// plain patternValidator would reject.
const validateCssParagraphSpacing: Validator = (value, path, issues) => {
  if (value === '') {
    return
  }

  if (typeof value === 'number' && value === 0) {
    return
  }

  if (typeof value !== 'string' || !CSS_PARAGRAPH_SPACING_PATTERN.test(value.trim())) {
    pushError(issues, path, ValidationErrorCode.CSS_PARAGRAPH_SPACING)
  }
}

// Optional CJK character-grid target: a positive integer, or null/undefined to
// disable. Anything else (0, negative, non-integer, non-number) is invalid.
const validateCharsPerLine: Validator = (value, path, issues) => {
  if (value === undefined || value === null) {
    return
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    pushError(issues, path, ValidationErrorCode.CHARS_PER_LINE)
  }
}

function validateContentItem(contentItem: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(contentItem)) {
    pushError(issues, path, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
    return
  }

  if (!isObject(contentItem.fonts)) {
    pushError(issues, `${path}.fonts`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    validateString(contentItem.fonts.latinFamily, `${path}.fonts.latinFamily`, issues)
    validateString(contentItem.fonts.cjkFamily, `${path}.fonts.cjkFamily`, issues)
    if (contentItem.fonts.cnQuoteFamily !== undefined) {
      validateString(contentItem.fonts.cnQuoteFamily, `${path}.fonts.cnQuoteFamily`, issues)
    }
    if (contentItem.fonts.cnBookTitleFamily !== undefined) {
      validateString(contentItem.fonts.cnBookTitleFamily, `${path}.fonts.cnBookTitleFamily`, issues)
    }
  }

  if (!isObject(contentItem.style)) {
    pushError(issues, `${path}.style`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    validateCssLength(contentItem.style.size, `${path}.style.size`, issues)
    validateFontWeight(contentItem.style.weight, `${path}.style.weight`, issues)
    if (!isObject(contentItem.style.colors)) {
      pushError(issues, `${path}.style.colors`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
    } else {
      validateCssColor(contentItem.style.colors.text, `${path}.style.colors.text`, issues)
      validateCssColor(contentItem.style.colors.background, `${path}.style.colors.background`, issues)
    }

    if (contentItem.style.index !== undefined && contentItem.style.index !== null && typeof contentItem.style.index !== 'string') {
      pushError(issues, `${path}.style.index`, ValidationErrorCode.STRING)
    }
  }

  if (!isObject(contentItem.paragraph)) {
    pushError(issues, `${path}.paragraph`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    validateTextAlign(contentItem.paragraph.align, `${path}.paragraph.align`, issues)
    validateCssLength(contentItem.paragraph.indent, `${path}.paragraph.indent`, issues)
    validateCharsPerLine(contentItem.paragraph.charsPerLine, `${path}.paragraph.charsPerLine`, issues)

    if (!isObject(contentItem.paragraph.spacing)) {
      pushError(issues, `${path}.paragraph.spacing`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
    } else {
      validateCssLineHeight(contentItem.paragraph.spacing.lineHeight, `${path}.paragraph.spacing.lineHeight`, issues)
      validateCssParagraphSpacing(contentItem.paragraph.spacing.before, `${path}.paragraph.spacing.before`, issues)
      validateCssParagraphSpacing(contentItem.paragraph.spacing.after, `${path}.paragraph.spacing.after`, issues)
    }
  }
}

function validateContent(content: unknown, issues: ValidationIssue[]): void {
  if (!isObject(content)) {
    pushError(issues, 'content', ValidationErrorCode.MISSING_OR_INVALID_FIELD)
    return
  }

  if (!content.body) {
    pushError(issues, 'content.body', ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  }

  Object.entries(content).forEach(([level, value]) => {
    validateContentItem(value, `content.${level}`, issues)
  })
}

function validatePage(page: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(page)) {
    pushError(issues, path, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
    return
  }

  const hasNamedSize = typeof page.size === 'string' && page.size.trim().length > 0
  const hasCustomDimensions = isObject(page.dimensions)
  if (!hasNamedSize && !hasCustomDimensions) {
    pushError(issues, `${path}.size`, ValidationErrorCode.PAGE_SIZE_OR_DIMENSIONS)
  }

  if (page.size !== undefined && (typeof page.size !== 'string' || page.size.trim().length === 0)) {
    pushError(issues, `${path}.size`, ValidationErrorCode.NON_EMPTY_STRING)
  }

  if (page.orientation !== undefined) {
    if (typeof page.orientation !== 'string' || !PAGE_ORIENTATION_SET.has(page.orientation)) {
      pushError(issues, `${path}.orientation`, ValidationErrorCode.PAGE_ORIENTATION)
    }
  }

  if (page.dimensions !== undefined) {
    if (!isObject(page.dimensions)) {
      pushError(issues, `${path}.dimensions`, ValidationErrorCode.OBJECT)
    } else {
      validateCssLength(page.dimensions.width, `${path}.dimensions.width`, issues)
      validateCssLength(page.dimensions.height, `${path}.dimensions.height`, issues)
      validateConvertiblePageMargin(page.dimensions.width, `${path}.dimensions.width`, issues)
      validateConvertiblePageMargin(page.dimensions.height, `${path}.dimensions.height`, issues)
    }
  }

  if (!isObject(page.margins)) {
    pushError(issues, `${path}.margins`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    const margins = page.margins as AnyRecord
    const marginKeys = ['top', 'right', 'bottom', 'left'] as const
    marginKeys.forEach((marginKey) => {
      const marginPath = `${path}.margins.${marginKey}`
      const marginValue = margins[marginKey]
      validateCssLength(marginValue, marginPath, issues)
      validateConvertiblePageMargin(marginValue, marginPath, issues)
    })
  }
}

function validatePagination(pagination: unknown, issues: ValidationIssue[]): void {
  if (pagination === undefined) {
    return
  }

  if (!isObject(pagination)) {
    pushError(issues, 'pagination', ValidationErrorCode.OBJECT)
    return
  }

  validateBoolean(pagination.enabled, 'pagination.enabled', issues)

  if (pagination.enabled === true) {
    validatePaginationConfig(pagination, 'pagination', issues)
  }
}

function validatePaginationConfig(pagination: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(pagination)) {
    pushError(issues, path, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
    return
  }

  if (pagination.enabled !== undefined) {
    validateBoolean(pagination.enabled, `${path}.enabled`, issues)
  }

  if (pagination.numberStyle !== undefined) {
    if (typeof pagination.numberStyle !== 'string' || !PAGINATION_NUMBER_STYLE_SET.has(pagination.numberStyle)) {
      pushError(issues, `${path}.numberStyle`, ValidationErrorCode.PAGINATION_NUMBER_STYLE)
    }
  }

  validatePaginationFormat(pagination.format, `${path}.format`, issues)

  if (!isObject(pagination.style)) {
    pushError(issues, `${path}.style`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    validatePaginationStyle(pagination.style, `${path}.style`, issues)
  }

  if (!isObject(pagination.position)) {
    pushError(issues, `${path}.position`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    validatePaginationPosition(pagination.position, `${path}.position`, issues)
  }
}

function validatePaginationStyle(style: AnyRecord, path: string, issues: ValidationIssue[]): void {
  if (!isObject(style.fonts)) {
    pushError(issues, `${path}.fonts`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    validateString(style.fonts.latinFamily, `${path}.fonts.latinFamily`, issues)
    validateString(style.fonts.cjkFamily, `${path}.fonts.cjkFamily`, issues)
    if (style.fonts.cnQuoteFamily !== undefined) {
      validateString(style.fonts.cnQuoteFamily, `${path}.fonts.cnQuoteFamily`, issues)
    }
    if (style.fonts.cnBookTitleFamily !== undefined) {
      validateString(style.fonts.cnBookTitleFamily, `${path}.fonts.cnBookTitleFamily`, issues)
    }
  }

  validateCssLength(style.size, `${path}.size`, issues)
  validateFontWeight(style.weight, `${path}.weight`, issues)

  if (!isObject(style.colors)) {
    pushError(issues, `${path}.colors`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
    return
  }

  validateCssColor(style.colors.text, `${path}.colors.text`, issues)
}

function validatePaginationPosition(position: AnyRecord, path: string, issues: ValidationIssue[]): void {
  if (!isObject(position.vertical)) {
    pushError(issues, `${path}.vertical`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    if (typeof position.vertical.anchor !== 'string' || !PAGINATION_VERTICAL_ANCHOR_SET.has(position.vertical.anchor)) {
      pushError(issues, `${path}.vertical.anchor`, ValidationErrorCode.VERTICAL_ANCHOR)
    }
    validateCssLength(position.vertical.offset, `${path}.vertical.offset`, issues)
  }

  if (!isObject(position.horizontal)) {
    pushError(issues, `${path}.horizontal`, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
  } else {
    if (typeof position.horizontal.anchor !== 'string' || !PAGINATION_HORIZONTAL_ANCHOR_SET.has(position.horizontal.anchor)) {
      pushError(issues, `${path}.horizontal.anchor`, ValidationErrorCode.HORIZONTAL_ANCHOR)
    }
    validateCssLength(position.horizontal.offset, `${path}.horizontal.offset`, issues)
  }
}

function validatePaginationFormat(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    pushError(issues, path, ValidationErrorCode.NON_EMPTY_STRING)
    return
  }

  const expressionMatches = value.matchAll(/\{([^{}]+)\}/g)
  for (const match of expressionMatches) {
    const expression = (match[1] ?? '').trim()
    if (!isValidPaginationExpression(expression)) {
      pushError(issues, path, ValidationErrorCode.INVALID_EXPRESSION, { expression: `{${expression}}` })
    }
  }
}

function isValidPaginationExpression(expression: string): boolean {
  if (expression.length === 0) {
    return false
  }

  if (!PAGINATION_EXPRESSION_ALLOWED_PATTERN.test(expression)) {
    return false
  }

  return (
    evaluateNumericTemplateExpression(expression, {
      currentPage: 1,
      CurrentPage: 1,
      totalPage: 1,
      TotalPage: 1
    }) !== null
  )
}

function validateConvertiblePageMargin(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isConvertibleCssLength(value)) {
    pushError(issues, path, ValidationErrorCode.CONVERTIBLE_CSS_LENGTH)
  }
}

function validateParser(parser: unknown, issues: ValidationIssue[], path: string): void {
  if (!isObject(parser)) {
    pushError(issues, path, ValidationErrorCode.MISSING_OR_INVALID_FIELD)
    return
  }

  if (parser.html !== undefined) {
    validateBoolean(parser.html, `${path}.html`, issues)
  }
  if (parser.enterStyle !== undefined) {
    validateEnterStyle(parser.enterStyle, `${path}.enterStyle`, issues)
  }
  if (parser.linkify !== undefined) {
    validateBoolean(parser.linkify, `${path}.linkify`, issues)
  }
  if (parser.typographer !== undefined) {
    validateBoolean(parser.typographer, `${path}.typographer`, issues)
  }

  validateBoolean(parser.headingNumbering, `${path}.headingNumbering`, issues)

  if (!Array.isArray(parser.disabledSyntax)) {
    pushError(issues, `${path}.disabledSyntax`, ValidationErrorCode.ARRAY)
  } else {
    parser.disabledSyntax.forEach((item, index) => {
      if (typeof item !== 'string' || item.trim().length === 0) {
        pushError(issues, `${path}.disabledSyntax.${index}`, ValidationErrorCode.INVALID_SYNTAX_ITEM)
      }
    })
  }

  if (parser.localStyleAliases !== undefined) {
    if (!isObject(parser.localStyleAliases)) {
      pushError(issues, `${path}.localStyleAliases`, ValidationErrorCode.OBJECT)
    } else {
      Object.entries(parser.localStyleAliases).forEach(([alias, target]) => {
        if (alias.trim().length === 0) {
          pushError(issues, `${path}.localStyleAliases`, ValidationErrorCode.ALIAS_KEY_EMPTY)
          return
        }

        if (typeof target !== 'string') {
          pushError(issues, `${path}.localStyleAliases.${alias}`, ValidationErrorCode.ALIAS_TARGET_STRING)
          return
        }

        const normalizedTarget = target.trim()
        const pathValidation = validateLocalStyleTargetPath(normalizedTarget)

        if (!pathValidation.formatValid) {
          pushError(issues, `${path}.localStyleAliases.${alias}`, ValidationErrorCode.ALIAS_TARGET_FORMAT)
          return
        }

        if (!pathValidation.inScope) {
          pushError(issues, `${path}.localStyleAliases.${alias}`, ValidationErrorCode.ALIAS_TARGET_SCOPE)
          return
        }

        if (!pathValidation.safe) {
          pushError(issues, `${path}.localStyleAliases.${alias}`, ValidationErrorCode.ALIAS_TARGET_UNSAFE)
        }
      })
    }
  }
}
