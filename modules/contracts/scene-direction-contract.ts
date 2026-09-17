import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  frameRangeSchema,
  hashSchema,
  idSchema,
  isoInstantSchema,
  jsonObjectSchema,
} from "../shared/timeline-v2/schema.js";
import {
  layoutFamilyIdV1Schema,
  layoutSlotIdV1Schema,
  layoutVariantIdV1Schema,
} from "./layout-contract.js";
import {
  visualRoleObjectKindSchema,
  visualRoleSupportDutySchema,
} from "./visual-role-contract.js";

const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const compactTextSchema = z.string().trim().min(1).max(1_000);
const shortTextSchema = z.string().trim().min(1).max(200);
const localKeySchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const INFORMATION_RELATION_IDS_V1 = [
  "SINGLE_CLAIM",
  "DEFINITION_BREAKDOWN",
  "PARALLEL_GROUPING",
  "SEQUENCE_PROCESS",
  "COMPARISON_CHANGE",
  "DATA_PROOF",
  "TIME_POSITION",
  "PROBLEM_SOLUTION_VERIFICATION",
] as const;

export const SCENE_GROUP_KINDS_V1 = [
  "SOURCE_CARRIER",
  "HEADLINE",
  "KEY_TEXT",
  "METRIC",
  "CARD_SET",
  "FLOW",
  "TIMELINE",
  "COMPARISON",
  "LIST",
  "RISK_MATRIX",
  "CALLOUT",
  "HIGHLIGHT",
  "CONNECTOR_SET",
  "BACKGROUND_SCAFFOLD",
] as const;

export const SCENE_PACKAGING_POLICIES_V1 = [
  "SOURCE_CLEAN",
  "CONTAINER_FOCUS_ONLY",
  "DESIGNED_MOTION",
  "STATIC_SCAFFOLD",
] as const;

export const SCENE_PROGRESS_OPERATIONS_V1 = [
  "ADD",
  "REPLACE",
  "TRANSFORM",
  "FOCUS",
  "CONCLUDE",
] as const;

export const SCENE_MOTION_REASON_CODES_V1 = [
  "ESTABLISH",
  "REVEAL",
  "SHOW_RELATION",
  "MARK_PROGRESS",
  "COMPARE",
  "DIRECT_ATTENTION",
  "VERIFY",
  "CONCLUDE",
] as const;

export const informationRelationIdV1Schema = z.enum(INFORMATION_RELATION_IDS_V1);
export const sceneGroupKindV1Schema = z.enum(SCENE_GROUP_KINDS_V1);
export const scenePackagingPolicyV1Schema = z.enum(SCENE_PACKAGING_POLICIES_V1);
export const sceneProgressOperationV1Schema = z.enum(SCENE_PROGRESS_OPERATIONS_V1);
export const sceneMotionReasonCodeV1Schema = z.enum(SCENE_MOTION_REASON_CODES_V1);
export const sceneContentModeV1Schema = z.enum([
  "UPSTREAM_EXACT",
  "EVIDENCE_BOUND_SUMMARY",
  "NON_SEMANTIC",
]);

const normalizedFrameSchema = z.object({
  xPermille: z.number().int().min(0).max(999),
  yPermille: z.number().int().min(0).max(999),
  widthPermille: z.number().int().min(1).max(1_000),
  heightPermille: z.number().int().min(1).max(1_000),
}).strict().superRefine((frame, context) => {
  if (frame.xPermille + frame.widthPermille > 1_000
    || frame.yPermille + frame.heightPermille > 1_000) {
    context.addIssue({ code: "custom", path: [], message: "normalized frame must remain inside the canvas" });
  }
});

export const sceneInformationRelationCatalogItemV1Schema = z.object({
  relationId: informationRelationIdV1Schema,
  label: z.string().trim().min(1).max(100),
  designQuestion: compactTextSchema,
  compatibleLayoutFamilyIds: z.array(layoutFamilyIdV1Schema).min(1).max(11),
  signatureGroupKinds: z.array(sceneGroupKindV1Schema).min(1).max(8),
}).strict().superRefine((item, context) => {
  if (!unique(item.compatibleLayoutFamilyIds) || !unique(item.signatureGroupKinds)) {
    context.addIssue({ code: "custom", path: [], message: "relation catalog lists must be unique" });
  }
});

