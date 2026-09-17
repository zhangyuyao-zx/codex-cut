import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat} from 'node:fs/promises';
import path from 'node:path';
import {buildCutRenderPlan} from './cut-render-plan';
import {CUT_FPS} from './cut-timeline';

const IDENTITY_CONTRACT_VERSION = 1 as const;
const MAX_CACHE_ENTRIES = 256;
const MEDIA_URL_PREFIX = '/cut-media/';

export type ContentDigest = (absoluteFile: string) => Promise<string>;

export type CutInputIdentity = Readonly<{
  inputHash: string;
  files: readonly Readonly<{
    fileName: string;
    sha256: string;
  }>[];
}>;

export type CutIdentityState = Readonly<{
  timeline?: unknown;
  asset?: Readonly<{
    url: string;
  }> | null;
  ranges: readonly Readonly<{
    startMs: number;
    endMs: number;
  }>[];
  /** Accepted for state compatibility and intentionally excluded from identity. */
  revision?: unknown;
  preview?: unknown;
  words?: readonly unknown[];
}>;

export type CutPreviewProvenance = Readonly<{
  version: 1;
  inputHash: string;
  contentHash: string;
  encodingHash: string;
  renderSource?: Readonly<{
    url: string;
    contentHash: string;
  }>;
}>;

export type CutPreviewIdentityState = CutIdentityState & Readonly<{
  revision: number;
  preview: Readonly<{
    url: string;
    revision: number;
    provenance?: CutPreviewProvenance;
  }> | null;
}>;

type FileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}>;

type CachedDigest = Readonly<{
  identity: FileIdentity;
  sha256: string;
}>;

type InFlightDigest = Readonly<{
  identity: FileIdentity;
  promise: Promise<string>;
}>;

type LegacyRange = Readonly<{
  startMs: number;
  endMs: number;
}>;

type LegacyRenderPlan = Readonly<{
  files: readonly string[];
  rangesMs: readonly LegacyRange[];
  sourceFrameRanges: readonly Readonly<{
    startFrame: number;
    endFrame: number;
  }>[];
}>;

