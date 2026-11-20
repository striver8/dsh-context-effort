# 0.1.1 本地兼容修复（宿主 DSH 0.2.2-rc.3）

## 不兼容点

宿主 0.2.2-alpha.2 起 `@deepseek-ai/dsh-client-ui-primitives` **移除**
`useAnchoredPosition` 值导出与 `AnchoredPositionOptions` 类型导出
（官方改用 CSS Anchor Positioning，见升级指南
`docs/upgrade-guide/v0.2.2-alpha.2/css-anchored-menus/guide.zh.md`）。

原代码在 `src/client/index.js` 里
`import { Tooltip, useAnchoredPosition, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'`，
构建产物 `lib/client.js:218` 调用 `primitives.useAnchoredPosition({...})`。
在 0.2.2 宿主上该值为 `undefined`，点击输入区控件时抛
`primitives.useAnchoredPosition is not a function`，面板无法打开。

## 修复

1. 移除 `useAnchoredPosition` 导入，新增本地 hook `usePanelPosition`
   （源码 `src/client/index.js` / 产物 `lib/client.js` 同步实现）：
   - `getBoundingClientRect()` 计算 fixed 坐标；
   - `ResizeObserver` 监听面板与锚点尺寸；
   - `window` 的 `resize` 与 `scroll`(capture) 重算；
   - 双 `requestAnimationFrame` 兜首帧面板尺寸；
   - 越界钳制到 `margin = 12`，上方空间不足时翻到下方。
2. 返回值仍为 `{ top, left }`，与面板 `style: position ?? { visibility: 'hidden', left: 0, top: 0 }` 兼容，CSS 不动。
3. `useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)` 保留 —— 0.2.2 宿主内
   仍有 7 个官方包在用，签名未变（已与官方 `dsh-client-ui-conversation` 调用形态逐一对照）。
4. `Tooltip({ label, side, delayMs, disabled })` 保留 —— 官方仍在用同组 props。
5. 版本号 0.1.0 → 0.1.1。

## 其他升级项核查（无影响）

- `projection-snapshot-scope`：`session.list` 摘要不再带 `contextPressure`/`contextBreakdown`；
  本插件在**打开的会话**里用 `useProjection(...)` 读取，不走 `session.list`，不受影响。
- `cordis-loader-entry-trees`：只影响 EntryTree 子类/applyEntryPatches；本插件的
  `cordis.patch.yml` 只有一条 `insert`。
- `plugin-engines-dsh`：本插件既无 `engines.dsh` 也无 `peerDependencies`，
  按"缺 engines 时回退 peer 规则"判定通过。

## 验证

```
node --check lib/client.js                      # 语法
node --check src/client/index.js（转 .mjs）      # 语法
```

并以只含 `{ Tooltip, useDismissOnOutsidePointer }` 的 primitives 桩执行
`window.__ModuleLoader__.load`，模块正常导出
`CAPACITY_PRESETS, ContextEffort, GLOBAL_THINKING_LEVELS, apply, buildEffortSelection,
buildModelSelection, contextOccupancy, formatCapacity, formatTokens, inject, modelPatchOps,
name, parseCapacity, resolveEffortLevels`，`apply` 为函数、`inject` 数组完整 —— 证明
不再触碰已移除的 API。

## 安装位置

修复后的同一份文件（硬链接，同 inode）已就位：

- `C:/Users/Admin/.dsh/local-plugins/dsh-context-effort-0.1.0/`
- `C:/Users/Admin/.dsh/profiles/desktop/node_modules/dsh-context-effort/`

重启 DSH 后生效。
