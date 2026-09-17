import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  hashSchema,
  idSchema,
  isoInstantSchema,
  jsonObjectSchema,
} from "../shared/timeline-v2/schema.js";
import {
  visualRoleMainKindSchema,
  visualRoleObjectKindSchema,
  visualRoleSupportingKindSchema,
} from "./visual-role-contract.js";

const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const compactTextSchema = z.string().trim().min(1).max(1_000);

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const LAYOUT_FAMILY_IDS_V1 = [
  "F01_PERSON_DELIVERY",
  "F02_TEXT_TAKEOVER",
  "F03_DATA_PROOF",
  "F04_PARALLEL_COMPONENTS",
  "F05_TIME_PROCESS",
  "F06_COMPARISON",
  "F07_LIST",
  "F08_RISK_QA",
  "F09_SCREEN_OPERATION",
  "F10_EVIDENCE_TAKEOVER",
  "F11_STEP_SEQUENCE",
] as const;

export const LAYOUT_VARIANT_IDS_V1 = [
  "layout:v1:1a-person-information-rail",
  "layout:v1:1b-clean-person",
  "layout:v1:2-fullscreen-text",
  "layout:v1:3a-single-data-proof",
  "layout:v1:3b-before-after-data",
  "layout:v1:4-parallel-points",
  "layout:v1:5a-timeline",
  "layout:v1:5b-pipeline",
  "layout:v1:6a-dual-object",
  "layout:v1:6b-dual-path",
  "layout:v1:7-fullscreen-list",
  "layout:v1:8-risk-qa-loop",
  "layout:v1:9-screen-operation",
  "layout:v1:10-evidence-takeover",
  "layout:v1:11-step-sequence",
  "layout:v1:1a-person-information-rail-solo",
  "layout:v1:1b-clean-person-solo",
  "layout:v1:2-fullscreen-text-solo",
  "layout:v1:3a-single-data-proof-solo",
  "layout:v1:3b-before-after-data-solo",
  "layout:v1:4-parallel-points-solo",
  "layout:v1:5a-timeline-solo",
  "layout:v1:5b-pipeline-solo",
  "layout:v1:6a-dual-object-solo",
  "layout:v1:6b-dual-path-solo",
  "layout:v1:7-fullscreen-list-solo",
  "layout:v1:8-risk-qa-loop-solo",
  "layout:v1:9-screen-operation-solo",
  "layout:v1:10-evidence-takeover-solo",
  "layout:v1:11-step-sequence-solo",
] as const;

export const layoutFamilyIdV1Schema = z.enum(LAYOUT_FAMILY_IDS_V1);
export const layoutVariantIdV1Schema = z.enum(LAYOUT_VARIANT_IDS_V1);
export const layoutSlotIdV1Schema = z.enum(["MAIN_STAGE", "SUPPORT_PRIMARY", "SUPPORT_SECONDARY"]);
export const layoutSupportStrengthV1Schema = z.enum(["STRONG", "LIGHT"]);

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

