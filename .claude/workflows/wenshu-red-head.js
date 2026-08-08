/**
 * 文秘 agent 体验验收：红头渲染质量专项。
 *
 * 背景：用户反馈"红头文件生成得一言难尽"，此前文秘验收只在 backlog 里打了
 * 规划条目、从未真正跑过（脚本都不存在）。本 workflow 补上验收通道。
 *
 * 素材：scripts/gen-acceptance-fixtures.ts 生成的三组渲染产物
 * （.claude/tmp/wenshu-acceptance/01-raw / 02-repaired / 03-ideal），
 * 覆盖修复前（文号顶行+抄送混正文）→ 修复后 → 理想态。
 *
 * 任务：以"文秘/格式校对"视角通读渲染链路代码 + 审查渲染产物，找出红头
 * 生成的残留问题。分三路并行 → 对抗验证 → 合成。
 */
export const meta = {
  name: "wenshu-red-head",
  description:
    "文秘视角红头渲染质量专项验收：通读渲染链路 + 审查产物 + 对抗验证",
  phases: [
    { title: "文秘三路审查", detail: "渲染链路 / 生成产物 / 交互体验 并行" },
    { title: "对抗验证", detail: "每条发现独立验证是否属实" },
    { title: "合成", detail: "汇总确认缺陷与修复建议" },
  ],
}

const ACCEPTANCE_DIR = "E:/ezdoc-v2/.claude/tmp/wenshu-acceptance"

const RED_HEAD_EXPECTATIONS = `以 GB/T 9704-2012《党政机关公文格式》为验收标准，红头（发文机关标志 §7.2.4）必须满足：
1. 红色（红头必须是红色字，电子稿 #e60012 近似）
2. 小标宋 2 号（22pt）
3. 居中
4. 位于版心最上方要素（密级/紧急之后、文号之前）
5. 内容为"机关全称/规范化简称 + 文件"
发文字号（§7.2.5）在红头之下空二行居中，字号 3 号仿宋（16pt），颜色应为红色（与红头同色系）。`

const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { enum: ["P0", "P1", "P2"] },
          evidence: { type: "string" },
          file: { type: "string" },
          line: { type: "string" },
          why: { type: "string" },
        },
        required: ["title", "severity", "evidence", "why"],
      },
    },
  },
  required: ["findings"],
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { enum: ["real", "false-positive", "already-fixed"] },
    reason: { type: "string" },
  },
  required: ["verdict", "reason"],
}

phase("文秘三路审查")

