import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { componentMediaBindingSchema } from "./component-media";

import {
  creativeDesignSchema,
  validateCreativeDesignReferences,
} from "./creative-design";

import { preserveSceneEdits } from "./editable-objects";
import {sceneEntryTransitionSchema} from "./scene-transition";
import {assertTransitionPredecessors} from "./transition-dependencies";
const STORE_FILE_NAME = "production.json";
const SCHEMA_VERSION = 1;
const MAX_ID_LENGTH = 200;
const MAX_TEXT_LENGTH = 20_000;
const MAX_URL_LENGTH = 4_096;

const idSchema = z.string().trim().min(1).max(MAX_ID_LENGTH);
// A timeline word reference contains both clip and source-word identities.
const wordIdSchema = z.string().trim().min(1).max(4096);
const textSchema = z.string().trim().min(1).max(MAX_TEXT_LENGTH);
const revisionSchema = z.number().int().nonnegative().safe();
const timeMsSchema = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);

export const productionSourceSchema = z
  .object({
    assetUrl: z.string().trim().min(1).max(MAX_URL_LENGTH),
    cutRevision: revisionSchema,
  })
  .strict();

export const sceneBeatSchema = z
  .object({
    wordId: wordIdSchema,
    label: textSchema,
  })
  .strict();

export const componentSelectionSchema = z
  .object({
    id: idSchema,
    componentId: idSchema,
    props: z
      .record(z.string().max(100), z.json())
      .refine((value) => JSON.stringify(value).length <= 64000, "组件参数过大"),
    mediaBindings: z.array(componentMediaBindingSchema).max(32).optional(),
    startWordId: wordIdSchema,
    endWordId: wordIdSchema,
    x: z.number().finite().min(-1920).max(3840),
    y: z.number().finite().min(-1080).max(2160),
    scale: z.number().finite().min(0.05).max(4),
    opacity: z.number().finite().min(0).max(1),
  })
  .strict();
export const sceneSchema = z
  .object({
    id: idSchema,
    title: textSchema,
    startWordId: wordIdSchema,
    endWordId: wordIdSchema,
    intent: textSchema,
    design: creativeDesignSchema.optional(),
    entryTransition: sceneEntryTransitionSchema.optional(),
    editor: z
      .object({
        overrides: z.record(
          z.string().max(128),
          z.union([z.string().max(4000), z.number().finite(), z.boolean()]),
        ),
        locks: z.array(z.string().min(1).max(128)).max(100),
        entryTransition: sceneEntryTransitionSchema.nullable().optional(),
      })
      .strict()
      .optional(),
    beats: z.array(sceneBeatSchema).max(2_000),
    components: z.array(componentSelectionSchema).max(12).optional(),
    program: z
      .object({
        moduleId: idSchema,
        parameters: z
          .record(z.string().max(100), z.json())
          .refine((v) => JSON.stringify(v).length <= 64000, "动画参数过大"),
      })
      .strict()
      .optional(),
  })
  .strict();

