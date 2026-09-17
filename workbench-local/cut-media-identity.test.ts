import {createHash} from 'node:crypto';
import {readFile, stat, symlink, utimes, writeFile, mkdtemp, rm, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {buildCutInputIdentity, createContentDigester, verifyCutPreviewIdentity} from './cut-media-identity';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-cut-media-identity-'));
  temporaryRoots.push(root);
  return root;
}

function asset(id: string, proxyFileName: string, words: Array<{id: string; text: string; startMs: number; endMs: number}> = []) {
  return {
    id,
    name: `${id} display name`,
    durationFrames: 90,
    sourceFileName: `${id}-source.mp4`,
    proxyFileName,
    words,
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
    revision: 3,
    preview: {url: '/cut-media/random-preview.mp4', revision: 3},
    words: [{id: 'ignored', text: 'ignored', startMs: 0, endMs: 100}],
    ranges: [{startMs: 0, endMs: 100}],
    timeline: {
      schemaVersion: 1 as const,
      assets: [
        asset('a', 'a-proxy.mp4'),
        asset('b', 'b-proxy.mp4'),
        asset('unused', 'unused-proxy.mp4'),
      ],
      clips: [
        clip('first', 'a', 0, 30, {x: 100}),
        clip('second', 'b', 10, 40, {volume: 0.5}),
      ],
    },
  };
}

async function writeProxyFiles(root: string): Promise<void> {
  await writeFile(path.join(root, 'a-proxy.mp4'), 'a-bytes');
  await writeFile(path.join(root, 'b-proxy.mp4'), 'b-bytes');
  await writeFile(path.join(root, 'unused-proxy.mp4'), 'unused-bytes');
}

