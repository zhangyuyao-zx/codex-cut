import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  frameRangeSchema,
  hashSchema,
  idSchema,
  isoInstantSchema,
} from "../shared/timeline-v2/schema.js";
import { layoutSlotIdV1Schema, layoutVariantIdV1Schema } from "./layout-contract.js";

const compactTextSchema = z.string().trim().min(1).max(1_000);
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

export const DIRECTOR_PREVIEW_KINDS = ["ROUGH_CUT", "LAYOUT_CUT", "PACKAGED_CUT"] as const;
export const directorPreviewKindV1Schema = z.enum(DIRECTOR_PREVIEW_KINDS);

export const DIRECTOR_EXPRESSION_TASKS = [
  "VIEWPOINT",
  "DEFINITION",
  "EXPLANATION",
  "PROCESS",
  "OPERATION_DEMO",
  "COMPARISON",
  "DATA_PROOF",
  "TIME_EVOLUTION",
  "PROBLEM_SOLUTION_VERIFICATION",
  "CASE_EVIDENCE",
  "SUMMARY",
  "CALL_TO_ACTION",
] as const;
export const directorExpressionTaskV1Schema = z.enum(DIRECTOR_EXPRESSION_TASKS);

export const DIRECTOR_INFORMATION_RELATIONS = [
  "SINGLE_CLAIM",
  "DEFINITION_BREAKDOWN",
  "PARALLEL_GROUPING",
  "SEQUENCE_PROCESS",
  "COMPARISON_CHANGE",
  "DATA_PROOF",
  "TIME_POSITION",
  "PROBLEM_SOLUTION_VERIFICATION",
] as const;
export const directorInformationRelationV1Schema = z.enum(DIRECTOR_INFORMATION_RELATIONS);

export const DIRECTOR_OBJECT_CLASSES = [
  "REAL_CONTENT",
  "CONSTRUCTED_INFORMATION",
  "GUIDANCE_EMPHASIS",
  "DECORATION",
] as const;
export const directorObjectClassV1Schema = z.enum(DIRECTOR_OBJECT_CLASSES);

export const DIRECTOR_VISUAL_OBJECT_KINDS = [
  "PERSON",
  "SCREEN_RECORDING",
  "FOOTAGE",
  "IMAGE",
  "DOCUMENT",
  "TEXT",
  "NUMBER",
  "CARD_SET",
  "FLOW",
  "TIMELINE",
  "COMPARISON",
  "CHART",
  "LIST",
  "RISK_MATRIX",
  "CALLOUT",
  "HIGHLIGHT",
  "CONNECTOR_SET",
  "BACKGROUND_SCAFFOLD",
] as const;
export const directorVisualObjectKindV1Schema = z.enum(DIRECTOR_VISUAL_OBJECT_KINDS);

export const DIRECTOR_TEXT_ROLES = [
  "NONE",
  "THESIS",
  "OBJECT_NAME",
  "CONDITION_UNIT",
  "RELATION_LABEL",
  "STATUS_RESULT",
  "CONCLUSION",
] as const;
export const directorTextRoleV1Schema = z.enum(DIRECTOR_TEXT_ROLES);

export const DIRECTOR_PACKAGING_MODES = [
  "NONE",
  "PRESENTATION_ONLY",
  "DESIGN_REQUIRED",
  "GUIDANCE",
  "DECORATIVE",
] as const;
export const directorPackagingModeV1Schema = z.enum(DIRECTOR_PACKAGING_MODES);

export const DIRECTOR_MOTION_REASONS = [
  "BUILD",
  "FLOW",
  "COMPARE",
  "REPLACE",
  "ACCUMULATE",
  "NUMERIC_CHANGE",
  "FOCUS",
  "CLEAR_CONCLUDE",
] as const;
export const directorMotionReasonV1Schema = z.enum(DIRECTOR_MOTION_REASONS);

export const directorSceneOperationV1Schema = z.enum(["ADD", "REPLACE", "TRANSFORM", "FOCUS", "CONCLUDE"]);

export const directorMaterialKindV1Schema = z.enum([
  "PERSON_VIDEO",
  "SCREEN_RECORDING",
  "B_ROLL_VIDEO",
  "IMAGE",
  "DOCUMENT",
  "DATA",
]);

export const directorAssetUnderstandingV1Schema = z.object({
  assetId: idSchema,
  fingerprint: z.string().min(1).max(512),
  name: z.string().trim().min(1).max(1_000),
  mediaKind: z.enum(["video", "audio", "image"]),
  usage: z.enum(["a_roll", "screen_recording", "b_roll", "other", "unassigned"]),
  semanticKind: z.enum(["PERSON_SOURCE", "SCREEN_SOURCE", "B_ROLL_SOURCE", "IMAGE_SOURCE", "AUDIO_SOURCE", "UNKNOWN"]),
  durationMs: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  offline: z.boolean(),
  evidence: z.literal("HOST_METADATA_ONLY"),
}).strict();

