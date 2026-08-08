/**
 * 对已落盘的真实生成产物重跑修复管线，验证新修复（标题去机关名 +
 * 红头成对检查 + docType 门控）是否生效。不调 API。
 */
import { parseLegalDoc, toMarkdown, checkFormat } from "../src/lib/legal-doc"
import { repairDoc } from "../src/lib/legal-doc/review/repair-doc"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"

const REAL_DIR = ".claude/tmp/wenshu-real"
const OUT_DIR = ".claude/tmp/wenshu-real-v2"

const FILES = ["1", "2", "3"]

function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const id of FILES) {
    const raw = readFileSync(`${REAL_DIR}/${id}-raw.json`, "utf-8")
    let doc
    try {
      doc = parseLegalDoc(raw)
    } catch (err) {
      console.log(`[${id}] JSON 无法解析，跳过`)
      continue
    }
    const { doc: repaired, repairs } = repairDoc(doc)
    const issues = checkFormat(repaired)
    const md = toMarkdown(repaired)
    console.log(`[${id}] docType=${repaired.docType}`)
    console.log(`  repairs: ${repairs.map((r) => r.code).join(", ") || "无"}`)
    console.log(`  issues: ${issues.map((i) => i.code).join(", ") || "无"}`)
    if (repaired.issuingOrg) console.log(`  红头: ${repaired.issuingOrg}`)
    console.log(`  标题: ${repaired.title}`)
    console.log(`  文号: ${repaired.docNumber ?? "无"}`)
    writeFileSync(`${OUT_DIR}/${id}-repaired-v2.md`, md)
    console.log("")
  }
}

main()