export const sceneGroupCatalogItemV1Schema = z.object({
  groupKind: sceneGroupKindV1Schema,
  label: z.string().trim().min(1).max(100),
  purpose: compactTextSchema,
  minimumItems: z.number().int().min(0).max(12),
  maximumItems: z.number().int().min(0).max(12),
  semantic: z.boolean(),
  derivedWithoutOwnerAllowed: z.boolean(),
  allowedPackagingPolicies: z.array(scenePackagingPolicyV1Schema).min(1).max(4),
}).strict().superRefine((item, context) => {
  if (item.minimumItems > item.maximumItems || !unique(item.allowedPackagingPolicies)) {
    context.addIssue({ code: "custom", path: [], message: "group catalog cardinality and policies must be valid" });
  }
});

export const sceneObjectPolicyCatalogItemV1Schema = z.object({
  visualObjectKind: visualRoleObjectKindSchema,
  sourceBearing: z.boolean(),
  allowedPackagingPolicies: z.array(scenePackagingPolicyV1Schema).min(1).max(4),
  requiredGroupKinds: z.array(sceneGroupKindV1Schema).min(1).max(8),
}).strict().superRefine((item, context) => {
  if (!unique(item.allowedPackagingPolicies) || !unique(item.requiredGroupKinds)) {
    context.addIssue({ code: "custom", path: [], message: "object policy lists must be unique" });
  }
});

export const sceneOperationCatalogItemV1Schema = z.object({
  operation: sceneProgressOperationV1Schema,
  label: z.string().trim().min(1).max(100),
  purpose: compactTextSchema,
  allowedMotionReasons: z.array(sceneMotionReasonCodeV1Schema).min(1).max(8),
}).strict().superRefine((item, context) => {
  if (!unique(item.allowedMotionReasons)) {
    context.addIssue({ code: "custom", path: ["allowedMotionReasons"], message: "motion reasons must be unique" });
  }
});

export function sceneDirectionCatalogV1Hash(catalog: unknown): string {
  return canonicalHash(catalog);
}

export const sceneDirectionCatalogV1Schema = z.object({
  schemaVersion: z.literal(1),
  catalogId: idSchema,
  catalogHash: hashSchema,
  version: z.literal(1),
  aspect: z.literal("LANDSCAPE_16_9"),
  theme: z.literal("TECH_HUD_DARK_V1"),
  informationRelations: z.array(sceneInformationRelationCatalogItemV1Schema).length(8),
  groupKinds: z.array(sceneGroupCatalogItemV1Schema).length(SCENE_GROUP_KINDS_V1.length),
  objectPolicies: z.array(sceneObjectPolicyCatalogItemV1Schema).length(13),
  operations: z.array(sceneOperationCatalogItemV1Schema).length(5),
  invariantCodes: z.array(idSchema).min(1).max(64),
}).strict().superRefine((catalog, context) => {
  for (const [path, values] of [
    ["informationRelations", catalog.informationRelations.map((item) => item.relationId)],
    ["groupKinds", catalog.groupKinds.map((item) => item.groupKind)],
    ["objectPolicies", catalog.objectPolicies.map((item) => item.visualObjectKind)],
    ["operations", catalog.operations.map((item) => item.operation)],
    ["invariantCodes", catalog.invariantCodes],
  ] as const) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [path], message: `${path} must be unique` });
  }
  const { schemaVersion: _schemaVersion, catalogHash: _catalogHash, ...semantic } = catalog;
  if (catalog.catalogHash !== sceneDirectionCatalogV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["catalogHash"], message: "catalog hash must match canonical content" });
  }
});

