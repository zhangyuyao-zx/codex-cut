import { z } from "zod";
import { masterTranscriptSchema } from "../shared/transcript-alignment.js";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  frameRangeSchema,
  hashSchema,
  idSchema,
  isoInstantSchema,
  positiveRationalSchema,
} from "../shared/timeline-v2/schema.js";
import { timelineTransactionV1Schema } from "../shared/timeline-v2/transaction-schema.js";

const relativeTranscriptPathSchema = z.string().min(1).refine((value) => {
  if (value.startsWith("/") || value.includes("\\")) return false;
  const parts = value.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}, "transcript path must be a safe project-relative POSIX path");

export const roughCutSourceRefSchema = z.object({
  assetId: idSchema,
  assetFingerprint: z.string().min(1),
  transcriptId: idSchema,
  relativePath: relativeTranscriptPathSchema,
  sourceHash: hashSchema,
  wordCount: z.number().int().nonnegative(),
  silenceCandidateCount: z.number().int().nonnegative(),
}).strict();

export const roughCutTimeMapSegmentSchema = z.object({
  segmentId: idSchema,
  spineEntryId: idSchema,
  clipId: idSchema,
  assetId: idSchema,
  sourceStartMs: z.number().int().nonnegative(),
  sourceEndMs: z.number().int().positive(),
  masterStartFrame: z.number().int().nonnegative(),
  masterEndFrame: z.number().int().positive(),
  playbackRate: positiveRationalSchema,
}).strict().superRefine((segment, context) => {
  if (segment.sourceEndMs <= segment.sourceStartMs) {
    context.addIssue({ code: "custom", path: ["sourceEndMs"], message: "source range must be positive" });
  }
  if (segment.masterEndFrame <= segment.masterStartFrame) {
    context.addIssue({ code: "custom", path: ["masterEndFrame"], message: "master range must be positive" });
  }
});

export const roughCutTimeMapSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  documentHash: hashSchema,
  framesPerSecond: positiveRationalSchema,
  durationFrames: z.number().int().positive(),
  segments: z.array(roughCutTimeMapSegmentSchema).min(1),
}).strict().superRefine((timeMap, context) => {
  const segmentIds = timeMap.segments.map((segment) => segment.segmentId);
  const spineEntryIds = timeMap.segments.map((segment) => segment.spineEntryId);
  if (new Set(segmentIds).size !== segmentIds.length) {
    context.addIssue({ code: "custom", path: ["segments"], message: "TimeMap segment ids must be unique" });
  }
  if (new Set(spineEntryIds).size !== spineEntryIds.length) {
    context.addIssue({ code: "custom", path: ["segments"], message: "TimeMap spine entry ids must be unique" });
  }
});

export const roughCutCandidateKindSchema = z.enum(["silence", "duplicate_speech", "filler_word"]);
export const roughCutCandidateEligibilitySchema = z.enum(["eligible", "blocked"]);

export const roughCutCandidateSchema = z.object({
  candidateId: idSchema,
  kind: roughCutCandidateKindSchema,
  eligibility: roughCutCandidateEligibilitySchema,
  defaultSelected: z.boolean(),
  selected: z.boolean(),
  rawRange: frameRangeSchema,
  snappedRange: frameRangeSchema,
  assetId: idSchema,
  clipId: idSchema,
  sourceStartMs: z.number().int().nonnegative(),
  sourceEndMs: z.number().int().positive(),
  text: z.string(),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
  wordIds: z.array(idSchema),
  evidence: z.array(z.string().min(1)).min(1),
  warning: z.string().min(1).nullable(),
}).strict().superRefine((candidate, context) => {
  if (candidate.sourceEndMs <= candidate.sourceStartMs) {
    context.addIssue({ code: "custom", path: ["sourceEndMs"], message: "source range must be positive" });
  }
  if (candidate.selected && candidate.eligibility !== "eligible") {
    context.addIssue({ code: "custom", path: ["selected"], message: "blocked candidates cannot be selected" });
  }
});

