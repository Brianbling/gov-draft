import { describe, it, expect } from "vitest"
import {
  presetsForPath,
  matchPreset,
  CJK_FONT_PRESETS,
  LATIN_FONT_PRESETS,
} from "../font-presets"

describe("presetsForPath", () => {
  it("maps CJK font fields to the CJK presets", () => {
    for (const field of ["cjkFamily", "cnQuoteFamily", "cnBookTitleFamily"]) {
      expect(presetsForPath(`content.h1.fonts.${field}`)).toBe(CJK_FONT_PRESETS)
    }
  })

  it("maps latinFamily to the Latin presets", () => {
    expect(presetsForPath("content.body.fonts.latinFamily")).toBe(
      LATIN_FONT_PRESETS
    )
  })

  it("returns null for non-font fields", () => {
    expect(presetsForPath("content.body.style.size")).toBeNull()
    expect(presetsForPath("name")).toBeNull()
  })
})

describe("matchPreset", () => {
  it("matches an exact stack", () => {
    const preset = CJK_FONT_PRESETS[0]!
    expect(matchPreset(CJK_FONT_PRESETS, preset.stack)?.id).toBe(preset.id)
  })

  it("ignores spacing and case differences", () => {
    expect(matchPreset(LATIN_FONT_PRESETS, "times new roman,SERIF")?.id).toBe(
      "timesNewRoman"
    )
  })

  it("returns null for a custom stack", () => {
    expect(matchPreset(CJK_FONT_PRESETS, "Foo Sans, sans-serif")).toBeNull()
  })

  it("returns null for an empty value", () => {
    expect(matchPreset(CJK_FONT_PRESETS, "")).toBeNull()
  })
})
