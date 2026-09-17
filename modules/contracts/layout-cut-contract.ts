import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import {
  frameRangeSchema,
  hashSchema,
  idSchema,
  isoInstantSchema,
} from "../shared/timeline-v2/schema.js";
import { layoutFamilyIdV1Schema, layoutSlotIdV1Schema, layoutVariantIdV1Schema } from "./layout-contract.js";
import {
  directorExpressionTaskV1Schema,
  directorInformationRelationV1Schema,
  directorObjectClassV1Schema,
  directorPackagingModeV1Schema,
  directorPreviewVersionV1Schema,
  directorSceneOperationV1Schema,
  directorTextRoleV1Schema,
  directorVisualObjectKindV1Schema,
  projectDesignSystemV1Schema,
} from "./project-director-contract.js";

const compactTextSchema = z.string().trim().min(1).max(2_000);
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

export const layoutCutRectV1Schema = z.object({
  xPermille: z.number().int().min(0).max(999),
  yPermille: z.number().int().min(0).max(999),
  widthPermille: z.number().int().min(1).max(1_000),
  heightPermille: z.number().int().min(1).max(1_000),
}).strict().superRefine((rect, context) => {
  if (rect.xPermille + rect.widthPermille > 1_000 || rect.yPermille + rect.heightPermille > 1_000) {
    context.addIssue({ code: "custom", message: "layout cut rectangles must stay inside the canvas" });
  }
});

export const layoutCutResolvedSourceV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("MEDIA"), assetIds: z.array(idSchema).min(1).max(16) }).strict(),
  z.object({ kind: z.literal("TRANSCRIPT"), wordIds: z.array(idSchema).min(1).max(256) }).strict(),
  z.object({ kind: z.literal("CONSTRUCTED"), evidenceWordIds: z.array(idSchema).max(256) }).strict(),
]);

export const layoutCutAppearanceV1Schema = z.object({
 opacityPermille:z.number().int().min(0).max(1000),
 cornerRadiusPermille:z.number().int().min(0).max(500),
 foregroundColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
 fontFamily:z.enum(['system-ui','Arial','Georgia','monospace']).optional(),
 fontSizePermille:z.number().int().min(250).max(3000).optional(),
}).strict();

const layoutCutObjectSemanticV1Schema = z.object({
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
  /** Source-relative crop window. Full source is 0/0/1000/1000. */
  crop: layoutCutRectV1Schema,
  zIndex: z.number().int().min(0).max(999),
  alignment: z.enum(["FILL", "CENTER", "TOP", "BOTTOM", "LEFT", "RIGHT"]),
  personTreatment: z.enum(["NONE", "FULL_FRAME", "RECTANGULAR_PIP", "CIRCULAR_PIP"]),
  readingOrder: z.number().int().nonnegative().max(63),
  manuallyEdited: z.boolean(),
  visible: z.boolean().optional(),
  editingLocked: z.boolean().optional(),
  appearance: layoutCutAppearanceV1Schema.optional(),
}).strict();

export const layoutCutObjectV1Schema = layoutCutObjectSemanticV1Schema.extend({
  objectHash: hashSchema,
}).strict().superRefine((object, context) => {
  const { objectHash: _objectHash, ...semantic } = object;
  if (object.objectHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["objectHash"], message: "layout object hash must match canonical content" });
  }
});

export const layoutCutStateV1Schema = z.object({
  stateId: idSchema,
  anchorWordId: idSchema,
  anchorFrame: z.number().int().nonnegative(),
  operation: directorSceneOperationV1Schema,
  targetObjectIds: z.array(idSchema).min(1).max(32),
  purpose: compactTextSchema,
}).strict();

const layoutCutParagraphSemanticV1Schema = z.object({
  paragraphId: idSchema,
  sourceParagraphHash: hashSchema,
  order: z.number().int().nonnegative().max(511),
  frameRange: frameRangeSchema,
  transcriptText: z.string().min(1).max(100_000),
  expressionTask: directorExpressionTaskV1Schema,
  coreProposition: compactTextSchema,
  informationRelation: directorInformationRelationV1Schema,
  selectedVariantId: layoutVariantIdV1Schema,
  selectedFamilyId: layoutFamilyIdV1Schema,
  variantLabel: z.string().trim().min(1).max(100),
  layoutIntent: compactTextSchema,
  hierarchyRationale: compactTextSchema,
  safeRegion: layoutCutRectV1Schema,
  captionExclusionRegion: layoutCutRectV1Schema,
  readingOrderObjectIds: z.array(idSchema).min(1).max(64),
  objects: z.array(layoutCutObjectV1Schema).min(1).max(64),
  states: z.array(layoutCutStateV1Schema).min(1).max(24),
}).strict();

