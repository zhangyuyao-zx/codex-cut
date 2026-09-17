import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';

const PROJECT_FILE_NAME = 'project.json';
const MAX_LOCKS = 64;
const MAX_LOCK_PATH_LENGTH = 200;

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/u, 'expected a six-digit hex color');

export const projectValuesSchema = z.object({
  title: z.string().max(80),
  accent: hexColorSchema,
  personScale: z.number().finite().min(0.5).max(1.5),
  personX: z.number().finite().min(-300).max(300),
  personY: z.number().finite().min(-300).max(300),
  titleScale: z.number().finite().min(0.5).max(1.5),
}).strict();

export const projectMotionSchema = z.object({
  offsetFrames: z.number().int().min(-12).max(12),
}).strict();

const projectIdentityFieldSchema = z.string().min(1).max(200);
const projectLocksSchema = z.array(z.string().min(1).max(MAX_LOCK_PATH_LENGTH)).max(MAX_LOCKS);

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: projectIdentityFieldSchema,
  name: projectIdentityFieldSchema,
  revision: z.number().int().nonnegative().safe(),
  values: projectValuesSchema,
  motion: projectMotionSchema,
  locks: projectLocksSchema,
  updatedAt: z.string().min(1).max(80),
}).strict();

const projectValuesPatchSchema = projectValuesSchema.partial().strict();
const projectMotionPatchSchema = projectMotionSchema.partial().strict();

export const projectPatchSchema = z.object({
  values: projectValuesPatchSchema.optional(),
  motion: projectMotionPatchSchema.optional(),
  locks: projectLocksSchema.optional(),
}).strict();

export const projectStoreOpenOptionsSchema = z.object({
  id: projectIdentityFieldSchema.optional(),
  name: projectIdentityFieldSchema.optional(),
  values: projectValuesPatchSchema.optional(),
  motion: projectMotionPatchSchema.optional(),
  locks: projectLocksSchema.optional(),
}).strict();

export const projectStoreEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  current: projectSchema,
  undoStack: z.array(projectSchema),
  redoStack: z.array(projectSchema),
}).strict();

export type ProjectValues = z.infer<typeof projectValuesSchema>;
export type ProjectMotion = z.infer<typeof projectMotionSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectPatch = z.infer<typeof projectPatchSchema>;
export type ProjectStoreOpenOptions = z.infer<typeof projectStoreOpenOptionsSchema>;
export type ProjectStoreEnvelope = z.infer<typeof projectStoreEnvelopeSchema>;
export type ProjectStoreActor = 'user' | 'codex';

export const DEFAULT_PROJECT_VALUES: Readonly<ProjectValues> = Object.freeze({
  title: '每个词，',
  accent: '#E1F795',
  personScale: 1,
  personX: 0,
  personY: 0,
  titleScale: 1,
});

export const DEFAULT_PROJECT_MOTION: Readonly<ProjectMotion> = Object.freeze({
  offsetFrames: 0,
});

export type ProjectStoreErrorCode =
  | 'STALE_REVISION'
  | 'LOCKED_FIELD'
  | 'INVALID_PROJECT'
  | 'NO_UNDO'
  | 'NO_REDO';

export class ProjectStoreError extends Error {
  public readonly code: ProjectStoreErrorCode;
  public readonly path?: string;

  public constructor(code: ProjectStoreErrorCode, message: string, pathValue?: string) {
    super(message);
    this.name = 'ProjectStoreError';
    this.code = code;
    this.path = pathValue;
  }
}

const writeQueues = new Map<string, Promise<void>>();

function runSerialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const marker = current.then(() => undefined, () => undefined);
  writeQueues.set(key, marker);
  void marker.then(() => {
    if (writeQueues.get(key) === marker) writeQueues.delete(key);
  });
  return current;
}

function cloneProject<T>(value: T): T {
  return structuredClone(value);
}

function invalidProject(message: string): ProjectStoreError {
  return new ProjectStoreError('INVALID_PROJECT', message);
}

function formatValidationMessage(context: string, issues: z.core.$ZodIssue[]): string {
  const detail = issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
  return detail ? `${context}: ${detail}` : context;
}

