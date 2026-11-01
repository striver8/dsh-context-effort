/**
 * dsh-context-effort — 宿主半边（构建产物）。
 *
 * 纯 UI 插件，宿主侧无行为；空 apply 只为让插件出现在 cordis.yml / Loader。
 * 浏览器半边由 package.json 的 dsh.client 声明发现，见 ./client.js。
 */

export function apply() {}

export const name = 'dsh-context-effort'
