import {randomUUID} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {access, lstat, mkdir, open, readFile, readdir, realpath, rename, stat, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile as nodeExecFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Router, type NextFunction, type Request, type Response} from 'express';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';

const execFile = promisify(nodeExecFile);

const SCHEMA_VERSION = 1 as const;
const MAX_UPLOAD_BYTES = 1024 ** 3;
const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STORED_FILE_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(png|jpe?g|webp|gif|mp4)$/iu;
const METADATA_FILE_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/iu;
const PUBLIC_URL_PREFIX = '/api/production/component-assets/file/';

type AssetKind = 'image' | 'video';

export interface ComponentAssetListItem {
  id: string;
  name: string;
  kind: AssetKind;
  url: string;
  durationFrames?: number;
}

export interface ResolvedComponentAsset extends ComponentAssetListItem {
  /** Absolute path to the service-owned immutable media file. */
  path: string;
  /** Alias kept explicit for render-copy callers that prefer this name. */
  absolutePath: string;
  fileName: string;
  extension: string;
  mimeType: string;
  size: number;
}

export interface ComponentAssetProbeStream {
  codec_type?: unknown;
  codec_name?: unknown;
  width?: unknown;
  height?: unknown;
  duration?: unknown;
  nb_frames?: unknown;
}

export interface ComponentAssetProbe {
  streams: readonly ComponentAssetProbeStream[];
  format?: {
    duration?: unknown;
    format_name?: unknown;
  };
}

export interface ComponentAssetsOptions {
  /** Override the executable in a test or a host with a bundled ffprobe. */
  ffprobePath?: string;
  /** Override the executable in a test or a host with a bundled ffmpeg. */
  ffmpegPath?: string;
  /** Replace ffprobe in focused tests; the file still passes signature checks. */
  probeMedia?: (filePath: string) => Promise<ComponentAssetProbe>;
  /** Replace ffmpeg in focused tests. The final argument is always the output path. */
  runFfmpeg?: (args: readonly string[]) => Promise<void>;
}

export type ComponentAssetErrorCode =
  | 'INVALID_UPLOAD'
  | 'NOT_FOUND'
  | 'PROBE_FAILED'
  | 'TOO_LARGE'
  | 'TRANSCODE_FAILED';

export class ComponentAssetError extends Error {
  public readonly code: ComponentAssetErrorCode;
  public readonly statusCode: number;

  public constructor(code: ComponentAssetErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = 'ComponentAssetError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface ImageSignature {
  extension: '.png' | '.jpg' | '.webp' | '.gif';
  mimeType: string;
}

interface StoredAsset {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  kind: AssetKind;
  fileName: string;
  extension: string;
  mimeType: string;
  url: string;
  size: number;
  durationFrames?: number;
  createdAt: string;
}

interface ValidatedVideo {
  codecName: string;
  durationFrames: number;
  formatName: string;
  width: number;
  height: number;
}

export interface ComponentAssetsService {
  router: ReturnType<typeof Router>;
  list(): Promise<ComponentAssetListItem[]>;
  resolve(id: string): Promise<ResolvedComponentAsset>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFinitePositiveNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function asPositiveDimension(value: unknown): number | null {
  const number = asFinitePositiveNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function notFound(id: string): ComponentAssetError {
  return new ComponentAssetError('NOT_FOUND', `素材不存在: ${id}`, 404);
}

function validateId(id: unknown): string {
  if (typeof id !== 'string' || !ASSET_ID_PATTERN.test(id)) {
    throw notFound(String(id ?? ''));
  }
  return id.toLowerCase();
}

function validateDisplayName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length === 0) return '上传素材';
  if (name.length > 255 || name.includes('\0') || [...name].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 && code !== 0x09;
  })) {
    throw new ComponentAssetError('INVALID_UPLOAD', '素材名称无效', 400);
  }
  return name;
}

async function readHeader(filePath: string): Promise<Buffer> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(512);
    const result = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, result.bytesRead);
  } finally {
    await handle.close();
  }
}

function detectImageSignature(header: Buffer): ImageSignature | null {
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {extension: '.png', mimeType: 'image/png'};
  }
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return {extension: '.jpg', mimeType: 'image/jpeg'};
  }
  if (header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') {
    return {extension: '.webp', mimeType: 'image/webp'};
  }
  if (header.length >= 6 && (header.toString('ascii', 0, 6) === 'GIF87a' || header.toString('ascii', 0, 6) === 'GIF89a')) {
    return {extension: '.gif', mimeType: 'image/gif'};
  }
  return null;
}

