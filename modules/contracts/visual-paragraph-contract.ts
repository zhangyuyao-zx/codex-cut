import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  frameRangeSchema,
  hashSchema,
  idSchema,
  isoInstantSchema,
} from "../shared/timeline-v2/schema.js";

export const VISUAL_PARAGRAPH_EXPRESSION_TASK_IDS = [
  "establish_topic",
  "emphasize_conclusion",
  "explain_concept",
  "show_process",
  "show_steps",
  "show_data",
  "compare_difference",
  "show_causality",
  "show_ui_operation",
  "provide_evidence",
  "show_case",
  "create_turn",
  "summarize_close",
  "establish_emotion",
  "prompt_action",
] as const;

export const VISUAL_PARAGRAPH_MAIN_VISUAL_KINDS = [
  "person",
  "screen_recording",
  "live_video",
  "image",
  "chart",
  "flow",
  "text_composition",
  "data_visualization",
] as const;

export const VISUAL_PARAGRAPH_COMPOSITION_RELATIONS = [
  "main_fullscreen",
  "host_primary_support_zone",
  "host_supporting_main_content",
  "split_primary_secondary",
  "picture_in_picture",
  "overlay_annotation",
  "comparison_dual",
  "sequence_flow",
  "evidence_clean",
  "text_led_takeover",
] as const;

export const VISUAL_PARAGRAPH_BOUNDARY_REASON_CODES = [
  "MAIN_VISUAL_CONTINUES",
  "MAIN_VISUAL_CHANGES",
  "EXPRESSION_TASK_CHANGES",
  "INFORMATION_DUTY_CHANGES",
  "COMPOSITION_RELATION_CHANGES",
  "SAME_SENTENCE_VISUAL_SWITCH",
  "EVIDENCE_SOURCE_CHANGES",
  "USER_FORCED_BOUNDARY",
  "INSUFFICIENT_EVIDENCE",
] as const;

export const VISUAL_PARAGRAPH_MODEL_BOUNDARY_REASON_CODES = [
  "SAME_SENTENCE_VISUAL_SWITCH",
  "INSUFFICIENT_EVIDENCE",
] as const;

export const expressionTaskIdSchema = z.enum(VISUAL_PARAGRAPH_EXPRESSION_TASK_IDS);
export const mainVisualKindSchema = z.enum(VISUAL_PARAGRAPH_MAIN_VISUAL_KINDS);
export const compositionRelationSchema = z.enum(VISUAL_PARAGRAPH_COMPOSITION_RELATIONS);
export const paragraphBoundaryReasonCodeSchema = z.enum(VISUAL_PARAGRAPH_BOUNDARY_REASON_CODES);
export const modelParagraphBoundaryReasonCodeSchema = z.enum(VISUAL_PARAGRAPH_MODEL_BOUNDARY_REASON_CODES);

const uniqueIds = (values: readonly string[]): boolean => new Set(values).size === values.length;

export const visualParagraphModelMainVisualSchema = z.object({
  kind: mainVisualKindSchema,
  continuityKey: idSchema,
  informationDuty: z.string().trim().min(1).max(300),
  focalSubject: z.string().trim().min(1).max(200),
  evidenceWordIds: z.array(idSchema).max(32),
}).strict().superRefine((value, context) => {
  if (!uniqueIds(value.evidenceWordIds)) {
    context.addIssue({ code: "custom", path: ["evidenceWordIds"], message: "main-visual evidence word ids must be unique" });
  }
  if (value.kind !== "person" && value.evidenceWordIds.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["evidenceWordIds"],
      message: "a non-person main visual requires transcript evidence",
    });
  }
});

