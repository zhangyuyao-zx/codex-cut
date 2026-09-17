import { z } from "zod";

const identifierPattern = /^[^\u0000-\u001f\u007f]+$/u;

export const agentIdentifierSchema = z.string().min(1).max(256).regex(identifierPattern);
export const agentTimestampSchema = z.string().datetime({ offset: true });
export const agentRevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const readToolNameSchema = z.enum([
  "project_get_summary",
  "timeline_get_state",
  "timeline_get_selection",
  "transcript_get_segment",
  "semantic_get_beats",
  "assets_get_summary",
  "render_get_status",
]);

export type ReadToolName = z.infer<typeof readToolNameSchema>;

export const contextKindSchema = z.enum([
  "project_summary",
  "timeline_state",
  "timeline_selection",
  "transcript_segment",
  "semantic_beats",
  "asset_summary",
  "render_status",
]);

export type AgentContextKind = z.infer<typeof contextKindSchema>;

export const selectionSummarySchema = z.object({
  selectedLaneIds: z.array(agentIdentifierSchema).max(256),
  selectedClipIds: z.array(agentIdentifierSchema).max(2048),
  selectedPackagingGroupIds: z.array(agentIdentifierSchema).max(256),
  range: z.object({
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
  }).strict().nullable(),
  truncated: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.range !== null && value.range.endFrame <= value.range.startFrame) {
    context.addIssue({
      code: "custom",
      path: ["range", "endFrame"],
      message: "Selection range must be a non-empty half-open interval",
    });
  }
});

export type AgentSelectionSummary = z.infer<typeof selectionSummarySchema>;

export const contextTruncationSchema = z.object({
  truncated: z.boolean(),
  reason: z.string().min(1).max(512).nullable(),
  originalItemCount: z.number().int().nonnegative().nullable(),
  returnedItemCount: z.number().int().nonnegative().nullable(),
}).strict().superRefine((value, context) => {
  if (!value.truncated && value.reason !== null) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Untruncated context cannot have a truncation reason" });
  }
  if (value.originalItemCount !== null && value.returnedItemCount !== null && value.returnedItemCount > value.originalItemCount) {
    context.addIssue({ code: "custom", path: ["returnedItemCount"], message: "Returned items cannot exceed original items" });
  }
});

export const agentContextEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  kind: contextKindSchema,
  projectId: agentIdentifierSchema,
  timelineId: agentIdentifierSchema,
  revision: agentRevisionSchema,
  source: z.string().min(1).max(512),
  generatedAt: agentTimestampSchema,
  truncation: contextTruncationSchema,
  data: z.unknown(),
}).strict();

export type AgentContextEnvelope = z.infer<typeof agentContextEnvelopeSchema>;

export const agentRuntimeCapabilitiesSchema = z.object({
  eventStream: z.literal(true),
  cancel: z.enum(["turn", "process", "none"]),
  resume: z.enum(["durable", "live_session", "none"]),
  close: z.enum(["session", "process", "none"]),
  readTools: z.boolean(),
  writeTools: z.literal(false),
}).strict();

export type AgentRuntimeCapabilities = z.infer<typeof agentRuntimeCapabilitiesSchema>;

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const startAgentSessionInputSchema = z.object({
  schemaVersion: z.literal(1),
  requestedSessionId: agentIdentifierSchema.nullable(),
  projectId: agentIdentifierSchema,
  timelineId: agentIdentifierSchema,
  currentRevision: agentRevisionSchema,
  providerId: agentIdentifierSchema,
  modelId: agentIdentifierSchema,
  selection: selectionSummarySchema,
  permissionGrants: z.array(readToolNameSchema).max(readToolNameSchema.options.length),
}).strict().superRefine((value, context) => {
  if (!uniqueValues(value.permissionGrants)) {
    context.addIssue({ code: "custom", path: ["permissionGrants"], message: "Permission grants must be unique" });
  }
});

export type StartAgentSessionInput = z.infer<typeof startAgentSessionInputSchema>;

export const agentSessionHandleSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: agentIdentifierSchema,
  projectId: agentIdentifierSchema,
  timelineId: agentIdentifierSchema,
  currentRevision: agentRevisionSchema,
  providerId: agentIdentifierSchema,
  modelId: agentIdentifierSchema,
  runtimeId: agentIdentifierSchema,
  runtimeVersion: z.string().min(1).max(128),
  state: z.enum(["active", "closed"]),
  createdAt: agentTimestampSchema,
  lastActiveAt: agentTimestampSchema,
  resumableStateRef: z.string().min(1).max(1024).nullable(),
}).strict();