export const materialRequestSchema = z
  .object({
    id: idSchema,
    sceneId: idSchema,
    description: textSchema,
    reason: textSchema,
    status: z.enum(["missing", "waived", "provided"]),
    fileName: textSchema.max(1_000).optional(),
    note: textSchema.max(4_000).optional(),
    animationSlot: z
      .object({
        templateId: z.string().uuid(),
        moduleId: idSchema,
        materialId: idSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export const feedbackSchema = z
  .object({
    id: idSchema,
    sceneId: idSchema,
    timeMs: timeMsSchema,
    text: textSchema,
    status: z.enum(["open", "resolved"]),
    revision: revisionSchema,
  })
  .strict();

export const productionStateSchema = z
  .object({
    revision: revisionSchema,
    source: productionSourceSchema.nullable(),
    scenes: z.array(sceneSchema).max(2_000),
    requests: z.array(materialRequestSchema).max(10_000),
    feedback: z.array(feedbackSchema).max(10_000),
  })
  .strict();

export const productionEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    state: productionStateSchema,
    history: z.array(productionStateSchema),
  })
  .strict();

export type ProductionSource = z.infer<typeof productionSourceSchema>;
export type SceneBeat = z.infer<typeof sceneBeatSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type MaterialRequest = z.infer<typeof materialRequestSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type ProductionState = z.infer<typeof productionStateSchema>;
export type State = ProductionState;

export type ProductionStoreErrorCode =
  "STALE_REVISION" | "INVALID_STATE" | "NO_UNDO" | "NOT_FOUND" | "DUPLICATE_ID";

export class ProductionStoreError extends Error {
  public readonly code: ProductionStoreErrorCode;

  public constructor(code: ProductionStoreErrorCode, message: string) {
    super(message);
    this.name = "ProductionStoreError";
    this.code = code;
  }
}

export interface ProductionStore {
  get(): Promise<ProductionState>;
  setScenes(
    expectedRevision: number,
    source: ProductionSource | null,
    scenes: readonly Scene[],
    actor?: "user" | "codex",
  ): Promise<ProductionState>;
  setRequest(
    expectedRevision: number,
    request: MaterialRequest,
  ): Promise<ProductionState>;
  setSceneWithRequests(
    expectedRevision: number,
    scene: Scene,
    requests: readonly MaterialRequest[],
  ): Promise<ProductionState>;
  addFeedback(
    expectedRevision: number,
    feedback: Feedback,
  ): Promise<ProductionState>;
  resolveFeedback(
    expectedRevision: number,
    id: string,
  ): Promise<ProductionState>;
  undo(expectedRevision: number): Promise<ProductionState>;
}

interface StoredEnvelope {
  schemaVersion: typeof SCHEMA_VERSION;
  state: ProductionState;
  history: ProductionState[];
}

const writeQueues = new Map<string, Promise<void>>();

function runSerialized<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const marker = current.then(
    () => undefined,
    () => undefined,
  );
  writeQueues.set(key, marker);
  void marker.then(() => {
    if (writeQueues.get(key) === marker) writeQueues.delete(key);
  });
  return current;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function invalidState(message: string): ProductionStoreError {
  return new ProductionStoreError("INVALID_STATE", message);
}

function formatIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
  return issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  input: unknown,
  context: string,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const detail = formatIssues(parsed.error.issues);
    throw invalidState(detail ? `${context}: ${detail}` : context);
  }
  return parsed.data;
}

function assertUniqueIds(
  values: readonly string[],
  label: string,
  seen: Set<string>,
): void {
  for (const id of values) {
    if (seen.has(id))
      throw new ProductionStoreError(
        "DUPLICATE_ID",
        `${label} id is duplicated: ${id}`,
      );
    seen.add(id);
  }
}

function validateRelationships(
  state: ProductionState,
  context: string,
): ProductionState {
  const sceneIds = new Set<string>();
  const entityIds = new Set<string>();
  assertUniqueIds(
    state.scenes.map((scene) => scene.id),
    "Scene",
    entityIds,
  );
  for (const scene of state.scenes) {
    validateCreativeDesignReferences(scene);
    const beatWordIds = new Set<string>();
    for (const beat of scene.beats) {
      if (beatWordIds.has(beat.wordId)) {
        throw invalidState(
          `${context}: Scene ${scene.id} has duplicated beat wordId ${beat.wordId}`,
        );
      }
      beatWordIds.add(beat.wordId);
    }
    sceneIds.add(scene.id);
  }
  assertUniqueIds(
    state.requests.map((request) => request.id),
    "Material request",
    entityIds,
  );
  assertUniqueIds(
    state.feedback.map((item) => item.id),
    "Feedback",
    entityIds,
  );
  for (const request of state.requests) {
    if (!sceneIds.has(request.sceneId)) {
      throw invalidState(
        `${context}: Material request ${request.id} references missing scene ${request.sceneId}`,
      );
    }
  }
  for (const item of state.feedback) {
    if (!sceneIds.has(item.sceneId)) {
      throw invalidState(
        `${context}: Feedback ${item.id} references missing scene ${item.sceneId}`,
      );
    }
  }
  return state;
}

function parseState(input: unknown, context: string): ProductionState {
  return validateRelationships(
    parseWithSchema(productionStateSchema, input, context),
    context,
  );
}

function parseEnvelope(input: unknown, source: string): StoredEnvelope {
  const parsed = parseWithSchema(
    productionEnvelopeSchema,
    input,
    `Invalid production store at ${source}`,
  );
  parseState(parsed.state, `Invalid production state at ${source}`);
  for (const [index, state] of parsed.history.entries()) {
    parseState(state, `Invalid production history ${index} at ${source}`);
  }
  return parsed;
}

function nextRevision(current: number): number {
  if (current >= Number.MAX_SAFE_INTEGER)
    throw invalidState("Production revision cannot increase safely");
  return current + 1;
}

