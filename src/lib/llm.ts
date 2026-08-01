import { isTauri, trackedInvoke } from "./tauri"

export const DEFAULT_MODEL = "deepseek-v4-flash"
export const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions"
const REQUEST_TIMEOUT_MS = 120_000
const MAX_CONTENT_CHARS = 50_000

export interface GenerateRequest {
  prompt: string
  apiKey?: string
  model?: string
  endpoint?: string
  signal?: AbortSignal
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError"
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError"
}

/**
 * 合并「外部取消信号 + 超时」的 AbortSignal。不用 AbortSignal.timeout：
 * 旧 WebView2/浏览器未实现时抛 TypeError，会被下面的 catch 误判为网络错误。
 * 用 AbortController + setTimeout 兜底，兼容面更宽。
 */
function createAbortSignal(
  external?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(
      new DOMException("The request timed out", "TimeoutError"),
    )
  }, REQUEST_TIMEOUT_MS)

  const onExternalAbort = () => controller.abort()
  if (external) {
    if (external.aborted) {
      controller.abort()
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true })
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId)
      external?.removeEventListener("abort", onExternalAbort)
    },
  }
}

export async function generateDocument(request: GenerateRequest): Promise<string> {
  const model = request.model ?? DEFAULT_MODEL
  const endpoint = request.endpoint ?? DEFAULT_ENDPOINT

  if (isTauri()) {
    // invoke 不能序列化 AbortSignal；取消在 Rust 侧由 120s 超时兜底，
    // 前端靠 mounted 守卫保证关闭后不写 store。这里只做已中止的前置短路。
    if (request.signal?.aborted) throw "LLM_ABORTED"
    return trackedInvoke<string>("generate_document", {
      prompt: request.prompt,
      apiKey: request.apiKey,
      model,
      endpoint,
    })
  }

  // 浏览器模式:key 会暴露在前端,仅 dev 用。生产走 Tauri 侧。
  const apiKey = request.apiKey
  if (!apiKey || apiKey.trim().length === 0) {
    throw "LLM_NO_API_KEY"
  }

  const { signal, cleanup } = createAbortSignal(request.signal)

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a professional government document writer. Respond only with a valid JSON object.",
          },
          { role: "user", content: request.prompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal,
    })
  } catch (err) {
    cleanup()
    if (isAbortError(err)) throw "LLM_ABORTED"
    if (isTimeoutError(err)) throw "LLM_TIMEOUT"
    throw "LLM_NETWORK_ERROR"
  }

  if (!response.ok) {
    cleanup()
    throw `LLM_HTTP_${response.status}`
  }

  let data: ChatCompletionResponse
  try {
    data = (await response.json()) as ChatCompletionResponse
  } catch (err) {
    cleanup()
    if (isTimeoutError(err)) throw "LLM_TIMEOUT"
    if (isAbortError(err)) throw "LLM_ABORTED"
    throw "LLM_INVALID_RESPONSE"
  }
  cleanup()

  const content = data.choices?.[0]?.message?.content
  if (!content || content.trim().length === 0) {
    throw "LLM_INVALID_RESPONSE"
  }
  if (content.length > MAX_CONTENT_CHARS) {
    throw "LLM_INVALID_RESPONSE"
  }

  return content
}
