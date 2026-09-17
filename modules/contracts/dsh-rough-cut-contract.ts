import { z } from "zod";
import { visualParagraphReviewScopeSchema } from "./visual-paragraph-contract.js";

const idSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9:._-]+$/u);
const instantSchema = z.string().datetime({ offset: false });
const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const dshRoughCutCandidateKindSchema = z.enum(["silence", "duplicate_speech", "filler_word"]);
export const dshRoughCutTextReviewIssueKindSchema = z.enum([
  "repeated_expression",
  "restart",
  "self_correction",
  "stutter",
  "filler_word",
]);
export const dshRoughCutExecutionModeSchema = z.enum(["review", "ai_draft"]);
export const dshRoughCutTurnKindSchema = z.enum([
  "editing",
  "visual_paragraph",
  "visual_paragraph_agent",
  "visual_role_plan",
  "visual_role_agent",
  "layout_plan",
  "layout_agent",
  "scene_direction_plan",
  "packaging_resolution_plan",
]);
export const dshRoughCutToolNameSchema = z.enum([
  "project_get_safe_summary",
  "assets_get_safe_summary",
  "timeline_get_safe_summary",
  "selection_get_safe_summary",
  "transcript_read_page",
  "editor_split_at_playhead",
  "editor_request_delete_selected_clip",
  "editor_request_trim_to_playhead",
  "editor_apply_confirmed_edit",
  "rough_cut_create_proposal",
  "rough_cut_add_transcript_duplicate",
  "rough_cut_stage_text_finding",
  "rough_cut_submit_text_review",
  "rough_cut_update_selection",
  "rough_cut_request_confirmation",
  "rough_cut_apply_confirmed",
  "editor_undo",
  "editor_redo",
  "visual_paragraph_create_proposal",
  "visual_paragraph_read_transcript_page",
  "visual_paragraph_submit_review",
  "visual_paragraph_get_review_context",
  "visual_paragraph_read_revision_transcript_page",
  "visual_paragraph_propose_revision",
  "visual_role_create_proposal",
  "visual_role_read_structure_page",
  "visual_role_read_transcript_page",
  "visual_role_lock_ideal_roles",
  "visual_role_read_material_manifest_page",
  "visual_role_submit_ideal_plan",
  "visual_role_report_structure_issue",
  "visual_role_get_review_context",
  "visual_role_read_review_transcript_page",
  "visual_role_read_review_manifest_page",
  "visual_role_propose_local_revision",
  "visual_role_report_local_blocker",
  "layout_create_proposal",
  "layout_read_foundation_page",
  "layout_read_catalog_page",
  "layout_submit_plan",
  "layout_get_review_context",
  "layout_read_review_catalog_page",
  "layout_propose_local_revision",
  "layout_report_local_blocker",
  "scene_direction_create_proposal",
  "scene_direction_read_foundation_page",
  "scene_direction_read_transcript_page",
  "scene_direction_read_method_catalog",
  "scene_direction_submit_plan",
  "packaging_resolution_create_proposal",
  "packaging_resolution_read_foundation_page",
  "packaging_resolution_read_catalog_page",
  "packaging_resolution_submit_plan",
]);

export const DSH_ROUGH_CUT_TOOL_NAMES = dshRoughCutToolNameSchema.options;

export const dshRoughCutTurnStateSchema = z.enum([
  "understanding",
  "analyzing_rough_cut",
  "analyzing_visual_paragraph",
  "analyzing_visual_role",
  "analyzing_layout",
  "analyzing_scene_direction",
  "analyzing_packaging_resolution",
  "waiting_confirmation",
  "applying",
  "completed",
  "read_only_completed",
  "cancelled",
  "failed",
  "interrupted",
]);

export const dshRoughCutSelectionContextSchema = z.object({
  selectedClipId: idSchema.nullable(),
  selectedAssetId: idSchema.nullable(),
  playheadFrame: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  rippleEnabled: z.boolean().default(false),
  mainTrackMagnetEnabled: z.boolean().default(true),
}).strict();

export const submitDshRoughCutTurnRequestSchema = z.object({
  expectedRevision: revisionSchema,
  submittedAt: instantSchema,
  userText: z.string().trim().min(1).max(1_000),
  executionMode: dshRoughCutExecutionModeSchema.default("review"),
  context: dshRoughCutSelectionContextSchema,
}).strict();

export const resumeDshRoughCutTurnRequestSchema = z.object({
  turnId: idSchema,
  expectedRevision: revisionSchema,
  resumedAt: instantSchema,
  executionMode: dshRoughCutExecutionModeSchema.default("review"),
  context: dshRoughCutSelectionContextSchema,
}).strict();

const dshRoughCutSourceQuoteRangeSchema = z.object({
  startWordIndex: z.number().int().nonnegative().max(1_000_000),
  endWordIndexExclusive: z.number().int().nonnegative().max(1_000_000),
}).strict().superRefine((range, context) => {
  if (range.endWordIndexExclusive <= range.startWordIndex) {
    context.addIssue({
      code: "custom",
      path: ["endWordIndexExclusive"],
      message: "source quote range must contain at least one word",
    });
  }
});

const dshRoughCutSourceQuoteSelectionSchema = z.object({
  range: dshRoughCutSourceQuoteRangeSchema,
  // Keep quote bytes exact. The resolver is deliberately case-, whitespace- and punctuation-sensitive.
  quote: z.string().min(1).max(4_000),
  occurrence: z.number().int().nonnegative().max(1_000_000),
}).strict();

