import {runtimeCommand} from "./runtime-paths";
import {randomUUID, createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {copyFile, mkdir, readFile, realpath, rename, stat, unlink, writeFile} from 'node:fs/promises';
import {execFile as nodeExecFile} from 'node:child_process';
import path from 'node:path';
import {clipTransformSchema, cutTimelineSchema, resolveCutTimeline, type CutTimeline, type TimelineClip} from './cut-timeline';
import {buildCutRenderPlan} from './cut-render-plan';
import {buildCutInputIdentity, createContentDigester, verifyCutPreviewIdentity} from './cut-media-identity';

const DEFAULT_FFMPEG_PATH = runtimeCommand("ffmpeg");
const DEFAULT_FFPROBE_PATH = runtimeCommand("ffprobe");
const STATE_FILE_NAME = 'roughcut.json';
const MEDIA_URL_PREFIX = '/cut-media/';
const SCHEMA_VERSION = 1;
const MAX_STATE_ERROR_LENGTH = 4000;
const MAX_TRANSCRIPT_WORDS = 50_000;
const CUT_ENCODER_ARGS = ['-c:v','libx264','-pix_fmt','yuv420p','-r','30',
  '-c:a','aac','-b:a','128k','-movflags','+faststart'] as const;
const CUT_RENDER_SOURCE_ARGS=['-c:v','libx264','-crf','0','-preset','ultrafast','-g','1','-bf','0','-pix_fmt','yuv420p','-r','30',
  '-c:a','pcm_s16le','-ar','48000'] as const;

async function mediaStamp(file: string): Promise<string> {
  const s = await stat(file, {bigint: true});
  return [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
}

export interface TranscriptWord {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface TimeRange {
  startMs: number;
  endMs: number;
}

export interface RoughcutAsset {
  durationFrames?: number;
  name: string;
  durationMs: number;
  url: string;
}

export interface RoughcutPreview {
  url: string;
  revision: number;
  provenance?: {version: 1; inputHash: string; contentHash: string; encodingHash: string;
    renderSource?:{url:string;contentHash:string}};
}

export interface RoughcutState {
  timeline?: CutTimeline;
  revision: number;
  asset: RoughcutAsset | null;
  words: TranscriptWord[];
  ranges: TimeRange[];
  preview: RoughcutPreview | null;
  busy: boolean;
  error?: string;
}

export type State = RoughcutState;
export type Word = TranscriptWord;
export type Range = TimeRange;

export interface ProjectedWord {
  legacySourceId?: string;
  sourceId: string;
  text: string;
  startMs: number;
  endMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
}

export interface MediaProbeResult {
  videoFrames?: number;
  durationMs: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface RoughcutServiceOptions {
  /** Only enable after the host has acquired its exclusive listening port. */
  recoverInterrupted?: boolean;
  ffmpegPath?: string;
  ffprobePath?: string;
  /** Replace ffprobe in tests or in a host with its own media probe. */
  probeMedia?: (filePath: string) => Promise<MediaProbeResult>;
  /** Replace ffmpeg in tests. The final argument is always the output path. */
  runFfmpeg?: (args: readonly string[]) => Promise<void>;
}

export interface RoughcutService {
  get(): Promise<RoughcutState>;
  verifyPreview(expectedRevision: number): Promise<void>;
  importFile(filePath: string, displayName?: string, appendAtRevision?: number): Promise<RoughcutState>;
  setClips(expectedRevision: number, clips: readonly TimelineClip[]): Promise<RoughcutState>;
  setAssetTranscript(expectedRevision: number, assetId: string, words: readonly TranscriptWord[]): Promise<RoughcutState>;
  setTranscript(expectedRevision: number, words: readonly TranscriptWord[]): Promise<RoughcutState>;
  cut(expectedRevision: number, ranges: readonly TimeRange[]): Promise<RoughcutState>;
  undo(expectedRevision: number): Promise<RoughcutState>;
  render(): Promise<{url: string; revision: number}>;
}

export type RoughcutErrorCode =
  | 'BUSY'
  | 'FFMPEG_FAILED'
  | 'INVALID_RANGES'
  | 'INVALID_STATE'
  | 'INVALID_TRANSCRIPT'
  | 'MEDIA_PROBE_FAILED'
  | 'NO_ASSET'
  | 'NO_UNDO'
  | 'STALE_REVISION';

export class RoughcutServiceError extends Error {
  public readonly code: RoughcutErrorCode;

  public constructor(code: RoughcutErrorCode, message: string) {
    super(message);
    this.name = 'RoughcutServiceError';
    this.code = code;
  }
}

interface HistoryEntry {
  timeline?: CutTimeline;
  words: TranscriptWord[];
  ranges: TimeRange[];
}

interface StoredFiles {
  sourceFileName: string;
  proxyFileName: string;
}

interface StoredEnvelope {
  schemaVersion: typeof SCHEMA_VERSION;
  state: RoughcutState;
  files: StoredFiles | null;
  history: HistoryEntry[];
}

interface ExecError extends Error {
  stderr?: string;
}

const writeQueues = new Map<string, Promise<void>>();

function runSerialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const marker = current.then(() => undefined, () => undefined);
  writeQueues.set(key, marker);
  void marker.then(() => {
    if (writeQueues.get(key) === marker) writeQueues.delete(key);
  });
  return current;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return isFiniteSafeInteger(value) && value >= 0;
}

function isNonNegativeTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function invalidState(message: string): RoughcutServiceError {
  return new RoughcutServiceError('INVALID_STATE', message);
}

function ensureText(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw invalidState(`${label} must be a non-empty string`);
  }
  return value;
}

function parseWord(value: unknown, index: number, code: 'INVALID_STATE' | 'INVALID_TRANSCRIPT'): TranscriptWord {
  if (!isRecord(value)) {
    throw new RoughcutServiceError(code, `Transcript word ${index} must be an object`);
  }
  const id = value.id;
  const text = value.text;
  const startMs = value.startMs;
  const endMs = value.endMs;
  if (typeof id !== 'string' || id.length === 0 || id.length > 200) {
    throw new RoughcutServiceError(code, `Transcript word ${index} has an invalid id`);
  }
  if (typeof text !== 'string' || text.length === 0 || text.length > 20_000) {
    throw new RoughcutServiceError(code, `Transcript word ${index} has invalid text`);
  }
  if (!isNonNegativeTime(startMs) || !isNonNegativeTime(endMs) || endMs <= startMs) {
    throw new RoughcutServiceError(code, `Transcript word ${index} must have 0 <= startMs < endMs in milliseconds`);
  }
  return {id, text, startMs, endMs};
}

function parseWords(value: unknown, code: 'INVALID_STATE' | 'INVALID_TRANSCRIPT'): TranscriptWord[] {
  if (!Array.isArray(value) || value.length > MAX_TRANSCRIPT_WORDS) {
    throw new RoughcutServiceError(code, `Transcript words must be an array of at most ${MAX_TRANSCRIPT_WORDS} items`);
  }
  const ids = new Set<string>();
  return value.map((item, index) => {
    const word = parseWord(item, index, code);
    if (ids.has(word.id)) throw new RoughcutServiceError(code, `Transcript word id is duplicated: ${word.id}`);
    ids.add(word.id);
    return word;
  });
}

function parseRangeShape(value: unknown, index: number, code: 'INVALID_STATE' | 'INVALID_RANGES'): TimeRange {
  if (!isRecord(value) || !isNonNegativeTime(value.startMs) || !isNonNegativeTime(value.endMs)) {
    throw new RoughcutServiceError(code, `Range ${index} must have non-negative startMs and endMs in milliseconds`);
  }
  if (value.endMs <= value.startMs) {
    throw new RoughcutServiceError(code, `Range ${index} must be non-empty`);
  }
  return {startMs: value.startMs, endMs: value.endMs};
}

function parseRanges(value: unknown, code: 'INVALID_STATE' | 'INVALID_RANGES'): TimeRange[] {
  if (!Array.isArray(value)) throw new RoughcutServiceError(code, 'Ranges must be an array');
  let previousEndMs = 0;
  return value.map((item, index) => {
    const range = parseRangeShape(item, index, code);
    if (index > 0 && range.startMs < previousEndMs) {
      throw new RoughcutServiceError(code, 'Ranges must be ordered and non-overlapping');
    }
    previousEndMs = range.endMs;
    return range;
  });
}

function parseMediaUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith(MEDIA_URL_PREFIX)) {
    throw invalidState(`Asset URL must start with ${MEDIA_URL_PREFIX}`);
  }
  const fileName = value.slice(MEDIA_URL_PREFIX.length);
  if (fileName.length === 0 || path.basename(fileName) !== fileName || fileName.includes('%2f') || fileName.includes('%2F')) {
    throw invalidState('Asset URL must contain a single media filename');
  }
  return value;
}