export const roughCutPreviewSchema = z.object({
  selectedCandidateIds: z.array(idSchema),
  beforeDurationFrames: z.number().int().positive(),
  afterDurationFrames: z.number().int().positive(),
  deleteFrameCount: z.number().int().nonnegative(),
  operationCount: z.number().int().nonnegative(),
  beforeCaptionCount: z.number().int().nonnegative(),
  afterCaptionCount: z.number().int().nonnegative(),
  affectedClipIds: z.array(idSchema),
  affectedWordIds: z.array(idSchema),
  beforeTimeMapHash: hashSchema,
  afterTimeMapHash: hashSchema,
  beforeMasterTranscriptHash: hashSchema,
  afterMasterTranscriptHash: hashSchema,
  beforeProjectionHash: hashSchema,
  afterProjectionHash: hashSchema,
  transactionHash: hashSchema.nullable(),
  warnings: z.array(z.string().min(1)),
}).strict().superRefine((preview, context) => {
  const empty = preview.selectedCandidateIds.length === 0;
  if (empty) {
    if (preview.afterDurationFrames !== preview.beforeDurationFrames
      || preview.deleteFrameCount !== 0
      || preview.operationCount !== 0
      || preview.beforeCaptionCount !== preview.afterCaptionCount
      || preview.affectedClipIds.length !== 0
      || preview.affectedWordIds.length !== 0
      || preview.beforeTimeMapHash !== preview.afterTimeMapHash
      || preview.beforeMasterTranscriptHash !== preview.afterMasterTranscriptHash
      || preview.beforeProjectionHash !== preview.afterProjectionHash
      || preview.transactionHash !== null) {
      context.addIssue({ code: "custom", message: "an empty rough-cut selection must be an exact no-op preview" });
    }
    return;
  }
  if (preview.deleteFrameCount <= 0 || preview.operationCount <= 0 || preview.affectedClipIds.length === 0 || preview.transactionHash === null) {
    context.addIssue({ code: "custom", message: "a selected rough-cut preview requires positive impact and transaction evidence" });
  }
});

export const roughCutCommitEvidenceSchema = z.object({
  resultRevision: z.number().int().positive(),
  documentHash: hashSchema,
  timeMapHash: hashSchema,
  masterTranscriptHash: hashSchema,
  projectionHash: hashSchema,
}).strict();

export const roughCutExecutionSchema = z.object({
  applicationId: idSchema,
  transaction: timelineTransactionV1Schema,
  transactionHash: hashSchema,
  confirmationId: idSchema,
  confirmedAt: isoInstantSchema,
  commit: roughCutCommitEvidenceSchema.nullable(),
}).strict().superRefine((execution, context) => {
  const hashInput = structuredClone(execution.transaction);
  const confirmation = hashInput.proposalGate.confirmation;
  hashInput.proposalGate.confirmation = null;
  if (execution.transactionHash !== canonicalHash(hashInput)) {
    context.addIssue({ code: "custom", path: ["transactionHash"], message: "transaction hash must match its canonical unconfirmed content" });
  }
  if (confirmation === null) {
    context.addIssue({ code: "custom", path: ["transaction", "proposalGate", "confirmation"], message: "rough-cut execution requires confirmation evidence" });
  } else {
    if (execution.confirmationId !== confirmation.confirmationId) {
      context.addIssue({ code: "custom", path: ["confirmationId"], message: "confirmation id must match the transaction gate" });
    }
    if (execution.confirmedAt !== confirmation.confirmedAt) {
      context.addIssue({ code: "custom", path: ["confirmedAt"], message: "confirmation time must match the transaction gate" });
    }
    if (execution.transactionHash !== confirmation.transactionHash) {
      context.addIssue({ code: "custom", path: ["transactionHash"], message: "execution and confirmation transaction hashes must match" });
    }
  }
  if (execution.transaction.transactionId !== `transaction:rough-cut:${execution.applicationId}`
    || execution.transaction.idempotencyKey !== `idempotency:rough-cut:${execution.applicationId}`) {
    context.addIssue({ code: "custom", path: ["applicationId"], message: "application id must bind the transaction and idempotency identities" });
  }
});

export const roughCutProposalStatusSchema = z.enum(["pending", "applying", "applied", "rejected", "conflicted"]);

