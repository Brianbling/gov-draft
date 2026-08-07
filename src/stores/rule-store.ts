import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { RuleConfig } from "@/engine"
import {
  compileRule,
  validateRule,
  getBuiltinRules,
  DEFAULT_HOST,
} from "@/engine"
import type { CompiledRule, ValidationResult, HostSelectors } from "@/engine"
import { RuleConfigSchema } from "@/engine/schema"
import { sanitizeCssValue } from "@/engine/utils/css-sanitize-utils"

const RULE_STORAGE_KEY = "ezdoc-rule"

const RESERVED_CUSTOM_STYLE_KEYS = new Set([
  "--page-margins-top",
  "--page-margins-right",
  "--page-margins-bottom",
  "--page-margins-left",
])

function normalizeCustomStyles(
  input: Record<string, string>
): Record<string, string> {
  return Object.entries(input).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const normalizedKey = key.startsWith("--") ? key : `--${key}`
      const normalizedValue = sanitizeCssValue(value)
      if (
        normalizedKey.length > 2 &&
        normalizedValue.length > 0 &&
        !RESERVED_CUSTOM_STYLE_KEYS.has(normalizedKey)
      ) {
        acc[normalizedKey] = normalizedValue
      }
      return acc
    },
    {}
  )
}

/**
 * Where the current rule came from.
 *
 * `builtin` means it is byte-identical to a shipped builtin rule, so a newer
 * app version may safely refresh it from the updated YAML. `custom` means the
 * user edited it (or authored it), and it must survive rehydration untouched.
 */
export type RuleOrigin = "builtin" | "custom"

/**
 * `getBuiltinRules()` re-parses every builtin YAML on each call, and `loadRule`
 * needs the list to classify origin — memoize it for the session.
 */
let builtinCache: RuleConfig[] | null = null

function builtinRules(): RuleConfig[] {
  builtinCache ??= getBuiltinRules()
  return builtinCache
}

/** Byte-compare against the shipped builtins to classify a rule's origin. */
function classifyOrigin(rule: RuleConfig): RuleOrigin {
  const serialized = JSON.stringify(rule)
  return builtinRules().some((r) => JSON.stringify(r) === serialized)
    ? "builtin"
    : "custom"
}

interface RuleState {
  currentRule: RuleConfig | null
  ruleOrigin: RuleOrigin | null
  availableRules: RuleConfig[]
  compiledRule: CompiledRule | null
  customStyles: Record<string, string>
  host: HostSelectors

  loadRule: (rule: RuleConfig) => void
  saveRule: (rule: RuleConfig) => ValidationResult
  setCustomStyle: (key: string, value: string) => void
  resetCustomStyles: () => void
  initializeRule: () => void

  getCssVariables: () => Record<string, string>
  getRuleCssText: () => string
}

export const useRuleStore = create<RuleState>()(
  persist(
    (set, get) => ({
      currentRule: null,
      ruleOrigin: null,
      availableRules: [],
      compiledRule: null,
      customStyles: {},
      host: DEFAULT_HOST,

      loadRule(rule) {
        const validation = validateRule(rule)
        if (!validation.valid) {
          throw new Error(`Invalid rule: ${validation.errors.join(", ")}`)
        }
        const compiled = compileRule(rule, get().host)
        set({
          currentRule: rule,
          compiledRule: compiled,
          ruleOrigin: classifyOrigin(rule),
        })
      },

      saveRule(rule) {
        const validation = validateRule(rule)
        if (!validation.valid) {
          throw new Error(`Invalid rule: ${validation.errors.join(", ")}`)
        }
        // Persistence only fires when `set` is called below, which happens
        // solely for the current rule. Saving a non-current rule validates
        // but does NOT persist.
        const current = get().currentRule
        if (current && current.name === rule.name) {
          const compiled = compileRule(rule, get().host)
          set({
            currentRule: rule,
            compiledRule: compiled,
            ruleOrigin: classifyOrigin(rule),
          })
        }
        return validation
      },

      setCustomStyle(key, value) {
        const normalizedKey = key.startsWith("--") ? key : `--${key}`
        if (RESERVED_CUSTOM_STYLE_KEYS.has(normalizedKey)) {
          const styles = { ...get().customStyles }
          delete styles[key]
          delete styles[normalizedKey]
          set({ customStyles: styles })
          return
        }
        set((s) => ({ customStyles: { ...s.customStyles, [key]: value } }))
      },

      resetCustomStyles() {
        set({ customStyles: {} })
      },

      initializeRule() {
        const builtin = builtinRules()
        set({ availableRules: builtin })

        const saved = get().currentRule
        if (!saved) {
          if (builtin.length > 0) {
            get().loadRule(builtin[0]!)
          }
          return
        }

        try {
          // Zustand persist rehydrates from localStorage with no schema
          // validation, so re-validate before use and fall back to a builtin
          // rule if the persisted value is corrupted or stale.
          const parsed = RuleConfigSchema.safeParse(saved)
          if (!parsed.success) {
            if (builtin.length > 0) {
              get().loadRule(builtin[0]!)
            }
            return
          }
          // A rule the user edited must survive rehydration as-is. Only a rule
          // still identical to a builtin (or one persisted before `ruleOrigin`
          // existed) may be refreshed from a newer builtin of the same name.
          if (get().ruleOrigin === "custom") {
            get().loadRule(saved)
            return
          }
          const builtinMatch = builtin.find((r) => r.name === saved.name)
          if (
            builtinMatch &&
            JSON.stringify(saved) !== JSON.stringify(builtinMatch)
          ) {
            get().loadRule(builtinMatch)
          } else {
            get().loadRule(saved)
          }
        } catch (error) {
          // A persisted value that survives zod (e.g. a unitless number in a
          // CSS-length field) can still be rejected by validateRule — never let
          // that throw out of initialization and white-screen the app. Clear
          // the poisoned value so the next launch does not read it again, and
          // fall back to a builtin rule.
          console.error("[rule-store] Invalid persisted rule, resetting:", error)
          set({ currentRule: null, ruleOrigin: null, customStyles: {} })
          if (builtin.length > 0) {
            get().loadRule(builtin[0]!)
          }
        }
      },

      getCssVariables() {
        const compiled = get().compiledRule
        if (!compiled) return {}
        return {
          ...compiled.tokens,
          ...normalizeCustomStyles(get().customStyles),
        }
      },

      getRuleCssText() {
        const compiled = get().compiledRule
        if (!compiled) return ""
        const customLines = Object.entries(
          normalizeCustomStyles(get().customStyles)
        ).map(([key, value]) => `  ${key}: ${value};`)
        if (customLines.length === 0) return compiled.cssText
        return `${compiled.cssText}\n\n:root {\n${customLines.join("\n")}\n}`
      },
    }),
    {
      name: RULE_STORAGE_KEY,
      partialize: (state) => ({
        currentRule: state.currentRule,
        ruleOrigin: state.ruleOrigin,
        customStyles: state.customStyles,
      }),
    }
  )
)