function looksLikeMp4(header: Buffer, formatName: string): boolean {
  if (header.length < 12 || header.toString('ascii', 4, 8) !== 'ftyp') return false;
  const majorBrand = header.toString('ascii', 8, 12).toLowerCase();
  if (majorBrand === 'qt  ' || majorBrand === 'm4a ' || majorBrand === 'm4b ') return false;
  const formatNames = formatName.split(',').map((value) => value.trim().toLowerCase());
  return formatNames.includes('mp4') || formatNames.length === 0;
}

function parseProbe(value: unknown): ComponentAssetProbe {
  if (!isRecord(value) || !Array.isArray(value.streams)) {
    throw new ComponentAssetError('PROBE_FAILED', 'ffprobe 未返回有效素材信息', 400);
  }
  const format = isRecord(value.format) ? value.format : undefined;
  return {
    streams: value.streams.filter(isRecord),
    format,
  };
}

function validateImageProbe(probe: ComponentAssetProbe): void {
  const stream = probe.streams.find((candidate) => candidate.codec_type === 'video');
  if (!stream || asPositiveDimension(stream.width) === null || asPositiveDimension(stream.height) === null) {
    throw new ComponentAssetError('INVALID_UPLOAD', '无法读取图片素材', 400);
  }
}

function validateVideoProbe(probe: ComponentAssetProbe): ValidatedVideo {
  const stream = probe.streams.find((candidate) => candidate.codec_type === 'video');
  if (!stream) throw new ComponentAssetError('INVALID_UPLOAD', '素材不包含可读取的视频画面', 400);
  const width = asPositiveDimension(stream.width);
  const height = asPositiveDimension(stream.height);
  if (width === null || height === null) throw new ComponentAssetError('INVALID_UPLOAD', '视频尺寸无效', 400);
  const streamDuration = asFinitePositiveNumber(stream.duration);
  const formatDuration = isRecord(probe.format) ? asFinitePositiveNumber(probe.format.duration) : null;
  const duration = streamDuration ?? formatDuration;
  if (duration === null) throw new ComponentAssetError('INVALID_UPLOAD', '视频时长无效', 400);
  const durationFrames = Math.round(duration * 30);
  if (!Number.isSafeInteger(durationFrames) || durationFrames <= 0) {
    throw new ComponentAssetError('INVALID_UPLOAD', '视频无法换算为30fps时间线', 400);
  }
  const codecName = typeof stream.codec_name === 'string' ? stream.codec_name.toLowerCase() : '';
  const formatName = typeof probe.format?.format_name === 'string' ? probe.format.format_name : '';
  return {codecName, durationFrames, formatName, width, height};
}

function toPublic(asset: StoredAsset): ComponentAssetListItem {
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    url: asset.url,
    ...(asset.durationFrames === undefined ? {} : {durationFrames: asset.durationFrames}),
  };
}

function parseStored(value: unknown, expectedId: string): StoredAsset {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION || value.id !== expectedId) {
    throw notFound(expectedId);
  }
  const fileName = value.fileName;
  if (typeof fileName !== 'string') throw notFound(expectedId);
  const fileMatch = fileName.match(STORED_FILE_PATTERN);
  if (!fileMatch || fileMatch[1]?.toLowerCase() !== expectedId) throw notFound(expectedId);
  if (typeof value.name !== 'string' || value.name.length === 0 || value.name.length > 255) throw notFound(expectedId);
  if (value.kind !== 'image' && value.kind !== 'video') throw notFound(expectedId);
  if (typeof value.extension !== 'string' || value.extension !== path.extname(fileName)) throw notFound(expectedId);
  if (typeof value.mimeType !== 'string' || !/^(image|video)\/[a-z0-9.+-]+$/iu.test(value.mimeType)) throw notFound(expectedId);
  if (value.url !== `${PUBLIC_URL_PREFIX}${expectedId}`) throw notFound(expectedId);
  if (typeof value.size !== 'number' || !Number.isSafeInteger(value.size) || value.size <= 0) throw notFound(expectedId);
  if (typeof value.createdAt !== 'string' || value.createdAt.length === 0) throw notFound(expectedId);
  const durationFrames = value.durationFrames;
  const normalizedDurationFrames: number | undefined = typeof durationFrames === 'number' ? durationFrames : undefined;
  if (durationFrames !== undefined && normalizedDurationFrames === undefined) throw notFound(expectedId);
  if (value.kind === 'video' && (normalizedDurationFrames === undefined || !Number.isSafeInteger(normalizedDurationFrames) || normalizedDurationFrames <= 0)) {
    throw notFound(expectedId);
  }
  if (value.kind === 'image' && normalizedDurationFrames !== undefined) throw notFound(expectedId);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: expectedId,
    name: value.name,
    kind: value.kind,
    fileName,
    extension: value.extension,
    mimeType: value.mimeType,
    url: value.url,
    size: value.size,
    ...(normalizedDurationFrames === undefined ? {} : {durationFrames: normalizedDurationFrames}),
    createdAt: value.createdAt,
  };
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(value), {encoding: 'utf8', flag: 'wx', mode: 0o600});
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