export const sceneDirectionFoundationObjectV1Schema = z.object({
  visualObjectId: idSchema,
  visualObjectHash: hashSchema,
  role: z.enum(["MAIN", "SUPPORTING"]),
  kind: visualRoleObjectKindSchema,
  layoutSlotId: layoutSlotIdV1Schema,
  normalizedFrame: normalizedFrameSchema,
  zIndex: z.number().int().min(0).max(100),
  personTreatment: z.enum(["NONE", "FULL_FRAME", "RECTANGULAR_PIP", "CIRCULAR_PIP"]),
  informationDuty: compactTextSchema,
  supportDuty: visualRoleSupportDutySchema.nullable(),
  strength: z.enum(["STRONG", "LIGHT"]).nullable(),
  content: jsonObjectSchema,
  evidenceWordIds: z.array(idSchema).min(1).max(64),
  sourceBindingHash: hashSchema,
}).strict().superRefine((object, context) => {
  if (!unique(object.evidenceWordIds)) {
    context.addIssue({ code: "custom", path: ["evidenceWordIds"], message: "object evidence ids must be unique" });
  }
});

export const sceneDirectionFoundationParagraphV1Schema = z.object({
  paragraphId: idSchema,
  paragraphFingerprint: hashSchema,
  order: z.number().int().nonnegative().max(511),
  visualParagraphType: z.string().trim().min(1).max(128),
  primaryExpressionTask: z.string().trim().min(1).max(128),
  informationDuty: compactTextSchema,
  wordRange: z.object({
    startWordId: idSchema,
    endWordId: idSchema,
    wordCount: z.number().int().positive().max(20_000),
  }).strict(),
  frameRange: frameRangeSchema,
  paragraphLayoutHash: hashSchema,
  selectedVariantId: layoutVariantIdV1Schema,
  selectedFamilyId: layoutFamilyIdV1Schema,
  geometryHash: hashSchema,
  objects: z.array(sceneDirectionFoundationObjectV1Schema).min(2).max(3),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.objects.map((object) => object.visualObjectId))
    || paragraph.objects.filter((object) => object.role === "MAIN").length !== 1
    || paragraph.objects.filter((object) => object.role === "SUPPORTING").length < 1) {
    context.addIssue({ code: "custom", path: ["objects"], message: "scene foundation requires one MAIN and one or two SUPPORT objects" });
  }
});

export function sceneDirectionFoundationV1Hash(foundation: unknown): string {
  return canonicalHash(foundation);
}

export const sceneDirectionFoundationV1Schema = z.object({
  schemaVersion: z.literal(1),
  foundationId: idSchema,
  foundationHash: hashSchema,
  projectAgentId: idSchema,
  contextPackId: idSchema,
  contextPackHash: hashSchema,
  projectConstitutionId: idSchema,
  projectConstitutionHash: hashSchema,
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: revisionSchema,
  timelineHash: hashSchema,
  visualParagraphProposalId: idSchema,
  visualParagraphProposalHash: hashSchema,
  masterTranscriptHash: hashSchema,
  transcriptWordCount: z.number().int().positive().max(1_000_000),
  visualRolePlanId: idSchema,
  visualRolePlanHash: hashSchema,
  materialManifestId: idSchema,
  materialManifestHash: hashSchema,
  layoutFoundationId: idSchema,
  layoutFoundationHash: hashSchema,
  layoutPlanId: idSchema,
  layoutPlanHash: hashSchema,
  layoutConfirmationId: idSchema,
  layoutConfirmationHash: hashSchema,
  catalogId: idSchema,
  catalogHash: hashSchema,
  canvas: z.object({
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
    framesPerSecond: z.number().positive().max(1_000),
  }).strict(),
  paragraphs: z.array(sceneDirectionFoundationParagraphV1Schema).min(1).max(512),
  createdAt: isoInstantSchema,
}).strict().superRefine((foundation, context) => {
  if (!unique(foundation.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "foundation paragraph ids must be unique" });
  }
  const { schemaVersion: _schemaVersion, foundationHash: _foundationHash, ...semantic } = foundation;
  if (foundation.foundationHash !== sceneDirectionFoundationV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["foundationHash"], message: "foundation hash must match canonical content" });
  }
});

