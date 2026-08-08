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
import { toast } from "@/components/ui/toast"
import i18n from "@/locales"

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
        // persist 只持久化 currentRule（单规则模型），保存非当前规则时
        // 校验通过但不会落盘——若静默返回成功，调用方会以为配置已保存
        // 而实际丢失。返回失败 + 说明 issue，让调用方明确知道没有持久化。
        const current = get().currentRule
        if (current && current.name === rule.name) {
          const compiled = compileRule(rule, get().host)
          set({
            currentRule: rule,
            compiledRule: compiled,
            ruleOrigin: classifyOrigin(rule),
          })
          return validation
        }
        return {
          valid: false,
          errors: [
            `Rule "${rule.name}" is not the current rule; it was not persisted`,
          ],
          issues: [
            ...validation.issues,
            {
              level: 'error',
              path: 'rule',
              code: 'MISSING_OR_INVALID_FIELD',
              message: `Rule "${rule.name}" is not the current rule; it was not persisted`,
            },
          ],
        }
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

        // zod 失败（如 weight:""）与 validateRule 失败（如单位数字）两条路径
        // 都会静默重置用户配置。统一走 recover：备份损坏 JSON 供用户找回，
        // 回退内置规则，并弹 toast 明确告知，避免"设置莫名没了"。
        const recover = (reason: unknown) => {
          console.error("[rule-store] Invalid persisted rule, resetting:", reason)
          // 保留损坏的原始 JSON（localStorage key "ezdoc-rule-poisoned"）：
          // 用户可据规则名在文本里找回丢失的标题层级/字体配置，便于手工重建。
          try {
            const persisted = window.localStorage.getItem(RULE_STORAGE_KEY)
            if (persisted) {
              window.localStorage.setItem(
                RULE_STORAGE_KEY + "-poisoned",
                persisted
              )
            }
          } catch {
            // localStorage 满/禁用时忽略，不因保留失败阻塞启动
          }
          const fallbackName = builtin[0]?.name ?? ""
          set({ currentRule: null, ruleOrigin: null, customStyles: {} })
          if (builtin.length > 0) {
            get().loadRule(builtin[0]!)
          }
          // toast 模块级 store 不依赖 React 树，启动期可用；i18n 全局实例已就绪。
          toast.error(
            i18n.t("settings.ruleResetTitle") +
              " " +
              i18n.t("settings.ruleResetMessage", { name: fallbackName })
          )
        }

        try {
          // Zustand persist rehydrates from localStorage with no schema
          // validation, so re-validate before use and fall back to a builtin
          // rule if the persisted value is corrupted or stale.
          const parsed = RuleConfigSchema.safeParse(saved)
          if (!parsed.success) {
            recover(new Error(`zod validation failed: ${parsed.error.message}`))
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
          // that throw out of initialization and white-screen the app.
          recover(error)
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
