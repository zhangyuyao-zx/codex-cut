import { z } from "zod";

/**
 * Full-catalog Component Lab closure.
 *
 * This module does not promote anything into the Product Registry. It closes
 * the research inventory by separating reusable single mechanisms from full
 * scenes, layouts, style systems, aggregate packages, and non-visual tooling.
 */

export const smartPackagingCatalogCompletionCoreIdValues = [
  "border-light-trace",
  "chat-thread",
  "code-block",
  "code-diff",
  "code-focus",
  "icon-cloud",
  "map-data",
  "media-pan-zoom",
  "media-treatment",
  "metric-card",
  "perspective-grid",
  "step-progress",
  "stroke-trace",
] as const;

export type SmartPackagingCatalogCompletionCoreId =
  (typeof smartPackagingCatalogCompletionCoreIdValues)[number];

export const smartPackagingCatalogCompletionTargetValues = [
  "LOCAL_ANNOTATION",
  "MEDIA_EVIDENCE",
  "QUANT_DATA",
  "RELATION_STRUCTURE",
  "SCENE_SURFACE",
  "SCREEN_UI",
] as const;

export type SmartPackagingCatalogCompletionTarget =
  (typeof smartPackagingCatalogCompletionTargetValues)[number];

export const smartPackagingCatalogCompletionRenderFamilyValues = [
  "ANNOTATION",
  "CODE_UI",
  "DATA",
  "MEDIA",
  "RELATION",
  "SCENE",
] as const;

export type SmartPackagingCatalogCompletionRenderFamily =
  (typeof smartPackagingCatalogCompletionRenderFamilyValues)[number];

export interface SmartPackagingCatalogCompletionContractV1 {
  label: string;
  target: SmartPackagingCatalogCompletionTarget;
  renderFamily: SmartPackagingCatalogCompletionRenderFamily;
  roleConstraint: "MAIN_OR_SUPPORT" | "SUPPORT_ONLY" | "NOT_VISUAL_ROLE";
  requiredEvidence: string[];
  requiredProps: string[];
  optionalProps: string[];
  capacity: {
    minimumItems: number | null;
    maximumItems: number | null;
    maximumTextCharacters: number | null;
  };
  staticFallback: string;
  rationale: string;
}

const contract = (
  value: SmartPackagingCatalogCompletionContractV1,
): SmartPackagingCatalogCompletionContractV1 => ({
  ...value,
  optionalProps: [...value.optionalProps, "intensity", "reducedMotion"],
});

