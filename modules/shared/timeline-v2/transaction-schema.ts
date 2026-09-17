import { z } from "zod";
import {
  assetRefSchema,
  audioStateSchema,
  captionCueSchema,
  frameRangeSchema,
  hashSchema,
  idSchema,
  isoInstantSchema,
  jsonObjectSchema,
  laneSchema,
  packagingGroupSchema,
  packagingVersionPinSchema,
  presentationSchema,
  programSpineEntrySchema,
  semanticCueSchema,
  timelineClipSchema,
  timelineDocumentV2Schema,
  timelineMarkerSchema,
  timeMapBindingSchema,
  transitionEdgeSchema,
} from "./schema.js";

const operationId = { operationId: idSchema } as const;

export const insertAssetOperationSchema = z.object({
  ...operationId,
  type: z.literal("insert_asset"),
  asset: assetRefSchema,
}).strict();

export const removeAssetOperationSchema = z.object({
  ...operationId,
  type: z.literal("remove_asset"),
  assetId: idSchema,
}).strict();

export const setDocumentDurationOperationSchema = z.object({
  ...operationId,
  type: z.literal("set_document_duration"),
  expectedDurationFrames: z.number().int().positive(),
  durationFrames: z.number().int().positive(),
}).strict();

export const createLaneOperationSchema = z.object({
  ...operationId,
  type: z.literal("create_lane"),
  lane: laneSchema,
}).strict();

export const renameLaneOperationSchema = z.object({
  ...operationId,
  type: z.literal("rename_lane"),
  laneId: idSchema,
  expectedName: z.string().min(1),
  name: z.string().min(1),
}).strict();

export const reorderLaneOperationSchema = z.object({
  ...operationId,
  type: z.literal("reorder_lane"),
  laneId: idSchema,
  expectedOrder: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
}).strict();

const laneStateSchema = z.object({
  locked: z.boolean(),
  hidden: z.boolean(),
  muted: z.boolean(),
}).strict();

export const setLaneStateOperationSchema = z.object({
  ...operationId,
  type: z.literal("set_lane_state"),
  laneId: idSchema,
  expected: laneStateSchema,
  value: laneStateSchema,
}).strict();

export const deleteLaneOperationSchema = z.object({
  ...operationId,
  type: z.literal("delete_lane"),
  laneId: idSchema,
  disposition: z.enum(["require_empty", "delete_contents", "move_contents"]),
  targetLaneId: idSchema.nullable(),
  groupDisposition: z.enum(["reject_if_member", "detach_members", "delete_groups"]),
}).strict();

export const insertClipOperationSchema = z.object({
  ...operationId,
  type: z.literal("insert_clip"),
  clip: timelineClipSchema,
}).strict();

export const renameClipOperationSchema = z.object({
  ...operationId,
  type: z.literal("rename_clip"),
  clipId: idSchema,
  expectedName: z.string().min(1),
  name: z.string().min(1),
}).strict();

export const moveClipOperationSchema = z.object({
  ...operationId,
  type: z.literal("move_clip"),
  clipId: idSchema,
  expectedLaneId: idSchema,
  expectedTimelineRange: frameRangeSchema,
  laneId: idSchema,
  timelineRange: frameRangeSchema,
  ripple: z.boolean(),
}).strict();

export const trimClipOperationSchema = z.object({
  ...operationId,
  type: z.literal("trim_clip"),
  clipId: idSchema,
  expectedTimelineRange: frameRangeSchema,
  edge: z.enum(["start", "end"]),
  frame: z.number().int().nonnegative(),
  sourcePolicy: z.literal("preserve_playback_rate"),
}).strict();

export const splitClipOperationSchema = z.object({
  ...operationId,
  type: z.literal("split_clip"),
  clipId: idSchema,
  expectedTimelineRange: frameRangeSchema,
  atFrame: z.number().int().positive(),
  newRightClipId: idSchema,
  newRightSpineEntryId: idSchema.nullable(),
  newRightTimeMapSegmentId: idSchema.nullable(),
}).strict();

export const deleteClipOperationSchema = z.object({
  ...operationId,
  type: z.literal("delete_clip"),
  clipId: idSchema,
  ripple: z.boolean(),
  transitionDisposition: z.enum(["reject", "delete_incident_edges"]),
  groupDisposition: z.enum(["reject", "detach", "delete_owning_groups"]),
}).strict();

export const setClipEnabledOperationSchema = z.object({
  ...operationId,
  type: z.literal("set_clip_enabled"),
  clipId: idSchema,
  expectedEnabled: z.boolean(),
  enabled: z.boolean(),
}).strict();

export const setClipPresentationOperationSchema = z.object({
  ...operationId,
  type: z.literal("set_clip_presentation"),
  clipId: idSchema,
  expectedPresentation: presentationSchema,
  presentation: presentationSchema,
}).strict();

