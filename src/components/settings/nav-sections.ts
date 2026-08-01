import type { SchemaFieldDescriptor } from "@/engine/schema"

/**
 * Navigation model for the settings overlay.
 *
 * `RuleConfig` is ~100 leaf fields; rendering them all at once means scrolling
 * to find anything. These helpers slice the descriptor tree into the sections
 * the left nav lists, so the detail pane only ever renders one section.
 *
 * Section ids double as the selected-nav key, and are stable across renders so
 * the selection survives edits.
 */

export const EDITOR_SECTION_ID = "editor"

export interface SettingsSection {
  id: string
  /** i18n key for the nav label. */
  labelKey: string
  /** Fallback when `labelKey` has no translation (custom content levels). */
  labelFallback?: string
  /** Descriptors rendered in the detail pane. Empty for the editor section. */
  fields: SchemaFieldDescriptor[]
  /** Nesting depth in the nav (0 = top level, 1 = under a group header). */
  depth: number
  /** True for a user-added content level, which can be renamed and removed. */
  removable?: boolean
  /** Model key of a removable content level (e.g. `custom1`). */
  contentKey?: string
}

/** Group header in the nav — not selectable, purely a label. */
export interface SettingsNavGroup {
  kind: "group"
  labelKey: string
}

export type SettingsNavEntry = SettingsSection | SettingsNavGroup

export function isGroup(entry: SettingsNavEntry): entry is SettingsNavGroup {
  return (entry as SettingsNavGroup).kind === "group"
}

/** Last segment of a dot path (`content.body.style` → `style`). */
export function lastSegment(path: string): string {
  return path.split(".").pop() ?? path
}

/**
 * Build the nav entries from the traversed rule schema plus the current model.
 *
 * The model is needed because `content` has a Zod catchall: custom levels exist
 * only as keys in the value, not in the schema.
 */
export function buildNavEntries(
  descriptors: SchemaFieldDescriptor[],
  model: Record<string, unknown>
): SettingsNavEntry[] {
  const entries: SettingsNavEntry[] = []

  // ── Basic: the root-level scalar fields (name, version, description) ──
  const basicFields = descriptors.filter((d) => d.fieldType !== "object")
  if (basicFields.length > 0) {
    entries.push({
      id: "basic",
      labelKey: "settingsNav.basic",
      fields: basicFields,
      depth: 0,
    })
  }

  // ── Content: one section per level, under a group header ──
  const content = descriptors.find((d) => d.path === "content")
  if (content?.children) {
    entries.push({ kind: "group", labelKey: "settingsNav.content" })

    for (const level of content.children) {
      entries.push({
        id: level.path,
        labelKey: `ruleField.${lastSegment(level.path)}`,
        fields: level.children ?? [level],
        depth: 1,
      })
    }

    for (const custom of customContentLevels(content, model)) {
      entries.push(custom)
    }
  }

  // ── Remaining top-level objects: page, pagination, parser ──
  // editor / preview / autoSave are part of the rule schema but rendered
  // in the standalone Editor section rather than as schema-driven nav entries.
  const EDITOR_RELATED = new Set(["editor", "preview", "autoSave"])
  for (const d of descriptors) {
    if (
      d.fieldType !== "object" ||
      d.path === "content" ||
      EDITOR_RELATED.has(d.path)
    )
      continue
    entries.push({
      id: d.path,
      labelKey: `settingsNav.${d.path}`,
      fields: d.children ?? [d],
      depth: 0,
    })
  }

  // ── Editor/preview settings: not part of the rule schema ──
  entries.push({
    id: EDITOR_SECTION_ID,
    labelKey: "settingsNav.editor",
    fields: [],
    depth: 0,
  })

  return entries
}

/**
 * Sections for content levels that exist in the model but not the schema
 * (added through the catchall). Each is renamable and removable.
 */
function customContentLevels(
  content: SchemaFieldDescriptor,
  model: Record<string, unknown>
): SettingsSection[] {
  if (!content.catchallDescriptor) return []

  const schemaKeys = new Set(
    (content.children ?? []).map((c) => lastSegment(c.path))
  )
  const contentValue = model.content
  if (typeof contentValue !== "object" || contentValue === null) return []

  return Object.keys(contentValue as Record<string, unknown>)
    .filter((key) => !schemaKeys.has(key))
    .map((key) => {
      const rebased = rebaseDescriptor(
        content.catchallDescriptor!,
        `content.${key}`
      )
      return {
        id: `content.${key}`,
        labelKey: `ruleField.${key}`,
        labelFallback: key,
        fields: rebased.children ?? [rebased],
        depth: 1,
        removable: true,
        contentKey: key,
      }
    })
}

/**
 * Re-root a catchall template descriptor onto a concrete path.
 *
 * The template is produced with an empty base path (it describes "any key"), so
 * every descendant path has to be rewritten before the form can read or write
 * values through it.
 */
export function rebaseDescriptor(
  d: SchemaFieldDescriptor,
  newPath: string
): SchemaFieldDescriptor {
  const result: SchemaFieldDescriptor = { ...d, path: newPath }
  if (d.children) {
    result.children = d.children.map((child) =>
      rebaseDescriptor(child, `${newPath}.${lastSegment(child.path)}`)
    )
  }
  if (d.catchallDescriptor) {
    result.catchallDescriptor = d.catchallDescriptor
  }
  return result
}

export interface SearchHit {
  sectionId: string
  sectionLabel: string
  /** Leaf field path, e.g. `content.h1.style.size`. */
  path: string
  /** Translated field label. */
  label: string
}

/** Resolves a descriptor path to its display label (i18n lives in the UI layer). */
export type LabelResolver = (path: string) => string

/**
 * Flatten every leaf field of every section into a searchable list.
 *
 * Only leaves are indexed: searching "字号" should land on the field, not on the
 * `style` group that contains it.
 */
export function buildSearchIndex(
  entries: SettingsNavEntry[],
  resolveLabel: LabelResolver,
  resolveSectionLabel: (section: SettingsSection) => string
): SearchHit[] {
  const hits: SearchHit[] = []

  for (const entry of entries) {
    if (isGroup(entry)) continue
    const sectionLabel = resolveSectionLabel(entry)
    for (const field of entry.fields) {
      collectLeaves(field, (leaf) => {
        hits.push({
          sectionId: entry.id,
          sectionLabel,
          path: leaf.path,
          label: resolveLabel(leaf.path),
        })
      })
    }
  }

  return hits
}

function collectLeaves(
  d: SchemaFieldDescriptor,
  visit: (leaf: SchemaFieldDescriptor) => void
): void {
  if (d.fieldType === "object" && d.children) {
    for (const child of d.children) collectLeaves(child, visit)
    return
  }
  visit(d)
}

/**
 * Filter the index by a query, matching the field label, the section label, or
 * the raw path (so `style.size` works as well as 字号).
 */
export function searchFields(index: SearchHit[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return []
  return index.filter(
    (hit) =>
      hit.label.toLowerCase().includes(q) ||
      hit.path.toLowerCase().includes(q) ||
      hit.sectionLabel.toLowerCase().includes(q)
  )
}
