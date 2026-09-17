import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {afterEach, describe, expect, it} from 'vitest';
import {
  createRoughcutService,
  projectWords,
  projectCutWords,
  snapRangesToFrames,
  type RoughcutServiceOptions,
  type TimeRange,
  type TranscriptWord,
} from './roughcut-service.js';

const temporaryDirectories: string[] = [];

describe('render provenance and publication protection', () => {
  it('retains both previous artifacts and removes the new internal source if preview encoding fails',async()=>{
    const directory=await makeTemporaryDirectory(),input=path.join(directory,'input.mp4');
    await writeFile(input,'source');
    let failPreview=false;
    const options={...fakeMediaOptions(12000,async args=>{
      if(failPreview&&args.at(-1)!.endsWith('.mp4'))throw Error('preview encoder failed');
      await writeFile(args.at(-1)!,'fake media');
    }),ffmpegPath:process.execPath};
    const service=await createRoughcutService(directory,options);await service.importFile(input);await service.render();
    const previous=(await service.get()).preview!,files=(await readdir(directory)).sort();
    failPreview=true;
    await expect(service.render()).rejects.toMatchObject({code:'FFMPEG_FAILED'});
    expect((await service.get()).preview).toEqual(previous);
    expect((await service.get()).busy).toBe(false);
    expect((await readdir(directory)).sort()).toEqual(files);
    await expect(service.verifyPreview(1)).resolves.toBeUndefined();
  });
  it('persists content proof independently of random output names and transcript revisions', async () => {
    const directory = await makeTemporaryDirectory();
    const input = path.join(directory, 'input.mp4');
    await writeFile(input, 'source');
    const options = {...fakeMediaOptions(), ffmpegPath:process.execPath};
    const service = await createRoughcutService(directory, options);
    await service.importFile(input);
    await service.render();
    const first = (await service.get()).preview!;
    expect(first.provenance).toMatchObject({version:1,
      contentHash:createHash('sha256').update('fake media').digest('hex')});
    await service.setTranscript(1,[{id:'w',text:'口播',startMs:100,endMs:200}]);
    await service.render();
    const second = (await service.get()).preview!;
    expect(second.url).not.toBe(first.url);
    expect(second.revision).toBe(2);
    expect(second.provenance).toMatchObject({inputHash:first.provenance!.inputHash,
      contentHash:first.provenance!.contentHash,encodingHash:first.provenance!.encodingHash,
      renderSource:{contentHash:first.provenance!.renderSource!.contentHash}});
    const reopened = await createRoughcutService(directory, options);
    expect((await reopened.get()).preview).toEqual(second);
    await expect(reopened.verifyPreview(2)).resolves.toBeUndefined();
    await expect(reopened.verifyPreview(1)).rejects.toMatchObject({code:'STALE_REVISION'});
    await writeFile(path.join(directory,path.basename(second.url)),'changed preview');
    await expect(reopened.verifyPreview(2)).rejects.toMatchObject({code:'INVALID_STATE'});
    expect((await reopened.get()).preview).toEqual(second);
  });

  it('rejects a source replacement during encoding and retains the last preview', async () => {
    const directory = await makeTemporaryDirectory();
    const input = path.join(directory,'input.mp4');
    await writeFile(input,'source');
    let replace = false;
    const options = {...fakeMediaOptions(12000,async args => {
      if (replace) await writeFile(args[args.indexOf('-i')+1], 'changed source');
      await writeFile(args.at(-1)!, 'fake media');
    }),ffmpegPath:process.execPath};
    const service = await createRoughcutService(directory,options);
    await service.importFile(input);
    await service.render();
    const previous = (await service.get()).preview;
    replace = true;
    await expect(service.render()).rejects.toMatchObject({code:'INVALID_STATE'});
    expect(await service.get()).toMatchObject({busy:false,preview:previous});
    expect((await readdir(directory)).filter(f=>f.startsWith('render-'))).toHaveLength(1);
  });

  it('does not publish an output for a project revision changed externally during encoding', async () => {
    const directory = await makeTemporaryDirectory();
    const input = path.join(directory,'input.mp4');
    await writeFile(input,'source');
    let alterRevision = false;
    const options = {...fakeMediaOptions(12000,async args => {
      if (alterRevision) {
        alterRevision=false;
        const file = path.join(directory,'roughcut.json');
        const envelope = JSON.parse(await readFile(file,'utf8'));
        envelope.state.revision += 1;
        await writeFile(file,JSON.stringify(envelope));
      }
      await writeFile(args.at(-1)!, 'fake media');
    }),ffmpegPath:process.execPath};
    const service = await createRoughcutService(directory,options);
    await service.importFile(input);
    await service.render();
    const previous = (await service.get()).preview;
    alterRevision = true;
    await expect(service.render()).rejects.toMatchObject({code:'STALE_REVISION'});
    expect(await service.get()).toMatchObject({revision:2,busy:false,preview:previous});
    expect((await readdir(directory)).filter(f=>f.startsWith('render-'))).toHaveLength(1);
  });
});

