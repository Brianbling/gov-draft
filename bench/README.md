# Engine benchmark

A comprehensive benchmark for the engine, built on
[`tinybench`](https://github.com/tinylibs/tinybench). It runs each task many
times, reports per-task statistics (mean / p99 / ops-per-sec / margin-of-error),
groups tasks by subsystem, and appends every run to `bench/history.jsonl`
tagged with the git commit so results can be tracked over time.

## Run

```bash
bun bench/engine-bench.ts                 # all groups, 400ms/task, logs history
bun bench/engine-bench.ts --time 1000     # longer = tighter confidence intervals
bun bench/engine-bench.ts --group parser  # one group only
bun bench/engine-bench.ts --no-log        # don't append to history.jsonl
```

Each run prints a per-group table and a summary line tagged with the current
git commit (`(dirty)` if the working tree has uncommitted changes), so every
history entry is attributable to a code state.

## Coverage

### parser
- `parse` across a **scale curve** — 5 / 20 / 80 / 200 paragraphs — to expose
  linear vs super-linear growth.
- `parse: mixed-script` — stresses the text-font-scope plugin (latin runs,
  中文引号 “”, 书名号 《》).
- `parse: local-style containers` — the custom `:::` block tokenizer + alias
  resolution.
- `parse: line-break heavy` — the line-break-normalizer preprocessor.
- `setOptions: unchanged config` vs `changed config (rebuild)` — isolates the
  parser-rebuild dirty-check (the per-keystroke win); the gap between the two is
  the cost the dirty-check avoids.

### compiler
- `compileRule (full)` plus its stages broken out: `generateRuleTokens`,
  `serializeStyleSheet`.
- `validateRule` — runs on load/save.
- `toCssCustomProperty (hot cache)` — path-memoization steady state.

### utils
- `formatByStyle` for arabic / zhHans / zhHant / roman — the number-formatting
  algorithms behind heading numbering.
- `expr eval: repeated (hot cache)` vs `unique (cold compile)` — the
  compile-once expression cache, best case vs worst case (cache never hits).

### end-to-end
- `open document` — validate + compile + parse, the real document-open path.
- `render 200 page numbers` — per-page template evaluation across a long doc.

### incremental
Per-keystroke parse cost with block-level caching. Simulates appending one
character at the end of a doc.

- `edit@end: true full reparse (huge 200p)` — full pipeline without caching
  (baseline).
- `edit@end: cached parse (huge 200p)` — `MarkdownParser.parse()` with built-in
  `BlockCache`.
- `edit@end: block-cached warm (huge 200p)` — pre-warmed cache, steady state.
- `edit@middle: block-cached warm (huge 200p)` — same but editing mid-document.
- `stage: preprocess / md.parse tokenize / heading renumber sweep / render html`
  — pipeline stages of the true full reparse, broken out individually.
- `edit@end: block-cached lower bound` — reparse only the edited block +
  unavoidable global stages (theoretical floor for any block-caching scheme).
- `edit@end: cached parse (small 20p)` and `block-cached warm (small 20p)` —
  small doc; cache is bypassed internally below 20 blocks.

**Caveat:** these run in bun/node and measure only the **engine parse** stage.
Pagination (DOM-measurement in `use-paginator.ts`) and React render are not
measurable without a browser layout engine.

## History

`history.jsonl` has one JSON object per run:

```json
{ "timestamp": "...", "commit": "bb49fe1", "dirty": true, "timeMs": 400, "group": "all",
  "results": [ { "group": "parser", "task": "parse: large doc (80p)",
                 "meanMs": 0.46, "p99Ms": 1.88, "hz": 2172, "rme": 3.9, "samples": 540 } ] }
```

Track one task across runs without extra tooling:

```bash
jq -r 'select(.dirty==false) | "\(.commit) \(.results[] | select(.task=="compileRule (full)") | .meanMs)"' bench/history.jsonl
```

## Comparing before/after a change

This benchmark measures the current tree. To compare against an earlier commit,
run it, switch commits (or `git stash`), run again, and diff the two
`history.jsonl` entries by `commit`. `history.jsonl` is gitignored (machine-
specific output).
