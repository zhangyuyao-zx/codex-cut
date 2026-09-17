import {produce} from 'immer';
import {z} from 'zod';
import {captionCueSchema, captionSourceKey, clipKindSchema, findClip, normalizedRectSchema, packagingDecisionSchema, packagingStylePackSchema, projectDocumentSchema, textStyleSchema, timelineClipSchema, transformSchema, type ProjectDocument} from './project.js';
import {semanticCueSchema, semanticIntentSchema, type SemanticCue} from './semantics.js';
import {assertRegisteredPackagingDecision, getMotionPreset, getSfxPreset, resolveSubjectLayoutOffset, themeRegistry} from './packaging-system.js';
import {canvasProfileFormatSchema, getCanvasProfile} from './canvas-profiles.js';
import {parseCompiledPresentation, sceneBackgroundSchema} from './scene-presentation.js';

const updateClipPatchSchema = z.object({
  kind: clipKindSchema.optional(),
  name: z.string().min(1).optional(),
  assetId: z.string().nullable().optional(),
  startFrame: z.number().int().nonnegative().optional(),
  durationInFrames: z.number().int().positive().optional(),
  sourceStartMs: z.number().nonnegative().optional(),
  sourceEndMs: z.number().nonnegative().nullable().optional(),
  playbackRate: z.number().positive().optional(),
  volume: z.number().min(0).max(2).optional(),
  muted: z.boolean().optional(),
  transform: transformSchema.optional(),
  text: z.string().nullable().optional(),
  textStyle: textStyleSchema.nullable().optional(),
  recipeId: z.string().nullable().optional(),
  engine: z.enum(['remotion', 'hyperframes']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const updateCaptionPatchSchema = captionCueSchema.pick({text: true, startMs: true, endMs: true, confirmed: true}).partial();
const updateSemanticCuePatchSchema = z.object({
  captionIds: z.array(z.string().min(1)).optional(),
  startFrame: z.number().int().nonnegative().optional(),
  endFrame: z.number().int().positive().optional(),
  intent: semanticIntentSchema.optional(),
  keywords: z.array(z.string().min(1)).optional(),
  metric: z.string().nullable().optional(),
  emphasis: z.union([z.enum(['low', 'medium', 'high']), z.number().min(0).max(1)]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  locked: z.boolean().optional(),
  lockSource: z.enum(['local', 'manual', 'codex']).nullable().optional(),
  analysisSource: z.enum(['local', 'manual', 'codex']).optional(),
}).passthrough();
const packagingAlternativeUpdateSchema = z.union([
  z.string().min(1),
  z.object({
    recipeId: z.string().min(1).nullable().optional(),
    componentId: z.string().min(1).nullable().optional(),
    rationale: z.string().optional(),
  }).passthrough(),
]);
const packagingConstraintChecksUpdateSchema = z.union([
  z.record(z.string(), z.boolean()),
  z.array(z.object({name: z.string().min(1), passed: z.boolean(), detail: z.string().optional()}).passthrough()),
]);
// Do not derive this from packagingDecisionSchema: its persistence defaults
// are useful for old documents but would turn a `{status}` patch into a full
// object and overwrite confidence, alternatives, and lock state.
const updatePackagingDecisionPatchSchema = z.object({
  recipeId: z.string().min(1).nullable().optional(),
  componentId: z.string().min(1).nullable().optional(),
  iconId: z.string().min(1).nullable().optional(),
  motionPresetId: z.string().min(1).nullable().optional(),
  sfxPresetId: z.string().min(1).nullable().optional(),
  themeId: z.string().min(1).optional(),
  alternatives: z.array(packagingAlternativeUpdateSchema).optional(),
  rationale: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  constraintChecks: packagingConstraintChecksUpdateSchema.optional(),
  status: z.enum(['proposed', 'applied', 'rejected']).optional(),
  locked: z.boolean().optional(),
  appliedClipId: z.string().min(1).nullable().optional(),
}).passthrough();
const updatePackagingSettingsPatchSchema = z.object({
  themeId: z.string().min(1).optional(),
  density: z.enum(['restrained', 'standard', 'frequent']).optional(),
  subjectLayout: z.enum(['center', 'left', 'right']).optional(),
  allowFullscreen: z.boolean().optional(),
  allowPip: z.boolean().optional(),
  allowBRoll: z.boolean().optional(),
  showSafeZones: z.boolean().optional(),
  personSafeZone: normalizedRectSchema.nullable().optional(),
  stylePackId: z.string().min(1).nullable().optional(),
  captionStyle: z.enum(['standard', 'three-layer']).optional(),
  captionVisualId: z.string().min(1).nullable().optional(),
  // Stage upgrade review fix: project-level default scene background.
  sceneBackground: sceneBackgroundSchema.optional(),
}).passthrough();

export const projectOperationSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('insertClip'), clip: timelineClipSchema}),
  z.object({type: z.literal('moveClip'), clipId: z.string(), trackId: z.string(), startFrame: z.number().int().nonnegative()}),
  z.object({type: z.literal('trimClip'), clipId: z.string(), edge: z.enum(['start', 'end']), frame: z.number().int().nonnegative()}),
  z.object({type: z.literal('splitClip'), clipId: z.string(), frame: z.number().int().positive(), newClipId: z.string().min(1)}),
  z.object({type: z.literal('deleteClip'), clipId: z.string(), ripple: z.boolean().default(false)}),
  z.object({type: z.literal('updateClip'), clipId: z.string(), patch: updateClipPatchSchema}),
  z.object({type: z.literal('setSelection'), clipId: z.string().nullable()}),
  z.object({type: z.literal('setPlayhead'), frame: z.number().int().nonnegative()}),
  z.object({type: z.literal('setCanvasProfile'), format: canvasProfileFormatSchema}),
  z.object({type: z.literal('insertCaption'), caption: captionCueSchema}),
  z.object({type: z.literal('updateCaption'), captionId: z.string(), patch: updateCaptionPatchSchema}),
  z.object({type: z.literal('splitCaption'), captionId: z.string(), atMs: z.number().nonnegative(), newCaptionId: z.string().min(1), leftText: z.string(), rightText: z.string()}),
  z.object({type: z.literal('mergeCaptions'), firstCaptionId: z.string(), secondCaptionId: z.string()}),
  z.object({type: z.literal('deleteCaption'), captionId: z.string()}),
  z.object({type: z.literal('replaceSemanticAnalysis'), cues: z.array(semanticCueSchema), decisions: z.array(packagingDecisionSchema), preserveLocked: z.boolean().default(true)}),
  z.object({type: z.literal('updateSemanticCue'), cueId: z.string(), patch: updateSemanticCuePatchSchema}),
  z.object({type: z.literal('setSemanticCueLock'), cueId: z.string(), locked: z.boolean(), lockSource: z.enum(['local', 'manual', 'codex']).nullable().optional()}),
  z.object({type: z.literal('updatePackagingDecision'), decisionId: z.string(), patch: updatePackagingDecisionPatchSchema}),
  z.object({type: z.literal('updatePackagingSettings'), patch: updatePackagingSettingsPatchSchema}),
  z.object({type: z.literal('savePackagingStylePack'), stylePack: packagingStylePackSchema}),
  z.object({type: z.literal('activatePackagingStylePack'), stylePackId: z.string().min(1)}),
]);
export type ProjectOperation = z.infer<typeof projectOperationSchema>;