export const setClipPlaybackDirectionOperationSchema = z.object({
  ...operationId,
  type: z.literal("set_clip_playback_direction"),
  clipId: idSchema,
  expectedDirection: z.enum(["forward", "reverse"]).nullable(),
  direction: z.enum(["forward", "reverse"]).nullable(),
}).strict();

export const insertMarkerOperationSchema = z.object({
  ...operationId,
  type: z.literal("insert_marker"),
  marker: timelineMarkerSchema,
}).strict();

export const deleteMarkerOperationSchema = z.object({
  ...operationId,
  type: z.literal("delete_marker"),
  markerId: idSchema,
  expectedFrame: z.number().int().nonnegative(),
  removeCollectionWhenEmpty: z.boolean(),
}).strict();

export const setClipAudioOperationSchema = z.object({
 ...operationId,type:z.literal('set_clip_audio'),clipId:idSchema,
 expectedAudio:audioStateSchema,audio:audioStateSchema,
}).strict();

export const setAudioGainOperationSchema = z.object({
  ...operationId,
  type: z.literal("set_audio_gain"),
  clipId: idSchema,
  expectedGainMilliDb: z.number().int().min(-96_000).max(24_000),
  gainMilliDb: z.number().int().min(-96_000).max(24_000),
}).strict();

export const replaceGraphicParametersOperationSchema = z.object({
  ...operationId,
  type: z.literal("replace_graphic_parameters"),
  clipId: idSchema,
  expectedParametersHash: hashSchema,
  parameters: jsonObjectSchema,
}).strict();

export const insertSpineEntryOperationSchema = z.object({
  ...operationId,
  type: z.literal("insert_spine_entry"),
  entry: programSpineEntrySchema,
}).strict();

export const removeSpineEntryOperationSchema = z.object({
  ...operationId,
  type: z.literal("remove_spine_entry"),
  entryId: idSchema,
  expectedClipId: idSchema,
}).strict();

export const replaceSpineEntryClipOperationSchema = z.object({
  ...operationId,
  type: z.literal("replace_spine_entry_clip"),
  entryId: idSchema,
  expectedClipId: idSchema,
  clipId: idSchema,
  timeMapBinding: timeMapBindingSchema.nullable(),
}).strict();

export const insertCaptionCueOperationSchema = z.object({
  ...operationId,
  type: z.literal("insert_caption_cue"),
  captionCue: captionCueSchema,
}).strict();

export const updateCaptionTextOperationSchema = z.object({
  ...operationId,
  type: z.literal("update_caption_text"),
  captionCueId: idSchema,
  expectedText: z.string(),
  text: z.string(),
  confirmed: z.boolean(),
}).strict();

export const updateCaptionTimingOperationSchema = z.object({
  ...operationId,
  type: z.literal("update_caption_timing"),
  captionCueId: idSchema,
  expectedStartMs: z.number().int().nonnegative(),
  expectedEndMs: z.number().int().positive(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  suppressionKey: z.string().min(1).nullable(),
}).strict();

export const splitCaptionCueOperationSchema = z.object({
  ...operationId,
  type: z.literal("split_caption_cue"),
  captionCueId: idSchema,
  atMs: z.number().int().positive(),
  leftText: z.string(),
  newRightCaptionCueId: idSchema,
  rightText: z.string(),
  suppressionKey: z.string().min(1).nullable(),
}).strict();

export const mergeCaptionCuesOperationSchema = z.object({
  ...operationId,
  type: z.literal("merge_caption_cues"),
  leftCaptionCueId: idSchema,
  rightCaptionCueId: idSchema,
  text: z.string(),
  suppressionKeys: z.array(z.string().min(1)),
}).strict();

export const deleteCaptionCueOperationSchema = z.object({
  ...operationId,
  type: z.literal("delete_caption_cue"),
  captionCueId: idSchema,
  suppressionKey: z.string().min(1).nullable(),
  semanticDisposition: z.enum(["reject", "detach"]),
  groupDisposition: z.enum(["reject", "detach"]),
}).strict();

export const captionSuppressionChangeSchema = z.object({
  key: z.string().min(1),
  expectedPresent: z.boolean(),
  present: z.boolean(),
}).strict();

export const restoreCaptionStateOperationSchema = z.object({
  ...operationId,
  type: z.literal("restore_caption_state"),
  captionCueId: idSchema,
  expectedCaptionCueHash: hashSchema.nullable(),
  captionCue: captionCueSchema.nullable(),
  suppressionChanges: z.array(captionSuppressionChangeSchema),
}).strict().superRefine((operation, context) => {
  if (operation.captionCue && operation.captionCue.captionCueId !== operation.captionCueId) {
    context.addIssue({ code: "custom", message: "captionCueId must match captionCue.captionCueId", path: ["captionCue", "captionCueId"] });
  }
  if (new Set(operation.suppressionChanges.map((change) => change.key)).size !== operation.suppressionChanges.length) {
    context.addIssue({ code: "custom", message: "suppression change keys must be unique", path: ["suppressionChanges"] });
  }
});

export const transcriptProjectionSourceRefSchema = z.object({
  assetId: idSchema,
  assetFingerprint: z.string().min(1),
  transcriptId: idSchema,
  sourceHash: hashSchema,
}).strict();

export const transcriptProjectionEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  proposalId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  timeMapHash: hashSchema,
  masterTranscriptHash: hashSchema,
  sourceTranscripts: z.array(transcriptProjectionSourceRefSchema).min(1),
  generatedAt: isoInstantSchema,
}).strict().superRefine((evidence, context) => {
  const assetIds = evidence.sourceTranscripts.map((source) => source.assetId);
  const transcriptIds = evidence.sourceTranscripts.map((source) => source.transcriptId);
  if (new Set(assetIds).size !== assetIds.length) {
    context.addIssue({ code: "custom", path: ["sourceTranscripts"], message: "source transcript asset ids must be unique" });
  }
  if (new Set(transcriptIds).size !== transcriptIds.length) {
    context.addIssue({ code: "custom", path: ["sourceTranscripts"], message: "source transcript ids must be unique" });
  }
});

