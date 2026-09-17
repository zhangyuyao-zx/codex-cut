import {z} from 'zod';
import type {ProjectDocument, TimelineClip} from './project.js';
import {applyOperation, type ProjectOperation} from './operations.js';
import {computePipelineTimelineHash} from './pipeline-artifacts.js';

/**
 * v1.2 TimeMap service.  The TimeMap is derived from the A-roll EDL in
 * `ProjectDocument.tracks` — it never stores a second set of editing
 * decisions.  All timing is integer: source time in milliseconds and master
 * time in integer frames.  Every range is `[start, end)`.
 */

export const timeMapSegmentSchema = z.object({
  id: z.string().min(1),
  clipId: z.string().min(1),
  assetId: z.string().min(1),
  sourceStartMs: z.number().int().nonnegative(),
  sourceEndMs: z.number().int().nonnegative(),
  masterStartFrame: z.number().int().nonnegative(),
  masterEndFrame: z.number().int().nonnegative(),
  playbackRate: z.number().positive(),
}).superRefine((segment, context) => {
  if (segment.sourceEndMs <= segment.sourceStartMs) {
    context.addIssue({code: 'custom', path: ['sourceEndMs'], message: 'sourceEndMs must be after sourceStartMs'});
  }
  if (segment.masterEndFrame <= segment.masterStartFrame) {
    context.addIssue({code: 'custom', path: ['masterEndFrame'], message: 'masterEndFrame must be after masterStartFrame'});
  }
});
export type TimeMapSegment = z.infer<typeof timeMapSegmentSchema>;

export const timeMapOverlapSchema = z.object({
  clipA: z.string().min(1),
  clipB: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});
export type TimeMapOverlap = z.infer<typeof timeMapOverlapSchema>;

export const timeMapGapSchema = z.object({startFrame: z.number().int().nonnegative(), endFrame: z.number().int().nonnegative()});
export type TimeMapGap = z.infer<typeof timeMapGapSchema>;

export const timeMapSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
  timelineHash: z.string().min(8),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
  segments: z.array(timeMapSegmentSchema),
  overlaps: z.array(timeMapOverlapSchema),
  gaps: z.array(timeMapGapSchema),
});
export type TimeMap = z.infer<typeof timeMapSchema>;

export const selectTimeMapClips = (project: ProjectDocument): Array<{clip: TimelineClip}> => {
  const selected: Array<{clip: TimelineClip}> = [];
  for (const track of project.tracks) {
    if (track.kind !== 'a-roll' || track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.kind === 'video') selected.push({clip});
    }
  }
  return selected.sort((left, right) => left.clip.startFrame - right.clip.startFrame || left.clip.id.localeCompare(right.clip.id));
};

const missingAssetReferenceError = (clip: TimelineClip): Error =>
  new Error(`A-roll 视频片段 ${clip.id}（${clip.name}）缺少素材引用（assetId 为空），请重新导入或重新链接素材后再构建 TimeMap`);

/**
 * The only assets the Master Transcript may consume: the video assets actually
 * referenced by the current visible A-roll EDL, deduplicated and kept in
 * timeline order.  Screen recordings and other supporting media never
 * participate in transcription, so a screen recording without a normalized
 * transcript can never break scene generation.
 */
export const selectArollVoiceoverAssets = (project: ProjectDocument): Array<{assetId: string; fingerprint: string}> => {
  const entries: Array<{assetId: string; fingerprint: string}> = [];
  const seen = new Set<string>();
  for (const {clip} of selectTimeMapClips(project)) {
    if (!clip.assetId) throw missingAssetReferenceError(clip);
    if (seen.has(clip.assetId)) continue;
    const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
    if (!asset) {
      throw new Error(`A-roll 视频片段 ${clip.id}（${clip.name}）引用的素材 ${clip.assetId} 不存在，请重新导入或重新链接素材`);
    }
    seen.add(clip.assetId);
    entries.push({assetId: clip.assetId, fingerprint: asset.fingerprint});
  }
  return entries;
};

export const resolveClipSourceEndMs = (clip: TimelineClip, fps: number): number => {
  if (clip.sourceEndMs !== null && clip.sourceEndMs > clip.sourceStartMs) return clip.sourceEndMs;
  return Math.round(clip.sourceStartMs + clip.durationInFrames / fps * 1000 * clip.playbackRate);
};

/** Pure builder: derive TimeMap segments from the current A-roll EDL. */
export const buildTimeMap = (project: ProjectDocument): TimeMap => {
  const fps = Number.isFinite(project.fps) && project.fps > 0 ? project.fps : 30;
  const clips = selectTimeMapClips(project);
  const segments: TimeMapSegment[] = clips.map(({clip}) => {
    if (!clip.assetId) throw missingAssetReferenceError(clip);
    return {
      id: `tm-${clip.id}`,
      clipId: clip.id,
      assetId: clip.assetId,
      sourceStartMs: Math.round(clip.sourceStartMs),
      sourceEndMs: Math.round(resolveClipSourceEndMs(clip, fps)),
      masterStartFrame: clip.startFrame,
      masterEndFrame: clip.startFrame + clip.durationInFrames,
      playbackRate: clip.playbackRate,
    };
  });
  const overlaps: TimeMapOverlap[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const current = segments[index];
    if (current.masterStartFrame < previous.masterEndFrame) {
      overlaps.push({
        clipA: previous.clipId,
        clipB: current.clipId,
        startFrame: current.masterStartFrame,
        endFrame: Math.min(previous.masterEndFrame, current.masterEndFrame),
      });
    }
  }
  const gaps: TimeMapGap[] = [];
  let expected = 0;
  for (const segment of segments) {
    if (segment.masterStartFrame > expected) gaps.push({startFrame: expected, endFrame: segment.masterStartFrame});
    expected = Math.max(expected, segment.masterEndFrame);
  }
  if (expected < project.durationInFrames) gaps.push({startFrame: expected, endFrame: project.durationInFrames});
  return timeMapSchema.parse({
    schemaVersion: 1,
    projectId: project.id,
    baseRevision: project.revision,
    timelineHash: computePipelineTimelineHash(project),
    fps,
    width: project.width,
    height: project.height,
    durationInFrames: project.durationInFrames,
    segments,
    overlaps,
    gaps,
  });
};

