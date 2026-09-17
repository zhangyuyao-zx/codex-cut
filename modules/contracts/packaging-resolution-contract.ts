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
  sceneGroupKindV1Schema,
  sceneMotionReasonCodeV1Schema,
  scenePackagingPolicyV1Schema,
  sceneProgressOperationV1Schema,
} from "./scene-direction-contract.js";
import { visualRoleObjectKindSchema } from "./visual-role-contract.js";

const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const compactTextSchema = z.string().trim().min(1).max(1_000);
const shortTextSchema = z.string().trim().min(1).max(200);

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const PACKAGING_RESOLUTION_COMPONENT_SOURCES_V1 = [
  "PILOT_PRIMITIVE",
  "NEW_CORE",
] as const;

export const PACKAGING_RESOLUTION_RENDERER_KINDS_V1 = [
  "DOM_CLASS",
  "REMOTION_REACT",
] as const;

export const PACKAGING_RESOLUTION_SELECTION_AUTHORITIES_V1 = [
  "HOST_LAYOUT_PROJECTION",
  "PROJECT_AGENT_EXPLICIT",
] as const;

export const PACKAGING_RESOLUTION_FIDELITY_POLICIES_V1 = [
  "PRESERVE_SOURCE",
  "CONTAINER_ONLY",
  "DESIGNED_GRAPHIC",
  "SCENE_SURFACE",
  "BOUNDARY",
] as const;

export const PACKAGING_RESOLUTION_DISPOSITIONS_V1 = [
  "HOST_PRESERVED",
  "SELECTED",
  "BLOCKED_COMPONENT_GAP",
] as const;

export const packagingResolutionComponentSourceV1Schema = z.enum(
  PACKAGING_RESOLUTION_COMPONENT_SOURCES_V1,
);
export const packagingResolutionRendererKindV1Schema = z.enum(
  PACKAGING_RESOLUTION_RENDERER_KINDS_V1,
);
export const packagingResolutionSelectionAuthorityV1Schema = z.enum(
  PACKAGING_RESOLUTION_SELECTION_AUTHORITIES_V1,
);
export const packagingResolutionFidelityPolicyV1Schema = z.enum(
  PACKAGING_RESOLUTION_FIDELITY_POLICIES_V1,
);
export const packagingResolutionDispositionV1Schema = z.enum(
  PACKAGING_RESOLUTION_DISPOSITIONS_V1,
);

export const packagingResolutionCapacityV1Schema = z.object({
  minimumItems: z.number().int().nonnegative().max(64).nullable(),
  maximumItems: z.number().int().nonnegative().max(64).nullable(),
  maximumTextCharacters: z.number().int().positive().max(10_000).nullable(),
}).strict().superRefine((capacity, context) => {
  if (capacity.minimumItems !== null && capacity.maximumItems !== null
    && capacity.minimumItems > capacity.maximumItems) {
    context.addIssue({ code: "custom", path: [], message: "component capacity range is invalid" });
  }
});

export function packagingResolutionComponentEntryV1Hash(entry: unknown): string {
  return canonicalHash(entry);
}

