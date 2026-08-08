# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **标题字号按标题字数自适应**（用户要求"红头标题字体大小要根据标题字数多少来定"）：标题 ≤14 字用标准 2 号（22pt）；15-18 字 → 20pt；19-22 字 → 18pt；23+ 字 → 16pt。实现：`toMarkdown` 把长标题包进 `::: content.h1.style.size: …; content.h1.paragraph.letterSpacing: 0em; class: keep-together` 容器，覆盖 h1 字号。配套引擎改动（heading-builder）：h1 letter-spacing 与 `::after` 尾距补偿改为消费 `content.h1.paragraph.letterSpacing` CSS 变量（回退字格 calc）——字格 calc 以 `--content-h1-style-size` 为字号基准，字号缩小会让 calc 暴增（22pt→16pt 时 `442/20−字号` 从 +0.1pt 到 +6.1pt），必须显式覆盖为 0em 才能让长标题紧凑；`::after` 补偿用同一变量，二者始终一致。`class: keep-together` 让分页器把标题容器整块原子处理、不拆分——否则容器被解包后 `local-style-container` 类落到 h1 上，其 0,2,0 选择器压过 `.preview-content h1`（0,1,1），标题会退回正文仿宋 16pt。兼容：heading 字格未启用时（charsPerLine 缺省）不产生任何变量消费，行为不变；**默认（未覆盖）h1 渲染与之前逐字一致**，只是 letter-spacing/尾距补偿表达式变成 `var(--content-h1-paragraph-letter-spacing, calc(…))`。
- **红色分隔线（红头红线，GB/T 9704 §7.2.6）**：文件式红头（gongwen/communique，红头+文号齐全）文号下 4mm 处输出通栏红色横线。实现：markdown `---` 重新启用（`disabledSyntax` 移除 `horizontalRule`）+ 新插件 `red-rule-line` 覆写 `md.renderer.rules.hr` 渲染为 `<hr class="red-rule-line">`（renderer 输出 HTML 字符串，不受 `html:false` 限制，同 `textFontScope` 先例）；`.red-rule-line` 样式 `border-top: 2px solid #e60012; margin: 4mm 0`。红头或文号缺失时不输出。
- **上行文（请示/报告）文号居左空一字 + 签发人**（GB/T 9704 §7.2.5）：request/report 文号容器改为居左空一字（`align:left; indent:1em`），同容器第二行排"签发人：×××"，`.doc-number-line` flex 两端对齐（文号居左、签发人靠右）；下行文保持居中。schema 新增 `signer` 字段，prompt 增加上行文编排规则。
- **红头字距加宽**（GB/T 9704 §7.2.4 小标宋宽字距）：红头容器 descriptor 加 `letter-spacing: 3pt`。此前该覆盖只落到容器 DIV、未达 `p`（字格 calc 仍负值重叠红字）——已由下方"红头与文号对不齐 + 红字重叠"条目彻底修复（`p`/`p::after` 消费同一变量）。
- **红头字号放大 + 按机关名长度自适应**（用户反馈"红头字号太小、与文号拉不开差距"）：红头是整版头最醒目、字号最大的要素，此前固定 22pt（二号）与标题同号、单薄。改为按机关名长度四档递增——≤6 字初号 42pt；7-10 字小初 36pt；11-13 字 30pt；≥14 字 26pt（版心宽 ~436pt，26pt+3pt 字距 15 字仍单行放得下）。letterSpacing 随字号微调（42/36pt 用 4pt、30/26pt 用 3pt），大字号宽字距更舒展。`toMarkdown` 由固定 `RED_HEAD` 常量改为按机关名动态构建 descriptor，字号始终 > 标题 22pt > 文号 16pt，层级拉开。
- **补 5 个法定公文文种**：按《党政机关公文处理工作条例》（中办发〔2012〕14号）15 文种补齐——新增 `resolution`（决议）、`order`（命令/令）、`gazette`（公报）、`communique`（通报）、`proposal`（议案），DOC_TYPES 从 9 扩到 14。全链路单源扩展：`types.ts` 枚举 + `doc-type-spec.ts`（name/promptRequirement/rules/formFields/sealDefault）+ `prompt.ts` 示例输出 + i18n（zh/en）+ 表单要素集。文种特性：命令文号用顺序号"第×号"（无年份括号）、决议/公报无文号、公报无主送机关、议案主送必填单一、通报用文件式红头。
- **发文字号年份检查豁免命令文种**：命令（令）文号为顺序号"第×号"，`DOC_NUMBER_YEAR_MISSING` 不再误报。
- **决议标题长度上限放宽到 50 字**：决议标题须写明通过决议的会议名称（"××市第×届人民代表大会第×次会议关于批准××报告的决议"），30 字上限必然误报，放宽到 50；其余文种维持 30。
- **发文字号与红头之间空二行间距**（GB/T 9704 §7.2.5）：有红头时文号容器加 `spacing.before: 57.9pt`（2 × 3 号行高），无红头文种（意见等）不受影响。
- **事务文书家族规划（未实现）**：用户提出"文种不够，想加讲稿/主持词这类"。已调研确认**事务文书无国家法定标准**（中办发〔2012〕14号只管 15 法定公文，讲稿/主持词不受条例管辖，格式靠工具书惯例 + 机关内模板，版式托底 GB/T 9704）。规划落盘 `docs/事务文书家族规划.md`：独立 `PracticalDocType` family（共享版式、剥离红头/文号/版记/密级），首期 3 文种（讲话稿/主持词/工作总结），交付形态建议"模板引导"而非自由生成。待产品决策。