export const roughCutProposalSchema = z.object({
  schemaVersion: z.literal(1),
  proposalId: idSchema,
  sessionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  baseDocumentHash: hashSchema,
  brief: z.string().min(1).max(2_000),
  sourceTranscripts: z.array(roughCutSourceRefSchema).min(1),
  beforeTimeMap: roughCutTimeMapSchema,
  beforeMasterTranscript: masterTranscriptSchema,
  candidates: z.array(roughCutCandidateSchema),
  preview: roughCutPreviewSchema,
  proposalHash: hashSchema,
  textReviewSubmissionHash: hashSchema.nullable().default(null),
  status: roughCutProposalStatusSchema,
  conflictCode: z.string().min(1).nullable(),
  execution: roughCutExecutionSchema.nullable(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((proposal, context) => {
  const candidateIds = proposal.candidates.map((candidate) => candidate.candidateId);
  if (new Set(candidateIds).size !== candidateIds.length) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "candidate ids must be unique" });
  }
  const selected = proposal.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.candidateId).sort();
  const previewSelected = [...proposal.preview.selectedCandidateIds].sort();
  if (JSON.stringify(selected) !== JSON.stringify(previewSelected)) {
    context.addIssue({ code: "custom", path: ["preview", "selectedCandidateIds"], message: "preview selection must equal candidate selection" });
  }
  if ((proposal.status === "applying" || proposal.status === "applied") && proposal.execution === null) {
    context.addIssue({ code: "custom", path: ["execution"], message: "applying or applied proposal requires execution" });
  }
  if (proposal.status === "applied" && proposal.execution?.commit === null) {
    context.addIssue({ code: "custom", path: ["execution", "commit"], message: "applied proposal requires commit evidence" });
  }
  if (proposal.status === "conflicted" && proposal.conflictCode === null) {
    context.addIssue({ code: "custom", path: ["conflictCode"], message: "conflicted proposal requires a code" });
  }
  const expectedProposalHash = canonicalHash({
    proposalId: proposal.proposalId,
    sessionId: proposal.sessionId,
    projectId: proposal.projectId,
    timelineId: proposal.timelineId,
    baseRevision: proposal.baseRevision,
    baseDocumentHash: proposal.baseDocumentHash,
    brief: proposal.brief,
    sourceTranscripts: proposal.sourceTranscripts,
    candidates: proposal.candidates,
    preview: proposal.preview,
  });
  if (proposal.proposalHash !== expectedProposalHash) {
    context.addIssue({ code: "custom", path: ["proposalHash"], message: "proposal hash must match its canonical semantic content" });
  }
});

export const roughCutAuditKindSchema = z.enum([
  "proposal_created",
  "candidate_added",
  "selection_updated",
  "text_review_submitted",
  "proposal_confirmed",
  "transaction_applied",
  "proposal_rejected",
  "proposal_conflicted",
  "recovery_resumed",
]);

export const roughCutAuditEventSchema = z.object({
  auditId: idSchema,
  kind: roughCutAuditKindSchema,
  proposalId: idSchema,
  sessionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  detailHash: hashSchema,
  createdAt: isoInstantSchema,
}).strict();

export const roughCutPersistentStateSchema = z.object({
  schemaVersion: z.literal(1),
  proposals: z.array(roughCutProposalSchema).max(4_096),
  audit: z.array(roughCutAuditEventSchema).max(16_384),
}).strict();

export const roughCutAvailabilitySchema = z.object({
  state: z.enum(["ready", "unavailable"]),
  code: z.string().min(1).nullable(),
  message: z.string().min(1),
  sourceTranscripts: z.array(roughCutSourceRefSchema),
  currentRevision: z.number().int().nonnegative(),
  currentTimeMapHash: hashSchema.nullable(),
  currentMasterTranscriptHash: hashSchema.nullable(),
  currentProjectionHash: hashSchema,
}).strict();

export const roughCutSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  availability: roughCutAvailabilitySchema,
  proposals: z.array(roughCutProposalSchema),
  auditCount: z.number().int().nonnegative(),
  registeredProposalTools: z.tuple([z.literal("rough_cut_create_proposal")]),
}).strict();

const roughCutScopeSchema = {
  sessionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  expectedRevision: z.number().int().nonnegative(),
} as const;

export const createRoughCutProposalRequestSchema = z.object({
  ...roughCutScopeSchema,
  proposalId: idSchema,
  brief: z.string().trim().min(1).max(2_000),
  initialSelectedKinds: z.array(roughCutCandidateKindSchema).max(roughCutCandidateKindSchema.options.length).optional(),
  createdAt: isoInstantSchema,
}).strict().superRefine((request, context) => {
  if (request.initialSelectedKinds !== undefined
    && new Set(request.initialSelectedKinds).size !== request.initialSelectedKinds.length) {
    context.addIssue({
      code: "custom",
      path: ["initialSelectedKinds"],
      message: "initial selected candidate kinds must be unique",
    });
  }
});

export const updateRoughCutSelectionRequestSchema = z.object({
  ...roughCutScopeSchema,
  proposalId: idSchema,
  selectedCandidateIds: z.array(idSchema),
  updatedAt: isoInstantSchema,
}).strict().superRefine((request, context) => {
  if (new Set(request.selectedCandidateIds).size !== request.selectedCandidateIds.length) {
    context.addIssue({ code: "custom", path: ["selectedCandidateIds"], message: "selected candidate ids must be unique" });
  }
});

export const addRoughCutTranscriptDuplicateRequestSchema = z.object({
  ...roughCutScopeSchema,
  proposalId: idSchema,
  retainedWordIds: z.array(idSchema).min(1).max(96),
  duplicateWordIds: z.array(idSchema).min(1).max(96),
  rationale: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
  updatedAt: isoInstantSchema,
}).strict().superRefine((request, context) => {
  if (new Set(request.retainedWordIds).size !== request.retainedWordIds.length) {
    context.addIssue({ code: "custom", path: ["retainedWordIds"], message: "retained word ids must be unique" });
  }
  if (new Set(request.duplicateWordIds).size !== request.duplicateWordIds.length) {
    context.addIssue({ code: "custom", path: ["duplicateWordIds"], message: "duplicate word ids must be unique" });
  }
  if (request.retainedWordIds.some((wordId) => request.duplicateWordIds.includes(wordId))) {
    context.addIssue({ code: "custom", path: ["duplicateWordIds"], message: "retained and duplicate word ids must not overlap" });
  }
});