export const packagingResolutionComponentEntryV1Schema = z.object({
  componentId: idSchema,
  componentHash: hashSchema,
  source: packagingResolutionComponentSourceV1Schema,
  sourceComponentId: idSchema,
  label: shortTextSchema,
  purpose: compactTextSchema,
  lifecycle: z.literal("LAB_VERIFIED"),
  visibility: z.literal("PROJECT_AUDITION_ONLY"),
  selectionAuthority: packagingResolutionSelectionAuthorityV1Schema,
  rendererKind: packagingResolutionRendererKindV1Schema,
  rendererId: idSchema,
  implementationHash: hashSchema,
  fidelityPolicy: packagingResolutionFidelityPolicyV1Schema,
  compatibleGroupKinds: z.array(sceneGroupKindV1Schema).max(14),
  compatibleObjectKinds: z.array(visualRoleObjectKindSchema).max(13),
  compatibleRoles: z.array(z.enum(["MAIN", "SUPPORTING"])).max(2),
  compatiblePackagingPolicies: z.array(scenePackagingPolicyV1Schema).max(4),
  allowedMotionReasons: z.array(sceneMotionReasonCodeV1Schema).max(8),
  evidenceRequirements: z.array(idSchema).max(16),
  capacity: packagingResolutionCapacityV1Schema,
  requiresExplicitSpatialAnchor: z.boolean(),
  projectAuditionEnabled: z.boolean(),
  globallyBlockedReasonCodes: z.array(idSchema).max(16),
}).strict().superRefine((entry, context) => {
  for (const [path, values] of [
    ["compatibleGroupKinds", entry.compatibleGroupKinds],
    ["compatibleObjectKinds", entry.compatibleObjectKinds],
    ["compatibleRoles", entry.compatibleRoles],
    ["compatiblePackagingPolicies", entry.compatiblePackagingPolicies],
    ["allowedMotionReasons", entry.allowedMotionReasons],
    ["evidenceRequirements", entry.evidenceRequirements],
    ["globallyBlockedReasonCodes", entry.globallyBlockedReasonCodes],
  ] as const) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [path], message: `${path} must be unique` });
  }
  if (entry.projectAuditionEnabled === (entry.globallyBlockedReasonCodes.length > 0)) {
    context.addIssue({ code: "custom", path: ["projectAuditionEnabled"], message: "audition availability and blockers disagree" });
  }
  const { componentHash: _componentHash, ...semantic } = entry;
  if (entry.componentHash !== packagingResolutionComponentEntryV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["componentHash"], message: "component hash must match canonical content" });
  }
});

export function packagingResolutionCatalogV1Hash(catalog: unknown): string {
  return canonicalHash(catalog);
}

export const packagingResolutionCatalogV1Schema = z.object({
  schemaVersion: z.literal(1),
  catalogId: idSchema,
  catalogHash: hashSchema,
  version: z.literal(1),
  aspect: z.literal("LANDSCAPE_16_9"),
  lifecycle: z.literal("PROJECT_AUDITION"),
  sourceComponentCount: z.literal(40),
  productionRegistryEntryCount: z.literal(0),
  agentSelectionRequired: z.literal(true),
  hostRankingForbidden: z.literal(true),
  entries: z.array(packagingResolutionComponentEntryV1Schema).length(40),
  invariantCodes: z.array(idSchema).min(1).max(64),
}).strict().superRefine((catalog, context) => {
  if (!unique(catalog.entries.map((entry) => entry.componentId))
    || !unique(catalog.entries.map((entry) => entry.sourceComponentId))
    || !unique(catalog.invariantCodes)) {
    context.addIssue({ code: "custom", path: [], message: "catalog identities and invariants must be unique" });
  }
  const { schemaVersion: _schemaVersion, catalogHash: _catalogHash, ...semantic } = catalog;
  if (catalog.catalogHash !== packagingResolutionCatalogV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["catalogHash"], message: "catalog hash must match canonical content" });
  }
});

export function packagingResolutionTargetV1Hash(target: unknown): string {
  return canonicalHash(target);
}

