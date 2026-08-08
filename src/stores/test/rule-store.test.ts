import { describe, it, expect, beforeEach } from "vitest"
import { getBuiltinRules, validateRule } from "@/engine"
import { RuleConfigSchema } from "@/engine/schema"
import type { RuleConfig } from "@/engine/schema"

// The jsdom environment here exposes no localStorage, and zustand-persist reads
// it while the store module is evaluated. Install a minimal in-memory shim
// before importing the store (hence the dynamic import below).
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

const { useRuleStore } = await import("../rule-store")

/**
 * `initializeRule()` refreshes a pristine builtin rule from the shipped YAML so
 * app upgrades reach existing users — but it must never do that to a rule the
 * user edited.
 */
describe("rule-store initializeRule", () => {
  beforeEach(() => {
    useRuleStore.setState({
      currentRule: null,
      ruleOrigin: null,
      availableRules: [],
      compiledRule: null,
      customStyles: {},
    })
  })

  it("loads the first builtin when nothing is persisted", () => {
    useRuleStore.getState().initializeRule()

    const builtin = getBuiltinRules()[0]!
    expect(useRuleStore.getState().currentRule?.name).toBe(builtin.name)
    expect(useRuleStore.getState().ruleOrigin).toBe("builtin")
  })

  it("marks an edited rule as custom on load", () => {
    const edited = structuredClone(getBuiltinRules()[0]!)
    edited.content.body.style.size = "18pt"

    useRuleStore.getState().loadRule(edited)

    expect(useRuleStore.getState().ruleOrigin).toBe("custom")
  })

  it("keeps a user-edited rule across initializeRule", () => {
    const edited = structuredClone(getBuiltinRules()[0]!)
    edited.content.body.style.size = "18pt"
    useRuleStore.getState().loadRule(edited)

    useRuleStore.getState().initializeRule()

    expect(useRuleStore.getState().currentRule?.content.body.style.size).toBe(
      "18pt"
    )
    expect(useRuleStore.getState().ruleOrigin).toBe("custom")
  })

  it("refreshes a pristine builtin that drifted from the shipped version", () => {
    // Simulates state persisted by an older app version: same name, stale body,
    // and no `ruleOrigin` recorded.
    const stale = structuredClone(getBuiltinRules()[0]!)
    stale.content.body.style.size = "13pt"
    useRuleStore.setState({ currentRule: stale, ruleOrigin: "builtin" })

    useRuleStore.getState().initializeRule()

    const shipped = getBuiltinRules()[0]!
    expect(useRuleStore.getState().currentRule?.content.body.style.size).toBe(
      shipped.content.body.style.size
    )
  })

  it("falls back to a builtin and clears the poisoned value when a zod-valid persisted rule fails validateRule", () => {
    // A persisted config can pass RuleConfigSchema (zod silently normalizes a
    // unitless number in a CSS-length field to its string form) yet still be
    // rejected by the compiler's validateRule — which used to throw straight out
    // of initializeRule and white-screen the app. Assert it no longer throws,
    // falls back to a builtin, and drops the bad value so the next launch does
    // not read it again.
    const poisoned = JSON.parse(
      JSON.stringify(getBuiltinRules()[0]!),
    ) as RuleConfig
    // JSON 往返剥掉类型层，把非法值塞进运行时数据（TS 静态类型不允许，但
    // 这正是要测的"持久化坏配置"场景——zustand persist 反序列化不校验类型）。
    ;(poisoned.content.body.style as { size: unknown }).size = 16

    // Sanity: this is precisely the zod-passes/validateRule-fails divergence.
    expect(RuleConfigSchema.safeParse(poisoned).success).toBe(true)
    expect(validateRule(poisoned).valid).toBe(false)

    useRuleStore.setState({ currentRule: poisoned, ruleOrigin: "custom" })

    expect(() => useRuleStore.getState().initializeRule()).not.toThrow()

    const builtin = getBuiltinRules()[0]!
    expect(useRuleStore.getState().currentRule?.name).toBe(builtin.name)
    expect(useRuleStore.getState().ruleOrigin).toBe("builtin")
    expect(useRuleStore.getState().currentRule?.content.body.style.size).toBe(
      builtin.content.body.style.size
    )
    // The poisoned value is cleared, not re-persisted.
    expect(useRuleStore.getState().currentRule?.content.body.style.size).not.toBe(
      16
    )
  })

  it("does not throw and falls back when the persisted value is zod-invalid (e.g. weight: '')", () => {
    // The localStorage-corruption case from the bug report: a config that even
    // RuleConfigSchema rejects. initializeRule must not throw (it used to be
    // possible for loadRule to escape), and must drop the bad value for a builtin.
    const poisoned = JSON.parse(
      JSON.stringify(getBuiltinRules()[0]!),
    ) as RuleConfig
    ;(poisoned.content.body.style as { weight: unknown }).weight = ""
    useRuleStore.setState({ currentRule: poisoned, ruleOrigin: "custom" })

    expect(() => useRuleStore.getState().initializeRule()).not.toThrow()

    const builtin = getBuiltinRules()[0]!
    expect(useRuleStore.getState().currentRule?.name).toBe(builtin.name)
    expect(useRuleStore.getState().ruleOrigin).toBe("builtin")
    expect(useRuleStore.getState().currentRule?.content.body.style.weight).toBe(
      400
    )
  })

  it("preserves the poisoned persisted rule JSON in a -poisoned backup on reset", () => {    // 用户手动配置的标题层级/字体被静默清空是最痛的场景：reset 前把损坏的
    // 原始 JSON 备份到 "ezdoc-rule-poisoned"，用户可据此找回丢失的配置手工重建。
    const poisoned = JSON.parse(
      JSON.stringify(getBuiltinRules()[0]!),
    ) as RuleConfig
    ;(poisoned.content.body.style as { weight: unknown }).weight = ""
    ;(poisoned as unknown as { content: { body: { style: { size?: string } } } })
      .content.body.style.size = "18pt"

    // 真实场景：zustand persist 以 {state, version} 包装格式把损坏规则写进
    // localStorage "ezdoc-rule"（setState 触发 persist 自动落盘）。
    useRuleStore.setState({ currentRule: poisoned, ruleOrigin: "custom" })
    const persisted = window.localStorage.getItem("ezdoc-rule")
    expect(persisted).not.toBeNull()
    expect(JSON.parse(persisted!).state.currentRule.content.body.style.weight).toBe(
      ""
    )

    useRuleStore.getState().initializeRule()

    const backup = window.localStorage.getItem("ezdoc-rule-poisoned")
    expect(backup).not.toBeNull()
    // 备份保留了用户的 18pt 手工字号（重置后丢失的那部分配置）。
    const restored = JSON.parse(backup!).state.currentRule as RuleConfig
    expect((restored.content.body.style as { size: string }).size).toBe(
      "18pt"
    )
    // 当前规则已回退内置，不再是损坏值。
    const builtin = getBuiltinRules()[0]!
    expect(useRuleStore.getState().currentRule?.name).toBe(builtin.name)
  })
})

