import { describe, expect, it } from "vitest"
import { DOC_TYPE_SPECS } from "../doc-type-spec"
import { DOC_TYPES, type DocType } from "../types"

describe("DOC_TYPE_SPECS · 分文种要素集 + 按需盖章默认（v2 表单辅助）", () => {
  it("每个文种都定义 formFields 且非空", () => {
    for (const docType of DOC_TYPES) {
      const spec = DOC_TYPE_SPECS[docType]
      expect(spec.formFields.length).toBeGreaterThan(0)
    }
  })

  it("formFields 的 key 都是合法 LegalDoc 字段（不含 body）", () => {
    const legalKeys = new Set([
      "title",
      "docNumber",
      "recipient",
      "issuer",
      "date",
      "securityLevel",
      "urgency",
      "attachments",
      "cc",
      "attendees",
      "absentees",
      "observers",
      "seal",
    ])
    for (const docType of DOC_TYPES) {
      for (const field of DOC_TYPE_SPECS[docType].formFields) {
        expect(legalKeys.has(field.key), `${docType}.${field.key}`).toBe(true)
        expect(field.label.length).toBeGreaterThan(0)
        expect(["text", "array", "boolean"].includes(field.type)).toBe(true)
      }
    }
  })

  it("minutes 的出席人员（attendees）标记 required，其余文种 title 标记 required", () => {
    const minutes = DOC_TYPE_SPECS.minutes.formFields.find(
      (f) => f.key === "attendees",
    )
    expect(minutes?.required).toBe(true)
    for (const docType of DOC_TYPES) {
      if (docType === "minutes") continue
      const title = DOC_TYPE_SPECS[docType].formFields.find(
        (f) => f.key === "title",
      )
      expect(title?.required).toBe(true)
    }
  })

  it("announcement 不含 recipient 字段（通告/公告无主送机关）", () => {
    const keys = DOC_TYPE_SPECS.announcement.formFields.map((f) => f.key)
    expect(keys).not.toContain("recipient")
  })

  it("sealDefault：决定/请示/批复/函默认盖章，通知/报告/纪要/通告默认不盖章", () => {
    const sealDocs: DocType[] = ["decision", "request", "reply", "letter"]
    for (const docType of sealDocs) {
      expect(DOC_TYPE_SPECS[docType].sealDefault).toBe(true)
    }
    const noSealDocs: DocType[] = [
      "gongwen",
      "opinion",
      "report",
      "minutes",
      "announcement",
    ]
    for (const docType of noSealDocs) {
      expect(DOC_TYPE_SPECS[docType].sealDefault).toBe(false)
    }
  })

  it("sealDefault 布尔类型", () => {
    for (const docType of DOC_TYPES) {
      expect(typeof DOC_TYPE_SPECS[docType].sealDefault).toBe("boolean")
    }
  })
})
