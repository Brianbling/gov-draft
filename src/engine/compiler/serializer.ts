import type { StyleDeclaration, StyleNode } from './types'

function serializeDeclarations(declarations: StyleDeclaration[], indentLevel: number): string {
  const indent = '  '.repeat(indentLevel)
  return declarations
    .filter((item) => item.property.length > 0 && item.value.length > 0)
    .map((item) => `${indent}${item.property}: ${item.value};`)
    .join('\n')
}

function serializeStyleNode(node: StyleNode, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel)

  if (node.type === 'style') {
    const selectorText = node.selectors.join(', ')
    const declarationText = serializeDeclarations(node.declarations, indentLevel + 1)
    return `${indent}${selectorText} {\n${declarationText}\n${indent}}`
  }

  const header = node.prelude ? `${indent}@${node.name} ${node.prelude} {` : `${indent}@${node.name} {`
  const chunks: string[] = []

  if (node.declarations && node.declarations.length > 0) {
    chunks.push(serializeDeclarations(node.declarations, indentLevel + 1))
  }

  if (node.children && node.children.length > 0) {
    chunks.push(node.children.map((child) => serializeStyleNode(child, indentLevel + 1)).join('\n\n'))
  }

  const body = chunks.join('\n\n')
  return body.length > 0 ? `${header}\n${body}\n${indent}}` : `${header}\n${indent}}`
}

export function serializeStyleSheet(rules: StyleNode[]): string {
  return rules.map((rule) => serializeStyleNode(rule)).join('\n\n')
}