export const directorFoundationParagraphV1Schema = z.object({
  paragraphId: idSchema,
  order: z.number().int().nonnegative().max(511),
  wordRange: z.object({
    startWordId: idSchema,
    endWordId: idSchema,
    includedWordIds: z.array(idSchema).min(1).max(20_000),
  }).strict(),
  frameRange: frameRangeSchema,
  words: z.array(z.object({
    wordId: idSchema,
    text: z.string().max(1_000),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
    assetId: idSchema,
  }).strict()).min(1).max(20_000),
  text: z.string().min(1).max(100_000),
  assetIds: z.array(idSchema).min(1).max(128),
  upstreamExpressionTask: z.string().min(1).max(128),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.wordRange.includedWordIds)) {
    context.addIssue({ code: "custom", path: ["wordRange", "includedWordIds"], message: "foundation word ids must be unique" });
  }
  if (paragraph.wordRange.includedWordIds[0] !== paragraph.wordRange.startWordId
    || paragraph.wordRange.includedWordIds.at(-1) !== paragraph.wordRange.endWordId) {
    context.addIssue({ code: "custom", path: ["wordRange"], message: "foundation word endpoints must match included words" });
  }
  if (!unique(paragraph.assetIds)) {
    context.addIssue({ code: "custom", path: ["assetIds"], message: "foundation asset ids must be unique" });
  }
  if (!unique(paragraph.words.map((word) => word.wordId))
    || paragraph.words.some((word) => word.endFrame <= word.startFrame)
    || paragraph.words.map((word) => word.wordId).join("\u0000") !== paragraph.wordRange.includedWordIds.join("\u0000")) {
    context.addIssue({ code: "custom", path: ["words"], message: "foundation words must exactly bind the ordered word range and valid host frames" });
  }
});

export const projectDirectorFoundationV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  canvas: z.object({
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
    framesPerSecond: z.number().positive().max(1_000),
  }).strict(),
  roughCutReady: z.boolean(),
  roughCutFoundationHash: hashSchema.nullable(),
  masterTranscriptHash: hashSchema.nullable(),
  timeMapHash: hashSchema.nullable(),
  projectionHash: hashSchema,
  visualParagraphProposalId: idSchema.nullable(),
  visualParagraphProposalHash: hashSchema.nullable(),
  paragraphs: z.array(directorFoundationParagraphV1Schema).max(512),
  assets: z.array(directorAssetUnderstandingV1Schema).max(2_048),
  foundationHash: hashSchema,
  observedAt: isoInstantSchema,
}).strict().superRefine((foundation, context) => {
  if ((foundation.visualParagraphProposalId === null) !== (foundation.visualParagraphProposalHash === null)) {
    context.addIssue({ code: "custom", path: ["visualParagraphProposalId"], message: "visual paragraph id and hash must be present together" });
  }
  if (foundation.roughCutReady && (
    foundation.roughCutFoundationHash === null
    || foundation.masterTranscriptHash === null
    || foundation.timeMapHash === null
  )) {
    context.addIssue({ code: "custom", path: ["roughCutReady"], message: "ready rough cut requires exact foundation hashes" });
  }
  if (!unique(foundation.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "foundation paragraph ids must be unique" });
  }
  if (!unique(foundation.assets.map((asset) => asset.assetId))) {
    context.addIssue({ code: "custom", path: ["assets"], message: "foundation asset ids must be unique" });
  }
  const { foundationHash: _foundationHash, ...semantic } = foundation;
  if (foundation.foundationHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["foundationHash"], message: "foundation hash must match canonical content" });
  }
});

export const projectDesignSystemV1Schema = z.object({
  palette: z.object({
    background: z.string().trim().min(1).max(64),
    surface: z.string().trim().min(1).max(64),
    primaryText: z.string().trim().min(1).max(64),
    secondaryText: z.string().trim().min(1).max(64),
    accent: z.string().trim().min(1).max(64),
    positive: z.string().trim().min(1).max(64),
    negative: z.string().trim().min(1).max(64),
  }).strict(),
  typography: z.object({
    family: z.string().trim().min(1).max(200),
    thesisWeight: z.number().int().min(100).max(900),
    bodyWeight: z.number().int().min(100).max(900),
    hierarchy: z.array(z.string().trim().min(1).max(128)).min(3).max(8),
  }).strict(),
  spacingScale: z.array(z.number().int().positive().max(256)).min(3).max(12),
  shapeLanguage: compactTextSchema,
  mediaFraming: compactTextSchema,
  iconLanguage: compactTextSchema,
  motionLanguage: compactTextSchema,
  captionSafeZone: z.object({
    xPermille: z.number().int().min(0).max(999),
    yPermille: z.number().int().min(0).max(999),
    widthPermille: z.number().int().positive().max(1_000),
    heightPermille: z.number().int().positive().max(1_000),
  }).strict().superRefine((zone, context) => {
    if (zone.xPermille + zone.widthPermille > 1_000 || zone.yPermille + zone.heightPermille > 1_000) {
      context.addIssue({ code: "custom", message: "caption safe zone must fit the canvas" });
    }
  }),
}).strict().superRefine((system, context) => {
  if (!unique(system.spacingScale.map(String))) {
    context.addIssue({ code: "custom", path: ["spacingScale"], message: "spacing scale values must be unique" });
  }
});

export const directorObjectSourceV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EXISTING_ASSET"), assetId: idSchema }).strict(),
  z.object({ kind: z.literal("TRANSCRIPT_WORD_SET"), wordIds: z.array(idSchema).min(1).max(256) }).strict(),
  z.object({ kind: z.literal("CONSTRUCTED"), evidenceWordIds: z.array(idSchema).max(256) }).strict(),
  z.object({ kind: z.literal("REQUIRED_MATERIAL"), requirementId: idSchema }).strict(),
]);

