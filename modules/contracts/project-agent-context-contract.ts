import { z } from "zod";
import { canonicalHash } from "../shared/timeline-v2/canonical.js";

const idSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9:._-]+$/u);
const hashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const instantSchema = z.string().datetime({ offset: false });
const compactTextSchema = z.string().trim().min(1).max(1_000);

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const projectAgentStageV1Schema = z.enum([
  "ROUGH_CUT",
  "VISUAL_PARAGRAPH",
  "VISUAL_ROLE",
  "MATERIALS",
  "LAYOUT",
  "PACKAGING_TARGET",
  "MOTION",
  "EXPORT",
]);

export const projectAgentArtifactKindV1Schema = z.enum([
  "TIMELINE_DOCUMENT",
  "ROUGH_CUT_FOUNDATION",
  "MASTER_TRANSCRIPT",
  "TIME_MAP",
  "TRANSCRIPT_PROJECTION",
  "VISUAL_PARAGRAPH_PROPOSAL",
  "VISUAL_PARAGRAPH_REVIEW",
  "VISUAL_ROLE_STRUCTURE",
  "VISUAL_ROLE_PLAN",
  "MATERIAL_MANIFEST",
  "VISUAL_ROLE_REVIEW",
  "LAYOUT_FOUNDATION",
  "LAYOUT_PLAN",
  "LAYOUT_REVIEW",
]);

export const projectAgentArtifactStatusV1Schema = z.enum([
  "CURRENT",
  "CONFIRMED",
  "PENDING",
  "PARTIAL_REVIEW_REQUIRED",
  "STALE",
  "MISSING",
  "BLOCKED",
]);

export const projectAgentGateCodeV1Schema = z.enum([
  "ROUGH_CUT_REQUIRED",
  "VISUAL_PARAGRAPH_REQUIRED",
  "VISUAL_PARAGRAPH_REVIEW_REQUIRED",
  "VISUAL_ROLE_PLAN_REQUIRED",
  "MATERIALS_REQUIRED",
  "VISUAL_ROLE_REVIEW_REQUIRED",
  "LAYOUT_READY_NOT_IMPLEMENTED",
  "LAYOUT_READY",
  "LAYOUT_REVIEW_REQUIRED",
  "SCENE_DIRECTION_READY",
  "BLOCKED",
]);

export const projectAgentGateV1Schema = z.object({
  code: projectAgentGateCodeV1Schema,
  stage: projectAgentStageV1Schema,
  state: z.enum(["READY", "BLOCKED", "NOT_IMPLEMENTED"]),
  reasonCodes: z.array(idSchema).max(64),
  affectedParagraphIds: z.array(idSchema).max(512),
}).strict().superRefine((gate, context) => {
  if (!unique(gate.reasonCodes)) {
    context.addIssue({ code: "custom", path: ["reasonCodes"], message: "gate reason codes must be unique" });
  }
  if (!unique(gate.affectedParagraphIds)) {
    context.addIssue({ code: "custom", path: ["affectedParagraphIds"], message: "gate paragraph ids must be unique" });
  }
  if (gate.code === "LAYOUT_READY_NOT_IMPLEMENTED" && (gate.stage !== "LAYOUT" || gate.state !== "NOT_IMPLEMENTED")) {
    context.addIssue({ code: "custom", path: ["code"], message: "layout-ready gate must remain explicitly not implemented" });
  }
  if (gate.code === "LAYOUT_READY" && (gate.stage !== "LAYOUT" || gate.state !== "READY")) {
    context.addIssue({ code: "custom", path: ["code"], message: "implemented layout gate must be ready at LAYOUT" });
  }
  if (gate.code === "LAYOUT_REVIEW_REQUIRED" && (gate.stage !== "LAYOUT" || gate.state !== "READY")) {
    context.addIssue({ code: "custom", path: ["code"], message: "layout review gate must remain ready at LAYOUT" });
  }
  if (gate.code === "SCENE_DIRECTION_READY" && (gate.stage !== "PACKAGING_TARGET" || gate.state !== "READY")) {
    context.addIssue({ code: "custom", path: ["code"], message: "scene-direction gate must be ready at PACKAGING_TARGET" });
  }
  if (gate.code === "BLOCKED" && gate.state !== "BLOCKED") {
    context.addIssue({ code: "custom", path: ["state"], message: "blocked gate must have blocked state" });
  }
});

