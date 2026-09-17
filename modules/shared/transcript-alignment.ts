import {z} from 'zod';
import {transcriptionResultSchema, transcriptionWordSchema, type SilenceCandidate, type TranscriptionWord} from './transcription.js';
import {captionSourceKey, type CaptionCue, type CaptionSource, type ProjectDocument} from './project.js';
import type {ProjectOperation} from './operations.js';
import {mapSourceRangeToMaster, type TimeMap} from './timemap.js';
import {fnv1a32} from './pipeline-artifacts.js';

/**
 * v1.2 transcript alignment.  Existing `transcripts/<assetId>.normalized.json`
 * files (captions/words/silenceCandidates, no schemaVersion) stay readable;
 * the v2 source transcript adds stable wordId/segmentId and provenance without
 * ever rewriting the old file.  The Master Transcript is derived through the
 * TimeMap: words removed by the rough cut never appear in it.
 */

const stableWordHash = (value: string) => fnv1a32(value, 0x9e3779b9).toString(36).padStart(7, '0');

/** Legacy shape: exactly what the existing transcription pipeline writes. */
export const legacySourceTranscriptSchema = transcriptionResultSchema;
export type LegacySourceTranscript = z.infer<typeof legacySourceTranscriptSchema>;

export const sourceTranscriptEngineSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1).nullable().default(null),
}).passthrough();

export const sourceTranscriptWordSchema = transcriptionWordSchema.extend({
  wordId: z.string().min(1),
  segmentId: z.string().min(1).nullable(),
});
export type SourceTranscriptWord = z.infer<typeof sourceTranscriptWordSchema>;

export const sourceTranscriptSchema = z.object({
  schemaVersion: z.literal(2),
  transcriptId: z.string().min(1),
  assetId: z.string().min(1),
  assetFingerprint: z.string().min(1),
  captions: z.array(z.object({
    id: z.string().min(1),
    text: z.string(),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
    timestampMs: z.number().nonnegative().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    confirmed: z.boolean(),
  })),
  words: z.array(sourceTranscriptWordSchema),
  language: z.string().min(1).nullable(),
  durationMs: z.number().nonnegative(),
  silenceCandidates: z.array(z.object({
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
    durationMs: z.number().nonnegative(),
    reason: z.string().min(1),
  })),
  generatedAt: z.string().min(1),
  engine: sourceTranscriptEngineSchema.nullable().default(null),
}).passthrough();
export type SourceTranscript = z.infer<typeof sourceTranscriptSchema>;

const captionForWord = (captions: readonly CaptionCue[], word: TranscriptionWord): CaptionCue | null => {
  const midpoint = (word.startMs + word.endMs) / 2;
  return captions.find((caption) => midpoint >= caption.startMs && midpoint < caption.endMs) ?? null;
};

const wordIdFor = (assetId: string, index: number, word: TranscriptionWord): string =>
  `w-${stableWordHash(`${assetId}|${index}|${word.word}|${word.startMs}|${word.endMs}`)}`;

/**
 * Compatible upgrade of a legacy normalized transcript.  Word and segment ids
 * are deterministic, so running it twice over the same input yields identical
 * results.  This function never touches the file on disk.
 */
export const upgradeSourceTranscript = (
  legacy: LegacySourceTranscript,
  meta: {assetId: string; assetFingerprint: string; transcriptId?: string; generatedAt?: string},
): SourceTranscript =>
  sourceTranscriptSchema.parse({
    schemaVersion: 2,
    transcriptId: meta.transcriptId ?? `st-${stableWordHash(`${meta.assetId}|${meta.assetFingerprint}`)}`,
    assetId: meta.assetId,
    assetFingerprint: meta.assetFingerprint,
    captions: legacy.captions,
    words: legacy.words.map((word, index) => ({
      ...word,
      wordId: wordIdFor(meta.assetId, index, word),
      segmentId: captionForWord(legacy.captions, word)?.id ?? null,
    })),
    language: legacy.language,
    durationMs: legacy.durationMs,
    silenceCandidates: legacy.silenceCandidates,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    engine: {name: 'whisper', model: null},
  });

/**
 * Parse a transcript JSON that may be the legacy shape (no schemaVersion) or
 * the v2 shape.  Legacy payloads are upgraded in memory; missing stable ids in
 * v2 payloads are repaired deterministically.  Old files are never rewritten.
 */