export const directorVisualObjectSubmissionV1Schema = z.object({
  visualObjectId: idSchema,
  role: z.enum(["MAIN", "SUPPORT", "INTERNAL"]),
  objectClass: directorObjectClassV1Schema,
  kind: directorVisualObjectKindV1Schema,
  informationDuty: compactTextSchema,
  textRole: directorTextRoleV1Schema,
  text: z.string().max(2_000).nullable(),
  source: directorObjectSourceV1Schema,
  packagingMode: directorPackagingModeV1Schema,
  childObjectIds: z.array(idSchema).max(32),
}).strict().superRefine((object, context) => {
  if (!unique(object.childObjectIds) || object.childObjectIds.includes(object.visualObjectId)) {
    context.addIssue({ code: "custom", path: ["childObjectIds"], message: "child object ids must be unique and cannot reference self" });
  }
  if ((object.textRole === "NONE") !== (object.text === null)) {
    context.addIssue({ code: "custom", path: ["text"], message: "text and text role must be present together" });
  }
  if (object.objectClass === "CONSTRUCTED_INFORMATION" && object.packagingMode !== "DESIGN_REQUIRED") {
    context.addIssue({ code: "custom", path: ["packagingMode"], message: "constructed information must be designed" });
  }
  if (object.objectClass === "GUIDANCE_EMPHASIS" && object.packagingMode !== "GUIDANCE") {
    context.addIssue({ code: "custom", path: ["packagingMode"], message: "guidance objects require guidance packaging" });
  }
  if (object.objectClass === "DECORATION" && object.packagingMode !== "DECORATIVE") {
    context.addIssue({ code: "custom", path: ["packagingMode"], message: "decoration objects require decorative packaging" });
  }
  if (object.objectClass === "REAL_CONTENT" && !["NONE", "PRESENTATION_ONLY"].includes(object.packagingMode)) {
    context.addIssue({ code: "custom", path: ["packagingMode"], message: "real content may only be preserved or presentation-treated" });
  }
  if (object.kind === "PERSON" && !["NONE", "PRESENTATION_ONLY"].includes(object.packagingMode)) {
    context.addIssue({ code: "custom", path: ["packagingMode"], message: "person content cannot receive content-changing packaging" });
  }
});

export const directorMaterialRequirementSubmissionV1Schema = z.object({
  requirementId: idSchema,
  paragraphIds: z.array(idSchema).min(1).max(512),
  kind: directorMaterialKindV1Schema,
  description: compactTextSchema,
  idealPurpose: compactTextSchema,
  requiredForIdealPlan: z.boolean(),
}).strict().superRefine((requirement, context) => {
  if (!unique(requirement.paragraphIds)) {
    context.addIssue({ code: "custom", path: ["paragraphIds"], message: "requirement paragraph ids must be unique" });
  }
});

export const directorPackagingTargetV1Schema = z.object({
  visualObjectId: idSchema,
  purpose: compactTextSchema,
  motionReason: directorMotionReasonV1Schema,
  preferredCapabilityIds: z.array(idSchema).max(12),
}).strict().superRefine((target, context) => {
  if (!unique(target.preferredCapabilityIds)) {
    context.addIssue({ code: "custom", path: ["preferredCapabilityIds"], message: "preferred capabilities must be unique" });
  }
});

const projectAgentPackagingTargetSubmissionV1Schema = directorPackagingTargetV1Schema.safeExtend({
  preferredCapabilityIds: z.array(idSchema).length(0),
});

export const directorSceneStateV1Schema = z.object({
  stateId: idSchema,
  anchorWordId: idSchema,
  operation: directorSceneOperationV1Schema,
  targetObjectIds: z.array(idSchema).min(1).max(32),
  purpose: compactTextSchema,
}).strict().superRefine((state, context) => {
  if (!unique(state.targetObjectIds)) {
    context.addIssue({ code: "custom", path: ["targetObjectIds"], message: "state target ids must be unique" });
  }
});