### Fixed

- **红头与文号水平对不齐 + 红字重叠（用户反馈"通知的红头和文号对不齐"根因）**：字格 letter-spacing 规则（body-builder）把 `letter-spacing: calc(版心宽/28 − 字号)` 和 `::after` 尾距补偿 `calc(-1 × …)` **硬编码**在 `p`/`p::after` 上，容器 descriptor 的 `content.body.paragraph.letterSpacing` 覆盖只落到 `.local-style-container`（DIV）不达 `p`。红头把字号提到 36-48px 后 calc 变负（48px 下 −26.94px），红字重叠；`::after` 尾距补偿仍按负 calc 往右推半字距（+26.94px 的负 margin-right），居中行整体被压偏 13.5px——正是红头与文号错位的量（文号 16px 字号 calc 近零、无此问题）。修复：`p` 的 letter-spacing 与 `p::after` 的 margin-right 均改为消费 `--content-body-paragraph-letter-spacing` 变量（回退原字格 calc），与 heading-builder 对 h1 的处理同构；变量未设置时行为与之前逐字一致（回退 calc）。红头 4pt 覆盖现在真正生效：实测红头 `p` letter-spacing 由 −26.94px 变 +5.33px，9 字 48px 红头 glyph 宽 189.5→480px 不再重叠，视觉右缘扣除尾距后中心 = 版心中心，与文号 offset 归零。
- **存量用户持久化规则仍带 `horizontalRule`、红线持续不渲染**（上条修复的遗漏）：rule-store 的 rehydration 对 `ruleOrigin === "custom"` 的持久化规则**原样保留**（loadRule(saved) 早退），不上拉新 builtin——所以上一条 yaml 修复只对"规则恰好仍等于 builtin（含旧版无 ruleOrigin）"的存量用户生效，已改过规则的 33476 用户重启后 `horizontalRule` 仍在 `disabledSyntax`，`---` 依旧被禁用。修复：`initializeRule` 新增 `migratePersistedRule`，在 zod 校验通过后、custom 早退前把持久化规则里的 `horizontalRule` 从 `disabledSyntax` 剔除（deep clone 后就地删，不污染原对象、不改动用户其他配置），对全部持久化规则生效——包括 custom。测试：rule-store.test 新增"custom 分类的持久化规则仍迁移 horizontalRule、保留用户手工字号"。用户需 Ctrl+Shift+R 硬刷新（dev 模式）或重启应用读取新代码。
- **机关代字与红头机关名不匹配（GB/T 9704 §7.2.5）**：红头"国务院办公厅文件"+ 文号"国发〔2026〕15号"——国发=国务院、国办发=国务院办公厅，LLM 常混用，`checkFormat` 此前完全不校验。修复：新增 `org-code.ts`（机关名↔代字映射表，含国务院/国务院办公厅/部门/省市政府占位），`matchOrgCode` 三级判定（机关名精确匹配→代字必须一致；机关名未知但代字匹配→校验机关名；两者未知→不误报），`checkFormat` 接入 `ORG_CODE_MISMATCH`（error 级）。**反向校验链路**：要素编辑面板改 docNumber/issuingOrg → `applyEdit` → `reviewDocument` 重跑格式自检 → 不匹配在结果面板弹出提示。
- **落款背页 + 版头独占一页（分页）**：① 落款（署名+日期）被甩到单独空白页——分页器对落款容器解包成独立块、可在署名与日期之间断页。修复：落款容器标 `class: keep-together`，`collectBlocksFromNode` 对 keep-together 容器整体成块不解包、`trySplitOversizedBlock` 拒绝拆分，溢出时先收紧行距重试（`tightenKeepTogetherBlock`）再换页。② 版头独占首页——分页器无条件 H1 换页规则（`isH1Block && currentPageHtml.length > 0 → pushPage`）把标题 H1 永远推到次页。修复：移除该规则，H1 放得下时与红头/文号/分隔线同页、放不下才换页。③ `local-style-container` 新增 `class:` 描述符段类型（提取到容器 class，非 CSS 变量）。
- **红头与发文字号成对检查（反向缺失）**：原先只查"有文号无红头"，漏了"有红头无文号"——LLM 只给红头不发文号时（如"××市人民政府文件"下面直接是标题）检查放行。修复：`checkFormat` 新增 `RED_HEAD_WITHOUT_DOC_NUMBER`（红头下应空二行排文号，error 级）；红头成对检查限定文件式红头文种（gongwen/communique），意见/请示/批复/函/决议/命令/公报/议案等无文件式红头文种不误报。
- **标题开头重复红头发文机关名**：LLM 常把机关名写进标题（"重庆市人民政府关于印发《×××》的通知"）与红头"重庆市人民政府文件"视觉重复。修复：`repairDoc` 新增 `stripOrgNameFromTitle`——标题最开头与红头机关名（剥"文件"后缀）完全匹配、且后续为公文标题动词时剥除；绝不剥标题中间机关名、后续非公文动词不剥（防误剥）。配套：prompt 新增"标题严禁包含发文机关名称"指令。
- **红头推导扩展到通报文种**：`repairDoc` 的 `inferRedHeadFromIssuer` 原来只对 gongwen 推导红头，现在通报（communique，同为文件式红头）也支持；决议等无文件式红头文种不推导。
- **AI 生成/导入后语法糖排版代码不折叠**：`replaceDocument`（AI 生成/导入/store 回灌的整篇替换唯一入口）替换全文后 CodeMirror 不重算 fold，新内容里所有 `:::` 容器全部展开显示排版代码。修复：`replaceDocument` 在替换后按 `showLayoutCode` 设置重新折叠/展开。
- **发文字号顶在版心首行（红头缺失）**：prompt 原引导"issuingOrg 一般不填以免与标题红头重复"，LLM 常不生成红头 → 文号成为第一个块顶格居中。三处修复：① prompt 改为"有发文字号必填红头"；② `checkFormat` 新增 `DOC_NUMBER_WITHOUT_RED_HEAD`（有文号无红头 → error）；③ `repairDoc` 兜底——有文号无红头但有发文机关署名时，按 GB/T 9704 §7.2.4 推导红头为"署名+文件"（会议纪要版头为"××会议纪要"，不适用文件式红头，排除）。
- **抄送混进正文未入版记**：LLM 把"抄送：××"写进正文末段。修复：`repairDoc` 新增 `extractCcParagraph`——整段以"抄送："开头或收尾语（特此通知等）紧跟"抄送："时提取到 cc 字段并从正文移除；cc 已有条目或"抄送"出现在普通句子里（前文非收尾语）时不提取。
- **加号（新建文档）按钮无效果**：工具栏派发 `document.dispatchEvent` 但 App 监听 `window`，CustomEvent 默认 `bubbles:false` 到不了 window → 点击静默无反应。改为 `window.dispatchEvent`。
- **"一级标题设置没了"整组修复**：① 工具栏"一级标题"按钮原本插入 `# `（引擎红头/文题，22pt 居中无编号），改为插 `## `（引擎 h2，16pt 黑体 + 自动"一、"序号），符合公文正文一级标题语义；② 设置搜索命中盲区——导航 label"标题 H1"与产品词"一级标题"脱节，统一改为"一级标题/二级标题/三级标题/四级标题"，搜"一级"可命中；③ 手写 `## 一、标题` 渲染双号"一、一、标题"，heading 处理器新增 `alreadyNumbered` 前缀识别，手动已带序号的标题不再重复加号。
- **持久化规则校验失败静默整条重置（HIGH）**：localStorage 规则含非法字段（如 `weight:""`、无单位数字）时，启动静默清空用户全部标题层级/字体配置并换内置规则，表现为"设置都没了"。修复：reset 前把损坏 JSON 备份到 `ezdoc-rule-poisoned`（用户可找回手工重建），回退内置规则并弹 toast 明确告知已回退到哪条规则。
- **AI 生成必填校验不指认缺失字段**：表单必填缺失只报通用文案。修复：`FORM_REQUIRED_*` 错误现在逐条列出缺失的必填字段（标题/主送机关等）。
- **LLM 返回空/非法 JSON 误报"服务配置错误"**：`LLM_INVALID_RESPONSE` 无专条落入通用回退，误导用户去查 API Key/网络。补映射为"AI 未返回有效内容"。
- **设置保存失败吞具体原因 + 成功无反馈**：catch 只显示"保存失败"；现在透传 `loadRule` 抛出的字段路径（如 `Invalid rule: ...`），成功加"已保存并应用"toast。
- **navigator.share 泄露全文 HTML**：分享同时把整篇公文 HTML 塞进 `text` 字段（明文出现在系统"文本"目标，超大内容致 Android 分享失败）。移除 `text`，仅分享 `files`；并以 `navigator.canShare({files})` 能力检测替代 UA 正则（iPadOS 13+ 桌面 UA 不再误判）。
- **工具栏格式按钮点击后不回焦编辑器**：点击 `<button>` 使 DOM 焦点离开编辑器，后续打字/Ctrl+Z 失效。`format()` 执行成功后 `view.focus()` 回焦。
- **A4Paper fitScale 负值闪跳**：clientWidth 为 0 时 fitScale 算出负值让预览消失；clamp 到 0.1，并用 ResizeObserver 替代 window resize 监听。
- **要素编辑面板回填丢用户正文修改**：patchMarkdownElements 按槽位替换丢新增段，重写为整体区域替换（要素区重建自 IR 快照、正文区保留编辑器当前内容）。
- **工具栏标题按钮无激活态指示**：光标移到某级标题行时对应按钮无视觉反馈，用户无法确认当前所在层级。修复：CodeMirror 新增 `onActiveHeadingChange` 回调（selectionSet/docChanged 时上报当前行 `#` 数量），App 经 Toolbar 传给 FormatButtons；h1/h2/h3 按钮（对应 `##`/`###`/`####`）命中层级时切换 `secondary` variant + `aria-pressed`。
- **autoSave=false 时内容仍无条件写 localStorage**：persist 在每次编辑落盘，开关只控制定时清 dirty flag，语义失真。修复：custom storage 在 autoSave=false 时抑制普通编辑写盘（保留已落盘旧值），显式 Ctrl+S 放行一次。
- **768–1024px 分割条 inert 死区**：useSplitPane 内部断点 1024 与 App 移动断点 768 不一致，该区间渲染分栏却拖不动。修复：split-pane 复用 useIsMobile() 同一断点。
- **持久化 rule 空串 index 落"隐藏禁用"路径**：UI 清空 index 写 `''`，与文档化 null=suppress 语义分叉。修复：`normalizeHeadingIndex` 把空串/空白归一为 `0lines` 禁用哨兵。
- **移动端工具栏 18 按钮 flex-wrap 挤压编辑区**：11 个格式按钮在窄屏折成多行。修复：移动端把格式工具收进单个"格式"下拉（保留标题层级激活态指示），桌面端保持平铺。
- **移动端预览首帧闪跳 + tab 重挂载重分页**：fitScale 初始 `useState(1)` 以 scale=1 渲染超宽纸面再被 effect 修正；切 preview tab 卸载重挂载导致整篇重分页 + 丢滚动位置。修复：初始 fitScale 按视口宽度估算；预览面板改为始终挂载、display:none 隐藏切换。
- **saveRule 对非当前规则静默 no-op**：校验通过但不持久化还返回成功，配置静默丢失。修复：返回 `valid:false` + 明确 errors/issues 说明未持久化。
- **AI 生成覆盖确认被绕过（HIGH，第 3 轮审查）**：OPEN_AI_EVENT 守卫只 `preventDefault` 不 `stopPropagation`，非空白文档点「AI 生成」会同时弹覆盖确认与生成对话框（双弹窗）；且对话框内「生成」按钮直连 `generate()` 写 store，完全不经守卫——手动微调后一次生成即静默覆盖。修复两处：① guard 加 `stopImmediatePropagation` 消除双弹窗；② 覆盖保护下沉到写入点——`generate()` 在文档非空白时返回不写 store，对话框内点生成先弹覆盖确认，「覆盖」按钮带 `force` 显式放行。
- **AI 生成模块级 lastResult 跨文档会话泄漏（MEDIUM）**：`lastResult/lastIssues` 模块级保留"最近一次生成"，导入/新建别的文档后重开弹窗，编辑面板显示旧文档要素，`applyEdit` 把旧要素结构静默拼进新文档。修复：新建/导入入口调用 `resetGenerateSession()` 清空跨会话结果。
- **newDocument 后空白文档误报"未保存"（MEDIUM）**：App 同步 effect 用相同内容再调 `setContent`，doc-store 无条件 `set({isDirty:true})` 把新建后已清空的 dirty 标志复位。修复：`setContent` 值未变化时跳过置脏。
- **设置页 Esc/遮罩点击绕过 closeIfClean（MEDIUM）**：Esc/遮罩点击走 `onOpenChange(false)` 直接卸载面板，未保存的设置草稿静默丢弃（与「取消」按钮弹确认不一致）。修复：`onEscapeKeyDown`/`onPointerDownOutside` 路由到 `closeIfClean` 走脏检查。
- **LLM_INVALID_RESPONSE 误用"生成内容为空"文案**：非法 JSON 响应显示"AI 未返回有效内容"误导。修复：新增 `llmInvalidResponse` 专属文案（zh/en）。

