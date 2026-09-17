import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {
  createProductionStore,
  type Feedback,
  type MaterialRequest,
  type ProductionState,
  type ProductionStoreError,
  type Scene,
} from './production-store.js';

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-workbench-production-store-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

function errorCode(error: unknown): string | undefined {
  return (error as Partial<ProductionStoreError>).code;
}

function scene(id: string, title = id): Scene {
  return {
    id,
    title,
    startWordId: `${id}-start`,
    endWordId: `${id}-end`,
    intent: `说明 ${title}`,
    beats: [{wordId: `${id}-beat`, label: '重点'}],
  };
}

function request(sceneId: string, id = `${sceneId}-request`): MaterialRequest {
  return {
    id,
    sceneId,
    description: '一张产品图',
    reason: '需要真实素材',
    status: 'missing',
  };
}

function feedback(sceneId: string, id = `${sceneId}-feedback`): Feedback {
  return {
    id,
    sceneId,
    timeMs: 1_250,
    text: '这里的画面节奏需要再看一遍',
    status: 'open',
    revision: 1,
  };
}

describe('production store', () => {
  it('rejects animation apply with a legacy predecessor without changing revision, requests or undo', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await createProductionStore(directory);
    const incoming: Scene = {...scene('b'), program:{moduleId:'incoming',parameters:{}}, entryTransition:{type:'dissolve',frames:8}};
    const before = await store.setScenes(0, null, [scene('a'), incoming], 'user');
    const disk = await readFile(path.join(directory, 'production.json'), 'utf8');
    await expect(store.setSceneWithRequests(before.revision, {...incoming,program:{moduleId:'replacement',parameters:{}}}, [request('b')])).rejects.toThrow('上一段');
    expect(await store.get()).toEqual(before);
    expect(await readFile(path.join(directory, 'production.json'), 'utf8')).toBe(disk);
  });
  it('creates, saves, and reopens a production document', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await createProductionStore(directory);

    await expect(store.get()).resolves.toEqual({
      revision: 0,
      source: null,
      scenes: [],
      requests: [],
      feedback: [],
    });

    const saved = await store.setScenes(0, {assetUrl: '/media/voice.mp4', cutRevision: 4}, [scene('scene-1', '开场')]);
    expect(saved).toMatchObject({
      revision: 1,
      source: {assetUrl: '/media/voice.mp4', cutRevision: 4},
      scenes: [{id: 'scene-1', title: '开场'}],
    });

    const reopened = await createProductionStore(directory);
    await expect(reopened.get()).resolves.toEqual(saved);
    const storedJson = JSON.parse(await readFile(path.join(directory, 'production.json'), 'utf8')) as {
      state: ProductionState;
    };
    expect(storedJson.state).toEqual(saved);
  });

  it('serializes instances and rejects stale revisions', async () => {
    const directory = await makeTemporaryDirectory();
    const first = await createProductionStore(directory);
    const second = await createProductionStore(directory);
    await first.get();
    await second.get();

    const current = await first.setScenes(0, null, [scene('scene-1')]);
    await expect(second.setScenes(0, null, [scene('scene-2')])).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'STALE_REVISION',
    );
    await expect(second.get()).resolves.toMatchObject({revision: current.revision, scenes: [{id: 'scene-1'}]});

    const [next, conflict] = await Promise.allSettled([
      first.setRequest(current.revision, request('scene-1')),
      second.setRequest(current.revision, {...request('scene-1', 'other-request'), status: 'provided'}),
    ]);
    expect([next.status, conflict.status].sort()).toEqual(['fulfilled', 'rejected']);
    const finalState = await first.get();
    expect(finalState.revision).toBe(2);
    expect(finalState.requests).toHaveLength(1);
  });

  it('replaces and adds requests while preserving feedback and request references on scene updates', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await createProductionStore(directory);
    let state = await store.setScenes(0, null, [scene('scene-1'), scene('scene-2')]);
    state = await store.setRequest(state.revision, request('scene-1'));
    state = await store.addFeedback(state.revision, feedback('scene-1'));

    state = await store.setRequest(state.revision, {...request('scene-1'), status: 'provided', fileName: 'product.png'});
    expect(state.requests).toEqual([expect.objectContaining({status: 'provided', fileName: 'product.png'})]);

    const updatedScene = {...scene('scene-1'), title: '修改后的开场'};
    state = await store.setScenes(state.revision, {assetUrl: '/media/voice-cut.mp4', cutRevision: 5}, [updatedScene, scene('scene-2')]);
    expect(state).toMatchObject({
      revision: 5,
      source: {assetUrl: '/media/voice-cut.mp4', cutRevision: 5},
      scenes: expect.arrayContaining([expect.objectContaining({id: 'scene-1', title: '修改后的开场'})]),
      requests: [{id: 'scene-1-request', sceneId: 'scene-1', status: 'provided'}],
      feedback: [{id: 'scene-1-feedback', sceneId: 'scene-1', status: 'open'}],
    });
  });

  it('rejects removal of scenes referenced by requests or feedback', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await createProductionStore(directory);
    let state = await store.setScenes(0, null, [scene('scene-1'), scene('scene-2')]);
    state = await store.setRequest(state.revision, request('scene-1'));
    state = await store.addFeedback(state.revision, feedback('scene-1'));

    await expect(store.setScenes(state.revision, null, [scene('scene-2')])).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INVALID_STATE',
    );
    await expect(store.get()).resolves.toMatchObject({
      revision: state.revision,
      scenes: expect.arrayContaining([expect.objectContaining({id: 'scene-1'})]),
    });
  });

  it('undoes changes with monotonic revisions and survives reopen', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await createProductionStore(directory);
    const first = await store.setScenes(0, {assetUrl: '/source.mp4', cutRevision: 1}, [scene('scene-1')]);
    const second = await store.setRequest(first.revision, request('scene-1'));
    const third = await store.addFeedback(second.revision, feedback('scene-1'));

    const undoneFeedback = await store.undo(third.revision);
    expect(undoneFeedback.revision).toBe(4);
    expect(undoneFeedback.feedback).toEqual([]);
    expect(undoneFeedback.requests).toHaveLength(1);

    const reopened = await createProductionStore(directory);
    const undoneRequest = await reopened.undo(undoneFeedback.revision);
    expect(undoneRequest.revision).toBe(5);
    expect(undoneRequest.requests).toEqual([]);
    expect(undoneRequest.scenes).toHaveLength(1);

    const undoneScenes = await reopened.undo(undoneRequest.revision);
    expect(undoneScenes.revision).toBe(6);
    expect(undoneScenes.source).toBeNull();
    expect(undoneScenes.scenes).toEqual([]);
    await expect(reopened.undo(undoneScenes.revision)).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'NO_UNDO',
    );
  });

  it('rejects bad references, duplicate IDs, empty values, and invalid ranges', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await createProductionStore(directory);

    await expect(store.setRequest(0, request('missing-scene'))).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INVALID_STATE',
    );
    await expect(store.addFeedback(0, feedback('missing-scene'))).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INVALID_STATE',
    );
    await expect(store.setScenes(0, null, [scene('same'), scene('same')])).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'DUPLICATE_ID',
    );
    await expect(store.setScenes(0, {assetUrl: '/source.mp4', cutRevision: -1}, [])).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INVALID_STATE',
    );
    await expect(store.setScenes(0, null, [{...scene('scene-1'), title: ''}])).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INVALID_STATE',
    );
    await expect(store.setScenes(0, null, [{...scene('scene-1'), beats: [{wordId: 'same', label: 'a'}, {wordId: 'same', label: 'b'}]}])).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INVALID_STATE',
    );
  });

  it('atomically replaces one scene and its animation-slot requests while preserving other state and undoing together', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await createProductionStore(directory);
    const original = {
      ...scene('scene-1'),
      editor: {overrides: {caption: '用户保留'}, locks: ['caption']},
    };
    let state = await store.setScenes(0, null, [original, scene('scene-2')]);
    state = await store.setRequest(state.revision, request('scene-1', 'old-request'));
    const templateId = 'f543988b-d9d3-4130-a7fc-37491b0f685d';
    const replacement: MaterialRequest = {
      id: 'animation-material-request',
      sceneId: 'scene-1',
      description: '保存动画素材',
      reason: '可替换槽位',
      status: 'missing',
      animationSlot: {templateId, moduleId: 'saved-template', materialId: 'slot-a'},
    };
    const changed = await store.setSceneWithRequests(
      state.revision,
      {...original, title: '应用动画', editor: {overrides: {caption: '不应覆盖'}, locks: []}},
      [replacement],
    );
    expect(changed.revision).toBe(state.revision + 1);
    expect(changed.scenes.find((candidate) => candidate.id === 'scene-1')).toMatchObject({
      title: '应用动画',
      editor: original.editor,
    });
    expect(changed.scenes.find((candidate) => candidate.id === 'scene-2')).toEqual(scene('scene-2'));
    expect(changed.requests).toEqual([replacement]);

    await expect(
      store.setSceneWithRequests(
        changed.revision,
        {...original, id: 'scene-1'},
        [{...replacement, id: 'cross-scene', sceneId: 'scene-2'}],
      ),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INVALID_STATE');
    await expect(store.get()).resolves.toEqual(changed);

    const undone = await store.undo(changed.revision);
    expect(undone.scenes).toEqual([original, scene('scene-2')]);
    expect(undone.requests).toEqual([request('scene-1', 'old-request')]);
  });

  it('fails closed for a corrupt existing file instead of replacing it', async () => {
    const directory = await makeTemporaryDirectory();
    const filePath = path.join(directory, 'production.json');
    const corrupt = '{not-json';
    await writeFile(filePath, corrupt, 'utf8');

    await expect(createProductionStore(directory)).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INVALID_STATE',
    );
    await expect(readFile(filePath, 'utf8')).resolves.toBe(corrupt);

    await writeFile(filePath, JSON.stringify({schemaVersion: 1, state: {}, history: []}), 'utf8');
    await expect(createProductionStore(directory)).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INVALID_STATE',
    );
  });
});

describe('creative design persistence',()=>{
 it('preserves design across reopen and undo, rejects broken references without writing',async()=>{
  const dir=await makeTemporaryDirectory(),store=await createProductionStore(dir);
  const source={assetUrl:'/media/a.mp4',cutRevision:1};
  const initial=scene('a');
  await store.setScenes(0,source,[initial]);
  const designed:Scene={...initial,design:{message:'重点',relationship:'递进',objects:[{id:'person',role:'main',content:'人物',source:'当前口播',layout:'全屏'}],actions:[{objectId:'person',wordId:'a-beat',action:'保持画面',purpose:'让观众关注表达'}],rationale:'内容由人物表达'}};
  await store.setScenes(1,source,[designed]);
  expect((await (await createProductionStore(dir)).get()).scenes[0].design).toEqual(designed.design);
  const before=await readFile(path.join(dir,'production.json'),'utf8');
  await expect(store.setScenes(2,source,[{...designed,design:{...designed.design!,actions:[{...designed.design!.actions[0],objectId:'missing'}]}}])).rejects.toThrow();
  expect(await readFile(path.join(dir,'production.json'),'utf8')).toBe(before);
  expect((await store.undo(2)).scenes[0].design).toBeUndefined();
 });
});
