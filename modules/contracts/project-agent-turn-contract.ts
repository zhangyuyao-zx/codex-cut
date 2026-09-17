import {sceneModuleDraftSchema,sceneModuleManifestSchema} from "./scene-module-contract.js";
import { compiledSceneMotionSchema } from "./scene-motion.js";
import { sceneComponentInstanceV1Schema } from "./scene-program-contract.js";
import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import { frameRangeSchema, hashSchema, idSchema, isoInstantSchema } from "../shared/timeline-v2/schema.js";
import {
  DIRECTOR_EXPRESSION_TASKS,
  DIRECTOR_INFORMATION_RELATIONS,
  DIRECTOR_MOTION_REASONS,
  DIRECTOR_OBJECT_CLASSES,
  DIRECTOR_PACKAGING_MODES,
  DIRECTOR_TEXT_ROLES,
  projectAgentCreativeParagraphSubmissionV1Schema,
  directorVisualObjectSubmissionV1Schema,
  directorSceneStateV1Schema,
  projectAgentMaterialRequirementSubmissionV1Schema,
  directorObjectClassV1Schema,
  directorMotionReasonV1Schema,
  directorPackagingModeV1Schema,
  directorSceneOperationV1Schema,
  directorTextRoleV1Schema,
  directorVisualObjectKindV1Schema,
  directorCreativePlanContinuityV1Schema,
  projectDirectorSnapshotV1Schema,
  projectDesignSystemV1Schema,
  type ProjectDirectorSnapshotV1,
  type SubmitProjectAgentCreativePlanV1Request,
} from "./project-director-contract.js";
import {
  layoutCutRectV1Schema,
  layoutCutResolvedSourceV1Schema,
  layoutCutSnapshotV1Schema,
  type LayoutCutSnapshotV1,
} from "./layout-cut-contract.js";
import {
  layoutFamilyIdV1Schema,
  layoutSlotIdV1Schema,
  layoutVariantIdV1Schema,
} from "./layout-contract.js";
import { LAYOUT_CATALOG_V1 } from "./layout-catalog.js";
import {
  packagedCutSnapshotV1Schema,
  type PackagedCutSnapshotV1,
} from "./packaged-cut-contract.js";
import {
  sceneCapabilityCatalogV1Schema,
  sceneImplementationParagraphSubmissionV1Schema,
  scenePatternIdV1Schema,
  sceneProgramLintDiagnosticV1Schema,
  sceneProgramSnapshotV1Schema,
  sceneProgramObjectV1Schema,
  submitSceneImplementationPlanV1RequestSchema,
  type SceneCapabilityCatalogV1,
  type SceneImplementationPlanV1,
  type SceneProgramSnapshotV1,
  type SubmitSceneImplementationPlanV1Request,
} from "./scene-program-contract.js";
import type { SceneSampleSnapshot } from "./scene-sample-contract.js";
import {
  projectAgentDecisionLedgerEntryV1Schema,
  projectAgentContextSnapshotV1Schema,
  type ProjectAgentContextSnapshotV1,
} from "./project-agent-context-contract.js";
import { dshRoughCutSelectionContextSchema } from "./dsh-rough-cut-contract.js";
import { projectAgentCreativeParagraphCompatibilityIssues } from "./project-agent-creative-compatibility.js";
import { SCENE_DIRECTION_CATALOG_V1 } from "./scene-direction-catalog.js";

const compactTextSchema = z.string().trim().min(1).max(4_000);
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

export const PROJECT_AGENT_TURN_KINDS = ["ROUGH_CUT", "CREATIVE_PLAN", "SCENE_IMPLEMENTATION"] as const;
export const projectAgentTurnKindV1Schema = z.enum(PROJECT_AGENT_TURN_KINDS);

export const PROJECT_AGENT_TURN_INTENTS = ["EXECUTE", "CONVERSE"] as const;
export const projectAgentTurnIntentV1Schema = z.enum(PROJECT_AGENT_TURN_INTENTS);

export const PROJECT_AGENT_TURN_STATES = [
  "RUNNING",
  "COMPLETED",
  "READ_ONLY_COMPLETED",
  "NEEDS_ATTENTION",
  "AWAITING_REVIEW",
  "CANCELLED",
  "FAILED",
  "INTERRUPTED",
] as const;
export const projectAgentTurnStateV1Schema = z.enum(PROJECT_AGENT_TURN_STATES);

export const PROJECT_AGENT_EXECUTION_PHASES = [
  "PREPARING_CONTEXT",
  "AGENT_DESIGNING",
  "HOST_VALIDATING",
  "REVIEWING_SCENE",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export const projectAgentExecutionPhaseV1Schema = z.enum(PROJECT_AGENT_EXECUTION_PHASES);

export const PROJECT_AGENT_TERMINAL_ACTIONS = [
  "DELEGATE_ROUGH_CUT",
  "SUBMIT_WHOLE_FILM_CREATIVE_PLAN",
  "SUBMIT_SCENE_IMPLEMENTATION_PLAN",
] as const;
export const projectAgentTerminalActionV1Schema = z.enum(PROJECT_AGENT_TERMINAL_ACTIONS);

export const projectAgentSceneScopeV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("SAMPLE"),
    paragraphId: idSchema,
  }).strict(),
  z.object({
    kind: z.literal("FULL"),
    reviewHash: hashSchema,
  }).strict(),
]);

export type ProjectAgentSceneScopeV1 = z.infer<typeof projectAgentSceneScopeV1Schema>;

export const projectAgentTurnSubmitRequestV1Schema = z.object({
  userText: z.string().trim().min(1).max(8_000),
  /** The host normally derives this from readiness. It is a user-intent hint, not authority. */
  turnKind: projectAgentTurnKindV1Schema.nullable().optional(),
  /** Card actions explicitly execute; free-form conversation may remain read-only. */
  intent: projectAgentTurnIntentV1Schema.default("CONVERSE"),
  /** Host-captured selection state; only delegated Rough Cut consumes it. */
  roughCutContext: dshRoughCutSelectionContextSchema,
  /** Optional single paragraph sample or full plan review scope for Scene execution. */
  sceneScope: projectAgentSceneScopeV1Schema.optional(),
}).strict();

export type ProjectAgentTurnSubmitRequestV1 = z.infer<typeof projectAgentTurnSubmitRequestV1Schema>;

const turnReferenceSchema = z.object({
  turnId: idSchema.optional(),
  jobId: idSchema.optional(),
}).strict().superRefine((value, context) => {
  if ((value.turnId === undefined) === (value.jobId === undefined)) {
    context.addIssue({ code: "custom", path: ["turnId"], message: "provide exactly one turnId or jobId" });
  }
});

export const projectAgentTurnStatusRequestV1Schema = turnReferenceSchema.safeExtend({ summaryOnly: z.literal(true).optional() });
export const projectAgentTurnCancelRequestV1Schema = turnReferenceSchema;
export type ProjectAgentTurnStatusRequestV1 = z.infer<typeof projectAgentTurnStatusRequestV1Schema>;
export type ProjectAgentTurnCancelRequestV1 = z.infer<typeof projectAgentTurnCancelRequestV1Schema>;

export const projectAgentTranscriptPageRequestV1Schema = z.object({
  cursor: z.number().int().nonnegative().max(1_000_000).describe("Zero-based item offset, NOT a page number. Start at 0, then copy the exact nextCursor returned by the previous response. Already-read valid pages may be read again."),
}).strict();

export const projectAgentDesignPageRequestV1Schema = z.object({
  cursor: z.number().int().nonnegative().max(1_000_000).describe("Zero-based item offset, NOT a page number. Start at 0, then copy the exact nextCursor returned by the previous response. Already-read valid pages may be read again."),
}).strict();

export const projectAgentCapabilityPageRequestV1Schema = z.object({
  cursor: z.number().int().nonnegative().max(1_000_000).describe("Zero-based item offset, NOT a page number. Start at 0, then copy the exact nextCursor returned by the previous response. Already-read valid pages may be read again."),
}).strict();

/**
 * A fresh Creative Plan supplies only stable word starts and full semantic
 * plan fields. The host derives paragraph IDs, end words, included words,
 * frame ranges, transcript text and source assets from current evidence.
 */
export const projectAgentCreativePlanParagraphV1Schema = projectAgentCreativeParagraphSubmissionV1Schema;

const projectAgentCompilableCreativePlanParagraphV1Schema = projectAgentCreativeParagraphSubmissionV1Schema.superRefine(
  (paragraph, context) => {
    for (const issue of projectAgentCreativeParagraphCompatibilityIssues(paragraph)) {
      context.addIssue({ code: "custom", path: issue.path, message: `${issue.code}: ${issue.message}` });
    }
  },
);

export const projectAgentCreativePlanWholeFilmReviewV1Schema = z.object({
  rhythmAssessment: z.string().trim().min(1).max(1_000),
  diversityAssessment: z.string().trim().min(1).max(1_000),
  continuityAssessment: z.string().trim().min(1).max(1_000),
  unresolvedRisks: z.array(z.string().trim().min(1).max(1_000)).max(32),
  opportunityAudit: z.object({
    assessment: z.string().trim().min(1).max(1_000),
    missedScreenRecordingParagraphStartWordIds: z.array(z.string().trim().min(1).max(256)).max(512),
    missedProcessParagraphStartWordIds: z.array(z.string().trim().min(1).max(256)).max(512),
    missedComparisonParagraphStartWordIds: z.array(z.string().trim().min(1).max(256)).max(512),
    missedDataParagraphStartWordIds: z.array(z.string().trim().min(1).max(256)).max(512),
    missedEvidenceParagraphStartWordIds: z.array(z.string().trim().min(1).max(256)).max(512),
  }).strict(),
  layoutAudit: z.object({
    assessment: z.string().trim().min(1).max(1_000),
    repeatedLayoutParagraphStartWordIds: z.array(z.string().trim().min(1).max(256)).max(512),
  }).strict(),
  materialAudit: z.object({
    assessment: z.string().trim().min(1).max(1_000),
    requirementIds: z.array(z.string().trim().min(1).max(256)).max(256),
  }).strict(),
  restraintAudit: z.object({
    assessment: z.string().trim().min(1).max(1_000),
    overpackagedParagraphStartWordIds: z.array(z.string().trim().min(1).max(256)).max(512),
    underpackagedParagraphStartWordIds: z.array(z.string().trim().min(1).max(256)).max(512),
  }).strict(),
}).strict();