export const projectPatchSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['manual', 'codex', 'recipe', 'component', 'packaging', 'system']),
  baseRevision: z.number().int().nonnegative(),
  summary: z.string().min(1),
  operations: z.array(projectOperationSchema).min(1),
  createdAt: z.string(),
});
export type ProjectPatch = z.infer<typeof projectPatchSchema>;

const removeClip = (project: ProjectDocument, clipId: string) => {
  for (const track of project.tracks) {
    const index = track.clips.findIndex((clip) => clip.id === clipId);
    if (index >= 0) {
      const [clip] = track.clips.splice(index, 1);
      return {track, clip};
    }
  }
  return null;
};

const assertTrackUnlocked = (track: {id: string; name: string; locked: boolean}) => {
  if (track.locked) throw new Error(`Track is locked: ${track.name} (${track.id})`);
};

const assertCaptionTrackUnlocked = (project: ProjectDocument) => {
  const locked = project.tracks.find((track) => track.kind === 'captions' && track.locked);
  if (locked) assertTrackUnlocked(locked);
};

const isAutoGeneratedPackagingClip = (clip: {metadata: Record<string, unknown>}) =>
  clip.metadata.autoGenerated === true && typeof clip.metadata.packagingDecisionId === 'string';

const isProductionVisualClip = (clip: {metadata: Record<string, unknown>}) =>
  clip.metadata.autoGenerated === true
  && (typeof clip.metadata.productionVisualId === 'string' || typeof clip.metadata.production === 'object');

