import {sceneModuleDraftSchema,sceneModuleManifestSchema,sceneModuleParametersSchema} from "./scene-module-contract.js";
import { COMPONENT_RUNTIME_SOURCE_HASH, COMPONENT_RUNTIME_SOURCE_HISTORY } from "../components/component-runtime-identity.generated.js";
import { COMPONENT_RUNTIME_DEFINITIONS } from "../components/component-runtime-catalog.js";
import { z } from "zod";
import { sceneMotionDraftSchema, compiledSceneMotionSchema, assertCompiledSceneMotion } from "./scene-motion.js";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  frameRangeSchema,
  hashSchema,
  idSchema,
  isoInstantSchema,
  jsonObjectSchema,
  millisecondRangeSchema,
  positiveRationalSchema,
} from "../shared/timeline-v2/schema.js";
import {
  directorExpressionTaskV1Schema,
  directorInformationRelationV1Schema,
  directorMotionReasonV1Schema,
  directorObjectClassV1Schema,
  directorPackagingModeV1Schema,
  directorSceneOperationV1Schema,
  directorVisualObjectKindV1Schema,
  projectDesignSystemV1Schema,
} from "./project-director-contract.js";
import {
  layoutCutObjectV1Schema,
  layoutCutV1Schema,
  type LayoutCutObjectV1,
  type LayoutCutV1,
} from "./layout-cut-contract.js";

const compactTextSchema = z.string().trim().min(1).max(2_000);
const shortTextSchema = z.string().trim().min(1).max(200);

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const SCENE_PATTERN_IDS_V1 = [
  "LAYOUT_PRESERVE_V1",
  "FLOW_V1",
  "COMPARISON_V1",
  "TIMELINE_V1",
  "DATA_PROOF_V1",
  "RISK_MATRIX_V1",
  "CONCLUSION_V1",
  "SCREEN_WITH_PERSON_PIP_V1",
  "PERSON_WITH_STRUCTURED_EMPHASIS_V1",
] as const;

export const SCENE_PATTERN_IMPLEMENTATION_KINDS_V1 = ["PATTERN", "CUSTOM_SCENE"] as const;
export const SCENE_CUSTOM_GROUP_KINDS_V1 = ["ROW", "COLUMN", "OVERLAY", "SEQUENCE"] as const;
export const SCENE_BINDING_TREATMENTS_V1 = ["PRESERVE", "COMPONENT"] as const;
export const SCENE_RENDERER_KINDS_V1 = ["DOM_CLASS", "REMOTION_REACT", "PRESERVE_SOURCE"] as const;
export const SCENE_CAPABILITY_AVAILABILITY_V1 = ["AVAILABLE", "BLOCKED"] as const;
export const SCENE_MOTION_INTENSITIES_V1 = ["SUBTLE", "STANDARD", "STRONG"] as const;
export const SCENE_COMPONENT_ADAPTER_VERSION_V1 = 1 as const;

// This is the renderer-coverage contract for the new deterministic adapter. It
// deliberately lists renderer identities (not component ids), so the catalog
// can make an unavailable adapter explicit instead of falling through to a
// generic base renderer.
export const SCENE_DETERMINISTIC_COMPONENT_RENDERER_IDS_V1 = Object.freeze([
  "component-stage-person-full",
  "component-stage-screen-main",
  "component-stage-evidence-main",
  "component-stage-detail-inset",
  "component-stage-person-pip-circle",
  "component-text-clean-card",
  "component-text-marker-underline",
  "component-text-context-label",
  "component-text-mini-explanation",
  "component-screen-smart-zoom-restore",
  "component-screen-spotlight-dim",
  "component-annotation-arrow",
  "component-annotation-circle",
  "component-annotation-callout",
  "component-annotation-cursor",
  "component-annotation-click-ripple",
  "component-evidence-clean-card",
  "component-evidence-source-label",
  "component-evidence-device-frame",
  "AreaChartCore",
  "ClockDialCore",
  "CreditsRollCore",
  "LoaderIndicatorCore",
  "MediaFrameCore",
  "RadialChartCore",
  ...COMPONENT_RUNTIME_DEFINITIONS.map((entry) => entry.rendererId),
] as const);

export const SCENE_PRESERVE_RENDERER_ID_V1 = "renderer:preserve-source-v1" as const;

export function sceneComponentRendererAdapterIdV1(
  rendererKind: "DOM_CLASS" | "REMOTION_REACT",
  rendererId: string,
): string {
  return `scene-adapter:v${SCENE_COMPONENT_ADAPTER_VERSION_V1}:${rendererKind}:${rendererId}`;
}

export function legacySceneComponentRendererAdapterHashV1(
  rendererKind: "DOM_CLASS" | "REMOTION_REACT",
  rendererId: string,
  implementationHash: string,
): string {
  return canonicalHash({
    adapterVersion: SCENE_COMPONENT_ADAPTER_VERSION_V1,
    rendererKind,
    sourceRendererId: rendererId,
    sourceImplementationHash: implementationHash,
  });
}

export function sceneComponentRendererAdapterHashV1(rendererKind:"DOM_CLASS"|"REMOTION_REACT",rendererId:string,implementationHash:string):string {
  return canonicalHash({sourceAdapterHash:legacySceneComponentRendererAdapterHashV1(rendererKind,rendererId,implementationHash),runtimeSourceHash:COMPONENT_RUNTIME_SOURCE_HASH});
}

/** Compatibility is limited to recorded runtimes of the same component implementation. */
export function isKnownSceneComponentRendererAdapterHashV1(
  rendererKind: "DOM_CLASS" | "REMOTION_REACT", rendererId: string,
  implementationHash: string, adapterHash: string,
): boolean {
  const sourceAdapterHash = legacySceneComponentRendererAdapterHashV1(rendererKind, rendererId, implementationHash);
  return adapterHash === sourceAdapterHash || [COMPONENT_RUNTIME_SOURCE_HASH, ...COMPONENT_RUNTIME_SOURCE_HISTORY]
    .some(runtimeSourceHash => adapterHash === canonicalHash({ sourceAdapterHash, runtimeSourceHash }));
}

export const SCENE_PRESERVE_RENDERER_ADAPTER_ID_V1 =
  `scene-adapter:v${SCENE_COMPONENT_ADAPTER_VERSION_V1}:PRESERVE_SOURCE:${SCENE_PRESERVE_RENDERER_ID_V1}`;
export const SCENE_PRESERVE_RENDERER_ADAPTER_HASH_V1 = canonicalHash({
  adapterVersion: SCENE_COMPONENT_ADAPTER_VERSION_V1,
  rendererKind: "PRESERVE_SOURCE",
  sourceRendererId: SCENE_PRESERVE_RENDERER_ID_V1,
  sourceImplementationHash: null,
});

export const scenePatternIdV1Schema = z.enum(SCENE_PATTERN_IDS_V1);
export const scenePatternImplementationKindV1Schema = z.enum(SCENE_PATTERN_IMPLEMENTATION_KINDS_V1);
export const sceneCustomGroupKindV1Schema = z.enum(SCENE_CUSTOM_GROUP_KINDS_V1);
export const sceneBindingTreatmentV1Schema = z.enum(SCENE_BINDING_TREATMENTS_V1);
export const sceneRendererKindV1Schema = z.enum(SCENE_RENDERER_KINDS_V1);
export const sceneCapabilityAvailabilityV1Schema = z.enum(SCENE_CAPABILITY_AVAILABILITY_V1);
export const sceneMotionIntensityV1Schema = z.enum(SCENE_MOTION_INTENSITIES_V1);

