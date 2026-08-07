import { describe, it, expect } from "vitest"
import {
  getPaginationInlineStyle,
  getPaginationText,
} from "../use-pagination-display"
import type { PageRenderMeta } from "../use-paginator"
import type { PaginationConfig } from "@/engine/schema"

function makePagination(
  overrides: Partial<PaginationConfig> = {}
): PaginationConfig {
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
  globalTotal = 1
): PageRenderMeta {
  return { globalPage, globalTotal, pagination }
}

describe("getPaginationText", () => {
  it("substitutes variables into format template", () => {
    const text = getPaginationText(
      makeMeta(makePagination({ format: "{currentPage} / {totalPage}" }), 3, 10)
    )
    expect(text).toBe("3 / 10")
  })

  it("evaluates arithmetic expressions in placeholders", () => {
    const text = getPaginationText(
      makeMeta(makePagination({ format: "第{currentPage+1}页" }), 3, 10)
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

  it("hideFirstPage=true 时首页（pageIndex 0）不输出页码文本", () => {
    const text = getPaginationText(
      makeMeta(
        makePagination({ hideFirstPage: true, format: "{currentPage}" }),
        1,
        3
      ),
      0
    )
    expect(text).toBe("")
  })

  it("hideFirstPage=true 时第 2 页起正常输出页码", () => {
    const text = getPaginationText(
      makeMeta(
        makePagination({ hideFirstPage: true, format: "{currentPage}" }),
        2,
        3
      ),
      1
    )
    expect(text).toBe("2")
  })

  it("hideFirstPage 缺省/false 时首页照常输出页码（默认行为不变）", () => {
    expect(getPaginationText(makeMeta(makePagination(), 1, 3), 0)).toBe("1 / 3")
    expect(
      getPaginationText(
        makeMeta(makePagination({ hideFirstPage: false }), 1, 3),
        0
      )
    ).toBe("1 / 3")
  })

  it("hideFirstPage=true 但不传 pageIndex 时保守输出（无首页判定则照常渲染）", () => {
    const text = getPaginationText(
      makeMeta(
        makePagination({ hideFirstPage: true, format: "{currentPage}" }),
        1,
        3
      )
    )
    expect(text).toBe("1")
  })
})

describe("getPaginationInlineStyle", () => {
  it("bottom anchor positions upward from the content bottom edge", () => {
    const style = getPaginationInlineStyle(
      makeMeta(
        makePagination({
          position: {
            vertical: { anchor: "bottom", offset: "7mm" },
            horizontal: { anchor: "center", offset: "0mm" },
          },
        })
      ),
      0
    )
    expect(style.top).toBeUndefined()
    expect(style.bottom).toBeDefined()
    expect(style.bottom).toContain("7mm")
    // 版心下边缘在纸底上方 page-margins-bottom 处，元素底缘应落在其下方 offset 处
    expect(style.bottom).toBe("calc(var(--page-margins-bottom) - 7mm)")
    expect(style.bottom).toContain("--page-margins-bottom")
  })

  it("top anchor positions downward from the content top edge", () => {
    const style = getPaginationInlineStyle(
      makeMeta(
        makePagination({
          position: {
            vertical: { anchor: "top", offset: "7mm" },
            horizontal: { anchor: "center", offset: "0mm" },
          },
        })
      ),
      0
    )
    expect(style.bottom).toBeUndefined()
    expect(style.top).toBeDefined()
    expect(style.top).toContain("7mm")
    expect(style.top).toBe("calc(var(--page-margins-top) + 7mm)")
    expect(style.top).toContain("--page-margins-top")
  })

  it("left anchor offsets from the content left edge (版心左缘 + 空一字)", () => {
    const style = getPaginationInlineStyle(
      makeMeta(
        makePagination({
          position: {
            vertical: { anchor: "bottom", offset: "0mm" },
            horizontal: { anchor: "left", offset: "10mm" },
          },
        })
      ),
      0
    )
    expect(style.right).toBeUndefined()
    expect(style.left).toBeDefined()
    expect(style.left).toContain("--page-margins-left")
    // 空一字相对版心边缘起算，而非纸面边缘：left = page-margins-left + offset
    expect(style.left).toBe("calc(var(--page-margins-left) + 10mm)")
    expect(style.left).toContain("10mm")
  })

  it("right anchor offsets from the content right edge (版心右缘 + 空一字)", () => {
    const style = getPaginationInlineStyle(
      makeMeta(
        makePagination({
          position: {
            vertical: { anchor: "bottom", offset: "0mm" },
            horizontal: { anchor: "right", offset: "10mm" },
          },
        })
      ),
      0
    )
    expect(style.left).toBeUndefined()
    expect(style.right).toBeDefined()
    expect(style.right).toContain("--page-margins-right")
    expect(style.right).toBe("calc(var(--page-margins-right) + 10mm)")
    expect(style.right).toContain("10mm")
  })

  it("outside anchor: right side on odd pages, left side on even pages", () => {
    const pagination = makePagination({
      position: {
        vertical: { anchor: "bottom", offset: "0mm" },
        horizontal: { anchor: "outside", offset: "10mm" },
      },
    })

    const oddStyle = getPaginationInlineStyle(makeMeta(pagination, 1, 10), 0)
    expect(oddStyle.right).toBe("calc(var(--page-margins-right) + 10mm)")
    expect(oddStyle.left).toBeUndefined()

    const evenStyle = getPaginationInlineStyle(makeMeta(pagination, 1, 10), 1)
    expect(evenStyle.left).toBe("calc(var(--page-margins-left) + 10mm)")
    expect(evenStyle.right).toBeUndefined()
  })

  it("inside anchor: left side on odd pages, right side on even pages", () => {
    const pagination = makePagination({
      position: {
        vertical: { anchor: "bottom", offset: "0mm" },
        horizontal: { anchor: "inside", offset: "10mm" },
      },
    })

    const oddStyle = getPaginationInlineStyle(makeMeta(pagination, 1, 10), 0)
    expect(oddStyle.left).toBe("calc(var(--page-margins-left) + 10mm)")
    expect(oddStyle.right).toBeUndefined()

    const evenStyle = getPaginationInlineStyle(makeMeta(pagination, 1, 10), 1)
    expect(evenStyle.right).toBe("calc(var(--page-margins-right) + 10mm)")
    expect(evenStyle.left).toBeUndefined()
  })

  it("always resets line-height to 1 and forbids wrapping", () => {
    const style = getPaginationInlineStyle(makeMeta(makePagination()), 0)
    expect(style.lineHeight).toBe("1")
    expect(style.whiteSpace).toBe("nowrap")
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
