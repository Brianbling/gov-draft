import { describe, expect, it } from 'vitest'
import { MarkdownParser } from '../markdown-parser'
import { getBuiltinRules } from '../../index'
import { headingStyles, pipelineMarkdown } from './fixtures'

describe('MarkdownParser behavior', () => {
  it('downgrades disabled markdown syntaxes to plain paragraph content', () => {
    const parser = new MarkdownParser(undefined, {
      headingNumbering: true,
      disabledSyntax: ['codeBlock', 'blockquote', 'unorderedList', 'horizontalRule'],
      headingStyles
    })

    const html = parser.parse(pipelineMarkdown).html

    expect(html).toContain('<h2>一、第二级标题</h2>')
    expect(html).toContain('<h3>（壹）第三级标题</h3>')

    expect(html).not.toContain('<ul>')
    expect(html).not.toContain('<blockquote>')
    expect(html).not.toContain('<hr')
    expect(html).not.toContain('<pre>')
    expect(html).not.toContain('<code>')

    expect(html).toContain('列表项<span class="latin-text">A</span>')
    expect(html).toContain('引用<span class="latin-text">A</span>')
    expect(html).toContain('<span class="latin-text">const</span> <span class="latin-text">value</span> = <span class="latin-text">1</span>')
  })

  it('does not auto number heading when numberingStyle is empty', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [], headingStyles: { h2: '' } })

    const html = parser.parse('## 仅标题').html
    expect(html).toContain('<h2>仅标题</h2>')
    expect(html).not.toContain('<h2>1、仅标题</h2>')
  })

  it('appends index when template does not contain {number}', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [], headingStyles: { h2: '第' } })

    const html = parser.parse('## 缺占位符').html
    expect(html).toContain('<h2>第<span class="latin-text">1</span>缺占位符</h2>')
  })

  it('replaces all occurrences when template contains multiple {number}', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [], headingStyles: { h2: '{number}-{number} ' } })

    const html = parser.parse('## 多占位符').html
    expect(html).toContain('<h2><span class="latin-text">1</span>-<span class="latin-text">1</span>多占位符</h2>')
  })

  it('does not number when template is only whitespace', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [], headingStyles: { h2: '   ' } })

    const html = parser.parse('## 空白模板').html
    expect(html).toContain('<h2>空白模板</h2>')
    expect(html).not.toContain('1')
  })

  it('does not number headings when headingNumbering is false', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [], headingStyles: { h2: '{number}、' } })

    const html = parser.parse('## 禁用总开关').html
    expect(html).toContain('<h2>禁用总开关</h2>')
    expect(html).not.toContain('<h2>1、禁用总开关</h2>')
  })

  it('supports zhHansIndex, zhHantIndex and romanIndex placeholders', () => {
    const parser = new MarkdownParser(undefined, {
      headingNumbering: true,
      disabledSyntax: [],
      headingStyles: {
        h2: '{zhHansIndex}、',
        h3: '（{zhHantIndex}）',
        h4: '{romanIndex}.'
      }
    })

    const markdown = ['## 汉字序号', '### 大写序号', '#### 数字序号'].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('<h2>一、汉字序号</h2>')
    expect(html).toContain('<h3>（壹）大写序号</h3>')
    expect(html).toContain('<h4><span class="latin-text">I</span>.数字序号</h4>')
  })

  it('supports arabicIndex and explicit roman placeholders', () => {
    const parser = new MarkdownParser(undefined, {
      headingNumbering: true,
      disabledSyntax: [],
      headingStyles: {
        h2: '{arabicIndex}、',
        h3: '{romanUpperIndex}.',
        h4: '{romanLowerIndex}.'
      }
    })

    const markdown = ['## 阿拉伯', '### 罗马大写', '#### 罗马小写'].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('<h2><span class="latin-text">1</span>、阿拉伯</h2>')
    expect(html).toContain('<h3><span class="latin-text">I</span>.罗马大写</h3>')
    expect(html).toContain('<h4><span class="latin-text">i</span>.罗马小写</h4>')
  })

  it('wires headingStyles from rule.content.*.style.index into parser config', () => {
    // Production path: use-markdown.ts derives headingStyles from
    // rule.content.{h1-h4}.style.index and merges into parser options.
    const rule = getBuiltinRules().find((r) => r.name.includes('9704')) ?? getBuiltinRules()[0]!
    const parser = new MarkdownParser(undefined, {
      ...rule.parser,
      headingStyles: {
        h1: rule.content.h1.style.index ?? '0lines',
        h2: rule.content.h2.style.index ?? '0lines',
        h3: rule.content.h3.style.index ?? '0lines',
        h4: rule.content.h4.style.index ?? '0lines',
      },
    })

    const html = parser.parse('## 二级\n### 三级\n#### 四级').html

    // GB/T 9704 headingStyles from content:
    // h2='{zhHansIndex}、' → '一、'  h3='（{zhHansIndex}）' → '（一）'  h4='{arabicIndex}．' → '1．'
    expect(html).toContain('<h2>一、二级</h2>')
    expect(html).toContain('<h3>（一）三级</h3>')
    expect(html).toContain('<h4><span class="latin-text">1</span>．四级</h4>')
  })

  it('supports local style container with canonical path syntax', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [] })

    const markdown = ['::: content.body.paragraph.indent: 0em', '段落A', ':::'].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('class="local-style-container"')
    expect(html).toContain('--content-body-paragraph-indent: 0em;')
    expect(html).toContain('<p>段落<span class="latin-text">A</span></p>')
  })

  it('supports sugar path without content prefix for dynamic overrides', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [] })

    const markdown = ['::: h2.style.size: 14pt', '## 标题E', ':::'].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('class="local-style-container"')
    expect(html).toContain('--content-h2-style-size: 14pt;')
  })

  it('supports quoted color value for dynamic style path', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [] })

    const markdown = ["::: body.style.colors.text: '#FF0000'", '段落E', ':::'].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('class="local-style-container"')
    expect(html).toContain('--content-body-style-colors-text: #FF0000;')
  })

  it('supports local style container with alias syntax', () => {
    const parser = new MarkdownParser(undefined, {
      headingNumbering: true,
      disabledSyntax: [],
      localStyleAliases: {
        bodyIndent: 'content.body.paragraph.indent'
      }
    })

    const markdown = ['::: bodyIndent: 1em', '段落B', ':::'].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('class="local-style-container"')
    expect(html).toContain('--content-body-paragraph-indent: 1em;')
  })

  it('does not support built-in old aliases without parser alias config', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [] })

    const markdown = ['::: bodyIndent: 0em', '段落C', ':::'].join('\n')
    const html = parser.parse(markdown).html

    expect(html).not.toContain('class="local-style-container"')
    expect(html).toContain('<span class="latin-text">bodyIndent</span>: <span class="latin-text">0em</span>')
    expect(html).toContain('段落<span class="latin-text">C</span>')
  })

  it('supports full-width colon in local style descriptor', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: true, disabledSyntax: [] })

    const markdown = ['::: content.body.paragraph.indent： 0em', '段落D', ':::'].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('class="local-style-container"')
    expect(html).toContain('--content-body-paragraph-indent: 0em;')
    expect(html).toContain('<p>段落<span class="latin-text">D</span></p>')
  })

  it('wraps latin letters and chinese quote symbols with dedicated spans', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })

    const html = parser.parse('ABC“测试”《公文》').html

    expect(html).toContain('<span class="latin-text">ABC</span>')
    expect(html).toContain('<span class="cn-quote">“</span>')
    expect(html).toContain('<span class="cn-quote">”</span>')
    expect(html).toContain('<span class="cn-book-title">《</span>')
    expect(html).toContain('<span class="cn-book-title">》</span>')
  })
  it('supports nested local style containers with proximity priority', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })

    const markdown = [
      '::: body.paragraph.indent:2em',
      '外层段落',
      '::: body.paragraph.indent:0em',
      '内层段落',
      ':::',
      '外层段落2',
      ':::'
    ].join('\n')
    const html = parser.parse(markdown).html

    const outerDivIndex = html.indexOf('class="local-style-container"')
    const innerDivIndex = html.indexOf('class="local-style-container"', outerDivIndex + 1)
    expect(outerDivIndex).toBeGreaterThan(-1)
    expect(innerDivIndex).toBeGreaterThan(outerDivIndex)

    expect(html).toContain('--content-body-paragraph-indent: 2em;')
    expect(html).toContain('--content-body-paragraph-indent: 0em;')
    expect(html).toContain('外层段落')
    expect(html).toContain('内层段落')
    expect(html).toContain('外层段落<span class="latin-text">2</span>')
  })

  it('supports single ::: line with multiple semicolon-separated rules', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })

    const markdown = [
      "::: body.paragraph.indent:0em; body.style.colors.text:'#ff0000'",
      '多规则段落',
      ':::'
    ].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('class="local-style-container"')
    expect(html).toContain('--content-body-paragraph-indent: 0em;')
    expect(html).toContain('--content-body-style-colors-text: #ff0000;')
  })

  it('supports full-width semicolon as multi-rule separator', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })

    const markdown = [
      '::: body.paragraph.indent:0em；body.paragraph.align:right',
      '全角分号段落',
      ':::'
    ].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('--content-body-paragraph-indent: 0em;')
    expect(html).toContain('--content-body-paragraph-align: right;')
  })

  it('ignores invalid segments in multi-rule descriptor', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })

    const markdown = [
      '::: body.paragraph.indent:0em; invalidKey; body.paragraph.align:center',
      '部分无效段落',
      ':::'
    ].join('\n')
    const html = parser.parse(markdown).html

    expect(html).toContain('--content-body-paragraph-indent: 0em;')
    expect(html).toContain('--content-body-paragraph-align: center;')
  })

  it('handles unclosed nested container gracefully', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })

    const markdown = [
      '::: body.paragraph.indent:2em',
      '外层',
      '::: body.paragraph.indent:0em',
      '内层未关闭',
      ':::'
    ].join('\n')
    const html = parser.parse(markdown).html

    const matches = html.match(/class="local-style-container"/g)
    expect(matches).toHaveLength(1)
    expect(html).toContain('--content-body-paragraph-indent: 0em;')
    expect(html).not.toContain('--content-body-paragraph-indent: 2em;')
  })

  it('treats single Enter as new paragraph when enterStyle is paragraph', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [], enterStyle: 'paragraph' })

    const html = parser.parse(['第一行', '第二行'].join('\n')).html

    expect(html).toContain('<p>第一行</p>')
    expect(html).toContain('<p>第二行</p>')
  })

  it('treats line-end // plus Enter as manual line break when enterStyle is paragraph', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [], enterStyle: 'paragraph' })

    const html = parser.parse(['第一行//', '第二行'].join('\n')).html

    expect(html).toMatch(/<p>第一行<br>\s*第二行<\/p>/)
  })

  it('keeps heading structure when single Enter follows heading under enterStyle paragraph', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [], enterStyle: 'paragraph' })

    const html = parser.parse(['## 标题', '正文'].join('\n')).html

    expect(html).toContain('<h2>标题</h2>')
    expect(html).toContain('<p>正文</p>')
  })

  it('keeps explicit empty lines as visible blank paragraphs under enterStyle paragraph', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [], enterStyle: 'paragraph' })

    const html = parser.parse(['第一段', '', '第二段'].join('\n')).html

    expect(html).toContain('<p>第一段</p>')
    expect(html).toContain('<p> </p>')
    expect(html).toContain('<p>第二段</p>')
  })

  it('returns ParseResult with html and tokens', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })
    const result = parser.parse('# Test')
    expect(result.html).toContain('<h1><span class="latin-text">Test</span></h1>')
    expect(Array.isArray(result.tokens)).toBe(true)
    expect(result.tokens.length).toBeGreaterThan(0)
  })

  it('returns empty result for empty string', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })
    const result = parser.parse('')
    expect(result.html).toBe('')
    expect(result.tokens).toEqual([])
  })

  it('returns empty result for non-string input', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })
    const result = parser.parse(null as unknown as string)
    expect(result.html).toBe('')
    expect(result.tokens).toEqual([])
  })

  it('setOptions updates parser configuration', () => {
    const parser = new MarkdownParser(undefined, { headingNumbering: false, disabledSyntax: [] })

    // Initially without heading numbering
    const before = parser.parse('## 标题').html
    expect(before).not.toContain('一、标题')

    // After setOptions, heading numbering is on
    parser.setOptions({ headingNumbering: true, headingStyles: { h2: '{zhHansIndex}、' } })
    const after = parser.parse('## 标题').html
    expect(after).toContain('一、标题')
  })

  it('enterStyle lineBreak preserves single line breaks as <br>', () => {
    const parser = new MarkdownParser(undefined, {
      headingNumbering: false,
      disabledSyntax: [],
      enterStyle: 'lineBreak'
    })
    const html = parser.parse('第一行\n第二行').html
    expect(html).toContain('<br>')
  })

  it('no disabledSyntax preserves all markdown syntax', () => {
    const parser = new MarkdownParser(undefined, {
      headingNumbering: false,
      disabledSyntax: [],
      enterStyle: 'lineBreak'
    })
    const html = parser.parse('> 引用\n\n- 列表项').html
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<ul>')
  })

  it('wraps pipeline errors in a descriptive message', () => {
    const parser = new MarkdownParser(
      {
        preprocessors: [
          {
            name: 'thrower',
            process() {
              throw new Error('pipeline explosion')
            },
          },
        ],
        mdPlugins: [],
        tokenProcessors: [],
        htmlPostprocessors: [],
      },
      { headingNumbering: false, disabledSyntax: [] },
    )
    expect(() => parser.parse('some markdown')).toThrow(
      'MARKDOWN_PARSE_FAILED: pipeline explosion',
    )
  })

  describe('fast-linkify guard', () => {
    const parser = new MarkdownParser(undefined, {
      linkify: true,
      headingNumbering: false,
      disabledSyntax: [],
    })

    it('still linkifies real URLs, emails and bare hosts', () => {
      const html = parser.parse(
        '详见 https://example.com/path 或邮箱 a@b.com 以及 example.org。',
      ).html
      expect(html).toContain('<a href="https://example.com/path"')
      expect(html).toContain('<a href="mailto:a@b.com"')
      expect(html).toContain('<a href="http://example.org"')
    })

    it('produces no links for trigger-free CJK prose (the skipped fast path)', () => {
      const html = parser.parse(
        '各部门要充分认识本次工作的重要意义，确保取得实效。',
      ).html
      expect(html).not.toContain('<a ')
    })

    it('matches non-guarded output when a trigger char is present but not a link', () => {
      // Contains "." and ":" yet has no linkifiable target — must stay link-free.
      const html = parser.parse('版本 v2.1，增长 12.5%：参见说明。').html
      expect(html).not.toContain('<a ')
    })
  })
})
