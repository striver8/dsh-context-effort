# 安装 dsh-context-effort

给 DeepSeek Harness 加一个对话输入区的控件：显示**当前模型的上下文长度与已用长度**，
可**一键切换思考等级（reasoning effort）**，并**直接编辑保存模型的上下文长度**。

---

## 前提

| 项 | 要求 |
|---|---|
| DeepSeek Harness | `>= 0.2.1-rc.2`（包内 `engines.dsh` 声明；本插件在 0.2.1-rc.5 上实测通过） |
| 界面 | **Web / 桌面版的对话界面**（插件挂在 composer 上，TUI 不适用） |
| Node.js | 仅「方式二」用 `dsh plugin add` 时需要 pnpm；「方式一」**不需要任何依赖** |

> 本插件**不声明** `@deepseek-ai/dsh-*` 的 peerDependencies（这些模块由宿主在运行时提供，
> 声明了反而会卡 pnpm 解析），只声明 `engines.dsh` 作为兼容下限。
> 如果 DSH 大改了 composer 的座位名或设置服务，控件可能不显示；此时看后面「排错」。

---

## 方式一：便携脚本（不依赖 pnpm / 网络，desktop profile 也能装）

1. 拿到插件目录（`git clone` 本仓库，或解压 release 里的 `.tgz` / zip）
2. **完全退出 DeepSeek Harness**（含托盘图标）
3. 在该目录打开 PowerShell，运行：

```powershell
.\install.ps1
```

装到别的 profile：

```powershell
.\install.ps1 -Profile web
```

脚本会做两件事，并自动备份 `package.json`：

- 把插件文件复制到 `<DSH_HOME>\profiles\<profile>\node_modules\dsh-context-effort`
- 在 `<DSH_HOME>\profiles\<profile>\package.json` 里登记 `dependencies` 与 `dsh.profile.bundles`

4. **重新打开 DeepSeek Harness**

卸载：

```powershell
.\install.ps1 -Uninstall
```

---

## 方式二：标准安装（有 pnpm 时）

```powershell
dsh plugin --profile <profile> add dsh-context-effort     # 从 npm
dsh plugin --profile <profile> add <path>\dsh-context-effort-0.1.0.tgz   # 从本地 tarball
```

`dsh plugin add` 会自动把插件登记进 `dsh.profile.bundles`（DSH 的 `reconcile` 步骤）。
但注意：**desktop profile 被桌面应用独占**，`dsh plugin` 会拒绝操作它 —
那种情况请用方式一，或在「设置 → 插件」里安装（插件管理器走的是应用内部通道）。

---

## 方式三：从源码目录安装

```powershell
cd <插件目录>
npm install
npm run build
```

然后把该目录以 `file:` 形式登记进 profile（同方式一脚本所做的两件事）。

> 改动源码后必须重新 `npm run build` 并同步 `lib/client.js`：
> 宿主只服务**构建产物**，不会编译源码。

---

## 生效原理（便于排错）

DSH 的 profile 是「bundle 层叠」结构。安装只需两步：

1. **包在 `node_modules` 里**（`exports["./client"]` 指向 `lib/client.js`）
2. **包名出现在 `dsh.profile.bundles`**

第 2 步之后，DSH 会**自动读取该包自己的 `cordis.patch.yml`** 并插入图层 ——
所以**不需要**手改 profile 的 `cordis.patch.yml`。

配置是否组装成功，可以用这条命令验证（不需要启动界面）：

```powershell
dsh --profile desktop --dump-config | Select-String context-effort
```

看到 `dsh-context-effort` 就说明接线正确。

---

## 排错

### 控件没出现

1. **确认完全重启过**（桌面版含托盘进程，只关窗口不算）
2. **确认 profile 对**：桌面应用用的是 `desktop` profile
3. **确认配置组装**：跑上面的 `--dump-config` 命令
4. **看浏览器控制台**：插件的日志前缀是 `[dsh-context-effort]`；
   座位渲染失败会在 DOM 里留下 `data-slot-error="conversation.input.right"`
5. **确认是 Web/桌面界面**：TUI 没有 composer 座位，插件不会显示

### 控件出现但「上下文长度」保存不了

写模型配置依赖 DSH 的 **`configForms`**（共享设置镜像服务，来自
`@deepseek-ai/dsh-client-ui-settings`）与 **`remote.llm`**。

本插件刻意把它们做成**可选**（惰性获取），所以缺了它们插件仍能用 ——
只是保存/切等级会提示「当前环境不支持写入模型配置」，
说明该 DSH 版本没有这个服务，或设置页插件没被组合进 profile。

### 版本兼容

本插件不声明 DSH peer 依赖，因此 DSH 不会因为版本不匹配拦截安装。
若遇到 `dsh plugin add` 报 peer 冲突，说明是别的包，不是本插件。

---

## 校验与回滚

- 安装脚本会自动备份 `package.json` 为
  `package.json.bak-before-dsh-context-effort`
- 出问题直接把它复制回去，并删除
  `node_modules\dsh-context-effort`，重启即可
- 包的 SHA256 见交付说明（`dist/` 下同名 `.sha256` 若无则以发布信息为准）

---

## 功能速览

| 功能 | 说明 |
|---|---|
| 上下文占用 | 环 + `~已用 / 上限` + 百分比，数据来自 DSH 的 `contextPressure` 投影 |
| 占用构成 | 系统提示 / 工具 / 对话消息 三段（启发式估算，界面标 `~`） |
| 思考等级 | 模型自带等级优先；未声明时用全局集 `off/minimal/low/medium/high/xhigh/max`，首次点击会写入该模型配置 |
| 上下文长度 | 显示「生效值」与「配置声明」，可填 `512K` / `1M` 保存；留空＝继承适配器默认 |
| 模型切换 | 面板内折叠区，可切 provider 下的模型 |

> `K` = 1000、`M` = 1000000（**十进制**），与 DSH 官方设置页一致。
> 所以 `256K` 存的是 256000，而适配器默认值是 262144 —— 这个差异是刻意的。