export const sceneDirectionGroupItemSubmissionV1Schema = z.object({
  itemKey: localKeySchema,
  text: shortTextSchema,
  evidenceWordIds: z.array(idSchema).min(1).max(32),
}).strict().superRefine((item, context) => {
  if (!unique(item.evidenceWordIds)) {
    context.addIssue({ code: "custom", path: ["evidenceWordIds"], message: "item evidence ids must be unique" });
  }
});

export const sceneDirectionGroupSubmissionV1Schema = z.object({
  groupKey: localKeySchema,
  ownerVisualObjectId: idSchema.nullable(),
  groupKind: sceneGroupKindV1Schema,
  label: z.string().trim().min(1).max(100).nullable(),
  informationDuty: compactTextSchema,
  packagingPolicy: scenePackagingPolicyV1Schema,
  contentMode: sceneContentModeV1Schema,
  items: z.array(sceneDirectionGroupItemSubmissionV1Schema).max(12),
  rationale: compactTextSchema,
}).strict().superRefine((group, context) => {
  const isScaffold = ["HIGHLIGHT", "CONNECTOR_SET", "BACKGROUND_SCAFFOLD"].includes(group.groupKind);
  if (group.groupKind === "SOURCE_CARRIER") {
    if (group.ownerVisualObjectId === null || group.items.length !== 0 || group.contentMode !== "UPSTREAM_EXACT") {
      context.addIssue({ code: "custom", path: [], message: "source carrier must bind one upstream object without model-authored items" });
    }
  } else if (isScaffold) {
    if (group.items.length !== 0 || group.contentMode !== "NON_SEMANTIC") {
      context.addIssue({ code: "custom", path: [], message: "scaffold groups cannot carry semantic text" });
    }
  } else if (group.items.length === 0 || group.contentMode === "NON_SEMANTIC") {
    context.addIssue({ code: "custom", path: [], message: "semantic graphic groups require evidence-bound content" });
  }
});

const sceneBeatBase = {
  beatKey: localKeySchema,
  anchorWordId: idSchema,
  purpose: compactTextSchema,
  motionReason: sceneMotionReasonCodeV1Schema,
};

export const sceneDirectionBeatSubmissionV1Schema = z.discriminatedUnion("operation", [
  z.object({
    ...sceneBeatBase,
    operation: z.literal("ADD"),
    addGroupKeys: z.array(localKeySchema).min(1).max(16),
  }).strict(),
  z.object({
    ...sceneBeatBase,
    operation: z.literal("REPLACE"),
    removeGroupKeys: z.array(localKeySchema).min(1).max(16),
    addGroupKeys: z.array(localKeySchema).min(1).max(16),
  }).strict(),
  z.object({
    ...sceneBeatBase,
    operation: z.literal("TRANSFORM"),
    fromGroupKey: localKeySchema,
    toGroupKey: localKeySchema,
  }).strict(),
  z.object({
    ...sceneBeatBase,
    operation: z.literal("FOCUS"),
    focusGroupKey: localKeySchema,
  }).strict(),
  z.object({
    ...sceneBeatBase,
    operation: z.literal("CONCLUDE"),
    focusGroupKey: localKeySchema,
  }).strict(),
]);

export const sceneDirectionParagraphSubmissionV1Schema = z.object({
  paragraphId: idSchema,
  informationRelation: informationRelationIdV1Schema,
  relationRationale: compactTextSchema,
  groups: z.array(sceneDirectionGroupSubmissionV1Schema).min(2).max(24),
  beats: z.array(sceneDirectionBeatSubmissionV1Schema).min(2).max(32),
  evidenceRefs: z.array(z.object({ refId: idSchema, refHash: hashSchema }).strict()).min(1).max(16),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.groups.map((group) => group.groupKey))
    || !unique(paragraph.beats.map((beat) => beat.beatKey))
    || !unique(paragraph.evidenceRefs.map((ref) => ref.refId))) {
    context.addIssue({ code: "custom", path: [], message: "paragraph group, beat and evidence identities must be unique" });
  }
  if (paragraph.beats[0]?.operation !== "ADD" || paragraph.beats.at(-1)?.operation !== "CONCLUDE") {
    context.addIssue({ code: "custom", path: ["beats"], message: "scene progression must start with ADD and end with CONCLUDE" });
  }
});