export const directorCreativeParagraphSubmissionV1Schema = z.object({
  paragraphId: idSchema,
  startWordId: idSchema,
  endWordId: idSchema,
  expressionTask: directorExpressionTaskV1Schema,
  coreProposition: compactTextSchema,
  informationRelation: directorInformationRelationV1Schema,
  objects: z.array(directorVisualObjectSubmissionV1Schema).min(1).max(64),
  mainVisualObjectId: idSchema,
  supportingVisualObjectIds: z.array(idSchema).max(2),
  composition: z.object({
    selectedVariantId: layoutVariantIdV1Schema,
    objectSlotMappings: z.array(z.object({
      visualObjectId: idSchema,
      layoutSlotId: layoutSlotIdV1Schema,
    }).strict()).min(1).max(3),
    layoutIntent: compactTextSchema,
    hierarchyRationale: compactTextSchema,
    readingOrderObjectIds: z.array(idSchema).min(1).max(64),
  }).strict(),
  packagingTargets: z.array(directorPackagingTargetV1Schema).max(64),
  states: z.array(directorSceneStateV1Schema).min(1).max(24),
  rationale: compactTextSchema,
  alternativeDirection: compactTextSchema,
  /** AI-authored uncertainty/creative-risk notes. Optional only so pre-U2 plans remain readable. */
  risks: z.array(compactTextSchema).max(16).optional(),
  confidence: z.number().min(0).max(1),
}).strict().superRefine((paragraph, context) => {
  const ids = paragraph.objects.map((object) => object.visualObjectId);
  const idSet = new Set(ids);
  if (!unique(ids)) context.addIssue({ code: "custom", path: ["objects"], message: "visual object ids must be unique" });
  if (!unique(paragraph.supportingVisualObjectIds) || paragraph.supportingVisualObjectIds.includes(paragraph.mainVisualObjectId)) {
    context.addIssue({ code: "custom", path: ["supportingVisualObjectIds"], message: "support ids must be unique and distinct from main" });
  }
  const mainObjects = paragraph.objects.filter((object) => object.role === "MAIN");
  if (mainObjects.length !== 1 || mainObjects[0]?.visualObjectId !== paragraph.mainVisualObjectId) {
    context.addIssue({ code: "custom", path: ["mainVisualObjectId"], message: "each paragraph requires exactly one declared MAIN object" });
  }
  if (mainObjects[0] !== undefined && !["REAL_CONTENT", "CONSTRUCTED_INFORMATION"].includes(mainObjects[0].objectClass)) {
    context.addIssue({ code: "custom", path: ["mainVisualObjectId"], message: "MAIN must independently carry information and cannot be guidance or decoration" });
  }
  const supportIds = paragraph.objects.filter((object) => object.role === "SUPPORT").map((object) => object.visualObjectId).sort();
  if (supportIds.join("\u0000") !== [...paragraph.supportingVisualObjectIds].sort().join("\u0000")) {
    context.addIssue({ code: "custom", path: ["supportingVisualObjectIds"], message: "declared support ids must exactly match SUPPORT objects" });
  }
  const references = [
    ...paragraph.objects.flatMap((object) => object.childObjectIds),
    ...paragraph.composition.readingOrderObjectIds,
    ...paragraph.packagingTargets.map((target) => target.visualObjectId),
    ...paragraph.states.flatMap((state) => state.targetObjectIds),
  ];
  if (references.some((id) => !idSet.has(id))) {
    context.addIssue({ code: "custom", path: ["objects"], message: "paragraph references must resolve to local visual objects" });
  }
  if (!unique(paragraph.composition.readingOrderObjectIds)) {
    context.addIssue({ code: "custom", path: ["composition", "readingOrderObjectIds"], message: "reading order must not repeat objects" });
  }
  const slotMappings = paragraph.composition.objectSlotMappings;
  const topLevelObjectIds = [paragraph.mainVisualObjectId, ...paragraph.supportingVisualObjectIds].sort();
  if (!unique(slotMappings.map((mapping) => mapping.visualObjectId))
    || !unique(slotMappings.map((mapping) => mapping.layoutSlotId))
    || slotMappings.map((mapping) => mapping.visualObjectId).sort().join("\u0000") !== topLevelObjectIds.join("\u0000")
    || slotMappings.find((mapping) => mapping.visualObjectId === paragraph.mainVisualObjectId)?.layoutSlotId !== "MAIN_STAGE"
    || slotMappings.some((mapping) => paragraph.supportingVisualObjectIds.includes(mapping.visualObjectId)
      && !["SUPPORT_PRIMARY", "SUPPORT_SECONDARY"].includes(mapping.layoutSlotId))) {
    context.addIssue({ code: "custom", path: ["composition", "objectSlotMappings"], message: "AI layout mappings must assign MAIN and every SUPPORT exactly once to compatible top-level slots" });
  }
  if (!unique(paragraph.packagingTargets.map((target) => target.visualObjectId))) {
    context.addIssue({ code: "custom", path: ["packagingTargets"], message: "packaging target objects must be unique" });
  }
  if (!unique(paragraph.states.map((state) => state.stateId))) {
    context.addIssue({ code: "custom", path: ["states"], message: "scene state ids must be unique" });
  }
  const targetIds = new Set(paragraph.packagingTargets.map((target) => target.visualObjectId));
  const missingRequiredTargets = paragraph.objects.filter((object) =>
    ["DESIGN_REQUIRED", "GUIDANCE", "DECORATIVE"].includes(object.packagingMode) && !targetIds.has(object.visualObjectId));
  if (missingRequiredTargets.length > 0) {
    context.addIssue({ code: "custom", path: ["packagingTargets"], message: "every designed, guidance, or decorative object must be an explicit packaging target" });
  }
});

/**
 * Host-owned, self-contained word evidence for Project Agent plans.  This is
 * deliberately optional on the persisted paragraph schema so plans written by
 * the pre-foundation-sync implementation remain readable; new Project Agent
 * submissions and host-generated successors always populate it.
 */
export const directorCreativeWordBindingV1Schema = z.object({
  wordId: idSchema,
  text: z.string().max(1_000),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  assetId: idSchema,
}).strict().superRefine((binding, context) => {
  if (binding.endFrame <= binding.startFrame) {
    context.addIssue({ code: "custom", path: ["endFrame"], message: "word binding endFrame must be after startFrame" });
  }
});

export const directorLayoutOverrideSourceBindingV1Schema = z.object({
  planId: idSchema,
  planHash: hashSchema,
  paragraphId: idSchema,
}).strict();

