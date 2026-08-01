import { useState } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlusSignIcon,
  Search01Icon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { isGroup, type SettingsNavEntry, type SearchHit } from "./nav-sections"

interface SettingsNavProps {
  entries: SettingsNavEntry[]
  selectedId: string
  onSelect: (id: string) => void
  query: string
  onQueryChange: (query: string) => void
  hits: SearchHit[]
  onAddLevel: () => void
  /** Resolved nav label for a section (handles the i18n fallback). */
  labelFor: (entry: SettingsNavEntry) => string
}

/**
 * Left rail of the settings overlay: a search box over a flat section list.
 *
 * With ~100 rule fields, search is the fast path — a hit jumps straight to the
 * owning section, which the detail pane then scrolls to.
 */
export function SettingsNav({
  entries,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  hits,
  onAddLevel,
  labelFor,
}: SettingsNavProps) {
  const { t } = useTranslation()
  const searching = query.trim().length > 0

  return (
    <nav
      className="flex w-56 shrink-0 flex-col border-r"
      aria-label={t("settings.navAria")}
    >
      <div className="relative border-b p-2">
        <HugeiconsIcon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          className="h-8 pl-7 text-xs"
          placeholder={t("settings.searchPlaceholder")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1">
        {searching ? (
          <SearchResults hits={hits} onSelect={onSelect} />
        ) : (
          <SectionList
            entries={entries}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddLevel={onAddLevel}
            labelFor={labelFor}
          />
        )}
      </div>
    </nav>
  )
}

interface SectionListProps {
  entries: SettingsNavEntry[]
  selectedId: string
  onSelect: (id: string) => void
  onAddLevel: () => void
  labelFor: (entry: SettingsNavEntry) => string
}

function SectionList({
  entries,
  selectedId,
  onSelect,
  onAddLevel,
  labelFor,
}: SectionListProps) {
  const { t } = useTranslation()

  // Track which groups are collapsed. Groups start expanded (not in the set).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleGroup = (labelKey: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(labelKey)) {
        next.delete(labelKey)
      } else {
        next.add(labelKey)
      }
      return next
    })
  }

  // The "add level" action belongs with the content group, so it is rendered
  // right after the last content section rather than in a global toolbar.
  const lastContentIndex = entries.reduce(
    (last, entry, i) =>
      !isGroup(entry) && entry.id.startsWith("content.") ? i : last,
    -1
  )

  // Walk entries, tracking which group we are inside so items under a collapsed
  // group can be hidden.
  let currentGroup: string | null = null
  const visible: boolean[] = entries.map(() => true)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (isGroup(entry)) {
      currentGroup = entry.labelKey
      continue
    }
    // Items nested under the current group are hidden when it is collapsed.
    if (currentGroup && entry.depth > 0 && collapsed.has(currentGroup)) {
      visible[i] = false
    }
    // A top-level item outside any group ends the group context.
    if (entry.depth === 0) {
      currentGroup = null
    }
  }

  return (
    <ul className="grid gap-0.5">
      {entries.map((entry, index) => {
        if (!visible[index]) return null

        const isCollapsed = isGroup(entry) && collapsed.has(entry.labelKey)

        return (
          <li key={isGroup(entry) ? `group-${index}` : entry.id}>
            {isGroup(entry) ? (
              <button
                type="button"
                onClick={() => toggleGroup(entry.labelKey)}
                className="flex w-full items-center justify-between px-2 pt-2 pb-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {labelFor(entry)}
                <HugeiconsIcon
                  icon={isCollapsed ? ChevronRightIcon : ChevronDownIcon}
                  className="size-3.5 shrink-0"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(entry.id)}
                aria-current={entry.id === selectedId ? "true" : undefined}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  entry.depth > 0 && "pl-5",
                  entry.id === selectedId
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                {labelFor(entry)}
              </button>
            )}

            {/* The "add level" button is hidden when the content group is collapsed. */}
            {index === lastContentIndex &&
              !collapsed.has("settingsNav.content") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-0.5 w-full justify-start pl-5 text-sm text-muted-foreground"
                  onClick={onAddLevel}
                >
                  <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                  {t("settings.addLevel")}
                </Button>
              )}
          </li>
        )
      })}
    </ul>
  )
}

function SearchResults({
  hits,
  onSelect,
}: {
  hits: SearchHit[]
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()

  if (hits.length === 0) {
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        {t("settings.searchEmpty")}
      </p>
    )
  }

  return (
    <ul className="grid gap-0.5">
      {hits.map((hit) => (
        <li key={hit.path}>
          <button
            type="button"
            onClick={() => onSelect(hit.sectionId)}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <span className="block text-foreground">{hit.label}</span>
            <span className="block truncate text-[0.6875rem]">
              {hit.sectionLabel}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default SettingsNav