async function expectedSha256(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

describe('cut media identity', () => {
  it('hashes regular files through a reusable instance-local digester', async () => {
    const root = await temporaryRoot();
    const file = path.join(root, 'large-proxy.mp4');
    await writeFile(file, Buffer.alloc(2 * 1024 * 1024, 0x5a));
    const digest = createContentDigester();

    const expected = await expectedSha256(file);
    await expect(digest(file)).resolves.toBe(expected);
    await expect(digest(file)).resolves.toBe(expected);
    await expect(digest(path.join(root, 'missing.mp4'))).rejects.toThrow();
    await expect(digest(root)).rejects.toThrow(/普通文件/);
  });

  it('invalidates a same-size rewrite even after mtime is restored because ctime changes', async () => {
    const root = await temporaryRoot();
    const file = path.join(root, 'proxy.mp4');
    await writeFile(file, 'before');
    const digest = createContentDigester();
    const oldHash = await digest(file);
    const before = await stat(file, {bigint: true});

    await writeFile(file, 'after!');
    const restoredMtimeMs = Number(before.mtimeNs) / 1_000_000;
    await utimes(file, restoredMtimeMs / 1000, restoredMtimeMs / 1000);

    const nextHash = await digest(file);
    expect(nextHash).not.toBe(oldHash);
    expect(nextHash).toBe(await expectedSha256(file));
    const concurrent = await Promise.all([digest(file), digest(file)]);
    expect(concurrent).toEqual([nextHash, nextHash]);
  });

  it('rejects relative paths, symlinks, and does not cache a failed read', async () => {
    const root = await temporaryRoot();
    const file = path.join(root, 'proxy.mp4');
    const link = path.join(root, 'proxy-link.mp4');
    await writeFile(file, 'bytes');
    await symlink(file, link);
    const digest = createContentDigester();

    await expect(digest('relative.mp4')).rejects.toThrow(/绝对/);
    await expect(digest(link)).rejects.toThrow(/普通文件/);
    await expect(digest(path.join(root, 'missing.mp4'))).rejects.toThrow();
    await writeFile(file, 'recovered');
    await expect(digest(file)).resolves.toBe(await expectedSha256(file));
  });

  it('builds a timeline identity from only used render inputs', async () => {
    const root = await temporaryRoot();
    await writeProxyFiles(root);
    const state = timelineState();
    const digest = createContentDigester();
    const first = await buildCutInputIdentity(state, root, digest);

    expect(first.files).toEqual([
      {fileName: 'a-proxy.mp4', sha256: await expectedSha256(path.join(root, 'a-proxy.mp4'))},
      {fileName: 'b-proxy.mp4', sha256: await expectedSha256(path.join(root, 'b-proxy.mp4'))},
    ]);

    const metadataOnly = structuredClone(state);
    metadataOnly.revision = 99;
    metadataOnly.preview = {url: '/cut-media/new-preview.mp4', revision: 99};
    metadataOnly.words = [{id: 'different', text: 'different', startMs: 0, endMs: 50}];
    metadataOnly.timeline.assets[2] = {
      ...metadataOnly.timeline.assets[2],
      name: 'renamed unused asset',
      proxyFileName: 'unused-renamed.mp4',
      words: [{id: 'unused-word', text: 'unused', startMs: 0, endMs: 100}],
    };
    const unchanged = await buildCutInputIdentity(metadataOnly, root, digest);
    expect(unchanged.inputHash).toBe(first.inputHash);
    await writeFile(path.join(root, 'unused-proxy.mp4'), 'unused-bytes-mutated');
    expect((await buildCutInputIdentity(metadataOnly, root, digest)).inputHash).toBe(first.inputHash);
  });

  it('changes identity for used bytes, transforms, trims, and clip order', async () => {
    const root = await temporaryRoot();
    await writeProxyFiles(root);
    const digest = createContentDigester();
    const original = timelineState();
    const base = await buildCutInputIdentity(original, root, digest);

    const transformed = structuredClone(original);
    transformed.timeline.clips[0].transform.volume = 0.25;
    expect((await buildCutInputIdentity(transformed, root, digest)).inputHash).not.toBe(base.inputHash);

    const trimmed = structuredClone(original);
    trimmed.timeline.clips[0].inFrame = 1;
    expect((await buildCutInputIdentity(trimmed, root, digest)).inputHash).not.toBe(base.inputHash);

    const reordered = structuredClone(original);
    reordered.timeline.clips.reverse();
    expect((await buildCutInputIdentity(reordered, root, digest)).inputHash).not.toBe(base.inputHash);

    await writeFile(path.join(root, 'a-proxy.mp4'), 'a-bytes-mutated');
    expect((await buildCutInputIdentity(original, root, digest)).inputHash).not.toBe(base.inputHash);
  });

  it('keeps legacy identity conservative and includes exact ms ranges plus old rounded source frames', async () => {
    const root = await temporaryRoot();
    const proxy = path.join(root, 'legacy-proxy.mp4');
    await writeFile(proxy, 'legacy');
    const digest = createContentDigester();
    const state = {
      revision: 1,
      preview: {url: '/cut-media/preview.mp4', revision: 1},
      asset: {url: '/cut-media/legacy-proxy.mp4'},
      ranges: [
        {startMs: 100.5, endMs: 1000.5},
        {startMs: 2000.25, endMs: 3000.25},
      ],
    };
    const first = await buildCutInputIdentity(state, root, digest);
    expect(first.files).toEqual([{fileName: 'legacy-proxy.mp4', sha256: await expectedSha256(proxy)}]);

    const changed = structuredClone(state);
    changed.ranges[0].startMs = 101.5;
    expect((await buildCutInputIdentity(changed, root, digest)).inputHash).not.toBe(first.inputHash);
    const metadataOnly = structuredClone(state);
    metadataOnly.revision = 9;
    metadataOnly.preview = {url: '/cut-media/other-preview.mp4', revision: 9};
    expect((await buildCutInputIdentity(metadataOnly, root, digest)).inputHash).toBe(first.inputHash);
  });

  it('rejects malformed ranges, unsafe legacy URLs, invalid directories, and missing media', async () => {
    const root = await temporaryRoot();
    const digest = createContentDigester();
    const legacy = (url: string, ranges = [{startMs: 0, endMs: 100}]) => ({asset: {url}, ranges});

    await expect(buildCutInputIdentity(legacy('/cut-media/../escape.mp4'), root, digest)).rejects.toThrow();
    await expect(buildCutInputIdentity(legacy('/cut-media/a/b.mp4'), root, digest)).rejects.toThrow();
    await expect(buildCutInputIdentity(legacy('/cut-media/a%2Fescape.mp4'), root, digest)).rejects.toThrow();
    await expect(buildCutInputIdentity(legacy('/cut-media/proxy.mp4', []), root, digest)).rejects.toThrow();
    await expect(buildCutInputIdentity(legacy('/cut-media/proxy.mp4', [{startMs: 100, endMs: 100}]), root, digest)).rejects.toThrow();
    await expect(buildCutInputIdentity(legacy('/cut-media/proxy.mp4'), 'relative', digest)).rejects.toThrow(/绝对/);
    await expect(buildCutInputIdentity(legacy('/cut-media/proxy.mp4'), root, digest)).rejects.toThrow();
    await expect(buildCutInputIdentity({...legacy('/cut-media/proxy.mp4'), asset: null}, root, digest)).rejects.toThrow();

    await mkdir(path.join(root, 'a-proxy.mp4'));
    const timeline = timelineState();
    await expect(buildCutInputIdentity(timeline, root, digest)).rejects.toThrow(/普通文件/);
  });

  it('accepts a readable legacy preview without provenance without claiming a full proof', async () => {
    const root = await temporaryRoot();
    await writeProxyFiles(root);
    await writeFile(path.join(root, 'legacy-preview.mp4'), 'legacy-preview');
    const digest = createContentDigester();
    await expect(verifyCutPreviewIdentity({
      ...timelineState(),
      revision: 7,
      preview: {url: '/cut-media/legacy-preview.mp4', revision: 7},
    }, root, digest)).resolves.toBeUndefined();
  });

  it('verifies provenance in input-first then preview order', async () => {
    const root = await temporaryRoot();
    await writeProxyFiles(root);
    await writeFile(path.join(root, 'verified-preview.mp4'), 'verified-preview');
    const state = {...timelineState(), revision: 7, preview: null};
    const digest = createContentDigester();
    const input = await buildCutInputIdentity(state, root, digest);
    const previewHash = await expectedSha256(path.join(root, 'verified-preview.mp4'));
    const calls: string[] = [];
    const recordingDigest = async (absoluteFile: string): Promise<string> => {
      calls.push(path.basename(absoluteFile));
      return digest(absoluteFile);
    };
    const verifiedState = {
      ...state,
      preview: {
        url: '/cut-media/verified-preview.mp4',
        revision: 7,
        provenance: {
          version: 1 as const,
          inputHash: input.inputHash,
          contentHash: previewHash,
          encodingHash: 'e'.repeat(64),
        },
      },
    };
    await expect(verifyCutPreviewIdentity(verifiedState, root, recordingDigest)).resolves.toBeUndefined();
    expect(calls).toEqual(['a-proxy.mp4', 'b-proxy.mp4', 'verified-preview.mp4']);
  });

  it('verifies an optional internal lossless render source after the preview proof', async () => {
    const root = await temporaryRoot();
    await writeProxyFiles(root);
    const previewFile = path.join(root, 'verified-preview.mp4');
    const renderSourceFile = path.join(root, 'render-source.mkv');
    await writeFile(previewFile, 'verified-preview');
    await writeFile(renderSourceFile, 'render-source');
    const digest = createContentDigester();
    const base = {...timelineState(), revision: 7, preview: null};
    const input = await buildCutInputIdentity(base, root, digest);
    const proof = {
      version: 1 as const,
      inputHash: input.inputHash,
      contentHash: await expectedSha256(previewFile),
      encodingHash: 'e'.repeat(64),
      renderSource: {
        url: '/cut-media/render-source.mkv',
        contentHash: await expectedSha256(renderSourceFile),
      },
    };
    const verified = {
      ...base,
      preview: {url: '/cut-media/verified-preview.mp4', revision: 7, provenance: proof},
    };
    const calls: string[] = [];
    const recordingDigest = async (absoluteFile: string): Promise<string> => {
      calls.push(path.basename(absoluteFile));
      return digest(absoluteFile);
    };

    await expect(verifyCutPreviewIdentity(verified, root, recordingDigest)).resolves.toBeUndefined();
    expect(calls).toEqual(['a-proxy.mp4', 'b-proxy.mp4', 'verified-preview.mp4', 'render-source.mkv']);
    expect(verified.revision).toBe(7);
    expect(await readFile(renderSourceFile, 'utf8')).toBe('render-source');

    await writeFile(renderSourceFile, 'render-source-replaced');
    await expect(verifyCutPreviewIdentity(verified, root, digest)).rejects.toThrow(/内部渲染源文件内容已变化/);
    await writeFile(renderSourceFile, 'render-source');
    await rm(renderSourceFile, {force: true});
    await expect(verifyCutPreviewIdentity(verified, root, digest)).rejects.toThrow(/重新生成预览/);

    const unsafePath = {
      ...verified,
      preview: {
        ...verified.preview,
        provenance: {...proof, renderSource: {...proof.renderSource, url: '/cut-media/../render-source.mkv'}},
      },
    };
    await expect(verifyCutPreviewIdentity(unsafePath, root, digest)).rejects.toThrow(/重新生成预览/);
    const wrongExtension = {
      ...verified,
      preview: {
        ...verified.preview,
        provenance: {...proof, renderSource: {...proof.renderSource, url: '/cut-media/render-source.mp4'}},
      },
    };
    await expect(verifyCutPreviewIdentity(wrongExtension, root, digest)).rejects.toThrow(/必须是 \.mkv/);
    const invalidSourceHash = {
      ...verified,
      preview: {
        ...verified.preview,
        provenance: {...proof, renderSource: {...proof.renderSource, contentHash: 'A'.repeat(64)}},
      },
    };
    await expect(verifyCutPreviewIdentity(invalidSourceHash, root, digest)).rejects.toThrow(/内部渲染源格式无效/);
    const incompleteProof = {
      ...verified,
      preview: {
        ...verified.preview,
        provenance: {renderSource: proof.renderSource},
      },
    };
    await expect(verifyCutPreviewIdentity(
      incompleteProof as unknown as Parameters<typeof verifyCutPreviewIdentity>[0],
      root,
      digest,
    )).rejects.toThrow(/版本或 hash 格式无效/);
  });

  it('rejects stale revision, changed source, changed or missing preview, and invalid proof/path', async () => {
    const root = await temporaryRoot();
    await writeProxyFiles(root);
    const previewFile = path.join(root, 'verified-preview.mp4');
    await writeFile(previewFile, 'verified-preview');
    const digest = createContentDigester();
    const base = {...timelineState(), revision: 7, preview: null};
    const input = await buildCutInputIdentity(base, root, digest);
    const previewHash = await expectedSha256(previewFile);
    const proof = {
      version: 1 as const,
      inputHash: input.inputHash,
      contentHash: previewHash,
      encodingHash: 'a'.repeat(64),
    };
    const verified = {
      ...base,
      preview: {url: '/cut-media/verified-preview.mp4', revision: 7, provenance: proof},
    };
    await expect(verifyCutPreviewIdentity(verified, root, digest)).resolves.toBeUndefined();

    await expect(verifyCutPreviewIdentity({...verified, revision: 8}, root, digest)).rejects.toThrow(/重新生成预览/);
    const changedSource = structuredClone(verified);
    await writeFile(path.join(root, 'a-proxy.mp4'), 'source-changed');
    await expect(verifyCutPreviewIdentity(changedSource, root, digest)).rejects.toThrow(/输入已变化/);

    await writeFile(path.join(root, 'a-proxy.mp4'), 'a-bytes');
    await writeFile(previewFile, 'preview-changed');
    await expect(verifyCutPreviewIdentity(verified, root, digest)).rejects.toThrow(/预览文件内容已变化/);
    await rm(previewFile, {force: true});
    await expect(verifyCutPreviewIdentity(verified, root, digest)).rejects.toThrow(/重新生成预览/);

    const invalidHash = {...verified, preview: {
      ...verified.preview,
      provenance: {...proof, contentHash: 'A'.repeat(64)},
    }};
    await expect(verifyCutPreviewIdentity(invalidHash, root, digest)).rejects.toThrow(/hash 格式无效/);
    const invalidVersion = {...verified, preview: {
      ...verified.preview,
      provenance: {...proof, version: 2},
    }};
    await expect(verifyCutPreviewIdentity(
      invalidVersion as unknown as Parameters<typeof verifyCutPreviewIdentity>[0],
      root,
      digest,
    )).rejects.toThrow(/版本或 hash 格式无效/);
    const unsafePath = {...verified, preview: {
      ...verified.preview,
      url: '/cut-media/../escape.mp4',
    }};
    await expect(verifyCutPreviewIdentity(unsafePath, root, digest)).rejects.toThrow(/重新生成预览/);
  });
});