/** §5: build the TimeMap as if the approved clip operations were applied. */
export const buildTimeMapFromOperations = (project: ProjectDocument, operations: readonly ProjectOperation[]): TimeMap => {
  let next = project;
  for (const operation of operations) next = applyOperation(next, operation);
  return buildTimeMap(next);
};

const segmentsForFrame = (timeMap: TimeMap, frame: number): TimeMapSegment | null => {
  if (!Number.isInteger(frame) || frame < 0) return null;
  return timeMap.segments.find((segment) => frame >= segment.masterStartFrame && frame < segment.masterEndFrame) ?? null;
};

const masterToSourceDeltaMs = (timeMap: TimeMap, segment: TimeMapSegment, frame: number): number =>
  (frame - segment.masterStartFrame) * (1000 / timeMap.fps) * segment.playbackRate;

/**
 * Point mapping.  Master gaps return null; deterministic rounding keeps the
 * result an integer millisecond.
 */
export const masterFrameToSource = (timeMap: TimeMap, masterFrame: number): {assetId: string; clipId: string; sourceMs: number} | null => {
  const segment = segmentsForFrame(timeMap, masterFrame);
  if (!segment) return null;
  return {
    assetId: segment.assetId,
    clipId: segment.clipId,
    sourceMs: Math.round(segment.sourceStartMs + masterToSourceDeltaMs(timeMap, segment, masterFrame)),
  };
};

/**
 * Inverse point mapping for a source millisecond.  The same source range may
 * be reused by several segments, so this returns an array (possibly empty).
 */
export const sourceMsToMasterFrames = (timeMap: TimeMap, assetId: string, sourceMs: number): number[] => {
  if (!Number.isInteger(sourceMs) || sourceMs < 0) return [];
  return timeMap.segments
    .filter((segment) => segment.assetId === assetId && sourceMs >= segment.sourceStartMs && sourceMs < segment.sourceEndMs)
    .map((segment) => Math.round(segment.masterStartFrame + (sourceMs - segment.sourceStartMs) / (1000 / timeMap.fps) / segment.playbackRate))
    .sort((left, right) => left - right);
};

export type MasterToSourceRange = {
  assetId: string;
  clipId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  masterStartFrame: number;
  masterEndFrame: number;
};

/**
 * Range mapping master → source.  start uses floor and end uses ceil so a
 * covered master range never loses a source millisecond at the boundaries.
 * Master gaps are returned as empty (no invented coverage).
 */
export const mapMasterRangeToSource = (timeMap: TimeMap, startFrame: number, endFrame: number): MasterToSourceRange[] => {
  if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || endFrame <= startFrame) return [];
  const ranges: MasterToSourceRange[] = [];
  for (const segment of timeMap.segments) {
    const overlapStart = Math.max(startFrame, segment.masterStartFrame);
    const overlapEnd = Math.min(endFrame, segment.masterEndFrame);
    if (overlapEnd <= overlapStart) continue;
    ranges.push({
      assetId: segment.assetId,
      clipId: segment.clipId,
      sourceStartMs: Math.max(0, Math.floor(segment.sourceStartMs + masterToSourceDeltaMs(timeMap, segment, overlapStart))),
      sourceEndMs: Math.max(1, Math.ceil(segment.sourceStartMs + masterToSourceDeltaMs(timeMap, segment, overlapEnd))),
      masterStartFrame: overlapStart,
      masterEndFrame: overlapEnd,
    });
  }
  return ranges;
};

export type SourceToMasterRange = {
  clipId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  masterStartFrame: number;
  masterEndFrame: number;
};

export const mapSourceRangeToMaster = (timeMap: TimeMap, assetId: string, startMs: number, endMs: number): SourceToMasterRange[] => {
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || endMs <= startMs) return [];
  const ranges: SourceToMasterRange[] = [];
  for (const segment of timeMap.segments) {
    if (segment.assetId !== assetId) continue;
    const overlapStartMs = Math.max(startMs, segment.sourceStartMs);
    const overlapEndMs = Math.min(endMs, segment.sourceEndMs);
    if (overlapEndMs <= overlapStartMs) continue;
    const msPerFrame = (1000 / timeMap.fps) * segment.playbackRate;
    ranges.push({
      clipId: segment.clipId,
      sourceStartMs: overlapStartMs,
      sourceEndMs: overlapEndMs,
      masterStartFrame: Math.max(0, Math.floor(segment.masterStartFrame + (overlapStartMs - segment.sourceStartMs) / msPerFrame)),
      masterEndFrame: Math.min(timeMap.durationInFrames, Math.ceil(segment.masterStartFrame + (overlapEndMs - segment.sourceStartMs) / msPerFrame)),
    });
  }
  return ranges;
};