function assertExpectedRevision(
  state: ProductionState,
  expectedRevision: number,
): void {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    expectedRevision !== state.revision
  ) {
    throw new ProductionStoreError(
      "STALE_REVISION",
      `Expected production revision ${expectedRevision}, current revision is ${state.revision}`,
    );
  }
}

function initialEnvelope(): StoredEnvelope {
  return {
    schemaVersion: SCHEMA_VERSION,
    state: {
      revision: 0,
      source: null,
      scenes: [],
      requests: [],
      feedback: [],
    },
    history: [],
  };
}

async function writeJsonAtomic(
  filePath: string,
  envelope: StoredEnvelope,
): Promise<void> {
  const validated = parseEnvelope(envelope, "<memory>");
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let renamed = false;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
    renamed = true;
  } finally {
    if (!renamed) await unlink(temporaryPath).catch(() => undefined);
  }
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

class ProductionStoreImpl implements ProductionStore {
  private readonly directory: string;
  private readonly filePath: string;
  private initialized = false;

  public constructor(directory: string) {
    this.directory = path.resolve(directory);
    this.filePath = path.join(this.directory, STORE_FILE_NAME);
  }

  public async initialize(): Promise<void> {
    await this.serialized(async () => {
      await this.loadEnvelopeLocked();
    });
  }

  public async get(): Promise<ProductionState> {
    return this.serialized(async () =>
      clone((await this.loadEnvelopeLocked()).state),
    );
  }