export const sceneProgramControlsV1Schema = z.object({
  intensityPermille: z.number().int().min(0).max(1_000),
  reducedMotion: z.boolean(),
  speedPermille: z.number().int().min(100).max(4_000).optional(),
}).strict();

export const sceneCapabilityCapacityV1Schema = z.object({
  minimumItems: z.number().int().nonnegative().max(1_024).nullable(),
  maximumItems: z.number().int().nonnegative().max(1_024).nullable(),
  maximumTextCharacters: z.number().int().positive().max(100_000).nullable(),
}).strict().superRefine((capacity, context) => {
  if (capacity.minimumItems !== null && capacity.maximumItems !== null
    && capacity.minimumItems > capacity.maximumItems) {
    context.addIssue({ code: "custom", path: ["minimumItems"], message: "scene capability capacity range is invalid" });
  }
});

const scenePatternCapabilitySemanticV1Schema = z.object({
  patternId: scenePatternIdV1Schema,
  label: shortTextSchema,
  purpose: compactTextSchema,
  recommendedInformationRelations: z.array(directorInformationRelationV1Schema).max(8),
  recommendedExpressionTasks: z.array(directorExpressionTaskV1Schema).max(12),
  acceptedObjectKinds: z.array(directorVisualObjectKindV1Schema).min(1).max(18),
  minimumObjects: z.number().int().positive().max(64),
  maximumObjects: z.number().int().positive().max(64),
  capacity: sceneCapabilityCapacityV1Schema,
  supportedOperations: z.array(directorSceneOperationV1Schema).min(1).max(5),
  supportedMotionReasons: z.array(directorMotionReasonV1Schema).min(1).max(8),
  rendererKind: z.enum(["DOM_CLASS", "REMOTION_REACT"]),
  rendererAdapterId: idSchema,
  rendererAdapterHash: hashSchema,
  lifecycle: z.literal("HOST_KNOWN"),
  availability: z.literal("AVAILABLE"),
}).strict().superRefine((card, context) => {
  for (const [path, values] of [
    ["recommendedInformationRelations", card.recommendedInformationRelations],
    ["recommendedExpressionTasks", card.recommendedExpressionTasks],
    ["acceptedObjectKinds", card.acceptedObjectKinds],
    ["supportedOperations", card.supportedOperations],
    ["supportedMotionReasons", card.supportedMotionReasons],
  ] as const) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [path], message: `${path} must be unique` });
  }
  if (card.minimumObjects > card.maximumObjects) {
    context.addIssue({ code: "custom", path: ["minimumObjects"], message: "pattern object cardinality is invalid" });
  }
  if (card.capacity.maximumItems !== null && card.capacity.maximumItems > 0 && card.capacity.maximumItems > card.maximumObjects) {
    context.addIssue({ code: "custom", path: ["capacity", "maximumItems"], message: "pattern item capacity cannot exceed object capacity" });
  }
});

export const scenePatternCapabilityV1Schema = scenePatternCapabilitySemanticV1Schema.extend({
  capabilityHash: hashSchema,
}).strict().superRefine((card, context) => {
  const { capabilityHash: _capabilityHash, ...semantic } = card;
  if (card.capabilityHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["capabilityHash"], message: "scene pattern capability hash must match canonical content" });
  }
});

