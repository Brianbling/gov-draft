import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

// zustand persist 在模块求值期读取 localStorage；jsdom 无此实现，先装内存 shim。
if (typeof globalThis.localStorage === "undefined") {
  const backing = new Map<string, string>()
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
    },
  })
}

// mock generateDocument：不真实调 API，返回可注入的 LLM 输出。
vi.mock("@/lib/llm", () => ({
  generateDocument: vi.fn(),
  DEFAULT_MODEL: "gpt-4o-mini",
  DEFAULT_ENDPOINT: "https://api.openai.com/v1/chat/completions",
}))

const { generateDocument } = await import("@/lib/llm")
const { useGenerateDocument, resetGenerateSession } = await import(
  "@/hooks/use-generate-document"
)
const { useDocStore } = await import("@/stores/doc-store")

const mockGenerateDocument = vi.mocked(generateDocument)

const VALID_LLM_OUTPUT = JSON.stringify({
  docType: "gongwen",
  title: "关于推进垃圾分类工作的通知",
  recipient: "各区人民政府，市政府各委、办、局：",
  body: [
    {
      type: "p",
      text: "为深入推进垃圾分类工作，经市政府同意，现就有关工作通知如下。",
    },
  ],
  issuer: "市人民政府",
  date: "2026-07-31",
})

