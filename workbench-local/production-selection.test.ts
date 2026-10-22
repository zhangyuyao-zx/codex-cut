import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import {expect, it, vi} from 'vitest';
import {productionRoutes} from './production-routes';
import {createProductionStore} from './production-store';
import {createEditorSelection} from './editor-selection';
import type {createComponentLibrary} from './component-library';

it('validates selection without building renderer context or listing unrelated modules and preserves draft/revision fields', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'production-selection-'));
  let routes: Awaited<ReturnType<typeof productionRoutes>> | undefined;
  try {
    const scenes = path.join(root, 'workbench-local', 'scenes'), project = path.join(root, 'project');
    await mkdir(scenes, {recursive: true});
    await writeFile(path.join(scenes, 'demo.json'), JSON.stringify({id: 'demo', label: 'Demo', entry: 'Demo.tsx',
      exportName: 'Demo', controls: [], objects: [{id: 'title', label: 'Title', parameters: []}]}));
    await writeFile(path.join(scenes, 'Demo.tsx'), 'export const Demo=()=>null;');
    await writeFile(path.join(scenes, 'unrelated.json'), '{broken');
    const planStore = await createProductionStore(path.join(project, 'production'));
    const plan = await planStore.setScenes(0, null, [{id: 'scene', title: 'Scene', startWordId: 'a', endWordId: 'b',
      intent: 'Demo', beats: [], program: {moduleId: 'demo', parameters: {}}}]);
    const library = {detail: vi.fn(() => {throw Error('Full context must not be read');})};
    const app = express();
    app.use(express.json());
    routes = await productionRoutes(root, project, library as unknown as Awaited<ReturnType<typeof createComponentLibrary>>);
    app.use(routes);
    app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(409).json({error: error.message}));
    const input = {sceneId: 'scene', objectId: null, timeSeconds: 0, view: 'scene', baseRevision: plan.revision,
      hasUnsavedChanges: true};
    const post = (value: object) => request(app).post('/selection').send(value);
    expect((await post(input)).status).toBe(200);
    expect((await post({...input, objectId: 'title'})).body).toMatchObject({...input, objectId: 'title'});
    expect(library.detail).not.toHaveBeenCalled();
    const selectionFile = path.join(project, 'production', 'editor-selection.json');
    const before = await readFile(selectionFile, 'utf8');
    for (const invalid of [
      {...input, objectId: 'missing'}, {...input, sceneId: 'missing'},
      {...input, objectId: 'title', sceneId: null}, {...input, timeSeconds: 0.051},
      {...input, timeSeconds: -1}, {...input, timeSeconds: '0'},
      {...input, baseRevision: -1}, {...input, extra: true}, {},
    ]) expect((await post(invalid)).status).toBe(409);
    expect(await readFile(selectionFile, 'utf8')).toBe(before);
    const selection = await createEditorSelection(path.join(project, 'production'));
    expect(await selection.get()).toMatchObject({...input, objectId: 'title'});
    // Selection records the editor's own base revision, including an older
    // draft; it must not silently rebase it to the current production revision.
    expect((await post({...input, objectId: 'title', baseRevision: 0, timeSeconds: 0.05})).body)
      .toMatchObject({baseRevision: 0, hasUnsavedChanges: true, timeSeconds: 0.05});
    // A null object only needs the production/cut snapshot, even if authored
    // scene code is currently broken or unavailable.
    await rm(path.join(scenes, 'demo.json'));
    expect((await post(input)).status).toBe(200);
    expect((await post({...input, objectId: 'title'})).status).toBe(409);
  } finally {
    await routes?.shutdown();
    await rm(root, {recursive: true, force: true});
  }
});
