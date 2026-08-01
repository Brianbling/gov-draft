import { useCallback, useEffect, useRef, useState } from "react"
import { useDocStore } from "@/stores/doc-store"
import { generateDocument } from "@/lib/llm"
import {
  buildUserPrompt,
  parseLegalDoc,
  toMarkdown,
  reviewDocument,
  normalizeDoc,
  repairDoc,
  repairsToIssues,
} from "@/lib/legal-doc"
import type { DocType, LegalDoc, FormatIssue } from "@/lib/legal-doc"

export type GenerateStatus = "idle" | "generating" | "done" | "error"

const DOC_TYPE_DEFAULT: DocType = "gongwen"

/**
 * 读取 EZDOC_* 环境变量（dev 手测 / vitest 用）。浏览器构建下 process 未定义，
 * 通过 globalThis 安全探测，避免在 `tsc -b` 中引用未声明的全局。
 */
function getEzdocEnv(name: string): string | undefined {
  const g = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }
  return g.process?.env?.[name]
}

const ERROR_CODE_TO_I18N: Record<string, string> = {
  LLM_EMPTY_RESULT: "aiGenerate.errors.llmEmptyResult",
  LEGAL_DOC_PARSE_FAILED: "aiGenerate.errors.legalDocParseFailed",
  LEGAL_DOC_UNSUPPORTED_TYPE: "aiGenerate.errors.legalDocUnsupportedType",
  LEGAL_DOC_MISSING_TITLE: "aiGenerate.errors.legalDocMissingTitle",
  LEGAL_DOC_EMPTY_BODY: "aiGenerate.errors.legalDocEmptyBody",
}

/** Map an LLM_ or LEGAL_DOC_ error code to an aiGenerate.errors i18n key. */
export function errorCodeToI18nKey(code: string): string {
  if (ERROR_CODE_TO_I18N[code]) return ERROR_CODE_TO_I18N[code]
  if (code.startsWith("LLM_")) return "aiGenerate.errors.llmRequestFailed"
  if (code.startsWith("LEGAL_DOC_"))
    return "aiGenerate.errors.legalDocParseFailed"
  return "aiGenerate.errors.unknown"
}

function extractErrorCode(err: unknown): string {
  // 先查 err.code：LegalDocParseError 等自定义错误带机器可读错误码，
  // 若先判 instanceof Error 会读到人类可读 message 而丢掉 code
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof err.code === "string"
  ) {
    return err.code
  }
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  return "UNKNOWN"
}

export interface GenerateResult {
  markdown: string
  title: string
}

export function useGenerateDocument() {
  const [prompt, setPrompt] = useState("")
  const [docType, setDocType] = useState<DocType>(DOC_TYPE_DEFAULT)
  const [seal, setSeal] = useState(false)
  const [status, setStatus] = useState<GenerateStatus>("idle")
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [result, setResult] = useState<LegalDoc | null>(null)
  const [issues, setIssues] = useState<FormatIssue[]>([])

  // 生成是异步的：用户在生成中关闭对话框（Radix 卸载组件）后，
  // 挂载守卫防止 generate() 完成后把结果静默写进 store / 编辑器。
  // 每次 generate 一个 AbortController；关闭对话框会卸载面板 → 触发本
  // cleanup → abort 在途请求，避免 Escape/遮罩关闭后 LLM 请求仍在跑（消耗额度）。
  const mountedRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const generate = useCallback(async (): Promise<GenerateResult | null> => {
    const abortController = new AbortController()
    abortRef.current = abortController
    setStatus("generating")
    setErrorCode(null)
    setResult(null)
    setIssues([])
    try {
      const userPrompt = buildUserPrompt(`${docType}\n${prompt}`, { seal })
      const raw = await generateDocument({
        prompt: userPrompt,
        // 集成点：endpoint/key/model 可经环境变量注入（dev 手测用）。
        // Vite 构建注入 import.meta.env.VITE_*；Node/vitest 用 process.env.EZDOC_*。
        endpoint:
          import.meta.env.VITE_LLM_ENDPOINT || getEzdocEnv("EZDOC_LLM_ENDPOINT"),
        apiKey:
          import.meta.env.VITE_LLM_API_KEY || getEzdocEnv("EZDOC_API_KEY"),
        model:
          import.meta.env.VITE_LLM_MODEL || getEzdocEnv("EZDOC_LLM_MODEL"),
        signal: abortController.signal,
      })
      if (!raw || raw.trim().length === 0) throw new Error("LLM_EMPTY_RESULT")
      const parsed = parseLegalDoc(raw)
      // L3 标点/文字规范：先规范化所有文本字段，再走保守修复带
      // （repairDoc 只修 100% 确定的模式，每个修复返回一条 info 级说明）。
      const normalized = normalizeDoc(parsed)
      const { doc, repairs } = repairDoc(normalized)
      const markdown = toMarkdown(doc)
      if (!mountedRef.current) return null
      useDocStore.getState().setContent(markdown)
      useDocStore.getState().setTitle(doc.title)
      const nextIssues = [...repairsToIssues(repairs), ...reviewDocument(doc)]
      setResult(doc)
      setIssues(nextIssues)
      setStatus("done")
      return { markdown, title: doc.title }
    } catch (err) {
      if (!mountedRef.current) return null
      const code = extractErrorCode(err)
      // 用户主动取消（关闭对话框）：不显示错误文案，回到 idle。
      if (code === "LLM_ABORTED") {
        setStatus("idle")
        return null
      }
      setErrorCode(code)
      setStatus("error")
      return null
    } finally {
      abortRef.current = null
    }
  }, [docType, prompt, seal])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPrompt("")
    setDocType(DOC_TYPE_DEFAULT)
    setSeal(false)
    setStatus("idle")
    setErrorCode(null)
    setResult(null)
    setIssues([])
  }, [])

  return {
    prompt,
    setPrompt,
    docType,
    setDocType,
    seal,
    setSeal,
    status,
    errorCode,
    issues,
    result,
    generate,
    reset,
  }
}
