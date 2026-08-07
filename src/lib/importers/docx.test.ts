import { describe, it, expect } from "vitest"
import { parseDocxToMarkdown, isDocxFile } from "./docx"

// 内嵌最小 docx：标题(Heading1) + 正文含 bookmarkStart(_Toc123) + 一张内嵌
// png 图 + 一个 2 行表格。手工拼 zip 造 docx 不可靠，直接内嵌 base64。
const DOCX_BASE64 =
  "UEsDBAoAAAAAAOmbB10AAAAAAAAAAAAAAAAFAAAAd29yZC9QSwMECgAAAAAA6ZsHXQAAAAAAAAAAAAAAAAsAAAB3b3JkL21lZGlhL1BLAwQKAAAAAADpmwddpBv/n0YAAABGAAAAFQAAAHdvcmQvbWVkaWEvaW1hZ2UxLnBuZ4lQTkcNChoKAAAADUlIRFIAAAABAAAAAQgGAAAAHxXEiQAAAA1JREFUeNpjZGD4Xw8AAocBgOtHupIAAAAASUVORK5CYIJQSwMECgAAAAAA6ZsHXbnqI5bfAQAA3wEAABgAAAB3b3JkL1tDb250ZW50X1R5cGVzXS54bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+PFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPjxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1wYWNrYWdlLnJlbGF0aW9uc2hpcHMreG1sIi8+PERlZmF1bHQgRXh0ZW5zaW9uPSJ4bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi94bWwiLz48RGVmYXVsdCBFeHRlbnNpb249InBuZyIgQ29udGVudFR5cGU9ImltYWdlL3BuZyIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3dvcmQvZG9jdW1lbnQueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQubWFpbit4bWwiLz48L1R5cGVzPlBLAwQKAAAAAADpmwddAAAAAAAAAAAAAAAABgAAAF9yZWxzL1BLAwQKAAAAAADpmwddm/036ikBAAApAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/PjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0id29yZC9kb2N1bWVudC54bWwiLz48L1JlbGF0aW9uc2hpcHM+UEsDBAoAAAAAAOmbB10AAAAAAAAAAAAAAAALAAAAd29yZC9fcmVscy9QSwMECgAAAAAA6ZsHXehQdQchAQAAIQEAABwAAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/PjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEwMCIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9pbWFnZSIgVGFyZ2V0PSJtZWRpYS9pbWFnZTEucG5nIi8+PC9SZWxhdGlvbnNoaXBzPlBLAwQKAAAAAADpmwddEDgbkVEGAABRBgAAEQAAAHdvcmQvZG9jdW1lbnQueG1sPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pjx3OmRvY3VtZW50IHhtbG5zOnc9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy93b3JkcHJvY2Vzc2luZ21sLzIwMDYvbWFpbiIgeG1sbnM6cj0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcyIgeG1sbnM6d3A9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi93b3JkcHJvY2Vzc2luZ0RyYXdpbmciIHhtbG5zOmE9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9tYWluIiB4bWxuczpwaWM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9kcmF3aW5nbWwvMjAwNi9waWN0dXJlIj48dzpib2R5Pjx3OnA+PHc6cFByPjx3OnBTdHlsZSB3OnZhbD0iSGVhZGluZzEiLz48L3c6cFByPjx3OnI+PHc6dD7lhbPkuo7lvIDlsZXkuJPpobnmo4Dmn6XnmoTpgJrnn6U8L3c6dD48L3c6cj48L3c6cD48dzpwPjx3OnI+PHc6dD7mraPmloc8L3c6dD48L3c6cj48dzpib29rbWFya1N0YXJ0IHc6aWQ9IjAiIHc6bmFtZT0iX1RvYzEyMyIvPjx3OnI+PHc6dD7lhoXlrrk8L3c6dD48L3c6cj48dzpib29rbWFya0VuZCB3OmlkPSIwIi8+PC93OnA+PHc6cD48dzpyPjx3OmRyYXdpbmc+PHdwOmlubGluZSBkaXN0VD0iMCIgZGlzdEI9IjAiIGRpc3RMPSIwIiBkaXN0Uj0iMCI+PHdwOmV4dGVudCBjeD0iMzA0ODAwIiBjeT0iMzA0ODAwIi8+PHdwOmRvY1ByIGlkPSIxIiBuYW1lPSJQaWN0dXJlIDEiLz48YTpncmFwaGljPjxhOmdyYXBoaWNEYXRhIHVyaT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L3BpY3R1cmUiPjxwaWM6cGljPjxwaWM6bnZQaWNQcj48cGljOmNOdlByIGlkPSIxIiBuYW1lPSJpbWFnZTEucG5nIi8+PHBpYzpjTnZQaWNQci8+PC9waWM6bnZQaWNQcj48cGljOmJsaXBGaWxsPjxhOmJsaXAgcjplbWJlZD0icklkMTAwIi8+PGE6c3RyZXRjaD48YTpmaWxsUmVjdC8+PC9hOnN0cmV0Y2g+PC9waWM6YmxpcEZpbGw+PHBpYzpzcFByPjxhOnhmcm0+PGE6b2ZmIHg9IjAiIHk9IjAiLz48YTpleHQgY3g9IjMwNDgwMCIgY3k9IjMwNDgwMCIvPjwvYTp4ZnJtPjxhOnByc3RHZW9tIHByc3Q9InJlY3QiPjxhOmF2THN0Lz48L2E6cHJzdEdlb20+PC9waWM6c3BQcj48L3BpYzpwaWM+PC9hOmdyYXBoaWNEYXRhPjwvYTpncmFwaGljPjwvd3A6aW5saW5lPjwvdzpkcmF3aW5nPjwvdzpyPjwvdzpwPjx3OnRibD48dzp0cj48dzp0Yz48dzpwPjx3OnI+PHc6dD7pobnnm648L3c6dD48L3c6cj48L3c6cD48L3c6dGM+PHc6dGM+PHc6cD48dzpyPjx3OnQ+6YeR6aKdPC93OnQ+PC93OnI+PC93OnA+PC93OnRjPjwvdzp0cj48dzp0cj48dzp0Yz48dzpwPjx3OnI+PHc6dD7mnZDmlpnotLk8L3c6dD48L3c6cj48L3c6cD48L3c6dGM+PHc6dGM+PHc6cD48dzpyPjx3OnQ+MTAwMDwvdzp0PjwvdzpyPjwvdzpwPjwvdzp0Yz48L3c6dHI+PC93OnRibD48dzpwPjx3OnI+PHc6dD7mraToh7Q8L3c6dD48L3c6cj48L3c6cD48L3c6Ym9keT48L3c6ZG9jdW1lbnQ+UEsBAhQACgAAAAAA6ZsHXQAAAAAAAAAAAAAAAAUAAAAAAAAAAAAQAAAAAAAAAHdvcmQvUEsBAhQACgAAAAAA6ZsHXQAAAAAAAAAAAAAAAAsAAAAAAAAAAAAQAAAAIwAAAHdvcmQvbWVkaWEvUEsBAhQACgAAAAAA6ZsHXaQb/59GAAAARgAAABUAAAAAAAAAAAAAAAAATAAAAHdvcmQvbWVkaWEvaW1hZ2UxLnBuZ1BLAQIUAAoAAAAAAOmbB1256iOW3wEAAN8BAAAYAAAAAAAAAAAAAAAAAMUAAAB3b3JkL1tDb250ZW50X1R5cGVzXS54bWxQSwECFAAKAAAAAADpmwddAAAAAAAAAAAAAAAABgAAAAAAAAAAABAAAADaAgAAX3JlbHMvUEsBAhQACgAAAAAA6ZsHXZv9N+opAQAAKQEAAAsAAAAAAAAAAAAAAAAA/gIAAF9yZWxzLy5yZWxzUEsBAhQACgAAAAAA6ZsHXQAAAAAAAAAAAAAAAAsAAAAAAAAAAAAQAAAAUAQAAHdvcmQvX3JlbHMvUEsBAhQACgAAAAAA6ZsHXehQdQchAQAAIQEAABwAAAAAAAAAAAAAAAAAeQQAAHdvcmQvX3JlbHMvZG9jdW1lbnQueG1sLnJlbHNQSwECFAAKAAAAAADpmwddEDgbkVEGAABRBgAAEQAAAAAAAAAAAAAAAADUBQAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAkACQAkAgAAVAwAAAAA"

function docxBytes(): Uint8Array {
  const binary = atob(DOCX_BASE64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

describe("parseDocxToMarkdown", () => {
  it("把 docx 正文转成 markdown 标题", async () => {
    const md = await parseDocxToMarkdown(docxBytes())
    expect(md).toContain("# 关于开展专项检查的通知")
    expect(md).toContain("正文")
    expect(md).toContain("此致")
  })

  it("过滤 bookmark 锚点死链", async () => {
    const md = await parseDocxToMarkdown(docxBytes())
    expect(md).not.toContain("](#")
    expect(md).not.toContain("[_Toc123]")
  })

  it("图片不泄漏 base64 data URI", async () => {
    const md = await parseDocxToMarkdown(docxBytes())
    expect(md).not.toContain("data:")
    expect(md).not.toContain("data:image")
  })

  it("输出无 BOM", async () => {
    const md = await parseDocxToMarkdown(docxBytes())
    expect(md.charCodeAt(0)).not.toBe(0xfeff)
  })

  it("表格内容不丢", async () => {
    const md = await parseDocxToMarkdown(docxBytes())
    expect(md).toContain("项目")
    expect(md).toContain("材料费")
  })
})

describe("isDocxFile", () => {
  it("按后缀识别 .docx", () => {
    expect(isDocxFile({ name: "通知.docx" })).toBe(true)
    expect(isDocxFile({ name: "通知.doc" })).toBe(false)
  })

  it("按 MIME 识别 docx", () => {
    expect(
      isDocxFile({
        name: "x",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    ).toBe(true)
  })
})