  public async setScenes(
    expectedRevision: number,
    source: ProductionSource | null,
    scenes: readonly Scene[],
    actor: "user" | "codex" = "codex",
  ): Promise<ProductionState> {
    return this.serialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      assertExpectedRevision(envelope.state, expectedRevision);
      const parsedSource = parseWithSchema(
        productionSourceSchema.nullable(),
        source,
        "Invalid production source",
      );
      const parsedScenes = parseWithSchema(
        z.array(sceneSchema).max(2_000),
        preserveSceneEdits(envelope.state.scenes, [...scenes], actor),
        "Invalid production scenes",
      );
      const nextState = parseState(
        {
          ...envelope.state,
          revision: nextRevision(envelope.state.revision),
          source: parsedSource,
          scenes: parsedScenes,
        },
        "Invalid production state",
      );
      return this.commit(envelope, nextState);
    });
  }

  public async setSceneWithRequests(
    expectedRevision: number,
    scene: Scene,
    requests: readonly MaterialRequest[],
  ): Promise<ProductionState> {
    return this.serialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      assertExpectedRevision(envelope.state, expectedRevision);
      const existing = envelope.state.scenes.find((candidate) => candidate.id === scene?.id);
      if (!existing)
        throw new ProductionStoreError(
          "NOT_FOUND",
          `Scene does not exist: ${String(scene?.id ?? "")}`,
        );
      const parsedRequests = parseWithSchema(
        z.array(materialRequestSchema).max(10_000),
        requests,
        "Invalid material requests",
      );
      if (parsedRequests.some((request) => request.sceneId !== existing.id))
        throw invalidState("Material requests must belong to the selected scene");
      const parsedScene = parseWithSchema(
        sceneSchema,
        {
          ...scene,
          ...(existing.editor?.entryTransition===undefined?{}:{entryTransition:existing.editor.entryTransition??undefined}),
          // Applying an animation may replace the program and components, but
          // the existing user's editor overrides and locks remain authoritative.
          ...(existing.editor === undefined ? {editor: undefined} : {editor: clone(existing.editor)}),
        },
        "Invalid production scene",
      );
      const nextState = parseState(
        {
          ...envelope.state,
          revision: nextRevision(envelope.state.revision),
          scenes: envelope.state.scenes.map((candidate) =>
            candidate.id === existing.id ? parsedScene : candidate,
          ),
          requests: [
            ...envelope.state.requests.filter((request) => request.sceneId !== existing.id),
            ...parsedRequests,
          ],
        },
        "Invalid production state",
      );
      // The animation apply path commits a scene and its material requests
      // together. Reject invalid adjacent-scene dependencies before either
      // becomes visible, including older documents loaded from disk.
      assertTransitionPredecessors(nextState);
      return this.commit(envelope, nextState);
    });
  }

  public async setRequest(
    expectedRevision: number,
    request: MaterialRequest,
  ): Promise<ProductionState> {
    return this.serialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      assertExpectedRevision(envelope.state, expectedRevision);
      const parsedRequest = parseWithSchema(
        materialRequestSchema,
        request,
        "Invalid material request",
      );
      const requests = [...envelope.state.requests];
      const index = requests.findIndex((item) => item.id === parsedRequest.id);
      if (index === -1) requests.push(parsedRequest);
      else requests[index] = parsedRequest;
      const nextState = parseState(
        {
          ...envelope.state,
          revision: nextRevision(envelope.state.revision),
          requests,
        },
        "Invalid production state",
      );
      return this.commit(envelope, nextState);
    });
  }

  public async addFeedback(
    expectedRevision: number,
    feedback: Feedback,
  ): Promise<ProductionState> {
    return this.serialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      assertExpectedRevision(envelope.state, expectedRevision);
      const parsedFeedback = parseWithSchema(
        feedbackSchema,
        feedback,
        "Invalid feedback",
      );
      if (
        envelope.state.feedback.some((item) => item.id === parsedFeedback.id)
      ) {
        throw new ProductionStoreError(
          "DUPLICATE_ID",
          `Feedback id is already present: ${parsedFeedback.id}`,
        );
      }
      const nextState = parseState(
        {
          ...envelope.state,
          revision: nextRevision(envelope.state.revision),
          feedback: [...envelope.state.feedback, parsedFeedback],
        },
        "Invalid production state",
      );
      return this.commit(envelope, nextState);
    });
  }

  public async resolveFeedback(
    expectedRevision: number,
    id: string,
  ): Promise<ProductionState> {
    return this.serialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      assertExpectedRevision(envelope.state, expectedRevision);
      const parsedId = parseWithSchema(idSchema, id, "Invalid feedback id");
      const index = envelope.state.feedback.findIndex(
        (item) => item.id === parsedId,
      );
      if (index === -1)
        throw new ProductionStoreError(
          "NOT_FOUND",
          `Feedback id does not exist: ${parsedId}`,
        );
      if (envelope.state.feedback[index].status === "resolved")
        return clone(envelope.state);
      const feedback = envelope.state.feedback.map((item, itemIndex) =>
        itemIndex === index ? { ...item, status: "resolved" as const } : item,
      );
      const nextState = parseState(
        {
          ...envelope.state,
          revision: nextRevision(envelope.state.revision),
          feedback,
        },
        "Invalid production state",
      );
      return this.commit(envelope, nextState);
    });
  }

  public async undo(expectedRevision: number): Promise<ProductionState> {
    return this.serialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      assertExpectedRevision(envelope.state, expectedRevision);
      if (envelope.history.length === 0)
        throw new ProductionStoreError(
          "NO_UNDO",
          "No production change is available to undo",
        );
      const target = envelope.history[envelope.history.length - 1];
      const nextState = parseState(
        { ...target, revision: nextRevision(envelope.state.revision) },
        "Invalid undo state",
      );
      const nextEnvelope: StoredEnvelope = {
        schemaVersion: SCHEMA_VERSION,
        state: nextState,
        history: envelope.history.slice(0, -1).map(clone),
      };
      await writeJsonAtomic(this.filePath, nextEnvelope);
      return clone(nextState);
    });
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    return runSerialized(this.filePath, operation);
  }

  private async commit(
    envelope: StoredEnvelope,
    nextState: ProductionState,
  ): Promise<ProductionState> {
    const nextEnvelope: StoredEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      state: nextState,
      history: [...envelope.history, clone(envelope.state)],
    };
    await writeJsonAtomic(this.filePath, nextEnvelope);
    return clone(nextState);
  }

  private async loadEnvelopeLocked(): Promise<StoredEnvelope> {
    await mkdir(this.directory, { recursive: true });
    let serialized: string;
    try {
      serialized = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        if (this.initialized)
          throw invalidState(`Production store is missing at ${this.filePath}`);
        const initial = initialEnvelope();
        await writeJsonAtomic(this.filePath, initial);
        this.initialized = true;
        return initial;
      }
      throw error;
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(serialized) as unknown;
    } catch (error) {
      throw invalidState(
        `Production store at ${this.filePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const envelope = parseEnvelope(decoded, this.filePath);
    this.initialized = true;
    return envelope;
  }
}

export async function createProductionStore(
  directory: string,
): Promise<ProductionStore> {
  if (typeof directory !== "string" || directory.trim().length === 0) {
    throw invalidState("Production store directory must be a non-empty string");
  }
  const store = new ProductionStoreImpl(directory);
  await store.initialize();
  return store;
}
