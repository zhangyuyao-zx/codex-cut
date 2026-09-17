import { z } from "zod";
import {
  agentContextEnvelopeSchema,
  readToolNameSchema,
  selectionSummarySchema,
} from "../server/agent-core/contracts.js";
import {
  timelineOperationV1Schema,
  timelineTransactionV1Schema,
} from "../shared/timeline-v2/transaction-schema.js";
import { editorActionSchema } from "./editor-contract.js";

export const agentV2IdSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9:._-]+$/u);
export const agentV2InstantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u);
export const agentV2RevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/u);

export const agentPermissionSchema = z.enum(["READ", "PROPOSAL", "CONFIRMED_WRITE"]);

export const credentialRefSchema = z.object({
  providerId: agentV2IdSchema,
  service: agentV2IdSchema,
  account: agentV2IdSchema,
}).strict();

export const providerModelSchema = z.object({
  modelId: agentV2IdSchema,
  label: z.string().min(1).max(128),
  contextWindow: z.number().int().positive(),
}).strict();

export const providerCapabilitiesSchema = z.object({
  streaming: z.literal(true),
  toolCalls: z.literal(true),
  cancellation: z.literal(true),
  timeout: z.literal(true),
  credentialRequired: z.boolean(),
  networkAccess: z.boolean(),
  paid: z.boolean(),
}).strict();

export const providerDescriptorSchema = z.object({
  providerId: agentV2IdSchema,
  label: z.string().min(1).max(128),
  adapterKind: z.enum(["local_deterministic", "dsh"]),
  runtimeId: agentV2IdSchema,
  runtimeVersion: z.string().min(1).max(128),
  models: z.array(providerModelSchema).min(1).max(64),
  capabilities: providerCapabilitiesSchema,
  enabled: z.boolean(),
  evidenceMode: z.enum(["offline_non_billing", "credentialed_live"]),
}).strict();

export type ProviderDescriptor = z.infer<typeof providerDescriptorSchema>;

export const providerErrorClassSchema = z.enum([
  "cancelled",
  "timeout",
  "authentication",
  "rate_limit",
  "network",
  "protocol",
  "provider",
]);

export const patchIntentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move_selected_clip"),
    deltaFrames: z.number().int().min(-10_000).max(10_000).refine((value) => value !== 0),
    ripple: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal("trim_selected_clip"),
    edge: z.enum(["start", "end"]),
    deltaFrames: z.number().int().min(-10_000).max(10_000).refine((value) => value !== 0),
  }).strict(),
  z.object({
    type: z.literal("set_selected_lane_state"),
    field: z.enum(["locked", "hidden", "muted"]),
    value: z.boolean(),
  }).strict(),
]).describe("Closed-world Agent intent; the Gateway resolves entities and compiles a Phase 5 editor action");

export type PatchIntent = z.infer<typeof patchIntentSchema>;

export const phase6ToolNameSchema = z.union([
  readToolNameSchema,
  z.enum([
    "timeline_create_patch_proposal",
    "timeline_apply_confirmed_transaction",
    "timeline_undo",
    "timeline_redo",
    "proposal_reject",
  ]),
]);

export type Phase6ToolName = z.infer<typeof phase6ToolNameSchema>;

export const providerTurnInputSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: agentV2IdSchema,
  turnId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  revision: agentV2RevisionSchema,
  providerId: agentV2IdSchema,
  modelId: agentV2IdSchema,
  message: z.string().trim().min(1).max(65_536),
  contexts: z.array(agentContextEnvelopeSchema).min(1).max(16),
}).strict();

export type ProviderTurnInput = z.infer<typeof providerTurnInputSchema>;

