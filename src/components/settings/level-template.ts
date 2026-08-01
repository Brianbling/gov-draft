/**
 * Seed value for a newly-added custom content level.
 *
 * A level must satisfy `ContentItemConfigSchema` (fonts + style + paragraph) or
 * the rule fails validation on save. Rather than synthesizing one from the
 * schema — which would produce empty strings that fail the CSS validators — the
 * new level is cloned from an existing one, so it is valid from the start and
 * the user only edits what differs.
 */

const PREFERRED_SOURCE_KEYS = ["body", "h1"]

/** Deep clone of a suitable existing level, or a minimal valid fallback. */
export function buildLevelTemplate(
  content: Record<string, unknown>
): Record<string, unknown> {
  const source = pickSource(content)
  if (source) return JSON.parse(JSON.stringify(source))
  return FALLBACK_LEVEL()
}

function pickSource(
  content: Record<string, unknown>
): Record<string, unknown> | null {
  for (const key of PREFERRED_SOURCE_KEYS) {
    const candidate = content[key]
    if (isLevel(candidate)) return candidate
  }
  // Any level will do — the user is going to edit it anyway.
  for (const value of Object.values(content)) {
    if (isLevel(value)) return value
  }
  return null
}

function isLevel(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.fonts === "object" &&
    typeof record.style === "object" &&
    typeof record.paragraph === "object"
  )
}

/** Used only when `content` holds no usable level (shouldn't happen). */
const FALLBACK_LEVEL = (): Record<string, unknown> => ({
  fonts: {
    latinFamily: "Times New Roman, serif",
    cjkFamily: "仿宋_GB2312, FangSong, STFangsong, serif",
  },
  style: {
    size: "16pt",
    weight: 400,
    colors: { text: "#000000", background: "#ffffff" },
  },
  paragraph: {
    align: "justify",
    indent: "2em",
    spacing: { lineHeight: "1.5", before: "0lines", after: "0lines" },
  },
})