### Notes

- **文秘红头验收 backlog（`workflow-wenshu-red-head` 结论）**：修复项已在上文 Fixed/Added 落地（红头成对反向检查、标题去机关名、通报红头推导、空二行间距、命令/决议检查豁免、**红色分隔线、机关代字匹配、上行文签发人、落款背页/版头独占页、红头字距**）。**遗留 2 项未做**，排期待定：① **版记生成缺口**——LLM 生成 docs 的版记（抄送/印发机关/印发日期）字段齐全，但 `toMarkdown` 版记容器渲染与理想态仍有差距（印发机关/日期表述格式未完全对齐），后续版记专项对齐；② **意见红头门控扩展**——红头成对检查目前只门控 gongwen/communique 文件式红头，个别单位意见用"××文件"红头时会漏检，是否扩展门控范围属产品决策。

## [0.1.9] - 2026-08-08

### Added

- **移动版 Tier A**：<768px 视口自动切换编辑/预览 tab（替代桌面分栏），编辑与预览互斥全屏展示。
- **移动端纸面自适应**：210mm 纸张在窄屏等比缩小适配视口宽度，预览不再横向溢出。
- **移动端导出**：支持 Web Share API（navigator.share 分享导出 HTML），分享面板可直接转存/打印；不支持的浏览器回退打印新窗口。
- **移动端触控体验**：工具栏按钮加高（≥40px 触控目标）、去掉分栏拖拽留白。