describe("useGenerateDocument 状态流", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDocStore.getState().reset()
    resetGenerateSession()
  })

  it("初始态 idle", () => {
    const { result } = renderHook(() => useGenerateDocument())
    expect(result.current.status).toBe("idle")
    expect(result.current.errorCode).toBeNull()
    expect(result.current.issues).toEqual([])
    expect(result.current.result).toBeNull()
  })

  it("输入描述 → 点生成 → loading → done → 写入 doc-store → 返回 issues", async () => {
    mockGenerateDocument.mockResolvedValue(VALID_LLM_OUTPUT)
    const { result } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("帮我写一份关于垃圾分类的通知"))

    let generatePromise: Promise<unknown> = Promise.resolve()
    act(() => {
      generatePromise = result.current.generate()
    })
    expect(result.current.status).toBe("generating")
    expect(mockGenerateDocument).toHaveBeenCalledOnce()

    const generateResult = await generatePromise
    await act(async () => {
      await generatePromise
    })

    expect(result.current.status).toBe("done")
    expect(result.current.errorCode).toBeNull()
    expect(result.current.issues).toEqual([])
    expect(result.current.result?.title).toBe("关于推进垃圾分类工作的通知")
    expect(generateResult).toEqual({
      markdown: expect.stringContaining("# 关于推进垃圾分类工作的通知"),
      title: "关于推进垃圾分类工作的通知",
    })

    // 写入 doc-store，供编辑器/预览消费
    const { content, title } = useDocStore.getState()
    expect(content).toContain("# 关于推进垃圾分类工作的通知")
    expect(content).toContain("为深入推进垃圾分类工作")
    expect(title).toBe("关于推进垃圾分类工作的通知")
  })

  it("LLM 返回非法 JSON → status=error，errorCode=LEGAL_DOC_PARSE_FAILED", async () => {
    mockGenerateDocument.mockResolvedValue("这不是 JSON")
    const { result } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    const ret = await promise
    await act(async () => {
      await promise
    })

    expect(result.current.status).toBe("error")
    expect(result.current.errorCode).toBe("LEGAL_DOC_PARSE_FAILED")
    expect(ret).toBeNull()
    // 失败时不应污染编辑器内容
    expect(useDocStore.getState().content).toBe("")
  })

  it("LLM 返回空串 → status=error，errorCode=LLM_EMPTY_RESULT", async () => {
    mockGenerateDocument.mockResolvedValue("")
    const { result } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await promise
    await act(async () => {
      await promise
    })

    expect(result.current.status).toBe("error")
    expect(result.current.errorCode).toBe("LLM_EMPTY_RESULT")
  })

  it("LLM 抛出字符串错误（如网络错误）→ 透传到 errorCode", async () => {
    mockGenerateDocument.mockRejectedValue("LLM_NETWORK_ERROR")
    const { result } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await promise
    await act(async () => {
      await promise
    })

    expect(result.current.status).toBe("error")
    expect(result.current.errorCode).toBe("LLM_NETWORK_ERROR")
  })

  it("generate 把 AbortSignal 透传给 generateDocument（供关闭时取消）", async () => {
    mockGenerateDocument.mockResolvedValue(VALID_LLM_OUTPUT)
    const { result } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await act(async () => {
      await promise
    })

    expect(mockGenerateDocument).toHaveBeenCalledOnce()
    const request = mockGenerateDocument.mock.calls[0][0] as {
      signal?: AbortSignal
    }
    expect(request.signal).toBeInstanceOf(AbortSignal)
  })

  it("生成中 reset → abort 在途请求 → 状态回 idle，不写 store", async () => {
    mockGenerateDocument.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject("LLM_ABORTED"))
        }),
    )
    const { result } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    expect(result.current.status).toBe("generating")

    act(() => result.current.reset())
    await act(async () => {
      await promise
    })

    expect(result.current.status).toBe("idle")
    expect(result.current.errorCode).toBeNull()
    expect(useDocStore.getState().content).toBe("")
  })

  it("卸载（关闭对话框）后 generate 完成不写 store、不 setState", async () => {
    let resolveFn!: (value: string) => void
    mockGenerateDocument.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve
        }),
    )
    const { result, unmount } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    expect(result.current.status).toBe("generating")

    // 关闭对话框 → 面板卸载 → cleanup 置 mounted=false 并 abort
    act(() => unmount())

    act(() => {
      resolveFn(VALID_LLM_OUTPUT)
    })
    await act(async () => {
      await promise
    })

    expect(useDocStore.getState().content).toBe("")
  })

  it("reset 清空状态与 store", async () => {
    mockGenerateDocument.mockResolvedValue(VALID_LLM_OUTPUT)
    const { result } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("帮我写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await promise
    await act(async () => {
      await promise
    })
    expect(result.current.status).toBe("done")

    act(() => result.current.reset())

    expect(result.current.status).toBe("idle")
    expect(result.current.prompt).toBe("")
    expect(result.current.errorCode).toBeNull()
    expect(result.current.issues).toEqual([])
    expect(result.current.result).toBeNull()
  })

  it("生成超长标题时 issues 含 TITLE_TOO_LONG（格式自检结果透出）", async () => {
    const longTitle = "关于进一步加强和完善新时代基层数字政府建设工作若干重大事项的通知"
    mockGenerateDocument.mockResolvedValue(
      JSON.stringify({
        docType: "gongwen",
        title: longTitle,
        body: [{ type: "p", text: "正文内容" }],
      })
    )
    const { result } = renderHook(() => useGenerateDocument())

    act(() => result.current.setPrompt("写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await promise
    await act(async () => {
      await promise
    })

    expect(result.current.status).toBe("done")
    expect(result.current.issues.map((i) => i.code)).toContain("TITLE_TOO_LONG")
    expect(useDocStore.getState().title).toBe(longTitle)
  })
})

describe("useGenerateDocument · 表单辅助路径", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDocStore.getState().reset()
    resetGenerateSession()
  })

  it("填写表单要素 → prompt 追加表单约束 → 生成成功", async () => {
    mockGenerateDocument.mockResolvedValue(VALID_LLM_OUTPUT)
    const { result } = renderHook(() => useGenerateDocument())

    act(() => {
      result.current.setFormValues({
        title: "关于推进垃圾分类工作的通知",
        recipient: "各区人民政府",
      })
    })

    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await promise
    await act(async () => {
      await promise
    })

    expect(result.current.status).toBe("done")
    const sentPrompt = mockGenerateDocument.mock.calls[0][0].prompt as string
    expect(sentPrompt).toContain("已确定的公文要素")
    expect(sentPrompt).toContain("标题=关于推进垃圾分类工作的通知")
    expect(sentPrompt).toContain("主送机关=各区人民政府")
  })

  it("表单已填写但缺必填要素 → status=error，errorCode=FORM_REQUIRED_*，不调 LLM", async () => {
    const { result } = renderHook(() => useGenerateDocument())

    // request 的标题/主送机关必填；填了标题但缺主送机关 → 拦截
    act(() => {
      result.current.setDocType("request")
      result.current.setFormValues({ title: "关于购置办公设备的请示" })
    })
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await act(async () => {
      await promise
    })

    expect(result.current.status).toBe("error")
    expect(result.current.errorCode).toBe("FORM_REQUIRED_REQUEST")
    expect(mockGenerateDocument).not.toHaveBeenCalled()
  })

  it("request 未触碰盖章 → 沿用 sealDefault=true，prompt 含盖章要求", async () => {
    mockGenerateDocument.mockResolvedValue(VALID_LLM_OUTPUT)
    const { result } = renderHook(() => useGenerateDocument())

    act(() => {
      result.current.setDocType("request")
      result.current.setFormValues({
        title: "关于购置办公设备的请示",
        recipient: "省人民政府",
      })
    })
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await promise
    await act(async () => {
      await promise
    })

    const sentPrompt = mockGenerateDocument.mock.calls[0][0].prompt as string
    expect(sentPrompt).toContain("该公文需要加盖公章")
  })

  it("显式取消盖章 → 覆盖文种默认，prompt 不含盖章要求", async () => {
    mockGenerateDocument.mockResolvedValue(VALID_LLM_OUTPUT)
    const { result } = renderHook(() => useGenerateDocument())

    act(() => {
      result.current.setDocType("request")
      result.current.setFormValues({
        title: "关于购置办公设备的请示",
        recipient: "省人民政府",
        seal: false,
      })
    })
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await promise
    await act(async () => {
      await promise
    })

    const sentPrompt = mockGenerateDocument.mock.calls[0][0].prompt as string
    expect(sentPrompt).not.toContain("该公文需要加盖公章")
    expect(sentPrompt).toContain("seal=false")
  })

  it("reset 清空表单值", async () => {
    const { result } = renderHook(() => useGenerateDocument())
    act(() => result.current.setFormValues({ recipient: "省人民政府" }))
    expect(result.current.formValues).toEqual({ recipient: "省人民政府" })

    act(() => result.current.reset())
    expect(result.current.formValues).toEqual({})
  })
})