/**
 * §Phase-5/Stage-upgrade: host visuals (legacy host PiP fragments
 * `visualDirector.hostPip`, generic derived Host Visuals
 * `visualDirector.hostVisual` and compiled `metadata.presentation.role =
 * 'host'`) are production visuals too — a manual move / trim / split /
 * update must mark them manualOverride + packagingLocked exactly like every
 * other packaging result, so a later re-apply can never silently overwrite
 * the edit.
 */
const isVisualDirectorHostClip = (clip: {metadata: Record<string, unknown>}) => {
  const visualDirector = clip.metadata.visualDirector;
  const legacyHostFlag = typeof visualDirector === 'object'
    && visualDirector !== null
    && ((visualDirector as Record<string, unknown>).hostPip === true || (visualDirector as Record<string, unknown>).hostVisual === true);
  return clip.metadata.autoGenerated === true && (legacyHostFlag || parseCompiledPresentation(clip.metadata)?.role === 'host');
};

const markManualPackagingOverride = (clip: {metadata: Record<string, unknown>}) => {
  if (!isAutoGeneratedPackagingClip(clip) && !isProductionVisualClip(clip) && !isVisualDirectorHostClip(clip)) return;
  clip.metadata = {
    ...clip.metadata,
    manualOverride: true,
    packagingLocked: true,
  };
};

const mergeSemanticAnalysis = (
  project: ProjectDocument,
  incomingCues: SemanticCue[],
  incomingDecisions: ProjectDocument['packagingDecisions'],
  preserveLocked: boolean,
) => {
  const existingCues = project.semanticCues ?? [];
  const protectedCues = new Map(existingCues.filter((cue) => preserveLocked && cue.locked).map((cue) => [cue.id, cue]));
  const mergedCues = incomingCues.map((cue) => protectedCues.get(cue.id) ?? cue);
  for (const cue of protectedCues.values()) if (!mergedCues.some((candidate) => candidate.id === cue.id)) mergedCues.push(cue);

  const existingDecisions = project.packagingDecisions ?? [];
  const protectedDecisions = new Map(existingDecisions
    .filter((decision) => decision.locked || decision.status === 'applied')
    .map((decision) => [decision.id, decision]));
  const mergedDecisions = incomingDecisions.map((decision) => protectedDecisions.get(decision.id) ?? decision);
  for (const decision of protectedDecisions.values()) if (!mergedDecisions.some((candidate) => candidate.id === decision.id)) mergedDecisions.push(decision);
  return {semanticCues: mergedCues, packagingDecisions: mergedDecisions};
};