export const layoutCatalogSlotV1Schema = z.object({
  slotId: layoutSlotIdV1Schema,
  role: z.enum(["MAIN", "SUPPORTING"]),
  required: z.boolean(),
  acceptedKinds: z.array(visualRoleObjectKindSchema).min(1).max(13),
  acceptedStrengths: z.array(layoutSupportStrengthV1Schema).max(2),
  frameToken: normalizedFrameSchema,
  areaSharePermille: z.object({
    minimum: z.number().int().min(1).max(1_000),
    maximum: z.number().int().min(1).max(1_000),
  }).strict(),
  zIndex: z.number().int().min(0).max(100),
  alignment: z.enum(["FILL", "CENTER", "TOP", "BOTTOM", "LEFT", "RIGHT"]),
  overlapPolicy: z.enum(["NONE", "OVER_MAIN", "INSET_IN_MAIN"]),
  personTreatment: z.enum(["NONE", "FULL_FRAME", "RECTANGULAR_PIP", "CIRCULAR_PIP"]),
  textCapacity: z.object({
    maximumGraphemes: z.number().int().positive().max(1_000),
    maximumLines: z.number().int().positive().max(32),
    maximumItems: z.number().int().positive().max(32),
  }).strict().nullable(),
}).strict().superRefine((slot, context) => {
  if (slot.areaSharePermille.minimum > slot.areaSharePermille.maximum) {
    context.addIssue({ code: "custom", path: ["areaSharePermille"], message: "area interval must be ordered" });
  }
  if (!unique(slot.acceptedKinds) || !unique(slot.acceptedStrengths)) {
    context.addIssue({ code: "custom", path: [], message: "slot kind and strength lists must be unique" });
  }
  if (slot.role === "MAIN" && (slot.slotId !== "MAIN_STAGE" || slot.acceptedStrengths.length !== 0)) {
    context.addIssue({ code: "custom", path: ["role"], message: "MAIN slot cannot accept supporting strength" });
  }
  if (slot.role === "SUPPORTING" && slot.slotId === "MAIN_STAGE") {
    context.addIssue({ code: "custom", path: ["slotId"], message: "supporting slot cannot use MAIN_STAGE" });
  }
});

export const layoutCatalogVariantV1Schema = z.object({
  variantId: layoutVariantIdV1Schema,
  familyId: layoutFamilyIdV1Schema,
  familyLabel: z.string().trim().min(1).max(100),
  variantLabel: z.string().trim().min(1).max(100),
  purpose: compactTextSchema,
  aspect: z.literal("LANDSCAPE_16_9"),
  minimumCanvas: z.object({
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
  }).strict(),
  allowedMainKinds: z.array(visualRoleMainKindSchema).min(1).max(6),
  allowedSupportingKinds: z.array(visualRoleSupportingKindSchema).min(1).max(7),
  supportCount: z.object({ minimum: z.number().int().min(0).max(1), maximum: z.number().int().min(0).max(2) }).strict(),
  maximumStrongSupportingCount: z.number().int().min(0).max(1),
  slots: z.array(layoutCatalogSlotV1Schema).min(1).max(3),
  hierarchyPolicy: z.literal("MAIN_MUST_BE_LARGEST"),
  safeRegion: z.object({
    leftPermille: z.number().int().min(0).max(300),
    rightPermille: z.number().int().min(0).max(300),
    topPermille: z.number().int().min(0).max(300),
    bottomPermille: z.number().int().min(0).max(400),
  }).strict(),
  captionPolicy: z.object({
    ordinaryCaptionsAreSeparateLayer: z.literal(true),
    minimumBottomClearancePermille: z.number().int().min(100).max(400),
    supportingTextMayOverlapCaptionZone: z.literal(false),
  }).strict(),
  objectFailureCodes: z.array(z.enum([
    "LAYOUT_MAIN_OBJECT_MISSING",
    "LAYOUT_SUPPORT_OBJECT_MISSING",
    "LAYOUT_OBJECT_STALE",
    "LAYOUT_OBJECT_KIND_INCOMPATIBLE",
  ])).min(4).max(4),
}).strict().superRefine((variant, context) => {
  if (!unique(variant.allowedMainKinds) || !unique(variant.allowedSupportingKinds)
    || !unique(variant.slots.map((slot) => slot.slotId)) || !unique(variant.objectFailureCodes)) {
    context.addIssue({ code: "custom", path: [], message: "variant closed lists must be unique" });
  }
  const mainSlots = variant.slots.filter((slot) => slot.role === "MAIN");
  const supportSlots = variant.slots.filter((slot) => slot.role === "SUPPORTING");
  if (mainSlots.length !== 1 || supportSlots.length !== variant.supportCount.maximum
    || supportSlots.filter((slot) => slot.required).length !== variant.supportCount.minimum) {
    context.addIssue({ code: "custom", path: ["slots"], message: "variant slots must exactly represent its support cardinality" });
  }
  const mainMinimum = mainSlots[0]?.areaSharePermille.minimum ?? 0;
  if (supportSlots.some((slot) => slot.areaSharePermille.maximum >= mainMinimum)) {
    context.addIssue({ code: "custom", path: ["hierarchyPolicy"], message: "MAIN must remain larger than every supporting slot" });
  }
});

