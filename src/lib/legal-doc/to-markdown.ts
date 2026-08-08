import type { LegalDoc } from "./types"
import { isValidIsoDate } from "./format-check"
import { isFileRedHeadDocType } from "./doc-type-spec"

const SEPARATOR = "\n"

/** 落款（署名+日期）容器标记：分页器保持整块不拆、不与正文断页分离。 */
const SIGNATURE_BLOCK_CLASS = "keep-together"

/**
 * 标题字号按标题字数递减（GB/T 9704 §7.3.1 标准为 2 号 22pt，但标题超过一行
 * 篇幅时同字号整行铺满会过满；实测习惯是标题越长字号越小，保证多行标题整体
 * 紧凑居中）。字数 ≤14 用标准 2 号；15-18 用 20pt；19-22 用 18pt；23+ 用 16pt。
 * 空标题返回 null（由调用方回退占位标题，不套字号容器）。
 */
function titleFontSize(title: string): string | null {
  const count = Array.from(title).length
  if (count <= 0) return null
  if (count <= 14) return null
  if (count <= 18) return "20pt"
  if (count <= 22) return "18pt"
  return "16pt"
}

/**
 * 标题中的 markdown 行内特殊字符转义（M2）：标题经 markdown-it 渲染成红头
 * `<h1>`，行内 `*`/`_`/`[`/`]`/`` ` ``/`~~`/`<` 等若不转义会被渲染成
 * `<em>`/`<a>`/`<code>`/`<s>` 等，与表单/LLM 提供的标题视觉不一致。
 * 这里只转义行内结构的成对标记字符，不做整个标题的全面 escape（保留标题
 * 原有文本，仅阻止 markdown-it 把它当行内语法）。用反斜杠转义后
 * markdown-it 会渲染成字面字符（`\*` → `*`）。
 */
