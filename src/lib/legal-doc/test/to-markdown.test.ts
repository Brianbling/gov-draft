import { describe, expect, it } from "vitest"
import {
  toMarkdown,
  formatChineseDate,
  patchMarkdownElements,
} from "../to-markdown"
import { MarkdownParser } from "@/engine/parser/markdown-parser"
import type { LegalDoc } from "../types"

function buildDoc(overrides: Partial<LegalDoc> = {}): LegalDoc {
  return {
    docType: "gongwen",
    title: "关于加强数字政府建设的通知",
    docNumber: "国发〔2026〕12号",
    recipient: "各省、自治区、直辖市人民政府，国务院各部委、各直属机构：",
    body: [
      {
        type: "p",
        text: "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设，经国务院同意，现就有关工作通知如下。",
      },
      {
        type: "h1",
        text: "总体要求",
      },
      {
        type: "p",
        text: "以习近平新时代中国特色社会主义思想为指导，坚持稳中求进工作总基调。",
      },
      {
        type: "h2",
        text: "统筹推进",
      },
      {
        type: "p",
        text: "各地区各部门要加强组织领导，确保各项任务落地见效。",
      },
    ],
    issuer: "国务院办公厅",
    date: "2026-07-31",
    ...overrides,
  }
}

describe("toMarkdown", () => {
  it("renders the title as a level-1 heading", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).toContain("# 关于加强数字政府建设的通知")
  })

  it("标题 ≤14 字不套字号容器，保持标准 2 号", () => {
    // "关于加强数字政府建设的通知" = 13 字，走标准字号路径（裸 `#`）。
    const markdown = toMarkdown(buildDoc())
    expect(markdown).not.toContain("content.h1.style.size")
    expect(markdown).toContain("# 关于加强数字政府建设的通知")
  })

  it("标题 15-18 字降为 20pt", () => {
    const title = "关于加强数字政府建设的通知字字"
    expect(Array.from(title).length).toBe(15)
    const markdown = toMarkdown(buildDoc({ title }))
    expect(markdown).toContain(
      "::: content.h1.style.size: 20pt; content.h1.paragraph.letterSpacing: 0em; class: keep-together\n# "
    )
    expect(markdown).toContain(`# ${title}`)
  })

  it("标题 19-22 字降为 18pt", () => {
    const title = "关于加强数字政府建设的通知字字字字字字"
    expect(Array.from(title).length).toBe(19)
    const markdown = toMarkdown(buildDoc({ title }))
    expect(markdown).toContain("content.h1.style.size: 18pt")
    expect(markdown).toContain("class: keep-together")
  })

  it("标题 23+ 字降为 16pt", () => {
    const title = "关于加强数字政府建设的通知字字字字字字字字字字"
    expect(Array.from(title).length).toBe(23)
    const markdown = toMarkdown(buildDoc({ title }))
    expect(markdown).toContain("content.h1.style.size: 16pt")
  })

  it("长标题容器 round-trip：patchMarkdownElements 后标题仍是 # 一级标题", () => {
    const title = "关于加强数字政府建设的通知字字字字字字"
    const markdown = toMarkdown(buildDoc({ title }))
    const patched = patchMarkdownElements(markdown, {
      ...buildDoc({ title }),
      title: "关于更新标题的通知",
    })
    expect(patched).toContain("# 关于更新标题的通知")
    expect(patched).not.toContain("未命名公文")
  })

  it("renders docNumber in a centered container above the title, after the red-head", () => {
    const markdown = toMarkdown(buildDoc())
    const docNumberLine =
      "::: content.body.paragraph.align: center; content.body.paragraph.indent: 0em"
    const blockIndex = markdown.indexOf(docNumberLine)
    const titleIndex = markdown.indexOf("# 关于加强数字政府建设的通知")
    expect(blockIndex).toBeGreaterThan(-1)
    expect(blockIndex).toBeLessThan(titleIndex)
    expect(markdown).toContain("国发〔2026〕12号")
  })

  it("renders the recipient flush-left without indentation", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).toContain("::: content.body.paragraph.indent: 0em")
    expect(markdown).toContain(
      "各省、自治区、直辖市人民政府，国务院各部委、各直属机构："
    )
  })

  it("wraps body paragraphs in an indented container", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).toContain("::: content.body.paragraph.indent: 2em")
    expect(markdown).toContain(
      "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设，经国务院同意，现就有关工作通知如下。"
    )
  })

  it("maps h1 body blocks to level-2 headings and h2 to level-3", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).toContain("## 总体要求")
    expect(markdown).toContain("### 统筹推进")
  })

  it("renders the letterhead when securityLevel or urgency is present", () => {
    const markdown = toMarkdown(
      buildDoc({ securityLevel: "秘密", urgency: "加急" })
    )
    expect(markdown).toContain(
      "::: content.body.paragraph.align: left; content.body.paragraph.indent: 0em; content.body.fonts.cjkFamily: 黑体, SimHei, STHeiti, sans-serif; content.body.style.weight: 700"
    )
    expect(markdown).toContain("秘密")
    expect(markdown).toContain("加急")
  })

  it("omits the letterhead when neither securityLevel nor urgency is set", () => {
    const markdown = toMarkdown(
      buildDoc({ securityLevel: undefined, urgency: undefined })
    )
    expect(markdown).not.toContain("黑体, SimHei, STHeiti, sans-serif")
  })

  it("renders attachments, signature and printing block", () => {
    const markdown = toMarkdown(
      buildDoc({
        attachments: ["数字政府建设任务清单"],
        cc: ["中共中央办公厅"],
        printingOffice: "国务院办公厅",
        printingDate: "2026-08-01",
      })
    )
    expect(markdown).toContain("附件：数字政府建设任务清单")
    expect(markdown).toContain(
      "::: content.body.paragraph.align: center; content.body.paragraph.indent: 0em"
    )
    expect(markdown).toContain("国务院办公厅")
    expect(markdown).toContain("2026年7月31日")
    expect(markdown).toContain("抄送：中共中央办公厅")
    expect(markdown).toContain("国务院办公厅\n2026年8月1日")
  })

  it("numbers multiple attachments with aligned continuation lines", () => {
    const markdown = toMarkdown(
      buildDoc({ attachments: ["任务清单", "工作台账"] })
    )
    // 多附件：首行“附件：1．×”，续行序号与首行对齐（“附件：”3 字 → 3 全角空格占位）
    expect(markdown).toContain("附件：1．任务清单")
    expect(markdown).toContain("　　　2．工作台账")
  })

  it("single attachment is not numbered", () => {
    const markdown = toMarkdown(
      buildDoc({ attachments: ["数字政府建设任务清单"] })
    )
    expect(markdown).toContain("附件：数字政府建设任务清单")
    expect(markdown).not.toContain("1．")
  })

  it("seal=true：署名成文日期右对齐 + 落款前留足印章空间，绝不输出“此处盖章”", () => {
    const markdown = toMarkdown(buildDoc({ seal: true }))
    // 需盖章：署名成文日期右对齐，正文末到落款 spacing.before 留足印章空间（骑年盖月手工加盖）
    expect(markdown).toContain(
      "::: content.body.paragraph.align: right; content.body.paragraph.indent: 0em"
    )
    expect(markdown).toContain("content.body.paragraph.spacing.before: 15mm")
    expect(markdown).not.toContain("（此处加盖公章）")
    expect(markdown).not.toContain("盖章")
  })

  it("seal=true：成文日期右空四字（GB/T 9704 §7.3.5.1）", () => {
    const markdown = toMarkdown(buildDoc({ seal: true }))
    expect(markdown).toContain("2026年7月31日" + "　".repeat(4))
  })

  it("seal=false/未设：署名与成文日期靠右错位编排（§7.3.5.2），无盖章文字", () => {
    const markdown = toMarkdown(buildDoc())
    // 不加盖公章：署名右空二字、日期排其下一行且首字比署名首字右移二字。
    // "国务院办公厅" 6 字 vs "2026年7月31日" 10 字 → 日期长于署名，
    // 改日期右空二字、署名右空数相应增加（10-6+4=8 全角空格）。
    // 落款容器带 keep-together 标记（分页器保持整块、防背页）。
    expect(markdown).toContain(
      "::: content.body.paragraph.align: right; content.body.paragraph.indent: 0em; content.body.paragraph.spacing.before: 28.95pt; class: keep-together\n国务院办公厅" +
        "　".repeat(8) +
        "\n:::"
    )
    expect(markdown).toContain("2026年7月31日" + "　".repeat(2))
    expect(markdown).not.toContain("（此处加盖公章）")
    expect(markdown).not.toContain("盖章")
  })

  it("标题含 Markdown 特殊字符（#、*）时不破坏标题结构", () => {
    const markdown = toMarkdown(
      buildDoc({ title: "关于 #1 重点任务 *清单* 的通知" })
    )
    // 标题必须仍是单行 # 一级标题，不能被解析成多个标题或加粗
    expect(markdown).toContain("# 关于 #1 重点任务 \\*清单\\* 的通知")
    expect(markdown).not.toContain("## 关于")
    expect(markdown).not.toContain("**清单**")
  })

  it("M2：标题含 markdown 行内字符时转义，round-trip 解析后不含 <em>/<a>/<code>/<s>", () => {
    // 标题来自 LLM/表单，可能含 * _ [ ] ` ~~ 等。toMarkdown 先转义，
    // 经 MarkdownParser 渲染的 HTML 必须是纯文本红头，不出现强调/链接/代码/删除线。
    const markdown = toMarkdown(
      buildDoc({
        title: "关于 *清单* 与 _重点_ [附件] `代码` ~~删除~~ 的通知",
      })
    )
    // 转义后仍保留可读标题文本（反斜杠是 markdown 转义，渲染后即为字面字符）
    expect(markdown).toContain(
      "# 关于 \\*清单\\* 与 \\_重点\\_ \\[附件\\] \\`代码\\` \\~\\~删除\\~\\~ 的通知"
    )

    const html = new MarkdownParser(undefined, {
      headingNumbering: false,
      disabledSyntax: [
        "codeBlock",
        "blockquote",
        "unorderedList",
        "horizontalRule",
      ],
    }).parse(markdown).html
    expect(html).toContain("<h1>")
    expect(html).not.toContain("<em>")
    expect(html).not.toContain("<a ")
    expect(html).not.toContain("<code>")
    expect(html).not.toContain("<s>")
    // 标题文本原样保留（markdown 转义渲染成字面字符）
    expect(html).toContain(
      "关于 *清单* 与 _重点_ [附件] `代码` ~~删除~~ 的通知"
    )
  })

  it("body 为空数组时仍输出标题不崩溃", () => {
    const doc = buildDoc()
    const emptyBodyDoc = { ...doc, body: [] as never[] } as unknown as LegalDoc
    const markdown = toMarkdown(emptyBodyDoc)
    expect(markdown).toContain("# 关于加强数字政府建设的通知")
    expect(markdown).toContain("国发〔2026〕12号")
  })

  it("标题为空时不输出幽灵空红头，改用可见占位标题", () => {
    // 空标题（LLM 未给出、且用户关闭表单必填门槛时）不应产出 `# ` 空红头行，
    // 而应输出可见占位标题；空缺由 checkFormat 的 TITLE_EMPTY（error）显著提示。
    const markdown = toMarkdown(buildDoc({ title: "" }))
    expect(markdown).not.toContain("# \n")
    expect(markdown).toContain("# 未命名公文")
  })

  it("纯空格标题同样不输出幽灵空红头", () => {
    const markdown = toMarkdown(buildDoc({ title: "   " }))
    expect(markdown).not.toContain("# \n")
    expect(markdown).toContain("# 未命名公文")
  })

  it("attachments/cc 为空数组时不输出空壳段落", () => {
    const markdown = toMarkdown(
      buildDoc({
        attachments: [],
        cc: [],
        printingOffice: undefined,
        printingDate: undefined,
      })
    )
    expect(markdown).not.toContain("附件：")
    expect(markdown).not.toContain("抄送：")
  })

  it("正文含全角标点与长段落时正常换行", () => {
    const longParagraph =
      "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设，全面提升政务服务效能，持续优化营商环境，切实增强企业和群众的获得感、幸福感，经国务院同意，现就有关工作通知如下：第一，坚持系统观念；第二，坚持问题导向；第三，坚持改革创新；第四，坚持统筹推进，确保各项任务落地见效。"
    const markdown = toMarkdown(
      buildDoc({ body: [{ type: "p", text: longParagraph }] })
    )
    expect(markdown).toContain(longParagraph)
    // 长段落落在缩进容器内，且不含被 markdown 误解的分隔
    expect(markdown).toContain("::: content.body.paragraph.indent: 2em")
    expect(markdown).not.toContain("\n\n:::\n\n")
  })

  it("h1/h2 标题自带序号前缀时剥离，避免与引擎自动编号叠加成双号", () => {
    const markdown = toMarkdown(
      buildDoc({
        body: [
          { type: "h1", text: "一、总体要求" },
          { type: "p", text: "正文" },
          { type: "h1", text: "二、主要任务" },
          { type: "h2", text: "（一）提升服务" },
          { type: "p", text: "正文" },
          { type: "h2", text: "1．强化保障" },
          { type: "p", text: "正文" },
        ],
      })
    )
    expect(markdown).toContain("## 总体要求")
    expect(markdown).toContain("## 主要任务")
    expect(markdown).toContain("### 提升服务")
    expect(markdown).toContain("### 强化保障")
    // 不应残留 LLM 手写的序号
    expect(markdown).not.toContain("## 一、")
    expect(markdown).not.toContain("### （一）")
    expect(markdown).not.toContain("### 1．")
  })

  it("标题以纯中文词开头（如“一体化”）不被误剥序号", () => {
    const markdown = toMarkdown(
      buildDoc({ body: [{ type: "h1", text: "一体化推进" }] })
    )
    expect(markdown).toContain("## 一体化推进")
  })

  it("落款/日期文本里的盖章占位被剥离（应走 seal:true 由系统生成）", () => {
    const markdown = toMarkdown(
      buildDoc({
        issuer: "国务院（此处加盖公章）",
        date: "2026年7月31日（此处加盖公章）",
      })
    )
    expect(markdown).toContain("国务院")
    expect(markdown).toContain("2026年7月31日")
    // 占位被剥离后，seal 未显式置 true → 不再额外补盖章行
    expect(markdown).not.toContain("（此处加盖公章）")
  })

  it("会议纪要渲染出席/请假/列席名单（正文后、版记前，左空二字）", () => {
    const markdown = toMarkdown(
      buildDoc({
        docType: "minutes",
        attendees: ["张三（市委办公厅）", "李四（市政府办）"],
        absentees: ["王五（市教育局）"],
        observers: ["赵六（列席）"],
      })
    )
    expect(markdown).toContain("出席：张三（市委办公厅）、李四（市政府办）")
    expect(markdown).toContain("请假：王五（市教育局）")
    expect(markdown).toContain("列席：赵六（列席）")
    // 名单在正文段落之后
    const bodyIndex = markdown.indexOf("各地区各部门要加强组织领导")
    const attendeeIndex = markdown.indexOf("出席：")
    expect(attendeeIndex).toBeGreaterThan(bodyIndex)
    // 名单使用正文缩进容器（左空二字 = indent:2em）
    expect(markdown).toContain(
      "::: content.body.paragraph.indent: 2em\n出席：张三（市委办公厅）、李四（市政府办）\n:::"
    )
  })

  it("非纪要文种不渲染出席名单", () => {
    const markdown = toMarkdown(
      buildDoc({
        docType: "gongwen",
        attendees: ["张三（市委办公厅）"],
      })
    )
    expect(markdown).not.toContain("出席：")
  })

  it("纪要不含任何名单时（attendees 为空/缺省）不输出空壳段落", () => {
    const markdown = toMarkdown(buildDoc({ docType: "minutes" }))
    expect(markdown).not.toContain("出席：")
    expect(markdown).not.toContain("请假：")
    expect(markdown).not.toContain("列席：")
  })

  it("份号/密级/紧急程度按 版头左上角 顶格居左黑体 顺序编排", () => {
    const markdown = toMarkdown(
      buildDoc({ copyNumber: "0001", securityLevel: "秘密", urgency: "加急" })
    )
    // 版头容器：左对齐 + 黑体 + 加粗（GB/T 9704 §7.2.1/7.2.2/7.2.3）
    expect(markdown).toContain(
      "::: content.body.paragraph.align: left; content.body.paragraph.indent: 0em; content.body.fonts.cjkFamily: 黑体, SimHei, STHeiti, sans-serif; content.body.style.weight: 700\n0001\n秘密\n加急\n:::"
    )
    // 份号在密级/紧急之前（版心左上角第一行）
    const copyIndex = markdown.indexOf("0001")
    const secretIndex = markdown.indexOf("秘密")
    expect(copyIndex).toBeGreaterThan(-1)
    expect(secretIndex).toBeGreaterThan(copyIndex)
  })

  it("无份号/密级/紧急时不输出版头容器", () => {
    const markdown = toMarkdown(
      buildDoc({
        copyNumber: undefined,
        securityLevel: undefined,
        urgency: undefined,
      })
    )
    expect(markdown).not.toContain("黑体, SimHei, STHeiti, sans-serif")
  })

  it("发文机关标志（红头）：红色小标宋 22pt 居中，上距版心 35mm，字距 3pt", () => {
    const markdown = toMarkdown(buildDoc({ issuingOrg: "××市人民政府文件" }))
    expect(markdown).toContain(
      "::: content.body.paragraph.align: center; content.body.paragraph.indent: 0em; content.body.fonts.cjkFamily: 方正小标宋_GBK, 方正小标宋简体, FZXiaoBiaoSong-B05, 黑体, SimHei, STHeiti, sans-serif; content.body.style.colors.text: #e60012; content.body.style.size: 22pt; content.body.paragraph.spacing.before: 35mm; content.body.paragraph.letterSpacing: 3pt\n××市人民政府文件\n:::"
    )
  })

  it("无发文机关标志时不输出红头容器", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).not.toContain("#e60012")
  })

  it("文件式红头（红头+文号齐全）在文号后、标题前输出红色分隔线 ---", () => {
    const markdown = toMarkdown(buildDoc({ issuingOrg: "××市人民政府文件" }))
    // `---` 经 red-rule-line 插件渲染为通栏红线（GB/T 9704 §7.2.6）
    const redLineIndex = markdown.indexOf("---")
    const docNumberIndex = markdown.indexOf("国发〔2026〕12号")
    const titleIndex = markdown.indexOf("# 关于加强数字政府建设的通知")
    expect(redLineIndex).toBeGreaterThan(docNumberIndex)
    expect(redLineIndex).toBeLessThan(titleIndex)
  })

  it("红头或文号缺失时不输出红色分隔线", () => {
    // 有红头无文号
    expect(
      toMarkdown(buildDoc({ issuingOrg: "××市人民政府文件", docNumber: undefined }))
    ).not.toContain("\n---\n")
    // 有文号无红头（意见等无文件式红头文种）
    expect(toMarkdown(buildDoc())).not.toContain("\n---\n")
  })

  it("上行文（请示）文号居左空一字 + 同容器签发人（doc-number-line）", () => {
    const markdown = toMarkdown(
      buildDoc({
        docType: "request",
        issuingOrg: "××市人民政府文件",
        signer: "×××",
      })
    )
    expect(markdown).toContain(
      "::: content.body.paragraph.align: left; content.body.paragraph.indent: 1em; content.body.paragraph.spacing.before: 57.9pt; class: doc-number-line"
    )
    expect(markdown).toContain("国发〔2026〕12号\n签发人：×××\n:::")
  })

  it("上行文（报告）无签发人时仍居左，不输出签发人行", () => {
    const markdown = toMarkdown(
      buildDoc({ docType: "report", issuingOrg: "××市人民政府文件" })
    )
    expect(markdown).toContain(
      "content.body.paragraph.align: left; content.body.paragraph.indent: 1em"
    )
    expect(markdown).not.toContain("签发人：")
  })

  it("下行文（通知）文号保持居中，不输出签发人", () => {
    const markdown = toMarkdown(
      buildDoc({ issuingOrg: "××市人民政府文件", signer: "×××" })
    )
    expect(markdown).toContain(
      "::: content.body.paragraph.align: center; content.body.paragraph.indent: 0em; content.body.paragraph.spacing.before: 57.9pt; class: doc-number-line"
    )
    expect(markdown).not.toContain("签发人：")
  })

  it("附注渲染为成文日期后左空二字加圆括号", () => {
    const markdown = toMarkdown(buildDoc({ annotation: "（此件公开发布）" }))
    // 去外层括号避免“（（此件公开发布））”双括号，系统统一补圆括号
    expect(markdown).toContain(
      "::: content.body.paragraph.indent: 2em\n（此件公开发布）\n:::"
    )
    expect(markdown).not.toContain("（（此件公开发布））")
  })

  it("附注无括号时不重复补括号", () => {
    const markdown = toMarkdown(buildDoc({ annotation: "此件公开发布" }))
    expect(markdown).toContain("（此件公开发布）")
  })

  it("无附注时不输出空壳附注行", () => {
    const markdown = toMarkdown(buildDoc())
    expect(markdown).not.toContain("（（")
  })

  it("抄送机关用版记容器：14pt 仿宋、左空一字、名称后句号", () => {
    const markdown = toMarkdown(
      buildDoc({ cc: ["中共中央办公厅", "全国人大常委会办公厅"] })
    )
    expect(markdown).toContain(
      "::: content.body.paragraph.indent: 1em; content.body.style.size: 14pt\n抄送：中共中央办公厅、全国人大常委会办公厅。\n:::"
    )
    // 抄送与版记容器同规格
    expect(markdown).not.toContain(
      "::: content.body.paragraph.indent: 0em\n抄送："
    )
  })

  it("印发机关/印发日期用版记容器，日期后加“印发”且右空一字", () => {
    const markdown = toMarkdown(
      buildDoc({ printingOffice: "国务院办公厅", printingDate: "2026-08-01" })
    )
    expect(markdown).toContain(
      "::: content.body.paragraph.indent: 1em; content.body.style.size: 14pt\n国务院办公厅\n2026年8月1日印发　\n:::"
    )
  })
})