type LayoutCatalogV1HashInput = {
  catalogId: string;
  version: 1;
  aspect: "LANDSCAPE_16_9";
  variants: z.infer<typeof layoutCatalogVariantV1Schema>[];
};

export function layoutCatalogV1Hash(catalog: LayoutCatalogV1HashInput): string {
  return canonicalHash(catalog);
}

export const layoutCatalogV1Schema = z.object({
  schemaVersion: z.literal(1),
  catalogId: idSchema,
  catalogHash: hashSchema,
  version: z.literal(1),
  aspect: z.literal("LANDSCAPE_16_9"),
  variants: z.array(layoutCatalogVariantV1Schema).min(15).max(64),
}).strict().superRefine((catalog, context) => {
  if (!unique(catalog.variants.map((variant) => variant.variantId))) {
    context.addIssue({ code: "custom", path: ["variants"], message: "catalog variant ids must be unique" });
  }
  if (new Set(catalog.variants.map((variant) => variant.familyId)).size !== 11) {
    context.addIssue({ code: "custom", path: ["variants"], message: "catalog must contain exactly eleven families" });
  }
  const { schemaVersion: _schemaVersion, catalogHash: _catalogHash, ...semantic } = catalog;
  if (catalog.catalogHash !== layoutCatalogV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["catalogHash"], message: "catalog hash must match canonical content" });
  }
});

export const layoutFoundationObjectV1Schema = z.object({
  visualObjectId: idSchema,
  visualObjectHash: hashSchema,
  sourceSlot: z.enum(["MAIN", "SUPPORT_1", "SUPPORT_2"]),
  role: z.enum(["MAIN", "SUPPORTING"]),
  kind: visualRoleObjectKindSchema,
  informationDuty: compactTextSchema,
  supportDuty: z.enum(["EMPHASIZE", "CLARIFY", "LOCATE", "CONTEXTUALIZE", "HUMANIZE", "DECORATE"]).nullable(),
  strength: layoutSupportStrengthV1Schema.nullable(),
  content: jsonObjectSchema,
  evidenceWordIds: z.array(idSchema).min(1).max(64),
  sourceBindingHash: hashSchema,
}).strict();

export const layoutFoundationParagraphV1Schema = z.object({
  paragraphId: idSchema,
  paragraphDesignHash: hashSchema,
  upstreamParagraphFingerprint: hashSchema,
  order: z.number().int().nonnegative().max(511),
  visualParagraphType: z.string().trim().min(1).max(128),
  primaryExpressionTask: z.string().trim().min(1).max(128),
  informationDuty: compactTextSchema,
  objects: z.array(layoutFoundationObjectV1Schema).min(1).max(3),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.objects.map((object) => object.visualObjectId))
    || paragraph.objects.filter((object) => object.role === "MAIN").length !== 1
    || paragraph.objects.filter((object) => object.role === "SUPPORTING").length < 1) {
    context.addIssue({ code: "custom", path: ["objects"], message: "layout foundation requires one MAIN and one or two unique SUPPORT objects" });
  }
});

type LayoutFoundationV1HashInput = {
  foundationId: string;
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
  paragraphs: z.infer<typeof layoutFoundationParagraphV1Schema>[];
  createdAt: string;
};

export function layoutFoundationV1Hash(foundation: LayoutFoundationV1HashInput): string {
  return canonicalHash(foundation);
}