export const replaceTranscriptProjectionOperationSchema = z.object({
  ...operationId,
  type: z.literal("replace_transcript_projection"),
  expectedProjectionHash: hashSchema,
  durationFrames: z.number().int().positive(),
  captionCues: z.array(captionCueSchema),
  captionSuppressions: z.array(z.string().min(1)),
  evidence: transcriptProjectionEvidenceSchema.nullable(),
}).strict().superRefine((operation, context) => {
  const captionIds = operation.captionCues.map((caption) => caption.captionCueId);
  if (new Set(captionIds).size !== captionIds.length) {
    context.addIssue({ code: "custom", path: ["captionCues"], message: "caption cue ids must be unique" });
  }
  if (new Set(operation.captionSuppressions).size !== operation.captionSuppressions.length) {
    context.addIssue({ code: "custom", path: ["captionSuppressions"], message: "caption suppressions must be unique" });
  }
});

export const insertSemanticCueOperationSchema = z.object({
  ...operationId,
  type: z.literal("insert_semantic_cue"),
  semanticCue: semanticCueSchema,
}).strict();

export const replaceSemanticCueOperationSchema = z.object({
  ...operationId,
  type: z.literal("replace_semantic_cue"),
  semanticCueId: idSchema,
  expectedCueHash: hashSchema,
  semanticCue: semanticCueSchema,
}).strict();

export const setSemanticCueLockOperationSchema = z.object({
  ...operationId,
  type: z.literal("set_semantic_cue_lock"),
  semanticCueId: idSchema,
  expectedLocked: z.boolean(),
  locked: z.boolean(),
  lockSource: z.enum(["local", "manual", "agent"]).nullable(),
}).strict();

export const deleteSemanticCueOperationSchema = z.object({
  ...operationId,
  type: z.literal("delete_semantic_cue"),
  semanticCueId: idSchema,
  groupDisposition: z.enum(["reject", "detach"]),
}).strict();

export const insertTransitionEdgeOperationSchema = z.object({
  ...operationId,
  type: z.literal("insert_transition_edge"),
  transitionEdge: transitionEdgeSchema,
}).strict();

export const replaceTransitionEdgeOperationSchema = z.object({
  ...operationId,
  type: z.literal("replace_transition_edge"),
  transitionEdgeId: idSchema,
  expectedEdgeHash: hashSchema,
  transitionEdge: transitionEdgeSchema,
}).strict();

export const deleteTransitionEdgeOperationSchema = z.object({
  ...operationId,
  type: z.literal("delete_transition_edge"),
  transitionEdgeId: idSchema,
  groupDisposition: z.enum(["reject", "detach"]),
}).strict();

export const insertPackagingGroupOperationSchema = z.object({
  ...operationId,
  type: z.literal("insert_packaging_group"),
  packagingGroup: packagingGroupSchema,
}).strict();

export const setPackagingGroupEnabledOperationSchema = z.object({
  ...operationId,
  type: z.literal("set_packaging_group_enabled"),
  packagingGroupId: idSchema,
  expectedEnabled: z.boolean(),
  enabled: z.boolean(),
}).strict();

export const movePackagingGroupOperationSchema = z.object({
  ...operationId,
  type: z.literal("move_packaging_group"),
  packagingGroupId: idSchema,
  expectedTimelineRange: frameRangeSchema,
  startFrame: z.number().int().nonnegative(),
}).strict();

