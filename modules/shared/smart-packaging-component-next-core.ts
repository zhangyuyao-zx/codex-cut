import path from "node:path";
import { z } from "zod";

/**
 * The Next Core Lab implements the 55 single-mechanism gaps closed by the
 * 145-unit disposition review. These identities remain DRAFT / LAB_ONLY until
 * a separate visual review. They are not Production Registry entries and are
 * never visible to the Project Agent.
 */

const SHA256 = z.string().regex(/^[a-f0-9]{64}$/u);
const SAFE_RELATIVE_PATH = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !path.isAbsolute(value) &&
      !/^[A-Za-z]:[\\/]/u.test(value) &&
      !value.split(/[\\/]/u).includes("..") &&
      !/^[a-z][a-z0-9+.-]*:/iu.test(value),
    "path must be project-relative and traversal-free",
  );

export const smartPackagingNextCoreIdValues = [
  "ambient-particle",
  "audio-spectrum",
  "audio-waveform",
  "bar-chart",
  "before-after",
  "brand-lockup",
  "camera-transform",
  "card-deck",
  "card-flip",
  "card-stack",
  "chart-axis-rescale",
  "clone-depth-echo",
  "connection-flyline",
  "cube-transition",
  "depth-camera",
  "flow-diagram",
  "gauge-arc",
  "geometric-wipe",
  "gradient-text",
  "hud-focus",
  "icon-feedback",
  "impact-feedback",
  "karaoke-progress",
  "kinetic-type",
  "line-chart",
  "list-sequence",
  "media-carousel",
  "media-tour",
  "numeric-counter",
  "panel-grid",
  "particle-celebration",
  "particle-transition",
  "progress-bar",
  "prompt-paste",
  "response-stream",
  "scene-push",
  "screen-frame",
  "selection-control",
  "shared-morph",
  "smear-trail",
  "space-camera",
  "speed-ramp",
  "split-flap",
  "spotlight-scan",
  "stream-line-chart",
  "terminal-type",
  "text-fracture",
  "text-reveal",
  "texture-dissolve",
  "theme-transition",
  "time-relation",
  "typewriter",
  "ui-materialize",
  "unit-chart",
  "word-relay",
] as const;

export type SmartPackagingNextCoreId =
  (typeof smartPackagingNextCoreIdValues)[number];

export const smartPackagingNextCoreBatchValues = [
  "DATA_AUDIO",
  "TEXT_UI_ANNOTATION",
  "RELATION_MEDIA",
  "SCENE_TRANSITION",
] as const;
export type SmartPackagingNextCoreBatch =
  (typeof smartPackagingNextCoreBatchValues)[number];

export const smartPackagingNextCoreRenderFamilyValues = [
  "ANNOTATION",
  "AUDIO",
  "DATA",
  "MEDIA",
  "RELATION",
  "SCENE",
  "TEXT",
  "TRANSITION",
  "UI",
] as const;
export type SmartPackagingNextCoreRenderFamily =
  (typeof smartPackagingNextCoreRenderFamilyValues)[number];

export const smartPackagingNextCoreTargetValues = [
  "AUDIO_SIGNAL",
  "LOCAL_ANNOTATION",
  "MEDIA_EVIDENCE",
  "QUANT_DATA",
  "RELATION_STRUCTURE",
  "SCENE_SURFACE",
  "SCREEN_UI",
  "TEXT_INFO",
  "TRANSITION_BOUNDARY",
] as const;
export type SmartPackagingNextCoreTarget =
  (typeof smartPackagingNextCoreTargetValues)[number];

export const smartPackagingNextCoreRoleValues = [
  "MAIN_OR_SUPPORT",
  "SUPPORT_ONLY",
  "NOT_VISUAL_ROLE",
] as const;
export type SmartPackagingNextCoreRole =
  (typeof smartPackagingNextCoreRoleValues)[number];