export const layoutFoundationV1Schema = z.object({
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
  canvas: z.object({
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
    framesPerSecond: z.number().positive().max(1_000),
  }).strict(),
  visualParagraphProposalId: idSchema,
  visualParagraphProposalHash: hashSchema,
  visualRoleStructureSnapshotId: idSchema,
  visualRoleStructureHash: hashSchema,
  visualRolePlanId: idSchema,
  visualRolePlanHash: hashSchema,
  materialManifestId: idSchema,
  materialManifestHash: hashSchema,
  visualRoleConfirmationId: idSchema,
  visualRoleConfirmationHash: hashSchema,
  catalogId: idSchema,
  catalogHash: hashSchema,
  paragraphs: z.array(layoutFoundationParagraphV1Schema).min(1).max(512),
  createdAt: isoInstantSchema,
}).strict().superRefine((foundation, context) => {
  if (!unique(foundation.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "foundation paragraph ids must be unique" });
  }
  const { schemaVersion: _schemaVersion, foundationHash: _foundationHash, ...semantic } = foundation;
  if (foundation.foundationHash !== layoutFoundationV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["foundationHash"], message: "foundation hash must match canonical content" });
  }
});

export const layoutObjectSlotMappingSubmissionV1Schema = z.object({
  visualObjectId: idSchema,
  visualObjectHash: hashSchema,
  layoutSlotId: layoutSlotIdV1Schema,
}).strict();

export const layoutCandidateRejectionCodeV1Schema = z.enum([
  "WEAKER_INFORMATION_HIERARCHY",
  "LOWER_TASK_FIT",
  "LOWER_SOURCE_FIT",
  "LOWER_TEXT_FIT",
  "LOWER_READING_ORDER_FIT",
  "LOWER_HUMAN_PRESENCE_FIT",
  "LOWER_COMPARISON_FIT",
]);

export const layoutCandidateAuditItemV1Schema = z.discriminatedUnion("decision", [
  z.object({
    variantId: layoutVariantIdV1Schema,
    decision: z.literal("SELECTED"),
    rejectionCode: z.null(),
  }).strict(),
  z.object({
    variantId: layoutVariantIdV1Schema,
    decision: z.literal("REJECTED"),
    rejectionCode: layoutCandidateRejectionCodeV1Schema,
  }).strict(),
]);

export const layoutAlternativeV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("MEANINGFUL_ALTERNATIVE"),
    variantId: layoutVariantIdV1Schema,
    rejectionCode: layoutCandidateRejectionCodeV1Schema,
    rationale: compactTextSchema,
  }).strict(),
  z.object({
    kind: z.literal("ONLY_COMPATIBLE_VARIANT"),
    reasonCode: z.literal("NO_OTHER_CATALOG_VARIANT_COMPATIBLE"),
  }).strict(),
]);

export const layoutTextAdaptationV1Schema = z.object({
  visualObjectId: idSchema,
  mode: z.enum(["CONDENSE", "SPLIT_WITHIN_OBJECT", "CHANGE_VARIANT"]),
  originalText: z.string().trim().min(1).max(1_000),
  proposedText: z.string().trim().min(1).max(1_000).nullable(),
  sourceEvidenceWordIds: z.array(idSchema).min(1).max(64),
  preservesClaims: z.literal(true),
  provenance: z.literal("AI_PROPOSAL"),
  status: z.literal("PENDING_USER_DECISION"),
  rationale: compactTextSchema,
}).strict().superRefine((adaptation, context) => {
  if (!unique(adaptation.sourceEvidenceWordIds)) {
    context.addIssue({ code: "custom", path: ["sourceEvidenceWordIds"], message: "adaptation evidence ids must be unique" });
  }
  if ((adaptation.mode === "CHANGE_VARIANT") !== (adaptation.proposedText === null)) {
    context.addIssue({ code: "custom", path: ["proposedText"], message: "only CHANGE_VARIANT may omit proposed text" });
  }
});

