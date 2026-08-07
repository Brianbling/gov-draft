import { describe, expect, it } from "vitest"
import { RuleConfigSchema } from "@/engine/schema"
import { validateRule } from "@/engine/compiler/validator"
import { getBuiltinRules } from "@/engine/builtin-rules"

describe("M-2 e2e: schema → validateRule 全链路", () => {
  it("YAML 无单位数字（size: 16）经 schema 归一后 validateRule 通过", () => {
    const builtin = getBuiltinRules()[0]!
    // 模拟 YAML `size: 16` 被解析成 number 16 后存入 ruleConfig
    const withNumber = {
      ...builtin,
      content: {
        ...builtin.content,
        body: {
          ...builtin.content.body,
          style: { ...builtin.content.body.style, size: 16 },
        },
      },
    }
    // zod 接受 number 16 并 transform 成 "16"
    const parsed = RuleConfigSchema.safeParse(withNumber)
    expect(parsed.success).toBe(true)
    const normalized = parsed.success ? parsed.data : builtin
    // 归一后的 "16" 必须通过 validateRule（不再 throw → 不静默丢规则）
    const result = validateRule(normalized)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("YAML 无单位数字（before: 28.95）经 schema 归一后 validateRule 通过", () => {
    const builtin = getBuiltinRules()[0]!
    const withNumber = {
      ...builtin,
      content: {
        ...builtin.content,
        body: {
          ...builtin.content.body,
          paragraph: {
            ...builtin.content.body.paragraph,
            spacing: {
              ...builtin.content.body.paragraph.spacing,
              before: 28.95,
            },
          },
        },
      },
    }
    const parsed = RuleConfigSchema.safeParse(withNumber)
    expect(parsed.success).toBe(true)
    const normalized = parsed.success ? parsed.data : builtin
    expect(validateRule(normalized).valid).toBe(true)
  })
})