export const parseSourceTranscript = (
  raw: unknown,
  meta: {assetId: string; assetFingerprint: string; transcriptId?: string; generatedAt?: string},
): SourceTranscript => {
  const record = raw as Record<string, unknown> | null;
  const legacy = legacySourceTranscriptSchema.safeParse(raw);
  if (legacy.success) return upgradeSourceTranscript(legacy.data, meta);
  const parsed = sourceTranscriptSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`无法解析转写文件：${detail || 'unknown parse error'}`);
  }
  const v2 = parsed.data;
  const captions = v2.captions as CaptionCue[];
  const words: SourceTranscriptWord[] = v2.words.map((word, index) => ({
    ...word,
    wordId: typeof record?.words === 'object' && record.words !== null && typeof (record.words as Array<Record<string, unknown>>)[index]?.wordId === 'string'
      ? word.wordId
      : wordIdFor(v2.assetId, index, word),
    segmentId: typeof (record?.words as Array<Record<string, unknown>> | undefined)?.[index]?.segmentId === 'string'
      ? word.segmentId
      : captionForWord(captions, word)?.id ?? null,
  }));
  return sourceTranscriptSchema.parse({...v2, words});
};

export const masterTranscriptWordSchema = z.object({
  wordId: z.string().min(1),
  sourceWordId: z.string().min(1),
  assetId: z.string().min(1),
  segmentId: z.string().min(1).nullable(),
  text: z.string(),
  sourceStartMs: z.number().int().nonnegative(),
  sourceEndMs: z.number().int().nonnegative(),
  masterStartFrame: z.number().int().nonnegative(),
  masterEndFrame: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).nullable(),
}).superRefine((word, context) => {
  if (word.sourceEndMs <= word.sourceStartMs) context.addIssue({code: 'custom', path: ['sourceEndMs'], message: 'sourceEndMs must be after sourceStartMs'});
  if (word.masterEndFrame <= word.masterStartFrame) context.addIssue({code: 'custom', path: ['masterEndFrame'], message: 'masterEndFrame must be after masterStartFrame'});
});
export type MasterTranscriptWord = z.infer<typeof masterTranscriptWordSchema>;

export const masterTranscriptSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
  timelineHash: z.string().min(8),
  fps: z.number().positive(),
  durationInFrames: z.number().int().positive(),
  sourceTranscriptIds: z.array(z.string().min(1)),
  sourceAssetIds: z.array(z.string().min(1)),
  words: z.array(masterTranscriptWordSchema),
});
export type MasterTranscript = z.infer<typeof masterTranscriptSchema>;

const MIN_WORD_SURVIVAL_RATIO = 0.5;

/**
 * Deterministic rule for a source range that straddles cut boundaries: keep
 * the largest surviving overlap when it covers at least half of the original
 * range, otherwise the word is considered cut.  Words are clipped, never split.
 */
export const clipSourceRangeThroughTimeMap = (
  timeMap: TimeMap,
  assetId: string,
  startMs: number,
  endMs: number,
): {sourceStartMs: number; sourceEndMs: number; masterStartFrame: number; masterEndFrame: number} | null => {
  const overlaps = mapSourceRangeToMaster(timeMap, assetId, startMs, endMs);
  if (overlaps.length === 0) return null;
  const largest = overlaps.reduce((best, current) =>
    current.sourceEndMs - current.sourceStartMs > best.sourceEndMs - best.sourceStartMs ? current : best,
  );
  const survivingMs = largest.sourceEndMs - largest.sourceStartMs;
  if (survivingMs / Math.max(1, endMs - startMs) < MIN_WORD_SURVIVAL_RATIO) return null;
  return {
    sourceStartMs: largest.sourceStartMs,
    sourceEndMs: largest.sourceEndMs,
    masterStartFrame: largest.masterStartFrame,
    masterEndFrame: largest.masterEndFrame,
  };
};

/**
 * §4: derive the Master Transcript through the TimeMap.  Words removed by the
 * rough cut do not appear; surviving words keep their source identity and gain
 * master frames.
 */
