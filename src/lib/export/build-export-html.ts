export interface BuildExportHtmlOptions {
  pages: string[]
  ruleCssText: string
  pageSize?: string
  orientation?: "portrait" | "landscape"
  lang?: string
}

// 强制分页:每个 sheet 一页,最后一页不留多余空白页。
// 抵消预览容器样式(缩放/flex),对齐 gov-draft weasy-export 的 print_override_css。
const PRINT_OVERRIDE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
.paper-stack { display: block; width: auto; min-width: 0; transform: none; zoom: 1; }
.paper-sheet { break-after: page; page-break-after: always; position: relative; }
.paper-sheet:last-child { break-after: auto; page-break-after: auto; }
.paper-pagination { position: absolute; }
html, body { writing-mode: horizontal-tb; margin: 0; padding: 0; }
`

export function buildExportHtml(options: BuildExportHtmlOptions): string {
  const {
    pages,
    ruleCssText,
    pageSize = "A4",
    orientation = "portrait",
    lang = "zh-CN",
  } = options

  const sheets = pages
    .map(
      (page) => `<article class="paper-sheet preview-content">${page}</article>`
    )
    .join("\n")

  const pageRule = `@page { size: ${pageSize} ${orientation}; margin: 0; }`

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<style>
${ruleCssText}
${pageRule}
${PRINT_OVERRIDE_CSS}
</style>
</head>
<body>
<div class="paper-stack">
${sheets}
</div>
</body>
</html>`
}