export type ProjectAgentCreativePlanWholeFilmReviewV1 = z.infer<typeof projectAgentCreativePlanWholeFilmReviewV1Schema>;

export const projectAgentMainVisualKindCountV1Schema = z.object({
  kind: directorVisualObjectKindV1Schema,
  count: z.number().int().positive().max(512),
}).strict();

export type ProjectAgentMainVisualKindCountV1 = z.infer<typeof projectAgentMainVisualKindCountV1Schema>;

/** Model payload omits host-derived envelope fields; the turn service adds them. */
export const projectAgentCreativePlanPayloadV1Schema = z.object({
  intentSummary: z.string().trim().min(1).max(1_000),
  designSystem: projectDesignSystemV1Schema,
  materialRequirements: z.array(projectAgentMaterialRequirementSubmissionV1Schema).max(256),
  paragraphs: z.array(projectAgentCompilableCreativePlanParagraphV1Schema).min(1).max(512),
  wholeFilmReview: projectAgentCreativePlanWholeFilmReviewV1Schema,
}).strict().superRefine((payload, context) => {
  if (!unique(payload.paragraphs.map((paragraph) => paragraph.startWordId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "creative paragraph start word ids must be unique" });
  }
  if (!unique(payload.materialRequirements.map((requirement) => requirement.requirementId))) {
    context.addIssue({ code: "custom", path: ["materialRequirements"], message: "material requirement ids must be unique" });
  }
  const starts = new Set(payload.paragraphs.map((paragraph) => paragraph.startWordId));
  const reviewedStarts = [
    ...payload.wholeFilmReview.opportunityAudit.missedScreenRecordingParagraphStartWordIds,
    ...payload.wholeFilmReview.opportunityAudit.missedProcessParagraphStartWordIds,
    ...payload.wholeFilmReview.opportunityAudit.missedComparisonParagraphStartWordIds,
    ...payload.wholeFilmReview.opportunityAudit.missedDataParagraphStartWordIds,
    ...payload.wholeFilmReview.opportunityAudit.missedEvidenceParagraphStartWordIds,
    ...payload.wholeFilmReview.layoutAudit.repeatedLayoutParagraphStartWordIds,
    ...payload.wholeFilmReview.restraintAudit.overpackagedParagraphStartWordIds,
    ...payload.wholeFilmReview.restraintAudit.underpackagedParagraphStartWordIds,
  ];
  if (reviewedStarts.some((startWordId) => !starts.has(startWordId))) {
    context.addIssue({ code: "custom", path: ["wholeFilmReview"], message: "whole-film audits may reference only staged paragraph start word ids" });
  }
  const requirementIds = new Set(payload.materialRequirements.map((requirement) => requirement.requirementId));
  if (payload.wholeFilmReview.materialAudit.requirementIds.some((requirementId) => !requirementIds.has(requirementId))) {
    context.addIssue({ code: "custom", path: ["wholeFilmReview", "materialAudit", "requirementIds"], message: "material audit may reference only staged material requirements" });
  }
});

export type ProjectAgentCreativePlanPayloadV1 = z.infer<typeof projectAgentCreativePlanPayloadV1Schema>;

/**
 * Read-only projection for a persisted plan created before the current
 * compatibility floor. It preserves the semantic shape so the Project Agent
 * can inspect and repair legacy decisions; it is never accepted as a new
 * staged paragraph or terminal submission.
 */
export const projectAgentCreativePlanRevisionProjectionV1Schema = z.object({
  intentSummary: z.string().trim().min(1).max(1_000),
  designSystem: projectDesignSystemV1Schema,
  materialRequirements: z.array(projectAgentMaterialRequirementSubmissionV1Schema).max(256),
  paragraphs: z.array(projectAgentCreativePlanParagraphV1Schema).min(1).max(512),
  wholeFilmReview: projectAgentCreativePlanWholeFilmReviewV1Schema,
}).strict().superRefine((payload, context) => {
  if (!unique(payload.paragraphs.map((paragraph) => paragraph.startWordId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "creative paragraph start word ids must be unique" });
  }
  if (!unique(payload.materialRequirements.map((requirement) => requirement.requirementId))) {
    context.addIssue({ code: "custom", path: ["materialRequirements"], message: "material requirement ids must be unique" });
  }
});

/**
 * A Creative Plan is assembled in-memory during one model turn.  Each call
 * carries exactly one bounded semantic part; the host never sends a partial
 * part to the Project Director.
 */
const projectAgentCreativePlanDeleteSlotV1Schema = z.object({
  kind: z.literal("DELETE_SLOT"),
  target: z.enum(["MATERIAL_REQUIREMENT", "PARAGRAPH"]),
  slotIndex: z.number().int().min(0).max(511),
}).strict().superRefine((value, context) => {
  if (value.target === "MATERIAL_REQUIREMENT" && value.slotIndex > 255) {
    context.addIssue({
      code: "custom",
      path: ["slotIndex"],
      message: "material requirement slots must be between 0 and 255",
    });
  }
});

// Model-facing source selectors are exact text within a host-bound paragraph.
export const creativeQuoteSelectorSchema = z.object({
  quote: z.string().min(1).max(4000),
  occurrence: z.number().int().nonnegative().max(20000),
}).strict();
export const creativeOutlineRequestSchema = z.object({
  kind: z.literal("SOURCE_OUTLINE"),
  sourceHash: hashSchema,
  paragraphs: z.array(z.object({
    startUnitIndex: z.number().int().nonnegative().max(20000),
    startOffsetWords: z.number().int().nonnegative().max(20000).optional(),
    openingQuote: z.string().trim().min(1).max(1000),
    summary: compactTextSchema,
  }).strict()).min(1).max(512),
}).strict();
const boundObjectSchema = z.object({
  ...directorVisualObjectSubmissionV1Schema.shape,
  source: z.discriminatedUnion("kind", [
    z.object({kind:z.literal("EXISTING_ASSET"),assetId:idSchema}).strict(),
    z.object({kind:z.literal("REQUIRED_MATERIAL"),requirementId:idSchema}).strict(),
    z.object({kind:z.literal("TRANSCRIPT_QUOTE"),selection:creativeQuoteSelectorSchema}).strict(),
    z.object({kind:z.literal("CONSTRUCTED_QUOTE"),selection:creativeQuoteSelectorSchema.nullable()}).strict(),
  ]),
});
export const boundCreativeParagraphSchema = projectAgentCreativeParagraphSubmissionV1Schema
  .omit({startWordId:true,objects:true,states:true}).extend({
    objects:z.array(boundObjectSchema).min(1).max(64),
    states:z.array(z.object({stateId:idSchema,operation:directorSceneStateV1Schema.shape.operation,targetObjectIds:directorSceneStateV1Schema.shape.targetObjectIds,purpose:directorSceneStateV1Schema.shape.purpose,anchor:creativeQuoteSelectorSchema}).strict()).min(1).max(24),
  }).strict();
export const creativeSourceCatalogSchema = z.object({
  sourceHash:hashSchema,
  units:z.array(z.object({unitIndex:z.number().int(),startWordIndex:z.number().int(),endWordIndexExclusive:z.number().int(),text:z.string()}).strict()).max(20000),
}).strict();
export const compiledCreativeOutlineSchema = z.object({
  outlineHash:hashSchema,
  paragraphs:z.array(z.object({slotIndex:z.number().int(),startWordId:idSchema,startWordIndex:z.number().int(),endWordIndexExclusive:z.number().int(),sourceText:z.string(),summary:compactTextSchema}).strict()).min(1).max(512),
}).strict();

export const projectAgentCreativePlanStageRequestV1Schema = z.discriminatedUnion("kind", [
  creativeOutlineRequestSchema,
  z.object({kind:z.literal("BOUND_PARAGRAPH"),outlineHash:hashSchema,slotIndex:z.number().int().min(0).max(511),paragraph:boundCreativeParagraphSchema}).strict(),
  z.object({
    kind: z.literal("FOUNDATION"),
    intentSummary: z.string().trim().min(1).max(1_000),
    designSystem: projectDesignSystemV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("MATERIAL_REQUIREMENT"),
    slotIndex: z.number().int().min(0).max(255),
    requirement: projectAgentMaterialRequirementSubmissionV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("PARAGRAPH"),
    slotIndex: z.number().int().min(0).max(511),
    paragraph: projectAgentCompilableCreativePlanParagraphV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("WHOLE_FILM_REVIEW"),
    expectedReviewBasisHash: hashSchema,
    wholeFilmReview: projectAgentCreativePlanWholeFilmReviewV1Schema,
  }).strict(),
  projectAgentCreativePlanDeleteSlotV1Schema,
]);

export type ProjectAgentCreativePlanStageRequestV1 = z.infer<typeof projectAgentCreativePlanStageRequestV1Schema>;

export const projectAgentCreativePlanStageResultV1Schema = z.object({
  outline: compiledCreativeOutlineSchema.nullable().optional(),
  outlineParagraphCount:z.number().int().nonnegative().optional(),
  nextOutlineCursor:z.number().int().nonnegative().nullable().optional(),
  acceptedParagraphSlots:z.array(z.number().int()).optional(),
  draftHash: hashSchema,
  reviewBasisHash: hashSchema,
  foundationStaged: z.boolean(),
  wholeFilmReviewStaged: z.boolean(),
  materialRequirementCount: z.number().int().min(0).max(256),
  paragraphCount: z.number().int().min(0).max(512),
  timelineModified: z.literal(false),
}).strict();

export type ProjectAgentCreativePlanStageResultV1 = z.infer<typeof projectAgentCreativePlanStageResultV1Schema>;

/**
 * Bounded, host-derived facts for a Creative Plan revision.  This capsule
 * exposes the already-preloaded slot topology and explicit material responses
 * without choosing any replacement visual, layout, wording, or motion for the
 * Project Agent.
 */