export const layoutParagraphSubmissionV1Schema = z.object({
  paragraphId: idSchema,
  selectedVariantId: layoutVariantIdV1Schema,
  objectSlotMappings: z.array(layoutObjectSlotMappingSubmissionV1Schema).min(1).max(3),
  candidateAudit: z.array(layoutCandidateAuditItemV1Schema).min(1).max(64),
  alternative: layoutAlternativeV1Schema,
  evidenceRefs: z.array(z.object({ refId: idSchema, refHash: hashSchema }).strict()).min(1).max(16),
  rationale: compactTextSchema,
  textAdaptations: z.array(layoutTextAdaptationV1Schema).max(3),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.objectSlotMappings.map((mapping) => mapping.visualObjectId))
    || !unique(paragraph.objectSlotMappings.map((mapping) => mapping.layoutSlotId))
    || !unique(paragraph.candidateAudit.map((candidate) => candidate.variantId))
    || !unique(paragraph.evidenceRefs.map((ref) => ref.refId))
    || !unique(paragraph.textAdaptations.map((adaptation) => adaptation.visualObjectId))) {
    context.addIssue({ code: "custom", path: [], message: "layout paragraph submission lists must be unique" });
  }
  const selected = paragraph.candidateAudit.filter((candidate) => candidate.decision === "SELECTED");
  if (selected.length !== 1 || selected[0]?.variantId !== paragraph.selectedVariantId) {
    context.addIssue({ code: "custom", path: ["candidateAudit"], message: "candidate audit must select the exact chosen variant once" });
  }
});

export const layoutPlanSubmissionV1Schema = z.object({
  proposalId: idSchema,
  paragraphs: z.array(layoutParagraphSubmissionV1Schema).min(1).max(512),
  submittedAt: isoInstantSchema,
}).strict();

export const layoutTextPreflightCheckV1Schema = z.object({
  visualObjectId: idSchema,
  layoutSlotId: layoutSlotIdV1Schema,
  measuredGraphemes: z.number().int().nonnegative().max(10_000),
  measuredItems: z.number().int().nonnegative().max(1_000),
  maximumGraphemes: z.number().int().positive().max(1_000),
  maximumLines: z.number().int().positive().max(32),
  maximumItems: z.number().int().positive().max(32),
  state: z.enum(["FIT", "ADAPTATION_REQUIRED"]),
  adaptationId: idSchema.nullable(),
}).strict();

export const layoutTextPreflightV1Schema = z.object({
  state: z.enum(["PASS", "REVIEW_REQUIRED"]),
  checks: z.array(layoutTextPreflightCheckV1Schema).max(3),
}).strict().superRefine((preflight, context) => {
  if (!unique(preflight.checks.map((check) => check.visualObjectId))) {
    context.addIssue({ code: "custom", path: ["checks"], message: "text preflight object ids must be unique" });
  }
  if ((preflight.state === "REVIEW_REQUIRED") !== preflight.checks.some((check) => check.state === "ADAPTATION_REQUIRED")) {
    context.addIssue({ code: "custom", path: ["state"], message: "preflight state must reflect its checks" });
  }
});

export const layoutGeometrySlotV1Schema = z.object({
  layoutSlotId: layoutSlotIdV1Schema,
  visualObjectId: idSchema,
  normalizedFrame: normalizedFrameSchema,
  pixelFrame: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict(),
  areaSharePermille: z.number().int().positive().max(1_000),
  zIndex: z.number().int().min(0).max(100),
  personTreatment: z.enum(["NONE", "FULL_FRAME", "RECTANGULAR_PIP", "CIRCULAR_PIP"]),
}).strict();

type LayoutGeometryV1HashInput = {
  geometryId: string;
  catalogHash: string;
  variantId: string;
  canvas: { width: number; height: number };
  safeRegion: z.infer<typeof normalizedFrameSchema>;
  captionExclusionRegion: z.infer<typeof normalizedFrameSchema>;
  slots: z.infer<typeof layoutGeometrySlotV1Schema>[];
};

export function layoutGeometryV1Hash(geometry: LayoutGeometryV1HashInput): string {
  return canonicalHash(geometry);
}

export const layoutGeometryV1Schema = z.object({
  geometryId: idSchema,
  geometryHash: hashSchema,
  catalogHash: hashSchema,
  variantId: layoutVariantIdV1Schema,
  canvas: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict(),
  safeRegion: normalizedFrameSchema,
  captionExclusionRegion: normalizedFrameSchema,
  slots: z.array(layoutGeometrySlotV1Schema).min(2).max(3),
}).strict().superRefine((geometry, context) => {
  if (!unique(geometry.slots.map((slot) => slot.layoutSlotId))
    || !unique(geometry.slots.map((slot) => slot.visualObjectId))) {
    context.addIssue({ code: "custom", path: ["slots"], message: "geometry slots and objects must be unique" });
  }
  const { geometryHash: _geometryHash, ...semantic } = geometry;
  if (geometry.geometryHash !== layoutGeometryV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["geometryHash"], message: "geometry hash must match canonical content" });
  }
});

