import { describe, expect, it } from "vitest"
import { z } from "zod"
import { traverseSchema, traverseSchemaAsRoot } from "../schema-traversal"
import { RuleConfigSchema } from "../index"

describe("schema-traversal", () => {
  it("traverses RuleConfigSchema and produces top-level descriptors", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const paths = descriptors.map((d) => d.path)

    expect(paths).toContain("name")
    expect(paths).toContain("version")
    expect(paths).toContain("content")
    expect(paths).toContain("page")
    expect(paths).toContain("pagination")
    expect(paths).toContain("parser")
  })

  it("detects content as object with catchall", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const content = descriptors.find((d) => d.path === "content")

    expect(content?.fieldType).toBe("object")
    expect(content?.hasCatchall).toBe(true)
    expect(content?.catchallDescriptor).toBeDefined()
    expect(content?.children?.map((c) => c.path)).toEqual(
      expect.arrayContaining([
        "content.body",
        "content.h1",
        "content.h2",
        "content.h3",
        "content.h4",
      ])
    )
  })

  it("identifies CSS length fields correctly", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const content = descriptors.find((d) => d.path === "content")
    const body = content?.children?.find((c) => c.path === "content.body")
    const style = body?.children?.find((c) => c.path === "content.body.style")
    const size = style?.children?.find(
      (c) => c.path === "content.body.style.size"
    )

    expect(size?.fieldType).toBe("cssLength")
  })

  it("identifies CSS color fields correctly", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const content = descriptors.find((d) => d.path === "content")
    const body = content?.children?.find((c) => c.path === "content.body")
    const style = body?.children?.find((c) => c.path === "content.body.style")
    const colors = style?.children?.find(
      (c) => c.path === "content.body.style.colors"
    )
    const text = colors?.children?.find(
      (c) => c.path === "content.body.style.colors.text"
    )

    expect(text?.fieldType).toBe("cssColor")
  })

  it("identifies enum fields with values", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const parser = descriptors.find((d) => d.path === "parser")
    const enterStyle = parser?.children?.find(
      (c) => c.path === "parser.enterStyle"
    )

    expect(enterStyle?.fieldType).toBe("enum")
    expect(enterStyle?.enumValues).toEqual(["paragraph", "lineBreak"])
  })

  it("identifies font weight as fontWeight type", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const content = descriptors.find((d) => d.path === "content")
    const body = content?.children?.find((c) => c.path === "content.body")
    const style = body?.children?.find((c) => c.path === "content.body.style")
    const weight = style?.children?.find(
      (c) => c.path === "content.body.style.weight"
    )

    expect(weight?.fieldType).toBe("fontWeight")
  })

  it("marks optional fields correctly", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const description = descriptors.find((d) => d.path === "description")
    const pagination = descriptors.find((d) => d.path === "pagination")
    const name = descriptors.find((d) => d.path === "name")

    expect(description?.required).toBe(false)
    expect(pagination?.required).toBe(false)
    expect(name?.required).toBe(true)
  })

  it("detects array and record fields", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const parser = descriptors.find((d) => d.path === "parser")
    const disabledSyntax = parser?.children?.find(
      (c) => c.path === "parser.disabledSyntax"
    )
    const localStyleAliases = parser?.children?.find(
      (c) => c.path === "parser.localStyleAliases"
    )

    expect(disabledSyntax?.fieldType).toBe("array")
    expect(localStyleAliases?.fieldType).toBe("record")
  })

  it("identifies numeric fields", () => {
    const descriptors = traverseSchema(RuleConfigSchema)
    const content = descriptors.find((d) => d.path === "content")
    const body = content?.children?.find((c) => c.path === "content.body")
    const paragraph = body?.children?.find(
      (c) => c.path === "content.body.paragraph"
    )
    const charsPerLine = paragraph?.children?.find(
      (c) => c.path === "content.body.paragraph.charsPerLine"
    )

    expect(charsPerLine?.fieldType).toBe("number")
    expect(charsPerLine?.required).toBe(false)
  })

  it("handles simple z.object schema", () => {
    const schema = z.object({
      flag: z.boolean(),
      label: z.string().optional(),
    })

    const root = traverseSchemaAsRoot(schema)

    expect(root.fieldType).toBe("object")
    expect(root.children).toHaveLength(2)

    const flag = root.children?.find((c) => c.path === "flag")
    expect(flag?.fieldType).toBe("boolean")
    expect(flag?.required).toBe(true)

    const label = root.children?.find((c) => c.path === "label")
    expect(label?.fieldType).toBe("string")
    expect(label?.required).toBe(false)
  })
})