function parseEnvelope(input: unknown, source: string): ProjectStoreEnvelope {
  const parsed = projectStoreEnvelopeSchema.safeParse(input);
  if (!parsed.success) throw invalidProject(formatValidationMessage(`Invalid project store at ${source}`, parsed.error.issues));

  const projectId = parsed.data.current.id;
  const projectName = parsed.data.current.name;
  const historyMatchesIdentity = [...parsed.data.undoStack, ...parsed.data.redoStack]
    .every((entry) => entry.id === projectId && entry.name === projectName);
  if (!historyMatchesIdentity) throw invalidProject(`Invalid project store at ${source}: history identity does not match current project`);
  return parsed.data;
}

function parseOptions(input: ProjectStoreOpenOptions | undefined): ProjectStoreOpenOptions {
  const parsed = projectStoreOpenOptionsSchema.safeParse(input ?? {});
  if (!parsed.success) throw invalidProject(formatValidationMessage('Invalid initial project options', parsed.error.issues));
  return parsed.data;
}

function parsePatch(input: ProjectPatch): ProjectPatch {
  const parsed = projectPatchSchema.safeParse(input);
  if (!parsed.success) throw invalidProject(formatValidationMessage('Invalid project patch', parsed.error.issues));
  return parsed.data;
}

function assertActor(actor: ProjectStoreActor): void {
  if (actor !== 'user' && actor !== 'codex') throw invalidProject('Invalid project patch actor');
}

function assertNextRevision(current: Project): number {
  if (current.revision >= Number.MAX_SAFE_INTEGER) throw invalidProject('Project revision cannot increase safely');
  return current.revision + 1;
}

function lockMatches(lock: string, fieldPath: string): boolean {
  return lock === fieldPath || fieldPath.startsWith(`${lock}.`);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function writeEnvelopeAtomic(filePath: string, envelope: ProjectStoreEnvelope): Promise<void> {
  const validated = projectStoreEnvelopeSchema.safeParse(envelope);
  if (!validated.success) throw invalidProject(formatValidationMessage('Cannot persist invalid project store', validated.error.issues));

  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let renamed = false;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(validated.data, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
    renamed = true;
  } finally {
    if (!renamed) await unlink(temporaryPath).catch(() => undefined);
  }
}

function buildInitialEnvelope(directory: string, initialInput: ProjectStoreOpenOptions | undefined): ProjectStoreEnvelope {
  const initial = parseOptions(initialInput);
  const values = projectValuesSchema.parse({...DEFAULT_PROJECT_VALUES, ...(initial.values ?? {})});
  const motion = projectMotionSchema.parse({...DEFAULT_PROJECT_MOTION, ...(initial.motion ?? {})});
  const resolvedDirectory = path.resolve(directory);
  const fallbackName = path.basename(resolvedDirectory) || '未命名项目';
  const current = projectSchema.parse({
    schemaVersion: 1,
    id: initial.id ?? randomUUID(),
    name: initial.name ?? fallbackName,
    revision: 0,
    values,
    motion,
    locks: initial.locks ?? [],
    updatedAt: nowIso(),
  });
  return projectStoreEnvelopeSchema.parse({schemaVersion: 1, current, undoStack: [], redoStack: []});
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as {code?: unknown}).code === code;
}

export class ProjectStore {
  private readonly directory: string;
  private readonly filePath: string;
  private readonly initialInput: ProjectStoreOpenOptions | undefined;
  private envelope: ProjectStoreEnvelope | null = null;
  private initialized = false;

  public constructor(directory: string, initial?: ProjectStoreOpenOptions) {
    this.directory = path.resolve(directory);
    this.filePath = path.join(this.directory, PROJECT_FILE_NAME);
    this.initialInput = initial;
  }

  public static async open(directory: string, initial?: ProjectStoreOpenOptions): Promise<ProjectStore> {
    const store = new ProjectStore(directory, initial);
    await store.runSerialized(async () => {
      await store.loadEnvelopeLocked();
    });
    return store;
  }