export type ProjectAgentArtifactRefV1HashInput = {
  refId: string;
  kind: z.infer<typeof projectAgentArtifactKindV1Schema>;
  artifactId: string | null;
  artifactHash: string | null;
  revision: number;
  status: z.infer<typeof projectAgentArtifactStatusV1Schema>;
  paragraphIds: string[];
  itemCount: number | null;
  unresolvedCount: number;
  noticeCodes: string[];
};

export function projectAgentArtifactRefV1Hash(ref: ProjectAgentArtifactRefV1HashInput): string {
  return canonicalHash(ref);
}

export const projectAgentArtifactRefV1Schema = z.object({
  schemaVersion: z.literal(1),
  refId: idSchema,
  refHash: hashSchema,
  kind: projectAgentArtifactKindV1Schema,
  artifactId: idSchema.nullable(),
  artifactHash: hashSchema.nullable(),
  revision: z.number().int().nonnegative(),
  status: projectAgentArtifactStatusV1Schema,
  paragraphIds: z.array(idSchema).max(512),
  itemCount: z.number().int().nonnegative().max(100_000).nullable(),
  unresolvedCount: z.number().int().nonnegative().max(100_000),
  noticeCodes: z.array(idSchema).max(64),
}).strict().superRefine((ref, context) => {
  if ((ref.artifactId === null) !== (ref.artifactHash === null)) {
    context.addIssue({ code: "custom", path: ["artifactId"], message: "artifact id and hash must be both present or absent" });
  }
  if (!["MISSING", "BLOCKED"].includes(ref.status) && ref.artifactId === null) {
    context.addIssue({ code: "custom", path: ["artifactId"], message: "available artifact status requires an exact id and hash" });
  }
  if (!unique(ref.paragraphIds)) {
    context.addIssue({ code: "custom", path: ["paragraphIds"], message: "artifact paragraph ids must be unique" });
  }
  if (!unique(ref.noticeCodes)) {
    context.addIssue({ code: "custom", path: ["noticeCodes"], message: "artifact notice codes must be unique" });
  }
  const { schemaVersion: _schemaVersion, refHash: _refHash, ...semantic } = ref;
  if (ref.refHash !== projectAgentArtifactRefV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["refHash"], message: "artifact ref hash must match canonical content" });
  }
});

export const projectAgentDecisionProvenanceV1Schema = z.enum([
  "HOST_FACT",
  "USER_CONFIRMED",
  "AI_PROPOSAL",
  "HYPOTHESIS",
]);

export const projectAgentDecisionStatusV1Schema = z.enum([
  "CONFIRMED",
  "PROPOSED",
  "UNVERIFIED",
]);

const projectAgentEvidenceRefV1Schema = z.object({
  refId: idSchema,
  refHash: hashSchema,
}).strict();

export type ProjectAgentDecisionLedgerEntryV1HashInput = {
  decisionId: string;
  projectAgentId: string;
  provenance: z.infer<typeof projectAgentDecisionProvenanceV1Schema>;
  status: z.infer<typeof projectAgentDecisionStatusV1Schema>;
  stage: z.infer<typeof projectAgentStageV1Schema>;
  summary: string;
  paragraphIds: string[];
  evidenceRefs: Array<{ refId: string; refHash: string }>;
  supersedesDecisionId: string | null;
  recordedAt: string;
  confirmedAt: string | null;
};

export function projectAgentDecisionLedgerEntryV1Hash(entry: ProjectAgentDecisionLedgerEntryV1HashInput): string {
  return canonicalHash(entry);
}