export const SMART_PACKAGING_CATALOG_COMPLETION_CONTRACTS_V1 = Object.freeze({
  "border-light-trace": contract({
    label: "边框流光描边",
    target: "LOCAL_ANNOTATION",
    renderFamily: "ANNOTATION",
    roleConstraint: "SUPPORT_ONLY",
    requiredEvidence: ["BOUND_TARGET_RECT", "MOTION_REASON"],
    requiredProps: ["content", "targetRect"],
    optionalProps: ["label", "accentColor", "cornerRadius", "direction"],
    capacity: { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 40 },
    staticFallback: "保留目标框和一条稳定的高亮边，不持续绕行。",
    rationale: "补齐沿已绑定对象边缘运行的光带机制；它不是场景氛围，也不能自行选择目标。",
  }),
  "chat-thread": contract({
    label: "对话线程",
    target: "SCREEN_UI",
    renderFamily: "CODE_UI",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["APPROVED_MESSAGE_SEQUENCE"],
    requiredProps: ["messages"],
    optionalProps: ["activeMessageId", "title", "accentColor"],
    capacity: { minimumItems: 2, maximumItems: 12, maximumTextCharacters: 720 },
    staticFallback: "显示全部已批准消息、角色与顺序，不模拟继续生成。",
    rationale: "对话气泡的角色、顺序和逐条揭示具有独立输入合同，不能由普通文字卡等价替代。",
  }),
  "code-block": contract({
    label: "代码面板",
    target: "SCREEN_UI",
    renderFamily: "CODE_UI",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["APPROVED_CODE_TEXT"],
    requiredProps: ["lines"],
    optionalProps: ["language", "title", "lineNumbers", "accentColor", "depth"],
    capacity: { minimumItems: 1, maximumItems: 28, maximumTextCharacters: 1800 },
    staticFallback: "完整显示经过批准的代码行并保持行号、缩进和语言标签。",
    rationale: "代码是独立的信息对象；主题和三维外观只是受控 preset，不能替代代码内容合同。",
  }),
  "code-diff": contract({
    label: "代码差异",
    target: "SCREEN_UI",
    renderFamily: "CODE_UI",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["APPROVED_CODE_DIFF"],
    requiredProps: ["lines"],
    optionalProps: ["title", "activeLineIndex", "accentColor"],
    capacity: { minimumItems: 2, maximumItems: 32, maximumTextCharacters: 2200 },
    staticFallback: "并列保留新增、删除和上下文行，不生成不存在的代码变更。",
    rationale: "新增、删除和上下文语义需要专用输入合同，不能降格为单纯代码高亮。",
  }),
  "code-focus": contract({
    label: "代码聚焦与滚动",
    target: "SCREEN_UI",
    renderFamily: "CODE_UI",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["APPROVED_CODE_TEXT", "BOUND_CODE_RANGE"],
    requiredProps: ["lines", "activeLineIndex"],
    optionalProps: ["title", "mode", "accentColor"],
    capacity: { minimumItems: 2, maximumItems: 48, maximumTextCharacters: 3200 },
    staticFallback: "显示完整代码并稳定突出已绑定行，不自动滚动。",
    rationale: "代码滚动和行级聚焦共享同一范围绑定与可读性合同，作为一个 Core 的两个受控 preset。",
  }),
  "icon-cloud": contract({
    label: "图标关系云",
    target: "RELATION_STRUCTURE",
    renderFamily: "RELATION",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["APPROVED_ENTITY_SET"],
    requiredProps: ["items"],
    optionalProps: ["activeId", "seed", "accentColor"],
    capacity: { minimumItems: 4, maximumItems: 32, maximumTextCharacters: 320 },
    staticFallback: "以可辨识的固定关系云显示全部实体和当前重点。",
    rationale: "多实体围绕中心或球面分布是独立关系表达，不等同于二维列表或普通媒体轮播。",
  }),
  "map-data": contract({
    label: "地图数据标注",
    target: "QUANT_DATA",
    renderFamily: "DATA",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["BOUND_MAP_GEOMETRY", "NUMBER_OR_LOCATION_DATA"],
    requiredProps: ["regions", "title"],
    optionalProps: ["unit", "activeRegionId", "accentColor"],
    capacity: { minimumItems: 1, maximumItems: 24, maximumTextCharacters: 480 },
    staticFallback: "显示完整地图轮廓、真实位置和数据标签。",
    rationale: "地理位置和区域值需要地图几何绑定，不能由普通关系图或散点图替代。",
  }),
  "media-pan-zoom": contract({
    label: "媒体平移推拉",
    target: "MEDIA_EVIDENCE",
    renderFamily: "MEDIA",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["BOUND_MEDIA", "BOUND_FOCUS_REGION"],
    requiredProps: ["content", "start", "end"],
    optionalProps: ["accentColor"],
    capacity: { minimumItems: 1, maximumItems: 1, maximumTextCharacters: null },
    staticFallback: "显示完整媒体并以终点焦区为轻微稳定构图。",
    rationale: "Ken Burns、平移和轻推近共享一条受源边界约束的媒体相机轨迹合同。",
  }),
  "media-treatment": contract({
    label: "媒体后期处理",
    target: "MEDIA_EVIDENCE",
    renderFamily: "MEDIA",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["BOUND_MEDIA", "TREATMENT_REASON"],
    requiredProps: ["content", "mode"],
    optionalProps: ["accentColor", "amount"],
    capacity: { minimumItems: 1, maximumItems: 1, maximumTextCharacters: null },
    staticFallback: "保留原媒体，仅应用稳定且可逆的轻量纹理或边缘处理。",
    rationale: "颗粒、扫描线、半调、暗角和受控模糊是媒体处理 preset，不应被误算成五个内容组件。",
  }),
  "metric-card": contract({
    label: "指标卡",
    target: "QUANT_DATA",
    renderFamily: "DATA",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["NUMBER_DATA", "METRIC_LABEL"],
    requiredProps: ["label", "value"],
    optionalProps: ["unit", "delta", "trend", "accentColor"],
    capacity: { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 80 },
    staticFallback: "显示真实数值、单位、指标名和可选变化方向。",
    rationale: "单指标卡的数值、单位与趋势语义不同于纯计数动画，需独立容量和证据合同。",
  }),
  "perspective-grid": contract({
    label: "透视网格场景",
    target: "SCENE_SURFACE",
    renderFamily: "SCENE",
    roleConstraint: "NOT_VISUAL_ROLE",
    requiredEvidence: ["BOUND_CONTENT", "MOTION_REASON"],
    requiredProps: ["content"],
    optionalProps: ["horizon", "density", "accentColor"],
    capacity: { minimumItems: 1, maximumItems: 1, maximumTextCharacters: null },
    staticFallback: "保留内容并显示固定、低对比度透视网格。",
    rationale: "透视网格具有独立空间和运动参数，但永远只是已绑定内容的场景表面。",
  }),
  "step-progress": contract({
    label: "步骤进度",
    target: "RELATION_STRUCTURE",
    renderFamily: "RELATION",
    roleConstraint: "MAIN_OR_SUPPORT",
    requiredEvidence: ["APPROVED_STEP_SEQUENCE"],
    requiredProps: ["steps", "activeStepId"],
    optionalProps: ["orientation", "accentColor"],
    capacity: { minimumItems: 2, maximumItems: 8, maximumTextCharacters: 320 },
    staticFallback: "显示全部步骤、固定顺序和当前状态。",
    rationale: "步骤状态需要 completed/current/pending 合同，不等同于单一百分比进度条。",
  }),
  "stroke-trace": contract({
    label: "路径描绘",
    target: "LOCAL_ANNOTATION",
    renderFamily: "ANNOTATION",
    roleConstraint: "SUPPORT_ONLY",
    requiredEvidence: ["BOUND_VECTOR_PATH", "BOUND_TARGET"],
    requiredProps: ["path", "viewBox"],
    optionalProps: ["label", "strokeWidth", "accentColor"],
    capacity: { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 40 },
    staticFallback: "显示完整矢量路径和目标标签。",
    rationale: "任意 SVG/白板路径的逐段描绘需要路径长度合同，不能限定为箭头、圆或下划线。",
  }),
} satisfies Record<
  SmartPackagingCatalogCompletionCoreId,
  SmartPackagingCatalogCompletionContractV1
>);

export const SMART_PACKAGING_BASE_COMPONENT_IDS_V1 = [
  "component:v1:stage-person-full",
  "component:v1:stage-screen-main",
  "component:v1:stage-evidence-main",
  "component:v1:stage-detail-inset",
  "component:v1:stage-person-pip-circle",
  "component:v1:text-clean-card",
  "component:v1:text-marker-underline",
  "component:v1:text-context-label",
  "component:v1:text-mini-explanation",
  "component:v1:screen-smart-zoom-restore",
  "component:v1:screen-spotlight-dim",
  "component:v1:annotation-arrow",
  "component:v1:annotation-circle",
  "component:v1:annotation-callout",
  "component:v1:annotation-cursor",
  "component:v1:annotation-click-ripple",
  "component:v1:evidence-clean-card",
  "component:v1:evidence-source-label",
  "component:v1:evidence-device-frame",
] as const;

const base = (id: string): string => `component:v1:${id}`;
const newCore = (id: string): string => `new-core-lab:v1:${id}`;
const nextCore = (id: string): string => `next-core-lab:v1:${id}`;
const completionCore = (id: SmartPackagingCatalogCompletionCoreId): string =>
  `catalog-completion:v1:${id}`;

