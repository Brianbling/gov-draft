import { describe, expect, it } from "vitest"
import {
  buildFormRequirement,
  validateFormRequired,
  hasFormValues,
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