export const sceneComponentCapabilityV1Schema = z.object({
  componentId: idSchema,
  componentHash: hashSchema,
  source: z.enum(["PILOT_PRIMITIVE", "NEW_CORE", "NEXT_CORE", "CATALOG_COMPLETION"]),
  sourceComponentId: idSchema,
  label: shortTextSchema,
  purpose: compactTextSchema,
  lifecycle: z.enum(["LAB_VERIFIED", "DRAFT"]),
  visibility: z.enum(["PROJECT_AUDITION_ONLY", "LAB_ONLY"]),
  /** Source lifecycle truth is retained even though all entries are discoverable in one Registry. */
  listedForDiscovery: z.literal(true),
  sourceAgentVisible: z.boolean(),
  productionReady: z.boolean(),
  targetObject: idSchema,
  recommendedInformationRelations: z.array(directorInformationRelationV1Schema).min(1).max(8),
  semanticSlots: z.array(z.object({
    slotId: idSchema,
    required: z.boolean(),
  }).strict()).max(64),
  requiredMaterialEvidence: z.array(idSchema).max(32),
  supportedStateChanges: z.array(directorSceneOperationV1Schema).min(1).max(5),
  motionPurpose: compactTextSchema,
  editableParameters: z.array(z.object({
    parameterId: idSchema,
    valueKind: z.enum(["NUMBER", "BOOLEAN", "STRING", "COLOR", "ENUM", "FRAME_COUNT", "JSON"]),
    minimum: z.number().nullable(),
    maximum: z.number().nullable(),
    defaultValue: z.json(),
    label: z.string().optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    description: z.string().optional(),
  }).strict()).max(64),
  defaultParameters: jsonObjectSchema,
  mount: z.enum(["OBJECT", "SCENE", "TRANSITION"]).optional(),
  preview: z.object({
    kind: z.enum(["REAL_PROJECT", "CONTROLLED_LAB"]),
    verified: z.boolean(),
    previewHash: hashSchema,
  }).strict(),
  provenance: z.object({
    implementationPath: z.string().min(1).max(1_000),
    exportName: idSchema,
    sourceIds: z.array(idSchema).max(128),
    version: z.string().min(1).max(64),
  }).strict(),
  selectionAuthority: z.enum(["HOST_LAYOUT_PROJECTION", "PROJECT_AGENT_EXPLICIT"]),
  rendererKind: z.enum(["DOM_CLASS", "REMOTION_REACT"]),
  rendererId: idSchema,
  implementationHash: hashSchema,
  fidelityPolicy: z.enum(["PRESERVE_SOURCE", "CONTAINER_ONLY", "DESIGNED_GRAPHIC", "SCENE_SURFACE", "BOUNDARY"]),
  compatibleGroupKinds: z.array(idSchema).max(14),
  compatibleObjectKinds: z.array(idSchema).max(13),
  compatibleRoles: z.array(z.enum(["MAIN", "SUPPORTING"])).max(2),
  compatiblePackagingPolicies: z.array(idSchema).max(4),
  allowedMotionReasons: z.array(idSchema).max(8),
  evidenceRequirements: z.array(idSchema).max(16),
  capacity: sceneCapabilityCapacityV1Schema,
  requiresExplicitSpatialAnchor: z.boolean(),
  projectAuditionEnabled: z.boolean(),
  globallyBlockedReasonCodes: z.array(idSchema).max(16),
  directorObjectKinds: z.array(directorVisualObjectKindV1Schema).max(18),
  directorRoles: z.array(z.enum(["MAIN", "SUPPORT", "INTERNAL"])).max(3),
  compatiblePackagingModes: z.array(directorPackagingModeV1Schema).max(5),
  rendererAdapterId: idSchema,
  rendererAdapterHash: hashSchema,
  availability: sceneCapabilityAvailabilityV1Schema,
  blockedReasonCodes: z.array(idSchema).max(16),
  capabilityHash: hashSchema,
}).strict().superRefine((entry, context) => {
  for (const [path, values] of [
    ["compatibleGroupKinds", entry.compatibleGroupKinds],
    ["compatibleObjectKinds", entry.compatibleObjectKinds],
    ["compatibleRoles", entry.compatibleRoles],
    ["compatiblePackagingPolicies", entry.compatiblePackagingPolicies],
    ["allowedMotionReasons", entry.allowedMotionReasons],
    ["evidenceRequirements", entry.evidenceRequirements],
    ["globallyBlockedReasonCodes", entry.globallyBlockedReasonCodes],
    ["directorObjectKinds", entry.directorObjectKinds],
    ["directorRoles", entry.directorRoles],
    ["compatiblePackagingModes", entry.compatiblePackagingModes],
    ["blockedReasonCodes", entry.blockedReasonCodes],
    ["recommendedInformationRelations", entry.recommendedInformationRelations],
    ["requiredMaterialEvidence", entry.requiredMaterialEvidence],
    ["supportedStateChanges", entry.supportedStateChanges],
  ] as const) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [path], message: `${path} must be unique` });
  }
  if (entry.availability === "AVAILABLE" && !entry.projectAuditionEnabled) {
    context.addIssue({ code: "custom", path: ["availability"], message: "available capability must be project-audition enabled" });
  }
  if (entry.availability === "BLOCKED" && entry.projectAuditionEnabled) {
    context.addIssue({ code: "custom", path: ["availability"], message: "blocked capability cannot be project-audition enabled" });
  }
  if (entry.availability === "BLOCKED" && entry.blockedReasonCodes.length === 0) {
    context.addIssue({ code: "custom", path: ["blockedReasonCodes"], message: "blocked capability requires a reason code" });
  }
  if (entry.blockedReasonCodes.join("\u0000") !== entry.globallyBlockedReasonCodes.join("\u0000")) {
    context.addIssue({ code: "custom", path: ["blockedReasonCodes"], message: "blocked reason projection must preserve catalog reason codes" });
  }
  if (!unique(entry.semanticSlots.map((slot) => slot.slotId)) || !unique(entry.editableParameters.map((parameter) => parameter.parameterId))) {
    context.addIssue({ code: "custom", path: ["semanticSlots"], message: "registry slots and parameter ids must be unique" });
  }
  const expectedAdapterId = sceneComponentRendererAdapterIdV1(entry.rendererKind, entry.rendererId);
  const expectedAdapterHash = sceneComponentRendererAdapterHashV1(entry.rendererKind, entry.rendererId, entry.implementationHash);
  if (entry.rendererAdapterId !== expectedAdapterId || entry.rendererAdapterHash !== expectedAdapterHash) {
    context.addIssue({ code: "custom", path: ["rendererAdapterId"], message: "component renderer adapter identity must bind the catalog renderer" });
  }
  const rendererImplemented = SCENE_DETERMINISTIC_COMPONENT_RENDERER_IDS_V1.includes(
    entry.rendererId as (typeof SCENE_DETERMINISTIC_COMPONENT_RENDERER_IDS_V1)[number],
  );
  if (entry.availability === "AVAILABLE" && !rendererImplemented) {
    context.addIssue({ code: "custom", path: ["availability"], message: "available component renderer lacks a deterministic Scene Program adapter" });
  }
  const capabilitySemantic = { ...entry } as Record<string, unknown>;
  delete capabilitySemantic.capabilityHash;
  if (entry.capabilityHash !== canonicalHash(capabilitySemantic)) {
    context.addIssue({ code: "custom", path: ["capabilityHash"], message: "component capability hash must match canonical content" });
  }
});

export const sceneCapabilityCatalogV1Schema = z.object({
  schemaVersion: z.literal(1),
  catalogId: idSchema,
  catalogHash: hashSchema,
  version: z.literal(1),
  aspect: z.literal("LANDSCAPE_16_9"),
  patternCatalogId: idSchema,
  sourceComponentCatalogHash: hashSchema,
  productionRegistryEntryCount: z.literal(0),
  hostRankingForbidden: z.literal(true),
  agentSelectionRequired: z.literal(true),
  patterns: z.array(scenePatternCapabilityV1Schema).length(SCENE_PATTERN_IDS_V1.length),
  components: z.array(sceneComponentCapabilityV1Schema).min(1).max(1024),
  customScene: z.object({
    enabled: z.literal(true),
    codeExecutionAllowed: z.literal(false),
    arbitraryStylesAllowed: z.literal(false),
    modelAuthoredFramesAllowed: z.literal(false),
    modelAuthoredSourcesAllowed: z.literal(false),
  }).strict(),
  invariantCodes: z.array(idSchema).min(1).max(64),
}).strict().superRefine((catalog, context) => {
  if (!unique(catalog.patterns.map((pattern) => pattern.patternId))
    || !unique(catalog.components.map((component) => component.componentId))
    || !unique(catalog.invariantCodes)) {
    context.addIssue({ code: "custom", path: [], message: "scene capability catalog identities must be unique" });
  }
  const { schemaVersion: _schemaVersion, catalogHash: _catalogHash, ...semantic } = catalog;
  if (catalog.catalogHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["catalogHash"], message: "scene capability catalog hash must match canonical content" });
  }
});

export const scenePatternCatalogV1Schema = sceneCapabilityCatalogV1Schema;

export const sceneCustomGroupV1Schema = z.object({
  groupId: idSchema,
  kind: sceneCustomGroupKindV1Schema,
  order: z.number().int().nonnegative().max(4_095),
  visualObjectIds: z.array(idSchema).min(1).max(64),
  relationship: compactTextSchema,
}).strict().superRefine((group, context) => {
  if (!unique(group.visualObjectIds)) {
    context.addIssue({ code: "custom", path: ["visualObjectIds"], message: "custom scene object ids must be unique within a group" });
  }
});

export const sceneCustomSceneV1Schema = z.object({
  groups: z.array(sceneCustomGroupV1Schema).min(1).max(64),
}).strict().superRefine((scene, context) => {
  if (!unique(scene.groups.map((group) => group.groupId))) {
    context.addIssue({ code: "custom", path: ["groups"], message: "custom scene group ids must be unique" });
  }
  if (scene.groups.some((group, index) => scene.groups.some((other, otherIndex) => index !== otherIndex && group.order === other.order))) {
    context.addIssue({ code: "custom", path: ["groups"], message: "custom scene group order must be unique" });
  }
});

export const sceneObjectBindingV1Schema = z.object({
  visualObjectId: idSchema,
  treatment: sceneBindingTreatmentV1Schema,
  componentId: idSchema.nullable(),
  rationale: compactTextSchema,
  motionReason: directorMotionReasonV1Schema,
  motionIntent: compactTextSchema,
  motionIntensity: sceneMotionIntensityV1Schema,
  parameters: jsonObjectSchema.optional(),
}).strict().superRefine((binding, context) => {
  if ((binding.treatment === "COMPONENT") !== (binding.componentId !== null)) {
    context.addIssue({ code: "custom", path: ["componentId"], message: "component treatment must bind one explicit component" });
  }
});

