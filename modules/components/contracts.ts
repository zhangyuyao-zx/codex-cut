export interface DesktopStatus {
  phase: 8;
  sidecarRunning: boolean;
  sidecarPid: number | null;
  projectRoot: string | null;
  dshRunning: boolean;
  dshPid: number | null;
  activeFakeJobId: string | null;
  editorDirectEditsEnabled: true;
  agentUiEnabled: true;
  roughCutUiEnabled: true;
  roughCutAvailable: boolean;
  dshRoughCutEnabled: true;
  dshRoughCutAvailable: boolean;
  smartPackagingUiEnabled: boolean;
  /** The accepted R2 Project Director shell is host-gated until the runtime advertises it. */
  projectDirectorRebuildV1Enabled?: boolean;
  /** The isolated Project Agent turn routes are exposed by the sidecar. */
  projectAgentTurnV1Enabled?: boolean;
  /** Layout Cut commands are exposed by the host alongside the R2 shell. */
  layoutCutV1Enabled?: boolean;
  /** Scene Program commands are exposed by the host after the confirmed Layout Cut. */
  sceneProgramV1Enabled?: boolean;
  /** Packaged Cut preview commands are exposed by the host after a ready Scene Program. */
  packagedCutV1Enabled?: boolean;
  writeToolsEnabled: true;
  exportAvailable: boolean;
}

// The desktop UI consumes the same strict contracts as the sidecar. Keep these
// as type-only re-exports so the Web host cannot accidentally fork the wire
// shape while still avoiding a runtime dependency on Node-side modules.
export type {
  ConfirmProjectDirectorPreviewV1Request,
  DirectorCreativePlanV1,
  DirectorDiagnosticV1,
  DirectorMaterialResponseV1,
  DirectorPreviewConfirmationV1,
  DirectorPreviewVersionV1,
  ProjectDirectorSnapshotV1,
} from "../contracts/project-director-contract.js";
export type {
  ProjectAgentTurnCancelRequestV1,
  ProjectAgentTurnHostProviderV1,
  ProjectAgentTurnRunnerInput,
  ProjectAgentTurnRunnerResult,
  ProjectAgentTurnStatusRequestV1,
  ProjectAgentTurnSubmitRequestV1,
  ProjectAgentTurnV1,
  ProjectAgentTurnSnapshotV1,
} from "../contracts/project-agent-turn-contract.js";
export type { DshRoughCutSelectionContext } from "../contracts/dsh-rough-cut-contract.js";
export type {
  ApplyLayoutCutEditV1Request,
  CompileLayoutCutV1Request,
  LayoutCutObjectV1,
  LayoutCutParagraphV1,
  LayoutCutRectV1,
  LayoutCutSnapshotV1,
  LayoutCutV1,
} from "../contracts/layout-cut-contract.js";
export type {
  CompilePackagedCutV1Request,
  PackagedCutPersistentStateV1,
  PackagedCutPreviewConfirmationV1,
  PackagedCutPreviewVersionV1,
  PackagedCutReadinessCodeV1,
  PackagedCutSnapshotV1,
  PackagedCutTechnicalQaCheckV1,
  PackagedCutTechnicalQaReportV1,
  PackagedCutV1,
} from "../contracts/packaged-cut-contract.js";
export type {
  PackagedCutExportCheckpointV1,
  PackagedCutExportSelectionV1,
} from "../contracts/packaged-cut-export-contract.js";
export type {
  PackagedCutExportJobReportV1,
  PackagedCutExportJobRequestV1,
  PackagedCutExportStartRequestV1,
} from "../contracts/packaged-cut-export-job-contract.js";
export type {
  ApplySceneProgramEditV1Request,
  DirectorMotionReasonV1,
  DirectorObjectClassV1,
  DirectorPackagingModeV1,
  DirectorVisualObjectKindV1,
  SceneCapabilityCatalogV1,
  SceneComponentCapabilityV1,
  SceneCustomGroupV1,
  SceneCustomSceneV1,
  SceneImplementationParagraphSubmissionV1,
  SceneImplementationPlanV1,
  SceneMotionIntensityV1,
  SceneObjectBindingV1,
  ScenePatternCapabilityV1,
  ScenePatternCatalogV1,
  SceneProgramBindingV1,
  SceneProgramControlsV1,
  SceneProgramMediaTimingV1,
  SceneProgramObjectV1,
  SceneProgramParagraphV1,
  SceneProgramPersistentStateV1,
  SceneProgramSourceV1,
  SceneProgramStateV1,
  SceneProgramV1,
  SceneProgramSnapshotV1,
  SceneProgramLintDiagnosticV1,
  SubmitSceneImplementationPlanV1Request,
} from "../contracts/scene-program-contract.js";

export interface ModelCatalogEntry {
  model: string;
  label: string;
  contextWindow: number;
  input: Array<"text" | "image">;
}

export interface ProviderCatalogEntry {
  provider: string;
  label: string;
  credentialLabel: string;
  credentialAvailable: boolean;
  models: ModelCatalogEntry[];
}

export interface ModelSettingsReport {
  schemaVersion: 2;
  configured: boolean;
  provider: string;
  model: string;
  credentialAvailable: boolean;
  credentialStorage: "macos_keychain";
  configurationScope: "codex_cut_only";
  catalogSource: "embedded_dsh_pi_ai";
  catalogProviderCount: number;
  catalogModelCount: number;
  providers: ProviderCatalogEntry[];
  message: string;
}

export type DshRoughCutTurnState =
  | "understanding"
  | "analyzing_rough_cut"
  | "analyzing_visual_paragraph"
  | "analyzing_visual_role"
  | "analyzing_layout"
  | "analyzing_scene_direction"
  | "analyzing_packaging_resolution"
  | "waiting_confirmation"
  | "applying"
  | "completed"
  | "read_only_completed"
  | "cancelled"
  | "failed"
  | "interrupted";

export interface DshRoughCutRuntime {
  available: boolean;
  expectedVersion: "0.1.1-rc.2";
  version: string | null;
  integrityVerified: boolean;
  provider: string | null;
  model: string | null;
  credentialAvailable: boolean;
  deterministicFallbackEnabled: false;
  message: string;
}

export interface DshRoughCutToolCall {
  sequence: number;
  callId: string;
  name: string;
  actor: "model" | "user" | "host";
  state: "succeeded" | "rejected" | "failed";
  argumentHash: string;
  resultSummary: string;
  createdAt: string;
}