export const projectAgentCreativePlanRevisionDraftV1Schema = z.object({
  preloaded: z.literal(true),
  currentPlanStatus: z.enum(["CURRENT", "NEEDS_MATERIAL_RESPONSE", "NEEDS_REVISION", "STALE"]),
  foundationStaged: z.literal(true),
  wholeFilmReviewStaged: z.literal(true),
  wholeFilmReviewSemanticallyVerifiedByHost: z.literal(false),
  reviewBasisHash: hashSchema,
  reviewBasisMeaning: z.literal("STRUCTURAL_BINDING_ONLY"),
  hostCreativeDecisionMade: z.literal(false),
  affectedParagraphSlotsAreCreativeAllowlist: z.literal(false),
  materialRequirementCount: z.number().int().min(0).max(256),
  paragraphCount: z.number().int().min(1).max(512),
  materialRequirementSlots: z.array(z.object({
    slotIndex: z.number().int().min(0).max(255),
    requirementId: idSchema,
    kind: z.enum(["PERSON_VIDEO", "SCREEN_RECORDING", "B_ROLL_VIDEO", "IMAGE", "DOCUMENT", "DATA"]),
    paragraphStartWordIds: z.array(idSchema).min(1).max(512),
    responseDecision: z.enum(["UNANSWERED", "WILL_PROVIDE", "PROVIDED", "CANNOT_PROVIDE"]),
  }).strict()).max(256),
  affectedParagraphSlots: z.array(z.object({
    slotIndex: z.number().int().min(0).max(511),
    startWordId: idSchema,
    reasonCodes: z.array(z.enum(["MATERIAL_CANNOT_PROVIDE", "CREATIVE_COMPATIBILITY_INVALID"])).min(1).max(2),
  }).strict()).max(512),
}).strict().superRefine((draft, context) => {
  if (draft.materialRequirementSlots.length !== draft.materialRequirementCount) {
    context.addIssue({
      code: "custom",
      path: ["materialRequirementSlots"],
      message: "revision material slot count must match the preloaded draft count",
    });
  }
  for (let slotIndex = 0; slotIndex < draft.materialRequirementSlots.length; slotIndex += 1) {
    if (draft.materialRequirementSlots[slotIndex]?.slotIndex !== slotIndex) {
      context.addIssue({
        code: "custom",
        path: ["materialRequirementSlots", slotIndex, "slotIndex"],
        message: "revision material slots must be dense and ordered",
      });
    }
  }
  if (!unique(draft.materialRequirementSlots.map((slot) => slot.requirementId))) {
    context.addIssue({
      code: "custom",
      path: ["materialRequirementSlots"],
      message: "revision material requirement ids must be unique",
    });
  }
  if (!unique(draft.affectedParagraphSlots.map((slot) => String(slot.slotIndex)))) {
    context.addIssue({
      code: "custom",
      path: ["affectedParagraphSlots"],
      message: "revision affected paragraph slots must be unique",
    });
  }
});

export type ProjectAgentCreativePlanRevisionDraftV1 = z.infer<typeof projectAgentCreativePlanRevisionDraftV1Schema>;

const projectAgentCreativePlanStagedSubmitRequestV1Schema = z.object({
  expectedDraftHash: hashSchema,
  expectedMaterialRequirementCount: z.number().int().min(0).max(256),
  expectedParagraphCount: z.number().int().min(1).max(512),
}).strict();

const projectAgentCreativePlanAtomicSubmitRequestV1Schema = z.object({
  mode: z.literal("ATOMIC"),
  contextPackHash: hashSchema,
  plan: projectAgentCreativePlanPayloadV1Schema,
}).strict();

/**
 * Legacy atomic submissions remain readable. New Creative Plan turns bind an
 * outline before staging independently validated paragraph designs; only the
 * complete assembled plan reaches the project transaction.
 */
export const projectAgentCreativePlanSubmitRequestV1Schema = z.union([
  projectAgentCreativePlanAtomicSubmitRequestV1Schema,
  projectAgentCreativePlanStagedSubmitRequestV1Schema,
]);

export type ProjectAgentCreativePlanSubmitRequestV1 = z.infer<typeof projectAgentCreativePlanSubmitRequestV1Schema>;

export const projectAgentSceneImplementationPlanPayloadV1Schema = z.object({
  paragraphs: submitSceneImplementationPlanV1RequestSchema.shape.paragraphs,
}).strict().superRefine((payload, context) => {
  if (!unique(payload.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "scene paragraph ids must be unique" });
  }
});

export type ProjectAgentSceneImplementationPlanPayloadV1 = z.infer<typeof projectAgentSceneImplementationPlanPayloadV1Schema>;

export const projectAgentSceneImplementationStageRequestV1Schema = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("BOUND_PUT"),slotIndex:z.number().int().min(0).max(511),
    sourceSelections:z.array(z.object({name:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),selection:creativeQuoteSelectorSchema}).strict()).max(256),
    paragraph:sceneImplementationParagraphSubmissionV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("PUT"),
    slotIndex: z.number().int().min(0).max(511),
    paragraph: sceneImplementationParagraphSubmissionV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("DELETE"),
    slotIndex: z.number().int().min(0).max(511),
  }).strict(),
]);

export type ProjectAgentSceneImplementationStageRequestV1 = z.infer<typeof projectAgentSceneImplementationStageRequestV1Schema>;

export const projectAgentSceneImplementationStageResultV1Schema = z.object({
  draftHash: hashSchema,
  paragraphCount: z.number().int().min(0).max(512),
  timelineModified: z.literal(false),
}).strict();

export type ProjectAgentSceneImplementationStageResultV1 = z.infer<typeof projectAgentSceneImplementationStageResultV1Schema>;

const projectAgentSceneImplementationStagedSubmitRequestV1Schema = z.object({
  expectedDraftHash: hashSchema,
  expectedParagraphCount: z.number().int().min(1).max(512),
}).strict();

const projectAgentSceneImplementationAtomicSubmitRequestV1Schema = z.object({
  mode: z.literal("ATOMIC"),
  contextPackHash: hashSchema,
  plan: projectAgentSceneImplementationPlanPayloadV1Schema,
}).strict();

export const projectAgentSceneImplementationSubmitRequestV1Schema = z.union([
  projectAgentSceneImplementationAtomicSubmitRequestV1Schema,
  projectAgentSceneImplementationStagedSubmitRequestV1Schema,
]);

export type ProjectAgentSceneImplementationSubmitRequestV1 = z.infer<typeof projectAgentSceneImplementationSubmitRequestV1Schema>;

export const projectAgentRoughCutPayloadV1Schema = z.object({
  executionMode: z.enum(["REVIEW", "AI_DRAFT"]).default("REVIEW"),
}).strict();
export type ProjectAgentRoughCutPayloadV1 = z.infer<typeof projectAgentRoughCutPayloadV1Schema>;

export const projectAgentTurnToolCallV1Schema = z.object({
  sequence: z.number().int().positive(),
  callId: idSchema,
  name: z.string().trim().min(1).max(128),
  actor: z.enum(["MODEL", "HOST"]),
  state: z.enum(["SUCCEEDED", "REJECTED", "FAILED"]),
  argumentHash: hashSchema,
  resultSummary: z.string().trim().min(1).max(2_000),
  createdAt: isoInstantSchema,
}).strict();

export const projectAgentTurnErrorV1Schema = z.object({
  code: z.string().trim().min(1).max(128).regex(/^[A-Z0-9_]+$/u),
  message: z.string().trim().min(1).max(2_000),
}).strict();

export const projectAgentTurnV1Schema = z.object({
  schemaVersion: z.literal(1),
  turnId: idSchema,
  jobId: idSchema,
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  kind: projectAgentTurnKindV1Schema,
  intent: projectAgentTurnIntentV1Schema,
  state: projectAgentTurnStateV1Schema,
  userText: z.string().trim().min(1).max(8_000),
  /** The immutable host snapshot captured when this turn was submitted. */
  roughCutContext: dshRoughCutSelectionContextSchema,
  /** True only for migrated history that never had an exact host snapshot. */
  roughCutContextLegacy: z.literal(true).optional(),
  expectedRevision: z.number().int().nonnegative(),
  expectedTimelineHash: hashSchema,
  expectedContextIdentity: hashSchema,
  transcriptReadComplete: z.boolean(),
  designReadComplete: z.boolean(),
  capabilityReadComplete: z.boolean(),
  directorCapabilityReadComplete: z.boolean(),
  /** U1 execution telemetry; absent only on turns persisted by older builds. */
  executionPhase: projectAgentExecutionPhaseV1Schema.optional(),
  /** Optional Scene execution scope; absent on legacy and non-Scene turns. */
  sceneScope: projectAgentSceneScopeV1Schema.optional(),
  contextPackHash: hashSchema.nullable().optional(),
  validationAttemptCount: z.number().int().min(0).max(2).optional(),
  repairAttempted: z.boolean().optional(),
  terminalSubmissionCount: z.number().int().min(0).max(1),
  sceneReview: z.object({stopReason:z.string().max(80),revisionCount:z.number().int().min(0).max(3),visualMode:z.enum(["none","image"]),records:z.array(z.object({revision:z.number().int(),programHash:hashSchema,technical:z.string().max(24),visual:z.string().max(24),issueCount:z.number().int().nonnegative(),blockerCount:z.number().int().nonnegative().optional(),issueMessages:z.array(z.string().max(1200)).max(64).optional()}).strict()).max(4)}).strict().optional(),
  assistantText: z.string().max(8_000).nullable(),
  error: projectAgentTurnErrorV1Schema.nullable(),
  toolCalls: z.array(projectAgentTurnToolCallV1Schema).max(512),
  /** Legacy rough-cut lineage, populated only for the host-delegated entry turn. */
  delegatedDshTurnId: idSchema.nullable(),
  delegatedDshJobId: idSchema.nullable(),
  dshSessionId: idSchema.nullable(),
  dshPid: z.number().int().positive().nullable(),
  submittedAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
  completedAt: isoInstantSchema.nullable(),
}).strict().superRefine((turn, context) => {
  if (turn.terminalSubmissionCount > 0 && turn.state === "READ_ONLY_COMPLETED") {
    context.addIssue({ code: "custom", path: ["state"], message: "a submitted turn cannot be read-only completed" });
  }
  if (turn.completedAt === null && ["COMPLETED", "READ_ONLY_COMPLETED", "NEEDS_ATTENTION", "AWAITING_REVIEW", "CANCELLED", "FAILED", "INTERRUPTED"].includes(turn.state)) {
    context.addIssue({ code: "custom", path: ["completedAt"], message: "terminal turns require completedAt" });
  }
  if (turn.completedAt !== null && turn.state === "RUNNING") {
    context.addIssue({ code: "custom", path: ["completedAt"], message: "running turns cannot have completedAt" });
  }
  if (!unique(turn.toolCalls.map((call) => call.callId))) {
    context.addIssue({ code: "custom", path: ["toolCalls"], message: "tool call ids must be unique" });
  }
});

