# CLAUDE.md

Guidance for Claude Code working in this repository.

## Commands

**Bun** package manager. Frontend is Vite + React 19; desktop shell is Tauri 2 (Rust).

```bash
bun install              # install dependencies

bun run dev              # Vite dev server on port 1420 (strict)
bun run tauri dev        # full Tauri app (spawns `bun run dev`)

bun run build            # tsc -b && vite build (type-checks whole project, then bundles)
bun run typecheck        # tsc --noEmit only
bun run tauri build      # produce desktop bundles

bun run release <major|minor|patch|x.y.z>   # bump versions + CHANGELOG scaffold (step 1)
bun run release commit                      # quality gate (build + tests), then git add, commit, tag (step 2)

bun run lint             # eslint .
bun run format           # prettier --write "**/*.{ts,tsx}"

bunx vitest run                                              # all tests once (no `test` script)
bunx vitest                                                  # watch mode
bunx vitest run src/engine/compiler/test/validator.test.ts  # single file
bunx vitest run -t "name of test"                            # filter by name

bun bench/engine-bench.ts [--group parser|compiler|utils|end-to-end] [--no-log]
```

- Tests live in `test/` subdirs next to code (e.g. `src/engine/compiler/test/`). Vitest: jsdom + globals; include glob `src/**/test/**/*.test.ts` and `src/**/*.test.ts`.
- Prettier is non-default: **no semicolons, double quotes**, 2-space tabs, 80 col, ES5 trailing commas.
- Engine benchmark in `bench/` (tinybench, run via `bun`, no package.json script). `bench/history.jsonl` is gitignored (machine-specific); script + README are untracked.

## Architecture

ezdoc is a Markdown-to-styled-document editor: author Markdown, pick a typography "rule" (e.g. GB/T 9704), and the engine compiles that rule to CSS and parses the Markdown to HTML for an A4 preview.

### The engine (`src/engine/`)

**Pure TypeScript, no UI dependencies.** Load-bearing one-way rule: `engine/` may import from `engine/` and npm packages (markdown-it, zod, yaml), but **never from `lib/`, `hooks/`, `stores/`, `components/`**. CSS class names and i18n are UI concerns — injected as parameters or handled upstream.

`src/engine/index.ts` is the sole public API (`compileRule`, `validateRule`, `getBuiltinRules`, `MarkdownParser`, `DEFAULT_HOST`, types). Internal helpers (`toCssCustomProperty`, `scopeSelectors`, sanitize utils) are **not** exported — keep it that way.

Three subsystems:

- **Compiler** (`compiler/`) — `compileRule(config, host)` orchestrates a three-stage pipeline: `token-generator.ts` (`RuleConfig`→tokens) → `rule-builders/` (root, body, heading, page, print; each returns `StyleNode[]`) → `serializer.ts` (`StyleNode[]`→CSS). Add a CSS category by writing a builder and registering it in `compiler.ts`. `HostSelectors` (`compiler/types.ts`) is a **required** param — no hardcoded selectors; `DEFAULT_HOST` provides defaults. `paperContent` is a compound selector injected whole.
- **Parser** (`parser/`) — `MarkdownParser` runs a `ParserPipeline` (default `DEFAULT_PIPELINE`): preprocessors → markdown-it parse → token processors → render → HTML postprocessors. Processors in `parser/processors/{preprocess,md-plugins,token}/`. Extend by adding a processor (interface in `parser/types.ts`) and registering it — no changes to `MarkdownParser`. `parse()` returns `{ html, tokens }`.
- **Schema + validation** (`schema/`, `compiler/validator.ts`) — Zod schemas define `RuleConfig`. Built-in rules are `builtin-rules/*.yaml`, loaded via `?raw` and parsed through `schema/yaml-mapper.ts`. `validateRule()` is hand-written (not Zod) and uses a **factory pattern** (`patternValidator`, `setValidator`, `typeValidator`). Prefer composing a factory; write bespoke validators only where rules genuinely differ (e.g. `validateCssParagraphSpacing` accepts `''` and numeric `0`).

### Error handling

Two i18n-free error-code enums: `ValidationErrorCode` (`compiler/types.ts`) and `ParseErrorCode` (`parser/types.ts`). Engine returns codes; the React/i18n layer translates via `ERROR_CODE_TO_I18N_KEY`. No translated strings in engine code.

### Tauri shell (`src-tauri/`)

Rust entry `src-tauri/src/lib.rs`. Custom `external-navigation` plugin: external `http(s)/mailto/tel` links open in the system browser (`tauri-plugin-opener`) and are blocked from navigating the webview; internal hosts (localhost, tauri.localhost) navigate normally. Main window starts hidden, shown on `PageLoadEvent::Finished`. Cargo package is `tauri-native` / lib `tauri_native_lib` (not "ezdoc").

## Project context

Migration in progress from `gov-draft` (Vue 3 + Express) to ezdoc (Tauri + React 19 + shadcn). Engine is ported. App layer substantially built: Zustand stores (`doc-store`, `rule-store`, `settings-store`), hooks (`use-markdown`, `use-paginator`, `use-style-injector`, `use-split-pane`, `use-rule-engine`, `use-file-system`), split-pane editor/preview UI wired in `App.tsx`. Settings panels still pending.

Authoritative design: **`docs/2026-06-02-govdraft-to-ezdoc-migration-design.md`**; phased plans in **`docs/superpowers/plans/`**. Read the design doc before structural changes. Decisions made there: no `types/` dir (types come from `engine/index.ts`), no `RuleEngine` class (pure functions), no adapter layer (React hooks), PDF export deferred, `HostSelectors` required with no engine default.

## Conventions

- Path alias `@/` → `src/` (Vite + tsconfig).
- shadcn/ui in `src/components/ui/`; icon library is **hugeicons** (per components.json), though lucide-react is also installed.
- TS strict with `noUnusedLocals`/`noUnusedParameters` + `erasableSyntaxOnly` — type-only imports must use `import type`.
- Release is tag-driven: pushing a `v*` tag triggers `.github/workflows/release.yml` (cross-platform Tauri build). No separate CI lint/test workflow.
- `bun run release`: step 1 bumps versions + scaffolds CHANGELOG from Conventional Commits; step 2 commits and tags. **After step 1, review and simplify CHANGELOG.md** — consolidate redundant entries, drop trivial chores, rewrite bullets into user-facing prose. The raw `### Commits` list per version is the source of truth.
