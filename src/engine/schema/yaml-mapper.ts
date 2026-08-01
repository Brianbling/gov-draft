import { parse } from 'yaml'
import { z } from 'zod'
import { RuleConfigSchema } from './index'
import type { RuleConfig } from './index'

export class RuleParseError extends Error {
  readonly zodError?: z.ZodError
  readonly parseError?: unknown

  constructor(message: string, zodError?: z.ZodError, cause?: unknown) {
    super(message)
    this.name = 'RuleParseError'
    this.zodError = zodError
    this.parseError = cause
  }
}

function parseYamlSafe(text: string, label: string): unknown {
  try {
    return parse(text)
  } catch (e) {
    throw new RuleParseError(`Failed to parse ${label} YAML`, undefined, e)
  }
}

export function parseRuleYaml(yamlText: string): RuleConfig {
  const raw = parseYamlSafe(yamlText, 'rule')
  const result = RuleConfigSchema.safeParse(raw)
  if (!result.success) {
    throw new RuleParseError('Rule YAML validation failed', result.error)
  }
  return result.data
}

export function parseRuleYamlSafe(
  yamlText: string,
): { success: true; data: RuleConfig } | { success: false; error: RuleParseError } {
  try {
    return { success: true, data: parseRuleYaml(yamlText) }
  } catch (e) {
    return {
      success: false,
      error: e instanceof RuleParseError ? e : new RuleParseError('Unknown parse error', undefined, e as unknown),
    }
  }
}
