window.__ModuleLoader__.load({
	id: "dsh-context-effort",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		(function (module, exports, require) {
			var __defProp = Object.defineProperty;
			var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
			var __getOwnPropNames = Object.getOwnPropertyNames;
			var __hasOwnProp = Object.prototype.hasOwnProperty;
			var __export = (target, all) => {
			  for (var name2 in all)
			    __defProp(target, name2, { get: all[name2], enumerable: true });
			};
			var __copyProps = (to, from, except, desc) => {
			  if (from && typeof from === "object" || typeof from === "function") {
			    for (let key of __getOwnPropNames(from))
			      if (!__hasOwnProp.call(to, key) && key !== except)
			        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
			  }
			  return to;
			};
			var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

			// src/client/index.js
			var index_exports = {};
			__export(index_exports, {
			  CAPACITY_PRESETS: () => CAPACITY_PRESETS,
			  ContextEffort: () => ContextEffort,
			  GLOBAL_THINKING_LEVELS: () => GLOBAL_THINKING_LEVELS,
			  apply: () => apply,
			  buildEffortSelection: () => buildEffortSelection,
			  buildModelSelection: () => buildModelSelection,
			  contextOccupancy: () => contextOccupancy,
			  formatCapacity: () => formatCapacity,
			  formatTokens: () => formatTokens,
			  inject: () => inject,
			  modelPatchOps: () => modelPatchOps,
			  name: () => name,
			  parseCapacity: () => parseCapacity,
			  resolveEffortLevels: () => resolveEffortLevels
			});
			module.exports = __toCommonJS(index_exports);
			var import_react = require("react");
			var import_react2 = require("react");
			var import_react_dom = require("react-dom");
			var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
			var NS = "dsh-context-effort";
			function contextOccupancy(pressure) {
			  const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens;
			  if (usedTokens === void 0 || pressure?.contextWindow === void 0) return null;
			  return {
			    percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
			    usedTokens,
			    contextWindow: pressure.contextWindow
			  };
			}
			function formatTokens(value, t) {
			  const scaled = (candidate) => candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10);
			  if (value < 1e3) return String(value);
			  if (value < 1e6) return t("number.thousand", { value: scaled(value / 1e3) });
			  return t("number.million", { value: scaled(value / 1e6) });
			}
			function buildEffortSelection(current, effort) {
			  if (current === null || current === void 0) return null;
			  if (current.provider === void 0 || current.model === void 0) return null;
			  return {
			    provider: current.provider,
			    model: current.model,
			    ...effort === void 0 ? {} : { reasoningEffort: effort }
			  };
			}
			function buildModelSelection(provider, model, defaultEffort) {
			  return {
			    provider,
			    model,
			    ...defaultEffort === void 0 ? {} : { reasoningEffort: defaultEffort }
			  };
			}
			var GLOBAL_THINKING_LEVELS = [
			  "off",
			  "minimal",
			  "low",
			  "medium",
			  "high",
			  "xhigh",
			  "max"
			];
			var CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i;
			var CAPACITY_SCALE = { k: 1e3, m: 1e6 };
			function parseCapacity(text) {
			  const trimmed = String(text ?? "").trim();
			  if (trimmed.length === 0) return void 0;
			  const match = CAPACITY_PATTERN.exec(trimmed);
			  if (match === null) return Number.NaN;
			  const suffix = match[2]?.toLowerCase();
			  const scale = suffix === "k" || suffix === "m" ? CAPACITY_SCALE[suffix] : 1;
			  const scaled = Number(match[1]) * scale;
			  const rounded = Math.round(scaled);
			  return Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled;
			}
			function formatCapacity(value) {
			  if (!Number.isInteger(value) || value <= 0) return String(value);
			  if (value % CAPACITY_SCALE.m === 0) return `${String(value / CAPACITY_SCALE.m)}M`;
			  if (value % CAPACITY_SCALE.k === 0) return `${String(value / CAPACITY_SCALE.k)}K`;
			  return String(value);
			}
			var CAPACITY_PRESETS = [128e3, 256e3, 512e3, 1e6, 2e6];
			function modelPatchOps(base, patch) {
			  const ops = [];
			  for (const [key, value] of Object.entries(patch ?? {})) {
			    if (value === void 0) ops.push({ op: "unset", path: [...base, key] });
			    else ops.push({ op: "set", path: [...base, key], value });
			  }
			  return ops;
			}
			function resolveEffortLevels(reasoning) {
			  if (reasoning !== void 0 && reasoning !== null && Array.isArray(reasoning.efforts) && reasoning.efforts.length > 0) {
			    return {
			      synthetic: false,
			      defaultEffort: reasoning.defaultEffort,
			      levels: reasoning.efforts.map((level) => ({
			        id: level.id,
			        label: level.name ?? level.id
			      }))
			    };
			  }
			  return {
			    synthetic: true,
			    defaultEffort: void 0,
			    levels: GLOBAL_THINKING_LEVELS.map((id) => ({
			      id,
			      label: id === "off" ? "off" : id
			    }))
			  };
			}
			var FALLBACK = {
			  "number.thousand": "{value}K",
			  "number.million": "{value}M",
			  "label.context": "上下文",
			  "label.contextLimit": "上下文长度",
			  "capacity.effective": "生效值",
			  "capacity.declared": "配置声明",
			  "capacity.inherited": "未设置（继承默认）",
			  "capacity.placeholder": "如 512K / 1M；留空即继承",
			  "capacity.save": "保存",
			  "capacity.saving": "保存中…",
			  "capacity.saved": "已保存，下一条请求生效",
			  "capacity.invalid": "格式无法识别，请用 256K / 512K / 1M 这类写法",
			  "capacity.failed": "保存失败：{reason}",
			  "capacity.unavailable": "当前环境不支持写入模型配置",
			  "capacity.hint": "K=1000、M=1000000（十进制）。模型未声明时会落回适配器默认 256K，这里填的值会写入该模型配置。",
			  "label.used": "已用",
			  "label.limit": "上限",
			  "label.remaining": "剩余",
			  "label.percent": "占用",
			  "label.effort": "思考等级",
			  "label.model": "模型",
			  "label.providerDefault": "跟随模型默认",
			  "panel.title": "上下文与思考等级",
			  "panel.noEfforts": "当前模型未提供推理等级。",
			  "panel.globalLevelsHint": "该模型未声明推理等级，已使用全局等级集；首次切换会写入模型配置。",
			  "panel.noPressure": "等待模型上报上下文用量…",
			  "panel.switching": "切换中…",
			  "panel.enabling": "正在启用推理等级…",
			  "panel.enableFailed": "写入模型配置失败：{reason}",
			  "panel.failed": "切换失败：{reason}",
			  "panel.breakdown": "构成（启发式估算）",
			  "breakdown.system": "系统提示",
			  "breakdown.tools": "工具",
			  "breakdown.messages": "对话消息",
			  "a11y.trigger": "上下文占用 {percent}，点击调整思考等级",
			  "a11y.dialog": "上下文与思考等级"
			};
			function makeFallbackT() {
			  return (key, params) => {
			    const raw = FALLBACK[key] ?? key;
			    if (params === void 0) return raw;
			    return raw.replace(
			      /\{(\w+)\}/g,
			      (_m, name2) => Object.hasOwn(params, name2) ? String(params[name2]) : `{${name2}}`
			    );
			  };
			}
			var RADIUS = 5.5;
			var CIRCUMFERENCE = 2 * Math.PI * RADIUS;
			var READING_SLOT = "\0";
			var BREAKDOWN_ROWS = [
			  { key: "systemTokens", label: "breakdown.system", cls: "ce-colorSystem" },
			  { key: "toolsTokens", label: "breakdown.tools", cls: "ce-colorTools" },
			  { key: "messageTokens", label: "breakdown.messages", cls: "ce-colorMessages" }
			];
			function ContextEffort(props) {
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
			    saveModelCapacity
			  } = props;
			  const t = injectedT ?? makeFallbackT();
			  const state = useDirectoryState(directory, useSession);
			  const pressure = useProjection("contextPressure");
			  const breakdown = useProjection("contextBreakdown");
			  const [open, setOpen] = (0, import_react2.useState)(false);
			  const [modelOpen, setModelOpen] = (0, import_react2.useState)(false);
			  const rootRef = (0, import_react2.useRef)(null);
			  const panelRef = (0, import_react2.useRef)(null);
			  const context = contextOccupancy(pressure);
			  const hasContext = context !== null;
			  const canEdit = available !== false;
			  const position = (0, import_dsh_client_ui_primitives.useAnchoredPosition)({
			    open: open && canEdit,
			    anchorRef: rootRef,
			    panelRef,
			    side: "top",
			    gap: 8,
			    margin: 12
			  });
			  (0, import_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open && canEdit, setOpen, panelRef);
			  (0, import_react2.useEffect)(() => {
			    if (open && canEdit && typeof load === "function") load();
			  }, [open, canEdit, load]);
			  (0, import_react2.useEffect)(() => {
			    if (!canEdit && open) setOpen(false);
			  }, [canEdit, open]);
			  (0, import_react2.useEffect)(() => {
			    if (!open || !canEdit) return void 0;
			    const onKeyDown = (e) => {
			      if (e.key === "Escape") setOpen(false);
			    };
			    document.addEventListener("keydown", onKeyDown);
			    return () => document.removeEventListener("keydown", onKeyDown);
			  }, [canEdit, open]);
			  const current = state.current;
			  const reasoning = (0, import_react2.useMemo)(
			    () => resolveReasoning(state, current),
			    [state, current]
			  );
			  const effortLevels = (0, import_react2.useMemo)(() => resolveEffortLevels(reasoning), [reasoning]);
			  const [enabling, setEnabling] = (0, import_react2.useState)(null);
			  const [enablingError, setEnablingError] = (0, import_react2.useState)(null);
			  const [declaredCapacity, setDeclaredCapacity] = (0, import_react2.useState)(void 0);
			  const [capacityDraft, setCapacityDraft] = (0, import_react2.useState)("");
			  const [capacityBusy, setCapacityBusy] = (0, import_react2.useState)(false);
			  const [capacityError, setCapacityError] = (0, import_react2.useState)(null);
			  const [capacitySaved, setCapacitySaved] = (0, import_react2.useState)(false);
			  const modelKey = current === null || current === void 0 ? null : `${current.provider}\0${current.model}`;
			  (0, import_react2.useEffect)(() => {
			    if (!open || modelKey === null) return void 0;
			    if (typeof readModelCapacity !== "function" || typeof resolveSettingsNs !== "function") {
			      return void 0;
			    }
			    let cancelled = false;
			    setCapacityError(null);
			    setCapacitySaved(false);
			    (async () => {
			      const resolved = await resolveSettingsNs(current.provider);
			      if (cancelled) return;
			      if (resolved.ok !== true) {
			        setDeclaredCapacity(void 0);
			        setCapacityDraft("");
			        return;
			      }
			      const read = await readModelCapacity(current.provider, current.model, resolved.settingsNs);
			      if (cancelled) return;
			      if (read.ok !== true) {
			        setDeclaredCapacity(void 0);
			        setCapacityDraft("");
			        return;
			      }
			      const declared = read.declared?.contextWindow;
			      setDeclaredCapacity(declared);
			      setCapacityDraft(declared === void 0 ? "" : formatCapacity(declared));
			    })().catch(() => {
			    });
			    return () => {
			      cancelled = true;
			    };
			  }, [open, modelKey, readModelCapacity, resolveSettingsNs, current]);
			  const onSaveCapacity = (0, import_react2.useCallback)(async () => {
			    if (current === null || current === void 0) return;
			    const parsed = parseCapacity(capacityDraft);
			    if (Number.isNaN(parsed)) {
			      setCapacityError(t("capacity.invalid"));
			      return;
			    }
			    if (typeof saveModelCapacity !== "function" || typeof resolveSettingsNs !== "function") {
			      setCapacityError(t("capacity.unavailable"));
			      return;
			    }
			    setCapacityBusy(true);
			    setCapacityError(null);
			    setCapacitySaved(false);
			    const resolved = await resolveSettingsNs(current.provider);
			    if (resolved.ok !== true) {
			      setCapacityBusy(false);
			      setCapacityError(resolved.error ?? t("capacity.unavailable"));
			      return;
			    }
			    const result = await saveModelCapacity(current.provider, current.model, resolved.settingsNs, {
			      contextWindow: parsed
			    });
			    setCapacityBusy(false);
			    if (result && result.ok === false) {
			      setCapacityError(result.error ?? t("capacity.failed"));
			      return;
			    }
			    setDeclaredCapacity(parsed);
			    setCapacitySaved(true);
			    if (typeof load === "function") load();
			  }, [
			    current,
			    capacityDraft,
			    saveModelCapacity,
			    resolveSettingsNs,
			    load,
			    t
			  ]);
			  const onPickEffort = (0, import_react2.useCallback)(
			    async (effort) => {
			      if (current === null || current === void 0 || effort === void 0) return;
			      if (effortLevels.synthetic && typeof enableEfforts === "function") {
			        setEnablingError(null);
			        setEnabling({ effort });
			        const resolved = typeof resolveSettingsNs === "function" ? await resolveSettingsNs(current.provider) : { ok: false, error: "resolveSettingsNs 不可用" };
			        if (resolved.ok !== true) {
			          setEnabling(null);
			          setEnablingError(resolved.error ?? "无法解析设置命名空间");
			          return;
			        }
			        const result = await enableEfforts(
			          current.provider,
			          current.model,
			          GLOBAL_THINKING_LEVELS,
			          resolved.settingsNs
			        );
			        setEnabling(null);
			        if (result && result.ok === false) {
			          setEnablingError(result.error ?? "写入模型配置失败");
			          return;
			        }
			        if (typeof load === "function") load();
			      }
			      const selection = buildEffortSelection(current, effort);
			      if (selection !== null) select(selection);
			    },
			    [current, select, effortLevels.synthetic, enableEfforts, resolveSettingsNs, load]
			  );
			  const onPickModel = (0, import_react2.useCallback)(
			    (provider, model, defaultEffort) => {
			      select(buildModelSelection(provider, model, defaultEffort));
			    },
			    [select]
			  );
			  if (!hasContext && !canEdit) return null;
			  const percent = hasContext ? context.percent : 0;
			  const reading = `${percent}%`;
			  const [headBefore = "", headAfter = ""] = String(
			    t("a11y.trigger", { percent: READING_SLOT })
			  ).split(READING_SLOT).map((part) => part.trim());
			  const breakdownTotal = breakdown === void 0 ? 0 : breakdown.systemTokens + breakdown.toolsTokens + breakdown.messageTokens;
			  const segments = breakdown === void 0 || breakdownTotal === 0 ? [{ key: "total", cls: void 0, width: percent }] : BREAKDOWN_ROWS.map((row2) => ({
			    key: row2.key,
			    cls: row2.cls,
			    width: percent * breakdown[row2.key] / breakdownTotal
			  }));
			  const visibleSegments = segments.filter((part) => part.width > 0);
			  const busy = state.status === "selecting" || enabling !== null;
			  const currentEffort = current?.reasoningEffort ?? reasoning?.defaultEffort;
			  const effortLabel = (() => {
			    if (currentEffort !== void 0) {
			      const found = effortLevels.levels.find((level) => level.id === currentEffort);
			      if (found !== void 0) return found.label;
			      return currentEffort;
			    }
			    if (effortLevels.synthetic) return t("label.providerDefault");
			    return effortLevels.defaultEffort === void 0 ? t("label.providerDefault") : effortLevels.levels.find((level) => level.id === effortLevels.defaultEffort)?.label ?? effortLevels.defaultEffort;
			  })();
			  return (0, import_react.createElement)(
			    "span",
			    { ref: rootRef, className: "ce-root" },
			    [
			      (0, import_react.createElement)(
			        import_dsh_client_ui_primitives.Tooltip,
			        {
			          key: "tip",
			          label: t("a11y.trigger", { percent: reading }),
			          side: "top",
			          delayMs: 200,
			          disabled: open
			        },
			        (0, import_react.createElement)(
			          "button",
			          {
			            type: "button",
			            className: "ce-trigger",
			            "aria-label": t("a11y.trigger", { percent: reading }),
			            "aria-haspopup": "dialog",
			            "aria-expanded": open,
			            onClick: () => setOpen(!open)
			          },
			          [
			            hasContext ? (0, import_react.createElement)(
			              "svg",
			              {
			                key: "ring",
			                viewBox: "0 0 14 14",
			                width: "14",
			                height: "14",
			                "aria-hidden": true
			              },
			              [
			                (0, import_react.createElement)("circle", {
			                  key: "track",
			                  className: "ce-track",
			                  cx: "7",
			                  cy: "7",
			                  r: RADIUS
			                }),
			                (0, import_react.createElement)("circle", {
			                  key: "fill",
			                  className: "ce-fill",
			                  cx: "7",
			                  cy: "7",
			                  r: RADIUS,
			                  strokeDasharray: `${CIRCUMFERENCE * percent / 100} ${CIRCUMFERENCE}`,
			                  transform: "rotate(-90 7 7)"
			                })
			              ]
			            ) : null,
			            (0, import_react.createElement)(
			              "span",
			              { key: "reading", className: "ce-reading" },
			              hasContext ? `${t("label.context")} ~${formatTokens(context.usedTokens, t)} / ${formatTokens(context.contextWindow, t)}` : t("label.context")
			            ),
			            (0, import_react.createElement)("span", { key: "effort", className: "ce-effortLabel" }, effortLabel),
			            (0, import_react.createElement)(
			              "svg",
			              {
			                key: "chev",
			                className: "ce-chevron",
			                viewBox: "0 0 12 12",
			                width: "12",
			                height: "12",
			                "aria-hidden": true
			              },
			              (0, import_react.createElement)("path", {
			                d: "M2.5 4.5 6 8l3.5-3.5",
			                fill: "none",
			                stroke: "currentColor",
			                strokeWidth: "1.4",
			                strokeLinecap: "round",
			                strokeLinejoin: "round"
			              })
			            )
			          ]
			        )
			      ),
			      open && canEdit ? (0, import_react_dom.createPortal)(
			        (0, import_react.createElement)(
			          "div",
			          {
			            ref: panelRef,
			            className: "ce-panel",
			            style: position ?? { visibility: "hidden", left: 0, top: 0 },
			            role: "dialog",
			            "aria-label": t("a11y.dialog")
			          },
			          [
			            // 头部：百分比 + 已完成 / 上限
			            (0, import_react.createElement)("div", { key: "head", className: "ce-panelHead" }, [
			              (0, import_react.createElement)(
			                "span",
			                { key: "before", className: "ce-headline" },
			                headBefore
			              ),
			              (0, import_react.createElement)("span", { key: "percent", className: "ce-percent" }, reading),
			              (0, import_react.createElement)(
			                "span",
			                { key: "after", className: "ce-headline" },
			                headAfter
			              ),
			              (0, import_react.createElement)(
			                "span",
			                { key: "figures", className: "ce-figures" },
			                hasContext ? `~${formatTokens(context.usedTokens, t)} / ${formatTokens(context.contextWindow, t)}` : "—"
			              )
			            ]),
			            // 占用条
			            (0, import_react.createElement)(
			              "div",
			              { key: "bar", className: "ce-bar" },
			              visibleSegments.map(
			                (segment) => (0, import_react.createElement)("div", {
			                  key: segment.key,
			                  className: segment.cls === void 0 ? "ce-segment" : `ce-segment ${segment.cls}`,
			                  style: { width: `${segment.width}%` }
			                })
			              )
			            ),
			            // 数值行
			            (0, import_react.createElement)("dl", { key: "num", className: "ce-rows" }, [
			              hasContext ? row("ce-used", t("label.used"), `~${formatTokens(context.usedTokens, t)}`) : null,
			              hasContext ? row("ce-limit", t("label.limit"), formatTokens(context.contextWindow, t)) : null,
			              hasContext ? row(
			                "ce-left",
			                t("label.remaining"),
			                `~${formatTokens(Math.max(0, context.contextWindow - context.usedTokens), t)}`
			              ) : null,
			              !hasContext ? (0, import_react.createElement)(
			                "div",
			                { key: "nop", className: "ce-empty" },
			                t("panel.noPressure")
			              ) : null
			            ]),
			            // 上下文长度（contextWindow）—— 可直接编辑并保存到模型配置
			            (0, import_react.createElement)("div", { key: "capacity", className: "ce-block" }, [
			              (0, import_react.createElement)(
			                "div",
			                { className: "ce-sectionTitle" },
			                t("label.contextLimit")
			              ),
			              // 生效值（host 解析后的）vs 声明值（配置里写的）
			              (0, import_react.createElement)("dl", { className: "ce-rows" }, [
			                (0, import_react.createElement)("div", { key: "eff", className: "ce-row" }, [
			                  (0, import_react.createElement)("dt", null, t("capacity.effective")),
			                  (0, import_react.createElement)(
			                    "dd",
			                    null,
			                    hasContext ? formatTokens(context.contextWindow, t) : "—"
			                  )
			                ]),
			                (0, import_react.createElement)("div", { key: "dec", className: "ce-row" }, [
			                  (0, import_react.createElement)("dt", null, t("capacity.declared")),
			                  (0, import_react.createElement)(
			                    "dd",
			                    null,
			                    declaredCapacity === void 0 ? t("capacity.inherited") : `${formatTokens(declaredCapacity, t)} (${formatCapacity(declaredCapacity)})`
			                  )
			                ])
			              ]),
			              (0, import_react.createElement)("div", { className: "ce-capacityRow" }, [
			                (0, import_react.createElement)("input", {
			                  key: "in",
			                  className: "ce-capacityInput",
			                  type: "text",
			                  inputMode: "numeric",
			                  placeholder: t("capacity.placeholder"),
			                  value: capacityDraft,
			                  disabled: capacityBusy,
			                  onChange: (e) => {
			                    setCapacityDraft(e.target.value);
			                    setCapacitySaved(false);
			                    setCapacityError(null);
			                  },
			                  onKeyDown: (e) => {
			                    if (e.key === "Enter") onSaveCapacity();
			                  }
			                }),
			                (0, import_react.createElement)(
			                  "button",
			                  {
			                    key: "save",
			                    type: "button",
			                    className: "ce-capacitySave",
			                    disabled: capacityBusy,
			                    onClick: onSaveCapacity
			                  },
			                  capacityBusy ? t("capacity.saving") : t("capacity.save")
			                )
			              ]),
			              // 常用值快捷填入
			              (0, import_react.createElement)(
			                "div",
			                { className: "ce-chips ce-chips--presets" },
			                CAPACITY_PRESETS.map(
			                  (preset) => (0, import_react.createElement)(
			                    "button",
			                    {
			                      key: preset,
			                      type: "button",
			                      className: declaredCapacity === preset ? "ce-chip ce-chip--preset ce-chipActive" : "ce-chip ce-chip--preset",
			                      disabled: capacityBusy,
			                      onClick: () => {
			                        setCapacityDraft(formatCapacity(preset));
			                        setCapacitySaved(false);
			                        setCapacityError(null);
			                      }
			                    },
			                    formatCapacity(preset)
			                  )
			                )
			              ),
			              (0, import_react.createElement)("div", { className: "ce-hint" }, t("capacity.hint")),
			              capacityError !== null ? (0, import_react.createElement)("div", { className: "ce-status ce-status--error" }, capacityError) : null,
			              capacitySaved ? (0, import_react.createElement)("div", { className: "ce-status" }, t("capacity.saved")) : null
			            ]),
			            // 构成（启发式）
			            breakdown !== void 0 ? (0, import_react.createElement)("div", { key: "bd" }, [
			              (0, import_react.createElement)(
			                "div",
			                { className: "ce-sectionTitle" },
			                t("panel.breakdown")
			              ),
			              (0, import_react.createElement)(
			                "dl",
			                { className: "ce-rows" },
			                BREAKDOWN_ROWS.map(
			                  (r) => (0, import_react.createElement)("div", { key: r.key, className: "ce-row" }, [
			                    (0, import_react.createElement)("dt", null, [
			                      (0, import_react.createElement)("span", {
			                        className: `ce-swatch ${r.cls}`,
			                        "aria-hidden": true
			                      }),
			                      t(r.label)
			                    ]),
			                    (0, import_react.createElement)(
			                      "dd",
			                      null,
			                      `~${formatTokens(breakdown[r.key], t)}`
			                    )
			                  ])
			                )
			              )
			            ]) : null,
			            // 思考等级（模型自带元数据 → 用它；否则用全局兜底集）
			            (0, import_react.createElement)("div", { key: "effort", className: "ce-block" }, [
			              (0, import_react.createElement)("div", { className: "ce-sectionTitle" }, t("label.effort")),
			              effortLevels.synthetic ? (0, import_react.createElement)("div", { className: "ce-hint" }, t("panel.globalLevelsHint")) : null,
			              (0, import_react.createElement)(
			                "div",
			                { className: "ce-chips" },
			                [
			                  // 只在模型自带默认等级时提供"跟随模型默认"这一项；
			                  // 全局兜底集本身就是显式等级，不需要这一项。
			                  ...!effortLevels.synthetic && effortLevels.defaultEffort === void 0 ? [
			                    {
			                      key: "provider-default",
			                      effort: void 0,
			                      label: t("label.providerDefault")
			                    }
			                  ] : [],
			                  ...effortLevels.levels.map((level) => ({
			                    key: `effort:${level.id}`,
			                    effort: level.id,
			                    label: level.label
			                  }))
			                ].map(
			                  (choice) => (0, import_react.createElement)(
			                    "button",
			                    {
			                      key: choice.key,
			                      type: "button",
			                      // 等级与模型用不同的类名，避免"当前项"高亮被混淆。
			                      className: choice.effort === currentEffort ? "ce-chip ce-chip--effort ce-chipActive" : "ce-chip ce-chip--effort",
			                      disabled: busy,
			                      onClick: () => onPickEffort(choice.effort)
			                    },
			                    choice.label
			                  )
			                )
			              )
			            ]),
			            // 模型：按需展开（默认折叠，避免面板被 40+ 个模型撑爆）。
			            state.groups.length > 0 ? (0, import_react.createElement)("div", { key: "model", className: "ce-block" }, [
			              (0, import_react.createElement)(
			                "button",
			                {
			                  className: "ce-disclosure",
			                  type: "button",
			                  "aria-expanded": modelOpen,
			                  onClick: () => setModelOpen(!modelOpen)
			                },
			                [
			                  (0, import_react.createElement)("span", { key: "l" }, t("label.model")),
			                  (0, import_react.createElement)(
			                    "span",
			                    { key: "v", className: "ce-disclosureValue" },
			                    current?.model ?? "—"
			                  ),
			                  (0, import_react.createElement)(
			                    "svg",
			                    {
			                      key: "c",
			                      className: modelOpen ? "ce-chevron ce-chevron--open" : "ce-chevron",
			                      viewBox: "0 0 12 12",
			                      width: "12",
			                      height: "12",
			                      "aria-hidden": true
			                    },
			                    (0, import_react.createElement)("path", {
			                      d: "M2.5 4.5 6 8l3.5-3.5",
			                      fill: "none",
			                      stroke: "currentColor",
			                      strokeWidth: "1.4",
			                      strokeLinecap: "round",
			                      strokeLinejoin: "round"
			                    })
			                  )
			                ]
			              ),
			              modelOpen ? (0, import_react.createElement)(
			                "div",
			                { className: "ce-chips" },
			                state.groups.flatMap(
			                  (group) => group.models.map((model) => ({
			                    group,
			                    model
			                  }))
			                ).map(
			                  ({ group, model }) => (0, import_react.createElement)(
			                    "button",
			                    {
			                      key: `${group.id}/${model.id}`,
			                      type: "button",
			                      className: current?.provider === group.id && current?.model === model.id ? "ce-chip ce-chip--model ce-chipActive" : "ce-chip ce-chip--model",
			                      disabled: busy,
			                      onClick: () => onPickModel(
			                        group.id,
			                        model.id,
			                        model.reasoning?.defaultEffort
			                      )
			                    },
			                    model.name ?? model.id
			                  )
			                )
			              ) : null
			            ]) : null,
			            // 状态行
			            busy || state.error !== null || enablingError !== null ? (0, import_react.createElement)(
			              "div",
			              {
			                key: "status",
			                className: state.error !== null || enablingError !== null ? "ce-status ce-status--error" : "ce-status"
			              },
			              enablingError !== null ? t("panel.enableFailed", { reason: enablingError }) : enabling !== null ? t("panel.enabling", { level: enabling.effort }) : state.error !== null ? t("panel.failed", { reason: state.error }) : t("panel.switching")
			            ) : null
			          ]
			        ),
			        document.body
			      ) : null
			    ]
			  );
			}
			function row(key, label, value) {
			  return (0, import_react.createElement)("div", { key, className: "ce-row" }, [
			    (0, import_react.createElement)("dt", null, label),
			    (0, import_react.createElement)("dd", null, value)
			  ]);
			}
			var EMPTY_DIRECTORY_STATE = {
			  status: "idle",
			  current: null,
			  groups: [],
			  retainedEffort: void 0,
			  pending: null,
			  error: null
			};
			function useDirectoryState(directory, useSession) {
			  const stable = directory ?? null;
			  const cacheRef = (0, import_react2.useRef)({ source: void 0, projected: EMPTY_DIRECTORY_STATE });
			  const subscribe = (0, import_react2.useCallback)(
			    (onChange) => {
			      if (stable === null || typeof stable.subscribe !== "function") return () => {
			      };
			      return stable.subscribe(onChange);
			    },
			    [stable]
			  );
			  const getSnapshot = (0, import_react2.useCallback)(() => {
			    if (stable === null || typeof stable.getSnapshot !== "function") {
			      return EMPTY_DIRECTORY_STATE;
			    }
			    let raw;
			    try {
			      raw = stable.getSnapshot();
			    } catch {
			      return EMPTY_DIRECTORY_STATE;
			    }
			    if (raw === null || typeof raw !== "object") return EMPTY_DIRECTORY_STATE;
			    const cache = cacheRef.current;
			    if (cache.source === raw) return cache.projected;
			    const next = {
			      status: raw.status ?? "idle",
			      current: raw.current ?? null,
			      groups: Array.isArray(raw.groups) ? raw.groups : [],
			      retainedEffort: raw.retainedEffort,
			      pending: raw.pending ?? null,
			      error: raw.error ?? null
			    };
			    const prev = cache.projected;
			    const same = prev.status === next.status && prev.current === next.current && prev.groups === next.groups && prev.retainedEffort === next.retainedEffort && prev.pending === next.pending && prev.error === next.error;
			    if (same) {
			      cacheRef.current = { source: raw, projected: prev };
			      return prev;
			    }
			    cacheRef.current = { source: raw, projected: next };
			    return next;
			  }, [stable]);
			  if (typeof import_react2.useSyncExternalStore === "function") {
			    return (0, import_react2.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			  }
			  return EMPTY_DIRECTORY_STATE;
			}
			function resolveReasoning(state, current) {
			  if (state === null || current === null || current === void 0) return void 0;
			  for (const group of state.groups) {
			    if (group.id !== current.provider) continue;
			    for (const model of group.models) {
			      if (model.id !== current.model) continue;
			      if (model.reasoning === void 0 || model.reasoning === null) return void 0;
			      const efforts = Array.isArray(model.reasoning.efforts) ? model.reasoning.efforts : [];
			      return { defaultEffort: model.reasoning.defaultEffort, efforts };
			    }
			  }
			  return void 0;
			}
			var CSS = `
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
			`;
			var CSS_TAG_ID = "dsh-context-effort/ContextEffort.css";
			function installCss() {
			  if (typeof document === "undefined") return;
			  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_TAG_ID)}]`) !== null) return;
			  const tag = document.createElement("style");
			  tag.dataset.plugin = "dsh-context-effort";
			  tag.dataset.pluginCss = CSS_TAG_ID;
			  tag.textContent = CSS;
			  document.head.appendChild(tag);
			}
			var name = "dsh-context-effort";
			var inject = [
			  "slots",
			  "locale",
			  "modelDirectories",
			  "sessions",
			  "remote",
			  "remote.session",
			  // 写模型配置要枚举可配置 provider（拿 settingsNs）。必须显式列出：
			  // cordis 的上下文 Proxy 对**未声明的子命名空间属性访问**直接抛
			  // `cannot get property "remote.llm" without inject`——只靠 ctx.get() 兜底
			  // 会在拿不到服务名时整条写路径失效（2026-10-16 实测就是这个问题）。
			  "remote.llm"
			];
			function apply(ctx) {
			  installCss();
			  const dicts = {
			    zh: {
			      "number.thousand": "{value}K",
			      "number.million": "{value}M",
			      "label.context": "上下文",
			      "label.contextLimit": "上下文长度",
			      "capacity.effective": "生效值",
			      "capacity.declared": "配置声明",
			      "capacity.inherited": "未设置（继承默认）",
			      "capacity.placeholder": "如 512K / 1M；留空即继承",
			      "capacity.save": "保存",
			      "capacity.saving": "保存中…",
			      "capacity.saved": "已保存，下一条请求生效",
			      "capacity.invalid": "格式无法识别，请用 256K / 512K / 1M 这类写法",
			      "capacity.failed": "保存失败：{reason}",
			      "capacity.unavailable": "当前环境不支持写入模型配置",
			      "capacity.hint": "K=1000、M=1000000（十进制）。模型未声明时会落回适配器默认 256K，这里填的值会写入该模型配置。",
			      "label.used": "已用",
			      "label.limit": "上限",
			      "label.remaining": "剩余",
			      "label.percent": "占用",
			      "label.effort": "思考等级",
			      "label.model": "模型",
			      "label.providerDefault": "跟随模型默认",
			      "panel.title": "上下文与思考等级",
			      "panel.noEfforts": "当前模型未提供推理等级。",
			      "panel.globalLevelsHint": "该模型未声明推理等级，已使用全局等级集；首次切换会写入模型配置。",
			      "panel.noPressure": "等待模型上报上下文用量…",
			      "panel.switching": "切换中…",
			      "panel.enabling": "Enabling reasoning levels…",
			      "panel.enableFailed": "Failed to write model config: {reason}",
			      "panel.failed": "切换失败：{reason}",
			      "panel.breakdown": "构成（启发式估算）",
			      "breakdown.system": "系统提示",
			      "breakdown.tools": "工具",
			      "breakdown.messages": "对话消息",
			      "a11y.trigger": "上下文占用 {percent}，点击调整思考等级",
			      "a11y.dialog": "上下文与思考等级"
			    },
			    en: {
			      "number.thousand": "{value}K",
			      "number.million": "{value}M",
			      "label.context": "Context",
			      "label.contextLimit": "Context length",
			      "capacity.effective": "Effective",
			      "capacity.declared": "Declared",
			      "capacity.inherited": "Unset (inherits default)",
			      "capacity.placeholder": "e.g. 512K / 1M; blank inherits",
			      "capacity.save": "Save",
			      "capacity.saving": "Saving…",
			      "capacity.saved": "Saved; applies to the next request",
			      "capacity.invalid": "Unrecognized format — use 256K / 512K / 1M",
			      "capacity.failed": "Save failed: {reason}",
			      "capacity.unavailable": "Writing model config is unavailable here",
			      "capacity.hint": "K=1000, M=1000000 (decimal). Undeclared models fall back to the adapter default 256K; a value here is written into that model config.",
			      "label.used": "Used",
			      "label.limit": "Limit",
			      "label.remaining": "Left",
			      "label.percent": "Usage",
			      "label.effort": "Effort",
			      "label.model": "Model",
			      "label.providerDefault": "Provider default",
			      "panel.title": "Context and reasoning effort",
			      "panel.noEfforts": "This model provides no reasoning effort levels.",
			      "panel.globalLevelsHint": "This model declares no reasoning levels; the global set is shown. The first switch writes it into the model config.",
			      "panel.noPressure": "Waiting for the model to report context usage…",
			      "panel.switching": "Switching…",
			      "panel.enabling": "Enabling reasoning levels…",
			      "panel.enableFailed": "Failed to write model config: {reason}",
			      "panel.failed": "Switch failed: {reason}",
			      "panel.breakdown": "Composition (heuristic)",
			      "breakdown.system": "System",
			      "breakdown.tools": "Tools",
			      "breakdown.messages": "Messages",
			      "a11y.trigger": "{percent} of context used — click to change reasoning effort",
			      "a11y.dialog": "Context and reasoning effort"
			    }
			  };
			  ctx.effect(() => ctx.locale.register(NS, dicts), "dsh-context-effort: dictionaries");
			  ctx.inject(["slots", "modelDirectories", "sessions", "remote", "configForms"], (scope) => {
			    const models = scope.modelDirectories;
			    const sessions = scope.sessions;
			    const remote = scope.remote;
			    const optional = (name2) => {
			      try {
			        const viaGet = typeof scope.get === "function" ? scope.get(name2) : void 0;
			        if (viaGet !== void 0) return viaGet;
			      } catch {
			      }
			      try {
			        return scope[name2];
			      } catch {
			        return void 0;
			      }
			    };
			    const configForms = optional("configForms");
			    scope.slots.inject(
			      "conversation.input.right",
			      () => scope.slots.register(
			        {
			          name: "conversation.input.right",
			          id: "context-effort",
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
			                const directory = models.directoryFor(sessionId);
			                if (directory === void 0) {
			                  return { directory: void 0, reason: "no-directory" };
			                }
			                const addressed = typeof sessions?.subagentAddress === "function" && sessions.subagentAddress(sessionId) !== void 0;
			                if (addressed) return { directory, reason: "addressed" };
			                return { directory, reason: void 0 };
			              } catch (error) {
			                return {
			                  directory: void 0,
			                  reason: String(error?.message ?? error)
			                };
			              }
			            };
			            const locateModel = (provider, model, settingsNs) => {
			              const forms = configForms;
			              if (forms === void 0 || typeof forms.get !== "function") {
			                return { ok: false, error: "configForms 服务不可用" };
			              }
			              const form = forms.get(settingsNs);
			              if (form === void 0) {
			                return { ok: false, error: `拿不到 ${settingsNs} 的配置表单` };
			              }
			              const snapshot = form.getSnapshot();
			              if (snapshot?.status !== "ready") {
			                return {
			                  ok: false,
			                  error: `设置镜像未就绪（status=${String(snapshot?.status)}）`
			                };
			              }
			              const doc = snapshot.value;
			              if (doc === void 0 || doc === null) {
			                return { ok: false, error: `${settingsNs} 没有配置内容` };
			              }
			              const profile = settingsNs === "llm-pi-ai" ? doc.providers?.[provider] : doc;
			              if (typeof profile !== "object" || profile === null) {
			                return { ok: false, error: `配置里找不到 provider ${provider}` };
			              }
			              const models2 = Array.isArray(profile.models) ? profile.models : [];
			              const index = models2.findIndex((item) => item && item.id === model);
			              if (index < 0) {
			                return { ok: false, error: `配置里找不到模型 ${model}` };
			              }
			              return { ok: true, form, doc, profile, entry: models2[index], index, models: models2 };
			            };
			            const updateModelConfig = async (provider, model, settingsNs, patch) => {
			              try {
			                const located = locateModel(provider, model, settingsNs);
			                if (located.ok !== true) return located;
			                const { form, index } = located;
			                const base = settingsNs === "llm-pi-ai" ? ["providers", provider, "models", String(index)] : ["models", String(index)];
			                const ops = modelPatchOps(base, patch);
			                if (ops.length === 0) return { ok: true };
			                const accepted = await form.mutate(ops);
			                if (accepted === false) {
			                  return { ok: false, error: `${settingsNs} 拒绝了写入` };
			                }
			                return { ok: true };
			              } catch (error) {
			                return { ok: false, error: String(error?.message ?? error) };
			              }
			            };
			            const first = resolve();
			            return {
			              available: first.directory !== void 0 && first.reason === void 0,
			              unavailableReason: first.reason,
			              sessionId,
			              directory: first.directory?.store,
			              load: () => {
			                try {
			                  const now = resolve();
			                  if (now.directory !== void 0) now.directory.load().catch(() => {
			                  });
			                } catch {
			                }
			              },
			              select: (selection) => {
			                const now = resolve();
			                if (now.directory === void 0) return Promise.resolve(void 0);
			                return now.directory.select(selection);
			              },
			              /**
			               * 解析 provider → 设置命名空间。
			               * @param provider - provider id。
			               * @returns `{ ok: true, settingsNs }` 或 `{ ok: false, error }`。
			               */
			              resolveSettingsNs: async (provider) => {
			                let llm = optional("remote.llm");
			                if (llm === void 0) {
			                  try {
			                    llm = remote?.llm;
			                  } catch {
			                    llm = void 0;
			                  }
			                }
			                if (llm === void 0 || typeof llm.listConfigurableProviders !== "function") {
			                  return {
			                    ok: false,
			                    error: "remote.llm 不可用，无法写入模型配置（当前宿主没有提供该服务）"
			                  };
			                }
			                try {
			                  const response = await llm.listConfigurableProviders();
			                  if (!response.ok) return { ok: false, error: response.error.message };
			                  const entry = response.value.find((item) => item.provider === provider);
			                  if (entry === void 0) {
			                    return { ok: false, error: `provider ${provider} 没有可写配置` };
			                  }
			                  return { ok: true, settingsNs: entry.settingsNs };
			                } catch (error) {
			                  return { ok: false, error: String(error?.message ?? error) };
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
			                const efforts = {};
			                for (const level of levels) efforts[level] = level === "off" ? null : level;
			                return updateModelConfig(provider, model, settingsNs, {
			                  reasoningEfforts: efforts
			                });
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
			                const located = locateModel(provider, model, settingsNs);
			                if (located.ok !== true) return located;
			                const { entry } = located;
			                return {
			                  ok: true,
			                  declared: {
			                    contextWindow: typeof entry.contextWindow === "number" ? entry.contextWindow : void 0,
			                    maxTokens: typeof entry.maxTokens === "number" ? entry.maxTokens : void 0
			                  }
			                };
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
			              saveModelCapacity: async (provider, model, settingsNs, capacity) => updateModelConfig(provider, model, settingsNs, capacity)
			            };
			          }
			        },
			        ContextEffort
			      )
			    );
			  });
			}

		})(module, exports, require);
		return module.exports;
	}
});