export const providerStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text_delta"), text: z.string().min(1).max(65_536) }).strict(),
  z.object({
    type: z.literal("tool_call"),
    toolCallId: agentV2IdSchema,
    toolName: phase6ToolNameSchema,
    input: z.unknown(),
  }).strict(),
  z.object({ type: z.literal("completed"), message: z.string().max(262_144) }).strict(),
  z.object({
    type: z.literal("error"),
    code: agentV2IdSchema,
    classification: providerErrorClassSchema,
    message: z.string().min(1).max(4096),
    retryable: z.boolean(),
  }).strict(),
]);

export type ProviderStreamEvent = z.infer<typeof providerStreamEventSchema>;

export const routedProviderEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("provider_selected"),
    sequence: z.number().int().nonnegative(),
    occurredAt: agentV2InstantSchema,
    providerId: agentV2IdSchema,
    modelId: agentV2IdSchema,
  }).strict(),
  z.object({
    type: z.literal("provider_fallback"),
    sequence: z.number().int().nonnegative(),
    occurredAt: agentV2InstantSchema,
    providerId: agentV2IdSchema,
    modelId: agentV2IdSchema,
    fromProviderId: agentV2IdSchema,
    reasonCode: agentV2IdSchema,
  }).strict(),
  z.object({
    type: z.literal("text_delta"),
    sequence: z.number().int().nonnegative(),
    occurredAt: agentV2InstantSchema,
    providerId: agentV2IdSchema,
    modelId: agentV2IdSchema,
    text: z.string().min(1).max(65_536),
  }).strict(),
  z.object({
    type: z.literal("tool_call"),
    sequence: z.number().int().nonnegative(),
    occurredAt: agentV2InstantSchema,
    providerId: agentV2IdSchema,
    modelId: agentV2IdSchema,
    toolCallId: agentV2IdSchema,
    toolName: phase6ToolNameSchema,
    input: z.unknown(),
  }).strict(),
  z.object({
    type: z.literal("tool_result"),
    sequence: z.number().int().nonnegative(),
    occurredAt: agentV2InstantSchema,
    providerId: agentV2IdSchema,
    modelId: agentV2IdSchema,
    toolCallId: agentV2IdSchema,
    toolName: phase6ToolNameSchema,
    result: z.unknown(),
  }).strict(),
  z.object({
    type: z.literal("completed"),
    sequence: z.number().int().nonnegative(),
    occurredAt: agentV2InstantSchema,
    providerId: agentV2IdSchema,
    modelId: agentV2IdSchema,
    message: z.string().max(262_144),
  }).strict(),
  z.object({
    type: z.literal("error"),
    sequence: z.number().int().nonnegative(),
    occurredAt: agentV2InstantSchema,
    providerId: agentV2IdSchema,
    modelId: agentV2IdSchema,
    code: agentV2IdSchema,
    classification: providerErrorClassSchema,
    message: z.string().min(1).max(4096),
    retryable: z.boolean(),
  }).strict(),
]);

export type RoutedProviderEvent = z.infer<typeof routedProviderEventSchema>;

export const agentSessionV2Schema = z.object({
  schemaVersion: z.literal(1),
  sessionId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  currentRevision: agentV2RevisionSchema,
  providerId: agentV2IdSchema,
  modelId: agentV2IdSchema,
  runtimeId: agentV2IdSchema,
  runtimeVersion: z.string().min(1).max(128),
  selection: selectionSummarySchema,
  permissionGrants: z.array(agentPermissionSchema).min(1).max(3),
  state: z.enum(["active", "closed"]),
  createdAt: agentV2InstantSchema,
  lastActiveAt: agentV2InstantSchema,
  resumableStateRef: z.string().min(1).max(1024),
}).strict().superRefine((value, context) => {
  if (new Set(value.permissionGrants).size !== value.permissionGrants.length) {
    context.addIssue({ code: "custom", path: ["permissionGrants"], message: "Permission grants must be unique" });
  }
});

export type AgentSessionV2 = z.infer<typeof agentSessionV2Schema>;

const impactedRangeSchema = z.object({
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
}).strict().refine((range) => range.endFrame > range.startFrame, "Impact range must be non-empty");

