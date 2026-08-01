# gov-draft 公文排版系统

[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/Brianbling/gov-draft/releases)
[![Version](https://img.shields.io/badge/version-v0.1.6-blue)](https://github.com/Brianbling/gov-draft/releases)
[![Bun](https://img.shields.io/badge/built%20with-Bun-fbf0df?logo=bun)](https://bun.sh)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-ffc131?logo=tauri)](https://v2.tauri.app/)
[![shadcn/ui](https://img.shields.io/badge/built%20with-shadcn%2Fui-000000?logo=shadcnui)](https://ui.shadcn.com/)

**AI 一键生成 + 标准公文排版**。输入一段需求描述，一键生成格式正确的党政机关公文；用 Markdown 写作，按 GB/T 9704 标准实时预览 A4 纸面效果并导出。

大模型只负责内容，格式由排版引擎保证。

## 核心特性

- **自然语言生成公文**：描述需求，LLM 直接产出符合 GB/T 9704 精神的公文，支持 9 种文种（通知 / 决定 / 意见 / 请示 / 报告 / 批复 / 函 / 会议纪要 / 通告·公告）。写错文种时审查管线给出规范化提示。
- **排版引擎保证格式**：GB/T 9704-2012 版式参数已编译进引擎（页边距 上 37 / 下 35 / 左 28 / 右 26 mm，正文 3 号仿宋，标题 2 号小标宋，一级标题黑体、二级标题楷体，行距约 28pt / 每页 22 行每行 28 字，页码 4 号半角宋体阿拉伯数字、数字左右各一条一字线、单页码居右空一字双页码居左空一字）——LLM 只负责内容，格式由引擎保证。
- **三层审查管线**：L1 结构（标题/发文字号/密级/紧急程度/日期/空段）→ L2 文种规范（按《党政机关公文处理工作条例》第八条逐文种校验，自动检测"请示漏批示语""报告夹带请示用语""函用命令语气""通告误填主送机关""附件与正文不一致"等问题）→ L3 标点文字规范（按 GB/T 15834 全角化，半角引号成对转中文弯引号等自动修复）+ 保守修复带（repairDoc：补主送机关冒号、提取附件段、统一文号六角括号）。
- **实时 A4 预览 + 导出**：Markdown 写作 → 实时分页 A4 预览，导出 HTML / PDF。
- **桌面应用，本地优先**：Tauri 2 桌面壳，AI 生成走 Rust 侧调用（API key 不进前端 bundle），本地文档自动保存。

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | [Tauri 2](https://v2.tauri.app/) (Rust) |
| 前端 | React 19 + TypeScript + Vite |
| UI | shadcn/ui + Tailwind CSS 4 |
| 编辑器 | CodeMirror 6 |
| 状态管理 | Zustand |
| 排版引擎 | 纯 TypeScript（无 UI 依赖） |
| 测试 | Vitest + Testing Library |

## 快速开始

项目使用 **Bun** 作为包管理器。

```bash
# 安装依赖
bun install

# 启动 Vite 开发服务器（端口 1420）
bun run dev

# 启动完整 Tauri 桌面应用（自动启动 Vite）
bun run tauri dev
```

运行测试：

```bash
bunx vitest run        # 运行全部测试
bunx vitest            # 监听模式
```

其他常用命令：

```bash
bun run build         # 类型检查 + 生产构建
bun run typecheck     # 仅类型检查（tsc --noEmit）
bun run tauri build   # 打包桌面应用
bun run lint          # ESLint 检查
bun run format        # Prettier 格式化
bun run release       # 发布脚本（tag 驱动，推送 v* tag 触发 GitHub Actions 跨平台构建）
```

## 目录结构

```
├── src/
│   ├── engine/          # 排版引擎（纯 TS）：GB/T 9704 / GB/T 33476 规则编译为 CSS、Markdown 解析、校验
│   ├── lib/legal-doc/   # AI 公文生成：LegalDoc schema + prompt + 生成链路 + 三层审查管线
│   ├── lib/llm.ts       # LLM 接入（Tauri + 浏览器双模式，API key 经 Rust 侧，不进前端 bundle）
│   ├── components/      # 编辑器（CodeMirror）、A4 预览、设置面板、AI 生成对话框
│   ├── stores/          # Zustand 状态（doc / rule / settings）
│   └── hooks/           # 业务 hooks（分页、导出、生成、自动保存等）
├── src-tauri/           # Tauri 2 桌面壳（Rust）：窗口管理、LLM HTTP 调用、PDF 导出、外部链接拦截
├── bench/               # 引擎基准测试（tinybench）
└── docs/                # 设计文档与开发日志
```

## 开发注意

- **AI 生成配置**：`.env` 中配置 `VITE_LLM_ENDPOINT` / `VITE_LLM_API_KEY` / `VITE_LLM_MODEL` 注入 LLM 的 endpoint / key / model（Vite 把 `VITE_*` 前缀变量注入 `import.meta.env`）。`.env` 已被 `.gitignore` 排除，切勿提交密钥。
- 路径别名 `@/` → `src/`；引擎层禁止导入 `lib/`、`hooks/`、`stores/`、`components/`。
- 发布流程：推送 `v*` tag 触发 GitHub Actions 跨平台构建（Windows / macOS / Linux）。