interface NextCoreContractTemplate {
  batch: SmartPackagingNextCoreBatch;
  renderFamily: SmartPackagingNextCoreRenderFamily;
  requiredProps: string[];
  optionalProps: string[];
  capacity: {
    minimumItems: number | null;
    maximumItems: number | null;
    maximumTextCharacters: number | null;
  };
  staticFallback: string;
}

const contract = (
  batch: SmartPackagingNextCoreBatch,
  renderFamily: SmartPackagingNextCoreRenderFamily,
  requiredProps: string[],
  optionalProps: string[],
  capacity: NextCoreContractTemplate["capacity"],
  staticFallback: string,
): NextCoreContractTemplate => ({
  batch,
  renderFamily,
  requiredProps,
  optionalProps: [...optionalProps, "intensity", "reducedMotion"],
  capacity,
  staticFallback,
});

const oneScene = { minimumItems: 1, maximumItems: 1, maximumTextCharacters: null };
const twoScenes = { minimumItems: 2, maximumItems: 2, maximumTextCharacters: null };

export const SMART_PACKAGING_NEXT_CORE_CONTRACTS_V1 = Object.freeze({
  "ambient-particle": contract(
    "SCENE_TRANSITION",
    "SCENE",
    ["content", "seed"],
    ["count", "density", "accentColor"],
    oneScene,
    "保留场景和固定 seed 的稀疏粒子终态，不持续漂移。",
  ),
  "audio-spectrum": contract(
    "DATA_AUDIO",
    "AUDIO",
    ["samples", "label"],
    ["bands", "accentColor"],
    { minimumItems: 16, maximumItems: 256, maximumTextCharacters: 40 },
    "显示当前受证据约束的频段快照。",
  ),
  "audio-waveform": contract(
    "DATA_AUDIO",
    "AUDIO",
    ["samples", "label"],
    ["windowSize", "accentColor"],
    { minimumItems: 16, maximumItems: 512, maximumTextCharacters: 40 },
    "显示完整静态波形与时间基准。",
  ),
  "bar-chart": contract(
    "DATA_AUDIO",
    "DATA",
    ["data", "title", "unit"],
    ["accentColor", "ordering"],
    { minimumItems: 2, maximumItems: 10, maximumTextCharacters: 48 },
    "显示全部条形、共同量纲、标签与单位。",
  ),
  "before-after": contract(
    "RELATION_MEDIA",
    "MEDIA",
    ["before", "after", "beforeLabel", "afterLabel"],
    ["divider", "accentColor"],
    { minimumItems: 2, maximumItems: 2, maximumTextCharacters: 32 },
    "按同一裁切和尺度并列显示前后证据。",
  ),
  "brand-lockup": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["mark", "name"],
    ["tagline", "accentColor"],
    { minimumItems: 1, maximumItems: 3, maximumTextCharacters: 64 },
    "显示稳定标志、字标和从属标签层级。",
  ),
  "camera-transform": contract(
    "SCENE_TRANSITION",
    "SCENE",
    ["content", "focusX", "focusY"],
    ["translateX", "translateY", "scale", "rotation"],
    oneScene,
    "显示完整场景并停在受控轻微重构终态。",
  ),
  "card-deck": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["items"],
    ["fanAngle", "accentColor"],
    { minimumItems: 3, maximumItems: 8, maximumTextCharacters: 48 },
    "显示已展开且层级明确的完整卡片组。",
  ),
  "card-flip": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["front", "back"],
    ["axis", "accentColor"],
    { minimumItems: 2, maximumItems: 2, maximumTextCharacters: 80 },
    "直接显示正反两面并标明关系。",
  ),
  "card-stack": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["items"],
    ["spread", "accentColor"],
    { minimumItems: 2, maximumItems: 7, maximumTextCharacters: 48 },
    "显示稳定堆叠与可辨识的项目顺序。",
  ),
  "chart-axis-rescale": contract(
    "DATA_AUDIO",
    "DATA",
    ["beforeData", "afterData", "title", "unit"],
    ["accentColor"],
    { minimumItems: 2, maximumItems: 12, maximumTextCharacters: 48 },
    "并列显示变更前后的真实刻度和相同数据点。",
  ),
  "clone-depth-echo": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["content", "count"],
    ["depth", "accentColor"],
    { minimumItems: 2, maximumItems: 6, maximumTextCharacters: null },
    "显示有限、静止且顺序明确的纵深副本。",
  ),
  "connection-flyline": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["nodes", "edges"],
    ["accentColor", "showDirection"],
    { minimumItems: 2, maximumItems: 10, maximumTextCharacters: 36 },
    "显示全部节点、边与方向，不继续流动。",
  ),
  "cube-transition": contract(
    "SCENE_TRANSITION",
    "TRANSITION",
    ["fromScene", "toScene"],
    ["direction", "perspective"],
    twoScenes,
    "在边界中点直接切换到目标场景。",
  ),
  "depth-camera": contract(
    "SCENE_TRANSITION",
    "SCENE",
    ["layers", "focusLayerId"],
    ["parallax", "accentColor"],
    { minimumItems: 2, maximumItems: 6, maximumTextCharacters: 32 },
    "显示完整景深层级与固定焦点。",
  ),
  "flow-diagram": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["nodes", "edges", "title"],
    ["direction", "accentColor"],
    { minimumItems: 2, maximumItems: 9, maximumTextCharacters: 42 },
    "显示全部流程节点、方向和关系说明。",
  ),
  "gauge-arc": contract(
    "DATA_AUDIO",
    "DATA",
    ["value", "minimum", "maximum", "unit", "label"],
    ["accentColor", "thresholds"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 40 },
    "显示输入值对应的完整弧线、范围和单位。",
  ),
  "geometric-wipe": contract(
    "SCENE_TRANSITION",
    "TRANSITION",
    ["fromScene", "toScene"],
    ["shape", "direction", "accentColor"],
    twoScenes,
    "在边界中点使用直接切换。",
  ),
  "gradient-text": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["text"],
    ["colors", "direction"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 48 },
    "显示完整、可读的固定渐变文字。",
  ),
  "hud-focus": contract(
    "TEXT_UI_ANNOTATION",
    "ANNOTATION",
    ["content", "targetX", "targetY", "label"],
    ["radius", "accentColor"],
    oneScene,
    "显示静态锁定框、标签和未遮挡目标。",
  ),
  "icon-feedback": contract(
    "TEXT_UI_ANNOTATION",
    "ANNOTATION",
    ["icon", "state", "label"],
    ["accentColor"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 32 },
    "显示最终反馈状态、图标和文字标签。",
  ),
  "impact-feedback": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["text"],
    ["accentColor", "impactStyle"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 24 },
    "显示稳定高对比结论，不保留震动或闪烁。",
  ),
  "karaoke-progress": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["words", "activeWordIndex"],
    ["accentColor"],
    { minimumItems: 2, maximumItems: 16, maximumTextCharacters: 64 },
    "显示全部词和宿主绑定的当前词状态。",
  ),
  "kinetic-type": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["words"],
    ["layout", "accentColor"],
    { minimumItems: 2, maximumItems: 8, maximumTextCharacters: 48 },
    "按最终层级显示全部词组。",
  ),
  "line-chart": contract(
    "DATA_AUDIO",
    "DATA",
    ["data", "title", "unit"],
    ["accentColor", "showGrid"],
    { minimumItems: 2, maximumItems: 16, maximumTextCharacters: 48 },
    "显示完整折线、数据点、坐标和单位。",
  ),
  "list-sequence": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["items", "title"],
    ["accentColor", "numbered"],
    { minimumItems: 2, maximumItems: 8, maximumTextCharacters: 48 },
    "显示完整列表和最终顺序。",
  ),
  "media-carousel": contract(
    "RELATION_MEDIA",
    "MEDIA",
    ["items", "activeId"],
    ["accentColor"],
    { minimumItems: 3, maximumItems: 9, maximumTextCharacters: 32 },
    "显示当前焦点及相邻媒体的稳定轮播状态。",
  ),
  "media-tour": contract(
    "RELATION_MEDIA",
    "MEDIA",
    ["content", "focusRegions"],
    ["accentColor", "activeRegionId"],
    { minimumItems: 1, maximumItems: 6, maximumTextCharacters: 36 },
    "显示完整媒体和当前有证据的焦点区域。",
  ),
  "numeric-counter": contract(
    "DATA_AUDIO",
    "DATA",
    ["value", "unit", "label"],
    ["startValue", "precision", "accentColor"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 32 },
    "直接显示最终受证据约束的数值、单位和条件。",
  ),
  "panel-grid": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["panels"],
    ["columns", "activeId", "accentColor"],
    { minimumItems: 2, maximumItems: 9, maximumTextCharacters: 48 },
    "显示稳定网格、层级和当前焦点。",
  ),
  "particle-celebration": contract(
    "SCENE_TRANSITION",
    "SCENE",
    ["content", "seed"],
    ["count", "originX", "originY", "accentColor"],
    oneScene,
    "保留场景和有限庆祝粒子的静止终态。",
  ),
  "particle-transition": contract(
    "SCENE_TRANSITION",
    "TRANSITION",
    ["fromScene", "toScene", "seed"],
    ["count", "direction", "accentColor"],
    twoScenes,
    "在边界中点直接切换，不保留粒子遮蔽。",
  ),
  "progress-bar": contract(
    "DATA_AUDIO",
    "DATA",
    ["progress", "label"],
    ["unit", "accentColor", "segments"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 40 },
    "显示真实最终进度、标签与单位。",
  ),
  "prompt-paste": contract(
    "TEXT_UI_ANNOTATION",
    "UI",
    ["prompt", "state"],
    ["accentColor", "sourceLabel"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 180 },
    "显示完整提示词与最终粘贴状态。",
  ),
  "response-stream": contract(
    "TEXT_UI_ANNOTATION",
    "UI",
    ["chunks", "state"],
    ["accentColor", "modelLabel"],
    { minimumItems: 1, maximumItems: 8, maximumTextCharacters: 220 },
    "显示完整响应片段和最终状态。",
  ),
  "scene-push": contract(
    "SCENE_TRANSITION",
    "TRANSITION",
    ["fromScene", "toScene"],
    ["direction", "distance"],
    twoScenes,
    "在边界中点直接切换到目标场景。",
  ),
  "screen-frame": contract(
    "TEXT_UI_ANNOTATION",
    "UI",
    ["content", "title"],
    ["sourceLabel", "accentColor"],
    oneScene,
    "显示完整录屏、框体、标题和来源。",
  ),
  "selection-control": contract(
    "TEXT_UI_ANNOTATION",
    "UI",
    ["options", "selectedId"],
    ["label", "accentColor"],
    { minimumItems: 2, maximumItems: 8, maximumTextCharacters: 32 },
    "显示所有选项与真实选中状态。",
  ),
  "shared-morph": contract(
    "SCENE_TRANSITION",
    "TRANSITION",
    ["fromScene", "toScene", "sharedElementId"],
    ["accentColor"],
    twoScenes,
    "在边界中点显示目标场景和共享元素终态。",
  ),
  "smear-trail": contract(
    "SCENE_TRANSITION",
    "SCENE",
    ["content"],
    ["direction", "copies", "accentColor"],
    oneScene,
    "显示清晰主体并移除速度残像。",
  ),
  "space-camera": contract(
    "SCENE_TRANSITION",
    "SCENE",
    ["layers", "focusLayerId"],
    ["travelX", "travelY", "depth", "accentColor"],
    { minimumItems: 2, maximumItems: 8, maximumTextCharacters: 32 },
    "显示完整空间层级与固定焦点。",
  ),
  "speed-ramp": contract(
    "SCENE_TRANSITION",
    "SCENE",
    ["content", "rateCurve"],
    ["focusFrame", "accentColor"],
    oneScene,
    "按正常速率显示有证据的代表帧。",
  ),
  "split-flap": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["text"],
    ["characterSet", "accentColor"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 24 },
    "显示全部字符的最终稳定状态。",
  ),
  "spotlight-scan": contract(
    "TEXT_UI_ANNOTATION",
    "UI",
    ["content", "region"],
    ["label", "accentColor"],
    oneScene,
    "显示完整界面和静态聚光区域。",
  ),
  "stream-line-chart": contract(
    "DATA_AUDIO",
    "DATA",
    ["data", "title", "unit"],
    ["windowSize", "accentColor"],
    { minimumItems: 4, maximumItems: 32, maximumTextCharacters: 48 },
    "显示当前窗口的完整曲线、坐标和单位。",
  ),
  "terminal-type": contract(
    "TEXT_UI_ANNOTATION",
    "UI",
    ["lines", "activeLineIndex"],
    ["prompt", "accentColor"],
    { minimumItems: 1, maximumItems: 10, maximumTextCharacters: 80 },
    "显示完整终端记录和当前行。",
  ),
  "text-fracture": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["text"],
    ["fragments", "accentColor"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 24 },
    "显示完整聚合后的文字。",
  ),
  "text-reveal": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["text"],
    ["direction", "accentColor"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 64 },
    "显示完整、可读的最终文字。",
  ),
  "texture-dissolve": contract(
    "SCENE_TRANSITION",
    "TRANSITION",
    ["fromScene", "toScene", "seed"],
    ["texture", "accentColor"],
    twoScenes,
    "在边界中点直接切换到目标场景。",
  ),
  "theme-transition": contract(
    "SCENE_TRANSITION",
    "TRANSITION",
    ["fromScene", "toScene", "fromTheme", "toTheme"],
    ["direction"],
    twoScenes,
    "显示目标场景与最终主题。",
  ),
  "time-relation": contract(
    "RELATION_MEDIA",
    "RELATION",
    ["events", "title", "timeUnit"],
    ["accentColor", "conclusion"],
    { minimumItems: 2, maximumItems: 8, maximumTextCharacters: 48 },
    "显示完整事件顺序、单位和结论。",
  ),
  "typewriter": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["text"],
    ["cursor", "accentColor"],
    { minimumItems: 1, maximumItems: 1, maximumTextCharacters: 120 },
    "显示完整文字并隐藏闪烁光标。",
  ),
  "ui-materialize": contract(
    "TEXT_UI_ANNOTATION",
    "UI",
    ["elements"],
    ["activeId", "accentColor"],
    { minimumItems: 2, maximumItems: 8, maximumTextCharacters: 48 },
    "显示所有界面元素的最终结构。",
  ),
  "unit-chart": contract(
    "DATA_AUDIO",
    "DATA",
    ["value", "total", "label", "unit"],
    ["columns", "accentColor"],
    { minimumItems: 1, maximumItems: 100, maximumTextCharacters: 40 },
    "显示完整单位点阵、真实值、总量和单位。",
  ),
  "word-relay": contract(
    "TEXT_UI_ANNOTATION",
    "TEXT",
    ["headline", "label"],
    ["accentColor"],
    { minimumItems: 2, maximumItems: 2, maximumTextCharacters: 48 },
    "显示标题与降格标签的最终层级。",
  ),
} satisfies Record<SmartPackagingNextCoreId, NextCoreContractTemplate>);