export const projectAgentDecisionLedgerEntryV1Schema = z.object({
  schemaVersion: z.literal(1),
  decisionId: idSchema,
  decisionHash: hashSchema,
  projectAgentId: idSchema,
  provenance: projectAgentDecisionProvenanceV1Schema,
  status: projectAgentDecisionStatusV1Schema,
  stage: projectAgentStageV1Schema,
  summary: compactTextSchema,
  paragraphIds: z.array(idSchema).max(512),
  evidenceRefs: z.array(projectAgentEvidenceRefV1Schema).max(64),
  supersedesDecisionId: idSchema.nullable(),
  recordedAt: instantSchema,
  confirmedAt: instantSchema.nullable(),
}).strict().superRefine((entry, context) => {
  if (!unique(entry.paragraphIds)) {
    context.addIssue({ code: "custom", path: ["paragraphIds"], message: "decision paragraph ids must be unique" });
  }
  if (!unique(entry.evidenceRefs.map((ref) => ref.refId))) {
    context.addIssue({ code: "custom", path: ["evidenceRefs"], message: "decision evidence refs must be unique" });
  }
  if (entry.provenance === "USER_CONFIRMED"
    && (entry.status !== "CONFIRMED" || entry.confirmedAt === null || entry.evidenceRefs.length === 0)) {
    context.addIssue({
      code: "custom",
      path: ["provenance"],
      message: "user-confirmed decisions require confirmed status, confirmation time and exact evidence",
    });
  }
  if (entry.provenance === "HOST_FACT" && (entry.status !== "CONFIRMED" || entry.evidenceRefs.length === 0)) {
    context.addIssue({ code: "custom", path: ["status"], message: "host facts require confirmed status and exact host evidence" });
  }
  if (entry.provenance === "AI_PROPOSAL" && entry.status !== "PROPOSED") {
    context.addIssue({ code: "custom", path: ["status"], message: "AI proposals cannot be represented as confirmed decisions" });
  }
  if (entry.provenance === "HYPOTHESIS" && entry.status !== "UNVERIFIED") {
    context.addIssue({ code: "custom", path: ["status"], message: "hypotheses must remain unverified" });
  }
  if (["AI_PROPOSAL", "HYPOTHESIS"].includes(entry.provenance) && entry.confirmedAt !== null) {
    context.addIssue({ code: "custom", path: ["confirmedAt"], message: "unconfirmed model knowledge cannot have a confirmation time" });
  }
  if (entry.supersedesDecisionId === entry.decisionId) {
    context.addIssue({ code: "custom", path: ["supersedesDecisionId"], message: "a decision cannot supersede itself" });
  }
  const { schemaVersion: _schemaVersion, decisionHash: _decisionHash, ...semantic } = entry;
  if (entry.decisionHash !== projectAgentDecisionLedgerEntryV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["decisionHash"], message: "decision hash must match canonical content" });
  }
});

export type ProjectConstitutionV1HashInput = {
  constitutionId: string;
  projectId: string;
  projectAgentId: string;
  revision: number;
  status: "DRAFT" | "CONFIRMED";
  objective: string | null;
  audience: string | null;
  deliveryIntent: string | null;
  stylePrinciples: string[];
  prohibitedDirections: string[];
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

export function projectConstitutionV1Hash(constitution: ProjectConstitutionV1HashInput): string {
  return canonicalHash(constitution);
}

export const projectConstitutionV1Schema = z.object({
  schemaVersion: z.literal(1),
  constitutionId: idSchema,
  constitutionHash: hashSchema,
  projectId: idSchema,
  projectAgentId: idSchema,
  revision: z.number().int().nonnegative(),
  status: z.enum(["DRAFT", "CONFIRMED"]),
  objective: compactTextSchema.nullable(),
  audience: compactTextSchema.nullable(),
  deliveryIntent: compactTextSchema.nullable(),
  stylePrinciples: z.array(compactTextSchema).max(64),
  prohibitedDirections: z.array(compactTextSchema).max(64),
  createdAt: instantSchema,
  updatedAt: instantSchema,
  confirmedAt: instantSchema.nullable(),
}).strict().superRefine((constitution, context) => {
  if (!unique(constitution.stylePrinciples) || !unique(constitution.prohibitedDirections)) {
    context.addIssue({ code: "custom", path: [], message: "project constitution lists must be unique" });
  }
  if ((constitution.status === "CONFIRMED") !== (constitution.confirmedAt !== null)) {
    context.addIssue({ code: "custom", path: ["status"], message: "constitution status and confirmation must match" });
  }
  if (constitution.status === "CONFIRMED"
    && constitution.objective === null
    && constitution.audience === null
    && constitution.deliveryIntent === null
    && constitution.stylePrinciples.length === 0
    && constitution.prohibitedDirections.length === 0) {
    context.addIssue({ code: "custom", path: ["status"], message: "an empty project constitution cannot be user-confirmed" });
  }
  const { schemaVersion: _schemaVersion, constitutionHash: _constitutionHash, ...semantic } = constitution;
  if (constitution.constitutionHash !== projectConstitutionV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["constitutionHash"], message: "constitution hash must match canonical content" });
  }
});

const productConstitutionRuleV1Schema = z.object({
  code: idSchema,
  statement: compactTextSchema,
}).strict();

export type ProductConstitutionV1HashInput = {
  constitutionId: string;
  version: 1;
  rules: Array<{ code: string; statement: string }>;
};

export function productConstitutionV1Hash(constitution: ProductConstitutionV1HashInput): string {
  return canonicalHash(constitution);
}

