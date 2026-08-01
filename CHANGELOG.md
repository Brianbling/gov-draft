# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.5] - 2026-08-01

### Added

- **设置页 AI 服务**：新增 LLM API Key 输入框，key 仅存本机（localStorage），生成时运行时传给 Rust 侧，不打包进安装包（内测分发安全）。
- **表单辅助 + 要素编辑面板**：分文种要素集（9 文种差异化填入项）、按需盖章默认、生成后编辑面板实时回填 markdown。
- **AI 描述栏**：多行 textarea + 分文种引导语。

### Changed

- **审查管线**：单一事实源 DocTypeSpec（prompt 与 L2 规则共用一份文种知识）、保守修复带（repairDoc：补主送机关冒号、提取附件段、统一文号六角括号）、severity 分级。
- **落款排版**：盖章/不盖章双布局（GB/T 9704 §6.4）——盖章右对齐预留骑年盖月印章空间、不盖章署名居中成文日期右空四字；移除"（此处加盖公章）"占位文字。
- **附件逻辑**：多附件续行按 §7.3.4 对齐、附件识别增强（"附件1：""附件2．"变体）。
- **页码定位**：GB/T 9704 §7.5 版心参照系修正。
- **端口 1420→1421**：错开 v1。

### Fixed

- **标题误拦**：标题不再作为生成前表单必填（此前填了任意表单字段就触发全部必填校验，导致"写个通知老是不给过"），缺失由生成后 L1 审查 TITLE_EMPTY 兜底。

### Commits

- 927d3ee fix(ai-generate): 标题不再作为生成前表单必填，消除误拦
- ec0c569 fix(legal-doc): 公章占位移除 + 盖章/不盖章双落款布局 + 附件识别增强
- b5dee34 feat: 设置页新增 LLM API Key 输入（localStorage，运行时传 key，不打包进 bundle）
- 132ce45 chore: 开发端口 1420→1421，错开 v1 的 tauri dev
- c7f8ee5 feat: 描述栏改造为多行 textarea + 分文种引导语 + 9 文种差异化填入项
- dd81090 feat: 要素编辑面板（v2 增量3）+ 编辑面板联动修复（增量4）
- bf1ab64 fix: 页码定位修正 GB/T 9704 §7.5（版心参照系 + 垂直7mm + 行高归位）
- 6d0fbe1 feat: AI 生成对话框表单辅助 + 自然语言双适配器（v2 增量2）
- 7ff8f7d feat: 分文种要素集 + 按需盖章默认（v2 表单辅助基础）
- 9ad8660 fix: 页码标准对齐 GB/T 9704 §7.5（单页右双页左 + 4号宋体 + 空一字）
- 0c8a5fe fix: 审查复核的 8 处边界修复（附件一致性/附件拆分/severity/日期）
- 045a277 feat: 单一事实源 DocTypeSpec + 保守修复带 + UI 优化

## [0.1.4] - 2026-07-25

### Added

- **pdf:** browser export support and chromium availability detection (2ef76f5)

### Commits

- 2ef76f5 feat(pdf): browser export support and chromium availability detection

## [0.1.3] - 2026-07-25

### Added

- **Settings**: redesigned in-window overlay with schema-driven nav, collapsible content groups, search, and YAML import/export with embedded editor/preview/autoSave config.
- **PDF export**: headless Chromium rendering via CDP, file dialog integration, page number support, and error-code to i18n mapping.

### Fixed

- PDF: box-sizing reset in export CSS to prevent layout drift; correct page number inclusion; Windows-compatible `file://` URL construction.

### Commits

- 655ecbc feat(settings): polish nav UI, add collapsible groups, and YAML import/export
- da5fe7b feat(settings): move settings in-window and redesign the rule editor
- 95cefdd fix(pdf): include page numbers in exported PDF
- 71ff331 fix(pdf): add box-sizing reset to export CSS and drop dead page_size arg
- 12586fd feat(pdf): wire Export PDF into the file menu
- 19f44c0 test(pdf): cover .paper-stack scoping excludes hidden measure sheet
- dee7cef feat(pdf): add use-pdf-export hook and page collection
- 50619e4 feat(pdf): add dialog plugin and save capability
- a23fc12 fix(pdf): build file:// URL with Url::from_file_path for Windows correctness
- b273f2d feat(pdf): implement headless Chromium rendering via CDP save_pdf
- 7ed22a7 feat(pdf): implement Chromium path detection with tests
- e55270a feat(pdf): scaffold Rust pdf module, deps, and command registration
- 0b08969 feat(export): add PDF error-code to i18n mapping and messages
- ab39556 style(export): format buildExportHtml files with prettier
- cf24782 feat(export): add buildExportHtml pure function for PDF assembly

## [0.1.2] - 2026-06-21

### Added

- Rich editing in the CodeMirror pane: syntax highlighting, in-editor search, auto-pairing of brackets/quotes, active-line highlight, and a formatting toolbar (bold, headings, lists).
- A bottom status bar showing live word and character counts.

### Changed

- The toolbar is now responsive — it wraps instead of clipping when space is tight — and import/export are grouped under a single File dropdown menu. Word/character counts moved out of the toolbar into the new status bar.
- Restructured the editor's `codemirror/` directory into a `core/` layout and added `@codemirror/search`.
- The Tauri window now enforces a minimum size (1100×700) so the toolbar always renders fully.

