import { describe, it, expect } from "vitest"
import { getDeep, setDeep } from "../deep-path"

describe("getDeep", () => {
  it("reads nested values by dot path", () => {
    const obj = { content: { body: { style: { size: "16pt" } } } }
    expect(getDeep(obj, "content.body.style.size")).toBe("16pt")
  })

  it("returns the root when path is empty", () => {
    const obj = { a: 1 }
    expect(getDeep(obj, "")).toBe(obj)
  })

  it("returns undefined when an intermediate segment is missing", () => {
    expect(getDeep({ a: {} }, "a.b.c")).toBeUndefined()
  })

  it("returns undefined when an intermediate segment is a primitive", () => {
    expect(getDeep({ a: "str" }, "a.b")).toBeUndefined()
  })
})

describe("setDeep", () => {
  it("sets a top-level key without mutating the source", () => {
    const src = { a: 1 }
    const next = setDeep(src, "a", 2)
    expect(next).toEqual({ a: 2 })
    expect(src).toEqual({ a: 1 })
  })

  it("sets a nested value and clones only the path", () => {
    const src = { content: { body: { size: "16pt" } }, page: { size: "A4" } }
    const next = setDeep(src, "content.body.size", "18pt")
    expect(getDeep(next, "content.body.size")).toBe("18pt")
    // source untouched
    expect(getDeep(src, "content.body.size")).toBe("16pt")
    // sibling branch is shared by reference (only path cloned)
    expect((next as typeof src).page).toBe(src.page)
    // changed branch is a new object
    expect((next as typeof src).content).not.toBe(src.content)
  })

  it("creates missing intermediate records", () => {
    const next = setDeep({}, "a.b.c", 42)
    expect(getDeep(next, "a.b.c")).toBe(42)
  })

  it("replaces a non-object intermediate segment with a record", () => {
    const next = setDeep({ a: "str" }, "a.b", 1)
    expect(getDeep(next, "a.b")).toBe(1)
  })
})