export const productConstitutionV1Schema = z.object({
  schemaVersion: z.literal(1),
  constitutionId: idSchema,
  constitutionHash: hashSchema,
  version: z.literal(1),
  rules: z.array(productConstitutionRuleV1Schema).min(1).max(32),
}).strict().superRefine((constitution, context) => {
  if (!unique(constitution.rules.map((rule) => rule.code))) {
    context.addIssue({ code: "custom", path: ["rules"], message: "product constitution rule codes must be unique" });
  }
  const { schemaVersion: _schemaVersion, constitutionHash: _constitutionHash, ...semantic } = constitution;
  if (constitution.constitutionHash !== productConstitutionV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["constitutionHash"], message: "product constitution hash must match canonical content" });
  }
});

export const PROJECT_AGENT_PRODUCT_CONSTITUTION_V1 = productConstitutionV1Schema.parse((() => {
  const semantic: ProductConstitutionV1HashInput = {
    constitutionId: "constitution:codex-cut-project-agent:v1",
    version: 1,
    rules: [
      { code: "ONE_LOGICAL_AGENT_PER_PROJECT", statement: "一个项目只有一个贯穿粗剪到导出的逻辑 Agent。" },
      { code: "MODEL_TURNS_ARE_DISPOSABLE", statement: "模型回合是一次性计算，不是项目身份或项目记忆。" },
      { code: "AI_DIRECTS_HOST_GUARDS", statement: "AI 负责语义判断和创作选择；宿主负责真值、边界和失败关闭。" },
      { code: "HOST_OWNS_GEOMETRY_AND_BINDING", statement: "时间、帧、source range、clip、TimeMap、hash 与 revision 只能由宿主推导。" },
      { code: "STABLE_REFS_NOT_PAYLOAD_COPIES", statement: "下游只引用上游稳定 ID 和 hash，不复制或重新决定上游语义。" },
      { code: "ATOMIC_VALIDATION_BEFORE_PERSIST", statement: "模型批次必须先由宿主完整原子校验，再形成版本化工件。" },
      { code: "DELTA_INVALIDATION", statement: "基础变化只失效受影响段落及其必要下游，不重做无关内容。" },
      { code: "NO_DIRECT_MODEL_PROJECT_WRITES", statement: "模型不得直接写 Timeline V2、ProgramSpine、项目文件、operation 或 transaction。" },
      { code: "DESIGN_SCENE_BEFORE_COMPONENT", statement: "先确定信息关系、组合画面、段内状态、包装对象与动效理由，再进入组件实现。" },
      { code: "REAL_SOURCE_REMAINS_CLEAN", statement: "人物、录屏、实拍和证据素材保持内容真实；包装只能作用于设计对象或其容器。" },
      { code: "ONE_RELATION_ONE_FOCUS", statement: "每个视觉段落只有一个主信息关系，每个语义状态只有一个注意中心。" },
    ],
  };
  return { schemaVersion: 1 as const, ...semantic, constitutionHash: productConstitutionV1Hash(semantic) };
})());

export const projectAgentInvalidationReasonV1Schema = z.enum([
  "FOUNDATION_CHANGED",
  "PARAGRAPH_CHANGED",
  "PARAGRAPH_REMOVED",
  "STRUCTURE_CHANGED",
  "REQUIREMENT_STALE",
  "BINDING_STALE",
  "CONFIRMATION_EXPIRED",
  "MATERIALS_UNRESOLVED",
  "SOURCE_UNAVAILABLE",
  "LAYOUT_CHANGED",
]);

export const projectAgentInvalidationDeltaV1Schema = z.object({
  deltaId: idSchema,
  sourceRefId: idSchema,
  targetRefId: idSchema,
  reasonCodes: z.array(projectAgentInvalidationReasonV1Schema).min(1).max(16),
  affectedParagraphIds: z.array(idSchema).max(512),
  invalidatedDownstreamRefIds: z.array(idSchema).max(64),
}).strict().superRefine((delta, context) => {
  for (const [path, values] of [
    ["reasonCodes", delta.reasonCodes],
    ["affectedParagraphIds", delta.affectedParagraphIds],
    ["invalidatedDownstreamRefIds", delta.invalidatedDownstreamRefIds],
  ] as const) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [path], message: `${path} must be unique` });
  }
});

export const projectAgentArtifactSourceSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  identity: z.object({
    documentId: idSchema,
    projectId: idSchema,
    timelineId: idSchema,
    revision: z.number().int().nonnegative(),
    timelineHash: hashSchema,
    projectName: z.string().trim().min(1).max(256),
    updatedAt: instantSchema,
    canvas: z.object({
      width: z.number().int().positive().max(16_384),
      height: z.number().int().positive().max(16_384),
      framesPerSecond: z.number().positive().max(1_000),
      durationFrames: z.number().int().positive(),
    }).strict(),
  }).strict(),
  artifacts: z.array(projectAgentArtifactRefV1Schema).min(1).max(64),
  invalidationDeltas: z.array(projectAgentInvalidationDeltaV1Schema).max(32),
  readiness: z.object({
    roughCutAvailable: z.boolean(),
    visualParagraphAvailable: z.boolean(),
    visualParagraphReviewed: z.boolean(),
    visualRolePlanAvailable: z.boolean(),
    unresolvedMaterialRequirementIds: z.array(idSchema).max(1_536),
    pendingVisualRoleProposalIds: z.array(idSchema).max(128),
    visualRoleReviewed: z.boolean(),
    layoutPlanAvailable: z.boolean(),
    layoutReviewed: z.boolean(),
    blockedReasonCodes: z.array(idSchema).max(64),
  }).strict(),
}).strict().superRefine((snapshot, context) => {
  if (!unique(snapshot.artifacts.map((artifact) => artifact.refId))) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "artifact refs must be unique" });
  }
  if (!unique(snapshot.artifacts.map((artifact) => artifact.kind))) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "artifact kinds must be unique" });
  }
  const artifactByKind = new Map(snapshot.artifacts.map((artifact) => [artifact.kind, artifact]));
  const missingKinds = projectAgentArtifactKindV1Schema.options.filter((kind) => !artifactByKind.has(kind));
  if (missingKinds.length > 0) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: `artifact catalog is incomplete: ${missingKinds.join(",")}` });
  }
  const hasArtifact = (kind: z.infer<typeof projectAgentArtifactKindV1Schema>) =>
    artifactByKind.get(kind)?.artifactId !== null && artifactByKind.get(kind)?.artifactId !== undefined;
  if (snapshot.readiness.roughCutAvailable && ![
    "ROUGH_CUT_FOUNDATION",
    "MASTER_TRANSCRIPT",
    "TIME_MAP",
    "TRANSCRIPT_PROJECTION",
  ].every((kind) => hasArtifact(kind as z.infer<typeof projectAgentArtifactKindV1Schema>))) {
    context.addIssue({ code: "custom", path: ["readiness", "roughCutAvailable"], message: "rough-cut readiness requires every exact foundation ref" });
  }
  if (snapshot.readiness.visualParagraphAvailable && !hasArtifact("VISUAL_PARAGRAPH_PROPOSAL")) {
    context.addIssue({ code: "custom", path: ["readiness", "visualParagraphAvailable"], message: "visual-paragraph readiness requires a current proposal ref" });
  }
  if (snapshot.readiness.visualParagraphReviewed
    && (!snapshot.readiness.visualParagraphAvailable || artifactByKind.get("VISUAL_PARAGRAPH_REVIEW")?.status !== "CONFIRMED")) {
    context.addIssue({ code: "custom", path: ["readiness", "visualParagraphReviewed"], message: "visual-paragraph review requires a current proposal and confirmed review ref" });
  }
  if (snapshot.readiness.visualRolePlanAvailable && ![
    "VISUAL_ROLE_STRUCTURE",
    "MATERIAL_MANIFEST",
    "VISUAL_ROLE_PLAN",
  ].every((kind) => hasArtifact(kind as z.infer<typeof projectAgentArtifactKindV1Schema>))) {
    context.addIssue({ code: "custom", path: ["readiness", "visualRolePlanAvailable"], message: "visual-role readiness requires structure, manifest and plan refs" });
  }
  if (snapshot.readiness.visualRoleReviewed && (
    !snapshot.readiness.visualRolePlanAvailable
    || snapshot.readiness.unresolvedMaterialRequirementIds.length > 0
    || snapshot.readiness.pendingVisualRoleProposalIds.length > 0
    || artifactByKind.get("VISUAL_ROLE_REVIEW")?.status !== "CONFIRMED"
  )) {
    context.addIssue({ code: "custom", path: ["readiness", "visualRoleReviewed"], message: "visual-role review requires one fully resolved confirmed plan" });
  }
  if (snapshot.readiness.layoutPlanAvailable && ![
    "LAYOUT_FOUNDATION",
    "LAYOUT_PLAN",
  ].every((kind) => hasArtifact(kind as z.infer<typeof projectAgentArtifactKindV1Schema>))) {
    context.addIssue({ code: "custom", path: ["readiness", "layoutPlanAvailable"], message: "layout readiness requires exact foundation and plan refs" });
  }
  if (snapshot.readiness.layoutReviewed && (
    !snapshot.readiness.layoutPlanAvailable
    || artifactByKind.get("LAYOUT_REVIEW")?.status !== "CONFIRMED"
  )) {
    context.addIssue({ code: "custom", path: ["readiness", "layoutReviewed"], message: "layout review requires one confirmed current layout plan" });
  }
  if (!unique(snapshot.invalidationDeltas.map((delta) => delta.deltaId))) {
    context.addIssue({ code: "custom", path: ["invalidationDeltas"], message: "invalidation delta ids must be unique" });
  }
  const refIds = new Set(snapshot.artifacts.map((artifact) => artifact.refId));
  if (snapshot.invalidationDeltas.some((delta) =>
    delta.sourceRefId === delta.targetRefId
    || !refIds.has(delta.sourceRefId)
    || !refIds.has(delta.targetRefId)
    || delta.invalidatedDownstreamRefIds.some((refId) => !refIds.has(refId)))) {
    context.addIssue({ code: "custom", path: ["invalidationDeltas"], message: "invalidation deltas must reference distinct known artifact refs" });
  }
  for (const [path, values] of [
    ["unresolvedMaterialRequirementIds", snapshot.readiness.unresolvedMaterialRequirementIds],
    ["pendingVisualRoleProposalIds", snapshot.readiness.pendingVisualRoleProposalIds],
    ["blockedReasonCodes", snapshot.readiness.blockedReasonCodes],
  ] as const) {
    if (!unique(values)) context.addIssue({ code: "custom", path: ["readiness", path], message: `${path} must be unique` });
  }
});