export const applyOperation = (project: ProjectDocument, operation: ProjectOperation): ProjectDocument =>
  produce(project, (draft) => {
    switch (operation.type) {
      case 'insertClip': {
        const track = draft.tracks.find((candidate) => candidate.id === operation.clip.trackId);
        if (!track) throw new Error(`Track not found: ${operation.clip.trackId}`);
        assertTrackUnlocked(track);
        if (findClip(draft, operation.clip.id)) throw new Error(`Clip already exists: ${operation.clip.id}`);
        track.clips.push(operation.clip);
        break;
      }
      case 'moveClip': {
        const source = findClip(draft, operation.clipId);
        if (!source) throw new Error(`Clip not found: ${operation.clipId}`);
        assertTrackUnlocked(source.track);
        const found = removeClip(draft, operation.clipId);
        if (!found) throw new Error(`Clip not found: ${operation.clipId}`);
        const target = draft.tracks.find((track) => track.id === operation.trackId);
        if (!target) throw new Error(`Track not found: ${operation.trackId}`);
        assertTrackUnlocked(target);
        found.clip.trackId = target.id;
        found.clip.startFrame = operation.startFrame;
        markManualPackagingOverride(found.clip);
        target.clips.push(found.clip);
        break;
      }
      case 'trimClip': {
        const found = findClip(draft, operation.clipId);
        if (!found) throw new Error(`Clip not found: ${operation.clipId}`);
        assertTrackUnlocked(found.track);
        const clip = found.clip;
        const clipEnd = clip.startFrame + clip.durationInFrames;
        if (operation.edge === 'start') {
          if (operation.frame >= clipEnd) throw new Error('Trim start must be before clip end');
          const delta = operation.frame - clip.startFrame;
          clip.startFrame = operation.frame;
          clip.durationInFrames -= delta;
          const sourceStartMs = Math.round(clip.sourceStartMs + (delta / draft.fps) * 1000 * clip.playbackRate);
          if (sourceStartMs < 0) throw new Error('Trim start exceeds available source media');
          clip.sourceStartMs = sourceStartMs;
        } else {
          if (operation.frame <= clip.startFrame) throw new Error('Trim end must be after clip start');
          clip.durationInFrames = operation.frame - clip.startFrame;
          if (clip.sourceEndMs !== null) {
            clip.sourceEndMs = Math.round(clip.sourceStartMs + (clip.durationInFrames / draft.fps) * 1000 * clip.playbackRate);
          }
        }
        markManualPackagingOverride(clip);
        break;
      }
      case 'splitClip': {
        const found = findClip(draft, operation.clipId);
        if (!found) throw new Error(`Clip not found: ${operation.clipId}`);
        assertTrackUnlocked(found.track);
        const clip = found.clip;
        const endFrame = clip.startFrame + clip.durationInFrames;
        if (operation.frame <= clip.startFrame || operation.frame >= endFrame) throw new Error('Split frame must be inside clip');
        const leftDuration = operation.frame - clip.startFrame;
        const rightDuration = endFrame - operation.frame;
        const sourceOffsetMs = Math.round((leftDuration / draft.fps) * 1000 * clip.playbackRate);
        const right = {
          ...clip,
          id: operation.newClipId,
          name: `${clip.name} · 分段`,
          startFrame: operation.frame,
          durationInFrames: rightDuration,
          sourceStartMs: Math.round(clip.sourceStartMs + sourceOffsetMs),
        };
        clip.durationInFrames = leftDuration;
        clip.sourceEndMs = Math.round(clip.sourceStartMs + sourceOffsetMs);
        markManualPackagingOverride(clip);
        markManualPackagingOverride(right);
        found.track.clips.push(right);
        break;
      }
      case 'deleteClip': {
        const source = findClip(draft, operation.clipId);
        if (!source) throw new Error(`Clip not found: ${operation.clipId}`);
        assertTrackUnlocked(source.track);
        const found = removeClip(draft, operation.clipId);
        if (!found) throw new Error(`Clip not found: ${operation.clipId}`);
        if (operation.ripple) {
          const deletedEnd = found.clip.startFrame + found.clip.durationInFrames;
          for (const clip of found.track.clips) {
            if (clip.startFrame >= deletedEnd) clip.startFrame -= found.clip.durationInFrames;
          }
        }
        if (draft.selectedClipId === operation.clipId) draft.selectedClipId = null;
        break;
      }
      case 'updateClip': {
        const found = findClip(draft, operation.clipId);
        if (!found) throw new Error(`Clip not found: ${operation.clipId}`);
        assertTrackUnlocked(found.track);
        const wasAutoGeneratedPackaging = isAutoGeneratedPackagingClip(found.clip);
        const originalPackagingMetadata = wasAutoGeneratedPackaging ? {...found.clip.metadata} : null;
        Object.assign(found.clip, operation.patch);
        if (wasAutoGeneratedPackaging) {
          found.clip.metadata = {
            ...found.clip.metadata,
            packagingDecisionId: found.clip.metadata.packagingDecisionId ?? originalPackagingMetadata?.packagingDecisionId ?? `manual-edit:${found.clip.id}`,
            semanticCueId: found.clip.metadata.semanticCueId ?? originalPackagingMetadata?.semanticCueId ?? null,
            autoGenerated: true,
          };
        }
        markManualPackagingOverride(found.clip);
        break;
      }
      case 'setSelection':
        draft.selectedClipId = operation.clipId;
        break;
      case 'setPlayhead':
        draft.playheadFrame = Math.min(operation.frame, draft.durationInFrames - 1);
        break;
      case 'setCanvasProfile': {
        const profile = getCanvasProfile(operation.format);
        const scaleX = profile.width / draft.width;
        const scaleY = profile.height / draft.height;
        draft.format = profile.format;
        draft.width = profile.width;
        draft.height = profile.height;
        for (const clip of draft.tracks.flatMap((track) => track.clips)) {
          clip.transform.x *= scaleX;
          clip.transform.y *= scaleY;
        }
        break;
      }
      case 'insertCaption': {
        assertCaptionTrackUnlocked(draft);
        if (draft.captions.some((candidate) => candidate.id === operation.caption.id)) throw new Error(`Caption already exists: ${operation.caption.id}`);
        if (operation.caption.endMs <= operation.caption.startMs) throw new Error('Caption end must be after caption start');
        draft.captions.push(operation.caption);
        draft.captions.sort((a, b) => a.startMs - b.startMs);
        break;
      }
      case 'updateCaption': {
        assertCaptionTrackUnlocked(draft);
        const caption = draft.captions.find((candidate) => candidate.id === operation.captionId);
        if (!caption) throw new Error(`Caption not found: ${operation.captionId}`);
        const timingOverride = operation.patch.startMs !== undefined || operation.patch.endMs !== undefined;
        if (timingOverride && caption.source) {
          const suppression = captionSourceKey(caption.source);
          if (!draft.captionSuppressions.includes(suppression)) draft.captionSuppressions.push(suppression);
          delete caption.source;
        }
        Object.assign(caption, operation.patch);
        if (caption.endMs <= caption.startMs) throw new Error('Caption end must be after caption start');
        break;
      }
      case 'splitCaption': {
        assertCaptionTrackUnlocked(draft);
        const index = draft.captions.findIndex((candidate) => candidate.id === operation.captionId);
        if (index < 0) throw new Error(`Caption not found: ${operation.captionId}`);
        const caption = draft.captions[index];
        if (operation.atMs <= caption.startMs || operation.atMs >= caption.endMs) throw new Error('Caption split must be inside the cue');
        if (caption.source) {
          const suppression = captionSourceKey(caption.source);
          if (!draft.captionSuppressions.includes(suppression)) draft.captionSuppressions.push(suppression);
          delete caption.source;
        }
        const right = {...caption, id: operation.newCaptionId, text: operation.rightText, startMs: operation.atMs};
        caption.text = operation.leftText;
        caption.endMs = operation.atMs;
        draft.captions.splice(index + 1, 0, right);
        break;
      }
      case 'mergeCaptions': {
        assertCaptionTrackUnlocked(draft);
        const firstIndex = draft.captions.findIndex((candidate) => candidate.id === operation.firstCaptionId);
        const secondIndex = draft.captions.findIndex((candidate) => candidate.id === operation.secondCaptionId);
        if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) throw new Error('Captions to merge were not found');
        const first = draft.captions[firstIndex];
        const second = draft.captions[secondIndex];
        for (const source of [first.source, second.source]) {
          if (!source) continue;
          const suppression = captionSourceKey(source);
          if (!draft.captionSuppressions.includes(suppression)) draft.captionSuppressions.push(suppression);
        }
        delete first.source;
        first.text = `${first.text.trim()} ${second.text.trim()}`.trim();
        first.startMs = Math.min(first.startMs, second.startMs);
        first.endMs = Math.max(first.endMs, second.endMs);
        first.confirmed = first.confirmed && second.confirmed;
        draft.captions.splice(secondIndex, 1);
        break;
      }
      case 'deleteCaption': {
        assertCaptionTrackUnlocked(draft);
        const index = draft.captions.findIndex((candidate) => candidate.id === operation.captionId);
        if (index < 0) throw new Error(`Caption not found: ${operation.captionId}`);
        const source = draft.captions[index].source;
        if (source) {
          const suppression = captionSourceKey(source);
          if (!draft.captionSuppressions.includes(suppression)) draft.captionSuppressions.push(suppression);
        }
        draft.captions.splice(index, 1);
        break;
      }
      case 'replaceSemanticAnalysis': {
        const parsedCues = operation.cues.map((cue) => semanticCueSchema.parse(cue));
        const parsedDecisions = operation.decisions.map((decision) => assertRegisteredPackagingDecision(packagingDecisionSchema.parse(decision)));
        const merged = mergeSemanticAnalysis(draft, parsedCues, parsedDecisions, operation.preserveLocked);
        draft.semanticCues = merged.semanticCues;
        draft.packagingDecisions = merged.packagingDecisions;
        break;
      }
      case 'updateSemanticCue': {
        const cue = (draft.semanticCues ?? []).find((candidate) => candidate.id === operation.cueId);
        if (!cue) throw new Error(`Semantic cue not found: ${operation.cueId}`);
        Object.assign(cue, operation.patch);
        semanticCueSchema.parse(cue);
        break;
      }
      case 'setSemanticCueLock': {
        const cue = (draft.semanticCues ?? []).find((candidate) => candidate.id === operation.cueId);
        if (!cue) throw new Error(`Semantic cue not found: ${operation.cueId}`);
        cue.locked = operation.locked;
        cue.lockSource = operation.locked ? (operation.lockSource ?? 'manual') : null;
        break;
      }
      case 'updatePackagingDecision': {
        const decision = (draft.packagingDecisions ?? []).find((candidate) => candidate.id === operation.decisionId);
        if (!decision) throw new Error(`Packaging decision not found: ${operation.decisionId}`);
        Object.assign(decision, operation.patch);
        assertRegisteredPackagingDecision(packagingDecisionSchema.parse(decision));
        break;
      }
      case 'updatePackagingSettings': {
        if (operation.patch.themeId && !themeRegistry.some((theme) => theme.id === operation.patch.themeId)) throw new Error(`Unknown packaging theme: ${operation.patch.themeId}`);
        Object.assign(draft.packagingSettings, operation.patch);
        if (operation.patch.themeId || operation.patch.subjectLayout) {
          for (const clip of draft.tracks.flatMap((track) => track.clips)) {
            if (clip.metadata.autoGenerated !== true || clip.metadata.manualOverride === true || clip.metadata.packagingLocked === true) continue;
            if (operation.patch.themeId) clip.metadata.themeId = operation.patch.themeId;
            if (operation.patch.subjectLayout && clip.kind !== 'audio') clip.transform.x = resolveSubjectLayoutOffset(draft.width, operation.patch.subjectLayout);
          }
        }
        break;
      }
      case 'savePackagingStylePack': {
        if (!themeRegistry.some((theme) => theme.id === operation.stylePack.themeId)) throw new Error(`Unknown packaging theme: ${operation.stylePack.themeId}`);
        if (operation.stylePack.defaultMotionPresetId && !getMotionPreset(operation.stylePack.defaultMotionPresetId)) throw new Error(`Unknown packaging motion preset: ${operation.stylePack.defaultMotionPresetId}`);
        if (operation.stylePack.defaultSfxPresetId && !getSfxPreset(operation.stylePack.defaultSfxPresetId)) throw new Error(`Unknown packaging SFX preset: ${operation.stylePack.defaultSfxPresetId}`);
        if (draft.packagingStylePacks.some((pack) => pack.id === operation.stylePack.id)) throw new Error(`Packaging style pack already exists: ${operation.stylePack.id}`);
        if (draft.packagingStylePacks.some((pack) => pack.name === operation.stylePack.name && pack.version === operation.stylePack.version)) throw new Error(`Packaging style pack version already exists: ${operation.stylePack.name} v${operation.stylePack.version}`);
        draft.packagingStylePacks.push(operation.stylePack);
        draft.packagingSettings.stylePackId = operation.stylePack.id;
        break;
      }
      case 'activatePackagingStylePack': {
        const pack = draft.packagingStylePacks.find((candidate) => candidate.id === operation.stylePackId);
        if (!pack) throw new Error(`Packaging style pack not found: ${operation.stylePackId}`);
        Object.assign(draft.packagingSettings, {
          stylePackId: pack.id,
          themeId: pack.themeId,
          density: pack.density,
          subjectLayout: pack.subjectLayout,
        });
        for (const clip of draft.tracks.flatMap((track) => track.clips)) {
          if (clip.metadata.autoGenerated !== true || clip.metadata.manualOverride === true || clip.metadata.packagingLocked === true) continue;
          clip.metadata.themeId = pack.themeId;
          if (clip.kind !== 'audio') clip.transform.x = resolveSubjectLayoutOffset(draft.width, pack.subjectLayout);
          if (pack.defaultMotionPresetId && clip.kind !== 'audio') clip.metadata.motionPresetId = pack.defaultMotionPresetId;
          if (pack.defaultSfxPresetId && clip.kind === 'audio') clip.metadata.sfxPresetId = pack.defaultSfxPresetId;
        }
        break;
      }
    }
  });

