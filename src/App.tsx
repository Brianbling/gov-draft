import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRuleStore } from '@/stores/rule-store'
import { useDocStore } from '@/stores/doc-store'
import { useStyleInjector } from '@/hooks/use-style-injector'
import { useMarkdown } from '@/hooks/use-markdown'
import { useSplitPane } from '@/hooks/use-split-pane'
import { useAutoSave } from '@/hooks/use-auto-save'
import CodeMirrorReact from '@/components/editor/CodeMirrorReact'
import type { CodeMirrorHandle } from '@/components/editor/CodeMirrorReact'
import { A4Paper } from '@/components/preview/A4Paper'
import { Toolbar } from '@/components/editor/Toolbar'
import { StatusBar } from '@/components/editor/StatusBar'
import { TooltipProvider } from '@/components/ui/tooltip'

export function App() {
  const { t } = useTranslation()
  const initializeRule = useRuleStore((state) => state.initializeRule)
  const storeContent = useDocStore((state) => state.content)
  const setStoreContent = useDocStore((state) => state.setContent)
  const html = useDocStore((state) => state.html)

  // Initialize rule engine on mount
  useEffect(() => {
    initializeRule()
  }, [initializeRule])

  // Style injection
  useStyleInjector()

  // Markdown parsing (auto watches docStore.content)
  useMarkdown()

  // Auto-save on the configured interval
  useAutoSave()

  // Split pane
  const { workspaceRef, workspaceStyle, startResize } = useSplitPane({ minPanelWidth: 360 })

  // Editor ref
  const editorRef = useRef<CodeMirrorHandle>(null)

  // Local editor content state (synced to store via effect)
  const [content, setContent] = useState(storeContent || t('app.defaultDocument'))

  // Sync local content to store when it changes
  useEffect(() => {
    setStoreContent(content)
  }, [content, setStoreContent])

  // External store updates (AI 生成、导入) 回灌编辑器。若不回灌，
  // CodeMirror 仍显示旧内容，用户一敲键旧内容会覆盖 store 里的新文档。
  // 用 ref 记录"上次回灌进编辑器的 store 值"：只有当 store 的值与编辑器
  // 当前所见不同时回灌，避免启动时（store 空、编辑器有默认文档）的
  // content→store 与 store→content 两个 effect 互相触发形成无限循环。
  // setContent 只在值真正变化时 set store，故回灌前后 ref 不必提前更新，
  // 下一轮 effect 自会因 content 变化而重新求值。
  const lastSyncedStoreRef = useRef(storeContent)
  useEffect(() => {
    if (storeContent === lastSyncedStoreRef.current) return
    // 启动时 store 已水合旧文档、而 ref 从 useRef(storeContent) 初始化，
    // 二者相等 → 直接跳过。这里显式改写 content 才会触发回灌。
    if (storeContent === content) return
    lastSyncedStoreRef.current = storeContent
    setContent(storeContent)
  }, [storeContent])

  return (
    <TooltipProvider>
    <div
      ref={workspaceRef}
      className="app-shell flex h-svh flex-col"
      style={workspaceStyle}
    >
      {/* Editor panel */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className="editor-panel flex flex-col overflow-hidden border-r"
          style={{ width: 'var(--editor-width)' }}
        >
          <Toolbar editorRef={editorRef} />
          <CodeMirrorReact
            ref={editorRef}
            value={content}
            onChange={setContent}
          />
          <StatusBar />
        </div>

        {/* Resizer */}
        <div
          className="resizer w-1 cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary"
          onPointerDown={startResize}
        />

        {/* Preview panel */}
        <div className="preview-panel flex-1 overflow-hidden">
          <A4Paper html={html} />
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}

export default App