export type ProjectAgentTurnV1 = z.infer<typeof projectAgentTurnV1Schema>;

export const projectAgentTurnPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  turns: z.array(projectAgentTurnV1Schema).max(64),
}).strict().superRefine((state, context) => {
  if (!unique(state.turns.map((turn) => turn.turnId)) || !unique(state.turns.map((turn) => turn.jobId))) {
    context.addIssue({ code: "custom", path: ["turns"], message: "turn identities must be unique" });
  }
  if (state.turns.some((turn) => turn.projectAgentId !== state.projectAgentId
    || turn.projectId !== state.projectId || turn.timelineId !== state.timelineId)) {
    context.addIssue({ code: "custom", path: ["turns"], message: "turn state cannot cross project identity" });
  }
});

export type ProjectAgentTurnPersistentStateV1 = z.infer<typeof projectAgentTurnPersistentStateV1Schema>;

export const projectAgentTranscriptWordV1Schema = z.object({
  index: z.number().int().nonnegative(),
  wordId: idSchema,
  text: z.string().max(1_000),
  assetId: idSchema,
}).strict();

export const projectAgentTranscriptBoundaryV1Schema = z.object({
  paragraphId: idSchema,
  order: z.number().int().nonnegative().max(511),
  startWordId: idSchema,
  endWordId: idSchema,
  includedWordIds: z.array(idSchema).min(1).max(20_000),
}).strict();

export const projectAgentTranscriptPageV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  cursor: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative().nullable(),
  wordCount: z.number().int().nonnegative(),
  words: z.array(projectAgentTranscriptWordV1Schema).max(256),
  paragraphBoundaries: z.array(projectAgentTranscriptBoundaryV1Schema).max(512),
  timelineModified: z.literal(false),
}).strict().superRefine((page, context) => {
  if (page.nextCursor !== null && page.nextCursor <= page.cursor) {
    context.addIssue({ code: "custom", path: ["nextCursor"], message: "nextCursor must advance" });
  }
});

export type ProjectAgentTranscriptPageV1 = z.infer<typeof projectAgentTranscriptPageV1Schema>;

export const projectAgentLayoutObjectV1Schema = z.object({
  visualObjectId: idSchema,
  role: z.enum(["MAIN", "SUPPORT", "INTERNAL"]),
  objectClass: directorObjectClassV1Schema,
  kind: directorVisualObjectKindV1Schema,
  informationDuty: compactTextSchema,
  textRole: directorTextRoleV1Schema,
  text: z.string().max(2_000).nullable(),
  resolvedSource: layoutCutResolvedSourceV1Schema,
  packagingMode: directorPackagingModeV1Schema,
  childObjectIds: z.array(idSchema).max(32),
  layoutSlotId: layoutSlotIdV1Schema.nullable(),
  frame: layoutCutRectV1Schema,
  crop: layoutCutRectV1Schema,
  zIndex: z.number().int().min(0).max(999),
  alignment: z.enum(["FILL", "CENTER", "TOP", "BOTTOM", "LEFT", "RIGHT"]),
  personTreatment: z.enum(["NONE", "FULL_FRAME", "RECTANGULAR_PIP", "CIRCULAR_PIP"]),
  readingOrder: z.number().int().nonnegative().max(63),
  manuallyEdited: z.boolean(),
}).strict();

export const projectAgentLayoutStateV1Schema = z.object({
  anchorWordId: idSchema,
  anchorFrame: z.number().int().nonnegative(),
  operation: directorSceneOperationV1Schema,
  targetObjectIds: z.array(idSchema).min(1).max(32),
  purpose: compactTextSchema,
}).strict();

export const projectAgentLayoutParagraphV1Schema = z.object({
  paragraphHash: hashSchema,
  frameRange: frameRangeSchema,
  selectedVariantId: layoutVariantIdV1Schema,
  selectedFamilyId: layoutFamilyIdV1Schema,
  variantLabel: z.string().trim().min(1).max(100),
  layoutIntent: compactTextSchema,
  hierarchyRationale: compactTextSchema,
  safeRegion: layoutCutRectV1Schema,
  captionExclusionRegion: layoutCutRectV1Schema,
  readingOrderObjectIds: z.array(idSchema).min(1).max(64),
  objects: z.array(projectAgentLayoutObjectV1Schema).min(2).max(64),
  states: z.array(projectAgentLayoutStateV1Schema).min(1).max(24),
}).strict();

export const projectAgentDesignParagraphV1Schema = z.object({
  paragraphId: idSchema,
  order: z.number().int().nonnegative().max(511),
  transcriptText: z.string().min(1).max(100_000),
  startWordId: idSchema,
  endWordId: idSchema,
  mainVisual: z.object({
    visualObjectId: idSchema,
    kind: directorVisualObjectKindV1Schema,
  }).strict(),
  supportingVisuals: z.array(z.object({
    visualObjectId: idSchema,
    kind: directorVisualObjectKindV1Schema,
  }).strict()).min(1).max(2),
  creativeParagraph: projectAgentCreativePlanParagraphV1Schema.nullable(),
  layoutParagraph: projectAgentLayoutParagraphV1Schema.nullable(),
}).strict();

export const projectAgentDesignPageV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  cursor: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative().nullable(),
  creativePlanId: idSchema.nullable(),
  creativePlanHash: hashSchema.nullable(),
  paragraphCount: z.number().int().nonnegative().max(512),
  materialRequirementCount: z.number().int().nonnegative().max(256),
  intentSummary: compactTextSchema.nullable(),
  designSystem: projectDesignSystemV1Schema.nullable(),
  materialRequirements: z.array(projectAgentMaterialRequirementSubmissionV1Schema).max(256),
  wholeFilmReview: projectAgentCreativePlanWholeFilmReviewV1Schema.nullable(),
  mainVisualKindCounts: z.array(projectAgentMainVisualKindCountV1Schema).max(19),
  continuity: directorCreativePlanContinuityV1Schema.nullable(),
  layoutCutId: idSchema.nullable(),
  layoutCutHash: hashSchema.nullable(),
  paragraphs: z.array(projectAgentDesignParagraphV1Schema).max(16),
  timelineModified: z.literal(false),
}).strict();

export type ProjectAgentDesignPageV1 = z.infer<typeof projectAgentDesignPageV1Schema>;

export const projectAgentCapabilityPageV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  cursor: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative().nullable(),
  patternCount: z.number().int().nonnegative(),
  componentCount: z.number().int().nonnegative(),
  patterns: z.array(z.unknown()).max(16),
  components: z.array(z.unknown()).max(16),
  productionRegistryEntryCount: z.number().int().nonnegative(),
  timelineModified: z.literal(false),
}).strict();

export type ProjectAgentCapabilityPageV1 = z.infer<typeof projectAgentCapabilityPageV1Schema>;

const projectAgentHashIdentityV1Schema = z.object({
  id: idSchema,
  hash: hashSchema,
}).strict();

const projectAgentPreviewIdentityV1Schema = z.object({
  previewVersionId: idSchema,
  previewVersionHash: hashSchema,
  kind: z.enum(["ROUGH_CUT", "LAYOUT_CUT", "PACKAGED_CUT"]),
  status: z.enum(["READY", "STALE"]),
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  payloadHash: hashSchema,
}).strict();

const projectAgentConfirmationIdentityV1Schema = z.object({
  confirmationId: idSchema,
  previewVersionId: idSchema,
  previewVersionHash: hashSchema,
  kind: z.enum(["ROUGH_CUT", "LAYOUT_CUT", "PACKAGED_CUT"]),
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  status: z.enum(["CONFIRMED", "STALE"]),
}).strict();

/**
 * Safe, bounded state exposed through project_agent_get_state.  The complete
 * Director/Layout/Scene/Packaged snapshots remain host-internal; paged tools
 * are the only model route to paragraph/design/capability details.
 */
