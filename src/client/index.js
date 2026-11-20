/**
 * dsh-context-effort — 浏览器半边。
 *
 * 在 composer 的模型座位行（`conversation.input.right`）注册一个控制件：
 *   - 环 + 百分比 + `已用 / 上限`：数据来自 token-meter 的 `contextPressure`
 *     projection（`pressureTokens` / `projectedTokens` / `contextWindow`）。
 *   - 点击展开面板：直接切换当前会话的**思考等级**（reasoning effort），
 *     必要时也能顺带换模型；走 `modelDirectories.directoryFor(sessionId).select()`
 *     → host `session.selectModel`，与官方 /model 弹窗、composer 模型座位
 *     共用同一个 per-session 目录实例，所以三处永远显示同一份状态。
 *
 * 构建：tsdown/rolldown 打成 `window.__ModuleLoader__.load({...})` 工厂包，
 * 唯一 external 是 loader 模块表里的 react 条目与宿主注入的 @deepseek-ai/*。
 */

import { createElement as h } from 'react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Tooltip,
  useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'

const NS = 'dsh-context-effort'

/* ------------------------------------------------------------------ *
 * 1. 上下文占用：与官方 ui-conversation 的 ContextMeter 同语义
 * ------------------------------------------------------------------ */

/**
 * 由独立更新的 pressure 字段解析有界展示占用。
 * @param pressure - 最新的 token-meter projection。
 * @returns 占用对象；分子与容量都未知时返回 null。
 */
export function contextOccupancy(pressure) {
  const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens
  if (usedTokens === undefined || pressure?.contextWindow === undefined) return null
  return {
    percent: Math.min(100, Math.round((usedTokens / pressure.contextWindow) * 100)),
    usedTokens,
    contextWindow: pressure.contextWindow,
  }
}

/** 紧凑 token 计数：1e3 以下原样，1e3 起用 K，1e6 起用 M。 */
export function formatTokens(value, t) {
  const scaled = (candidate) =>
    candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10)
  if (value < 1e3) return String(value)
  if (value < 1e6) return t('number.thousand', { value: scaled(value / 1e3) })
  return t('number.million', { value: scaled(value / 1e6) })
}

/**
 * 构造一次「只改思考等级」的选择。
 *
 * 与官方 ModelSelect 的语义一致：`reasoningEffort` 省略即表示「跟随模型
 * 默认」，此时 host 会用目录里该模型的 `reasoning.defaultEffort` 兜底。
 * @param current - 目录里当前的 `{ provider, model, reasoningEffort }`。
 * @param effort - 目标等级 id；传 undefined 表示回落到 provider/model 默认。
 * @returns `ModelSelection`，或 null（当前没有可用模型时）。
 */
export function buildEffortSelection(current, effort) {
  if (current === null || current === undefined) return null
  if (current.provider === undefined || current.model === undefined) return null
  return {
    provider: current.provider,
    model: current.model,
    ...(effort === undefined ? {} : { reasoningEffort: effort }),
  }
}

/**
 * 构造一次「换模型」的选择：默认带上目标模型自报的默认等级。
 * @param provider - provider id。
 * @param model - provider 拥有的模型 id。
 * @param defaultEffort - 该模型自报的默认等级，可省略。
 * @returns `ModelSelection`。
 */
export function buildModelSelection(provider, model, defaultEffort) {
  return {
    provider,
    model,
    ...(defaultEffort === undefined ? {} : { reasoningEffort: defaultEffort }),
  }
}

/**
 * DSH 原生的思考等级 id 全集（升序），与 `dsh-llm-pi-ai` 的 `THINKING_LEVELS`
 * 完全一致。当某个模型（尤其自定义 provider 的模型）没有在适配器配置里声明
 * `reasoningEfforts` 时，用它作为**全局兜底等级集**，让任何模型都能调等级。
 */
export const GLOBAL_THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]

/**
 * 容量字段接受的写法：十进制数字 + 可选 `K`/`M` 后缀。
 * 与官方 `dsh-client-ui-settings-models` 的 `CAPACITY_PATTERN` 一致。
 */
const CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i

/**
 * `K`/`M` 的换算比例 —— **十进制**（1000 / 1000000），与官方 `CAPACITY_SCALE`
 * 一致。
 *
 * 这与内存语境的 1024 不同：`1M` = 1000000、`256K` = 256000。
 * 官方设置页占位符写 `256K`，而适配器实际默认是 262144 —— 这个差异是刻意的
 * （占位符只是量级提示），所以界面上把换算规则讲清楚。
 */
const CAPACITY_SCALE = { k: 1e3, m: 1e6 }

/**
 * 解析用户输入的容量。
 *
 * @param text - 原始输入。
 * @returns 解析出的 token 数；空白返回 `undefined`（表示继承默认）；
 *   无法识别返回 `NaN`（调用方应拒绝提交）。
 */
export function parseCapacity(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed.length === 0) return undefined
  const match = CAPACITY_PATTERN.exec(trimmed)
  if (match === null) return Number.NaN
  const suffix = match[2]?.toLowerCase()
  const scale = suffix === 'k' || suffix === 'm' ? CAPACITY_SCALE[suffix] : 1
  const scaled = Number(match[1]) * scale
  const rounded = Math.round(scaled)
  return Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled
}

/**
 * 把存储的 token 数拼回最简写法（能被 {@link parseCapacity} 往返解析）。
 *
 * @param value - 存储的容量。
 * @returns 字段文本；非正整数时原样输出。
 */
export function formatCapacity(value) {
  if (!Number.isInteger(value) || value <= 0) return String(value)
  if (value % CAPACITY_SCALE.m === 0) return `${String(value / CAPACITY_SCALE.m)}M`
  if (value % CAPACITY_SCALE.k === 0) return `${String(value / CAPACITY_SCALE.k)}K`
  return String(value)
}

/** 容量的常用快捷值，便于一键填入。 */
export const CAPACITY_PRESETS = [128000, 256000, 512000, 1000000, 2000000]

/**
 * 把一次「模型字段补丁」翻成最小的配置写操作（精确路径的 `set` / `unset`）。
 *
 * 契约：
 *   · **只写 patch 里出现的键** —— 其它字段（尤其 `maxTokens`）一个都不碰；
 *   · 值为 `undefined` 的键发 `unset` = 删除该字段、继承适配器默认，
 *     与官方容量输入"留空即继承"的语义一致；
 *   · 空 patch → 空数组，调用方据此跳过整次写入。
 *
 * 为什么需要它：早前是「整份 provider 回写」（`set` 到 `providers.<id>`），
 * 那会把宿主文档里的 schema 默认值实体化落盘（`input: []`、`compat{}`），
 * 并把用户没碰过的 `maxTokens` 一并复写 —— 从 diff 上看起来像"手改了输出上限"。
 *
 * @param base - 该模型条目在设置文档里的路径，如 `['providers','mychange','models','3']`。
 * @param patch - 要写入的字段；`undefined` 值表示删除该字段。
 * @returns 有序的操作列表，可直接交给 `configForms.mutate()`。
 */
export function modelPatchOps(base, patch) {
  const ops = []
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === undefined) ops.push({ op: 'unset', path: [...base, key] })
    else ops.push({ op: 'set', path: [...base, key], value })
  }
  return ops
}

/**
 * 把全局等级 id 解析成可显示的选项。
 *
 * 模型自带 reasoning 元数据时优先用它（尊重适配器声明的真实能力与显示名）；
 * 没有时退回全局等级集，并标记 `synthetic: true` —— 调用方据此知道这些等级
 * 需要先写进模型配置才能真正生效。
 *
 * @param reasoning - 目录里该模型的 `reasoning`，可能为 undefined。
 * @returns `{ levels, synthetic, defaultEffort }`。
 */
