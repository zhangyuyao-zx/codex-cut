import {z} from 'zod';
import {semanticCueSchema, type SemanticCue} from './semantics.js';
import {canvasProfileFormatSchema, getCanvasProfile} from './canvas-profiles.js';
import {sceneBackgroundSchema} from './scene-presentation.js';

export const projectFormatSchema = canvasProfileFormatSchema;
export type ProjectFormat = z.infer<typeof projectFormatSchema>;

export const trackKindSchema = z.enum(['a-roll', 'b-roll', 'graphics', 'captions', 'audio']);
export type TrackKind = z.infer<typeof trackKindSchema>;

export const clipKindSchema = z.enum(['video', 'audio', 'image', 'text', 'recipe', 'component', 'hyperframes']);
export type ClipKind = z.infer<typeof clipKindSchema>;

export const frameRateModeSchema = z.enum(['native', 'frame-sampling', 'optical-flow']);
export type FrameRateMode = z.infer<typeof frameRateModeSchema>;

export const assetUsageValues = ['a_roll', 'screen_recording', 'b_roll', 'other', 'unassigned'] as const;
export const assetUsageSchema = z.enum(assetUsageValues);
export type AssetUsage = z.infer<typeof assetUsageSchema>;

export const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  kind: z.enum(['video', 'audio', 'image']),
  fingerprint: z.string().min(1),
  durationMs: z.number().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  fps: z.number().positive().nullable(),
  variableFrameRate: z.boolean().default(false),
  conformedFps: z.number().positive().nullable().default(null),
  frameRateMode: frameRateModeSchema.default('native'),
  codec: z.string().nullable(),
  hasAudio: z.boolean(),
  offline: z.boolean().default(false),
  proxyPath: z.string().nullable().default(null),
  thumbnailPath: z.string().nullable().default(null),
  waveformPath: z.string().nullable().default(null),
  /** Explicit human-confirmed purpose. Missing means a legacy/unassigned asset. */
  usage: assetUsageSchema.optional(),
  createdAt: z.string(),
});
export type AssetRef = z.infer<typeof assetSchema>;

export const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number().positive(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  cropTop: z.number().min(0).max(1),
  cropRight: z.number().min(0).max(1),
  cropBottom: z.number().min(0).max(1),
  cropLeft: z.number().min(0).max(1),
  borderRadius: z.number().nonnegative(),
});
export type ClipTransform = z.infer<typeof transformSchema>;

export const textStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900),
  color: z.string(),
  backgroundColor: z.string(),
  align: z.enum(['left', 'center', 'right']),
});
export type TextStyle = z.infer<typeof textStyleSchema>;

export const timelineClipSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  kind: clipKindSchema,
  name: z.string().min(1),
  assetId: z.string().nullable(),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  sourceStartMs: z.number().nonnegative(),
  sourceEndMs: z.number().nonnegative().nullable(),
  playbackRate: z.number().positive(),
  volume: z.number().min(0).max(2),
  muted: z.boolean(),
  transform: transformSchema,
  text: z.string().nullable(),
  textStyle: textStyleSchema.nullable(),
  recipeId: z.string().nullable(),
  engine: z.enum(['remotion', 'hyperframes']).default('remotion'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type TimelineClip = z.infer<typeof timelineClipSchema>;

export const timelineTrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: trackKindSchema,
  locked: z.boolean(),
  hidden: z.boolean(),
  muted: z.boolean(),
  clips: z.array(timelineClipSchema),
});
export type TimelineTrack = z.infer<typeof timelineTrackSchema>;

export const captionSourceSchema = z.strictObject({
  kind: z.literal('transcript'),
  assetId: z.string().min(1),
  assetFingerprint: z.string().min(1),
  transcriptId: z.string().min(1),
  sourceCaptionId: z.string().min(1),
  sourceStartMs: z.number().int().nonnegative(),
  sourceEndMs: z.number().int().positive(),
  clipId: z.string().min(1),
}).superRefine((source, context) => {
  if (source.sourceEndMs <= source.sourceStartMs) context.addIssue({code: 'custom', path: ['sourceEndMs'], message: 'sourceEndMs must be after sourceStartMs'});
});
export type CaptionSource = z.infer<typeof captionSourceSchema>;
export const captionSourceKey = (source: CaptionSource): string =>
  [source.assetId, source.transcriptId, source.sourceCaptionId, source.clipId].map(encodeURIComponent).join('|');

