import { describe, expect, it } from "vitest"
import {
  buildFormRequirement,
  validateFormRequired,
  hasFormValues,
  docToFormValues,
  applyFormValuesToDoc,
  type FormValues,
} from "../form-adaptor"
import { DOC_TYPE_SPECS } from "../doc-type-spec"

describe("buildFormRequirement", () => {
  it("无表单值时不追加任何约束（保持纯自然语言路径行为）", () => {
    expect(buildFormRequirement("gongwen", {})).toBe("")
    expect(
      buildFormRequirement("gongwen", { date: "  " })
    ).toBe("")
  })

  it("填入单值要素时按‘要素=值’拼接进一句话约束", () => {
    const req = buildFormRequirement("request", {
      recipient: "省人民政府",
      docNumber: "×政发〔2026〕5号",
    })
    expect(req).toContain("已确定的公文要素")
    expect(req).toContain("主送机关=省人民政府")
    expect(req).toContain("发文字号=×政发〔2026〕5号")
    expect(req).toContain("请严格按上述要素生成")
  })

  it("未触碰盖章开关时不写入 seal 约束（默认交给 sealDefault）", () => {
    const req = buildFormRequirement("request", { recipient: "省人民政府" })
    expect(req).not.toContain("seal=")
  })

  it("显式勾选盖章时写入 seal=true 约束", () => {
    const req = buildFormRequirement("request", {
      recipient: "省人民政府",
      seal: true,
    })
    expect(req).toContain("seal=true")
  })

  it("显式取消盖章时写入 seal=false 约束", () => {
    const req = buildFormRequirement("letter", {
      seal: false,
    })
    expect(req).toContain("seal=false")
  })

  it("公告文种不包含 recipient 要素，填写主送机关也会被忽略", () => {
    const req = buildFormRequirement("announcement", {
      recipient: "各区政府",
    })
    expect(req).toBe("")
  })

  it("minutes 文种的名单以顿号连接写入约束", () => {
    const req = buildFormRequirement("minutes", {
      attendees: ["张三（市委办）", "李四（市政府办）"],
      absentees: ["王五（市发改委）"],
    })
    expect(req).toContain("出席人员=张三（市委办）、李四（市政府办）")
    expect(req).toContain("请假人员=王五（市发改委）")
  })

  it("只使用该文种 formFields 定义过的字段", () => {
    // request 的 formFields 不含 cc/urgent，填写后不应出现在约束里
    const req = buildFormRequirement("request", {
      recipient: "省人民政府",
      cc: ["省办公厅"],
      urgency: "特急",
    })
    expect(req).not.toContain("抄送机关")
    expect(req).not.toContain("紧急程度")
  })
})

describe("validateFormRequired", () => {
  it("必填要素齐全时返回空数组", () => {
    const values: FormValues = {
      title: "关于解决办公设备不足问题的请示",
      recipient: "省人民政府",
    }
    expect(validateFormRequired("request", values)).toEqual([])
  })

  it("缺失必填要素时返回缺失的中文 label", () => {
    const missing = validateFormRequired("request", {})
    expect(missing).toContain("标题")
    expect(missing).toContain("主送机关")
  })

  it("minutes 的出席人员（array）必填", () => {
    expect(validateFormRequired("minutes", {})).toContain("出席人员")
    expect(
      validateFormRequired("minutes", {
        title: "全市安全生产工作会议纪要",
        attendees: ["张三（市委办）"],
      })
    ).toEqual([])
  })

  it("非必填要素不影响校验结果", () => {
    const missing = validateFormRequired("gongwen", {
      title: "关于举办培训班的通知",
    })
    // gongwen（default 分支）只有 title 必填
    expect(missing).toEqual([])
  })
})

describe("hasFormValues", () => {
  it("空表单为 false", () => {
    expect(hasFormValues({})).toBe(false)
  })

  it("任一要素非空即为 true", () => {
    expect(hasFormValues({ date: "2026-08-01" })).toBe(true)
    expect(hasFormValues({ attendees: ["张三（市委办）"] })).toBe(true)
  })

  it("仅显式取消盖章不算填写了表单", () => {
    expect(hasFormValues({ seal: false })).toBe(false)
  })
})

describe("formFields 与 sealDefault 覆盖全部文种", () => {
  it("每个文种都有 formFields 且 title 必填", () => {
    for (const docType of Object.keys(DOC_TYPE_SPECS) as Array<
      keyof typeof DOC_TYPE_SPECS
    >) {
      const fields = DOC_TYPE_SPECS[docType].formFields
      expect(fields.length).toBeGreaterThan(0)
      const title = fields.find((f) => f.key === "title")
      expect(title).toBeDefined()
      expect(title?.required).toBe(true)
    }
  })

  it("盖章默认按文种区分（决定/请示/批复/函为 true）", () => {
    expect(DOC_TYPE_SPECS.request.sealDefault).toBe(true)
    expect(DOC_TYPE_SPECS.reply.sealDefault).toBe(true)
    expect(DOC_TYPE_SPECS.decision.sealDefault).toBe(true)
    expect(DOC_TYPE_SPECS.letter.sealDefault).toBe(true)
    expect(DOC_TYPE_SPECS.announcement.sealDefault).toBe(false)
    expect(DOC_TYPE_SPECS.minutes.sealDefault).toBe(false)
  })
})

function buildDoc(overrides: Partial<import("../types").LegalDoc> = {}) {
  return {
    docType: "gongwen" as const,
    title: "关于推进垃圾分类工作的通知",
    body: [{ type: "p" as const, text: "正文" }],
    ...overrides,
  }
}