export function resolveEffortLevels(reasoning) {
  if (reasoning !== undefined && reasoning !== null && Array.isArray(reasoning.efforts) && reasoning.efforts.length > 0) {
    return {
      synthetic: false,
      defaultEffort: reasoning.defaultEffort,
      levels: reasoning.efforts.map((level) => ({
        id: level.id,
        label: level.name ?? level.id,
      })),
    }
  }
  return {
    synthetic: true,
    defaultEffort: undefined,
    levels: GLOBAL_THINKING_LEVELS.map((id) => ({
      id,
      label: id === 'off' ? 'off' : id,
    })),
  }
}

/** 未注入 locale 时的兜底文案（宿主总是会注入 t，这只防御 HMR 竞态）。 */
const FALLBACK = {
  'number.thousand': '{value}K',
  'number.million': '{value}M',
  'label.context': '上下文',
  'label.contextLimit': '上下文长度',
  'capacity.effective': '生效值',
  'capacity.declared': '配置声明',
  'capacity.inherited': '未设置（继承默认）',
  'capacity.placeholder': '如 512K / 1M；留空即继承',
  'capacity.save': '保存',
  'capacity.saving': '保存中…',
  'capacity.saved': '已保存，下一条请求生效',
  'capacity.invalid': '格式无法识别，请用 256K / 512K / 1M 这类写法',
  'capacity.failed': '保存失败：{reason}',
  'capacity.unavailable': '当前环境不支持写入模型配置',
  'capacity.hint': 'K=1000、M=1000000（十进制）。模型未声明时会落回适配器默认 256K，这里填的值会写入该模型配置。',
  'label.used': '已用',
  'label.limit': '上限',
  'label.remaining': '剩余',
  'label.percent': '占用',
  'label.effort': '思考等级',
  'label.model': '模型',
  'label.providerDefault': '跟随模型默认',
  'panel.title': '上下文与思考等级',
  'panel.noEfforts': '当前模型未提供推理等级。',
  'panel.globalLevelsHint': '该模型未声明推理等级，已使用全局等级集；首次切换会写入模型配置。',
  'panel.noPressure': '等待模型上报上下文用量…',
  'panel.switching': '切换中…',
  'panel.enabling': '正在启用推理等级…',
  'panel.enableFailed': '写入模型配置失败：{reason}',
  'panel.failed': '切换失败：{reason}',
  'panel.breakdown': '构成（启发式估算）',
  'breakdown.system': '系统提示',
  'breakdown.tools': '工具',
  'breakdown.messages': '对话消息',
  'a11y.trigger': '上下文占用 {percent}，点击调整思考等级',
  'a11y.dialog': '上下文与思考等级',
}

function makeFallbackT() {
  return (key, params) => {
    const raw = FALLBACK[key] ?? key
    if (params === undefined) return raw
    return raw.replace(/\{(\w+)\}/g, (_m, name) =>
      Object.hasOwn(params, name) ? String(params[name]) : `{${name}}`,
    )
  }
}

/* ------------------------------------------------------------------ *
 * 2. 组件
 * ------------------------------------------------------------------ */

const RADIUS = 5.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const READING_SLOT = '\0'

const BREAKDOWN_ROWS = [
  { key: 'systemTokens', label: 'breakdown.system', cls: 'ce-colorSystem' },
  { key: 'toolsTokens', label: 'breakdown.tools', cls: 'ce-colorTools' },
  { key: 'messageTokens', label: 'breakdown.messages', cls: 'ce-colorMessages' },
]

/**
 * ContextEffort —— composer 里的上下文 / 思考等级控制件。
 *
 * props 由框架的五份 share 组合而来：
 *   - `useProjection`：session 标准 share，读 `contextPressure` / `contextBreakdown`。
 *   - `t`：locale 座位。
 *   - `directory` / `select` / `available` / `sessionId`：本插件 `inject`
 *     返回的业务 share（见 apply 里的注册）。
 */
