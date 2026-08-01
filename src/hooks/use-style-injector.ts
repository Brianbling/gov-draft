import { useEffect, useId } from 'react'
import { useRuleStore } from '@/stores/rule-store'

const STYLE_ELEMENT_ID = 'rule-styles'

export function useStyleInjector() {
  const ruleStore = useRuleStore()
  // useId gives a stable, render-pure unique id per hook instance so the
  // cleanup effect only removes a <style> element this instance created.
  const instanceId = useId()
  const getRuleCssText = ruleStore.getRuleCssText

  useEffect(() => {
    const cssText = getRuleCssText()
    if (!cssText) {
      const existing = document.getElementById(STYLE_ELEMENT_ID)
      if (existing && existing.dataset.injectorOwner === instanceId) {
        existing.remove()
      }
      return
    }
    let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
    if (styleEl) {
      styleEl.textContent = cssText
      styleEl.dataset.injectorOwner = instanceId
    } else {
      styleEl = document.createElement('style')
      styleEl.id = STYLE_ELEMENT_ID
      styleEl.textContent = cssText
      styleEl.dataset.injectorOwner = instanceId
      document.head.appendChild(styleEl)
    }
  }, [ruleStore.compiledRule, ruleStore.customStyles, getRuleCssText, instanceId])

  useEffect(() => {
    return () => {
      const existing = document.getElementById(STYLE_ELEMENT_ID)
      if (existing && existing.dataset.injectorOwner === instanceId) {
        existing.remove()
      }
    }
  }, [instanceId])
}