function parseAsset(value: unknown): RoughcutAsset | null {
  if (value === null) return null;
  if (!isRecord(value)) throw invalidState('Asset must be null or an object');
  const name = ensureText(value.name, 'Asset name');
  const durationMs = value.durationMs;
  if (!isNonNegativeTime(durationMs) || durationMs <= 0) {
    throw invalidState('Asset durationMs must be a positive number');
  }
  const url = parseMediaUrl(value.url);
  if (value.durationFrames !== undefined && (!isNonNegativeSafeInteger(value.durationFrames) || value.durationFrames === 0))
    throw invalidState('Asset durationFrames must be positive');
  return {name, durationMs, url, ...(value.durationFrames === undefined ? {} : {durationFrames: value.durationFrames as number})};
}

function parsePreview(value: unknown): RoughcutPreview | null {
  if (value === null) return null;
  if (!isRecord(value)) throw invalidState('Preview must be null or an object');
  const url = parseMediaUrl(value.url);
  const revision = value.revision;
  if (!isNonNegativeSafeInteger(revision)) throw invalidState('Preview revision must be a non-negative integer');
  if (value.provenance !== undefined) {
    const p = value.provenance;
    if (!isRecord(p) || p.version !== 1 ||
      !['inputHash','contentHash','encodingHash'].every(k => typeof p[k] === 'string' && /^[a-f0-9]{64}$/.test(p[k] as string)))
      throw invalidState('Preview provenance is invalid');
    let renderSource:{url:string;contentHash:string}|undefined;
    if(p.renderSource!==undefined){
      if(!isRecord(p.renderSource)||typeof p.renderSource.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(p.renderSource.contentHash))
        throw invalidState('Render source provenance is invalid');
      const sourceUrl=p.renderSource.url;
      if(typeof sourceUrl!=='string'||!/^\/cut-media\/[a-zA-Z0-9._-]+\.mkv$/.test(sourceUrl))
        throw invalidState('Render source URL is invalid');
      renderSource={url:sourceUrl,contentHash:p.renderSource.contentHash};
    }
    return {url,revision,provenance:{version:1,inputHash:p.inputHash as string,
      contentHash:p.contentHash as string,encodingHash:p.encodingHash as string,...(renderSource?{renderSource}:{})}};
  }
  return {url, revision};
}

function parseState(value: unknown): RoughcutState {
  if (!isRecord(value)) throw invalidState('Persisted roughcut state must be an object');
  const revision = value.revision;
  if (!isNonNegativeSafeInteger(revision)) throw invalidState('State revision must be a non-negative integer');
  const asset = parseAsset(value.asset);
  const words = parseWords(value.words, 'INVALID_STATE');
  const ranges = parseRanges(value.ranges, 'INVALID_STATE');
  const preview = parsePreview(value.preview);
  if (typeof value.busy !== 'boolean') throw invalidState('State busy must be boolean');
  if (value.error !== undefined && (typeof value.error !== 'string' || value.error.length > MAX_STATE_ERROR_LENGTH)) {
    throw invalidState('State error must be a short string');
  }
  if (asset === null && ranges.length !== 0) throw invalidState('A state without an asset cannot have ranges');
  if (asset !== null) validateRoughcutRanges(ranges, asset.durationMs);
  return {
    revision,
    asset,
    words,
    ranges,
    preview,
    busy: value.busy,
    ...(value.timeline === undefined ? {} : {timeline: cutTimelineSchema.parse(value.timeline)}),
    ...(value.error === undefined ? {} : {error: value.error}),
  };
}