export const componentInstanceStyleV1Schema=z.object({
  foregroundColor:z.string().min(1).max(64).nullable().optional(),backgroundColor:z.string().min(1).max(64).nullable().optional(),fontFamily:z.string().min(1).max(256).nullable().optional(),
  fontSizePermille:z.number().int().min(250).max(3000).optional(),opacityPermille:z.number().int().min(0).max(1000).optional(),cornerRadiusPermille:z.number().int().min(0).max(500).optional(),
}).strict();

/** Explicit component additions share the same parameter contract for users and agents. */
export const sceneComponentSelectionV1Schema = z.object({
  instanceId: idSchema,
  componentId: idSchema,
  parameters: jsonObjectSchema,
  targetObjectIds: z.array(idSchema).max(16),
  style:componentInstanceStyleV1Schema.optional(),
  frame:z.object({xPermille:z.number().int().min(0).max(999),yPermille:z.number().int().min(0).max(999),widthPermille:z.number().int().min(1).max(1000),heightPermille:z.number().int().min(1).max(1000)}).strict().optional(),
  activeFrameRange:frameRangeSchema.optional(),
  zIndex:z.number().int().min(0).max(999).optional(),
  speedPermille:z.number().int().min(100).max(4000).optional(),
}).strict();

export const sceneComponentInstanceV1Schema = sceneComponentSelectionV1Schema.extend({
  componentHash: hashSchema,
  rendererAdapterHash: hashSchema,
  frame: z.object({
    xPermille: z.number().int().min(0).max(999), yPermille: z.number().int().min(0).max(999),
    widthPermille: z.number().int().min(1).max(1000), heightPermille: z.number().int().min(1).max(1000),
  }).strict(),
  activeFrameRange: frameRangeSchema,
  zIndex: z.number().int().min(0).max(999),
  speedPermille: z.number().int().min(100).max(4000),
  userLocked: z.boolean(),
  timingLocked: z.boolean().optional(),
}).strict().superRefine((instance, context) => {
  if (!unique(instance.targetObjectIds)) context.addIssue({code: "custom", path: ["targetObjectIds"], message: "component targets must be unique"});
  if (instance.frame.xPermille + instance.frame.widthPermille > 1000 || instance.frame.yPermille + instance.frame.heightPermille > 1000)
    context.addIssue({code: "custom", path: ["frame"], message: "component frame must remain inside canvas"});
});
export type SceneComponentInstanceV1 = z.infer<typeof sceneComponentInstanceV1Schema>;

export const sceneImplementationParagraphSubmissionV1Schema = z.object({
  paragraphId: idSchema,
  motion: sceneMotionDraftSchema.optional(),
  modules: z.array(sceneModuleDraftSchema).max(8).optional(),
  implementation: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("PATTERN"), patternId: scenePatternIdV1Schema }).strict(),
    z.object({ kind: z.literal("CUSTOM_SCENE"), customScene: sceneCustomSceneV1Schema }).strict(),
  ]),
  objectBindings: z.array(sceneObjectBindingV1Schema).min(1).max(64),
  componentInstances: z.array(sceneComponentSelectionV1Schema).max(64).optional(),
}).strict().superRefine((paragraph, context) => {
  if (paragraph.modules?.length && !paragraph.motion) context.addIssue({code:"custom",path:["modules"],message:"SceneModules require speech motion"});
  if (!unique((paragraph.modules ?? []).map(module=>module.moduleId))) context.addIssue({code:"custom",path:["modules"],message:"Module identities must be unique"});
  if (!unique((paragraph.componentInstances ?? []).map(instance => instance.instanceId))) context.addIssue({code:"custom",path:["componentInstances"],message:"component instance identities must be unique"});
  if (!unique(paragraph.objectBindings.map((binding) => binding.visualObjectId))) {
    context.addIssue({ code: "custom", path: ["objectBindings"], message: "scene object bindings must be unique" });
  }
});

const sceneImplementationPlanSemanticV1Schema = z.object({
  schemaVersion: z.literal(1),
  submissionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  creativePlanId: idSchema,
  creativePlanHash: hashSchema,
  layoutCutId: idSchema,
  layoutCutHash: hashSchema,
  layoutConfirmationVersionId: idSchema,
  layoutConfirmationVersionHash: hashSchema,
  paragraphs: z.array(sceneImplementationParagraphSubmissionV1Schema).min(1).max(512),
  createdByTurnId: idSchema,
  submittedAt: isoInstantSchema,
}).strict().superRefine((plan, context) => {
  if (!unique(plan.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "scene implementation paragraph ids must be unique" });
  }
});

export const sceneImplementationPlanV1Schema = sceneImplementationPlanSemanticV1Schema.extend({
  planId: idSchema,
  planHash: hashSchema,
}).strict().superRefine((plan, context) => {
  const { planHash: _planHash, ...semantic } = plan;
  if (plan.planHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["planHash"], message: "scene implementation plan hash must match canonical content" });
  }
});

export const submitSceneImplementationPlanV1RequestSchema = sceneImplementationPlanSemanticV1Schema;

export const sceneProgramMediaTimingV1Schema = z.object({
  clipId: idSchema,
  assetId: idSchema,
  clipTimelineFrameRange: frameRangeSchema,
  timelineFrameRange: frameRangeSchema,
  sourceRange: millisecondRangeSchema,
  playbackRate: positiveRationalSchema,
  playbackDirection: z.enum(["forward", "reverse"]),
}).strict().superRefine((timing, context) => {
  if (timing.timelineFrameRange.startFrame < timing.clipTimelineFrameRange.startFrame
    || timing.timelineFrameRange.endFrame > timing.clipTimelineFrameRange.endFrame) {
    context.addIssue({ code: "custom", path: ["timelineFrameRange"], message: "media timing intersection must remain within its source clip range" });
  }
});

export const sceneProgramSourceV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("MEDIA"),
    assetIds: z.array(idSchema).min(1).max(16),
    clipTimings: z.array(sceneProgramMediaTimingV1Schema).max(64),
  }).strict().superRefine((source, context) => {
    if (!unique(source.assetIds)) context.addIssue({ code: "custom", path: ["assetIds"], message: "media source asset ids must be unique" });
    if (!unique(source.clipTimings.map((timing) => timing.clipId))) context.addIssue({ code: "custom", path: ["clipTimings"], message: "media timing clip ids must be unique" });
    source.clipTimings.forEach((timing, index) => {
      if (!source.assetIds.includes(timing.assetId)) {
        context.addIssue({ code: "custom", path: ["clipTimings", index, "assetId"], message: "media timing asset must be bound by the source" });
      }
    });
  }),
  z.object({ kind: z.literal("TRANSCRIPT"), wordIds: z.array(idSchema).min(1).max(256) }).strict(),
  z.object({ kind: z.literal("CONSTRUCTED"), evidenceWordIds: z.array(idSchema).max(256) }).strict(),
]);

