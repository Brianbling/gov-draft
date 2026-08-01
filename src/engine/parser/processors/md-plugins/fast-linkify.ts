import type { ParserConfig } from '../../../schema'
import type { MdPluginWithOptions } from '../../types'

const LINKIFY_TRIGGERS = ['.', ':', '/', '@']

function hasLinkifyTrigger(content: string): boolean {
  for (let i = 0; i < LINKIFY_TRIGGERS.length; i += 1) {
    if (content.indexOf(LINKIFY_TRIGGERS[i]!) >= 0) {
      return true
    }
  }
  return false
}

export const fastLinkifyPlugin: MdPluginWithOptions<ParserConfig> = (md) => {
  type CoreRuleFn = Parameters<typeof md.core.ruler.at>[1]
  interface CoreRule {
    name: string
    fn: CoreRuleFn
  }
  interface RulerInternals {
    __rules__: CoreRule[]
  }

  const rules = (md.core.ruler as unknown as RulerInternals).__rules__
  const linkifyRule = rules.find((rule) => rule.name === 'linkify')
  if (!linkifyRule || typeof linkifyRule.fn !== 'function') {
    return
  }

  const originalLinkify = linkifyRule.fn

  md.core.ruler.at('linkify', (state) => {
    if (!state.md.options.linkify) {
      return
    }

    let mayContainLink = false
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]
      if (token && token.type === 'inline' && hasLinkifyTrigger(token.content)) {
        mayContainLink = true
        break
      }
    }

    if (!mayContainLink) {
      return
    }

    return originalLinkify(state)
  })
}