export const packagingResolutionTargetV1Schema = z.object({
  targetId: idSchema,
  targetHash: hashSchema,
  paragraphId: idSchema,
  groupId: idSchema,
  groupHash: hashSchema,
  groupKind: sceneGroupKindV1Schema,
  packagingPolicy: scenePackagingPolicyV1Schema,
  ownerVisualObjectId: idSchema.nullable(),
  ownerKind: visualRoleObjectKindSchema.nullable(),
  ownerRole: z.enum(["MAIN", "SUPPORTING"]).nullable(),
  informationDuty: compactTextSchema,
  label: shortTextSchema.nullable(),
  items: z.array(z.object({
    itemId: idSchema,
    itemHash: hashSchema,
    text: shortTextSchema,
    evidenceWordIds: z.array(idSchema).min(1).max(32),
  }).strict()).max(12),
  operations: z.array(sceneProgressOperationV1Schema).min(1).max(5),
  motionReasons: z.array(sceneMotionReasonCodeV1Schema).min(1).max(8),
  compatibleComponentIds: z.array(idSchema).max(40),
  requiredDisposition: packagingResolutionDispositionV1Schema,
  hostProjectionComponentId: idSchema.nullable(),
  blockedReasonCodes: z.array(idSchema).max(32),
}).strict().superRefine((target, context) => {
  for (const [path, values] of [
    ["items", target.items.map((item) => item.itemId)],
    ["operations", target.operations],
    ["motionReasons", target.motionReasons],
    ["compatibleComponentIds", target.compatibleComponentIds],
    ["blockedReasonCodes", target.blockedReasonCodes],
  ] as const) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [path], message: `${path} must be unique` });
  }
  if (target.requiredDisposition === "SELECTED" && target.compatibleComponentIds.length === 0) {
    context.addIssue({ code: "custom", path: ["compatibleComponentIds"], message: "selected targets require compatible candidates" });
  }
  if (target.requiredDisposition !== "SELECTED" && target.compatibleComponentIds.length > 0) {
    context.addIssue({ code: "custom", path: ["requiredDisposition"], message: "non-selected targets cannot expose selectable candidates" });
  }
  if (target.requiredDisposition === "HOST_PRESERVED" && target.groupKind !== "SOURCE_CARRIER") {
    context.addIssue({ code: "custom", path: ["requiredDisposition"], message: "only source carriers may be host preserved" });
  }
  const { targetHash: _targetHash, ...semantic } = target;
  if (target.targetHash !== packagingResolutionTargetV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["targetHash"], message: "target hash must match canonical content" });
  }
});

export const packagingResolutionFoundationParagraphV1Schema = z.object({
  paragraphId: idSchema,
  paragraphFingerprint: hashSchema,
  order: z.number().int().nonnegative().max(511),
  sceneParagraphHash: hashSchema,
  informationRelation: z.string().min(1).max(128),
  frameRange: frameRangeSchema,
  targets: z.array(packagingResolutionTargetV1Schema).min(2).max(24),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.targets.map((target) => target.targetId))
    || !unique(paragraph.targets.map((target) => target.groupId))) {
    context.addIssue({ code: "custom", path: ["targets"], message: "paragraph targets must be unique" });
  }
});

export function packagingResolutionFoundationV1Hash(foundation: unknown): string {
  return canonicalHash(foundation);
}

export const packagingResolutionFoundationV1Schema = z.object({
  schemaVersion: z.literal(1),
  foundationId: idSchema,
  foundationHash: hashSchema,
  projectAgentId: idSchema,
  contextPackId: idSchema,
  contextPackHash: hashSchema,
  projectConstitutionHash: hashSchema,
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: revisionSchema,
  timelineHash: hashSchema,
  sceneDirectionFoundationId: idSchema,
  sceneDirectionFoundationHash: hashSchema,
  sceneDirectionPlanId: idSchema,
  sceneDirectionPlanHash: hashSchema,
  sceneDirectionConfirmationId: idSchema,
  sceneDirectionConfirmationHash: hashSchema,
  componentCatalogId: idSchema,
  componentCatalogHash: hashSchema,
  productionRegistryHash: hashSchema,
  productionRegistryEntryCount: z.literal(0),
  canvas: z.object({
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
    framesPerSecond: z.number().positive().max(1_000),
  }).strict(),
  paragraphs: z.array(packagingResolutionFoundationParagraphV1Schema).min(1).max(512),
  createdAt: isoInstantSchema,
}).strict().superRefine((foundation, context) => {
  if (!unique(foundation.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "foundation paragraphs must be unique" });
  }
  const { schemaVersion: _schemaVersion, foundationHash: _foundationHash, ...semantic } = foundation;
  if (foundation.foundationHash !== packagingResolutionFoundationV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["foundationHash"], message: "foundation hash must match canonical content" });
  }
});