export const deriveMasterTranscript = (
  sourceTranscripts: readonly SourceTranscript[],
  timeMap: TimeMap,
  project: Pick<ProjectDocument, 'id' | 'revision' | 'fps' | 'durationInFrames'>,
): MasterTranscript => {
  const words: MasterTranscriptWord[] = [];
  for (const transcript of sourceTranscripts) {
    for (const word of transcript.words) {
      const clipped = clipSourceRangeThroughTimeMap(timeMap, transcript.assetId, word.startMs, word.endMs);
      if (!clipped) continue;
      words.push(masterTranscriptWordSchema.parse({
        wordId: word.wordId,
        sourceWordId: word.wordId,
        assetId: transcript.assetId,
        segmentId: word.segmentId,
        text: word.word,
        sourceStartMs: clipped.sourceStartMs,
        sourceEndMs: clipped.sourceEndMs,
        masterStartFrame: clipped.masterStartFrame,
        masterEndFrame: clipped.masterEndFrame,
        confidence: word.confidence,
      }));
    }
  }
  words.sort((left, right) => left.masterStartFrame - right.masterStartFrame || left.wordId.localeCompare(right.wordId));
  return masterTranscriptSchema.parse({
    schemaVersion: 1,
    projectId: project.id,
    baseRevision: project.revision,
    timelineHash: timeMap.timelineHash,
    fps: timeMap.fps,
    durationInFrames: timeMap.durationInFrames,
    sourceTranscriptIds: sourceTranscripts.map((transcript) => transcript.transcriptId),
    sourceAssetIds: [...new Set(sourceTranscripts.map((transcript) => transcript.assetId))],
    words,
  });
};

// ── Confirmed-caption reconciliation (production fix #2) ─────────────────
//
// Master Transcript words keep Whisper word-level times, but the LANGUAGE
// text truth is the set of `project.captions` entries with `confirmed: true`
// (human-reviewed).  This section overlays those caption texts back onto the
// Master word slots: only `text` changes — wordId/sourceWordId/assetId/
// segmentId/source times/master frames/fps/timelineHash stay untouched, so
// existing SemanticBeat wordId references remain stable even when a slot is
// corrected to the empty string.
//
// Matching convention (frozen in this module):
// - `project.captions` times are timeline milliseconds — the same convention
//   `resolveCaptionWordRanges` in captions.ts documents — so a caption
//   [startMs, endMs) converts to master frames with the SAME expression the
//   TimeMap uses when deriving word master frames (`mapSourceRangeToMaster`):
//   `floor(ms / (1000 / fps))` for the start and `ceil(...)` for the end.
//   The algebraically equivalent `floor((ms / 1000) * fps)` is forbidden here
//   because floating point makes the two disagree by exactly one frame at
//   integer multiples (e.g. 3400 ms @ 30 fps → 101 vs 102), which silently
//   drops the caption's first covered word.
// - A Master word is COVERED only when its whole [masterStartFrame,
//   masterEndFrame) interval lies inside the caption's converted frame
//   interval.  Partial overlaps are never guessed; a confirmed caption with
//   no covered word lands in `unmatchedCaptionIds`.
// - Two confirmed captions whose [startMs, endMs) intervals overlap are
//   ambiguous: both land in `conflictingCaptionIds` and NEITHER is applied.
// - Covered words KEEP their existing `master.words` array order — they are
//   never re-sorted by start/end/id for the alignment, because the persisted
//   artifact concatenates words in exactly that array order.
// - Text is distributed back onto the covered slots through a deterministic
//   grapheme-level global (Needleman–Wunsch) minimum-edit alignment between
//   the whitespace-stripped concatenation of the covered word texts and the
//   whitespace-stripped caption text.  Every target grapheme is assigned to
//   exactly one covered slot via a direct `targetIndex -> ownerSlot` map:
//   matches/substitutions use their source grapheme's owner, insertions use
//   the owner of the next source grapheme (the right slot on a boundary) and
//   only fall back to the left slot when no right one exists; an empty target
//   empties every slot.  After correction, the covered words' texts
//   concatenate exactly to the caption text in final `master.words` array
//   order (modulo the shared whitespace normalization) — this is enforced by
//   an internal postcondition that throws instead of persisting a violating
//   artifact.  This supports 中英混排, word merging and rewrites
//   (`Work` + `body` → `WorkBuddy`, `语意库` → `语义库`, `P I P` → `PIP`)
//   without ever duplicating a target grapheme.

