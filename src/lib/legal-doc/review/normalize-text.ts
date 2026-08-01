/**
 * L3 文字规范层：纯文本规范化（无 DOM、无副作用）。
 * 依据 GB/T 15834《标点符号用法》与 GB/T 15835《出版物上数字用法》：
 * 中文语境下必须使用全角标点，禁止半角英文标点混入中文；
 * 数字、英文、URL、小数、版本号（如 2.1）里的半角点号必须保留原样。
 */

/** CJK 汉字 + 中文标点（全角标点区、引号、书名号等）。 */
const CJK_CHAR_PATTERN = /[一-鿿㐀-䶿\u3000-〿＀-￯‘’“”—…·《》]/

const isCjkChar = (ch: string | undefined): boolean =>
  ch !== undefined && CJK_CHAR_PATTERN.test(ch)

/** 字符串中是否含任何 CJK 字符（用于判断"中文语境"）。 */
const containsCjk = (s: string): boolean => CJK_CHAR_PATTERN.test(s)

/** 从位置 start 出发，沿 step 方向找最近的非空白字符。 */
function nearestChar(
  chars: string[],
  start: number,
  step: -1 | 1,
): string | undefined {
  let i = start + step
  while (i >= 0 && i < chars.length) {
    const ch = chars[i]
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") return ch
    i += step
  }
  return undefined
}

/**
 * 半角 → 全角引号成对转换（ASCII 双/单引号只有一种字形，开闭共用）。
 * 把引号按配对单元处理：先收集本视觉族（half/fullOpen/fullClose）的所有引号位，
 * 再逐对决策 —— 一对引号转全角当且仅当：
 * - 引号内容含中文，或
 * - 引号外侧（前/后最近非空白字符）是中文。
 * 这样 `强调"open"精神` 转换，而 `the "quick" fox`、`It's` 保留半角。
 * 已存在的全角引号参与配对状态，避免 `“总体要求"` 这类半角闭引号被漏转。
 */
function convertQuotes(
  text: string,
  half: string,
  fullOpen: string,
  fullClose: string,
): string {
  const chars = Array.from(text)
  const result = [...chars]

  interface QuoteMark {
    pos: number
    kind: "half" | "open" | "close"
  }
  const marks: QuoteMark[] = []
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === half) marks.push({ pos: i, kind: "half" })
    else if (ch === fullOpen) marks.push({ pos: i, kind: "open" })
    else if (ch === fullClose) marks.push({ pos: i, kind: "close" })
  }

  /** 决策：pending 开引号与闭引号之间的单元是否该转全角。 */
  const shouldConvert = (openPos: number, closePos: number): boolean => {
    const segment = chars.slice(openPos + 1, closePos).join("")
    const before = nearestChar(chars, openPos, -1)
    const after = nearestChar(chars, closePos, 1)
    return containsCjk(segment) || isCjkChar(before) || isCjkChar(after)
  }

  let pendingHalf: number | null = null
  let insideFull = false

  const finalizePending = (endPos: number): void => {
    if (pendingHalf !== null) {
      if (shouldConvert(pendingHalf, endPos)) result[pendingHalf] = fullOpen
      pendingHalf = null
    }
  }

  for (const mark of marks) {
    if (mark.kind === "open") {
      finalizePending(mark.pos)
      insideFull = true
    } else if (mark.kind === "close") {
      finalizePending(mark.pos)
      insideFull = false
    } else {
      if (insideFull) {
        // 处于全角开引号内：此半角引号作为闭引号收尾。
        result[mark.pos] = fullClose
        insideFull = false
      } else if (pendingHalf !== null) {
        // 匹配到 pending 开引号的闭引号。
        if (shouldConvert(pendingHalf, mark.pos)) {
          result[pendingHalf] = fullOpen
          result[mark.pos] = fullClose
        }
        pendingHalf = null
      } else {
        pendingHalf = mark.pos
      }
    }
  }

  // 字符串结尾仍悬挂的开引号（如 `It's` 里的撇号）：按单元决策。
  if (pendingHalf !== null && shouldConvert(pendingHalf, chars.length)) {
    result[pendingHalf] = fullOpen
  }

  return result.join("")
}

/**
 * 半角圆括号对 → 全角圆括号对。扫描配对 `(`/`)`，
 * 若括号内含任意 CJK 字符则整对转换（如 `(一)`、`(2019年)`），
 * 避免破坏英文短语、URL、代码（如 `(click here)`）。
 */
function convertCjkParens(text: string): string {
  const chars = Array.from(text)
  const convertAt = new Array<boolean>(chars.length).fill(false)

  const stack: number[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === "(") {
      stack.push(i)
    } else if (chars[i] === ")") {
      const open = stack.pop()
      if (open === undefined) continue
      const segment = chars.slice(open + 1, i).join("")
      if (containsCjk(segment)) {
        convertAt[open] = true
        convertAt[i] = true
      }
    }
  }
  // 未闭合的半角开括号：若其后到行尾/下一个括号间含中文，同样转换。
  for (const open of stack) {
    let segment = ""
    let j = open + 1
    while (j < chars.length && chars[j] !== "(" && chars[j] !== ")") {
      segment += chars[j]
      j++
    }
    if (containsCjk(segment)) convertAt[open] = true
  }

  for (let i = 0; i < chars.length; i++) {
    if (convertAt[i]) chars[i] = chars[i] === "(" ? "（" : "）"
  }
  return chars.join("")
}

/**
 * 半角逗号/冒号 → 全角。仅当两侧至少一侧是中文（含全角标点）时转换，
 * 避免破坏英文单词、URL、时间（9:30）、代码。
 */
function convertCjkPunct(text: string, half: string, full: string): string {
  const chars = Array.from(text)
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== half) continue
    if (!isCjkChar(chars[i - 1]) && !isCjkChar(chars[i + 1])) continue
    chars[i] = full
  }
  return chars.join("")
}

/**
 * 半角句号 `.` → 全角 `。`。仅当前面是中文且（后面是中文或句尾）时转换，
 * 严格避免误伤小数（2.1）、版本号（v2.3.4）、网址、英文缩写。
 */
function convertCjkPeriod(text: string): string {
  const chars = Array.from(text)
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== ".") continue
    if (!isCjkChar(chars[i - 1])) continue
    if (chars[i + 1] !== undefined && !isCjkChar(chars[i + 1])) continue
    chars[i] = "。"
  }
  return chars.join("")
}

/** 递归压缩连续重复的同一全角标点（如 `。。`、`，，`、`！！`）。 */
function collapseRepeatedMarks(text: string): string {
  return text.replace(/([，。；：！？、])\1+/g, "$1")
}

/**
 * 规范化一段中文公文文本：
 * 1. 半角引号成对转中文引号（英文语境保留）；
 * 2. 半角圆括号对转全角（内含中文才转）；
 * 3. 半角逗号/冒号在中文语境转全角；
 * 4. 中文语境的半角句号转全角（数字/版本/URL 不误伤）；
 * 5. 压缩连续重复标点。
 */
export function normalizeText(text: string): string {
  const singles = convertQuotes(convertQuotes(text, "'", "‘", "’"), '"', "“", "”")
  const parens = convertCjkParens(singles)
  const commas = convertCjkPunct(parens, ",", "，")
  const colons = convertCjkPunct(commas, ":", "：")
  const periods = convertCjkPeriod(colons)
  return collapseRepeatedMarks(periods)
}