export interface DshRoughCutTurn {
  turnId: string;
  jobId: string;
  sessionId: string;
  dshSessionId: string | null;
  projectId: string;
  timelineId: string;
  expectedRevision: number;
  state: DshRoughCutTurnState;
  turnKind: "editing" | "visual_paragraph" | "visual_paragraph_agent" | "visual_role_plan" | "visual_role_agent" | "layout_plan" | "layout_agent" | "scene_direction_plan" | "packaging_resolution_plan";
  userText: string;
  executionMode: "review" | "ai_draft";
  draftAuthorizationId: string | null;
  draftAuthorizationHash: string | null;
  draftAuthorizationConsumedAt: string | null;
  intentSummary: string | null;
  assistantText: string | null;
  context: {
    selectedClipId: string | null;
    selectedAssetId: string | null;
    playheadFrame: number;
    rippleEnabled: boolean;
    mainTrackMagnetEnabled: boolean;
  };
  proposalId: string | null;
  proposalHash: string | null;
  confirmationId: string | null;
  editId: string | null;
  roughCutRemoveKinds: Array<"silence" | "duplicate_speech" | "filler_word">;
  roughCutKeepKinds: Array<"silence" | "duplicate_speech" | "filler_word">;
  modelCandidateDecisionIds: string[];
  transcriptProposalId: string | null;
  transcriptHash: string | null;
  transcriptWordCount: number;
  transcriptReadRanges: Array<{ startIndex: number; endIndex: number }>;
  modelTranscriptCandidateIds: string[];
  visualParagraphConversationRootProposalId: string | null;
  visualParagraphScope: VisualParagraphReviewScope | null;
  visualParagraphRevisionId: string | null;
  visualParagraphRevisionHash: string | null;
  visualRoleStructureSnapshotId: string | null;
  visualRoleStructureHash: string | null;
  visualRoleMaterialManifestId: string | null;
  visualRoleMaterialManifestHash: string | null;
  visualRoleStructureItemCount: number;
  visualRoleStructureReadRanges: Array<{ startIndex: number; endIndex: number }>;
  visualRoleIdealLockId: string | null;
  visualRoleIdealLockHash: string | null;
  visualRoleIdealLockedParagraphs: Array<Record<string, unknown>>;
  visualRoleManifestEntryCount: number;
  visualRoleManifestReadRanges: Array<{ startIndex: number; endIndex: number }>;
  visualRoleTerminalTool: "visual_role_submit_ideal_plan" | "visual_role_report_structure_issue" | null;
  visualRolePlanId: string | null;
  visualRolePlanHash: string | null;
  visualRolePlanCreatedByTurn: boolean;
  visualRoleOutcome: "WAITING_MATERIAL_DECISION" | "READY_FOR_REVIEW" | "STRUCTURE_REVIEW_REQUIRED" | null;
  visualRoleReviewMode: "DOWNGRADE" | "REVIEW" | null;
  visualRoleReviewContextId: string | null;
  visualRoleReviewContextHash: string | null;
  visualRoleReviewTargetParagraphIds: string[];
  visualRoleReviewAllowedParagraphIds: string[];
  visualRoleReviewTriggerRequirementId: string | null;
  visualRoleReviewTriggerRequirementHash: string | null;
  visualRoleReviewTerminalTool: "visual_role_propose_local_revision" | "visual_role_report_local_blocker" | null;
  visualRolePlanProposalId: string | null;
  visualRolePlanProposalHash: string | null;
  visualRolePlanProposalCreatedByTurn: boolean;
  visualRoleReviewOutcome: "PENDING_USER_DECISION" | "BLOCKED" | "EXPLANATION_ONLY" | null;
  layoutProposalId: string | null;
  layoutProposalHash: string | null;
  layoutFoundationId: string | null;
  layoutFoundationHash: string | null;
  layoutContextPackId: string | null;
  layoutContextPackHash: string | null;
  layoutCatalogId: string | null;
  layoutCatalogHash: string | null;
  layoutFoundationItemCount: number;
  layoutFoundationReadRanges: Array<{ startIndex: number; endIndex: number }>;
  layoutCatalogVariantCount: number;
  layoutCatalogReadRanges: Array<{ startIndex: number; endIndex: number }>;
  layoutTerminalTool: "layout_submit_plan" | null;
  layoutPlanId: string | null;
  layoutPlanHash: string | null;
  layoutPlanCreatedByTurn: boolean;
  layoutOutcome: "READY_FOR_REVIEW" | null;
  layoutReviewContextId: string | null;
  layoutReviewContextHash: string | null;
  layoutReviewTargetParagraphIds: string[];
  layoutReviewAllowedParagraphIds: string[];
  layoutReviewCatalogVariantCount: number;
  layoutReviewCatalogReadRanges: Array<{ startIndex: number; endIndex: number }>;
  layoutReviewTerminalTool: "layout_propose_local_revision" | "layout_report_local_blocker" | null;
  layoutPlanProposalId: string | null;
  layoutPlanProposalHash: string | null;
  layoutPlanProposalCreatedByTurn: boolean;
  layoutReviewOutcome: "PENDING_USER_DECISION" | "BLOCKED" | "EXPLANATION_ONLY" | null;
  sceneDirectionProposalId: string | null;
  sceneDirectionProposalHash: string | null;
  sceneDirectionFoundationId: string | null;
  sceneDirectionFoundationHash: string | null;
  sceneDirectionContextPackId: string | null;
  sceneDirectionContextPackHash: string | null;
  sceneDirectionCatalogId: string | null;
  sceneDirectionCatalogHash: string | null;
  sceneDirectionFoundationItemCount: number;
  sceneDirectionFoundationReadRanges: Array<{ startIndex: number; endIndex: number }>;
  sceneDirectionMethodCatalogRead: boolean;
  sceneDirectionTerminalTool: "scene_direction_submit_plan" | null;
  sceneDirectionPlanId: string | null;
  sceneDirectionPlanHash: string | null;
  sceneDirectionPlanCreatedByTurn: boolean;
  sceneDirectionOutcome: "READY_FOR_REVIEW" | null;
  packagingResolutionProposalId: string | null;
  packagingResolutionProposalHash: string | null;
  packagingResolutionFoundationId: string | null;
  packagingResolutionFoundationHash: string | null;
  packagingResolutionContextPackId: string | null;
  packagingResolutionContextPackHash: string | null;
  packagingResolutionCatalogId: string | null;
  packagingResolutionCatalogHash: string | null;
  packagingResolutionFoundationItemCount: number;
  packagingResolutionFoundationReadRanges: Array<{ startIndex: number; endIndex: number }>;
  packagingResolutionCatalogItemCount: number;
  packagingResolutionCatalogReadRanges: Array<{ startIndex: number; endIndex: number }>;
  packagingResolutionTerminalTool: "packaging_resolution_submit_plan" | null;
  packagingResolutionPlanId: string | null;
  packagingResolutionPlanHash: string | null;
  packagingResolutionPlanCreatedByTurn: boolean;
  packagingResolutionOutcome: "READY_FOR_PROJECT_AUDITION" | "BLOCKED_COMPONENT_GAPS" | null;
  provider: string;
  model: string;
  dshVersion: string;
  dshPid: number | null;
  resumedFromTurnId: string | null;
  toolCalls: DshRoughCutToolCall[];
  error: { code: string; message: string } | null;
  orphanCount: number;
  submittedAt: string;
  updatedAt: string;
}

export interface DshRoughCutConfirmation {
  confirmationId: string;
  turnId: string;
  proposalId: string;
  proposalHash: string;
  baseRevision: number;
  status: "pending" | "applying" | "applied" | "expired";
  applicationId: string;
  createdAt: string;
  confirmedAt: string | null;
  consumedAt: string | null;
  transactionId: string | null;
  resultRevision: number | null;
  source: "interactive" | "ai_draft_authorization";
  authorizationId: string | null;
  authorizationHash: string | null;
}

export type DshEditorEditKind =
  | "delete_selected_clip"
  | "trim_before_playhead"
  | "trim_after_playhead";

export interface DshEditorEdit {
  editId: string;
  editHash: string;
  confirmationId: string;
  turnId: string;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  baseDocumentHash: string | null;
  kind: DshEditorEditKind;
  clipId: string;
  clipName: string;
  playheadFrame: number;
  affectedStartFrame: number;
  affectedEndFrame: number;
  deleteFrameCount: number;
  dependentCaptionCueIds: string[];
  dependentTransitionEdgeIds: string[];
  ripple: boolean;
  magnet: boolean;
  summary: string;
  status: "pending" | "applying" | "applied" | "rejected" | "expired";
  applicationId: string;
  createdAt: string;
  confirmedAt: string | null;
  consumedAt: string | null;
  transactionId: string | null;
  resultRevision: number | null;
}

export interface DshRoughCutSnapshot {
  schemaVersion: 1;
  runtime: DshRoughCutRuntime;
  sessionId: string;
  projectId: string;
  timelineId: string;
  currentRevision: number;
  registeredTools: string[];
  turns: DshRoughCutTurn[];
  turn: DshRoughCutTurn | null;
  confirmation: DshRoughCutConfirmation | null;
  editorEdit: DshEditorEdit | null;
}

export type VisualParagraphExpressionTask =
  | "establish_topic"
  | "emphasize_conclusion"
  | "explain_concept"
  | "show_process"
  | "show_steps"
  | "show_data"
  | "compare_difference"
  | "show_causality"
  | "show_ui_operation"
  | "provide_evidence"
  | "show_case"
  | "create_turn"
  | "summarize_close"
  | "establish_emotion"
  | "prompt_action";

export type VisualParagraphMainVisualKind =
  | "person"
  | "screen_recording"
  | "live_video"
  | "image"
  | "chart"
  | "flow"
  | "text_composition"
  | "data_visualization";

export type VisualParagraphCompositionRelation =
  | "main_fullscreen"
  | "host_primary_support_zone"
  | "host_supporting_main_content"
  | "split_primary_secondary"
  | "picture_in_picture"
  | "overlay_annotation"
  | "comparison_dual"
  | "sequence_flow"
  | "evidence_clean"
  | "text_led_takeover";

export type VisualParagraphBoundaryReasonCode =
  | "MAIN_VISUAL_CONTINUES"
  | "MAIN_VISUAL_CHANGES"
  | "EXPRESSION_TASK_CHANGES"
  | "INFORMATION_DUTY_CHANGES"
  | "COMPOSITION_RELATION_CHANGES"
  | "SAME_SENTENCE_VISUAL_SWITCH"
  | "EVIDENCE_SOURCE_CHANGES"
  | "USER_FORCED_BOUNDARY"
  | "INSUFFICIENT_EVIDENCE";

export interface VisualParagraphFoundation {
  roughCutProposalId: string;
  roughCutProposalHash: string;
  roughCutConfirmationId: string;
  commitRevision: number;
  documentHash: string;
  timeMapHash: string;
  masterTranscriptHash: string;
  projectionHash: string;
  transcriptWordCount: number;
  durationFrames: number;
  framesPerSecond: number;
}

