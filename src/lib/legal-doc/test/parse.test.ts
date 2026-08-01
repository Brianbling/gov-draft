import { describe, expect, it } from "vitest"
import {
  parseLegalDoc,
  LegalDocParseError,
  LEGAL_DOC_PARSE_FAILED,
  LEGAL_DOC_UNSUPPORTED_TYPE,
  LEGAL_DOC_MISSING_TITLE,
  LEGAL_DOC_EMPTY_BODY,
  type LegalDoc,
} from "../index"

function validDoc(overrides: Partial<LegalDoc> = {}): LegalDoc {
  return {
    docType: "gongwen",
    title: "关于加强数字政府建设的通知",
    docNumber: "国发〔2026〕12号",
    recipient: "各省、自治区、直辖市人民政府：",
    body: [
      {
        type: "p",
        text: "为深入贯彻落实党中央、国务院决策部署，加快推进数字政府建设。",
      },
    ],
    issuer: "国务院办公厅",
    date: "2026-07-31",
    ...overrides,
  }
}

/** 提取 parseLegalDoc 抛出的 LegalDocParseError；未抛错返回 { code: "NO_ERROR" }。 */
function parseError(raw: string): { code: string; message: string } {
  try {
    parseLegalDoc(raw)
  } catch (error) {
    if (error instanceof LegalDocParseError) {
      return { code: error.code, message: error.message }
    }
    return { code: "UNKNOWN_ERROR", message: String(error) }
  }
  return { code: "NO_ERROR", message: "" }
}

/** 提取 parseLegalDoc 抛出的 LegalDocParseError.code；未抛错返回 "NO_ERROR"。 */
function parseCode(raw: string): string {
  return parseError(raw).code
}

describe("parseLegalDoc", () => {
  it("解析合法 JSON 字符串", () => {
    const doc = parseLegalDoc(JSON.stringify(validDoc()))
    expect(doc.title).toBe("关于加强数字政府建设的通知")
    expect(doc.body).toHaveLength(1)
    expect(doc.docType).toBe("gongwen")
  })

  it("解析被 ```json 代码块包裹的 JSON（剥围栏）", () => {
    const fenced = "```json\n" + JSON.stringify(validDoc(), null, 2) + "\n```"
    const doc = parseLegalDoc(fenced)
    expect(doc.title).toBe("关于加强数字政府建设的通知")
  })

  it("解析被 ``` 裸代码块（无 json 标注）包裹的 JSON", () => {
    const fenced = "```\n" + JSON.stringify(validDoc()) + "\n```"
    const doc = parseLegalDoc(fenced)
    expect(doc.title).toBe("关于加强数字政府建设的通知")
  })

  it("非法 JSON 抛 LEGAL_DOC_PARSE_FAILED", () => {
    expect(parseCode("这不是 JSON { 没有闭合")).toBe(LEGAL_DOC_PARSE_FAILED)
  })

  it("空字符串抛 LEGAL_DOC_PARSE_FAILED", () => {
    expect(parseCode("")).toBe(LEGAL_DOC_PARSE_FAILED)
    expect(parseCode("   ")).toBe(LEGAL_DOC_PARSE_FAILED)
  })

  it("缺 title（body 完好）抛 LEGAL_DOC_MISSING_TITLE", () => {
    const doc = validDoc()
    delete (doc as Partial<LegalDoc>).title
    expect(parseCode(JSON.stringify(doc))).toBe(LEGAL_DOC_MISSING_TITLE)
  })

  it("body 缺失/为空（title 完好）抛 LEGAL_DOC_EMPTY_BODY", () => {
    const noBody = validDoc()
    delete (noBody as Partial<LegalDoc>).body
    expect(parseCode(JSON.stringify(noBody))).toBe(LEGAL_DOC_EMPTY_BODY)
    expect(parseCode(JSON.stringify(validDoc({ body: [] })))).toBe(
      LEGAL_DOC_EMPTY_BODY
    )
  })

  it("非法/缺失 docType（title 完好）抛 LEGAL_DOC_UNSUPPORTED_TYPE", () => {
    expect(
      parseCode(JSON.stringify(validDoc({ docType: "banana" as never })))
    ).toBe(LEGAL_DOC_UNSUPPORTED_TYPE)
  })

  it("body 为空数组抛错误（不满足至少 1 段）", () => {
    expect(parseCode(JSON.stringify(validDoc({ body: [] })))).not.toBe(
      "NO_ERROR"
    )
  })

  it("多余未知字段被丢弃（strip）不报错", () => {
    const raw = JSON.stringify({
      ...validDoc(),
      bogusField: "should-be-stripped",
      another: { nested: 123 },
    })
    const doc = parseLegalDoc(raw)
    expect(doc.title).toBe("关于加强数字政府建设的通知")
    expect("bogusField" in doc).toBe(false)
  })

  it("空字符串正文段落抛错误（min(1) 校验）", () => {
    const bad = validDoc({ body: [{ type: "p", text: "" }] })
    expect(parseCode(JSON.stringify(bad))).not.toBe("NO_ERROR")
  })

  it("非法 paragraph type 抛错误", () => {
    const bad = {
      ...validDoc(),
      body: [{ type: "h3", text: "不存在的层级" }],
    }
    expect(parseCode(JSON.stringify(bad))).not.toBe("NO_ERROR")
  })

  it("非对象顶层（数组/字符串）抛错误，并给出明确提示", () => {
    const arrayErr = parseError(JSON.stringify([1, 2, 3]))
    expect(arrayErr.code).toBe(LEGAL_DOC_PARSE_FAILED)
    expect(arrayErr.message).toContain("JSON object")

    const stringErr = parseError(JSON.stringify("just a string"))
    expect(stringErr.code).toBe(LEGAL_DOC_PARSE_FAILED)
    expect(stringErr.message).toContain("JSON object")
  })
})
