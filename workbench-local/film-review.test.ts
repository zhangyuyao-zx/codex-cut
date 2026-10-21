import {createReadStream} from 'node:fs';
import {mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, utimes, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, expect, it, vi} from 'vitest';
import {createFilmReviewStore, type CaptureFilmReviewFrame, type FilmReviewInput, type FilmReviewScene} from './film-review';

const dirs: string[] = [];
vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {...actual, createReadStream: vi.fn(actual.createReadStream)};
});
afterEach(async () => {await Promise.all(dirs.splice(0).map(d => rm(d, {recursive: true, force: true}))); vi.mocked(createReadStream).mockClear();});
async function setup(capture?: CaptureFilmReviewFrame) {
  const directory = await mkdtemp(join(tmpdir(), 'film-review-')); dirs.push(directory);
  const calls: Parameters<CaptureFilmReviewFrame>[0][] = [];
  const captureFrame: CaptureFilmReviewFrame = capture ?? (async request => {calls.push(request); await writeFile(request.output, 'jpeg-test-double');});
  const options = {directory, ffmpeg: 'unused-in-injected-test', captureFrame};
  return {directory, calls, options, store: createFilmReviewStore(options)};
}
function scene(id = 'a', from = 300, end = 600): FilmReviewScene {
  return {sceneId: id, title: id, key: `${id}-key`, from, end, render: {id: `render-${id}`, key: `${id}-key`, from, end, url: `/production-media/renders/render-${id}/review.mp4`, current: true, status: 'done'}};
}
async function media(directory: string, s: FilmReviewScene, content = 'test-video') {
  const path = join(directory, 'renders', s.render!.url!.split('/')[3], 'review.mp4');
  await mkdir(join(path, '..'), {recursive: true}); await writeFile(path, content); return path;
}
function review(s: FilmReviewScene, frameIds: string[]): FilmReviewInput {
  return {sceneId: s.sceneId, key: s.key, renderId: s.render!.id, frameIds, note: '已查看画面，检查风格与构图', style: 'consistent', composition: 'distinct'};
}

it('uses local source times, prioritizes action points, includes readable landing and reuses cache', async () => {
  const {directory, calls, store} = await setup(), s = {...scene(), candidateFrames: [330, 390, 460, 510, 900, 330]};
  await media(directory, s);
  expect((await store.describe([s])).scenes[0].frames).toEqual([]);
  const output = await store.capture([s]);
  expect(output.scenes[0].frames.map(f => f.frame)).toEqual([330, 460, 555]);
  expect(calls.map(c => c.seconds)).toEqual([1, 160 / 30, 8.5]);
  expect(calls.every(c => c.seconds >= 0 && c.seconds < 10 && c.width === 640 && c.height === 360)).toBe(true);
  expect(output.scenes[0].current).toBe(true);
  for (const f of output.scenes[0].frames) expect(await store.resolveFrame(f.id)).toBe(join(await realpath(directory), 'storyboard', `${f.id}.jpg`));
  await createFilmReviewStore({directory, ffmpeg: 'unused', captureFrame: async () => {throw Error('cache miss');}}).capture([s]);
  expect(calls).toHaveLength(3);
});

it('keeps the RenderLane task identity separate from the independently allocated output directory', async () => {
  const {directory, calls, store} = await setup();
  const s = {...scene(), render: {...scene().render!, id: '143a683f-1f0d-42bb-881e-a63c3c380e9c', url: '/production-media/renders/6ca2d823-5828-438b-8ad2-bbebaaae6858/review.mp4'}};
  await media(directory, s);
  const output = await store.capture([s]);
  expect(output.scenes[0].current).toBe(true); expect(output.scenes[0].renderId).toBe(s.render.id); expect(output.scenes[0].frames).toHaveLength(3);
  expect(calls.every(call => call.input.endsWith('/renders/6ca2d823-5828-438b-8ad2-bbebaaae6858/review.mp4'))).toBe(true);
  const saved = await store.record(review(s, [output.scenes[0].frames[0].id]), [s]);
  expect(saved.renderId).toBe(s.render.id); expect((await store.describe([s])).reviews[0].current).toBe(true);
  for (const url of ['/production-media/renders/../review.mp4', '/production-media/renders/%2e%2e/review.mp4', '/production-media/renders/a/../../review.mp4', '/production-media/renders/a\\b/review.mp4', '/production-media/renders/a/review.mp4?path=b', '/production-media/renders/a/review.mp4#b', `${s.render.url}\n`]) {
    expect((await store.capture([{...s, render: {...s.render, url}}])).scenes[0].frames).toEqual([]);
  }
  expect(calls).toHaveLength(3);
});