export interface VisualParagraphFoundationSync {
  kind: "host_rebase_v1";
  sourceProposalId: string;
  sourceProposalHash: string;
  sourceBaseRevision: number;
  targetRevision: number;
  preservedParagraphCount: number;
  changedParagraphOrders: number[];
  removedSourceParagraphOrders: number[];
  addedWordCount: number;
  removedWordCount: number;
  reordered: boolean;
}

export interface VisualParagraphDecision {
  paragraphId: string;
  order: number;
  wordRange: {
    startWordId: string;
    endWordId: string;
    includedWordIds: string[];
  };
  frameRange: { startFrame: number; endFrame: number };
  text: string;
  assetIds: string[];
  hostBindings: Array<{
    timeMapSegmentId: string;
    spineEntryId: string;
    clipId: string;
    assetId: string;
  }>;
  primaryExpressionTask: VisualParagraphExpressionTask;
  mainVisual: {
    kind: VisualParagraphMainVisualKind;
    continuityKey: string;
    informationDuty: string;
    focalSubject: string;
    evidenceWordIds: string[];
  };
  compositionRelation: VisualParagraphCompositionRelation;
  boundaryBefore: {
    reasonCodes: VisualParagraphBoundaryReasonCode[];
    evidenceWordIds: string[];
    rationale: string;
    confidence: number;
    reviewRequired: boolean;
  } | null;
  confidence: number;
  reviewRequired: boolean;
}

export interface VisualParagraphProposal {
  schemaVersion: 1;
  proposalId: string;
  proposalHash: string;
  sessionId: string;
  projectId: string;
  timelineId: string;
  baseRevision: number;
  foundation: VisualParagraphFoundation;
  intentSummary: string;
  protocol: "complete_master_transcript_single_batch_v1" | "complete_master_transcript_boundary_starts_v2";
  status: "awaiting_model_review" | "draft";
  paragraphs: VisualParagraphDecision[];
  submissionHash: string | null;
  foundationSync?: VisualParagraphFoundationSync;
  createdAt: string;
  updatedAt: string;
}

export interface VisualParagraphReviewScope {
  kind: "proposal" | "paragraph" | "playhead";
  paragraphId: string | null;
  playheadFrame: number;
}

export interface VisualParagraphRevision {
  schemaVersion: 1;
  revisionId: string;
  revisionHash: string;
  turnId: string;
  conversationRootProposalId: string;
  sessionId: string;
  projectId: string;
  timelineId: string;
  baseRevision: number;
  foundationHash: string;
  baseProposalId: string;
  baseProposalHash: string;
  scope: VisualParagraphReviewScope;
  summary: string;
  rationale: string;
  candidateProposalId: string;
  candidateProposalHash: string;
  candidateProposal: VisualParagraphProposal;
  changedParagraphOrders: number[];
  beforeParagraphCount: number;
  afterParagraphCount: number;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  expiredAt: string | null;
}

export interface VisualParagraphReviewConfirmation {
  schemaVersion: 1;
  confirmationId: string;
  confirmationHash: string;
  sessionId: string;
  projectId: string;
  timelineId: string;
  baseRevision: number;
  foundationHash: string;
  proposalId: string;
  proposalHash: string;
  status: "confirmed" | "expired";
  confirmedAt: string;
  expiredAt: string | null;
}

export interface VisualParagraphSnapshot {
  schemaVersion: 1;
  availability: {
    state: "ready" | "unavailable";
    code: string | null;
    message: string;
    currentRevision: number;
    foundation: VisualParagraphFoundation | null;
  };
  proposals: VisualParagraphProposal[];
  revisions: VisualParagraphRevision[];
  reviewConfirmations: VisualParagraphReviewConfirmation[];
  registeredModelTools: [
    "visual_paragraph_create_proposal",
    "visual_paragraph_read_transcript_page",
    "visual_paragraph_submit_review",
  ];
  registeredAgentModelTools: [
    "visual_paragraph_get_review_context",
    "visual_paragraph_read_revision_transcript_page",
    "visual_paragraph_propose_revision",
  ];
  timelineModified: false;
}

export type VisualRoleSourceKind =
  | "PERSON_SEGMENT"
  | "SCREEN_SEGMENT"
  | "LIVE_ACTION_SEGMENT"
  | "EVIDENCE_VIDEO_SEGMENT"
  | "IMAGE_REGION"
  | "DOCUMENT_REGION"
  | "SCREENSHOT_REGION"
  | "DATA_TABLE_REGION"
  | "TRANSCRIPT_WORD_SET"
  | "CONFIRMED_FACT_SET"
  | "CONFIRMED_RELATION_SET"
  | "CONFIRMED_STEP_SEQUENCE"
  | "USER_CONFIRMED_TEXT"
  | "CONFIRMED_METADATA"
  | "BRAND_ASSET";

export type VisualRoleSlot = "MAIN" | "SUPPORT_1" | "SUPPORT_2";

export type VisualRoleMainKind =
  | "PERSON"
  | "SCREEN_RECORDING"
  | "LIVE_DEMONSTRATION"
  | "EVIDENCE_MEDIA"
  | "STRUCTURED_EXPLANATION"
  | "TEXT_COMPOSITION";

export type VisualRoleSupportingKind =
  | "KEY_TEXT"
  | "PERSON_PIP"
  | "DETAIL_VIEW"
  | "ANNOTATION"
  | "CONTEXT_LABEL"
  | "MINI_EXPLANATION"
  | "DECORATIVE_ACCENT";

export type VisualRoleObjectKind = VisualRoleMainKind | VisualRoleSupportingKind;

export type VisualRoleParagraphType =
  | "PERSON_DELIVERY"
  | "SCREEN_OPERATION"
  | "LIVE_DEMONSTRATION"
  | "EVIDENCE_REVIEW"
  | "DESIGNED_INFORMATION";

export type VisualRolePersistentSource =
  | { mode: "EXISTING_SOURCE"; sourceRefId: string; sourceKind: VisualRoleSourceKind; contentHash: string; manifestHash: string }
  | { mode: "MATERIAL_REQUIREMENT"; requirementId: string; requiredSourceKind: VisualRoleSourceKind }
  | { mode: "DERIVED_FROM_PARENT"; parentVisualObjectId: string; anchorRefIds: string[] }
  | { mode: "NO_EXTERNAL_MATERIAL"; nonContentBearing: true };

export interface VisualRoleObject {
  visualObjectId: string;
  visualObjectHash: string;
  slot: VisualRoleSlot;
  role: "MAIN" | "SUPPORTING";
  kind: VisualRoleObjectKind;
  informationDuty: string;
  supportDuty: "EMPHASIZE" | "CLARIFY" | "LOCATE" | "CONTEXTUALIZE" | "HUMANIZE" | "DECORATE" | null;
  strength: "STRONG" | "LIGHT" | null;
  source: VisualRolePersistentSource;
  evidenceWordIds: string[];
  content: Record<string, unknown>;
  mustBeLargest: boolean;
  mustRemainUnderstandableWithoutSupportingVisuals: boolean;
  confidence: number;
  reviewRequired: boolean;
}

export interface VisualRoleSupportingCandidateAudit {
  candidateKindsConsidered: VisualRoleSupportingKind[];
  candidateSourceRefIdsConsidered: string[];
  userForbiddenKinds: VisualRoleSupportingKind[];
  selectedSlots: Array<"SUPPORT_1" | "SUPPORT_2">;
  rejectedCandidates: Array<{
    kind: VisualRoleSupportingKind;
    reasonCode: "DUPLICATES_MAIN" | "NO_DISTINCT_INFORMATION_DUTY" | "WOULD_BECOME_SECOND_MAIN" | "CONTRADICTS_EVIDENCE" | "OUTSIDE_PARAGRAPH_TASK" | "USER_FORBIDDEN";
  }>;
  zeroSupportingExceptionCode: "NO_DISTINCT_SUPPORT_DUTY" | "PRESERVE_EMOTIONAL_PERFORMANCE" | "USER_CONFIRMED_NONE" | null;
}

export interface VisualRoleMainCandidateAudit {
  candidateKindsConsidered: VisualRoleMainKind[];
  selectedKind: VisualRoleMainKind;
  rejectedCandidates: Array<{
    kind: VisualRoleMainKind;
    reasonCode: "CANNOT_CARRY_PRIMARY_DUTY_INDEPENDENTLY" | "WEAKER_INFORMATION_CARRIER" | "CONTRADICTS_EVIDENCE" | "OUTSIDE_PARAGRAPH_TASK" | "WOULD_REQUIRE_UNCONFIRMED_CONTENT";
    evidenceWordIds: string[];
    rationale: string;
  }>;
  strongestAlternativeKind: VisualRoleMainKind;
  strongestAlternativeRationale: string;
  selectedIndependentCarrier: true;
}

