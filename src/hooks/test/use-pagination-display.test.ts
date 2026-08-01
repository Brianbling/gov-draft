import { describe, it, expect } from "vitest"
import {
  getPaginationInlineStyle,
  getPaginationText,
} from "../use-pagination-display"
import type { PageRenderMeta } from "../use-paginator"
import type { PaginationConfig } from "@/engine/schema"

function makePagination(overrides: Partial<PaginationConfig> = {}): PaginationConfig {
  return {
    enabled: true,
    format: "{currentPage} / {totalPage}",
    style: {
      fonts: { latinFamily: "serif", cjkFamily: "serif" },
      size: "14pt",
      weight: 400,
      colors: { text: "#000000" },
    },
    position: {
      vertical: { anchor: "bottom", offset: "7mm" },
      horizontal: { anchor: "center", offset: "0mm" },
    },
    ...overrides,
  }
}

function makeMeta(
  pagination: PaginationConfig,
  globalPage = 1,
  globalTotal = 1,
): PageRenderMeta {
  return { globalPage, globalTotal, pagination }
}

describe("getPaginationText", () => {
  it("substitutes variables into format template", () => {
    const text = getPaginationText(
      makeMeta(makePagination({ format: "{currentPage} / {totalPage}" }), 3, 10),
    )
    expect(text).toBe("3 / 10")
  })

  it("evaluates arithmetic expressions in placeholders", () => {
    const text = getPaginationText(
      makeMeta(
        makePagination({ format: "第{currentPage+1}页" }),
        3,
        10,
      ),
    )
    expect(text).toBe("第4页")
  })

  it("returns empty string when pagination config is absent", () => {
    const meta: PageRenderMeta = {
      globalPage: 1,
      globalTotal: 1,
      pagination: null as unknown as PaginationConfig,
    }
    expect(getPaginationText(meta)).toBe("")
  })
})

describe("getPaginationInlineStyle", () => {
  it("bottom anchor positions upward from the content bottom edge", () => {
    const style = getPaginationInlineStyle(
      makeMeta(makePagination({ position: { vertical: { anchor: "bottom", offset: "7mm" }, horizontal: { anchor: "center", offset: "0mm" } } })),
      0,
    )
    expect(style.top).toBeUndefined()
    expect(style.bottom).toBeDefined()
    expect(style.bottom).toContain("7mm")
    expect(style.bottom).toContain("--page-margins-bottom")
  })

  it("top anchor positions downward from the content top edge", () => {
    const style = getPaginationInlineStyle(
      makeMeta(makePagination({ position: { vertical: { anchor: "top", offset: "7mm" }, horizontal: { anchor: "center", offset: "0mm" } } })),
      0,
    )
    expect(style.bottom).toBeUndefined()
    expect(style.top).toBeDefined()
    expect(style.top).toContain("7mm")
    expect(style.top).toContain("--page-margins-top")
  })

  it("left anchor references the left margin", () => {
    const style = getPaginationInlineStyle(
      makeMeta(makePagination({ position: { vertical: { anchor: "bottom", offset: "0mm" }, horizontal: { anchor: "left", offset: "10mm" } } })),
      0,
    )
    expect(style.right).toBeUndefined()
    expect(style.left).toBeDefined()
    expect(style.left).toContain("--page-margins-left")
    expect(style.left).toContain("10mm")
  })

  it("right anchor references the right margin", () => {
    const style = getPaginationInlineStyle(
      makeMeta(makePagination({ position: { vertical: { anchor: "bottom", offset: "0mm" }, horizontal: { anchor: "right", offset: "10mm" } } })),
      0,
    )
    expect(style.left).toBeUndefined()
    expect(style.right).toBeDefined()
    expect(style.right).toContain("--page-margins-right")
    expect(style.right).toContain("10mm")
  })

  it("outside anchor: right side on odd pages, left side on even pages", () => {
    const pagination = makePagination({ position: { vertical: { anchor: "bottom", offset: "0mm" }, horizontal: { anchor: "outside", offset: "10mm" } } })

    const oddStyle = getPaginationInlineStyle(makeMeta(pagination, 1, 10), 0)
    expect(oddStyle.right).toBeDefined()
    expect(oddStyle.left).toBeUndefined()

    const evenStyle = getPaginationInlineStyle(makeMeta(pagination, 1, 10), 1)
    expect(evenStyle.left).toBeDefined()
    expect(evenStyle.right).toBeUndefined()
  })

  it("inside anchor: left side on odd pages, right side on even pages", () => {
    const pagination = makePagination({ position: { vertical: { anchor: "bottom", offset: "0mm" }, horizontal: { anchor: "inside", offset: "10mm" } } })

    const oddStyle = getPaginationInlineStyle(makeMeta(pagination, 1, 10), 0)
    expect(oddStyle.left).toBeDefined()
    expect(oddStyle.right).toBeUndefined()

    const evenStyle = getPaginationInlineStyle(makeMeta(pagination, 1, 10), 1)
    expect(evenStyle.right).toBeDefined()
    expect(evenStyle.left).toBeUndefined()
  })

  it("returns empty object when pagination config is absent", () => {
    const meta: PageRenderMeta = {
      globalPage: 1,
      globalTotal: 1,
      pagination: null as unknown as PaginationConfig,
    }
    expect(getPaginationInlineStyle(meta, 0)).toEqual({})
  })
})
