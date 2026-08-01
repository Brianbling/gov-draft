import { describe, it, expect } from "vitest"
import { ContentItemConfigSchema, RuleConfigSchema } from "@/engine/schema"
import { getBuiltinRules } from "@/engine"
import { buildLevelTemplate } from "../level-template"

const builtin = getBuiltinRules()[0]!

describe("buildLevelTemplate", () => {
  it("clones the body level when present", () => {
    const template = buildLevelTemplate(
      builtin.content as unknown as Record<string, unknown>
    )
    expect(template).toEqual(builtin.content.body)
  })

  it("returns a deep copy, not a reference into the source", () => {
    const content = builtin.content as unknown as Record<string, unknown>
    const template = buildLevelTemplate(content)
    expect(template).not.toBe(content.body)
    expect(template.fonts).not.toBe(builtin.content.body.fonts)
  })

  it("produces a value that satisfies ContentItemConfigSchema", () => {
    const template = buildLevelTemplate(
      builtin.content as unknown as Record<string, unknown>
    )
    expect(ContentItemConfigSchema.safeParse(template).success).toBe(true)
  })

  it("falls back to a valid level when content holds none", () => {
    const template = buildLevelTemplate({})
    expect(ContentItemConfigSchema.safeParse(template).success).toBe(true)
  })

  it("keeps the whole rule valid when added as a custom level", () => {
    const content = builtin.content as unknown as Record<string, unknown>
    const next = {
      ...builtin,
      content: { ...content, custom1: buildLevelTemplate(content) },
    }
    expect(RuleConfigSchema.safeParse(next).success).toBe(true)
  })
})