export function ContextEffort(props) {
  const {
    useProjection,
    t: injectedT,
    directory,
    select,
    load,
    available,
    useSession,
    enableEfforts,
    resolveSettingsNs,
    readModelCapacity,
    saveModelCapacity,
  } = props

  const t = injectedT ?? makeFallbackT()

  // 目录 store：订阅式快照（与官方 ModelSelect 读的是同一个 store）。
  const state = useDirectoryState(directory, useSession)
  const pressure = useProjection('contextPressure')
  const breakdown = useProjection('contextBreakdown')

  const [open, setOpen] = useState(false)
  // 模型列表默认折叠：绝大多数使用场景只需要改等级，不必被 40+ 个模型撑爆面板。
  const [modelOpen, setModelOpen] = useState(false)
  const rootRef = useRef(null)
  const panelRef = useRef(null)

  const context = contextOccupancy(pressure)
  const hasContext = context !== null
  // 可编辑 = 这个会话有独立的模型目录（不是子代理会话）。
  // 注意不能要求 `state.groups.length > 0`：目录是异步加载的，初始为空是
  // 正常状态 —— 那样会让面板永远打不开。空目录在面板里显示空态。
  const canEdit = available !== false

  // 宿主 0.2.2 起 primitives 不再导出 useAnchoredPosition，
  // 改由本地 usePanelPosition 计算 fixed 坐标（见文件末尾实现）。
  const position = usePanelPosition({
    open: open && canEdit,
    anchorRef: rootRef,
    panelRef,
    side: 'top',
    gap: 8,
    margin: 12,
  })
  useDismissOnOutsidePointer(rootRef, open && canEdit, setOpen, panelRef)

  // 打开面板时拉取最新目录（模型/等级目录可能已被设置改动）。
  useEffect(() => {
    if (open && canEdit && typeof load === 'function') load()
  }, [open, canEdit, load])

  // 失去可编辑条件时收起。
  useEffect(() => {
    if (!canEdit && open) setOpen(false)
  }, [canEdit, open])

  useEffect(() => {
    if (!open || !canEdit) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [canEdit, open])

  const current = state.current
  const reasoning = useMemo(
    () => resolveReasoning(state, current),
    [state, current],
  )

  // 等级来源：模型自带元数据优先，缺失时用全局兜底集
  // （off/minimal/low/medium/high/xhigh/max）。必须早于 onPickEffort 声明 ——
  // 后者在 useCallback 的依赖数组里读 effortLevels.synthetic。
  const effortLevels = useMemo(() => resolveEffortLevels(reasoning), [reasoning])

  // 合成等级（模型未声明 reasoningEfforts）写入配置的进展状态。
  const [enabling, setEnabling] = useState(null)
  const [enablingError, setEnablingError] = useState(null)

  // ---- 上下文长度（contextWindow）编辑 ----
  // 区分两个值：
  //   declared = 配置里**声明**的值（未声明 → undefined，落回适配器默认）
  //   effective = host 解析后的**生效值**（来自 contextPressure.contextWindow）
  const [declaredCapacity, setDeclaredCapacity] = useState(undefined)
  const [capacityDraft, setCapacityDraft] = useState('')
  const [capacityBusy, setCapacityBusy] = useState(false)
  const [capacityError, setCapacityError] = useState(null)
  const [capacitySaved, setCapacitySaved] = useState(false)

  const modelKey =
    current === null || current === undefined
      ? null
      : `${current.provider}\u0000${current.model}`

  /**
   * 每次切换模型（或打开面板）都重新读一次该模型声明的容量。
   * 读路径与写路径共用 configForms 的共享镜像。
   */
  useEffect(() => {
    if (!open || modelKey === null) return undefined
    if (typeof readModelCapacity !== 'function' || typeof resolveSettingsNs !== 'function') {
      return undefined
    }
    let cancelled = false
    setCapacityError(null)
    setCapacitySaved(false)
    ;(async () => {
      const resolved = await resolveSettingsNs(current.provider)
      if (cancelled) return
      if (resolved.ok !== true) {
        setDeclaredCapacity(undefined)
        setCapacityDraft('')
        return
      }
      const read = await readModelCapacity(current.provider, current.model, resolved.settingsNs)
      if (cancelled) return
      if (read.ok !== true) {
        setDeclaredCapacity(undefined)
        setCapacityDraft('')
        return
      }
      const declared = read.declared?.contextWindow
      setDeclaredCapacity(declared)
      setCapacityDraft(declared === undefined ? '' : formatCapacity(declared))
    })().catch(() => {
      /* 读失败不阻塞面板，用户仍可手动填写 */
    })
    return () => {
      cancelled = true
    }
  }, [open, modelKey, readModelCapacity, resolveSettingsNs, current])

  /** 保存当前模型的 contextWindow。 */
  const onSaveCapacity = useCallback(async () => {
    if (current === null || current === undefined) return
    const parsed = parseCapacity(capacityDraft)
    if (Number.isNaN(parsed)) {
      setCapacityError(t('capacity.invalid'))
      return
    }
    if (typeof saveModelCapacity !== 'function' || typeof resolveSettingsNs !== 'function') {
      setCapacityError(t('capacity.unavailable'))
      return
    }
    setCapacityBusy(true)
    setCapacityError(null)
    setCapacitySaved(false)
    const resolved = await resolveSettingsNs(current.provider)
    if (resolved.ok !== true) {
      setCapacityBusy(false)
      setCapacityError(resolved.error ?? t('capacity.unavailable'))
      return
    }
    // parsed === undefined 表示留空 → 删除该字段、继承适配器默认
    const result = await saveModelCapacity(current.provider, current.model, resolved.settingsNs, {
      contextWindow: parsed,
    })
    setCapacityBusy(false)
    if (result && result.ok === false) {
      setCapacityError(result.error ?? t('capacity.failed'))
      return
    }
    setDeclaredCapacity(parsed)
    setCapacitySaved(true)
    if (typeof load === 'function') load()
  }, [
    current,
    capacityDraft,
    saveModelCapacity,
    resolveSettingsNs,
    load,
    t,
  ])

  const onPickEffort = useCallback(
    async (effort) => {
      if (current === null || current === undefined || effort === undefined) return
      // 模型未声明等级时，先把它写进模型配置，host 才会真的认这个等级。
      if (effortLevels.synthetic && typeof enableEfforts === 'function') {
        setEnablingError(null)
        setEnabling({ effort })
        // 先解析该 provider 的设置命名空间，再写入。
        const resolved =
          typeof resolveSettingsNs === 'function'
            ? await resolveSettingsNs(current.provider)
            : { ok: false, error: 'resolveSettingsNs 不可用' }
        if (resolved.ok !== true) {
          setEnabling(null)
          setEnablingError(resolved.error ?? '无法解析设置命名空间')
          return
        }
        const result = await enableEfforts(
          current.provider,
          current.model,
          GLOBAL_THINKING_LEVELS,
          resolved.settingsNs,
        )
        setEnabling(null)
        if (result && result.ok === false) {
          setEnablingError(result.error ?? '写入模型配置失败')
          return
        }
        // 写入成功后重新拉目录，让 host 侧新能力反映到 UI。
        if (typeof load === 'function') load()
      }
      const selection = buildEffortSelection(current, effort)
      if (selection !== null) select(selection)
    },
    [current, select, effortLevels.synthetic, enableEfforts, resolveSettingsNs, load],
  )

  const onPickModel = useCallback(
    (provider, model, defaultEffort) => {
      select(buildModelSelection(provider, model, defaultEffort))
    },
    [select],
  )

  // 完全没有可显示的内容时才不占位：既无上下文压力、又不能编辑等级。
  if (!hasContext && !canEdit) return null

  const percent = hasContext ? context.percent : 0
  const reading = `${percent}%`
  const [headBefore = '', headAfter = ''] = String(
    t('a11y.trigger', { percent: READING_SLOT }),
  )
    .split(READING_SLOT)
    .map((part) => part.trim())

  const breakdownTotal =
    breakdown === undefined
      ? 0
      : breakdown.systemTokens + breakdown.toolsTokens + breakdown.messageTokens
  const segments =
    breakdown === undefined || breakdownTotal === 0
      ? [{ key: 'total', cls: undefined, width: percent }]
      : BREAKDOWN_ROWS.map((row) => ({
          key: row.key,
          cls: row.cls,
          width: (percent * breakdown[row.key]) / breakdownTotal,
        }))
  const visibleSegments = segments.filter((part) => part.width > 0)

  const busy = state.status === 'selecting' || enabling !== null
  const currentEffort =
    current?.reasoningEffort ?? reasoning?.defaultEffort

  const effortLabel = (() => {
    if (currentEffort !== undefined) {
      const found = effortLevels.levels.find((level) => level.id === currentEffort)
      if (found !== undefined) return found.label
      return currentEffort
    }
    if (effortLevels.synthetic) return t('label.providerDefault')
    return effortLevels.defaultEffort === undefined
      ? t('label.providerDefault')
      : (effortLevels.levels.find((level) => level.id === effortLevels.defaultEffort)?.label ??
        effortLevels.defaultEffort)
  })()

  return h(
    'span',
    { ref: rootRef, className: 'ce-root' },
    [
      h(
        Tooltip,
        {
          key: 'tip',
          label: t('a11y.trigger', { percent: reading }),
          side: 'top',
          delayMs: 200,
          disabled: open,
        },
        h(
          'button',
          {
            type: 'button',
            className: 'ce-trigger',
            'aria-label': t('a11y.trigger', { percent: reading }),
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            onClick: () => setOpen(!open),
          },
          [
            hasContext
              ? h(
                  'svg',
                  {
                    key: 'ring',
                    viewBox: '0 0 14 14',
                    width: '14',
                    height: '14',
                    'aria-hidden': true,
                  },
                  [
                    h('circle', {
                      key: 'track',
                      className: 'ce-track',
                      cx: '7',
                      cy: '7',
                      r: RADIUS,
                    }),
                    h('circle', {
                      key: 'fill',
                      className: 'ce-fill',
                      cx: '7',
                      cy: '7',
                      r: RADIUS,
                      strokeDasharray: `${(CIRCUMFERENCE * percent) / 100} ${CIRCUMFERENCE}`,
                      transform: 'rotate(-90 7 7)',
                    }),
                  ],
                )
              : null,
            h(
              'span',
              { key: 'reading', className: 'ce-reading' },
              hasContext
                ? `${t('label.context')} ~${formatTokens(context.usedTokens, t)} / ${formatTokens(context.contextWindow, t)}`
                : t('label.context'),
            ),
            h('span', { key: 'effort', className: 'ce-effortLabel' }, effortLabel),
            h(
              'svg',
              {
                key: 'chev',
                className: 'ce-chevron',
                viewBox: '0 0 12 12',
                width: '12',
                height: '12',
                'aria-hidden': true,
              },
              h('path', {
                d: 'M2.5 4.5 6 8l3.5-3.5',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: '1.4',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }),
            ),
          ],
        ),
      ),
      open && canEdit
        ? createPortal(
            h(
              'div',
              {
                ref: panelRef,
                className: 'ce-panel',
                style:
                  position ?? { visibility: 'hidden', left: 0, top: 0 },
                role: 'dialog',
                'aria-label': t('a11y.dialog'),
              },
              [
                // 头部：百分比 + 已完成 / 上限
                h('div', { key: 'head', className: 'ce-panelHead' }, [
                  h(
                    'span',
                    { key: 'before', className: 'ce-headline' },
                    headBefore,
                  ),
                  h('span', { key: 'percent', className: 'ce-percent' }, reading),
                  h(
                    'span',
                    { key: 'after', className: 'ce-headline' },
                    headAfter,
                  ),
                  h(
                    'span',
                    { key: 'figures', className: 'ce-figures' },
                    hasContext
                      ? `~${formatTokens(context.usedTokens, t)} / ${formatTokens(context.contextWindow, t)}`
                      : '—',
                  ),
                ]),

                // 占用条
                h(
                  'div',
                  { key: 'bar', className: 'ce-bar' },
                  visibleSegments.map((segment) =>
                    h('div', {
                      key: segment.key,
                      className:
                        segment.cls === undefined
                          ? 'ce-segment'
                          : `ce-segment ${segment.cls}`,
                      style: { width: `${segment.width}%` },
                    }),
                  ),
                ),

                // 数值行
                h('dl', { key: 'num', className: 'ce-rows' }, [
                  hasContext
                    ? row('ce-used', t('label.used'), `~${formatTokens(context.usedTokens, t)}`)
                    : null,
                  hasContext
                    ? row('ce-limit', t('label.limit'), formatTokens(context.contextWindow, t))
                    : null,
                  hasContext
                    ? row(
                        'ce-left',
                        t('label.remaining'),
                        `~${formatTokens(Math.max(0, context.contextWindow - context.usedTokens), t)}`,
                      )
                    : null,
                  !hasContext
                    ? h(
                        'div',
                        { key: 'nop', className: 'ce-empty' },
                        t('panel.noPressure'),
                      )
                    : null,
                ]),

                // 上下文长度（contextWindow）—— 可直接编辑并保存到模型配置
                h('div', { key: 'capacity', className: 'ce-block' }, [
                  h(
                    'div',
                    { className: 'ce-sectionTitle' },
                    t('label.contextLimit'),
                  ),
                  // 生效值（host 解析后的）vs 声明值（配置里写的）
                  h('dl', { className: 'ce-rows' }, [
                    h('div', { key: 'eff', className: 'ce-row' }, [
                      h('dt', null, t('capacity.effective')),
                      h(
                        'dd',
                        null,
                        hasContext ? formatTokens(context.contextWindow, t) : '—',
                      ),
                    ]),
                    h('div', { key: 'dec', className: 'ce-row' }, [
                      h('dt', null, t('capacity.declared')),
                      h(
                        'dd',
                        null,
                        declaredCapacity === undefined
                          ? t('capacity.inherited')
                          : `${formatTokens(declaredCapacity, t)} (${formatCapacity(declaredCapacity)})`,
                      ),
                    ]),
                  ]),
                  h('div', { className: 'ce-capacityRow' }, [
                    h('input', {
                      key: 'in',
                      className: 'ce-capacityInput',
                      type: 'text',
                      inputMode: 'numeric',
                      placeholder: t('capacity.placeholder'),
                      value: capacityDraft,
                      disabled: capacityBusy,
                      onChange: (e) => {
                        setCapacityDraft(e.target.value)
                        setCapacitySaved(false)
                        setCapacityError(null)
                      },
                      onKeyDown: (e) => {
                        if (e.key === 'Enter') onSaveCapacity()
                      },
                    }),
                    h(
                      'button',
                      {
                        key: 'save',
                        type: 'button',
                        className: 'ce-capacitySave',
                        disabled: capacityBusy,
                        onClick: onSaveCapacity,
                      },
                      capacityBusy ? t('capacity.saving') : t('capacity.save'),
                    ),
                  ]),
                  // 常用值快捷填入
                  h(
                    'div',
                    { className: 'ce-chips ce-chips--presets' },
                    CAPACITY_PRESETS.map((preset) =>
                      h(
                        'button',
                        {
                          key: preset,
                          type: 'button',
                          className:
                            declaredCapacity === preset
                              ? 'ce-chip ce-chip--preset ce-chipActive'
                              : 'ce-chip ce-chip--preset',
                          disabled: capacityBusy,
                          onClick: () => {
                            setCapacityDraft(formatCapacity(preset))
                            setCapacitySaved(false)
                            setCapacityError(null)
                          },
                        },
                        formatCapacity(preset),
                      ),
                    ),
                  ),
                  h('div', { className: 'ce-hint' }, t('capacity.hint')),
                  capacityError !== null
                    ? h('div', { className: 'ce-status ce-status--error' }, capacityError)
                    : null,
                  capacitySaved
                    ? h('div', { className: 'ce-status' }, t('capacity.saved'))
                    : null,
                ]),

                // 构成（启发式）
                breakdown !== undefined
                  ? h('div', { key: 'bd' }, [
                      h(
                        'div',
                        { className: 'ce-sectionTitle' },
                        t('panel.breakdown'),
                      ),
                      h(
                        'dl',
                        { className: 'ce-rows' },
                        BREAKDOWN_ROWS.map((r) =>
                          h('div', { key: r.key, className: 'ce-row' }, [
                            h('dt', null, [
                              h('span', {
                                className: `ce-swatch ${r.cls}`,
                                'aria-hidden': true,
                              }),
                              t(r.label),
                            ]),
                            h(
                              'dd',
                              null,
                              `~${formatTokens(breakdown[r.key], t)}`,
                            ),
                          ]),
                        ),
                      ),
                    ])
                  : null,

                // 思考等级（模型自带元数据 → 用它；否则用全局兜底集）
                h('div', { key: 'effort', className: 'ce-block' }, [
                  h('div', { className: 'ce-sectionTitle' }, t('label.effort')),
                  effortLevels.synthetic
                    ? h('div', { className: 'ce-hint' }, t('panel.globalLevelsHint'))
                    : null,
                  h(
                    'div',
                    { className: 'ce-chips' },
                    [
                      // 只在模型自带默认等级时提供"跟随模型默认"这一项；
                      // 全局兜底集本身就是显式等级，不需要这一项。
                      ...(!effortLevels.synthetic && effortLevels.defaultEffort === undefined
                        ? [
                            {
                              key: 'provider-default',
                              effort: undefined,
                              label: t('label.providerDefault'),
                            },
                          ]
                        : []),
                      ...effortLevels.levels.map((level) => ({
                        key: `effort:${level.id}`,
                        effort: level.id,
                        label: level.label,
                      })),
                    ].map((choice) =>
                      h(
                        'button',
                        {
                          key: choice.key,
                          type: 'button',
                          // 等级与模型用不同的类名，避免"当前项"高亮被混淆。
                          className:
                            choice.effort === currentEffort
                              ? 'ce-chip ce-chip--effort ce-chipActive'
                              : 'ce-chip ce-chip--effort',
                          disabled: busy,
                          onClick: () => onPickEffort(choice.effort),
                        },
                        choice.label,
                      ),
                    ),
                  ),
                ]),

                // 模型：按需展开（默认折叠，避免面板被 40+ 个模型撑爆）。
                state.groups.length > 0
                  ? h('div', { key: 'model', className: 'ce-block' }, [
                      h(
                        'button',
                        {
                          className: 'ce-disclosure',
                          type: 'button',
                          'aria-expanded': modelOpen,
                          onClick: () => setModelOpen(!modelOpen),
                        },
                        [
                          h('span', { key: 'l' }, t('label.model')),
                          h(
                            'span',
                            { key: 'v', className: 'ce-disclosureValue' },
                            current?.model ?? '—',
                          ),
                          h(
                            'svg',
                            {
                              key: 'c',
                              className: modelOpen
                                ? 'ce-chevron ce-chevron--open'
                                : 'ce-chevron',
                              viewBox: '0 0 12 12',
                              width: '12',
                              height: '12',
                              'aria-hidden': true,
                            },
                            h('path', {
                              d: 'M2.5 4.5 6 8l3.5-3.5',
                              fill: 'none',
                              stroke: 'currentColor',
                              strokeWidth: '1.4',
                              strokeLinecap: 'round',
                              strokeLinejoin: 'round',
                            }),
                          ),
                        ],
                      ),
                      modelOpen
                        ? h(
                            'div',
                            { className: 'ce-chips' },
                            state.groups
                              .flatMap((group) =>
                                group.models.map((model) => ({
                                  group,
                                  model,
                                })),
                              )
                              .map(({ group, model }) =>
                                h(
                                  'button',
                                  {
                                    key: `${group.id}/${model.id}`,
                                    type: 'button',
                                    className:
                                      current?.provider === group.id &&
                                      current?.model === model.id
                                        ? 'ce-chip ce-chip--model ce-chipActive'
                                        : 'ce-chip ce-chip--model',
                                    disabled: busy,
                                    onClick: () =>
                                      onPickModel(
                                        group.id,
                                        model.id,
                                        model.reasoning?.defaultEffort,
                                      ),
                                  },
                                  model.name ?? model.id,
                                ),
                              ),
                          )
                        : null,
                    ])
                  : null,

                // 状态行
                busy || state.error !== null || enablingError !== null
                  ? h(
                      'div',
                      {
                        key: 'status',
                        className:
                          state.error !== null || enablingError !== null
                            ? 'ce-status ce-status--error'
                            : 'ce-status',
                      },
                      enablingError !== null
                        ? t('panel.enableFailed', { reason: enablingError })
                        : enabling !== null
                          ? t('panel.enabling', { level: enabling.effort })
                          : state.error !== null
                            ? t('panel.failed', { reason: state.error })
                            : t('panel.switching'),
                    )
                  : null,
              ],
            ),
            document.body,
          )
        : null,
    ],
  )
}

function row(key, label, value) {
  return h('div', { key, className: 'ce-row' }, [
    h('dt', null, label),
    h('dd', null, value),
  ])
}

/* ------------------------------------------------------------------ *
 * 3. 目录 store → React state
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 面板定位（本地实现，替代已移除的 primitives.useAnchoredPosition）
 *
 * 宿主 0.2.2 起 `@deepseek-ai/dsh-client-ui-primitives` 移除了
 * `useAnchoredPosition`（官方改用 CSS Anchor Positioning），插件里再调用
 * 会拿到 undefined 直接抛错。这里用 getBoundingClientRect 计算 fixed
 * 坐标：跟随锚点滚动/缩放、面板尺寸变化重算，越界时钳到 margin。
 * ------------------------------------------------------------------ */

/**
 * @param {object} options
 * @param {boolean} options.open 面板是否打开；关闭时返回 null。
 * @param {{current: (Element|null)}} options.anchorRef 触发器元素。
 * @param {{current: (Element|null)}} options.panelRef 面板元素。
 * @param {'top'|'bottom'} [options.side] 首选方向，空间不足时翻到另一侧。
 * @param {number} [options.gap] 与锚点的间距。
 * @param {number} [options.margin] 距窗口边缘的最小留白。
 * @returns {{top: number, left: number} | null} fixed 定位坐标。
 */
function usePanelPosition({ open, anchorRef, panelRef, side = 'top', gap = 8, margin = 12 }) {
  const [position, setPosition] = useState(null)

  const compute = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const panel = panelRef.current
    const width = panel ? panel.offsetWidth : Math.min(320, window.innerWidth - margin * 2)
    const height = panel ? panel.offsetHeight : 0
    let left = rect.left
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width
    if (left < margin) left = margin
    let top = side === 'top' ? rect.top - gap - height : rect.bottom + gap
    if (side === 'top' && top < margin) top = rect.bottom + gap
    if (side !== 'top' && top + height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - gap - height)
    }
    setPosition({ top: Math.round(top), left: Math.round(left) })
  }, [anchorRef, panelRef, side, gap, margin])

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return undefined
    }
    let alive = true
    // 首帧面板尚未渲染，拿不到真实尺寸；下一帧再算一次。
    const first = window.requestAnimationFrame(() => { if (alive) compute() })
    const second = window.requestAnimationFrame(() => { if (alive) compute() })
    let observer
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => compute())
      if (panelRef.current) observer.observe(panelRef.current)
      if (anchorRef.current) observer.observe(anchorRef.current)
    }
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      alive = false
      window.cancelAnimationFrame(first)
      window.cancelAnimationFrame(second)
      if (observer !== undefined) observer.disconnect()
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open, compute, anchorRef, panelRef])

  return position
}

