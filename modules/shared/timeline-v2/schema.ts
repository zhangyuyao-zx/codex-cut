import { z } from "zod";

const controlCharacterPattern = /[\u0000-\u001f\u007f]/u;
const namespacedIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const hashPattern = /^sha256:[0-9a-f]{64}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

export const idSchema = z
  .string()
  .min(1)
  .refine((value) => Array.from(value).length <= 256, "must be at most 256 Unicode scalar values")
  .refine((value) => !controlCharacterPattern.test(value), "must not contain control characters");

export const namespacedIdSchema = z.string().regex(namespacedIdPattern);
export const hashSchema = z.string().regex(hashPattern);
export const isoInstantSchema = z
  .string()
  .regex(utcInstantPattern)
  .refine((value) => Number.isFinite(Date.parse(value)), "must be a valid RFC 3339 UTC instant");

export const finiteNumberSchema = z
  .number()
  .refine(Number.isFinite, "must be finite")
  .refine((value) => !Object.is(value, -0), "negative zero is not allowed");
export const frameSchema = z.number().int().nonnegative();
export const positiveFrameSchema = z.number().int().positive();
export const unitIntervalSchema = finiteNumberSchema.min(0).max(1);
export const permilleSchema = z.number().int().min(-1000).max(1000);
export const jsonValueSchema = z.json();
export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

export const frameRangeSchema = z
  .object({
    startFrame: frameSchema,
    endFrame: positiveFrameSchema,
  })
  .strict()
  .refine((value) => value.endFrame > value.startFrame, {
    message: "endFrame must be greater than startFrame",
    path: ["endFrame"],
  });

export const millisecondRangeSchema = z
  .object({
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
  })
  .strict()
  .refine((value) => value.endMs > value.startMs, {
    message: "endMs must be greater than startMs",
    path: ["endMs"],
  });

export const positiveRationalSchema = z
  .object({
    numerator: z.number().int().positive(),
    denominator: z.number().int().positive(),
  })
  .strict()
  .refine((value) => greatestCommonDivisor(value.numerator, value.denominator) === 1, {
    message: "rational must be reduced to lowest terms",
  });