export const packagingResolutionTargetSubmissionV1Schema = z.object({
  targetId: idSchema,
  disposition: packagingResolutionDispositionV1Schema,
  componentId: idSchema.nullable(),
  rationale: compactTextSchema,
  controls: z.object({
    intensity: z.number().min(0).max(1),
    durationFrames: z.number().int().min(30).max(360),
    reducedMotion: z.boolean(),
  }).strict().nullable(),
}).strict().superRefine((selection, context) => {
  if ((selection.disposition === "SELECTED") !== (selection.componentId !== null && selection.controls !== null)) {
    context.addIssue({ code: "custom", path: [], message: "only selected targets carry a component and controls" });
  }
});

export const packagingResolutionParagraphSubmissionV1Schema = z.object({
  paragraphId: idSchema,
  targets: z.array(packagingResolutionTargetSubmissionV1Schema).min(2).max(24),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.targets.map((target) => target.targetId))) {
    context.addIssue({ code: "custom", path: ["targets"], message: "submitted target ids must be unique" });
  }
});

export const packagingResolutionPlanSubmissionV1Schema = z.object({
  proposalId: idSchema,
  paragraphs: z.array(packagingResolutionParagraphSubmissionV1Schema).min(1).max(512),
  submittedAt: isoInstantSchema,
}).strict();

export const packagingResolutionBindingV1Schema = z.object({
  bindingId: idSchema,
  bindingHash: hashSchema,
  targetId: idSchema,
  targetHash: hashSchema,
  groupId: idSchema,
  groupHash: hashSchema,
  disposition: packagingResolutionDispositionV1Schema,
  componentId: idSchema.nullable(),
  componentHash: hashSchema.nullable(),
  rendererKind: packagingResolutionRendererKindV1Schema.nullable(),
  rendererId: idSchema.nullable(),
  resolvedInput: jsonObjectSchema.nullable(),
  controls: packagingResolutionTargetSubmissionV1Schema.shape.controls,
  rationale: compactTextSchema,
  previewHash: hashSchema,
  status: z.enum(["READY", "BLOCKED"]),
  reasonCodes: z.array(idSchema).max(32),
}).strict().superRefine((binding, context) => {
  const selected = binding.disposition === "SELECTED";
  if (selected !== (binding.componentId !== null
    && binding.componentHash !== null
    && binding.rendererKind !== null
    && binding.rendererId !== null
    && binding.resolvedInput !== null
    && binding.controls !== null)) {
    context.addIssue({ code: "custom", path: [], message: "selected binding fields are incomplete" });
  }
  if ((binding.status === "READY") === (binding.reasonCodes.length > 0)) {
    context.addIssue({ code: "custom", path: ["status"], message: "binding readiness and reasons disagree" });
  }
  const { bindingHash: _bindingHash, ...semantic } = binding;
  if (binding.bindingHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["bindingHash"], message: "binding hash must match canonical content" });
  }
});

export function packagingResolutionPlanParagraphV1Hash(paragraph: unknown): string {
  return canonicalHash(paragraph);
}

export const packagingResolutionPlanParagraphV1Schema = z.object({
  paragraphId: idSchema,
  paragraphResolutionHash: hashSchema,
  upstreamParagraphFingerprint: hashSchema,
  bindings: z.array(packagingResolutionBindingV1Schema).min(2).max(24),
  selectedComponentIds: z.array(idSchema).max(24),
  previewHash: hashSchema,
  preflight: z.object({
    status: z.enum(["READY_FOR_PROJECT_AUDITION", "BLOCKED_COMPONENT_GAPS"]),
    blockedTargetIds: z.array(idSchema).max(24),
    reasonCodes: z.array(idSchema).max(64),
  }).strict(),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.bindings.map((binding) => binding.bindingId))
    || !unique(paragraph.bindings.map((binding) => binding.targetId))
    || !unique(paragraph.selectedComponentIds)
    || !unique(paragraph.preflight.blockedTargetIds)
    || !unique(paragraph.preflight.reasonCodes)) {
    context.addIssue({ code: "custom", path: [], message: "resolution paragraph identities must be unique" });
  }
  if ((paragraph.preflight.status === "READY_FOR_PROJECT_AUDITION")
    !== (paragraph.preflight.blockedTargetIds.length === 0 && paragraph.preflight.reasonCodes.length === 0)) {
    context.addIssue({ code: "custom", path: ["preflight"], message: "paragraph preflight is inconsistent" });
  }
  const { paragraphResolutionHash: _paragraphResolutionHash, ...semantic } = paragraph;
  if (paragraph.paragraphResolutionHash !== packagingResolutionPlanParagraphV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["paragraphResolutionHash"], message: "paragraph resolution hash must match canonical content" });
  }
});