/** Every named inventory mechanism has a final implemented destination. */
export const SMART_PACKAGING_MECHANISM_COMPONENT_MAP_V1 = Object.freeze({
  "ai-flow-pipeline": [nextCore("flow-diagram")],
  "ambient-gradient": [newCore("light-overlay")],
  "ambient-particle": [nextCore("ambient-particle")],
  "ambient-texture": [completionCore("media-treatment")],
  "arrow-draw": [base("annotation-arrow")],
  "audio-spectrum": [nextCore("audio-spectrum")],
  "audio-waveform": [nextCore("audio-waveform")],
  "bar-chart": [nextCore("bar-chart")],
  "before-after": [nextCore("before-after")],
  "brand-lockup": [nextCore("brand-lockup")],
  "camera-orbit": [newCore("camera-orbit")],
  "camera-shake": [newCore("camera-shake")],
  "camera-zoom": [nextCore("camera-transform")],
  "canvas-materialize": [nextCore("flow-diagram"), nextCore("ui-materialize")],
  "card-deck": [nextCore("card-deck")],
  "card-flip": [nextCore("card-flip")],
  "card-stack": [nextCore("card-stack")],
  "carousel-cycle": [nextCore("media-carousel")],
  "chat-thread": [completionCore("chat-thread")],
  "click-feedback": [base("annotation-click-ripple")],
  "clone-depth-echo": [nextCore("clone-depth-echo")],
  "code-diff": [completionCore("code-diff")],
  "count-up": [nextCore("numeric-counter")],
  "crash-zoom": [nextCore("camera-transform")],
  "cube-rotate": [nextCore("cube-transition")],
  "cursor-move": [base("annotation-cursor")],
  "data-timeline": [nextCore("time-relation")],
  "depth-camera": [nextCore("depth-camera")],
  "device-frame": [base("evidence-device-frame")],
  "diagram-flow": [nextCore("flow-diagram")],
  "digit-roll": [nextCore("numeric-counter")],
  "editorial-caption": [base("text-clean-card")],
  "fracture-boil": [nextCore("text-fracture")],
  "fragment-assemble-type": [nextCore("text-reveal")],
  "freeze-orbit": [newCore("camera-orbit")],
  "gauge-arc": [nextCore("gauge-arc")],
  "geometric-wipe": [nextCore("geometric-wipe")],
  "gradient-word-sweep": [nextCore("gradient-text")],
  "headline-slam": [nextCore("impact-feedback")],
  "hud-scan-lock": [nextCore("hud-focus")],
  "icon-performance": [nextCore("icon-feedback")],
  "impact-hit": [nextCore("impact-feedback")],
  "integration-map": [nextCore("flow-diagram")],
  "karaoke-word-progress": [nextCore("karaoke-progress")],
  "keyword-highlight": [base("text-marker-underline")],
  "kinetic-caption": [nextCore("kinetic-type")],
  "kinetic-type": [nextCore("kinetic-type")],
  "light-flyline": [nextCore("connection-flyline")],
  "line-chart-draw": [nextCore("line-chart")],
  "list-sequence": [nextCore("list-sequence")],
  "live-chart": [nextCore("stream-line-chart"), nextCore("chart-axis-rescale")],
  "lower-third": [base("text-context-label")],
  "marker-draw": [base("text-marker-underline")],
  "media-grid": [newCore("media-grid")],
  "media-tour": [nextCore("media-tour")],
  "neon-frame-orbit": [completionCore("border-light-trace")],
  "panel-grid-reflow": [nextCore("panel-grid")],
  "paper-craft": [nextCore("text-reveal")],
  "particle-celebration": [nextCore("particle-celebration")],
  "progress-bar": [nextCore("progress-bar")],
  "progress-ring": [nextCore("gauge-arc")],
  "prompt-paste": [nextCore("prompt-paste")],
  "prompt-type-on": [nextCore("typewriter")],
  "prompt-zoom": [nextCore("camera-transform")],
  "quad-split": [nextCore("panel-grid")],
  "radial-light-reveal": [nextCore("spotlight-scan")],
  "response-stream": [nextCore("response-stream")],
  "rhythmic-cut": [nextCore("scene-push")],
  "rise-tilt": [nextCore("camera-transform")],
  "scene-fly": [nextCore("scene-push")],
  "scene-push": [nextCore("scene-push")],
  "scene-wipe": [nextCore("geometric-wipe")],
  "selection-control": [nextCore("selection-control")],
  "shared-morph": [nextCore("shared-morph")],
  "slide-reveal": [nextCore("text-reveal")],
  "smart-zoom": [base("screen-smart-zoom-restore")],
  "smear-trail": [nextCore("smear-trail")],
  "space-camera": [nextCore("space-camera")],
  "speed-ramp-freeze": [nextCore("speed-ramp")],
  "split-flap": [nextCore("split-flap")],
  "spotlight-focus": [base("screen-spotlight-dim")],
  "spotlight-scan": [nextCore("spotlight-scan")],
  "terminal-type": [nextCore("terminal-type")],
  "text-reveal": [nextCore("text-reveal")],
  "texture-dissolve": [nextCore("texture-dissolve")],
  "timeline-travel": [nextCore("time-relation")],
  "trailer-cadence": [nextCore("scene-push")],
  "typewriter": [nextCore("typewriter")],
  "ui-materialize": [nextCore("ui-materialize")],
  "ui-strip-away": [nextCore("ui-materialize")],
  "word-relay": [nextCore("word-relay")],
} satisfies Record<string, string[]>);

export type SmartPackagingFinalDispositionV1 =
  | "COMPONENT_COVERED"
  | "AGGREGATE_COVERED"
  | "COMPOSITE_COVERED"
  | "LAYOUT_REFERENCE_ONLY"
  | "STYLE_REFERENCE_ONLY"
  | "TOOLING_NOT_COMPONENT"
  | "MEDIA_ADAPTER_NOT_COMPONENT";

export interface SmartPackagingManualClosureDecisionV1 {
  disposition: SmartPackagingFinalDispositionV1;
  componentIds: string[];
  rationale: string;
}