const dshRoughCutTextReviewFindingSchema = z.object({
  issueKind: dshRoughCutTextReviewIssueKindSchema,
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

const dshRoughCutSourceTextReviewFindingSchema = z.object({
  issueKind: dshRoughCutTextReviewIssueKindSchema,
  deleteSelection: dshRoughCutSourceQuoteSelectionSchema,
  keepSelection: dshRoughCutSourceQuoteSelectionSchema.nullable(),
  rationale: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
}).strict().superRefine((finding, context) => {
  if (finding.issueKind !== "filler_word" && finding.keepSelection === null) {
    context.addIssue({
      code: "custom",
      path: ["keepSelection"],
      message: "non-filler text findings require an exact retained quote selection",
    });
  }
});

export const dshRoughCutTextReviewFindingDraftSchema = z.object({
  draftId: idSchema,
  proposalId: idSchema,
  transcriptHash: hashSchema,
  expectedRevision: revisionSchema,
  sourceFinding: dshRoughCutSourceTextReviewFindingSchema,
  finding: dshRoughCutTextReviewFindingSchema,
}).strict();

export const dshRoughCutJobRequestSchema = z.object({
  jobId: idSchema,
}).strict();

export const confirmDshRoughCutRequestSchema = z.object({
  turnId: idSchema,
  confirmationId: idSchema,
  proposalId: idSchema,
  expectedRevision: revisionSchema,
  confirmed: z.literal(true),
  confirmedAt: instantSchema,
}).strict();

export const dshEditorEditKindSchema = z.enum([
  "delete_selected_clip",
  "trim_before_playhead",
  "trim_after_playhead",
]);

export const dshEditorEditSchema = z.object({
  editId: idSchema,
  editHash: hashSchema,
  confirmationId: idSchema,
  turnId: idSchema,
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: revisionSchema,
  baseDocumentHash: hashSchema.nullable().default(null),
  kind: dshEditorEditKindSchema,
  clipId: idSchema,
  clipName: z.string().min(1).max(256),
  playheadFrame: revisionSchema,
  affectedStartFrame: revisionSchema,
  affectedEndFrame: revisionSchema,
  deleteFrameCount: revisionSchema,
  dependentCaptionCueIds: z.array(idSchema).max(10_000).default([]),
  dependentTransitionEdgeIds: z.array(idSchema).max(10_000).default([]),
  ripple: z.boolean(),
  magnet: z.boolean(),
  summary: z.string().min(1).max(500),
  status: z.enum(["pending", "applying", "applied", "rejected", "expired"]),
  applicationId: idSchema,
  createdAt: instantSchema,
  confirmedAt: instantSchema.nullable(),
  consumedAt: instantSchema.nullable(),
  transactionId: idSchema.nullable(),
  resultRevision: revisionSchema.nullable(),
}).strict().superRefine((edit, context) => {
  if (new Set(edit.dependentCaptionCueIds).size !== edit.dependentCaptionCueIds.length) {
    context.addIssue({ code: "custom", path: ["dependentCaptionCueIds"], message: "dependent caption cue ids must be unique" });
  }
  if (new Set(edit.dependentTransitionEdgeIds).size !== edit.dependentTransitionEdgeIds.length) {
    context.addIssue({ code: "custom", path: ["dependentTransitionEdgeIds"], message: "dependent transition edge ids must be unique" });
  }
});

export const confirmDshEditorEditRequestSchema = z.object({
  turnId: idSchema,
  editId: idSchema,
  editHash: hashSchema,
  confirmationId: idSchema,
  expectedRevision: revisionSchema,
  confirmed: z.literal(true),
  confirmedAt: instantSchema,
}).strict();

export const rejectDshEditorEditRequestSchema = z.object({
  turnId: idSchema,
  editId: idSchema,
  editHash: hashSchema,
  confirmationId: idSchema,
  expectedRevision: revisionSchema,
  rejectedAt: instantSchema,
}).strict();

export const dshRoughCutToolCallSchema = z.object({
  sequence: z.number().int().positive(),
  callId: idSchema,
  name: dshRoughCutToolNameSchema,
  actor: z.enum(["model", "user", "host"]),
  state: z.enum(["succeeded", "rejected", "failed"]),
  argumentHash: hashSchema,
  resultSummary: z.string().min(1).max(512),
  createdAt: instantSchema,
}).strict();

export const dshRoughCutFailureSchema = z.object({
  code: z.string().min(1).max(128).regex(/^[A-Z0-9_]+$/u),
  message: z.string().min(1).max(1_024),
}).strict();

export const dshRoughCutConfirmationSchema = z.object({
  confirmationId: idSchema,
  turnId: idSchema,
  proposalId: idSchema,
  proposalHash: hashSchema,
  baseRevision: revisionSchema,
  status: z.enum(["pending", "applying", "applied", "expired"]),
  applicationId: idSchema,
  createdAt: instantSchema,
  confirmedAt: instantSchema.nullable(),
  consumedAt: instantSchema.nullable(),
  transactionId: idSchema.nullable(),
  resultRevision: revisionSchema.nullable(),
  source: z.enum(["interactive", "ai_draft_authorization"]).default("interactive"),
  authorizationId: idSchema.nullable().default(null),
  authorizationHash: hashSchema.nullable().default(null),
}).strict().superRefine((confirmation, context) => {
  const authorizedDraft = confirmation.source === "ai_draft_authorization";
  if (authorizedDraft !== (confirmation.authorizationId !== null && confirmation.authorizationHash !== null)) {
    context.addIssue({
      code: "custom",
      path: ["source"],
      message: "AI draft confirmations require one exact user authorization binding",
    });
  }
});

export const dshRoughCutTurnSchema = z.object({
  turnId: idSchema,
  jobId: idSchema,
  sessionId: idSchema,
  dshSessionId: idSchema.nullable(),
  projectId: idSchema,
  timelineId: idSchema,
  expectedRevision: revisionSchema,
  state: dshRoughCutTurnStateSchema,
  turnKind: dshRoughCutTurnKindSchema.default("editing"),
  userText: z.string().min(1).max(1_000),
  executionMode: dshRoughCutExecutionModeSchema.default("review"),
  draftAuthorizationId: idSchema.nullable().default(null),
  draftAuthorizationHash: hashSchema.nullable().default(null),
  draftAuthorizationConsumedAt: instantSchema.nullable().default(null),
  intentSummary: z.string().min(1).max(500).nullable(),
  assistantText: z.string().min(1).max(4_000).nullable(),
  context: dshRoughCutSelectionContextSchema,
  proposalId: idSchema.nullable(),
  proposalHash: hashSchema.nullable(),
  confirmationId: idSchema.nullable(),
  editId: idSchema.nullable().default(null),
  roughCutRemoveKinds: z.array(dshRoughCutCandidateKindSchema).max(3).default([]),
  roughCutKeepKinds: z.array(dshRoughCutCandidateKindSchema).max(3).default([]),
  modelCandidateDecisionIds: z.array(idSchema).max(512).default([]),
  transcriptProposalId: idSchema.nullable().default(null),
  transcriptHash: hashSchema.nullable().default(null),
  transcriptWordCount: z.number().int().nonnegative().max(1_000_000).default(0),
  transcriptReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(1_000_000),
    endIndex: z.number().int().positive().max(1_000_000),
  }).strict()).max(512).default([]),
  modelTranscriptCandidateIds: z.array(idSchema).max(512).default([]),
  textReviewProposalId: idSchema.nullable().default(null),
  textReviewTranscriptHash: hashSchema.nullable().default(null),
  textReviewTranscriptWordCount: z.number().int().nonnegative().max(1_000_000).default(0),
  textReviewSubmissionHash: hashSchema.nullable().default(null),
  textReviewFindingDrafts: z.array(dshRoughCutTextReviewFindingDraftSchema).max(128).default([]),
  visualParagraphConversationRootProposalId: idSchema.nullable().default(null),
  visualParagraphScope: visualParagraphReviewScopeSchema.nullable().default(null),
  visualParagraphRevisionId: idSchema.nullable().default(null),
  visualParagraphRevisionHash: hashSchema.nullable().default(null),
  visualRoleStructureSnapshotId: idSchema.nullable().default(null),
  visualRoleStructureHash: hashSchema.nullable().default(null),
  visualRoleMaterialManifestId: idSchema.nullable().default(null),
  visualRoleMaterialManifestHash: hashSchema.nullable().default(null),
  visualRoleStructureItemCount: z.number().int().nonnegative().max(512).default(0),
  visualRoleStructureReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(512),
    endIndex: z.number().int().positive().max(512),
  }).strict()).max(32).default([]),
  visualRoleIdealLockId: idSchema.nullable().default(null),
  visualRoleIdealLockHash: hashSchema.nullable().default(null),
  visualRoleIdealLockedParagraphs: z.array(z.record(z.string(), z.unknown())).max(512).default([]),
  visualRoleManifestEntryCount: z.number().int().nonnegative().max(4_096).default(0),
  visualRoleManifestReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(4_096),
    endIndex: z.number().int().positive().max(4_096),
  }).strict()).max(128).default([]),
  visualRoleTerminalTool: z.enum([
    "visual_role_submit_ideal_plan",
    "visual_role_report_structure_issue",
  ]).nullable().default(null),
  visualRolePlanId: idSchema.nullable().default(null),
  visualRolePlanHash: hashSchema.nullable().default(null),
  visualRolePlanCreatedByTurn: z.boolean().default(false),
  visualRoleOutcome: z.enum([
    "WAITING_MATERIAL_DECISION",
    "READY_FOR_REVIEW",
    "STRUCTURE_REVIEW_REQUIRED",
  ]).nullable().default(null),
  visualRoleReviewMode: z.enum(["DOWNGRADE", "REVIEW"]).nullable().default(null),
  visualRoleReviewContextId: idSchema.nullable().default(null),
  visualRoleReviewContextHash: hashSchema.nullable().default(null),
  visualRoleReviewTargetParagraphIds: z.array(idSchema).max(3).default([]),
  visualRoleReviewAllowedParagraphIds: z.array(idSchema).max(3).default([]),
  visualRoleReviewTriggerRequirementId: idSchema.nullable().default(null),
  visualRoleReviewTriggerRequirementHash: hashSchema.nullable().default(null),
  visualRoleReviewTerminalTool: z.enum([
    "visual_role_propose_local_revision",
    "visual_role_report_local_blocker",
  ]).nullable().default(null),
  visualRolePlanProposalId: idSchema.nullable().default(null),
  visualRolePlanProposalHash: hashSchema.nullable().default(null),
  visualRolePlanProposalCreatedByTurn: z.boolean().default(false),
  visualRoleReviewOutcome: z.enum([
    "PENDING_USER_DECISION",
    "BLOCKED",
    "EXPLANATION_ONLY",
  ]).nullable().default(null),
  layoutProposalId: idSchema.nullable().default(null),
  layoutProposalHash: hashSchema.nullable().default(null),
  layoutFoundationId: idSchema.nullable().default(null),
  layoutFoundationHash: hashSchema.nullable().default(null),
  layoutContextPackId: idSchema.nullable().default(null),
  layoutContextPackHash: hashSchema.nullable().default(null),
  layoutCatalogId: idSchema.nullable().default(null),
  layoutCatalogHash: hashSchema.nullable().default(null),
  layoutFoundationItemCount: z.number().int().nonnegative().max(512).default(0),
  layoutFoundationReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(512),
    endIndex: z.number().int().positive().max(512),
  }).strict()).max(32).default([]),
  layoutCatalogVariantCount: z.number().int().nonnegative().max(128).default(0),
  layoutCatalogReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(128),
    endIndex: z.number().int().positive().max(128),
  }).strict()).max(32).default([]),
  layoutTerminalTool: z.literal("layout_submit_plan").nullable().default(null),
  layoutPlanId: idSchema.nullable().default(null),
  layoutPlanHash: hashSchema.nullable().default(null),
  layoutPlanCreatedByTurn: z.boolean().default(false),
  layoutOutcome: z.literal("READY_FOR_REVIEW").nullable().default(null),
  layoutReviewContextId: idSchema.nullable().default(null),
  layoutReviewContextHash: hashSchema.nullable().default(null),
  layoutReviewTargetParagraphIds: z.array(idSchema).max(3).default([]),
  layoutReviewAllowedParagraphIds: z.array(idSchema).max(3).default([]),
  layoutReviewCatalogVariantCount: z.number().int().nonnegative().max(128).default(0),
  layoutReviewCatalogReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(128),
    endIndex: z.number().int().positive().max(128),
  }).strict()).max(32).default([]),
  layoutReviewTerminalTool: z.enum([
    "layout_propose_local_revision",
    "layout_report_local_blocker",
  ]).nullable().default(null),
  layoutPlanProposalId: idSchema.nullable().default(null),
  layoutPlanProposalHash: hashSchema.nullable().default(null),
  layoutPlanProposalCreatedByTurn: z.boolean().default(false),
  layoutReviewOutcome: z.enum([
    "PENDING_USER_DECISION",
    "BLOCKED",
    "EXPLANATION_ONLY",
  ]).nullable().default(null),
  sceneDirectionProposalId: idSchema.nullable().default(null),
  sceneDirectionProposalHash: hashSchema.nullable().default(null),
  sceneDirectionFoundationId: idSchema.nullable().default(null),
  sceneDirectionFoundationHash: hashSchema.nullable().default(null),
  sceneDirectionContextPackId: idSchema.nullable().default(null),
  sceneDirectionContextPackHash: hashSchema.nullable().default(null),
  sceneDirectionCatalogId: idSchema.nullable().default(null),
  sceneDirectionCatalogHash: hashSchema.nullable().default(null),
  sceneDirectionFoundationItemCount: z.number().int().nonnegative().max(512).default(0),
  sceneDirectionFoundationReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(512),
    endIndex: z.number().int().positive().max(512),
  }).strict()).max(32).default([]),
  sceneDirectionMethodCatalogRead: z.boolean().default(false),
  sceneDirectionTerminalTool: z.literal("scene_direction_submit_plan").nullable().default(null),
  sceneDirectionPlanId: idSchema.nullable().default(null),
  sceneDirectionPlanHash: hashSchema.nullable().default(null),
  sceneDirectionPlanCreatedByTurn: z.boolean().default(false),
  sceneDirectionOutcome: z.literal("READY_FOR_REVIEW").nullable().default(null),
  packagingResolutionProposalId: idSchema.nullable().default(null),
  packagingResolutionProposalHash: hashSchema.nullable().default(null),
  packagingResolutionFoundationId: idSchema.nullable().default(null),
  packagingResolutionFoundationHash: hashSchema.nullable().default(null),
  packagingResolutionContextPackId: idSchema.nullable().default(null),
  packagingResolutionContextPackHash: hashSchema.nullable().default(null),
  packagingResolutionCatalogId: idSchema.nullable().default(null),
  packagingResolutionCatalogHash: hashSchema.nullable().default(null),
  packagingResolutionFoundationItemCount: z.number().int().nonnegative().max(512).default(0),
  packagingResolutionFoundationReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(512),
    endIndex: z.number().int().positive().max(512),
  }).strict()).max(32).default([]),
  packagingResolutionCatalogItemCount: z.number().int().nonnegative().max(40).default(0),
  packagingResolutionCatalogReadRanges: z.array(z.object({
    startIndex: z.number().int().nonnegative().max(40),
    endIndex: z.number().int().positive().max(40),
  }).strict()).max(4).default([]),
  packagingResolutionTerminalTool: z.literal("packaging_resolution_submit_plan").nullable().default(null),
  packagingResolutionPlanId: idSchema.nullable().default(null),
  packagingResolutionPlanHash: hashSchema.nullable().default(null),
  packagingResolutionPlanCreatedByTurn: z.boolean().default(false),
  packagingResolutionOutcome: z.enum([
    "READY_FOR_PROJECT_AUDITION",
    "BLOCKED_COMPONENT_GAPS",
  ]).nullable().default(null),
  provider: z.string().min(1).max(128),
  model: z.string().min(1).max(256),
  dshVersion: z.string().min(1).max(64),
  dshPid: z.number().int().positive().nullable(),
  resumedFromTurnId: idSchema.nullable(),
  toolCalls: z.array(dshRoughCutToolCallSchema).max(256),
  error: dshRoughCutFailureSchema.nullable(),
  orphanCount: z.number().int().nonnegative(),
  submittedAt: instantSchema,
  updatedAt: instantSchema,
}).strict().superRefine((turn, context) => {
  const hasAuthorization = turn.draftAuthorizationId !== null && turn.draftAuthorizationHash !== null;
  if ((turn.executionMode === "ai_draft") !== hasAuthorization) {
    context.addIssue({
      code: "custom",
      path: ["executionMode"],
      message: "AI draft turns require one exact user authorization",
    });
  }
  if ((turn.turnKind === "visual_paragraph" || turn.turnKind === "visual_paragraph_agent")
    && turn.executionMode !== "review") {
    context.addIssue({
      code: "custom",
      path: ["executionMode"],
      message: "visual-paragraph turns are read-only review turns",
    });
  }
  if ((turn.turnKind === "visual_role_plan" || turn.turnKind === "visual_role_agent")
    && turn.executionMode !== "review") {
    context.addIssue({
      code: "custom",
      path: ["executionMode"],
      message: "visual-role-plan turns are read-only design turns",
    });
  }
  if ((turn.turnKind === "layout_plan" || turn.turnKind === "layout_agent")
    && turn.executionMode !== "review") {
    context.addIssue({
      code: "custom",
      path: ["executionMode"],
      message: "layout turns are read-only design turns",
    });
  }
  if (turn.turnKind === "scene_direction_plan" && turn.executionMode !== "review") {
    context.addIssue({
      code: "custom",
      path: ["executionMode"],
      message: "scene-direction turns are read-only design turns",
    });
  }
  if (turn.turnKind === "packaging_resolution_plan" && turn.executionMode !== "review") {
    context.addIssue({
      code: "custom",
      path: ["executionMode"],
      message: "packaging-resolution turns are read-only project-audition turns",
    });
  }
  if (turn.turnKind === "visual_paragraph_agent"
    && (turn.proposalId === null
      || turn.proposalHash === null
      || turn.visualParagraphConversationRootProposalId === null
      || turn.visualParagraphScope === null)) {
    context.addIssue({
      code: "custom",
      path: ["turnKind"],
      message: "visual-paragraph Agent turns require exact proposal, lineage and scope bindings",
    });
  }
  const kinds = [...turn.roughCutRemoveKinds, ...turn.roughCutKeepKinds];
  if (new Set(kinds).size !== kinds.length) {
    context.addIssue({ code: "custom", path: ["roughCutRemoveKinds"], message: "rough-cut kind policy must be disjoint" });
  }
  if (new Set(turn.modelCandidateDecisionIds).size !== turn.modelCandidateDecisionIds.length) {
    context.addIssue({ code: "custom", path: ["modelCandidateDecisionIds"], message: "model candidate decisions must be unique" });
  }
  if (new Set(turn.modelTranscriptCandidateIds).size !== turn.modelTranscriptCandidateIds.length) {
    context.addIssue({ code: "custom", path: ["modelTranscriptCandidateIds"], message: "model transcript candidate ids must be unique" });
  }
  if (new Set(turn.textReviewFindingDrafts.map((draft) => draft.draftId)).size !== turn.textReviewFindingDrafts.length) {
    context.addIssue({ code: "custom", path: ["textReviewFindingDrafts"], message: "text review finding draft ids must be unique" });
  }
  if ((turn.transcriptProposalId === null) !== (turn.transcriptHash === null)) {
    context.addIssue({ code: "custom", path: ["transcriptProposalId"], message: "transcript binding requires both proposal id and hash" });
  }
  if ((turn.visualRoleStructureSnapshotId === null) !== (turn.visualRoleStructureHash === null)
    || (turn.visualRoleMaterialManifestId === null) !== (turn.visualRoleMaterialManifestHash === null)
    || (turn.visualRoleIdealLockId === null) !== (turn.visualRoleIdealLockHash === null)
    || (turn.visualRoleIdealLockId === null) !== (turn.visualRoleIdealLockedParagraphs.length === 0)
    || (turn.visualRolePlanId === null) !== (turn.visualRolePlanHash === null)
    || (turn.visualRoleReviewContextId === null) !== (turn.visualRoleReviewContextHash === null)
    || (turn.visualRoleReviewTriggerRequirementId === null) !== (turn.visualRoleReviewTriggerRequirementHash === null)
    || (turn.visualRolePlanProposalId === null) !== (turn.visualRolePlanProposalHash === null)) {
    context.addIssue({
      code: "custom",
      path: ["visualRoleStructureSnapshotId"],
      message: "visual-role identities require exact id/hash pairs",
    });
  }
  if (turn.turnKind === "visual_role_agent") {
    const exactDowngradeTrigger = turn.visualRoleReviewTriggerRequirementId !== null
      && turn.visualRoleReviewTriggerRequirementHash !== null;
    if (turn.visualRoleReviewMode === null
      || turn.visualRoleReviewContextId === null
      || turn.visualRolePlanId === null
      || turn.visualRoleReviewTargetParagraphIds.length === 0
      || turn.visualRoleReviewAllowedParagraphIds.length === 0
      || turn.visualRoleReviewTargetParagraphIds.some((paragraphId) =>
        !turn.visualRoleReviewAllowedParagraphIds.includes(paragraphId))
      || (turn.visualRoleReviewMode === "DOWNGRADE") !== exactDowngradeTrigger) {
      context.addIssue({
        code: "custom",
        path: ["visualRoleReviewMode"],
        message: "visual-role Agent turns require one exact host-captured plan context and mode-specific trigger",
      });
    }
  }
  if (new Set(turn.visualRoleReviewTargetParagraphIds).size !== turn.visualRoleReviewTargetParagraphIds.length
    || new Set(turn.visualRoleReviewAllowedParagraphIds).size !== turn.visualRoleReviewAllowedParagraphIds.length) {
    context.addIssue({
      code: "custom",
      path: ["visualRoleReviewTargetParagraphIds"],
      message: "visual-role review paragraph scope must be unique",
    });
  }
  if (turn.visualRolePlanCreatedByTurn && turn.visualRolePlanId === null) {
    context.addIssue({
      code: "custom",
      path: ["visualRolePlanCreatedByTurn"],
      message: "a turn-created visual-role plan requires an exact plan binding",
    });
  }
  if (turn.visualRolePlanProposalCreatedByTurn && turn.visualRolePlanProposalId === null) {
    context.addIssue({
      code: "custom",
      path: ["visualRolePlanProposalCreatedByTurn"],
      message: "a turn-created visual-role plan proposal requires an exact proposal binding",
    });
  }
  if (turn.visualRoleOutcome === "STRUCTURE_REVIEW_REQUIRED"
    && (turn.visualRoleTerminalTool !== "visual_role_report_structure_issue"
      || turn.visualRolePlanId !== null)) {
    context.addIssue({
      code: "custom",
      path: ["visualRoleOutcome"],
      message: "structure review outcome cannot carry a visual-role plan",
    });
  }
  if ((turn.visualRoleOutcome === "WAITING_MATERIAL_DECISION"
      || turn.visualRoleOutcome === "READY_FOR_REVIEW")
    && (turn.visualRoleTerminalTool !== "visual_role_submit_ideal_plan"
      || turn.visualRolePlanId === null)) {
    context.addIssue({
      code: "custom",
      path: ["visualRoleOutcome"],
      message: "ideal-plan outcomes require one exact successful plan binding",
    });
  }
  if (turn.visualRoleReviewOutcome === "PENDING_USER_DECISION"
    && (turn.visualRoleReviewTerminalTool !== "visual_role_propose_local_revision"
      || turn.visualRolePlanProposalId === null)) {
    context.addIssue({
      code: "custom",
      path: ["visualRoleReviewOutcome"],
      message: "pending visual-role review outcome requires one exact local revision proposal",
    });
  }
  if (turn.visualRoleReviewOutcome === "BLOCKED"
    && (turn.visualRoleReviewMode !== "DOWNGRADE"
      || turn.visualRoleReviewTerminalTool !== "visual_role_report_local_blocker"
      || turn.visualRolePlanProposalId === null)) {
    context.addIssue({
      code: "custom",
      path: ["visualRoleReviewOutcome"],
      message: "blocked visual-role review outcome requires one exact downgrade blocker record",
    });
  }
  if (turn.visualRoleReviewOutcome === "EXPLANATION_ONLY"
    && (turn.visualRoleReviewMode !== "REVIEW"
      || turn.visualRoleReviewTerminalTool !== null
      || turn.visualRolePlanProposalId !== null)) {
    context.addIssue({
      code: "custom",
      path: ["visualRoleReviewOutcome"],
      message: "explanation-only visual-role review cannot carry a proposal terminal",
    });
  }
  if ((turn.layoutProposalId === null) !== (turn.layoutProposalHash === null)
    || (turn.layoutFoundationId === null) !== (turn.layoutFoundationHash === null)
    || (turn.layoutContextPackId === null) !== (turn.layoutContextPackHash === null)
    || (turn.layoutCatalogId === null) !== (turn.layoutCatalogHash === null)
    || (turn.layoutPlanId === null) !== (turn.layoutPlanHash === null)
    || (turn.layoutReviewContextId === null) !== (turn.layoutReviewContextHash === null)
    || (turn.layoutPlanProposalId === null) !== (turn.layoutPlanProposalHash === null)) {
    context.addIssue({
      code: "custom",
      path: ["layoutProposalId"],
      message: "layout identities require exact id/hash pairs",
    });
  }
  if (turn.turnKind === "layout_agent"
    && (turn.layoutReviewContextId === null
      || turn.layoutPlanId === null
      || turn.layoutReviewTargetParagraphIds.length === 0
      || turn.layoutReviewAllowedParagraphIds.length === 0
      || turn.layoutReviewTargetParagraphIds.some((paragraphId) =>
        !turn.layoutReviewAllowedParagraphIds.includes(paragraphId)))) {
    context.addIssue({
      code: "custom",
      path: ["layoutReviewContextId"],
      message: "layout Agent turns require one exact host-captured plan and paragraph scope",
    });
  }
  if (new Set(turn.layoutReviewTargetParagraphIds).size !== turn.layoutReviewTargetParagraphIds.length
    || new Set(turn.layoutReviewAllowedParagraphIds).size !== turn.layoutReviewAllowedParagraphIds.length) {
    context.addIssue({
      code: "custom",
      path: ["layoutReviewTargetParagraphIds"],
      message: "layout review paragraph scope must be unique",
    });
  }
  if (turn.layoutPlanCreatedByTurn && turn.layoutPlanId === null) {
    context.addIssue({
      code: "custom",
      path: ["layoutPlanCreatedByTurn"],
      message: "a turn-created layout plan requires an exact plan binding",
    });
  }
  if (turn.layoutPlanProposalCreatedByTurn && turn.layoutPlanProposalId === null) {
    context.addIssue({
      code: "custom",
      path: ["layoutPlanProposalCreatedByTurn"],
      message: "a turn-created layout proposal requires an exact proposal binding",
    });
  }
  if (turn.layoutOutcome === "READY_FOR_REVIEW"
    && (turn.layoutTerminalTool !== "layout_submit_plan" || turn.layoutPlanId === null)) {
    context.addIssue({
      code: "custom",
      path: ["layoutOutcome"],
      message: "ready layout outcomes require one exact successful plan binding",
    });
  }
  if (turn.layoutReviewOutcome === "PENDING_USER_DECISION"
    && (turn.layoutReviewTerminalTool !== "layout_propose_local_revision"
      || turn.layoutPlanProposalId === null)) {
    context.addIssue({
      code: "custom",
      path: ["layoutReviewOutcome"],
      message: "pending layout review outcome requires one exact local revision proposal",
    });
  }
  if (turn.layoutReviewOutcome === "BLOCKED"
    && (turn.layoutReviewTerminalTool !== "layout_report_local_blocker"
      || turn.layoutPlanProposalId !== null)) {
    context.addIssue({
      code: "custom",
      path: ["layoutReviewOutcome"],
      message: "blocked layout review outcome cannot carry a local revision proposal",
    });
  }
  if (turn.layoutReviewOutcome === "EXPLANATION_ONLY"
    && (turn.layoutReviewTerminalTool !== null || turn.layoutPlanProposalId !== null)) {
    context.addIssue({
      code: "custom",
      path: ["layoutReviewOutcome"],
      message: "explanation-only layout review cannot carry a proposal terminal",
    });
  }
  if ((turn.sceneDirectionProposalId === null) !== (turn.sceneDirectionProposalHash === null)
    || (turn.sceneDirectionFoundationId === null) !== (turn.sceneDirectionFoundationHash === null)
    || (turn.sceneDirectionContextPackId === null) !== (turn.sceneDirectionContextPackHash === null)
    || (turn.sceneDirectionCatalogId === null) !== (turn.sceneDirectionCatalogHash === null)
    || (turn.sceneDirectionPlanId === null) !== (turn.sceneDirectionPlanHash === null)) {
    context.addIssue({
      code: "custom",
      path: ["sceneDirectionProposalId"],
      message: "scene-direction identities require exact id/hash pairs",
    });
  }
  if (turn.sceneDirectionPlanCreatedByTurn && turn.sceneDirectionPlanId === null) {
    context.addIssue({
      code: "custom",
      path: ["sceneDirectionPlanCreatedByTurn"],
      message: "a turn-created scene-direction plan requires one exact plan binding",
    });
  }
  if (turn.sceneDirectionOutcome === "READY_FOR_REVIEW"
    && (turn.sceneDirectionTerminalTool !== "scene_direction_submit_plan" || turn.sceneDirectionPlanId === null)) {
    context.addIssue({
      code: "custom",
      path: ["sceneDirectionOutcome"],
      message: "ready scene-direction outcomes require one exact successful plan binding",
    });
  }
  if ((turn.packagingResolutionProposalId === null) !== (turn.packagingResolutionProposalHash === null)
    || (turn.packagingResolutionFoundationId === null) !== (turn.packagingResolutionFoundationHash === null)
    || (turn.packagingResolutionContextPackId === null) !== (turn.packagingResolutionContextPackHash === null)
    || (turn.packagingResolutionCatalogId === null) !== (turn.packagingResolutionCatalogHash === null)
    || (turn.packagingResolutionPlanId === null) !== (turn.packagingResolutionPlanHash === null)) {
    context.addIssue({
      code: "custom",
      path: ["packagingResolutionProposalId"],
      message: "packaging-resolution identities require exact id/hash pairs",
    });
  }
  if (turn.packagingResolutionPlanCreatedByTurn && turn.packagingResolutionPlanId === null) {
    context.addIssue({
      code: "custom",
      path: ["packagingResolutionPlanCreatedByTurn"],
      message: "a turn-created packaging-resolution plan requires one exact plan binding",
    });
  }
  if (turn.packagingResolutionOutcome !== null
    && (turn.packagingResolutionTerminalTool !== "packaging_resolution_submit_plan"
      || turn.packagingResolutionPlanId === null)) {
    context.addIssue({
      code: "custom",
      path: ["packagingResolutionOutcome"],
      message: "packaging-resolution outcomes require one exact successful plan binding",
    });
  }
  for (const [index, range] of turn.transcriptReadRanges.entries()) {
    if (range.endIndex <= range.startIndex || range.endIndex > turn.transcriptWordCount) {
      context.addIssue({ code: "custom", path: ["transcriptReadRanges", index], message: "transcript read range is invalid" });
    }
  }
  for (const [field, ranges, count] of [
    ["visualRoleStructureReadRanges", turn.visualRoleStructureReadRanges, turn.visualRoleStructureItemCount],
    ["visualRoleManifestReadRanges", turn.visualRoleManifestReadRanges, turn.visualRoleManifestEntryCount],
  ] as const) {
    for (const [index, range] of ranges.entries()) {
      if (range.endIndex <= range.startIndex || range.endIndex > count) {
        context.addIssue({ code: "custom", path: [field, index], message: "visual-role read range is invalid" });
      }
    }
  }
  for (const [field, ranges, count] of [
    ["layoutFoundationReadRanges", turn.layoutFoundationReadRanges, turn.layoutFoundationItemCount],
    ["layoutCatalogReadRanges", turn.layoutCatalogReadRanges, turn.layoutCatalogVariantCount],
    ["layoutReviewCatalogReadRanges", turn.layoutReviewCatalogReadRanges, turn.layoutReviewCatalogVariantCount],
    ["sceneDirectionFoundationReadRanges", turn.sceneDirectionFoundationReadRanges, turn.sceneDirectionFoundationItemCount],
    ["packagingResolutionFoundationReadRanges", turn.packagingResolutionFoundationReadRanges, turn.packagingResolutionFoundationItemCount],
    ["packagingResolutionCatalogReadRanges", turn.packagingResolutionCatalogReadRanges, turn.packagingResolutionCatalogItemCount],
  ] as const) {
    for (const [index, range] of ranges.entries()) {
      if (range.endIndex <= range.startIndex || range.endIndex > count) {
        context.addIssue({ code: "custom", path: [field, index], message: "layout read range is invalid" });
      }
    }
  }
});

export const dshRoughCutPersistentStateSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  turns: z.array(dshRoughCutTurnSchema).max(100),
  confirmations: z.array(dshRoughCutConfirmationSchema).max(100),
  editorEdits: z.array(dshEditorEditSchema).max(100).default([]),
}).strict();

export const dshRoughCutRuntimeSchema = z.object({
  available: z.boolean(),
  expectedVersion: z.literal("0.1.1-rc.2"),
  version: z.string().min(1).max(64).nullable(),
  integrityVerified: z.boolean(),
  provider: z.string().min(1).max(128).nullable(),
  model: z.string().min(1).max(256).nullable(),
  credentialAvailable: z.boolean(),
  deterministicFallbackEnabled: z.literal(false),
  message: z.string().min(1).max(1_024),
}).strict();

export const dshRoughCutSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  runtime: dshRoughCutRuntimeSchema,
  sessionId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  currentRevision: revisionSchema,
  registeredTools: z.tuple(DSH_ROUGH_CUT_TOOL_NAMES.map((name) => z.literal(name)) as [
    z.ZodLiteral<(typeof DSH_ROUGH_CUT_TOOL_NAMES)[0]>,
    ...z.ZodLiteral<(typeof DSH_ROUGH_CUT_TOOL_NAMES)[number]>[],
  ]),
  turns: z.array(dshRoughCutTurnSchema).max(100),
  turn: dshRoughCutTurnSchema.nullable(),
  confirmation: dshRoughCutConfirmationSchema.nullable(),
  editorEdit: dshEditorEditSchema.nullable(),
}).strict();

