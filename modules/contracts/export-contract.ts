import { z } from "zod";

export const exportJobIdSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

const absoluteExportPathSchema = z.string().min(1).max(4096);

export const startExportRequestSchema = z.object({
  jobId: exportJobIdSchema,
  outputPath: absoluteExportPathSchema,
  expectedRevision: z.number().int().nonnegative(),
}).strict();

export const exportJobRequestSchema = z.object({
  jobId: exportJobIdSchema,
}).strict();

export const exportJobStateSchema = z.enum([
  "preparing",
  "rendering",
  "verifying",
  "publishing",
  "cancelling",
  "completed",
  "cancelled",
  "failed",
]);

export const exportFailureSchema = z.object({
  code: z.string().min(1).max(128).regex(/^[A-Z0-9_]+$/u),
  message: z.string().min(1).max(2048),
}).strict();

export const exportVerificationSchema = z.object({
  container: z.literal("mp4"),
  videoCodec: z.literal("h264"),
  audioCodec: z.literal("aac"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  framesPerSecond: z.number().positive(),
  frameCount: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  videoDurationSeconds: z.number().positive().nullable(),
  audioDurationSeconds: z.number().positive().nullable(),
  byteLength: z.number().int().positive(),
  decoded: z.literal(true),
}).strict();

export const exportJobReportSchema = z.object({
  schemaVersion: z.literal(1),
  jobId: exportJobIdSchema,
  state: exportJobStateSchema,
  stage: z.string().min(1).max(128),
  progress: z.number().min(0).max(1),
  message: z.string().min(1).max(1024),
  outputPath: absoluteExportPathSchema.nullable(),
  expectedDurationSeconds: z.number().positive().nullable(),
  renderedSeconds: z.number().nonnegative(),
  error: exportFailureSchema.nullable(),
  verification: exportVerificationSchema.nullable(),
}).strict();

export type StartExportRequest = z.infer<typeof startExportRequestSchema>;
export type ExportJobRequest = z.infer<typeof exportJobRequestSchema>;
export type ExportJobState = z.infer<typeof exportJobStateSchema>;
export type ExportFailure = z.infer<typeof exportFailureSchema>;
export type ExportVerification = z.infer<typeof exportVerificationSchema>;
export type ExportJobReport = z.infer<typeof exportJobReportSchema>;