export const projectAgentSafeStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  contextIdentity: hashSchema,
  context: z.object({
    identity: projectAgentContextSnapshotV1Schema.shape.identity,
    hostIdentity: projectAgentContextSnapshotV1Schema.shape.hostIdentity,
    productConstitution: projectAgentContextSnapshotV1Schema.shape.productConstitution,
    projectConstitution: projectAgentContextSnapshotV1Schema.shape.projectConstitution,
    decisionCount: z.number().int().nonnegative(),
    omittedDecisionCount: z.number().int().nonnegative(),
    decisionLedger: z.array(projectAgentDecisionLedgerEntryV1Schema).max(256),
  }).strict(),
  directorCapability: z.object({
    catalog: projectAgentHashIdentityV1Schema,
    version: z.literal(1),
    sectionCount: z.number().int().positive(),
    hostRankingForbidden: z.literal(true),
    readRequiredForCreativePlan: z.literal(true),
  }).strict(),
  director: z.object({
    readiness: projectDirectorSnapshotV1Schema.shape.readiness,
    foundation: z.object({
      revision: z.number().int().nonnegative(),
      timelineHash: hashSchema,
      foundationHash: hashSchema,
      roughCutFoundationHash: hashSchema.nullable(),
      masterTranscriptHash: hashSchema.nullable(),
      timeMapHash: hashSchema.nullable(),
      projectionHash: hashSchema,
      visualParagraphProposalId: idSchema.nullable(),
      visualParagraphProposalHash: hashSchema.nullable(),
      assetCount: z.number().int().nonnegative(),
    }).strict(),
    currentPlan: z.object({
      plan: projectAgentHashIdentityV1Schema,
      status: z.enum(["CURRENT", "NEEDS_MATERIAL_RESPONSE", "NEEDS_REVISION", "STALE"]),
      foundation: z.object({
        revision: z.number().int().nonnegative(),
        timelineHash: hashSchema,
        foundationHash: hashSchema,
        roughCutFoundationHash: hashSchema,
        masterTranscriptHash: hashSchema,
        timeMapHash: hashSchema,
        projectionHash: hashSchema,
        visualParagraphProposalId: idSchema,
        visualParagraphProposalHash: hashSchema,
        boundarySetId: idSchema.optional(),
        boundarySetHash: hashSchema.optional(),
      }).strict(),
      intentSummary: z.string().min(1).max(4_000),
      designSystem: projectDesignSystemV1Schema,
      materialRequirementCount: z.number().int().nonnegative(),
      pendingMaterialRequirementIds: z.array(idSchema).max(256),
      diagnosticCodes: z.array(z.string().min(1).max(128)).max(32),
      continuity: directorCreativePlanContinuityV1Schema.nullable(),
    }).strict().nullable(),
    previews: z.array(projectAgentPreviewIdentityV1Schema).max(24),
    confirmations: z.array(projectAgentConfirmationIdentityV1Schema).max(48),
  }).strict(),
  creativePlanRevisionDraft: projectAgentCreativePlanRevisionDraftV1Schema.nullable(),
  layout: z.object({
    readiness: layoutCutSnapshotV1Schema.shape.readiness,
    layoutCut: z.object({
      layoutCut: projectAgentHashIdentityV1Schema,
      revision: z.number().int().nonnegative(),
      timelineHash: hashSchema,
      creativePlanId: idSchema,
      creativePlanHash: hashSchema,
      paragraphCount: z.number().int().nonnegative(),
    }).strict().nullable(),
    preview: projectAgentPreviewIdentityV1Schema.nullable(),
  }).strict(),
  sceneProgram: z.object({
    readiness: sceneProgramSnapshotV1Schema.shape.readiness,
    implementationPlan: z.object({
      plan: projectAgentHashIdentityV1Schema,
      revision: z.number().int().nonnegative(),
      timelineHash: hashSchema,
      creativePlanId: idSchema,
      creativePlanHash: hashSchema,
      layoutCutId: idSchema,
      layoutCutHash: hashSchema,
      paragraphCount: z.number().int().nonnegative(),
    }).strict().nullable(),
    sceneProgram: z.object({
      program: projectAgentHashIdentityV1Schema,
      revision: z.number().int().nonnegative(),
      timelineHash: hashSchema,
      creativePlanId: idSchema,
      creativePlanHash: hashSchema,
      paragraphCount: z.number().int().nonnegative(),
      baseProgramHash: hashSchema.nullable(),
      editRevision: z.number().int().nonnegative(),
      userEditHash: hashSchema.nullable(),
      speechScenes: z.array(z.object({paragraphId:idSchema,motion:compiledSceneMotionSchema,modules:z.array(sceneModuleDraftSchema).max(8).optional(),effectiveModules:z.array(sceneModuleManifestSchema).max(8).optional()}).strict()).max(512).optional(),
      userComponentInstances: z.array(z.object({paragraphId: idSchema, instance: sceneComponentInstanceV1Schema}).strict()).max(4096).optional(),
      userLockedObjects: z.array(z.object({
        paragraphId: idSchema,
        visualObjectId: idSchema,
        locks: z.array(z.enum(["TEXT", "FRAME", "CROP", "STYLE", "TIMING", "LAYER", "COMPONENT", "MOTION"])).min(1).max(8),
        // Optional only for reading context packs persisted by older versions.
        effectiveValues: z.object({
          text: sceneProgramObjectV1Schema.shape.text,
          frame: sceneProgramObjectV1Schema.shape.frame,
          crop: sceneProgramObjectV1Schema.shape.crop,
          style: sceneProgramObjectV1Schema.shape.style,
          activeFrameRange: sceneProgramObjectV1Schema.shape.activeFrameRange,
          zIndex: sceneProgramObjectV1Schema.shape.zIndex,
          binding: sceneProgramObjectV1Schema.shape.binding,
        }).strict().optional(),
      }).strict()).max(4_096),
    }).strict().nullable(),
    editing: z.object({
      baseProgramHash: hashSchema.nullable(),
      editRevision: z.number().int().nonnegative(),
      canUndo: z.boolean(),
      canRedo: z.boolean(),
      ignoredWarningIds: z.array(idSchema).max(1_024),
      diagnostics: z.array(sceneProgramLintDiagnosticV1Schema).max(512),
    }).strict(),
  }).strict(),
  capabilities: z.object({
    catalog: projectAgentHashIdentityV1Schema,
    version: z.literal(1),
    patternCount: z.number().int().nonnegative(),
    componentCount: z.number().int().nonnegative(),
    productionRegistryEntryCount: z.literal(0),
    hostRankingForbidden: z.literal(true),
    agentSelectionRequired: z.literal(true),
  }).strict(),
  packagedCut: z.object({
    readiness: packagedCutSnapshotV1Schema.shape.readiness,
    packagedCut: z.object({
      packagedCut: projectAgentHashIdentityV1Schema,
      revision: z.number().int().nonnegative(),
      timelineHash: hashSchema,
      creativePlanId: idSchema,
      creativePlanHash: hashSchema,
      layoutCutId: idSchema,
      layoutCutHash: hashSchema,
      sceneProgramId: idSchema,
      sceneProgramHash: hashSchema,
      durationFrames: z.number().int().positive(),
    }).strict().nullable(),
    preview: projectAgentPreviewIdentityV1Schema.nullable(),
    previewConfirmed: z.boolean(),
  }).strict(),
  assets: z.array(z.unknown()).max(2_048),
  allowedTerminalActions: z.array(projectAgentTerminalActionV1Schema).max(2),
  timelineModified: z.literal(false),
}).strict();

export type ProjectAgentSafeStateV1 = z.infer<typeof projectAgentSafeStateV1Schema>;

const projectAgentDirectorCapabilityCaseV1Schema = z.object({
  caseId: idSchema,
  evidencePattern: compactTextSchema,
  decisionLesson: compactTextSchema,
  hostChecks: z.array(compactTextSchema).min(1).max(8),
}).strict();

const projectAgentDirectorCapabilitySectionV1Schema = z.object({
  sectionId: idSchema,
  title: compactTextSchema,
  purpose: compactTextSchema,
  rules: z.array(compactTextSchema).min(1).max(64),
  closedVocabulary: z.array(compactTextSchema).max(64),
  cases: z.array(projectAgentDirectorCapabilityCaseV1Schema).max(8),
}).strict();

const projectAgentDirectorCapabilityCatalogSemanticV1Schema = z.object({
  schemaVersion: z.literal(1),
  catalogId: idSchema,
  version: z.literal(1),
  hostRankingForbidden: z.literal(true),
  sections: z.array(projectAgentDirectorCapabilitySectionV1Schema).min(1).max(16),
}).strict().superRefine((catalog, context) => {
  if (!unique(catalog.sections.map((section) => section.sectionId))) {
    context.addIssue({ code: "custom", path: ["sections"], message: "director capability section ids must be unique" });
  }
});

export const projectAgentDirectorCapabilityCatalogV1Schema = projectAgentDirectorCapabilityCatalogSemanticV1Schema.extend({
  catalogHash: hashSchema,
}).strict().superRefine((catalog, context) => {
  const { catalogHash: _catalogHash, ...semantic } = catalog;
  if (catalog.catalogHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["catalogHash"], message: "director capability catalog hash must match canonical content" });
  }
});

const directorRelationLayoutRules = SCENE_DIRECTION_CATALOG_V1.informationRelations.map((relation) =>
  `${relation.relationId} accepts layout families: ${relation.compatibleLayoutFamilyIds.join(", ")}.`);
const directorVariantFamilyRules = LAYOUT_CATALOG_V1.variants.map((variant) =>
  `${variant.variantId} belongs to ${variant.familyId}; MAIN=${variant.allowedMainKinds.join("|")}; SUPPORT=${variant.allowedSupportingKinds.join("|")}; supportCount=${variant.supportCount.minimum}-${variant.supportCount.maximum}.`);
const directorLayoutVocabulary = [...new Set(LAYOUT_CATALOG_V1.variants.flatMap((variant) => [
  variant.variantId,
  variant.familyId,
]))];