export const sceneProgramBindingV1Schema = z.object({
  treatment: sceneBindingTreatmentV1Schema,
  componentId: idSchema.nullable(),
  componentHash: hashSchema.nullable(),
  rendererKind: sceneRendererKindV1Schema,
  rendererId: idSchema,
  rendererAdapterId: idSchema,
  rendererAdapterHash: hashSchema,
  implementationHash: hashSchema.nullable(),
  motionIntensity: sceneMotionIntensityV1Schema,
  controls: sceneProgramControlsV1Schema,
  resolvedInput: jsonObjectSchema,
  parameters: jsonObjectSchema.optional(),
  rationale: compactTextSchema,
  motionReason: directorMotionReasonV1Schema,
  motionIntent: compactTextSchema,
}).strict().superRefine((binding, context) => {
  const selected = binding.treatment === "COMPONENT";
  if (selected !== (binding.componentId !== null && binding.componentHash !== null && binding.implementationHash !== null)) {
    context.addIssue({ code: "custom", path: [], message: "compiled component binding fields are incomplete" });
  }
  if (!selected && binding.rendererKind !== "PRESERVE_SOURCE") {
    context.addIssue({ code: "custom", path: ["rendererKind"], message: "preserved source must use the preserve renderer" });
  }
  if (!selected && (binding.componentId !== null || binding.componentHash !== null || binding.implementationHash !== null)) {
    context.addIssue({ code: "custom", path: ["componentId"], message: "preserved source cannot carry component identity or implementation metadata" });
  }
  if (!selected && (binding.rendererId !== SCENE_PRESERVE_RENDERER_ID_V1
    || binding.rendererAdapterId !== SCENE_PRESERVE_RENDERER_ADAPTER_ID_V1
    || binding.rendererAdapterHash !== SCENE_PRESERVE_RENDERER_ADAPTER_HASH_V1
    || binding.implementationHash !== null)) {
    context.addIssue({ code: "custom", path: ["rendererAdapterId"], message: "preserved source renderer adapter identity is invalid" });
  }
  if (selected && binding.rendererKind === "PRESERVE_SOURCE") {
    context.addIssue({ code: "custom", path: ["rendererKind"], message: "selected components must use a deterministic DOM_CLASS or REMOTION_REACT adapter" });
  }
  if (selected && binding.rendererKind !== "PRESERVE_SOURCE") {
    const expectedId = sceneComponentRendererAdapterIdV1(binding.rendererKind, binding.rendererId);
    // Stored programs survive verified runtime upgrades; compilation still uses the current identity.
    const knownAdapter = binding.implementationHash !== null && isKnownSceneComponentRendererAdapterHashV1(
      binding.rendererKind, binding.rendererId, binding.implementationHash, binding.rendererAdapterHash);
    if (binding.rendererAdapterId !== expectedId || !knownAdapter) {
      context.addIssue({ code: "custom", path: ["rendererAdapterId"], message: "compiled component adapter identity does not bind its source renderer" });
    }
  }
});

export const sceneProgramObjectV1Schema = z.object({
  visualObjectId: idSchema,
  role: z.enum(["MAIN", "SUPPORT", "INTERNAL"]),
  objectClass: directorObjectClassV1Schema,
  kind: directorVisualObjectKindV1Schema,
  informationDuty: compactTextSchema,
  textRole: z.string().min(1).max(64),
  text: z.string().max(2_000).nullable(),
  source: sceneProgramSourceV1Schema,
  packagingMode: directorPackagingModeV1Schema,
  childObjectIds: z.array(idSchema).max(32),
  frame: z.object({
    xPermille: z.number().int().min(0).max(999),
    yPermille: z.number().int().min(0).max(999),
    widthPermille: z.number().int().min(1).max(1_000),
    heightPermille: z.number().int().min(1).max(1_000),
  }).strict(),
  crop: z.object({
    xPermille: z.number().int().min(0).max(999),
    yPermille: z.number().int().min(0).max(999),
    widthPermille: z.number().int().min(1).max(1_000),
    heightPermille: z.number().int().min(1).max(1_000),
  }).strict().optional(),
  zIndex: z.number().int().min(0).max(999),
  alignment: z.enum(["FILL", "CENTER", "TOP", "BOTTOM", "LEFT", "RIGHT"]),
  personTreatment: z.enum(["NONE", "FULL_FRAME", "RECTANGULAR_PIP", "CIRCULAR_PIP"]),
  readingOrder: z.number().int().nonnegative().max(63),
  binding: sceneProgramBindingV1Schema,
  stateFrameIds: z.array(idSchema).max(24),
  activeFrameRange: frameRangeSchema.optional(),
  style: z.object({
    foregroundColor: z.string().min(1).max(64).nullable(),
    backgroundColor: z.string().min(1).max(64).nullable(),
    fontFamily: z.string().min(1).max(256).nullable(),
    fontSizePermille: z.number().int().min(250).max(3_000),
    opacityPermille: z.number().int().min(0).max(1_000),
    cornerRadiusPermille: z.number().int().min(0).max(500),
  }).strict().optional(),
  userLocks: z.array(z.enum(["TEXT", "FRAME", "CROP", "STYLE", "TIMING", "LAYER", "COMPONENT", "MOTION"])).max(8).optional(),
}).strict().superRefine((object, context) => {
  if (object.frame.xPermille + object.frame.widthPermille > 1_000
    || object.frame.yPermille + object.frame.heightPermille > 1_000) {
    context.addIssue({ code: "custom", path: ["frame"], message: "compiled object frame must remain inside the canvas" });
  }
  if (!unique(object.childObjectIds) || object.childObjectIds.includes(object.visualObjectId)) {
    context.addIssue({ code: "custom", path: ["childObjectIds"], message: "compiled child object ids must be unique and local" });
  }
  if (object.crop !== undefined && (object.crop.xPermille + object.crop.widthPermille > 1_000
    || object.crop.yPermille + object.crop.heightPermille > 1_000)) {
    context.addIssue({ code: "custom", path: ["crop"], message: "compiled object crop must remain inside the source" });
  }
  if (object.activeFrameRange !== undefined && object.activeFrameRange.endFrame <= object.activeFrameRange.startFrame) {
    context.addIssue({ code: "custom", path: ["activeFrameRange"], message: "object active frame range must be positive" });
  }
  if (object.userLocks !== undefined && !unique(object.userLocks)) {
    context.addIssue({ code: "custom", path: ["userLocks"], message: "object user locks must be unique" });
  }
});

export const sceneProgramStateV1Schema = z.object({
  stateId: idSchema,
  anchorWordId: idSchema,
  frame: z.number().int().nonnegative(),
  operation: directorSceneOperationV1Schema,
  targetObjectIds: z.array(idSchema).min(1).max(32),
  purpose: compactTextSchema,
}).strict().superRefine((state, context) => {
  if (!unique(state.targetObjectIds)) {
    context.addIssue({ code: "custom", path: ["targetObjectIds"], message: "compiled state target ids must be unique" });
  }
});

