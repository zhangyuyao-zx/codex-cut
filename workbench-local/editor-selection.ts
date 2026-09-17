import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';

const FILE_NAME = 'editor-selection.json';
const MAX_ID_LENGTH = 200;
const MAX_TIME_SECONDS = 10_000_000;

const idSchema = z.string().min(1).max(MAX_ID_LENGTH);
const timeSecondsSchema = z.number().finite().min(0).max(MAX_TIME_SECONDS);
const revisionSchema = z.number().int().nonnegative().safe();

/**
 * The selection payload accepted by set(). The parent route owns validation
 * against the current project, so this schema only checks the persisted shape.
 */
export const editorSelectionInputSchema = z
  .object({
    sceneId: idSchema.nullable(),
    objectId: idSchema.nullable(),
    timeSeconds: timeSecondsSchema,
    view: z.enum(['cut', 'scene', 'sample', 'review']),
    baseRevision: revisionSchema,
    hasUnsavedChanges: z.boolean(),
  })
  .strict()
  .superRefine((selection, context) => {
    if (selection.objectId !== null && selection.sceneId === null) {
      context.addIssue({
        code: 'custom',
        path: ['objectId'],
        message: 'objectId requires a non-null sceneId',
      });
    }
  });

// Public name for callers that need to validate the six-field route payload.
export const editorSelectionSchema = editorSelectionInputSchema;

export type EditorSelectionInput = z.infer<typeof editorSelectionInputSchema>;

const updatedAtSchema = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), 'updatedAt must be an ISO timestamp');

const storedEditorSelectionSchema = z
  .object({
    sceneId: idSchema.nullable(),
    objectId: idSchema.nullable(),
    timeSeconds: timeSecondsSchema,
    view: z.enum(['cut', 'scene', 'sample', 'review']),
    baseRevision: revisionSchema,
    hasUnsavedChanges: z.boolean(),
    updatedAt: updatedAtSchema.nullable(),
  })
  .strict()
  .superRefine((selection, context) => {
    if (selection.objectId !== null && selection.sceneId === null) {
      context.addIssue({
        code: 'custom',
        path: ['objectId'],
        message: 'objectId requires a non-null sceneId',
      });
    }
  });

export type EditorSelection = z.infer<typeof storedEditorSelectionSchema>;

export const DEFAULT_EDITOR_SELECTION: Readonly<EditorSelection> = Object.freeze({
  sceneId: null,
  objectId: null,
  timeSeconds: 0,
  view: 'cut',
  baseRevision: 0,
  hasUnsavedChanges: false,
  updatedAt: null,
});

export type EditorSelectionErrorCode = 'INVALID_INPUT' | 'INVALID_STATE';

export class EditorSelectionError extends Error {
  public readonly code: EditorSelectionErrorCode;
  public readonly path?: string;

  public constructor(code: EditorSelectionErrorCode, message: string, pathValue?: string) {
    super(message);
    this.name = 'EditorSelectionError';
    this.code = code;
    this.path = pathValue;
  }
}

export interface EditorSelectionService {
  get(): Promise<EditorSelection>;
  set(input: EditorSelectionInput): Promise<EditorSelection>;
}

const writeQueues = new Map<string, Promise<void>>();

function runSerialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
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

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as {code?: unknown}).code === code;
}

function formatIssues(issues: readonly z.core.$ZodIssue[]): string {
  return issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}

function invalidInput(input: unknown, issues: readonly z.core.$ZodIssue[]): EditorSelectionError {
  const detail = formatIssues(issues);
  return new EditorSelectionError(
    'INVALID_INPUT',
    detail ? `Invalid editor selection input: ${detail}` : 'Invalid editor selection input',
    typeof input === 'object' && input !== null ? undefined : '<root>',
  );
}

function invalidState(message: string): EditorSelectionError {
  return new EditorSelectionError('INVALID_STATE', message);
}

function parseStoredSelection(value: unknown, source: string): EditorSelection {
  const parsed = storedEditorSelectionSchema.safeParse(value);
  if (!parsed.success) {
    const detail = formatIssues(parsed.error.issues);
    throw invalidState(
      detail
        ? `Invalid editor selection at ${source}: ${detail}`
        : `Invalid editor selection at ${source}`,
    );
  }
  return parsed.data;
}

async function writeJsonAtomic(filePath: string, value: EditorSelection): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, {recursive: true});
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      if (!isNodeErrorWithCode(cleanupError, 'ENOENT')) throw cleanupError;
    }
    throw error;
  }
}

async function loadSelection(filePath: string): Promise<EditorSelection> {
  let serialized: string;
  try {
    serialized = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) return clone(DEFAULT_EDITOR_SELECTION);
    throw error;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw invalidState(
      `Editor selection at ${filePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseStoredSelection(decoded, filePath);
}

class EditorSelectionServiceImpl implements EditorSelectionService {
  private readonly directory: string;
  private readonly filePath: string;

  public constructor(directory: string) {
    this.directory = path.resolve(directory);
    this.filePath = path.join(this.directory, FILE_NAME);
  }

  public async initialize(): Promise<void> {
    await runSerialized(this.filePath, async () => {
      await loadSelection(this.filePath);
    });
  }

  public async get(): Promise<EditorSelection> {
    return runSerialized(this.filePath, async () => clone(await loadSelection(this.filePath)));
  }

  public async set(input: EditorSelectionInput): Promise<EditorSelection> {
    const parsed = editorSelectionInputSchema.safeParse(input);
    if (!parsed.success) throw invalidInput(input, parsed.error.issues);

    return runSerialized(this.filePath, async () => {
      // Reload under the queue so concurrent service instances serialize from
      // the latest on-disk value before each write.
      await loadSelection(this.filePath);
      const next = storedEditorSelectionSchema.parse({
        ...parsed.data,
        updatedAt: new Date().toISOString(),
      });
      await writeJsonAtomic(this.filePath, next);
      return clone(next);
    });
  }
}

export async function createEditorSelection(directory: string): Promise<EditorSelectionService> {
  if (typeof directory !== 'string' || directory.trim().length === 0) {
    throw invalidState('Editor selection directory must be a non-empty string');
  }

  const service = new EditorSelectionServiceImpl(directory);
  // Validate an existing file during construction so corruption is surfaced
  // immediately. A missing file remains a valid default state.
  await service.initialize();
  return service;
}