type LayoutPlanParagraphV1HashInput = {
  paragraphId: string;
  upstreamParagraphFingerprint: string;
  selectedVariantId: string;
  objectSlotMappings: z.infer<typeof layoutObjectSlotMappingSubmissionV1Schema>[];
  candidateAudit: z.infer<typeof layoutCandidateAuditItemV1Schema>[];
  alternative: z.infer<typeof layoutAlternativeV1Schema>;
  evidenceRefs: Array<{ refId: string; refHash: string }>;
  rationale: string;
  textAdaptations: Array<z.infer<typeof layoutTextAdaptationV1Schema> & { adaptationId: string; adaptationHash: string }>;
  textPreflight: z.infer<typeof layoutTextPreflightV1Schema>;
  geometry: z.infer<typeof layoutGeometryV1Schema>;
  confidence: number;
  reviewRequired: boolean;
};

export function layoutPlanParagraphV1Hash(paragraph: LayoutPlanParagraphV1HashInput): string {
  return canonicalHash(paragraph);
}

export const layoutPersistentTextAdaptationV1Schema = layoutTextAdaptationV1Schema.extend({
  adaptationId: idSchema,
  adaptationHash: hashSchema,
}).strict().superRefine((adaptation, context) => {
  const { adaptationId, adaptationHash: _adaptationHash, ...submission } = adaptation;
  const expected = canonicalHash({ adaptationId, ...submission });
  if (adaptation.adaptationHash !== expected) {
    context.addIssue({ code: "custom", path: ["adaptationHash"], message: "adaptation hash must match canonical content" });
  }
});

export const layoutPlanParagraphV1Schema = z.object({
  paragraphId: idSchema,
  paragraphLayoutHash: hashSchema,
  upstreamParagraphFingerprint: hashSchema,
  selectedVariantId: layoutVariantIdV1Schema,
  objectSlotMappings: z.array(layoutObjectSlotMappingSubmissionV1Schema).min(1).max(3),
  candidateAudit: z.array(layoutCandidateAuditItemV1Schema).min(1).max(64),
  alternative: layoutAlternativeV1Schema,
  evidenceRefs: z.array(z.object({ refId: idSchema, refHash: hashSchema }).strict()).min(1).max(16),
  rationale: compactTextSchema,
  textAdaptations: z.array(layoutPersistentTextAdaptationV1Schema).max(3),
  textPreflight: layoutTextPreflightV1Schema,
  geometry: layoutGeometryV1Schema,
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((paragraph, context) => {
  const { paragraphLayoutHash: _paragraphLayoutHash, ...semantic } = paragraph;
  if (paragraph.paragraphLayoutHash !== layoutPlanParagraphV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["paragraphLayoutHash"], message: "layout paragraph hash must match canonical content" });
  }
});

