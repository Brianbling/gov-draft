import { describe, expect, it } from "vitest"
import { buildUserPrompt } from "../prompt"
import { checkDocFormat } from "../review/format-rules"
import { DOC_TYPES } from "../types"

describe("few-shot examples self-consistency", () => {
  it("each docType example passes its own L2 rules", () => {
    for (const docType of DOC_TYPES) {
      const prompt = buildUserPrompt(`${docType}\n测试内容`)
      const raw = prompt.split("示例输出")[1]!.match(/\{[\s\S]*\}/)?.[0] ?? "{}"
      const example = JSON.parse(raw)
      const issues = checkDocFormat(example)
      expect(issues, `${docType} example issues: ${JSON.stringify(issues)}`).toEqual([])
    }
  })
})
