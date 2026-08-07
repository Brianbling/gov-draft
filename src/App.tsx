import { useState, useRef, useEffect, useCallback } from "react"
import { useRuleStore } from "@/stores/rule-store"
import { useDocStore, BLANK_DOCUMENT } from "@/stores/doc-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useStyleInjector } from "@/hooks/use-style-injector"
import { useMarkdown } from "@/hooks/use-markdown"
import { useSplitPane } from "@/hooks/use-split-pane"
import { useAutoSave } from "@/hooks/use-auto-save"
import CodeMirrorReact from "@/components/editor/CodeMirrorReact"
import type { CodeMirrorHandle } from "@/components/editor/CodeMirrorReact"
import { A4Paper } from "@/components/preview/A4Paper"
import { Toolbar } from "@/components/editor/Toolbar"
import { StatusBar } from "@/components/editor/StatusBar"
import { WelcomeDialog, hasSeenWelcome } from "@/components/WelcomeDialog"
import { ConfirmOverwriteDialog } from "@/components/ConfirmOverwriteDialog"
import { ConfirmNewDocumentDialog } from "@/components/ConfirmNewDocumentDialog"
import { TooltipProvider } from "@/components/ui/tooltip"

/** 全局事件：跨组件打开 AI 生成 / 导入（Toolbar 与引导层共用）。 */
const OPEN_AI_EVENT = "ezdoc:open-ai-generate"
const OPEN_IMPORT_EVENT = "ezdoc:open-import"
const NEW_DOCUMENT_EVENT = "ezdoc:new-document"

export function App() {
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
  const { workspaceRef, workspaceStyle, startResize } = useSplitPane({
    minPanelWidth: 360,
  })

  // Editor ref
  const editorRef = useRef<CodeMirrorHandle>(null)

  // P0-1 首屏改空白编辑器：有用户文档痕迹（store 水合了非空内容）才沿用，
  // 全新首启（localStorage 无内容）加载空白文档（未命名标题占位）。
  // app.defaultDocument 整篇 `:::` 覆写语法示例不再作首启默认内容。
  const [content, setContent] = useState(() =>
    storeContent.trim() ? storeContent : BLANK_DOCUMENT
  )

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
  // 注意：deps 只放 storeContent，不放 content。若把 content 也放进 deps，
  // 用户每次击键的渲染里 back-fill 就会读到上一次的旧 store 值并回退编辑器，
  // 形成"输入→回灌→覆盖输入"的 Maximum update depth 死循环。
  const lastSyncedStoreRef = useRef(storeContent)
  useEffect(() => {
    if (storeContent === lastSyncedStoreRef.current) return
    // 启动时 store 已水合旧文档、而 ref 从 useRef(storeContent) 初始化，
    // 二者相等 → 直接跳过。这里显式改写 content 才会触发回灌。
    if (storeContent === content) return
    lastSyncedStoreRef.current = storeContent
    setContent(storeContent)
  }, [storeContent])

  // P0-1 首启引导：首次启动弹欢迎层（localStorage 记 seen）。
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome())
  // P0-5 二次生成确认 / P0-1 新建确认。
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)

  // P0-1 新建文档：清空正文，回到未命名空白文档。
  const createNewDocument = useCallback(() => {
    useDocStore.getState().newDocument()
    lastSyncedStoreRef.current = BLANK_DOCUMENT
    setContent(BLANK_DOCUMENT)
  }, [])

  // P0-1 新建文档逻辑（供按钮/快捷键/确认弹窗复用）。
  const handleNewRequestRef = useRef<() => void>(() => {})
  useEffect(() => {
    handleNewRequestRef.current = () => {
      if (useDocStore.getState().isBlankDocument()) {
        createNewDocument()
      } else {
        setConfirmNew(true)
      }
    }
  }, [createNewDocument])

  // P0-5 二次生成覆盖确认：编辑器有内容（非空白）时再生成先弹确认，
  // 避免误点即静默覆盖手动微调成果。逻辑放 ref，供 Ctrl+J / Toolbar 按钮 /
  // 欢迎层 / 确认弹窗的"继续生成"四入口复用，避免事件再分发死循环。
  const openAiGenerateRef = useRef<() => void>(() => {})
  useEffect(() => {
    openAiGenerateRef.current = () => {
      if (!useDocStore.getState().isBlankDocument()) {
        setConfirmGenerate(true)
        return
      }
      window.dispatchEvent(new CustomEvent(OPEN_AI_EVENT))
    }
  }, [])

  // P0-1 工具栏"新建文档"按钮 → 空白则直接新建，有内容先弹确认。
  // 用稳定闭包读 ref，避免监听器永远指向初始空函数。
  useEffect(() => {
    const stableHandler = () => handleNewRequestRef.current()
    window.addEventListener(NEW_DOCUMENT_EVENT, stableHandler)
    return () => window.removeEventListener(NEW_DOCUMENT_EVENT, stableHandler)
  }, [])

  // 关闭前确认：自动保存关闭且存在未保存改动时，关闭/刷新前提醒，
  // 避免用户退出即丢手动修改。自动保存开启时 persist 已实时落盘，不拦截。
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const doc = useDocStore.getState()
      if (doc.isDirty && !useSettingsStore.getState().autoSave) {
        e.preventDefault()
        // 现代浏览器要求 returnValue 或 preventDefault 才显示确认框。
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  // P0-2/P0-4 全局快捷键：Ctrl+J 打开 AI 生成、Ctrl+N 新建、Ctrl+S 保存。
  // capture 阶段拦截，避免 CodeMirror（Ctrl-n 光标下移）与浏览器默认动作抢先。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === "j") {
        e.preventDefault()
        openAiGenerateRef.current()
      } else if (key === "n") {
        e.preventDefault()
        handleNewRequestRef.current()
      } else if (key === "s") {
        e.preventDefault()
        useDocStore.getState().saveManually()
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true })
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true })
  }, [])

  const openAiGenerate = useCallback(() => {
    openAiGenerateRef.current()
  }, [])

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
            style={{ width: "var(--editor-width)" }}
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

        {/* P0-1 首启引导层：四步 + 两个主入口 */}
        <WelcomeDialog
          open={welcomeOpen}
          onOpenChange={setWelcomeOpen}
          onGenerate={openAiGenerate}
          onImport={() =>
            window.dispatchEvent(new CustomEvent(OPEN_IMPORT_EVENT))
          }
        />

        {/* P0-5 二次生成覆盖确认：覆盖 / 保留并新建 */}
        <ConfirmOverwriteDialog
          open={confirmGenerate}
          onOpenChange={setConfirmGenerate}
          onConfirm={() => {
            setConfirmGenerate(false)
            window.dispatchEvent(new CustomEvent(OPEN_AI_EVENT))
          }}
          onNewDocument={() => {
            setConfirmGenerate(false)
            createNewDocument()
            openAiGenerate()
          }}
        />

        {/* P0-1 新建确认 */}
        <ConfirmNewDocumentDialog
          open={confirmNew}
          onOpenChange={setConfirmNew}
          onConfirm={() => {
            setConfirmNew(false)
            createNewDocument()
          }}
        />
      </div>
    </TooltipProvider>
  )
}

export default App