export const proposalPreviewSchema = z.object({
  beforeDocumentHash: hashSchema,
  afterDocumentHash: hashSchema,
  baseRevision: agentV2RevisionSchema,
  predictedRevision: z.number().int().positive(),
  operationCount: z.number().int().positive(),
  affectedEntityIds: z.array(agentV2IdSchema).max(4096),
  ranges: z.array(impactedRangeSchema).max(4096),
  warnings: z.array(z.string().min(1).max(1024)).max(128),
}).strict();

export const proposalExecutionSchema = z.object({
  applicationId: agentV2IdSchema,
  confirmedAt: agentV2InstantSchema,
  transaction: timelineTransactionV1Schema,
  commit: z.object({
    revision: z.number().int().positive(),
    documentHash: hashSchema,
    transactionId: agentV2IdSchema,
    idempotent: z.boolean(),
  }).strict().nullable(),
}).strict();

export const timelinePatchProposalSchema = z.object({
  schemaVersion: z.literal(1),
  proposalId: agentV2IdSchema,
  sessionId: agentV2IdSchema,
  turnId: agentV2IdSchema,
  toolCallId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  baseRevision: agentV2RevisionSchema,
  status: z.enum(["pending", "applying", "applied", "rejected", "conflicted"]),
  intent: patchIntentSchema,
  action: editorActionSchema,
  operations: z.array(timelineOperationV1Schema).min(1).max(256),
  summary: z.string().min(1).max(2048),
  rationale: z.string().min(1).max(4096),
  riskClass: z.enum(["low", "medium", "high"]),
  preview: proposalPreviewSchema,
  proposalHash: hashSchema,
  createdAt: agentV2InstantSchema,
  execution: proposalExecutionSchema.nullable(),
  conflictCode: agentV2IdSchema.nullable(),
}).strict().superRefine((value, context) => {
  if ((value.status === "applying" || value.status === "applied") && value.execution === null) {
    context.addIssue({ code: "custom", path: ["execution"], message: "Applying or applied proposal requires execution state" });
  }
  if (value.status === "applied" && value.execution?.commit === null) {
    context.addIssue({ code: "custom", path: ["execution", "commit"], message: "Applied proposal requires commit evidence" });
  }
  if (value.status === "conflicted" && value.conflictCode === null) {
    context.addIssue({ code: "custom", path: ["conflictCode"], message: "Conflicted proposal requires a stable code" });
  }
});

export type TimelinePatchProposal = z.infer<typeof timelinePatchProposalSchema>;

export const agentTurnRecordSchema = z.object({
  schemaVersion: z.literal(1),
  turnId: agentV2IdSchema,
  sessionId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  revision: agentV2RevisionSchema,
  message: z.string().min(1).max(65_536),
  response: z.string().max(262_144),
  status: z.enum(["completed", "failed", "cancelled", "interrupted"]),
  providerId: agentV2IdSchema,
  modelId: agentV2IdSchema,
  events: z.array(routedProviderEventSchema).max(2048),
  proposalId: agentV2IdSchema.nullable(),
  createdAt: agentV2InstantSchema,
  completedAt: agentV2InstantSchema,
}).strict();

export type AgentTurnRecord = z.infer<typeof agentTurnRecordSchema>;

export const agentAuditEventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: agentV2IdSchema,
  kind: z.enum([
    "session_started",
    "session_resumed",
    "session_revision_refreshed",
    "turn_completed",
    "turn_failed",
    "read_tool_invoked",
    "proposal_created",
    "proposal_confirmed",
    "proposal_rejected",
    "transaction_applied",
    "transaction_conflicted",
    "timeline_undo",
    "timeline_redo",
  ]),
  occurredAt: agentV2InstantSchema,
  sessionId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  revision: agentV2RevisionSchema,
  turnId: agentV2IdSchema.nullable(),
  toolName: phase6ToolNameSchema.nullable(),
  proposalId: agentV2IdSchema.nullable(),
  transactionId: agentV2IdSchema.nullable(),
  result: z.enum(["accepted", "completed", "rejected", "conflicted", "failed"]),
  code: agentV2IdSchema.nullable(),
}).strict();

