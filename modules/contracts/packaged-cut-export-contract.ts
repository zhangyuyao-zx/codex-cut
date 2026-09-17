import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import { hashSchema, idSchema } from "../shared/timeline-v2/schema.js";

/**
 * The immutable identity tuple selected at the export boundary.  It contains
 * only facts already produced by the confirmed Packaged Cut pipeline; it does
 * not contain a filesystem path or any model-authored export choice.
 */
export const packagedCutExportSelectionV1Schema = z.object({
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  packagedCutId: idSchema,
  packagedCutHash: hashSchema,
  dependencyHash: hashSchema,
  sceneProgramId: idSchema,
  sceneProgramHash: hashSchema,
  previewVersionId: idSchema,
  previewVersionHash: hashSchema,
}).strict();

export type PackagedCutExportSelectionV1 = z.infer<typeof packagedCutExportSelectionV1Schema>;

export function createPackagedCutExportSelectionV1(
  input: PackagedCutExportSelectionV1,
): PackagedCutExportSelectionV1 {
  return packagedCutExportSelectionV1Schema.parse(input);
}

export function assertPackagedCutExportSelectionV1(
  input: unknown,
): PackagedCutExportSelectionV1 {
  return packagedCutExportSelectionV1Schema.parse(input);
}

/** Return the canonical hash of an exact export selection. */
export function packagedCutExportSelectionV1Hash(input: unknown): string {
  return canonicalHash(packagedCutExportSelectionV1Schema.parse(input));
}

/** Compatibility alias for callers that prefer the shorter name. */
export const packagedCutExportSelectionHashV1 = packagedCutExportSelectionV1Hash;

export const packagedCutExportCheckpointSemanticV1Schema = packagedCutExportSelectionV1Schema.extend({
  schemaVersion: z.literal(1),
  captionProjectionHash: hashSchema,
  assetBindingHash: hashSchema,
  remotionRuntimeHash: hashSchema,
}).strict();

export const packagedCutExportCheckpointV1Schema = packagedCutExportCheckpointSemanticV1Schema.extend({
  checkpointHash: hashSchema,
}).strict().superRefine((checkpoint, context) => {
  const { checkpointHash: _checkpointHash, ...semantic } = checkpoint;
  if (checkpoint.checkpointHash !== canonicalHash(semantic)) {
    context.addIssue({
      code: "custom",
      path: ["checkpointHash"],
      message: "Packaged Cut export checkpoint hash must match canonical content",
    });
  }
});

export type PackagedCutExportCheckpointSemanticV1 = z.infer<typeof packagedCutExportCheckpointSemanticV1Schema>;
export type PackagedCutExportCheckpointV1 = z.infer<typeof packagedCutExportCheckpointV1Schema>;
export const packagedCutExportFinalCheckpointV1Schema = packagedCutExportCheckpointV1Schema;
export type PackagedCutExportFinalCheckpointV1 = PackagedCutExportCheckpointV1;

export type CreatePackagedCutExportCheckpointV1Input = (PackagedCutExportSelectionV1 & {
  schemaVersion?: 1;
  captionProjectionHash: string;
  assetBindingHash: string;
  remotionRuntimeHash: string;
}) | ({
  selection: PackagedCutExportSelectionV1;
  schemaVersion?: 1;
  captionProjectionHash: string;
  assetBindingHash: string;
  remotionRuntimeHash: string;
});

/** Construct the exact final checkpoint from already validated dependencies. */
export function createPackagedCutExportCheckpointV1(
  input: CreatePackagedCutExportCheckpointV1Input,
): PackagedCutExportCheckpointV1 {
  const flatInput = "selection" in input
    ? (() => {
      const { selection: _selection, ...rest } = input;
      return { ...input.selection, ...rest };
    })()
    : input;
  const semantic = packagedCutExportCheckpointSemanticV1Schema.parse({
    ...flatInput,
    schemaVersion: input.schemaVersion ?? 1,
  });
  return packagedCutExportCheckpointV1Schema.parse({
    ...semantic,
    checkpointHash: canonicalHash(semantic),
  });
}

/** Compute the checkpoint hash while excluding its self-hash field. */
export function packagedCutExportCheckpointV1Hash(input: unknown): string {
  const parsed = packagedCutExportCheckpointV1Schema.parse(input);
  const { checkpointHash: _checkpointHash, ...semantic } = parsed;
  return canonicalHash(semantic);
}

export function assertPackagedCutExportCheckpointV1(
  input: unknown,
): PackagedCutExportCheckpointV1 {
  return packagedCutExportCheckpointV1Schema.parse(input);
}

export const createPackagedCutExportFinalCheckpointV1 = createPackagedCutExportCheckpointV1;
export const assertPackagedCutExportFinalCheckpointV1 = assertPackagedCutExportCheckpointV1;