const implementationByFamily: Record<
  SmartPackagingNextCoreRenderFamily,
  { path: string; exportName: string }
> = {
  ANNOTATION: {
    path: "desktop/component-lab/next-cores/text-ui-cores.tsx",
    exportName: "AnnotationCore",
  },
  AUDIO: {
    path: "desktop/component-lab/next-cores/data-audio-cores.tsx",
    exportName: "AudioCore",
  },
  DATA: {
    path: "desktop/component-lab/next-cores/data-audio-cores.tsx",
    exportName: "DataCore",
  },
  MEDIA: {
    path: "desktop/component-lab/next-cores/relation-media-cores.tsx",
    exportName: "MediaCore",
  },
  RELATION: {
    path: "desktop/component-lab/next-cores/relation-media-cores.tsx",
    exportName: "RelationCore",
  },
  SCENE: {
    path: "desktop/component-lab/next-cores/scene-transition-cores.tsx",
    exportName: "SceneCore",
  },
  TEXT: {
    path: "desktop/component-lab/next-cores/text-ui-cores.tsx",
    exportName: "TextCore",
  },
  TRANSITION: {
    path: "desktop/component-lab/next-cores/scene-transition-cores.tsx",
    exportName: "TransitionCore",
  },
  UI: {
    path: "desktop/component-lab/next-cores/text-ui-cores.tsx",
    exportName: "UiCore",
  },
};

