import {createHash, randomUUID} from "node:crypto";
import {createReadStream, createWriteStream} from "node:fs";
import {mkdtemp, lstat, mkdir, open, realpath, rm, unlink, link} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const ANIMATION_PACKAGE_MAGIC = "CUTANIMATION" as const;
export const ANIMATION_PACKAGE_SCHEMA_VERSION = 1 as const;
export const ANIMATION_PACKAGE_MAX_BYTES = 1024 ** 3;
export const ANIMATION_PACKAGE_MAX_FILES = 4096;
export const ANIMATION_PACKAGE_MAX_MANIFEST_BYTES = 2 * 1024 ** 2;

const HEADER_BYTES = Buffer.byteLength(ANIMATION_PACKAGE_MAGIC) + 1 + 1 + 4;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ANIMATION_PACKAGE_EXTERNAL_PACKAGES = [
  "react",
  "react/*",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "remotion",
  "remotion/*",
  "@remotion/*",
] as const;

export interface AnimationPackageFile {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

export interface AnimationPackageManifest {
  readonly magic: typeof ANIMATION_PACKAGE_MAGIC;
  readonly schemaVersion: typeof ANIMATION_PACKAGE_SCHEMA_VERSION;
  readonly templateId: string;
  readonly template: unknown;
  readonly external: Readonly<{
    readonly packages: readonly string[];
    readonly runtime: string;
    readonly bundled: false;
  }>;
  readonly files: readonly AnimationPackageFile[];
}

export interface AnimationPackageSourceFile {
  readonly path: string;
  readonly sourcePath: string;
}

export interface ExportAnimationPackageInput {
  readonly templateId: string;
  readonly template: unknown;
  readonly files: readonly AnimationPackageSourceFile[];
  readonly outputFile: string;
}

export interface ExportAnimationPackageResult {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
  readonly templateId: string;
}

export interface ImportedAnimationPackage {
  readonly manifest: AnimationPackageManifest;
  readonly stagingDirectory: string;
}

function fail(message: string): never {
  throw new Error(`动画包无效：${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], context: string): void {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) fail(`${context}包含不支持字段：${key}`);
  }
  for (const key of keys) {
    if (!(key in value)) fail(`${context}缺少字段：${key}`);
  }
}

function assertSafeArchivePath(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0)
    fail(`${context}必须是非空相对路径`);
  if (value.includes("\\") || value.includes("\u0000") || path.posix.isAbsolute(value))
    fail(`${context}不是安全相对路径`);
  const parts = value.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === ".."))
    fail(`${context}包含非法路径段`);
  return value;
}

function assertPackageManifest(value: unknown): AnimationPackageManifest {
  if (!isRecord(value)) fail("manifest 必须是对象");
  assertExactKeys(value, ["magic", "schemaVersion", "templateId", "template", "external", "files"], "manifest");
  if (value.magic !== ANIMATION_PACKAGE_MAGIC)
    fail("magic 不匹配");
  if (value.schemaVersion !== ANIMATION_PACKAGE_SCHEMA_VERSION)
    fail("schemaVersion 不支持");
  if (typeof value.templateId !== "string" || !value.templateId.trim())
    fail("templateId 无效");
  if (!isRecord(value.template)) fail("template 必须是完整对象");
  if (!isRecord(value.external)) fail("external 必须是对象");
  assertExactKeys(value.external, ["packages", "runtime", "bundled"], "manifest.external");
  if (!Array.isArray(value.external.packages) || value.external.packages.some((item) => typeof item !== "string" || !item))
    fail("external.packages 无效");
  if (new Set(value.external.packages).size !== value.external.packages.length)
    fail("external.packages 不能包含重复项");
  if (typeof value.external.runtime !== "string" || !value.external.runtime)
    fail("external.runtime 无效");
  if (value.external.bundled !== false)
    fail("动画包不能伪称已打包运行时");
  if (!Array.isArray(value.files)) fail("files 必须是数组");
  if (value.files.length < 1 || value.files.length > ANIMATION_PACKAGE_MAX_FILES)
    fail(`files 数量必须在 1-${ANIMATION_PACKAGE_MAX_FILES} 之间`);
  const paths = new Set<string>();
  let total = 0;
  const files: AnimationPackageFile[] = [];
  for (const [index, raw] of value.files.entries()) {
    if (!isRecord(raw)) fail(`files[${index}] 无效`);
    assertExactKeys(raw, ["path", "size", "sha256"], `files[${index}]`);
    const filePath = assertSafeArchivePath(raw.path, `files[${index}].path`);
    if (paths.has(filePath)) fail(`files 存在重复路径：${filePath}`);
    paths.add(filePath);
    if (typeof raw.size !== "number" || !Number.isSafeInteger(raw.size) || raw.size < 0)
      fail(`files[${index}].size 无效`);
    if (typeof raw.sha256 !== "string" || !SHA256_PATTERN.test(raw.sha256))
      fail(`files[${index}].sha256 无效`);
    total += raw.size;
    if (!Number.isSafeInteger(total)) fail("文件总大小超出安全整数范围");
    files.push({path: filePath, size: raw.size, sha256: raw.sha256});
  }
  return {
    magic: ANIMATION_PACKAGE_MAGIC,
    schemaVersion: ANIMATION_PACKAGE_SCHEMA_VERSION,
    templateId: value.templateId,
    template: value.template,
    external: {
      packages: [...value.external.packages] as string[],
      runtime: value.external.runtime,
      bundled: false,
    },
    files,
  };
}

function sameStat(left: any, right: any): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function regularStat(file: string): Promise<any> {
  let info: any;
  try {
    info = await lstat(file, {bigint: true});
  } catch (error) {
    throw new Error(`动画包文件不可读：${file}`, {cause: error});
  }
  if (!info.isFile() || info.isSymbolicLink())
    fail(`动画包文件必须是普通文件：${file}`);
  return info;
}

async function digestFile(file: string): Promise<{readonly size: number; readonly sha256: string}> {
  const before = await regularStat(file);
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    size += (chunk as Buffer).length;
    hash.update(chunk as Buffer);
  }
  const after = await regularStat(file);
  if (!sameStat(before, after)) fail(`文件在读取期间发生变化：${file}`);
  if (size !== Number(before.size)) fail(`文件大小读取不一致：${file}`);
  return {size, sha256: hash.digest("hex")};
}

function canonicalJson(value: unknown, depth = 0): string {
  if (depth > 256) fail("JSON 嵌套层数超过 256");
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item, depth + 1)).join(",")}]`;
  if (isRecord(value))
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key], depth + 1)}`).join(",")}}`;
  return JSON.stringify(value);
}

