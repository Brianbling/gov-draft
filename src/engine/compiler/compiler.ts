import type { RuleConfig } from '../schema'
import type { CompiledRule, HostSelectors, StyleNode } from './types'
import { generateRuleTokens } from './token-generator'
import { buildRootRule } from './rule-builders/root-builder'
import { buildBodyRules } from './rule-builders/body-builder'
import { buildHeadingRules } from './rule-builders/heading-builder'
import { buildPageRule } from './rule-builders/page-builder'
import { buildPrintRules } from './rule-builders/print-builder'
import { serializeStyleSheet } from './serializer'

export function compileRule(config: RuleConfig, host: HostSelectors): CompiledRule {
  const tokens = generateRuleTokens(config)
  const rules: StyleNode[] = [
    ...buildRootRule(tokens),
    ...buildBodyRules(config, host),
    ...buildHeadingRules(config, host),
    ...buildPageRule(config),
    ...buildPrintRules(config, host)
  ]
  const cssText = serializeStyleSheet(rules)

  return {
    tokens,
    rules,
    cssText
  }
}