export function packagingResolutionPlanV1Hash(plan: unknown): string {
  return canonicalHash(plan);
}

export const packagingResolutionPlanV1Schema = z.object({
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
  sceneDirectionPlanId: idSchema,
  sceneDirectionPlanHash: hashSchema,
  sceneDirectionConfirmationId: idSchema,
  sceneDirectionConfirmationHash: hashSchema,
  componentCatalogId: idSchema,
  componentCatalogHash: hashSchema,
  productionRegistryHash: hashSchema,
  paragraphs: z.array(packagingResolutionPlanParagraphV1Schema).min(1).max(512),
  outcome: z.enum(["READY_FOR_PROJECT_AUDITION", "BLOCKED_COMPONENT_GAPS"]),
  createdByTurnId: idSchema.nullable(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((plan, context) => {
  if (!unique(plan.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "plan paragraphs must be unique" });
  }
  const ready = plan.paragraphs.every((paragraph) => paragraph.preflight.status === "READY_FOR_PROJECT_AUDITION");
  if ((plan.outcome === "READY_FOR_PROJECT_AUDITION") !== ready) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "plan outcome must match paragraph preflight" });
  }
  const { schemaVersion: _schemaVersion, planHash: _planHash, ...semantic } = plan;
  if (plan.planHash !== packagingResolutionPlanV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["planHash"], message: "plan hash must match canonical content" });
  }
});

export function packagingResolutionParagraphReviewV1Hash(review: unknown): string {
  return canonicalHash(review);
}

export const packagingResolutionParagraphReviewV1Schema = z.object({
  schemaVersion: z.literal(1),
  reviewId: idSchema,
  reviewHash: hashSchema,
  planId: idSchema,
  planHash: hashSchema,
  paragraphId: idSchema,
  paragraphResolutionHash: hashSchema,
  previewHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  reviewedAt: isoInstantSchema,
}).strict().superRefine((review, context) => {
  if ((review.decision === "REJECT") !== (review.reason !== null)) {
    context.addIssue({ code: "custom", path: ["reason"], message: "only rejected reviews require a reason" });
  }
  const { schemaVersion: _schemaVersion, reviewHash: _reviewHash, ...semantic } = review;
  if (review.reviewHash !== packagingResolutionParagraphReviewV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["reviewHash"], message: "review hash must match canonical content" });
  }
});

export function packagingResolutionConfirmationV1Hash(confirmation: unknown): string {
  return canonicalHash(confirmation);
}

export const packagingResolutionConfirmationV1Schema = z.object({
  schemaVersion: z.literal(1),
  confirmationId: idSchema,
  confirmationHash: hashSchema,
  planId: idSchema,
  planHash: hashSchema,
  foundationHash: hashSchema,
  componentCatalogHash: hashSchema,
  paragraphReviewHashes: z.array(hashSchema).min(1).max(512),
  auditionScope: z.literal("PROJECT_PLAN_ONLY"),
  componentLifecyclePromoted: z.literal(false),
  productionRegistryModified: z.literal(false),
  status: z.enum(["CONFIRMED", "EXPIRED"]),
  confirmedAt: isoInstantSchema,
  expiredAt: isoInstantSchema.nullable(),
}).strict().superRefine((confirmation, context) => {
  if (!unique(confirmation.paragraphReviewHashes)
    || (confirmation.status === "CONFIRMED") !== (confirmation.expiredAt === null)) {
    context.addIssue({ code: "custom", path: [], message: "resolution confirmation is inconsistent" });
  }
  const { schemaVersion: _schemaVersion, confirmationHash: _confirmationHash, ...semantic } = confirmation;
  if (confirmation.confirmationHash !== packagingResolutionConfirmationV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["confirmationHash"], message: "confirmation hash must match canonical content" });
  }
});

