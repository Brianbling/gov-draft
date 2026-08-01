#!/usr/bin/env bun
// Prepare a release in two steps: first bump versions and generate the
// CHANGELOG entry, then (after review) commit + tag.
//
// Usage:
//   bun run release <major|minor|patch|x.y.z>   # step 1: bump + changelog
//   bun run release commit                      # step 2: git add, commit, tag
//
// Step 1 — bump, in order:
//   1. Reads the current version from package.json and computes the next one.
//   2. Writes the next version to the five files that pin it:
//        package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml,
//        src-tauri/Cargo.lock (the tauri-native entry only), README.md
//        (Shield.io version badge).
//   3. Collects commits in `<last tag>..HEAD`, groups them by Conventional
//      Commit type, and inserts a new `## [x.y.z]` section into CHANGELOG.md
//      just below `## [Unreleased]`, refreshing the compare links at the foot.
//
// Step 2 — commit (run after polishing CHANGELOG.md):
//   Runs a quality gate first (`bun run build` + full vitest suite); aborts
//   without committing or tagging if either fails. Then reads the current
//   version from package.json, git add the five versioned files, commit with
//   "chore(release): prepare v<x.y.z>", and create a v<x.y.z> tag. Does NOT
//   push — you push manually afterwards.
//
// The generated Added/Changed/Fixed bullets are scaffolding — skim and polish
// them before releasing. The raw `### Commits` list underneath is the source
// of truth.
//
//   bun run release minor                     # write files, stop — edit CHANGELOG first
//   bun run release commit                    # git add, commit, tag — then push manually

import { execSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const SEMVER = /^\d+\.\d+\.\d+$/
const CARGO_PKG_NAME = "tauri-native"
const REPO_URL = "https://github.com/LeonardoTan19/ezdoc"

// Conventional-commit type → CHANGELOG section heading. Types not listed
// (chore, test, ci, style, build) are kept out of the semantic sections but
// still appear in the raw `### Commits` list.
const TYPE_TO_SECTION: Record<string, string> = {
  feat: "Added",
  fix: "Fixed",
  perf: "Changed",
  refactor: "Changed",
  docs: "Changed",
}
const SECTION_ORDER = ["Added", "Changed", "Fixed"]

function fail(message: string): never {
  console.error(`release: ${message}`)
  process.exit(1)
}

function git(command: string): string {
  return execSync(command, { cwd: root, encoding: "utf8" }).trim()
}

// Run a command, streaming its output; abort the release if it exits non-zero.
function run(command: string, label: string): void {
  try {
    execSync(command, { cwd: root, stdio: "inherit" })
  } catch {
    fail(`${label} failed (\`${command}\`) — aborting before tag`)
  }
}

// Pre-tag gate: `bun run build` is the `tsc -b && vite build` CI runs, so a
// green gate means a green release build (`typecheck`'s `tsc --noEmit` misses
// `tsc -b` build-mode errors).
function runReleaseGate(): void {
  console.log("release commit: running quality gate (build + tests)...")
  run("bun run build", "build")
  run("bunx vitest run", "tests")
  console.log("  gate passed\n")
}

function readCurrentVersion(): string {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  if (!SEMVER.test(pkg.version ?? "")) {
    fail(`package.json version "${pkg.version}" is not a clean x.y.z semver`)
  }
  return pkg.version
}

function computeNextVersion(current: string, arg: string): string {
  if (SEMVER.test(arg)) return arg
  const [major, minor, patch] = current.split(".").map(Number)
  switch (arg) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
    default:
      fail(`unknown bump "${arg}" — expected major|minor|patch or an explicit x.y.z`)
  }
}

// --- version bumping ---------------------------------------------------------

// Replace the first top-level `"version": "x.y.z"` field. Targeted text replace
// preserves the file's existing formatting (no JSON re-serialization).
function bumpJsonVersionField(relativePath: string, next: string): void {
  const path = join(root, relativePath)
  const text = readFileSync(path, "utf8")
  const replaced = text.replace(/("version"\s*:\s*")\d+\.\d+\.\d+(")/, `$1${next}$2`)
  if (replaced === text) fail(`could not find a version field in ${relativePath}`)
  writeFileSync(path, replaced)
}

