import { describe, expect, it } from "vitest"
import { formatByStyle } from "../number-format-utils"

describe("formatByStyle", () => {
  it("returns arabic digits by default", () => {
    expect(formatByStyle(1, "arabic")).toBe("1")
    expect(formatByStyle(42, "arabic")).toBe("42")
    expect(formatByStyle(0, "arabic")).toBe("0")
  })

  it("converts to roman numerals", () => {
    expect(formatByStyle(1, "roman")).toBe("I")
    expect(formatByStyle(4, "roman")).toBe("IV")
    expect(formatByStyle(9, "roman")).toBe("IX")
    expect(formatByStyle(42, "roman")).toBe("XLII")
    expect(formatByStyle(3999, "roman")).toBe("MMMCMXCIX")
  })

  it("falls back to arabic for roman out of range", () => {
    expect(formatByStyle(0, "roman")).toBe("0")
    expect(formatByStyle(-1, "roman")).toBe("-1")
    expect(formatByStyle(4000, "roman")).toBe("4000")
  })

  it("converts to zhHans chinese numerals", () => {
    expect(formatByStyle(0, "zhHans")).toBe("零")
    expect(formatByStyle(1, "zhHans")).toBe("一")
    expect(formatByStyle(10, "zhHans")).toBe("十")
    expect(formatByStyle(11, "zhHans")).toBe("十一")
    expect(formatByStyle(20, "zhHans")).toBe("二十")
    expect(formatByStyle(100, "zhHans")).toBe("一百")
    expect(formatByStyle(101, "zhHans")).toBe("一百零一")
    expect(formatByStyle(10000, "zhHans")).toBe("一万")
    expect(formatByStyle(12345, "zhHans")).toBe("一万二千三百四十五")
  })

  it("converts to zhHant chinese numerals", () => {
    expect(formatByStyle(1, "zhHant")).toBe("壹")
    expect(formatByStyle(10, "zhHant")).toBe("拾")
    expect(formatByStyle(1234, "zhHant")).toBe("壹仟贰佰叁拾肆")
  })

  it("returns empty string for non-finite numbers", () => {
    expect(formatByStyle(Infinity, "arabic")).toBe("")
    expect(formatByStyle(NaN, "arabic")).toBe("")
  })

  it("returns string representation for non-integer numbers", () => {
    expect(formatByStyle(3.14, "arabic")).toBe("3.14")
    expect(formatByStyle(3.14, "roman")).toBe("3.14")
  })
})