it('streams unchanged media once across capture, cache hits and describe while ctime defeats restored-mtime rewrites', async () => {
  const {directory, store} = await setup(), s = scene(), path = await media(directory, s, 'version-1');
  const before = await store.capture([s]);
  await store.describe([s]); await store.capture([s]); await store.describe([s]);
  expect(vi.mocked(createReadStream)).toHaveBeenCalledTimes(1);
  const metadata = await stat(path);
  await writeFile(path, 'version-2'); await utimes(path, metadata.atime, metadata.mtime);
  const after = await store.capture([s]);
  expect(vi.mocked(createReadStream)).toHaveBeenCalledTimes(2);
  expect(after.scenes[0].frames.every(f => !before.scenes[0].frames.some(old => old.id === f.id))).toBe(true);
});

it('deduplicates very short ranges and never uses current action points for historical renders', async () => {
  const {directory, calls, store} = await setup(), short = scene('short', 10, 11);
  const old = {...scene('old', 200, 400), candidateFrames: [210, 240], render: {...scene('old', 30, 90).render!, current: false}};
  await media(directory, short); await media(directory, old);
  const result = await store.capture([short, old]);
  expect(result.scenes[0].frames.map(f => f.frame)).toEqual([10]);
  expect(result.scenes[1].frames.map(f => f.frame)).toEqual([42, 60, 81]);
  expect(result.scenes[1].current).toBe(false); expect(result.scenes[1].reason).toContain('历史');
  expect(calls.map(c => c.seconds)).toEqual([0, .4, 1, 1.7]);
});

it('reports missing/unfinished media without inventing frames and rejects traversal, URL spoofing and symlinks', async () => {
  const {directory, calls, store} = await setup(), s = scene();
  const sources = [s, {...scene('pending'), render: {...scene('pending').render!, status: 'rendering'}}, {...scene('escape'), render: {...scene('escape').render!, id: '../a'}}, {...scene('url'), render: {...scene('url').render!, url: '/private.mp4'}}, {...scene('none'), render: undefined}];
  const result = await store.capture(sources);
  expect(result.scenes.every(s => s.frames.length === 0 && !!s.reason && !s.current)).toBe(true);
  expect(calls).toHaveLength(0);
  expect(await store.resolveFrame('../reviews.json')).toBeNull(); expect(await store.resolveFrame('f'.repeat(64))).toBeNull();
  const external = join(directory, 'outside.mp4'); await writeFile(external, 'external');
  await mkdir(join(directory, 'renders', s.render!.id), {recursive: true});
  await symlink(external, join(directory, 'renders', s.render!.id, 'review.mp4'));
  expect((await store.capture([s])).scenes[0].frames).toEqual([]);
  await rm(join(directory, 'renders', s.render!.id, 'review.mp4')); await media(directory, s);
  const framed = (await store.capture([s])).scenes[0].frames[0];
  const jpg = join(directory, 'storyboard', `${framed.id}.jpg`); await rm(jpg); await symlink(external, jpg);
  expect(await store.resolveFrame(framed.id)).toBeNull();
  expect((await store.describe([s])).scenes[0].frames.some(f => f.id === framed.id)).toBe(false);
  await expect(store.record(review(s, [framed.id]), [s])).rejects.toThrow('真实存在');
});

it('content changes invalidate source cache and reviews even when render metadata is unchanged', async () => {
  const {directory, calls, store} = await setup(), s = scene(); const path = await media(directory, s, 'version-1');
  const before = (await store.capture([s])).scenes[0].frames;
  await store.record(review(s, [before[0].id]), [s]);
  await writeFile(path, 'version-2');
  const stale = await store.describe([s]); expect(stale.scenes[0].frames).toEqual([]); expect(stale.reviews[0].current).toBe(false);
  await expect(store.record(review(s, [before[0].id]), [s])).rejects.toThrow();
  const after = (await store.capture([s])).scenes[0].frames;
  expect(after.every(f => !before.some(old => old.id === f.id))).toBe(true); expect(calls).toHaveLength(6);
});

