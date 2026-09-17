import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  frameRangeSchema,
  hashSchema,
  idSchema,
  isoInstantSchema,
  jsonObjectSchema,
} from "../shared/timeline-v2/schema.js";
import { layoutGeometryV1Schema } from "./layout-contract.js";
import { packagingResolutionPlanParagraphV1Schema } from "./packaging-resolution-contract.js";
import {
  informationRelationIdV1Schema,
  sceneDirectionCompiledStateV1Schema,
  sceneDirectionFoundationObjectV1Schema,
  sceneDirectionPersistentGroupV1Schema,
} from "./scene-direction-contract.js";

const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const PACKAGING_IMPLEMENTATION_ADAPTER_IDS_V1 = [
  "adapter:g2-v1:host-source-passthrough",
  "adapter:g2-v1:text-clean-card",
  "adapter:g2-v1:text-mini-explanation",
] as const;

export const packagingImplementationAdapterIdV1Schema = z.enum(
  PACKAGING_IMPLEMENTATION_ADAPTER_IDS_V1,
);

export function packagingImplementationAdapterV1Hash(adapter: unknown): string {
  return canonicalHash(adapter);
}

export const packagingImplementationAdapterV1Schema = z.object({
  adapterId: packagingImplementationAdapterIdV1Schema,
  adapterVersion: z.literal(1),
  backend: z.enum(["HOST_SOURCE", "REMOTION_FRAME_DRIVEN"]),
  componentId: idSchema.nullable(),
  sourceRendererId: idSchema.nullable(),
  implementationHash: hashSchema,
  supportedAspect: z.literal("LANDSCAPE_16_9"),
  capacity: z.object({
    minimumItems: z.number().int().nonnegative().max(8),
    maximumItems: z.number().int().nonnegative().max(8),
    maximumTextCharacters: z.number().int().nonnegative().max(1_000),
  }).strict(),
  motionContract: z.enum(["PASSTHROUGH", "CARD_REVEAL_HOLD_EXIT", "STAGGERED_ITEMS_REVEAL_HOLD_EXIT"]),
}).strict().superRefine((adapter, context) => {
  if (adapter.capacity.minimumItems > adapter.capacity.maximumItems) {
    context.addIssue({ code: "custom", path: ["capacity"], message: "adapter capacity is invalid" });
  }
  const isHost = adapter.adapterId === "adapter:g2-v1:host-source-passthrough";
  if (isHost !== (adapter.backend === "HOST_SOURCE" && adapter.componentId === null && adapter.sourceRendererId === null)) {
    context.addIssue({ code: "custom", path: ["backend"], message: "host adapter identity is inconsistent" });
  }
  const { implementationHash: _implementationHash, ...semantic } = adapter;
  if (adapter.implementationHash !== packagingImplementationAdapterV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["implementationHash"], message: "adapter implementation hash must match canonical content" });
  }
});

export const packagingImplementationDesignParagraphV1Schema = z.object({
  paragraphId: idSchema,
  paragraphFingerprint: hashSchema,
  paragraphSceneHash: hashSchema,
  paragraphLayoutHash: hashSchema,
  geometryHash: hashSchema,
  informationRelation: informationRelationIdV1Schema,
  frameRange: frameRangeSchema,
  captionExclusionRegion: layoutGeometryV1Schema.shape.captionExclusionRegion,
  objects: z.array(sceneDirectionFoundationObjectV1Schema).min(2).max(3),
  groups: z.array(sceneDirectionPersistentGroupV1Schema).min(2).max(24),
  states: z.array(sceneDirectionCompiledStateV1Schema).min(2).max(32),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.objects.map((object) => object.visualObjectId))
    || !unique(paragraph.groups.map((group) => group.groupId))
    || !unique(paragraph.states.map((state) => state.stateId))) {
    context.addIssue({ code: "custom", path: [], message: "design paragraph identities must be unique" });
  }
});

export function packagingImplementationDesignV1Hash(design: unknown): string {
  return canonicalHash(design);
}

export const packagingImplementationDesignV1Schema = z.object({
  schemaVersion: z.literal(1),
  aspect: z.literal("LANDSCAPE_16_9"),
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
  layoutPlanId: idSchema,
  layoutPlanHash: hashSchema,
  layoutConfirmationId: idSchema,
  layoutConfirmationHash: hashSchema,
  canvas: z.object({
    width: z.literal(1920),
    height: z.literal(1080),
    framesPerSecond: z.number().positive().max(1_000),
  }).strict(),
  paragraphs: z.array(packagingImplementationDesignParagraphV1Schema).min(1).max(512),
}).strict().superRefine((design, context) => {
  if (!unique(design.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "design paragraph ids must be unique" });
  }
});