const covered = (
  componentIds: string[],
  rationale: string,
): SmartPackagingManualClosureDecisionV1 => ({
  disposition: "COMPONENT_COVERED",
  componentIds,
  rationale,
});
const aggregate = (
  componentIds: string[],
  rationale: string,
): SmartPackagingManualClosureDecisionV1 => ({
  disposition: "AGGREGATE_COVERED",
  componentIds,
  rationale,
});
const composite = (
  componentIds: string[],
  rationale: string,
): SmartPackagingManualClosureDecisionV1 => ({
  disposition: "COMPOSITE_COVERED",
  componentIds,
  rationale,
});
const tooling = (rationale: string): SmartPackagingManualClosureDecisionV1 => ({
  disposition: "TOOLING_NOT_COMPONENT",
  componentIds: [],
  rationale,
});
const mediaAdapter = (
  rationale: string,
): SmartPackagingManualClosureDecisionV1 => ({
  disposition: "MEDIA_ADAPTER_NOT_COMPONENT",
  componentIds: [],
  rationale,
});

/** Explicit closure for records that do not carry a named mechanism. */
export const SMART_PACKAGING_MANUAL_EFFECT_UNIT_DECISIONS_V1 = Object.freeze({
  "candidate:ai-chat-reveal": covered(
    [completionCore("chat-thread")],
    "The candidate is a message-sequence reveal and is covered by the bounded chat-thread Core.",
  ),
  "candidate:code-highlight": covered(
    [completionCore("code-focus")],
    "A bound code range is highlighted by the code-focus Core.",
  ),
  "candidate:code-snippet-apple-terminal-pro": covered(
    [completionCore("code-block"), nextCore("terminal-type")],
    "Terminal chrome is a preset over code-block and terminal-type, not a new mechanism.",
  ),
  "candidate:comic-panel-split": covered(
    [nextCore("panel-grid")],
    "Comic split is a panel-grid preset; the source does not define a separate motion contract.",
  ),
  "candidate:cv-floatingstack": covered(
    [nextCore("card-stack")],
    "Floating cards are a card-stack depth and phase preset.",
  ),
  "candidate:cv-minidashboard": composite(
    [nextCore("screen-frame"), completionCore("chat-thread"), nextCore("response-stream")],
    "The mini dashboard is a composed product scene, while its screen, conversation, and response mechanisms are independently covered.",
  ),
  "candidate:cv-palettes": tooling(
    "Palette derivation functions produce design tokens and have no independently rendered packaging object.",
  ),
  "candidate:cv-sceneglow": covered(
    [completionCore("border-light-trace")],
    "The reusable behavior is a light tracing a bound rounded rectangle.",
  ),
  "candidate:cv-statsgrid": composite(
    [nextCore("panel-grid"), completionCore("metric-card")],
    "A stats grid composes metric cards inside the existing panel-grid layout.",
  ),
  "candidate:data-chart": aggregate(
    [nextCore("bar-chart"), nextCore("line-chart"), newCore("radial-chart")],
    "Generic chart growth is an aggregate label; concrete chart contracts are separately implemented.",
  ),
  "candidate:dynamic-grid": covered(
    [completionCore("perspective-grid")],
    "The moving depth grid is covered by the perspective-grid scene-surface Core.",
  ),
  "candidate:ec-onda-audio": aggregate(
    [nextCore("audio-spectrum"), nextCore("audio-waveform")],
    "The package entry groups spectrum and waveform mechanisms already implemented separately.",
  ),
  "candidate:ec-remocn-github": composite(
    [completionCore("metric-card"), nextCore("numeric-counter"), nextCore("connection-flyline")],
    "Flying stars plus a count is a composition of metric, counter, and path-transfer mechanisms.",
  ),
  "candidate:ec-remocn-terminal": aggregate(
    [completionCore("code-block"), completionCore("code-focus"), nextCore("terminal-type")],
    "The entry is a family bundle, not one component identity.",
  ),
  "candidate:ec-remotion-animated": tooling(
    "The declarative animation wrapper is an implementation API, not a packaging object or mechanism.",
  ),
  "candidate:ec-remotion-subtitles": tooling(
    "Subtitle timeline parsing and synchronization are host infrastructure; visible caption treatments are covered by text Cores.",
  ),
  "candidate:ec-remotion-transitions": aggregate(
    [nextCore("geometric-wipe"), nextCore("scene-push"), newCore("cross-dissolve"), nextCore("texture-dissolve")],
    "The library entry contains several already separated transition mechanisms.",
  ),
  "candidate:ec-rui-audio": aggregate(
    [nextCore("audio-spectrum"), nextCore("audio-waveform")],
    "Audio utilities and visualizers resolve to the two bounded audio signal Cores.",
  ),
  "candidate:hf-apple-terminal": aggregate(
    [completionCore("code-block"), nextCore("terminal-type")],
    "Twelve themes are presets over the same code and terminal contracts.",
  ),
  "candidate:hf-chatgpt-claude": covered(
    [completionCore("chat-thread")],
    "Brand-specific chat chrome is a preset over the common message-sequence contract.",
  ),
  "candidate:hf-code-3d-extrude": covered(
    [completionCore("code-block"), nextCore("depth-camera")],
    "Extrusion is a depth-camera preset applied to a code block.",
  ),
  "candidate:hf-code-scroll": covered(
    [completionCore("code-focus")],
    "Bound line scrolling is a code-focus preset.",
  ),
  "candidate:hf-engineering": tooling(
    "Timing, tracks, deterministic seeking, and parameter plumbing are engine contracts, not visual components.",
  ),
  "candidate:hf-maps-plus": aggregate(
    [nextCore("impact-feedback"), nextCore("time-relation"), nextCore("ambient-particle")],
    "Beat accent, pulse background, and beat timeline are separate implemented mechanisms bundled by one source entry.",
  ),
  "candidate:hf-transition-set": aggregate(
    [newCore("cross-dissolve"), nextCore("geometric-wipe"), nextCore("scene-push"), nextCore("cube-transition"), nextCore("texture-dissolve")],
    "The source is a transition collection; each independent family has an implemented destination.",
  ),
  "candidate:hf-world-map": covered(
    [completionCore("map-data")],
    "Map variants share the bound geometry and location-data contract.",
  ),
  "candidate:od-kenburns": covered(
    [completionCore("media-pan-zoom")],
    "Ken Burns motion is the media-pan-zoom Core.",
  ),
  "candidate:od-piereveal": covered(
    [newCore("radial-chart")],
    "Pie reveal is a radial-chart preset.",
  ),
  "candidate:od-progresssteps": covered(
    [completionCore("step-progress")],
    "Discrete completed/current/pending states require the step-progress Core.",
  ),
  "candidate:od-statcard": covered(
    [completionCore("metric-card")],
    "The independent object is a metric card with value, unit, label, and optional delta.",
  ),
  "candidate:od-transition-a": covered(
    [nextCore("scene-push"), nextCore("camera-transform")],
    "Zoom transition is a scene boundary preset combining directional scene movement and a bounded camera transform.",
  ),
  "candidate:pj-brand": composite(
    [nextCore("brand-lockup"), nextCore("ambient-particle"), newCore("light-overlay")],
    "The showcase is a brand-lockup scene composed with particle and light treatments.",
  ),
  "candidate:pj-kenburns": composite(
    [completionCore("media-pan-zoom"), nextCore("media-tour")],
    "The slideshow composes per-media pan/zoom with media sequencing.",
  ),
  "candidate:pj-product": composite(
    [newCore("media-frame"), base("text-clean-card"), nextCore("camera-transform")],
    "A full product advertisement is a layout and editorial composition, not one reusable effect.",
  ),
  "candidate:pj-videooverlay": covered(
    [base("stage-detail-inset")],
    "Video overlay is the existing bounded detail-inset media stage.",
  ),
  "candidate:playground-src-compositions-mediaexamples-mediafromurl-jsx": mediaAdapter(
    "Loading media from a URL is an ingestion adapter; it does not change the visible packaging mechanism.",
  ),
  "candidate:playground-src-compositions-prolevel-fastediting-tsx": composite(
    [nextCore("scene-push"), nextCore("impact-feedback"), newCore("cross-dissolve")],
    "Fast editing is an editorial cadence assembled from cuts and emphasis Cores, not an independent component.",
  ),
  "candidate:pw-burgerad": composite(
    [newCore("media-frame"), nextCore("brand-lockup"), nextCore("camera-transform"), newCore("light-overlay")],
    "The 15-second advertisement is a complete scene program with multiple reusable mechanisms.",
  ),
  "candidate:pw-chrometilt": composite(
    [nextCore("screen-frame"), nextCore("camera-transform"), nextCore("selection-control"), base("annotation-cursor")],
    "The interactive browser demo composes a framed screen, camera, controls, and pointer path.",
  ),
  "candidate:pw-iconcloud": covered(
    [completionCore("icon-cloud")],
    "The reusable Fibonacci/spherical entity arrangement is captured by icon-cloud.",
  ),
  "candidate:pw-parameterized": tooling(
    "Schema, color picker, default props, and live parameter editing are authoring infrastructure.",
  ),
  "candidate:pw-piechart": covered(
    [newCore("radial-chart")],
    "Segmented circular drawing and legends are a radial-chart preset.",
  ),
  "candidate:pw-techgrid": covered(
    [completionCore("perspective-grid")],
    "The independently reusable mechanism is a perspective grid surface.",
  ),
  "candidate:pw-transition": aggregate(
    [newCore("cross-dissolve"), nextCore("scene-push"), nextCore("geometric-wipe")],
    "The demo exposes the official transition families already represented by separate Cores.",
  ),
  "candidate:pw-videorotation": composite(
    [nextCore("screen-frame"), nextCore("camera-transform"), base("text-mini-explanation")],
    "The full narrated walkthrough is a composition, while its reusable screen, camera, and caption parts are covered.",
  ),
  "candidate:rc-glasscodeblock": covered(
    [completionCore("code-block")],
    "Glass is a visual preset over the code-block content contract.",
  ),
  "candidate:rc-handwrite": covered(
    [completionCore("stroke-trace")],
    "Handwriting is a path-trace preset with an approved vector path.",
  ),
  "candidate:rc-scribblecircle": covered(
    [base("annotation-circle")],
    "A scribbled circle is a style preset of the existing circle annotation.",
  ),
  "candidate:rc-terminalsimulator": covered(
    [nextCore("terminal-type")],
    "The simulator shares the terminal line and prompt contract.",
  ),
  "candidate:ro-animutils": tooling(
    "Transform and style interpolation helpers are implementation utilities.",
  ),
  "candidate:ro-effects": aggregate(
    [completionCore("media-treatment"), newCore("channel-distortion"), newCore("light-overlay"), newCore("color-treatment")],
    "The package groups multiple media-treatment presets and already separated distortion, light, and color Cores.",
  ),
  "candidate:ro-giflottie": mediaAdapter(
    "GIF and Lottie decoding are media adapters; the selected asset remains the packaging object.",
  ),
  "candidate:ro-layout": tooling(
    "Layout helpers calculate geometry and do not render an independently selectable effect.",
  ),
  "candidate:ro-layoututils": tooling(
    "Text measurement and fitting guard capacity but are not visual components.",
  ),
  "candidate:ro-mediautils": tooling(
    "Audio sampling and path smoothing feed audio Cores but do not render a component by themselves.",
  ),
  "candidate:ro-motionblur": covered(
    [nextCore("smear-trail")],
    "Motion blur is an implementation treatment of the bounded smear/trail mechanism.",
  ),
  "candidate:ro-paths": tooling(
    "Path interpolation and morphing are implementation utilities consumed by stroke and transition Cores.",
  ),
  "candidate:ro-shapes": tooling(
    "Shape constructors feed annotation Cores and are not independently selected packaging effects.",
  ),
  "candidate:ro-tpl-audiogram": composite(
    [nextCore("audio-waveform"), nextCore("audio-spectrum"), nextCore("karaoke-progress")],
    "Audiogram is a composition of audio signal and word-progress components.",
  ),
  "candidate:ro-tpl-codehike": aggregate(
    [completionCore("code-diff"), completionCore("code-focus")],
    "Token focus and diff states are covered by separate code Cores.",
  ),
  "candidate:ro-tpl-musicviz": aggregate(
    [nextCore("audio-spectrum"), nextCore("audio-waveform")],
    "Music visualization resolves to bounded frequency and waveform views.",
  ),
  "candidate:ro-tpl-overlay": covered(
    [base("text-clean-card"), base("text-context-label")],
    "An overlay corner card is a preset of existing supporting text primitives.",
  ),
  "candidate:ro-tpl-stargazer": composite(
    [nextCore("line-chart"), completionCore("metric-card")],
    "The template combines a trend chart with a metric summary.",
  ),
  "candidate:ro-tpl-tiktok": covered(
    [nextCore("karaoke-progress")],
    "Timed word coloring is the karaoke-progress mechanism.",
  ),
  "candidate:ro-transitions": aggregate(
    [newCore("cross-dissolve"), nextCore("geometric-wipe"), nextCore("scene-push"), nextCore("texture-dissolve")],
    "The package is a transition toolkit rather than one component.",
  ),
  "candidate:ro-whisper": tooling(
    "Speech transcription creates timing evidence and is not a visible packaging component.",
  ),
  "candidate:rs-cinematic": aggregate(
    [nextCore("text-reveal"), nextCore("kinetic-type"), nextCore("gradient-text"), nextCore("impact-feedback")],
    "Ten cinematic title treatments reduce to existing bounded text mechanisms plus style presets.",
  ),
  "candidate:rs-liquid": aggregate(
    [newCore("liquid-blob"), newCore("liquid-flow"), newCore("liquid-ink"), newCore("liquid-ripple"), newCore("liquid-surface"), newCore("liquid-swirl")],
    "The source entry is an aggregate of the implemented liquid mechanism family.",
  ),
  "candidate:rs-lists": aggregate(
    [nextCore("list-sequence"), nextCore("time-relation"), nextCore("panel-grid")],
    "List layouts and timelines are presets over sequence, time relation, and panel grid Cores.",
  ),
  "candidate:rs-logo": aggregate(
    [nextCore("brand-lockup"), nextCore("text-reveal"), nextCore("gradient-text")],
    "Logo animation variants use the brand-lockup and text reveal/treatment contracts.",
  ),
  "candidate:rs-ui": aggregate(
    [nextCore("selection-control"), nextCore("ui-materialize"), newCore("loader-indicator"), base("annotation-click-ripple")],
    "The UI suite is a collection of selection, materialization, loading, and click states.",
  ),
  "candidate:rui-audio-pulse": covered(
    [nextCore("audio-waveform")],
    "Audio pulse is a compact waveform amplitude preset.",
  ),
  "candidate:rv-clippkit-toast": covered(
    [nextCore("ui-materialize")],
    "Toast entrance, hold, and exit are a UI materialization preset.",
  ),
  "candidate:rv-clippkit-waveform": aggregate(
    [nextCore("audio-spectrum"), nextCore("audio-waveform")],
    "Bar, circular, and linear waveform views share the bounded audio-sample inputs.",
  ),
  "candidate:rve-templates-floating-bubble-text-tsx": covered(
    [nextCore("kinetic-type")],
    "Floating bubble text is a kinetic-type layout preset.",
  ),
  "candidate:rve-templates-ken-burns-tsx": covered(
    [completionCore("media-pan-zoom")],
    "Ken Burns motion uses the bounded media-pan-zoom contract.",
  ),
  "candidate:rve-templates-parallax-pan-tsx": covered(
    [completionCore("media-pan-zoom"), nextCore("depth-camera")],
    "Parallax pan is a layered preset over media pan/zoom and depth camera.",
  ),
  "candidate:rve-templates-zoom-pulse-tsx": covered(
    [nextCore("camera-transform")],
    "Zoom pulse is a bounded camera-transform preset.",
  ),
  "candidate:scenes-src-scenes-demoanimations-demodragdrop-tsx": covered(
    [nextCore("selection-control"), nextCore("ui-materialize")],
    "Drag/drop is a bounded selection-state preset with materialized source and destination states.",
  ),
  "candidate:scenes-src-scenes-demoanimations-demomenuexpand-tsx": covered(
    [nextCore("selection-control"), nextCore("ui-materialize")],
    "Menu expansion is a selection-control and UI materialization preset.",
  ),
  "candidate:scenes-src-scenes-demoanimations-demomodal-tsx": covered(
    [nextCore("ui-materialize")],
    "Modal open/close is a UI materialization preset.",
  ),
  "candidate:scenes-src-scenes-demoanimations-demopagetransition-tsx": covered(
    [nextCore("scene-push")],
    "The reusable behavior is an existing scene boundary transition.",
  ),
  "candidate:scenes-src-scenes-demoanimations-demosearchfilter-tsx": covered(
    [nextCore("selection-control"), nextCore("list-sequence")],
    "Search/filter is a selection state applied to a bounded list.",
  ),
  "candidate:scenes-src-scenes-demoanimations-demotooltip-tsx": covered(
    [nextCore("ui-materialize")],
    "Tooltip appearance is a small UI materialization preset anchored to a real target.",
  ),
  "candidate:scenes-src-scenes-demoanimations-demowizard-tsx": covered(
    [completionCore("step-progress"), nextCore("selection-control")],
    "Wizard state is covered by step-progress and a bounded selection control.",
  ),
  "candidate:scenes-src-scenes-themeanimations-theme3dglassthreejs-tsx": {
    disposition: "STYLE_REFERENCE_ONLY",
    componentIds: [nextCore("depth-camera"), completionCore("media-treatment")],
    rationale: "The entry is a complete 3D glass style system; depth and media treatment mechanisms are covered, but the style itself is not a component.",
  },
  "candidate:snap-terminal-simulator": covered(
    [nextCore("terminal-type")],
    "The simulator shares the bounded terminal input contract.",
  ),
  "candidate:svg-stroke-trace": covered(
    [completionCore("stroke-trace")],
    "Arbitrary SVG path drawing is implemented by stroke-trace.",
  ),
  "candidate:th-fullscreen": covered(
    [base("stage-person-full")],
    "Talking-head fullscreen is an existing person media-stage primitive.",
  ),
  "candidate:th-pip": covered(
    [base("stage-person-pip-circle")],
    "Talking-head picture-in-picture is an existing person PIP primitive.",
  ),
  "candidate:vox-annotate": aggregate(
    [base("annotation-arrow"), base("annotation-circle"), base("annotation-callout")],
    "The annotation bundle resolves to existing bounded annotation primitives.",
  ),
  "candidate:vs-caption": covered(
    [base("text-mini-explanation")],
    "The bottom explanatory strip is a mini-explanation text preset.",
  ),
  "candidate:vs-drawsvgtrace": covered(
    [completionCore("stroke-trace")],
    "The reusable behavior is arbitrary path tracing.",
  ),
  "candidate:vs-flatpanel": covered(
    [base("evidence-clean-card")],
    "A flat paper panel is a visual preset of the evidence card primitive.",
  ),
  "candidate:vs-motionfixture": tooling(
    "Design-stage coordinate scaling and interpolation helpers are rendering infrastructure.",
  ),
  "candidate:vs-motionhelpers": tooling(
    "Velocity, lag, and damped settling helpers are implementation utilities.",
  ),
  "candidate:vs-mulberry": tooling(
    "A deterministic pseudo-random generator is infrastructure, not a visual component.",
  ),
  "candidate:vs-ripple": covered(
    [newCore("liquid-ripple")],
    "Concentric breathing rings are a liquid-ripple scene preset.",
  ),
  "candidate:whiteboard-ink": covered(
    [completionCore("stroke-trace")],
    "Whiteboard ink is a stroke-trace style preset.",
  ),
  "candidate:workbench-chapter-title": covered(
    [base("text-clean-card"), nextCore("text-reveal")],
    "Chapter numbering and title text use existing card and reveal contracts.",
  ),
  "candidate:workbench-verdict-stamp": covered(
    [nextCore("impact-feedback"), nextCore("icon-feedback")],
    "A verdict stamp combines bounded text impact and icon state feedback without a new input contract.",
  ),
  "candidate:zoom-through-transition": covered(
    [nextCore("scene-push"), nextCore("camera-transform")],
    "Zoom-through is a scene-push and camera-transform preset.",
  ),
} satisfies Record<string, SmartPackagingManualClosureDecisionV1>);