### Notes

- **Android 原生包（APK）暂不可构建**：`tauri android init` 需要 JDK/Android SDK，本机无 Java（已检查 Android Studio jbr、Program Files/Java、Eclipse Adoptium 均无 JDK）。移动版先以**响应式 Web** 形态交付（`bun run dev --host` + HTTPS 即可在手机浏览器使用）；APK 需在有 JDK/SDK 的机器上执行 `tauri android build`。

### Commits

- c6455b2 feat(mobile): 移动版 Tier A —— <768px 编辑/预览 tab 切换 + navigator.share 分享导出

## [0.1.8] - 2026-08-07

### Added

- 生成结果覆盖确认：已生成过文档时再次生成，先弹确认框，避免误覆盖手写内容。
- 关闭前未保存提醒：自动保存关闭且有未保存改动时，退出/切换前弹确认。
- docx 文件导入、布局代码显隐开关（LayoutCodeToggle）等桌面端体验补齐。

### Fixed

- **逻辑审查第 2 轮**：修复引用缓存陈旧（跨块引用定义不同步）、红头锚误判、生成覆盖无确认。
- **折叠回归**：语法糖折叠启用不再连带折叠 markdown 标题（此前长文档整篇被折没）。
- **数值长度字段**：无单位数字（`size: 16`）不再因校验与 schema 不一致而保存失败、重启丢规则。
- **Windows 发布脚本**：Cargo.lock CRLF 行尾导致发布版本号刷新半程失败。
- **发布安全**：发布门禁构建改用空 LLM 环境变量，避免 dev `.env` 里的真实 API key 被 Vite 打进 release 产物。