export const dshToolScopeSchema = z.object({
  projectId: idSchema,
  sessionId: idSchema,
  expectedRevision: revisionSchema,
}).strict();

const exhaustiveKindsSchema = z.object({
  removeKinds: z.array(dshRoughCutCandidateKindSchema).min(1).max(3),
  keepKinds: z.array(dshRoughCutCandidateKindSchema).max(3),
}).strict().superRefine((value, context) => {
  const all = [...value.removeKinds, ...value.keepKinds];
  if (new Set(all).size !== all.length) {
    context.addIssue({ code: "custom", message: "removeKinds and keepKinds must not overlap or repeat" });
  }
  if (new Set(all).size !== dshRoughCutCandidateKindSchema.options.length) {
    context.addIssue({ code: "custom", message: "every candidate kind must be explicitly removed or kept" });
  }
});

export const createDshRoughCutProposalToolInputSchema = dshToolScopeSchema.extend({
  intentSummary: z.string().trim().min(1).max(500),
  ...exhaustiveKindsSchema.shape,
}).strict().superRefine((value, context) => {
  const all = [...value.removeKinds, ...value.keepKinds];
  if (new Set(all).size !== all.length || new Set(all).size !== dshRoughCutCandidateKindSchema.options.length) {
    context.addIssue({ code: "custom", message: "candidate-kind policy must be exhaustive and disjoint" });
  }
});