const EMPTY_DIRECTORY_STATE = {
  status: 'idle',
  current: null,
  groups: [],
  retainedEffort: undefined,
  pending: null,
  error: null,
}

/**
 * 订阅 ModelDirectory 的 store 快照。
 *
 * 官方目录 store 暴露裸的快照源（`getSnapshot` / `subscribe`），React hook
 * 绑定属于渲染机制，所以这里用 `useSyncExternalStore` 自己绑。
 * @param directory - `models.directoryFor(sessionId).store`（或 undefined）。
 * @param useSession - 会话标准 share（仅在 store 缺失时用于兜底）。
 */
function useDirectoryState(directory, useSession) {
  const stable = directory ?? null

  // 上一次投影结果的缓存。`useSyncExternalStore` 用 Object.is 比较
  // getSnapshot 的返回值 —— 如果每次都造新对象，React 会判定"外部存储每
  // 次都变了"，从而无限重渲染（React #185: Maximum update depth exceeded）。
  // 所以这里手工做**浅层字段比较**，内容不变就复用旧引用。
  const cacheRef = useRef({ source: undefined, projected: EMPTY_DIRECTORY_STATE })

  const subscribe = useCallback(
    (onChange) => {
      if (stable === null || typeof stable.subscribe !== 'function') return () => {}
      return stable.subscribe(onChange)
    },
    [stable],
  )

  const getSnapshot = useCallback(() => {
    if (stable === null || typeof stable.getSnapshot !== 'function') {
      return EMPTY_DIRECTORY_STATE
    }
    let raw
    try {
      raw = stable.getSnapshot()
    } catch {
      return EMPTY_DIRECTORY_STATE
    }
    if (raw === null || typeof raw !== 'object') return EMPTY_DIRECTORY_STATE

    const cache = cacheRef.current
    // 底层快照是同一个引用 → 直接复用投影（最常见的快路径）。
    if (cache.source === raw) return cache.projected

    const next = {
      status: raw.status ?? 'idle',
      current: raw.current ?? null,
      groups: Array.isArray(raw.groups) ? raw.groups : [],
      retainedEffort: raw.retainedEffort,
      pending: raw.pending ?? null,
      error: raw.error ?? null,
    }

    const prev = cache.projected
    // 字段级比较：即使底层换了新对象，只要投影内容一致也复用旧引用。
    const same =
      prev.status === next.status &&
      prev.current === next.current &&
      prev.groups === next.groups &&
      prev.retainedEffort === next.retainedEffort &&
      prev.pending === next.pending &&
      prev.error === next.error

    if (same) {
      // 只更新 source 指针，保持 projected 引用不变。
      cacheRef.current = { source: raw, projected: prev }
      return prev
    }

    cacheRef.current = { source: raw, projected: next }
    return next
  }, [stable])

  // React 18 自带 useSyncExternalStore；缺失时整体降级为静态快照。
  // 第三个参数（getServerSnapshot）是 SSR 必需的 —— 缺了它 React 会抛
  // "Missing getServerSnapshot"，所以即便 Web 端不走 SSR 也必须传。
  if (typeof useSyncExternalStore === 'function') {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }
  return EMPTY_DIRECTORY_STATE
}

