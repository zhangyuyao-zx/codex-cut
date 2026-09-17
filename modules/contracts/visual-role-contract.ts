import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  hashSchema,
  idSchema,
  isoInstantSchema,
  jsonObjectSchema,
} from "../shared/timeline-v2/schema.js";
import { expressionTaskIdSchema } from "./visual-paragraph-contract.js";

export const VISUAL_ROLE_MAIN_KINDS = [
  "PERSON",
  "SCREEN_RECORDING",
  "LIVE_DEMONSTRATION",
  "EVIDENCE_MEDIA",
  "STRUCTURED_EXPLANATION",
  "TEXT_COMPOSITION",
] as const;

export const VISUAL_ROLE_SUPPORTING_KINDS = [
  "KEY_TEXT",
  "PERSON_PIP",
  "DETAIL_VIEW",
  "ANNOTATION",
  "CONTEXT_LABEL",
  "MINI_EXPLANATION",
  "DECORATIVE_ACCENT",
] as const;

export const VISUAL_PARAGRAPH_TYPES_V2 = [
  "PERSON_DELIVERY",
  "SCREEN_OPERATION",
  "LIVE_DEMONSTRATION",
  "EVIDENCE_REVIEW",
  "DESIGNED_INFORMATION",
] as const;

export const VISUAL_ROLE_SOURCE_KINDS = [
  "PERSON_SEGMENT",
  "SCREEN_SEGMENT",
  "LIVE_ACTION_SEGMENT",
  "EVIDENCE_VIDEO_SEGMENT",
  "IMAGE_REGION",
  "DOCUMENT_REGION",
  "SCREENSHOT_REGION",
  "DATA_TABLE_REGION",
  "TRANSCRIPT_WORD_SET",
  "CONFIRMED_FACT_SET",
  "CONFIRMED_RELATION_SET",
  "CONFIRMED_STEP_SEQUENCE",
  "USER_CONFIRMED_TEXT",
  "CONFIRMED_METADATA",
  "BRAND_ASSET",
] as const;

export const VISUAL_ROLE_SUPPORT_DUTIES = [
  "EMPHASIZE",
  "CLARIFY",
  "LOCATE",
  "CONTEXTUALIZE",
  "HUMANIZE",
  "DECORATE",
] as const;

export const VISUAL_ROLE_REJECTION_CODES = [
  "DUPLICATES_MAIN",
  "NO_DISTINCT_INFORMATION_DUTY",
  "WOULD_BECOME_SECOND_MAIN",
  "CONTRADICTS_EVIDENCE",
  "OUTSIDE_PARAGRAPH_TASK",
  "USER_FORBIDDEN",
] as const;

export const VISUAL_ROLE_MAIN_REJECTION_CODES = [
  "CANNOT_CARRY_PRIMARY_DUTY_INDEPENDENTLY",
  "WEAKER_INFORMATION_CARRIER",
  "CONTRADICTS_EVIDENCE",
  "OUTSIDE_PARAGRAPH_TASK",
  "WOULD_REQUIRE_UNCONFIRMED_CONTENT",
] as const;

export const VISUAL_ROLE_ZERO_SUPPORTING_EXCEPTIONS = [
  "NO_DISTINCT_SUPPORT_DUTY",
  "PRESERVE_EMOTIONAL_PERFORMANCE",
  "USER_CONFIRMED_NONE",
] as const;

// This is a protocol-abuse guard for semantic content, not a display-capacity
// limit. Line count, type size, wrapping, and component fit belong to the later
// layout/implementation preflight and must not reject role design here.
export const VISUAL_ROLE_SEMANTIC_TEXT_GRAPHEME_LIMIT = 300;

export const MATERIAL_REQUIREMENT_STATES = [
  "REQUESTED",
  "WAITING_USER_RESPONSE",
  "WAITING_ASSET",
  "WAITING_BINDING",
  "NEEDS_CLARIFICATION",
  "SATISFIED",
  "USER_CANNOT_PROVIDE",
  "SUPERSEDED",
  "STALE",
] as const;

export const MATERIAL_BINDING_STATES = [
  "SELECTED_EXISTING",
  "UPLOADED",
  "BOUND_TO_REQUIREMENT",
  "TECHNICALLY_VALID",
  "PENDING_USER_CONFIRMATION",
  "SATISFIED",
  "SUPERSEDED",
  "STALE",
] as const;

export const MATERIAL_ASSET_ORIGINS = [
  "PROJECT_ASSET",
  "UPLOADED",
] as const;

export const MATERIAL_REQUIREMENT_RESPONSES = [
  "ALREADY_AVAILABLE",
  "WILL_PROVIDE",
  "PROVIDED",
  "CANNOT_PROVIDE",
  "NEEDS_CLARIFICATION",
] as const;

export const VISUAL_ROLE_PLAN_PROPOSAL_KINDS = [
  "DOWNGRADE",
  "AGENT_REVISION",
] as const;

export const VISUAL_ROLE_PLAN_PROPOSAL_STATES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "BLOCKED",
  "STALE",
] as const;

export const VISUAL_ROLE_PLAN_PROPOSAL_DECISION_REASONS = [
  "USER_ACCEPTED",
  "USER_REJECTED",
  "NO_EVIDENCE_SAFE_FALLBACK",
  "STRUCTURE_REVIEW_REQUIRED",
  "FOUNDATION_CHANGED",
  "BASE_PLAN_SUPERSEDED",
] as const;

export const visualRoleMainKindSchema = z.enum(VISUAL_ROLE_MAIN_KINDS);
export const visualRoleSupportingKindSchema = z.enum(VISUAL_ROLE_SUPPORTING_KINDS);
export const visualRoleObjectKindSchema = z.enum([
  ...VISUAL_ROLE_MAIN_KINDS,
  ...VISUAL_ROLE_SUPPORTING_KINDS,
]);
export const visualParagraphTypeV2Schema = z.enum(VISUAL_PARAGRAPH_TYPES_V2);
export const visualRoleSourceKindSchema = z.enum(VISUAL_ROLE_SOURCE_KINDS);
export const visualRoleSupportDutySchema = z.enum(VISUAL_ROLE_SUPPORT_DUTIES);
export const visualRoleRejectionCodeSchema = z.enum(VISUAL_ROLE_REJECTION_CODES);
export const visualRoleMainRejectionCodeSchema = z.enum(VISUAL_ROLE_MAIN_REJECTION_CODES);
export const visualRoleZeroSupportingExceptionSchema = z.enum(VISUAL_ROLE_ZERO_SUPPORTING_EXCEPTIONS);
export const materialRequirementStateSchema = z.enum(MATERIAL_REQUIREMENT_STATES);
export const materialBindingStateSchema = z.enum(MATERIAL_BINDING_STATES);
export const materialAssetOriginSchema = z.enum(MATERIAL_ASSET_ORIGINS);
export const materialRequirementResponseKindSchema = z.enum(MATERIAL_REQUIREMENT_RESPONSES);
export const visualRolePlanProposalKindSchema = z.enum(VISUAL_ROLE_PLAN_PROPOSAL_KINDS);
export const visualRolePlanProposalStateSchema = z.enum(VISUAL_ROLE_PLAN_PROPOSAL_STATES);
export const visualRolePlanProposalDecisionReasonSchema = z.enum(VISUAL_ROLE_PLAN_PROPOSAL_DECISION_REASONS);
export const visualRoleSlotSchema = z.enum(["MAIN", "SUPPORT_1", "SUPPORT_2"]);

export type VisualRoleMainKind = z.infer<typeof visualRoleMainKindSchema>;
export type VisualRoleSupportingKind = z.infer<typeof visualRoleSupportingKindSchema>;
export type VisualRoleSourceKind = z.infer<typeof visualRoleSourceKindSchema>;
export type VisualRoleSlot = z.infer<typeof visualRoleSlotSchema>;

export const VISUAL_ROLE_ROUTE_BY_MAIN_KIND = {
  PERSON: "PERSON_DELIVERY",
  SCREEN_RECORDING: "SCREEN_OPERATION",
  LIVE_DEMONSTRATION: "LIVE_DEMONSTRATION",
  EVIDENCE_MEDIA: "EVIDENCE_REVIEW",
  STRUCTURED_EXPLANATION: "DESIGNED_INFORMATION",
  TEXT_COMPOSITION: "DESIGNED_INFORMATION",
} as const satisfies Record<VisualRoleMainKind, z.infer<typeof visualParagraphTypeV2Schema>>;