async function writeChunk(stream: NodeJS.WritableStream & {write(chunk: Buffer, callback?: (error?: Error | null) => void): boolean}, chunk: Buffer): Promise<void> {
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

async function closeWriter(stream: NodeJS.WritableStream & {end(callback?: () => void): void}): Promise<void> {
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

function makeHeader(manifestBytes: number): Buffer {
  const header = Buffer.alloc(HEADER_BYTES);
  Buffer.from(ANIMATION_PACKAGE_MAGIC, "ascii").copy(header, 0);
  header.writeUInt8(ANIMATION_PACKAGE_SCHEMA_VERSION, Buffer.byteLength(ANIMATION_PACKAGE_MAGIC));
  header.writeUInt8(0, Buffer.byteLength(ANIMATION_PACKAGE_MAGIC) + 1);
  header.writeUInt32BE(manifestBytes, Buffer.byteLength(ANIMATION_PACKAGE_MAGIC) + 2);
  return header;
}

async function readExact(handle: Awaited<ReturnType<typeof open>>, offset: number, length: number): Promise<Buffer> {
  const output = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const result = await handle.read(output, read, length - read, offset + read);
    if (result.bytesRead === 0) fail("文件截断");
    read += result.bytesRead;
  }
  return output;
}

async function copyPackageRange(
  handle: Awaited<ReturnType<typeof open>>,
  start: number,
  size: number,
  destination: string,
): Promise<{readonly size: number; readonly sha256: string}> {
  await mkdir(path.dirname(destination), {recursive: true});
  const output = createWriteStream(destination, {flags: "wx", mode: 0o600});
  const hash = createHash("sha256");
  let written = 0;
  try {
    if (size > 0) {
      const input = handle.createReadStream({start, end: start + size - 1, autoClose: false});
      for await (const chunk of input) {
        const bytes = chunk as Buffer;
        written += bytes.length;
        hash.update(bytes);
        await writeChunk(output, bytes);
      }
    }
    await closeWriter(output);
  } catch (error) {
    output.destroy();
    await unlink(destination).catch(() => undefined);
    throw error;
  }
  return {size: written, sha256: hash.digest("hex")};
}

async function packageFilesFromManifest(manifest: AnimationPackageManifest): Promise<number> {
  let total = 0;
  for (const file of manifest.files) total += file.size;
  if (HEADER_BYTES + total > ANIMATION_PACKAGE_MAX_BYTES)
    fail("动画包超过 1GiB 上限");
  return total;
}

export async function exportAnimationPackage(input: ExportAnimationPackageInput): Promise<ExportAnimationPackageResult> {
  if (!path.isAbsolute(input.outputFile)) fail("导出目标必须是绝对路径");
  if (typeof input.templateId !== "string" || !input.templateId.trim()) fail("templateId 无效");
  if (!Array.isArray(input.files) || input.files.length === 0) fail("导出文件不能为空");
  const sourceFiles: AnimationPackageFile[] = [];
  const paths = new Set<string>();
  for (const source of input.files) {
    const archivePath = assertSafeArchivePath(source.path, "导出文件路径");
    if (paths.has(archivePath)) fail(`导出文件存在重复路径：${archivePath}`);
    paths.add(archivePath);
    if (!path.isAbsolute(source.sourcePath)) fail(`导出源必须是绝对路径：${source.sourcePath}`);
    const summary = await digestFile(source.sourcePath);
    sourceFiles.push({path: archivePath, ...summary});
  }
  const manifestValue = {
    magic: ANIMATION_PACKAGE_MAGIC,
    schemaVersion: ANIMATION_PACKAGE_SCHEMA_VERSION,
    templateId: input.templateId,
    template: input.template,
    external: {
      packages: [...ANIMATION_PACKAGE_EXTERNAL_PACKAGES],
      runtime: "React/Remotion host runtime is required; source is not executed during import",
      bundled: false,
    },
    files: sourceFiles,
  } satisfies AnimationPackageManifest;
  const manifestBytes = Buffer.from(JSON.stringify(manifestValue));
  if (manifestBytes.length > ANIMATION_PACKAGE_MAX_MANIFEST_BYTES)
    fail("manifest 超过 2MiB 上限");
  const manifest = assertPackageManifest(manifestValue);
  const payloadBytes = await packageFilesFromManifest(manifest);
  const totalSize = HEADER_BYTES + manifestBytes.length + payloadBytes;
  if (totalSize > ANIMATION_PACKAGE_MAX_BYTES) fail("动画包超过 1GiB 上限");
  await mkdir(path.dirname(input.outputFile), {recursive: true});
  let output: ReturnType<typeof createWriteStream> | undefined;
  let outputHandle: Awaited<ReturnType<typeof open>> | undefined;
  let created = false;
  const packageHash = createHash("sha256");
  let written = 0;
  try {
    // Reserve the destination with the promise API first. A createWriteStream
    // opened directly with `wx` reports EEXIST asynchronously, which can race
    // the first write and leave an unhandled stream error while also making it
    // unsafe to decide whether this call created the file.
    outputHandle = await open(input.outputFile, "wx", 0o600);
    created = true;
    output = createWriteStream(input.outputFile, {
      fd: outputHandle.fd,
      autoClose: false,
    });
    const write = async (bytes: Buffer) => {
      packageHash.update(bytes);
      written += bytes.length;
      await writeChunk(output!, bytes);
    };
    await write(makeHeader(manifestBytes.length));
    await write(manifestBytes);
    for (const [index, source] of input.files.entries()) {
      const expected = sourceFiles[index];
      const before = await regularStat(source.sourcePath);
      const hash = createHash("sha256");
      let size = 0;
      for await (const chunk of createReadStream(source.sourcePath)) {
        const bytes = chunk as Buffer;
        size += bytes.length;
        hash.update(bytes);
        await write(bytes);
      }
      const after = await regularStat(source.sourcePath);
      const sha256 = hash.digest("hex");
      if (!sameStat(before, after) || size !== expected.size || sha256 !== expected.sha256)
        fail(`源文件在导出期间发生变化：${source.sourcePath}`);
    }
    await closeWriter(output);
    output = undefined;
    await outputHandle.close();
    outputHandle = undefined;
    if (written !== totalSize) fail("导出包大小不一致");
    return {
      path: input.outputFile,
      size: written,
      sha256: packageHash.digest("hex"),
      templateId: input.templateId,
    };
  } catch (error) {
    output?.destroy();
    await outputHandle?.close().catch(() => undefined);
    if (created) await unlink(input.outputFile).catch(() => undefined);
    throw error;
  }
}

export async function readAnimationPackage(packageFile: string): Promise<ImportedAnimationPackage> {
  if (!path.isAbsolute(packageFile)) fail("导入包路径必须是绝对路径");
  const packageInfo = await regularStat(packageFile);
  const packageSize = Number(packageInfo.size);
  if (!Number.isSafeInteger(packageSize) || packageSize > ANIMATION_PACKAGE_MAX_BYTES)
    fail("动画包超过 1GiB 上限");
  const handle = await open(packageFile, "r");
  let stagingDirectory = "";
  try {
    const openedInfo = await handle.stat({bigint: true});
    if (Number(openedInfo.size) !== packageSize) fail("动画包在读取前已变化");
    if (packageSize < HEADER_BYTES) fail("动画包头部不完整");
    const header = await readExact(handle, 0, HEADER_BYTES);
    const magic = header.subarray(0, Buffer.byteLength(ANIMATION_PACKAGE_MAGIC)).toString("ascii");
    if (magic !== ANIMATION_PACKAGE_MAGIC) fail("magic 不匹配");
    const versionOffset = Buffer.byteLength(ANIMATION_PACKAGE_MAGIC);
    if (header.readUInt8(versionOffset) !== ANIMATION_PACKAGE_SCHEMA_VERSION)
      fail("schemaVersion 不支持");
    if (header.readUInt8(versionOffset + 1) !== 0) fail("头部 flags 不支持");
    const manifestLength = header.readUInt32BE(versionOffset + 2);
    if (manifestLength > ANIMATION_PACKAGE_MAX_MANIFEST_BYTES)
      fail("manifest 超过 2MiB 上限");
    if (HEADER_BYTES + manifestLength > packageSize) fail("manifest 被截断");
    const manifestBytes = await readExact(handle, HEADER_BYTES, manifestLength);
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestBytes.toString("utf8")) as unknown;
    } catch {
      fail("manifest 不是有效 JSON");
    }
    const manifest = assertPackageManifest(parsed);
    const payloadBytes = await packageFilesFromManifest(manifest);
    const expectedTotal = HEADER_BYTES + manifestLength + payloadBytes;
    if (expectedTotal !== packageSize)
      fail("动画包存在截断或尾部额外数据");
    // Keep the staging root canonical. On macOS the temporary directory often
    // lives below /var, which is a system symlink; callers only need to reject
    // symlinks created inside this freshly-owned staging tree.
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-animation-package-"));
    try {
      stagingDirectory = await realpath(temporaryDirectory);
    } catch (error) {
      await rm(temporaryDirectory, {recursive: true, force: true});
      throw error;
    }
    let offset = HEADER_BYTES + manifestLength;
    for (const file of manifest.files) {
      const stagedPath = path.join(stagingDirectory, ...file.path.split("/"));
      const copied = await copyPackageRange(handle, offset, file.size, stagedPath);
      if (copied.size !== file.size || copied.sha256 !== file.sha256)
        fail(`文件内容 hash 不匹配：${file.path}`);
      offset += file.size;
    }
    const afterInfo = await handle.stat({bigint: true});
    const pathInfo = await regularStat(packageFile);
    if (!sameStat(openedInfo, afterInfo) || !sameStat(openedInfo, pathInfo))
      fail("动画包在读取期间发生变化");
    await handle.close();
    return {manifest, stagingDirectory};
  } catch (error) {
    await handle.close().catch(() => undefined);
    if (stagingDirectory) await rm(stagingDirectory, {recursive: true, force: true});
    throw error;
  }
}

export async function publishAnimationPackageFile(source: string, destination: string): Promise<void> {
  const sourceInfo = await regularStat(source);
  await mkdir(path.dirname(destination), {recursive: true});
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    const output = createWriteStream(temporary, {flags: "wx", mode: 0o600});
    const input = createReadStream(source);
    for await (const chunk of input) await writeChunk(output, chunk as Buffer);
    await closeWriter(output);
    const copied = await digestFile(temporary);
    const sourceAfter = await regularStat(source);
    const sourceDigest = await digestFile(source);
    if (
      !sameStat(sourceInfo, sourceAfter) ||
      copied.size !== Number(sourceInfo.size) ||
      copied.sha256 !== sourceDigest.sha256
    )
      fail(`发布文件在复制期间发生变化：${source}`);
    await link(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

export async function removeImportedAnimationPackage(stagingDirectory: string): Promise<void> {
  if (stagingDirectory) await rm(stagingDirectory, {recursive: true, force: true});
}

export function packageJsonEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}