// Cargo.toml: the version line inside the [package] section only.
function bumpCargoToml(next: string): void {
  const path = join(root, "src-tauri/Cargo.toml")
  const text = readFileSync(path, "utf8")
  const replaced = text.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")\d+\.\d+\.\d+(")/,
    `$1${next}$2`,
  )
  if (replaced === text) fail("could not find [package] version in Cargo.toml")
  writeFileSync(path, replaced)
}

// Cargo.lock: only the tauri-native package block, not any dependency entry.
function bumpCargoLock(next: string): void {
  const path = join(root, "src-tauri/Cargo.lock")
  const text = readFileSync(path, "utf8")
  const replaced = text.replace(
    new RegExp(`(name = "${CARGO_PKG_NAME}"\\nversion = ")\\d+\\.\\d+\\.\\d+(")`),
    `$1${next}$2`,
  )
  if (replaced === text) fail(`could not find ${CARGO_PKG_NAME} entry in Cargo.lock`)
  writeFileSync(path, replaced)
}

// README.md: update the Shield.io version badge URL.
function bumpReadmeVersion(next: string): void {
  const path = join(root, "README.md")
  const text = readFileSync(path, "utf8")
  const replaced = text.replace(
    /(https:\/\/img\.shields\.io\/badge\/version-)v\d+\.\d+\.\d+(-blue)/,
    `$1v${next}$2`,
  )
  if (replaced === text) fail("could not find Shield.io version badge in README.md")
  writeFileSync(path, replaced)
}

// --- changelog generation ----------------------------------------------------

interface ParsedCommit {
  hash: string
  subject: string
  type: string | null
  scope: string | null
  description: string
}

function collectCommits(): ParsedCommit[] {
  // The last tag is the *previous* release; HEAD is the new tip. We never read
  // the tag we're about to create — that's left for the manual `git tag` step.
  // No tags yet (first release): fall back to the whole history.
  let range = "HEAD"
  try {
    const lastTag = git("git describe --tags --abbrev=0")
    if (lastTag) range = `${lastTag}..HEAD`
  } catch {
    // no tags reachable — keep the full-history range
  }

  const raw = git(`git log ${range} --no-merges --pretty=format:%h%x09%s`)
  if (!raw) return []

  return raw.split("\n").map((line) => {
    const tab = line.indexOf("\t")
    const hash = line.slice(0, tab)
    const subject = line.slice(tab + 1)
    const match = subject.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/)
    return {
      hash,
      subject,
      type: match?.[1] ?? null,
      scope: match?.[2] ?? null,
      description: match?.[3] ?? subject,
    }
  })
}

function renderSemanticSections(commits: ParsedCommit[]): string {
  const buckets: Record<string, string[]> = {}
  for (const c of commits) {
    if (!c.type) continue
    // Release-prep commits describe the release itself, not its contents.
    if (c.type === "chore" && c.scope === "release") continue
    const section = TYPE_TO_SECTION[c.type]
    if (!section) continue
    const prefix = c.scope ? `**${c.scope}:** ` : ""
    ;(buckets[section] ??= []).push(`- ${prefix}${c.description} (${c.hash})`)
  }

  const parts: string[] = []
  for (const section of SECTION_ORDER) {
    const lines = buckets[section]
    if (lines && lines.length > 0) {
      parts.push(`### ${section}\n\n${lines.join("\n")}`)
    }
  }
  return parts.join("\n\n")
}

function renderCommitsSection(commits: ParsedCommit[]): string {
  if (commits.length === 0) return "### Commits\n\n- (no commits since last tag)"
  const lines = commits.map((c) => `- ${c.hash} ${c.subject}`)
  return `### Commits\n\n${lines.join("\n")}`
}

function buildVersionSection(next: string, commits: ParsedCommit[]): string {
  const date = new Date().toISOString().slice(0, 10)
  const semantic = renderSemanticSections(commits)
  const blocks = [`## [${next}] - ${date}`]
  if (semantic) blocks.push(semantic)
  blocks.push(renderCommitsSection(commits))
  return blocks.join("\n\n")
}