export const captionReconciliationSummarySchema = z.object({
  /** Confirmed captions actually overlaid onto the Master words (sorted by startMs/endMs/id). */
  appliedCaptionIds: z.array(z.string().min(1)),
  /** Confirmed captions whose interval covers no Master word (sorted by startMs/endMs/id). */
  unmatchedCaptionIds: z.array(z.string().min(1)),
  /** Confirmed captions overlapping another confirmed caption — not applied (sorted by startMs/endMs/id). */
  conflictingCaptionIds: z.array(z.string().min(1)),
  /** Master words whose text changed; identity and times are never counted. */
  correctedWordCount: z.number().int().nonnegative(),
});
export type CaptionReconciliationSummary = z.infer<typeof captionReconciliationSummarySchema>;

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const compareCaptions = (left: CaptionCue, right: CaptionCue): number =>
  left.startMs - right.startMs || left.endMs - right.endMs || compareStrings(left.id, right.id);

/**
 * The one shared whitespace rule for the reconciliation invariant: NFC
 * normalization with ALL whitespace removed.  Tests may re-apply this same
 * rule before comparing concatenated word text with caption text.
 */
export const normalizeReconciliationText = (value: string): string =>
  value.normalize('NFC').replace(/\s+/gu, '');

const graphemeSegmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'});

const graphemesOf = (value: string): string[] =>
  Array.from(graphemeSegmenter.segment(value), (entry) => entry.segment);

type AlignmentEntry = {sourceIndex: number | null; targetIndex: number | null};

/**
 * Deterministic global minimum-edit alignment over grapheme clusters.
 * Levenshtein costs (substitution/insertion/deletion all 1); the backtrace
 * prefers diagonal (match/substitution), then deletion, then insertion, so
 * the same input always yields the byte-identical same alignment.
 */
const minEditGraphemeAlignment = (source: readonly string[], target: readonly string[]): AlignmentEntry[] => {
  const rows = source.length;
  const columns = target.length;
  const costs: number[][] = Array.from({length: rows + 1}, () => new Array<number>(columns + 1).fill(0));
  for (let i = 1; i <= rows; i += 1) costs[i][0] = i;
  for (let j = 1; j <= columns; j += 1) costs[0][j] = j;
  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= columns; j += 1) {
      const substitute = costs[i - 1][j - 1] + (source[i - 1] === target[j - 1] ? 0 : 1);
      const remove = costs[i - 1][j] + 1;
      const insert = costs[i][j - 1] + 1;
      costs[i][j] = Math.min(substitute, remove, insert);
    }
  }
  const alignment: AlignmentEntry[] = [];
  let i = rows;
  let j = columns;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && costs[i][j] === costs[i - 1][j - 1] + (source[i - 1] === target[j - 1] ? 0 : 1)) {
      alignment.push({sourceIndex: i - 1, targetIndex: j - 1});
      i -= 1;
      j -= 1;
    } else if (i > 0 && costs[i][j] === costs[i - 1][j] + 1) {
      alignment.push({sourceIndex: i - 1, targetIndex: null});
      i -= 1;
    } else {
      alignment.push({sourceIndex: null, targetIndex: j - 1});
      j -= 1;
    }
  }
  alignment.reverse();
  return alignment;
};

/**
 * Distribute the caption text back onto the covered word slots.  Returns one
 * replacement text per covered word (in covered order = `master.words` array
 * order).  The concatenation of the returned texts is exactly the caption
 * text (modulo the shared whitespace normalization), and every target
 * grapheme is assigned to exactly one slot: matches/substitutions use their
 * aligned source grapheme's owner, insertions deterministically use the owner
 * of the NEXT source grapheme (the right slot when the insertion lands on a
 * word boundary) and only fall back to the previous/left owner when no right
 * slot exists.  An empty target empties every covered slot.  There is no
 * post-hoc "boundary run re-homing" pass anymore: the old append-then-pop
 * migration could remove the wrong chunk and duplicate target graphemes.
 */
