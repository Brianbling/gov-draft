import { describe, expect, it } from "vitest"
import {
  resolveCanonicalLocalStylePath,
  validateLocalStyleTargetPath,
} from "../local-style-path-utils"

describe("validateLocalStyleTargetPath", () => {
  it("accepts a valid scoped path", () => {
    const result = validateLocalStyleTargetPath(
      "content.body.paragraph.indent",
    )
    expect(result.formatValid).toBe(true)
    expect(result.inScope).toBe(true)
    expect(result.safe).toBe(true)
    expect(result.valid).toBe(true)
  })

  it("rejects path with invalid format", () => {
    const result = validateLocalStyleTargetPath("bad field")
    expect(result.formatValid).toBe(false)
    expect(result.valid).toBe(false)
  })

  it("rejects path outside content scope", () => {
    const result = validateLocalStyleTargetPath("other.field.path")
    expect(result.formatValid).toBe(true)
    expect(result.inScope).toBe(false)
    expect(result.valid).toBe(false)
  })

  it("rejects unsafe path segment", () => {
    const result = validateLocalStyleTargetPath(
      "content.body.__proto__.indent",
    )
    expect(result.formatValid).toBe(true)
    expect(result.inScope).toBe(true)
    expect(result.safe).toBe(false)
    expect(result.valid).toBe(false)
  })
})

describe("resolveCanonicalLocalStylePath", () => {
  it("returns full scoped path unchanged", () => {
    expect(resolveCanonicalLocalStylePath("content.body.paragraph.indent")).toBe(
      "content.body.paragraph.indent",
    )
  })

  it("resolves sugar path by prefixing content.", () => {
    expect(resolveCanonicalLocalStylePath("body.paragraph.indent")).toBe(
      "content.body.paragraph.indent",
    )
    expect(resolveCanonicalLocalStylePath("h2.style.size")).toBe(
      "content.h2.style.size",
    )
  })

  it("returns null for empty string", () => {
    expect(resolveCanonicalLocalStylePath("")).toBeNull()
    expect(resolveCanonicalLocalStylePath("   ")).toBeNull()
  })

  it("returns null for path without dot separator", () => {
    expect(resolveCanonicalLocalStylePath("bodyIndent")).toBeNull()
  })

  it("returns null for invalid path", () => {
    expect(resolveCanonicalLocalStylePath("bad field")).toBeNull()
  })
})