### Commits

- 504090b fix(release): bumpCargoLock 匹配 CRLF 的 Cargo.lock，避免 Windows 发布脚本半程失败
- 4e16c7d fix: M-7 折叠启用时整篇文本消失（foldAll 连带折叠 markdown 标题）
- bf6e8ae fix: M-2 无单位数字长度字段过 zod 却挂 validateRule，重启静默丢用户规则
- 292105c fix: 第2轮对抗审查 P0 三项（覆盖确认守卫 / 红头锚误判 / 引用缓存陈旧）
- f129a08 feat: 关闭前确认（autoSave 关闭且有未保存改动时提醒）
- dde42d7 fix: 文秘验收必修项（覆盖确认接线 + 发文字号位置 + docx/LayoutCodeToggle 接线）
- 826414c feat: 大发布 Wave 1 并行修复（产品 P0 / UI / 逻辑遗留 / 折叠 / 分页 / docx / 撤销）

### Fixed

- **落款排版（不盖章）**：发文机关署名不再居中，改为与成文日期一致右对齐、右空四字（GB/T 9704 §7.3.5.2）。
- **AI 生成错误码渲染为裸 key**：LLM_TIMEOUT / LLM_NETWORK_ERROR / LEGAL_DOC_* 等错误码不再原样显示英文代码，统一经 errorCodeToI18nKey 映射为中文提示（死代码恢复调用）。
- **成文日期真实性校验**：L1 审查与落款渲染共用 isValidIsoDate（月 1-12、日按当月实有天数），拦截 2026-13-40 类越界日期。
- **空标题幽灵红头**：标题为空时输出可见占位"# 未命名公文"，不再产生空红头行。
- **导入 YAML 无引号数值类型漂移**：CSS 长度/行高/段距的数值标量（16 / 1.5）归一化为字符串，消除导入-保存-导出 round-trip 类型分叉。
- **设置页导入报错误导**：区分 YAML 语法错误与 schema 校验错误，分别显示明确文案，不再笼统"导入失败，请检查文件格式"。
- **设置页未保存直接关闭静默丢弃**：取消前比较 draft 与 stores 快照，存在差异弹确认框（放弃/继续编辑）。