export const VISUAL_ROLE_MAIN_SOURCE_MATRIX = {
  PERSON: ["PERSON_SEGMENT"],
  SCREEN_RECORDING: ["SCREEN_SEGMENT"],
  LIVE_DEMONSTRATION: ["LIVE_ACTION_SEGMENT"],
  EVIDENCE_MEDIA: [
    "EVIDENCE_VIDEO_SEGMENT",
    "IMAGE_REGION",
    "DOCUMENT_REGION",
    "SCREENSHOT_REGION",
    "DATA_TABLE_REGION",
    "BRAND_ASSET",
  ],
  STRUCTURED_EXPLANATION: [
    "CONFIRMED_FACT_SET",
    "CONFIRMED_RELATION_SET",
    "CONFIRMED_STEP_SEQUENCE",
    "CONFIRMED_METADATA",
    "TRANSCRIPT_WORD_SET",
  ],
  TEXT_COMPOSITION: [
    "TRANSCRIPT_WORD_SET",
    "USER_CONFIRMED_TEXT",
    "CONFIRMED_FACT_SET",
    "CONFIRMED_METADATA",
  ],
} as const satisfies Record<VisualRoleMainKind, readonly VisualRoleSourceKind[]>;

export const VISUAL_ROLE_SUPPORTING_SOURCE_MATRIX = {
  KEY_TEXT: ["TRANSCRIPT_WORD_SET", "USER_CONFIRMED_TEXT", "CONFIRMED_FACT_SET", "CONFIRMED_METADATA"],
  PERSON_PIP: ["PERSON_SEGMENT"],
  DETAIL_VIEW: [
    "SCREEN_SEGMENT",
    "LIVE_ACTION_SEGMENT",
    "EVIDENCE_VIDEO_SEGMENT",
    "IMAGE_REGION",
    "DOCUMENT_REGION",
    "SCREENSHOT_REGION",
    "DATA_TABLE_REGION",
  ],
  ANNOTATION: [],
  CONTEXT_LABEL: ["TRANSCRIPT_WORD_SET", "USER_CONFIRMED_TEXT", "CONFIRMED_METADATA", "BRAND_ASSET"],
  MINI_EXPLANATION: [
    "CONFIRMED_FACT_SET",
    "CONFIRMED_RELATION_SET",
    "CONFIRMED_STEP_SEQUENCE",
    "CONFIRMED_METADATA",
    "TRANSCRIPT_WORD_SET",
  ],
  DECORATIVE_ACCENT: [],
} as const satisfies Record<VisualRoleSupportingKind, readonly VisualRoleSourceKind[]>;

export const VISUAL_ROLE_SUPPORTING_COMPATIBILITY = {
  PERSON: ["KEY_TEXT", "DETAIL_VIEW", "ANNOTATION", "CONTEXT_LABEL", "MINI_EXPLANATION", "DECORATIVE_ACCENT"],
  SCREEN_RECORDING: [...VISUAL_ROLE_SUPPORTING_KINDS],
  LIVE_DEMONSTRATION: [...VISUAL_ROLE_SUPPORTING_KINDS],
  EVIDENCE_MEDIA: [...VISUAL_ROLE_SUPPORTING_KINDS],
  STRUCTURED_EXPLANATION: ["KEY_TEXT", "PERSON_PIP", "DETAIL_VIEW", "ANNOTATION", "CONTEXT_LABEL", "DECORATIVE_ACCENT"],
  TEXT_COMPOSITION: ["PERSON_PIP", "DETAIL_VIEW", "CONTEXT_LABEL", "DECORATIVE_ACCENT"],
} as const satisfies Record<VisualRoleMainKind, readonly VisualRoleSupportingKind[]>;

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function exactSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

const unicodeMarkPattern = /^\p{Mark}$/u;

function graphemeCount(value: string): number {
  const codePoints = [...value.normalize("NFC")];
  let count = 0;
  let regionalIndicatorRun = 0;
  let joinedToPrevious = false;
  let previousWasCarriageReturn = false;
  for (const character of codePoints) {
    const codePoint = character.codePointAt(0)!;
    const isRegionalIndicator = codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
    const isVariationSelector = (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
      || (codePoint >= 0xe0100 && codePoint <= 0xe01ef);
    const isEmojiModifier = codePoint >= 0x1f3fb && codePoint <= 0x1f3ff;
    const isEmojiTag = codePoint >= 0xe0020 && codePoint <= 0xe007f;
    const isZeroWidthJoiner = codePoint === 0x200d;
    const isCombiningMark = unicodeMarkPattern.test(character);
    if (isZeroWidthJoiner) {
      joinedToPrevious = count > 0;
      previousWasCarriageReturn = false;
      continue;
    }
    if (isCombiningMark || isVariationSelector || isEmojiModifier || isEmojiTag || joinedToPrevious) {
      joinedToPrevious = false;
      previousWasCarriageReturn = false;
      regionalIndicatorRun = isRegionalIndicator ? regionalIndicatorRun + 1 : 0;
      continue;
    }
    if (character === "\n" && previousWasCarriageReturn) {
      previousWasCarriageReturn = false;
      regionalIndicatorRun = 0;
      continue;
    }
    if (isRegionalIndicator) {
      if (regionalIndicatorRun % 2 === 0) count += 1;
      regionalIndicatorRun += 1;
    } else {
      count += 1;
      regionalIndicatorRun = 0;
    }
    previousWasCarriageReturn = character === "\r";
  }
  return count;
}

const boundedGraphemeString = (maximum: number) => z.string().trim().min(1).refine(
  (value) => graphemeCount(value) <= maximum,
  `must contain at most ${maximum} grapheme clusters`,
);

export const visualRoleTechnicalMetadataSchema = z.object({
  mediaKind: z.enum(["VIDEO", "IMAGE", "DOCUMENT", "TABLE", "TEXT", "FACTS", "RELATIONS", "STEPS", "METADATA", "BRAND"]),
  mimeType: z.string().trim().min(1).max(200).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationFrames: z.number().int().positive().nullable(),
  pageCount: z.number().int().positive().nullable(),
  rowCount: z.number().int().positive().nullable(),
  columnCount: z.number().int().positive().nullable(),
}).strict();

export const visualRoleMaterialLocatorSchema = z.string()
  .min(1)
  .max(1_024)
  .regex(/^(?:media|visual-role-v2\/materials)\/[A-Za-z0-9._-]+$/u);

type MaterialAssetHashInput = {
  assetId: string;
  projectId: string;
  timelineId: string;
  timelineRevision: number;
  origin: string;
  projectAssetId: string | null;
  locator: string;
  displayName: string;
  contentHash: string;
  byteLength: number;
  technicalMetadata: unknown;
  technicalValidation: string;
  createdAt: string;
  updatedAt: string;
};

export function materialAssetV2Hash(
  asset: MaterialAssetHashInput & { schemaVersion?: number; assetHash?: string },
): string {
  const { schemaVersion: _schemaVersion, assetHash: _assetHash, ...semantic } = asset;
  return canonicalHash(semantic);
}

export const materialAssetV2Schema = z.object({
  schemaVersion: z.literal(2),
  assetId: idSchema,
  assetHash: hashSchema,
  projectId: idSchema,
  timelineId: idSchema,
  timelineRevision: z.number().int().nonnegative(),
  origin: materialAssetOriginSchema,
  projectAssetId: idSchema.nullable(),
  locator: visualRoleMaterialLocatorSchema,
  displayName: z.string().trim().min(1).max(255),
  contentHash: hashSchema,
  byteLength: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  technicalMetadata: visualRoleTechnicalMetadataSchema,
  technicalValidation: z.literal("PASSED"),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((asset, context) => {
  if ((asset.origin === "PROJECT_ASSET") !== (asset.projectAssetId !== null)) {
    context.addIssue({ code: "custom", path: ["projectAssetId"], message: "project assets require one exact ProjectDocument asset id" });
  }
  if (asset.assetHash !== materialAssetV2Hash(asset)) {
    context.addIssue({ code: "custom", path: ["assetHash"], message: "material asset hash must match canonical content" });
  }
});

const normalizedRegionSchema = z.object({
  xPermille: z.number().int().min(0).max(999),
  yPermille: z.number().int().min(0).max(999),
  widthPermille: z.number().int().min(1).max(1_000),
  heightPermille: z.number().int().min(1).max(1_000),
}).strict().superRefine((region, context) => {
  if (region.xPermille + region.widthPermille > 1_000
    || region.yPermille + region.heightPermille > 1_000) {
    context.addIssue({ code: "custom", path: [], message: "normalized material region must stay inside the source" });
  }
});

export const materialSelectorV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("VIDEO_SEGMENT"),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
  }).strict().superRefine((segment, context) => {
    if (segment.endFrame <= segment.startFrame) {
      context.addIssue({ code: "custom", path: ["endFrame"], message: "video segment end must be after start" });
    }
  }),
  z.object({ kind: z.literal("IMAGE_WHOLE") }).strict(),
  z.object({ kind: z.literal("IMAGE_REGION"), region: normalizedRegionSchema }).strict(),
  z.object({
    kind: z.literal("DOCUMENT_REGION"),
    page: z.number().int().positive(),
    region: normalizedRegionSchema,
  }).strict(),
  z.object({
    kind: z.literal("TABLE_REGION"),
    rowStart: z.number().int().nonnegative(),
    rowEnd: z.number().int().positive(),
    columnStart: z.number().int().nonnegative(),
    columnEnd: z.number().int().positive(),
  }).strict().superRefine((region, context) => {
    if (region.rowEnd <= region.rowStart || region.columnEnd <= region.columnStart) {
      context.addIssue({ code: "custom", path: [], message: "table region ends must be after starts" });
    }
  }),
]);