export const SMART_PACKAGING_PARAMETER_EFFECT_UNIT_MAP_V1 = Object.freeze({
  "candidate:curvable-text-hover": [nextCore("gradient-text")],
  "candidate:cv-bulbbg": [completionCore("media-treatment"), newCore("light-overlay")],
  "candidate:cv-curvabletypes": [nextCore("text-reveal")],
  "candidate:cv-ellipsebloom": [newCore("light-overlay")],
  "candidate:cv-textswap": [nextCore("word-relay")],
  "candidate:cv-twodrops": [newCore("liquid-blob")],
  "candidate:cv-typewriter": [nextCore("typewriter")],
  "candidate:rs-shape-circular-progress": [nextCore("gauge-arc")],
  "candidate:rs-text-counter": [nextCore("numeric-counter")],
  "candidate:rs-text3dflip": [nextCore("split-flap")],
  "candidate:rs-textexplode": [nextCore("text-fracture")],
  "candidate:rs-textglitch": [nextCore("kinetic-type"), newCore("channel-distortion")],
  "candidate:rs-textmaskreveal": [nextCore("text-reveal")],
  "candidate:rs-textscramble": [nextCore("kinetic-type")],
  "candidate:rs-textsplit": [nextCore("text-reveal")],
  "candidate:rs-textwave": [nextCore("kinetic-type")],
  "shotcraft:page-waterfall-wall:page-waterfall-wall": [nextCore("media-carousel"), nextCore("panel-grid")],
  "shotcraft:paper-title-card:paper-title-card": [nextCore("text-reveal")],
} satisfies Record<string, string[]>);