it('strictly validates real current references, persists observations and invalidates changed comparisons', async () => {
  const {directory, options, store} = await setup(), a = scene(), b = scene('b');
  await media(directory, a); await media(directory, b);
  const captured = await store.capture([a, b]);
  const aIds = captured.scenes[0].frames.map(f => f.id), bIds = captured.scenes[1].frames.map(f => f.id);
  const valid = {...review(a, aIds), comparedTo: [{sceneId: b.sceneId, key: b.key, renderId: b.render!.id, frameIds: [bIds[0]]}]};
  await expect(store.record(review(a, ['f'.repeat(64)]), [a, b])).rejects.toThrow();
  await expect(store.record(review(a, [bIds[0]]), [a, b])).rejects.toThrow();
  await expect(store.record({...valid, key: 'stale'}, [a, b])).rejects.toThrow();
  await expect(store.record({...valid, comparedTo: [{...valid.comparedTo[0], renderId: a.render!.id}]}, [a, b])).rejects.toThrow();
  expect(() => store.record({...valid, userConfirmed: true} as any, [a, b])).toThrow();
  expect(() => store.record({...valid, accepted: true} as any, [a, b])).toThrow();
  expect(() => store.record({...valid, note: '   '} as any, [a, b])).toThrow();
  expect(() => store.record({...valid, note: '字'.repeat(4001)} as any, [a, b])).toThrow();
  await store.record(valid, [a, b]);
  const restarted = createFilmReviewStore(options);
  expect((await restarted.describe([a, b])).reviews[0]).toMatchObject({...valid, current: true});
  expect((await restarted.describe([a, {...b, key: 'changed'}])).reviews[0].current).toBe(false);
  expect((await restarted.describe([{...a, end: a.end + 1}, b])).reviews[0].current).toBe(false);
  await expect(store.record(valid, [{...a, render: {...a.render!, current: false}}, b])).rejects.toThrow();
});

it('serializes simultaneous capture and record writes across store instances without changing approval files', async () => {
  const {directory, options, calls, store} = await setup(), a = scene(), b = scene('b'); await media(directory, a); await media(directory, b);
  const production = '{"production":"untouched"}', approvals = '{"approvals":["untouched"]}';
  await writeFile(join(directory, 'production.json'), production); await writeFile(join(directory, 'segment-reviews.json'), approvals);
  const second = createFilmReviewStore(options);
  await Promise.all([store.capture([a]), second.capture([b]), second.capture([a])]);
  expect(calls).toHaveLength(6);
  const frames = (await store.describe([a, b])).scenes;
  await Promise.all(Array.from({length: 12}, (_, i) => (i % 2 ? store : second).record({...review(a, [frames[0].frames[0].id]), note: `note-${i}`}, [a, b])));
  const records = (await store.describe([a, b])).reviews;
  expect(records).toHaveLength(12); expect(new Set(records.map(r => r.note)).size).toBe(12); expect(records.every(r => r.current)).toBe(true);
  expect(await readFile(join(directory, 'production.json'), 'utf8')).toBe(production);
  expect(await readFile(join(directory, 'segment-reviews.json'), 'utf8')).toBe(approvals);
  expect((await readdir(join(directory, 'storyboard'))).filter(f => f.includes('.tmp'))).toEqual([]);
});

it('failed extraction publishes no partial manifest, cleans temporary files and can be retried', async () => {
  let attempts = 0;
  const {directory, store} = await setup(async request => {await writeFile(request.output, 'jpeg'); if (++attempts === 2) throw Error('injected failure');});
  const s = scene(); await media(directory, s);
  await expect(store.capture([s])).rejects.toThrow('injected failure');
  expect((await store.describe([s])).scenes[0].frames).toEqual([]);
  expect(await store.resolveFrame((await readdir(join(directory, 'storyboard'))).find(f => f.endsWith('.jpg'))!.slice(0, -4))).toBeNull();
  expect((await readdir(join(directory, 'storyboard'))).filter(f => f.includes('.tmp'))).toEqual([]);
  expect((await store.capture([s])).scenes[0].frames).toHaveLength(3);
});

it('detects a video replaced during extraction and leaves it untouched after refusing the frames', async () => {
  const {directory, store} = await setup(async request => {await writeFile(request.output, 'jpeg'); await writeFile(request.input, 'external-new-video');});
  const s = scene(), path = await media(directory, s, 'original-video');
  await expect(store.capture([s])).rejects.toThrow('抽帧期间发生变化');
  expect(await readFile(path, 'utf8')).toBe('external-new-video');
  expect((await store.describe([s])).scenes[0].frames).toEqual([]);
  expect((await readdir(join(directory, 'storyboard'))).filter(f => f.includes('.tmp'))).toEqual([]);
});

it('refuses a substituted storyboard directory without creating output or observation records outside it', async () => {
  const {directory, store} = await setup(), s = scene(); await media(directory, s);
  const external = join(directory, 'external'); await mkdir(external); await symlink(external, join(directory, 'storyboard'));
  await expect(store.capture([s])).rejects.toThrow('目录路径无效');
  await expect(store.record(review(s, ['f'.repeat(64)]), [s])).rejects.toThrow();
  expect(await readdir(external)).toEqual([]);
});