/**
 * 解析当前模型的 reasoning 元数据（等级列表 + 默认等级）。
 *
 * 目录返回的是 `{ groups: [{ id, models: [{ id, name, reasoning }] }] }`；
 * `reasoning` 缺席表示该适配器没有推理元数据 —— 此时不显示等级行。
 * @returns `{ defaultEffort, efforts }`，或 undefined。
 */
function resolveReasoning(state, current) {
  if (state === null || current === null || current === undefined) return undefined
  for (const group of state.groups) {
    if (group.id !== current.provider) continue
    for (const model of group.models) {
      if (model.id !== current.model) continue
      if (model.reasoning === undefined || model.reasoning === null) return undefined
      const efforts = Array.isArray(model.reasoning.efforts) ? model.reasoning.efforts : []
      return { defaultEffort: model.reasoning.defaultEffort, efforts }
    }
  }
  return undefined
}

/* ------------------------------------------------------------------ *
 * 4. 样式（注入一次，带 data-plugin-css 去重标记）
 * ------------------------------------------------------------------ */

const CSS = `
.ce-root{flex:none;display:inline-flex;position:relative}
.ce-trigger{border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-variant-numeric:tabular-nums;line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;cursor:pointer;background:0 0;border:none;flex:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}
.ce-trigger:hover,.ce-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.ce-track{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:2px}
.ce-fill{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:2px;stroke-linecap:round}
.ce-reading{font-variant-numeric:tabular-nums}
.ce-effortLabel{color:var(--dsw-alias-label-tertiary);border-left:1px solid var(--dsw-alias-border-l3);padding-left:6px;max-width:9em;overflow:hidden;text-overflow:ellipsis}
.ce-chevron{opacity:.7}
.ce-panel{z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);width:min(320px,100vw - 16px);max-height:min(70vh,560px);overflow-y:auto;overscroll-behavior:contain;backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:12px;font-size:12px;line-height:20px;position:fixed}
.ce-panelHead{align-items:center;gap:6px;display:flex}
.ce-figures{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-left:auto;font-weight:500}
.ce-percent{color:var(--dsw-alias-label-primary);font-weight:500}
.ce-headline{color:var(--dsw-alias-label-tertiary)}
.ce-headline:empty{display:none}
.ce-bar{background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;gap:1px;height:4px;margin:10px 0 12px;display:flex;overflow:hidden}
.ce-segment{background:var(--ce-tint,var(--dsw-alias-label-tertiary));border-radius:1px;flex:none;min-width:2px;height:100%}
.ce-swatch{background:var(--ce-tint);vertical-align:baseline;border-radius:2px;width:8px;height:8px;margin-right:6px;display:inline-block}
.ce-colorSystem{--ce-tint:var(--dsw-static-neutral-bluish-400)}
.ce-colorTools{--ce-tint:#a78bfa}
.ce-colorMessages{--ce-tint:var(--dsw-static-blue-450)}
.ce-rows{margin:6px 0 0;padding:0}
.ce-row{justify-content:space-between;align-items:center;gap:12px;padding:2px 0;display:flex}
.ce-row dt{color:var(--dsw-alias-label-secondary);margin:0}
.ce-row dd{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin:0}
.ce-sectionTitle{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-weight:500}
.ce-block{margin-top:4px}
.ce-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.ce-chip{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;padding:3px 10px;cursor:pointer;white-space:nowrap}
.ce-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.ce-chip:disabled{opacity:.5;cursor:default}
.ce-chipActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary)}
.ce-chip--model{font-size:11px;padding:2px 8px;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.ce-disclosure{display:flex;align-items:center;gap:6px;width:100%;background:0 0;border:0;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;padding:8px 0 4px;margin-top:8px;text-align:left}
.ce-disclosure:hover{color:var(--dsw-alias-label-secondary)}
.ce-disclosureValue{margin-left:auto;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;max-width:12em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-chevron--open{transform:rotate(180deg)}
.ce-empty{color:var(--dsw-alias-label-tertiary);padding:4px 0}
.ce-capacityRow{display:flex;gap:6px;align-items:center;margin-top:8px}
.ce-capacityInput{flex:1;min-width:0;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-variant-numeric:tabular-nums;padding:5px 8px}
.ce-capacityInput:focus{outline:none;border-color:var(--dsw-alias-label-tertiary)}
.ce-capacityInput:disabled{opacity:.6}
.ce-capacitySave{flex:none;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font:inherit;padding:5px 12px;cursor:pointer;white-space:nowrap}
.ce-capacitySave:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}
.ce-capacitySave:disabled{opacity:.5;cursor:default}
.ce-chips--presets{margin-top:6px}
.ce-chip--preset{font-size:11px;padding:2px 8px}
.ce-hint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin-top:4px}
.ce-status{color:var(--dsw-alias-label-tertiary);margin-top:10px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:8px}
.ce-status--error{color:var(--dsw-alias-status-error, #e5484d)}
`