export const SMART_PACKAGING_BLOCKED_EFFECT_UNIT_MAP_V1 = Object.freeze({
  "shotcraft:document-typewriter-reveal:document-typewriter-reveal": [
    nextCore("typewriter"),
    nextCore("text-reveal"),
    nextCore("list-sequence"),
    nextCore("camera-transform"),
  ],
  "shotcraft:list-stack-press:list-stack-press": [
    nextCore("card-stack"),
    nextCore("list-sequence"),
    nextCore("numeric-counter"),
    nextCore("camera-transform"),
  ],
  "shotcraft:outro-group-photo-launch:outro-group-photo-launch": [
    newCore("media-grid"),
    nextCore("brand-lockup"),
    nextCore("ambient-particle"),
    nextCore("camera-transform"),
  ],
  "shotcraft:row-embed:row-embed": [
    nextCore("list-sequence"),
    nextCore("camera-transform"),
  ],
} satisfies Record<string, string[]>);

export const smartPackagingFinalDispositionValues = [
  "COMPONENT_COVERED",
  "AGGREGATE_COVERED",
  "COMPOSITE_COVERED",
  "LAYOUT_REFERENCE_ONLY",
  "STYLE_REFERENCE_ONLY",
  "TOOLING_NOT_COMPONENT",
  "MEDIA_ADAPTER_NOT_COMPONENT",
] as const;

