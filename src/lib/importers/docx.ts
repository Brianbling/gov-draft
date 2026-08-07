import mammoth from "mammoth"
import TurndownService from "turndown"

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

// Word 公文里常见两类占位锚点：mammoth 把 bookmarkStart 渲染成
// <a id="_Toc123"></a>，历史 docx 里也有 <a name="..."/>。两者都没有
// href，不是超链接；turndown 默认会把带内容/空内容的它们误转成
// [text](#id) 或 [](#id) 死链，必须拆包去掉。
const unwrapBookmarkAnchors = (turndown: TurndownService): void => {
  turndown.addRule("unwrapBookmarkAnchors", {
    filter: (node) =>
      node.nodeName === "A" &&
      !node.getAttribute("href") &&
      (node.hasAttribute("name") || node.hasAttribute("id")),
    replacement: (content) => content,
  })
}

// 图片统一换成占位符，避免 mammoth 默认把内嵌图导出成 base64 data URI
//（一张图几十 KB → 几 MB 字符串），导入会卡死/产出超长 markdown。
const dropImageDataUris = (turndown: TurndownService): void => {
  turndown.addRule("dropImageDataUris", {
    filter: "img",
    replacement: () => "![图片]",
  })
}

export function isDocxFile(file: { name: string; type?: string }): boolean {
  return (
    file.name.toLowerCase().endsWith(".docx") || file.type === DOCX_MIME_TYPE
  )
}

export async function parseDocxToMarkdown(
  file: ArrayBuffer | Uint8Array
): Promise<string> {
  const bytes = file instanceof Uint8Array ? file : new Uint8Array(file)
  const result = await mammoth.convertToHtml(
    // Node 版 mammoth 认 buffer，browser 版认 arrayBuffer，两个键都传
    // 才能在 vitest 和 Tauri 浏览器环境同时生效。
    { buffer: bytes, arrayBuffer: bytes } as unknown as Parameters<
      typeof mammoth.convertToHtml
    >[0],
    {
      // convertImage 返回空 src，mammoth 便不再读取原图/生成 data URI
      convertImage: mammoth.images.imgElement(() =>
        Promise.resolve({ src: "" })
      ),
    }
  )

  const turndownService = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    strongDelimiter: "**",
    emDelimiter: "*",
  })
  unwrapBookmarkAnchors(turndownService)
  dropImageDataUris(turndownService)

  return turndownService
    .turndown(result.value)
    .replace(/^\uFEFF/, "")
    .trim()
}