type MaterialSelectionHashInput = {
  selectionId: string;
  assetId: string;
  derivedRegionOrSegmentId: string;
  sourceKind: string;
  selector: unknown;
  contentHash: string;
  technicalValidation: string;
  userSemanticDescription: string;
  userSemanticConfirmation: string;
  selectionRevision: number;
  createdAt: string;
  updatedAt: string;
};

export function materialSelectionV2Hash(
  selection: MaterialSelectionHashInput & { schemaVersion?: number; selectionHash?: string },
): string {
  const { schemaVersion: _schemaVersion, selectionHash: _selectionHash, ...semantic } = selection;
  return canonicalHash(semantic);
}

export const materialSelectionV2Schema = z.object({
  schemaVersion: z.literal(2),
  selectionId: idSchema,
  selectionHash: hashSchema,
  assetId: idSchema,
  derivedRegionOrSegmentId: idSchema,
  sourceKind: visualRoleSourceKindSchema,
  selector: materialSelectorV2Schema,
  contentHash: hashSchema,
  technicalValidation: z.literal("PASSED"),
  userSemanticDescription: z.string().trim().min(1).max(1_000),
  userSemanticConfirmation: z.enum(["PENDING", "CONFIRMED", "REJECTED"]),
  selectionRevision: z.number().int().positive(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((selection, context) => {
  if (selection.selectionHash !== materialSelectionV2Hash(selection)) {
    context.addIssue({ code: "custom", path: ["selectionHash"], message: "material selection hash must match canonical content" });
  }
});

export const materialAssetRegistrationV2Schema = z.object({
  origin: materialAssetOriginSchema,
  projectAssetId: idSchema.nullable(),
  locator: visualRoleMaterialLocatorSchema,
  displayName: z.string().trim().min(1).max(255),
  contentHash: hashSchema,
  byteLength: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  technicalMetadata: visualRoleTechnicalMetadataSchema,
  inspectedAt: isoInstantSchema,
}).strict();

export const existingSourceRefV2Schema = z.object({
  sourceRefId: idSchema,
  sourceKind: visualRoleSourceKindSchema,
  assetId: idSchema.nullable(),
  derivedRegionOrSegmentId: idSchema.nullable(),
  contentHash: hashSchema,
  technicalMetadata: visualRoleTechnicalMetadataSchema,
  userConfirmedSemanticDescription: z.string().trim().min(1).max(1_000),
  applicableParagraphIds: z.array(idSchema).min(1).max(512).optional(),
  confirmedAnchorRefIds: z.array(idSchema).max(64),
  revision: z.number().int().nonnegative(),
  manifestHash: hashSchema,
}).strict().superRefine((source, context) => {
  if (source.applicableParagraphIds !== undefined && !unique(source.applicableParagraphIds)) {
    context.addIssue({
      code: "custom",
      path: ["applicableParagraphIds"],
      message: "paragraph-scoped source ids must be unique",
    });
  }
});

type MaterialManifestHashInput = {
  manifestId: string;
  projectId: string;
  timelineId: string;
  revision: number;
  manifestRevision?: number;
  entries: Array<Omit<z.infer<typeof existingSourceRefV2Schema>, "manifestHash"> & { manifestHash?: string }>;
  createdAt: string;
};

export function materialManifestV2Hash(manifest: MaterialManifestHashInput): string {
  return canonicalHash({
    manifestId: manifest.manifestId,
    projectId: manifest.projectId,
    timelineId: manifest.timelineId,
    revision: manifest.revision,
    ...(manifest.manifestRevision === undefined ? {} : { manifestRevision: manifest.manifestRevision }),
    entries: manifest.entries.map(({ manifestHash: _ignored, ...entry }) => entry),
    createdAt: manifest.createdAt,
  });
}

export const materialManifestV2Schema = z.object({
  schemaVersion: z.literal(2),
  manifestId: idSchema,
  manifestHash: hashSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  manifestRevision: z.number().int().positive().optional(),
  entries: z.array(existingSourceRefV2Schema).max(4_096),
  createdAt: isoInstantSchema,
}).strict().superRefine((manifest, context) => {
  if (!unique(manifest.entries.map((entry) => entry.sourceRefId))) {
    context.addIssue({ code: "custom", path: ["entries"], message: "sourceRefId values must be unique" });
  }
  if (manifest.entries.some((entry) => entry.manifestHash !== manifest.manifestHash)) {
    context.addIssue({ code: "custom", path: ["entries"], message: "every source must bind the exact manifest hash" });
  }
  if (manifest.entries.some((entry) => entry.revision !== manifest.revision
    || !unique(entry.confirmedAnchorRefIds))) {
    context.addIssue({ code: "custom", path: ["entries"], message: "source revisions and confirmed anchor identities must be exact" });
  }
  if (manifest.manifestHash !== materialManifestV2Hash(manifest)) {
    context.addIssue({ code: "custom", path: ["manifestHash"], message: "manifest hash must match canonical content" });
  }
});

export const visualParagraphStructureBoundaryEvidenceV2Schema = z.object({
  reasonCodes: z.array(z.string().trim().min(1).max(128)).max(16),
  evidenceWordIds: z.array(idSchema).max(32),
  reviewRequired: z.boolean(),
}).strict();

type StructureParagraphHashInput = {
  paragraphId: string;
  order: number;
  stableWordRange: {
    startWordId: string;
    endWordId: string;
    includedWordIds: string[];
  };
  primaryExpressionTask: string;
  informationDuty: string;
  boundaryEvidence: unknown;
};

export function visualParagraphStructureParagraphV2Hash(paragraph: StructureParagraphHashInput): string {
  return canonicalHash({
    paragraphId: paragraph.paragraphId,
    order: paragraph.order,
    stableWordRange: paragraph.stableWordRange,
    primaryExpressionTask: paragraph.primaryExpressionTask,
    informationDuty: paragraph.informationDuty,
    boundaryEvidence: paragraph.boundaryEvidence,
  });
}

export const visualParagraphStructureParagraphV2Schema = z.object({
  paragraphId: idSchema,
  paragraphHash: hashSchema,
  order: z.number().int().nonnegative().max(511),
  stableWordRange: z.object({
    startWordId: idSchema,
    endWordId: idSchema,
    includedWordIds: z.array(idSchema).min(1).max(20_000),
  }).strict(),
  primaryExpressionTask: expressionTaskIdSchema,
  informationDuty: z.string().trim().min(1).max(300),
  boundaryEvidence: visualParagraphStructureBoundaryEvidenceV2Schema.nullable(),
}).strict().superRefine((paragraph, context) => {
  const words = paragraph.stableWordRange.includedWordIds;
  if (!unique(words)
    || words[0] !== paragraph.stableWordRange.startWordId
    || words.at(-1) !== paragraph.stableWordRange.endWordId) {
    context.addIssue({ code: "custom", path: ["stableWordRange"], message: "stable word range must be unique and endpoint-bound" });
  }
  if (paragraph.paragraphHash !== visualParagraphStructureParagraphV2Hash(paragraph)) {
    context.addIssue({ code: "custom", path: ["paragraphHash"], message: "paragraph hash must match canonical structure" });
  }
});

type StructureSnapshotHashInput = {
  structureSnapshotId: string;
  projectId: string;
  sessionId: string;
  timelineId: string;
  baseRevision: number;
  foundationHash: string;
  baseVisualParagraphProposalId: string;
  baseVisualParagraphProposalHash: string;
  paragraphs: unknown[];
  createdAt: string;
};

export function visualParagraphStructureSnapshotV2Hash(snapshot: StructureSnapshotHashInput): string {
  return canonicalHash({
    structureSnapshotId: snapshot.structureSnapshotId,
    projectId: snapshot.projectId,
    sessionId: snapshot.sessionId,
    timelineId: snapshot.timelineId,
    baseRevision: snapshot.baseRevision,
    foundationHash: snapshot.foundationHash,
    baseVisualParagraphProposalId: snapshot.baseVisualParagraphProposalId,
    baseVisualParagraphProposalHash: snapshot.baseVisualParagraphProposalHash,
    paragraphs: snapshot.paragraphs,
    createdAt: snapshot.createdAt,
  });
}

export const visualParagraphStructureSnapshotV2Schema = z.object({
  schemaVersion: z.literal(2),
  structureSnapshotId: idSchema,
  structureHash: hashSchema,
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  foundationHash: hashSchema,
  baseVisualParagraphProposalId: idSchema,
  baseVisualParagraphProposalHash: hashSchema,
  paragraphs: z.array(visualParagraphStructureParagraphV2Schema).min(1).max(512),
  createdAt: isoInstantSchema,
}).strict().superRefine((snapshot, context) => {
  if (!unique(snapshot.paragraphs.map((paragraph) => paragraph.paragraphId))
    || snapshot.paragraphs.some((paragraph, order) => paragraph.order !== order)) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "structure paragraphs must be unique and contiguous" });
  }
  const words = snapshot.paragraphs.flatMap((paragraph) => paragraph.stableWordRange.includedWordIds);
  if (!unique(words)) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "structure paragraphs must not overlap stable word ids" });
  }
  if (snapshot.structureHash !== visualParagraphStructureSnapshotV2Hash(snapshot)) {
    context.addIssue({ code: "custom", path: ["structureHash"], message: "structure hash must match canonical content" });
  }
});