export type AgentAuditEvent = z.infer<typeof agentAuditEventSchema>;

export const agentPersistentStateSchema = z.object({
  schemaVersion: z.literal(1),
  sessions: z.array(agentSessionV2Schema).max(256),
  turns: z.array(agentTurnRecordSchema).max(4096),
  proposals: z.array(timelinePatchProposalSchema).max(4096),
  audit: z.array(agentAuditEventSchema).max(16_384),
}).strict();

export type AgentPersistentState = z.infer<typeof agentPersistentStateSchema>;

export const startAgentSessionRequestSchema = z.object({
  sessionId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  currentRevision: agentV2RevisionSchema,
  providerId: agentV2IdSchema,
  modelId: agentV2IdSchema,
  selection: selectionSummarySchema,
}).strict();

export const resumeAgentSessionRequestSchema = z.object({
  sessionId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  currentRevision: agentV2RevisionSchema,
}).strict();

export const refreshAgentSessionRequestSchema = z.object({
  sessionId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  currentRevision: agentV2RevisionSchema,
  selection: selectionSummarySchema,
}).strict();

export const sendAgentTurnRequestSchema = z.object({
  sessionId: agentV2IdSchema,
  turnId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  expectedRevision: agentV2RevisionSchema,
  message: z.string().trim().min(1).max(65_536),
}).strict();

export const applyAgentProposalRequestSchema = z.object({
  sessionId: agentV2IdSchema,
  proposalId: agentV2IdSchema,
  applicationId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  expectedRevision: agentV2RevisionSchema,
  confirmed: z.literal(true),
  confirmedAt: agentV2InstantSchema,
}).strict();

export const rejectAgentProposalRequestSchema = z.object({
  sessionId: agentV2IdSchema,
  proposalId: agentV2IdSchema,
  rejectionId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  expectedRevision: agentV2RevisionSchema,
  rejectedAt: agentV2InstantSchema,
}).strict();

export const agentHistoryRequestSchema = z.object({
  sessionId: agentV2IdSchema,
  actionId: agentV2IdSchema,
  projectId: agentV2IdSchema,
  timelineId: agentV2IdSchema,
  expectedRevision: agentV2RevisionSchema,
  createdAt: agentV2InstantSchema,
}).strict();

export const agentSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  providers: z.array(providerDescriptorSchema).min(2),
  session: agentSessionV2Schema.nullable(),
  turns: z.array(agentTurnRecordSchema),
  proposals: z.array(timelinePatchProposalSchema),
  auditCount: z.number().int().nonnegative(),
  registeredReadTools: z.array(readToolNameSchema),
  registeredWriteTools: z.tuple([
    z.literal("timeline_create_patch_proposal"),
    z.literal("timeline_apply_confirmed_transaction"),
    z.literal("timeline_undo"),
    z.literal("timeline_redo"),
    z.literal("proposal_reject"),
  ]),
}).strict();

export type AgentSnapshot = z.infer<typeof agentSnapshotSchema>;
export type StartAgentSessionRequest = z.infer<typeof startAgentSessionRequestSchema>;
export type ResumeAgentSessionRequest = z.infer<typeof resumeAgentSessionRequestSchema>;
export type RefreshAgentSessionRequest = z.infer<typeof refreshAgentSessionRequestSchema>;
export type SendAgentTurnRequest = z.infer<typeof sendAgentTurnRequestSchema>;
export type ApplyAgentProposalRequest = z.infer<typeof applyAgentProposalRequestSchema>;
export type RejectAgentProposalRequest = z.infer<typeof rejectAgentProposalRequestSchema>;
export type AgentHistoryRequest = z.infer<typeof agentHistoryRequestSchema>;
