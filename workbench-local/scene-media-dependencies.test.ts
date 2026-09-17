import {writeFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {createContentDigester} from './cut-media-identity';
import {buildSceneCutIdentity} from './scene-media-dependencies';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-scene-media-dependencies-'));
  temporaryRoots.push(root);
  return root;
}

function asset(id: string, proxyFileName: string) {
  return {
    id,
    name: `${id} name`,
    durationFrames: 90,
    sourceFileName: `${id}-source.mp4`,
    proxyFileName,
    words: [{id: `${id}-word`, text: 'ignored', startMs: 0, endMs: 100}],
  };
}

function clip(id: string, assetId: string, inFrame: number, outFrame: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    assetId,
    inFrame,
    outFrame,
    transform: {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      crop: {left: 0, right: 0, top: 0, bottom: 0},
      volume: 1,
      ...overrides,
    },
  };
}

function timelineState() {
  return {
    revision: 4,
    preview: {url: '/cut-media/random-preview.mp4', revision: 4},
    words: [{id: 'ignored', text: 'ignored', startMs: 0, endMs: 100}],
    ranges: [{startMs: 0, endMs: 100}],
    timeline: {
      schemaVersion: 1 as const,
      assets: [asset('a', 'a-proxy.mp4'), asset('b', 'b-proxy.mp4'), asset('unused', 'unused-proxy.mp4')],
      clips: [
        clip('first', 'a', 0, 30, {x: 10}),
        clip('second', 'b', 0, 30, {volume: 0.5}),
      ],
    },
  };
}

async function writeMedia(root: string): Promise<void> {
  await writeFile(path.join(root, 'a-proxy.mp4'), 'a-bytes');
  await writeFile(path.join(root, 'b-proxy.mp4'), 'b-bytes');
  await writeFile(path.join(root, 'unused-proxy.mp4'), 'unused-bytes');
}

describe('scene media dependencies', () => {
  it('is stable for the same window and ignores other clips, unused assets, revision, preview, and words', async () => {
    const root = await temporaryRoot();
    await writeMedia(root);
    const digest = createContentDigester();
    const base = timelineState();
    const first = await buildSceneCutIdentity(base, {from: 0, end: 20}, root, digest, 'window');
    const changed = structuredClone(base);
    changed.revision = 99;
    changed.preview = {url: '/cut-media/random-other-preview.mp4', revision: 99};
    changed.words = [{id: 'new', text: 'new', startMs: 0, endMs: 50}];
    changed.timeline.assets[2] = {
      ...changed.timeline.assets[2],
      name: 'unused renamed',
      proxyFileName: 'unused-renamed.mp4',
      words: [{id: 'unused', text: 'unused', startMs: 0, endMs: 100}],
    };
    changed.timeline.clips[1].transform.rotation = 90;

    const second = await buildSceneCutIdentity(changed, {from: 0, end: 20}, root, digest, 'window');
    expect(first.scope).toBe('window');
    expect(second).toEqual(first);
    expect(await buildSceneCutIdentity(base, {from: 0, end: 20}, root, digest, 'window')).toEqual(first);
  });

  it('changes for the selected transform, volume, source window, window, or related file bytes', async () => {
    const root = await temporaryRoot();
    await writeMedia(root);
    const digest = createContentDigester();
    const base = timelineState();
    const identity = await buildSceneCutIdentity(base, {from: 0, end: 20}, root, digest, 'window');

    const transformed = structuredClone(base);
    transformed.timeline.clips[0].transform.rotation = 45;
    expect((await buildSceneCutIdentity(transformed, {from: 0, end: 20}, root, digest, 'window')).hash).not.toBe(identity.hash);

    const louder = structuredClone(base);
    louder.timeline.clips[0].transform.volume = 0.25;
    expect((await buildSceneCutIdentity(louder, {from: 0, end: 20}, root, digest, 'window')).hash).not.toBe(identity.hash);

    const trimmed = structuredClone(base);
    trimmed.timeline.clips[0].inFrame = 1;
    expect((await buildSceneCutIdentity(trimmed, {from: 0, end: 20}, root, digest, 'window')).hash).not.toBe(identity.hash);

    const movedWindow = await buildSceneCutIdentity(base, {from: 1, end: 21}, root, digest, 'window');
    expect(movedWindow.hash).not.toBe(identity.hash);

    await writeFile(path.join(root, 'a-proxy.mp4'), 'a-bytes-changed');
    expect((await buildSceneCutIdentity(base, {from: 0, end: 20}, root, digest, 'window')).hash).not.toBe(identity.hash);
  });

  it('uses full-cut scope when requested and reacts to a change in another clip', async () => {
    const root = await temporaryRoot();
    await writeMedia(root);
    const digest = createContentDigester();
    const base = timelineState();
    const first = await buildSceneCutIdentity(base, {from: 0, end: 20}, root, digest, 'full-cut');
    const changed = structuredClone(base);
    changed.timeline.clips[1].transform.rotation = 90;
    const second = await buildSceneCutIdentity(changed, {from: 0, end: 20}, root, digest, 'full-cut');

    expect(first.scope).toBe('full-cut');
    expect(second.scope).toBe('full-cut');
    expect(second.hash).not.toBe(first.hash);
  });

  it('falls back to full-cut for legacy ranges and changes when the overall ranges change', async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, 'legacy-proxy.mp4'), 'legacy-bytes');
    const digest = createContentDigester();
    const base = {
      revision: 1,
      preview: {url: '/cut-media/random-preview.mp4', revision: 1},
      asset: {url: '/cut-media/legacy-proxy.mp4'},
      ranges: [{startMs: 0, endMs: 1000}, {startMs: 2000, endMs: 3000}],
    };
    const first = await buildSceneCutIdentity(base, {from: 0, end: 30}, root, digest, 'window');
    const changed = structuredClone(base);
    changed.ranges[0].endMs = 900;
    const second = await buildSceneCutIdentity(changed, {from: 0, end: 30}, root, digest, 'window');

    expect(first.scope).toBe('full-cut');
    expect(second.scope).toBe('full-cut');
    expect(second.hash).not.toBe(first.hash);
  });

  it('rejects invalid or incomplete windows, unsafe paths, missing media, and invalid scopes', async () => {
    const root = await temporaryRoot();
    await writeMedia(root);
    const digest = createContentDigester();
    const state = timelineState();

    await expect(buildSceneCutIdentity(state, {from: -1, end: 2}, root, digest, 'window')).rejects.toThrow();
    await expect(buildSceneCutIdentity(state, {from: 20, end: 61}, root, digest, 'window')).rejects.toThrow(/不完整|超出/);
    await expect(buildSceneCutIdentity(state, {from: 0, end: 20}, 'relative', digest, 'window')).rejects.toThrow(/绝对/);
    await expect(buildSceneCutIdentity(state, {from: 0, end: 20}, root, digest, 'bad' as 'window')).rejects.toThrow(/无效/);

    const missing = structuredClone(state);
    missing.timeline.assets[0].proxyFileName = 'missing-proxy.mp4';
    await expect(buildSceneCutIdentity(missing, {from: 0, end: 20}, root, digest, 'window')).rejects.toThrow();
    const unsafe = structuredClone(state);
    unsafe.timeline.assets[0].proxyFileName = '../escape.mp4';
    await expect(buildSceneCutIdentity(unsafe, {from: 0, end: 20}, root, digest, 'window')).rejects.toThrow();
  });
});
