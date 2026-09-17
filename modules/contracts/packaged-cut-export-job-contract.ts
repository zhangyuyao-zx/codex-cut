import {z} from "zod";
import {
  exportFailureSchema,
  exportJobIdSchema,
  exportJobReportSchema,
  exportJobRequestSchema,
} from "./export-contract.js";
import {
  packagedCutExportCheckpointV1Schema,
  packagedCutExportSelectionV1Hash,
  packagedCutExportSelectionV1Schema,
  type PackagedCutExportCheckpointV1,
  type PackagedCutExportSelectionV1,
} from "./packaged-cut-export-contract.js";

/**
 * The only mutable input accepted by the Packaged Cut export job boundary.
 * The selection is an immutable identity tuple; captions, assets, ranges,
 * and output implementation details are deliberately not accepted here.
 */
export const packagedCutExportStartRequestV1Schema = z.object({
  jobId: exportJobIdSchema,
  outputPath: z.string().min(1).max(4096),
  selection: packagedCutExportSelectionV1Schema,
}).strict();

/** Status and cancel carry no mutable export facts beyond the job identity. */
export const packagedCutExportJobRequestV1Schema = exportJobRequestSchema;

/**
 * Public report for the later broker boundary.  It intentionally reuses the
 * existing bounded report fields, while adding the immutable selection and a
 * final checkpoint that is published only after the verified hard link is in
 * place.
 */
export const packagedCutExportJobReportV1Schema = exportJobReportSchema.extend({
  selection: packagedCutExportSelectionV1Schema,
  finalCheckpoint: packagedCutExportCheckpointV1Schema.nullable(),
}).strict().superRefine((report, context) => {
  if (report.state === "completed") {
    if (report.finalCheckpoint === null) {
      context.addIssue({
        code: "custom",
        path: ["finalCheckpoint"],
        message: "a completed Packaged Cut export must expose its final checkpoint",
      });
    }
    if (report.verification === null) {
      context.addIssue({
        code: "custom",
        path: ["verification"],
        message: "a completed Packaged Cut export must expose verification evidence",
      });
    }
    if (report.progress !== 1) {
      context.addIssue({
        code: "custom",
        path: ["progress"],
        message: "a completed Packaged Cut export must report progress 1",
      });
    }
    if (report.outputPath === null || report.expectedDurationSeconds === null
      || report.renderedSeconds !== report.expectedDurationSeconds) {
      context.addIssue({
        code: "custom",
        path: ["renderedSeconds"],
        message: "a completed Packaged Cut export must expose its exact final duration",
      });
    }
    if (report.error !== null) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "a completed Packaged Cut export cannot contain an error",
      });
    }
  } else if (report.finalCheckpoint !== null) {
    context.addIssue({
      code: "custom",
      path: ["finalCheckpoint"],
      message: "the final checkpoint is published only for a completed export",
    });
  }

  if (report.state !== "completed" && report.verification !== null) {
    context.addIssue({
      code: "custom",
      path: ["verification"],
      message: "only a completed Packaged Cut export may expose verification evidence",
    });
  }

  if (report.finalCheckpoint !== null) {
    const checkpointSelection = {
      projectId: report.finalCheckpoint.projectId,
      timelineId: report.finalCheckpoint.timelineId,
      revision: report.finalCheckpoint.revision,
      timelineHash: report.finalCheckpoint.timelineHash,
      packagedCutId: report.finalCheckpoint.packagedCutId,
      packagedCutHash: report.finalCheckpoint.packagedCutHash,
      dependencyHash: report.finalCheckpoint.dependencyHash,
      sceneProgramId: report.finalCheckpoint.sceneProgramId,
      sceneProgramHash: report.finalCheckpoint.sceneProgramHash,
      previewVersionId: report.finalCheckpoint.previewVersionId,
      previewVersionHash: report.finalCheckpoint.previewVersionHash,
    } satisfies PackagedCutExportSelectionV1;
    if (packagedCutExportSelectionV1Hash(checkpointSelection)
      !== packagedCutExportSelectionV1Hash(report.selection)) {
      context.addIssue({
        code: "custom",
        path: ["finalCheckpoint"],
        message: "final checkpoint selection must equal the report selection",
      });
    }
  }
});

export type PackagedCutExportStartRequestV1 = z.infer<typeof packagedCutExportStartRequestV1Schema>;
export type PackagedCutExportJobRequestV1 = z.infer<typeof packagedCutExportJobRequestV1Schema>;
export type PackagedCutExportJobReportV1 = z.infer<typeof packagedCutExportJobReportV1Schema>;

/** Compatibility aliases for callers that use the shorter request names. */
export const packagedCutExportRequestV1Schema = packagedCutExportStartRequestV1Schema;
export const packagedCutExportJobStartRequestV1Schema = packagedCutExportStartRequestV1Schema;
export const packagedCutExportStatusRequestV1Schema = packagedCutExportJobRequestV1Schema;
export const packagedCutExportCancelRequestV1Schema = packagedCutExportJobRequestV1Schema;
export const packagedCutExportJobStatusRequestV1Schema = packagedCutExportJobRequestV1Schema;
export const packagedCutExportJobCancelRequestV1Schema = packagedCutExportJobRequestV1Schema;
export const packagedCutExportReportV1Schema = packagedCutExportJobReportV1Schema;
export type PackagedCutExportRequestV1 = PackagedCutExportStartRequestV1;
export type PackagedCutExportJobStartRequestV1 = PackagedCutExportStartRequestV1;
export type PackagedCutExportReportV1 = PackagedCutExportJobReportV1;

export function assertPackagedCutExportStartRequestV1(input: unknown): PackagedCutExportStartRequestV1 {
  return packagedCutExportStartRequestV1Schema.parse(input);
}

export function assertPackagedCutExportJobRequestV1(input: unknown): PackagedCutExportJobRequestV1 {
  return packagedCutExportJobRequestV1Schema.parse(input);
}

export function assertPackagedCutExportJobReportV1(input: unknown): PackagedCutExportJobReportV1 {
  return packagedCutExportJobReportV1Schema.parse(input);
}

export function assertPackagedCutExportCheckpointForReportV1(
  report: PackagedCutExportJobReportV1,
): PackagedCutExportCheckpointV1 | null {
  return report.finalCheckpoint === null
    ? null
    : packagedCutExportCheckpointV1Schema.parse(report.finalCheckpoint);
}

/** Keep this import visible to downstream type-only consumers without allowing a second schema. */
export type {PackagedCutExportCheckpointV1, PackagedCutExportSelectionV1};
export {exportFailureSchema};
