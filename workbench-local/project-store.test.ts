import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {ProjectStore, type Project, type ProjectStoreError} from './project-store.js';

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-workbench-project-store-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

function errorCode(error: unknown): string | undefined {
  return (error as Partial<ProjectStoreError>).code;
}

describe('ProjectStore', () => {
  it('creates defaults, persists patches, and reopens the same project', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await ProjectStore.open(directory, {id: 'project-1', name: '样片'});

    await expect(store.get()).resolves.toMatchObject({
      schemaVersion: 1,
      id: 'project-1',
      name: '样片',
      revision: 0,
      values: {
        title: '每个词，',
        accent: '#E1F795',
        personScale: 1,
        personX: 0,
        personY: 0,
        titleScale: 1,
      },
      motion: {offsetFrames: 0},
      locks: [],
    });

    const patched = await store.patch(0, {
      values: {title: '看这一段', personScale: 1.2, personX: 42},
      motion: {offsetFrames: -3},
    }, 'user');
    expect(patched.revision).toBe(1);
    expect(patched.updatedAt).not.toBe('');

    const reopened = await ProjectStore.open(directory);
    await expect(reopened.get()).resolves.toMatchObject({
      id: 'project-1',
      name: '样片',
      revision: 1,
      values: {title: '看这一段', personScale: 1.2, personX: 42},
      motion: {offsetFrames: -3},
    });

    const envelope = JSON.parse(await readFile(path.join(directory, 'project.json'), 'utf8')) as {
      current: Project;
      undoStack: Project[];
      redoStack: Project[];
    };
    expect(envelope.current.revision).toBe(1);
    expect(envelope.undoStack).toHaveLength(1);
    expect(envelope.redoStack).toHaveLength(0);
  });

  it('rejects stale revisions and codex writes to locked paths while retaining user values on motion patches', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await ProjectStore.open(directory, {id: 'locked-project', name: '锁定测试'});
    const userValues = await store.patch(0, {
      values: {title: '用户标题', personScale: 0.8, personX: -24, personY: 12, titleScale: 1.3},
      locks: ['values.title', 'values.personScale'],
    }, 'user');

    await expect(store.patch(0, {motion: {offsetFrames: 1}}, 'codex'))
      .rejects.toSatisfy((error: unknown) => errorCode(error) === 'STALE_REVISION');
    await expect(store.patch(userValues.revision, {locks: []}, 'codex'))
      .rejects.toSatisfy((error: unknown) => errorCode(error) === 'LOCKED_FIELD');
    await expect(store.patch(userValues.revision, {values: {title: '模型标题'}}, 'codex'))
      .rejects.toSatisfy((error: unknown) => errorCode(error) === 'LOCKED_FIELD');

    const motion = await store.patch(userValues.revision, {motion: {offsetFrames: 5}}, 'codex');
    expect(motion).toMatchObject({
      revision: 2,
      values: {title: '用户标题', personScale: 0.8, personX: -24, personY: 12, titleScale: 1.3},
      motion: {offsetFrames: 5},
    });
  });

  it('persists undo and redo as new monotonic revisions across reopen', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await ProjectStore.open(directory, {id: 'history-project', name: '历史测试'});
    const first = await store.patch(0, {values: {title: '第一版'}}, 'user');
    const second = await store.patch(first.revision, {values: {accent: '#123456'}}, 'user');

    const undone = await store.undo(second.revision);
    expect(undone.revision).toBe(3);
    expect(undone.values).toMatchObject({title: '第一版', accent: '#E1F795'});

    const reopened = await ProjectStore.open(directory);
    const redone = await reopened.redo(undone.revision);
    expect(redone.revision).toBe(4);
    expect(redone.values).toMatchObject({title: '第一版', accent: '#123456'});

    const reopenedAgain = await ProjectStore.open(directory);
    const undoneAgain = await reopenedAgain.undo(redone.revision);
    expect(undoneAgain.revision).toBe(5);
    expect(undoneAgain.values).toMatchObject({title: '第一版', accent: '#E1F795'});
  });

  it('fails closed for malformed or structurally invalid existing project files', async () => {
    const directory = await makeTemporaryDirectory();
    const projectPath = path.join(directory, 'project.json');
    await writeFile(projectPath, '{ this is not json', 'utf8');
    await expect(ProjectStore.open(directory)).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INVALID_PROJECT');

    await writeFile(projectPath, JSON.stringify({schemaVersion: 1, current: {schemaVersion: 1}, undoStack: [], redoStack: []}), 'utf8');
    await expect(ProjectStore.open(directory)).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INVALID_PROJECT');
  });

  it('rejects unknown patch keys and out-of-bounds values', async () => {
    const directory = await makeTemporaryDirectory();
    const store = await ProjectStore.open(directory);

    await expect(store.patch(0, {values: {personScale: 2}} as never, 'user'))
      .rejects.toSatisfy((error: unknown) => errorCode(error) === 'INVALID_PROJECT');
    await expect(store.patch(0, {values: {title: '合法', extra: '禁止'}} as never, 'user'))
      .rejects.toSatisfy((error: unknown) => errorCode(error) === 'INVALID_PROJECT');
    await expect(store.patch(0, {motion: {offsetFrames: 13}}, 'user'))
      .rejects.toSatisfy((error: unknown) => errorCode(error) === 'INVALID_PROJECT');
  });
});