export const layoutCutParagraphV1Schema = layoutCutParagraphSemanticV1Schema.extend({
  paragraphHash: hashSchema,
}).strict().superRefine((paragraph, context) => {
  if (!unique(paragraph.objects.map((object) => object.visualObjectId))
    || !unique(paragraph.readingOrderObjectIds)
    || paragraph.readingOrderObjectIds.some((objectId) => !paragraph.objects.some((object) => object.visualObjectId === objectId))
    || paragraph.states.some((state) => state.targetObjectIds.some((objectId) => !paragraph.objects.some((object) => object.visualObjectId === objectId)))) {
    context.addIssue({ code: "custom", path: ["objects"], message: "layout paragraph object references must be unique and local" });
  }
  const { paragraphHash: _paragraphHash, ...semantic } = paragraph;
  if (paragraph.paragraphHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["paragraphHash"], message: "layout paragraph hash must match canonical content" });
  }
});

const layoutCutSemanticV1Schema = z.object({
  schemaVersion: z.literal(1),
  layoutCutId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  foundationHash: hashSchema,
  creativePlanId: idSchema,
  creativePlanHash: hashSchema,
  canvas: z.object({
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
    framesPerSecond: z.number().positive().max(1_000),
  }).strict(),
  designSystem: projectDesignSystemV1Schema,
  overrideRevision: z.number().int().nonnegative(),
  paragraphs: z.array(layoutCutParagraphV1Schema).min(1).max(512),
  generatedAt: isoInstantSchema,
}).strict();

export const layoutCutV1Schema = layoutCutSemanticV1Schema.extend({
  layoutCutHash: hashSchema,
}).strict().superRefine((layoutCut, context) => {
  if (!unique(layoutCut.paragraphs.map((paragraph) => paragraph.paragraphId))) {
    context.addIssue({ code: "custom", path: ["paragraphs"], message: "layout cut paragraph ids must be unique" });
  }
  const { layoutCutHash: _layoutCutHash, ...semantic } = layoutCut;
  if (layoutCut.layoutCutHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["layoutCutHash"], message: "layout cut hash must match canonical content" });
  }
});

export const compileLayoutCutV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  expectedTimelineHash: hashSchema,
  creativePlanId: idSchema,
  creativePlanHash: hashSchema,
}).strict();

export const layoutCutObjectEditChangeV1Schema = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("SET_VISIBILITY"),visible:z.boolean()}).strict(),
  z.object({kind:z.literal("SET_EDIT_LOCK"),editingLocked:z.boolean()}).strict(),
  z.object({kind:z.literal("SET_APPEARANCE"),appearance:layoutCutAppearanceV1Schema}).strict(),
  z.object({ kind: z.literal("SET_FRAME"), frame: layoutCutRectV1Schema }).strict(),
  z.object({ kind: z.literal("SET_CROP"), crop: layoutCutRectV1Schema }).strict(),
  z.object({ kind: z.literal("SET_ALIGNMENT"), alignment: z.enum(["FILL", "CENTER", "TOP", "BOTTOM", "LEFT", "RIGHT"]) }).strict(),
  z.object({ kind: z.literal("SET_Z_INDEX"), zIndex: z.number().int().min(0).max(999) }).strict(),
  z.object({ kind: z.literal("SET_TEXT"), text: z.string().trim().min(1).max(2_000) }).strict(),
  z.object({ kind: z.literal("RESET_OBJECT") }).strict(),
]);

export const layoutCutEditChangeV1Schema = z.discriminatedUnion("kind", [
  ...layoutCutObjectEditChangeV1Schema.options,
  z.object({ kind: z.literal("UNDO") }).strict(),
  z.object({ kind: z.literal("REDO") }).strict(),
]);

export const applyLayoutCutEditV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  expectedTimelineHash: hashSchema,
  layoutCutId: idSchema,
  layoutCutHash: hashSchema,
  paragraphId: idSchema,
  visualObjectId: idSchema,
  editId: idSchema,
  change: layoutCutEditChangeV1Schema,
  editedAt: isoInstantSchema,
}).strict();

const layoutCutOverrideSemanticV1Schema = z.object({
  editId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  creativePlanId: idSchema,
  creativePlanHash: hashSchema,
  paragraphId: idSchema,
  visualObjectId: idSchema,
  change: layoutCutObjectEditChangeV1Schema,
  editedAt: isoInstantSchema,
}).strict();

