/**
 * 文秘验收素材生成器：把真实 LLM 形态的输出（含用户报过的毛病：无红头/文号顶行、
 * 抄送混入正文）走完整管线（parse → toMarkdown → GB/T 9704 渲染 → HTML），
 * 落盘 markdown + HTML，供文秘 agent 肉眼看渲染结果。
 *
 * 用 `bun run scripts/gen-acceptance-fixtures.ts` 执行（无浏览器、无网络，纯引擎）。
 */
import { parseLegalDoc, toMarkdown } from "../src/lib/legal-doc"
import { repairDoc } from "../src/lib/legal-doc/review/repair-doc"
import { getBuiltinRules, MarkdownParser } from "../src/engine"
import { writeFileSync, mkdirSync } from "node:fs"

const OUT_DIR = ".claude/tmp/wenshu-acceptance"

// 用户实际见过的失败形态：无红头（issuingOrg 缺省），文号是第一块 → 顶行。
// 抄送被 LLM 写进正文末段，未入版记。这正是 f42de8b 前真实发生的问题。
const RAW_LLM_OUTPUT_NO_RED_HEAD = JSON.stringify({
  docType: "gongwen",
  title: "关于印发《××市数字经济促进条例》的通知",
  docNumber: "渝政〔2026〕28号",
  recipient: "各区县（自治县）人民政府，市政府各部门，有关单位：",
  body: [
    {
      type: "p",
      text: "《××市数字经济促进条例》已经市六届人大常委会第二十七次会议通过，现印发给你们，请认真贯彻执行。",
    },
    {
      type: "p",
      text: "特此通知。抄送：市委办公厅，市人大常委会办公厅，市政协办公厅，市监委。",
    },
  ],
  issuer: "重庆市人民政府",
  date: "2026-07-31",
})

// 对照：修复后的理想形态——红头在文号上方，抄送已进版记。
const IDEAL_LLM_OUTPUT = JSON.stringify({
  docType: "gongwen",
  title: "关于印发《××市数字经济促进条例》的通知",
  issuingOrg: "重庆市人民政府文件",
  docNumber: "渝政〔2026〕28号",
  recipient: "各区县（自治县）人民政府，市政府各部门，有关单位：",
  body: [
    {
      type: "p",
      text: "《××市数字经济促进条例》已经市六届人大常委会第二十七次会议通过，现印发给你们，请认真贯彻执行。",
    },
    {
      type: "p",
      text: "特此通知。",
    },
  ],
  issuer: "重庆市人民政府",
  date: "2026-07-31",
  cc: ["市委办公厅", "市人大常委会办公厅", "市政协办公厅", "市监委"],
})

function render(markdown: string): string {
  const rule = getBuiltinRules().find((r) => r.name.includes("9704")) ?? getBuiltinRules()[0]!
  const parser = new MarkdownParser(undefined, {
    ...rule.parser,
    headingStyles: {
      h1: rule.content.h1.style.index ?? "0lines",
      h2: rule.content.h2.style.index ?? "0lines",
      h3: rule.content.h3.style.index ?? "0lines",
      h4: rule.content.h4.style.index ?? "0lines",
    },
  })
  return parser.parse(markdown).html
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  // 场景 1：raw LLM 输出 → 修复前的渲染（文号顶行 + 抄送混正文）
  const rawDoc = parseLegalDoc(RAW_LLM_OUTPUT_NO_RED_HEAD)
  const rawMd = toMarkdown(rawDoc)
  writeFileSync(`${OUT_DIR}/01-raw-llm-output.md`, rawMd)
  writeFileSync(`${OUT_DIR}/01-raw-llm-output.html`, render(rawMd))

  // 场景 2：raw LLM 输出 → 走修复管线（repairDoc 推导红头 + 提取抄送）后的渲染
  const repaired = repairDoc(rawDoc)
  const repairedMd = toMarkdown(repaired.doc)
  writeFileSync(`${OUT_DIR}/02-repaired.md`, repairedMd)
  writeFileSync(`${OUT_DIR}/02-repaired.html`, render(repairedMd))

  // 场景 3：理想 LLM 输出（红头 + 抄送入版记）的渲染
  const idealDoc = parseLegalDoc(IDEAL_LLM_OUTPUT)
  const idealMd = toMarkdown(idealDoc)
  writeFileSync(`${OUT_DIR}/03-ideal.md`, idealMd)
  writeFileSync(`${OUT_DIR}/03-ideal.html`, render(idealMd))

  console.log(`written to ${OUT_DIR}:`)
  console.log("  01-raw-llm-output.md / .html — 修复前（文号顶行 + 抄送混正文）")
  console.log("  02-repaired.md / .html — repairDoc 修复后")
  console.log("  03-ideal.md / .html — 理想形态")
}

main()
