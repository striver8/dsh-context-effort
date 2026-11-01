# dsh-context-effort

DeepSeek Harness Web 插件：在对话输入区显示**当前模型的上下文长度与已用长度**，
并可**一键切换思考等级（reasoning effort）**、**直接编辑并保存模型上下文长度**。

功能定位对齐 ekko studio 对话窗口上的「上下文长度 / 已用长度」指示器，并把它做成可直接操作的控件。

**English** — A DeepSeek Harness (DSH) Web plugin that adds a compact context meter and a
reasoning-effort switcher to the composer. It shows the model's context window, the tokens in
use and a rough composition breakdown (system / tools / messages), lets you switch the model's
reasoning effort with one click, and lets you edit and persist the model's `contextWindow`
inline. It reads only official DSH services (`sessionProjections`, `modelDirectories`,
`configForms`) — no forked state, no network calls, no telemetry.

- **Install:** `dsh plugin add dsh-context-effort` (or install from the plugin manager's Discover tab)
- **Requires:** DeepSeek Harness `>= 0.2.1-rc.2`, Web or desktop GUI (composer slot — the TUI has none)
- **Package:** `dsh.bundle` + `dsh.client`, UI-only, no host-side behaviour

## 效果

控件挂在 composer 的 `conversation.input.right` 座位（模型选择器同行、右侧）：

**折叠态**

```
◐ 上下文 ~25K / 128K  │ High  ⌄
```

- 环 = 上下文占用百分比
- `~已用 / 上限` = token-meter 的 `contextPressure` 投影
- `│ High` = 当前思考等级
- 没有用量数据时退化为 `上下文 High ⌄`

**展开面板**

- 头部：占用百分比 + `~已用 / 上限`
- 占位条：按 `contextBreakdown` 的 系统提示 / 工具 / 对话消息 三段着色
- 数值行：已用、上限、剩余
- **上下文长度**：生效值 / 配置声明 + 输入框 + 快捷预设 + 保存 ← 见下节
- **思考等级**：当前模型广告的等级列表，当前项高亮，点击即切换
- **模型**：默认折叠（可滚动；面板最大高度 70vh），展开后可换模型

## 上下文长度编辑

自定义 provider 的模型若没声明 `contextWindow`，host 会落回适配器默认
（`llm-pi-ai` 的 `defaultContextWindow` = **262144 / 256K**），即使该模型实际支持
512K 或 1M。面板里的「上下文长度」区就是为这件事准备的：

| 行 | 含义 |
|---|---|
| **生效值** | host 解析后的实际值（来自 `contextPressure.contextWindow`） |
| **配置声明** | 该模型在配置里**写没写** `contextWindow`；未写显示「未设置（继承默认）」 |

输入 `512K` / `1M` 后点保存，值会写进该模型的配置，**下一条请求生效**。
留空保存＝删除该字段、继承适配器默认（与官方 设置→模型 的语义一致）。

> **换算规则**：`K` = 1000、`M` = 1000000（**十进制**），与官方
> `CAPACITY_SCALE` 一致。所以 `256K` 存的是 256000，而适配器默认是 262144 ——
> 这个差异是刻意的（官方占位符只是量级提示）。

## 思考等级的两种来源

| 模型情况 | 等级来源 | 行为 |
|---|---|---|
| 适配器声明了 `reasoningEfforts` | **模型自带** | 尊重适配器声明的等级与显示名，直接用 |
| 未声明（常见于自定义 provider） | **全局兜底集** | 显示 `off/minimal/low/medium/high/xhigh/max`，并提示"首次切换会写入模型配置" |

全局兜底集与 `dsh-llm-pi-ai` 的 `THINKING_LEVELS` 完全一致。首次点击某个等级时，
插件把 `reasoningEfforts` **写入该 provider 的模型配置**，随后 host 重新解析模型，
UI 自动切换为「模型自带等级」形态（原始等级名 + 正确高亮）。

> **写入路径**：必须走 `ctx.configForms`（共享设置镜像），**不是**直接调
> `remote.settings.describe()`。原因见下文「关键实现要点 4」。

## 已验证的行为（实测证据）

两处写入都落到 profile 的 `cordis.patch.yml`（官方注释：
`Profile edits land as minimal settings.mutate`，owned by `cordis.patch.yml`）：

```yaml
- id: llm-pi-ai
  config:
    providers:
      infron:
        models:
          - id: deepseek/deepseek-v4.1-flash:free
            contextWindow: 1000000        # 上下文长度写入
            maxTokens: 384000
            reasoningEfforts:             # 思考等级写入
              off: null
              minimal: minimal
              low: low
              medium: medium
              high: high
              xhigh: xhigh
              max: max
```

**思考等级确实进了请求**（会话日志 `request/header` 交叉验证）：

```
seq=2343  model/selection  →  reasoningEffort: "high"
seq=2351  request/header.config  →  reasoningEffort: "high"   ← 已生效
```

**上下文长度确实持久化**：写入 512K → 落盘 `contextWindow: 512000` →
重启实例 → 面板读回 `配置声明 512K`。

> 会话日志是**多帧拼接的 zstd**（单文件 1400+ 帧）。Node 的
> `zstdDecompressSync` 只解第一帧、流式 API 会在第二帧报
> `Unknown frame descriptor`，核对时需按魔数边界逐帧解压。

## 安装

插件是纯 UI 插件，由 profile 的 bundle 层加载。包自带 `dsh.bundle` 与
`cordis.patch.yml`，安装后 DSH 会自动把它插进图层栈 —— **不需要手改 profile 的配置**。

### 方式一：插件管理器（推荐）

```powershell
dsh plugin add dsh-context-effort
```

或在 DSH 里：**设置 → 插件 → 安装**。桌面应用的 `desktop` profile 由应用独占，
`dsh plugin` 会拒绝直接操作它，请走界面安装，或用下面的便携脚本。

### 方式二：GitHub Release 预构建包

```powershell
dsh plugin add https://github.com/striver8/dsh-context-effort/releases/download/v0.1.0/dsh-context-effort-0.1.0.tgz
```

### 方式三：便携脚本（不依赖 pnpm / 网络，适合 desktop profile）

```powershell
# 需要 PowerShell（脚本会备份 profile 的 package.json）
.\install.ps1              # 默认 -Profile desktop
.\install.ps1 -Profile web
.\install.ps1 -Uninstall   # 卸载
```

详见 [INSTALL.md](./INSTALL.md)。

### 方式四：源码

```powershell
git clone https://github.com/striver8/dsh-context-effort.git
cd dsh-context-effort
npm install
npm run build          # 产出 lib/client.js（宿主只服务构建产物）
```

然后把该目录以 `file:` 依赖登记进 profile，并加进 `dsh.profile.bundles`。

> **注意**：`file:` 依赖会被 pnpm **复制**（不是符号链接）。改完代码重新 `build` 后，
> 必须重新 `install`（或直接覆盖 profile 下 `node_modules/dsh-context-effort/lib/client.js`），
> 否则宿主仍服务旧 bundle。

安装后**完全退出并重启** DeepSeek Harness（桌面版含托盘进程，只关窗口不算）。

## 架构

```
src/index.js          宿主半边（空 apply，仅供 Loader 发现）
src/client/index.js   浏览器半边：slot 注册 + ContextEffort 组件
build.mjs             esbuild → window.__ModuleLoader__.load 工厂包
lib/client.js         构建产物（宿主实际服务的文件）
cordis.patch.yml      profile 图层插入声明
locale/{zh,en}.json   文案
```

### 数据来源（全部来自官方服务，无自造状态）

| 名称 | 来源 | 用途 |
|---|---|---|
| `contextPressure` | `ctx.sessionProjections`（token-meter 注册） | `projectedTokens` / `pressureTokens` / `contextWindow` |
| `contextBreakdown` | 同上 | 系统提示 / 工具 / 对话消息 的启发式构成 |
| `useProjection(key)` | slot 组件的**标准 session props share** | 订阅上面两个投影 |
| `ctx.modelDirectories.directoryFor(sid)` | `@deepseek-ai/dsh-client-ui-model-selection` | per-session 模型 + 等级目录 |
| `directory.select(sel)` | 同上 → host `session.selectModel` | 切换等级/模型 |
| `ctx.configForms.get(ns)` | `@deepseek-ai/dsh-client-ui-settings` | 读/写模型配置（写 `reasoningEfforts`） |
| `ctx.remote.llm.listConfigurableProviders()` | host `llm` | provider → `settingsNs` |
| `t(key, params)` | `ctx.locale` | 文案 |

因为与官方 `/model` 弹窗、composer 模型座位**共用同一个 per-session 目录实例**，
三处显示与切换永远一致。

### 关键实现要点

1. **cordis inject 必须显式声明传递依赖，且 remote 的每个子命名空间都要单独列出。**
   `modelDirectories` 内部依赖 `sessions` / `remote` / `remote.session`；写模型配置还需要
   `remote.llm` 与 `configForms`。少声明任一项就会抛
   `cannot get property "remote.X" without inject`（这是运行时才发现的问题）。

2. **`useSyncExternalStore` 的 `getSnapshot` 必须返回稳定引用。**
   每次造新对象会让 React 判定"存储每次都变"，直接触发
   `React error #185: Maximum update depth exceeded`。
   本插件用 `cacheRef` 做字段级比较，内容不变就复用旧引用。

3. **浮层必须设 `max-height` + `overflow-y:auto`。**
   40+ 个模型展开会把面板撑到 1000px 以上、顶部跑出视口，
   看起来像"弹窗关不掉"。现在限制为 `min(70vh, 560px)` 并可滚动。

4. **写设置只能走 `ctx.configForms`，不能直接调 `remote.settings.describe()`。**
   官方 `ui-settings` 的 `ConfigForms` 源码注释说明了原因：

   > The PROVIDING fiber, kept because a Service reads `ctx` as its *consumer's*
   > fiber: letting a shared form write through the caller's context would make
   > every caller declare `remote.settings` in its own `inject`.

   实测后果：非 settings 页面直接调 `remote.settings.describe()` 返回的
   `namespaces` 是**空数组**，根本定位不到目标命名空间。
   正确写法是 `ctx.configForms.get(settingsNs)`，它返回一个带
   `getSnapshot()`（含 `value` / `revision`）与 `mutate(ops)`（自带写队列与
   revision 冲突处理）的 controller。

5. **座位降级而非消失。**
   目录暂不可用（空白会话、子代理会话）只影响"能否改等级"，
   不影响上下文占用的显示。

## 开发

```powershell
npm install
npm run build          # src/client/index.js → lib/client.js
```

`lib/client.js` 是 `window.__ModuleLoader__.load(...)` 工厂包，**提交进仓库**：
宿主只服务构建产物，从源码装插件的人不必自己跑一遍 esbuild。唯一允许的
external 是 shell 提供的冻结基线表（`react` / `react-dom` / `react/jsx-runtime` /
`@deepseek-ai/dsh-client-ui-primitives`），`build.mjs` 会在打包后自行校验。

手工验证需要一个带 token 的实例；用一个独立 profile，别动日常在用的那个：

```powershell
dsh --profile ce-debug --port 19389 --no-open
# 日志会打印 http://127.0.0.1:19389/?token=...
```

## 已知限制

- **上下文数字依赖模型上报。** 新会话/未发请求时没有 `contextPressure`，
  控件退化为只显示上下文标签与思考等级。这是设计行为，非缺陷。
- **上下文长度（`contextWindow`）不是可拖动的滑杆。**
  它是模型适配器的声明属性。本插件在面板里读写的就是 **设置 → 模型** 里那个字段
  （同一个 `settings.mutate` 落点），但只做「填值 + 保存」，不做容量协商。
- **`contextBreakdown` 是启发式估算**（4 字符 ≈ 1 token），CJK 与 JSON schema
  会被低估；面板里以 `~` 标注。这与官方 ContextMeter 的语义一致。
- **子代理会话不暴露独立模型选择**（与官方 ModelSelect 一致），
  此时只读显示上下文。
- **全局等级兜底需要写一次配置。** 首次点击会把
  `reasoningEfforts` 写进该模型的配置；这是为了让 host 真正按等级派发请求，
  不能只改前端状态。
