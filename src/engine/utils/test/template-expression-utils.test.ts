import { describe, expect, it } from "vitest"
import { evaluateNumericTemplateExpression } from "../template-expression-utils"

describe("evaluateNumericTemplateExpression", () => {
  const vars = { currentPage: 5, totalPage: 20 }

  it("evaluates a simple variable reference", () => {
    expect(evaluateNumericTemplateExpression("currentPage", vars)).toBe(5)
  })

  it("evaluates arithmetic expressions", () => {
    expect(evaluateNumericTemplateExpression("currentPage + 1", vars)).toBe(6)
    expect(evaluateNumericTemplateExpression("currentPage - 1", vars)).toBe(4)
    expect(evaluateNumericTemplateExpression("currentPage * 2", vars)).toBe(10)
    expect(evaluateNumericTemplateExpression("totalPage / 2", vars)).toBe(10)
    expect(evaluateNumericTemplateExpression("(currentPage + totalPage) / 5", vars)).toBe(5)
  })

  it("returns null for empty or whitespace expression", () => {
    expect(evaluateNumericTemplateExpression("", vars)).toBeNull()
    expect(evaluateNumericTemplateExpression("   ", vars)).toBeNull()
  })

  it("returns null when expression contains illegal characters", () => {
    expect(evaluateNumericTemplateExpression("alert(1)", vars)).toBeNull()
    expect(evaluateNumericTemplateExpression("currentPage; alert(1)", vars)).toBeNull()
    expect(evaluateNumericTemplateExpression("window.location", vars)).toBeNull()
  })

  it("returns null when expression references undefined variables", () => {
    expect(evaluateNumericTemplateExpression("unknownVar + 1", vars)).toBeNull()
    expect(evaluateNumericTemplateExpression("currentPage + foo", vars))
      .toBeNull()
  })

  it("returns null when result is NaN or Infinity", () => {
    expect(
      evaluateNumericTemplateExpression("currentPage / 0", vars),
    ).toBeNull()
  })

  it("resolves longer variable names before shorter ones", () => {
    const ctx = { currentPage: 3, CurrentPage: 10 }
    expect(
      evaluateNumericTemplateExpression("CurrentPage + currentPage", ctx),
    ).toBe(13)
  })
})