function fail(message: string): never {
  throw new Error(`无法建立粗剪媒体身份：${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function readFileIdentity(absoluteFile: string): Promise<FileIdentity> {
  let metadata: Awaited<ReturnType<typeof lstat>>;
  try {
    metadata = await lstat(absoluteFile, {bigint: true});
  } catch (error) {
    throw new Error(`媒体文件不可读：${absoluteFile}`, {cause: error});
  }
  if (!metadata.isFile()) fail(`媒体路径必须是普通文件：${absoluteFile}`);
  return {
    dev: metadata.dev,
    ino: metadata.ino,
    size: metadata.size,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
  };
}

function touchCache(cache: Map<string, CachedDigest>, absoluteFile: string, entry: CachedDigest): void {
  cache.delete(absoluteFile);
  cache.set(absoluteFile, entry);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function hashAndVerify(
  absoluteFile: string,
  before: FileIdentity,
): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(absoluteFile);
  try {
    for await (const chunk of stream) hash.update(chunk as Buffer);
  } finally {
    stream.destroy();
  }
  const after = await readFileIdentity(absoluteFile);
  if (!sameFileIdentity(before, after)) {
    throw new Error(`媒体文件在读取期间发生变化，未缓存哈希：${absoluteFile}`);
  }
  return hash.digest('hex');
}

/**
 * Create an instance-local, stat-validated SHA-256 file digester.
 *
 * The stream is never materialized as one buffer. `ctimeNs` is included so a
 * same-size rewrite that restores mtime still invalidates the cache. A file
 * replacement or mutation during the stream fails closed after the read.
 */
export function createContentDigester(): ContentDigest {
  const cache = new Map<string, CachedDigest>();
  const inFlight = new Map<string, InFlightDigest>();

  return async (absoluteFile: string): Promise<string> => {
    if (typeof absoluteFile !== 'string' || !path.isAbsolute(absoluteFile)) {
      fail('digest 输入必须是绝对文件路径');
    }
    const before = await readFileIdentity(absoluteFile);
    const cached = cache.get(absoluteFile);
    if (cached && sameFileIdentity(cached.identity, before)) {
      touchCache(cache, absoluteFile, cached);
      return cached.sha256;
    }

    const running = inFlight.get(absoluteFile);
    if (running && sameFileIdentity(running.identity, before)) return running.promise;

    const promise = hashAndVerify(absoluteFile, before).then((sha256) => {
      touchCache(cache, absoluteFile, {identity: before, sha256});
      return sha256;
    });
    inFlight.set(absoluteFile, {identity: before, promise});
    void promise.then(
      () => {
        if (inFlight.get(absoluteFile)?.promise === promise) inFlight.delete(absoluteFile);
      },
      () => {
        if (inFlight.get(absoluteFile)?.promise === promise) inFlight.delete(absoluteFile);
      },
    );
    return promise;
  };
}

function parseLegacyProxyFileName(url: unknown): string {
  if (typeof url !== 'string' || !url.startsWith(MEDIA_URL_PREFIX)) {
    fail('legacy 素材 URL 必须以 /cut-media/ 开头');
  }
  const rawName = url.slice(MEDIA_URL_PREFIX.length);
  if (!rawName || rawName === '.' || rawName === '..' || rawName.includes('/') || rawName.includes('\\') ||
      rawName.includes('?') || rawName.includes('#') || rawName.includes('\u0000')) {
    fail('legacy 素材 URL 必须只包含一个安全文件名');
  }
  let decodedName: string;
  try {
    decodedName = decodeURIComponent(rawName);
  } catch {
    fail('legacy 素材 URL 含有无效编码');
  }
  if (!decodedName || decodedName === '.' || decodedName === '..' || decodedName.includes('/') ||
      decodedName.includes('\\') || decodedName.includes('\u0000')) {
    fail('legacy 素材 URL 不能包含路径穿越');
  }
  return rawName;
}

function parseLegacyRanges(state: CutIdentityState): LegacyRange[] {
  if (!Array.isArray(state.ranges) || state.ranges.length === 0) {
    fail('legacy state 必须包含至少一个毫秒范围');
  }
  const ranges: LegacyRange[] = [];
  let previousEndMs = 0;
  for (const [index, range] of state.ranges.entries()) {
    if (!isRecord(range) || !isFiniteNonNegative(range.startMs) || !isFiniteNonNegative(range.endMs) ||
        range.endMs <= range.startMs) {
      fail(`legacy 范围 ${index} 必须满足 0 <= startMs < endMs`);
    }
    if (index > 0 && range.startMs < previousEndMs) {
      fail('legacy 范围必须按时间顺序且不能重叠');
    }
    const parsed = {startMs: range.startMs, endMs: range.endMs};
    ranges.push(parsed);
    previousEndMs = parsed.endMs;
  }
  return ranges;
}

function buildLegacyRenderPlan(state: CutIdentityState): LegacyRenderPlan {
  if (!isRecord(state.asset) || state.asset === null) fail('legacy state 缺少素材');
  const proxyFileName = parseLegacyProxyFileName(state.asset.url);
  const rangesMs = parseLegacyRanges(state);
  const sourceFrameRanges = rangesMs.map((range) => {
    const startFrame = Math.round(range.startMs * CUT_FPS / 1000);
    const endFrame = Math.round(range.endMs * CUT_FPS / 1000);
    if (endFrame <= startFrame) fail('legacy 范围经过旧 FFmpeg 帧取整后为空');
    return {startFrame, endFrame};
  });
  return {
    files: [proxyFileName],
    rangesMs,
    sourceFrameRanges,
  };
}

function hashIdentityDocument(document: unknown): string {
  return createHash('sha256').update(JSON.stringify(document)).digest('hex');
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function previewFailure(message: string): never {
  throw new Error(`预览校验失败，需要重新生成预览：${message}`);
}

/**
 * Build a deterministic identity for the media and render-affecting cut data.
 * Timeline render plans are generated by the same plan builder used for export;
 * legacy ranges are retained as a conservative whole-input identity.
 */
export async function buildCutInputIdentity(
  state: CutIdentityState,
  directory: string,
  digest: ContentDigest,
): Promise<CutInputIdentity> {
  if (!isRecord(state)) fail('state 必须是对象');
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
    fail('媒体目录必须是绝对路径');
  }
  if (typeof digest !== 'function') fail('必须传入文件内容 digest 函数');

  const timelineEnabled = Object.prototype.hasOwnProperty.call(state, 'timeline') && state.timeline !== undefined;
  const mode = timelineEnabled ? 'timeline' : 'legacy';
  const renderPlan = timelineEnabled
    ? buildCutRenderPlan(state.timeline)
    : buildLegacyRenderPlan(state);
  const fileNames = renderPlan.files;
  const files: Array<{fileName: string; sha256: string}> = [];
  for (const fileName of fileNames) {
    const absoluteFile = path.join(directory, fileName);
    if (!path.isAbsolute(absoluteFile)) fail(`媒体文件路径必须保持绝对路径：${fileName}`);
    files.push({fileName, sha256: await digest(absoluteFile)});
  }

  const identityDocument = {
    contractVersion: IDENTITY_CONTRACT_VERSION,
    mode,
    renderPlan,
    files,
  };
  return {
    inputHash: hashIdentityDocument(identityDocument),
    files,
  };
}

/**
 * Verify the current preview against its saved input/content provenance.
 * A preview without provenance is accepted only as a legacy readable-file
 * compatibility path; it is never treated as a complete identity proof.
 */
export async function verifyCutPreviewIdentity(
  state: CutPreviewIdentityState,
  directory: string,
  digest: ContentDigest,
): Promise<void> {
  try {
    if (!isRecord(state) || !Number.isSafeInteger(state.revision) || state.revision < 0) {
      previewFailure('当前工程 revision 无效');
    }
    const preview = state.preview;
    if (!isRecord(preview)) previewFailure('当前工程没有可验证的预览');
    if (preview.revision !== state.revision) {
      previewFailure('预览对应旧工程版本');
    }
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
      previewFailure('媒体目录必须是绝对路径');
    }
    if (typeof digest !== 'function') previewFailure('缺少文件内容 digest 函数');
    const previewFileName = parseLegacyProxyFileName(preview.url);
    const previewFile = path.join(directory, previewFileName);

    if (preview.provenance === undefined) {
      // Legacy previews have no input/content proof. Reading through the
      // injected digester still verifies existence and ordinary-file status.
      await digest(previewFile);
      return;
    }

    if (!isRecord(preview.provenance) || preview.provenance.version !== 1 ||
        !isSha256(preview.provenance.inputHash) ||
        !isSha256(preview.provenance.contentHash) ||
        !isSha256(preview.provenance.encodingHash)) {
      previewFailure('预览 provenance 版本或 hash 格式无效');
    }

    let renderSourceFile: string | undefined;
    let renderSourceHashExpected: string | undefined;
    const renderSource = preview.provenance.renderSource;
    if (renderSource !== undefined) {
      if (!isRecord(renderSource) || typeof renderSource.url !== 'string' ||
          !isSha256(renderSource.contentHash)) {
        previewFailure('预览 provenance 内部渲染源格式无效');
      }
      const renderSourceFileName = parseLegacyProxyFileName(renderSource.url);
      if (!renderSourceFileName.endsWith('.mkv')) {
        previewFailure('预览 provenance 内部渲染源必须是 .mkv 文件');
      }
      renderSourceFile = path.join(directory, renderSourceFileName);
      renderSourceHashExpected = renderSource.contentHash;
    }

    // Keep this order deliberate: source inputs are validated before the
    // generated preview is read, so callers never accept a preview for changed inputs.
    const inputIdentity = await buildCutInputIdentity(state, directory, digest);
    if (inputIdentity.inputHash !== preview.provenance.inputHash) {
      previewFailure('粗剪输入已变化');
    }
    const contentHash = await digest(previewFile);
    if (contentHash !== preview.provenance.contentHash) {
      previewFailure('预览文件内容已变化');
    }
    if (renderSourceFile !== undefined && renderSourceHashExpected !== undefined) {
      const renderSourceHash = await digest(renderSourceFile);
      if (renderSourceHash !== renderSourceHashExpected) {
        previewFailure('内部渲染源文件内容已变化');
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('预览校验失败，需要重新生成预览：')) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`预览校验失败，需要重新生成预览：${detail}`, {cause: error});
  }
}