export function packagingImplementationResolutionV1Hash(resolution: unknown): string {
  return canonicalHash(resolution);
}

export const packagingImplementationResolutionV1Schema = z.object({
  schemaVersion: z.literal(1),
  packagingResolutionFoundationId: idSchema,
  packagingResolutionFoundationHash: hashSchema,
  packagingResolutionPlanId: idSchema,
  packagingResolutionPlanHash: hashSchema,
  packagingResolutionConfirmationId: idSchema,
  packagingResolutionConfirmationHash: hashSchema,
  componentCatalogId: idSchema,
  componentCatalogHash: hashSchema,
  productionRegistryHash: hashSchema,
  productionRegistryEntryCount: z.literal(0),
  auditionScope: z.literal("PROJECT_PLAN_ONLY"),
  componentLifecyclePromoted: z.literal(false),
  adapters: z.array(packagingImplementationAdapterV1Schema).min(1).max(3),
  paragraphs: z.array(packagingResolutionPlanParagraphV1Schema).min(1).max(512),
}).strict().superRefine((resolution, context) => {
  if (!unique(resolution.adapters.map((adapter) => adapter.adapterId))
    || !unique(resolution.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: [], message: "resolution identities must be unique" });
  }
});

export const packagingImplementationStateWindowV1Schema = z.object({
  stateId: idSchema,
  stateHash: hashSchema,
  startFrame: revisionSchema,
  endFrame: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  visibleGroupIds: z.array(idSchema).min(1).max(24),
  enteringGroupIds: z.array(idSchema).max(16),
  exitingGroupIds: z.array(idSchema).max(16),
  focusGroupId: idSchema.nullable(),
}).strict().superRefine((window, context) => {
  if (window.endFrame <= window.startFrame) {
    context.addIssue({ code: "custom", path: ["endFrame"], message: "state window must have positive duration" });
  }
});

export const packagingImplementationRenderLayerV1Schema = z.object({
  layerId: idSchema,
  layerHash: hashSchema,
  groupId: idSchema,
  groupHash: hashSchema,
  groupKind: z.string().min(1).max(128),
  ownerVisualObjectId: idSchema.nullable(),
  ownerVisualObjectHash: hashSchema.nullable(),
  sourceBindingHash: hashSchema.nullable(),
  frame: sceneDirectionFoundationObjectV1Schema.shape.normalizedFrame,
  zIndex: z.number().int().min(0).max(100),
  personTreatment: sceneDirectionFoundationObjectV1Schema.shape.personTreatment,
  adapterId: packagingImplementationAdapterIdV1Schema,
  adapterImplementationHash: hashSchema,
  componentId: idSchema.nullable(),
  componentHash: hashSchema.nullable(),
  bindingHash: hashSchema,
  resolvedInput: jsonObjectSchema.nullable(),
  controls: z.object({
    intensity: z.number().min(0).max(1),
    durationFrames: z.number().int().min(30).max(360),
    reducedMotion: z.boolean(),
  }).strict().nullable(),
}).strict().superRefine((layer, context) => {
  const host = layer.adapterId === "adapter:g2-v1:host-source-passthrough";
  if (host !== (layer.componentId === null && layer.componentHash === null && layer.resolvedInput === null && layer.controls === null)) {
    context.addIssue({ code: "custom", path: ["adapterId"], message: "host and designed layer fields disagree" });
  }
  if (host && (layer.ownerVisualObjectId === null || layer.ownerVisualObjectHash === null || layer.sourceBindingHash === null)) {
    context.addIssue({ code: "custom", path: ["ownerVisualObjectId"], message: "host source layers require one exact source owner" });
  }
  if (layer.ownerVisualObjectId === null
    && (layer.ownerVisualObjectHash !== null || layer.sourceBindingHash !== null || layer.personTreatment !== "NONE")) {
    context.addIssue({ code: "custom", path: ["ownerVisualObjectId"], message: "ownerless designed layers cannot carry source identities or person treatment" });
  }
  const { layerHash: _layerHash, ...semantic } = layer;
  if (layer.layerHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["layerHash"], message: "render layer hash must match canonical content" });
  }
});