export const layoutCutOverrideV1Schema = layoutCutOverrideSemanticV1Schema.extend({
  editHash: hashSchema,
}).strict().superRefine((override, context) => {
  const { editHash: _editHash, ...semantic } = override;
  if (override.editHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["editHash"], message: "layout edit hash must match canonical content" });
  }
});

export const layoutCutPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  overrides: z.array(layoutCutOverrideV1Schema).max(4_096),
  histories: z.array(z.object({
    creativePlanId: idSchema,
    creativePlanHash: hashSchema,
    editIds: z.array(idSchema).max(4_096),
    cursor: z.number().int().nonnegative().max(4_096),
    actions: z.array(z.object({
      actionId: idSchema,
      kind: z.enum(["UNDO", "REDO"]),
      resultingCursor: z.number().int().nonnegative().max(4_096),
    }).strict()).max(4_096).default([]),
  }).strict().superRefine((history, context) => {
    if (!unique(history.editIds)) context.addIssue({ code: "custom", path: ["editIds"], message: "layout history edit ids must be unique" });
    if (history.cursor > history.editIds.length) context.addIssue({ code: "custom", path: ["cursor"], message: "layout history cursor exceeds edit count" });
  })).max(256).default([]),
}).strict().superRefine((state, context) => {
  if (!unique(state.overrides.map((override) => override.editId))) {
    context.addIssue({ code: "custom", path: ["overrides"], message: "layout edit ids must be unique" });
  }
  const historyKeys = state.histories.map((history) => `${history.creativePlanId}\u0000${history.creativePlanHash}`);
  if (!unique(historyKeys)) context.addIssue({ code: "custom", path: ["histories"], message: "layout history plan identities must be unique" });
  const overrideIds = new Set(state.overrides.map((override) => override.editId));
  if (state.histories.some((history) => history.editIds.some((editId) => !overrideIds.has(editId)))) {
    context.addIssue({ code: "custom", path: ["histories"], message: "layout history may reference only persisted overrides" });
  }
  const actionIds = state.histories.flatMap((history) => history.actions.map((action) => action.actionId));
  if (!unique(actionIds) || actionIds.some((actionId) => overrideIds.has(actionId))) {
    context.addIssue({ code: "custom", path: ["histories"], message: "layout edit and history action ids must be globally unique" });
  }
});

export const layoutCutSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  layoutCut: layoutCutV1Schema.nullable(),
  previewVersion: directorPreviewVersionV1Schema.nullable(),
  readiness: z.object({
    code: z.enum([
      "ROUGH_CUT_REQUIRED",
      "ROUGH_CUT_CONFIRMATION_REQUIRED",
      "VISUAL_PARAGRAPHS_REQUIRED",
      "CREATIVE_PLAN_REQUIRED",
      "MATERIAL_RESPONSE_REQUIRED",
      "CREATIVE_PLAN_REVISION_REQUIRED",
      "LAYOUT_CUT_READY",
      "LAYOUT_CUT_STALE",
    ]),
    message: z.string().min(1).max(2_000),
  }).strict(),
  history: z.object({
    canUndo: z.boolean(),
    canRedo: z.boolean(),
    appliedEditCount: z.number().int().nonnegative(),
    redoEditCount: z.number().int().nonnegative(),
  }).strict().default({ canUndo: false, canRedo: false, appliedEditCount: 0, redoEditCount: 0 }),
  timelineModified: z.literal(false),
}).strict();

export type LayoutCutRectV1 = z.infer<typeof layoutCutRectV1Schema>;
export type LayoutCutObjectV1 = z.infer<typeof layoutCutObjectV1Schema>;
export type LayoutCutParagraphV1 = z.infer<typeof layoutCutParagraphV1Schema>;
export type LayoutCutV1 = z.infer<typeof layoutCutV1Schema>;
export type LayoutCutOverrideV1 = z.infer<typeof layoutCutOverrideV1Schema>;
export type LayoutCutPersistentStateV1 = z.infer<typeof layoutCutPersistentStateV1Schema>;
export type LayoutCutSnapshotV1 = z.infer<typeof layoutCutSnapshotV1Schema>;
export type CompileLayoutCutV1Request = z.infer<typeof compileLayoutCutV1RequestSchema>;
export type ApplyLayoutCutEditV1Request = z.infer<typeof applyLayoutCutEditV1RequestSchema>;
