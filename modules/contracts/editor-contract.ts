import { z } from "zod";
import { isAbsolute } from "node:path";
import { presentationSchema, audioStateSchema } from "../shared/timeline-v2/schema.js";

const editorIdSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9:._-]+$/u);
const entityIdSchema = z.string().min(1).max(256).refine(
  (value) => !/[\u0000-\u001f\u007f]/u.test(value),
  "ID must not contain control characters",
);
const labelSchema = z.string().trim().min(1).max(128).refine(
  (value) => !/[\u0000-\u001f\u007f]/u.test(value),
  "Label must not contain control characters",
);
const isoInstantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u);
const frameSchema = z.number().int().nonnegative();

export const editableLaneKindSchema = z.enum([
  "video",
  "screen_recording",
  "image",
  "text",
  "graphic",
  "caption",
  "audio",
  "automation",
]);

export const editorActionSchema = z.discriminatedUnion("type", [
  z.object({type:z.literal("set_clip_audio"),clipId:entityIdSchema,audio:audioStateSchema}).strict(),
  z.object({
    type: z.literal("create_lane"),
    name: labelSchema,
    kind: editableLaneKindSchema,
    order: frameSchema,
  }).strict(),
  z.object({
    type: z.literal("reorder_lane"),
    laneId: entityIdSchema,
    direction: z.enum(["up", "down"]),
  }).strict(),
  z.object({
    type: z.literal("set_lane_state"),
    laneId: entityIdSchema,
    field: z.enum(["locked", "hidden", "muted"]),
    value: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal("delete_lane"),
    laneId: entityIdSchema,
  }).strict(),
  z.object({
    type: z.literal("move_clip"),
    clipId: entityIdSchema,
    laneId: entityIdSchema,
    startFrame: frameSchema,
    ripple: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal("place_clip"),
    clipId: entityIdSchema,
    startFrame: frameSchema,
    magnet: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal("insert_asset_clip"),
    assetId: entityIdSchema,
    startFrame: frameSchema,
    magnet: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal("trim_clip"),
    clipId: entityIdSchema,
    edge: z.enum(["start", "end"]),
    frame: frameSchema,
  }).strict(),
  z.object({
    type: z.literal("split_clip"),
    clipId: entityIdSchema,
    atFrame: z.number().int().positive(),
  }).strict(),
  z.object({
    type: z.literal("delete_clip"),
    clipId: entityIdSchema,
    ripple: z.boolean(),
    expectedCaptionCueIds: z.array(entityIdSchema).max(10_000).optional(),
    expectedTransitionEdgeIds: z.array(entityIdSchema).max(10_000).optional(),
  }).strict(),
  z.object({
    type: z.literal("delete_clip_side"),
    clipId: entityIdSchema,
    direction: z.enum(["left", "right"]),
    frame: frameSchema,
    magnet: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal("delete_asset"),
    assetId: entityIdSchema,
  }).strict(),
  z.object({
    type: z.literal("set_clip_presentation"),
    clipId: entityIdSchema,
    presentation: presentationSchema,
  }).strict(),
  z.object({
    type: z.literal("set_clip_playback_direction"),
    clipId: entityIdSchema,
    direction: z.enum(["forward", "reverse"]),
  }).strict(),
  z.object({
    type: z.literal("add_marker"),
    frame: frameSchema,
  }).strict(),
  z.object({
    type: z.literal("delete_marker"),
    markerId: entityIdSchema,
  }).strict(),
  z.object({
    type: z.literal("insert_transition"),
    adjacencyScope: z.enum(["program_spine", "lane"]),
    laneId: entityIdSchema.nullable(),
    fromClipId: entityIdSchema,
    toClipId: entityIdSchema,
    durationFrames: z.number().int().positive().max(120),
  }).strict(),
  z.object({
    type: z.literal("delete_transition"),
    transitionEdgeId: entityIdSchema,
  }).strict(),
  z.object({
    type: z.literal("set_packaging_group_enabled"),
    packagingGroupId: entityIdSchema,
    enabled: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal("move_packaging_group"),
    packagingGroupId: entityIdSchema,
    startFrame: frameSchema,
  }).strict(),
  z.object({
    type: z.literal("delete_packaging_group"),
    packagingGroupId: entityIdSchema,
    memberDisposition: z.enum(["detach", "delete_members"]).optional(),
  }).strict(),
]);

export const editorCommandRequestSchema = z.object({
  actionId: editorIdSchema,
  baseRevision: frameSchema,
  createdAt: isoInstantSchema,
  confirmed: z.boolean(),
  action: editorActionSchema,
}).strict();

export const editorHistoryRequestSchema = z.object({
  actionId: editorIdSchema,
  createdAt: isoInstantSchema,
}).strict();

export const migrationPreviewRequestSchema = z.object({
  path: z.string().min(1).max(4096).refine(isAbsolute, "Migration preview path must be absolute"),
}).strict();

export type EditableLaneKind = z.infer<typeof editableLaneKindSchema>;
export type EditorAction = z.infer<typeof editorActionSchema>;
export type EditorCommandRequest = z.infer<typeof editorCommandRequestSchema>;
export type EditorHistoryRequest = z.infer<typeof editorHistoryRequestSchema>;