const CSS_TAG_ID = 'dsh-context-effort/ContextEffort.css'

function installCss() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_TAG_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-context-effort'
  tag.dataset.pluginCss = CSS_TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

/* ------------------------------------------------------------------ *
 * 5. 插件入口
 * ------------------------------------------------------------------ */

export const name = 'dsh-context-effort'

/**
 * cordis 的数组式 inject：声明本插件在客户端需要哪些服务活着。
 *
 * 这里的依赖表与官方 `@deepseek-ai/dsh-client-ui-model-selection` 对齐 ——
 * 因为我们要用它的 `ctx.modelDirectories`，而那个服务内部依赖
 * `sessions` / `remote` / `remote.session`（`ModelDirectoryResolver.inject`）。
 * cordis 要求**显式声明传递依赖**，否则访问 `models.directoryFor()` 时会抛
 * `cannot get property "remote.session" without inject`。
 *
 * 逐项用途：
 *   - `slots`：注册 UI 座位。
 *   - `locale`：文案字典。
 *   - `modelDirectories`：per-session 模型/等级目录（读当前值 + select）。
 *   - `sessions`：子代理会话判定（子代理不暴露独立模型选择）。
 *   - `remote` / `remote.session`：目录服务的模型目录拉取与事件订阅。
 *
 * **刻意不放进插件 inject 的**（改为 `ctx.get()` 惰性获取）：
 *   - `configForms`：写模型配置用的共享设置镜像。它列在**作用域** inject 里
 *     （`ctx.inject([...], cb)`），因为座位注册与写入都发生在作用域内；
 *     取值仍走 `optional()` → `ctx.get('configForms')`，两条路都通。
 *
 * 原因：`inject` 里列了但目标环境缺少的服务会让**整个插件**加载失败 ——
 * 连上下文计量都一起没了。写配置只是增强能力，缺了它插件仍应可用。
 *
 * ⚠️ `remote` 的子命名空间（`remote.llm` 这类）有一条容易踩的规则：
 *   · **属性访问**（`scope.remote.llm`）必须在 inject 里单独列出，否则 cordis 的
 *     上下文 Proxy 直接抛 `cannot get property "remote.llm" without inject`
 *     ——未声明的子命名空间**不会**回落到 undefined，而是抛错；
 *   · **`ctx.get('remote.llm')`** 按服务名查存储，**不受该守卫限制**（cordis 的
 *     `ReflectService.get` 注释即"Read a service from the store without the inject
 *     requirement"）。
 *
 * 因此写路径两条路都实现（见 `optional()` / `resolveSettingsNs`）：先 `ctx.get()`，
 * 再回落到已声明的属性访问。**`remote.llm` 必须留在上面的 inject 列表里** ——
 * 2026-10-16 的回归事故就是把它删掉、只靠 `ctx.get()`，结果面板一保存就报
 * `cannot get property "remote.llm" without inject`。
 *
 * 本插件用到的 `remote.session` 属于目录服务的传递依赖，必须列在 inject 里。
 */
export const inject = [
  'slots',
  'locale',
  'modelDirectories',
  'sessions',
  'remote',
  'remote.session',
  // 写模型配置要枚举可配置 provider（拿 settingsNs）。必须显式列出：
  // cordis 的上下文 Proxy 对**未声明的子命名空间属性访问**直接抛
  // `cannot get property "remote.llm" without inject`——只靠 ctx.get() 兜底
  // 会在拿不到服务名时整条写路径失效（2026-10-16 实测就是这个问题）。
  'remote.llm',
]

/**
 * @param ctx - 客户端 cordis 上下文。
 */
