/** Structured error codes for rule validation — no i18n dependency. */
export const ValidationErrorCode = {
  RULE_CONFIG_EMPTY: 'RULE_CONFIG_EMPTY',
  RULE_CONFIG_OBJECT: 'RULE_CONFIG_OBJECT',
  NON_EMPTY_STRING: 'NON_EMPTY_STRING',
  CSS_LENGTH: 'CSS_LENGTH',
  CSS_LINE_HEIGHT: 'CSS_LINE_HEIGHT',
  CSS_PARAGRAPH_SPACING: 'CSS_PARAGRAPH_SPACING',
  CSS_COLOR: 'CSS_COLOR',
  FONT_WEIGHT: 'FONT_WEIGHT',
  TEXT_ALIGN: 'TEXT_ALIGN',
  BOOLEAN: 'BOOLEAN',
  ENTER_STYLE: 'ENTER_STYLE',
  PAGE_ORIENTATION: 'PAGE_ORIENTATION',
  PAGE_SIZE_OR_DIMENSIONS: 'PAGE_SIZE_OR_DIMENSIONS',
  VERTICAL_ANCHOR: 'VERTICAL_ANCHOR',
  HORIZONTAL_ANCHOR: 'HORIZONTAL_ANCHOR',
  PAGINATION_NUMBER_STYLE: 'PAGINATION_NUMBER_STYLE',
  MISSING_OR_INVALID_FIELD: 'MISSING_OR_INVALID_FIELD',
  INVALID_EXPRESSION: 'INVALID_EXPRESSION',
  ARRAY: 'ARRAY',
  INVALID_SYNTAX_ITEM: 'INVALID_SYNTAX_ITEM',
  OBJECT: 'OBJECT',
  STRING: 'STRING',
  CHARS_PER_LINE: 'CHARS_PER_LINE',
  CONVERTIBLE_CSS_LENGTH: 'CONVERTIBLE_CSS_LENGTH',
  ALIAS_KEY_EMPTY: 'ALIAS_KEY_EMPTY',
  ALIAS_TARGET_STRING: 'ALIAS_TARGET_STRING',
  ALIAS_TARGET_FORMAT: 'ALIAS_TARGET_FORMAT',
  ALIAS_TARGET_SCOPE: 'ALIAS_TARGET_SCOPE',
  ALIAS_TARGET_UNSAFE: 'ALIAS_TARGET_UNSAFE',
} as const

export type ValidationErrorCode =
  (typeof ValidationErrorCode)[keyof typeof ValidationErrorCode]

export interface ValidationIssue {
  level: 'error' | 'warning'
  path: string
  code: ValidationErrorCode
  message: string
  params?: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  issues: ValidationIssue[]
}

// ─── CSS compilation types ────────────────────────────────────────────────

/** Heading levels recognised by the rule engine */
export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4'

export interface StyleDeclaration {
  property: string
  value: string
}

export interface StyleRule {
  type: 'style'
  selectors: string[]
  declarations: StyleDeclaration[]
}

export interface AtRule {
  type: 'at-rule'
  name: string
  prelude?: string
  declarations?: StyleDeclaration[]
  children?: StyleNode[]
}

export type StyleNode = StyleRule | AtRule

export interface CompiledRule {
  tokens: Record<string, string>
  rules: StyleNode[]
  cssText: string
}

export interface HostSelectors {
  rootContent: string[]
  paperSheet: string[]
  exportDocument: string[]
  appShell: string[]
  printContainer: string[]
  // Compound/intersection selector (sheet AND content, e.g. '.paper-sheet.preview-content');
  // cannot be composed from paperSheet + printContainer, so it is injected whole.
  paperContent: string[]
}
