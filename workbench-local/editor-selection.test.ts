import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';

import {
  createEditorSelection,
  type EditorSelectionInput,
} from './editor-selection.js';

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-workbench-editor-selection-'));
  temporaryDirectories.push(directory);
  return directory;
}

const baseSelection: EditorSelectionInput = {
  sceneId: 'scene-1',
  objectId: 'object-1',
  timeSeconds: 2.5,
  view: 'scene',
  baseRevision: 7,
  hasUnsavedChanges: true,
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})),
  );
});

describe('editor selection service', () => {
  it('returns defaults when the file is missing and reads the latest state after restart', async () => {
    const directory = await makeTemporaryDirectory();
    const filePath = path.join(directory, 'editor-selection.json');
    const service = await createEditorSelection(directory);

    await expect(service.get()).resolves.toEqual({
      sceneId: null,
      objectId: null,
      timeSeconds: 0,
      view: 'cut',
      baseRevision: 0,
      hasUnsavedChanges: false,
      updatedAt: null,
    });

    const written = await service.set(baseSelection);
    expect(written).toMatchObject(baseSelection);
    expect(written.updatedAt).toEqual(expect.any(String));
    expect(new Date(written.updatedAt as string).toISOString()).toBe(written.updatedAt);

    const restarted = await createEditorSelection(directory);
    await expect(restarted.get()).resolves.toEqual(written);
    await expect(readFile(filePath, 'utf8')).resolves.toContain('"sceneId": "scene-1"');
  });

  it('rejects invalid input without changing the existing file', async () => {
    const directory = await makeTemporaryDirectory();
    const service = await createEditorSelection(directory);
    const written = await service.set(baseSelection);
    const filePath = path.join(directory, 'editor-selection.json');
    const before = await readFile(filePath, 'utf8');

    await expect(service.set({...baseSelection, unknown: true} as never))
      .rejects.toMatchObject({code: 'INVALID_INPUT'});
    await expect(service.set({...baseSelection, timeSeconds: Number.NaN}))
      .rejects.toMatchObject({code: 'INVALID_INPUT'});
    await expect(service.set({...baseSelection, sceneId: 'x'.repeat(201)}))
      .rejects.toMatchObject({code: 'INVALID_INPUT'});

    await expect(readFile(filePath, 'utf8')).resolves.toBe(before);
    await expect(service.get()).resolves.toEqual(written);
  });

  it('serializes concurrent writes and leaves one valid JSON document', async () => {
    const directory = await makeTemporaryDirectory();
    const first = await createEditorSelection(directory);
    const second = await createEditorSelection(directory);
    const inputs = Array.from({length: 48}, (_, index) => ({
      ...baseSelection,
      objectId: `object-${index}`,
      timeSeconds: index / 2,
      baseRevision: index,
      hasUnsavedChanges: index % 2 === 0,
    }));

    await Promise.all(inputs.map((input, index) => (index % 2 === 0 ? first : second).set(input)));

    const filePath = path.join(directory, 'editor-selection.json');
    const serialized = await readFile(filePath, 'utf8');
    const decoded = JSON.parse(serialized) as Record<string, unknown>;
    expect(decoded).toEqual(await (await createEditorSelection(directory)).get());
    expect(Object.keys(decoded).sort()).toEqual([
      'baseRevision',
      'hasUnsavedChanges',
      'objectId',
      'sceneId',
      'timeSeconds',
      'updatedAt',
      'view',
    ]);
    await expect(readdir(directory)).resolves.toEqual(['editor-selection.json']);
  });

  it('enforces the scene and object relationship and surfaces corrupt files', async () => {
    const directory = await makeTemporaryDirectory();
    const service = await createEditorSelection(directory);

    await expect(service.set({...baseSelection, sceneId: null, objectId: 'object-1'}))
      .rejects.toMatchObject({code: 'INVALID_INPUT'});
    await expect(service.set({...baseSelection, sceneId: null, objectId: null}))
      .resolves.toMatchObject({sceneId: null, objectId: null});

    const corruptDirectory = await makeTemporaryDirectory();
    await writeFile(path.join(corruptDirectory, 'editor-selection.json'), '{broken', 'utf8');
    await expect(createEditorSelection(corruptDirectory))
      .rejects.toMatchObject({code: 'INVALID_STATE'});
  });
});
