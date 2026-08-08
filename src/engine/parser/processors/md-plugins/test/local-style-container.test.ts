import { describe, expect, it } from "vitest"
import {
  collectLocalStyleDescriptorIssues,
  extractClassSegments,
  isClassSegment,
} from "../local-style-container"
import type { ParserConfig } from "../../../../schema"

const BASE_OPTIONS: ParserConfig = {
  html: false,
  enterStyle: "paragraph",
  linkify: true,
  typographer: true,
  headingNumbering: false,
  disabledSyntax: [],
  localStyleAliases: {
    bodyIndent: "content.body.paragraph.indent",
  },
}

describe("collectLocalStyleDescriptorIssues", () => {
  it("reports an unknown key with reason unknownKey", () => {
    const issues = collectLocalStyleDescriptorIssues(
      "body.paragraph.indent:0em; totallyUnknown: 1",
      BASE_OPTIONS
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]!.reason).toBe("unknownKey")
    expect(issues[0]!.segment).toBe("totallyUnknown: 1")
  })

  it("reports a missing colon with reason badSeparator", () => {
    const issues = collectLocalStyleDescriptorIssues(
      "body.paragraph.indent 0em",
      BASE_OPTIONS
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]!.reason).toBe("badSeparator")
  })

  it("reports an empty value with reason emptyValue", () => {
    const issues = collectLocalStyleDescriptorIssues(
      "body.paragraph.indent:",
      BASE_OPTIONS
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]!.reason).toBe("emptyValue")
  })

  it("does not report valid segments", () => {
    const issues = collectLocalStyleDescriptorIssues(
      "body.paragraph.indent:0em; body.paragraph.align:center",
      BASE_OPTIONS
    )
    expect(issues).toHaveLength(0)
  })

  it("reports only the invalid segments among valid ones", () => {
    const issues = collectLocalStyleDescriptorIssues(
      "body.paragraph.indent:0em; badKey: 1; bodyIndent: 1em",
      BASE_OPTIONS
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]!.segment).toBe("badKey: 1")
    expect(issues[0]!.reason).toBe("unknownKey")
  })

  it("resolves aliases as valid", () => {
    const issues = collectLocalStyleDescriptorIssues(
      "bodyIndent: 1em",
      BASE_OPTIONS
    )
    expect(issues).toHaveLength(0)
  })

  it("returns empty for an empty descriptor", () => {
    expect(collectLocalStyleDescriptorIssues("", BASE_OPTIONS)).toHaveLength(0)
  })

  it("class 段被识别为 class 段（不进入 CSS 变量）", () => {
    expect(isClassSegment("class: keep-together")).toBe(true)
    expect(isClassSegment("content.body.paragraph.indent: 2em")).toBe(false)
  })

  it("extractClassSegments 提取 class 值，忽略其他段", () => {
    expect(
      extractClassSegments(
        "content.body.paragraph.indent: 0em; class: keep-together; content.body.style.size: 14pt"
      )
    ).toEqual(["keep-together"])
  })

  it("class 段不产生 unknownKey 告警", () => {
    const issues = collectLocalStyleDescriptorIssues(
      "content.body.paragraph.indent: 0em; class: keep-together",
      BASE_OPTIONS
    )
    expect(issues).toHaveLength(0)
  })

  it("空 class 段不提取", () => {
    expect(extractClassSegments("content.body.paragraph.indent: 0em")).toEqual(
      []
    )
  })
})