const componentIdSchema = z
  .string()
  .regex(/^(component|new-core-lab|next-core-lab|catalog-completion):v1:/u);

export const smartPackagingFinalClosureRecordSchema = z
  .strictObject({
    effectUnitId: z.string().min(1),
    candidateId: z.string().min(1),
    label: z.string().min(1),
    inventoryTarget: z.string().min(1),
    resolvedTarget: z.string().min(1),
    inventoryMechanismId: z.string().nullable(),
    disposition: z.enum(smartPackagingFinalDispositionValues),
    independentlyComponentizable: z.boolean(),
    componentIds: z.array(componentIdSchema),
    basis: z.array(z.string().min(1)).min(1),
    rationale: z.string().min(1),
    sourceReviewRuntimeStatus: z.enum(["PASS", "BLOCKED"]).nullable(),
    lifecycle: z.literal("RESEARCH_CLOSED"),
    visibility: z.literal("LAB_ONLY"),
    agentVisible: z.literal(false),
    productionReady: z.literal(false),
  })
  .superRefine((record, ctx) => {
    if (
      record.disposition === "COMPONENT_COVERED" &&
      record.componentIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["componentIds"],
        message: "component-covered records require at least one component",
      });
    }
    if (
      record.independentlyComponentizable !==
      (record.disposition === "COMPONENT_COVERED")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["independentlyComponentizable"],
        message: "only component-covered records are independently componentizable",
      });
    }
    if (new Set(record.componentIds).size !== record.componentIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["componentIds"],
        message: "component identities must be unique",
      });
    }
  });

