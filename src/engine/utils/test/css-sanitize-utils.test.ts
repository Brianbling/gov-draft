import { describe, expect, it } from "vitest"
import { sanitizeCssProperty, sanitizeCssValue } from "../css-sanitize-utils"

const CSS_VALUE_UNSAFE = /[{};\n\r]/
const CSS_PROPERTY_UNSAFE = /[{};:\n\r]/

describe("sanitizeCssValue", () => {
  it("passes through normal values unchanged", () => {
    expect(sanitizeCssValue("16pt")).toBe("16pt")
    expect(sanitizeCssValue("#ff0000")).toBe("#ff0000")
    expect(sanitizeCssValue("0")).toBe("0")
  })

  it("strips all unsafe characters from the output", () => {
    expect(sanitizeCssValue("red; } body { color: blue")).not.toMatch(
      CSS_VALUE_UNSAFE,
    )
    expect(sanitizeCssValue("16pt\n}}inline")).not.toMatch(CSS_VALUE_UNSAFE)
    expect(sanitizeCssValue("a{b}c")).not.toMatch(CSS_VALUE_UNSAFE)
  })

  it("handles null and undefined", () => {
    expect(sanitizeCssValue(null)).toBe("")
    expect(sanitizeCssValue(undefined)).toBe("")
  })

  it("converts non-string values to string", () => {
    expect(sanitizeCssValue(400)).toBe("400")
    expect(sanitizeCssValue(0)).toBe("0")
  })
})

describe("sanitizeCssProperty", () => {
  it("passes through normal property names unchanged", () => {
    expect(sanitizeCssProperty("color")).toBe("color")
    expect(sanitizeCssProperty("--custom-prop")).toBe("--custom-prop")
  })

  it("strips all unsafe characters from the output", () => {
    expect(sanitizeCssProperty("color: red;")).not.toMatch(CSS_PROPERTY_UNSAFE)
    expect(sanitizeCssProperty("prop\n{}")).not.toMatch(CSS_PROPERTY_UNSAFE)
  })
})