export const readDshTranscriptPageToolInputSchema = dshToolScopeSchema.extend({
  proposalId: idSchema,
  cursor: z.number().int().nonnegative().max(1_000_000),
}).strict();

export const addDshTranscriptDuplicateToolInputSchema = dshToolScopeSchema.extend({
  proposalId: idSchema,
  retainedWordIds: z.array(idSchema).min(1).max(96),
  duplicateWordIds: z.array(idSchema).min(1).max(96),
  rationale: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
}).strict().superRefine((value, context) => {
  if (new Set(value.retainedWordIds).size !== value.retainedWordIds.length) {
    context.addIssue({ code: "custom", path: ["retainedWordIds"], message: "retained word ids must be unique" });
  }
  if (new Set(value.duplicateWordIds).size !== value.duplicateWordIds.length) {
    context.addIssue({ code: "custom", path: ["duplicateWordIds"], message: "duplicate word ids must be unique" });
  }
  if (value.retainedWordIds.some((wordId) => value.duplicateWordIds.includes(wordId))) {
    context.addIssue({ code: "custom", path: ["duplicateWordIds"], message: "retained and duplicate word ids must not overlap" });
  }
});

export const submitDshRoughCutTextReviewToolInputSchema = dshToolScopeSchema.extend({
  proposalId: idSchema,
  selectedAuxiliaryCandidateIds: z.array(idSchema).max(512),
  findings: z.array(dshRoughCutTextReviewFindingSchema).max(128),
  // A staged source-quote draft is host-resolved and must be explicitly covered
  // by the final atomic batch. Omission is rejected when drafts exist.
  stagedFindingIds: z.array(idSchema).max(128).default([]),
}).strict().superRefine((value, context) => {
  if (new Set(value.selectedAuxiliaryCandidateIds).size !== value.selectedAuxiliaryCandidateIds.length) {
    context.addIssue({ code: "custom", path: ["selectedAuxiliaryCandidateIds"], message: "selected auxiliary candidate ids must be unique" });
  }
  if (new Set(value.stagedFindingIds).size !== value.stagedFindingIds.length) {
    context.addIssue({ code: "custom", path: ["stagedFindingIds"], message: "staged finding ids must be unique" });
  }
});