describe("formatChineseDate · GB/T 9704 §6.5 中文日期", () => {
  it("ISO → 中文日期（月日不编虚位，去前导 0）", () => {
    expect(formatChineseDate("2026-07-31")).toBe("2026年7月31日")
    expect(formatChineseDate("2026-08-01")).toBe("2026年8月1日")
    expect(formatChineseDate("2026-12-30")).toBe("2026年12月30日")
  })

  it("非 ISO 日期原样返回（不误改 LLM 已写好的中文日期）", () => {
    expect(formatChineseDate("2026年7月31日")).toBe("2026年7月31日")
    expect(formatChineseDate("")).toBe("")
  })

  it("月/日越界或为 0 的无效日期原样返回，不产生“2026年13月1日”", () => {
    expect(formatChineseDate("2026-13-01")).toBe("2026-13-01")
    expect(formatChineseDate("2026-00-10")).toBe("2026-00-10")
    expect(formatChineseDate("2026-01-00")).toBe("2026-01-00")
    expect(formatChineseDate("2026-00-00")).toBe("2026-00-00")
  })

  it("超出当月实有天数的无效日期原样返回（4月31日/2月30日/6月31日）", () => {
    expect(formatChineseDate("2026-04-31")).toBe("2026-04-31")
    expect(formatChineseDate("2026-02-30")).toBe("2026-02-30")
    expect(formatChineseDate("2026-06-31")).toBe("2026-06-31")
  })

  it("边界日期正常转换：1月1日 / 12月31日", () => {
    expect(formatChineseDate("2026-01-01")).toBe("2026年1月1日")
    expect(formatChineseDate("2026-12-31")).toBe("2026年12月31日")
  })

  it("落款成文日期渲染为中文日期（月日不编虚位）", () => {
    const markdown = toMarkdown(buildDoc({ date: "2026-07-31" }))
    expect(markdown).toContain("2026年7月31日")
    expect(markdown).not.toContain("2026-07-31")
  })

  it("版记印发日期同样渲染为中文日期", () => {
    const markdown = toMarkdown(
      buildDoc({ printingOffice: "国务院办公厅", printingDate: "2026-08-01" })
    )
    expect(markdown).toContain("国务院办公厅\n2026年8月1日")
    expect(markdown).not.toContain("2026-08-01")
  })
})