export const materialCardinalityV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SINGLE"), exactCount: z.literal(1) }).strict(),
  z.object({ kind: z.literal("FIXED_SET"), exactCount: z.number().int().min(2).max(4) }).strict(),
  z.object({ kind: z.literal("ORDERED_SEQUENCE"), exactCount: z.number().int().min(2).max(5) }).strict(),
]);

export const materialAcceptanceCriteriaV2Schema = z.object({
  mustShow: z.array(z.string().trim().min(1).max(300)).min(1).max(12),
  mustNotShow: z.array(z.string().trim().min(1).max(300)).max(12),
  continuityNeed: z.string().trim().min(1).max(300).nullable(),
  legibilityNeed: z.string().trim().min(1).max(300).nullable(),
}).strict();

export const materialRequirementDraftV2Schema = z.object({
  requiredSourceKind: visualRoleSourceKindSchema,
  subject: z.string().trim().min(1).max(300),
  requiredContent: z.array(z.string().trim().min(1).max(300)).min(1).max(12),
  requiredActionOrState: z.string().trim().min(1).max(300).nullable(),
  purpose: z.string().trim().min(1).max(500),
  evidenceWordIds: z.array(idSchema).min(1).max(64),
  acceptanceCriteria: materialAcceptanceCriteriaV2Schema,
  cardinality: materialCardinalityV2Schema,
}).strict();

type RequirementHashInput = {
  requirementId: string;
  paragraphId: string;
  visualSlot: string;
  visualObjectId: string;
  priority: string;
  requiredSourceKind: string;
  subject: string;
  requiredContent: string[];
  requiredActionOrState: string | null;
  purpose: string;
  evidenceWordIds: string[];
  acceptanceCriteria: unknown;
  cardinality: unknown;
  status: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export function materialRequirementV2Hash(
  requirement: RequirementHashInput & { requirementHash?: string },
): string {
  const { requirementHash: _ignored, ...semantic } = requirement;
  return canonicalHash(semantic);
}

export const materialRequirementV2Schema = materialRequirementDraftV2Schema.extend({
  requirementId: idSchema,
  requirementHash: hashSchema,
  paragraphId: idSchema,
  visualSlot: visualRoleSlotSchema,
  visualObjectId: idSchema,
  priority: z.literal("REQUIRED_FOR_IDEAL_PLAN"),
  status: materialRequirementStateSchema,
  revision: z.number().int().positive(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((requirement, context) => {
  if (!unique(requirement.evidenceWordIds)) {
    context.addIssue({ code: "custom", path: ["evidenceWordIds"], message: "requirement evidence must be unique" });
  }
  if (requirement.requirementHash !== materialRequirementV2Hash(requirement)) {
    context.addIssue({ code: "custom", path: ["requirementHash"], message: "requirement hash must match canonical content" });
  }
});

type MaterialRequirementResponseHashInput = {
  responseId: string;
  requirementId: string;
  requirementHashBefore: string;
  response: string;
  assetId: string | null;
  note: string | null;
  resultingStatus: string;
  createdAt: string;
};

export function materialRequirementResponseV2Hash(
  response: MaterialRequirementResponseHashInput & { schemaVersion?: number; responseHash?: string },
): string {
  const { schemaVersion: _schemaVersion, responseHash: _responseHash, ...semantic } = response;
  return canonicalHash(semantic);
}

export const materialRequirementResponseV2Schema = z.object({
  schemaVersion: z.literal(2),
  responseId: idSchema,
  responseHash: hashSchema,
  requirementId: idSchema,
  requirementHashBefore: hashSchema,
  response: materialRequirementResponseKindSchema,
  assetId: idSchema.nullable(),
  note: z.string().trim().min(1).max(1_000).nullable(),
  resultingStatus: materialRequirementStateSchema,
  createdAt: isoInstantSchema,
}).strict().superRefine((response, context) => {
  if ((response.response === "PROVIDED") !== (response.assetId !== null)) {
    context.addIssue({ code: "custom", path: ["assetId"], message: "PROVIDED requires one exact registered material asset" });
  }
  if (response.responseHash !== materialRequirementResponseV2Hash(response)) {
    context.addIssue({ code: "custom", path: ["responseHash"], message: "material response hash must match canonical content" });
  }
});

export const visualRoleSubmissionSourceV2Schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("EXISTING_SOURCE"), sourceRefId: idSchema }).strict(),
  z.object({ mode: z.literal("MATERIAL_REQUIREMENT"), requirement: materialRequirementDraftV2Schema }).strict(),
  z.object({
    mode: z.literal("DERIVED_FROM_PARENT"),
    parentSlot: visualRoleSlotSchema,
    anchorRefIds: z.array(idSchema).min(1).max(3),
  }).strict(),
  z.object({ mode: z.literal("NO_EXTERNAL_MATERIAL"), nonContentBearing: z.literal(true) }).strict(),
]);

export const visualRolePersistentSourceV2Schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("EXISTING_SOURCE"),
    sourceRefId: idSchema,
    sourceKind: visualRoleSourceKindSchema,
    contentHash: hashSchema,
    manifestHash: hashSchema,
  }).strict(),
  z.object({
    mode: z.literal("MATERIAL_REQUIREMENT"),
    requirementId: idSchema,
    requiredSourceKind: visualRoleSourceKindSchema,
  }).strict(),
  z.object({
    mode: z.literal("DERIVED_FROM_PARENT"),
    parentVisualObjectId: idSchema,
    anchorRefIds: z.array(idSchema).min(1).max(3),
  }).strict(),
  z.object({ mode: z.literal("NO_EXTERNAL_MATERIAL"), nonContentBearing: z.literal(true) }).strict(),
]);

export const personMainContentV2Schema = z.object({
  focalSubject: z.string().trim().min(1).max(200),
  participantCount: z.number().int().min(1).max(2),
  attentionOwner: z.string().trim().min(1).max(200),
}).strict();

export const screenRecordingMainContentV2Schema = z.object({
  objective: z.string().trim().min(1).max(300),
  orderedOperations: z.array(z.string().trim().min(1).max(200)).min(1).max(5),
}).strict();

export const liveDemonstrationMainContentV2Schema = z.object({
  objective: z.string().trim().min(1).max(300),
  orderedSteps: z.array(z.string().trim().min(1).max(200)).min(1).max(5),
}).strict();

export const evidenceMediaMainContentV2Schema = z.object({
  evidenceItems: z.array(z.string().trim().min(1).max(300)).min(1).max(2),
  comparisonDimension: z.string().trim().min(1).max(200).nullable(),
}).strict().superRefine((content, context) => {
  if ((content.evidenceItems.length === 2) !== (content.comparisonDimension !== null)) {
    context.addIssue({ code: "custom", path: ["comparisonDimension"], message: "two evidence items require one shared comparison dimension" });
  }
});

export const structuredExplanationMainContentV2Schema = z.discriminatedUnion("structureKind", [
  z.object({ structureKind: z.literal("FLOW"), nodeCount: z.number().int().min(2).max(5), edgeCount: z.number().int().min(1).max(4) }).strict(),
  z.object({ structureKind: z.literal("COMPARISON"), sideCount: z.literal(2), dimensionCount: z.number().int().min(1).max(3) }).strict(),
  z.object({ structureKind: z.literal("DATA"), valueCount: z.number().int().min(1).max(4) }).strict(),
  z.object({ structureKind: z.literal("RELATION"), nodeCount: z.number().int().min(2).max(5), edgeCount: z.number().int().min(1).max(6) }).strict(),
]);