export type AgentSessionHandle = z.infer<typeof agentSessionHandleSchema>;

export const agentTurnInputSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: agentIdentifierSchema,
  turnId: agentIdentifierSchema,
  projectId: agentIdentifierSchema,
  timelineId: agentIdentifierSchema,
  expectedRevision: agentRevisionSchema,
  message: z.string().trim().min(1).max(65_536),
  contexts: z.array(agentContextEnvelopeSchema).min(1).max(16),
  availableReadTools: z.array(readToolNameSchema).max(readToolNameSchema.options.length),
}).strict().superRefine((value, context) => {
  if (!uniqueValues(value.availableReadTools)) {
    context.addIssue({ code: "custom", path: ["availableReadTools"], message: "Available read tools must be unique" });
  }
  if (!uniqueValues(value.contexts.map((envelope) => envelope.kind))) {
    context.addIssue({ code: "custom", path: ["contexts"], message: "Context kinds must be unique within one turn" });
  }
  for (const [index, envelope] of value.contexts.entries()) {
    if (envelope.projectId !== value.projectId || envelope.timelineId !== value.timelineId || envelope.revision !== value.expectedRevision) {
      context.addIssue({
        code: "custom",
        path: ["contexts", index],
        message: "Every context must match the turn project, timeline, and revision",
      });
    }
  }
});

export type AgentTurnInput = z.infer<typeof agentTurnInputSchema>;

const eventBase = {
  schemaVersion: z.literal(1),
  sessionId: agentIdentifierSchema,
  turnId: agentIdentifierSchema,
  projectId: agentIdentifierSchema,
  timelineId: agentIdentifierSchema,
  revision: agentRevisionSchema,
  sequence: z.number().int().nonnegative(),
  occurredAt: agentTimestampSchema,
};

export const agentEventSchema = z.discriminatedUnion("type", [
  z.object({ ...eventBase, type: z.literal("turn_started") }).strict(),
  z.object({
    ...eventBase,
    type: z.literal("context_attached"),
    contextKinds: z.array(contextKindSchema).min(1).max(16),
  }).strict(),
  z.object({ ...eventBase, type: z.literal("text_delta"), text: z.string().max(262_144) }).strict(),
  z.object({
    ...eventBase,
    type: z.literal("read_tool_call"),
    toolName: readToolNameSchema,
    input: z.unknown(),
  }).strict(),
  z.object({
    ...eventBase,
    type: z.literal("read_tool_result"),
    toolName: readToolNameSchema,
    result: z.unknown(),
  }).strict(),
  z.object({ ...eventBase, type: z.literal("turn_completed"), message: z.string().max(262_144) }).strict(),
  z.object({ ...eventBase, type: z.literal("turn_cancelled"), reason: z.string().min(1).max(1024) }).strict(),
  z.object({
    ...eventBase,
    type: z.literal("runtime_error"),
    code: agentIdentifierSchema,
    message: z.string().min(1).max(4096),
    retryable: z.boolean(),
  }).strict(),
]);

export type AgentEvent = z.infer<typeof agentEventSchema>;

export const agentRuntimeHealthSchema = z.object({
  schemaVersion: z.literal(1),
  runtimeId: agentIdentifierSchema,
  runtimeVersion: z.string().min(1).max(128),
  status: z.enum(["ready", "degraded", "unavailable"]),
  capabilities: agentRuntimeCapabilitiesSchema,
  checks: z.array(z.object({
    name: agentIdentifierSchema,
    status: z.enum(["pass", "warn", "fail"]),
    message: z.string().min(1).max(2048),
  }).strict()).max(64),
}).strict();

export type AgentRuntimeHealth = z.infer<typeof agentRuntimeHealthSchema>;

export interface AgentRuntime {
  readonly runtimeId: string;
  readonly runtimeVersion: string;
  readonly capabilities: AgentRuntimeCapabilities;
  startSession(input: StartAgentSessionInput): Promise<AgentSessionHandle>;
  sendTurn(input: AgentTurnInput): AsyncIterable<AgentEvent>;
  cancelTurn(sessionId: string, turnId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<AgentSessionHandle>;
  closeSession(sessionId: string): Promise<void>;
  healthCheck(): Promise<AgentRuntimeHealth>;
}