export function packagingImplementationRenderParagraphV1Hash(paragraph: unknown): string {
  return canonicalHash(paragraph);
}

export const packagingImplementationRenderParagraphV1Schema = z.object({
  paragraphId: idSchema,
  renderHash: hashSchema,
  frameRange: frameRangeSchema,
  durationFrames: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  captionExclusionRegion: layoutGeometryV1Schema.shape.captionExclusionRegion,
  layers: z.array(packagingImplementationRenderLayerV1Schema).min(2).max(24),
  stateWindows: z.array(packagingImplementationStateWindowV1Schema).min(1).max(32),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.layers.map((layer) => layer.layerId))
    || !unique(paragraph.layers.map((layer) => layer.groupId))
    || !unique(paragraph.stateWindows.map((window) => window.stateId))
    || paragraph.durationFrames !== paragraph.frameRange.endFrame - paragraph.frameRange.startFrame) {
    context.addIssue({ code: "custom", path: [], message: "render paragraph identities or duration are invalid" });
  }
  const { renderHash: _renderHash, ...semantic } = paragraph;
  if (paragraph.renderHash !== packagingImplementationRenderParagraphV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["renderHash"], message: "render paragraph hash must match canonical content" });
  }
});

export const packagingImplementationPreflightCheckV1Schema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/u),
  status: z.enum(["PASS", "BLOCKER"]),
  paragraphId: idSchema.nullable(),
  targetId: idSchema.nullable(),
  message: z.string().trim().min(1).max(1_000),
}).strict();

export function packagingImplementationPreviewV1Hash(preview: unknown): string {
  return canonicalHash(preview);
}

export const packagingImplementationPreviewV1Schema = z.object({
  schemaVersion: z.literal(1),
  backend: z.literal("REMOTION_PLAYER_FRAME_DRIVEN_V1"),
  designHash: hashSchema,
  resolutionHash: hashSchema,
  paragraphs: z.array(packagingImplementationRenderParagraphV1Schema).min(1).max(512),
  preflight: z.object({
    status: z.literal("PASS"),
    checks: z.array(packagingImplementationPreflightCheckV1Schema).min(1).max(4_096),
    blockerCodes: z.array(z.never()).length(0),
  }).strict(),
}).strict().superRefine((preview, context) => {
  if (!unique(preview.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "preview paragraph ids must be unique" });
  }
});

export function packagingImplementationProposalV1Hash(proposal: unknown): string {
  return canonicalHash(proposal);
}

export const packagingImplementationProposalV1Schema = z.object({
  schemaVersion: z.literal(1),
  proposalId: idSchema,
  proposalHash: hashSchema,
  proposalVersion: z.literal(1),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: revisionSchema,
  timelineHash: hashSchema,
  aspect: z.literal("LANDSCAPE_16_9"),
  design: packagingImplementationDesignV1Schema,
  designHash: hashSchema,
  resolution: packagingImplementationResolutionV1Schema,
  resolutionHash: hashSchema,
  preview: packagingImplementationPreviewV1Schema,
  previewHash: hashSchema,
  status: z.literal("READY_FOR_G2_REVIEW"),
  g2ConfirmationId: z.null(),
  createdAt: isoInstantSchema,
}).strict().superRefine((proposal, context) => {
  if (proposal.designHash !== packagingImplementationDesignV1Hash(proposal.design)
    || proposal.resolutionHash !== packagingImplementationResolutionV1Hash(proposal.resolution)
    || proposal.previewHash !== packagingImplementationPreviewV1Hash(proposal.preview)
    || proposal.preview.designHash !== proposal.designHash
    || proposal.preview.resolutionHash !== proposal.resolutionHash) {
    context.addIssue({ code: "custom", path: [], message: "proposal hash chain is inconsistent" });
  }
  const semantic = {
    proposalId: proposal.proposalId,
    proposalVersion: proposal.proposalVersion,
    projectId: proposal.projectId,
    sessionId: proposal.sessionId,
    timelineId: proposal.timelineId,
    baseRevision: proposal.baseRevision,
    timelineHash: proposal.timelineHash,
    aspect: proposal.aspect,
    designHash: proposal.designHash,
    resolutionHash: proposal.resolutionHash,
    previewHash: proposal.previewHash,
  };
  if (proposal.proposalHash !== packagingImplementationProposalV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["proposalHash"], message: "proposal hash must bind the exact G2 review snapshot" });
  }
});