export const projectAgentDependencyNodeV1Schema = z.object({
  nodeId: idSchema,
  artifactRefId: idSchema,
  artifactRefHash: hashSchema,
  state: projectAgentArtifactStatusV1Schema,
}).strict();

export const projectAgentDependencyEdgeV1Schema = z.object({
  edgeId: idSchema,
  sourceNodeId: idSchema,
  targetNodeId: idSchema,
  state: z.enum(["CURRENT", "MISSING", "STALE", "BLOCKED", "PARTIAL_REVIEW_REQUIRED"]),
  reasonCodes: z.array(projectAgentInvalidationReasonV1Schema).max(16),
  affectedParagraphIds: z.array(idSchema).max(512),
}).strict().superRefine((edge, context) => {
  if (!unique(edge.reasonCodes) || !unique(edge.affectedParagraphIds)) {
    context.addIssue({ code: "custom", path: [], message: "dependency edge reasons and paragraphs must be unique" });
  }
});

export type ProjectAgentDependencyGraphV1HashInput = {
  graphId: string;
  nodes: z.infer<typeof projectAgentDependencyNodeV1Schema>[];
  edges: z.infer<typeof projectAgentDependencyEdgeV1Schema>[];
};

export function projectAgentDependencyGraphV1Hash(graph: ProjectAgentDependencyGraphV1HashInput): string {
  return canonicalHash(graph);
}

export const projectAgentDependencyGraphV1Schema = z.object({
  schemaVersion: z.literal(1),
  graphId: idSchema,
  graphHash: hashSchema,
  nodes: z.array(projectAgentDependencyNodeV1Schema).min(1).max(64),
  edges: z.array(projectAgentDependencyEdgeV1Schema).max(128),
}).strict().superRefine((graph, context) => {
  const nodeIds = graph.nodes.map((node) => node.nodeId);
  if (!unique(nodeIds) || !unique(graph.edges.map((edge) => edge.edgeId))) {
    context.addIssue({ code: "custom", path: [], message: "dependency graph identities must be unique" });
  }
  const known = new Set(nodeIds);
  if (graph.edges.some((edge) => !known.has(edge.sourceNodeId) || !known.has(edge.targetNodeId))) {
    context.addIssue({ code: "custom", path: ["edges"], message: "dependency edges must reference existing nodes" });
  }
  const { schemaVersion: _schemaVersion, graphHash: _graphHash, ...semantic } = graph;
  if (graph.graphHash !== projectAgentDependencyGraphV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["graphHash"], message: "dependency graph hash must match canonical content" });
  }
});

