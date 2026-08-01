import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { compileRule, validateRule, getBuiltinRules, DEFAULT_HOST } from '@/engine'
import type { RuleConfig, HostSelectors, ValidationResult } from '@/engine'
import { ERROR_CODE_TO_I18N_KEY } from '@/lib/error-messages'

export function useRuleEngine(host: HostSelectors = DEFAULT_HOST) {
  const { t } = useTranslation()

  const validate = useCallback(
    (config: unknown): ValidationResult => {
      const result = validateRule(config)
      return {
        ...result,
        issues: result.issues.map((issue) => ({
          ...issue,
          message: t(ERROR_CODE_TO_I18N_KEY[issue.code], {
            path: issue.path,
            ...(issue.params as Record<string, unknown>),
          }),
        })),
        errors: result.issues
          .filter((i) => i.level === 'error')
          .map(
            (i) =>
              `${i.path}: ${t(ERROR_CODE_TO_I18N_KEY[i.code], {
                path: i.path,
                ...(i.params as Record<string, unknown>),
              })}`,
          ),
      }
    },
    [t],
  )

  const compile = useCallback((config: RuleConfig) => compileRule(config, host), [host])

  return { validate, compile, getBuiltinRules }
}