export const directorCreativePlanContinuityV1Schema = z.object({
  /** FOUNDATION_SYNC is host deterministic rebasing; AGENT_REVISION is a model resubmission. */
  kind: z.enum(["FOUNDATION_SYNC", "AGENT_REVISION"]),
  predecessorPlanId: idSchema,
  predecessorPlanHash: hashSchema,
  preservedParagraphs: z.array(z.object({
    currentParagraphId: idSchema,
    predecessorParagraphId: idSchema,
    predecessorParagraphHash: hashSchema,
    /** Cumulative, de-duplicated sources for safe layout-override inheritance. */
    inheritedLayoutOverrideSources: z.array(directorLayoutOverrideSourceBindingV1Schema).max(1_024),
  }).strict()).max(512),
  affectedPreviousParagraphIds: z.array(idSchema).max(512),
  unresolvedCurrentWordIds: z.array(idSchema).max(20_000),
}).strict().superRefine((continuity, context) => {
  const preservedIds = continuity.preservedParagraphs.map((entry) => entry.currentParagraphId);
  if (!unique(preservedIds)) {
    context.addIssue({ code: "custom", path: ["preservedParagraphs"], message: "preserved current paragraph ids must be unique" });
  }
  if (!unique(continuity.affectedPreviousParagraphIds)) {
    context.addIssue({ code: "custom", path: ["affectedPreviousParagraphIds"], message: "affected paragraph ids must be unique" });
  }
  if (!unique(continuity.unresolvedCurrentWordIds)) {
    context.addIssue({ code: "custom", path: ["unresolvedCurrentWordIds"], message: "unresolved current word ids must be unique" });
  }
  for (const entry of continuity.preservedParagraphs) {
    const sourceKeys = entry.inheritedLayoutOverrideSources.map((source) => `${source.planId}\u0000${source.planHash}\u0000${source.paragraphId}`);
    if (!unique(sourceKeys)) {
      context.addIssue({ code: "custom", path: ["preservedParagraphs"], message: "inherited layout override sources must be de-duplicated" });
    }
  }
});

export const directorWholeFilmOpportunityAuditV1Schema = z.object({
  assessment: compactTextSchema,
  missedScreenRecordingParagraphIds: z.array(idSchema).max(512),
  missedProcessParagraphIds: z.array(idSchema).max(512),
  missedComparisonParagraphIds: z.array(idSchema).max(512),
  missedDataParagraphIds: z.array(idSchema).max(512),
  missedEvidenceParagraphIds: z.array(idSchema).max(512),
}).strict();

export const directorWholeFilmLayoutAuditV1Schema = z.object({
  assessment: compactTextSchema,
  repeatedLayoutParagraphIds: z.array(idSchema).max(512),
}).strict();

export const directorWholeFilmMaterialAuditV1Schema = z.object({
  assessment: compactTextSchema,
  requirementIds: z.array(idSchema).max(256),
}).strict();

export const directorWholeFilmRestraintAuditV1Schema = z.object({
  assessment: compactTextSchema,
  overpackagedParagraphIds: z.array(idSchema).max(512),
  underpackagedParagraphIds: z.array(idSchema).max(512),
}).strict();

export const directorWholeFilmReviewV1Schema = z.object({
  rhythmAssessment: compactTextSchema,
  diversityAssessment: compactTextSchema,
  continuityAssessment: compactTextSchema,
  unresolvedRisks: z.array(compactTextSchema).max(32),
  /** Optional only for backwards compatibility with pre-U2 persisted plans. */
  opportunityAudit: directorWholeFilmOpportunityAuditV1Schema.optional(),
  layoutAudit: directorWholeFilmLayoutAuditV1Schema.optional(),
  materialAudit: directorWholeFilmMaterialAuditV1Schema.optional(),
  restraintAudit: directorWholeFilmRestraintAuditV1Schema.optional(),
}).strict();

export const submitProjectCreativePlanV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  expectedTimelineHash: hashSchema,
  intentSummary: compactTextSchema,
  designSystem: projectDesignSystemV1Schema,
  materialRequirements: z.array(directorMaterialRequirementSubmissionV1Schema).max(256),
  paragraphs: z.array(directorCreativeParagraphSubmissionV1Schema).min(1).max(512),
  wholeFilmReview: directorWholeFilmReviewV1Schema,
  createdByTurnId: idSchema,
  submittedAt: isoInstantSchema,
}).strict().superRefine((request, context) => {
  if (!unique(request.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "creative plan paragraph ids must be unique" });
  }
  if (!unique(request.materialRequirements.map((requirement) => requirement.requirementId))) {
    context.addIssue({ code: "custom", path: ["materialRequirements"], message: "material requirement ids must be unique" });
  }
});

/**
 * The isolated Project Agent path deliberately does not ask the model to
 * invent paragraph identities, end words, frame ranges, or transcript
 * coverage.  It supplies stable starts and the semantic design only; the
 * Project Director host derives the complete paragraph records from the
 * current Master Transcript in one state-file transaction.
 */
export const projectAgentCreativeParagraphSubmissionV1Schema = z.object({
  startWordId: idSchema,
  expressionTask: directorExpressionTaskV1Schema,
  coreProposition: compactTextSchema,
  informationRelation: directorInformationRelationV1Schema,
  objects: z.array(directorVisualObjectSubmissionV1Schema).min(1).max(64),
  mainVisualObjectId: idSchema,
  supportingVisualObjectIds: z.array(idSchema).max(2),
  composition: z.object({
    selectedVariantId: layoutVariantIdV1Schema,
    objectSlotMappings: z.array(z.object({
      visualObjectId: idSchema,
      layoutSlotId: layoutSlotIdV1Schema,
    }).strict()).min(1).max(3),
    layoutIntent: compactTextSchema,
    hierarchyRationale: compactTextSchema,
    readingOrderObjectIds: z.array(idSchema).min(1).max(64),
  }).strict(),
  packagingTargets: z.array(projectAgentPackagingTargetSubmissionV1Schema).max(64),
  states: z.array(directorSceneStateV1Schema).min(1).max(24),
  rationale: compactTextSchema,
  alternativeDirection: compactTextSchema,
  risks: z.array(compactTextSchema).max(16),
  confidence: z.number().min(0).max(1),
}).strict();

