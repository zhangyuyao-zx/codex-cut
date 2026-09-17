import { z } from "zod";
import { canonicalHash, compareUnicodeCodePoints } from "../shared/timeline-v2/canonical.js";
import {
  hashSchema,
  idSchema,
  isoInstantSchema,
  jsonObjectSchema,
} from "../shared/timeline-v2/schema.js";
import {
  directorPreviewConfirmationV1Schema,
  directorPreviewVersionV1Schema,
  type DirectorPreviewConfirmationV1,
  type DirectorPreviewVersionV1,
} from "./project-director-contract.js";
import {
  sceneProgramV1Schema,
  type SceneProgramV1,
} from "./scene-program-contract.js";

export const PACKAGED_CUT_PREVIEW_RENDER_CONTRACT_ID_V1 =
  "renderer:scene-program-remotion-player-v1" as const;
export const PACKAGED_CUT_PREVIEW_RENDER_CONTRACT_HASH_V1 = canonicalHash({
  contractId: PACKAGED_CUT_PREVIEW_RENDER_CONTRACT_ID_V1,
  renderer: "R4 SceneProgram Remotion Player",
  delivery: "PREVIEW_ONLY",
  frameDriven: true,
  version: 1,
});

export const packagedCutTechnicalQaCheckStatusV1Schema = z.enum(["PASS", "FAIL", "WARNING"]);
export const packagedCutTechnicalQaSeverityV1Schema = z.enum(["BLOCKER", "WARNING"]);

export const packagedCutTechnicalQaCheckV1Schema = z.object({
  checkId: idSchema,
  status: packagedCutTechnicalQaCheckStatusV1Schema,
  severity: packagedCutTechnicalQaSeverityV1Schema,
  message: z.string().trim().min(1).max(2_000),
  evidence: jsonObjectSchema,
}).strict();

const packagedCutTechnicalQaReportSemanticV1Schema = z.object({
  schemaVersion: z.literal(1),
  overall: z.enum(["PASS", "FAIL"]),
  checks: z.array(packagedCutTechnicalQaCheckV1Schema).min(1).max(128),
  blockerCount: z.number().int().nonnegative().max(128),
  warningCount: z.number().int().nonnegative().max(128),
}).strict().superRefine((report, context) => {
  const blockerCount = report.checks.filter((check) => check.status === "FAIL" && check.severity === "BLOCKER").length;
  const warningCount = report.checks.filter((check) => check.status === "WARNING" || check.severity === "WARNING").length;
  if (report.blockerCount !== blockerCount) {
    context.addIssue({ code: "custom", path: ["blockerCount"], message: "technical QA blocker count must match checks" });
  }
  if (report.warningCount !== warningCount) {
    context.addIssue({ code: "custom", path: ["warningCount"], message: "technical QA warning count must match checks" });
  }
  const hasFailure = report.checks.some((check) => check.status === "FAIL");
  if ((report.overall === "FAIL") !== hasFailure) {
    context.addIssue({ code: "custom", path: ["overall"], message: "technical QA overall must match check failures" });
  }
  if (new Set(report.checks.map((check) => check.checkId)).size !== report.checks.length) {
    context.addIssue({ code: "custom", path: ["checks"], message: "technical QA check ids must be unique" });
  }
});

export const packagedCutTechnicalQaReportV1Schema = packagedCutTechnicalQaReportSemanticV1Schema.extend({
  reportHash: hashSchema,
}).strict().superRefine((report, context) => {
  const { reportHash: _reportHash, ...semantic } = report;
  if (report.reportHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["reportHash"], message: "technical QA report hash must match canonical content" });
  }
});

const packagedCutCanvasV1Schema = z.object({
  width: z.number().int().positive().max(16_384),
  height: z.number().int().positive().max(16_384),
  framesPerSecond: z.number().positive().max(1_000),
}).strict();

const packagedCutSemanticV1Schema = z.object({
  schemaVersion: z.literal(1),
  packagedCutId: idSchema,
  projectId: idSchema,
  timelineId: idSchema,
  revision: z.number().int().nonnegative(),
  timelineHash: hashSchema,
  creativePlanId: idSchema,
  creativePlanHash: hashSchema,
  layoutCutId: idSchema,
  layoutCutHash: hashSchema,
  layoutConfirmationVersionId: idSchema,
  layoutConfirmationVersionHash: hashSchema,
  implementationPlanId: idSchema,
  implementationPlanHash: hashSchema,
  sceneProgramId: idSchema,
  sceneProgramHash: hashSchema,
  previewRenderContractId: idSchema,
  previewRenderContractHash: hashSchema,
  canvas: packagedCutCanvasV1Schema,
  durationFrames: z.number().int().positive(),
  mediaAssetIds: z.array(idSchema).max(256),
  componentIds: z.array(idSchema).max(256),
  rendererAdapterIds: z.array(idSchema).max(256),
  dependencyHash: hashSchema,
  technicalQaReport: packagedCutTechnicalQaReportV1Schema,
  generatedAt: isoInstantSchema,
  timelineModified: z.literal(false),
}).strict().superRefine((artifact, context) => {
  for (const [field, values] of [
    ["mediaAssetIds", artifact.mediaAssetIds],
    ["componentIds", artifact.componentIds],
    ["rendererAdapterIds", artifact.rendererAdapterIds],
  ] as const) {
    const sorted = [...values].sort(compareUnicodeCodePoints);
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", path: [field], message: `${field} must contain unique identities` });
    }
    if (sorted.some((value, index) => value !== values[index])) {
      context.addIssue({ code: "custom", path: [field], message: `${field} must be sorted canonically` });
    }
  }
  if (artifact.previewRenderContractId !== PACKAGED_CUT_PREVIEW_RENDER_CONTRACT_ID_V1
    || artifact.previewRenderContractHash !== PACKAGED_CUT_PREVIEW_RENDER_CONTRACT_HASH_V1) {
    context.addIssue({ code: "custom", path: ["previewRenderContractId"], message: "Packaged Cut must bind the deterministic preview renderer contract" });
  }
});