export const textCompositionMainContentV2Schema = z.object({
  text: boundedGraphemeString(VISUAL_ROLE_SEMANTIC_TEXT_GRAPHEME_LIMIT),
}).strict();

export const keyTextSupportingContentV2Schema = z.object({
  text: boundedGraphemeString(VISUAL_ROLE_SEMANTIC_TEXT_GRAPHEME_LIMIT),
}).strict();
export const personPipSupportingContentV2Schema = z.object({ subject: z.string().trim().min(1).max(200) }).strict();
export const detailViewSupportingContentV2Schema = z.object({ detailSubject: z.string().trim().min(1).max(300) }).strict();
export const annotationSupportingContentV2Schema = z.object({
  anchors: z.array(z.object({
    anchorRefId: idSchema,
    label: boundedGraphemeString(VISUAL_ROLE_SEMANTIC_TEXT_GRAPHEME_LIMIT),
  }).strict()).min(1).max(3),
}).strict();
export const contextLabelSupportingContentV2Schema = z.object({
  entries: z.array(z.object({
    label: boundedGraphemeString(VISUAL_ROLE_SEMANTIC_TEXT_GRAPHEME_LIMIT),
    value: boundedGraphemeString(VISUAL_ROLE_SEMANTIC_TEXT_GRAPHEME_LIMIT),
  }).strict()).min(1).max(2),
}).strict();
export const miniExplanationSupportingContentV2Schema = z.object({
  items: z.array(z.string().trim().min(1).max(200)).min(2).max(3),
  relationCount: z.number().int().min(0).max(2),
}).strict();
export const decorativeAccentSupportingContentV2Schema = z.object({
  elementCount: z.number().int().min(1).max(3),
  nonContentBearing: z.literal(true),
}).strict();