  public async get(): Promise<Project> {
    return this.runSerialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      return cloneProject(envelope.current);
    });
  }

  public async patch(
    expectedRevision: number,
    patch: ProjectPatch,
    actor: ProjectStoreActor,
  ): Promise<Project> {
    return this.runSerialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      const current = envelope.current;
      this.assertExpectedRevision(current, expectedRevision);
      assertActor(actor);
      const parsedPatch = parsePatch(patch);

      if (actor === 'codex' && parsedPatch.locks !== undefined) {
        throw new ProjectStoreError('LOCKED_FIELD', 'Codex cannot change project locks', 'locks');
      }

      const valuePaths = Object.keys(parsedPatch.values ?? {}).map((field) => `values.${field}`);
      const changedPaths = [
        ...valuePaths,
        ...(parsedPatch.motion ? Object.keys(parsedPatch.motion).map((field) => `motion.${field}`) : []),
        ...(parsedPatch.locks !== undefined ? ['locks'] : []),
      ];
      if (actor === 'codex') {
        const blockedPath = changedPaths.find((fieldPath) => current.locks.some((lock) => lockMatches(lock, fieldPath)));
        if (blockedPath) {
          throw new ProjectStoreError('LOCKED_FIELD', `Codex cannot write locked field ${blockedPath}`, blockedPath);
        }
      }

      const next = projectSchema.parse({
        ...current,
        revision: assertNextRevision(current),
        values: {...current.values, ...(parsedPatch.values ?? {})},
        motion: {...current.motion, ...(parsedPatch.motion ?? {})},
        locks: parsedPatch.locks ?? current.locks,
        updatedAt: nowIso(),
      });
      const nextEnvelope = projectStoreEnvelopeSchema.parse({
        schemaVersion: 1,
        current: next,
        undoStack: [...envelope.undoStack, cloneProject(current)],
        redoStack: [],
      });
      await writeEnvelopeAtomic(this.filePath, nextEnvelope);
      this.envelope = nextEnvelope;
      return cloneProject(next);
    });
  }

  public async undo(expectedRevision: number): Promise<Project> {
    return this.runSerialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      const current = envelope.current;
      this.assertExpectedRevision(current, expectedRevision);
      if (envelope.undoStack.length === 0) throw new ProjectStoreError('NO_UNDO', 'No project changes are available to undo');

      const target = cloneProject(envelope.undoStack[envelope.undoStack.length - 1]);
      const next = projectSchema.parse({...target, revision: assertNextRevision(current), updatedAt: nowIso()});
      const nextEnvelope = projectStoreEnvelopeSchema.parse({
        schemaVersion: 1,
        current: next,
        undoStack: envelope.undoStack.slice(0, -1),
        redoStack: [...envelope.redoStack, cloneProject(current)],
      });
      await writeEnvelopeAtomic(this.filePath, nextEnvelope);
      this.envelope = nextEnvelope;
      return cloneProject(next);
    });
  }

  public async redo(expectedRevision: number): Promise<Project> {
    return this.runSerialized(async () => {
      const envelope = await this.loadEnvelopeLocked();
      const current = envelope.current;
      this.assertExpectedRevision(current, expectedRevision);
      if (envelope.redoStack.length === 0) throw new ProjectStoreError('NO_REDO', 'No project changes are available to redo');

      const target = cloneProject(envelope.redoStack[envelope.redoStack.length - 1]);
      const next = projectSchema.parse({...target, revision: assertNextRevision(current), updatedAt: nowIso()});
      const nextEnvelope = projectStoreEnvelopeSchema.parse({
        schemaVersion: 1,
        current: next,
        undoStack: [...envelope.undoStack, cloneProject(current)],
        redoStack: envelope.redoStack.slice(0, -1),
      });
      await writeEnvelopeAtomic(this.filePath, nextEnvelope);
      this.envelope = nextEnvelope;
      return cloneProject(next);
    });
  }

  private runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    return runSerialized(this.directory, operation);
  }

  private assertExpectedRevision(current: Project, expectedRevision: number): void {
    if (expectedRevision !== current.revision) {
      throw new ProjectStoreError(
        'STALE_REVISION',
        `Expected project revision ${expectedRevision}, but current revision is ${current.revision}`,
      );
    }
  }

  private async loadEnvelopeLocked(): Promise<ProjectStoreEnvelope> {
    await mkdir(this.directory, {recursive: true});

    let serialized: string;
    try {
      serialized = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isNodeErrorWithCode(error, 'ENOENT')) {
        if (this.initialized) throw invalidProject(`Project store is missing at ${this.filePath}`);
        const created = buildInitialEnvelope(this.directory, this.initialInput);
        await writeEnvelopeAtomic(this.filePath, created);
        this.envelope = created;
        this.initialized = true;
        return created;
      }
      throw error;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(serialized) as unknown;
    } catch (error) {
      throw invalidProject(`Project store at ${this.filePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    const envelope = parseEnvelope(decoded, this.filePath);
    this.envelope = envelope;
    this.initialized = true;
    return envelope;
  }
}
