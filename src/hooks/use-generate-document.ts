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
import {
  buildFormRequirement,
  validateFormRequired,
  hasFormValues,
  docToFormValues,
  applyFormValuesToDoc,
  type FormValues,
} from "@/lib/legal-doc/form-adaptor"
import { DOC_TYPE_SPECS } from "@/lib/legal-doc/doc-type-spec"

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
  // 表单辅助模式：按文种 formFields 填写的结构化要素。未触碰时保持 undefined，
  // 生成的 prompt 约束只包含用户确实填过的字段。
  const [formValues, setFormValues] = useState<FormValues>({})
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
    // 表单必填校验：仅在用户实际填写了表单时强制（纯自然语言路径不设门槛，
    // title/主送机关等交由 LLM 从描述推断，与 v1 行为一致）。
    if (hasFormValues(formValues)) {
      const missing = validateFormRequired(docType, formValues)
      if (missing.length > 0) {
        setStatus("error")
        setErrorCode(`FORM_REQUIRED_${docType.toUpperCase()}`)
        return null
      }
    }
    const abortController = new AbortController()
    abortRef.current = abortController
    setStatus("generating")
    setErrorCode(null)
    setResult(null)
    setIssues([])
    try {
      const formRequirement = buildFormRequirement(docType, formValues)
      // 表单值（硬约束）拼在自然语言描述之后；formRequirement 为空时与纯自然语言路径行为一致。
      const mergedPrompt = formRequirement
        ? `${docType}\n${prompt}\n${formRequirement}`
        : `${docType}\n${prompt}`
      // 用户显式勾选盖章 → 覆盖文种默认；未触碰（undefined）→ 沿用 sealDefault。
      const effectiveSeal = formValues.seal ?? DOC_TYPE_SPECS[docType].sealDefault
      const userPrompt = buildUserPrompt(mergedPrompt, { seal: effectiveSeal })
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
      // 生成成功后把 LegalDoc 拍平回 formValues：对话框的要素区从"生成前约束表单"
      // 切换为"生成后编辑面板"，初值即 AI 实际产出，用户可直接改。
      setFormValues(docToFormValues(doc))
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
  }, [docType, prompt, formValues])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPrompt("")
    setDocType(DOC_TYPE_DEFAULT)
    setFormValues({})
    setStatus("idle")
    setErrorCode(null)
    setResult(null)
    setIssues([])
  }, [])

  /**
   * 要素编辑面板的回填入口（#29）：把面板的 FormValues 应用到最近一次生成的 LegalDoc，
   * 重新跑 toMarkdown 实时回填编辑器。面板只编辑已生成文档的要素子集，不改正文，
   * 因此无需再走 LLM；正文若被用户在编辑器里改过，这里只重建要素区，其余 markdown
   * 由编辑器持有不受影响。返回 null 表示无可编辑结果（尚未生成成功过）。
   * 不回写 formValues：面板的输入状态由 Input 自身维护，若这里按 result 拍平回写，
   * 会在每次击键后把用户正在输入的值重排（trim/分隔符拆分），造成光标跳动。
   */
  const applyEdit = useCallback(
    (values: FormValues): string | null => {
      if (!result) return null
      const next = applyFormValuesToDoc(result, values)
      const markdown = toMarkdown(next)
      useDocStore.getState().setContent(markdown)
      useDocStore.getState().setTitle(next.title)
      setResult(next)
      // 要素改动可能消除/引入格式问题（如修正文号消除 DOC_NUMBER_YEAR_MISSING），
      // 用编辑后的 doc 重跑一遍格式自检，让"格式自检"面板与所见一致。
      setIssues(reviewDocument(next))
      return markdown
    },
    [result],
  )

  return {
    prompt,
    setPrompt,
    docType,
    setDocType,
    formValues,
    setFormValues,
    status,
    errorCode,
    issues,
    result,
    generate,
    applyEdit,
    reset,
  }
}