function createChangelog(next: string, commits: ParsedCommit[]): string {
  const section = buildVersionSection(next, commits)
  const unreleasedLink = `[Unreleased]: ${REPO_URL}/compare/v${next}...HEAD`
  const firstTag = `[${next}]: ${REPO_URL}/releases/tag/v${next}`

  return [
    "# Changelog",
    "",
    "All notable changes to this project will be documented in this file.",
    "",
    "## [Unreleased]",
    "",
    section,
    "",
    unreleasedLink,
    firstTag,
    "",
  ].join("\n")
}

function updateChangelog(current: string, next: string, commits: ParsedCommit[]): void {
  const path = join(root, "CHANGELOG.md")

  // First release: create the file from scratch.
  let text: string
  try {
    text = readFileSync(path, "utf8")
  } catch {
    text = createChangelog(next, commits)
    writeFileSync(path, text)
    return
  }

  const section = buildVersionSection(next, commits)

  // Insert the new section directly after the `## [Unreleased]` heading.
  const unreleased = text.match(/^## \[Unreleased\][^\n]*\n/m)
  if (!unreleased) fail("CHANGELOG.md has no `## [Unreleased]` heading to insert under")
  const insertAt = unreleased.index! + unreleased[0].length
  text = `${text.slice(0, insertAt)}\n${section}\n${text.slice(insertAt)}`

  // Refresh the link refs at the foot: point Unreleased at the new version and
  // add a compare link for it. Falls back to appending if no refs exist.
  const unreleasedLink = `[Unreleased]: ${REPO_URL}/compare/v${next}...HEAD`
  const versionLink = `[${next}]: ${REPO_URL}/compare/v${current}...v${next}`

  if (/^\[Unreleased\]:/m.test(text)) {
    text = text.replace(/^\[Unreleased\]:.*$/m, `${unreleasedLink}\n${versionLink}`)
  } else {
    text = `${text.replace(/\s*$/, "")}\n\n${unreleasedLink}\n${versionLink}\n`
  }

  writeFileSync(path, text)
}

// --- main --------------------------------------------------------------------

const args = process.argv.slice(2)
const command = args[0]

if (!command || command === "--help" || command === "-h") {
  console.log("Usage:")
  console.log("  bun run release <major|minor|patch|x.y.z>   # bump + changelog")
  console.log("  bun run release commit                      # git add, commit, tag")
  process.exit(command ? 0 : 1)
}

// --- sub-command: commit -----------------------------------------------------

if (command === "commit") {
  const version = readCurrentVersion()
  const tag = `v${version}`

  // Gate first: never tag a release that can't build or pass tests.
  runReleaseGate()

  const status = git("git status --porcelain")
  if (status) {
    console.log(`release commit: staging and committing changed files...`)
    git(`git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md README.md`)
    git(`git commit -m "chore(release): prepare v${version}"`)
  }

  console.log(`  tagging ${tag}...`)
  git(`git tag -a ${tag} -m "${tag}"`)
  console.log(``)
  console.log(`  done — ${tag} created on current commit`)
  console.log(`  to push:  git push --follow-tags`)
  process.exit(0)
}

// --- sub-command: bump -------------------------------------------------------

const versionArg = command
const current = readCurrentVersion()
const next = computeNextVersion(current, versionArg)
if (next === current) fail(`already at ${current} — nothing to bump`)

const commits = collectCommits()

bumpJsonVersionField("package.json", next)
bumpJsonVersionField("src-tauri/tauri.conf.json", next)
bumpCargoToml(next)
bumpCargoLock(next)
bumpReadmeVersion(next)
updateChangelog(current, next, commits)

console.log(`release: ${current} → ${next}`)
console.log(`  bumped package.json, tauri.conf.json, Cargo.toml, Cargo.lock, README.md`)
console.log(`  added CHANGELOG.md section from ${commits.length} commit(s)`)
console.log(``)
console.log(`  next:`)
console.log(`    1. polish the new section in CHANGELOG.md`)
console.log(`    2. bun run release commit  (git add, commit, tag)`)
console.log(`    3. git push --follow-tags`)