### Notes

- **设置页架构约束（防退化）**：设置页保持 schema-driven 导航模型（section 由 RuleConfig descriptor 树派生）＋ 独立的 Editor section。**"AI 服务"是唯一硬编码特例**：`nav-sections.ts` 直接 push 一个 fields 为空的 section，由 `AiSettingsForm` 渲染，其配置值（`llmApiKey/llmEndpoint/llmModel`）搭 `SettingsDraft.editor` 载体传输。约束：**不再新增硬编码 section**；AI 配置若继续增长，给 `SettingsDraft` 拆独立 `ai` 字段，而非继续膨胀 `editor` 载体。避免特例蔓延成垃圾代码。
- **bug 审查 workflow 结果**（22 agent 全模块通读 + 对抗验证，2026-08-02）：6 条确认缺陷全部修复（见上 Fixed）；46 条初筛发现中 6 条为误报（对抗验证排除），其余为 low/建议。遗留 v2 再说项：rule schema 与 validateRule 校验器统一、设置页 AI section 可搜索化、Pagination CSS variables 定义权归属。
- **回捞存档丢失的调研成果**（2026-08-08）：产品审查（31 反馈→25 主题，P0/P1/P2）与 GB/T 9704 审计 + UI/逻辑/Rust 三路审查曾只存在于会话上下文，压缩后丢失；已从会话 transcript 逐字回捞，落盘为 `docs/产品审查报告.md` 与 `docs/审计与三路审查报告.md`。其中审计 26 条提案的 implementable-now 项已在 054724e 落地（见系统实现说明），needs-engine 项（分隔线/附件另面/签发人/信函命令/横排表格页码/纪要混合字体）留作引擎能力扩展排期参考。教训：多 agent 大报告产出后必须立即落盘，不能只留在会话里。