export const projectAgentMaterialRequirementSubmissionV1Schema = z.object({
  requirementId: idSchema,
  paragraphStartWordIds: z.array(idSchema).min(1).max(512),
  kind: directorMaterialKindV1Schema,
  description: compactTextSchema,
  idealPurpose: compactTextSchema,
  requiredForIdealPlan: z.literal(true),
}).strict().superRefine((requirement, context) => {
  if (!unique(requirement.paragraphStartWordIds)) {
    context.addIssue({ code: "custom", path: ["paragraphStartWordIds"], message: "requirement paragraph starts must be unique" });
  }
});

export const submitProjectAgentCreativePlanV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  expectedTimelineHash: hashSchema,
  intentSummary: compactTextSchema,
  designSystem: projectDesignSystemV1Schema,
  materialRequirements: z.array(projectAgentMaterialRequirementSubmissionV1Schema).max(256),
  paragraphs: z.array(projectAgentCreativeParagraphSubmissionV1Schema).min(1).max(512),
  wholeFilmReview: z.object({
    rhythmAssessment: compactTextSchema,
    diversityAssessment: compactTextSchema,
    continuityAssessment: compactTextSchema,
    unresolvedRisks: z.array(compactTextSchema).max(32),
    opportunityAudit: z.object({
      assessment: compactTextSchema,
      missedScreenRecordingParagraphStartWordIds: z.array(idSchema).max(512),
      missedProcessParagraphStartWordIds: z.array(idSchema).max(512),
      missedComparisonParagraphStartWordIds: z.array(idSchema).max(512),
      missedDataParagraphStartWordIds: z.array(idSchema).max(512),
      missedEvidenceParagraphStartWordIds: z.array(idSchema).max(512),
    }).strict(),
    layoutAudit: z.object({
      assessment: compactTextSchema,
      repeatedLayoutParagraphStartWordIds: z.array(idSchema).max(512),
    }).strict(),
    materialAudit: directorWholeFilmMaterialAuditV1Schema,
    restraintAudit: z.object({
      assessment: compactTextSchema,
      overpackagedParagraphStartWordIds: z.array(idSchema).max(512),
      underpackagedParagraphStartWordIds: z.array(idSchema).max(512),
    }).strict(),
  }).strict(),
  createdByTurnId: idSchema,
  submittedAt: isoInstantSchema,
}).strict().superRefine((request, context) => {
  if (!unique(request.paragraphs.map((paragraph) => paragraph.startWordId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "creative plan paragraph start word ids must be unique" });
  }
  if (!unique(request.materialRequirements.map((requirement) => requirement.requirementId))) {
    context.addIssue({ code: "custom", path: ["materialRequirements"], message: "material requirement ids must be unique" });
  }
});

export const directorFoundationBindingV1Schema = z.object({
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  foundationHash: hashSchema,
  roughCutFoundationHash: hashSchema,
  masterTranscriptHash: hashSchema,
  timeMapHash: hashSchema,
  projectionHash: hashSchema,
  visualParagraphProposalId: idSchema,
  visualParagraphProposalHash: hashSchema,
  /** Present for the atomic Project Agent path; absent on legacy plans. */
  boundarySetId: idSchema.optional(),
  boundarySetHash: hashSchema.optional(),
}).strict().superRefine((binding, context) => {
  if ((binding.boundarySetId === undefined) !== (binding.boundarySetHash === undefined)) {
    context.addIssue({ code: "custom", path: ["boundarySetId"], message: "boundary set id and hash must be present together" });
  }
});

export const directorCreativeParagraphV1Schema = directorCreativeParagraphSubmissionV1Schema.extend({
  order: z.number().int().nonnegative().max(511),
  includedWordIds: z.array(idSchema).min(1).max(20_000),
  frameRange: frameRangeSchema,
  transcriptText: z.string().min(1).max(100_000),
  sourceAssetIds: z.array(idSchema).min(1).max(128),
  wordBindings: z.array(directorCreativeWordBindingV1Schema).min(1).max(20_000).optional(),
  paragraphHash: hashSchema,
}).strict().superRefine((paragraph, context) => {
  if (paragraph.wordBindings !== undefined) {
    const bindingIds = paragraph.wordBindings.map((binding) => binding.wordId);
    if (!unique(bindingIds) || bindingIds.join("\u0000") !== paragraph.includedWordIds.join("\u0000")) {
      context.addIssue({ code: "custom", path: ["wordBindings"], message: "word bindings must exactly cover the ordered included word ids" });
    }
  }
  const { paragraphHash: _paragraphHash, ...semantic } = paragraph;
  if (paragraph.paragraphHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["paragraphHash"], message: "creative paragraph hash must match canonical content" });
  }
});

