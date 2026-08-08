import { useState, useCallback, useEffect, useRef } from 'react'
import { useIsMobile } from './use-is-mobile'

interface UseSplitPaneOptions {
  minPanelWidth?: number
  initialEditorWidthPercent?: number
}

const DEFAULT_MIN_WIDTH = 360
const DEFAULT_PERCENT = 50

export function useSplitPane(options: UseSplitPaneOptions = {}) {
  const minPanelWidth = options.minPanelWidth ?? DEFAULT_MIN_WIDTH
  const initialPercent = options.initialEditorWidthPercent ?? DEFAULT_PERCENT

  const [editorWidthPercent, setEditorWidthPercent] = useState(initialPercent)
  const isResizing = useRef(false)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  // 复用 App 的移动断点（<768px）：分割条可拖拽性与编辑/预览 tab 切换用
  // 同一判断，消除 768–1024px 间"渲染分栏但拖不动"的死区。
  const isMobile = useIsMobile()

  const clampPercent = useCallback(
    (raw: number, containerWidth: number) => {
      const minPct = Math.min((minPanelWidth / containerWidth) * 100, 49)
      const maxPct = 100 - minPct
      return Math.max(minPct, Math.min(maxPct, raw))
    },
    [minPanelWidth],
  )

  const updateByClientX = useCallback(
    (clientX: number) => {
      const ws = workspaceRef.current
      if (!ws) return
      const rect = ws.getBoundingClientRect()
      if (rect.width <= 0) return
      setEditorWidthPercent(clampPercent(((clientX - rect.left) / rect.width) * 100, rect.width))
    },
    [clampPercent],
  )

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      if (isMobile) return
      isResizing.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      updateByClientX(e.clientX)
    },
    [isMobile, updateByClientX],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isResizing.current) return
      updateByClientX(e.clientX)
    }
    const onStop = () => {
      if (!isResizing.current) return
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onStop)
    window.addEventListener('pointercancel', onStop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onStop)
      window.removeEventListener('pointercancel', onStop)
      if (isResizing.current) {
        isResizing.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [updateByClientX])

  return {
    workspaceRef,
    editorWidthPercent,
    startResize,
    workspaceStyle: { '--editor-width': `${editorWidthPercent}%` } as React.CSSProperties,
  }
}
