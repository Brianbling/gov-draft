import { describe, it, expect } from "vitest"
import { normalizeHeadingIndex } from "../use-markdown"

describe("headingStyles index 归一化（3.14）", () => {
  it("空串归一为禁用哨兵 0lines", () => {
    expect(normalizeHeadingIndex("")).toBe("0lines")
    expect(normalizeHeadingIndex("   ")).toBe("0lines")
  })

  it("null / undefined 归一同样为禁用哨兵", () => {
    expect(normalizeHeadingIndex(null)).toBe("0lines")
    expect(normalizeHeadingIndex(undefined)).toBe("0lines")
  })

  it("合法模板原样保留", () => {
    expect(normalizeHeadingIndex("{zhHansIndex}、")).toBe("{zhHansIndex}、")
    expect(normalizeHeadingIndex("{number}. ")).toBe("{number}. ")
  })
})