export type SmartPackagingFinalClosureRecordV1 = z.infer<
  typeof smartPackagingFinalClosureRecordSchema
>;

const implementationFileSchema = z.strictObject({
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const smartPackagingCatalogCompletionRecordSchema = z.strictObject({
  coreId: z.enum(smartPackagingCatalogCompletionCoreIdValues),
  implementationId: z.string().regex(/^catalog-completion:v1:/u),
  label: z.string().min(1),
  target: z.enum(smartPackagingCatalogCompletionTargetValues),
  renderFamily: z.enum(smartPackagingCatalogCompletionRenderFamilyValues),
  roleConstraint: z.enum(["MAIN_OR_SUPPORT", "SUPPORT_ONLY", "NOT_VISUAL_ROLE"]),
  requiredEvidence: z.array(z.string().min(1)).min(1),
  inputContract: z.strictObject({
    requiredProps: z.array(z.string().min(1)),
    optionalProps: z.array(z.string().min(1)),
    capacity: z.strictObject({
      minimumItems: z.number().int().nullable(),
      maximumItems: z.number().int().nullable(),
      maximumTextCharacters: z.number().int().nullable(),
    }),
  }),
  motionContract: z.strictObject({
    frameDriven: z.literal(true),
    deterministic: z.literal(true),
    noCssAnimation: z.literal(true),
    noUnseededRandom: z.literal(true),
    reducedMotionSupported: z.literal(true),
    staticFallback: z.string().min(1),
  }),
  rationale: z.string().min(1),
  sourceEffectUnitIds: z.array(z.string().min(1)).min(1),
  implementation: z.strictObject({
    path: z.string().min(1),
    exportName: z.string().min(1),
    fileSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }),
  lifecycle: z.literal("DRAFT"),
  visibility: z.literal("LAB_ONLY"),
  agentVisible: z.literal(false),
  productionReady: z.literal(false),
  visualReviewPassed: z.literal(false),
  productUserAccepted: z.literal(false),
});

export type SmartPackagingCatalogCompletionRecordV1 = z.infer<
  typeof smartPackagingCatalogCompletionRecordSchema
>;

const summarySchema = z.strictObject({
  totalEffectUnits: z.literal(797),
  resolvedEffectUnits: z.literal(797),
  unresolvedEffectUnits: z.literal(0),
  independentlyComponentizableEffectUnits: z.number().int().nonnegative(),
  nonComponentEffectUnits: z.number().int().nonnegative(),
  byDisposition: z.record(z.string(), z.number().int().nonnegative()),
  finalIndependentComponents: z.literal(108),
  existingIndependentComponents: z.literal(95),
  newlyImplementedIndependentComponents: z.literal(13),
  newComponentsByTarget: z.record(z.string(), z.number().int().nonnegative()),
  legacyRunnableResolved: z.literal(24),
  parameterAdapterResolved: z.literal(18),
  outsideCalibrationUnknownResolved: z.literal(48),
  sourceRuntimeBlocksResolvedByReimplementation: z.literal(4),
  agentVisible: z.literal(0),
  productionReady: z.literal(0),
});

export const smartPackagingFinalClosureManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  purpose: z.literal("smart_packaging_full_catalog_component_closure"),
  policy: z.strictObject({
    inventoryEffectUnits: z.literal(797),
    everyEffectUnitRequiresFinalDisposition: z.literal(true),
    componentsRequireIndependentInputContract: z.literal(true),
    completeScenesAreNotComponents: z.literal(true),
    layoutsAreNotComponents: z.literal(true),
    styleSystemsAreNotComponents: z.literal(true),
    aggregatePackagesAreNotComponents: z.literal(true),
    toolingIsNotComponentInventory: z.literal(true),
    noAutomaticProductPromotion: z.literal(true),
  }),
  derivedFrom: z.record(
    z.string(),
    z.strictObject({
      path: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    }),
  ),
  implementationFiles: z.array(implementationFileSchema).min(1),
  completionCores: z
    .array(smartPackagingCatalogCompletionRecordSchema)
    .length(13),
  records: z.array(smartPackagingFinalClosureRecordSchema).length(797),
  summary: summarySchema,
});

export type SmartPackagingFinalClosureManifestV1 = z.infer<
  typeof smartPackagingFinalClosureManifestSchema
>;

export const smartPackagingFinalClosureSummarySchema = z.strictObject({
  schemaVersion: z.literal(1),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  summary: summarySchema,
  all797Resolved: z.literal(true),
  allComponentizableImplemented: z.literal(true),
  noUnknownOrNeedsEvidenceDisposition: z.literal(true),
  noCanonicalInventoryMutation: z.literal(true),
  noProductionRegistryMutation: z.literal(true),
  labVisualReviewAccepted: z.literal(false),
  productUserAccepted: z.literal(false),
});

export type SmartPackagingFinalClosureSummaryV1 = z.infer<
  typeof smartPackagingFinalClosureSummarySchema
>;

export const stringifySmartPackagingCatalogCompletionJson = (
  value: unknown,
): string => `${JSON.stringify(value, null, 2)}\n`;
