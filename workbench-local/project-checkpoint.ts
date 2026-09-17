import {createHash, randomUUID} from "node:crypto";
import {createReadStream, createWriteStream} from "node:fs";
import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  lstat,
  rename,
  rmdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const CODE = ["workbench-local", "modules", "public", "package.json", "package-lock.json", "README.md", "MIGRATION.json"];
const PROJECT = [
  "cut",
  "media",
  "production",
  "productions",
  "exports",
  "animation-templates",
  "library-presets",
  "component-favorites",
];
const EXCLUDED = new Set([
  "node_modules",
  ".git",
  "runtime",
  "qa",
  "verification",
  ".DS_Store",
]);

// These sets describe the existing allow-list above; they do not add paths.
// They let verification reject a forged manifest such as code/package.json/x.
const CODE_DIRECTORIES = new Set(["workbench-local", "modules", "public"]);
const CODE_FILES = new Set(CODE.filter((entry) => !CODE_DIRECTORIES.has(entry)));

export interface ProjectCheckpointEntry {
  path: string;
  bytes: number;
  sha256: string;
  mode: number;
}

export interface ProjectCheckpointManifest {
  schemaVersion: 1;
  createdAt: string;
  files: ProjectCheckpointEntry[];
  dependencies: "install-from-lockfile";
}

interface FileStat {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly size: bigint;
  readonly mode: bigint;
  readonly mtimeNs: bigint;
  readonly ctimeNs: bigint;
}

interface FileSummary {
  readonly bytes: number;
  readonly sha256: string;
  readonly mode: number;
  readonly stat: FileStat;
}

interface SourceFile {
  readonly kind: "code" | "project";
  readonly relative: string;
  readonly absolute: string;
}

interface CheckpointOptions {
  readonly repo: string;
  readonly project: string;
  readonly destination: string;
  /** Test-only synchronization point before the final source rescan. */
  readonly beforeFinalScan?: () => void | Promise<void>;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function fail(message: string): never {
  throw new Error(message);
}

function nodeErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as {code?: unknown}).code)
    : undefined;
}

function inside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (nodeErrorCode(error) === "ENOENT") return false;
    throw error;
  }
}

async function requireDirectory(directory: string, context: string): Promise<void> {
  let info: any;
  try {
    info = await lstat(directory, {bigint: true});
  } catch (error) {
    fail(`${context} 不存在或不可读取`);
  }
  if (info.isSymbolicLink()) fail(`${context} 不能是软链接`);
  if (!info.isDirectory()) fail(`${context} 必须是目录`);
}

/** Check only paths below the supplied base, avoiding system aliases above it. */
async function assertNoSymlinkParents(
  base: string,
  relativePath: string,
  context: string,
): Promise<void> {
  const basePath = path.resolve(base);
  const target = path.resolve(basePath, ...relativePath.split("/"));
  const relative = path.relative(basePath, target);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    fail(`${context} 越过允许目录`);
  let baseInfo: any;
  try {
    baseInfo = await lstat(basePath, {bigint: true});
  } catch (error) {
    if (nodeErrorCode(error) === "ENOENT") return;
    fail(`${context} 父目录不可检查`);
  }
  if (baseInfo.isSymbolicLink()) fail(`${context} 父目录不能是软链接`);
  if (!baseInfo.isDirectory()) fail(`${context} 父路径必须是目录`);
  const parts = path.relative(basePath, path.dirname(target)).split(path.sep).filter(Boolean);
  let current = basePath;
  for (const part of parts) {
    current = path.join(current, part);
    let info: any;
    try {
      info = await lstat(current, {bigint: true});
    } catch (error) {
      if (nodeErrorCode(error) === "ENOENT") break;
      fail(`${context} 父目录不可检查`);
    }
    if (info.isSymbolicLink()) fail(`${context} 父目录不能是软链接`);
    if (!info.isDirectory()) fail(`${context} 父路径必须是目录`);
  }
}