export interface SmartPackagingNextCoreDispositionGroupInputV1 {
  destinationId: string;
  destinationLabel: string;
  disposition: string;
  resolvedTarget: string;
  roleConstraint: string;
  sourceMechanismIds: string[];
  effectUnitIds: string[];
  requiredEvidence: string[];
  rationale: string;
  extractionInstruction: string;
}

export interface SmartPackagingNextCoreImplementationEvidenceV1 {
  path: string;
  sha256: string;
}

const capacitySchema = z.strictObject({
  minimumItems: z.number().int().nonnegative().nullable(),
  maximumItems: z.number().int().positive().nullable(),
  maximumTextCharacters: z.number().int().positive().nullable(),
});

export const smartPackagingNextCoreRecordSchema = z.strictObject({
  coreId: z.enum(smartPackagingNextCoreIdValues),
  researchImplementationId: z
    .string()
    .regex(/^next-core-lab:v1:[a-z0-9-]+$/u),
  dispositionId: z.string().regex(/^candidate-core:v1:[a-z0-9-]+$/u),
  label: z.string().min(1),
  batch: z.enum(smartPackagingNextCoreBatchValues),
  renderFamily: z.enum(smartPackagingNextCoreRenderFamilyValues),
  target: z.enum(smartPackagingNextCoreTargetValues),
  roleConstraint: z.enum(smartPackagingNextCoreRoleValues),
  sourceMechanismIds: z.array(z.string().min(1)).min(1),
  sourceEffectUnitIds: z.array(z.string().min(1)).min(1),
  requiredEvidence: z.array(z.string().min(1)).min(1),
  inputContract: z.strictObject({
    requiredProps: z.array(z.string().min(1)).min(1),
    optionalProps: z.array(z.string().min(1)),
    capacity: capacitySchema,
  }),
  controls: z.strictObject({
    intensity: z.strictObject({
      minimum: z.literal(0),
      maximum: z.literal(1),
      defaultValue: z.number().min(0).max(1),
    }),
    durationFrames: z.strictObject({
      minimum: z.number().int().positive(),
      maximum: z.number().int().positive(),
      defaultValue: z.number().int().positive(),
    }),
  }),
  motionContract: z.strictObject({
    frameDriven: z.literal(true),
    deterministic: z.literal(true),
    noCssAnimation: z.literal(true),
    noUnseededRandom: z.literal(true),
    motionReasonRequired: z.literal(true),
    reducedMotionSupported: z.literal(true),
    staticFallback: z.string().min(1),
  }),
  rationale: z.string().min(1),
  extractionInstruction: z.string().min(1),
  implementation: z.strictObject({
    path: SAFE_RELATIVE_PATH,
    exportName: z.string().min(1),
    fileSha256: SHA256,
  }),
  lifecycle: z.literal("DRAFT"),
  visibility: z.literal("LAB_ONLY"),
  agentVisible: z.literal(false),
  productionReady: z.literal(false),
  visualReviewPassed: z.literal(false),
  labReviewAccepted: z.literal(false),
  projectAuditionPassed: z.literal(false),
  productUserAccepted: z.literal(false),
});