function escapeMarkdownInline(text: string): string {
  return text.replace(/([\\`*_[\]<>~])/g, "\\$1")
}

const CENTERED =
  "content.body.paragraph.align: center; content.body.paragraph.indent: 0em"
const RIGHT_ALIGNED =
  "content.body.paragraph.align: right; content.body.paragraph.indent: 0em"
const FLUSH_LEFT = "content.body.paragraph.indent: 0em"
/**
 * 上行文（请示/报告）发文字号编排：居左空一字（GB/T 9704 §7.2.5），
 * 右侧同排签发人。下行文才用居中（CENTERED）。
 */
const UPWARD_DOC_NUMBER =
  "content.body.paragraph.align: left; content.body.paragraph.indent: 1em"
const BODY_INDENT = "content.body.paragraph.indent: 2em"
/**
 * 版头密级/紧急程度（GB/T 9704 §7.2.2/7.2.3）：顶格居左、黑体。
 * §7.2.1 份号与密级/紧急同为版头左上方要素，共用同一容器。
 */
const LETTERHEAD =
  "content.body.paragraph.align: left; content.body.paragraph.indent: 0em; content.body.fonts.cjkFamily: 黑体, SimHei, STHeiti, sans-serif; content.body.style.weight: 700"
/**
 * 版记容器（GB/T 9704 §7.4.2/7.4.3）：4 号（14pt）仿宋、左空一字（indent 1em）。
 * 抄送机关、印发机关、印发日期共用。
 */
const VERSION_MEMO =
  "content.body.paragraph.indent: 1em; content.body.style.size: 14pt"
/**
 * 红头（发文机关标志）字号按机关名长度自适应（GB/T 9704 §7.2.4）：红头是
 * 整个版头最醒目、字号最大的要素，须与下方 3 号仿宋发文字号（16pt）拉开
 * 视觉差距——≤6 字初号 42pt；7-10 字小初 36pt；11-13 字 30pt；≥14 字 26pt
 * （版心宽 ~436pt，26pt+3pt 字距 15 字仍单行放得下）。空机关名返回空串。
 */
function redHeadFontSize(org: string): string {
  const count = Array.from(org).length
  if (count <= 0) return ""
  if (count <= 6) return "42pt"
  if (count <= 10) return "36pt"
  if (count <= 13) return "30pt"
  return "26pt"
}

function container(descriptor: string, lines: string[]): string[] {
  return [`::: ${descriptor}`, ...lines, ":::"]
}

/**
 * 剥离标题文本开头的序号前缀。引擎对 h2/h3/h4 会按样式自动加序号
 * （gb-t-9704.yaml：h2 `{zhHansIndex}、`、h3 `（{zhHansIndex}）`、h4 `{arabicIndex}．`）。
 * LLM 若把"一、""（一）""1．"写进了 h1/h2/h3 的 text，会渲染成"一、一、"双号，
 * 这里防御性剥掉段首序号，避免与引擎编号叠加。
 * 注意三个分支都必须带分隔符（、．）或成对括号：纯"一"（如"一体化"）不剥。
 */
const ORDER_PREFIX_PATTERN =
  /^(?:[一二三四五六七八九十百]+、|\d+[．.、]|[（(][一二三四五六七八九十百\d]+[）)])/

function stripLeadingOrder(text: string): string {
  return text.replace(ORDER_PREFIX_PATTERN, "").trim()
}

/** 落款/日期文本里被 LLM 误写的盖章占位（应走 seal 由系统排版，不打印任何盖章字样）。 */
const SEAL_PLACEHOLDER_PATTERN =
  /[（(]?(?:此处加盖公章|此处盖章|盖章处|加盖公章处|加盖公章)[）)]?/g

function stripSealPlaceholder(text: string): string {
  return text.replace(SEAL_PLACEHOLDER_PATTERN, "").trim()
}

/**
 * 成文日期/印发日期在落款版记中按 GB/T 9704-2012 §6.5 编排：
 * “用阿拉伯数字将年、月、日标全，月、日不编虚位”，即 2026-08-01 → 2026年8月1日。
 * 判定逻辑与 checkFormat 共用（真实存在的 ISO 日期）；非 ISO 或月/日越界
 * （含超出当月实有天数）的输入原样返回，避免把 LLM 已写好的中文日期改坏、
 * 也不产生“2026年4月31日”这类错误日期。
 */
export function formatChineseDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso
  const [, year, month, day] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)!
  return `${year}年${Number(month)}月${Number(day)}日`
}

/**
 * 不加盖公章落款错位量（GB/T 9704-2012 §7.3.5.2）：
 * 署名编排在正文下空一行右空二字处；成文日期排署名下一行，首字比署名首字右移二字；
 * 日期长于署名时，改日期右空二字、署名右空数相应增加。用尾部全角空格实现右对齐容器
 * 内的相对错位（U+3000 非可折叠空白、浏览器保留）。
 */
function noSealTrailingSpaces(
  issuerLength: number,
  dateLength: number
): { issuerPad: number; datePad: number } {
  if (dateLength <= issuerLength) {
    return { issuerPad: 2, datePad: issuerLength - dateLength }
  }
  return { issuerPad: dateLength - issuerLength + 4, datePad: 2 }
}

/** 附注文本去外层括号，避免与系统补的圆括号叠加成“（（…））”。 */
function stripAnnotationParens(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^（(.+)）$/)
  return match ? match[1] : trimmed
}

function renderBody(doc: LegalDoc): string[][] {
  const blocks: string[][] = []
  let pendingParagraphs: string[] = []

  const flushParagraphs = (): void => {
    if (pendingParagraphs.length > 0) {
      blocks.push(container(BODY_INDENT, pendingParagraphs))
      pendingParagraphs = []
    }
  }

  for (const paragraph of doc.body) {
    if (paragraph.type === "p") {
      pendingParagraphs.push(paragraph.text)
    } else if (paragraph.type === "h1") {
      flushParagraphs()
      blocks.push([`## ${stripLeadingOrder(paragraph.text)}`])
    } else {
      flushParagraphs()
      blocks.push([`### ${stripLeadingOrder(paragraph.text)}`])
    }
  }
  flushParagraphs()

  return blocks
}

/**
 * Convert a LegalDoc into the Markdown source the ezdoc pipeline renders
 * through the GB/T 9704 rule. `#` triggers the red-head title (h1),
 * `##`/`###` map to engine h2/h3 (一级/二级标题), and canonical-path `:::`
 * containers carry the body indent and 版记 alignment overrides.
 */
export function toMarkdown(doc: LegalDoc): string {
  const blocks: string[][] = []

  // 版头（GB/T 9704 §7.2.1/7.2.2/7.2.3）：份号、密级、紧急程度顶格居左、黑体，
  // 自上而下依次编排于版心左上角（§7.2.1 份号在版心左上角第一行）。
  const letterheadLines = [
    doc.copyNumber,
    doc.securityLevel,
    doc.urgency,
  ].filter((value): value is string => Boolean(value))
  if (letterheadLines.length > 0) {
    blocks.push(container(LETTERHEAD, letterheadLines))
  }

  // 发文机关标志（红头，GB/T 9704 §7.2.4）：红色小标宋居中，上边缘距版心上边缘 35mm。
  // 字号按机关名长度自适应（redHeadFontSize），始终大于标题 22pt、远超文号 16pt，
  // 保持版头"红头最醒目"的层级。letterSpacing 随字号微调（大字号宽字距更舒展，
  // 小字号收窄防多字铺不下）——该变量由 body-builder 的 .local-style-container
  // 规则消费，覆盖 body 的 charsPerLine 字距 calc（大字号下 calc 会变负值导致
  // 红字重叠，见 heading-builder 同构处理）。
  // 仅文件式红头文种（通知/通报）渲染红头——其他文种的 issuingOrg 即使被 LLM
  // 填了（如命令的"×××令"标志）也不渲染成"×××文件"式红头（isFileRedHeadDocType）。
  const hasFileRedHead = isFileRedHeadDocType(doc.docType)
  if (hasFileRedHead && doc.issuingOrg && doc.issuingOrg.trim().length > 0) {
    const org = doc.issuingOrg.trim()
    const redSize = redHeadFontSize(org)
    const redLetterSpacing = redSize === "42pt" || redSize === "36pt" ? "4pt" : "3pt"
    const redHeadStyle = [
      "content.body.paragraph.align: center",
      "content.body.paragraph.indent: 0em",
      "content.body.fonts.cjkFamily: 方正小标宋_GBK, 方正小标宋简体, FZXiaoBiaoSong-B05, 黑体, SimHei, STHeiti, sans-serif",
      "content.body.style.colors.text: #e60012",
      `content.body.style.size: ${redSize}`,
      "content.body.paragraph.spacing.before: 35mm",
      `content.body.paragraph.letterSpacing: ${redLetterSpacing}`,
    ].join("; ")
    blocks.push(container(redHeadStyle, [org]))
  }

  // 发文字号（GB/T 9704 §7.2.5）：编排在发文机关标志（红头）下空二行处。
  // 下行文（通知等）文号居中；上行文（请示/报告）文号居左空一字、同行右侧排签发人
  // （同容器两行 + .doc-number-line flex 两端对齐）。空二行 = 2 × 3 号行高；
  // 无红头时（意见等无文件式红头文种）文号顶格无前置间距。
  const isUpwardDoc = doc.docType === "request" || doc.docType === "report"
  if (doc.docNumber) {
    const hasRedHead = hasFileRedHead && doc.issuingOrg && doc.issuingOrg.trim().length > 0
    const alignment = isUpwardDoc ? UPWARD_DOC_NUMBER : CENTERED
    const docNumberLines = [doc.docNumber]
    if (isUpwardDoc && doc.signer) {
      docNumberLines.push(`签发人：${doc.signer}`)
    }
    const docNumberStyle = hasRedHead
      ? `${alignment}; content.body.paragraph.spacing.before: 57.9pt; class: doc-number-line`
      : alignment
    blocks.push(container(docNumberStyle, docNumberLines))
  }

  // 红色分隔线（GB/T 9704 §7.2.6）：文件式红头（红头+文号齐全）下方通栏红线的
  // 前置条件，在发文字号下 4mm 处。`---` 经 red-rule-line 插件渲染为红色横线。
  if (hasFileRedHead && doc.issuingOrg && doc.docNumber) {
    blocks.push(["---"])
  }

  // 标题空缺（LLM 未给出、且用户关闭表单必填门槛时）不输出幽灵红头 `# `，
  // 而是输出一个可见占位标题，让生成的文档始终有可辨识的标题行；空缺本身
  // 由 checkFormat 的 TITLE_EMPTY（error 级）在结果面板显著提示。
  const titleText =
    doc.title.trim().length > 0 ? escapeMarkdownInline(doc.title.trim()) : "未命名公文"
  const titleSize = titleFontSize(doc.title)
  // 标题容器（GB/T 9704 §7.3.1 分隔线下空二行由 h1 spacing.before 实现）。
  // 标题超过 14 字时按字数递减字号，容器覆盖 content.h1.style.size；h1 字格
  // letter-spacing 与 ::after 尾距补偿都以该变量为字号基准，覆盖后自动重算——
  // 但字号缩小会让字格 calc 暴增（442/20−16pt ≈ +6.1pt），故同时把 letter-spacing
  // 覆盖为 0em（heading-builder 消费该变量，::after 补偿同步），标题保持紧凑居中。
  // class: keep-together 让分页器把标题容器整块原子处理、不拆分（等价于裸 `#`
  // 的 h1 不拆行为）——否则分页器会把容器解包、把 local-style-container 类落到
  // h1 上，其 0,2,0 选择器会压过 `.preview-content h1`（0,1,1），把标题打回正文。
  if (titleSize) {
    blocks.push(
      container(
        `content.h1.style.size: ${titleSize}; content.h1.paragraph.letterSpacing: 0em; class: ${SIGNATURE_BLOCK_CLASS}`,
        [`# ${titleText}`]
      )
    )
  } else {
    blocks.push([`# ${titleText}`])
  }

  if (doc.recipient) {
    blocks.push(container(FLUSH_LEFT, [doc.recipient]))
  }

  blocks.push(...renderBody(doc))

  if (doc.attachments && doc.attachments.length > 0) {
    // GB/T 9704-2012 §7.3.4：附件说明排在正文下空一行、左空二字。单个附件不编号
    // （“附件：×××”），多个附件用阿拉伯数字标注顺序号，续行序号与首行序号对齐
    // （“附件：”3 字，续行以 3 个全角空格占位，U+3000 非可折叠空白、浏览器保留）。
    // spacing.before 28.95pt = 正文一行行高，即“正文下空一行”。
    const lines =
      doc.attachments.length === 1
        ? [`附件：${doc.attachments[0]}`]
        : doc.attachments.map(
            (attachment, index) =>
              `${index === 0 ? "附件：" : "　　　"}${index + 1}．${attachment}`
          )
    blocks.push(
      container(
        `${BODY_INDENT}; content.body.paragraph.spacing.before: 28.95pt`,
        lines
      )
    )
  }

  // 会议纪要出席/请假/列席名单：按 GB/T 9704-2012 第 10.3 条"纪要格式"，
  // 正文或附件说明下空一行，左空二字编排"出席：…"（回行对齐冒号后首字）。
  // "出席"二字黑体、姓名仿宋的混合字体属版式层字体建模（需引擎 span 级字体），
  // 留待 v2，此处用标准正文缩进容器。
  if (doc.docType === "minutes") {
    if (doc.attendees && doc.attendees.length > 0) {
      blocks.push(container(BODY_INDENT, [`出席：${doc.attendees.join("、")}`]))
    }
    if (doc.absentees && doc.absentees.length > 0) {
      blocks.push(container(BODY_INDENT, [`请假：${doc.absentees.join("、")}`]))
    }
    if (doc.observers && doc.observers.length > 0) {
      blocks.push(container(BODY_INDENT, [`列席：${doc.observers.join("、")}`]))
    }
  }

  const signatureLines: string[] = []
  if (doc.issuer) signatureLines.push(stripSealPlaceholder(doc.issuer))
  if (doc.date)
    signatureLines.push(stripSealPlaceholder(formatChineseDate(doc.date)))
  if (signatureLines.length > 0) {
    // 落款（署名+日期）必须与正文同页（背页修复）：容器标 keep-together，
    // 分页器整体处理不拆分；空间不足时收紧行距挤回本页。
    if (doc.seal === true) {
      // 需盖章：署名与成文日期分别右对齐，署名上方 spacing.before 在正文末与落款之间
      // 留出印章空间（15mm）。印章由用户打印后手工加盖（骑年盖月），仅预留位置，
      // 绝不打印“此处盖章”字样。spacing.before 只加在署名容器，避免撑开署名与日期间距。
      // 成文日期按 §7.3.5.1 右空四字（尾部 4 全角空格）。
      if (doc.issuer) {
        blocks.push(
          container(
            `${RIGHT_ALIGNED}; content.body.paragraph.spacing.before: 15mm; class: ${SIGNATURE_BLOCK_CLASS}`,
            [signatureLines[0]]
          )
        )
      }
      if (doc.date) {
        blocks.push(
          container(
            `${RIGHT_ALIGNED}; class: ${SIGNATURE_BLOCK_CLASS}`,
            [`${signatureLines[signatureLines.length - 1]}　　　　`]
          )
        )
      }
    } else {
      // 不加盖公章：按 GB/T 9704-2012 §7.3.5.2 靠右编排——署名右空二字、日期排其下一行
      // 且首字比署名首字右移二字（日期长于署名时改日期右空二字、署名右空数相应增加）。
      // 署名容器 spacing.before 28.95pt = 正文下空一行。错位量由署名/日期实际字数动态计算。
      const issuerText = doc.issuer
        ? stripSealPlaceholder(doc.issuer)
        : signatureLines[0]
      const dateText = doc.date
        ? stripSealPlaceholder(formatChineseDate(doc.date))
        : signatureLines[signatureLines.length - 1]
      const issuerLen = Array.from(issuerText).length
      const dateLen = Array.from(dateText).length
      const { issuerPad, datePad } = noSealTrailingSpaces(issuerLen, dateLen)
      if (doc.issuer) {
        blocks.push(
          container(
            `${RIGHT_ALIGNED}; content.body.paragraph.spacing.before: 28.95pt; class: ${SIGNATURE_BLOCK_CLASS}`,
            [`${issuerText}${"　".repeat(issuerPad)}`]
          )
        )
      }
      if (doc.date) {
        blocks.push(
          container(
            `${RIGHT_ALIGNED}; class: ${SIGNATURE_BLOCK_CLASS}`,
            [`${dateText}${"　".repeat(datePad)}`]
          )
        )
      }
    }
  }

  // 不再输出“（此处加盖公章）”占位文字——所有情况都禁止该字样出现。

  // 附注（GB/T 9704-2012 §7.3.6）：居左空二字加圆括号，编排在成文日期下一行、抄送之前。
  if (doc.annotation && doc.annotation.trim().length > 0) {
    blocks.push(
      container(BODY_INDENT, [`（${stripAnnotationParens(doc.annotation)}）`])
    )
  }

  if (doc.cc && doc.cc.length > 0) {
    // 抄送机关（GB/T 9704-2012 §7.4.2）：4 号（14pt）仿宋、左右各空一字（indent 1em）、
    // 名称后加句号。
    blocks.push(container(VERSION_MEMO, [`抄送：${doc.cc.join("、")}。`]))
  }

  const printingLines: string[] = []
  if (doc.printingOffice) printingLines.push(doc.printingOffice)
  if (doc.printingDate) {
    // 印发日期（GB/T 9704-2012 §7.4.3）：日期后加“印发”二字且右空一字。
    printingLines.push(`${formatChineseDate(doc.printingDate)}印发　`)
  }
  if (printingLines.length > 0) {
    // 印发机关/印发日期（§7.4.3）：4 号（14pt）仿宋，机关左空一字。
    blocks.push(container(VERSION_MEMO, printingLines))
  }

  return blocks.map((block) => block.join(SEPARATOR)).join(SEPARATOR)
}

// toMarkdown 用单个 `\n`（SEPARATOR）连接逻辑块（容器内部行也是 `\n`），
// 所以不能用 `\n\n` 切块——那会把整篇并成一个块。切块的依据是块首行：
// 标题行（`#`/`##`/`###`）或容器描述行（`::: `）。容器内部行、正文行都归入当前块。
function splitDocBlocks(markdown: string): string[] {
  const lines = markdown.split("\n")
  const blocks: string[] = []
  let current: string[] = []
  const flush = (): void => {
    if (current.length > 0) {
      blocks.push(current.join("\n"))
      current = []
    }
  }
  for (const line of lines) {
    if (/^#{1,3} /.test(line) || line.startsWith("::: ")) flush()
    current.push(line)
  }
  flush()
  return blocks
}

/**
 * 是否"正文块"（用户可能在编辑器里手动修改、applyEdit 必须保留的块）：
 * - 正文缩进容器：descriptor 恰为 `content.body.paragraph.indent: 2em`（renderBody 的 p 段容器）。
 *   附件容器 descriptor 是 `2em; ...spacing.before:`，不匹配；文号/主送/落款容器带
 *   `align:`/更长 descriptor，不匹配——这些是要素区，走 IR 重建。
 * - 正文一级/二级标题（`##` / `###`）。红头 `#` 是要素区标题，不在其列。
 */
function isBodyTypedBlock(block: string): boolean {
  if (block.startsWith("::: ")) {
    return (
      block.startsWith("::: content.body.paragraph.indent: 2em\n") ||
      block === "::: content.body.paragraph.indent: 2em"
    )
  }
  return block.startsWith("## ") || block.startsWith("### ")
}

/**
 * 是否"要素锚块"：正文区在文档里的终点。toMarkdown 的正文区（body）一定排在
 * 附件/纪要名单/落款/附注/版记之前，所以遇到这些锚块后 inBody 即止，其后即使是
 * 2em 容器（纪要名单/附注）也不再当正文保留，而是从 IR 重建。
 * 锚判定分两类：descriptor 关键字（落款 align:right、版记 14pt、附件 spacing.before），
 * 以及纪要名单的内容行（`出席：`/`请假：`/`列席：`，容器首行被 `::: ` 占住，须看内容行）。
 */
function isElementAnchorBlock(block: string): boolean {
  if (block.includes("content.body.paragraph.align: right")) return true // 落款署名/成文日期
  if (block.includes("content.body.style.size: 14pt")) return true // 版记（抄送/印发）
  if (block.includes("spacing.before: 28.95pt")) return true // 附件说明（下空一行）
  const contentLines = block
    .split("\n")
    .filter((l) => l.length > 0 && l !== ":::" && !l.startsWith("::: "))
  return contentLines.some((l) => /^(出席|请假|列席)：/.test(l)) // 会议纪要名单
}

/**
 * 要素编辑面板回填（#29 修复）：以 nextDoc 重建整篇 markdown，但把重建稿正文区里的
 * 正文块（BODY_INDENT 容器 + `##`/`###` 标题）逐个替换为编辑器当前 content 里对应的
 * 正文块原文。要素区（版头/红头/标题/文号/主送/附件/纪要名单/落款/附注/抄送/印发）
 * 始终来自 nextDoc，确保面板改的要素生效；正文块保留用户在编辑器里的手动修改。
 *
 * 正文区以第一个要素锚块（附件/纪要名单/落款/版记）为终点——applyFormValuesToDoc 不碰
 * body，重建稿正文块数量与上次生成的正文块数量一致。用户若在编辑器里增删过正文段落，
 * 槽位对不上时缺失的槽位回退到重建稿默认值（内容来自 IR 快照，非丢失）；多余的
 * currentBodyBlocks 不会被消费。
 */
export function patchMarkdownElements(
  currentMarkdown: string,
  nextDoc: LegalDoc
): string {
  const rebuilt = toMarkdown(nextDoc)
  const rebuiltBlocks = splitDocBlocks(rebuilt)
  const currentBodyBlocks =
    splitDocBlocks(currentMarkdown).filter(isBodyTypedBlock)

  // 定位重建稿正文区（第一个正文块 → 第一个要素锚块之前的连续区间）。
  // 用户可能在编辑器里增删过正文段，槽位对不上——按"正文区整体替换"处理：
  // 重建稿正文区整体换成编辑器当前的正文块列表，数量可以不同。
  const firstBody = rebuiltBlocks.findIndex(isBodyTypedBlock)
  let bodyEnd = rebuiltBlocks.length
  for (let i = firstBody + 1; i < rebuiltBlocks.length; i += 1) {
    if (isElementAnchorBlock(rebuiltBlocks[i]!)) {
      bodyEnd = i
      break
    }
  }

  if (firstBody === -1) return rebuilt

  const prefix = rebuiltBlocks.slice(0, firstBody)
  const suffix = rebuiltBlocks.slice(bodyEnd)
  const out = [...prefix, ...currentBodyBlocks, ...suffix]
  return out.join("\n")
}