export const visualRoleObjectSubmissionV2Schema = z.object({
  slot: visualRoleSlotSchema,
  kind: visualRoleObjectKindSchema,
  informationDuty: z.string().trim().min(1).max(300),
  supportDuty: visualRoleSupportDutySchema.nullable(),
  strength: z.enum(["STRONG", "LIGHT"]).nullable(),
  source: visualRoleSubmissionSourceV2Schema,
  evidenceWordIds: z.array(idSchema).min(1).max(64),
  content: jsonObjectSchema,
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict();

type VisualObjectHashInput = {
  visualObjectId: string;
  slot: string;
  role: string;
  kind: string;
  informationDuty: string;
  supportDuty: string | null;
  strength: string | null;
  source: unknown;
  evidenceWordIds: string[];
  content: unknown;
  mustBeLargest: boolean;
  mustRemainUnderstandableWithoutSupportingVisuals: boolean;
  confidence: number;
  reviewRequired: boolean;
};

export function visualRoleObjectV2Hash(
  object: VisualObjectHashInput & { visualObjectHash?: string },
): string {
  const { visualObjectHash: _ignored, ...semantic } = object;
  return canonicalHash(semantic);
}

export const visualRoleObjectV2Schema = z.object({
  visualObjectId: idSchema,
  visualObjectHash: hashSchema,
  slot: visualRoleSlotSchema,
  role: z.enum(["MAIN", "SUPPORTING"]),
  kind: visualRoleObjectKindSchema,
  informationDuty: z.string().trim().min(1).max(300),
  supportDuty: visualRoleSupportDutySchema.nullable(),
  strength: z.enum(["STRONG", "LIGHT"]).nullable(),
  source: visualRolePersistentSourceV2Schema,
  evidenceWordIds: z.array(idSchema).min(1).max(64),
  content: jsonObjectSchema,
  mustBeLargest: z.boolean(),
  mustRemainUnderstandableWithoutSupportingVisuals: z.boolean(),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((object, context) => {
  const isMain = object.slot === "MAIN";
  if (isMain !== (object.role === "MAIN")
    || isMain !== (object.supportDuty === null)
    || isMain !== (object.strength === null)
    || isMain !== object.mustBeLargest
    || isMain !== object.mustRemainUnderstandableWithoutSupportingVisuals
    || (isMain && !VISUAL_ROLE_MAIN_KINDS.includes(object.kind as VisualRoleMainKind))
    || (!isMain && !VISUAL_ROLE_SUPPORTING_KINDS.includes(object.kind as VisualRoleSupportingKind))) {
    context.addIssue({ code: "custom", path: ["role"], message: "slot, role, kind, strength and main invariants must agree" });
  }
  if (!unique(object.evidenceWordIds)) {
    context.addIssue({ code: "custom", path: ["evidenceWordIds"], message: "visual evidence word ids must be unique" });
  }
  if (object.visualObjectHash !== visualRoleObjectV2Hash(object)) {
    context.addIssue({ code: "custom", path: ["visualObjectHash"], message: "visual object hash must match canonical content" });
  }
});

export const supportingCandidateAuditV2Schema = z.object({
  candidateKindsConsidered: z.array(visualRoleSupportingKindSchema).max(7),
  candidateSourceRefIdsConsidered: z.array(idSchema).max(256),
  userForbiddenKinds: z.array(visualRoleSupportingKindSchema).max(7),
  selectedSlots: z.array(z.enum(["SUPPORT_1", "SUPPORT_2"])).max(2),
  rejectedCandidates: z.array(z.object({
    kind: visualRoleSupportingKindSchema,
    reasonCode: visualRoleRejectionCodeSchema,
  }).strict()).max(7),
  zeroSupportingExceptionCode: visualRoleZeroSupportingExceptionSchema.nullable(),
}).strict().superRefine((audit, context) => {
  for (const values of [
    audit.candidateKindsConsidered,
    audit.candidateSourceRefIdsConsidered,
    audit.userForbiddenKinds,
    audit.selectedSlots,
    audit.rejectedCandidates.map((candidate) => candidate.kind),
  ]) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [], message: "candidate audit arrays must be unique" });
  }
});

export const mainCandidateAuditV2Schema = z.object({
  candidateKindsConsidered: z.array(visualRoleMainKindSchema).length(VISUAL_ROLE_MAIN_KINDS.length),
  selectedKind: visualRoleMainKindSchema,
  rejectedCandidates: z.array(z.object({
    kind: visualRoleMainKindSchema,
    reasonCode: visualRoleMainRejectionCodeSchema,
    evidenceWordIds: z.array(idSchema).min(1).max(12),
    rationale: z.string().trim().min(1).max(300),
  }).strict()).length(VISUAL_ROLE_MAIN_KINDS.length - 1),
  strongestAlternativeKind: visualRoleMainKindSchema,
  strongestAlternativeRationale: z.string().trim().min(1).max(300),
  selectedIndependentCarrier: z.literal(true),
}).strict().superRefine((audit, context) => {
  const rejectedKinds = audit.rejectedCandidates.map((candidate) => candidate.kind);
  if (!unique(audit.candidateKindsConsidered)
    || !unique(rejectedKinds)
    || audit.rejectedCandidates.some((candidate) => !unique(candidate.evidenceWordIds))) {
    context.addIssue({ code: "custom", path: [], message: "main candidate audit arrays must be unique" });
  }
  if (!exactSet(audit.candidateKindsConsidered, VISUAL_ROLE_MAIN_KINDS)) {
    context.addIssue({
      code: "custom",
      path: ["candidateKindsConsidered"],
      message: "main candidate audit must consider every closed MAIN kind exactly once",
    });
  }
  const expectedRejected = VISUAL_ROLE_MAIN_KINDS.filter((kind) => kind !== audit.selectedKind);
  if (!exactSet(rejectedKinds, expectedRejected)) {
    context.addIssue({
      code: "custom",
      path: ["rejectedCandidates"],
      message: "main candidate audit must reject every unselected MAIN kind exactly once",
    });
  }
  if (audit.strongestAlternativeKind === audit.selectedKind
    || !rejectedKinds.includes(audit.strongestAlternativeKind)) {
    context.addIssue({
      code: "custom",
      path: ["strongestAlternativeKind"],
      message: "strongest alternative must be one rejected MAIN kind",
    });
  }
});

export const visualRoleParagraphSubmissionV2Schema = z.object({
  paragraphId: idSchema,
  visualObjects: z.array(visualRoleObjectSubmissionV2Schema).min(1).max(4),
  // Optional only for byte/hash compatibility with already persisted V2 plans.
  // Every new DSH ideal-role lock is required to materialize this audit.
  mainCandidateAudit: mainCandidateAuditV2Schema.optional(),
  supportingCandidateAudit: supportingCandidateAuditV2Schema,
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict();

export const visualRolePlanSubmissionV2Schema = z.object({
  kind: z.literal("PLAN"),
  structureSnapshotId: idSchema,
  structureHash: hashSchema,
  materialManifestId: idSchema,
  materialManifestHash: hashSchema,
  paragraphs: z.array(visualRoleParagraphSubmissionV2Schema).min(1).max(512),
  submittedAt: isoInstantSchema,
}).strict();

export const visualRoleStructureReviewRequiredV2Schema = z.object({
  kind: z.literal("STRUCTURE_REVIEW_REQUIRED"),
  structureSnapshotId: idSchema,
  structureHash: hashSchema,
  affectedParagraphIds: z.array(idSchema).min(1).max(512),
  evidenceWordIds: z.array(idSchema).min(1).max(128),
  reasonCode: z.enum([
    "MULTIPLE_PRIMARY_TASKS_INSIDE_PARAGRAPH",
    "MAIN_VISUAL_SWITCH_INSIDE_PARAGRAPH",
  ]),
  rationale: z.string().trim().min(1).max(1_000),
}).strict();

export const visualRoleSubmissionV2Schema = z.discriminatedUnion("kind", [
  visualRolePlanSubmissionV2Schema,
  visualRoleStructureReviewRequiredV2Schema,
]);

type PlanParagraphHashInput = {
  paragraphId: string;
  stableWordRange: unknown;
  visualParagraphType: string;
  primaryExpressionTask: string;
  informationDuty: string;
  mainVisual: unknown;
  supportingVisuals: unknown[];
  mainCandidateAudit?: unknown;
  supportingCandidateAudit: unknown;
  materialRequirementIds: string[];
  confidence: number;
  reviewRequired: boolean;
};

export function visualRolePlanParagraphV2Hash(
  paragraph: PlanParagraphHashInput & { paragraphDesignHash?: string },
): string {
  const { paragraphDesignHash: _ignored, ...semantic } = paragraph;
  return canonicalHash(semantic);
}

export const visualRolePlanParagraphV2Schema = z.object({
  paragraphId: idSchema,
  paragraphDesignHash: hashSchema,
  stableWordRange: z.object({
    startWordId: idSchema,
    endWordId: idSchema,
    includedWordIds: z.array(idSchema).min(1).max(20_000),
  }).strict(),
  visualParagraphType: visualParagraphTypeV2Schema,
  primaryExpressionTask: expressionTaskIdSchema,
  informationDuty: z.string().trim().min(1).max(300),
  mainVisual: visualRoleObjectV2Schema,
  supportingVisuals: z.array(visualRoleObjectV2Schema).max(2),
  // Missing on legacy V2 bytes; present and hash-bound on all newly generated DSH plans.
  mainCandidateAudit: mainCandidateAuditV2Schema.optional(),
  supportingCandidateAudit: supportingCandidateAuditV2Schema,
  materialRequirementIds: z.array(idSchema).max(3),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
}).strict().superRefine((paragraph, context) => {
  if (paragraph.mainVisual.role !== "MAIN" || paragraph.mainVisual.slot !== "MAIN") {
    context.addIssue({ code: "custom", path: ["mainVisual"], message: "paragraph requires exactly one MAIN visual" });
  }
  if (!unique(paragraph.supportingVisuals.map((visual) => visual.visualObjectId))
    || !unique(paragraph.materialRequirementIds)) {
    context.addIssue({ code: "custom", path: ["supportingVisuals"], message: "supporting visuals and requirements must be unique" });
  }
  if (paragraph.paragraphDesignHash !== visualRolePlanParagraphV2Hash(paragraph)) {
    context.addIssue({ code: "custom", path: ["paragraphDesignHash"], message: "paragraph design hash must match canonical content" });
  }
});

type VisualRolePlanHashInput = {
  planId: string;
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
  materialManifestId: string;
  materialManifestHash: string;
  status: string;
  paragraphs: unknown[];
  materialRequirementIds: string[];
  createdAt: string;
  updatedAt: string;
};

export function visualRolePlanV2Hash(
  plan: VisualRolePlanHashInput & { schemaVersion?: number; planHash?: string },
): string {
  const { schemaVersion: _schemaVersion, planHash: _planHash, ...semantic } = plan;
  return canonicalHash(semantic);
}

export const visualRolePlanV2Schema = z.object({
  schemaVersion: z.literal(2),
  planId: idSchema,
  planHash: hashSchema,
  revision: z.number().int().positive(),
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  foundationHash: hashSchema,
  structureSnapshotId: idSchema,
  structureHash: hashSchema,
  baseVisualParagraphProposalId: idSchema,
  baseVisualParagraphProposalHash: hashSchema,
  materialManifestId: idSchema,
  materialManifestHash: hashSchema,
  status: z.enum(["WAITING_MATERIALS", "REVIEW_REQUIRED", "READY_FOR_REVIEW"]),
  paragraphs: z.array(visualRolePlanParagraphV2Schema).min(1).max(512),
  materialRequirementIds: z.array(idSchema).max(1_536),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((plan, context) => {
  if (!unique(plan.paragraphs.map((paragraph) => paragraph.paragraphId)) || !unique(plan.materialRequirementIds)) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "plan paragraph and requirement ids must be unique" });
  }
  if (plan.planHash !== visualRolePlanV2Hash(plan)) {
    context.addIssue({ code: "custom", path: ["planHash"], message: "plan hash must match canonical content" });
  }
});

type BindingHashInput = {
  bindingId: string;
  requirementId: string;
  sourceSelectionIds?: string[];
  sourceRefIds: string[];
  sourceContentHashes: string[];
  materialManifestId?: string | null;
  materialManifestHash?: string | null;
  provisionMode?: string;
  technicalValidation: string;
  userSemanticConfirmation: string;
  bindingRevision: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function materialBindingV2Hash(
  binding: BindingHashInput & { schemaVersion?: number; bindingHash?: string },
): string {
  const { schemaVersion: _schemaVersion, bindingHash: _bindingHash, ...semantic } = binding;
  return canonicalHash(semantic);
}

export const materialBindingV2Schema = z.object({
  schemaVersion: z.literal(2),
  bindingId: idSchema,
  bindingHash: hashSchema,
  requirementId: idSchema,
  sourceSelectionIds: z.array(idSchema).min(1).max(5).optional(),
  sourceRefIds: z.array(idSchema).max(5),
  sourceContentHashes: z.array(hashSchema).max(5),
  materialManifestId: idSchema.nullable().optional(),
  materialManifestHash: hashSchema.nullable().optional(),
  provisionMode: z.enum(["SELECTED_EXISTING", "UPLOADED", "MIXED"]).optional(),
  technicalValidation: z.enum(["PENDING", "PASSED", "FAILED"]),
  userSemanticConfirmation: z.enum(["PENDING", "CONFIRMED", "REJECTED"]),
  bindingRevision: z.number().int().positive(),
  status: materialBindingStateSchema,
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
}).strict().superRefine((binding, context) => {
  if (!unique(binding.sourceRefIds)
    || binding.sourceRefIds.length !== binding.sourceContentHashes.length) {
    context.addIssue({ code: "custom", path: ["sourceRefIds"], message: "binding sources must be unique and content-hash aligned" });
  }
  if (binding.sourceSelectionIds !== undefined && !unique(binding.sourceSelectionIds)) {
    context.addIssue({ code: "custom", path: ["sourceSelectionIds"], message: "binding material selections must be unique" });
  }
  const hasManifestBinding = binding.materialManifestId !== undefined
    || binding.materialManifestHash !== undefined;
  if (hasManifestBinding
    && ((binding.materialManifestId ?? null) === null) !== ((binding.materialManifestHash ?? null) === null)) {
    context.addIssue({ code: "custom", path: ["materialManifestId"], message: "binding manifest id and hash must be both present or absent" });
  }
  if (binding.status === "SATISFIED"
    && (binding.technicalValidation !== "PASSED"
      || binding.userSemanticConfirmation !== "CONFIRMED"
      || binding.sourceRefIds.length === 0)) {
    context.addIssue({ code: "custom", path: ["status"], message: "satisfied binding requires technical and semantic confirmation" });
  }
  if (binding.sourceSelectionIds !== undefined
    && binding.status !== "SATISFIED"
    && binding.sourceRefIds.length > 0) {
    context.addIssue({ code: "custom", path: ["sourceRefIds"], message: "only a satisfied binding may expose confirmed source refs" });
  }
  if (binding.bindingHash !== materialBindingV2Hash(binding)) {
    context.addIssue({ code: "custom", path: ["bindingHash"], message: "binding hash must match canonical content" });
  }
});

export const registerUploadedVisualRoleMaterialRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  locator: visualRoleMaterialLocatorSchema.refine(
    (value) => value.startsWith("visual-role-v2/materials/"),
    "uploaded Smart Packaging materials must use the managed material directory",
  ),
  displayName: z.string().trim().min(1).max(255),
  registeredAt: isoInstantSchema,
}).strict();

export const registerProjectVisualRoleMaterialRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  projectAssetId: idSchema,
  registeredAt: isoInstantSchema,
}).strict();

export const respondVisualRoleMaterialRequirementRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  requirementId: idSchema,
  requirementHash: hashSchema,
  response: materialRequirementResponseKindSchema,
  assetId: idSchema.nullable(),
  note: z.string().trim().min(1).max(1_000).nullable(),
  respondedAt: isoInstantSchema,
}).strict();

export const materialSelectionDraftV2Schema = z.object({
  assetId: idSchema,
  selector: materialSelectorV2Schema,
  userSemanticDescription: z.string().trim().min(1).max(1_000),
}).strict();

export const saveVisualRoleMaterialBindingRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  requirementId: idSchema,
  requirementHash: hashSchema,
  selections: z.array(materialSelectionDraftV2Schema).min(1).max(5),
  savedAt: isoInstantSchema,
}).strict();

export const confirmVisualRoleMaterialBindingRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  requirementId: idSchema,
  requirementHash: hashSchema,
  bindingId: idSchema,
  bindingHash: hashSchema,
  expectedMaterialManifestId: idSchema,
  expectedMaterialManifestHash: hashSchema,
  confirmed: z.literal(true),
  confirmedAt: isoInstantSchema,
}).strict();

type PlanProposalHashInput = {
  proposalId: string;
  proposalRevision: number;
  kind: string;
  status: string;
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
  decisionReasonCode: string | null;
};

export function visualRolePlanProposalV2Hash(
  proposal: PlanProposalHashInput & { schemaVersion?: number; proposalHash?: string },
): string {
  const { schemaVersion: _schemaVersion, proposalHash: _proposalHash, ...semantic } = proposal;
  return canonicalHash(semantic);
}

export const visualRolePlanProposalV2Schema = z.object({
  schemaVersion: z.literal(2),
  proposalId: idSchema,
  proposalHash: hashSchema,
  proposalRevision: z.number().int().positive(),
  kind: visualRolePlanProposalKindSchema,
  status: visualRolePlanProposalStateSchema,
  projectId: idSchema,
  sessionId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  foundationHash: hashSchema,
  structureSnapshotId: idSchema,
  structureHash: hashSchema,
  basePlanId: idSchema,
  basePlanHash: hashSchema,
  candidatePlanId: idSchema.nullable(),
  candidatePlanHash: hashSchema.nullable(),
  triggerRequirementId: idSchema.nullable(),
  triggerRequirementHash: hashSchema.nullable(),
  triggerResponseId: idSchema.nullable(),
  targetParagraphIds: z.array(idSchema).min(1).max(512),
  allowedParagraphIds: z.array(idSchema).min(1).max(512),
  changedParagraphIds: z.array(idSchema).max(512),
  summary: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(1_000),
  createdByTurnId: idSchema.nullable(),
  createdAt: isoInstantSchema,
  decidedAt: isoInstantSchema.nullable(),
  decisionReasonCode: visualRolePlanProposalDecisionReasonSchema.nullable(),
}).strict().superRefine((proposal, context) => {
  for (const [field, ids] of [
    ["targetParagraphIds", proposal.targetParagraphIds],
    ["allowedParagraphIds", proposal.allowedParagraphIds],
    ["changedParagraphIds", proposal.changedParagraphIds],
  ] as const) {
    if (!unique(ids)) context.addIssue({ code: "custom", path: [field], message: `${field} must be unique` });
  }
  if (proposal.targetParagraphIds.some((id) => !proposal.allowedParagraphIds.includes(id))
    || proposal.changedParagraphIds.some((id) => !proposal.allowedParagraphIds.includes(id))) {
    context.addIssue({ code: "custom", path: ["allowedParagraphIds"], message: "proposal scope must contain every target and change" });
  }
  const hasCandidate = proposal.candidatePlanId !== null && proposal.candidatePlanHash !== null;
  if (hasCandidate !== (proposal.candidatePlanId !== null || proposal.candidatePlanHash !== null)) {
    context.addIssue({ code: "custom", path: ["candidatePlanId"], message: "candidate plan id/hash must be both present or absent" });
  }
  const hasTrigger = proposal.triggerRequirementId !== null
    && proposal.triggerRequirementHash !== null
    && proposal.triggerResponseId !== null;
  if ((proposal.kind === "DOWNGRADE") !== hasTrigger) {
    context.addIssue({ code: "custom", path: ["triggerRequirementId"], message: "only downgrade proposals require one exact CANNOT_PROVIDE trigger" });
  }
  if (proposal.kind === "AGENT_REVISION"
    && (proposal.triggerRequirementId !== null || proposal.triggerRequirementHash !== null || proposal.triggerResponseId !== null)) {
    context.addIssue({ code: "custom", path: ["triggerRequirementId"], message: "Agent revisions cannot claim a material downgrade trigger" });
  }
  if (proposal.status === "PENDING") {
    if (!hasCandidate || proposal.changedParagraphIds.length === 0
      || proposal.decidedAt !== null || proposal.decisionReasonCode !== null) {
      context.addIssue({ code: "custom", path: ["status"], message: "pending proposal requires an undecided changed candidate plan" });
    }
  } else if (proposal.status === "ACCEPTED" || proposal.status === "REJECTED") {
    const expectedReason = proposal.status === "ACCEPTED" ? "USER_ACCEPTED" : "USER_REJECTED";
    if (!hasCandidate || proposal.changedParagraphIds.length === 0
      || proposal.decidedAt === null || proposal.decisionReasonCode !== expectedReason) {
      context.addIssue({ code: "custom", path: ["status"], message: "accepted/rejected proposal requires an exact user decision over one candidate" });
    }
  } else if (proposal.status === "BLOCKED") {
    if (hasCandidate || proposal.changedParagraphIds.length !== 0 || proposal.decidedAt === null
      || !["NO_EVIDENCE_SAFE_FALLBACK", "STRUCTURE_REVIEW_REQUIRED"].includes(proposal.decisionReasonCode ?? "")) {
      context.addIssue({ code: "custom", path: ["status"], message: "blocked proposal cannot carry a candidate and requires a closed blocker reason" });
    }
  } else if (proposal.status === "STALE") {
    if (proposal.decidedAt === null
      || !["FOUNDATION_CHANGED", "BASE_PLAN_SUPERSEDED"].includes(proposal.decisionReasonCode ?? "")) {
      context.addIssue({ code: "custom", path: ["status"], message: "stale proposal requires an auditable invalidation reason" });
    }
  }
  if ((proposal.status === "PENDING" || proposal.status === "ACCEPTED" || proposal.status === "REJECTED")
    && proposal.targetParagraphIds.some((id) => !proposal.changedParagraphIds.includes(id))) {
    context.addIssue({ code: "custom", path: ["changedParagraphIds"], message: "every locked target paragraph must materially change" });
  }
  if (proposal.proposalHash !== visualRolePlanProposalV2Hash(proposal)) {
    context.addIssue({ code: "custom", path: ["proposalHash"], message: "plan proposal hash must match canonical content" });
  }
});

export const decideVisualRolePlanProposalRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  proposalId: idSchema,
  proposalHash: hashSchema,
  candidatePlanId: idSchema,
  candidatePlanHash: hashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  decidedAt: isoInstantSchema,
}).strict();

export const confirmVisualRoleReviewRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  planId: idSchema,
  planHash: hashSchema,
  structureSnapshotId: idSchema,
  structureHash: hashSchema,
  expectedMaterialManifestId: idSchema,
  expectedMaterialManifestHash: hashSchema,
  confirmed: z.literal(true),
  confirmedAt: isoInstantSchema,
}).strict();

type ConfirmationHashInput = {
  confirmationId: string;
  planId: string;
  planHash: string;
  structureHash: string;
  foundationHash: string;
  materialManifestId?: string;
  materialManifestHash: string;
  status: string;
  confirmedAt: string;
  expiredAt: string | null;
};

export function visualRoleConfirmationV2Hash(
  confirmation: ConfirmationHashInput & { schemaVersion?: number; confirmationHash?: string },
): string {
  const { schemaVersion: _schemaVersion, confirmationHash: _confirmationHash, ...semantic } = confirmation;
  return canonicalHash(semantic);
}

export const visualRoleConfirmationV2Schema = z.object({
  schemaVersion: z.literal(2),
  confirmationId: idSchema,
  confirmationHash: hashSchema,
  planId: idSchema,
  planHash: hashSchema,
  structureHash: hashSchema,
  foundationHash: hashSchema,
  materialManifestId: idSchema.optional(),
  materialManifestHash: hashSchema,
  status: z.enum(["CONFIRMED", "EXPIRED"]),
  confirmedAt: isoInstantSchema,
  expiredAt: isoInstantSchema.nullable(),
}).strict().superRefine((confirmation, context) => {
  if ((confirmation.status === "CONFIRMED") !== (confirmation.expiredAt === null)) {
    context.addIssue({ code: "custom", path: ["status"], message: "confirmation status and expiry must agree" });
  }
  if (confirmation.confirmationHash !== visualRoleConfirmationV2Hash(confirmation)) {
    context.addIssue({ code: "custom", path: ["confirmationHash"], message: "confirmation hash must match canonical content" });
  }
});