export type SmartPackagingNextCoreRecordV1 = z.infer<
  typeof smartPackagingNextCoreRecordSchema
>;

const countBy = (values: Iterable<string>): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "en")),
  );
};

const sortedUnique = <T extends string>(values: Iterable<T>): T[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));

export const buildSmartPackagingNextCoreRecordsV1 = (
  groups: SmartPackagingNextCoreDispositionGroupInputV1[],
  implementationEvidence: SmartPackagingNextCoreImplementationEvidenceV1[],
): SmartPackagingNextCoreRecordV1[] => {
  const newCoreGroups = groups.filter(
    (group) => group.disposition === "NEW_CORE_REQUIRED",
  );
  const groupById = new Map(
    newCoreGroups.map((group) => [group.destinationId, group]),
  );
  const implementationByPath = new Map(
    implementationEvidence.map((entry) => [entry.path, entry]),
  );

  const records = smartPackagingNextCoreIdValues.map((coreId) => {
    const dispositionId = `candidate-core:v1:${coreId}`;
    const group = groupById.get(dispositionId);
    if (group === undefined) {
      throw new Error(`next-core disposition group missing: ${dispositionId}`);
    }
    const contractDefinition = SMART_PACKAGING_NEXT_CORE_CONTRACTS_V1[coreId];
    const implementation =
      implementationByFamily[contractDefinition.renderFamily];
    const evidence = implementationByPath.get(implementation.path);
    if (evidence === undefined) {
      throw new Error(`next-core implementation missing: ${implementation.path}`);
    }

    return smartPackagingNextCoreRecordSchema.parse({
      coreId,
      researchImplementationId: `next-core-lab:v1:${coreId}`,
      dispositionId,
      label: group.destinationLabel,
      batch: contractDefinition.batch,
      renderFamily: contractDefinition.renderFamily,
      target: group.resolvedTarget,
      roleConstraint: group.roleConstraint,
      sourceMechanismIds: sortedUnique(group.sourceMechanismIds),
      sourceEffectUnitIds: sortedUnique(group.effectUnitIds),
      requiredEvidence: sortedUnique(group.requiredEvidence),
      inputContract: {
        requiredProps: sortedUnique(contractDefinition.requiredProps),
        optionalProps: sortedUnique(contractDefinition.optionalProps),
        capacity: contractDefinition.capacity,
      },
      controls: {
        intensity: { minimum: 0, maximum: 1, defaultValue: 0.68 },
        durationFrames: { minimum: 60, maximum: 360, defaultValue: 180 },
      },
      motionContract: {
        frameDriven: true,
        deterministic: true,
        noCssAnimation: true,
        noUnseededRandom: true,
        motionReasonRequired: true,
        reducedMotionSupported: true,
        staticFallback: contractDefinition.staticFallback,
      },
      rationale: group.rationale,
      extractionInstruction: group.extractionInstruction,
      implementation: {
        ...implementation,
        fileSha256: evidence.sha256,
      },
      lifecycle: "DRAFT",
      visibility: "LAB_ONLY",
      agentVisible: false,
      productionReady: false,
      visualReviewPassed: false,
      labReviewAccepted: false,
      projectAuditionPassed: false,
      productUserAccepted: false,
    });
  });

  if (newCoreGroups.length !== 55 || records.length !== 55) {
    throw new Error(
      `next-core scope drifted: ${newCoreGroups.length} groups / ${records.length} records`,
    );
  }
  const effectUnitIds = records.flatMap((record) => record.sourceEffectUnitIds);
  if (effectUnitIds.length !== 110 || new Set(effectUnitIds).size !== 110) {
    throw new Error(
      `next-core source coverage drifted: ${effectUnitIds.length} / ${new Set(effectUnitIds).size}`,
    );
  }
  if (new Set(records.map((record) => record.renderFamily)).size !== 9) {
    throw new Error("all 9 shared render families must be exercised");
  }
  return records;
};