export const projectAgentPermissionV1Schema = z.enum([
  "READ_PROJECT_CONTEXT",
  "READ_MASTER_TRANSCRIPT",
  "READ_MATERIAL_MANIFEST",
  "PROPOSE_ROUGH_CUT",
  "PROPOSE_VISUAL_PARAGRAPHS",
  "PROPOSE_VISUAL_ROLES",
  "REQUEST_MATERIAL",
  "PROPOSE_LAYOUT",
  "PROPOSE_SCENE_DIRECTION",
  "PROPOSE_PACKAGING_TARGET",
  "PROPOSE_MOTION",
  "REQUEST_CONFIRMATION",
  "DERIVE_TIME_GEOMETRY",
  "VALIDATE_ATOMIC_BATCH",
  "PERSIST_VERSIONED_ARTIFACT",
  "APPLY_CONFIRMED_TIMELINE_TRANSACTION",
  "DIRECT_TIMELINE_WRITE",
  "PROGRAM_SPINE_WRITE",
  "PROJECT_FILE_WRITE",
  "ARBITRARY_OPERATION",
  "ARBITRARY_TRANSACTION",
]);

export const projectAgentStagePermissionsV1Schema = z.object({
  modelAllowed: z.array(projectAgentPermissionV1Schema).max(16),
  hostOnly: z.array(projectAgentPermissionV1Schema).max(16),
  denied: z.array(projectAgentPermissionV1Schema).max(16),
}).strict().superRefine((permissions, context) => {
  for (const [path, values] of Object.entries(permissions)) {
    if (!unique(values)) context.addIssue({ code: "custom", path: [path], message: `${path} permissions must be unique` });
  }
  const model = new Set(permissions.modelAllowed);
  const host = new Set(permissions.hostOnly);
  const denied = new Set(permissions.denied);
  if (permissions.modelAllowed.some((permission) => host.has(permission) || denied.has(permission))
    || permissions.hostOnly.some((permission) => denied.has(permission))) {
    context.addIssue({ code: "custom", path: [], message: "permission classes must be disjoint" });
  }
  for (const permission of [
    "DIRECT_TIMELINE_WRITE",
    "PROGRAM_SPINE_WRITE",
    "PROJECT_FILE_WRITE",
    "ARBITRARY_OPERATION",
    "ARBITRARY_TRANSACTION",
  ] as const) {
    if (!denied.has(permission) || model.has(permission)) {
      context.addIssue({ code: "custom", path: ["denied"], message: `${permission} must always be denied to the model` });
    }
  }
});

export const projectAgentIdentityV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectAgentId: idSchema,
  projectId: idSchema,
  createdAt: instantSchema,
}).strict();

export const projectAgentPersistentStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  identity: projectAgentIdentityV1Schema,
  projectConstitution: projectConstitutionV1Schema,
  decisionLedger: z.array(projectAgentDecisionLedgerEntryV1Schema).max(4_096),
  updatedAt: instantSchema,
}).strict().superRefine((state, context) => {
  if (state.projectConstitution.projectAgentId !== state.identity.projectAgentId
    || state.projectConstitution.projectId !== state.identity.projectId
    || state.decisionLedger.some((decision) => decision.projectAgentId !== state.identity.projectAgentId)) {
    context.addIssue({ code: "custom", path: [], message: "project Agent state cannot cross project identity" });
  }
  if (!unique(state.decisionLedger.map((decision) => decision.decisionId))) {
    context.addIssue({ code: "custom", path: ["decisionLedger"], message: "decision ids must be unique" });
  }
});

export const projectAgentContextSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  identity: projectAgentIdentityV1Schema,
  hostIdentity: projectAgentArtifactSourceSnapshotV1Schema.shape.identity,
  productConstitution: productConstitutionV1Schema,
  projectConstitution: projectConstitutionV1Schema,
  currentGate: projectAgentGateV1Schema,
  artifacts: z.array(projectAgentArtifactRefV1Schema).min(1).max(64),
  decisionLedger: z.array(projectAgentDecisionLedgerEntryV1Schema).max(4_096),
  dependencyGraph: projectAgentDependencyGraphV1Schema,
  timelineModified: z.literal(false),
}).strict();