const directorCapabilityCatalogSemantic = {
  schemaVersion: 1 as const,
  catalogId: "catalog:codex-cut-project-agent-director:v1",
  version: 1 as const,
  hostRankingForbidden: true as const,
  sections: [
    {
      sectionId: "METHOD_6_STEP",
      title: "六步内部方法与边界",
      purpose: "Creative Plan 是一个 whole-film atomic step 2-5 输出；Scene implementation 是确认 Layout 后的 step 6 输出。",
      rules: [
        "Step 1 只由宿主准备并确认 Rough Cut foundation；模型不得确认、Apply 或改写 Timeline。",
        "Step 2 先从当前 Master Transcript 建立完整段落边界，再定义每段唯一主信息关系。",
        "Step 3 为每段选择一个 MAIN，使其独立承担主要信息；MAIN 不是恰好出现在 A-roll 的素材。",
        "Step 4 按表达需要为每段选择 0-2 个 SUPPORT，补充、强调或装饰 MAIN，不制造第二主信息。",
        "Step 5 先选关系、构图、包装目标与动效理由，再把它们表达为语义对象；所有 constructed information 必须有证据。",
        "Step 6 只能在 Layout 已由宿主确认后提交 SceneImplementationPlan；组件目录是实现材料，不是创意计划。",
        "完整方案提交前复查整片节奏、信息覆盖、连续性、主次层级、素材风险与跨段偷懒；诊断只提供 advisory signal。",
      ],
      closedVocabulary: ["ROUGH_CUT", "CREATIVE_PLAN", "SCENE_IMPLEMENTATION", "MAIN", "SUPPORT", "HOST_CONFIRMATION"],
      cases: [],
    },
    {
      sectionId: "SEMANTIC_ROLES_AND_TASKS",
      title: "MAIN/SUPPORT 与粗粒度表达任务",
      purpose: "先判断信息职责和表达任务，再选择对象、关系、构图与包装。",
      rules: [
        "MAIN 是理想观众在本段完成主要理解所依赖的唯一主载体；它可以是人物、录屏、证据媒体或结构化解释，但必须能独立承担任务。",
        "SUPPORT 只能补充、强调或装饰 MAIN；不需要辅助信息时允许 0 个 SUPPORT，使用单主视觉布局，每个 SUPPORT 都要有独立且段落内可解释的职责。",
        "人物、屏幕录制和真实 footage 保持 clean/presentation-only；不可把真实内容当作可任意变形的包装对象。",
        "粗粒度任务先从现有 DIRECTOR_EXPRESSION_TASKS 闭合集合判断，再决定对象和关系；不能自行发明任务枚举。",
        "如果段内出现两个不可合并的主任务或 MAIN 发生真实切换，应报告结构问题并让宿主重新划分边界，不用支持对象掩盖。",
      ],
      closedVocabulary: [...DIRECTOR_EXPRESSION_TASKS, "MAIN", "SUPPORT"],
      cases: [],
    },
    {
      sectionId: "OBJECT_AND_TEXT_CLASSES",
      title: "四类对象与文字职责",
      purpose: "让信息对象有清晰类别；对象类别决定其可用的包装权限。",
      rules: [
        "四类对象是 REAL_CONTENT、CONSTRUCTED_INFORMATION、GUIDANCE_EMPHASIS、DECORATION。",
        "REAL_CONTENT 表示人物、录屏、实拍和已有证据；只允许 NONE 或 PRESENTATION_ONLY，不能承受内容改变型包装。",
        "CONSTRUCTED_INFORMATION 必须说明 evidenceWordIds 或其他宿主可核验的证据，并使用 DESIGN_REQUIRED；不能把无证据的装饰伪装成信息。",
        "GUIDANCE_EMPHASIS 只指向阅读引导或注意力强调，使用 GUIDANCE；DECORATION 只提供轻量装饰，使用 DECORATIVE。",
        "文字职责使用现有 DIRECTOR_TEXT_ROLES；NONE 不应携带文字，其他文字必须保留完整语义，不因容量猜测而静默缩写。",
      ],
      closedVocabulary: [...DIRECTOR_OBJECT_CLASSES, ...DIRECTOR_TEXT_ROLES],
      cases: [],
    },
    {
      sectionId: "INFORMATION_RELATIONS",
      title: "八种信息关系",
      purpose: "关系是创意计划的首要判断；它先于组件、模板与渲染实现。",
      rules: [
        "每段使用 exactly one relation：现有 DIRECTOR_INFORMATION_RELATIONS 中的一个，不得让模型自行扩展关系枚举。",
        "SINGLE_CLAIM 建立单一观点；DEFINITION_BREAKDOWN 拆解定义；PARALLEL_GROUPING 并列归类；SEQUENCE_PROCESS 表达有顺序的步骤。",
        "COMPARISON_CHANGE 表达对比变化；DATA_PROOF 表达数据证明；TIME_POSITION 表达时间定位；PROBLEM_SOLUTION_VERIFICATION 形成问题—方案—验证闭环。",
        "不要让布局或组件反过来决定关系；如果文字证据不足以区分关系，降低 confidence 并在 wholeFilmReview 标出风险。",
      ],
      closedVocabulary: [...DIRECTOR_INFORMATION_RELATIONS],
      cases: [],
    },
    {
      sectionId: "PACKAGING_AND_MATERIAL_POLICY",
      title: "包装、动效与理想素材",
      purpose: "先确定语义关系和包装理由，再请求理想素材；缺失素材只能在用户响应后由宿主处理。",
      rules: [
        "先写 ideal material request：描述理想素材、用途、对主信息的必要性与证据；不要因为当前素材容易得到就把它选作 MAIN。",
        "实时人物、录屏、实拍和已有证据素材保持 presentation-only；若要动画，创建独立的 constructed/guidance container，由容器承接包装。",
        "每个 packagingTarget 必须指向 constructed/guidance/decorative 对象且与其 packagingMode 一致；REAL_CONTENT 或 NONE 对象不能成为包装目标。",
        "组件、模板、renderer、Registry/Resolver 和像素 geometry 只能在 Scene implementation/host compiler 阶段出现；模型提交语义，不提交 frames、ranges 或 transaction。",
        "缺少理想素材时保留理想结构并提出 requirement；只有用户明确响应之后，宿主才能展示可审阅的 fallback，禁止静默降级或删对象。",
      ],
      closedVocabulary: [...DIRECTOR_PACKAGING_MODES, ...DIRECTOR_MOTION_REASONS, "IDEAL_MATERIAL", "FALLBACK_AFTER_RESPONSE"],
      cases: [],
    },
    {
      sectionId: "WHOLE_FILM_SELF_AUDIT",
      title: "整片自审与诊断边界",
      purpose: "防止模型只为每段填表；整片审查只产生可解释的 advisory diagnostics。",
      rules: [
        "逐段检查：主信息是否唯一、MAIN 是否独立承载、SUPPORT 是否从属、证据是否覆盖、构图是否表达关系、包装是否有理由；每段必须写 risks，无风险时提交空数组。",
        "整片检查：节奏和连续性之外，必须逐项检查是否错过录屏/流程/对比/数据/证据机会、布局是否重复、素材需求是否完整、是否过度或不足包装。",
        "opportunityAudit/layoutAudit/materialAudit/restraintAudit 是 AI 自审结论；宿主只校验其 paragraphId/requirementId 引用是否存在，不代替 AI 下美学结论。",
        "ALL_MAIN_VISUALS_PERSON、重复 MAIN、重复关系和低置信度都是 advisory diagnostics；不能自动重写、硬拒绝或强制多样化。",
        "不要用 diagnostics 证明已经看过 AI preview；模型没有视觉预览权限，必须依据 host transcript、资产 metadata 与语义证据。",
        "成功提交后停止，不继续调用工具或偷偷编译 Layout/Packaged Cut；确认与编译永远由宿主卡片触发。",
      ],
      closedVocabulary: ["ADVISORY", "ALL_MAIN_VISUALS_PERSON", "REPEATED_MAIN_VISUAL_KIND", "REPEATED_INFORMATION_RELATION", "LOW_CONFIDENCE_PARAGRAPH", "NO_AI_PREVIEW"],
      cases: [],
    },
    {
      sectionId: "OBJECT_LAYOUT_COMPATIBILITY",
      title: "Objective object and layout compatibility",
      purpose: "Keep creative choice with the Project Agent while preventing plans that the host cannot compile.",
      rules: [
        "CALLOUT, HIGHLIGHT, CONNECTOR_SET, and BACKGROUND_SCAFFOLD are annotation, attention, connection, or scaffold primitives. They may support or live inside an information object, but they can never be MAIN.",
        "An objectClass label never overrides object-kind semantics. Do not relabel a scaffold primitive as CONSTRUCTED_INFORMATION to make it look eligible for MAIN.",
        "Choose the information relation first, then choose a layout variant whose family is explicitly compatible with that relation. The host will reject an incompatible pair instead of silently choosing for the Agent.",
        "The selected variant must accept the mapped MAIN kind, every SUPPORT kind, the exact support count, every assigned slot, and the full untruncated text.",
        ...directorRelationLayoutRules,
        ...directorVariantFamilyRules,
      ],
      closedVocabulary: [
        ...directorLayoutVocabulary,
        "CALLOUT",
        "HIGHLIGHT",
        "CONNECTOR_SET",
        "BACKGROUND_SCAFFOLD",
      ],
      cases: [],
    },
    {
      sectionId: "CASE_LIBRARY",
      title: "证据驱动案例抽象",
      purpose: "案例用于帮助模型判断，不是宿主排名器或创作决策树；每个案例都要回到当前段落证据。",
      rules: [
        "案例只说明证据模式与可迁移教训；不能把案例结论直接套到当前项目，也不能把支持素材可用性当作 MAIN 选择依据。",
        "P03/P16/P21/P23/P24 是反惰性对照：同一句表达在不同任务关系中可能需要不同 MAIN、SUPPORT 或构图。",
        "案例自审后仍需提交 current transcript 的 startWordId 与段落本地 evidenceWordIds；宿主只验证身份、范围、hash、容量与安全。",
      ],
      closedVocabulary: ["P03", "P16", "P21", "P23", "P24", "EVIDENCE_FIRST", "NO_HOST_RANKING"],
      cases: [
        {
          caseId: "P03",
          evidencePattern: "画面需要用一根时间轴统一表达‘从哪里来、何时出现、怎么移动’，节点、对象、标签和扫描线共同承担信息。",
          decisionLesson: "先判断 TIME_POSITION 或 SEQUENCE_PROCESS 关系，再设计时间轴空间结构；不要把时间信息拆成互不关联的装饰卡片。",
          hostChecks: ["时间/阶段词证据", "节点和对象的 evidenceWordIds", "主视觉是否由时间轴统一承载"],
        },
        {
          caseId: "P16",
          evidencePattern: "旧流程与新流程需要被清楚对照，画面以上下两条红/绿路径表达两条过程，文字承担流程节点和关系说明。",
          decisionLesson: "先判断 COMPARISON_CHANGE，再让两个流程保持同层级并置；不要把旧/新差异压缩成一张没有关系标签的卡片。",
          hostChecks: ["旧/新状态证据", "上下路径是否各自连续", "节点文字是否说明关系"],
        },
        {
          caseId: "P21",
          evidencePattern: "数字证明按‘测试条件 → 旧结果 → 新结果 → 倍数’逐步揭晓，数字不能脱离条件单独放大。",
          decisionLesson: "先建立 DATA_PROOF 或 PROBLEM_SOLUTION_VERIFICATION 的证据链，再按条件、旧结果、新结果、倍数安排状态；不要让孤立数字替代完整证明。",
          hostChecks: ["测试条件 evidenceWordIds", "旧/新结果是否可核验", "倍数是否依附条件与结果"],
        },
        {
          caseId: "P23",
          evidencePattern: "风险卡、QA 链和状态共同构成风险矩阵，而不是若干互不相关的卡片组件。",
          decisionLesson: "先把风险、控制、验证和状态建成 PROBLEM_SOLUTION_VERIFICATION 的结构关系；卡片只是对象，不是完整语义。",
          hostChecks: ["风险与控制 evidenceWordIds", "QA 链是否连贯", "状态是否绑定对应风险"],
        },
        {
          caseId: "P24",
          evidencePattern: "任务是观点升华时，排版文字本身成为主视觉，关键词和留白形成阅读节奏。",
          decisionLesson: "当观点和结论由文字承担时可选择 TEXT/CONSTRUCTED_INFORMATION 作为 MAIN；用关键词层级和留白组织阅读，不把文字降为装饰标签。",
          hostChecks: ["结论 evidenceWordIds", "MAIN 是否独立承担观点", "关键词层级与留白是否一致"],
        },
      ],
    },
  ],
};

