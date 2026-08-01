/**
 * Font-family presets for the rule editor.
 *
 * A `*Family` field holds a full CSS font stack — the GB/T rules pair each
 * Chinese face with several aliases plus a generic fallback, e.g.
 * `仿宋_GB2312, 仿宋, FangSong, FangSong_GB2312, STFangsong, serif`. Typing that
 * by hand is error-prone, so the form offers these chains as presets and keeps a
 * free-text field for anything else.
 *
 * The stacks are the ones used by the builtin rules (`engine/builtin-rules/`);
 * keep them in sync if a builtin YAML changes its chain.
 */

export interface FontPreset {
  /** Stable id, also the i18n key suffix under `fontPreset.`. */
  id: string
  /** The full CSS font stack written into the field. */
  stack: string
}

/** Chinese (CJK) stacks — used by cjkFamily, cnQuoteFamily, cnBookTitleFamily. */
export const CJK_FONT_PRESETS: FontPreset[] = [
  {
    id: "fangsong",
    stack: "仿宋_GB2312, 仿宋, FangSong, FangSong_GB2312, STFangsong, serif",
  },
  {
    id: "heiti",
    stack: "黑体, SimHei, STHeiti, Microsoft YaHei, sans-serif",
  },
  {
    id: "kaiti",
    stack: "楷体_GB2312, 楷体, KaiTi, KaiTi_GB2312, STKaiti, serif",
  },
  {
    id: "xiaobiaosong",
    stack:
      "方正小标宋_GBK, 方正小标宋简体, FZXiaoBiaoSong-B05, 黑体, SimHei, STHeiti, sans-serif",
  },
  {
    id: "songti",
    stack: "宋体, SimSun, Songti SC, STSong, serif",
  },
]

/** Latin stacks — used by latinFamily. */
export const LATIN_FONT_PRESETS: FontPreset[] = [
  { id: "timesNewRoman", stack: "Times New Roman, serif" },
  { id: "arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "georgia", stack: "Georgia, serif" },
  { id: "courier", stack: "Courier New, Courier, monospace" },
]

/** Field-name suffixes that hold a font stack, mapped to their preset list. */
const PRESETS_BY_FIELD: Record<string, FontPreset[]> = {
  latinFamily: LATIN_FONT_PRESETS,
  cjkFamily: CJK_FONT_PRESETS,
  cnQuoteFamily: CJK_FONT_PRESETS,
  cnBookTitleFamily: CJK_FONT_PRESETS,
}

/**
 * Presets for a descriptor path, or null when the field is not a font stack.
 * Matches on the last path segment, so it works for any content level.
 */
export function presetsForPath(path: string): FontPreset[] | null {
  const lastSegment = path.split(".").pop() ?? ""
  return PRESETS_BY_FIELD[lastSegment] ?? null
}

/** Normalize for comparison: collapse whitespace after commas, trim, lowercase. */
function normalizeStack(stack: string): string {
  return stack
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)
    .join(",")
}

/** The preset whose stack equals `value`, or null when the value is custom. */
export function matchPreset(
  presets: FontPreset[],
  value: string
): FontPreset | null {
  const normalized = normalizeStack(value)
  return presets.find((p) => normalizeStack(p.stack) === normalized) ?? null
}
