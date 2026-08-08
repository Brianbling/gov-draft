import { describe, expect, it } from "vitest"
import { inferDocCode, matchOrgCode } from "../org-code"

describe("matchOrgCode", () => {
  it("精确匹配：国务院红头 + 国发文号通过", () => {
    expect(
      matchOrgCode("国务院文件", "国发〔2026〕15号")
    ).toBeNull()
  })

  it("精确匹配：国务院办公厅红头 + 国办发文号通过", () => {
    expect(
      matchOrgCode("国务院办公厅文件", "国办发〔2026〕15号")
    ).toBeNull()
  })

  it("文秘验收问题 1：国务院办公厅红头 + 国发文号报错", () => {
    const issue = matchOrgCode(
      "国务院办公厅文件",
      "国发〔2026〕15号"
    )
    expect(issue).not.toBeNull()
    expect(issue).toMatchObject({
      field: "docNumber",
      code: "ORG_CODE_MISMATCH",
      severity: "error",
    })
    expect(issue!.message).toContain("国办发")
  })

  it("反向：国务院红头 + 国办发文号报错（机关名命中优先，指向 docNumber）", () => {
    const issue = matchOrgCode(
      "国务院文件",
      "国办发〔2026〕15号"
    )
    expect(issue).not.toBeNull()
    expect(issue).toMatchObject({
      field: "docNumber",
      code: "ORG_CODE_MISMATCH",
      severity: "error",
    })
    expect(issue!.message).toContain("国发")
  })

  it("已收录机关名 + 代字完全匹配通过", () => {
    expect(matchOrgCode("财政部文件", "财发〔2026〕3号")).toBeNull()
  })

  it("占位模板：××市人民政府文件 + ×政发〔2026〕3号 不误报", () => {
    expect(
      matchOrgCode("××市人民政府文件", "×政发〔2026〕3号")
    ).toBeNull()
  })

  it("占位机关名 + 具体代字：××市人民政府文件 + 国发 不误报（模板无法验证）", () => {
    expect(
      matchOrgCode("××市人民政府文件", "国发〔2026〕15号")
    ).toBeNull()
  })

  it("双侧未知机关（未收录）：不误报", () => {
    expect(matchOrgCode("××市档案馆文件", "×档发〔2026〕1号")).toBeNull()
  })

  it("红头机关名能去文件后缀后精确命中：国务院办公厅文件 + 国办发", () => {
    expect(
      matchOrgCode("国务院办公厅文件", "国办发〔2026〕12号")
    ).toBeNull()
  })
})

describe("inferDocCode", () => {
  it("国务院 → 国发", () => {
    expect(inferDocCode("国务院")).toBe("国发")
    expect(inferDocCode("国务院文件")).toBe("国发")
  })

  it("国务院办公厅 → 国办发", () => {
    expect(inferDocCode("国务院办公厅")).toBe("国办发")
  })

  it("已收录机关命中", () => {
    expect(inferDocCode("财政部文件")).toBe("财发")
  })

  it("未收录机关返回 null", () => {
    expect(inferDocCode("××市档案馆")).toBeNull()
  })
})