export const stageDshRoughCutTextFindingToolInputSchema = dshToolScopeSchema.extend({
  proposalId: idSchema,
  finding: dshRoughCutSourceTextReviewFindingSchema,
}).strict();

export const updateDshRoughCutSelectionToolInputSchema = dshToolScopeSchema.extend({
  proposalId: idSchema,
  decisions: z.array(z.object({
    candidateId: idSchema,
    action: z.enum(["delete", "keep"]),
  }).strict()).min(1).max(512),
}).strict().superRefine((value, context) => {
  if (new Set(value.decisions.map((decision) => decision.candidateId)).size !== value.decisions.length) {
    context.addIssue({ code: "custom", path: ["decisions"], message: "candidate decisions must be unique" });
  }
});

export const requestDshRoughCutConfirmationToolInputSchema = dshToolScopeSchema.extend({
  proposalId: idSchema,
  proposalHash: hashSchema,
  intentSummary: z.string().trim().min(1).max(500),
}).strict();

export const applyConfirmedDshRoughCutToolInputSchema = dshToolScopeSchema.extend({
  confirmationId: idSchema,
  proposalId: idSchema,
}).strict();

export const hostBoundDshEditorToolInputSchema = z.object({}).strict();

export const requestDshEditorEditToolInputSchema = z.object({
  summary: z.string().trim().min(1).max(500),
}).strict();