### Fixed

- CodeMirror vertical scrolling now works with a visible scrollbar.
- Components comply with the `index.css` design tokens.

### Commits

- 3315369 feat(editor): responsive toolbar, file dropdown menu, and status bar
- dd743e7 feat(editor): add syntax highlight, search, auto-pair, active-line, format toolbar
- 5c8e463 refactor(editor): restructure codemirror/ into core/ and add @codemirror/search
- f27383b fix(editor): add visible scrollbar and fix CodeMirror vertical scrolling
- 435617f fix(theme): enforce index.css design token compliance across components

## [0.1.1] - 2026-06-19

### Performance

- Faster incremental editing: the parser now caches block-level tokens and reuses them across edits, and skips the linkify scan entirely on documents with no links.

### Fixed

- Page splitting now keeps partial trailing text that follows inline elements, so content no longer drops at page boundaries.
- Release workflow: the summary step is pinned to bash so it runs identically on all platforms (previously failed on Windows runners under PowerShell), and the linkify optimization now builds cleanly under `tsc -b`.

### Commits

- 680693c fix(parser): type fast-linkify access to markdown-it private __rules__
- 374549b fix(ci): run release summary step with bash on all platforms
- 800c8f7 perf(parser): add block-level token cache for incremental markdown parsing
- 01e0131 perf(parser): skip linkify scan on link-free documents
- bb49fe1 test: audit and improve test coverage across all modules
- 522e6fb fix(paginator): include partial trailing text after inline elements during page split

## [0.1.0] - 2026-06-10

First release of ezdoc — a Tauri + React Markdown-to-styled-document editor.

### Highlights

- **Typesetting engine**: Pure TypeScript engine migrated from gov-draft with a pipeline architecture (compiler: token generation → rule builders → CSS serialization; parser: preprocess → markdown-it → token process → render → postprocess). Rule config validated via Zod schemas. Built-in YAML rules include GB/T 9704 and other typographic standards.
- **Split-pane editor**: CodeMirror 6 editing area + A4 paper preview, with draggable split ratio and a toolbar for common Markdown operations (bold/italic/headings/lists).
- **Paginated preview**: Automatic page-splitting algorithm driven by rule config, with precise pagination based on charsPerLine and line height.
- **CJK character-grid layout**: Fixed-width character-grid typesetting for Chinese typography via charsPerLine configuration.
- **i18n**: react-i18next with built-in Chinese and English UI. Engine error codes are mapped to user-readable messages in the UI layer.
- **State management**: Zustand stores (document content, rule selection, editor settings) integrated with the engine via React hooks.

### Fixes

- Fix paginator page-splitting accuracy and pagination position calculation
- Fix heading style index not correctly derived from rule content.style.index
- Fix builtin-rules: missing charsPerLine, quote/book-title font configuration
- Fix TypeScript compilation errors under erasableSyntaxOnly strict mode

### Commits

- 56a5ebf fix: resolve TypeScript compilation errors under erasableSyntaxOnly
- 4e6a7cd chore: bootstrap project infrastructure
- 743d358 fix(paginator): improve page splitting accuracy and pagination position
- ef191e8 fix(parser): derive headingStyles from rule content.style.index
- 126c710 fix(builtin-rules): add charsPerLine, fix quote/book-title fonts, update pagination
- 7b89588 feat(engine): add CJK character-grid letter-spacing via charsPerLine
- 0a31834 feat(app): integrate editor and preview with split pane
- 2dcc120 fix(toolbar): optimize subscriptions, improve accessibility
- 9550b2f fix(editor): prevent stale onChange closure and remove no-op theme
- c411a57 feat(editor): add Toolbar component, fix locale interpolation to react-i18next double-brace syntax
- ff0e551 feat(preview): add A4Paper preview component with pagination
- a4970d3 feat(ui): generate shadcn input, label, checkbox, select, sheet components
- f41ec7c feat(editor): add CodeMirror React editor component
- 7685d0e fix(hooks): fix split-pane style leak, file-system dep churn, paginator clamp/cleanup, lazy parser init
- 96f6a14 feat(hooks): add engine + store integration hooks
- 3c9dde5 fix(stores): guard rule hydration and dedupe settings defaults
- 3624f10 feat(stores): add rule, doc, and settings Zustand stores
- 4f18527 refactor(locales): drop SSR guards, dedupe locale resolution
- 321d05d feat(app): set up react-i18next with ported gov-draft locales
- bc70973 feat(app): install i18n/zustand deps and copy error-messages mapping
- 7d8bccb fix(engine): resolve lint errors in parser pipeline
- f63a28e refactor(engine): pipeline architecture, validator factory, HostSelectors injection, parser pipeline, pure-function API
- 0da19ff feat(engine): migrate engine layer from gov-draft with green test baseline
- 6a6449c feat: initial commit

[Unreleased]: https://github.com/Brianbling/gov-draft/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/Brianbling/gov-draft/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/Brianbling/gov-draft/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/Brianbling/gov-draft/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Brianbling/gov-draft/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Brianbling/gov-draft/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Brianbling/gov-draft/releases/tag/v0.1.0