export const applyProjectPatch = (project: ProjectDocument, patch: ProjectPatch): ProjectDocument => {
  if (patch.baseRevision !== project.revision) {
    throw new Error(`Revision conflict: expected ${patch.baseRevision}, current ${project.revision}`);
  }
  let next = project;
  for (const operation of patch.operations) next = applyOperation(next, operation);
  const maxEnd = Math.max(
    1,
    ...next.tracks.flatMap((track) => track.clips.map((clip) => clip.startFrame + clip.durationInFrames)),
  );
  const timelineMutation = patch.operations.some((operation) =>
    ['insertClip', 'moveClip', 'trimClip', 'splitClip', 'deleteClip', 'updateClip'].includes(operation.type),
  );
  const primaryTrackIds = new Set(project.tracks.filter((track) => track.kind === 'a-roll').map((track) => track.id));
  const insertedPrimaryClipIds = new Set(patch.operations
    .filter((operation): operation is Extract<ProjectOperation, {type: 'insertClip'}> => operation.type === 'insertClip' && primaryTrackIds.has(operation.clip.trackId))
    .map((operation) => operation.clip.id));
  const touchesPrimaryTimeline = patch.operations.some((operation) => {
    if (operation.type === 'insertClip') return primaryTrackIds.has(operation.clip.trackId);
    if (operation.type === 'moveClip') {
      const current = findClip(project, operation.clipId)?.clip;
      return primaryTrackIds.has(operation.trackId) || Boolean(current && primaryTrackIds.has(current.trackId)) || insertedPrimaryClipIds.has(operation.clipId);
    }
    if (operation.type === 'trimClip' || operation.type === 'splitClip' || operation.type === 'deleteClip' || operation.type === 'updateClip') {
      const current = findClip(project, operation.clipId)?.clip;
      return Boolean(current && primaryTrackIds.has(current.trackId)) || insertedPrimaryClipIds.has(operation.clipId);
    }
    return false;
  });
  for (const track of next.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId || (clip.kind !== 'video' && clip.kind !== 'audio')) continue;
      const asset = next.assets.find((candidate) => candidate.id === clip.assetId);
      // Legacy/offline projects may keep a clip whose AssetRef is unavailable;
      // relink and QC own that failure. Bounds are enforceable only when the
      // referenced source metadata is present.
      if (!asset) continue;
      const calculatedEndMs = clip.sourceStartMs + clip.durationInFrames / next.fps * 1_000 * clip.playbackRate;
      const explicitEndMs = clip.sourceEndMs ?? calculatedEndMs;
      if (clip.sourceStartMs > asset.durationMs + 1 || calculatedEndMs > asset.durationMs + 1 || explicitEndMs > asset.durationMs + 1) {
        throw new Error(`Clip ${clip.id} exceeds source media bounds (${Math.round(asset.durationMs)}ms)`);
      }
      if (explicitEndMs <= clip.sourceStartMs) throw new Error(`Clip ${clip.id} has an invalid source range`);
    }
  }
  next = {
    ...next,
    revision: project.revision + 1,
    // Caption/semantic/decision-only patches are metadata edits and must not
    // collapse an otherwise valid timeline to the single-frame floor.
    // Only edits to the A-roll structure may shorten the program. Graphics,
    // captions, semantic packaging, music and SFX are overlays: inserting a
    // short card must never clamp later transcript cues out of the project.
    durationInFrames: timelineMutation && touchesPrimaryTimeline ? maxEnd : Math.max(project.durationInFrames, maxEnd),
    updatedAt: new Date().toISOString(),
  };
  return projectDocumentSchema.parse(next);
};
