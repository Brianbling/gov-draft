import { useEffect, useRef } from 'react'
import { usePaginator } from '@/hooks/use-paginator'
import { getPaginationText, getPaginationInlineStyle } from '@/hooks/use-pagination-display'
import { useRuleStore } from '@/stores/rule-store'
import { useSettingsStore } from '@/stores/settings-store'

interface A4PaperProps {
  html: string
}

export function A4Paper({ html }: A4PaperProps) {
  const ruleStore = useRuleStore()
  const previewZoom = useSettingsStore((s) => s.previewSettings.zoom)
  const { pages, pageMetas, paginate, measureRef } = usePaginator()
  const stageRef = useRef<HTMLDivElement>(null)

  const drag = useRef({ active: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 })

  // Preview scale is the user zoom only. The paper deliberately does NOT
  // fit-to-width: resizing the split pane must not change the rendered size,
  // since the preview mirrors a fixed-width printed page.
  const scale = previewZoom / 100

  useEffect(() => {
    paginate(html)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, ruleStore.compiledRule, ruleStore.currentRule?.pagination])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
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
    stage.scrollLeft = drag.current.startLeft - (e.clientX - drag.current.startX)
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
        style={{ '--preview-scale': scale } as React.CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="paper-stack flex flex-col items-center gap-6">
          {pages.map((pageHtml, idx) => {
            const meta = pageMetas[idx]
            const paginationEnabled = ruleStore.currentRule?.pagination?.enabled === true
            return (
              <article
                key={idx}
                data-page-index={idx + 1}
                className="paper-sheet preview-content relative w-[210mm] min-h-[297mm] bg-background shadow-lg"
              >
                <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
                {paginationEnabled && meta?.pagination && (
                  <div
                    className="paper-pagination absolute"
                    style={getPaginationInlineStyle(meta, idx)}
                  >
                    {getPaginationText(meta)}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>

      <div className="paper-measure fixed left-[-9999px] top-0 opacity-0 pointer-events-none" aria-hidden="true">
        <article className="paper-sheet w-[210mm]">
          <div ref={measureRef} className="preview-content" />
        </article>
      </div>
    </>
  )
}

export default A4Paper