describe("docToFormValues · LegalDoc → 编辑面板 FormValues", () => {
  it("按该文种 formFields 拍平为 FormValues（array 转数组、boolean 转开关）", () => {
    const values = docToFormValues(
      buildDoc({
        docType: "gongwen",
        title: "关于推进垃圾分类工作的通知",
        docNumber: "国发〔2026〕12号",
        recipient: "各区人民政府：",
        issuer: "市人民政府",
        date: "2026-07-31",
        attachments: ["任务清单"],
        cc: ["市委办"],
        seal: true,
      }),
    )
    expect(values.title).toBe("关于推进垃圾分类工作的通知")
    expect(values.docNumber).toBe("国发〔2026〕12号")
    expect(values.recipient).toBe("各区人民政府：")
    expect(values.issuer).toBe("市人民政府")
    expect(values.date).toBe("2026-07-31")
    expect(values.attachments).toEqual(["任务清单"])
    expect(values.cc).toEqual(["市委办"])
    expect(values.seal).toBe(true)
  })

  it("缺失字段归一为 undefined/空占位（面板显示空，不残留脏值）", () => {
    const values = docToFormValues(buildDoc())
    expect(values.docNumber).toBe("")
    expect(values.attachments).toEqual([])
    expect(values.cc).toEqual([])
  })

  it("未盖章时 seal 归一为 false（开关双态可切换）", () => {
    const values = docToFormValues(buildDoc({ docType: "gongwen", seal: false }))
    expect(values.seal).toBe(false)
  })

  it("只拍平该文种 formFields 定义过的字段（纪要名单不混进普通通知）", () => {
    const values = docToFormValues(
      buildDoc({
        docType: "gongwen",
        attendees: ["张三（市委办）"],
        absentees: ["李四（市政府办）"],
      }),
    )
    // gongwen（default 分支）formFields 不含 attendees/absentees
    expect(values.attendees).toBeUndefined()
    expect(values.absentees).toBeUndefined()
  })

  it("minutes 文种拍平出席/请假/列席名单", () => {
    const values = docToFormValues(
      buildDoc({
        docType: "minutes",
        attendees: ["张三（市委办）"],
        absentees: ["李四（市政府办）"],
        observers: ["王五（列席）"],
        title: "会议纪要",
      }),
    )
    expect(values.attendees).toEqual(["张三（市委办）"])
    expect(values.absentees).toEqual(["李四（市政府办）"])
    expect(values.observers).toEqual(["王五（列席）"])
  })
})

describe("applyFormValuesToDoc · 编辑面板 FormValues → LegalDoc", () => {
  it("修改要素值后原样写回（浅拷贝，不改原 doc）", () => {
    const doc = buildDoc({
      docType: "gongwen",
      title: "原标题",
      docNumber: "国发〔2026〕12号",
      issuer: "市人民政府",
      date: "2026-07-31",
      seal: false,
    })
    const next = applyFormValuesToDoc(doc, {
      title: "新标题",
      docNumber: "国发〔2026〕13号",
      issuer: "市人民政府办公厅",
      date: "2026-08-01",
      seal: true,
    })
    expect(next).not.toBe(doc)
    expect(next.title).toBe("新标题")
    expect(next.docNumber).toBe("国发〔2026〕13号")
    expect(next.issuer).toBe("市人民政府办公厅")
    expect(next.date).toBe("2026-08-01")
    expect(next.seal).toBe(true)
    // 原对象不变
    expect(doc.title).toBe("原标题")
    expect(doc.seal).toBe(false)
  })

  it("只写该文种 formFields 定义过的字段，正文与版记保持原样", () => {
    const doc = buildDoc({
      docType: "gongwen",
      body: [{ type: "p", text: "正文内容" }],
      printingOffice: "国务院办公厅",
      printingDate: "2026-08-01",
    })
    const next = applyFormValuesToDoc(doc, { title: "新标题" })
    expect(next.title).toBe("新标题")
    // 正文/版记不在 formFields 子集内，面板编辑不触碰
    expect(next.body).toEqual([{ type: "p", text: "正文内容" }])
    expect(next.printingOffice).toBe("国务院办公厅")
    expect(next.printingDate).toBe("2026-08-01")
  })

  it("array 空数组 → undefined（IR 语义上无空壳字段）", () => {
    const doc = buildDoc({
      docType: "gongwen",
      attachments: ["任务清单"],
      cc: ["市委办"],
    })
    const next = applyFormValuesToDoc(doc, {
      attachments: [],
      cc: [],
    })
    expect(next.attachments).toBeUndefined()
    expect(next.cc).toBeUndefined()
  })

  it("text 空白串 → undefined（避免塞入纯空白要素）", () => {
    const doc = buildDoc({
      docType: "gongwen",
      docNumber: "国发〔2026〕12号",
    })
    const next = applyFormValuesToDoc(doc, { docNumber: "   " })
    expect(next.docNumber).toBeUndefined()
  })

  it("未触碰的字段保持原值（面板只提交被编辑的字段）", () => {
    const doc = buildDoc({
      docType: "gongwen",
      title: "原标题",
      docNumber: "国发〔2026〕12号",
    })
    const next = applyFormValuesToDoc(doc, { title: "新标题" })
    expect(next.docNumber).toBe("国发〔2026〕12号")
  })

  it("minutes 文种写回名单与盖章", () => {
    const doc = buildDoc({ docType: "minutes", title: "会议纪要" })
    const next = applyFormValuesToDoc(doc, {
      title: "全市安全生产工作会议纪要",
      attendees: ["张三（市委办）"],
      absentees: [],
      observers: ["王五（列席）"],
      seal: true,
    })
    expect(next.title).toBe("全市安全生产工作会议纪要")
    expect(next.attendees).toEqual(["张三（市委办）"])
    expect(next.absentees).toBeUndefined()
    expect(next.observers).toEqual(["王五（列席）"])
    expect(next.seal).toBe(true)
  })
})
