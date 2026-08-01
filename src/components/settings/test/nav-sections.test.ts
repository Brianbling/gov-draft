import { describe, it, expect } from "vitest"
import { traverseSchema, RuleConfigSchema } from "@/engine/schema"
import {
  buildNavEntries,
  buildSearchIndex,
  searchFields,
  isGroup,
  EDITOR_SECTION_ID,
  type SettingsSection,
} from "../nav-sections"

const descriptors = traverseSchema(RuleConfigSchema)

/** Minimal model: only `content` keys matter for catchall detection. */
function modelWith(contentKeys: string[]): Record<string, unknown> {
  const content: Record<string, unknown> = {}
  for (const key of contentKeys) content[key] = {}
  return { content }
}

const BUILTIN_LEVELS = ["body", "h1", "h2", "h3", "h4"]

describe("buildNavEntries", () => {
  it("lists basic,每个内容层级, page/pagination/parser and editor", () => {
    const entries = buildNavEntries(descriptors, modelWith(BUILTIN_LEVELS))
    const ids = entries
      .filter((e): e is SettingsSection => !isGroup(e))
      .map((e) => e.id)

    expect(ids).toEqual([
      "basic",
      "content.body",
      "content.h1",
      "content.h2",
      "content.h3",
      "content.h4",
      "page",
      "pagination",
      "parser",
      EDITOR_SECTION_ID,
    ])
  })

  it("puts name/version/description in the basic section", () => {
    const entries = buildNavEntries(descriptors, modelWith(BUILTIN_LEVELS))
    const basic = entries.find(
      (e) => !isGroup(e) && e.id === "basic"
    ) as SettingsSection

    expect(basic.fields.map((f) => f.path)).toEqual([
      "name",
      "version",
      "description",
    ])
  })

  it("expands a content level into its fonts/style/paragraph groups", () => {
    const entries = buildNavEntries(descriptors, modelWith(BUILTIN_LEVELS))
    const body = entries.find(
      (e) => !isGroup(e) && e.id === "content.body"
    ) as SettingsSection

    expect(body.fields.map((f) => f.path)).toEqual([
      "content.body.fonts",
      "content.body.style",
      "content.body.paragraph",
    ])
  })

  it("adds a removable section for a catchall content level", () => {
    const entries = buildNavEntries(
      descriptors,
      modelWith([...BUILTIN_LEVELS, "custom1"])
    )
    const custom = entries.find(
      (e) => !isGroup(e) && e.id === "content.custom1"
    ) as SettingsSection

    expect(custom.removable).toBe(true)
    expect(custom.contentKey).toBe("custom1")
    expect(custom.fields.map((f) => f.path)).toEqual([
      "content.custom1.fonts",
      "content.custom1.style",
      "content.custom1.paragraph",
    ])
  })

  it("emits a group header before the content levels", () => {
    const entries = buildNavEntries(descriptors, modelWith(BUILTIN_LEVELS))
    const groupIndex = entries.findIndex(isGroup)
    const firstLevelIndex = entries.findIndex(
      (e) => !isGroup(e) && e.id === "content.body"
    )

    expect(groupIndex).toBeGreaterThanOrEqual(0)
    expect(groupIndex).toBeLessThan(firstLevelIndex)
  })
})

describe("search", () => {
  const entries = buildNavEntries(descriptors, modelWith(BUILTIN_LEVELS))
  // Stand in for i18n: label = last path segment.
  const index = buildSearchIndex(
    entries,
    (path) => path.split(".").pop() ?? path,
    (section) => section.id
  )

  it("indexes only leaf fields, not object groups", () => {
    expect(index.some((h) => h.path === "content.body.style")).toBe(false)
    expect(index.some((h) => h.path === "content.body.style.size")).toBe(true)
  })

  it("returns nothing for an empty query", () => {
    expect(searchFields(index, "   ")).toHaveLength(0)
  })

  it("matches a field label across every content level", () => {
    const hits = searchFields(index, "charsPerLine")
    expect(hits.map((h) => h.sectionId).sort()).toEqual([
      "content.body",
      "content.h1",
      "content.h2",
      "content.h3",
      "content.h4",
    ])
  })

  it("matches on a dotted path fragment", () => {
    const hits = searchFields(index, "margins.top")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.sectionId).toBe("page")
  })
})