## [0.1.7] - 2026-08-01

### Fixed

- **ai-service:** 安装包默认走 DeepSeek，而非 OpenAI (f157aba)

### Commits

- f157aba fix(ai-service): 安装包默认走 DeepSeek，而非 OpenAI

## [0.1.6] - 2026-08-02

### Added

- **设置页 AI 服务独立导航**：LLM API Key 从"编辑器与预览"里拆出来，成为左侧导航的独立入口。
- **首次运行默认打开 AI 服务**：本机未配置过 API Key 时，设置页一打开就落在 API Key 输入框上，内测用户不会再找不到"填 key 的环节"。

### Changed

- 已配置过 API Key 的老用户打开设置仍落在"基础"，行为不变。

### Commits

- e821733 feat(settings): AI 服务独立导航入口 + 首次运行默认打开 API Key

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

[Unreleased]: https://github.com/Brianbling/gov-draft/compare/v0.1.9...HEAD
[0.1.9]: https://github.com/Brianbling/gov-draft/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/Brianbling/gov-draft/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/Brianbling/gov-draft/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/Brianbling/gov-draft/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/Brianbling/gov-draft/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/Brianbling/gov-draft/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/Brianbling/gov-draft/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Brianbling/gov-draft/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Brianbling/gov-draft/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Brianbling/gov-draft/releases/tag/v0.1.0