const LENSES = [
  {
    key: "render-chain",
    prompt: `你是资深公文排版工程师。通读 ezdoc 红头渲染链路代码，找出红头生成的问题。

验收目标（GB/T 9704-2012）：
${RED_HEAD_EXPECTATIONS}

必读文件（E:/ezdoc-v2）：
- src/lib/legal-doc/to-markdown.ts（红头/文号/版记如何生成 markdown 容器）
- src/lib/legal-doc/review/repair-doc.ts（红头缺失时如何推导、抄送如何提取）
- src/lib/legal-doc/format-check.ts（有文号无红头如何提示）
- src/lib/legal-doc/prompt.ts（prompt 如何引导 LLM 填红头）
- src/engine/builtin-rules/gb-t-9704.yaml（h1/正文样式定义）
- src/engine/parser/processors/（markdown → HTML 渲染，尤其 ::: 容器如何处理）

重点排查：
1. 红头颜色/字号/字体是否真的渲染为 22pt 红色小标宋？还是丢了某个样式？
2. 文号颜色：GB/T 9704 文号应为红色，代码里文号容器（CENTERED）是否无色（黑色）？
3. 红头与标题（#）的关系：红头是 :: 容器 + 标题是 h1，两者会不会视觉重复或错位？
4. repairDoc 红头推导逻辑是否有会生成错误红头的边界情况？
5. prompt 引导是否足够让 LLM 稳定产出红头？

每条发现给出：标题/严重级(P0严重缺陷 P1影响体验 P2改进建议)/证据(文件:行号)/为什么。

只报你读代码确认属实的问题，报 ≤8 条。`,
  },
  {
    key: "render-output",
    prompt: `你是专门负责"肉眼看渲染结果"的公文格式校对员。验收目录 ${ACCEPTANCE_DIR} 下有三组产物：

- 01-raw-llm-output.md / .html：修复前（LLM 原始输出直接渲染：文号顶行、抄送混正文）
- 02-repaired.md / .html：repairDoc 修复后
- 03-ideal.md / .html：理想形态（红头 + 抄送入版记）

请以文秘校对视角，逐行审查三个 markdown 源文件和渲染出的 HTML，对照 GB/T 9704 验收标准：

${RED_HEAD_EXPECTATIONS}

重点检查渲染产物本身：
1. 02-repaired / 03-ideal 的红头容器是否真的渲染了红色 22pt 居中？看 HTML 里红头 <p> 的 CSS 变量是否完整（--content-body-style-colors-text 红色 / --content-body-style-size: 22pt / align center）？
2. 文号容器的 CSS 变量：是否有颜色？如果无色，文号是黑色——对照 GB/T 9704 文号应为红色，这就是缺陷。
3. 红头（重庆市人民政府文件）和标题（关于印发《…》的通知）会不会视觉重复？正文里书刊名《××市数字经济促进条例》是否被正确包成 cn-book-title？
4. 抄送是否已从正文移到版记（14pt indent 1em）？正文里"特此通知。"是否独立成段？
5. 落款（重庆市人民政府 + 日期右对齐）与 GB/T 9704 §7.3.5.2 是否一致？

每条发现给出：标题/严重级/证据（哪个文件哪行/哪个 CSS 变量缺失）/为什么。
只报你在产物里真能看到的问题，报 ≤6 条。`,
  },
  {
    key: "edge-cases",
    prompt: `你是公文格式专家，专门抓"边界情况"。红头推导与抄送提取刚上线（repairDoc），我要你用刁钻输入找 bug。

验收标准：
${RED_HEAD_EXPECTATIONS}

必读代码：
- E:/ezdoc-v2/src/lib/legal-doc/review/repair-doc.ts（inferRedHeadFromIssuer + extractCcParagraph）

重点攻击：
1. 红头推导（inferRedHeadFromIssuer）：issuer 是"重庆市人民政府办公厅"时推导成"重庆市人民政府办公厅文件"——红头该是"重庆市人民政府文件"还是带"办公厅"？issuer="XX办公室"（无政府/人民字样）呢？issuer 结尾是"委员会"呢？issuer 是普通名词（"市财政局"）呢？有没有推导出错误红头的场景？
2. 抄送提取（extractCcParagraph）：正文"抄送：A、B。"在段落中间（非段首、非收尾语后）会怎样？正文只有"抄送：xxx"且无收尾语会怎样？cc 已有内容但正文又有"抄送："段会怎样（会不会重复）？
3. 边界：红头内容超长（机关全称很长）会不会换行错乱？红头里有标点/数字？

每条发现给出：标题/严重级/触发输入/当前行为/应该行为。
只报你读代码能 100% 确认触发的场景，报 ≤6 条。`,
  },
]

const results = await parallel(
  LENSES.map((l) => () =>
    agent(l.prompt, {
      label: `wenshu:${l.key}`,
      phase: "文秘三路审查",
      schema: FINDINGS_SCHEMA,
    })
  )
)

const allFindings = results.filter(Boolean).flatMap((r) => r.findings)

// 去除重复（同标题跨路重复报）
const seen = new Set()
const deduped = allFindings.filter((f) => {
  const key = f.title
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

phase("对抗验证")

log(`初筛 ${allFindings.length} 条 → 去重后 ${deduped.length} 条，进入对抗验证`)

const verified = await parallel(
  deduped.map((f) => () =>
    agent(
      `你是对抗验证员。下面这条"文秘红头验收"发现需要你独立验证是否属实。

发现标题：${f.title}
严重级：${f.severity}
证据：${f.evidence}
文件/行：${f.file ?? "-"} / ${f.line ?? "-"}
声称的问题：${f.why}

去 E:/ezdoc-v2 打开对应文件读代码/产物（如无文件路径则结合发现内容判断），判断：
- verdict 选 "real"（确认属实、按此验收标准确实不符合）
- 选 "false-positive"（误报：代码其实没问题/产物其实正确/看错了）
- 选 "already-fixed"（确实是问题但代码里已修复）
给出你的理由。默认倾向严格：不确定就选 false-positive，宁可漏报不可误杀。`,
      {
        label: `verify:${f.title.slice(0, 20)}`,
        phase: "对抗验证",
        schema: VERDICT_SCHEMA,
      }
    )
  )
)

const confirmed = deduped.filter((_, i) => verified[i]?.verdict === "real")

phase("合成")

log(`对抗验证后确认 ${confirmed.length} 条`)

return {
  count: confirmed.length,
  findings: confirmed,
  allSkipped: deduped.length - confirmed.length,
  skippedReasons: deduped
    .map((f, i) => ({ title: f.title, verdict: verified[i]?.verdict }))
    .filter((x) => x.verdict !== "real"),
}
