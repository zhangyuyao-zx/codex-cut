import {z} from 'zod';
import type {ProjectDocument} from './project.js';

/**
 * v1.2 pipeline artifact envelope, staleness rules and the derived
 * MasterTimelineSnapshot.  The editable `project.json` stays the transactional
 * source of truth; everything here is a reviewable derived artifact stored in
 * `pipeline/v1.2/` and must never be written back into `project.json`.
 */

export const pipelineArtifactKindSchema = z.enum([
  'timemap',
  'source-transcript',
  'master-transcript',
  'asset-index',
  'semantic-beats',
  'scene-specs',
  'packaging-plan',
  'smart-packaging-design',
  'smart-packaging-design-preflight',
  'smart-packaging-registry-eligibility-ledger',
  'smart-packaging-registry-gate',
  'smart-packaging-resolution',
  'smart-packaging-fallback-inspection',
  'smart-packaging-runtime-context',
  'scene-spec-projection',
  'smart-packaging-implementation-preflight',
  'smart-packaging-preview-request',
  'smart-packaging-preview-result',
  'smart-packaging-preview-review',
  'smart-packaging-proposal',
  'smart-packaging-g2-decision',
  'qc-report',
  'cut-qc-report',
  'autofix-patch',
]);
export type PipelineArtifactKind = z.infer<typeof pipelineArtifactKindSchema>;

export const pipelineArtifactSourceSchema = z.enum(['local', 'manual', 'codex', 'system']);
export type PipelineArtifactSource = z.infer<typeof pipelineArtifactSourceSchema>;

export const pipelineArtifactEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  kind: pipelineArtifactKindSchema,
  projectId: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
  timelineHash: z.string().min(8),
  generatedAt: z.string().min(1),
  source: pipelineArtifactSourceSchema.default('local'),
  payload: z.unknown(),
}).passthrough();
export type PipelineArtifactEnvelope = z.infer<typeof pipelineArtifactEnvelopeSchema>;

/** §3.1: read-only derived snapshot of the single editable Master Timeline. */
export const masterTimelineSnapshotSchema = z.object({
  projectId: z.string().min(1),
  projectRevision: z.number().int().nonnegative(),
  timelineHash: z.string().min(8),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
});
export type MasterTimelineSnapshot = z.infer<typeof masterTimelineSnapshotSchema>;

/** Deterministic stable JSON serialization: object keys sorted, arrays kept in order. */
export const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return JSON.stringify(String(value));
  return JSON.stringify(value);
};

/** FNV-1a 32-bit with a configurable seed.  Deterministic across Node/browser. */
export const fnv1a32 = (value: string, seed = 0x811c9dc5): number => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** Two independent FNV passes combined into a 16-hex timeline hash. */
export const stableTimelineHash = (value: string): string => {
  const left = fnv1a32(value, 0x811c9dc5).toString(16).padStart(8, '0');
  const right = fnv1a32(value, 0x01000193).toString(16).padStart(8, '0');
  return `${left}${right}`;
};

/**
 * Hash input for every v1.2 pipeline artifact.  Only the rough-cut-relevant
 * part of the project is included: canvas, fps, duration and the A-roll EDL
 * with the source fingerprints of the media it references.  Metadata edits
 * (captions, semantics, packaging settings) must NOT invalidate the TimeMap.
 */
export const buildPipelineTimelineHashInput = (project: ProjectDocument): unknown => {
  const aRollTracks = project.tracks.filter((track) => track.kind === 'a-roll');
  const clips = aRollTracks
    .flatMap((track) => track.clips.map((clip) => ({trackId: track.id, trackHidden: track.hidden, clip})))
    .filter(({clip}) => clip.kind === 'video')
    .sort((left, right) => left.clip.startFrame - right.clip.startFrame || left.clip.id.localeCompare(right.clip.id))
    .map(({trackId, trackHidden, clip}) => {
      const asset = clip.assetId ? project.assets.find((candidate) => candidate.id === clip.assetId) ?? null : null;
      return {
        trackId,
        trackHidden,
        clipId: clip.id,
        assetId: clip.assetId,
        assetFingerprint: asset?.fingerprint ?? 'missing-asset',
        startFrame: clip.startFrame,
        durationInFrames: clip.durationInFrames,
        sourceStartMs: clip.sourceStartMs,
        sourceEndMs: clip.sourceEndMs,
        playbackRate: clip.playbackRate,
      };
    });
  return {
    projectId: project.id,
    fps: project.fps,
    width: project.width,
    height: project.height,
    durationInFrames: project.durationInFrames,
    clips,
  };
};

export const computePipelineTimelineHash = (project: ProjectDocument): string =>
  stableTimelineHash(stableSerialize(buildPipelineTimelineHashInput(project)));

export const createMasterTimelineSnapshot = (project: ProjectDocument): MasterTimelineSnapshot =>
  masterTimelineSnapshotSchema.parse({
    projectId: project.id,
    projectRevision: project.revision,
    timelineHash: computePipelineTimelineHash(project),
    fps: project.fps,
    width: project.width,
    height: project.height,
    durationInFrames: project.durationInFrames,
  });

export const createPipelineArtifactEnvelope = <Payload>(
  kind: PipelineArtifactKind,
  payload: Payload,
  meta: {
    projectId: string;
    baseRevision: number;
    timelineHash: string;
    source?: PipelineArtifactSource;
    id?: string;
    generatedAt?: string;
  },
): PipelineArtifactEnvelope =>
  pipelineArtifactEnvelopeSchema.parse({
    schemaVersion: 1,
    id: meta.id ?? `${kind}-${crypto.randomUUID()}`,
    kind,
    projectId: meta.projectId,
    baseRevision: meta.baseRevision,
    timelineHash: meta.timelineHash,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    source: meta.source ?? 'local',
    payload,
  });

export type ArtifactStaleness = {stale: boolean; reason: string | null};

/**
 * §12: an artifact whose projectId or timelineHash does not match the current
 * project must be marked stale and the UI must not allow applying it.
 */
export const getArtifactStaleness = (
  envelope: Pick<PipelineArtifactEnvelope, 'projectId' | 'timelineHash'>,
  current: {projectId: string; timelineHash: string},
): ArtifactStaleness => {
  if (envelope.projectId !== current.projectId) {
    return {stale: true, reason: `artifact 属于其他项目 (${envelope.projectId.slice(0, 8)}…)`};
  }
  if (envelope.timelineHash !== current.timelineHash) {
    return {stale: true, reason: '粗剪时间线已变化，产物需要重新生成'};
  }
  return {stale: false, reason: null};
};

export const parsePipelineArtifactEnvelope = (raw: unknown): PipelineArtifactEnvelope =>
  pipelineArtifactEnvelopeSchema.parse(raw);