export interface VisualRoleTechnicalMetadata {
  mediaKind: "VIDEO" | "IMAGE" | "DOCUMENT" | "TABLE" | "TEXT" | "FACTS" | "RELATIONS" | "STEPS" | "METADATA" | "BRAND";
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationFrames: number | null;
  pageCount: number | null;
  rowCount: number | null;
  columnCount: number | null;
}

export interface VisualRoleMaterialRequirement {
  requirementId: string;
  requirementHash: string;
  paragraphId: string;
  visualSlot: VisualRoleSlot;
  visualObjectId: string;
  priority: "REQUIRED_FOR_IDEAL_PLAN";
  requiredSourceKind: VisualRoleSourceKind;
  subject: string;
  requiredContent: string[];
  requiredActionOrState: string | null;
  purpose: string;
  evidenceWordIds: string[];
  acceptanceCriteria: {
    mustShow: string[];
    mustNotShow: string[];
    continuityNeed: string | null;
    legibilityNeed: string | null;
  };
  cardinality: {
    kind: "SINGLE" | "FIXED_SET" | "ORDERED_SEQUENCE";
    exactCount: number;
  };
  status: "REQUESTED" | "WAITING_USER_RESPONSE" | "WAITING_ASSET" | "WAITING_BINDING" | "NEEDS_CLARIFICATION" | "SATISFIED" | "USER_CANNOT_PROVIDE" | "SUPERSEDED" | "STALE";
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type VisualRoleMaterialSelector =
  | { kind: "VIDEO_SEGMENT"; startFrame: number; endFrame: number }
  | { kind: "IMAGE_WHOLE" }
  | { kind: "IMAGE_REGION"; region: { xPermille: number; yPermille: number; widthPermille: number; heightPermille: number } }
  | { kind: "DOCUMENT_REGION"; page: number; region: { xPermille: number; yPermille: number; widthPermille: number; heightPermille: number } }
  | { kind: "TABLE_REGION"; rowStart: number; rowEnd: number; columnStart: number; columnEnd: number };

export interface VisualRoleMaterialAsset {
  assetId: string;
  assetHash: string;
  projectId: string;
  timelineId: string;
  timelineRevision: number;
  origin: "PROJECT_ASSET" | "UPLOADED";
  projectAssetId: string | null;
  locator: string;
  displayName: string;
  contentHash: string;
  byteLength: number;
  technicalMetadata: VisualRoleTechnicalMetadata;
  technicalValidation: "PASSED";
  createdAt: string;
  updatedAt: string;
}

export interface VisualRoleMaterialSelection {
  selectionId: string;
  selectionHash: string;
  assetId: string;
  derivedRegionOrSegmentId: string;
  sourceKind: VisualRoleSourceKind;
  selector: VisualRoleMaterialSelector;
  contentHash: string;
  technicalValidation: "PASSED";
  userSemanticDescription: string;
  userSemanticConfirmation: "PENDING" | "CONFIRMED" | "REJECTED";
  selectionRevision: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisualRoleMaterialBinding {
  bindingId: string;
  bindingHash: string;
  requirementId: string;
  sourceSelectionIds?: string[];
  sourceRefIds: string[];
  sourceContentHashes: string[];
  materialManifestId?: string | null;
  materialManifestHash?: string | null;
  provisionMode?: "SELECTED_EXISTING" | "UPLOADED" | "MIXED";
  technicalValidation: "PENDING" | "PASSED" | "FAILED";
  userSemanticConfirmation: "PENDING" | "CONFIRMED" | "REJECTED";
  bindingRevision: number;
  status: "SELECTED_EXISTING" | "UPLOADED" | "BOUND_TO_REQUIREMENT" | "TECHNICALLY_VALID" | "PENDING_USER_CONFIRMATION" | "SATISFIED" | "SUPERSEDED" | "STALE";
  createdAt: string;
  updatedAt: string;
}

export interface VisualRoleMaterialManifest {
  manifestId: string;
  manifestHash: string;
  projectId: string;
  timelineId: string;
  revision: number;
  manifestRevision?: number;
  entries: Array<{
    sourceRefId: string;
    sourceKind: VisualRoleSourceKind;
    assetId: string | null;
    derivedRegionOrSegmentId: string | null;
    contentHash: string;
    technicalMetadata: VisualRoleTechnicalMetadata;
    userConfirmedSemanticDescription: string;
    applicableParagraphIds?: string[];
    revision: number;
    manifestHash: string;
  }>;
  createdAt: string;
}

export interface VisualRolePlan {
  schemaVersion: 2;
  planId: string;
  planHash: string;
  revision: number;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  foundationHash: string;
  structureSnapshotId: string;
  structureHash: string;
  baseVisualParagraphProposalId: string;
  baseVisualParagraphProposalHash: string;
  status: "WAITING_MATERIALS" | "REVIEW_REQUIRED" | "READY_FOR_REVIEW";
  materialManifestId: string;
  materialManifestHash: string;
  paragraphs: Array<{
    paragraphId: string;
    paragraphDesignHash: string;
    stableWordRange: { startWordId: string; endWordId: string; includedWordIds: string[] };
    visualParagraphType: VisualRoleParagraphType;
    primaryExpressionTask: VisualParagraphExpressionTask;
    informationDuty: string;
    mainVisual: VisualRoleObject;
    supportingVisuals: VisualRoleObject[];
    mainCandidateAudit?: VisualRoleMainCandidateAudit;
    supportingCandidateAudit: VisualRoleSupportingCandidateAudit;
    materialRequirementIds: string[];
    confidence: number;
    reviewRequired: boolean;
  }>;
  materialRequirementIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VisualRolePlanProposal {
  schemaVersion: 2;
  proposalId: string;
  proposalHash: string;
  proposalRevision: number;
  kind: "DOWNGRADE" | "AGENT_REVISION";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED" | "STALE";
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  foundationHash: string;
  structureSnapshotId: string;
  structureHash: string;
  basePlanId: string;
  basePlanHash: string;
  candidatePlanId: string | null;
  candidatePlanHash: string | null;
  triggerRequirementId: string | null;
  triggerRequirementHash: string | null;
  triggerResponseId: string | null;
  targetParagraphIds: string[];
  allowedParagraphIds: string[];
  changedParagraphIds: string[];
  summary: string;
  rationale: string;
  createdByTurnId: string | null;
  createdAt: string;
  decidedAt: string | null;
  decisionReasonCode: "USER_ACCEPTED" | "USER_REJECTED" | "NO_EVIDENCE_SAFE_FALLBACK" | "STRUCTURE_REVIEW_REQUIRED" | "FOUNDATION_CHANGED" | "BASE_PLAN_SUPERSEDED" | null;
}

export interface VisualRoleConfirmation {
  schemaVersion: 2;
  confirmationId: string;
  confirmationHash: string;
  planId: string;
  planHash: string;
  structureHash: string;
  foundationHash: string;
  materialManifestId?: string;
  materialManifestHash: string;
  status: "CONFIRMED" | "EXPIRED";
  confirmedAt: string;
  expiredAt: string | null;
}

export interface VisualRoleProjectAssetCandidate {
  projectAssetId: string;
  name: string;
  kind: "video" | "image";
  locator: string;
  durationMs: number;
  width: number | null;
  height: number | null;
  registeredMaterialAssetId: string | null;
}

export interface VisualRoleSnapshot {
  schemaVersion: 2;
  currentStructure: unknown | null;
  currentPlan: VisualRolePlan | null;
  structures: unknown[];
  manifests: VisualRoleMaterialManifest[];
  plans: VisualRolePlan[];
  requirements: VisualRoleMaterialRequirement[];
  bindings: VisualRoleMaterialBinding[];
  materialAssets: VisualRoleMaterialAsset[];
  materialSelections: VisualRoleMaterialSelection[];
  materialResponses: Array<{
    responseHash?: string;
    responseId: string;
    requirementId: string;
    response: "ALREADY_AVAILABLE" | "WILL_PROVIDE" | "PROVIDED" | "CANNOT_PROVIDE" | "NEEDS_CLARIFICATION";
    assetId: string | null;
    resultingStatus: VisualRoleMaterialRequirement["status"];
    createdAt: string;
  }>;
  planProposals: VisualRolePlanProposal[];
  confirmations: VisualRoleConfirmation[];
  reviewReadiness: {
    code: "NO_CURRENT_PLAN" | "PENDING_PLAN_PROPOSAL" | "UNRESOLVED_MATERIALS" | "READY" | "CONFIRMED";
    eligible: boolean;
    unresolvedRequirementIds: string[];
    pendingProposalIds: string[];
    confirmationId: string | null;
  };
  planWarnings?: Array<{
    code: "ALL_PARAGRAPHS_SAME_MAIN_KIND";
    mainKind: VisualRoleMainKind;
    paragraphIds: string[];
  }>;
  foundationSyncs: unknown[];
  projectAssets: VisualRoleProjectAssetCandidate[];
  timelineModified: false;
}

export type LayoutFamilyIdV1 =
  | "F01_PERSON_DELIVERY"
  | "F02_TEXT_TAKEOVER"
  | "F03_DATA_PROOF"
  | "F04_PARALLEL_COMPONENTS"
  | "F05_TIME_PROCESS"
  | "F06_COMPARISON"
  | "F07_LIST"
  | "F08_RISK_QA"
  | "F09_SCREEN_OPERATION"
  | "F10_EVIDENCE_TAKEOVER"
  | "F11_STEP_SEQUENCE";

export type LayoutVariantIdV1 =
  | "layout:v1:1a-person-information-rail"
  | "layout:v1:1b-clean-person"
  | "layout:v1:2-fullscreen-text"
  | "layout:v1:3a-single-data-proof"
  | "layout:v1:3b-before-after-data"
  | "layout:v1:4-parallel-points"
  | "layout:v1:5a-timeline"
  | "layout:v1:5b-pipeline"
  | "layout:v1:6a-dual-object"
  | "layout:v1:6b-dual-path"
  | "layout:v1:7-fullscreen-list"
  | "layout:v1:8-risk-qa-loop"
  | "layout:v1:9-screen-operation"
  | "layout:v1:10-evidence-takeover"
  | "layout:v1:11-step-sequence";

export type LayoutSlotIdV1 = "MAIN_STAGE" | "SUPPORT_PRIMARY" | "SUPPORT_SECONDARY";

export interface LayoutNormalizedFrameV1 {
  xPermille: number;
  yPermille: number;
  widthPermille: number;
  heightPermille: number;
}

export interface LayoutCatalogSlotV1 {
  slotId: LayoutSlotIdV1;
  role: "MAIN" | "SUPPORTING";
  required: boolean;
  acceptedKinds: VisualRoleObjectKind[];
  acceptedStrengths: Array<"STRONG" | "LIGHT">;
  frameToken: LayoutNormalizedFrameV1;
  areaSharePermille: { minimum: number; maximum: number };
  zIndex: number;
  alignment: "FILL" | "CENTER" | "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
  overlapPolicy: "NONE" | "OVER_MAIN" | "INSET_IN_MAIN";
  personTreatment: "NONE" | "FULL_FRAME" | "RECTANGULAR_PIP" | "CIRCULAR_PIP";
  textCapacity: { maximumGraphemes: number; maximumLines: number; maximumItems: number } | null;
}

export interface LayoutCatalogVariantV1 {
  variantId: LayoutVariantIdV1;
  familyId: LayoutFamilyIdV1;
  familyLabel: string;
  variantLabel: string;
  purpose: string;
  aspect: "LANDSCAPE_16_9";
  minimumCanvas: { width: number; height: number };
  allowedMainKinds: VisualRoleMainKind[];
  allowedSupportingKinds: VisualRoleSupportingKind[];
  supportCount: { minimum: 1; maximum: 1 | 2 };
  maximumStrongSupportingCount: number;
  slots: LayoutCatalogSlotV1[];
  hierarchyPolicy: "MAIN_MUST_BE_LARGEST";
  safeRegion: {
    leftPermille: number;
    rightPermille: number;
    topPermille: number;
    bottomPermille: number;
  };
  captionPolicy: {
    ordinaryCaptionsAreSeparateLayer: true;
    minimumBottomClearancePermille: number;
    supportingTextMayOverlapCaptionZone: false;
  };
  objectFailureCodes: string[];
}

export interface LayoutCatalogV1 {
  schemaVersion: 1;
  catalogId: string;
  catalogHash: string;
  version: 1;
  aspect: "LANDSCAPE_16_9";
  variants: LayoutCatalogVariantV1[];
}

export interface LayoutFoundationObjectV1 {
  visualObjectId: string;
  visualObjectHash: string;
  sourceSlot: "MAIN" | "SUPPORT_1" | "SUPPORT_2";
  role: "MAIN" | "SUPPORTING";
  kind: VisualRoleObjectKind;
  informationDuty: string;
  supportDuty: "EMPHASIZE" | "CLARIFY" | "LOCATE" | "CONTEXTUALIZE" | "HUMANIZE" | "DECORATE" | null;
  strength: "STRONG" | "LIGHT" | null;
  content: Record<string, unknown>;
  evidenceWordIds: string[];
  sourceBindingHash: string;
}

export interface LayoutFoundationParagraphV1 {
  paragraphId: string;
  paragraphDesignHash: string;
  upstreamParagraphFingerprint: string;
  order: number;
  visualParagraphType: string;
  primaryExpressionTask: string;
  informationDuty: string;
  objects: LayoutFoundationObjectV1[];
}

export interface LayoutFoundationV1 {
  schemaVersion: 1;
  foundationId: string;
  foundationHash: string;
  projectAgentId: string;
  contextPackId: string;
  contextPackHash: string;
  projectConstitutionId: string;
  projectConstitutionHash: string;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  timelineHash: string;
  canvas: { width: number; height: number; framesPerSecond: number };
  visualParagraphProposalId: string;
  visualParagraphProposalHash: string;
  visualRoleStructureSnapshotId: string;
  visualRoleStructureHash: string;
  visualRolePlanId: string;
  visualRolePlanHash: string;
  materialManifestId: string;
  materialManifestHash: string;
  visualRoleConfirmationId: string;
  visualRoleConfirmationHash: string;
  catalogId: string;
  catalogHash: string;
  paragraphs: LayoutFoundationParagraphV1[];
  createdAt: string;
}

export interface LayoutObjectSlotMappingV1 {
  visualObjectId: string;
  visualObjectHash: string;
  layoutSlotId: LayoutSlotIdV1;
}

export interface LayoutTextAdaptationV1 {
  adaptationId: string;
  adaptationHash: string;
  visualObjectId: string;
  mode: "CONDENSE" | "SPLIT_WITHIN_OBJECT" | "CHANGE_VARIANT";
  originalText: string;
  proposedText: string | null;
  sourceEvidenceWordIds: string[];
  preservesClaims: true;
  provenance: "AI_PROPOSAL";
  status: "PENDING_USER_DECISION";
  rationale: string;
}

export interface LayoutGeometryV1 {
  geometryId: string;
  geometryHash: string;
  catalogHash: string;
  variantId: LayoutVariantIdV1;
  canvas: { width: number; height: number };
  safeRegion: LayoutNormalizedFrameV1;
  captionExclusionRegion: LayoutNormalizedFrameV1;
  slots: Array<{
    layoutSlotId: LayoutSlotIdV1;
    visualObjectId: string;
    normalizedFrame: LayoutNormalizedFrameV1;
    pixelFrame: { x: number; y: number; width: number; height: number };
    areaSharePermille: number;
    zIndex: number;
    personTreatment: "NONE" | "FULL_FRAME" | "RECTANGULAR_PIP" | "CIRCULAR_PIP";
  }>;
}

export interface LayoutPlanParagraphV1 {
  paragraphId: string;
  paragraphLayoutHash: string;
  upstreamParagraphFingerprint: string;
  selectedVariantId: LayoutVariantIdV1;
  objectSlotMappings: LayoutObjectSlotMappingV1[];
  candidateAudit: Array<{
    variantId: LayoutVariantIdV1;
    decision: "SELECTED" | "REJECTED";
    rejectionCode: string | null;
  }>;
  alternative:
    | { kind: "MEANINGFUL_ALTERNATIVE"; variantId: LayoutVariantIdV1; rejectionCode: string; rationale: string }
    | { kind: "ONLY_COMPATIBLE_VARIANT"; reasonCode: "NO_OTHER_CATALOG_VARIANT_COMPATIBLE" };
  evidenceRefs: Array<{ refId: string; refHash: string }>;
  rationale: string;
  textAdaptations: LayoutTextAdaptationV1[];
  textPreflight: {
    state: "PASS" | "REVIEW_REQUIRED";
    checks: Array<{
      visualObjectId: string;
      layoutSlotId: LayoutSlotIdV1;
      measuredGraphemes: number;
      measuredItems: number;
      maximumGraphemes: number;
      maximumLines: number;
      maximumItems: number;
      state: "FIT" | "ADAPTATION_REQUIRED";
      adaptationId: string | null;
    }>;
  };
  geometry: LayoutGeometryV1;
  confidence: number;
  reviewRequired: boolean;
}

export interface LayoutPlanV1 {
  schemaVersion: 1;
  planId: string;
  planHash: string;
  revision: number;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  foundationId: string;
  foundationHash: string;
  projectAgentId: string;
  contextPackId: string;
  contextPackHash: string;
  projectConstitutionHash: string;
  visualRolePlanId: string;
  visualRolePlanHash: string;
  materialManifestId: string;
  materialManifestHash: string;
  catalogId: string;
  catalogHash: string;
  paragraphs: LayoutPlanParagraphV1[];
  createdByTurnId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutPlanProposalV1 {
  schemaVersion: 1;
  proposalId: string;
  proposalHash: string;
  proposalRevision: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "STALE" | "BLOCKED";
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  foundationId: string;
  foundationHash: string;
  basePlanId: string;
  basePlanHash: string;
  candidatePlanId: string | null;
  candidatePlanHash: string | null;
  targetParagraphIds: string[];
  allowedParagraphIds: string[];
  changedParagraphIds: string[];
  summary: string;
  rationale: string;
  createdByTurnId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface LayoutParagraphReviewV1 {
  schemaVersion: 1;
  reviewId: string;
  reviewHash: string;
  planId: string;
  planHash: string;
  paragraphId: string;
  paragraphLayoutHash: string;
  decision: "ACCEPT" | "REJECT";
  acceptedTextAdaptationIds: string[];
  reason: string | null;
  reviewedAt: string;
}

export interface LayoutConfirmationV1 {
  schemaVersion: 1;
  confirmationId: string;
  confirmationHash: string;
  planId: string;
  planHash: string;
  foundationHash: string;
  catalogHash: string;
  paragraphReviewHashes: string[];
  status: "CONFIRMED" | "EXPIRED";
  confirmedAt: string;
  expiredAt: string | null;
}

export interface LayoutSnapshotV1 {
  schemaVersion: 1;
  catalog: LayoutCatalogV1;
  currentFoundation: LayoutFoundationV1 | null;
  currentPlan: LayoutPlanV1 | null;
  plans: LayoutPlanV1[];
  proposals: LayoutPlanProposalV1[];
  paragraphReviews: LayoutParagraphReviewV1[];
  confirmations: LayoutConfirmationV1[];
  paragraphReadiness: Array<{
    paragraphId: string;
    state: "STALE" | "PENDING_PROPOSAL" | "PENDING_REVIEW" | "REJECTED" | "ACCEPTED";
    reasonCodes: string[];
    reviewId: string | null;
  }>;
  reviewReadiness: {
    code: "UPSTREAM_NOT_READY" | "NO_CURRENT_PLAN" | "STALE_PARAGRAPHS" | "PENDING_PROPOSAL" | "PARAGRAPH_REVIEW_REQUIRED" | "READY" | "CONFIRMED";
    eligible: boolean;
    staleParagraphIds: string[];
    pendingProposalIds: string[];
    pendingReviewParagraphIds: string[];
    rejectedParagraphIds: string[];
    confirmationId: string | null;
    blockedReasonCodes: string[];
  };
  timelineModified: false;
}

export type InformationRelationIdV1 =
  | "SINGLE_CLAIM"
  | "DEFINITION_BREAKDOWN"
  | "PARALLEL_GROUPING"
  | "SEQUENCE_PROCESS"
  | "COMPARISON_CHANGE"
  | "DATA_PROOF"
  | "TIME_POSITION"
  | "PROBLEM_SOLUTION_VERIFICATION";

export type SceneGroupKindV1 =
  | "SOURCE_CARRIER"
  | "HEADLINE"
  | "KEY_TEXT"
  | "METRIC"
  | "CARD_SET"
  | "FLOW"
  | "TIMELINE"
  | "COMPARISON"
  | "LIST"
  | "RISK_MATRIX"
  | "CALLOUT"
  | "HIGHLIGHT"
  | "CONNECTOR_SET"
  | "BACKGROUND_SCAFFOLD";

export type ScenePackagingPolicyV1 =
  | "SOURCE_CLEAN"
  | "CONTAINER_FOCUS_ONLY"
  | "DESIGNED_MOTION"
  | "STATIC_SCAFFOLD";

export type SceneProgressOperationV1 = "ADD" | "REPLACE" | "TRANSFORM" | "FOCUS" | "CONCLUDE";
export type SceneMotionReasonCodeV1 =
  | "ESTABLISH"
  | "REVEAL"
  | "SHOW_RELATION"
  | "MARK_PROGRESS"
  | "COMPARE"
  | "DIRECT_ATTENTION"
  | "VERIFY"
  | "CONCLUDE";

export interface SceneDirectionCatalogV1 {
  schemaVersion: 1;
  catalogId: string;
  catalogHash: string;
  version: 1;
  aspect: "LANDSCAPE_16_9";
  theme: "TECH_HUD_DARK_V1";
  informationRelations: Array<{
    relationId: InformationRelationIdV1;
    label: string;
    designQuestion: string;
    compatibleLayoutFamilyIds: LayoutFamilyIdV1[];
    signatureGroupKinds: SceneGroupKindV1[];
  }>;
  groupKinds: Array<{
    groupKind: SceneGroupKindV1;
    label: string;
    purpose: string;
    minimumItems: number;
    maximumItems: number;
    semantic: boolean;
    derivedWithoutOwnerAllowed: boolean;
    allowedPackagingPolicies: ScenePackagingPolicyV1[];
  }>;
  objectPolicies: Array<{
    visualObjectKind: VisualRoleObjectKind;
    sourceBearing: boolean;
    allowedPackagingPolicies: ScenePackagingPolicyV1[];
    requiredGroupKinds: SceneGroupKindV1[];
  }>;
  operations: Array<{
    operation: SceneProgressOperationV1;
    label: string;
    purpose: string;
    allowedMotionReasons: SceneMotionReasonCodeV1[];
  }>;
  invariantCodes: string[];
}

export interface SceneDirectionFoundationObjectV1 {
  visualObjectId: string;
  visualObjectHash: string;
  role: "MAIN" | "SUPPORTING";
  kind: VisualRoleObjectKind;
  layoutSlotId: LayoutSlotIdV1;
  normalizedFrame: LayoutNormalizedFrameV1;
  zIndex: number;
  personTreatment: "NONE" | "FULL_FRAME" | "RECTANGULAR_PIP" | "CIRCULAR_PIP";
  informationDuty: string;
  supportDuty: "EMPHASIZE" | "CLARIFY" | "LOCATE" | "CONTEXTUALIZE" | "HUMANIZE" | "DECORATE" | null;
  strength: "STRONG" | "LIGHT" | null;
  content: Record<string, unknown>;
  evidenceWordIds: string[];
  sourceBindingHash: string;
}

export interface SceneDirectionFoundationParagraphV1 {
  paragraphId: string;
  paragraphFingerprint: string;
  order: number;
  visualParagraphType: string;
  primaryExpressionTask: string;
  informationDuty: string;
  wordRange: { startWordId: string; endWordId: string; wordCount: number };
  frameRange: { startFrame: number; endFrame: number };
  paragraphLayoutHash: string;
  selectedVariantId: LayoutVariantIdV1;
  selectedFamilyId: LayoutFamilyIdV1;
  geometryHash: string;
  objects: SceneDirectionFoundationObjectV1[];
}

export interface SceneDirectionFoundationV1 {
  schemaVersion: 1;
  foundationId: string;
  foundationHash: string;
  projectAgentId: string;
  contextPackId: string;
  contextPackHash: string;
  projectConstitutionId: string;
  projectConstitutionHash: string;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  timelineHash: string;
  visualParagraphProposalId: string;
  visualParagraphProposalHash: string;
  masterTranscriptHash: string;
  transcriptWordCount: number;
  visualRolePlanId: string;
  visualRolePlanHash: string;
  materialManifestId: string;
  materialManifestHash: string;
  layoutFoundationId: string;
  layoutFoundationHash: string;
  layoutPlanId: string;
  layoutPlanHash: string;
  layoutConfirmationId: string;
  layoutConfirmationHash: string;
  catalogId: string;
  catalogHash: string;
  canvas: { width: number; height: number; framesPerSecond: number };
  paragraphs: SceneDirectionFoundationParagraphV1[];
  createdAt: string;
}

export interface SceneDirectionPersistentGroupV1 {
  groupId: string;
  groupHash: string;
  groupKey: string;
  ownerVisualObjectId: string | null;
  groupKind: SceneGroupKindV1;
  label: string | null;
  informationDuty: string;
  packagingPolicy: ScenePackagingPolicyV1;
  contentMode: "UPSTREAM_EXACT" | "EVIDENCE_BOUND_SUMMARY" | "NON_SEMANTIC";
  items: Array<{
    itemId: string;
    itemHash: string;
    itemKey: string;
    text: string;
    evidenceWordIds: string[];
  }>;
  rationale: string;
}

export interface SceneDirectionCompiledStateV1 {
  stateId: string;
  stateHash: string;
  stateIndex: number;
  beatKey: string;
  anchorWordId: string;
  anchorFrame: number;
  operation: SceneProgressOperationV1;
  purpose: string;
  motionReason: SceneMotionReasonCodeV1;
  visibleGroupIds: string[];
  enteringGroupIds: string[];
  exitingGroupIds: string[];
  transform: { fromGroupId: string; toGroupId: string } | null;
  focusGroupId: string | null;
}

export interface SceneDirectionPlanParagraphV1 {
  paragraphId: string;
  paragraphSceneHash: string;
  upstreamParagraphFingerprint: string;
  informationRelation: InformationRelationIdV1;
  relationRationale: string;
  groups: SceneDirectionPersistentGroupV1[];
  states: SceneDirectionCompiledStateV1[];
  evidenceRefs: Array<{ refId: string; refHash: string }>;
  confidence: number;
  reviewRequired: boolean;
}

export interface SceneDirectionPlanV1 {
  schemaVersion: 1;
  planId: string;
  planHash: string;
  revision: number;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  foundationId: string;
  foundationHash: string;
  projectAgentId: string;
  contextPackId: string;
  contextPackHash: string;
  projectConstitutionHash: string;
  layoutPlanId: string;
  layoutPlanHash: string;
  layoutConfirmationId: string;
  layoutConfirmationHash: string;
  catalogId: string;
  catalogHash: string;
  paragraphs: SceneDirectionPlanParagraphV1[];
  createdByTurnId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SceneDirectionParagraphReviewV1 {
  schemaVersion: 1;
  reviewId: string;
  reviewHash: string;
  planId: string;
  planHash: string;
  paragraphId: string;
  paragraphSceneHash: string;
  decision: "ACCEPT" | "REJECT";
  reason: string | null;
  reviewedAt: string;
}

export interface SceneDirectionConfirmationV1 {
  schemaVersion: 1;
  confirmationId: string;
  confirmationHash: string;
  planId: string;
  planHash: string;
  foundationHash: string;
  catalogHash: string;
  paragraphReviewHashes: string[];
  status: "CONFIRMED" | "EXPIRED";
  confirmedAt: string;
  expiredAt: string | null;
}

export interface SceneDirectionSnapshotV1 {
  schemaVersion: 1;
  catalog: SceneDirectionCatalogV1;
  currentFoundation: SceneDirectionFoundationV1 | null;
  currentPlan: SceneDirectionPlanV1 | null;
  plans: SceneDirectionPlanV1[];
  paragraphReviews: SceneDirectionParagraphReviewV1[];
  confirmations: SceneDirectionConfirmationV1[];
  paragraphReadiness: Array<{
    paragraphId: string;
    state: "STALE" | "PENDING_REVIEW" | "REJECTED" | "ACCEPTED";
    reasonCodes: string[];
    reviewId: string | null;
  }>;
  reviewReadiness: {
    code: "UPSTREAM_NOT_READY" | "NO_CURRENT_PLAN" | "STALE_PARAGRAPHS" | "PARAGRAPH_REVIEW_REQUIRED" | "READY" | "CONFIRMED";
    eligible: boolean;
    staleParagraphIds: string[];
    pendingReviewParagraphIds: string[];
    rejectedParagraphIds: string[];
    confirmationId: string | null;
    blockedReasonCodes: string[];
  };
  timelineModified: false;
  productionRegistryModified: false;
}

export type PackagingResolutionDispositionV1 = "HOST_PRESERVED" | "SELECTED" | "BLOCKED_COMPONENT_GAP";
export type PackagingResolutionRendererKindV1 = "DOM_CLASS" | "REMOTION_REACT";

export interface PackagingResolutionComponentEntryV1 {
  componentId: string;
  componentHash: string;
  source: "PILOT_PRIMITIVE" | "NEW_CORE";
  sourceComponentId: string;
  label: string;
  purpose: string;
  lifecycle: "LAB_VERIFIED";
  visibility: "PROJECT_AUDITION_ONLY";
  selectionAuthority: "HOST_LAYOUT_PROJECTION" | "PROJECT_AGENT_EXPLICIT";
  rendererKind: PackagingResolutionRendererKindV1;
  rendererId: string;
  implementationHash: string;
  fidelityPolicy: "PRESERVE_SOURCE" | "CONTAINER_ONLY" | "DESIGNED_GRAPHIC" | "SCENE_SURFACE" | "BOUNDARY";
  compatibleGroupKinds: SceneGroupKindV1[];
  compatibleObjectKinds: VisualRoleObjectKind[];
  compatibleRoles: Array<"MAIN" | "SUPPORTING">;
  compatiblePackagingPolicies: ScenePackagingPolicyV1[];
  allowedMotionReasons: SceneMotionReasonCodeV1[];
  evidenceRequirements: string[];
  capacity: { minimumItems: number | null; maximumItems: number | null; maximumTextCharacters: number | null };
  requiresExplicitSpatialAnchor: boolean;
  projectAuditionEnabled: boolean;
  globallyBlockedReasonCodes: string[];
}

export interface PackagingResolutionCatalogV1 {
  schemaVersion: 1;
  catalogId: string;
  catalogHash: string;
  version: 1;
  aspect: "LANDSCAPE_16_9";
  lifecycle: "PROJECT_AUDITION";
  sourceComponentCount: 40;
  productionRegistryEntryCount: 0;
  agentSelectionRequired: true;
  hostRankingForbidden: true;
  entries: PackagingResolutionComponentEntryV1[];
  invariantCodes: string[];
}

export interface PackagingResolutionTargetV1 {
  targetId: string;
  targetHash: string;
  paragraphId: string;
  groupId: string;
  groupHash: string;
  groupKind: SceneGroupKindV1;
  packagingPolicy: ScenePackagingPolicyV1;
  ownerVisualObjectId: string | null;
  ownerKind: VisualRoleObjectKind | null;
  ownerRole: "MAIN" | "SUPPORTING" | null;
  informationDuty: string;
  label: string | null;
  items: Array<{ itemId: string; itemHash: string; text: string; evidenceWordIds: string[] }>;
  operations: SceneProgressOperationV1[];
  motionReasons: SceneMotionReasonCodeV1[];
  compatibleComponentIds: string[];
  requiredDisposition: PackagingResolutionDispositionV1;
  hostProjectionComponentId: string | null;
  blockedReasonCodes: string[];
}

export interface PackagingResolutionFoundationParagraphV1 {
  paragraphId: string;
  paragraphFingerprint: string;
  order: number;
  sceneParagraphHash: string;
  informationRelation: InformationRelationIdV1;
  frameRange: { startFrame: number; endFrame: number };
  targets: PackagingResolutionTargetV1[];
}

export interface PackagingResolutionFoundationV1 {
  schemaVersion: 1;
  foundationId: string;
  foundationHash: string;
  projectAgentId: string;
  contextPackId: string;
  contextPackHash: string;
  projectConstitutionHash: string;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  timelineHash: string;
  sceneDirectionFoundationId: string;
  sceneDirectionFoundationHash: string;
  sceneDirectionPlanId: string;
  sceneDirectionPlanHash: string;
  sceneDirectionConfirmationId: string;
  sceneDirectionConfirmationHash: string;
  componentCatalogId: string;
  componentCatalogHash: string;
  productionRegistryHash: string;
  productionRegistryEntryCount: 0;
  canvas: { width: number; height: number; framesPerSecond: number };
  paragraphs: PackagingResolutionFoundationParagraphV1[];
  createdAt: string;
}

export interface PackagingResolutionBindingV1 {
  bindingId: string;
  bindingHash: string;
  targetId: string;
  targetHash: string;
  groupId: string;
  groupHash: string;
  disposition: PackagingResolutionDispositionV1;
  componentId: string | null;
  componentHash: string | null;
  rendererKind: PackagingResolutionRendererKindV1 | null;
  rendererId: string | null;
  resolvedInput: Record<string, unknown> | null;
  controls: { intensity: number; durationFrames: number; reducedMotion: boolean } | null;
  rationale: string;
  previewHash: string;
  status: "READY" | "BLOCKED";
  reasonCodes: string[];
}

export interface PackagingResolutionPlanParagraphV1 {
  paragraphId: string;
  paragraphResolutionHash: string;
  upstreamParagraphFingerprint: string;
  bindings: PackagingResolutionBindingV1[];
  selectedComponentIds: string[];
  previewHash: string;
  preflight: {
    status: "READY_FOR_PROJECT_AUDITION" | "BLOCKED_COMPONENT_GAPS";
    blockedTargetIds: string[];
    reasonCodes: string[];
  };
}

export interface PackagingResolutionPlanV1 {
  schemaVersion: 1;
  planId: string;
  planHash: string;
  revision: number;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  foundationId: string;
  foundationHash: string;
  sceneDirectionPlanId: string;
  sceneDirectionPlanHash: string;
  sceneDirectionConfirmationId: string;
  sceneDirectionConfirmationHash: string;
  componentCatalogId: string;
  componentCatalogHash: string;
  productionRegistryHash: string;
  paragraphs: PackagingResolutionPlanParagraphV1[];
  outcome: "READY_FOR_PROJECT_AUDITION" | "BLOCKED_COMPONENT_GAPS";
  createdByTurnId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PackagingResolutionParagraphReviewV1 {
  schemaVersion: 1;
  reviewId: string;
  reviewHash: string;
  planId: string;
  planHash: string;
  paragraphId: string;
  paragraphResolutionHash: string;
  previewHash: string;
  decision: "ACCEPT" | "REJECT";
  reason: string | null;
  reviewedAt: string;
}

export interface PackagingResolutionConfirmationV1 {
  schemaVersion: 1;
  confirmationId: string;
  confirmationHash: string;
  planId: string;
  planHash: string;
  foundationHash: string;
  componentCatalogHash: string;
  paragraphReviewHashes: string[];
  auditionScope: "PROJECT_PLAN_ONLY";
  componentLifecyclePromoted: false;
  productionRegistryModified: false;
  status: "CONFIRMED" | "EXPIRED";
  confirmedAt: string;
  expiredAt: string | null;
}

export interface PackagingResolutionSnapshotV1 {
  schemaVersion: 1;
  catalog: PackagingResolutionCatalogV1;
  currentFoundation: PackagingResolutionFoundationV1 | null;
  currentPlan: PackagingResolutionPlanV1 | null;
  plans: PackagingResolutionPlanV1[];
  paragraphReviews: PackagingResolutionParagraphReviewV1[];
  confirmations: PackagingResolutionConfirmationV1[];
  paragraphReadiness: Array<{
    paragraphId: string;
    state: "STALE" | "BLOCKED_COMPONENT_GAPS" | "PENDING_REVIEW" | "REJECTED" | "ACCEPTED";
    reasonCodes: string[];
    reviewId: string | null;
  }>;
  reviewReadiness: {
    code: "UPSTREAM_NOT_READY" | "NO_CURRENT_PLAN" | "STALE_PARAGRAPHS" | "COMPONENT_GAPS" | "PARAGRAPH_REVIEW_REQUIRED" | "READY" | "CONFIRMED";
    eligible: boolean;
    staleParagraphIds: string[];
    blockedParagraphIds: string[];
    pendingReviewParagraphIds: string[];
    rejectedParagraphIds: string[];
    confirmationId: string | null;
    blockedReasonCodes: string[];
  };
  lifecycle: "PROJECT_AUDITION";
  componentUserAccepted: false;
  productionRegistryEntryCount: 0;
  timelineModified: false;
  programSpineModified: false;
  productionRegistryModified: false;
}

export type PackagingImplementationAdapterV1 = import("../contracts/packaging-implementation-contract.js").PackagingImplementationAdapterV1;
export type PackagingImplementationDesignV1 = import("../contracts/packaging-implementation-contract.js").PackagingImplementationDesignV1;
export type PackagingImplementationResolutionV1 = import("../contracts/packaging-implementation-contract.js").PackagingImplementationResolutionV1;
export type PackagingImplementationRenderLayerV1 = import("../contracts/packaging-implementation-contract.js").PackagingImplementationRenderLayerV1;
export type PackagingImplementationRenderParagraphV1 = import("../contracts/packaging-implementation-contract.js").PackagingImplementationRenderParagraphV1;
export type PackagingImplementationPreviewV1 = import("../contracts/packaging-implementation-contract.js").PackagingImplementationPreviewV1;
export type PackagingImplementationProposalV1 = import("../contracts/packaging-implementation-contract.js").PackagingImplementationProposalV1;
export type PackagingImplementationSnapshotV1 = import("../contracts/packaging-implementation-contract.js").PackagingImplementationSnapshotV1;

export interface RoughCutProductEngine {
  available: boolean;
  engine: "funasr-seaco" | "openai-whisper";
  model: string;
  language: "zh";
  message: string;
}

export interface RoughCutProductSnapshot {
  schemaVersion: 1;
  engine: RoughCutProductEngine;
  snapshot: import("./rough-cut-v1/types.js").RoughCutSnapshot;
}

export type RoughCutAnalysisState =
  | "preparing"
  | "transcribing"
  | "analyzing"
  | "cancelling"
  | "completed"
  | "cancelled"
  | "failed";

export interface RoughCutAnalysisJobReport {
  schemaVersion: 1;
  jobId: string;
  state: RoughCutAnalysisState;
  stage: string;
  progress: number;
  message: string;
  expectedRevision: number;
  assetCount: number;
  completedAssetCount: number;
  currentAssetName: string | null;
  proposalId: string | null;
  error: { code: string; message: string } | null;
}

export interface RoughCutProductMutationResult {
  snapshot: import("./rough-cut-v1/types.js").RoughCutSnapshot;
  editor: import("./editor-v2/types.js").EditorDocumentEnvelope;
  proposal: import("./rough-cut-v1/types.js").RoughCutProposal;
}

export interface FakeJobReport {
  jobId: string;
  state: "running" | "cancelled" | "completed";
}

export interface ProjectWorkspace {
  schemaVersion: 1;
  projectId: string;
  name: string;
  projectRoot: string;
  createdAt: string;
  updatedAt: string;
  mediaCount: number;
  hasTimeline: boolean;
}

export interface CreateEditingProjectReport {
  workspace: ProjectWorkspace;
  editor: import("./editor-v2/types.js").EditorDocumentEnvelope;
}

export interface DeleteEditingProjectReport {
  schemaVersion: 1;
  projectId: string;
  name: string;
  originalProjectRoot: string;
  trashedProjectRoot: string;
  recoverable: true;
}

export interface ImportedMediaFile {
  name: string;
  locator: string;
  absolutePath: string;
  byteLength: number;
  metadata?: ImportedMediaMetadata;
}

export interface PickedMediaReport {
  workspace: ProjectWorkspace;
  media: ImportedMediaFile[];
}

export interface PickedVisualRoleMaterial {
  name: string;
  locator: string;
  absolutePath: string;
  byteLength: number;
}

export interface PickedVisualRoleMaterialsReport {
  workspace: ProjectWorkspace;
  materials: PickedVisualRoleMaterial[];
}

export interface ImportedMediaMetadata {
  locator: string;
  name: string;
  durationMs: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface PreviewProxyAssetReport {
  assetId: string;
  locator: string;
  reused: boolean;
  encoder: string;
}

export interface PreparePreviewProxiesReport {
  schemaVersion: 1;
  proxies: PreviewProxyAssetReport[];
}

export interface NativeTimelinePlayerPrepareReport {
  ok: true;
  revisionKey: string;
  clipCount: number;
  durationSeconds: number;
  renderWidth: number;
  renderHeight: number;
  renderBackend: "core-image-metal" | "core-image-metal-layout" | "avfoundation-audio";
  gapCount: number;
  reverseClipCount: number;
  transformedClipCount: number;
  reverseAudioMutedClipCount: number;
}

export interface NativeTimelinePlayerStatus {
  ok: true;
  prepared: boolean;
  revisionKey: string;
  currentSeconds: number;
  durationSeconds: number;
  renderBackend: "core-image-metal" | "core-image-metal-layout" | "avfoundation-audio" | null;
  gapCount: number;
  reverseClipCount: number;
  transformedClipCount: number;
  reverseAudioMutedClipCount: number;
  rate: number;
  control: "paused" | "waiting" | "playing";
  readiness: "unknown" | "ready" | "failed";
  visible: boolean;
  readyForDisplay: boolean;
  ended: boolean;
  error: string | null;
}

export interface NativeTimelinePlayerPauseReport {
  ok: true;
  currentSeconds: number;
}

export interface NativeTimelinePlayerCommandReport {
  ok: true;
  requestedSeconds?: number;
  revisionKey?: string;
  visible?: boolean;
}

export interface ExportDestination {
  authorizationId: string;
  outputPath: string;
}

export type ExportJobState =
  | "preparing"
  | "rendering"
  | "verifying"
  | "publishing"
  | "cancelling"
  | "completed"
  | "cancelled"
  | "failed";

export interface ExportVerification {
  container: "mp4";
  videoCodec: "h264";
  audioCodec: "aac";
  width: number;
  height: number;
  framesPerSecond: number;
  frameCount: number;
  durationSeconds: number;
  videoDurationSeconds: number | null;
  audioDurationSeconds: number | null;
  byteLength: number;
  decoded: true;
}

/** The UI consumes the exact sidecar Packaged Cut report, including selection
 * and the final checkpoint; this is an alias rather than a forked wire shape. */
export type ExportJobReport = import("../contracts/packaged-cut-export-job-contract.js").PackagedCutExportJobReportV1;