export const PROJECT_AGENT_DIRECTOR_CAPABILITY_CATALOG_V1 = projectAgentDirectorCapabilityCatalogV1Schema.parse({
  ...directorCapabilityCatalogSemantic,
  catalogHash: canonicalHash(directorCapabilityCatalogSemantic),
});

export const projectAgentCompleteTranscriptV1Schema = z.object({
  transcriptHash: hashSchema,
  wordCount: z.number().int().nonnegative().max(20_000),
  words: z.array(projectAgentTranscriptWordV1Schema).max(20_000),
  paragraphBoundaries: z.array(projectAgentTranscriptBoundaryV1Schema).max(512),
}).strict().superRefine((transcript, context) => {
  if (transcript.words.length !== transcript.wordCount) {
    context.addIssue({ code: "custom", path: ["words"], message: "complete transcript word count must match words" });
  }
  if (transcript.words.some((word, index) => word.index !== index)) {
    context.addIssue({ code: "custom", path: ["words"], message: "complete transcript words must be dense and ordered" });
  }
  if (!unique(transcript.words.map((word) => word.wordId))) {
    context.addIssue({ code: "custom", path: ["words"], message: "complete transcript word ids must be unique" });
  }
});

export type ProjectAgentCompleteTranscriptV1 = z.infer<typeof projectAgentCompleteTranscriptV1Schema>;

export const projectAgentCompleteDesignV1Schema = z.object({
  creativePlanId: idSchema.nullable(),
  creativePlanHash: hashSchema.nullable(),
  paragraphCount: z.number().int().nonnegative().max(512),
  materialRequirementCount: z.number().int().nonnegative().max(256),
  intentSummary: compactTextSchema.nullable(),
  designSystem: projectDesignSystemV1Schema.nullable(),
  materialRequirements: z.array(projectAgentMaterialRequirementSubmissionV1Schema).max(256),
  wholeFilmReview: projectAgentCreativePlanWholeFilmReviewV1Schema.nullable(),
  mainVisualKindCounts: z.array(projectAgentMainVisualKindCountV1Schema).max(19),
  continuity: directorCreativePlanContinuityV1Schema.nullable(),
  layoutCutId: idSchema.nullable(),
  layoutCutHash: hashSchema.nullable(),
  paragraphs: z.array(projectAgentDesignParagraphV1Schema).max(512),
}).strict().superRefine((design, context) => {
  if (design.paragraphs.length !== design.paragraphCount) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "complete design paragraph count must match paragraphs" });
  }
  if (design.materialRequirements.length !== design.materialRequirementCount) {
    context.addIssue({ code: "custom", path: ["materialRequirements"], message: "complete design material count must match requirements" });
  }
});

export type ProjectAgentCompleteDesignV1 = z.infer<typeof projectAgentCompleteDesignV1Schema>;

export const projectAgentSceneCompatibilityCandidateV1Schema = z.object({
  componentId: idSchema,
  allowedMotionReasons: z.array(directorMotionReasonV1Schema).min(1).max(8),
}).strict();

export const projectAgentSceneObjectCompatibilityV1Schema = z.object({
  visualObjectId: idSchema,
  preserveAllowed: z.boolean(),
  componentRequired: z.boolean(),
  /** Added for module-backed semantic replacements; absent on legacy catalogs. */
  moduleReplacementAllowed: z.boolean().optional(),
  candidates: z.array(projectAgentSceneCompatibilityCandidateV1Schema).max(1024),
}).strict().superRefine((object, context) => {
  if (!unique(object.candidates.map((candidate) => candidate.componentId))) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "scene component candidates must be unique" });
  }
});

export const projectAgentSceneParagraphCompatibilityV1Schema = z.object({
  paragraphId: idSchema,
  patternIds: z.array(scenePatternIdV1Schema).max(9),
  customSceneAllowed: z.literal(true),
  objects: z.array(projectAgentSceneObjectCompatibilityV1Schema).min(1).max(64),
}).strict();

export type ProjectAgentSceneParagraphCompatibilityV1 = z.infer<typeof projectAgentSceneParagraphCompatibilityV1Schema>;

const projectAgentContextPackSemanticV1Schema = z.object({
  schemaVersion: z.literal(1),
  turnKind: projectAgentTurnKindV1Schema,
  intent: projectAgentTurnIntentV1Schema,
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  contextIdentity: hashSchema,
  safeState: projectAgentSafeStateV1Schema,
  transcript: projectAgentCompleteTranscriptV1Schema.nullable(),
  creativeSourceCatalog: creativeSourceCatalogSchema.nullable().optional(),
  sceneCheckpoint:z.object({originRequest:z.string().optional(),draftHash:hashSchema,paragraphSlots:z.array(z.number().int()),paragraphCount:z.number().int()}).strict().nullable().optional(),
  creativeCheckpoint: z.object({originRequest:z.string().optional(),outline:compiledCreativeOutlineSchema,outlineParagraphCount:z.number().int().nonnegative(),nextOutlineCursor:z.number().int().nonnegative().nullable(),parts:z.array(projectAgentCreativePlanStageRequestV1Schema).max(1024),draftHash:hashSchema,reviewBasisHash:hashSchema}).strict().nullable().optional(),
  design: projectAgentCompleteDesignV1Schema.nullable(),
  directorCapability: projectAgentDirectorCapabilityCatalogV1Schema.nullable(),
  sceneCapability: sceneCapabilityCatalogV1Schema.nullable(),
  sceneCompatibility: z.array(projectAgentSceneParagraphCompatibilityV1Schema).max(512),
  executionContract: z.object({
    modelPaginationRequired: z.boolean(),
    modelStagingAllowed: z.boolean(),
    creativeSourceBindingRequired: z.boolean().optional(),
    atomicSubmissionRequiredForExecute: z.boolean(),
    maximumValidationAttempts: z.literal(2),
    hostCreativeRankingForbidden: z.literal(true),
  }).strict(),
  timelineModified: z.literal(false),
}).strict().superRefine((pack, context) => {
  if (pack.projectAgentId !== pack.safeState.projectAgentId
    || pack.projectId !== pack.safeState.projectId
    || pack.timelineId !== pack.safeState.timelineId
    || pack.revision !== pack.safeState.revision
    || pack.timelineHash !== pack.safeState.timelineHash
    || pack.contextIdentity !== pack.safeState.contextIdentity) {
    context.addIssue({ code: "custom", path: ["safeState"], message: "context pack identity must match safe state" });
  }
  if (!pack.executionContract.modelPaginationRequired && pack.turnKind !== "ROUGH_CUT" && pack.transcript === null) {
    context.addIssue({ code: "custom", path: ["transcript"], message: "creative and scene context packs require the complete transcript" });
  }
  if (!pack.executionContract.modelPaginationRequired && pack.turnKind === "CREATIVE_PLAN" && pack.directorCapability === null) {
    context.addIssue({ code: "custom", path: ["directorCapability"], message: "Creative Plan context requires Director capability" });
  }
  if (!pack.executionContract.modelPaginationRequired && pack.turnKind === "SCENE_IMPLEMENTATION"
    && (pack.design === null || pack.sceneCapability === null || pack.sceneCompatibility.length === 0)) {
    context.addIssue({ code: "custom", path: ["sceneCompatibility"], message: "Scene implementation context requires complete design and objective compatibility" });
  }
});

export const projectAgentContextPackV1Schema = projectAgentContextPackSemanticV1Schema.safeExtend({
  contextPackHash: hashSchema,
}).strict().superRefine((pack, context) => {
  const { contextPackHash: _contextPackHash, ...semantic } = pack;
  if (pack.contextPackHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["contextPackHash"], message: "context pack hash must match canonical content" });
  }
});

export type ProjectAgentContextPackV1 = z.infer<typeof projectAgentContextPackV1Schema>;

export function createProjectAgentContextPackV1(
  semantic: z.input<typeof projectAgentContextPackSemanticV1Schema>,
): ProjectAgentContextPackV1 {
  const parsed = projectAgentContextPackSemanticV1Schema.parse(semantic);
  return projectAgentContextPackV1Schema.parse({
    ...parsed,
    contextPackHash: canonicalHash(parsed),
  });
}

export const projectAgentDirectorCapabilityPageRequestV1Schema = z.object({
  cursor: z.number().int().nonnegative().max(1_000_000).describe("Zero-based item offset, NOT a page number. Start at 0, then copy the exact nextCursor returned by the previous response. Already-read valid pages may be read again."),
}).strict();

export const projectAgentDirectorCapabilityPageV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  catalogId: idSchema,
  catalogHash: hashSchema,
  version: z.literal(1),
  cursor: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative().nullable(),
  totalSectionCount: z.number().int().positive(),
  sections: z.array(projectAgentDirectorCapabilitySectionV1Schema).max(2),
  timelineModified: z.literal(false),
}).strict().superRefine((page, context) => {
  if (page.nextCursor !== null && page.nextCursor <= page.cursor) {
    context.addIssue({ code: "custom", path: ["nextCursor"], message: "nextCursor must advance" });
  }
});

export type ProjectAgentDirectorCapabilitySectionV1 = z.infer<typeof projectAgentDirectorCapabilitySectionV1Schema>;
export type ProjectAgentDirectorCapabilityCatalogV1 = z.infer<typeof projectAgentDirectorCapabilityCatalogV1Schema>;
export type ProjectAgentDirectorCapabilityPageV1 = z.infer<typeof projectAgentDirectorCapabilityPageV1Schema>;