export const captionCueSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  timestampMs: z.number().nonnegative().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  confirmed: z.boolean(),
  /**
   * Present only for captions derived from an asset transcript through the
   * TimeMap. Old projects and manually-authored captions remain valid without
   * this field. Keeping the source range here makes multi-asset captions
   * traceable without treating master-timeline milliseconds as source time.
   */
  source: captionSourceSchema.optional(),
});
export type CaptionCue = z.infer<typeof captionCueSchema>;

// Persisted packaging schemas live here (rather than importing packaging.ts)
// so loading an old project cannot trigger a project → planner → project cycle.
export const packagingDensitySchema = z.enum(['restrained', 'standard', 'frequent']);
export type PackagingDensity = z.infer<typeof packagingDensitySchema>;
export const subjectLayoutSchema = z.enum(['center', 'left', 'right']);
export type SubjectLayout = z.infer<typeof subjectLayoutSchema>;
export const normalizedRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).refine((rect) => rect.x + rect.width <= 1.000001 && rect.y + rect.height <= 1.000001, 'Normalized rectangle must stay inside the frame');
export type NormalizedRect = z.infer<typeof normalizedRectSchema>;
export const packagingSettingsSchema = z.object({
  themeId: z.string().min(1).default('midnight-tech'),
  density: packagingDensitySchema.default('standard'),
  subjectLayout: subjectLayoutSchema.default('center'),
  allowFullscreen: z.boolean().default(true),
  allowPip: z.boolean().default(false),
  allowBRoll: z.boolean().default(true),
  showSafeZones: z.boolean().default(false),
  personSafeZone: normalizedRectSchema.nullable().default(null),
  stylePackId: z.string().min(1).nullable().default(null),
  captionStyle: z.enum(['standard', 'three-layer']).default('standard'),
  // Stage C Phase 4: project-level caption production visual.  `null` (the
  // default for old projects) keeps the current standard CaptionLayer.
  captionVisualId: z.string().min(1).nullable().default(null),
  // Stage upgrade review fix: project-level default scene background.  Scenes
  // with `background=inherit` deterministically inherit this default (the
  // Composition root canvas renders it with the existing Theme Tokens).
  // Old projects without the key parse to `inherit` (no behavior change).
  sceneBackground: sceneBackgroundSchema.default(() => sceneBackgroundSchema.parse({mode: 'inherit', assetId: null, themeId: null})),
}).passthrough();
export type PackagingSettings = z.infer<typeof packagingSettingsSchema>;
export const packagingStylePackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive(),
  createdAt: z.string(),
  source: z.enum(['manual', 'codex']).default('manual'),
  themeId: z.string().min(1),
  density: packagingDensitySchema,
  subjectLayout: subjectLayoutSchema,
  iconStyleFamily: z.string().min(1).default('geometric-outline'),
  defaultMotionPresetId: z.string().min(1).nullable().default(null),
  defaultSfxPresetId: z.string().min(1).nullable().default(null),
  locked: z.boolean().default(true),
}).passthrough();
export type PackagingStylePack = z.infer<typeof packagingStylePackSchema>;
export const packagingDecisionStatusSchema = z.enum(['proposed', 'applied', 'rejected']);
export type PackagingDecisionStatus = z.infer<typeof packagingDecisionStatusSchema>;
export const packagingAlternativeSchema = z.object({
  recipeId: z.string().min(1).nullable().default(null),
  componentId: z.string().min(1).nullable().default(null),
  rationale: z.string().default(''),
}).passthrough();
export type PackagingAlternative = z.infer<typeof packagingAlternativeSchema>;
export const packagingConstraintChecksSchema = z.union([
  z.record(z.string(), z.boolean()),
  z.array(z.object({
    ruleId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    passed: z.boolean(),
    message: z.string().optional(),
    detail: z.string().optional(),
    severity: z.enum(['error', 'warning', 'info']).optional(),
  }).passthrough()),
]).default({});
export const packagingDecisionSchema = z.object({
  id: z.string().min(1),
  cueId: z.string().min(1),
  recipeId: z.string().min(1).nullable().default(null),
  componentId: z.string().min(1).nullable().default(null),
  iconId: z.string().min(1).nullable().default(null),
  motionPresetId: z.string().min(1).nullable().default(null),
  sfxPresetId: z.string().min(1).nullable().default(null),
  themeId: z.string().min(1).default('midnight-tech'),
  alternatives: z.array(z.union([z.string().min(1), packagingAlternativeSchema])).default([]),
  rationale: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.6),
  constraintChecks: packagingConstraintChecksSchema,
  status: packagingDecisionStatusSchema.default('proposed'),
  locked: z.boolean().default(false),
  appliedClipId: z.string().min(1).nullable().default(null),
}).passthrough();
export type PackagingDecision = z.infer<typeof packagingDecisionSchema>;

