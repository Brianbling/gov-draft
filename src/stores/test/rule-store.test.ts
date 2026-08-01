import { describe, it, expect, beforeEach } from "vitest"
import { getBuiltinRules } from "@/engine"

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
})
