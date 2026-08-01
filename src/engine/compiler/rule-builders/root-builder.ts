import type { StyleNode } from '../types'
import { mapTokensToDeclarations, styleRule } from '../compiler-internals'

export function buildRootRule(tokens: Record<string, string>): StyleNode[] {
  return [styleRule([':root'], mapTokensToDeclarations(tokens))]
}