const distributeCaptionTextOverWords = (
  covered: readonly MasterTranscriptWord[],
  captionText: string,
): string[] => {
  const wordGraphemes = covered.map((word) => graphemesOf(normalizeReconciliationText(word.text)));
  const targetGraphemes = graphemesOf(normalizeReconciliationText(captionText));
  if (targetGraphemes.length === 0) return covered.map(() => '');
  const sourceGraphemes = wordGraphemes.flat();
  const ownerOf: number[] = new Array<number>(sourceGraphemes.length).fill(0);
  let cursor = 0;
  for (let slot = 0; slot < wordGraphemes.length; slot += 1) {
    for (let index = cursor; index < cursor + wordGraphemes[slot].length; index += 1) ownerOf[index] = slot;
    cursor += wordGraphemes[slot].length;
  }
  const alignment = minEditGraphemeAlignment(sourceGraphemes, targetGraphemes);
  const chunks: string[][] = covered.map(() => []);
  // Lookahead for insertion ownership: `nextSourceEntry` points at the first
  // alignment entry at/after the current position that carries a source
  // grapheme, i.e. the deterministic "right" owner of an insertion run.
  let nextSourceEntry = 0;
  while (nextSourceEntry < alignment.length && alignment[nextSourceEntry].sourceIndex === null) nextSourceEntry += 1;
  let previousOwner: number | null = null;
  for (let position = 0; position < alignment.length; position += 1) {
    const entry = alignment[position];
    if (entry.sourceIndex !== null) {
      previousOwner = ownerOf[entry.sourceIndex];
      if (position >= nextSourceEntry) {
        nextSourceEntry = position + 1;
        while (nextSourceEntry < alignment.length && alignment[nextSourceEntry].sourceIndex === null) nextSourceEntry += 1;
      }
    }
    if (entry.targetIndex === null) continue; // source deletion → dropped
    const owner = entry.sourceIndex !== null
      ? ownerOf[entry.sourceIndex]
      : nextSourceEntry < alignment.length
        ? ownerOf[alignment[nextSourceEntry].sourceIndex as number]
        : previousOwner ?? 0;
    chunks[owner].push(targetGraphemes[entry.targetIndex]);
  }
  return chunks.map((chunk) => chunk.join(''));
};

/**
 * Internal postcondition of the reconciliation invariant: in final
 * `master.words` array order, the normalized concatenation of an applied
 * caption's covered word texts must equal the caption text exactly.  Any
 * violation throws — an artifact that claims `applied` without satisfying
 * the invariant must never be persisted.
 */
export const assertCaptionRangeInvariant = (
  caption: CaptionCue,
  covered: readonly MasterTranscriptWord[],
  texts: readonly string[],
): void => {
  const joined = normalizeReconciliationText(texts.join(''));
  const expected = normalizeReconciliationText(caption.text);
  if (joined !== expected) {
    const coveredWordIds = covered.map((word) => word.wordId).join(', ');
    throw new Error(`字幕校正不变量失败：confirmed caption ${caption.id} 覆盖词 [${coveredWordIds}] 校正后拼接「${joined}」不等于人工字幕「${expected}」，拒绝持久化该 artifact`);
  }
};

/**
 * Overlay the confirmed captions onto the Master Transcript.  Pure and
 * deterministic: inputs are never mutated, only `MasterTranscriptWord.text`
 * changes, word identity/times are preserved, and the same input always
 * yields byte-identical words and summary.  Unconfirmed captions produce no
 * override at all.
 */