async function regularFileStat(file: string, context: string): Promise<FileStat> {
  let info: any;
  try {
    info = await lstat(file, {bigint: true});
  } catch (error) {
    fail(`${context} 不存在或不可读取`);
  }
  if (info.isSymbolicLink()) fail(`${context} 不能是软链接`);
  if (!info.isFile()) fail(`${context} 必须是普通文件`);
  if (info.size > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${context} 过大`);
  return {
    dev: info.dev,
    ino: info.ino,
    size: info.size,
    mode: info.mode,
    mtimeNs: info.mtimeNs,
    ctimeNs: info.ctimeNs,
  };
}

function modeOf(stat: FileStat): number {
  return Number(stat.mode & 0o777n);
}

function sameStat(left: FileStat, right: FileStat): boolean {
  return left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs;
}

async function digestFileStable(file: string, context: string): Promise<FileSummary> {
  const before = await regularFileStat(file, context);
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(file)) {
      const value = chunk as Buffer;
      bytes += value.length;
      if (!Number.isSafeInteger(bytes)) fail(`${context} 过大`);
      hash.update(value);
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    fail(`${context} 读取失败`);
  }
  const after = await regularFileStat(file, context);
  if (!sameStat(before, after) || bytes !== Number(before.size))
    fail(`${context} 在读取期间发生变化，请保存后重试`);
  return {bytes, sha256: hash.digest("hex"), mode: modeOf(before), stat: before};
}

async function writeChunk(
  stream: NodeJS.WritableStream & {
    write(chunk: Buffer, callback?: (error?: Error | null) => void): boolean;
  },
  chunk: Buffer,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      stream.removeListener("error", onError);
      reject(error);
    };
    stream.once("error", onError);
    try {
      stream.write(chunk, (error?: Error | null) => {
        stream.removeListener("error", onError);
        if (error) reject(error);
        else resolve();
      });
    } catch (error) {
      stream.removeListener("error", onError);
      reject(error);
    }
  });
}

async function closeWriter(
  stream: NodeJS.WritableStream & {end(callback?: () => void): void},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      stream.removeListener("error", onError);
      reject(error);
    };
    stream.once("error", onError);
    stream.end(() => {
      stream.removeListener("error", onError);
      resolve();
    });
  });
}

async function copyAndVerify(
  source: string,
  destination: string,
  expected?: Pick<ProjectCheckpointEntry, "bytes" | "sha256" | "mode">,
): Promise<FileSummary> {
  const sourceBefore = await regularFileStat(source, `快照文件 ${source}`);
  const sourceHash = createHash("sha256");
  let bytes = 0;
  await mkdir(path.dirname(destination), {recursive: true});
  let outputHandle: Awaited<ReturnType<typeof open>> | undefined;
  let output: ReturnType<typeof createWriteStream> | undefined;
  let created = false;
  try {
    outputHandle = await open(destination, "wx", 0o600);
    created = true;
    output = createWriteStream(destination, {fd: outputHandle.fd, autoClose: false});
    for await (const chunk of createReadStream(source)) {
      const value = chunk as Buffer;
      bytes += value.length;
      if (!Number.isSafeInteger(bytes)) fail(`快照文件过大：${source}`);
      sourceHash.update(value);
      await writeChunk(output, value);
    }
    await closeWriter(output);
    output = undefined;
    await outputHandle.close();
    outputHandle = undefined;
    const sourceAfter = await regularFileStat(source, `快照文件 ${source}`);
    const sourceSha256 = sourceHash.digest("hex");
    if (!sameStat(sourceBefore, sourceAfter) || bytes !== Number(sourceBefore.size))
      fail("快照期间工程或源码发生变化，请保存后重试");
    const sourceSummary: FileSummary = {
      bytes,
      sha256: sourceSha256,
      mode: modeOf(sourceBefore),
      stat: sourceBefore,
    };
    if (expected && (
      expected.bytes !== sourceSummary.bytes ||
      expected.sha256 !== sourceSummary.sha256 ||
      expected.mode !== sourceSummary.mode
    )) fail(`快照文件校验失败：${source}`);
    await chmod(destination, sourceSummary.mode);
    const targetSummary = await digestFileStable(destination, `快照目标 ${destination}`);
    if (
      targetSummary.bytes !== sourceSummary.bytes ||
      targetSummary.sha256 !== sourceSummary.sha256 ||
      targetSummary.mode !== sourceSummary.mode
    ) fail(`快照目标校验失败：${destination}`);
    return targetSummary;
  } catch (error) {
    output?.on("error", () => undefined);
    output?.destroy();
    await outputHandle?.close().catch(() => undefined);
    if (created) await unlink(destination).catch(() => undefined);
    throw error;
  }
}

interface PublishedPath {
  readonly path: string;
  readonly dev: bigint;
  readonly ino: bigint;
}

/**
 * Reserve a new directory and move already verified stage entries into it.
 * Directory rename over an existing target is platform-dependent and can
 * replace an empty directory, so publishing the children under an exclusive
 * reservation avoids that overwrite race.
 */
async function publishDirectoryNoReplace(stage: string, destination: string): Promise<void> {
  await mkdir(destination, {recursive: false});
  const reservation = await lstat(destination, {bigint: true});
  if (!reservation.isDirectory() || reservation.isSymbolicLink())
    fail("发布目标必须是新目录");
  const moved: PublishedPath[] = [];
  try {
    const names = (await readdir(stage)).sort((left, right) => {
      if (left === "checkpoint.json") return 1;
      if (right === "checkpoint.json") return -1;
      return left.localeCompare(right);
    });
    for (const name of names) {
      const source = path.join(stage, name);
      const target = path.join(destination, name);
      if (await exists(target)) fail("发布目标已被占用，拒绝覆盖");
      const sourceInfo = await lstat(source, {bigint: true});
      if (sourceInfo.isSymbolicLink()) fail("快照暂存目录不能包含软链接");
      await rename(source, target);
      const targetInfo = await lstat(target, {bigint: true});
      if (targetInfo.dev !== sourceInfo.dev || targetInfo.ino !== sourceInfo.ino)
        fail("发布目标校验失败");
      moved.push({path: target, dev: targetInfo.dev, ino: targetInfo.ino});
    }
    const after = await lstat(destination, {bigint: true});
    if (after.dev !== reservation.dev || after.ino !== reservation.ino)
      fail("发布目标在发布期间发生变化");
    await rm(stage, {recursive: true, force: false});
  } catch (error) {
    await rm(stage, {recursive: true, force: true});
    // Remove only entries whose inode is still the one moved by this call.
    // If another writer has replaced a child, leave the destination intact.
    for (const item of moved.reverse()) {
      try {
        const info = await lstat(item.path, {bigint: true});
        if (info.dev === item.dev && info.ino === item.ino)
          await rm(item.path, {recursive: true, force: true});
      } catch {
        // The caller receives the original publication error.
      }
    }
    try {
      const after = await lstat(destination, {bigint: true});
      if (after.dev === reservation.dev && after.ino === reservation.ino && (await readdir(destination)).length === 0)
        await rmdir(destination);
    } catch {
      // Keep a changed or externally occupied destination rather than deleting it.
    }
    throw error;
  }
}

function toManifestRelative(relative: string): string {
  return relative.split(path.sep).join("/");
}

async function collect(root: string, sub: string, out: SourceFile[], kind: SourceFile["kind"]): Promise<void> {
  await assertNoSymlinkParents(root, sub, `源码路径 ${sub}`);
  const file = path.resolve(root, sub);
  const info = await lstat(file, {bigint: true});
  if (info.isSymbolicLink()) fail(`快照拒绝软链接，请先将素材复制到工程：${sub}`);
  if (info.isDirectory()) {
    for (const name of (await readdir(file)).sort()) {
      if (!EXCLUDED.has(name)) await collect(root, path.join(sub, name), out, kind);
    }
  } else if (info.isFile()) {
    out.push({kind, relative: toManifestRelative(sub), absolute: file});
  } else {
    fail(`不支持的文件类型：${sub}`);
  }
}

async function collectRootFiles(
  root: string,
  kind: SourceFile["kind"],
  allow: readonly string[],
): Promise<SourceFile[]> {
  await requireDirectory(root, `${kind === "code" ? "代码" : "工程"}目录`);
  const files: SourceFile[] = [];
  const roots = [...allow];
  if (kind === "project") {
    for (const name of (await readdir(root)).sort()) {
      if (EXCLUDED.has(name)) continue;
      const info = await lstat(path.join(root, name), {bigint: true});
      if (info.isSymbolicLink()) fail(`快照拒绝软链接，请先将素材复制到工程：${name}`);
      if (info.isFile() && !roots.includes(name)) roots.push(name);
    }
  }
  for (const sub of roots) {
    if (await exists(path.join(root, sub))) await collect(root, sub, files, kind);
  }
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${file.kind}/${file.relative}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function collectSources(repo: string, project: string): Promise<SourceFile[]> {
  return [
    ...(await collectRootFiles(repo, "code", CODE)),
    ...(await collectRootFiles(project, "project", PROJECT)),
  ];
}

function sourceKey(file: Pick<SourceFile, "kind" | "relative">): string {
  return `${file.kind}/${file.relative}`;
}

function assertSameSourceSet(before: readonly SourceFile[], after: readonly SourceFile[]): void {
  const expected = new Set(before.map(sourceKey));
  const actual = new Set(after.map(sourceKey));
  if (expected.size !== actual.size || [...expected].some((key) => !actual.has(key)))
    fail("复制期间源码或工程文件集合发生变化，请保存后重试");
}

function isAllowedCodePath(relative: string): boolean {
  if (CODE_FILES.has(relative)) return true;
  return [...CODE_DIRECTORIES].some((directory) => relative.startsWith(`${directory}/`));
}

function isAllowedProjectPath(relative: string): boolean {
  const first = relative.split("/")[0];
  if (!first || EXCLUDED.has(first)) return false;
  if (PROJECT.includes(first)) return true;
  return relative.split("/").length === 1;
}

function assertManifestRelativePath(value: unknown): string {
  if (typeof value !== "string" || !/^(code|project)\//u.test(value)) fail("快照路径无效或重复");
  if (value.includes("\\") || value.includes("\u0000")) fail("快照路径无效或重复");
  const parts = value.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === ".." || EXCLUDED.has(part)))
    fail("快照路径无效或重复");
  const kind = parts[0];
  const relative = parts.slice(1).join("/");
  if (kind === "code" ? !isAllowedCodePath(relative) : !isAllowedProjectPath(relative))
    fail("快照路径不在允许清单内");
  return value;
}

function parseManifest(value: unknown): ProjectCheckpointManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("快照清单无效");
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    typeof record.createdAt !== "string" ||
    record.createdAt.length === 0 ||
    record.dependencies !== "install-from-lockfile" ||
    !Array.isArray(record.files) ||
    record.files.length === 0
  ) fail("快照清单无效");
  const seen = new Set<string>();
  const files: ProjectCheckpointEntry[] = [];
  for (const raw of record.files) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("快照文件元数据无效");
    const entry = raw as Record<string, unknown>;
    const relative = assertManifestRelativePath(entry.path);
    if (seen.has(relative)) fail("快照路径无效或重复");
    if (
      !Number.isSafeInteger(entry.bytes) ||
      (entry.bytes as number) < 0 ||
      !Number.isSafeInteger(entry.mode) ||
      (entry.mode as number) < 0 ||
      (entry.mode as number) > 0o777 ||
      typeof entry.sha256 !== "string" ||
      !SHA256_PATTERN.test(entry.sha256)
    ) fail("快照文件元数据无效");
    seen.add(relative);
    files.push({
      path: relative,
      bytes: entry.bytes as number,
      sha256: entry.sha256,
      mode: entry.mode as number,
    });
  }
  return {
    schemaVersion: 1,
    createdAt: record.createdAt,
    files,
    dependencies: "install-from-lockfile",
  };
}

async function readManifest(directory: string): Promise<ProjectCheckpointManifest> {
  const checkpoint = path.resolve(directory);
  await requireDirectory(checkpoint, "快照目录");
  await assertNoSymlinkParents(checkpoint, "checkpoint.json", "快照清单路径");
  const manifestPath = path.join(checkpoint, "checkpoint.json");
  const manifestInfo = await regularFileStat(manifestPath, "快照清单");
  if (manifestInfo.size > 2n * 1024n * 1024n) fail("快照清单过大");
  let parsed: unknown;
  try {
    const text = await readFile(manifestPath, "utf8");
    const after = await regularFileStat(manifestPath, "快照清单");
    if (!sameStat(manifestInfo, after)) fail("快照清单在读取期间发生变化，请重试");
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) fail("快照清单无效");
    throw error;
  }
  return parseManifest(parsed);
}

/** Create an immutable, checksummed source+project pair. Never restore over a live project. */
export async function createProjectCheckpoint(options: CheckpointOptions): Promise<ProjectCheckpointManifest> {
  const repo = path.resolve(options.repo);
  const project = path.resolve(options.project);
  const destination = path.resolve(options.destination);
  await requireDirectory(repo, "代码目录");
  await requireDirectory(project, "工程目录");
  if (
    destination === repo ||
    destination === project ||
    inside(repo, destination) ||
    inside(project, destination)
  ) fail("快照目录必须位于代码与工程目录之外");
  await assertNoSymlinkParents(path.dirname(destination), path.basename(destination), "快照目标路径");
  if (await exists(destination)) fail("快照目标已存在");
  const stage = `${destination}.partial-${randomUUID()}`;
  await mkdir(path.dirname(stage), {recursive: true});
  await mkdir(stage, {recursive: false});
  const entries: ProjectCheckpointEntry[] = [];
  try {
    const initialSources = await collectSources(repo, project);
    for (const source of initialSources) {
      const target = path.join(stage, source.kind, ...source.relative.split("/"));
      await mkdir(path.dirname(target), {recursive: true});
      const copied = await copyAndVerify(source.absolute, target);
      entries.push({
        path: `${source.kind}/${source.relative}`,
        bytes: copied.bytes,
        sha256: copied.sha256,
        mode: copied.mode,
      });
    }
    await options.beforeFinalScan?.();
    const finalSources = await collectSources(repo, project);
    assertSameSourceSet(initialSources, finalSources);
    const finalByKey = new Map(finalSources.map((source) => [sourceKey(source), source]));
    for (const entry of entries) {
      const slash = entry.path.indexOf("/");
      const source = finalByKey.get(`${entry.path.slice(0, slash)}/${entry.path.slice(slash + 1)}`);
      if (!source) fail("复制期间源码或工程文件集合发生变化，请保存后重试");
      const current = await digestFileStable(source.absolute, `源文件 ${source.absolute}`);
      if (
        current.bytes !== entry.bytes ||
        current.sha256 !== entry.sha256 ||
        current.mode !== entry.mode
      ) fail("复制期间工程或源码发生变化，请保存后重试");
    }
    const manifest: ProjectCheckpointManifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      files: entries,
      dependencies: "install-from-lockfile",
    };
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    if (Buffer.byteLength(manifestText, "utf8") > 2 * 1024 * 1024)
      fail("快照清单过大");
    await writeFile(path.join(stage, "checkpoint.json"), manifestText, {
      flag: "wx",
      encoding: "utf8",
      mode: 0o600,
    });
    await publishDirectoryNoReplace(stage, destination);
    return manifest;
  } catch (error) {
    await rm(stage, {recursive: true, force: true});
    throw error;
  }
}

export async function verifyProjectCheckpoint(directory: string): Promise<ProjectCheckpointManifest> {
  const checkpoint = path.resolve(directory);
  const manifest = await readManifest(checkpoint);
  for (const entry of manifest.files) {
    await assertNoSymlinkParents(checkpoint, entry.path, `快照文件 ${entry.path}`);
    const file = path.join(checkpoint, ...entry.path.split("/"));
    const actual = await digestFileStable(file, `快照文件 ${entry.path}`);
    if (
      actual.bytes !== entry.bytes ||
      actual.sha256 !== entry.sha256 ||
      actual.mode !== entry.mode
    ) fail(`快照校验失败：${entry.path}`);
  }
  return manifest;
}

export async function restoreProjectCheckpoint(
  checkpoint: string,
  destination: string,
): Promise<ProjectCheckpointManifest> {
  const sourceDirectory = path.resolve(checkpoint);
  const manifest = await verifyProjectCheckpoint(sourceDirectory);
  const targetDirectory = path.resolve(destination);
  await assertNoSymlinkParents(path.dirname(targetDirectory), path.basename(targetDirectory), "恢复目标路径");
  if (await exists(targetDirectory)) fail("恢复目标必须是不存在的新目录，不能覆盖当前工程");
  const stage = `${targetDirectory}.partial-${randomUUID()}`;
  await mkdir(path.dirname(stage), {recursive: true});
  await mkdir(stage, {recursive: false});
  try {
    for (const entry of manifest.files) {
      const source = path.join(sourceDirectory, ...entry.path.split("/"));
      const target = path.join(stage, ...entry.path.split("/"));
      await copyAndVerify(source, target, entry);
    }
    await copyAndVerify(
      path.join(sourceDirectory, "checkpoint.json"),
      path.join(stage, "checkpoint.json"),
    );
    await verifyProjectCheckpoint(stage);
    await publishDirectoryNoReplace(stage, targetDirectory);
    return manifest;
  } catch (error) {
    await rm(stage, {recursive: true, force: true});
    throw error;
  }
}