describe("patchMarkdownElements · 要素编辑面板回填（H1 数据丢失修复）", () => {
  const doc = buildDoc({
    body: [
      { type: "p", text: "第一段正文内容。" },
      { type: "h1", text: "总体要求" },
      { type: "p", text: "第二段正文。" },
    ],
  })
  const md = toMarkdown(doc)

  it("要素改动生效（文号更新），用户手动改过的正文保留", () => {
    // 用户在编辑器里把第一段正文改掉了
    const edited = md.replace(
      "第一段正文内容。",
      "第一段正文内容【用户修改】。"
    )
    const next = { ...doc, docNumber: "国发〔2026〕99号" }
    const patched = patchMarkdownElements(edited, next)

    expect(patched).toContain("国发〔2026〕99号") // 要素区更新
    expect(patched).not.toContain("国发〔2026〕12号")
    expect(patched).toContain("第一段正文内容【用户修改】。") // 正文保留
    expect(patched).toContain("第二段正文。") // 未改正文原样
    expect(patched).toContain("## 总体要求") // 标题保留
  })

  it("标题改动生效，正文不受影响", () => {
    const edited = md.replace(
      "第一段正文内容。",
      "第一段正文内容【用户修改】。"
    )
    const next = { ...doc, title: "关于更新标题的通知" }
    const patched = patchMarkdownElements(edited, next)
    expect(patched).toContain("# 关于更新标题的通知")
    expect(patched).toContain("第一段正文内容【用户修改】。")
  })

  it("编辑器里改过正文标题，要素面板保存后标题修改保留", () => {
    const edited = md.replace("## 总体要求", "## 总体要求（用户改）")
    const patched = patchMarkdownElements(edited, { ...doc, title: "新标题" })
    expect(patched).toContain("## 总体要求（用户改）")
    expect(patched).toContain("# 新标题")
  })

  it("编辑器无改动时，patch 结果与全量重建一致", () => {
    const next = { ...doc, docNumber: "国发〔2026〕99号" }
    expect(patchMarkdownElements(md, next)).toBe(toMarkdown(next))
  })

  it("附件要素更新生效（锚块后的正文不再被当正文保留）", () => {
    const withAttachment = buildDoc({
      body: [{ type: "p", text: "正文第一段。" }],
      attachments: ["任务清单"],
    })
    const base = toMarkdown(withAttachment)
    const edited = base.replace("正文第一段。", "正文第一段【用户改】。")
    const next = { ...withAttachment, attachments: ["任务清单", "工作台账"] }
    const patched = patchMarkdownElements(edited, next)
    expect(patched).toContain("正文第一段【用户改】。")
    expect(patched).toContain("附件：1．任务清单")
    expect(patched).toContain("2．工作台账")
  })

  it("含红头（issuingOrg）时正文手动修改仍保留（M-6 回归）", () => {
    // RED_HEAD descriptor 含 spacing.before: 35mm，曾触发 isElementAnchorBlock 的
    // spacing.before 误判，导致红头之后正文全部回退 IR 重建稿、覆盖手动修改。
    const withOrg = buildDoc({
      issuingOrg: "××市人民政府",
      body: [{ type: "p", text: "红头后的正文。" }],
    })
    const base = toMarkdown(withOrg)
    const edited = base.replace("红头后的正文。", "红头后的正文【用户改】。")
    const patched = patchMarkdownElements(edited, { ...withOrg, title: "新标题" })
    expect(patched).toContain("红头后的正文【用户改】。")
    expect(patched).toContain("# 新标题")
  })

  it("会议纪要名单更新生效", () => {
    const minutes = buildDoc({
      docType: "minutes",
      body: [{ type: "p", text: "会议第一段。" }],
      attendees: ["张三"],
    })
    const base = toMarkdown(minutes)
    const edited = base.replace("会议第一段。", "会议第一段【用户改】。")
    const next = { ...minutes, attendees: ["张三", "李四"] }
    const patched = patchMarkdownElements(edited, next)
    expect(patched).toContain("会议第一段【用户改】。")
    expect(patched).toContain("出席：张三、李四")
  })

  it("用户在编辑器里新增正文段后 applyEdit 不丢段落", () => {
    // 生成时正文 2 段；用户手动加了第 3 段正文容器。
    const edited =
      md +
      '\n\n::: content.body.paragraph.indent: 2em\n用户新增的第三段。\n:::'
    const next = { ...doc, docNumber: "国发〔2026〕99号" }
    const patched = patchMarkdownElements(edited, next)

    expect(patched).toContain("用户新增的第三段。")
    expect(patched).toContain("第一段正文内容。")
    expect(patched).toContain("第二段正文。")
    expect(patched).toContain("国发〔2026〕99号")
  })

  it("用户在编辑器里删除正文段后 applyEdit 不还原已删段", () => {
    // 生成时正文含"总体要求"标题段；用户手动删掉它。
    const edited = md.replace("\n## 总体要求\n", "\n")
    const next = { ...doc, docNumber: "国发〔2026〕99号" }
    const patched = patchMarkdownElements(edited, next)

    expect(patched).not.toContain("总体要求")
    expect(patched).toContain("第一段正文内容。")
    expect(patched).toContain("第二段正文。")
    expect(patched).toContain("国发〔2026〕99号")
  })
})