export const sceneDirectionPlanSubmissionV1Schema = z.object({
  proposalId: idSchema,
  paragraphs: z.array(sceneDirectionParagraphSubmissionV1Schema).min(1).max(512),
  submittedAt: isoInstantSchema,
}).strict();

export const sceneDirectionPersistentGroupItemV1Schema = sceneDirectionGroupItemSubmissionV1Schema.extend({
  itemId: idSchema,
  itemHash: hashSchema,
}).strict().superRefine((item, context) => {
  const { itemHash: _itemHash, ...semantic } = item;
  if (item.itemHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["itemHash"], message: "item hash must match canonical content" });
  }
});

export const sceneDirectionPersistentGroupV1Schema = z.object({
  groupId: idSchema,
  groupHash: hashSchema,
  groupKey: localKeySchema,
  ownerVisualObjectId: idSchema.nullable(),
  groupKind: sceneGroupKindV1Schema,
  label: z.string().trim().min(1).max(100).nullable(),
  informationDuty: compactTextSchema,
  packagingPolicy: scenePackagingPolicyV1Schema,
  contentMode: sceneContentModeV1Schema,
  items: z.array(sceneDirectionPersistentGroupItemV1Schema).max(12),
  rationale: compactTextSchema,
}).strict().superRefine((group, context) => {
  if (!unique(group.items.map((item) => item.itemId)) || !unique(group.items.map((item) => item.itemKey))) {
    context.addIssue({ code: "custom", path: ["items"], message: "persistent group item identities must be unique" });
  }
  const { groupHash: _groupHash, ...semantic } = group;
  if (group.groupHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["groupHash"], message: "group hash must match canonical content" });
  }
});

export const sceneDirectionCompiledStateV1Schema = z.object({
  stateId: idSchema,
  stateHash: hashSchema,
  stateIndex: z.number().int().nonnegative().max(31),
  beatKey: localKeySchema,
  anchorWordId: idSchema,
  anchorFrame: revisionSchema,
  operation: sceneProgressOperationV1Schema,
  purpose: compactTextSchema,
  motionReason: sceneMotionReasonCodeV1Schema,
  visibleGroupIds: z.array(idSchema).min(1).max(24),
  enteringGroupIds: z.array(idSchema).max(16),
  exitingGroupIds: z.array(idSchema).max(16),
  transform: z.object({ fromGroupId: idSchema, toGroupId: idSchema }).strict().nullable(),
  focusGroupId: idSchema.nullable(),
}).strict().superRefine((state, context) => {
  if (!unique(state.visibleGroupIds) || !unique(state.enteringGroupIds) || !unique(state.exitingGroupIds)) {
    context.addIssue({ code: "custom", path: [], message: "compiled state group lists must be unique" });
  }
  const { stateHash: _stateHash, ...semantic } = state;
  if (state.stateHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["stateHash"], message: "state hash must match canonical content" });
  }
});

export function sceneDirectionPlanParagraphV1Hash(paragraph: unknown): string {
  return canonicalHash(paragraph);
}