describe("rule-store saveRule（3.22 非当前规则不静默丢配置）", () => {
  beforeEach(() => {
    useRuleStore.setState({
      currentRule: null,
      ruleOrigin: null,
      availableRules: [],
      compiledRule: null,
      customStyles: {},
    })
  })

  it("保存当前规则 → 校验通过 + 持久化为 currentRule", () => {
    const rule = structuredClone(getBuiltinRules()[0]!)
    useRuleStore.getState().loadRule(rule)

    const edited = structuredClone(rule)
    edited.content.body.style.size = "18pt"
    const result = useRuleStore.getState().saveRule(edited)

    expect(result.valid).toBe(true)
    expect(useRuleStore.getState().currentRule?.content.body.style.size).toBe(
      "18pt"
    )
  })

  it("保存非当前规则 → 返回失败而非静默成功（不静默丢配置）", () => {
    const current = structuredClone(getBuiltinRules()[0]!)
    useRuleStore.getState().loadRule(current)

    // 另一条内置规则（name 不同）被误当"当前规则"保存
    const other = structuredClone(getBuiltinRules()[1] ?? getBuiltinRules()[0]!)
    const result = useRuleStore.getState().saveRule(other)

    expect(result.valid).toBe(false)
    expect(result.errors.join("")).toContain("not the current rule")
    // 当前规则未被意外替换，配置没有丢失
    expect(useRuleStore.getState().currentRule?.name).toBe(current.name)
  })
})