export const reconcileConfirmedCaptionsIntoMasterTranscript = (
  master: MasterTranscript,
  captions: readonly CaptionCue[],
): {masterTranscript: MasterTranscript; summary: CaptionReconciliationSummary} => {
  const confirmed = captions.filter((caption) => caption.confirmed);
  const sorted = [...confirmed].sort(compareCaptions);

  // Direct [startMs, endMs) overlaps make the pair ambiguous.
  const conflictingIds = new Set<string>();
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const left = sorted[i];
      const right = sorted[j];
      if (left.startMs < right.endMs && right.startMs < left.endMs) {
        conflictingIds.add(left.id);
        conflictingIds.add(right.id);
      }
    }
  }

  const fps = master.fps;
  const corrections = new Map<string, string>();
  const appliedCaptionIds: string[] = [];
  const unmatchedCaptionIds: string[] = [];
  let correctedWordCount = 0;

  for (const caption of sorted) {
    if (conflictingIds.has(caption.id)) continue;
    // Caption interval → master frames with the SAME expression the TimeMap
    // used for the words' own master frames, so the caption's first word is
    // never dropped by a one-frame floating-point disagreement.
    const msPerFrame = 1000 / fps;
    const startFrame = Math.floor(caption.startMs / msPerFrame);
    const endFrame = Math.ceil(caption.endMs / msPerFrame);
    // Covered words KEEP their existing `master.words` array order — the
    // persisted artifact concatenates exactly in that order, so the
    // distribution must not re-sort by start/end/id.
    const covered = master.words.filter(
      (word) => word.masterStartFrame >= startFrame && word.masterEndFrame <= endFrame,
    );
    if (covered.length === 0) {
      unmatchedCaptionIds.push(caption.id);
      continue;
    }
    const texts = distributeCaptionTextOverWords(covered, caption.text);
    // Internal postcondition: the corrected covered words must concatenate
    // exactly to the caption text in final `master.words` array order.
    // Violations throw instead of persisting a fake-`applied` artifact.
    assertCaptionRangeInvariant(caption, covered, texts);
    appliedCaptionIds.push(caption.id);
    covered.forEach((word, index) => {
      const nextText = texts[index];
      if (nextText !== word.text) {
        corrections.set(word.wordId, nextText);
        correctedWordCount += 1;
      }
    });
  }

  const words = master.words.map((word) => {
    const corrected = corrections.get(word.wordId);
    return corrected === undefined ? word : {...word, text: corrected};
  });
  const masterTranscript = masterTranscriptSchema.parse({...master, words});
  const conflictingCaptions = sorted.filter((caption) => conflictingIds.has(caption.id));
  const summary = captionReconciliationSummarySchema.parse({
    appliedCaptionIds,
    unmatchedCaptionIds,
    conflictingCaptionIds: conflictingCaptions.map((caption) => caption.id),
    correctedWordCount,
  });
  return {masterTranscript, summary};
};

const MIN_CAPTION_SURVIVAL_RATIO = 0.5;

const captionRangeToMasterMs = (range: {masterStartFrame: number; masterEndFrame: number}, fps: number) => ({
  startMs: Math.round(range.masterStartFrame / fps * 1_000),
  endMs: Math.round(range.masterEndFrame / fps * 1_000),
});

const sameLegacyCaption = (
  existing: CaptionCue,
  sourceCaption: SourceTranscript['captions'][number],
  master: {startMs: number; endMs: number},
) => !existing.source
  && Math.abs(existing.startMs - master.startMs) <= 1
  && Math.abs(existing.endMs - master.endMs) <= 1
  && (existing.id === sourceCaption.id || normalizeReconciliationText(existing.text) === normalizeReconciliationText(sourceCaption.text));

/**
 * The only source→master caption projection used by the server pipeline.
 * Source ranges always come from an asset transcript; display times always
 * come from the TimeMap. Existing confirmed text corrections retain their
 * stable derived identity, while manual captions (no `source`) are preserved.
 */