export const sceneDirectionPlanParagraphV1Schema = z.object({
  paragraphId: idSchema,
  paragraphSceneHash: hashSchema,
  upstreamParagraphFingerprint: hashSchema,
  informationRelation: informationRelationIdV1Schema,
  relationRationale: compactTextSchema,
  groups: z.array(sceneDirectionPersistentGroupV1Schema).min(2).max(24),
  states: z.array(sceneDirectionCompiledStateV1Schema).min(2).max(32),
  evidenceRefs: z.array(z.object({ refId: idSchema, refHash: hashSchema }).strict()).min(1).max(16),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.groups.map((group) => group.groupId))
    || !unique(paragraph.groups.map((group) => group.groupKey))
    || !unique(paragraph.states.map((state) => state.stateId))
    || !unique(paragraph.evidenceRefs.map((ref) => ref.refId))) {
    context.addIssue({ code: "custom", path: [], message: "scene paragraph persistent identities must be unique" });
  }
  const { paragraphSceneHash: _paragraphSceneHash, ...semantic } = paragraph;
  if (paragraph.paragraphSceneHash !== sceneDirectionPlanParagraphV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["paragraphSceneHash"], message: "scene paragraph hash must match canonical content" });
  }
});

export function sceneDirectionPlanV1Hash(plan: unknown): string {
  return canonicalHash(plan);
}

export const sceneDirectionPlanV1Schema = z.object({
  schemaVersion: z.literal(1),
  planId: idSchema,
  planHash: hashSchema,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: revisionSchema,
  foundationId: idSchema,
  foundationHash: hashSchema,
  projectAgentId: idSchema,
  contextPackId: idSchema,
  contextPackHash: hashSchema,
  projectConstitutionHash: hashSchema,
  layoutPlanId: idSchema,
  layoutPlanHash: hashSchema,
  layoutConfirmationId: idSchema,
  layoutConfirmationHash: hashSchema,
  catalogId: idSchema,
  catalogHash: hashSchema,
  paragraphs: z.array(sceneDirectionPlanParagraphV1Schema).min(1).max(512),
  createdByTurnId: idSchema.nullable(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((plan, context) => {
  if (!unique(plan.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "scene plan paragraph ids must be unique" });
  }
  const { schemaVersion: _schemaVersion, planHash: _planHash, ...semantic } = plan;
  if (plan.planHash !== sceneDirectionPlanV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["planHash"], message: "scene plan hash must match canonical content" });
  }
});

export function sceneDirectionParagraphReviewV1Hash(review: unknown): string {
  return canonicalHash(review);
}

export const sceneDirectionParagraphReviewV1Schema = z.object({
  schemaVersion: z.literal(1),
  reviewId: idSchema,
  reviewHash: hashSchema,
  planId: idSchema,
  planHash: hashSchema,
  paragraphId: idSchema,
  paragraphSceneHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  reviewedAt: isoInstantSchema,
}).strict().superRefine((review, context) => {
  if ((review.decision === "REJECT") !== (review.reason !== null)) {
    context.addIssue({ code: "custom", path: ["reason"], message: "only rejected reviews require one reason" });
  }
  const { schemaVersion: _schemaVersion, reviewHash: _reviewHash, ...semantic } = review;
  if (review.reviewHash !== sceneDirectionParagraphReviewV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["reviewHash"], message: "review hash must match canonical content" });
  }
});

export function sceneDirectionConfirmationV1Hash(confirmation: unknown): string {
  return canonicalHash(confirmation);
}

export const sceneDirectionConfirmationV1Schema = z.object({
  schemaVersion: z.literal(1),
  confirmationId: idSchema,
  confirmationHash: hashSchema,
  planId: idSchema,
  planHash: hashSchema,
  foundationHash: hashSchema,
  catalogHash: hashSchema,
  paragraphReviewHashes: z.array(hashSchema).min(1).max(512),
  status: z.enum(["CONFIRMED", "EXPIRED"]),
  confirmedAt: isoInstantSchema,
  expiredAt: isoInstantSchema.nullable(),
}).strict().superRefine((confirmation, context) => {
  if (!unique(confirmation.paragraphReviewHashes)
    || (confirmation.status === "CONFIRMED") !== (confirmation.expiredAt === null)) {
    context.addIssue({ code: "custom", path: [], message: "scene confirmation state is inconsistent" });
  }
  const { schemaVersion: _schemaVersion, confirmationHash: _confirmationHash, ...semantic } = confirmation;
  if (confirmation.confirmationHash !== sceneDirectionConfirmationV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["confirmationHash"], message: "confirmation hash must match canonical content" });
  }
});