export const summarizeSmartPackagingNextCoreRecordsV1 = (
  records: SmartPackagingNextCoreRecordV1[],
) => {
  if (records.length !== 55) {
    throw new Error(`next-core record count drifted: ${records.length}`);
  }
  const sourceRecords = records.reduce(
    (total, record) => total + record.sourceEffectUnitIds.length,
    0,
  );
  if (sourceRecords !== 110) {
    throw new Error(`next-core source count drifted: ${sourceRecords}`);
  }
  return {
    records: 55 as const,
    sourceRecords: 110 as const,
    implementationFamilies: 9 as const,
    byBatch: countBy(records.map((record) => record.batch)),
    byTarget: countBy(records.map((record) => record.target)),
    deterministicFrameDriven: 55 as const,
    reducedMotionSupported: 55 as const,
    lifecycleDraft: 55 as const,
    labOnly: 55 as const,
    visualReviewPassed: 0 as const,
    labReviewAccepted: 0 as const,
    projectAuditionPassed: 0 as const,
    productUserAccepted: 0 as const,
    productionReady: 0 as const,
    agentVisible: 0 as const,
  };
};

export const smartPackagingNextCoreManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  purpose: z.literal("smart_packaging_next_core_lab_v1"),
  derivedFrom: z.strictObject({
    dispositionManifestPath: SAFE_RELATIVE_PATH,
    dispositionManifestSha256: SHA256,
  }),
  definitionSetSha256: SHA256,
  scope: z.strictObject({
    dispositionGroups: z.literal(55),
    sourceEffectUnits: z.literal(110),
    implementedCores: z.literal(55),
    sharedRenderFamilies: z.literal(9),
    productionRegistryEntriesAdded: z.literal(0),
  }),
  implementationFiles: z
    .array(
      z.strictObject({
        path: SAFE_RELATIVE_PATH,
        sha256: SHA256,
      }),
    )
    .min(4),
  records: z.array(smartPackagingNextCoreRecordSchema).length(55),
  summary: z.strictObject({
    records: z.literal(55),
    sourceRecords: z.literal(110),
    implementationFamilies: z.literal(9),
    byBatch: z.record(z.string(), z.number().int().nonnegative()),
    byTarget: z.record(z.string(), z.number().int().nonnegative()),
    deterministicFrameDriven: z.literal(55),
    reducedMotionSupported: z.literal(55),
    lifecycleDraft: z.literal(55),
    labOnly: z.literal(55),
    visualReviewPassed: z.literal(0),
    labReviewAccepted: z.literal(0),
    projectAuditionPassed: z.literal(0),
    productUserAccepted: z.literal(0),
    productionReady: z.literal(0),
    agentVisible: z.literal(0),
  }),
});

export type SmartPackagingNextCoreManifestV1 = z.infer<
  typeof smartPackagingNextCoreManifestSchema
>;

export const smartPackagingNextCoreSummarySchema = z.strictObject({
  schemaVersion: z.literal(1),
  manifestSha256: SHA256,
  definitionSetSha256: SHA256,
  summary: smartPackagingNextCoreManifestSchema.shape.summary,
  all55Implemented: z.literal(true),
  exact110SourceCoverage: z.literal(true),
  noCanonicalInventoryMutation: z.literal(true),
  noProductionRegistryMutation: z.literal(true),
  labVisualReviewAccepted: z.literal(false),
  notProjectAudition: z.literal(true),
  notProductAcceptance: z.literal(true),
});

export const stringifySmartPackagingNextCoreJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;