export const replacePackagingGroupVersionOperationSchema = z.object({
  ...operationId,
  type: z.literal("replace_packaging_group_version"),
  packagingGroupId: idSchema,
  expectedVersion: z.number().int().positive(),
  expectedContentHash: hashSchema,
  version: z.number().int().positive(),
  versionPin: packagingVersionPinSchema,
  replacementMemberClipIds: z.array(idSchema),
  replacementMemberCaptionCueIds: z.array(idSchema),
  replacementMemberTransitionEdgeIds: z.array(idSchema),
}).strict();

export const deletePackagingGroupOperationSchema = z.object({
  ...operationId,
  type: z.literal("delete_packaging_group"),
  packagingGroupId: idSchema,
  memberDisposition: z.enum(["detach", "delete_members"]),
}).strict();

export const timelineOperationV1Schema = z.discriminatedUnion("type", [
  insertAssetOperationSchema,
  removeAssetOperationSchema,
  setDocumentDurationOperationSchema,
  createLaneOperationSchema,
  renameLaneOperationSchema,
  reorderLaneOperationSchema,
  setLaneStateOperationSchema,
  deleteLaneOperationSchema,
  insertClipOperationSchema,
  renameClipOperationSchema,
  moveClipOperationSchema,
  trimClipOperationSchema,
  splitClipOperationSchema,
  deleteClipOperationSchema,
  setClipEnabledOperationSchema,
  setClipPresentationOperationSchema,
  setClipPlaybackDirectionOperationSchema,
  setAudioGainOperationSchema,
  setClipAudioOperationSchema,
  replaceGraphicParametersOperationSchema,
  insertSpineEntryOperationSchema,
  removeSpineEntryOperationSchema,
  replaceSpineEntryClipOperationSchema,
  insertMarkerOperationSchema,
  deleteMarkerOperationSchema,
  insertCaptionCueOperationSchema,
  updateCaptionTextOperationSchema,
  updateCaptionTimingOperationSchema,
  splitCaptionCueOperationSchema,
  mergeCaptionCuesOperationSchema,
  deleteCaptionCueOperationSchema,
  restoreCaptionStateOperationSchema,
  replaceTranscriptProjectionOperationSchema,
  insertSemanticCueOperationSchema,
  replaceSemanticCueOperationSchema,
  setSemanticCueLockOperationSchema,
  deleteSemanticCueOperationSchema,
  insertTransitionEdgeOperationSchema,
  replaceTransitionEdgeOperationSchema,
  deleteTransitionEdgeOperationSchema,
  insertPackagingGroupOperationSchema,
  setPackagingGroupEnabledOperationSchema,
  movePackagingGroupOperationSchema,
  replacePackagingGroupVersionOperationSchema,
  deletePackagingGroupOperationSchema,
]);

export const transactionActorSchema = z.object({
  kind: z.enum(["user", "agent", "system"]),
  actorId: idSchema,
}).strict();

export const proposalConfirmationSchema = z.object({
  confirmationId: idSchema,
  confirmedBy: idSchema,
  confirmedAt: isoInstantSchema,
  transactionHash: hashSchema,
}).strict();

export const proposalGateSchema = z.object({
  required: z.boolean(),
  proposalId: idSchema.nullable(),
  confirmation: proposalConfirmationSchema.nullable(),
}).strict();

export const timelineTransactionV1Schema = z.object({
  transactionSchemaVersion: z.literal(1),
  transactionId: idSchema,
  idempotencyKey: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  baseRevision: z.number().int().nonnegative(),
  actor: transactionActorSchema,
  summary: z.string().min(1),
  riskClass: z.enum(["low", "medium", "high"]),
  proposalGate: proposalGateSchema,
  operations: z.array(timelineOperationV1Schema),
  createdAt: isoInstantSchema,
}).strict();

export const preparedCommitV1Schema = z.object({
  schemaVersion: z.literal(1),
  transaction: timelineTransactionV1Schema,
  transactionHash: hashSchema,
  baseDocumentHash: hashSchema,
  nextDocument: timelineDocumentV2Schema,
  nextDocumentHash: hashSchema,
  resultRevision: z.number().int().positive(),
  inverseOperations: z.array(timelineOperationV1Schema),
}).strict();

export type TimelineOperationV1 = z.infer<typeof timelineOperationV1Schema>;
export type TimelineTransactionV1 = z.infer<typeof timelineTransactionV1Schema>;
export type PreparedCommitV1 = z.infer<typeof preparedCommitV1Schema>;
export type RiskClass = TimelineTransactionV1["riskClass"];
export type CaptionSuppressionChangeV1 = z.infer<typeof captionSuppressionChangeSchema>;
