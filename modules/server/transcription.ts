import {execFile} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {
  transcriptionOptionsSchema,
  transcriptionRequestSchema,
  transcriptionResultSchema,
  type SilenceCandidate,
  type TranscriptionOptions,
  type TranscriptionRequest,
  type TranscriptionResult,
  type TranscriptionWord,
} from '../shared/transcription.js';

const execFileAsync = promisify(execFile);
const SILENCE_THRESHOLD_MS = 650;
// Keep a little headroom below the product's approximately 4.5 second limit.
const MAX_CAPTION_DURATION_MS = 4_000;
const MAX_VISIBLE_CAPTION_CHARS = 22;

type WhisperExecutionResult = {
  stdout?: string;
  stderr?: string;
};

/** Injectable process runner used by tests and by embedders that supervise CLI work. */
export type WhisperRunner = (
  command: string,
  args: string[],
) => WhisperExecutionResult | void | Promise<WhisperExecutionResult | void>;

export type TranscriptionServiceOptions = Partial<TranscriptionOptions> & {
  runner?: WhisperRunner;
};

const runWhisper: WhisperRunner = async (command, args) => {
  const result = await execFileAsync(command, args, {encoding: 'utf8'});
  return {
    stdout: typeof result.stdout === 'string' ? result.stdout : String(result.stdout ?? ''),
    stderr: typeof result.stderr === 'string' ? result.stderr : String(result.stderr ?? ''),
  };
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseJsonInput = (input: unknown): JsonRecord => {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'invalid JSON';
      throw new Error(`Malformed Whisper JSON: ${detail}`);
    }
  }
  if (!isRecord(value)) {
    throw new Error('Malformed Whisper JSON: expected an object');
  }
  return value;
};

const hasOwn = (record: JsonRecord, key: string) => Object.prototype.hasOwnProperty.call(record, key);

const finiteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Malformed Whisper JSON: ${label} must be a finite number`);
  }
  return value;
};

const milliseconds = (value: unknown, label: string): number => {
  const seconds = finiteNumber(value, label);
  if (seconds < 0) throw new Error(`Malformed Whisper JSON: ${label} cannot be negative`);
  return Math.round(seconds * 1000);
};

const millisecondsField = (record: JsonRecord, field: 'start' | 'end', label: string): number => {
  const msField = `${field}Ms`;
  if (hasOwn(record, msField)) {
    const value = finiteNumber(record[msField], `${label}.${msField}`);
    if (value < 0) throw new Error(`Malformed Whisper JSON: ${label}.${msField} cannot be negative`);
    return Math.round(value);
  }
  if (!hasOwn(record, field)) {
    throw new Error(`Malformed Whisper JSON: ${label}.${field} is required`);
  }
  return milliseconds(record[field], `${label}.${field}`);
};

const ensureInterval = (startMs: number, endMs: number, label: string) => {
  if (endMs < startMs) {
    throw new Error(`Malformed Whisper JSON: ${label}.end must not precede start`);
  }
};

const optionalConfidence = (record: JsonRecord, label: string): number | null => {
  const raw = hasOwn(record, 'confidence') ? record.confidence : record.probability;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 1) return null;
  return raw;
};

type ParsedWord = TranscriptionWord & {
  order: number;
  // Whisper generally includes a leading space on English words.  Preserve
  // that information internally so reconstructed caption text does not join
  // English words together, while keeping the public word shape unchanged.
  leadingSpace: boolean;
};
type ParsedSegment = {
  index: number;
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
  words: ParsedWord[];
};

const parseWord = (value: unknown, segmentIndex: number, wordIndex: number, order: number): ParsedWord => {
  const label = `segments[${segmentIndex}].words[${wordIndex}]`;
  if (!isRecord(value)) throw new Error(`Malformed Whisper JSON: ${label} must be an object`);
  const rawWord = hasOwn(value, 'word') ? value.word : value.text;
  if (typeof rawWord !== 'string') throw new Error(`Malformed Whisper JSON: ${label}.word must be a string`);
  const word = rawWord.trim();
  if (!word) throw new Error(`Malformed Whisper JSON: ${label}.word cannot be empty`);
  const startMs = millisecondsField(value, 'start', label);
  const endMs = millisecondsField(value, 'end', label);
  ensureInterval(startMs, endMs, label);
  return {
    word,
    startMs,
    endMs,
    confidence: optionalConfidence(value, label),
    order,
    leadingSpace: /^\s/u.test(rawWord),
  };
};

const segmentConfidence = (segment: JsonRecord, words: ParsedWord[]): number | null => {
  const direct = optionalConfidence(segment, 'segment');
  if (direct !== null) return direct;
  const noSpeech = segment.no_speech_prob;
  if (typeof noSpeech === 'number' && Number.isFinite(noSpeech) && noSpeech >= 0 && noSpeech <= 1) {
    return 1 - noSpeech;
  }
  const wordConfidences = words
    .map((word) => word.confidence)
    .filter((confidence): confidence is number => confidence !== null);
  if (wordConfidences.length === 0) return null;
  return wordConfidences.reduce((sum, confidence) => sum + confidence, 0) / wordConfidences.length;
};

const parseSegment = (value: unknown, index: number, wordOrder: {value: number}): ParsedSegment => {
  const label = `segments[${index}]`;
  if (!isRecord(value)) throw new Error(`Malformed Whisper JSON: ${label} must be an object`);
  const startMs = millisecondsField(value, 'start', label);
  const endMs = millisecondsField(value, 'end', label);
  ensureInterval(startMs, endMs, label);
  if (typeof value.text !== 'string') throw new Error(`Malformed Whisper JSON: ${label}.text must be a string`);
  const rawId = value.id;
  const id = rawId === undefined || rawId === null ? String(index) : String(rawId);
  const words: ParsedWord[] = [];
  if (hasOwn(value, 'words')) {
    if (!Array.isArray(value.words)) throw new Error(`Malformed Whisper JSON: ${label}.words must be an array`);
    value.words.forEach((word, wordIndex) => {
      words.push(parseWord(word, index, wordIndex, wordOrder.value));
      wordOrder.value += 1;
    });
  }
  words.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.order - right.order);
  const text = value.text.trim() || words.map((word) => word.word).join(' ').trim();
  return {
    index,
    id,
    text,
    startMs,
    endMs,
    confidence: segmentConfidence(value, words),
    words,
  };
};

type CaptionGroup = {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
};

const startsWithPunctuation = (value: string) => /^[,，、。.!！？?;；:：)）\]}]$/u.test(value);
const endsWithOpeningPunctuation = (value: string) => /[(（\[{]$/u.test(value);
const endsWithSentencePunctuation = (value: string) => /[。.!！？?；;]$/u.test(value);
const endsWithClausePunctuation = (value: string) => /[，,、：:]$/u.test(value);
const punctuationOnly = (value: string) => /^[\s\p{P}\p{S}]+$/u.test(value);

/** Count characters users can actually see; whitespace is not a useful line-length limit. */
const visibleCharacterCount = (value: string) => Array.from(value).filter((character) => !/\s/u.test(character)).length;

const joinWordTexts = (words: ParsedWord[]): string => words.reduce((text, word, index) => {
  if (index === 0) return word.word;
  const previous = words[index - 1].word;
  const noSpaceBefore = startsWithPunctuation(word.word) || endsWithOpeningPunctuation(previous);
  const bothAsciiWords = /[A-Za-z0-9]$/u.test(previous) && /^[A-Za-z0-9]/u.test(word.word);
  const adjacentCjkWords = /[\u3400-\u9fff]$/u.test(previous) && /^[\u3400-\u9fff]/u.test(word.word);
  // Chinese Whisper tokens should remain adjacent even when an implementation
  // happens to emit a leading space. English tokens retain Whisper's explicit
  // space and also get one when a fixture omits it.
  const shouldSeparate = !noSpaceBefore && !adjacentCjkWords
    && (word.leadingSpace || bothAsciiWords);
  return `${text}${shouldSeparate ? ' ' : ''}${word.word}`;
}, '');

const averageWordConfidence = (words: ParsedWord[], fallback: number | null): number | null => {
  const confidences = words
    .map((word) => word.confidence)
    .filter((confidence): confidence is number => confidence !== null);
  if (confidences.length === 0) return fallback;
  return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length;
};

const makeCaptionGroup = (words: ParsedWord[], fallbackConfidence: number | null): CaptionGroup => {
  const startMs = words[0].startMs;
  return {
    text: joinWordTexts(words),
    startMs,
    // Whisper occasionally assigns several seconds of following silence to a
    // single token. Keep the word intact, but do not leave its caption pinned
    // on screen for the whole anomalous token interval.
    endMs: Math.min(words[words.length - 1].endMs, startMs + MAX_CAPTION_DURATION_MS),
    confidence: averageWordConfidence(words, fallbackConfidence),
  };
};

const splitWordTimedSegment = (segment: ParsedSegment): CaptionGroup[] => {
  const groups: ParsedWord[][] = [];
  let current: ParsedWord[] = [];
  const flush = () => {
    if (current.length > 0) {
      groups.push(current);
      current = [];
    }
  };
  for (const word of segment.words) {
    const candidate = current.length > 0 ? [...current, word] : [word];
    const candidateText = joinWordTexts(candidate);
    const candidateDuration = word.endMs - candidate[0].startMs;
    const overDuration = current.length > 0 && candidateDuration > MAX_CAPTION_DURATION_MS;
    const overCharacters = current.length > 0
      && visibleCharacterCount(candidateText) > MAX_VISIBLE_CAPTION_CHARS
      // Keep a comma/period with the preceding word rather than orphaning
      // punctuation on a line of its own when the suggested length is crossed.
      && !punctuationOnly(word.word);
    if (overDuration || overCharacters) {
      flush();
      current.push(word);
    } else {
      current = candidate;
    }
    const text = joinWordTexts(current);
    if (endsWithSentencePunctuation(word.word) || endsWithClausePunctuation(word.word)) flush();
  }
  flush();
  return groups.map((words) => makeCaptionGroup(words, segment.confidence));
};

const splitTextFallback = (segment: ParsedSegment): CaptionGroup[] => {
  const text = segment.text;
  const durationMs = segment.endMs - segment.startMs;
  if (durationMs <= MAX_CAPTION_DURATION_MS && visibleCharacterCount(text) <= MAX_VISIBLE_CAPTION_CHARS) {
    return [{text, startMs: segment.startMs, endMs: segment.endMs, confidence: segment.confidence}];
  }
  const chunks: string[] = [];
  const units = Array.from(text);
  const totalUnits = units.length || 1;
  let current = '';
  let currentStartUnit = 0;
  for (const [unitIndex, character] of units.entries()) {
    const candidate = `${current}${character}`;
    const candidateDuration = durationMs * (unitIndex + 1 - currentStartUnit) / totalUnits;
    if (current && (
      visibleCharacterCount(candidate) > MAX_VISIBLE_CAPTION_CHARS
      || candidateDuration > MAX_CAPTION_DURATION_MS
    )) {
      chunks.push(current);
      current = character;
      currentStartUnit = unitIndex;
    } else {
      current = candidate;
    }
    if (current && (endsWithSentencePunctuation(character) || endsWithClausePunctuation(character))) {
      chunks.push(current);
      current = '';
      currentStartUnit = unitIndex + 1;
    }
  }
  if (current) chunks.push(current);
  if (chunks.length === 0) return [];
  let consumedUnits = 0;
  return chunks.map((chunk, index) => {
    const chunkUnits = Array.from(chunk).length;
    const startMs = index === 0
      ? segment.startMs
      : segment.startMs + Math.round(durationMs * consumedUnits / totalUnits);
    consumedUnits += chunkUnits;
    const endMs = index === chunks.length - 1
      ? segment.endMs
      : segment.startMs + Math.round(durationMs * consumedUnits / totalUnits);
    return {
      text: chunk,
      startMs,
      endMs: Math.min(Math.max(startMs, endMs), startMs + MAX_CAPTION_DURATION_MS),
      confidence: segment.confidence,
    };
  });
};

const captionGroupsForSegment = (segment: ParsedSegment) => (
  segment.words.length > 0 ? splitWordTimedSegment(segment) : splitTextFallback(segment)
);

const gapCandidates = (
  intervals: Array<{startMs: number; endMs: number}>,
  reason: string,
): SilenceCandidate[] => {
  const ordered = intervals
    .slice()
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  const candidates: SilenceCandidate[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const startMs = previous.endMs;
    const endMs = current.startMs;
    const durationMs = endMs - startMs;
    if (durationMs >= SILENCE_THRESHOLD_MS) {
      candidates.push({startMs, endMs, durationMs, reason});
    }
  }
  return candidates;
};

/**
 * Convert Whisper JSON into the workbench's millisecond-based shape.
 *
 * The parser is deliberately pure: it performs no file or process I/O and is
 * therefore safe to exercise with captured Whisper fixtures in unit tests.
 */
export const parseWhisperJson = (input: unknown): TranscriptionResult => {
  const root = parseJsonInput(input);
  if (!Array.isArray(root.segments)) {
    throw new Error('Malformed Whisper JSON: segments must be an array');
  }
  const language = root.language === undefined || root.language === null
    ? null
    : typeof root.language === 'string'
      ? root.language
      : (() => { throw new Error('Malformed Whisper JSON: language must be a string'); })();
  const wordOrder = {value: 0};
  const segments = root.segments.map((segment, index) => parseSegment(segment, index, wordOrder));
  const orderedSegments = segments
    .slice()
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.index - right.index);
  const words = segments
    .flatMap((segment) => segment.words)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.order - right.order)
    .map(({order: _order, leadingSpace: _leadingSpace, ...word}) => word);
  const usedCaptionIds = new Set<string>();
  const captions = orderedSegments.flatMap((segment) => {
    const groups = captionGroupsForSegment(segment).filter((group) => group.text.length > 0);
    return groups.map((group, groupIndex) => {
      const baseId = `caption-${segment.id}`;
      const preferredId = groups.length === 1 ? baseId : `${baseId}-${groupIndex + 1}`;
      let id = preferredId;
      let duplicateIndex = 2;
      while (usedCaptionIds.has(id)) {
        id = `${preferredId}-${duplicateIndex}`;
        duplicateIndex += 1;
      }
      usedCaptionIds.add(id);
      return {
        id,
        text: group.text,
        startMs: group.startMs,
        endMs: group.endMs,
        timestampMs: group.startMs,
        confidence: group.confidence,
        confirmed: false,
      };
    });
  });
  const segmentEnds = segments.map((segment) => segment.endMs);
  const wordEnds = words.map((word) => word.endMs);
  let durationMs = Math.max(0, ...segmentEnds, ...wordEnds);
  if (hasOwn(root, 'durationMs')) {
    const rootDurationMs = finiteNumber(root.durationMs, 'durationMs');
    if (rootDurationMs < 0) throw new Error('Malformed Whisper JSON: durationMs cannot be negative');
    durationMs = Math.max(durationMs, Math.round(rootDurationMs));
  } else if (hasOwn(root, 'duration')) {
    durationMs = Math.max(durationMs, milliseconds(root.duration, 'duration'));
  }
  const silenceCandidates = words.length > 0
    ? gapCandidates(words, 'word-gap')
    : gapCandidates(segments, 'segment-gap');
  return transcriptionResultSchema.parse({
    captions,
    words,
    language,
    durationMs,
    silenceCandidates,
  });
};

export const parseWhisperOutput = parseWhisperJson;
export const parseWhisperJsonOutput = parseWhisperJson;

/** Add media-boundary silence using the authoritative FFprobe duration. */
export const completeTranscriptionDuration = (result: TranscriptionResult, mediaDurationMs: number): TranscriptionResult => {
  const durationMs = Math.max(result.durationMs, Math.round(mediaDurationMs));
  const intervals = result.words.length > 0 ? result.words : result.captions;
  const ordered = intervals.slice().sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  const boundaryCandidates: SilenceCandidate[] = [];
  if (ordered.length === 0) {
    if (durationMs >= SILENCE_THRESHOLD_MS) boundaryCandidates.push({startMs: 0, endMs: durationMs, durationMs, reason: 'no-speech'});
  } else {
    const leadingDuration = ordered[0].startMs;
    if (leadingDuration >= SILENCE_THRESHOLD_MS) boundaryCandidates.push({startMs: 0, endMs: ordered[0].startMs, durationMs: leadingDuration, reason: 'leading-silence'});
    const lastEnd = Math.max(...ordered.map((interval) => interval.endMs));
    const trailingDuration = durationMs - lastEnd;
    if (trailingDuration >= SILENCE_THRESHOLD_MS) boundaryCandidates.push({startMs: lastEnd, endMs: durationMs, durationMs: trailingDuration, reason: 'trailing-silence'});
  }
  return transcriptionResultSchema.parse({...result, durationMs, silenceCandidates: [...boundaryCandidates, ...result.silenceCandidates].sort((a, b) => a.startMs - b.startMs)});
};

export type WhisperAvailabilityOptions = {
  command?: string;
  runner?: WhisperRunner;
};

/** Check whether the local Whisper executable can be started without invoking a transcription. */
export const detectWhisperAvailability = async (
  input: WhisperAvailabilityOptions | string = {},
): Promise<boolean> => {
  const options = typeof input === 'string' ? {command: input} : input;
  const command = options.command ?? 'whisper';
  const runner = options.runner ?? runWhisper;
  try {
    await runner(command, ['--help']);
    return true;
  } catch {
    return false;
  }
};

const defaultOutputDirectory = () => path.join(os.tmpdir(), 'codex-video-workbench', 'transcriptions');

const errorDetail = (error: unknown): string => {
  if (!error || typeof error !== 'object') return error instanceof Error ? error.message : String(error);
  const candidate = error as {message?: unknown; stderr?: unknown; code?: unknown};
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  const stderr = typeof candidate.stderr === 'string' ? candidate.stderr.trim() : '';
  const code = candidate.code === undefined ? '' : ` (${String(candidate.code)})`;
  return [message, stderr].filter(Boolean).join(': ') + code;
};

const isMissingCommand = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {code?: unknown; message?: unknown};
  return candidate.code === 'ENOENT' || (typeof candidate.message === 'string' && /ENOENT|not found/i.test(candidate.message));
};

const stemForMedia = (mediaPath: string) => {
  const parsed = path.parse(mediaPath);
  return parsed.name || 'transcription';
};

const normalizeRequest = (
  request: TranscriptionRequest | string,
  overrides: TranscriptionServiceOptions,
) => {
  const parsedRequest = typeof request === 'string'
    ? transcriptionRequestSchema.parse({mediaPath: request})
    : transcriptionRequestSchema.parse(request);
  const directOverrides = {
    ...(parsedRequest.language === undefined ? {} : {language: parsedRequest.language}),
    ...(parsedRequest.model === undefined ? {} : {model: parsedRequest.model}),
    ...(parsedRequest.outputDir === undefined ? {} : {outputDir: parsedRequest.outputDir}),
    ...(parsedRequest.wordTimestamps === undefined ? {} : {wordTimestamps: parsedRequest.wordTimestamps}),
    ...(parsedRequest.command === undefined ? {} : {command: parsedRequest.command}),
  };
  const options = transcriptionOptionsSchema.parse({
    ...(parsedRequest.options ?? {}),
    ...directOverrides,
    ...overrides,
  });
  return {parsedRequest, options};
};

/** Run the local Whisper CLI and parse its generated JSON output. */
export const transcribeMedia = async (
  request: TranscriptionRequest | string,
  serviceOptions: TranscriptionServiceOptions = {},
): Promise<TranscriptionResult> => {
  const {parsedRequest, options} = normalizeRequest(request, serviceOptions);
  const outputDir = options.outputDir ?? defaultOutputDirectory();
  const outputPath = path.join(outputDir, `${stemForMedia(parsedRequest.mediaPath)}.json`);
  await mkdir(outputDir, {recursive: true}).catch((error: unknown) => {
    throw new Error(`Unable to create Whisper output directory "${outputDir}": ${errorDetail(error)}`);
  });
  const args = [
    parsedRequest.mediaPath,
    '--model', options.model,
    '--language', options.language,
    '--output_dir', outputDir,
    '--output_format', 'json',
    '--word_timestamps', options.wordTimestamps ? 'True' : 'False',
    '--verbose', 'False',
  ];
  const runner = serviceOptions.runner ?? runWhisper;
  try {
    await runner(options.command, args);
  } catch (error) {
    if (isMissingCommand(error)) {
      throw new Error(`Whisper CLI not found (command "${options.command}"). Install openai-whisper or add it to PATH.`);
    }
    throw new Error(`Whisper transcription command failed: ${errorDetail(error)}`);
  }
  let rawOutput: string;
  try {
    rawOutput = await readFile(outputPath, 'utf8');
  } catch (error) {
    throw new Error(`Whisper output JSON is missing at "${outputPath}". Confirm the CLI completed and wrote JSON: ${errorDetail(error)}`);
  }
  try {
    return parseWhisperJson(rawOutput);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Whisper output JSON is malformed at "${outputPath}": ${detail}`);
  }
};