export const sceneProgramParagraphV1Schema = z.object({
  paragraphId: idSchema,
  motion: compiledSceneMotionSchema.optional(),
  modules: z.array(sceneModuleManifestSchema).max(8).optional(),
  order: z.number().int().nonnegative().max(511),
  frameRange: frameRangeSchema,
  transcriptText: z.string().min(1).max(100_000),
  expressionTask: directorExpressionTaskV1Schema,
  informationRelation: directorInformationRelationV1Schema,
  implementation: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("PATTERN"),
      patternId: scenePatternIdV1Schema,
      patternCapabilityHash: hashSchema,
    }).strict(),
    z.object({
      kind: z.literal("CUSTOM_SCENE"),
      groups: z.array(sceneCustomGroupV1Schema).min(1).max(64),
      customSceneHash: hashSchema,
    }).strict(),
  ]),
  objects: z.array(sceneProgramObjectV1Schema).min(1).max(64),
  componentInstances: z.array(sceneComponentInstanceV1Schema).max(64).optional(),
  states: z.array(sceneProgramStateV1Schema).min(1).max(24),
  readingOrderObjectIds: z.array(idSchema).min(1).max(64),
  layoutSafeRegion: z.object({
    xPermille: z.number().int().min(0).max(999),
    yPermille: z.number().int().min(0).max(999),
    widthPermille: z.number().int().min(1).max(1_000),
    heightPermille: z.number().int().min(1).max(1_000),
  }).strict(),
  captionExclusionRegion: z.object({
    xPermille: z.number().int().min(0).max(999),
    yPermille: z.number().int().min(0).max(999),
    widthPermille: z.number().int().min(1).max(1_000),
    heightPermille: z.number().int().min(1).max(1_000),
  }).strict(),
}).strict().superRefine((paragraph, context) => {
  const objectIds = paragraph.objects.map((object) => object.visualObjectId);
  if (!unique(objectIds) || !unique(paragraph.readingOrderObjectIds)
    || paragraph.readingOrderObjectIds.some((id) => !objectIds.includes(id))
    || paragraph.states.some((state) => state.targetObjectIds.some((id) => !objectIds.includes(id)))) {
    context.addIssue({ code: "custom", path: ["objects"], message: "compiled paragraph references must resolve locally" });
  }
  if (paragraph.layoutSafeRegion.xPermille + paragraph.layoutSafeRegion.widthPermille > 1_000
    || paragraph.layoutSafeRegion.yPermille + paragraph.layoutSafeRegion.heightPermille > 1_000
    || paragraph.captionExclusionRegion.xPermille + paragraph.captionExclusionRegion.widthPermille > 1_000
    || paragraph.captionExclusionRegion.yPermille + paragraph.captionExclusionRegion.heightPermille > 1_000) {
    context.addIssue({ code: "custom", path: [], message: "compiled paragraph regions must remain inside the canvas" });
  }
});

const sceneProgramSemanticV1Schema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  programId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  creativePlanId: idSchema,
  creativePlanHash: hashSchema,
  layoutCutId: idSchema,
  layoutCutHash: hashSchema,
  layoutConfirmationVersionId: idSchema,
  layoutConfirmationVersionHash: hashSchema,
  implementationPlanId: idSchema,
  implementationPlanHash: hashSchema,
  canvas: z.object({
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
    framesPerSecond: z.number().positive().max(1_000),
  }).strict(),
  designSystem: projectDesignSystemV1Schema,
  paragraphs: z.array(sceneProgramParagraphV1Schema).min(1).max(512),
  generatedAt: isoInstantSchema,
  /** Present on locally edited effective programs; absent on the immutable AI-compiled base. */
  baseProgramHash: hashSchema.optional(),
  editRevision: z.number().int().nonnegative().optional(),
  userEditHash: hashSchema.optional(),
  timelineModified: z.literal(false),
}).strict();

export const sceneProgramV1Schema = sceneProgramSemanticV1Schema.extend({
  programHash: hashSchema,
}).strict().superRefine((program, context) => {
  program.paragraphs.forEach((paragraph,index)=>{
    if (paragraph.modules?.length && !paragraph.motion) context.addIssue({code:"custom",path:["paragraphs",index,"modules"],message:"SceneModules require speech motion"});
    if (!unique((paragraph.modules??[]).map(module=>module.moduleId))) context.addIssue({code:"custom",path:["paragraphs",index,"modules"],message:"Duplicate modules"});
    if (!paragraph.motion) return;
    try {assertCompiledSceneMotion(paragraph.motion,[...paragraph.objects.map(object=>object.visualObjectId),...(paragraph.componentInstances??[]).map(instance=>instance.instanceId)],paragraph.frameRange);}
    catch(error){context.addIssue({code:"custom",path:["paragraphs",index,"motion"],message:error instanceof Error?error.message:"Invalid persisted scene motion"});}
  });
  if ((program.schemaVersion === 2) !== program.paragraphs.some(paragraph => paragraph.motion !== undefined)) {
    context.addIssue({ code: "custom", path: ["schemaVersion"], message: "speech motion requires Scene Program v2; legacy programs retain v1 interpretation" });
  }
  if (!unique(program.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "scene program paragraph ids must be unique" });
  }
  const { programHash: _programHash, ...semantic } = program;
  if (program.programHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["programHash"], message: "scene program hash must match canonical content" });
  }
});

/** The historical reader name accepts both persisted formats. */
export const sceneProgramV2Schema = sceneProgramV1Schema.refine(program => program.schemaVersion === 2, "Scene Program v2 required");
export type SceneProgramV2 = z.infer<typeof sceneProgramV2Schema> & { schemaVersion: 2 };

const componentPresentationSchema = z.object({
  style:componentInstanceStyleV1Schema.nullable().optional(),
  frame: z.object({xPermille:z.number().int().min(0).max(999),yPermille:z.number().int().min(0).max(999),widthPermille:z.number().int().min(1).max(1000),heightPermille:z.number().int().min(1).max(1000)}).strict(),
  activeFrameRange:frameRangeSchema,
  speedPermille:z.number().int().min(100).max(4000),
  zIndex:z.number().int().min(0).max(999),
}).strict();