export const canvasSchema = z
  .object({
    format: z.enum(["landscape", "portrait", "square", "custom"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    pixelAspectRatio: positiveRationalSchema,
  })
  .strict();

export const timebaseSchema = z
  .object({
    framesPerSecond: positiveRationalSchema,
    dropFrame: z.literal(false),
  })
  .strict();

export const assetKindSchema = z.enum(["video", "audio", "image"]);
export const assetUsageSchema = z.enum([
  "a_roll",
  "screen_recording",
  "b_roll",
  "other",
  "unassigned",
]);

export const assetRefSchema = z
  .object({
    assetId: idSchema,
    name: z.string().min(1),
    kind: assetKindSchema,
    locator: z.string().min(1),
    fingerprint: z.string().min(1),
    durationMs: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    fps: positiveRationalSchema.nullable(),
    variableFrameRate: z.boolean(),
    conformedFps: positiveRationalSchema.nullable(),
    codec: z.string().nullable(),
    hasAudio: z.boolean(),
    offline: z.boolean(),
    proxyLocator: z.string().nullable(),
    thumbnailLocator: z.string().nullable(),
    waveformLocator: z.string().nullable(),
    usage: assetUsageSchema,
    createdAt: isoInstantSchema,
  })
  .strict();

export const laneKindSchema = z.enum([
  "program",
  "video",
  "screen_recording",
  "image",
  "text",
  "graphic",
  "caption",
  "audio",
  "automation",
]);

export const visualRoleSchema = z.enum([
  "main_visual",
  "supporting_visual",
  "caption",
  "decorative",
  "audio_only",
]);

export const laneSchema = z
  .object({
    laneId: idSchema,
    name: z.string().min(1),
    kind: laneKindSchema,
    order: z.number().int().nonnegative(),
    locked: z.boolean(),
    hidden: z.boolean(),
    muted: z.boolean(),
  })
  .strict();

export const sourceBindingSchema = z
  .object({
    assetId: idSchema,
    sourceRange: millisecondRangeSchema,
    playbackRate: positiveRationalSchema,
    playbackDirection: z.enum(["forward", "reverse"]).optional(),
  })
  .strict();

export const audioStateSchema = z
  .object({
    enabled: z.boolean(),
    gainMilliDb: z.number().int().min(-96_000).max(24_000),
    panPermille: permilleSchema,
    fadeInMs: z.number().int().min(0).max(10000).optional(),
    fadeOutMs: z.number().int().min(0).max(10000).optional(),
  })
  .strict();

export const presentationSchema = z
  .object({
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    scale: finiteNumberSchema.positive(),
    rotationDegrees: finiteNumberSchema,
    opacity: unitIntervalSchema,
    cropTop: unitIntervalSchema,
    cropRight: unitIntervalSchema,
    cropBottom: unitIntervalSchema,
    cropLeft: unitIntervalSchema,
    borderRadius: finiteNumberSchema.nonnegative(),
    mirrorHorizontal: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.cropLeft + value.cropRight >= 1) {
      context.addIssue({
        code: "custom",
        message: "horizontal crop must leave a visible interval",
        path: ["cropRight"],
      });
    }
    if (value.cropTop + value.cropBottom >= 1) {
      context.addIssue({
        code: "custom",
        message: "vertical crop must leave a visible interval",
        path: ["cropBottom"],
      });
    }
  });

export const automationKeyframeSchema = z
  .object({
    offsetFrame: frameSchema,
    value: finiteNumberSchema,
    interpolation: z.enum(["hold", "linear", "ease_in", "ease_out", "ease_in_out"]),
  })
  .strict();

export const mediaPayloadSchema = z
  .object({
    kind: z.literal("media"),
    mediaKind: z.enum(["video", "audio", "image"]),
  })
  .strict();

export const textPayloadSchema = z
  .object({
    kind: z.literal("text"),
    text: z.string(),
    styleToken: namespacedIdSchema,
  })
  .strict();

export const graphicPayloadSchema = z
  .object({
    kind: z.literal("graphic"),
    capabilityId: namespacedIdSchema,
    parameters: jsonObjectSchema,
  })
  .strict();

export const automationPayloadSchema = z
  .object({
    kind: z.literal("automation"),
    targetClipId: idSchema,
    parameter: z.enum([
      "x",
      "y",
      "scale",
      "rotationDegrees",
      "opacity",
      "cropTop",
      "cropRight",
      "cropBottom",
      "cropLeft",
      "borderRadius",
      "gainMilliDb",
      "panPermille",
    ]),
    keyframes: z.array(automationKeyframeSchema),
  })
  .strict();

export const legacyPayloadSchema = z
  .object({
    kind: z.literal("legacy"),
    legacyNamespace: namespacedIdSchema,
    legacyRef: idSchema,
    payloadHash: hashSchema,
  })
  .strict();

export const clipPayloadSchema = z.discriminatedUnion("kind", [
  mediaPayloadSchema,
  textPayloadSchema,
  graphicPayloadSchema,
  automationPayloadSchema,
  legacyPayloadSchema,
]);

export const clipProvenanceSchema = z
  .object({
    origin: z.enum(["manual", "agent", "packaging", "migration", "system"]),
    sourceTransactionId: idSchema.nullable(),
    legacyClipId: idSchema.nullable(),
  })
  .strict();

export const timelineClipSchema = z
  .object({
    clipId: idSchema,
    laneId: idSchema,
    kind: z.enum(["media", "text", "graphic", "automation", "legacy"]),
    name: z.string().min(1),
    visualRole: visualRoleSchema,
    timelineRange: frameRangeSchema,
    sourceBinding: sourceBindingSchema.nullable(),
    audioState: audioStateSchema.nullable(),
    presentation: presentationSchema.nullable(),
    payload: clipPayloadSchema,
    enabled: z.boolean(),
    locked: z.boolean(),
    provenance: clipProvenanceSchema,
  })
  .strict()
  .refine((value) => value.kind === value.payload.kind, {
    message: "clip kind must equal payload kind",
    path: ["payload", "kind"],
  });

export const timeMapBindingSchema = z
  .object({
    sourceClipId: idSchema,
    timeMapSegmentId: idSchema,
  })
  .strict();

export const programSpineEntrySchema = z
  .object({
    entryId: idSchema,
    clipId: idSchema,
    timeMapBinding: timeMapBindingSchema.nullable(),
  })
  .strict();

export const programSpineSchema = z
  .object({
    spineId: idSchema,
    coveragePolicy: z.literal("allow_gaps"),
    entries: z.array(programSpineEntrySchema),
  })
  .strict();

export const timelineMarkerSchema = z
  .object({
    markerId: idSchema,
    frame: frameSchema,
    label: z.string().min(1).max(128),
    color: z.enum(["teal", "blue", "yellow", "red", "purple"]),
  })
  .strict();

export const captionSourceSchema = z
  .object({
    kind: z.literal("transcript"),
    assetId: idSchema,
    assetFingerprint: z.string().min(1),
    transcriptId: idSchema,
    sourceCaptionId: idSchema,
    sourceStartMs: z.number().int().nonnegative(),
    sourceEndMs: z.number().int().positive(),
    clipId: idSchema,
  })
  .strict()
  .refine((value) => value.sourceEndMs > value.sourceStartMs, {
    message: "sourceEndMs must be greater than sourceStartMs",
    path: ["sourceEndMs"],
  });

export const captionProvenanceSchema = z
  .object({
    legacyCaptionId: idSchema.nullable(),
  })
  .strict();

export const captionCueSchema = z
  .object({
    captionCueId: idSchema,
    laneId: idSchema,
    text: z.string(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    timestampMs: z.number().int().nonnegative().nullable(),
    confidence: unitIntervalSchema.nullable(),
    confirmed: z.boolean(),
    source: captionSourceSchema.nullable(),
    provenance: captionProvenanceSchema,
  })
  .strict()
  .refine((value) => value.endMs > value.startMs, {
    message: "endMs must be greater than startMs",
    path: ["endMs"],
  });

export const semanticCueSchema = z
  .object({
    semanticCueId: idSchema,
    captionCueIds: z.array(idSchema),
    timelineRange: frameRangeSchema,
    intent: z.enum(["hook", "title", "claim", "data", "step", "comparison", "warning", "summary", "cta"]),
    keywords: z.array(z.string().min(1)),
    metric: z.string().nullable(),
    emphasis: z.union([
      z.literal("low"),
      z.literal("medium"),
      z.literal("high"),
      unitIntervalSchema,
    ]),
    confidence: unitIntervalSchema,
    locked: z.boolean(),
    lockSource: z.enum(["local", "manual", "agent"]).nullable(),
    analysisSource: z.enum(["local", "manual", "agent"]),
  })
  .strict();

export const transitionFallbackSchema = z
  .object({
    strategy: z.enum(["cut", "alternate", "reject"]),
    capabilityId: namespacedIdSchema.nullable(),
    parameters: jsonObjectSchema,
  })
  .strict();

export const transitionCompatibilitySchema = z
  .object({
    status: z.enum(["compatible", "fallback_required"]),
    validatorId: namespacedIdSchema,
    validatorVersion: z.number().int().positive(),
    checkedAgainstRevision: z.number().int().nonnegative(),
    reasons: z.array(z.string().min(1)),
  })
  .strict();

export const transitionEdgeSchema = z
  .object({
    transitionEdgeId: idSchema,
    adjacencyScope: z.enum(["program_spine", "lane"]),
    laneId: idSchema.nullable(),
    fromClipId: idSchema,
    toClipId: idSchema,
    capabilityId: namespacedIdSchema,
    durationFrames: positiveFrameSchema,
    alignment: z.enum(["before_cut", "center_on_cut", "after_cut"]),
    parameters: jsonObjectSchema,
    fallback: transitionFallbackSchema,
    compatibility: transitionCompatibilitySchema,
  })
  .strict();

export const packagingVersionPinSchema = z
  .object({
    artifactId: idSchema,
    artifactVersion: z.number().int().positive(),
    contentHash: hashSchema,
  })
  .strict();

export const captionAvoidanceSchema = z
  .object({
    mode: z.enum(["protect_lane", "protect_cues"]),
    captionLaneId: idSchema,
    captionCueIds: z.array(idSchema),
  })
  .strict();

export const packagingProvenanceSchema = z
  .object({
    origin: z.enum(["manual", "agent", "migration"]),
    sourceTransactionId: idSchema.nullable(),
    legacyDecisionId: idSchema.nullable(),
  })
  .strict();

export const packagingGroupSchema = z
  .object({
    packagingGroupId: idSchema,
    version: z.number().int().positive(),
    enabled: z.boolean(),
    timelineRange: frameRangeSchema,
    semanticCueIds: z.array(idSchema),
    memberClipIds: z.array(idSchema),
    memberCaptionCueIds: z.array(idSchema),
    memberTransitionEdgeIds: z.array(idSchema),
    visualProtagonistClipId: idSchema.nullable(),
    versionPin: packagingVersionPinSchema,
    captionAvoidance: captionAvoidanceSchema.nullable(),
    fallbackStrategy: z.enum(["disable_group", "keep_safe_members", "reject"]),
    provenance: packagingProvenanceSchema,
  })
  .strict();

const idToJsonObjectMapSchema = z.record(idSchema, jsonObjectSchema);
const legacyRemainderSchema = z
  .object({
    project: jsonObjectSchema,
    assetsById: idToJsonObjectMapSchema,
    tracksById: idToJsonObjectMapSchema,
    clipsById: idToJsonObjectMapSchema,
    captionsById: idToJsonObjectMapSchema,
    semanticCuesById: idToJsonObjectMapSchema,
  })
  .strict();

export const legacyTrackMappingSchema = z
  .object({
    legacyTrackId: idSchema.nullable(),
    laneId: idSchema,
    legacyKind: z.enum(["a-roll", "b-roll", "graphics", "captions", "audio"]),
    laneKind: laneKindSchema,
    synthetic: z.boolean(),
  })
  .strict();

export const legacyNamespaceSchema = z
  .object({
    sourceSchemaVersion: z.literal(1),
    sourceDocumentHash: hashSchema,
    migrationContractVersion: z.literal(1),
    sourcePresencePointers: z.array(z.string()),
    identityMappings: z
      .object({
        derivedIdMappings: z.array(
          z
            .object({
              source: idSchema,
              target: idSchema,
              reason: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
    trackMappings: z.array(legacyTrackMappingSchema),
    editorState: z
      .object({
        selectedClipId: idSchema.nullable(),
        playheadFrame: frameSchema,
      })
      .strict(),
    roundTripRemainders: legacyRemainderSchema,
    unknownFields: legacyRemainderSchema,
    legacyPackaging: z
      .object({
        settings: jsonValueSchema,
        decisions: z.array(jsonValueSchema),
        stylePacks: z.array(jsonValueSchema),
        clipIds: z.array(idSchema),
      })
      .strict(),
  })
  .strict();

export const extensionNamespaceMapSchema = z.record(namespacedIdSchema, jsonValueSchema);

export const timelineDocumentV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    documentId: idSchema,
    projectId: idSchema,
    timelineId: idSchema,
    revision: z.number().int().nonnegative(),
    name: z.string().min(1),
    createdAt: isoInstantSchema,
    updatedAt: isoInstantSchema,
    canvas: canvasSchema,
    timebase: timebaseSchema,
    durationFrames: positiveFrameSchema,
    assets: z.array(assetRefSchema),
    lanes: z.array(laneSchema),
    clips: z.array(timelineClipSchema),
    programSpine: programSpineSchema,
    markers: z.array(timelineMarkerSchema).optional(),
    captionCues: z.array(captionCueSchema),
    captionSuppressions: z.array(z.string().min(1)),
    semanticCues: z.array(semanticCueSchema),
    transitionEdges: z.array(transitionEdgeSchema),
    packagingGroups: z.array(packagingGroupSchema),
    extensions: extensionNamespaceMapSchema,
    legacy: legacyNamespaceSchema.nullable(),
  })
  .strict();

export type FrameRange = z.infer<typeof frameRangeSchema>;
export type MillisecondRange = z.infer<typeof millisecondRangeSchema>;
export type PositiveRational = z.infer<typeof positiveRationalSchema>;
export type CanvasV2 = z.infer<typeof canvasSchema>;
export type TimebaseV2 = z.infer<typeof timebaseSchema>;
export type AssetRefV2 = z.infer<typeof assetRefSchema>;
export type LaneKind = z.infer<typeof laneKindSchema>;
export type LaneV2 = z.infer<typeof laneSchema>;
export type VisualRole = z.infer<typeof visualRoleSchema>;
export type SourceBindingV2 = z.infer<typeof sourceBindingSchema>;
export type AudioStateV2 = z.infer<typeof audioStateSchema>;
export type PresentationV2 = z.infer<typeof presentationSchema>;
export type ClipPayloadV2 = z.infer<typeof clipPayloadSchema>;
export type TimelineClipV2 = z.infer<typeof timelineClipSchema>;
export type ProgramSpineEntryV2 = z.infer<typeof programSpineEntrySchema>;
export type ProgramSpineV2 = z.infer<typeof programSpineSchema>;
export type TimelineMarkerV2 = z.infer<typeof timelineMarkerSchema>;
export type CaptionCueV2 = z.infer<typeof captionCueSchema>;
export type SemanticCueV2 = z.infer<typeof semanticCueSchema>;
export type TransitionEdgeV2 = z.infer<typeof transitionEdgeSchema>;
export type PackagingGroupV2 = z.infer<typeof packagingGroupSchema>;
export type LegacyNamespaceV1 = z.infer<typeof legacyNamespaceSchema>;
export type TimelineDocumentV2 = z.infer<typeof timelineDocumentV2Schema>;