export const packagedCutV1Schema = packagedCutSemanticV1Schema.extend({
  packagedCutHash: hashSchema,
}).strict().superRefine((artifact, context) => {
  const { packagedCutHash: _packagedCutHash, ...semantic } = artifact;
  if (artifact.packagedCutHash !== canonicalHash(semantic)) {
    context.addIssue({ code: "custom", path: ["packagedCutHash"], message: "Packaged Cut hash must match canonical content" });
  }
});

export const compilePackagedCutV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  expectedTimelineHash: hashSchema,
  sceneProgramId: idSchema,
  sceneProgramHash: hashSchema,
}).strict();

export const packagedCutPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  currentPackagedCutId: idSchema.nullable(),
  packagedCuts: z.array(packagedCutV1Schema).max(128),
}).strict().superRefine((state, context) => {
  const ids = state.packagedCuts.map((artifact) => artifact.packagedCutId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["packagedCuts"], message: "Packaged Cut identities must be unique" });
  }
  if (state.currentPackagedCutId !== null && !ids.includes(state.currentPackagedCutId)) {
    context.addIssue({ code: "custom", path: ["currentPackagedCutId"], message: "current Packaged Cut must exist" });
  }
});

export const packagedCutReadinessCodeV1Schema = z.enum([
  "ROUGH_CUT_REQUIRED",
  "CREATIVE_PLAN_REQUIRED",
  "LAYOUT_CUT_REQUIRED",
  "LAYOUT_CUT_CONFIRMATION_REQUIRED",
  "SCENE_PROGRAM_REQUIRED",
  "SCENE_PROGRAM_STALE",
  "TECHNICAL_QA_FAILED",
  "TECHNICAL_QA_STALE",
  "PACKAGED_CUT_PREVIEW_REQUIRED",
  "PACKAGED_CUT_READY",
]);

export const packagedCutSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: idSchema,
  timelineId: idSchema,
  packagedCut: packagedCutV1Schema.nullable(),
  previewVersion: directorPreviewVersionV1Schema.nullable(),
  previewConfirmed: z.boolean(),
  technicalQaReport: packagedCutTechnicalQaReportV1Schema.nullable(),
  readiness: z.object({
    code: packagedCutReadinessCodeV1Schema,
    message: z.string().trim().min(1).max(2_000),
  }).strict(),
  timelineModified: z.literal(false),
}).strict();

export type PackagedCutTechnicalQaCheckV1 = z.infer<typeof packagedCutTechnicalQaCheckV1Schema>;
export type PackagedCutTechnicalQaReportV1 = z.infer<typeof packagedCutTechnicalQaReportV1Schema>;
export type PackagedCutV1 = z.infer<typeof packagedCutV1Schema>;
export type CompilePackagedCutV1Request = z.infer<typeof compilePackagedCutV1RequestSchema>;
export type PackagedCutPersistentStateV1 = z.infer<typeof packagedCutPersistentStateV1Schema>;
export type PackagedCutSnapshotV1 = z.infer<typeof packagedCutSnapshotV1Schema>;
export type PackagedCutReadinessCodeV1 = z.infer<typeof packagedCutReadinessCodeV1Schema>;
export type PackagedCutPreviewVersionV1 = DirectorPreviewVersionV1;
export type PackagedCutPreviewConfirmationV1 = DirectorPreviewConfirmationV1;

export function packagedCutTechnicalQaReportV1Hash(report: unknown): string {
  const parsed = packagedCutTechnicalQaReportV1Schema.parse(report);
  const { reportHash: _reportHash, ...semantic } = parsed;
  return canonicalHash(semantic);
}

export function packagedCutV1Hash(artifact: unknown): string {
  const parsed = packagedCutV1Schema.parse(artifact);
  const { packagedCutHash: _packagedCutHash, ...semantic } = parsed;
  return canonicalHash(semantic);
}

export function packagedCutSemanticHash(artifact: Omit<PackagedCutV1, "packagedCutHash">): string {
  return canonicalHash(artifact);
}

export function isCurrentPackagedCutPreviewV1(
  preview: DirectorPreviewVersionV1 | null,
  artifact: Pick<PackagedCutV1, "revision" | "timelineHash" | "creativePlanId" | "creativePlanHash" | "packagedCutHash">,
): preview is DirectorPreviewVersionV1 {
  return preview !== null
    && preview.kind === "PACKAGED_CUT"
    && preview.status === "READY"
    && preview.revision === artifact.revision
    && preview.timelineHash === artifact.timelineHash
    && preview.creativePlanId === artifact.creativePlanId
    && preview.creativePlanHash === artifact.creativePlanHash
    && preview.payloadHash === artifact.packagedCutHash;
}

export function isCurrentPackagedCutConfirmationV1(
  confirmation: DirectorPreviewConfirmationV1,
  preview: DirectorPreviewVersionV1,
): boolean {
  return confirmation.kind === "PACKAGED_CUT"
    && confirmation.status === "CONFIRMED"
    && confirmation.previewVersionId === preview.previewVersionId
    && confirmation.previewVersionHash === preview.previewVersionHash
    && confirmation.revision === preview.revision
    && confirmation.timelineHash === preview.timelineHash;
}

export function assertSceneProgramHashBoundV1(program: unknown): SceneProgramV1 {
  return sceneProgramV1Schema.parse(program);
}