function parseFiles(value: unknown, state: RoughcutState): StoredFiles | null {
  if (value === null) {
    if (state.asset !== null) throw invalidState('A state with an asset must persist source and proxy filenames');
    return null;
  }
  if (!isRecord(value)) throw invalidState('Persisted media files must be null or an object');
  const sourceFileName = ensureFileName(value.sourceFileName, 'sourceFileName');
  const proxyFileName = ensureFileName(value.proxyFileName, 'proxyFileName');
  if (state.asset === null) throw invalidState('A state without an asset cannot persist media filenames');
  const urlFileName = state.asset.url.slice(MEDIA_URL_PREFIX.length);
  if (urlFileName !== proxyFileName) throw invalidState('Asset URL does not match persisted proxy filename');
  return {sourceFileName, proxyFileName};
}

function parseHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) throw invalidState('Persisted roughcut history must be an array');
  return value.map((item, index) => {
    if (!isRecord(item)) throw invalidState(`History entry ${index} must be an object`);
    return {
      words: parseWords(item.words, 'INVALID_STATE'),
      ranges: parseRanges(item.ranges, 'INVALID_STATE'),
      ...(item.timeline === undefined ? {} : {timeline: cutTimelineSchema.parse(item.timeline)}),
    };
  });
}

function parseEnvelope(value: unknown, source: string): StoredEnvelope {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) {
    throw invalidState(`Invalid roughcut state at ${source}`);
  }
  try {
    const state = parseState(value.state);
    const files = parseFiles(value.files, state);
    const history = parseHistory(value.history);
    return {schemaVersion: SCHEMA_VERSION, state, files, history};
  } catch (error) {
    if (error instanceof RoughcutServiceError) {
      throw new RoughcutServiceError('INVALID_STATE', `Invalid roughcut state at ${source}: ${error.message}`);
    }
    throw error;
  }
}

function ensureFileName(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || path.basename(value) !== value || value === '.' || value === '..') {
    throw invalidState(`${label} must be a single filename`);
  }
  return value;
}

function validateStateForWrite(envelope: StoredEnvelope): void {
  parseEnvelope(envelope, '<memory>');
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let renamed = false;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
    renamed = true;
  } finally {
    if (!renamed) await unlink(temporaryPath).catch(() => undefined);
  }
}

function mediaUrl(fileName: string): string {
  return `${MEDIA_URL_PREFIX}${fileName}`;
}

function nextRevision(revision: number): number {
  if (revision >= Number.MAX_SAFE_INTEGER) throw invalidState('State revision cannot increase safely');
  return revision + 1;
}

function clearError(state: RoughcutState): RoughcutState {
  const next = {...state};
  delete next.error;
  return next;
}

function formatError(error: unknown): string {
  if (error instanceof RoughcutServiceError) return error.message;
  if (isRecord(error) && typeof error.stderr === 'string' && error.stderr.trim().length > 0) return error.stderr.trim();
  if (error instanceof Error && error.message.length > 0) return error.message;
  return String(error);
}

function ffmpegError(stage: string, error: unknown): RoughcutServiceError {
  const detail = formatError(error).slice(0, MAX_STATE_ERROR_LENGTH - stage.length - 3);
  return new RoughcutServiceError('FFMPEG_FAILED', `${stage}失败：${detail}`);
}

function probeError(error: unknown): RoughcutServiceError {
  const detail = formatError(error).slice(0, MAX_STATE_ERROR_LENGTH - 7);
  return new RoughcutServiceError('MEDIA_PROBE_FAILED', `媒体探测失败：${detail}`);
}

function formatSeconds(valueMs: number): string {
  return (valueMs / 1000).toFixed(9);
}

function buildConcatFilter(ranges: readonly TimeRange[]): string {
  const videoParts: string[] = [];
  const audioParts: string[] = [];
  for (const [index, range] of ranges.entries()) {
    const start = formatSeconds(range.startMs);
    const end = formatSeconds(range.endMs);
    videoParts.push(`[0:v:0]trim=start_frame=${Math.round(range.startMs*30/1000)}:end_frame=${Math.round(range.endMs*30/1000)},setpts=PTS-STARTPTS[v${index}]`);
    audioParts.push(`[0:a:0]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${index}]`);
  }
  const concatInputs = ranges.map((_, index) => `[v${index}][a${index}]`).join('');
  return `${videoParts.join(';')};${audioParts.join(';')};${concatInputs}concat=n=${ranges.length}:v=1:a=1[vout][aout]`;
}

function validateProbeResult(value: MediaProbeResult): MediaProbeResult {
  if (!isNonNegativeTime(value.durationMs) || value.durationMs <= 0) {
    throw new RoughcutServiceError('MEDIA_PROBE_FAILED', '媒体时长必须是正数毫秒');
  }
  if (value.hasVideo !== true) {
    throw new RoughcutServiceError('MEDIA_PROBE_FAILED', '素材必须包含视频流');
  }
  return value;
}

