import { useCallback, useEffect, useState } from "react"
import { save } from "@tauri-apps/plugin-dialog"
import { useTranslation } from "react-i18next"
import { isTauri, trackedInvoke } from "@/lib/tauri"
import { buildExportHtml } from "@/lib/export/build-export-html"
import { pdfErrorCodeToI18nKey } from "@/lib/export/pdf-error-codes"
import { toast } from "@/components/ui/toast"
import { useRuleStore } from "@/stores/rule-store"
import { useDocStore } from "@/stores/doc-store"
import { useSettingsStore } from "@/stores/settings-store"

interface ExportPdfResult {
  outputPath: string
  bytesWritten: number
}

/**
 * 从已渲染的预览 DOM 收集每页内容 HTML(每个 .paper-sheet 的内容 div 与
 * .paper-pagination 页码 div 的 outerHTML 拼接)。查询范围限定在 .paper-stack
 * 内,避免命中 A4Paper 中用于测量分页的隐藏 .paper-sheet(off-screen
 * measurement sheet,不在 .paper-stack 内)。页码 div 的定位由内联 style
 * 在运行时计算得出,必须保留其 outerHTML 才能在导出的 PDF 中正确显示页码。
 */
export function collectRenderedPages(root: ParentNode): string[] {
  const sheets = Array.from(root.querySelectorAll(".paper-stack .paper-sheet"))
  return sheets
    .map((sheet) => {
      const content = sheet.querySelector(":scope > div:not(.paper-pagination)")
      const pagination = sheet.querySelector(":scope > .paper-pagination")
      return (content?.outerHTML ?? "") + (pagination?.outerHTML ?? "")
    })
    .filter((html) => html.length > 0)
}

export function usePdfExport() {
  const { t } = useTranslation()
  const getRuleCssText = useRuleStore((s) => s.getRuleCssText)
  const pageConfig = useRuleStore((s) => s.currentRule?.page)
  const title = useDocStore((s) => s.title)
  const chromiumPath = useSettingsStore((s) => s.chromiumPath)
  const isTauriEnv = isTauri()

  // Tauri 环境下需要检测 Chromium 是否可用；浏览器模式下始终可用
  const [chromiumAvailable, setChromiumAvailable] = useState(false)

  useEffect(() => {
    if (!isTauriEnv) {
      // 浏览器模式：使用 window.print()，无需 Chromium
      setChromiumAvailable(true)
      return
    }

    // 用户在设置中已指定 chromium 路径 → 可用
    if (chromiumPath && chromiumPath.trim().length > 0) {
      setChromiumAvailable(true)
      return
    }

    // 自动检测系统 Chromium
    let cancelled = false
    trackedInvoke<string | null>("detect_chromium")
      .then((result) => {
        if (!cancelled) setChromiumAvailable(result != null)
      })
      .catch(() => {
        if (!cancelled) setChromiumAvailable(false)
      })

    return () => {
      cancelled = true
    }
  }, [isTauriEnv, chromiumPath])

  const isSupported = isTauriEnv ? chromiumAvailable : true

  const exportPdf = useCallback(async () => {
    // Tauri 和浏览器模式共享：收集渲染页面 + 构建导出 HTML
    const pages = collectRenderedPages(document)
    if (pages.length === 0) {
      toast.error(t("fileSystem.pdfExportNoPages"))
      return
    }
    const html = buildExportHtml({
      pages,
      ruleCssText: getRuleCssText(),
      pageSize: pageConfig?.size,
      orientation: pageConfig?.orientation,
    })

    if (isTauriEnv) {
      // Tauri 模式：保存对话框 → Chromium 后端导出
      const defaultName = `${title || "document"}.pdf`
      const outputPath = await save({
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      })
      if (!outputPath) return // 用户取消

      try {
        const result = await trackedInvoke<ExportPdfResult>("export_pdf", {
          args: {
            html,
            outputPath,
            chromiumPath: chromiumPath || undefined,
            orientation: pageConfig?.orientation ?? "portrait",
            printBackground: true,
          },
        })
        toast.success(t("pdfExport.success", { path: result.outputPath }))
      } catch (err) {
        const code = typeof err === "string" ? err : String(err)
        toast.error(t(pdfErrorCodeToI18nKey(code)))
      }
    } else {
      // 浏览器模式：新窗口打开导出 HTML → 浏览器打印
      const w = window.open("", "_blank")
      if (!w) {
        toast.error(t("fileSystem.popupBlocked"))
        return
      }
      w.document.write(html)
      w.document.close()
      // 等待样式加载完成后自动弹出打印对话框
      w.onload = () => w.print()
    }
  }, [isTauriEnv, getRuleCssText, pageConfig, title, chromiumPath, t])

  return { exportPdf, isSupported }
}