type LayoutPlanV1HashInput = {
  planId: string;
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
  paragraphs: z.infer<typeof layoutPlanParagraphV1Schema>[];
  createdByTurnId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function layoutPlanV1Hash(plan: LayoutPlanV1HashInput): string {
  return canonicalHash(plan);
}

export const layoutPlanV1Schema = z.object({
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
  visualRolePlanId: idSchema,
  visualRolePlanHash: hashSchema,
  materialManifestId: idSchema,
  materialManifestHash: hashSchema,
  catalogId: idSchema,
  catalogHash: hashSchema,
  paragraphs: z.array(layoutPlanParagraphV1Schema).min(1).max(512),
  createdByTurnId: idSchema.nullable(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((plan, context) => {
  if (!unique(plan.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "layout plan paragraph ids must be unique" });
  }
  const { schemaVersion: _schemaVersion, planHash: _planHash, ...semantic } = plan;
  if (plan.planHash !== layoutPlanV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["planHash"], message: "layout plan hash must match canonical content" });
  }
});

export const layoutPlanProposalStateV1Schema = z.enum(["PENDING", "ACCEPTED", "REJECTED", "STALE", "BLOCKED"]);

type LayoutPlanProposalV1HashInput = {
  proposalId: string;
  proposalRevision: number;
  status: z.infer<typeof layoutPlanProposalStateV1Schema>;
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
};

export function layoutPlanProposalV1Hash(proposal: LayoutPlanProposalV1HashInput): string {
  return canonicalHash(proposal);
}

export const layoutPlanProposalV1Schema = z.object({
  schemaVersion: z.literal(1),
  proposalId: idSchema,
  proposalHash: hashSchema,
  proposalRevision: z.number().int().positive(),
  status: layoutPlanProposalStateV1Schema,
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: revisionSchema,
  foundationId: idSchema,
  foundationHash: hashSchema,
  basePlanId: idSchema,
  basePlanHash: hashSchema,
  candidatePlanId: idSchema.nullable(),
  candidatePlanHash: hashSchema.nullable(),
  targetParagraphIds: z.array(idSchema).min(1).max(3),
  allowedParagraphIds: z.array(idSchema).min(1).max(3),
  changedParagraphIds: z.array(idSchema).max(3),
  summary: compactTextSchema,
  rationale: compactTextSchema,
  createdByTurnId: idSchema.nullable(),
  createdAt: isoInstantSchema,
  decidedAt: isoInstantSchema.nullable(),
}).strict().superRefine((proposal, context) => {
  if ((proposal.candidatePlanId === null) !== (proposal.candidatePlanHash === null)
    || !unique(proposal.targetParagraphIds) || !unique(proposal.allowedParagraphIds)
    || !unique(proposal.changedParagraphIds)
    || proposal.targetParagraphIds.some((id) => !proposal.allowedParagraphIds.includes(id))
    || proposal.changedParagraphIds.some((id) => !proposal.allowedParagraphIds.includes(id))) {
    context.addIssue({ code: "custom", path: [], message: "layout proposal identities and scopes must be exact" });
  }
  const { schemaVersion: _schemaVersion, proposalHash: _proposalHash, ...semantic } = proposal;
  if (proposal.proposalHash !== layoutPlanProposalV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["proposalHash"], message: "layout proposal hash must match canonical content" });
  }
});

type LayoutParagraphReviewV1HashInput = {
  reviewId: string;
  planId: string;
  planHash: string;
  paragraphId: string;
  paragraphLayoutHash: string;
  decision: "ACCEPT" | "REJECT";
  acceptedTextAdaptationIds: string[];
  reason: string | null;
  reviewedAt: string;
};

export function layoutParagraphReviewV1Hash(review: LayoutParagraphReviewV1HashInput): string {
  return canonicalHash(review);
}

export const layoutParagraphReviewV1Schema = z.object({
  schemaVersion: z.literal(1),
  reviewId: idSchema,
  reviewHash: hashSchema,
  planId: idSchema,
  planHash: hashSchema,
  paragraphId: idSchema,
  paragraphLayoutHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  acceptedTextAdaptationIds: z.array(idSchema).max(3),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  reviewedAt: isoInstantSchema,
}).strict().superRefine((review, context) => {
  if (!unique(review.acceptedTextAdaptationIds)
    || (review.decision === "REJECT" && review.acceptedTextAdaptationIds.length > 0)) {
    context.addIssue({ code: "custom", path: ["acceptedTextAdaptationIds"], message: "only accepted reviews may accept unique adaptations" });
  }
  const { schemaVersion: _schemaVersion, reviewHash: _reviewHash, ...semantic } = review;
  if (review.reviewHash !== layoutParagraphReviewV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["reviewHash"], message: "paragraph review hash must match canonical content" });
  }
});