describe('multi-asset persistence and rendering', () => {
  it('migrates legacy container duration using actual proxy frames instead of inventing a tail frame', async () => {
    const directory = await makeTemporaryDirectory();
    const input = path.join(directory, 'input.mp4');
    await writeFile(input, 'source');
    const options = {...fakeMediaOptions(3007), probeMedia: async () => ({
      durationMs: 3007, videoFrames: 90, hasVideo: true, hasAudio: true,
    })};
    const service = await createRoughcutService(directory, options);
    await service.importFile(input);
    const statePath = path.join(directory, 'roughcut.json');
    const envelope = JSON.parse(await readFile(statePath, 'utf8'));
    delete envelope.state.asset.durationFrames;
    envelope.state.asset.durationMs = 3007;
    await writeFile(statePath, JSON.stringify(envelope));
    const reopened = await createRoughcutService(directory, options);
    const appended = await reopened.importFile(input, 'second', 1);
    expect(appended.timeline!.assets[0].durationFrames).toBe(90);
    expect(appended.timeline!.clips[0].outFrame).toBe(90);
    const clips = structuredClone(appended.timeline!.clips);
    clips[0].outFrame = 91;
    await expect(reopened.setClips(2, clips)).rejects.toThrow();
    expect((await reopened.get()).revision).toBe(2);
  });
  it('keeps the existing project and media after a failed append and rejects concurrent stale edits', async () => {
    const directory = await makeTemporaryDirectory();
    const input = path.join(directory, 'input.mp4');
    await writeFile(input, 'source');
    let fail = false;
    const service = await createRoughcutService(directory, fakeMediaOptions(3000, async args => {
      if (fail) throw Error('simulated encoder failure');
      await writeFile(args.at(-1)!, 'result');
    }));
    const original = await service.importFile(input);
    const filesBefore = (await readdir(directory)).filter(f => /^(source|proxy)-/.test(f)).sort();
    fail = true;
    await expect(service.importFile(input, 'bad', 1)).rejects.toMatchObject({code:'FFMPEG_FAILED'});
    const state = await service.get();
    expect(state).toMatchObject({revision:1, asset:original.asset, ranges:original.ranges,busy:false});
    expect(state.timeline).toBeUndefined();
    expect((await readdir(directory)).filter(f => /^(source|proxy)-/.test(f)).sort()).toEqual(filesBefore);
    fail = false;
    const appended = await service.importFile(input, 'good', 1);
    const clips = appended.timeline!.clips;
    const results = await Promise.allSettled([service.setClips(2, clips), service.setClips(2, [...clips].reverse())]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.code).toBe('STALE_REVISION');
    const stable = await service.get();
    await expect(service.setClips(3, [{...clips[0],assetId:'not-registered'}])).rejects.toThrow();
    expect(await service.get()).toEqual(stable);
  });
  it('appends without replacing, reloads, reorders, renders all sources and undoes back to legacy state', async () => {
    const directory = await makeTemporaryDirectory();
    const input = path.join(directory, 'input.mp4');
    await writeFile(input, 'source');
    const calls: string[][] = [];
    const options = fakeMediaOptions(3000, async args => {
      calls.push([...args]);
      await writeFile(args.at(-1)!, 'result');
    });
    const service = await createRoughcutService(directory, options);
    await service.importFile(input, 'first');
    const original = await service.setTranscript(1, [{id: 'word-0', text: '原词', startMs: 100, endMs: 300}]);
    const added = await service.importFile(input, 'second', 2);
    expect(added.asset).toEqual(original.asset);
    expect(added.timeline?.assets).toHaveLength(2);
    expect(projectCutWords(added)[0].legacySourceId).toBe('word-0');
    const second = added.timeline!.assets[1];
    const transcribed = await service.setAssetTranscript(3, second.id, [{id: 'word-0', text: '新词', startMs: 100, endMs: 300}]);
    expect(projectCutWords(transcribed)[1].sourceId).not.toBe('word-0');
    const clips = [...transcribed.timeline!.clips].reverse();
    clips[0].transform.volume = 0;
    const edited = await service.setClips(4, clips);
    expect(projectCutWords(edited).map(w => w.text)).toEqual(['新词', '原词']);
    const reloaded = await createRoughcutService(directory, options);
    expect((await reloaded.get()).timeline).toEqual(edited.timeline);
    await reloaded.render();
    const render = calls.findLast(args=>args.includes('-filter_complex'))!;
    expect(render.filter(a => a === '-i')).toHaveLength(2);
    expect(render[render.indexOf('-filter_complex') + 1]).toContain('volume=0');
    expect(render[render.indexOf('-filter_complex') + 1]).toContain('concat=n=2');
    await reloaded.undo(5);
    await reloaded.undo(6);
    const restored = await reloaded.undo(7);
    expect(restored.timeline).toBeUndefined();
    expect(restored.words).toEqual(original.words);
    expect(restored.ranges).toEqual(original.ranges);
    await expect(reloaded.importFile(input, 'stale', 2)).rejects.toMatchObject({code: 'STALE_REVISION'});
    expect((await reloaded.get()).revision).toBe(8);
  });
});

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-workbench-roughcut-'));
  temporaryDirectories.push(directory);
  return directory;
}