export const packagingResolutionPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  currentPlanId: idSchema.nullable(),
  plans: z.array(packagingResolutionPlanV1Schema).max(256),
  paragraphReviews: z.array(packagingResolutionParagraphReviewV1Schema).max(8_192),
  confirmations: z.array(packagingResolutionConfirmationV1Schema).max(256),
}).strict().superRefine((state, context) => {
  if (!unique(state.plans.map((plan) => plan.planId))
    || !unique(state.paragraphReviews.map((review) => review.reviewId))
    || !unique(state.confirmations.map((confirmation) => confirmation.confirmationId))) {
    context.addIssue({ code: "custom", path: [], message: "persistent resolution identities must be unique" });
  }
  if (state.currentPlanId !== null && !state.plans.some((plan) => plan.planId === state.currentPlanId)) {
    context.addIssue({ code: "custom", path: ["currentPlanId"], message: "current resolution plan must exist" });
  }
});

export const reviewPackagingResolutionParagraphRequestSchema = z.object({
  expectedRevision: revisionSchema,
  planId: idSchema,
  planHash: hashSchema,
  paragraphId: idSchema,
  paragraphResolutionHash: hashSchema,
  previewHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  reviewedAt: isoInstantSchema,
}).strict();

export const confirmPackagingResolutionReviewRequestSchema = z.object({
  expectedRevision: revisionSchema,
  planId: idSchema,
  planHash: hashSchema,
  foundationId: idSchema,
  foundationHash: hashSchema,
  componentCatalogId: idSchema,
  componentCatalogHash: hashSchema,
  confirmed: z.literal(true),
  confirmedAt: isoInstantSchema,
}).strict();

export type PackagingResolutionComponentEntryV1 = z.infer<typeof packagingResolutionComponentEntryV1Schema>;
export type PackagingResolutionCatalogV1 = z.infer<typeof packagingResolutionCatalogV1Schema>;
export type PackagingResolutionTargetV1 = z.infer<typeof packagingResolutionTargetV1Schema>;
export type PackagingResolutionFoundationV1 = z.infer<typeof packagingResolutionFoundationV1Schema>;
export type PackagingResolutionFoundationParagraphV1 = z.infer<typeof packagingResolutionFoundationParagraphV1Schema>;
export type PackagingResolutionTargetSubmissionV1 = z.infer<typeof packagingResolutionTargetSubmissionV1Schema>;
export type PackagingResolutionParagraphSubmissionV1 = z.infer<typeof packagingResolutionParagraphSubmissionV1Schema>;
export type PackagingResolutionPlanSubmissionV1 = z.infer<typeof packagingResolutionPlanSubmissionV1Schema>;
export type PackagingResolutionBindingV1 = z.infer<typeof packagingResolutionBindingV1Schema>;
export type PackagingResolutionPlanParagraphV1 = z.infer<typeof packagingResolutionPlanParagraphV1Schema>;
export type PackagingResolutionPlanV1 = z.infer<typeof packagingResolutionPlanV1Schema>;
export type PackagingResolutionParagraphReviewV1 = z.infer<typeof packagingResolutionParagraphReviewV1Schema>;
export type PackagingResolutionConfirmationV1 = z.infer<typeof packagingResolutionConfirmationV1Schema>;
export type PackagingResolutionPersistentStateV1 = z.infer<typeof packagingResolutionPersistentStateV1Schema>;
export type ReviewPackagingResolutionParagraphRequest = z.infer<typeof reviewPackagingResolutionParagraphRequestSchema>;
export type ConfirmPackagingResolutionReviewRequest = z.infer<typeof confirmPackagingResolutionReviewRequestSchema>;