export const directorDiagnosticV1Schema = z.object({
  code: z.enum([
    "ALL_MAIN_VISUALS_PERSON",
    "REPEATED_MAIN_VISUAL_KIND",
    "REPEATED_INFORMATION_RELATION",
    "REPEATED_LAYOUT_INTENT",
    "LOW_CONFIDENCE_PARAGRAPH",
    "MATERIAL_REQUIREMENTS_PENDING",
    "MISSED_VISUAL_OPPORTUNITY",
    "REPEATED_LAYOUT_SELF_REVIEW",
    "OVERPACKAGING_RISK",
    "UNDERPACKAGING_RISK",
  ]),
  severity: z.literal("ADVISORY"),
  paragraphIds: z.array(idSchema).max(512),
  message: compactTextSchema,
}).strict();

export const directorCreativePlanV1Schema = z.object({
  schemaVersion: z.literal(1),
  planId: idSchema,
  planHash: hashSchema,
  projectId: idSchema,
  timelineId: idSchema,
  foundation: directorFoundationBindingV1Schema,
  intentSummary: compactTextSchema,
  designSystem: projectDesignSystemV1Schema,
  materialRequirements: z.array(directorMaterialRequirementSubmissionV1Schema).max(256),
  paragraphs: z.array(directorCreativeParagraphV1Schema).min(1).max(512),
  wholeFilmReview: submitProjectCreativePlanV1RequestSchema.shape.wholeFilmReview,
  diagnostics: z.array(directorDiagnosticV1Schema).max(128),
  status: z.enum(["CURRENT", "NEEDS_MATERIAL_RESPONSE", "NEEDS_REVISION", "STALE"]),
  createdByTurnId: idSchema,
  /** Only populated by the isolated Project Agent path for crash-safe replay. */
  projectAgentSubmissionHash: hashSchema.optional(),
  /** Host-owned lineage for deterministic foundation rebases and Agent revisions. */
  continuity: directorCreativePlanContinuityV1Schema.optional(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((plan, context) => {
  if (!unique(plan.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "plan paragraph ids must be unique" });
  }
  const { planHash: _planHash, ...semantic } = plan;
  if (plan.planHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["planHash"], message: "creative plan hash must match canonical content" });
  }
});

export const directorMaterialResponseV1Schema = z.object({
  responseId: idSchema,
  responseHash: hashSchema,
  planId: idSchema,
  planHash: hashSchema,
  requirementId: idSchema,
  decision: z.enum(["WILL_PROVIDE", "PROVIDED", "CANNOT_PROVIDE"]),
  assetIds: z.array(idSchema).max(64),
  note: z.string().trim().max(1_000),
  respondedAt: isoInstantSchema,
}).strict().superRefine((response, context) => {
  if (!unique(response.assetIds)) {
    context.addIssue({ code: "custom", path: ["assetIds"], message: "response asset ids must be unique" });
  }
  if (response.decision === "PROVIDED" && response.assetIds.length === 0) {
    context.addIssue({ code: "custom", path: ["assetIds"], message: "provided material requires at least one asset" });
  }
  if (response.decision !== "PROVIDED" && response.assetIds.length > 0) {
    context.addIssue({ code: "custom", path: ["assetIds"], message: "only provided material may bind assets" });
  }
  const { responseHash: _responseHash, ...semantic } = response;
  if (response.responseHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["responseHash"], message: "material response hash must match canonical content" });
  }
});

export const respondProjectDirectorMaterialV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  planId: idSchema,
  planHash: hashSchema,
  requirementId: idSchema,
  decision: z.enum(["WILL_PROVIDE", "PROVIDED", "CANNOT_PROVIDE"]),
  assetIds: z.array(idSchema).max(64),
  note: z.string().trim().max(1_000),
  respondedAt: isoInstantSchema,
}).strict();

export const directorPreviewVersionV1Schema = z.object({
  previewVersionId: idSchema,
  previewVersionHash: hashSchema,
  kind: directorPreviewKindV1Schema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  creativePlanId: idSchema.nullable(),
  creativePlanHash: hashSchema.nullable(),
  payloadHash: hashSchema,
  status: z.enum(["READY", "STALE"]),
  generatedAt: isoInstantSchema,
}).strict().superRefine((version, context) => {
  if ((version.creativePlanId === null) !== (version.creativePlanHash === null)) {
    context.addIssue({ code: "custom", path: ["creativePlanId"], message: "preview plan id and hash must be present together" });
  }
  const { previewVersionHash: _previewVersionHash, ...semantic } = version;
  if (version.previewVersionHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["previewVersionHash"], message: "preview version hash must match canonical content" });
  }
});

export const directorPreviewConfirmationV1Schema = z.object({
  confirmationId: idSchema,
  confirmationHash: hashSchema,
  previewVersionId: idSchema,
  previewVersionHash: hashSchema,
  kind: directorPreviewKindV1Schema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  status: z.enum(["CONFIRMED", "STALE"]),
  confirmedAt: isoInstantSchema,
  staleAt: isoInstantSchema.nullable(),
}).strict().superRefine((confirmation, context) => {
  if ((confirmation.status === "CONFIRMED") !== (confirmation.staleAt === null)) {
    context.addIssue({ code: "custom", path: ["status"], message: "confirmation status and staleAt must agree" });
  }
  const { confirmationHash: _confirmationHash, ...semantic } = confirmation;
  if (confirmation.confirmationHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["confirmationHash"], message: "confirmation hash must match canonical content" });
  }
});