function parseFfprobeOutput(output: string): MediaProbeResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(output) as unknown;
  } catch (error) {
    throw new RoughcutServiceError('MEDIA_PROBE_FAILED', `ffprobe 输出不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(decoded)) throw new RoughcutServiceError('MEDIA_PROBE_FAILED', 'ffprobe 输出缺少媒体信息');
  const streams = Array.isArray(decoded.streams) ? decoded.streams : [];
  const hasVideo = streams.some((item) => isRecord(item) && item.codec_type === 'video');
  const hasAudio = streams.some((item) => isRecord(item) && item.codec_type === 'audio');
  const format = isRecord(decoded.format) ? decoded.format : {};
  const durationSeconds = typeof format.duration === 'string' ? Number(format.duration) : format.duration;
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RoughcutServiceError('MEDIA_PROBE_FAILED', 'ffprobe 未返回有效媒体时长');
  }
  const durationMs = Math.round(durationSeconds * 1000);
  const video = streams.find((item) => isRecord(item) && item.codec_type === 'video');
  const frames = isRecord(video) ? Number(video.nb_frames) : NaN;
  return validateProbeResult({durationMs, hasVideo, hasAudio,
    ...(Number.isSafeInteger(frames) && frames > 0 ? {videoFrames: frames} : {})});
}

function runExternal(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    nodeExecFile(command, [...args], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024}, (error, _stdout, stderr) => {
      if (error) {
        const enriched = error as ExecError;
        enriched.stderr = typeof stderr === 'string' ? stderr : String(stderr);
        reject(enriched);
        return;
      }
      resolve();
    });
  });
}

async function defaultProbe(ffprobePath: string, filePath: string): Promise<MediaProbeResult> {
  let output = '';
  try {
    await new Promise<void>((resolve, reject) => {
      nodeExecFile(
        ffprobePath,
        ['-v', 'error', '-show_entries', 'stream=codec_type,nb_frames:format=duration', '-of', 'json', filePath],
        {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024},
        (error, stdout, stderr) => {
          output = typeof stdout === 'string' ? stdout : String(stdout);
          if (error) {
            const enriched = error as ExecError;
            enriched.stderr = typeof stderr === 'string' ? stderr : String(stderr);
            reject(enriched);
            return;
          }
          resolve();
        },
      );
    });
  } catch (error) {
    throw probeError(error);
  }
  try {
    return parseFfprobeOutput(output);
  } catch (error) {
    if (error instanceof RoughcutServiceError) throw error;
    throw probeError(error);
  }
}

function defaultInitialEnvelope(): StoredEnvelope {
  return {
    schemaVersion: SCHEMA_VERSION,
    state: {
      revision: 0,
      asset: null,
      words: [],
      ranges: [],
      preview: null,
      busy: false,
    },
    files: null,
    history: [],
  };
}

function historyEntry(state: RoughcutState): HistoryEntry {
  return {words: clone(state.words), ranges: clone(state.ranges),
    ...(state.timeline ? {timeline: clone(state.timeline)} : {})};
}

function timelineFor(envelope: StoredEnvelope, actualFrames?: number): CutTimeline {
  if (envelope.state.timeline) return clone(envelope.state.timeline);
  const {state, files} = envelope;
  if (!state.asset || !files) return {schemaVersion: 1, assets: [], clips: []};
  const assetId = files.proxyFileName;
  return cutTimelineSchema.parse({schemaVersion: 1, assets: [{id: assetId,
    name: state.asset.name, durationFrames: actualFrames ?? state.asset.durationFrames ?? Math.floor(state.asset.durationMs * 30 / 1000),
    ...files, words: state.words}], clips: state.ranges.map((r, i) => ({
      id: `legacy-${i}`, assetId, inFrame: Math.round(r.startMs * 30 / 1000),
      outFrame: Math.round(r.endMs * 30 / 1000), legacyWordIds: true,
    }))});
}

export function projectCutWords(state: RoughcutState): ProjectedWord[] {
  if (!state.timeline) return projectWords(state.words, state.ranges);
  return resolveCutTimeline(state.timeline).words.map(w => ({
    sourceId: w.id, legacySourceId: w.legacySourceId, text: w.text,
    startMs: w.startMs, endMs: w.endMs,
    sourceStartMs: w.sourceStartMs, sourceEndMs: w.sourceEndMs,
  }));
}

/** Exact occurrence IDs win. An old alias resolves only when unambiguous. */
export function findCutWord(words: readonly ProjectedWord[], id: string): ProjectedWord | undefined {
  const exact = words.find(w => w.sourceId === id);
  if (exact) return exact;
  const aliases = words.filter(w => w.legacySourceId === id);
  return aliases.length === 1 ? aliases[0] : undefined;
}

function validateWordsForAsset(words: readonly TranscriptWord[], asset: RoughcutAsset | null): TranscriptWord[] {
  const parsed = parseWords(words, 'INVALID_TRANSCRIPT');
  if (asset !== null) {
    const outOfBounds = parsed.find((word) => word.endMs > asset.durationMs);
    if (outOfBounds) {
      throw new RoughcutServiceError(
        'INVALID_TRANSCRIPT',
        `Transcript word ${outOfBounds.id} ends at ${outOfBounds.endMs}ms beyond asset duration ${asset.durationMs}ms`,
      );
    }
  }
  return parsed;
}

/** Validate and clone an EDL against the imported asset duration. */
export function validateRoughcutRanges(ranges: readonly TimeRange[], durationMs: number): TimeRange[] {
  if (!isNonNegativeTime(durationMs) || durationMs <= 0) {
    throw new RoughcutServiceError('INVALID_RANGES', 'Asset duration must be a positive number');
  }
  if (!Array.isArray(ranges) || ranges.length === 0) {
    throw new RoughcutServiceError('INVALID_RANGES', 'At least one non-empty range is required');
  }
  const parsed = parseRanges(ranges, 'INVALID_RANGES');
  const outOfBounds = parsed.find((range) => range.endMs > durationMs);
  if (outOfBounds) {
    throw new RoughcutServiceError('INVALID_RANGES', `Range ${outOfBounds.startMs}-${outOfBounds.endMs}ms is outside the asset boundary ${durationMs}ms`);
  }
  return parsed;
}

/**
 * Map source transcript words onto the compacted timeline represented by an EDL.
 * A word crossing a removed gap is represented by one projected piece per kept range.
 */
/** Persist the actual 30fps edit boundaries used by both audio and picture. */
export function snapRangesToFrames(ranges: readonly TimeRange[]): TimeRange[] {
  const snapped=parseRanges(ranges,'INVALID_RANGES').map(r=>({startMs:Math.max(0,Math.ceil(r.startMs*30/1000-1e-7))*1000/30,endMs:Math.floor(r.endMs*30/1000+1e-7)*1000/30})).filter(r=>r.endMs>r.startMs);
  if(!snapped.length)throw new RoughcutServiceError('INVALID_RANGES','保留内容至少需要一帧');
  return snapped;
}

export function projectWords(words: readonly TranscriptWord[], ranges: readonly TimeRange[]): ProjectedWord[] {
  const parsedWords = parseWords(words, 'INVALID_TRANSCRIPT');
  const parsedRanges = parseRanges(ranges, 'INVALID_RANGES');
  if (parsedRanges.length === 0) return [];

  const projected: ProjectedWord[] = [];
  let timelineOffsetMs = 0;
  for (const range of parsedRanges) {
    for (const word of parsedWords) {
      const sourceStartMs = Math.max(word.startMs, range.startMs);
      const sourceEndMs = Math.min(word.endMs, range.endMs);
      if (sourceEndMs <= sourceStartMs) continue;
      projected.push({
        sourceId: word.id,
        text: word.text,
        startMs: timelineOffsetMs + sourceStartMs - range.startMs,
        endMs: timelineOffsetMs + sourceEndMs - range.startMs,
        sourceStartMs,
        sourceEndMs,
      });
    }
    timelineOffsetMs += range.endMs - range.startMs;
  }
  return projected.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.sourceId.localeCompare(right.sourceId));
}

class RoughcutServiceImpl implements RoughcutService {
  private readonly contentDigest = createContentDigester();
  private readonly directory: string;
  private readonly statePath: string;
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;
  private readonly probeMedia: (filePath: string) => Promise<MediaProbeResult>;
  private readonly runFfmpeg: (args: readonly string[]) => Promise<void>;
  private initialized = false;

  public constructor(directory: string, options: RoughcutServiceOptions = {}) {
    this.directory = path.resolve(directory);
    this.statePath = path.join(this.directory, STATE_FILE_NAME);
    this.ffmpegPath = options.ffmpegPath ?? DEFAULT_FFMPEG_PATH;
    this.ffprobePath = options.ffprobePath ?? DEFAULT_FFPROBE_PATH;
    this.probeMedia = options.probeMedia ?? ((filePath) => defaultProbe(this.ffprobePath, filePath));
    this.runFfmpeg = options.runFfmpeg ?? ((args) => runExternal(this.ffmpegPath, args));
  }

  public async initialize(recoverInterrupted=false): Promise<void> {
    await runSerialized(this.directory, async () => {
      const envelope=await this.loadEnvelopeLocked();
      if(recoverInterrupted&&envelope.state.busy)await this.persist({...envelope,state:{...envelope.state,busy:false,error:'上次媒体任务已中断，原工程保留，可重新生成预览。'}});
    });
  }

  public async get(): Promise<RoughcutState> {
    const envelope = await this.loadEnvelopeForRead();
    return clone(envelope.state);
  }

  public async verifyPreview(expectedRevision: number): Promise<void> {
    const state = await this.get();
    this.assertExpectedRevision(state,expectedRevision);
    try {
      await verifyCutPreviewIdentity(state,this.directory,this.contentDigest);
    } catch (error) {
      throw new RoughcutServiceError('INVALID_STATE',formatError(error));
    }
    const latest = await this.get();
    this.assertExpectedRevision(latest,expectedRevision);
    if (latest.preview?.url !== state.preview?.url)
      throw new RoughcutServiceError('STALE_REVISION','粗剪预览已更新，请刷新后重试');
  }

  private async registeredTimeline(envelope: StoredEnvelope): Promise<CutTimeline> {
    if (envelope.state.timeline || !envelope.state.asset || !envelope.files) return timelineFor(envelope);
    // Old imports recorded container duration, which can outlast the video by a frame.
    // Inspect the actual proxy on explicit migration; ordinary reads never rewrite it.
    const probe = await this.probeMedia(path.join(this.directory, envelope.files.proxyFileName));
    const frames = probe.videoFrames ?? Math.floor(probe.durationMs * 30 / 1000);
    if (!probe.hasVideo || !Number.isSafeInteger(frames) || frames < 1) {
      throw new RoughcutServiceError('MEDIA_PROBE_FAILED', '无法确认旧素材的实际视频帧数，请检查素材后重试');
    }
    return timelineFor(envelope, frames);
  }

  public async importFile(filePath: string, displayName?: string, appendAtRevision?: number): Promise<RoughcutState> {
    const sourcePath = path.resolve(filePath);
    await this.assertRegularFile(sourcePath);
    const name = displayName === undefined || displayName.length === 0 ? path.basename(sourcePath) : displayName;
    if (name.length > 200) throw new RoughcutServiceError('INVALID_STATE', 'Asset name is too long');

    await runSerialized(this.directory, async () => {
      const envelope = await this.loadEnvelopeLocked();
      this.assertNotBusy(envelope.state);
      if (appendAtRevision !== undefined) this.assertExpectedRevision(envelope.state, appendAtRevision);
      if (envelope.state.asset !== null) await this.persistImportBackup(envelope);
      const busyState: RoughcutState = clearError({...envelope.state, busy: true});
      await this.persist({...envelope, state: busyState});
    });

    let sourceFileName: string | undefined;
    let proxyFileName: string | undefined;
    try {
      const extension = path.extname(sourcePath).match(/^\.[A-Za-z0-9]{1,12}$/u)?.[0] ?? '.media';
      sourceFileName = `source-${randomUUID()}${extension}`;
      proxyFileName = `proxy-${randomUUID()}.mp4`;
      const copiedSourcePath = path.join(this.directory, sourceFileName);
      const proxyPath = path.join(this.directory, proxyFileName);
      await copyFile(sourcePath, copiedSourcePath, constants.COPYFILE_EXCL);
      let probe: MediaProbeResult;
      try {
        probe = validateProbeResult(await this.probeMedia(copiedSourcePath));
      } catch (error) {
        if (error instanceof RoughcutServiceError && error.code === 'MEDIA_PROBE_FAILED') throw error;
        throw probeError(error);
      }
      const temporaryProxyPath = path.join(this.directory, `.${proxyFileName}.${randomUUID()}.tmp.mp4`);
      try {
        await this.runFfmpeg([
          '-y',
          '-v',
          'error',
          '-i',
          copiedSourcePath,
          ...(probe.hasAudio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']),
          '-map',
          '0:v:0',
          '-map',
          probe.hasAudio ? '0:a:0' : '1:a:0',
          '-vf',
          'scale=1280:-2:flags=lanczos,fps=30',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          ...(!probe.hasAudio ? ['-shortest'] : []),
          '-movflags',
          '+faststart',
          temporaryProxyPath,
        ]);
        await this.assertNonEmptyFile(temporaryProxyPath, 'FFmpeg proxy output');
        await rename(temporaryProxyPath, proxyPath);
      } finally {
        await unlink(temporaryProxyPath).catch(() => undefined);
      }

      const proxyProbe = await this.probeMedia(proxyPath);
      const proxyFrames = proxyProbe.videoFrames ?? Math.floor(probe.durationMs * 30 / 1000);
      const finalState = await runSerialized(this.directory, async () => {
        const envelope = await this.loadEnvelopeLocked();
        if (!envelope.state.busy) throw new RoughcutServiceError('BUSY', 'Import task state changed before completion');
        const asset: RoughcutAsset = {name, durationMs: proxyFrames * 1000 / 30, url: mediaUrl(proxyFileName!),
          ...(proxyProbe.videoFrames ? {durationFrames: proxyFrames} : {})};
        const nextState: RoughcutState = {
          revision: nextRevision(envelope.state.revision),
          asset,
          words: [],
          ranges: snapRangesToFrames([{startMs: 0, endMs: asset.durationMs}]),
          preview: null,
          busy: false,
        };
        const nextEnvelope: StoredEnvelope = {
          schemaVersion: SCHEMA_VERSION,
          state: nextState,
          files: {sourceFileName: sourceFileName!, proxyFileName: proxyFileName!},
          history: [],
        };
        if (appendAtRevision !== undefined && envelope.state.asset) {
          const timeline = await this.registeredTimeline(envelope);
          const assetId = randomUUID();
          timeline.assets.push({id: assetId, name, durationFrames: proxyFrames,
            sourceFileName: sourceFileName!, proxyFileName: proxyFileName!, words: []});
          timeline.clips.push({id: randomUUID(), assetId, inFrame: 0,
            outFrame: proxyFrames, transform: clipTransformSchema.parse({})});
          const appended = clearError({...envelope.state, busy: false,
            revision: nextState.revision, timeline: cutTimelineSchema.parse(timeline)});
          await this.persist({...envelope, state: appended,
            history: [...envelope.history, historyEntry(envelope.state)]});
          return appended;
        }
        await this.persist(nextEnvelope);
        return nextState;
      });
      return clone(finalState);
    } catch (error) {
      await this.removeGeneratedFiles(sourceFileName, proxyFileName);
      const failure = error instanceof RoughcutServiceError
        ? error
        : error instanceof Error && error.message.toLowerCase().includes('ffprobe')
          ? probeError(error)
          : ffmpegError('媒体导入', error);
      await this.persistFailure(failure.message);
      throw failure;
    }
  }

  public async setClips(expectedRevision: number, clips: readonly TimelineClip[]): Promise<RoughcutState> {
    return runSerialized(this.directory, async () => {
      const envelope = await this.loadEnvelopeLocked();
      this.assertExpectedRevision(envelope.state, expectedRevision);
      this.assertNotBusy(envelope.state);
      const timeline = await this.registeredTimeline(envelope);
      // Migration aliases cannot be assigned to newly inserted duplicate clips.
      const legacyIds = new Set(timeline.clips.filter(c => c.legacyWordIds).map(c => c.id));
      const nextTimeline = cutTimelineSchema.parse({...timeline, clips: clips.map(c => ({...c,
        legacyWordIds: legacyIds.has(c.id) && timeline.clips.find(old => old.id === c.id)?.assetId === c.assetId,
      }))});
      const state = clearError({...envelope.state, timeline: nextTimeline, revision: nextRevision(envelope.state.revision)});
      await this.persist({...envelope, state, history: [...envelope.history, historyEntry(envelope.state)]});
      return clone(state);
    });
  }

  public async setAssetTranscript(expectedRevision: number, assetId: string, words: readonly TranscriptWord[]): Promise<RoughcutState> {
    return runSerialized(this.directory, async () => {
      const envelope = await this.loadEnvelopeLocked();
      this.assertExpectedRevision(envelope.state, expectedRevision);
      this.assertNotBusy(envelope.state);
      const timeline = await this.registeredTimeline(envelope);
      const asset = timeline.assets.find(a => a.id === assetId);
      if (!asset) throw invalidState('素材不存在');
      asset.words = parseWords(words, 'INVALID_TRANSCRIPT');
      const state = clearError({...envelope.state, timeline: cutTimelineSchema.parse(timeline), revision: nextRevision(envelope.state.revision)});
      await this.persist({...envelope, state, history: [...envelope.history, historyEntry(envelope.state)]});
      return clone(state);
    });
  }

  public async setTranscript(expectedRevision: number, words: readonly TranscriptWord[]): Promise<RoughcutState> {
    return runSerialized(this.directory, async () => {
      const envelope = await this.loadEnvelopeLocked();
      this.assertExpectedRevision(envelope.state, expectedRevision);
      this.assertNotBusy(envelope.state);
      if (envelope.state.timeline) throw invalidState('多素材工程请指定素材后更新转写');
      const parsedWords = validateWordsForAsset(words, envelope.state.asset);
      const nextState: RoughcutState = clearError({
        ...envelope.state,
        revision: nextRevision(envelope.state.revision),
        words: parsedWords,
      });
      const nextEnvelope: StoredEnvelope = {
        ...envelope,
        state: nextState,
        history: [...envelope.history, historyEntry(envelope.state)],
      };
      await this.persist(nextEnvelope);
      return clone(nextState);
    });
  }

  public async cut(expectedRevision: number, ranges: readonly TimeRange[]): Promise<RoughcutState> {
    return runSerialized(this.directory, async () => {
      const envelope = await this.loadEnvelopeLocked();
      this.assertExpectedRevision(envelope.state, expectedRevision);
      this.assertNotBusy(envelope.state);
      if (envelope.state.timeline) throw invalidState('多素材工程请编辑时间线片段');
      if (envelope.state.asset === null) throw new RoughcutServiceError('NO_ASSET', 'Import a video with audio before cutting');
      const parsedRanges = snapRangesToFrames(validateRoughcutRanges(ranges, envelope.state.asset.durationMs));
      const nextState: RoughcutState = clearError({
        ...envelope.state,
        revision: nextRevision(envelope.state.revision),
        ranges: parsedRanges,
      });
      const nextEnvelope: StoredEnvelope = {
        ...envelope,
        state: nextState,
        history: [...envelope.history, historyEntry(envelope.state)],
      };
      await this.persist(nextEnvelope);
      return clone(nextState);
    });
  }

  public async undo(expectedRevision: number): Promise<RoughcutState> {
    return runSerialized(this.directory, async () => {
      const envelope = await this.loadEnvelopeLocked();
      this.assertExpectedRevision(envelope.state, expectedRevision);
      this.assertNotBusy(envelope.state);
      if (envelope.history.length === 0) {
        throw new RoughcutServiceError('NO_UNDO', 'Import cannot be undone; no transcript or cut change is available to undo');
      }
      const target = envelope.history[envelope.history.length - 1];
      const nextState: RoughcutState = clearError({
        ...envelope.state,
        revision: nextRevision(envelope.state.revision),
        words: clone(target.words),
        ranges: clone(target.ranges),
        timeline: target.timeline ? clone(target.timeline) : undefined,
      });
      const nextEnvelope: StoredEnvelope = {
        ...envelope,
        state: nextState,
        history: envelope.history.slice(0, -1),
      };
      await this.persist(nextEnvelope);
      return clone(nextState);
    });
  }

  public async render(): Promise<{url: string; revision: number}> {
    const task = await runSerialized(this.directory, async () => {
      const envelope = await this.loadEnvelopeLocked();
      this.assertNotBusy(envelope.state);
      if (envelope.state.asset === null || envelope.files === null) {
        throw new RoughcutServiceError('NO_ASSET', 'Import a video with audio before rendering');
      }
      const ranges = envelope.state.timeline ? [] : validateRoughcutRanges(envelope.state.ranges, envelope.state.asset.durationMs);
      const timelinePlan = envelope.state.timeline ? buildCutRenderPlan(envelope.state.timeline) : null;
      if (timelinePlan) for (const file of timelinePlan.files)
        await this.assertNonEmptyFile(path.join(this.directory, file), '时间线素材文件');
      const inputIdentity = await buildCutInputIdentity(envelope.state, this.directory, this.contentDigest);
      const inputStamps = await Promise.all(inputIdentity.files.map(async f => ({
        fileName:f.fileName,stamp:await mediaStamp(path.join(this.directory,f.fileName)),
      })));
      const encoderPath = await realpath(this.ffmpegPath);
      const encoderStamp = await mediaStamp(encoderPath);
      const encodingHash = createHash('sha256').update(JSON.stringify({
        args:CUT_ENCODER_ARGS,sourceArgs:CUT_RENDER_SOURCE_ARGS,executable:await this.contentDigest(encoderPath),
      })).digest('hex');
      const outputFileName = `render-${randomUUID()}.mp4`;
      const temporaryOutputPath = path.join(this.directory, `.${outputFileName}.${randomUUID()}.tmp.mp4`);
      const renderSourceFileName=`frames-${randomUUID()}.mkv`;
      const temporarySourcePath=path.join(this.directory,`.${renderSourceFileName}.${randomUUID()}.tmp.mkv`);
      const nextState = clearError({...envelope.state, busy: true});
      await this.persist({...envelope, state: nextState});
      return {
        revision: envelope.state.revision,
        state:clone(envelope.state), inputIdentity,inputStamps,encoderPath,encoderStamp,encodingHash,
        ranges,
        timelinePlan,
        proxyPath: path.join(this.directory, envelope.files.proxyFileName),
        outputFileName,
        outputPath: path.join(this.directory, outputFileName),
        temporaryOutputPath,
        renderSourceFileName,temporarySourcePath,renderSourcePath:path.join(this.directory,renderSourceFileName),
      };
    });

    try {
      await this.runFfmpeg([
        '-y',
        '-v',
        'error',
        ...(task.timelinePlan ? task.timelinePlan.files.flatMap(file => ['-i', path.join(this.directory, file)]) : ['-i', task.proxyPath]),
        '-filter_complex',
        task.timelinePlan?.filter ?? buildConcatFilter(task.ranges),
        '-map',
        '[vout]',
        '-map',
        '[aout]',
        ...CUT_RENDER_SOURCE_ARGS,
        task.temporarySourcePath,
      ]);
      await this.assertNonEmptyFile(task.temporarySourcePath,'FFmpeg deterministic render source');
      await this.runFfmpeg(['-y','-v','error','-i',task.temporarySourcePath,
        '-map','0:v:0','-map','0:a:0',...CUT_ENCODER_ARGS,task.temporaryOutputPath]);
      await this.assertNonEmptyFile(task.temporaryOutputPath, 'FFmpeg render output');
      for (const input of task.inputStamps) {
        if (await mediaStamp(path.join(this.directory,input.fileName)) !== input.stamp)
          throw new RoughcutServiceError('INVALID_STATE','渲染期间源素材发生变化，原预览已保留，请检查后重试');
      }
      if (await realpath(this.ffmpegPath) !== task.encoderPath || await mediaStamp(task.encoderPath) !== task.encoderStamp)
        throw new RoughcutServiceError('INVALID_STATE','渲染期间编码器发生变化，请重新生成');
      const currentInput = await buildCutInputIdentity(task.state,this.directory,this.contentDigest);
      if (currentInput.inputHash !== task.inputIdentity.inputHash)
        throw new RoughcutServiceError('INVALID_STATE','渲染输入发生变化，请重新生成');
      const contentHash = await this.contentDigest(task.temporaryOutputPath);
      const renderSourceHash=await this.contentDigest(task.temporarySourcePath);
      await rename(task.temporarySourcePath,task.renderSourcePath);
      await rename(task.temporaryOutputPath, task.outputPath);
      const result = await runSerialized(this.directory, async () => {
        const envelope = await this.loadEnvelopeLocked();
        if (!envelope.state.busy) throw new RoughcutServiceError('BUSY', 'Render task state changed before completion');
        if (envelope.state.revision !== task.revision)
          throw new RoughcutServiceError('STALE_REVISION','渲染期间工程版本发生变化，未发布旧结果');
        const preview: RoughcutPreview = {url: mediaUrl(task.outputFileName), revision:task.revision,
          provenance:{version:1,inputHash:task.inputIdentity.inputHash,contentHash,encodingHash:task.encodingHash,
            renderSource:{url:mediaUrl(task.renderSourceFileName),contentHash:renderSourceHash}}};
        const nextState = clearError({...envelope.state, busy: false, preview});
        await this.persist({...envelope, state: nextState});
        return {url: preview.url, revision: preview.revision};
      });
      return result;
    } catch (error) {
      await unlink(task.temporaryOutputPath).catch(() => undefined);
      await unlink(task.outputPath).catch(() => undefined);
      await unlink(task.temporarySourcePath).catch(()=>undefined);
      await unlink(task.renderSourcePath).catch(()=>undefined);
      const failure = error instanceof RoughcutServiceError && error.code !== 'FFMPEG_FAILED'
        ? error
        : ffmpegError('剪辑渲染', error);
      await this.persistFailure(failure.message);
      throw failure;
    }
  }

  private async assertRegularFile(filePath: string): Promise<void> {
    let info;
    try {
      info = await stat(filePath);
    } catch (error) {
      throw new RoughcutServiceError('MEDIA_PROBE_FAILED', `无法读取素材：${formatError(error)}`);
    }
    if (!info.isFile()) throw new RoughcutServiceError('MEDIA_PROBE_FAILED', '素材路径必须是文件');
  }

  private async assertNonEmptyFile(filePath: string, label: string): Promise<void> {
    let info;
    try {
      info = await stat(filePath);
    } catch (error) {
      throw new RoughcutServiceError('FFMPEG_FAILED', `${label}不存在：${formatError(error)}`);
    }
    if (!info.isFile() || info.size <= 0) throw new RoughcutServiceError('FFMPEG_FAILED', `${label}为空`);
  }

  private assertExpectedRevision(state: RoughcutState, expectedRevision: number): void {
    if (!isNonNegativeSafeInteger(expectedRevision) || expectedRevision !== state.revision) {
      throw new RoughcutServiceError('STALE_REVISION', `Expected roughcut revision ${expectedRevision}, current revision is ${state.revision}`);
    }
  }

  private assertNotBusy(state: RoughcutState): void {
    if (state.busy) throw new RoughcutServiceError('BUSY', 'A media task is already running');
  }

  private async loadEnvelopeForRead(): Promise<StoredEnvelope> {
    await mkdir(this.directory, {recursive: true});
    let serialized: string;
    try {
      serialized = await readFile(this.statePath, 'utf8');
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT' && !this.initialized) {
        return runSerialized(this.directory, async () => this.loadEnvelopeLocked());
      }
      throw error;
    }
    try {
      return parseEnvelope(JSON.parse(serialized) as unknown, this.statePath);
    } catch (error) {
      if (error instanceof RoughcutServiceError) throw error;
      throw invalidState(`Roughcut state at ${this.statePath} is not valid JSON: ${formatError(error)}`);
    }
  }

  private async loadEnvelopeLocked(): Promise<StoredEnvelope> {
    await mkdir(this.directory, {recursive: true});
    let serialized: string;
    try {
      serialized = await readFile(this.statePath, 'utf8');
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') {
        if (this.initialized) throw invalidState(`Roughcut state is missing at ${this.statePath}`);
        const initial = defaultInitialEnvelope();
        await this.persist(initial);
        this.initialized = true;
        return initial;
      }
      throw error;
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(serialized) as unknown;
    } catch (error) {
      throw invalidState(`Roughcut state at ${this.statePath} is not valid JSON: ${formatError(error)}`);
    }
    const envelope = parseEnvelope(decoded, this.statePath);
    this.initialized = true;
    return envelope;
  }

  private async persist(envelope: StoredEnvelope): Promise<void> {
    validateStateForWrite(envelope);
    await mkdir(this.directory, {recursive: true});
    await writeJsonAtomic(this.statePath, envelope);
  }

  private async persistFailure(message: string): Promise<void> {
    await runSerialized(this.directory, async () => {
      const envelope = await this.loadEnvelopeLocked();
      const nextState: RoughcutState = {...envelope.state, busy: false, error: message.slice(0, MAX_STATE_ERROR_LENGTH)};
      await this.persist({...envelope, state: nextState});
    });
  }

  private async persistImportBackup(envelope: StoredEnvelope): Promise<void> {
    const historyDirectory = path.join(this.directory, 'history');
    await mkdir(historyDirectory, {recursive: true});
    const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
    const backupPath = path.join(historyDirectory, `${timestamp}-${randomUUID()}.json`);
    await writeJsonAtomic(backupPath, {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      state: envelope.state,
      files: envelope.files,
      history: envelope.history,
    });
  }

  private async removeGeneratedFiles(sourceFileName: string | undefined, proxyFileName: string | undefined): Promise<void> {
    const fileNames = [sourceFileName, proxyFileName].filter((value): value is string => value !== undefined);
    await Promise.all(fileNames.map((fileName) => unlink(path.join(this.directory, fileName)).catch(() => undefined)));
  }
}

export async function createRoughcutService(
  directory: string,
  options: RoughcutServiceOptions = {},
): Promise<RoughcutService> {
  if (typeof directory !== 'string' || directory.length === 0) throw invalidState('Roughcut directory is required');
  const service = new RoughcutServiceImpl(directory, options);
  await service.initialize(options.recoverInterrupted);
  return service;
}