export const sceneDirectionPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  currentPlanId: idSchema.nullable(),
  plans: z.array(sceneDirectionPlanV1Schema).max(256),
  paragraphReviews: z.array(sceneDirectionParagraphReviewV1Schema).max(8_192),
  confirmations: z.array(sceneDirectionConfirmationV1Schema).max(256),
}).strict().superRefine((state, context) => {
  if (!unique(state.plans.map((plan) => plan.planId))
    || !unique(state.paragraphReviews.map((review) => review.reviewId))
    || !unique(state.confirmations.map((confirmation) => confirmation.confirmationId))) {
    context.addIssue({ code: "custom", path: [], message: "scene state identities must be unique" });
  }
  if (state.currentPlanId !== null && !state.plans.some((plan) => plan.planId === state.currentPlanId)) {
    context.addIssue({ code: "custom", path: ["currentPlanId"], message: "current scene plan must exist" });
  }
});

export const reviewSceneDirectionParagraphRequestSchema = z.object({
  expectedRevision: revisionSchema,
  planId: idSchema,
  planHash: hashSchema,
  paragraphId: idSchema,
  paragraphSceneHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  reviewedAt: isoInstantSchema,
}).strict();

export const confirmSceneDirectionReviewRequestSchema = z.object({
  expectedRevision: revisionSchema,
  planId: idSchema,
  planHash: hashSchema,
  foundationId: idSchema,
  foundationHash: hashSchema,
  catalogId: idSchema,
  catalogHash: hashSchema,
  confirmed: z.literal(true),
  confirmedAt: isoInstantSchema,
}).strict();

export type InformationRelationIdV1 = z.infer<typeof informationRelationIdV1Schema>;
export type SceneGroupKindV1 = z.infer<typeof sceneGroupKindV1Schema>;
export type ScenePackagingPolicyV1 = z.infer<typeof scenePackagingPolicyV1Schema>;
export type SceneProgressOperationV1 = z.infer<typeof sceneProgressOperationV1Schema>;
export type SceneDirectionCatalogV1 = z.infer<typeof sceneDirectionCatalogV1Schema>;
export type SceneDirectionFoundationV1 = z.infer<typeof sceneDirectionFoundationV1Schema>;
export type SceneDirectionFoundationParagraphV1 = z.infer<typeof sceneDirectionFoundationParagraphV1Schema>;
export type SceneDirectionParagraphSubmissionV1 = z.infer<typeof sceneDirectionParagraphSubmissionV1Schema>;
export type SceneDirectionPlanSubmissionV1 = z.infer<typeof sceneDirectionPlanSubmissionV1Schema>;
export type SceneDirectionPersistentGroupV1 = z.infer<typeof sceneDirectionPersistentGroupV1Schema>;
export type SceneDirectionCompiledStateV1 = z.infer<typeof sceneDirectionCompiledStateV1Schema>;
export type SceneDirectionPlanParagraphV1 = z.infer<typeof sceneDirectionPlanParagraphV1Schema>;
export type SceneDirectionPlanV1 = z.infer<typeof sceneDirectionPlanV1Schema>;
export type SceneDirectionParagraphReviewV1 = z.infer<typeof sceneDirectionParagraphReviewV1Schema>;
export type SceneDirectionConfirmationV1 = z.infer<typeof sceneDirectionConfirmationV1Schema>;
export type SceneDirectionPersistentStateV1 = z.infer<typeof sceneDirectionPersistentStateV1Schema>;
export type ReviewSceneDirectionParagraphRequest = z.infer<typeof reviewSceneDirectionParagraphRequestSchema>;
export type ConfirmSceneDirectionReviewRequest = z.infer<typeof confirmSceneDirectionReviewRequestSchema>;