export const projectAgentHostStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  contextIdentity: hashSchema,
  context: projectAgentContextSnapshotV1Schema,
  director: projectDirectorSnapshotV1Schema,
  layout: layoutCutSnapshotV1Schema,
  sceneProgram: sceneProgramSnapshotV1Schema,
  capabilities: sceneCapabilityCatalogV1Schema,
  packagedCut: packagedCutSnapshotV1Schema,
  assets: z.array(z.unknown()).max(2_048),
  readiness: z.object({
    roughConfirmed: z.boolean(),
    creativePlanCurrent: z.boolean(),
    layoutConfirmed: z.boolean(),
    sceneProgramReady: z.boolean(),
    packagedCutReady: z.boolean(),
  }).strict(),
  allowedTerminalActions: z.array(projectAgentTerminalActionV1Schema).max(2),
  timelineModified: z.literal(false),
}).strict();

export type ProjectAgentHostStateV1 = z.infer<typeof projectAgentHostStateV1Schema>;

export const projectAgentTurnRuntimeV1Schema = z.object({
  available: z.boolean(),
  configured: z.boolean(),
  preset: z.literal("codex-cut-project-agent"),
  deterministicFallbackEnabled: z.literal(false),
  message: z.string().trim().min(1).max(1_024),
}).strict();

export const projectAgentTurnSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  host: projectAgentHostStateV1Schema,
  runtime: projectAgentTurnRuntimeV1Schema,
  activeTurn: projectAgentTurnV1Schema.nullable(),
  turns: z.array(projectAgentTurnV1Schema).max(64),
  timelineModified: z.literal(false),
}).strict();

export type ProjectAgentTurnSnapshotV1 = z.infer<typeof projectAgentTurnSnapshotV1Schema>;

/** Polling must not rebuild the six host snapshots or transmit the tool log. */
export const projectAgentTurnProgressV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  toolCallCount: z.number().int().nonnegative(),
  turn: z.object({
    turnId: projectAgentTurnV1Schema.shape.turnId,
    jobId: projectAgentTurnV1Schema.shape.jobId,
    state: projectAgentTurnV1Schema.shape.state,
    executionPhase: projectAgentTurnV1Schema.shape.executionPhase,
    validationAttemptCount: projectAgentTurnV1Schema.shape.validationAttemptCount,
    repairAttempted: projectAgentTurnV1Schema.shape.repairAttempted,
    terminalSubmissionCount: projectAgentTurnV1Schema.shape.terminalSubmissionCount,
    sceneScope: projectAgentTurnV1Schema.shape.sceneScope,
    updatedAt: projectAgentTurnV1Schema.shape.updatedAt,
    completedAt: projectAgentTurnV1Schema.shape.completedAt,
    contextPackHash: projectAgentTurnV1Schema.shape.contextPackHash,
  }).strict(),
}).strict();
export type ProjectAgentTurnProgressV1 = z.infer<typeof projectAgentTurnProgressV1Schema>;

export type ProjectAgentTurnHostProviderV1 = {
  readReviewTimeline?:()=>Promise<import("../shared/timeline-v2/schema.js").TimelineDocumentV2>;
  restoreSceneReviewVersion?:(expectedHash:string,implementationPlanId:string)=>Promise<SceneProgramSnapshotV1>;
  renderScenePreviewImages?: (programHash:string,frames:readonly number[],signal:AbortSignal)=>Promise<NonNullable<ProjectAgentTurnRunnerInput["previewImages"]>>;
  readProjectAgentContext(): Promise<ProjectAgentContextV1Like>;
  readDirector(): Promise<ProjectDirectorSnapshotV1>;
  readLayout(): Promise<LayoutCutSnapshotV1>;
  readSceneProgram(): Promise<SceneProgramSnapshotV1>;
  readPackagedCut(): Promise<PackagedCutSnapshotV1>;
  readCapabilities(): Promise<SceneCapabilityCatalogV1>;
  /** Full Master Transcript used before a fresh paragraph foundation exists. */
  readMasterTranscript(): Promise<import("../shared/transcript-alignment.js").MasterTranscript>;
  submitCreativePlan(request: SubmitProjectAgentCreativePlanV1Request): Promise<ProjectDirectorSnapshotV1>;
  submitScenePlan(request: SubmitSceneImplementationPlanV1Request): Promise<SceneProgramSnapshotV1>;
  /** Optional isolated Scene sample capability; absent providers retain the legacy full-plan flow. */
  readSceneSample?: () => Promise<SceneSampleSnapshot>;
  submitSceneSample?: (request: {
    paragraphId: string;
    implementation: SubmitSceneImplementationPlanV1Request;
  }) => Promise<SceneSampleSnapshot>;
  readApprovedSampleParagraph?: () => Promise<SceneImplementationPlanV1["paragraphs"][0]>;
};

// Structural alias keeps the host provider type independent of the exact
// context-service import while the runtime schema still validates the full
// context snapshot at the boundary.
export type ProjectAgentContextV1Like = ProjectAgentContextSnapshotV1;

export type ProjectAgentTurnRunnerResult = {
  assistantText: string;
  dshSessionId: string | null;
  dshPid: number | null;
  delegatedDshTurnId?: string | null;
  delegatedDshJobId?: string | null;
};

export type ProjectAgentTurnRunnerInput = {
  turn: ProjectAgentTurnV1;
  /**
   * Host-built U1 input. Creative/Scene turns receive the complete bounded
   * evidence pack before the model starts; Rough Cut keeps its delegated
   * legacy adapter and therefore uses null.
   */
  contextPack: ProjectAgentContextPackV1 | null;
  /** Host-derived revision facts; null for an initial plan and other stages. */
  creativePlanRevisionDraft: ProjectAgentCreativePlanRevisionDraftV1 | null;
  /**
   * Host-built, bounded conversation context from completed turns before this
   * one. The runner must treat this as untrusted conversation data.
   */
  conversationHistory: string;
  /** Actual host-rendered frame bytes, never preview hashes in place of images. */
  previewImages?: readonly {data: Uint8Array; mediaType: "image/png" | "image/jpeg" | "image/webp"; frame: number; sceneProgramHash: string}[];
  callTool: (name: ProjectAgentTurnToolNameV1, args: unknown) => Promise<unknown>;
  onPid: (pid: number) => Promise<void>;
  /** Host-only binding check for adapters that have no model tool call gate. */
  assertCurrentHost?: () => Promise<void>;
};

export const PROJECT_AGENT_TURN_TOOL_NAMES = [
  "project_agent_get_state",
  "project_agent_read_workflow",
  "project_agent_read_transcript_page",
  "project_agent_read_design_page",
  "project_agent_read_scene_capability_page",
  "project_agent_read_director_capability",
  "project_agent_stage_creative_plan_part",
  "project_agent_submit_creative_plan",
  "project_agent_stage_scene_implementation_part",
  "project_agent_submit_scene_implementation_plan",
] as const;
export const projectAgentTurnToolNameV1Schema = z.enum(PROJECT_AGENT_TURN_TOOL_NAMES);
export type ProjectAgentTurnToolNameV1 = (typeof PROJECT_AGENT_TURN_TOOL_NAMES)[number];

export const projectAgentTurnToolInputSchemas = {
  project_agent_get_state: z.object({}).strict(),
  project_agent_read_workflow:z.object({cursor:z.number().int().nonnegative().max(512)}).strict(),
  project_agent_read_transcript_page: projectAgentTranscriptPageRequestV1Schema,
  project_agent_read_design_page: projectAgentDesignPageRequestV1Schema,
  project_agent_read_scene_capability_page: projectAgentCapabilityPageRequestV1Schema,
  project_agent_read_director_capability: projectAgentDirectorCapabilityPageRequestV1Schema,
  project_agent_stage_creative_plan_part: projectAgentCreativePlanStageRequestV1Schema,
  project_agent_submit_creative_plan: projectAgentCreativePlanSubmitRequestV1Schema,
  project_agent_stage_scene_implementation_part: projectAgentSceneImplementationStageRequestV1Schema,
  project_agent_submit_scene_implementation_plan: projectAgentSceneImplementationSubmitRequestV1Schema,
} as const;

export function projectAgentTurnContextIdentity(input: {
  projectAgentId: string;
  projectId: string;
  timelineId: string;
  revision: number;
  timelineHash: string;
  context: ProjectAgentContextV1Like;
  director: ProjectDirectorSnapshotV1;
  layout: LayoutCutSnapshotV1;
  sceneProgram: SceneProgramSnapshotV1;
  capabilities: SceneCapabilityCatalogV1;
  packagedCut: PackagedCutSnapshotV1;
}): string {
  return canonicalHash({
    projectAgentId: input.projectAgentId,
    projectId: input.projectId,
    timelineId: input.timelineId,
    revision: input.revision,
    timelineHash: input.timelineHash,
    // The legacy context snapshot remains host-internal.  Only its stable
    // project identity, constitutions, and complete decision ledger belong in
    // the Project Agent turn identity; derived Stage/Gate/artifact/dependency
    // state must not invalidate a turn or steer the model-visible state.
    context: {
      identity: input.context.identity,
      hostIdentity: input.context.hostIdentity,
      productConstitution: input.context.productConstitution,
      projectConstitution: input.context.projectConstitution,
      decisionLedger: input.context.decisionLedger,
    },
    director: input.director,
    layout: input.layout,
    sceneProgram: input.sceneProgram,
    capabilities: input.capabilities,
    packagedCut: input.packagedCut,
    directorCapabilityCatalogHash: PROJECT_AGENT_DIRECTOR_CAPABILITY_CATALOG_V1.catalogHash,
  });
}

export function projectAgentTurnReferenceId(input: { turnId?: string; jobId?: string }): string {
  return input.turnId ?? input.jobId!;
}

export type {
  ProjectDirectorSnapshotV1,
  SubmitProjectAgentCreativePlanV1Request,
  SceneCapabilityCatalogV1,
  SceneImplementationPlanV1,
  SceneProgramSnapshotV1,
  SubmitSceneImplementationPlanV1Request,
  LayoutCutSnapshotV1,
  PackagedCutSnapshotV1,
};