export function apply(ctx) {
  installCss()

  const dicts = {
    zh: {
      'number.thousand': '{value}K',
      'number.million': '{value}M',
      'label.context': '上下文',
  'label.contextLimit': '上下文长度',
  'capacity.effective': '生效值',
  'capacity.declared': '配置声明',
  'capacity.inherited': '未设置（继承默认）',
  'capacity.placeholder': '如 512K / 1M；留空即继承',
  'capacity.save': '保存',
  'capacity.saving': '保存中…',
  'capacity.saved': '已保存，下一条请求生效',
  'capacity.invalid': '格式无法识别，请用 256K / 512K / 1M 这类写法',
  'capacity.failed': '保存失败：{reason}',
  'capacity.unavailable': '当前环境不支持写入模型配置',
  'capacity.hint': 'K=1000、M=1000000（十进制）。模型未声明时会落回适配器默认 256K，这里填的值会写入该模型配置。',
      'label.used': '已用',
      'label.limit': '上限',
      'label.remaining': '剩余',
      'label.percent': '占用',
      'label.effort': '思考等级',
      'label.model': '模型',
      'label.providerDefault': '跟随模型默认',
      'panel.title': '上下文与思考等级',
      'panel.noEfforts': '当前模型未提供推理等级。',
      'panel.globalLevelsHint': '该模型未声明推理等级，已使用全局等级集；首次切换会写入模型配置。',
      'panel.noPressure': '等待模型上报上下文用量…',
      'panel.switching': '切换中…',
      'panel.enabling': 'Enabling reasoning levels…',
      'panel.enableFailed': 'Failed to write model config: {reason}',
      'panel.failed': '切换失败：{reason}',
      'panel.breakdown': '构成（启发式估算）',
      'breakdown.system': '系统提示',
      'breakdown.tools': '工具',
      'breakdown.messages': '对话消息',
      'a11y.trigger': '上下文占用 {percent}，点击调整思考等级',
      'a11y.dialog': '上下文与思考等级',
    },
    en: {
      'number.thousand': '{value}K',
      'number.million': '{value}M',
      'label.context': 'Context',
      'label.contextLimit': 'Context length',
      'capacity.effective': 'Effective',
      'capacity.declared': 'Declared',
      'capacity.inherited': 'Unset (inherits default)',
      'capacity.placeholder': 'e.g. 512K / 1M; blank inherits',
      'capacity.save': 'Save',
      'capacity.saving': 'Saving…',
      'capacity.saved': 'Saved; applies to the next request',
      'capacity.invalid': 'Unrecognized format — use 256K / 512K / 1M',
      'capacity.failed': 'Save failed: {reason}',
      'capacity.unavailable': 'Writing model config is unavailable here',
      'capacity.hint': 'K=1000, M=1000000 (decimal). Undeclared models fall back to the adapter default 256K; a value here is written into that model config.',
      'label.used': 'Used',
      'label.limit': 'Limit',
      'label.remaining': 'Left',
      'label.percent': 'Usage',
      'label.effort': 'Effort',
      'label.model': 'Model',
      'label.providerDefault': 'Provider default',
      'panel.title': 'Context and reasoning effort',
      'panel.noEfforts': 'This model provides no reasoning effort levels.',
      'panel.globalLevelsHint': 'This model declares no reasoning levels; the global set is shown. The first switch writes it into the model config.',
      'panel.noPressure': 'Waiting for the model to report context usage…',
      'panel.switching': 'Switching…',
      'panel.enabling': 'Enabling reasoning levels…',
      'panel.enableFailed': 'Failed to write model config: {reason}',
      'panel.failed': 'Switch failed: {reason}',
      'panel.breakdown': 'Composition (heuristic)',
      'breakdown.system': 'System',
      'breakdown.tools': 'Tools',
      'breakdown.messages': 'Messages',
      'a11y.trigger': '{percent} of context used — click to change reasoning effort',
      'a11y.dialog': 'Context and reasoning effort',
    },
  }

  ctx.effect(() => ctx.locale.register(NS, dicts), 'dsh-context-effort: dictionaries')

  ctx.inject(['slots', 'modelDirectories', 'sessions', 'remote', 'configForms'], (scope) => {
    const models = scope.modelDirectories
    const sessions = scope.sessions
    const remote = scope.remote

    /**
     * 可选服务：写模型配置需要 `configForms`（共享设置镜像）。
     *
     * 用 `scope.get()` **惰性**取，而不是放进硬性 `inject` —— 这是可移植性的
     * 关键：`inject` 里列了但目标环境缺少的服务会让**整个插件**加载失败
     * （连上下文计量都一起没了）。写配置属于增强能力，缺了它插件仍应可用，
     * 只是保存/切等级会返回"当前环境不支持"。
     */
    const optional = (name) => {
      // 先按服务名查存储：`ctx.get()` 是 cordis 明确的「不要求 inject」读口
      // （ReflectService.get 的注释即此意）。对 `remote.llm` 这类子命名空间，
      // 它是唯一不触发 `cannot get property "…" without inject` 守卫的取法 ——
      // 守卫挂在上下文 Proxy 的 get 上，只拦属性访问，不拦 get()。
      try {
        const viaGet = typeof scope.get === 'function' ? scope.get(name) : undefined
        if (viaGet !== undefined) return viaGet
      } catch {
        /* 落到属性访问再试一次 */
      }
      // 兜底：本上下文 inject 里声明过的服务可以直接取属性。
      try {
        return scope[name]
      } catch {
        return undefined
      }
    }
    const configForms = optional('configForms')

    scope.slots.inject('conversation.input.right', () =>
      scope.slots.register(
        {
          name: 'conversation.input.right',
          id: 'context-effort',
          // 排在官方 model 座位之后（模型座位无显式 order，视作 0）。
          order: 10,
          locale: NS,
          /**
           * 每次渲染按 session 解析模型目录。
           *
           * 目录服务对「还没有 Agent 的空白会话」「已寻址的子代理会话」等情况
           * 会抛错或返回不可用目录 —— 那属于**暂时性**状态，不能当成永久禁用
           * （否则用户建完会话后本控件再也不出现）。所以这里：
           *   - 失败只记原因并标记 available=false，业务 props 仍完整返回；
           *   - 上下文占用数据与目录无关，组件照常渲染；
           *   - 每次 open / load 都会重新尝试解析。
           */
          inject: (sessionId) => {
            const resolve = () => {
              try {
                const directory = models.directoryFor(sessionId)
                if (directory === undefined) {
                  return { directory: undefined, reason: 'no-directory' }
                }
                // 子代理会话不暴露独立模型选择（与官方 ModelSelect 一致）。
                const addressed =
                  typeof sessions?.subagentAddress === 'function' &&
                  sessions.subagentAddress(sessionId) !== undefined
                if (addressed) return { directory, reason: 'addressed' }
                return { directory, reason: undefined }
              } catch (error) {
                return {
                  directory: undefined,
                  reason: String(error?.message ?? error),
                }
              }
            }

            /**
             * 定位某个模型在设置文档里的条目。
             *
             * 读路径与写路径必须一致 —— 都走 `ctx.configForms` 的共享镜像：
             * 非 settings 页面直接调 `remote.settings.describe()` 会拿到**空的
             * 命名空间列表**，因为 `ConfigForms` 持有的是"提供方 fiber"。
             *
             * @param provider - provider id。
             * @param model - 模型 id。
             * @param settingsNs - 设置命名空间。
             * @returns `{ ok: true, form, doc, profile, entry, index }` 或错误。
             */
            const locateModel = (provider, model, settingsNs) => {
              const forms = configForms
              if (forms === undefined || typeof forms.get !== 'function') {
                return { ok: false, error: 'configForms 服务不可用' }
              }
              const form = forms.get(settingsNs)
              if (form === undefined) {
                return { ok: false, error: `拿不到 ${settingsNs} 的配置表单` }
              }
              const snapshot = form.getSnapshot()
              if (snapshot?.status !== 'ready') {
                return {
                  ok: false,
                  error: `设置镜像未就绪（status=${String(snapshot?.status)}）`,
                }
              }
              const doc = snapshot.value
              if (doc === undefined || doc === null) {
                return { ok: false, error: `${settingsNs} 没有配置内容` }
              }
              // llm-pi-ai 的模型挂在 providers[provider].models
              const profile = settingsNs === 'llm-pi-ai' ? doc.providers?.[provider] : doc
              if (typeof profile !== 'object' || profile === null) {
                return { ok: false, error: `配置里找不到 provider ${provider}` }
              }
              const models = Array.isArray(profile.models) ? profile.models : []
              const index = models.findIndex((item) => item && item.id === model)
              if (index < 0) {
                return { ok: false, error: `配置里找不到模型 ${model}` }
              }
              return { ok: true, form, doc, profile, entry: models[index], index, models }
            }

            /**
             * 把一组字段写进某个模型条目 —— **只写这些字段，其余一概不动**。
             *
             * 值是 `undefined` 的字段会从条目里**删除**（继承默认），
             * 这与官方容量输入的"留空即继承"语义一致。
             *
             * @param provider - provider id。
             * @param model - 模型 id。
             * @param settingsNs - 设置命名空间。
             * @param patch - 要写入的字段。
             * @returns `{ ok: true }` 或 `{ ok: false, error }`。
             */
            const updateModelConfig = async (provider, model, settingsNs, patch) => {
              try {
                const located = locateModel(provider, model, settingsNs)
                if (located.ok !== true) return located
                const { form, index } = located

                // 只写本次要改的字段：路径精确到 `<base>.<字段>`。
                // 为什么不再整份 provider 回写：那会把宿主文档里的 schema 默认值
                // 实体化落盘（input: []、compat{}），并把用户没碰过的字段（如
                // maxTokens）一并复写 —— diff 上看起来像"插件把输出上限也改了"。
                // 宿主 applyPathOp 的语义：数字段按数组下标寻址（越界抛 TypeError，
                // 由外层 catch 转成可读错误），落在对象键上的 unset 就是删该键
                // （只有路径末段是数组下标时 unset 才会 splice 数组元素）。
                const base = settingsNs === 'llm-pi-ai'
                  ? ['providers', provider, 'models', String(index)]
                  : ['models', String(index)]
                const ops = modelPatchOps(base, patch)
                if (ops.length === 0) return { ok: true }

                // configForms 的写队列自带 revision 与冲突处理
                const accepted = await form.mutate(ops)
                if (accepted === false) {
                  return { ok: false, error: `${settingsNs} 拒绝了写入` }
                }
                return { ok: true }
              } catch (error) {
                return { ok: false, error: String(error?.message ?? error) }
              }
            }

            const first = resolve()
            return {
              available: first.directory !== undefined && first.reason === undefined,
              unavailableReason: first.reason,
              sessionId,
              directory: first.directory?.store,
              load: () => {
                try {
                  const now = resolve()
                  if (now.directory !== undefined) now.directory.load().catch(() => {})
                } catch {
                  /* 目录未就绪：下次打开再试 */
                }
              },
              select: (selection) => {
                const now = resolve()
                if (now.directory === undefined) return Promise.resolve(undefined)
                return now.directory.select(selection)
              },
              /**
               * 解析 provider → 设置命名空间。
               * @param provider - provider id。
               * @returns `{ ok: true, settingsNs }` 或 `{ ok: false, error }`。
               */
              resolveSettingsNs: async (provider) => {
                // `remote.llm` 刻意不放进 inject（见文件顶部的可移植性说明），
                // 而 cordis 对未声明的子命名空间**属性访问**会抛
                // `cannot get property "remote.llm" without inject`。
                // 所以先走 `optional()` → `ctx.get('remote.llm')`（按服务名查存储，
                // 不经那道守卫）；只有它拿不到时才回落到属性访问。
                let llm = optional('remote.llm')
                if (llm === undefined) {
                  try {
                    llm = remote?.llm
                  } catch {
                    llm = undefined
                  }
                }
                if (llm === undefined || typeof llm.listConfigurableProviders !== 'function') {
                  return {
                    ok: false,
                    error: 'remote.llm 不可用，无法写入模型配置（当前宿主没有提供该服务）',
                  }
                }
                try {
                  const response = await llm.listConfigurableProviders()
                  if (!response.ok) return { ok: false, error: response.error.message }
                  const entry = response.value.find((item) => item.provider === provider)
                  if (entry === undefined) {
                    return { ok: false, error: `provider ${provider} 没有可写配置` }
                  }
                  return { ok: true, settingsNs: entry.settingsNs }
                } catch (error) {
                  return { ok: false, error: String(error?.message ?? error) }
                }
              },
              /**
               * 把全局等级集写入当前 provider 的模型配置，让 host 侧真正生效。
               *
               * 为什么需要：自定义 provider 的模型若没在适配器配置里声明
               * `reasoningEfforts`，host 的 `resolveModelInfo` 就不会给出
               * reasoning 元数据 —— 目录里读不到等级，`session.selectModel`
               * 传 `reasoningEffort` 也不会被真的写进请求。
               *
               * 写路径（关键）：必须走 **`ctx.configForms`** —— 官方
               * `@deepseek-ai/dsh-client-ui-settings` 提供的共享设置镜像服务，
               * 不是直接调 `remote.settings.describe()`。
               *
               * 原因见该服务源码注释：
               *   "The PROVIDING fiber, kept because a Service reads `ctx` as its
               *    *consumer's* fiber: letting a shared form write through the
               *    caller's context would make every caller declare
               *    `remote.settings` in its own `inject`."
               * 也就是说：非 settings 页面直接读 `remote.settings.describe()`
               * 拿到的是**空命名空间列表**；只有经 configForms 的镜像才看得到
               * 真实文档，且它自带 revision 与写队列。
               *
               * @param provider - provider id（目录 group 的 id）。
               * @param model - 该 provider 下的模型 id。
               * @param levels - 等级 id 列表。
               * @param settingsNs - 该 provider 的设置命名空间（由调用方从
               *   `remote.llm.listConfigurableProviders()` 取得）。
               * @returns `{ ok: true }` 或 `{ ok: false, error }`。
               */
              enableEfforts: async (provider, model, levels, settingsNs) => {
                // 等级 → wire 值。off 用 null 表示"不发送思考参数"。
                const efforts = {}
                for (const level of levels) efforts[level] = level === 'off' ? null : level
                return updateModelConfig(provider, model, settingsNs, {
                  reasoningEfforts: efforts,
                })
              },
              /**
               * 读当前模型在配置里**声明**的容量字段。
               *
               * 与 `contextPressure.contextWindow`（host 解析后的**生效值**）不同：
               * 这里读的是「配置里写了什么」。未声明时返回 undefined ——
               * 正是用户要区分的那两种情况（自身支持 1M vs 落回适配器默认）。
               *
               * @param provider - provider id。
               * @param model - 模型 id。
               * @param settingsNs - 设置命名空间。
               * @returns `{ ok: true, declared: {contextWindow?, maxTokens?} }` 或错误。
               */
              readModelCapacity: async (provider, model, settingsNs) => {
                const located = locateModel(provider, model, settingsNs)
                if (located.ok !== true) return located
                const { entry } = located
                return {
                  ok: true,
                  declared: {
                    contextWindow:
                      typeof entry.contextWindow === 'number' ? entry.contextWindow : undefined,
                    maxTokens: typeof entry.maxTokens === 'number' ? entry.maxTokens : undefined,
                  },
                }
              },
              /**
               * 保存当前模型的容量字段（`contextWindow` / `maxTokens`）。
               *
               * 值为 `undefined` 表示**清空该字段、继承适配器默认**（与官方
               * 设置→模型 的"留空即继承"语义一致）。
               *
               * 注意 `K`/`M` 是**十进制**：`1M` = 1000000、`256K` = 256000
               * （官方 `CAPACITY_SCALE` 同为 1000 / 1000000）。
               *
               * @param provider - provider id。
               * @param model - 模型 id。
               * @param settingsNs - 设置命名空间。
               * @param capacity - `{ contextWindow?, maxTokens? }`。
               * @returns `{ ok: true }` 或 `{ ok: false, error }`。
               */
              saveModelCapacity: async (provider, model, settingsNs, capacity) =>
                updateModelConfig(provider, model, settingsNs, capacity),
            }
          },
        },
        ContextEffort,
      ),
    )
  })
}
