import { describe, expect, it } from 'vitest'
import { validateRule } from '../validator'
import { createValidRule } from './fixtures'

describe('validateRule', () => {
  it('returns invalid when input is null', () => {
    const result = validateRule(null)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('rule: RULE_CONFIG_EMPTY')
  })

  it('returns invalid when parser and typed fields are malformed', () => {
    const invalidRule = createValidRule() as unknown as Record<string, unknown>
    invalidRule.parser = {
      enterStyle: '***',
      headingNumbering: 'true',
      disabledSyntax: ['codeBlock', 'badSyntax'],
      localStyleAliases: {
        bodyIndent: 'content.body.bad field'
      }
    }

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'parser.enterStyle: ENTER_STYLE',
        'parser.headingNumbering: BOOLEAN',
        'parser.localStyleAliases.bodyIndent: ALIAS_TARGET_FORMAT'
      ])
    )
  })

  it('returns invalid when content/page fields have wrong types', () => {
    const invalidRule = createValidRule() as unknown as Record<string, unknown>
    invalidRule.content = {
      ...createValidRule().content,
      body: {
        ...createValidRule().content.body,
        style: {
          size: '16pt',
          weight: 450,
          color: '#000000'
        },
        paragraph: {
          align: 'middle',
          indent: 'foo',
          spacing: {
            lineHeight: 'bad-line-height',
            before: 'foo',
            after: '0'
          }
        }
      }
    }
    invalidRule.page = {
      size: '',
      orientation: 'horizontal',
      margins: { top: '37mm', right: '26mm', bottom: '35mm', left: '28mm' }
    }

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'content.body.style.weight: FONT_WEIGHT',
        'content.body.paragraph.align: TEXT_ALIGN',
        'content.body.paragraph.indent: CSS_LENGTH',
        'content.body.paragraph.spacing.lineHeight: CSS_LINE_HEIGHT',
        'content.body.paragraph.spacing.before: CSS_PARAGRAPH_SPACING',
        'page.size: NON_EMPTY_STRING',
        'page.orientation: PAGE_ORIENTATION'
      ])
    )
  })

  it('returns valid for builtin rule config', () => {
    const validRule = createValidRule()
    const result = validateRule(validRule)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns valid when pagination is omitted', () => {
    const validRule = createValidRule()
    delete (validRule as Record<string, unknown>).pagination

    const result = validateRule(validRule)
    expect(result.valid).toBe(true)
  })

  it('returns invalid when pagination format contains illegal expression', () => {
    const invalidRule = createValidRule()
    if (!invalidRule.pagination) {
      throw new Error('pagination 配置缺失')
    }

    invalidRule.pagination.format = '第{currentPage+alert(1)}页'

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'pagination.format: INVALID_EXPRESSION'
      ])
    )
  })

  it('returns invalid when pagination numberStyle is unknown', () => {
    const invalidRule = createValidRule()
    if (!invalidRule.pagination) {
      throw new Error('pagination 配置缺失')
    }

    invalidRule.pagination.numberStyle = 'foobar' as 'arabic'
    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'pagination.numberStyle: PAGINATION_NUMBER_STYLE'
    )
  })

  it('returns invalid when page margins are not convertible to px', () => {
    const invalidRule = createValidRule()
    invalidRule.page.margins.top = '2em' as '37mm'

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'page.margins.top: CONVERTIBLE_CSS_LENGTH'
    )
  })

  it('returns valid when content contains custom level with full ContentItem structure', () => {
    const validRule = createValidRule()
    validRule.content.appendix = JSON.parse(JSON.stringify(validRule.content.body))

    const result = validateRule(validRule)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns invalid when custom content level structure is malformed', () => {
    const invalidRule = createValidRule() as unknown as Record<string, unknown>
    const content = invalidRule.content as Record<string, unknown>
    content.appendix = {
      fonts: {
        latinFamily: 'Times New Roman'
      },
      style: {
        size: '16pt',
        weight: 400,
        colors: {
          text: '#000000',
          background: '#ffffff'
        }
      },
      paragraph: {
        align: 'left',
        indent: '2em'
      }
    }

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'content.appendix.fonts.cjkFamily: NON_EMPTY_STRING',
        'content.appendix.paragraph.spacing: MISSING_OR_INVALID_FIELD'
      ])
    )
  })

  it('returns invalid when ruleConfig is not an object', () => {
    const result = validateRule('not an object')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('rule: RULE_CONFIG_OBJECT')
  })

  it('returns invalid when charsPerLine is zero, negative, or non-integer', () => {
    const invalidValues = [0, -1, 3.5]
    for (const value of invalidValues) {
      const invalidRule = createValidRule()
      invalidRule.content.body.paragraph.charsPerLine = value

      const result = validateRule(invalidRule)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'content.body.paragraph.charsPerLine: CHARS_PER_LINE'
      )
    }
  })

  it('returns valid when charsPerLine is a positive integer', () => {
    const validRule = createValidRule()
    validRule.content.body.paragraph.charsPerLine = 28

    const result = validateRule(validRule)
    expect(result.valid).toBe(true)
  })

  it('returns valid when charsPerLine is null or undefined', () => {
    // Both null and undefined disable the charsPerLine constraint
    const validRule = createValidRule()
    validRule.content.body.paragraph.charsPerLine = undefined
    expect(validateRule(validRule).valid).toBe(true)

    const nullRule = createValidRule()
    nullRule.content.body.paragraph.charsPerLine = null as unknown as undefined
    expect(validateRule(nullRule).valid).toBe(true)
  })

  it('returns invalid when page has neither size nor dimensions', () => {
    const invalidRule = createValidRule()
    invalidRule.page.size = undefined as unknown as string
    invalidRule.page.dimensions = undefined

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('page.size: PAGE_SIZE_OR_DIMENSIONS')
  })

  it('returns valid when page has custom dimensions instead of named size', () => {
    const validRule = createValidRule()
    validRule.page.size = undefined as unknown as string
    validRule.page.dimensions = { width: '210mm', height: '297mm' }

    const result = validateRule(validRule)
    expect(result.valid).toBe(true)
  })

  it('returns invalid when page dimensions are not valid css lengths', () => {
    const invalidRule = createValidRule()
    invalidRule.page.dimensions = { width: 'foo', height: 'bar' }

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'page.dimensions.width: CSS_LENGTH',
        'page.dimensions.height: CSS_LENGTH'
      ])
    )
  })

  it('returns invalid when localStyleAliases target path is out of scope', () => {
    const invalidRule = createValidRule()
    if (!invalidRule.parser) {
      throw new Error('parser 配置缺失')
    }
    invalidRule.parser.localStyleAliases = { myAlias: 'other.path.value' }

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'parser.localStyleAliases.myAlias: ALIAS_TARGET_SCOPE'
    )
  })

  it('returns invalid when localStyleAliases target path contains unsafe segment', () => {
    const invalidRule = createValidRule()
    if (!invalidRule.parser) {
      throw new Error('parser 配置缺失')
    }
    invalidRule.parser.localStyleAliases = {
      myAlias: 'content.body.__proto__.value'
    }

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'parser.localStyleAliases.myAlias: ALIAS_TARGET_UNSAFE'
    )
  })

  it('returns invalid when parser html/linkify/typographer are not booleans', () => {
    const invalidRule = createValidRule()
    if (!invalidRule.parser) {
      throw new Error('parser 配置缺失')
    }
    invalidRule.parser.html = 'yes' as unknown as boolean
    invalidRule.parser.linkify = 1 as unknown as boolean

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'parser.html: BOOLEAN',
        'parser.linkify: BOOLEAN'
      ])
    )
  })

  it('returns invalid when cnQuoteFamily is set but empty', () => {
    const invalidRule = createValidRule()
    invalidRule.content.body.fonts.cnQuoteFamily = '   '

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'content.body.fonts.cnQuoteFamily: NON_EMPTY_STRING'
    )
  })

  it('returns invalid when pagination vertical anchor is unknown', () => {
    const invalidRule = createValidRule()
    if (!invalidRule.pagination) {
      throw new Error('pagination 配置缺失')
    }
    invalidRule.pagination.position.vertical.anchor = 'middle' as 'bottom'

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'pagination.position.vertical.anchor: VERTICAL_ANCHOR'
    )
  })

  it('returns invalid when pagination horizontal anchor is unknown', () => {
    const invalidRule = createValidRule()
    if (!invalidRule.pagination) {
      throw new Error('pagination 配置缺失')
    }
    invalidRule.pagination.position.horizontal.anchor = 'middle' as 'center'

    const result = validateRule(invalidRule)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'pagination.position.horizontal.anchor: HORIZONTAL_ANCHOR'
    )
  })
})