type LayoutConfirmationV1HashInput = {
  confirmationId: string;
  planId: string;
  planHash: string;
  foundationHash: string;
  catalogHash: string;
  paragraphReviewHashes: string[];
  status: "CONFIRMED" | "EXPIRED";
  confirmedAt: string;
  expiredAt: string | null;
};

export function layoutConfirmationV1Hash(confirmation: LayoutConfirmationV1HashInput): string {
  return canonicalHash(confirmation);
}

export const layoutConfirmationV1Schema = z.object({
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
    context.addIssue({ code: "custom", path: [], message: "layout confirmation state is inconsistent" });
  }
  const { schemaVersion: _schemaVersion, confirmationHash: _confirmationHash, ...semantic } = confirmation;
  if (confirmation.confirmationHash !== layoutConfirmationV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["confirmationHash"], message: "layout confirmation hash must match canonical content" });
  }
});

export const layoutPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  currentPlanId: idSchema.nullable(),
  plans: z.array(layoutPlanV1Schema).max(256),
  proposals: z.array(layoutPlanProposalV1Schema).max(256),
  paragraphReviews: z.array(layoutParagraphReviewV1Schema).max(8_192),
  confirmations: z.array(layoutConfirmationV1Schema).max(256),
}).strict().superRefine((state, context) => {
  if (!unique(state.plans.map((plan) => plan.planId))
    || !unique(state.proposals.map((proposal) => proposal.proposalId))
    || !unique(state.paragraphReviews.map((review) => review.reviewId))
    || !unique(state.confirmations.map((confirmation) => confirmation.confirmationId))) {
    context.addIssue({ code: "custom", path: [], message: "layout persistent identities must be unique" });
  }
  if (state.currentPlanId !== null && !state.plans.some((plan) => plan.planId === state.currentPlanId)) {
    context.addIssue({ code: "custom", path: ["currentPlanId"], message: "current layout plan must exist" });
  }
});

export const reviewLayoutParagraphRequestSchema = z.object({
  expectedRevision: revisionSchema,
  planId: idSchema,
  planHash: hashSchema,
  paragraphId: idSchema,
  paragraphLayoutHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  acceptTextAdaptations: z.boolean(),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  reviewedAt: isoInstantSchema,
}).strict();

export const decideLayoutPlanProposalRequestSchema = z.object({
  expectedRevision: revisionSchema,
  proposalId: idSchema,
  proposalHash: hashSchema,
  candidatePlanId: idSchema,
  candidatePlanHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  decidedAt: isoInstantSchema,
}).strict();

export const confirmLayoutReviewRequestSchema = z.object({
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

export type LayoutCatalogV1 = z.infer<typeof layoutCatalogV1Schema>;
export type LayoutCatalogVariantV1 = z.infer<typeof layoutCatalogVariantV1Schema>;
export type LayoutFoundationV1 = z.infer<typeof layoutFoundationV1Schema>;
export type LayoutFoundationParagraphV1 = z.infer<typeof layoutFoundationParagraphV1Schema>;
export type LayoutParagraphSubmissionV1 = z.infer<typeof layoutParagraphSubmissionV1Schema>;
export type LayoutPlanSubmissionV1 = z.infer<typeof layoutPlanSubmissionV1Schema>;
export type LayoutPlanParagraphV1 = z.infer<typeof layoutPlanParagraphV1Schema>;
export type LayoutPlanV1 = z.infer<typeof layoutPlanV1Schema>;
export type LayoutPlanProposalV1 = z.infer<typeof layoutPlanProposalV1Schema>;
export type LayoutParagraphReviewV1 = z.infer<typeof layoutParagraphReviewV1Schema>;
export type LayoutConfirmationV1 = z.infer<typeof layoutConfirmationV1Schema>;
export type LayoutPersistentStateV1 = z.infer<typeof layoutPersistentStateV1Schema>;
export type ReviewLayoutParagraphRequest = z.infer<typeof reviewLayoutParagraphRequestSchema>;
export type DecideLayoutPlanProposalRequest = z.infer<typeof decideLayoutPlanProposalRequestSchema>;
export type ConfirmLayoutReviewRequest = z.infer<typeof confirmLayoutReviewRequestSchema>;
