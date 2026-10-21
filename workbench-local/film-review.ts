import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {createContentDigester} from './cut-media-identity';

export type FilmReviewScene = {
  sceneId: string; title: string; key: string; from: number; end: number;
  candidateFrames?: number[];
  render?: {id: string; key: string; from: number; end: number; url?: string; current: boolean; status: string};
};
export type CaptureFilmReviewFrame = (request: {
  input: string; output: string; seconds: number; width: 640; height: 360;
}) => Promise<void>;
const identity = z.string().min(1).max(500);
const frameId = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const referenceSchema = z.object({
  sceneId: identity, key: identity, renderId: identity,
  frameIds: z.array(frameId).min(1).max(3).refine(ids => new Set(ids).size === ids.length),
}).strict();
export const filmReviewInputSchema = referenceSchema.extend({
  note: z.string().trim().min(1).max(4000),
  style: z.enum(['consistent', 'revise', 'unreviewed']),
  composition: z.enum(['distinct', 'intentional-repeat', 'revise', 'unreviewed']),
  comparedTo: z.array(referenceSchema).max(100).optional(),
}).strict();
export type FilmReviewInput = z.infer<typeof filmReviewInputSchema>;
type Review = FilmReviewInput & {id: string; at: string};
export type FilmReviewFrame = {id: string; frame: number; url: string; width: number; height: number};
export type FilmReviewDescription = {
  scenes: {sceneId: string; title: string; key: string; from: number; end: number; renderId?: string; current: boolean; frames: FilmReviewFrame[]; reason?: string}[];
  reviews: (Review & {current: boolean})[];
};
const storedFrameSchema = z.object({
  id: frameId, frame: z.number().int().nonnegative(), width: z.literal(640), height: z.literal(360),
  sceneId: identity, renderId: identity, key: identity,
  from: z.number().int().nonnegative(), end: z.number().int().positive(), sourceHash: frameId,
}).strict();
type StoredFrame = z.infer<typeof storedFrameSchema>;
const manifestSchema = z.object({version: z.literal(1), frames: z.array(storedFrameSchema)}).strict();
const ledgerSchema = z.object({version: z.literal(1), reviews: z.array(filmReviewInputSchema.extend({id: z.string().uuid(), at: z.string()}).strict())}).strict();
type Manifest = z.infer<typeof manifestSchema>;
type Source = {input: string; hash: string; render: NonNullable<FilmReviewScene['render']>; current: boolean};
const queues = new Map<string, Promise<unknown>>();
const exec = promisify(execFile);
const safeRenderId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;
const renderMediaUrl = /^\/production-media\/renders\/([A-Za-z0-9][A-Za-z0-9_-]{0,199})\/review\.mp4$/;
const validRange = (from: number, end: number) => Number.isSafeInteger(from) && Number.isSafeInteger(end) && from >= 0 && end > from;
const publicFrame = (f: StoredFrame): FilmReviewFrame => ({id: f.id, frame: f.frame, url: `/api/production/storyboard/frame/${f.id}`, width: f.width, height: f.height});

