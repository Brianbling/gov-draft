import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePaginator } from "@/hooks/use-paginator"
import {
  getPaginationText,
  getPaginationInlineStyle,
} from "@/hooks/use-pagination-display"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { useRuleStore } from "@/stores/rule-store"
import { useSettingsStore } from "@/stores/settings-store"

interface A4PaperProps {
  html: string
}

export function A4Paper({ html }: A4PaperProps) {
  const { t } = useTranslation()
  const ruleStore = useRuleStore()
  const previewZoom = useSettingsStore((s) => s.previewSettings.zoom)
  const { pages, pageMetas, paginate, measureRef } = usePaginator()
  const stageRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)

  // 移动端纸面适配视口宽度：210mm 纸张在窄屏下等比缩小到 <768px 内可见。
  // 桌面端保持用户 zoom 不缩放（fit-to-width 固定，分屏变化不改渲染尺寸）。
  const isNarrow = useIsMobile()

  useEffect(() => {
    if (!isNarrow) {
      setFitScale(1)
      return
    }
    const measure = () => {
      const mmToPx = (mm: number) => (mm * 96) / 25.4
      const paperWidthPx = mmToPx(210)
      const availablePx = (stageRef.current?.clientWidth ?? 0) - 2 * 16
      setFitScale(Math.min(1, availablePx / paperWidthPx))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [isNarrow])

  const scale = (previewZoom / 100) * fitScale

  const isEmpty = html.trim().length === 0

  const drag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  })

  // Pagination is the layout-measurement hotspot (innerHTML + scrollHeight
  // reflow per page). Typing produces one parse result every ~100ms, so
  // paginating each intermediate state pays the reflow cost for content the
  // user never sees. Coalesce rapid html changes into a single pagination that
  // runs when the main thread is idle; the pending value guarantees the latest
  // html is always paginated (trailing edge), and the rIC timeout bounds lag.
  const pendingHtmlRef = useRef<string | null>(null)
  const idleHandleRef = useRef<number | null>(null)

  useEffect(() => {
    pendingHtmlRef.current = html
    if (idleHandleRef.current !== null) return
    const run = () => {
      idleHandleRef.current = null
      const target = pendingHtmlRef.current
      pendingHtmlRef.current = null
      if (target !== null) void paginate(target)
    }
    if (typeof requestIdleCallback === "function") {
      idleHandleRef.current = requestIdleCallback(run, { timeout: 200 })
    } else {
      idleHandleRef.current = window.setTimeout(run, 50)
    }
    return () => {
      if (idleHandleRef.current !== null) {
        if (typeof cancelIdleCallback === "function") {
          cancelIdleCallback(idleHandleRef.current)
        } else {
          clearTimeout(idleHandleRef.current)
        }
        idleHandleRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, ruleStore.compiledRule, ruleStore.currentRule?.pagination])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return
    // 只在纸面外的灰色留白区启动拖拽滚动，纸面内保留文本选择/复制能力
    const target = e.target as HTMLElement
    if (target.closest(".paper-sheet")) return
    const stage = stageRef.current
    if (!stage) return
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: stage.scrollLeft,
      startTop: stage.scrollTop,
    }
    stage.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    const stage = stageRef.current
    if (!stage) return
    stage.scrollLeft =
      drag.current.startLeft - (e.clientX - drag.current.startX)
    stage.scrollTop = drag.current.startTop - (e.clientY - drag.current.startY)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    drag.current.active = false
    stageRef.current?.releasePointerCapture(e.pointerId)
  }

  return (
    <>
      <div
        ref={stageRef}
        className="paper-stage h-full overflow-auto bg-muted p-6"
        style={{ "--preview-scale": scale } as React.CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="paper-stack flex flex-col items-center gap-6">
          {isEmpty ? (
            <div className="paper-sheet flex h-[297mm] w-[210mm] flex-col items-center justify-center gap-2 rounded-sm bg-background text-center shadow-lg">
              <p className="text-sm text-muted-foreground">
                {t("preview.emptyHint")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("preview.emptySubHint")}
              </p>
            </div>
          ) : (
            pages.map((pageHtml, idx) => {
              const meta = pageMetas[idx]
              const paginationEnabled =
                ruleStore.currentRule?.pagination?.enabled === true
              return (
                <article
                  key={idx}
                  data-page-index={idx + 1}
                  className="paper-sheet preview-content relative min-h-[297mm] w-[210mm] bg-background shadow-lg"
                >
                  <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
                  {paginationEnabled && meta?.pagination && (
                    <div
                      className="paper-pagination absolute"
                      style={getPaginationInlineStyle(meta, idx)}
                    >
                      {getPaginationText(meta, idx)}
                    </div>
                  )}
                </article>
              )
            })
          )}
        </div>
      </div>

      <div
        className="paper-measure pointer-events-none fixed top-0 left-[-9999px] opacity-0"
        aria-hidden="true"
      >
        <article className="paper-sheet w-[210mm]">
          <div ref={measureRef} className="preview-content" />
        </article>
      </div>
    </>
  )
}

export default A4Paper