function fakeMediaOptions(
  durationMs = 12_000,
  runFfmpeg?: RoughcutServiceOptions['runFfmpeg'],
): RoughcutServiceOptions {
  return {
    probeMedia: async () => ({durationMs, hasVideo: true, hasAudio: true}),
    runFfmpeg: runFfmpeg ?? (async (args) => {
      const outputPath = args.at(-1);
      if (typeof outputPath !== 'string') throw new Error('missing output path');
      await writeFile(outputPath, 'fake media');
    }),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

describe('projectWords', () => {
  it('maps source times onto the compacted timeline and preserves source ids', () => {
    const words: TranscriptWord[] = [
      {id: 'w1', text: '前半', startMs: 500, endMs: 1_500},
      {id: 'w2', text: '后半', startMs: 2_200, endMs: 2_600},
    ];
    const ranges: TimeRange[] = [
      {startMs: 0, endMs: 1_000},
      {startMs: 2_000, endMs: 2_500},
    ];

    expect(projectWords(words, ranges)).toEqual([
      {
        sourceId: 'w1',
        text: '前半',
        startMs: 500,
        endMs: 1_000,
        sourceStartMs: 500,
        sourceEndMs: 1_000,
      },
      {
        sourceId: 'w2',
        text: '后半',
        startMs: 1_200,
        endMs: 1_500,
        sourceStartMs: 2_200,
        sourceEndMs: 2_500,
      },
    ]);
  });

  it('splits a source word when a removed gap passes through it', () => {
    const projected = projectWords(
      [{id: 'w1', text: '跨段', startMs: 500, endMs: 2_300}],
      [{startMs: 0, endMs: 1_000}, {startMs: 2_000, endMs: 2_500}],
    );
    expect(projected).toEqual([
      {sourceId: 'w1', text: '跨段', startMs: 500, endMs: 1_000, sourceStartMs: 500, sourceEndMs: 1_000},
      {sourceId: 'w1', text: '跨段', startMs: 1_000, endMs: 1_300, sourceStartMs: 2_000, sourceEndMs: 2_300},
    ]);
  });
});

describe('roughcut service', () => {
  it('persists an imported asset, transcript, EDL and revision conflicts', async () => {
    const directory = await makeTemporaryDirectory();
    const sourcePath = path.join(directory, 'narrated-sample.mp4');
    await writeFile(sourcePath, 'source media');
    const options = fakeMediaOptions();
    const service = await createRoughcutService(directory, options);

    const imported = await service.importFile(sourcePath);
    expect(imported).toMatchObject({
      revision: 1,
      asset: {name: 'narrated-sample.mp4', durationMs: 12_000},
      ranges: [{startMs: 0, endMs: 12_000}],
      words: [],
      preview: null,
      busy: false,
    });
    expect(imported.asset?.url).toMatch(/^\/cut-media\/proxy-[0-9a-f-]+\.mp4$/u);
    expect(imported.asset?.url).not.toBe(sourcePath);

    const words: TranscriptWord[] = [{id: 'w1', text: '第一句', startMs: 1_000, endMs: 2_000}];
    const transcript = await service.setTranscript(imported.revision, words);
    const cut = await service.cut(transcript.revision, [
      {startMs: 0, endMs: 3_000},
      {startMs: 5_000, endMs: 9_000},
    ]);
    await expect(service.cut(transcript.revision, [{startMs: 0, endMs: 1_000}]))
      .rejects.toMatchObject({code: 'STALE_REVISION'});

    const reopened = await createRoughcutService(directory, options);
    await expect(reopened.get()).resolves.toMatchObject({
      revision: cut.revision,
      asset: imported.asset,
      words,
      ranges: cut.ranges,
      busy: false,
    });
    await expect(readFile(path.join(directory, 'roughcut.json'), 'utf8')).resolves.toContain('proxy-');
  });

  it('rejects empty, overlapping and out-of-bounds ranges without changing revision', async () => {
    const directory = await makeTemporaryDirectory();
    const sourcePath = path.join(directory, 'sample.mp4');
    await writeFile(sourcePath, 'source media');
    const service = await createRoughcutService(directory, fakeMediaOptions());
    const imported = await service.importFile(sourcePath);

    for (const ranges of [
      [],
      [{startMs: 0, endMs: 0}],
      [{startMs: 0, endMs: 5_000}, {startMs: 4_000, endMs: 6_000}],
      [{startMs: 0, endMs: 12_001}],
    ]) {
      await expect(service.cut(imported.revision, ranges)).rejects.toMatchObject({code: 'INVALID_RANGES'});
    }
    await expect(service.get()).resolves.toMatchObject({revision: imported.revision, ranges: [{startMs: 0, endMs: 12_000}]});
  });

  it('undoes transcript and cut changes while import itself remains a boundary', async () => {
    const directory = await makeTemporaryDirectory();
    const sourcePath = path.join(directory, 'first.mp4');
    await writeFile(sourcePath, 'source media');
    const service = await createRoughcutService(directory, fakeMediaOptions());
    const imported = await service.importFile(sourcePath);
    const words: TranscriptWord[] = [{id: 'w1', text: '保留', startMs: 100, endMs: 500}];
    const transcript = await service.setTranscript(imported.revision, words);
    const cut = await service.cut(transcript.revision, [{startMs: 0, endMs: 2_000}]);

    const undoCut = await service.undo(cut.revision);
    expect(undoCut.words).toEqual(words);
    expect(undoCut.ranges).toEqual([{startMs: 0, endMs: 12_000}]);
    const undoTranscript = await service.undo(undoCut.revision);
    expect(undoTranscript.words).toEqual([]);
    expect(undoTranscript.ranges).toEqual([{startMs: 0, endMs: 12_000}]);
    await expect(service.undo(undoTranscript.revision)).rejects.toMatchObject({code: 'NO_UNDO'});
  });

  it('keeps get responsive while render is busy and records a revisioned preview', async () => {
    const directory = await makeTemporaryDirectory();
    const sourcePath = path.join(directory, 'sample.mp4');
    await writeFile(sourcePath, 'source media');
    let holdRender = false;
    let startedResolve!: () => void;
    const started = new Promise<void>((resolve) => {
      startedResolve = resolve;
    });
    let releaseRender!: () => void;
    const renderRelease = new Promise<void>((resolve) => {
      releaseRender = resolve;
    });
    const options = fakeMediaOptions(12_000, async (args) => {
      const outputPath = args.at(-1);
      if (typeof outputPath !== 'string') throw new Error('missing output path');
      if (holdRender) {
        startedResolve();
        await renderRelease;
      }
      await writeFile(outputPath, 'fake media');
    });
    const service = await createRoughcutService(directory, options);
    const imported = await service.importFile(sourcePath);
    holdRender = true;
    const renderPromise = service.render();
    await started;
    await expect(service.get()).resolves.toMatchObject({busy: true, revision: imported.revision});
    releaseRender();
    await expect(renderPromise).resolves.toMatchObject({revision: imported.revision, url: expect.stringMatching(/^\/cut-media\/render-/u)});
    await expect(service.get()).resolves.toMatchObject({busy: false, preview: {revision: imported.revision}});
  });

  it('keeps an import history snapshot before replacing an existing asset', async () => {
    const directory = await makeTemporaryDirectory();
    const firstPath = path.join(directory, 'first.mp4');
    const secondPath = path.join(directory, 'second.mp4');
    await writeFile(firstPath, 'first media');
    await writeFile(secondPath, 'second media');
    const service = await createRoughcutService(directory, fakeMediaOptions());
    await service.importFile(firstPath);
    await service.importFile(secondPath);

    const historyFiles = await readdir(path.join(directory, 'history'));
    expect(historyFiles).toHaveLength(1);
    const backup = JSON.parse(await readFile(path.join(directory, 'history', historyFiles[0]), 'utf8')) as {
      state: {asset: {name: string} | null};
    };
    expect(backup.state.asset?.name).toBe('first.mp4');
  });
});


it('persists frame-aligned edits so many word cuts cannot accumulate clock drift',()=>{
 const ranges=snapRangesToFrames([{startMs:280,endMs:1160},{startMs:1540,endMs:10820}]);
 expect(ranges[0].startMs).toBe(300);
 for(const r of ranges){expect(r.startMs*30/1000).toBeCloseTo(Math.round(r.startMs*30/1000),8);expect(r.endMs*30/1000).toBeCloseTo(Math.round(r.endMs*30/1000),8)}
 const duration=ranges.reduce((s,r)=>s+r.endMs-r.startMs,0);expect(duration*30/1000).toBeCloseTo(Math.round(duration*30/1000),8);
 expect(()=>snapRangesToFrames([{startMs:1,endMs:2}])).toThrow();
});

it('recovers an interrupted task only when the host explicitly owns the service',async()=>{
 const dir=await makeTemporaryDirectory();const service=await createRoughcutService(dir);
 const file=path.join(dir,'roughcut.json');const envelope=JSON.parse(await readFile(file,'utf8'));envelope.state.busy=true;await writeFile(file,JSON.stringify(envelope));
 const recovered=await createRoughcutService(dir,{recoverInterrupted:true});const state=await recovered.get();expect(state.busy).toBe(false);expect(state.error).toContain('中断');expect(state.revision).toBe(0);
});