export const deriveMasterCaptions = (
  sourceTranscripts: readonly SourceTranscript[],
  timeMap: TimeMap,
  existingCaptions: readonly CaptionCue[] = [],
  suppressions: readonly string[] = [],
): CaptionCue[] => {
  const suppressed = new Set(suppressions);
  const consumed = new Set<number>();
  const legacySourceBacked = new Set<number>();
  const derived: CaptionCue[] = [];
  const usedIds = new Set<string>();

  existingCaptions.forEach((existing, index) => {
    if (existing.source) return;
    const belongsToSource = sourceTranscripts.some((transcript) => transcript.captions.some((sourceCaption) =>
      existing.id === sourceCaption.id
      || (Math.abs(existing.startMs - sourceCaption.startMs) <= 1
        && Math.abs(existing.endMs - sourceCaption.endMs) <= 1
        && normalizeReconciliationText(existing.text) === normalizeReconciliationText(sourceCaption.text)),
    ));
    if (belongsToSource) legacySourceBacked.add(index);
  });

  for (const transcript of sourceTranscripts) {
    for (const sourceCaption of transcript.captions) {
      const ranges = mapSourceRangeToMaster(
        timeMap,
        transcript.assetId,
        Math.floor(sourceCaption.startMs),
        Math.ceil(sourceCaption.endMs),
      );
      for (const range of ranges) {
        const survivingMs = range.sourceEndMs - range.sourceStartMs;
        if (survivingMs / Math.max(1, sourceCaption.endMs - sourceCaption.startMs) < MIN_CAPTION_SURVIVAL_RATIO) continue;
        const source: CaptionSource = {
          kind: 'transcript',
          assetId: transcript.assetId,
          assetFingerprint: transcript.assetFingerprint,
          transcriptId: transcript.transcriptId,
          sourceCaptionId: sourceCaption.id,
          sourceStartMs: range.sourceStartMs,
          sourceEndMs: range.sourceEndMs,
          clipId: range.clipId,
        };
        const sourceKey = captionSourceKey(source);
        if (suppressed.has(sourceKey)) continue;
        const master = captionRangeToMasterMs(range, timeMap.fps);
        if (master.endMs <= master.startMs) continue;
        let existingIndex = existingCaptions.findIndex((caption, index) =>
          !consumed.has(index) && caption.source !== undefined && captionSourceKey(caption.source) === sourceKey,
        );
        if (existingIndex < 0) {
          existingIndex = existingCaptions.findIndex((caption, index) =>
            !consumed.has(index) && sameLegacyCaption(caption, sourceCaption, master),
          );
        }
        const existing = existingIndex >= 0 ? existingCaptions[existingIndex] : null;
        if (existingIndex >= 0) consumed.add(existingIndex);
        const preferredId = existing?.id ?? `caption-${stableWordHash(sourceKey)}`;
        const id = usedIds.has(preferredId) ? `${preferredId}-${stableWordHash(`${sourceKey}|${master.startMs}`)}` : preferredId;
        usedIds.add(id);
        derived.push({
          id,
          text: existing?.confirmed ? existing.text : sourceCaption.text,
          startMs: master.startMs,
          endMs: master.endMs,
          timestampMs: existing?.timestampMs ?? null,
          confidence: sourceCaption.confidence,
          confirmed: existing?.confirmed ?? false,
          source,
        });
      }
    }
  }

  existingCaptions.forEach((caption, index) => {
    if (consumed.has(index) || caption.source || legacySourceBacked.has(index)) return;
    let id = caption.id;
    if (usedIds.has(id)) id = `${id}-manual-${stableWordHash(`${caption.id}|${caption.startMs}|${caption.endMs}`)}`;
    usedIds.add(id);
    derived.push({...caption, id});
  });
  return derived.sort(compareCaptions);
};

/**
 * §4: after a rough cut the project captions must align to the Master
 * Timeline instead of raw source time.  Captions fully removed by the cut are
 * deleted; partially surviving captions are deterministically clipped.
 * Returns ordinary ProjectOperations for the existing revision/undo system.
 */
export const remapCaptionsToMasterOperations = (
  project: ProjectDocument,
  timeMap: TimeMap,
  assetId?: string,
): ProjectOperation[] => {
  const inferredAssetId = assetId
    ?? project.tracks.filter((track) => track.kind === 'a-roll').flatMap((track) => track.clips).find((clip) => clip.kind === 'video' && clip.assetId)?.assetId
    ?? null;
  if (!inferredAssetId) return [];
  const operations: ProjectOperation[] = [];
  const sorted = [...project.captions].sort((left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id));
  for (const caption of sorted) {
    const overlaps = mapSourceRangeToMaster(timeMap, inferredAssetId, Math.floor(caption.startMs), Math.ceil(caption.endMs));
    if (overlaps.length === 0) {
      operations.push({type: 'deleteCaption', captionId: caption.id});
      continue;
    }
    const largest = overlaps.reduce((best, current) =>
      current.sourceEndMs - current.sourceStartMs > best.sourceEndMs - best.sourceStartMs ? current : best,
    );
    const survivingMs = largest.sourceEndMs - largest.sourceStartMs;
    if (survivingMs / Math.max(1, caption.endMs - caption.startMs) < MIN_CAPTION_SURVIVAL_RATIO) {
      operations.push({type: 'deleteCaption', captionId: caption.id});
      continue;
    }
    const startMs = Math.round(largest.masterStartFrame / timeMap.fps * 1000);
    const endMs = Math.round(largest.masterEndFrame / timeMap.fps * 1000);
    if (endMs <= startMs) {
      operations.push({type: 'deleteCaption', captionId: caption.id});
      continue;
    }
    operations.push({type: 'updateCaption', captionId: caption.id, patch: {startMs, endMs}});
  }
  return operations;
};