export const sceneProgramPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  currentPlanId: idSchema.nullable(),
  plans: z.array(sceneImplementationPlanV1Schema).max(256),
  programs: z.array(sceneProgramV1Schema).max(256),
  editHistories: z.array(z.object({
    baseProgramId: idSchema,
    baseProgramHash: hashSchema,
    edits: z.array(z.object({
      editId: idSchema,
      paragraphId: idSchema,
      visualObjectId: idSchema,
      change: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("SET_TEXT"), text: z.string().trim().min(1).max(2_000) }).strict(),
        z.object({ kind: z.literal("SET_FRAME"), frame: z.object({ xPermille: z.number().int().min(0).max(999), yPermille: z.number().int().min(0).max(999), widthPermille: z.number().int().min(1).max(1_000), heightPermille: z.number().int().min(1).max(1_000) }).strict() }).strict(),
        z.object({ kind: z.literal("SET_CROP"), crop: z.object({ xPermille: z.number().int().min(0).max(999), yPermille: z.number().int().min(0).max(999), widthPermille: z.number().int().min(1).max(1_000), heightPermille: z.number().int().min(1).max(1_000) }).strict() }).strict(),
        z.object({ kind: z.literal("SET_STYLE"), style: z.object({ foregroundColor: z.string().min(1).max(64).nullable(), backgroundColor: z.string().min(1).max(64).nullable(), fontFamily: z.string().min(1).max(256).nullable(), fontSizePermille: z.number().int().min(250).max(3_000), opacityPermille: z.number().int().min(0).max(1_000), cornerRadiusPermille: z.number().int().min(0).max(500) }).strict() }).strict(),
        z.object({ kind: z.literal("SET_MOTION_SPEED"), speedPermille: z.number().int().min(100).max(4_000) }).strict(),
        z.object({ kind: z.literal("SET_TIMING"), activeFrameRange: frameRangeSchema }).strict(),
        z.object({ kind: z.literal("SET_Z_INDEX"), zIndex: z.number().int().min(0).max(999) }).strict(),
        z.object({ kind: z.literal("SWAP_COMPONENT"), componentId: idSchema, presentation:componentPresentationSchema.optional(), parameters: jsonObjectSchema.optional() }).strict(),
        z.object({kind:z.literal("SET_MODULE_PARAMETERS"),parameters:sceneModuleParametersSchema}).strict(),
        z.object({ kind: z.literal("SET_COMPONENT_PARAMETERS"), presentation:componentPresentationSchema.optional(), parameters: jsonObjectSchema }).strict(),
        z.object({ kind: z.literal("UPSERT_COMPONENT_INSTANCE"), instance: sceneComponentInstanceV1Schema }).strict(),
        z.object({ kind: z.literal("REMOVE_COMPONENT_INSTANCE") }).strict(),
        z.object({ kind: z.literal("DISABLE_PACKAGING") }).strict(),
        z.object({ kind: z.literal("RESET_OBJECT") }).strict(),
      ]),
      editedAt: isoInstantSchema,
      editHash: hashSchema,
    }).strict()).max(4_096),
    cursor: z.number().int().nonnegative().max(4_096),
    ignoredWarningIds: z.array(idSchema).max(1_024),
    actions: z.array(z.object({ actionId: idSchema, kind: z.enum(["UNDO", "REDO", "IGNORE_WARNING", "RESTORE_WARNING"]), targetId: idSchema.nullable(), resultingCursor: z.number().int().nonnegative() }).strict()).max(4_096),
  }).strict()).max(256).default([]),
}).strict().superRefine((state, context) => {
  if (!unique(state.plans.map((plan) => plan.planId)) || !unique(state.programs.map((program) => program.programId))) {
    context.addIssue({ code: "custom", path: [], message: "scene program persistent identities must be unique" });
  }
  if (state.currentPlanId !== null && !state.plans.some((plan) => plan.planId === state.currentPlanId)) {
    context.addIssue({ code: "custom", path: ["currentPlanId"], message: "current scene implementation plan must exist" });
  }
  if (!unique(state.editHistories.map((history) => `${history.baseProgramId}\u0000${history.baseProgramHash}`))) {
    context.addIssue({ code: "custom", path: ["editHistories"], message: "scene edit history identities must be unique" });
  }
  for (const history of state.editHistories) {
    if (history.cursor > history.edits.length
      || !unique(history.edits.map((edit) => edit.editId))
      || !unique(history.actions.map((action) => action.actionId))
      || history.actions.some((action) => history.edits.some((edit) => edit.editId === action.actionId))
      || !unique(history.ignoredWarningIds)) {
      context.addIssue({ code: "custom", path: ["editHistories"], message: "scene edit history cursor and identities must be valid" });
    }
    for (const edit of history.edits) {
      const { editHash: _editHash, ...semantic } = edit;
      if (edit.editHash !== canonicalHash(semantic)) context.addIssue({ code: "custom", path: ["editHistories"], message: "scene edit hash must match canonical content" });
    }
  }
});

export const sceneProgramEditControlV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SET_TEXT"), text: z.string().trim().min(1).max(2_000) }).strict(),
  z.object({ kind: z.literal("SET_FRAME"), frame: z.object({ xPermille: z.number().int().min(0).max(999), yPermille: z.number().int().min(0).max(999), widthPermille: z.number().int().min(1).max(1_000), heightPermille: z.number().int().min(1).max(1_000) }).strict() }).strict(),
  z.object({ kind: z.literal("SET_CROP"), crop: z.object({ xPermille: z.number().int().min(0).max(999), yPermille: z.number().int().min(0).max(999), widthPermille: z.number().int().min(1).max(1_000), heightPermille: z.number().int().min(1).max(1_000) }).strict() }).strict(),
  z.object({ kind: z.literal("SET_STYLE"), style: z.object({ foregroundColor: z.string().min(1).max(64).nullable(), backgroundColor: z.string().min(1).max(64).nullable(), fontFamily: z.string().min(1).max(256).nullable(), fontSizePermille: z.number().int().min(250).max(3_000), opacityPermille: z.number().int().min(0).max(1_000), cornerRadiusPermille: z.number().int().min(0).max(500) }).strict() }).strict(),
  z.object({ kind: z.literal("SET_MOTION_SPEED"), speedPermille: z.number().int().min(100).max(4_000) }).strict(),
  z.object({ kind: z.literal("SET_TIMING"), activeFrameRange: frameRangeSchema }).strict(),
  z.object({ kind: z.literal("SET_Z_INDEX"), zIndex: z.number().int().min(0).max(999) }).strict(),
  z.object({ kind: z.literal("SWAP_COMPONENT"), componentId: idSchema, presentation:componentPresentationSchema.optional(), parameters: jsonObjectSchema.optional() }).strict(),
        z.object({kind:z.literal("SET_MODULE_PARAMETERS"),parameters:sceneModuleParametersSchema}).strict(),
        z.object({ kind: z.literal("SET_COMPONENT_PARAMETERS"), presentation:componentPresentationSchema.optional(), parameters: jsonObjectSchema }).strict(),
        z.object({ kind: z.literal("UPSERT_COMPONENT_INSTANCE"), instance: sceneComponentInstanceV1Schema }).strict(),
        z.object({ kind: z.literal("REMOVE_COMPONENT_INSTANCE") }).strict(),
  z.object({ kind: z.literal("DISABLE_PACKAGING") }).strict(),
  z.object({ kind: z.literal("RESET_OBJECT") }).strict(),
  z.object({ kind: z.literal("UNDO") }).strict(),
  z.object({ kind: z.literal("REDO") }).strict(),
  z.object({ kind: z.literal("IGNORE_WARNING"), warningId: idSchema }).strict(),
  z.object({ kind: z.literal("RESTORE_WARNING"), warningId: idSchema }).strict(),
]);

export const applySceneProgramEditV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  expectedTimelineHash: hashSchema,
  sceneProgramId: idSchema,
  sceneProgramHash: hashSchema,
  paragraphId: idSchema.nullable(),
  visualObjectId: idSchema.nullable(),
  editId: idSchema,
  change: sceneProgramEditControlV1Schema,
  editedAt: isoInstantSchema,
}).strict().superRefine((request, context) => {
  const objectChange = !["UNDO", "REDO", "IGNORE_WARNING", "RESTORE_WARNING"].includes(request.change.kind);
  if (objectChange && (request.paragraphId === null || request.visualObjectId === null)) {
    context.addIssue({ code: "custom", path: ["visualObjectId"], message: "object edit requires paragraphId and visualObjectId" });
  }
  if (!objectChange && (request.paragraphId !== null || request.visualObjectId !== null)) {
    context.addIssue({ code: "custom", path: ["paragraphId"], message: "history and warning controls must not target an object" });
  }
});