export const confirmProjectDirectorPreviewV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  previewVersionId: idSchema,
  previewVersionHash: hashSchema,
  confirmedAt: isoInstantSchema,
}).strict();

export const projectDirectorPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  currentPlanId: idSchema.nullable(),
  plans: z.array(directorCreativePlanV1Schema).max(8),
  materialResponses: z.array(directorMaterialResponseV1Schema).max(512),
  previewVersions: z.array(directorPreviewVersionV1Schema).max(24),
  previewConfirmations: z.array(directorPreviewConfirmationV1Schema).max(48),
}).strict().superRefine((state, context) => {
  if (state.currentPlanId !== null && !state.plans.some((plan) => plan.planId === state.currentPlanId)) {
    context.addIssue({ code: "custom", path: ["currentPlanId"], message: "current plan id must resolve" });
  }
});

export const projectDirectorSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  foundation: projectDirectorFoundationV1Schema,
  currentPlan: directorCreativePlanV1Schema.nullable(),
  materialResponses: z.array(directorMaterialResponseV1Schema).max(512),
  previewVersions: z.array(directorPreviewVersionV1Schema).max(24),
  previewConfirmations: z.array(directorPreviewConfirmationV1Schema).max(48),
  readiness: z.object({
    code: z.enum([
      "ROUGH_CUT_REQUIRED",
      "ROUGH_CUT_CONFIRMATION_REQUIRED",
      "VISUAL_PARAGRAPHS_REQUIRED",
      "CREATIVE_PLAN_REQUIRED",
      "MATERIAL_RESPONSE_REQUIRED",
      "CREATIVE_PLAN_REVISION_REQUIRED",
      "LAYOUT_CUT_REQUIRED",
      "LAYOUT_CUT_CONFIRMATION_REQUIRED",
      "PACKAGED_CUT_REQUIRED",
      "PACKAGED_CUT_CONFIRMATION_REQUIRED",
      "READY_TO_EXPORT",
    ]),
    pendingMaterialRequirementIds: z.array(idSchema).max(256),
    cannotProvideRequirementIds: z.array(idSchema).max(256),
    stalePreviewKinds: z.array(directorPreviewKindV1Schema).max(3),
  }).strict(),
  registeredCapabilities: z.tuple([
    z.literal("SUBMIT_WHOLE_FILM_CREATIVE_PLAN"),
    z.literal("REQUEST_IDEAL_MATERIALS"),
  ]),
  permissions: z.object({
    modelAllowed: z.array(z.string().min(1).max(128)),
    modelDenied: z.tuple([
      z.literal("DIRECT_TIMELINE_WRITE"),
      z.literal("PROGRAM_SPINE_WRITE"),
      z.literal("PROJECT_FILE_WRITE"),
      z.literal("ARBITRARY_OPERATION"),
      z.literal("ARBITRARY_TRANSACTION"),
      z.literal("MODEL_AUTHORED_FRAME_RANGE"),
    ]),
  }).strict(),
  timelineModified: z.literal(false),
}).strict();

export type ProjectDirectorFoundationV1 = z.infer<typeof projectDirectorFoundationV1Schema>;
export type DirectorAssetUnderstandingV1 = z.infer<typeof directorAssetUnderstandingV1Schema>;
export type SubmitProjectCreativePlanV1Request = z.infer<typeof submitProjectCreativePlanV1RequestSchema>;
export type ProjectAgentCreativeParagraphSubmissionV1 = z.infer<typeof projectAgentCreativeParagraphSubmissionV1Schema>;
export type ProjectAgentMaterialRequirementSubmissionV1 = z.infer<typeof projectAgentMaterialRequirementSubmissionV1Schema>;
export type SubmitProjectAgentCreativePlanV1Request = z.infer<typeof submitProjectAgentCreativePlanV1RequestSchema>;
export type DirectorCreativePlanV1 = z.infer<typeof directorCreativePlanV1Schema>;
export type DirectorCreativeParagraphV1 = z.infer<typeof directorCreativeParagraphV1Schema>;
export type DirectorCreativeWordBindingV1 = z.infer<typeof directorCreativeWordBindingV1Schema>;
export type DirectorLayoutOverrideSourceBindingV1 = z.infer<typeof directorLayoutOverrideSourceBindingV1Schema>;
export type DirectorCreativePlanContinuityV1 = z.infer<typeof directorCreativePlanContinuityV1Schema>;
export type DirectorDiagnosticV1 = z.infer<typeof directorDiagnosticV1Schema>;
export type DirectorMaterialResponseV1 = z.infer<typeof directorMaterialResponseV1Schema>;
export type RespondProjectDirectorMaterialV1Request = z.infer<typeof respondProjectDirectorMaterialV1RequestSchema>;
export type DirectorPreviewVersionV1 = z.infer<typeof directorPreviewVersionV1Schema>;
export type DirectorPreviewConfirmationV1 = z.infer<typeof directorPreviewConfirmationV1Schema>;
export type ConfirmProjectDirectorPreviewV1Request = z.infer<typeof confirmProjectDirectorPreviewV1RequestSchema>;
export type ProjectDirectorPersistentStateV1 = z.infer<typeof projectDirectorPersistentStateV1Schema>;
export type ProjectDirectorSnapshotV1 = z.infer<typeof projectDirectorSnapshotV1Schema>;