export const roughCutTextReviewIssueKindSchema = z.enum([
  "repeated_expression",
  "restart",
  "self_correction",
  "stutter",
  "filler_word",
]);

export const roughCutTextReviewFindingSchema = z.object({
  issueKind: roughCutTextReviewIssueKindSchema,
  deleteWordIds: z.array(idSchema).min(1).max(96),
  keepWordIds: z.array(idSchema).max(96),
  rationale: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
}).strict().superRefine((finding, context) => {
  if (new Set(finding.deleteWordIds).size !== finding.deleteWordIds.length) {
    context.addIssue({ code: "custom", path: ["deleteWordIds"], message: "delete word ids must be unique" });
  }
  if (new Set(finding.keepWordIds).size !== finding.keepWordIds.length) {
    context.addIssue({ code: "custom", path: ["keepWordIds"], message: "keep word ids must be unique" });
  }
  if (finding.deleteWordIds.some((wordId) => finding.keepWordIds.includes(wordId))) {
    context.addIssue({ code: "custom", path: ["keepWordIds"], message: "delete and keep word ids must not overlap" });
  }
  if (finding.issueKind !== "filler_word" && finding.keepWordIds.length === 0) {
    context.addIssue({ code: "custom", path: ["keepWordIds"], message: "non-filler text findings require a retained word range" });
  }
});

export const submitRoughCutTextReviewRequestSchema = z.object({
  ...roughCutScopeSchema,
  proposalId: idSchema,
  selectedAuxiliaryCandidateIds: z.array(idSchema).max(512),
  findings: z.array(roughCutTextReviewFindingSchema).max(128),
  updatedAt: isoInstantSchema,
}).strict().superRefine((request, context) => {
  if (new Set(request.selectedAuxiliaryCandidateIds).size !== request.selectedAuxiliaryCandidateIds.length) {
    context.addIssue({
      code: "custom",
      path: ["selectedAuxiliaryCandidateIds"],
      message: "selected auxiliary candidate ids must be unique",
    });
  }
});

export const applyRoughCutProposalRequestSchema = z.object({
  ...roughCutScopeSchema,
  proposalId: idSchema,
  applicationId: idSchema,
  confirmed: z.literal(true),
  confirmedAt: isoInstantSchema,
}).strict();

export const rejectRoughCutProposalRequestSchema = z.object({
  ...roughCutScopeSchema,
  proposalId: idSchema,
  rejectionId: idSchema,
  rejectedAt: isoInstantSchema,
}).strict();

export const ROUGH_CUT_PROPOSAL_TOOLS = ["rough_cut_create_proposal"] as const;

export type RoughCutSourceRef = z.infer<typeof roughCutSourceRefSchema>;
export type RoughCutTimeMap = z.infer<typeof roughCutTimeMapSchema>;
export type RoughCutTimeMapSegment = z.infer<typeof roughCutTimeMapSegmentSchema>;
export type RoughCutCandidate = z.infer<typeof roughCutCandidateSchema>;
export type RoughCutPreview = z.infer<typeof roughCutPreviewSchema>;
export type RoughCutProposal = z.infer<typeof roughCutProposalSchema>;
export type RoughCutPersistentState = z.infer<typeof roughCutPersistentStateSchema>;
export type RoughCutSnapshot = z.infer<typeof roughCutSnapshotSchema>;
export type CreateRoughCutProposalRequest = z.infer<typeof createRoughCutProposalRequestSchema>;
export type UpdateRoughCutSelectionRequest = z.infer<typeof updateRoughCutSelectionRequestSchema>;
export type AddRoughCutTranscriptDuplicateRequest = z.infer<typeof addRoughCutTranscriptDuplicateRequestSchema>;
export type RoughCutTextReviewIssueKind = z.infer<typeof roughCutTextReviewIssueKindSchema>;
export type RoughCutTextReviewFinding = z.infer<typeof roughCutTextReviewFindingSchema>;
export type SubmitRoughCutTextReviewRequest = z.infer<typeof submitRoughCutTextReviewRequestSchema>;
export type ApplyRoughCutProposalRequest = z.infer<typeof applyRoughCutProposalRequestSchema>;
export type RejectRoughCutProposalRequest = z.infer<typeof rejectRoughCutProposalRequestSchema>;