export type ProjectContextPackV1HashInput = {
  packId: string;
  projectAgentId: string;
  stage: z.infer<typeof projectAgentStageV1Schema>;
  generatedAt: string;
  hostIdentity: z.infer<typeof projectAgentArtifactSourceSnapshotV1Schema>["identity"];
  productConstitution: z.infer<typeof productConstitutionV1Schema>;
  projectConstitution: z.infer<typeof projectConstitutionV1Schema>;
  currentGate: z.infer<typeof projectAgentGateV1Schema>;
  artifacts: z.infer<typeof projectAgentArtifactRefV1Schema>[];
  decisionLedger: z.infer<typeof projectAgentDecisionLedgerEntryV1Schema>[];
  dependencyGraph: z.infer<typeof projectAgentDependencyGraphV1Schema>;
  permissions: z.infer<typeof projectAgentStagePermissionsV1Schema>;
  notices: string[];
};

export function projectContextPackV1Hash(pack: ProjectContextPackV1HashInput): string {
  return canonicalHash(pack);
}

export const projectContextPackV1Schema = z.object({
  schemaVersion: z.literal(1),
  packId: idSchema,
  packHash: hashSchema,
  projectAgentId: idSchema,
  stage: projectAgentStageV1Schema,
  generatedAt: instantSchema,
  hostIdentity: projectAgentArtifactSourceSnapshotV1Schema.shape.identity,
  productConstitution: productConstitutionV1Schema,
  projectConstitution: projectConstitutionV1Schema,
  currentGate: projectAgentGateV1Schema,
  artifacts: z.array(projectAgentArtifactRefV1Schema).min(1).max(64),
  decisionLedger: z.array(projectAgentDecisionLedgerEntryV1Schema).max(4_096),
  dependencyGraph: projectAgentDependencyGraphV1Schema,
  permissions: projectAgentStagePermissionsV1Schema,
  notices: z.array(compactTextSchema).max(64),
  timelineModified: z.literal(false),
}).strict().superRefine((pack, context) => {
  const { schemaVersion: _schemaVersion, packHash: _packHash, timelineModified: _timelineModified, ...semantic } = pack;
  if (pack.packHash !== projectContextPackV1Hash(semantic)) {
    context.addIssue({ code: "custom", path: ["packHash"], message: "context pack hash must match canonical content" });
  }
});

export const updateProjectConstitutionV1RequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  confirmedByUser: z.literal(true),
  objective: compactTextSchema.nullable(),
  audience: compactTextSchema.nullable(),
  deliveryIntent: compactTextSchema.nullable(),
  stylePrinciples: z.array(compactTextSchema).max(64),
  prohibitedDirections: z.array(compactTextSchema).max(64),
  updatedAt: instantSchema,
}).strict();

export const recordProjectAgentDecisionV1RequestSchema = z.object({
  decisionId: idSchema,
  provenance: projectAgentDecisionProvenanceV1Schema,
  status: projectAgentDecisionStatusV1Schema,
  stage: projectAgentStageV1Schema,
  summary: compactTextSchema,
  paragraphIds: z.array(idSchema).max(512),
  evidenceRefs: z.array(projectAgentEvidenceRefV1Schema).max(64),
  supersedesDecisionId: idSchema.nullable(),
  recordedAt: instantSchema,
  confirmedAt: instantSchema.nullable(),
}).strict();

export const getProjectContextPackV1RequestSchema = z.object({
  stage: projectAgentStageV1Schema,
}).strict();

export type ProjectAgentStageV1 = z.infer<typeof projectAgentStageV1Schema>;
export type ProjectAgentArtifactKindV1 = z.infer<typeof projectAgentArtifactKindV1Schema>;
export type ProjectAgentArtifactRefV1 = z.infer<typeof projectAgentArtifactRefV1Schema>;
export type ProjectAgentDecisionLedgerEntryV1 = z.infer<typeof projectAgentDecisionLedgerEntryV1Schema>;
export type ProjectConstitutionV1 = z.infer<typeof projectConstitutionV1Schema>;
export type ProjectAgentArtifactSourceSnapshotV1 = z.infer<typeof projectAgentArtifactSourceSnapshotV1Schema>;
export type ProjectAgentDependencyGraphV1 = z.infer<typeof projectAgentDependencyGraphV1Schema>;
export type ProjectAgentPersistentStateV1 = z.infer<typeof projectAgentPersistentStateV1Schema>;
export type ProjectAgentContextSnapshotV1 = z.infer<typeof projectAgentContextSnapshotV1Schema>;
export type ProjectContextPackV1 = z.infer<typeof projectContextPackV1Schema>;
export type UpdateProjectConstitutionV1Request = z.infer<typeof updateProjectConstitutionV1RequestSchema>;
export type RecordProjectAgentDecisionV1Request = z.infer<typeof recordProjectAgentDecisionV1RequestSchema>;