export const projectDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  format: projectFormatSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  durationInFrames: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assets: z.array(assetSchema),
  tracks: z.array(timelineTrackSchema),
  captions: z.array(captionCueSchema),
  /** Stable source-caption keys intentionally hidden by a manual delete,
   * split, merge, or timing override. They prevent a later TimeMap rebuild
   * from silently resurrecting an edit the user already made. */
  captionSuppressions: z.array(z.string().min(1)).default([]),
  semanticCues: z.array(semanticCueSchema).default([]),
  packagingDecisions: z.array(packagingDecisionSchema).default([]),
  packagingSettings: packagingSettingsSchema.default(() => packagingSettingsSchema.parse({})),
  packagingStylePacks: z.array(packagingStylePackSchema).default([]),
  selectedClipId: z.string().nullable(),
  playheadFrame: z.number().int().nonnegative(),
}).passthrough();
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;
export type {SemanticCue};

export const defaultTransform = (): ClipTransform => ({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  cropLeft: 0,
  borderRadius: 0,
});

export const defaultTextStyle = (): TextStyle => ({
  fontFamily: 'PingFang SC, system-ui, sans-serif',
  fontSize: 64,
  fontWeight: 700,
  color: '#ffffff',
  backgroundColor: 'transparent',
  align: 'center',
});

export const createProjectDocument = (name = '未命名口播项目', format: ProjectFormat = 'landscape'): ProjectDocument => {
  const now = new Date().toISOString();
  const canvas = getCanvasProfile(format);
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    format,
    width: canvas.width,
    height: canvas.height,
    fps: 30,
    durationInFrames: 300,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    assets: [],
    tracks: [
      {id: 'track-a-roll', name: '主口播', kind: 'a-roll', locked: false, hidden: false, muted: false, clips: []},
      {id: 'track-b-roll', name: 'B-roll', kind: 'b-roll', locked: false, hidden: false, muted: false, clips: []},
      {id: 'track-graphics', name: '动态图形', kind: 'graphics', locked: false, hidden: false, muted: false, clips: []},
      {id: 'track-captions', name: '字幕', kind: 'captions', locked: false, hidden: false, muted: false, clips: []},
      {id: 'track-audio', name: '音乐 / 音效', kind: 'audio', locked: false, hidden: false, muted: false, clips: []},
    ],
    captions: [],
    captionSuppressions: [],
    semanticCues: [],
    packagingDecisions: [],
    packagingSettings: packagingSettingsSchema.parse({}),
    packagingStylePacks: [],
    selectedClipId: null,
    playheadFrame: 0,
  };
};

export const findClip = (project: ProjectDocument, clipId: string) => {
  for (const track of project.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return {track, clip};
  }
  return null;
};