export function packagingImplementationParagraphReviewV1Hash(review: unknown): string {
  return canonicalHash(review);
}

export const packagingImplementationParagraphReviewV1Schema = z.object({
  schemaVersion: z.literal(1),
  reviewId: idSchema,
  reviewHash: hashSchema,
  proposalId: idSchema,
  proposalHash: hashSchema,
  proposalVersion: z.literal(1),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: revisionSchema,
  timelineHash: hashSchema,
  designHash: hashSchema,
  resolutionHash: hashSchema,
  previewHash: hashSchema,
  paragraphId: idSchema,
  renderHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  reviewedAt: isoInstantSchema,
}).strict().superRefine((review, context) => {
  if ((review.decision === "REJECT") !== (review.reason !== null)) {
    context.addIssue({ code: "custom", path: ["reason"], message: "only rejected G2 paragraph reviews require one reason" });
  }
  const { schemaVersion: _schemaVersion, reviewHash: _reviewHash, ...semantic } = review;
  if (review.reviewHash !== packagingImplementationParagraphReviewV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["reviewHash"], message: "G2 paragraph review hash must match canonical content" });
  }
});

export function packagingImplementationConfirmationV1Hash(confirmation: unknown): string {
  return canonicalHash(confirmation);
}

export const packagingImplementationConfirmationV1Schema = z.object({
  schemaVersion: z.literal(1),
  confirmationId: idSchema,
  confirmationHash: hashSchema,
  proposalId: idSchema,
  proposalHash: hashSchema,
  proposalVersion: z.literal(1),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: revisionSchema,
  timelineHash: hashSchema,
  aspect: z.literal("LANDSCAPE_16_9"),
  designHash: hashSchema,
  resolutionHash: hashSchema,
  previewHash: hashSchema,
  paragraphReviewHashes: z.array(hashSchema).min(1).max(512),
  confirmationScope: z.literal("G2_EXACT_SNAPSHOT_ONLY"),
  applyAuthorized: z.literal(false),
  componentLifecyclePromoted: z.literal(false),
  productionRegistryModified: z.literal(false),
  timelineModified: z.literal(false),
  programSpineModified: z.literal(false),
  status: z.enum(["CONFIRMED", "EXPIRED"]),
  confirmedAt: isoInstantSchema,
  expiredAt: isoInstantSchema.nullable(),
}).strict().superRefine((confirmation, context) => {
  if (!unique(confirmation.paragraphReviewHashes)
    || (confirmation.status === "CONFIRMED") !== (confirmation.expiredAt === null)) {
    context.addIssue({ code: "custom", path: [], message: "G2 confirmation state is inconsistent" });
  }
  const { schemaVersion: _schemaVersion, confirmationHash: _confirmationHash, ...semantic } = confirmation;
  if (confirmation.confirmationHash !== packagingImplementationConfirmationV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["confirmationHash"], message: "G2 confirmation hash must match canonical content" });
  }
});

export const packagingImplementationPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  currentProposalId: idSchema.nullable(),
  proposals: z.array(packagingImplementationProposalV1Schema).max(128),
  paragraphReviews: z.array(packagingImplementationParagraphReviewV1Schema).max(8_192).default([]),
  confirmations: z.array(packagingImplementationConfirmationV1Schema).max(256).default([]),
}).strict().superRefine((state, context) => {
  if (!unique(state.proposals.map((proposal) => proposal.proposalId))
    || !unique(state.paragraphReviews.map((review) => review.reviewId))
    || !unique(state.confirmations.map((confirmation) => confirmation.confirmationId))
    || (state.currentProposalId !== null && !state.proposals.some((proposal) => proposal.proposalId === state.currentProposalId))) {
    context.addIssue({ code: "custom", path: [], message: "implementation proposal identities are invalid" });
  }
});

export const preparePackagingImplementationProposalRequestSchema = z.object({
  expectedRevision: revisionSchema,
  packagingResolutionPlanId: idSchema,
  packagingResolutionPlanHash: hashSchema,
  packagingResolutionConfirmationId: idSchema,
  packagingResolutionConfirmationHash: hashSchema,
  preparedAt: isoInstantSchema,
}).strict();