function routeError(error: unknown, response: Response, next: NextFunction): void {
  if (error instanceof ComponentAssetError) {
    response.status(error.statusCode).json({error: error.message, code: error.code});
    return;
  }
  next(error);
}

export async function createComponentAssets(dir: string, options: ComponentAssetsOptions = {}): Promise<ComponentAssetsService> {
  const serviceDir = path.resolve(dir);
  await mkdir(serviceDir, {recursive: true});
  const serviceDirRealPath = await realpath(serviceDir);
  const ffprobePath = options.ffprobePath ?? process.env.FFPROBE_PATH ?? 'ffprobe';
  const ffmpegPath = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg';

  async function probeMedia(filePath: string): Promise<ComponentAssetProbe> {
    if (options.probeMedia) return parseProbe(await options.probeMedia(filePath));
    try {
      const result = await execFile(ffprobePath, [
        '-v', 'error',
        '-print_format', 'json',
        '-show_streams',
        '-show_format',
        '-count_frames',
        filePath,
      ], {maxBuffer: 16 * 1024 * 1024});
      return parseProbe(JSON.parse(String(result.stdout)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ComponentAssetError('PROBE_FAILED', `无法验证素材：${message.slice(0, 400)}`, 400);
    }
  }

  async function runFfmpeg(args: readonly string[]): Promise<void> {
    if (options.runFfmpeg) {
      await options.runFfmpeg(args);
      return;
    }
    try {
      await execFile(ffmpegPath, [...args], {maxBuffer: 16 * 1024 * 1024});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ComponentAssetError('TRANSCODE_FAILED', `无法生成浏览器兼容视频：${message.slice(0, 400)}`, 400);
    }
  }

  async function readStored(id: string): Promise<StoredAsset> {
    const normalizedId = validateId(id);
    const metadataPath = path.join(serviceDir, `${normalizedId}.json`);
    try {
      const raw = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown;
      return parseStored(raw, normalizedId);
    } catch (error) {
      if (error instanceof ComponentAssetError) throw error;
      throw notFound(normalizedId);
    }
  }

  async function resolve(id: string): Promise<ResolvedComponentAsset> {
    const asset = await readStored(id);
    const absolutePath = path.resolve(serviceDir, asset.fileName);
    if (path.dirname(absolutePath) !== serviceDir) throw notFound(asset.id);
    try {
      const file = await lstat(absolutePath);
      if (!file.isFile() || file.isSymbolicLink() || file.size <= 0) throw notFound(asset.id);
      const canonicalPath = await realpath(absolutePath);
      if (path.dirname(canonicalPath) !== serviceDirRealPath || path.basename(canonicalPath) !== asset.fileName) throw notFound(asset.id);
    } catch (error) {
      if (error instanceof ComponentAssetError) throw error;
      throw notFound(asset.id);
    }
    return {...toPublic(asset), fileName: asset.fileName, extension: asset.extension, mimeType: asset.mimeType, size: asset.size, path: absolutePath, absolutePath};
  }

  async function list(): Promise<ComponentAssetListItem[]> {
    const entries = await readdir(serviceDir, {withFileTypes: true});
    const items: ComponentAssetListItem[] = [];
    for (const entry of entries) {
      const match = entry.isFile() ? entry.name.match(METADATA_FILE_PATTERN) : null;
      if (!match?.[1]) continue;
      try {
        const asset = await readStored(match[1]);
        await resolve(asset.id);
        items.push(toPublic(asset));
      } catch {
        // A half-written or externally damaged record is not exposed to clients.
      }
    }
    items.sort((left, right) => left.id.localeCompare(right.id));
    return items;
  }

  async function upload(request: Request): Promise<ComponentAssetListItem> {
    const queryName = Array.isArray(request.query.name) ? request.query.name[0] : request.query.name;
    const displayName = validateDisplayName(queryName);
    const contentLength = Number(request.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
      throw new ComponentAssetError('TOO_LARGE', '素材上限为1GB', 413);
    }

    const id = randomUUID();
    const uploadPath = path.join(serviceDir, `.upload-${id}.part`);
    let normalizedPath = '';
    let finalPath = '';
    let metadataPath = '';
    try {
      let bytes = 0;
      const limit = new Transform({
        transform(chunk: Buffer | string, _encoding, callback) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (bytes + buffer.length > MAX_UPLOAD_BYTES) {
            callback(new ComponentAssetError('TOO_LARGE', '素材上限为1GB', 413));
            return;
          }
          bytes += buffer.length;
          callback(null, buffer);
        },
      });
      await pipeline(request, limit, createWriteStream(uploadPath, {flags: 'wx', mode: 0o600}));
      const uploaded = await stat(uploadPath);
      if (!uploaded.isFile() || uploaded.size <= 0) throw new ComponentAssetError('INVALID_UPLOAD', '上传的素材为空', 400);

      const header = await readHeader(uploadPath);
      const imageSignature = detectImageSignature(header);
      const probe = await probeMedia(uploadPath);
      let kind: AssetKind;
      let extension: string;
      let mimeType: string;
      let durationFrames: number | undefined;
      let sourceForFinal = uploadPath;
      if (imageSignature?.extension === ".gif") throw new ComponentAssetError("INVALID_UPLOAD", "请将动图转换为视频后导入，以确保预览和导出时间一致", 400);
      if (imageSignature) {
        validateImageProbe(probe);
        kind = 'image';
        extension = imageSignature.extension;
        mimeType = imageSignature.mimeType;
      } else {
        const video = validateVideoProbe(probe);
        kind = 'video';
        extension = '.mp4';
        mimeType = 'video/mp4';
        durationFrames = video.durationFrames;
        if (!(video.codecName === 'h264' && looksLikeMp4(header, video.formatName))) {
          // Keep the temporary file hidden while retaining the .mp4 suffix so ffmpeg
          // can select the MP4 muxer from the output filename.
          normalizedPath = path.join(serviceDir, `.normalize-${id}.mp4`);
          await runFfmpeg([
            '-v', 'error',
            '-i', uploadPath,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-y', normalizedPath,
          ]);
          const normalizedStat = await stat(normalizedPath).catch(() => null);
          if (!normalizedStat?.isFile() || normalizedStat.size <= 0) throw new ComponentAssetError('TRANSCODE_FAILED', '视频代理文件为空', 400);
          const normalizedProbe = await probeMedia(normalizedPath);
          const normalizedVideo = validateVideoProbe(normalizedProbe);
          if (normalizedVideo.codecName !== 'h264') throw new ComponentAssetError('TRANSCODE_FAILED', '视频代理不是H.264格式', 400);
          durationFrames = normalizedVideo.durationFrames;
          sourceForFinal = normalizedPath;
        }
      }

      finalPath = path.join(serviceDir, `${id}${extension}`);
      await access(finalPath).then(() => { throw new ComponentAssetError('INVALID_UPLOAD', '素材ID冲突，请重试', 409); }).catch((error) => {
        if (error instanceof ComponentAssetError) throw error;
      });
      await rename(sourceForFinal, finalPath);
      const finalStat = await stat(finalPath);
      const stored: StoredAsset = {
        schemaVersion: SCHEMA_VERSION,
        id,
        name: displayName,
        kind,
        fileName: path.basename(finalPath),
        extension,
        mimeType,
        url: `${PUBLIC_URL_PREFIX}${id}`,
        size: finalStat.size,
        ...(durationFrames === undefined ? {} : {durationFrames}),
        createdAt: new Date().toISOString(),
      };
      metadataPath = path.join(serviceDir, `${id}.json`);
      await writeJsonAtomically(metadataPath, stored);
      return toPublic(stored);
    } catch (error) {
      if (error instanceof ComponentAssetError) throw error;
      throw new ComponentAssetError('INVALID_UPLOAD', error instanceof Error ? error.message : String(error), 400);
    } finally {
      await unlink(uploadPath).catch(() => undefined);
      if (normalizedPath) await unlink(normalizedPath).catch(() => undefined);
      if (finalPath && metadataPath) {
        const metadataCommitted = await access(metadataPath).then(() => true, () => false);
        if (!metadataCommitted) await unlink(finalPath).catch(() => undefined);
      } else if (finalPath) {
        await unlink(finalPath).catch(() => undefined);
      }
    }
  }

  const router = Router();
  router.get('/', async (_request, response, next) => {
    try {
      response.json({items: await list()});
    } catch (error) {
      routeError(error, response, next);
    }
  });
  router.post('/', async (request, response, next) => {
    try {
      response.status(201).json(await upload(request));
    } catch (error) {
      routeError(error, response, next);
    }
  });
  router.get('/file/:id', async (request, response, next) => {
    try {
      const asset = await resolve(request.params.id);
      response.setHeader('Content-Type', asset.mimeType);
      response.sendFile(asset.path, {dotfiles: 'deny'}, (error) => {
        if (error && !response.headersSent) next(error);
      });
    } catch (error) {
      routeError(error, response, next);
    }
  });

  return {router, list, resolve};
}
