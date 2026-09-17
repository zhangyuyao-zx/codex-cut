import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const SCHEMA_VERSION = 1 as const;
const MAX_COMPONENT_ID_LENGTH = 200;
const MAX_FAVORITES = 194;

const componentIdSchema = z.string().trim().min(1).max(MAX_COMPONENT_ID_LENGTH);

export const componentFavoriteMutationSchema = z
  .object({
    componentId: componentIdSchema,
    favorite: z.boolean(),
  })
  .strict();

const favoritesEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    componentIds: z.array(componentIdSchema).max(MAX_FAVORITES),
  })
  .strict();

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

function formatIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
  return issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

function parseEnvelope(input: unknown, source: string): string[] {
  const parsed = favoritesEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `收藏文件无效 (${source}): ${formatIssues(parsed.error.issues)}`,
    );
  }
  const ids = parsed.data.componentIds;
  if (new Set(ids).size !== ids.length) {
    throw new Error(`收藏文件无效 (${source}): componentIds 不能重复`);
  }
  return ids;
}

function parseMutation(input: unknown): z.infer<typeof componentFavoriteMutationSchema> {
  const parsed = componentFavoriteMutationSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`收藏参数无效: ${formatIssues(parsed.error.issues)}`);
  }
  return parsed.data;
}

async function writeEnvelopeAtomic(filePath: string, componentIds: readonly string[]): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let renamed = false;
  try {
    const envelope = { schemaVersion: SCHEMA_VERSION, componentIds: [...componentIds] };
    const validated = favoritesEnvelopeSchema.safeParse(envelope);
    if (!validated.success) {
      throw new Error(`无法保存收藏: ${formatIssues(validated.error.issues)}`);
    }
    await writeFile(temporaryPath, `${JSON.stringify(validated.data, null, 2)}\n`, {
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

export class ComponentFavoritesStore {
  private readonly filePath: string;
  private readonly allowedIds: ReadonlySet<string>;

  public constructor(filePath: string, allowedIds: readonly string[]) {
    this.filePath = path.resolve(filePath);
    this.allowedIds = new Set(allowedIds);
    if (this.allowedIds.size > MAX_FAVORITES) {
      throw new Error(`收藏目录不能超过 ${MAX_FAVORITES} 项`);
    }
  }

  private async load(): Promise<Set<string>> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
      throw error;
    }
    const ids = parseEnvelope(JSON.parse(raw) as unknown, this.filePath);
    for (const id of ids) {
      if (!this.allowedIds.has(id)) {
        throw new Error(`收藏文件包含未知组件: ${id}`);
      }
    }
    return new Set(ids);
  }

  public async list(): Promise<string[]> {
    return runSerialized(this.filePath, async () => {
      const favorites = await this.load();
      return [...favorites].sort();
    });
  }

  public async set(input: unknown): Promise<string[]> {
    const mutation = parseMutation(input);
    if (!this.allowedIds.has(mutation.componentId)) {
      throw new Error(`组件不在 App 最终盘点库中: ${mutation.componentId}`);
    }
    return runSerialized(this.filePath, async () => {
      const favorites = await this.load();
      if (mutation.favorite) favorites.add(mutation.componentId);
      else favorites.delete(mutation.componentId);
      const componentIds = [...favorites].sort();
      await writeEnvelopeAtomic(this.filePath, componentIds);
      return componentIds;
    });
  }
}

export function createComponentFavoritesStore(
  filePath: string,
  allowedIds: readonly string[],
): ComponentFavoritesStore {
  return new ComponentFavoritesStore(filePath, allowedIds);
}
