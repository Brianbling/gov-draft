import type { RuleConfig } from '../schema/index'
import { parseRuleYaml, RuleParseError } from '../schema/yaml-mapper'
import gbT33476YamlText from './gb-t-33476.yaml?raw'
import gbT9704YamlText from './gb-t-9704.yaml?raw'

const BUILTIN_RULE_SOURCES: Array<{ yaml: string; label: string }> = [
  { yaml: gbT33476YamlText, label: 'GB/T 33476-2016' },
  { yaml: gbT9704YamlText, label: 'GB/T 9704-2012' },
]

export function getBuiltinRules(): RuleConfig[] {
  const rules: RuleConfig[] = []

  for (const source of BUILTIN_RULE_SOURCES) {
    try {
      rules.push(parseRuleYaml(source.yaml))
    } catch (e) {
      const detail = e instanceof RuleParseError ? e.zodError?.message ?? e.message : String(e)
      console.error(`[builtin-rules] Failed to load ${source.label}:`, detail)
    }
  }

  return rules
}