/** Select global 30fps frames; historical pictures never borrow today's action timings. */
function selectFrames(scene: FilmReviewScene, source: Source) {
  const {from, end} = source.render;
  const size = end - from;
  const at = (fraction: number) => from + Math.min(size - 1, Math.floor(size * fraction));
  const candidates = source.current ? [...new Set(scene.candidateFrames ?? [])].filter(f => Number.isSafeInteger(f) && f >= from && f < end).sort((a, b) => a - b) : [];
  const selected = candidates.length ? [candidates[0], ...(candidates.length > 1 ? [candidates[Math.floor(candidates.length / 2)]] : []), at(.85)] : [at(.2), at(.5), at(.85)];
  return [...new Set(selected)].sort((a, b) => a - b).slice(0, 3);
}
/** Visual observations are independent of the user-confirmation/production ledgers. */
export function createFilmReviewStore(options: {directory: string; ffmpeg: string; captureFrame?: CaptureFilmReviewFrame}) {
  const directory = resolve(options.directory);
  const board = resolve(directory, 'storyboard');
  const manifestFile = resolve(board, 'manifest.json');
  const reviewFile = resolve(board, 'reviews.json');
  // Reuse streamed SHA-256 only while dev/ino/size/mtimeNs/ctimeNs remain equal.
  // The shared digester also rejects changes during the initial stream read.
  const digest = createContentDigester();
  const queueKey = realpath(directory).catch((error: NodeJS.ErrnoException) => {if (error.code === 'ENOENT') return directory; throw error;});
  async function serial<T>(work: () => Promise<T>): Promise<T> {
    const key = await queueKey;
    const pending = (queues.get(key) ?? Promise.resolve()).then(work);
    const settled = pending.catch(() => {});
    queues.set(key, settled);
    void settled.then(() => {if (queues.get(key) === settled) queues.delete(key);});
    return pending;
  }
  async function read<T>(file: string, schema: z.ZodType<T>, empty: T): Promise<T> {
    try {return schema.parse(JSON.parse(await readFile(file, 'utf8')));}
    catch (error: any) {if (error.code === 'ENOENT') return empty; throw error;}
  }
  const manifest = () => read(manifestFile, manifestSchema, {version: 1, frames: []});
  const ledger = () => read(reviewFile, ledgerSchema, {version: 1, reviews: []});
  async function atomic(file: string, value: unknown) {
    await mkdir(board, {recursive: true});
    if (await realpath(board) !== resolve(await realpath(directory), 'storyboard')) throw Error('关键帧目录路径无效');
    const temp = `${file}.${randomUUID()}.tmp`;
    try {await writeFile(temp, JSON.stringify(value, null, 2), {flag: 'wx'}); await rename(temp, file);}
    finally {await rm(temp, {force: true});}
  }
  async function actualFile(file: string) {
    try {if (await realpath(file) !== file) return false; const info = await stat(file); return info.isFile() && info.size > 0;}
    catch (error: any) {if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) return false; throw error;}
  }
  async function source(scene: FilmReviewScene): Promise<{source?: Source; reason?: string}> {
    const r = scene.render;
    if (!r || r.status !== 'done') return {reason: '待制作：尚无已完成样片'};
    const mediaMatch = renderMediaUrl.exec(r.url ?? '');
    const mediaDirectory = mediaMatch?.[0] === r.url ? mediaMatch?.[1] : undefined;
    // RenderLane's task ID and the output directory UUID are separate identities.
    if (!validRange(r.from, r.end) || !safeRenderId.test(r.id) || !mediaDirectory) return {reason: '样片来源或路径无效'};
    let root: string;
    try {root = await realpath(directory);} catch (error: any) {if (error.code === 'ENOENT') return {reason: '样片文件不存在'}; throw error;}
    const input = resolve(root, 'renders', mediaDirectory, 'review.mp4');
    if (!await actualFile(input)) return {reason: '样片文件不存在或路径无效'};
    const current = r.current && r.key === scene.key && r.from === scene.from && r.end === scene.end;
    return {source: {input, hash: await digest(input), render: r, current}};
  }
  async function frameExists(id: string) {
    if (!frameId.safeParse(id).success) return false;
    let root: string;
    try {root = await realpath(directory);} catch (error: any) {if (error.code === 'ENOENT') return false; throw error;}
    // Do not follow a substituted storyboard directory or JPEG symlink.
    return actualFile(resolve(root, 'storyboard', `${id}.jpg`));
  }
  function matches(f: StoredFrame, scene: FilmReviewScene, s: Source) {
    const r = s.render;
    return f.sceneId === scene.sceneId && f.renderId === r.id && f.key === r.key && f.from === r.from && f.end === r.end && f.sourceHash === s.hash;
  }
  function generatedId(scene: FilmReviewScene, s: Source, frame: number) {
    return createHash('sha256').update(JSON.stringify([s.input, s.hash, scene.sceneId, s.render.id, s.render.key, s.render.from, s.render.end, frame, 640, 360])).digest('hex');
  }
  async function sources(scenes: FilmReviewScene[]) {
    if (new Set(scenes.map(s => s.sceneId)).size !== scenes.length || scenes.some(s => !validRange(s.from, s.end))) throw Error('全片段落范围或标识无效');
    const result = new Map<string, Awaited<ReturnType<typeof source>>>();
    // Hash large media as streams, with bounded (one at a time) I/O.
    for (const scene of scenes) result.set(scene.sceneId, await source(scene));
    return result;
  }
  async function referenceCurrent(ref: z.infer<typeof referenceSchema>, scenes: FilmReviewScene[], all: Awaited<ReturnType<typeof sources>>, m: Manifest) {
    const scene = scenes.find(s => s.sceneId === ref.sceneId);
    const s = all.get(ref.sceneId)?.source;
    if (!scene || !s?.current || scene.key !== ref.key || s.render.id !== ref.renderId) return false;
    for (const id of ref.frameIds) {
      const f = m.frames.find(f => f.id === id);
      if (!f || !matches(f, scene, s) || generatedId(scene, s, f.frame) !== id || !await frameExists(id)) return false;
    }
    return true;
  }
  async function describeInternal(scenes: FilmReviewScene[]): Promise<FilmReviewDescription> {
    const all = await sources(scenes), m = await manifest(), saved = await ledger();
    const result: FilmReviewDescription = {scenes: [], reviews: []};
    for (const scene of scenes) {
      const entry = all.get(scene.sceneId)!, s = entry.source;
      const frames: FilmReviewFrame[] = [];
      if (s) for (const frame of selectFrames(scene, s)) {
        const id = generatedId(scene, s, frame);
        const f = m.frames.find(f => f.id === id && matches(f, scene, s));
        if (f && await frameExists(id)) frames.push(publicFrame(f));
      }
      result.scenes.push({sceneId: scene.sceneId, title: scene.title, key: scene.key, from: scene.from, end: scene.end, renderId: scene.render?.id, current: s?.current ?? false, frames,
        ...((entry.reason || !s?.current || !frames.length) ? {reason: entry.reason ?? (!s?.current ? '历史样片：当前段落已变化' : '尚未提取关键帧')} : {})});
    }
    for (const review of saved.reviews) {
      let current = await referenceCurrent(review, scenes, all, m);
      for (const ref of review.comparedTo ?? []) if (!await referenceCurrent(ref, scenes, all, m)) current = false;
      result.reviews.push({...review, current});
    }
    return result;
  }
  const captureFrame: CaptureFilmReviewFrame = options.captureFrame ?? (async ({input, output, seconds, width, height}) => {
    await exec(options.ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-ss', String(seconds), '-i', input, '-frames:v', '1', '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`, '-q:v', '3', '-f', 'image2', '-y', output], {timeout: 60_000, maxBuffer: 1024 * 1024});
  });
  return {
    describe: (scenes: FilmReviewScene[]) => {const snapshot = structuredClone(scenes); return serial(() => describeInternal(snapshot));},
    capture: (scenes: FilmReviewScene[]) => {
      const snapshot = structuredClone(scenes);
      return serial(async () => {
        const all = await sources(snapshot), m = await manifest();
        for (const scene of snapshot) {
          const s = all.get(scene.sceneId)?.source;
          if (!s) continue;
          await mkdir(board, {recursive: true});
          // Refuse substituted output directories as well as unsafe source paths.
          const root = await realpath(directory);
          if (await realpath(board) !== resolve(root, 'storyboard')) throw Error('关键帧目录路径无效');
          for (const frame of selectFrames(scene, s)) {
            const id = generatedId(scene, s, frame);
            const cached = m.frames.find(f => f.id === id && matches(f, scene, s));
            if (cached && await frameExists(id)) continue;
            const output = resolve(root, 'storyboard', `${id}.jpg`), temp = resolve(root, 'storyboard', `${id}.${randomUUID()}.tmp.jpg`);
            try {
              await captureFrame({input: s.input, output: temp, seconds: (frame - s.render.from) / 30, width: 640, height: 360});
              if (!await actualFile(temp)) throw Error('关键帧提取未生成有效文件');
              await rename(temp, output);
            } finally {await rm(temp, {force: true});}
            const f: StoredFrame = {id, frame, width: 640, height: 360, sceneId: scene.sceneId, renderId: s.render.id, key: s.render.key, from: s.render.from, end: s.render.end, sourceHash: s.hash};
            m.frames = m.frames.filter(f => f.id !== id); m.frames.push(f);
          }
        }
        // Revalidate every source immediately before publication, including cache-only
        // captures. Unchanged files require stat checks rather than another full read.
        for (const scene of snapshot) {
          const before = all.get(scene.sceneId)?.source;
          if (!before) continue;
          const after = (await source(scene)).source;
          if (!after || after.input !== before.input || after.hash !== before.hash) throw Error('样片在抽帧期间发生变化，请重试');
        }
        // A failed extraction never publishes a partially updated manifest.
        if (all.size && m.frames.length) await atomic(manifestFile, m);
        return describeInternal(snapshot);
      });
    },
    record: (input: FilmReviewInput, scenes: FilmReviewScene[]) => {
      const review = filmReviewInputSchema.parse(input), snapshot = structuredClone(scenes);
      return serial(async () => {
        const all = await sources(snapshot), m = await manifest();
        for (const ref of [review, ...review.comparedTo ?? []]) if (!await referenceCurrent(ref, snapshot, all, m)) throw Error('审阅必须引用当前已完成样片中真实存在的关键帧，请重新提取并查看');
        const saved = await ledger(), item: Review = {...review, id: randomUUID(), at: new Date().toISOString()};
        saved.reviews.push(item); await atomic(reviewFile, saved);
        return {...item, current: true as const};
      });
    },
    resolveFrame: (id: string): Promise<string | null> => serial(async () => {
      if (!frameId.safeParse(id).success) return null;
      const m = await manifest();
      if (!m.frames.some(f => f.id === id) || !await frameExists(id)) return null;
      return resolve(await realpath(directory), 'storyboard', `${id}.jpg`);
    }),
  };
}