export const requestDshTrimToPlayheadToolInputSchema = requestDshEditorEditToolInputSchema.extend({
  direction: z.enum(["before", "after"]),
}).strict();

export const applyConfirmedDshEditorEditToolInputSchema = dshToolScopeSchema.extend({
  editId: idSchema,
  editHash: hashSchema,
  confirmationId: idSchema,
}).strict();

export type DshRoughCutToolName = z.infer<typeof dshRoughCutToolNameSchema>;
export type DshRoughCutExecutionMode = z.infer<typeof dshRoughCutExecutionModeSchema>;
export type DshRoughCutTurnKind = z.infer<typeof dshRoughCutTurnKindSchema>;
export type DshRoughCutSelectionContext = z.infer<typeof dshRoughCutSelectionContextSchema>;
export type SubmitDshRoughCutTurnRequest = z.infer<typeof submitDshRoughCutTurnRequestSchema>;
export type ResumeDshRoughCutTurnRequest = z.infer<typeof resumeDshRoughCutTurnRequestSchema>;
export type ConfirmDshRoughCutRequest = z.infer<typeof confirmDshRoughCutRequestSchema>;
export type DshRoughCutToolCall = z.infer<typeof dshRoughCutToolCallSchema>;
export type DshRoughCutConfirmation = z.infer<typeof dshRoughCutConfirmationSchema>;
export type DshEditorEditKind = z.infer<typeof dshEditorEditKindSchema>;
export type DshEditorEdit = z.infer<typeof dshEditorEditSchema>;
export type ConfirmDshEditorEditRequest = z.infer<typeof confirmDshEditorEditRequestSchema>;
export type RejectDshEditorEditRequest = z.infer<typeof rejectDshEditorEditRequestSchema>;
export type DshRoughCutTurn = z.infer<typeof dshRoughCutTurnSchema>;
export type DshRoughCutPersistentState = z.infer<typeof dshRoughCutPersistentStateSchema>;
export type DshRoughCutRuntime = z.infer<typeof dshRoughCutRuntimeSchema>;
export type DshRoughCutSnapshot = z.infer<typeof dshRoughCutSnapshotSchema>;
export type CreateDshRoughCutProposalToolInput = z.infer<typeof createDshRoughCutProposalToolInputSchema>;
export type ReadDshTranscriptPageToolInput = z.infer<typeof readDshTranscriptPageToolInputSchema>;
export type AddDshTranscriptDuplicateToolInput = z.infer<typeof addDshTranscriptDuplicateToolInputSchema>;
export type DshRoughCutSourceQuoteRange = z.infer<typeof dshRoughCutSourceQuoteRangeSchema>;
export type DshRoughCutSourceQuoteSelection = z.infer<typeof dshRoughCutSourceQuoteSelectionSchema>;
export type DshRoughCutSourceTextReviewFinding = z.infer<typeof dshRoughCutSourceTextReviewFindingSchema>;
export type DshRoughCutTextReviewFinding = z.infer<typeof dshRoughCutTextReviewFindingSchema>;
export type DshRoughCutTextReviewFindingDraft = z.infer<typeof dshRoughCutTextReviewFindingDraftSchema>;
export type StageDshRoughCutTextFindingToolInput = z.infer<typeof stageDshRoughCutTextFindingToolInputSchema>;
export type SubmitDshRoughCutTextReviewToolInput = z.infer<typeof submitDshRoughCutTextReviewToolInputSchema>;
export type UpdateDshRoughCutSelectionToolInput = z.infer<typeof updateDshRoughCutSelectionToolInputSchema>;
export type RequestDshRoughCutConfirmationToolInput = z.infer<typeof requestDshRoughCutConfirmationToolInputSchema>;
export type ApplyConfirmedDshRoughCutToolInput = z.infer<typeof applyConfirmedDshRoughCutToolInputSchema>;
export type RequestDshEditorEditToolInput = z.infer<typeof requestDshEditorEditToolInputSchema>;
export type RequestDshTrimToPlayheadToolInput = z.infer<typeof requestDshTrimToPlayheadToolInputSchema>;
export type ApplyConfirmedDshEditorEditToolInput = z.infer<typeof applyConfirmedDshEditorEditToolInputSchema>;