export const visualParagraphBoundaryDecisionSchema = z.object({
  reasonCodes: z.array(paragraphBoundaryReasonCodeSchema).min(1).max(7),
  evidenceWordIds: z.array(idSchema).min(1).max(24),
  rationale: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((value, context) => {
  if (!uniqueIds(value.reasonCodes)) {
    context.addIssue({ code: "custom", path: ["reasonCodes"], message: "boundary reason codes must be unique" });
  }
  if (!uniqueIds(value.evidenceWordIds)) {
    context.addIssue({ code: "custom", path: ["evidenceWordIds"], message: "boundary evidence word ids must be unique" });
  }
  if (value.reasonCodes.includes("INSUFFICIENT_EVIDENCE") && (!value.reviewRequired || value.confidence >= 0.7)) {
    context.addIssue({
      code: "custom",
      path: ["reviewRequired"],
      message: "insufficient evidence must stay review-required and below high confidence",
    });
  }
  if (value.confidence < 0.7 && !value.reviewRequired) {
    context.addIssue({
      code: "custom",
      path: ["reviewRequired"],
      message: "low-confidence boundaries must be review-required",
    });
  }
});

export const visualParagraphModelBoundaryDecisionSchema = z.object({
  extraReasonCodes: z.array(modelParagraphBoundaryReasonCodeSchema).max(2),
  evidenceWordIds: z.array(idSchema).min(1).max(24),
  rationale: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((value, context) => {
  if (!uniqueIds(value.extraReasonCodes)) {
    context.addIssue({ code: "custom", path: ["extraReasonCodes"], message: "boundary reason codes must be unique" });
  }
  if (!uniqueIds(value.evidenceWordIds)) {
    context.addIssue({ code: "custom", path: ["evidenceWordIds"], message: "boundary evidence word ids must be unique" });
  }
  if (value.extraReasonCodes.includes("INSUFFICIENT_EVIDENCE") && (!value.reviewRequired || value.confidence >= 0.7)) {
    context.addIssue({
      code: "custom",
      path: ["reviewRequired"],
      message: "insufficient evidence must stay review-required and below high confidence",
    });
  }
  if (value.confidence < 0.7 && !value.reviewRequired) {
    context.addIssue({
      code: "custom",
      path: ["reviewRequired"],
      message: "low-confidence boundaries must be review-required",
    });
  }
});

export const visualParagraphModelDecisionSchema = z.object({
  startWordId: idSchema,
  primaryExpressionTask: expressionTaskIdSchema,
  mainVisual: visualParagraphModelMainVisualSchema,
  compositionRelation: compositionRelationSchema,
  boundaryBefore: visualParagraphModelBoundaryDecisionSchema.nullable(),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.confidence < 0.7 && !value.reviewRequired) {
    context.addIssue({
      code: "custom",
      path: ["reviewRequired"],
      message: "low-confidence paragraph decisions must be review-required",
    });
  }
});

export const visualParagraphFoundationSchema = z.object({
  roughCutProposalId: idSchema,
  roughCutProposalHash: hashSchema,
  roughCutConfirmationId: idSchema,
  commitRevision: z.number().int().nonnegative(),
  documentHash: hashSchema,
  timeMapHash: hashSchema,
  masterTranscriptHash: hashSchema,
  projectionHash: hashSchema,
  transcriptWordCount: z.number().int().positive().max(20_000),
  durationFrames: z.number().int().positive(),
  framesPerSecond: z.number().positive(),
}).strict();

export const visualParagraphFoundationSyncSchema = z.object({
  kind: z.literal("host_rebase_v1"),
  sourceProposalId: idSchema,
  sourceProposalHash: hashSchema,
  sourceBaseRevision: z.number().int().nonnegative(),
  targetRevision: z.number().int().nonnegative(),
  preservedParagraphCount: z.number().int().nonnegative().max(512),
  changedParagraphOrders: z.array(z.number().int().nonnegative().max(511)).max(512),
  removedSourceParagraphOrders: z.array(z.number().int().nonnegative().max(511)).max(512),
  addedWordCount: z.number().int().nonnegative().max(20_000),
  removedWordCount: z.number().int().nonnegative().max(20_000),
  reordered: z.boolean(),
}).strict().superRefine((sync, context) => {
  if (!uniqueIds(sync.changedParagraphOrders.map(String))) {
    context.addIssue({ code: "custom", path: ["changedParagraphOrders"], message: "changed paragraph orders must be unique" });
  }
  if (!uniqueIds(sync.removedSourceParagraphOrders.map(String))) {
    context.addIssue({ code: "custom", path: ["removedSourceParagraphOrders"], message: "removed source paragraph orders must be unique" });
  }
});

export const visualParagraphHostBindingSchema = z.object({
  timeMapSegmentId: idSchema,
  spineEntryId: idSchema,
  clipId: idSchema,
  assetId: idSchema,
}).strict();

export const visualParagraphSchema = z.object({
  paragraphId: idSchema,
  order: z.number().int().nonnegative(),
  wordRange: z.object({
    startWordId: idSchema,
    endWordId: idSchema,
    includedWordIds: z.array(idSchema).min(1).max(20_000),
  }).strict(),
  frameRange: frameRangeSchema,
  text: z.string().min(1).max(100_000),
  assetIds: z.array(idSchema).min(1),
  hostBindings: z.array(visualParagraphHostBindingSchema).min(1),
  primaryExpressionTask: expressionTaskIdSchema,
  mainVisual: visualParagraphModelMainVisualSchema,
  compositionRelation: compositionRelationSchema,
  boundaryBefore: visualParagraphBoundaryDecisionSchema.nullable(),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((value, context) => {
  if (!uniqueIds(value.wordRange.includedWordIds)) {
    context.addIssue({ code: "custom", path: ["wordRange", "includedWordIds"], message: "paragraph word ids must be unique" });
  }
  if (value.wordRange.includedWordIds[0] !== value.wordRange.startWordId
    || value.wordRange.includedWordIds.at(-1) !== value.wordRange.endWordId) {
    context.addIssue({ code: "custom", path: ["wordRange"], message: "paragraph word-range endpoints must match included words" });
  }
  if (!uniqueIds(value.assetIds)) {
    context.addIssue({ code: "custom", path: ["assetIds"], message: "paragraph asset ids must be unique" });
  }
});

export const visualParagraphProposalStatusSchema = z.enum(["awaiting_model_review", "draft"]);

function proposalSemanticPayload(proposal: {
  proposalId: string;
  sessionId: string;
  projectId: string;
  timelineId: string;
  baseRevision: number;
  foundation: unknown;
  intentSummary: string;
  protocol: string;
  status: string;
  paragraphs: unknown[];
  submissionHash: string | null;
  foundationSync?: unknown;
  createdAt: string;
  updatedAt: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    proposalId: proposal.proposalId,
    sessionId: proposal.sessionId,
    projectId: proposal.projectId,
    timelineId: proposal.timelineId,
    baseRevision: proposal.baseRevision,
    foundation: proposal.foundation,
    intentSummary: proposal.intentSummary,
    protocol: proposal.protocol,
    status: proposal.status,
    paragraphs: proposal.paragraphs,
    submissionHash: proposal.submissionHash,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  };
  if (proposal.foundationSync !== undefined) payload.foundationSync = proposal.foundationSync;
  return payload;
}

export function visualParagraphProposalHash(proposal: Parameters<typeof proposalSemanticPayload>[0]): string {
  return canonicalHash(proposalSemanticPayload(proposal));
}

export const visualParagraphProposalSchema = z.object({
  schemaVersion: z.literal(1),
  proposalId: idSchema,
  proposalHash: hashSchema,
  sessionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  foundation: visualParagraphFoundationSchema,
  intentSummary: z.string().trim().min(1).max(500),
  protocol: z.enum([
    "complete_master_transcript_single_batch_v1",
    "complete_master_transcript_boundary_starts_v2",
  ]),
  status: visualParagraphProposalStatusSchema,
  paragraphs: z.array(visualParagraphSchema).max(512),
  submissionHash: hashSchema.nullable(),
  foundationSync: visualParagraphFoundationSyncSchema.optional(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((proposal, context) => {
  if (proposal.status === "awaiting_model_review" && (proposal.paragraphs.length !== 0 || proposal.submissionHash !== null)) {
    context.addIssue({ code: "custom", path: ["status"], message: "an awaiting proposal cannot contain a submitted review" });
  }
  if (proposal.status === "draft" && (proposal.paragraphs.length === 0 || proposal.submissionHash === null)) {
    context.addIssue({ code: "custom", path: ["status"], message: "a draft proposal requires one complete submitted review" });
  }
  if (proposal.foundationSync !== undefined) {
    if (proposal.status !== "draft"
      || proposal.foundationSync.targetRevision !== proposal.baseRevision
      || proposal.foundationSync.sourceBaseRevision >= proposal.baseRevision
      || proposal.foundationSync.preservedParagraphCount + proposal.foundationSync.changedParagraphOrders.length !== proposal.paragraphs.length
      || proposal.foundationSync.changedParagraphOrders.some((order) => order >= proposal.paragraphs.length)) {
      context.addIssue({ code: "custom", path: ["foundationSync"], message: "foundation sync must bind one later complete draft revision" });
    }
  }
  if (proposal.proposalHash !== visualParagraphProposalHash(proposal)) {
    context.addIssue({ code: "custom", path: ["proposalHash"], message: "proposal hash must match exact semantic content" });
  }
});

export const visualParagraphReviewScopeSchema = z.object({
  kind: z.enum(["proposal", "paragraph", "playhead"]),
  paragraphId: idSchema.nullable(),
  playheadFrame: z.number().int().nonnegative(),
}).strict().superRefine((scope, context) => {
  if ((scope.kind === "paragraph") !== (scope.paragraphId !== null)) {
    context.addIssue({
      code: "custom",
      path: ["paragraphId"],
      message: "paragraph scope requires exactly one paragraph id",
    });
  }
});

function revisionBindingPayload(revision: {
  revisionId: string;
  turnId: string;
  conversationRootProposalId: string;
  sessionId: string;
  projectId: string;
  timelineId: string;
  baseRevision: number;
  foundationHash: string;
  baseProposalId: string;
  baseProposalHash: string;
  scope: unknown;
  summary: string;
  rationale: string;
  candidateProposalId: string;
  candidateProposalHash: string;
  changedParagraphOrders: number[];
  beforeParagraphCount: number;
  afterParagraphCount: number;
  createdAt: string;
}): Record<string, unknown> {
  return {
    revisionId: revision.revisionId,
    turnId: revision.turnId,
    conversationRootProposalId: revision.conversationRootProposalId,
    sessionId: revision.sessionId,
    projectId: revision.projectId,
    timelineId: revision.timelineId,
    baseRevision: revision.baseRevision,
    foundationHash: revision.foundationHash,
    baseProposalId: revision.baseProposalId,
    baseProposalHash: revision.baseProposalHash,
    scope: revision.scope,
    summary: revision.summary,
    rationale: revision.rationale,
    candidateProposalId: revision.candidateProposalId,
    candidateProposalHash: revision.candidateProposalHash,
    changedParagraphOrders: revision.changedParagraphOrders,
    beforeParagraphCount: revision.beforeParagraphCount,
    afterParagraphCount: revision.afterParagraphCount,
    createdAt: revision.createdAt,
  };
}

export function visualParagraphRevisionHash(
  revision: Parameters<typeof revisionBindingPayload>[0],
): string {
  return canonicalHash(revisionBindingPayload(revision));
}

export const visualParagraphRevisionSchema = z.object({
  schemaVersion: z.literal(1),
  revisionId: idSchema,
  revisionHash: hashSchema,
  turnId: idSchema,
  conversationRootProposalId: idSchema,
  sessionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  foundationHash: hashSchema,
  baseProposalId: idSchema,
  baseProposalHash: hashSchema,
  scope: visualParagraphReviewScopeSchema,
  summary: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(1_000),
  candidateProposalId: idSchema,
  candidateProposalHash: hashSchema,
  candidateProposal: visualParagraphProposalSchema,
  changedParagraphOrders: z.array(z.number().int().nonnegative().max(511)).min(1).max(512),
  beforeParagraphCount: z.number().int().positive().max(512),
  afterParagraphCount: z.number().int().positive().max(512),
  status: z.enum(["pending", "accepted", "rejected", "expired"]),
  createdAt: isoInstantSchema,
  acceptedAt: isoInstantSchema.nullable(),
  rejectedAt: isoInstantSchema.nullable(),
  expiredAt: isoInstantSchema.nullable(),
}).strict().superRefine((revision, context) => {
  if (!uniqueIds(revision.changedParagraphOrders.map(String))) {
    context.addIssue({ code: "custom", path: ["changedParagraphOrders"], message: "changed paragraph orders must be unique" });
  }
  if (revision.candidateProposal.proposalId !== revision.candidateProposalId
    || revision.candidateProposal.proposalHash !== revision.candidateProposalHash) {
    context.addIssue({ code: "custom", path: ["candidateProposal"], message: "candidate proposal binding must match" });
  }
  const terminalTimes = [revision.acceptedAt, revision.rejectedAt, revision.expiredAt].filter((value) => value !== null);
  if ((revision.status === "pending" && terminalTimes.length !== 0)
    || (revision.status === "accepted" && (revision.acceptedAt === null || terminalTimes.length !== 1))
    || (revision.status === "rejected" && (revision.rejectedAt === null || terminalTimes.length !== 1))
    || (revision.status === "expired" && (revision.expiredAt === null || terminalTimes.length !== 1))) {
    context.addIssue({ code: "custom", path: ["status"], message: "revision status and terminal timestamp must match" });
  }
  if (revision.revisionHash !== visualParagraphRevisionHash(revision)) {
    context.addIssue({ code: "custom", path: ["revisionHash"], message: "revision hash must match exact immutable binding" });
  }
});

function reviewConfirmationBindingPayload(confirmation: {
  confirmationId: string;
  sessionId: string;
  projectId: string;
  timelineId: string;
  baseRevision: number;
  foundationHash: string;
  proposalId: string;
  proposalHash: string;
  confirmedAt: string;
}): Record<string, unknown> {
  return {
    confirmationId: confirmation.confirmationId,
    sessionId: confirmation.sessionId,
    projectId: confirmation.projectId,
    timelineId: confirmation.timelineId,
    baseRevision: confirmation.baseRevision,
    foundationHash: confirmation.foundationHash,
    proposalId: confirmation.proposalId,
    proposalHash: confirmation.proposalHash,
    confirmedAt: confirmation.confirmedAt,
  };
}

export function visualParagraphReviewConfirmationHash(
  confirmation: Parameters<typeof reviewConfirmationBindingPayload>[0],
): string {
  return canonicalHash(reviewConfirmationBindingPayload(confirmation));
}

export const visualParagraphReviewConfirmationSchema = z.object({
  schemaVersion: z.literal(1),
  confirmationId: idSchema,
  confirmationHash: hashSchema,
  sessionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  foundationHash: hashSchema,
  proposalId: idSchema,
  proposalHash: hashSchema,
  status: z.enum(["confirmed", "expired"]),
  confirmedAt: isoInstantSchema,
  expiredAt: isoInstantSchema.nullable(),
}).strict().superRefine((confirmation, context) => {
  if ((confirmation.status === "confirmed") !== (confirmation.expiredAt === null)) {
    context.addIssue({ code: "custom", path: ["status"], message: "review confirmation status and expiry must match" });
  }
  if (confirmation.confirmationHash !== visualParagraphReviewConfirmationHash(confirmation)) {
    context.addIssue({ code: "custom", path: ["confirmationHash"], message: "confirmation hash must match exact immutable binding" });
  }
});

export const visualParagraphPersistentStateSchema = z.object({
  schemaVersion: z.literal(1),
  proposals: z.array(visualParagraphProposalSchema).max(8),
  revisions: z.array(visualParagraphRevisionSchema).max(8).default([]),
  reviewConfirmations: z.array(visualParagraphReviewConfirmationSchema).max(16).default([]),
}).strict();

export const visualParagraphAvailabilitySchema = z.object({
  state: z.enum(["ready", "unavailable"]),
  code: z.string().min(1).max(128).nullable(),
  message: z.string().min(1).max(1_024),
  currentRevision: z.number().int().nonnegative(),
  foundation: visualParagraphFoundationSchema.nullable(),
}).strict();

export const visualParagraphSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  availability: visualParagraphAvailabilitySchema,
  proposals: z.array(visualParagraphProposalSchema).max(8),
  revisions: z.array(visualParagraphRevisionSchema).max(8),
  reviewConfirmations: z.array(visualParagraphReviewConfirmationSchema).max(16),
  registeredModelTools: z.tuple([
    z.literal("visual_paragraph_create_proposal"),
    z.literal("visual_paragraph_read_transcript_page"),
    z.literal("visual_paragraph_submit_review"),
  ]),
  registeredAgentModelTools: z.tuple([
    z.literal("visual_paragraph_get_review_context"),
    z.literal("visual_paragraph_read_revision_transcript_page"),
    z.literal("visual_paragraph_propose_revision"),
  ]),
  timelineModified: z.literal(false),
}).strict();

export const createVisualParagraphProposalRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  proposalId: idSchema,
  intentSummary: z.string().trim().min(1).max(500),
  createdAt: isoInstantSchema,
}).strict();

export const submitVisualParagraphReviewRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  proposalId: idSchema,
  paragraphs: z.array(visualParagraphModelDecisionSchema).min(1).max(512),
  submittedAt: isoInstantSchema,
}).strict();

export const visualParagraphToolScopeSchema = z.object({
  projectId: idSchema,
  sessionId: idSchema,
  expectedRevision: z.number().int().nonnegative(),
}).strict();

export const createVisualParagraphProposalToolInputSchema = visualParagraphToolScopeSchema.extend({
  intentSummary: z.string().trim().min(1).max(500),
}).strict();

export const readVisualParagraphTranscriptPageToolInputSchema = visualParagraphToolScopeSchema.extend({
  proposalId: idSchema,
  cursor: z.number().int().nonnegative().max(1_000_000),
}).strict();

export const submitVisualParagraphReviewToolInputSchema = visualParagraphToolScopeSchema.extend({
  proposalId: idSchema,
  paragraphs: z.array(visualParagraphModelDecisionSchema).min(1).max(512),
}).strict();

export const submitDshVisualParagraphTurnRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  submittedAt: isoInstantSchema,
}).strict();

export const submitDshVisualParagraphAgentTurnRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  submittedAt: isoInstantSchema,
  userText: z.string().trim().min(1).max(1_000),
  baseProposalId: idSchema,
  baseProposalHash: hashSchema,
  scope: visualParagraphReviewScopeSchema,
}).strict();

export const visualParagraphReviewToolScopeSchema = visualParagraphToolScopeSchema.extend({
  baseProposalId: idSchema,
  baseProposalHash: hashSchema,
}).strict();

export const getVisualParagraphReviewContextToolInputSchema = visualParagraphToolScopeSchema;

export const readVisualParagraphRevisionTranscriptPageToolInputSchema = visualParagraphReviewToolScopeSchema.extend({
  cursor: z.number().int().nonnegative().max(1_000_000),
}).strict();

export const proposeVisualParagraphRevisionToolInputSchema = visualParagraphReviewToolScopeSchema.extend({
  summary: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(1_000),
  paragraphs: z.array(visualParagraphModelDecisionSchema).min(1).max(512),
}).strict();

export const acceptVisualParagraphRevisionRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  revisionId: idSchema,
  revisionHash: hashSchema,
  baseProposalId: idSchema,
  baseProposalHash: hashSchema,
  acceptedAt: isoInstantSchema,
}).strict();

export const rejectVisualParagraphRevisionRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  revisionId: idSchema,
  revisionHash: hashSchema,
  baseProposalId: idSchema,
  baseProposalHash: hashSchema,
  rejectedAt: isoInstantSchema,
}).strict();

export const confirmVisualParagraphReviewRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  proposalId: idSchema,
  proposalHash: hashSchema,
  confirmed: z.literal(true),
  confirmedAt: isoInstantSchema,
}).strict();

export const VISUAL_PARAGRAPH_MODEL_TOOLS = [
  "visual_paragraph_create_proposal",
  "visual_paragraph_read_transcript_page",
  "visual_paragraph_submit_review",
] as const;

export const VISUAL_PARAGRAPH_AGENT_MODEL_TOOLS = [
  "visual_paragraph_get_review_context",
  "visual_paragraph_read_revision_transcript_page",
  "visual_paragraph_propose_revision",
] as const;

export type VisualParagraphModelDecision = z.infer<typeof visualParagraphModelDecisionSchema>;
export type VisualParagraphModelBoundaryDecision = z.infer<typeof visualParagraphModelBoundaryDecisionSchema>;
export type VisualParagraphFoundation = z.infer<typeof visualParagraphFoundationSchema>;
export type VisualParagraphFoundationSync = z.infer<typeof visualParagraphFoundationSyncSchema>;
export type VisualParagraph = z.infer<typeof visualParagraphSchema>;
export type VisualParagraphProposal = z.infer<typeof visualParagraphProposalSchema>;
export type VisualParagraphPersistentState = z.infer<typeof visualParagraphPersistentStateSchema>;
export type VisualParagraphSnapshot = z.infer<typeof visualParagraphSnapshotSchema>;
export type VisualParagraphReviewScope = z.infer<typeof visualParagraphReviewScopeSchema>;
export type VisualParagraphRevision = z.infer<typeof visualParagraphRevisionSchema>;
export type VisualParagraphReviewConfirmation = z.infer<typeof visualParagraphReviewConfirmationSchema>;
export type CreateVisualParagraphProposalRequest = z.infer<typeof createVisualParagraphProposalRequestSchema>;
export type SubmitVisualParagraphReviewRequest = z.infer<typeof submitVisualParagraphReviewRequestSchema>;
export type CreateVisualParagraphProposalToolInput = z.infer<typeof createVisualParagraphProposalToolInputSchema>;
export type ReadVisualParagraphTranscriptPageToolInput = z.infer<typeof readVisualParagraphTranscriptPageToolInputSchema>;
export type SubmitVisualParagraphReviewToolInput = z.infer<typeof submitVisualParagraphReviewToolInputSchema>;
export type SubmitDshVisualParagraphTurnRequest = z.infer<typeof submitDshVisualParagraphTurnRequestSchema>;
export type SubmitDshVisualParagraphAgentTurnRequest = z.infer<typeof submitDshVisualParagraphAgentTurnRequestSchema>;
export type GetVisualParagraphReviewContextToolInput = z.infer<typeof getVisualParagraphReviewContextToolInputSchema>;
export type ReadVisualParagraphRevisionTranscriptPageToolInput = z.infer<typeof readVisualParagraphRevisionTranscriptPageToolInputSchema>;
export type ProposeVisualParagraphRevisionToolInput = z.infer<typeof proposeVisualParagraphRevisionToolInputSchema>;
export type AcceptVisualParagraphRevisionRequest = z.infer<typeof acceptVisualParagraphRevisionRequestSchema>;
export type RejectVisualParagraphRevisionRequest = z.infer<typeof rejectVisualParagraphRevisionRequestSchema>;
export type ConfirmVisualParagraphReviewRequest = z.infer<typeof confirmVisualParagraphReviewRequestSchema>;