export const reviewPackagingImplementationParagraphRequestSchema = z.object({
  expectedRevision: revisionSchema,
  proposalId: idSchema,
  proposalHash: hashSchema,
  proposalVersion: z.literal(1),
  timelineHash: hashSchema,
  designHash: hashSchema,
  resolutionHash: hashSchema,
  previewHash: hashSchema,
  paragraphId: idSchema,
  renderHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  reviewedAt: isoInstantSchema,
}).strict().superRefine((request, context) => {
  if ((request.decision === "REJECT") !== (request.reason !== null)) {
    context.addIssue({ code: "custom", path: ["reason"], message: "only rejected G2 paragraph reviews require one reason" });
  }
});

export const confirmPackagingImplementationReviewRequestSchema = z.object({
  expectedRevision: revisionSchema,
  proposalId: idSchema,
  proposalHash: hashSchema,
  proposalVersion: z.literal(1),
  timelineHash: hashSchema,
  designHash: hashSchema,
  resolutionHash: hashSchema,
  previewHash: hashSchema,
  paragraphReviewHashes: z.array(hashSchema).min(1).max(512),
  confirmed: z.literal(true),
  confirmedAt: isoInstantSchema,
}).strict();

export type PackagingImplementationAdapterV1 = z.infer<typeof packagingImplementationAdapterV1Schema>;
export type PackagingImplementationDesignV1 = z.infer<typeof packagingImplementationDesignV1Schema>;
export type PackagingImplementationResolutionV1 = z.infer<typeof packagingImplementationResolutionV1Schema>;
export type PackagingImplementationRenderLayerV1 = z.infer<typeof packagingImplementationRenderLayerV1Schema>;
export type PackagingImplementationRenderParagraphV1 = z.infer<typeof packagingImplementationRenderParagraphV1Schema>;
export type PackagingImplementationPreviewV1 = z.infer<typeof packagingImplementationPreviewV1Schema>;
export type PackagingImplementationProposalV1 = z.infer<typeof packagingImplementationProposalV1Schema>;
export type PackagingImplementationParagraphReviewV1 = z.infer<typeof packagingImplementationParagraphReviewV1Schema>;
export type PackagingImplementationConfirmationV1 = z.infer<typeof packagingImplementationConfirmationV1Schema>;
export type PackagingImplementationPersistentStateV1 = z.infer<typeof packagingImplementationPersistentStateV1Schema>;
export type PreparePackagingImplementationProposalRequest = z.infer<typeof preparePackagingImplementationProposalRequestSchema>;
export type ReviewPackagingImplementationParagraphRequest = z.infer<typeof reviewPackagingImplementationParagraphRequestSchema>;
export type ConfirmPackagingImplementationReviewRequest = z.infer<typeof confirmPackagingImplementationReviewRequestSchema>;

export interface PackagingImplementationSnapshotV1 {
  schemaVersion: 1;
  adapterRegistry: PackagingImplementationAdapterV1[];
  currentProposal: PackagingImplementationProposalV1 | null;
  proposals: PackagingImplementationProposalV1[];
  paragraphReviews: PackagingImplementationParagraphReviewV1[];
  confirmations: PackagingImplementationConfirmationV1[];
  paragraphReadiness: Array<{
    paragraphId: string;
    state: "STALE" | "PENDING_REVIEW" | "REJECTED" | "ACCEPTED";
    reasonCodes: string[];
    reviewId: string | null;
  }>;
  reviewReadiness: {
    code: "UPSTREAM_NOT_READY" | "NO_CURRENT_PROPOSAL" | "STALE_PROPOSAL" | "PARAGRAPH_REVIEW_REQUIRED" | "READY" | "CONFIRMED";
    eligible: boolean;
    staleParagraphIds: string[];
    pendingReviewParagraphIds: string[];
    rejectedParagraphIds: string[];
    paragraphReviewHashes: string[];
    confirmationId: string | null;
    confirmationHash: string | null;
    blockedReasonCodes: string[];
  };
  readiness: {
    code:
      | "UPSTREAM_NOT_READY"
      | "PROJECT_AUDITION_CONFIRMATION_REQUIRED"
      | "READY_TO_PREPARE"
      | "READY_FOR_G2_REVIEW"
      | "STALE_PROPOSAL"
      | "G2_CONFIRMED";
    canPrepare: boolean;
    blockedReasonCodes: string[];
    packagingResolutionConfirmationId: string | null;
  };
  g2ConfirmationId: string | null;
  productionRegistryEntryCount: 0;
  timelineModified: false;
  programSpineModified: false;
  productionRegistryModified: false;
}
