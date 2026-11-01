/**
 * dsh-context-effort — 宿主半边（Node 侧）。
 *
 * 这是一个纯 UI 插件：真正的行为全部在浏览器半边
 * （见 src/client/index.js，由 package.json 的 dsh.client 声明发现并加载）。
 * 宿主 apply 保持为空，只为让插件出现在 cordis.yml / Loader 里。
 */

/** 宿主插件体 —— 该 UI 面没有宿主侧行为。 */
export function apply() {}

export const name = 'dsh-context-effort'