export const sceneProgramLintDiagnosticV1Schema = z.object({
  diagnosticId: idSchema,
  code: z.enum(["MISSING_SOURCE", "TIMING_OUT_OF_BOUNDS", "TEXT_CAPACITY_EXCEEDED", "RENDERER_MISSING", "PARAMETERS_INVALID", "CAPTION_SAFE_ZONE_COLLISION", "STALE_BINDING", "MAIN_MONOTONY", "REPEATED_LAYOUT", "MISSED_INFORMATION_SCENE", "TOO_MANY_OBJECTS", "DENSITY_ANOMALY", "NO_VISUAL_CHANGE", "MAIN_SUPPORT_COMPETITION", "COMPONENT_OVERUSE"]),
  severity: z.enum(["HARD_ERROR", "CREATIVE_WARNING"]),
  paragraphId: idSchema.nullable(),
  visualObjectId: idSchema.nullable(),
  message: z.string().min(1).max(2_000),
  status: z.enum(["ACTIVE", "IGNORED"]),
}).strict();

export const sceneProgramEditingStateV1Schema = z.object({
  baseProgramHash: hashSchema.nullable(),
  editRevision: z.number().int().nonnegative(),
  canUndo: z.boolean(),
  canRedo: z.boolean(),
  ignoredWarningIds: z.array(idSchema).max(1_024),
  diagnostics: z.array(sceneProgramLintDiagnosticV1Schema).max(512),
  componentCandidates: z.array(z.object({
    paragraphId: idSchema,
    visualObjectId: idSchema,
    componentIds: z.array(idSchema).max(1024),
  }).strict()).max(32_768),
}).strict();

export const sceneProgramSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  capabilities: sceneCapabilityCatalogV1Schema,
  implementationPlan: sceneImplementationPlanV1Schema.nullable(),
  sceneProgram: sceneProgramV1Schema.nullable(),
  readiness: z.object({
    code: z.enum([
      "ROUGH_CUT_REQUIRED",
      "CREATIVE_PLAN_REQUIRED",
      "LAYOUT_CUT_REQUIRED",
      "LAYOUT_CUT_CONFIRMATION_REQUIRED",
      "IMPLEMENTATION_PLAN_REQUIRED",
      "IMPLEMENTATION_PLAN_STALE",
      "SCENE_PROGRAM_READY",
      "SCENE_PROGRAM_STALE",
    ]),
    message: compactTextSchema,
  }).strict(),
  editing: sceneProgramEditingStateV1Schema.default({ baseProgramHash: null, editRevision: 0, canUndo: false, canRedo: false, ignoredWarningIds: [], diagnostics: [], componentCandidates: [] }),
  timelineModified: z.literal(false),
}).strict();

export type ScenePatternIdV1 = z.infer<typeof scenePatternIdV1Schema>;
export type DirectorMotionReasonV1 = z.infer<typeof directorMotionReasonV1Schema>;
export type DirectorObjectClassV1 = z.infer<typeof directorObjectClassV1Schema>;
export type DirectorPackagingModeV1 = z.infer<typeof directorPackagingModeV1Schema>;
export type DirectorVisualObjectKindV1 = z.infer<typeof directorVisualObjectKindV1Schema>;
export type ScenePatternCapabilityV1 = z.infer<typeof scenePatternCapabilityV1Schema>;
export type SceneComponentCapabilityV1 = z.infer<typeof sceneComponentCapabilityV1Schema>;
export type SceneCapabilityCatalogV1 = z.infer<typeof sceneCapabilityCatalogV1Schema>;
export type ScenePatternCatalogV1 = z.infer<typeof scenePatternCatalogV1Schema>;
export type SceneCustomGroupV1 = z.infer<typeof sceneCustomGroupV1Schema>;
export type SceneCustomSceneV1 = z.infer<typeof sceneCustomSceneV1Schema>;
export type SceneObjectBindingV1 = z.infer<typeof sceneObjectBindingV1Schema>;
export type SceneImplementationParagraphSubmissionV1 = z.infer<typeof sceneImplementationParagraphSubmissionV1Schema>;
export type SceneImplementationPlanV1 = z.infer<typeof sceneImplementationPlanV1Schema>;
export type SubmitSceneImplementationPlanV1Request = z.infer<typeof submitSceneImplementationPlanV1RequestSchema>;
export type SceneProgramSourceV1 = z.infer<typeof sceneProgramSourceV1Schema>;
export type SceneProgramMediaTimingV1 = z.infer<typeof sceneProgramMediaTimingV1Schema>;
export type SceneMotionIntensityV1 = z.infer<typeof sceneMotionIntensityV1Schema>;
export type SceneProgramControlsV1 = z.infer<typeof sceneProgramControlsV1Schema>;
export type SceneProgramBindingV1 = z.infer<typeof sceneProgramBindingV1Schema>;
export type SceneProgramObjectV1 = z.infer<typeof sceneProgramObjectV1Schema>;
export type SceneProgramStateV1 = z.infer<typeof sceneProgramStateV1Schema>;
export type SceneProgramParagraphV1 = z.infer<typeof sceneProgramParagraphV1Schema>;
export type SceneProgramV1 = z.infer<typeof sceneProgramV1Schema>;
export type SceneProgramPersistentStateV1 = z.infer<typeof sceneProgramPersistentStateV1Schema>;
export type SceneProgramSnapshotV1 = z.infer<typeof sceneProgramSnapshotV1Schema>;
export type ApplySceneProgramEditV1Request = z.infer<typeof applySceneProgramEditV1RequestSchema>;
export type SceneProgramEditControlV1 = z.infer<typeof sceneProgramEditControlV1Schema>;
export type SceneProgramLintDiagnosticV1 = z.infer<typeof sceneProgramLintDiagnosticV1Schema>;
export type SceneProgramEditingStateV1 = z.infer<typeof sceneProgramEditingStateV1Schema>;

export function sceneImplementationPlanV1Hash(plan: unknown): string {
  return canonicalHash(plan);
}

export function sceneProgramV1Hash(program: unknown): string {
  return canonicalHash(program);
}

export function scenePatternCapabilityV1Hash(capability: unknown): string {
  return canonicalHash(capability);
}

export function sceneComponentCapabilityV1Hash(capability: unknown): string {
  return canonicalHash(capability);
}

export function sceneCustomSceneV1Hash(scene: unknown): string {
  return canonicalHash(scene);
}

// Kept as a type-only helper for renderer consumers that need to preserve the
// exact upstream shape without allowing model-authored geometry or sources.
export type SceneProgramLayoutInputV1 = LayoutCutV1;
export type SceneProgramLayoutObjectInputV1 = LayoutCutObjectV1;
export const sceneProgramLayoutInputV1Schema = layoutCutV1Schema;
export const sceneProgramLayoutObjectInputV1Schema = layoutCutObjectV1Schema;