type FoundationSyncHashInput = {
  syncId: string;
  sourceStructureSnapshotId: string;
  sourceStructureHash: string;
  targetStructureSnapshotId: string;
  targetStructureHash: string;
  sourcePlanId: string | null;
  sourcePlanHash: string | null;
  preservedParagraphs: unknown[];
  invalidatedSourceParagraphIds: string[];
  unresolvedTargetParagraphIds: string[];
  preservedRequirementIds: string[];
  staleRequirementIds: string[];
  preservedBindingIds: string[];
  staleBindingIds: string[];
  expiredConfirmationIds: string[];
  createdAt: string;
};

export function visualRoleFoundationSyncV2Hash(
  sync: FoundationSyncHashInput & { schemaVersion?: number; syncHash?: string },
): string {
  const { schemaVersion: _schemaVersion, syncHash: _syncHash, ...semantic } = sync;
  return canonicalHash(semantic);
}

export const visualRoleFoundationSyncV2Schema = z.object({
  schemaVersion: z.literal(2),
  syncId: idSchema,
  syncHash: hashSchema,
  sourceStructureSnapshotId: idSchema,
  sourceStructureHash: hashSchema,
  targetStructureSnapshotId: idSchema,
  targetStructureHash: hashSchema,
  sourcePlanId: idSchema.nullable(),
  sourcePlanHash: hashSchema.nullable(),
  preservedParagraphs: z.array(z.object({
    sourceParagraphId: idSchema,
    targetParagraphId: idSchema,
    sourceParagraphDesignHash: hashSchema,
  }).strict()).max(512),
  invalidatedSourceParagraphIds: z.array(idSchema).max(512),
  unresolvedTargetParagraphIds: z.array(idSchema).max(512),
  preservedRequirementIds: z.array(idSchema).max(1_536),
  staleRequirementIds: z.array(idSchema).max(1_536),
  preservedBindingIds: z.array(idSchema).max(1_536),
  staleBindingIds: z.array(idSchema).max(1_536),
  expiredConfirmationIds: z.array(idSchema).max(64),
  createdAt: isoInstantSchema,
}).strict().superRefine((sync, context) => {
  if ((sync.sourcePlanId === null) !== (sync.sourcePlanHash === null)) {
    context.addIssue({ code: "custom", path: ["sourcePlanId"], message: "source plan id and hash must be both present or absent" });
  }
  for (const values of [
    sync.preservedParagraphs.map((paragraph) => paragraph.sourceParagraphId),
    sync.preservedParagraphs.map((paragraph) => paragraph.targetParagraphId),
    sync.invalidatedSourceParagraphIds,
    sync.unresolvedTargetParagraphIds,
    sync.preservedRequirementIds,
    sync.staleRequirementIds,
    sync.preservedBindingIds,
    sync.staleBindingIds,
    sync.expiredConfirmationIds,
  ]) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [], message: "foundation sync identities must be unique" });
  }
  if (sync.syncHash !== visualRoleFoundationSyncV2Hash(sync)) {
    context.addIssue({ code: "custom", path: ["syncHash"], message: "foundation sync hash must match canonical content" });
  }
});

export const visualRolePersistentStateV2Schema = z.object({
  schemaVersion: z.literal(2),
  structures: z.array(visualParagraphStructureSnapshotV2Schema).max(8),
  manifests: z.array(materialManifestV2Schema).max(128),
  plans: z.array(visualRolePlanV2Schema).max(32),
  requirements: z.array(materialRequirementV2Schema).max(1_536),
  bindings: z.array(materialBindingV2Schema).max(1_536),
  materialAssets: z.array(materialAssetV2Schema).max(4_096).default([]),
  materialSelections: z.array(materialSelectionV2Schema).max(8_192).default([]),
  materialResponses: z.array(materialRequirementResponseV2Schema).max(8_192).default([]),
  planProposals: z.array(visualRolePlanProposalV2Schema).max(128).default([]),
  confirmations: z.array(visualRoleConfirmationV2Schema).max(32),
  foundationSyncs: z.array(visualRoleFoundationSyncV2Schema).max(16),
}).strict().superRefine((state, context) => {
  const identityGroups = [
    state.structures.map((item) => item.structureSnapshotId),
    state.manifests.map((item) => item.manifestId),
    state.plans.map((item) => item.planId),
    state.requirements.map((item) => item.requirementId),
    state.bindings.map((item) => item.bindingId),
    state.materialAssets.map((item) => item.assetId),
    state.materialSelections.map((item) => item.selectionId),
    state.materialResponses.map((item) => item.responseId),
    state.planProposals.map((item) => item.proposalId),
    state.confirmations.map((item) => item.confirmationId),
    state.foundationSyncs.map((item) => item.syncId),
  ];
  if (identityGroups.some((identities) => !unique(identities))) {
    context.addIssue({ code: "custom", path: [], message: "persistent identities must be unique within each entity kind" });
  }
});

export type ExistingSourceRefV2 = z.infer<typeof existingSourceRefV2Schema>;
export type MaterialManifestV2 = z.infer<typeof materialManifestV2Schema>;
export type MaterialAssetV2 = z.infer<typeof materialAssetV2Schema>;
export type MaterialAssetRegistrationV2 = z.infer<typeof materialAssetRegistrationV2Schema>;
export type MaterialSelectorV2 = z.infer<typeof materialSelectorV2Schema>;
export type MaterialSelectionDraftV2 = z.infer<typeof materialSelectionDraftV2Schema>;
export type MaterialSelectionV2 = z.infer<typeof materialSelectionV2Schema>;
export type MaterialRequirementResponseV2 = z.infer<typeof materialRequirementResponseV2Schema>;
export type VisualParagraphStructureParagraphV2 = z.infer<typeof visualParagraphStructureParagraphV2Schema>;
export type VisualParagraphStructureSnapshotV2 = z.infer<typeof visualParagraphStructureSnapshotV2Schema>;
export type MaterialRequirementDraftV2 = z.infer<typeof materialRequirementDraftV2Schema>;
export type MaterialRequirementV2 = z.infer<typeof materialRequirementV2Schema>;
export type MaterialBindingV2 = z.infer<typeof materialBindingV2Schema>;
export type RegisterUploadedVisualRoleMaterialRequest = z.infer<typeof registerUploadedVisualRoleMaterialRequestSchema>;
export type RegisterProjectVisualRoleMaterialRequest = z.infer<typeof registerProjectVisualRoleMaterialRequestSchema>;
export type RespondVisualRoleMaterialRequirementRequest = z.infer<typeof respondVisualRoleMaterialRequirementRequestSchema>;
export type SaveVisualRoleMaterialBindingRequest = z.infer<typeof saveVisualRoleMaterialBindingRequestSchema>;
export type ConfirmVisualRoleMaterialBindingRequest = z.infer<typeof confirmVisualRoleMaterialBindingRequestSchema>;
export type VisualRolePlanProposalV2 = z.infer<typeof visualRolePlanProposalV2Schema>;
export type DecideVisualRolePlanProposalRequest = z.infer<typeof decideVisualRolePlanProposalRequestSchema>;
export type ConfirmVisualRoleReviewRequest = z.infer<typeof confirmVisualRoleReviewRequestSchema>;
export type VisualRoleObjectSubmissionV2 = z.infer<typeof visualRoleObjectSubmissionV2Schema>;
export type VisualRolePlanSubmissionV2 = z.infer<typeof visualRolePlanSubmissionV2Schema>;
export type VisualRoleStructureReviewRequiredV2 = z.infer<typeof visualRoleStructureReviewRequiredV2Schema>;
export type VisualRoleSubmissionV2 = z.infer<typeof visualRoleSubmissionV2Schema>;
export type VisualRoleObjectV2 = z.infer<typeof visualRoleObjectV2Schema>;
export type VisualRolePlanParagraphV2 = z.infer<typeof visualRolePlanParagraphV2Schema>;
export type VisualRolePlanV2 = z.infer<typeof visualRolePlanV2Schema>;
export type VisualRoleConfirmationV2 = z.infer<typeof visualRoleConfirmationV2Schema>;
export type VisualRoleFoundationSyncV2 = z.infer<typeof visualRoleFoundationSyncV2Schema>;
export type VisualRolePersistentStateV2 = z.infer<typeof visualRolePersistentStateV2Schema>;
