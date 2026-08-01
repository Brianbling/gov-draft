import { PAGINATION_EXPRESSION_ALLOWED_PATTERN } from '../patterns/css-patterns'

type CompiledExpression = (variables: Record<string, number>) => number | null

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'identifier'; name: string }
  | { kind: 'operator'; op: '+' | '-' | '*' | '/' }
  | { kind: 'paren'; paren: '(' | ')' }

type AstNode =
  | { type: 'number'; value: number }
  | { type: 'identifier'; name: string }
  | { type: 'unary'; op: '-'; operand: AstNode }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: AstNode; right: AstNode }

const compiledCache = new Map<string, CompiledExpression | null>()

const BINARY_PRECEDENCE: Record<'+' | '-' | '*' | '/', number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
}

function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = []
  let index = 0

  while (index < expression.length) {
    const char = expression[index]!

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      index += 1
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ kind: 'operator', op: char })
      index += 1
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ kind: 'paren', paren: char })
      index += 1
      continue
    }

    if ((char >= '0' && char <= '9') || char === '.') {
      let end = index
      while (end < expression.length) {
        const next = expression[end]!
        if ((next >= '0' && next <= '9') || next === '.') {
          end += 1
        } else {
          break
        }
      }
      const value = Number(expression.slice(index, end))
      if (!Number.isFinite(value)) {
        return null
      }
      tokens.push({ kind: 'number', value })
      index = end
      continue
    }

    if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || char === '_') {
      let end = index
      while (end < expression.length) {
        const next = expression[end]!
        if (
          (next >= 'A' && next <= 'Z') ||
          (next >= 'a' && next <= 'z') ||
          (next >= '0' && next <= '9') ||
          next === '_'
        ) {
          end += 1
        } else {
          break
        }
      }
      tokens.push({ kind: 'identifier', name: expression.slice(index, end) })
      index = end
      continue
    }

    return null
  }

  return tokens
}

function parse(tokens: Token[]): AstNode | null {
  let position = 0

  function peek(): Token | undefined {
    return tokens[position]
  }

  function parsePrimary(): AstNode | null {
    const token = peek()
    if (!token) {
      return null
    }

    if (token.kind === 'operator' && (token.op === '-' || token.op === '+')) {
      position += 1
      const operand = parsePrimary()
      if (!operand) {
        return null
      }
      return token.op === '-' ? { type: 'unary', op: '-', operand } : operand
    }

    if (token.kind === 'number') {
      position += 1
      return { type: 'number', value: token.value }
    }

    if (token.kind === 'identifier') {
      position += 1
      return { type: 'identifier', name: token.name }
    }

    if (token.kind === 'paren' && token.paren === '(') {
      position += 1
      const inner = parseExpression(0)
      const closing = peek()
      if (!inner || !closing || closing.kind !== 'paren' || closing.paren !== ')') {
        return null
      }
      position += 1
      return inner
    }

    return null
  }

  function parseExpression(minPrecedence: number): AstNode | null {
    let left = parsePrimary()
    if (!left) {
      return null
    }

    while (true) {
      const token = peek()
      if (!token || token.kind !== 'operator') {
        break
      }
      const precedence = BINARY_PRECEDENCE[token.op]
      if (precedence < minPrecedence) {
        break
      }
      position += 1
      const right = parseExpression(precedence + 1)
      if (!right) {
        return null
      }
      left = { type: 'binary', op: token.op, left, right }
    }

    return left
  }

  const ast = parseExpression(0)
  if (!ast || position !== tokens.length) {
    return null
  }
  return ast
}

const UNRESOLVED = Symbol('unresolved-variable')

function evaluateAst(node: AstNode, variables: Record<string, number>): number | typeof UNRESOLVED {
  switch (node.type) {
    case 'number':
      return node.value
    case 'identifier': {
      const value = variables[node.name]
      return typeof value === 'number' ? value : UNRESOLVED
    }
    case 'unary': {
      const operand = evaluateAst(node.operand, variables)
      return operand === UNRESOLVED ? UNRESOLVED : -operand
    }
    case 'binary': {
      const left = evaluateAst(node.left, variables)
      if (left === UNRESOLVED) {
        return UNRESOLVED
      }
      const right = evaluateAst(node.right, variables)
      if (right === UNRESOLVED) {
        return UNRESOLVED
      }
      if (node.op === '+') return left + right
      if (node.op === '-') return left - right
      if (node.op === '*') return left * right
      return left / right
    }
  }
}

export function compileNumericTemplateExpression(expression: string): CompiledExpression | null {
  const trimmedExpression = expression.trim()
  const cached = compiledCache.get(trimmedExpression)
  if (cached !== undefined) {
    return cached
  }

  let compiled: CompiledExpression | null = null
  if (trimmedExpression && PAGINATION_EXPRESSION_ALLOWED_PATTERN.test(trimmedExpression)) {
    const tokens = tokenize(trimmedExpression)
    const ast = tokens ? parse(tokens) : null
    if (ast) {
      compiled = (variables) => {
        const result = evaluateAst(ast, variables)
        if (result === UNRESOLVED || typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
          return null
        }
        return result
      }
    }
  }

  compiledCache.set(trimmedExpression, compiled)
  return compiled
}

export function evaluateNumericTemplateExpression(
  expression: string,
  variables: Record<string, number>
): number | null {
  const compiled = compileNumericTemplateExpression(expression)
  return compiled ? compiled(variables) : null
}
