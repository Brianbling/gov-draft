import type { ParserConfig } from "../../../schema"
import type { MdPluginWithOptions } from "../../types"

/**
 * 红色分隔线（红头红线，GB/T 9704 §7.2.6）：版头红色横线，位于发文字号下
 * 4mm 处、通栏。markdown `---` 默认被禁用（gb-t-9704.yaml disabledSyntax
 * horizontalRule），本插件在渲染层覆写 `hr` 规则，把 `---` 渲染为红色通栏
 * 横线。renderer 输出是最终 HTML 字符串，不受 `html: false`（markdown-it
 * 对内嵌 HTML 的转义）限制——textFontScopePlugin 覆写 `rules.text` 是同一
 * 机制。样式由 body-builder 的 `.red-rule-line` 规则提供（间距 4mm、红色
 * 2px 顶边线）。
 */
export const redRuleLinePlugin: MdPluginWithOptions<ParserConfig> = (md) => {
  md.renderer.rules.hr = () => '<hr class="red-rule-line" />'
}
