import {z} from 'zod';
import {captionCueSchema, type CaptionCue} from './project.js';

/** A single word returned by Whisper's optional word-timestamp output. */
export const transcriptionWordSchema = z.object({
  word: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).nullable(),
});
export type TranscriptionWord = z.infer<typeof transcriptionWordSchema>;

/** A possible edit point where no recognized speech occurs. */
export const silenceCandidateSchema = z.object({
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  reason: z.string().min(1),
});
export type SilenceCandidate = z.infer<typeof silenceCandidateSchema>;

/** The normalized, local-only transcription result consumed by the workbench. */
export const transcriptionResultSchema = z.object({
  captions: z.array(captionCueSchema),
  words: z.array(transcriptionWordSchema),
  language: z.string().min(1).nullable(),
  durationMs: z.number().nonnegative(),
  silenceCandidates: z.array(silenceCandidateSchema),
});
export type TranscriptionResult = z.infer<typeof transcriptionResultSchema>;

/** Options that affect the local Whisper invocation. */
export const transcriptionOptionsSchema = z.object({
  language: z.string().min(1).default('zh'),
  model: z.string().min(1).default('turbo'),
  outputDir: z.string().min(1).optional(),
  wordTimestamps: z.boolean().default(true),
  command: z.string().min(1).default('whisper'),
});
export type TranscriptionOptions = z.infer<typeof transcriptionOptionsSchema>;

/**
 * A request accepted by the transcription service.  The direct option fields
 * are intentionally supported alongside `options` so callers can keep the
 * request JSON flat while the service still has one normalized option shape.
 */
export const transcriptionRequestSchema = z.object({
  mediaPath: z.string().min(1),
  outputDir: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  wordTimestamps: z.boolean().optional(),
  command: z.string().min(1).optional(),
  options: transcriptionOptionsSchema.partial().optional(),
});
export type TranscriptionRequest = z.infer<typeof transcriptionRequestSchema>;

// Keep the shorter names available to callers that use the operation name.
export const transcribeOptionsSchema = transcriptionOptionsSchema;
export type TranscribeOptions = TranscriptionOptions;
export const transcribeRequestSchema = transcriptionRequestSchema;
export type TranscribeRequest = TranscriptionRequest;

export type CaptionCueCompatible = CaptionCue;
