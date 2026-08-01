import { describe, it, expect } from "vitest"
import { pdfErrorCodeToI18nKey } from "../pdf-error-codes"

describe("pdfErrorCodeToI18nKey", () => {
  it("已知错误码映射到对应 i18n key", () => {
    expect(pdfErrorCodeToI18nKey("CHROMIUM_NOT_FOUND")).toBe(
      "pdfExport.errors.chromiumNotFound"
    )
    expect(pdfErrorCodeToI18nKey("RENDER_TIMEOUT")).toBe(
      "pdfExport.errors.renderTimeout"
    )
    expect(pdfErrorCodeToI18nKey("EMPTY_PDF")).toBe("pdfExport.errors.emptyPdf")
  })

  it("未知错误码回退到通用 key", () => {
    expect(pdfErrorCodeToI18nKey("SOMETHING_ELSE")).toBe(
      "pdfExport.errors.unknown"
    )
    expect(pdfErrorCodeToI18nKey("")).toBe("pdfExport.errors.unknown")
  })
})
