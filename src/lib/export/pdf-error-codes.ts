export type PdfErrorCode =
  | "CHROMIUM_NOT_FOUND"
  | "CHROMIUM_LAUNCH_FAILED"
  | "CDP_CONNECT_FAILED"
  | "RENDER_TIMEOUT"
  | "WRITE_FAILED"
  | "EMPTY_PDF"

const CODE_TO_KEY: Record<PdfErrorCode, string> = {
  CHROMIUM_NOT_FOUND: "pdfExport.errors.chromiumNotFound",
  CHROMIUM_LAUNCH_FAILED: "pdfExport.errors.chromiumLaunchFailed",
  CDP_CONNECT_FAILED: "pdfExport.errors.cdpConnectFailed",
  RENDER_TIMEOUT: "pdfExport.errors.renderTimeout",
  WRITE_FAILED: "pdfExport.errors.writeFailed",
  EMPTY_PDF: "pdfExport.errors.emptyPdf",
}

export function pdfErrorCodeToI18nKey(code: string): string {
  return CODE_TO_KEY[code as PdfErrorCode] ?? "pdfExport.errors.unknown"
}