describe("useGenerateDocument · applyEdit 要素编辑回填（#29）", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDocStore.getState().reset()
    resetGenerateSession()
  })

  async function generateOnce(): Promise<{
    result: { current: ReturnType<typeof useGenerateDocument> }
  }> {
    mockGenerateDocument.mockResolvedValue(VALID_LLM_OUTPUT)
    const { result } = renderHook(() => useGenerateDocument())
    act(() => result.current.setPrompt("帮我写一份关于垃圾分类的通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await act(async () => {
      await promise
    })
    return { result }
  }

  it("生成成功后 formValues 拍平为 AI 实际产出（编辑面板初值）", async () => {
    const { result } = await generateOnce()
    expect(result.current.formValues.title).toBe("关于推进垃圾分类工作的通知")
    expect(result.current.formValues.recipient).toBe("各区人民政府，市政府各委、办、局：")
    expect(result.current.formValues.issuer).toBe("市人民政府")
    expect(result.current.formValues.date).toBe("2026-07-31")
  })

  it("applyEdit 修改要素 → 实时回填编辑器 markdown 并返回新 markdown", async () => {
    const { result } = await generateOnce()
    let returned = ""
    act(() => {
      returned =
        result.current.applyEdit({ title: "新标题", recipient: "各区人民政府" }) ??
        ""
    })
    expect(returned).toContain("# 新标题")
    expect(returned).toContain("各区人民政府")
    const { content, title } = useDocStore.getState()
    expect(content).toContain("# 新标题")
    expect(title).toBe("新标题")
    // result 同步为编辑后的 doc（applyEdit 触发的重渲染已更新 result.current）
    expect(result.current.result?.title).toBe("新标题")
  })

  it("applyEdit 未生成过时返回 null（无可编辑对象）", () => {
    const { result } = renderHook(() => useGenerateDocument())
    let returned: string | null = "sentinel"
    act(() => {
      returned = result.current.applyEdit({ title: "新标题" })
    })
    expect(returned).toBeNull()
    expect(useDocStore.getState().content).toBe("")
  })

  it("applyEdit 用编辑后的 doc 重跑格式自检（修正文号消除 DOC_NUMBER_YEAR_MISSING）", async () => {
    mockGenerateDocument.mockResolvedValue(
      JSON.stringify({
        docType: "gongwen",
        title: "关于推进垃圾分类工作的通知",
        docNumber: "国发12号",
        body: [{ type: "p", text: "正文" }],
      }),
    )
    const { result } = renderHook(() => useGenerateDocument())
    act(() => result.current.setPrompt("帮我写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = result.current.generate()
    })
    await act(async () => {
      await promise
    })
    // 生成成功且含 DOC_NUMBER_YEAR_MISSING（文号缺〔年份〕）
    expect(result.current.issues.map((i) => i.code)).toContain(
      "DOC_NUMBER_YEAR_MISSING",
    )
    act(() => {
      result.current.applyEdit({ title: "新标题", docNumber: "国发〔2026〕12号" })
    })
    expect(result.current.issues.map((i) => i.code)).not.toContain(
      "DOC_NUMBER_YEAR_MISSING",
    )
  })

  it("3.7 关窗重开：从模块级恢复上次生成结果，可直接续编（不丢 issues）", async () => {
    mockGenerateDocument.mockResolvedValue(
      JSON.stringify({
        docType: "gongwen",
        title: "关于推进垃圾分类工作的通知",
        docNumber: "国发12号",
        body: [{ type: "p", text: "正文" }],
      }),
    )
    // 第一次挂载：生成成功，写入模块级 lastResult/lastIssues
    const first = renderHook(() => useGenerateDocument())
    act(() => first.result.current.setPrompt("帮我写一份通知"))
    let promise: Promise<unknown> = Promise.resolve()
    act(() => {
      promise = first.result.current.generate()
    })
    await act(async () => {
      await promise
    })
    expect(first.result.current.status).toBe("done")
    expect(first.result.current.issues.map((i) => i.code)).toContain(
      "DOC_NUMBER_YEAR_MISSING",
    )
    // 卸载组件（等价关闭弹窗）：组件 state 全丢，但模块级保留
    first.unmount()

    // 第二次挂载（等价重开弹窗）：从模块级恢复 done 态 + 上次结果 + issues
    const second = renderHook(() => useGenerateDocument())
    expect(second.result.current.status).toBe("done")
    expect(second.result.current.result?.title).toBe(
      "关于推进垃圾分类工作的通知",
    )
    expect(second.result.current.issues.map((i) => i.code)).toContain(
      "DOC_NUMBER_YEAR_MISSING",
    )
    // 续编：直接改文号，格式自检跟着更新
    act(() => {
      second.result.current.applyEdit({
        title: "关于推进垃圾分类工作的通知",
        docNumber: "国发〔2026〕12号",
      })
    })
    expect(second.result.current.issues.map((i) => i.code)).not.toContain(
      "DOC_NUMBER_YEAR_MISSING",
    )
  })
})
