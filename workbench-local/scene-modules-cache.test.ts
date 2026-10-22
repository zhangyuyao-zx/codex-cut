import {mkdtemp, mkdir, realpath, rm, stat, symlink, unlink, utimes, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, expect, it, vi} from 'vitest';
import {createSceneModules} from './scene-modules';
import * as dependencies from './source-dependencies';

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(root => rm(root, {recursive: true, force: true})));
});
async function fixture(source = "import {value} from './value'; export const Demo=()=>value;") {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-scene-cache-'));
  roots.push(root);
  const scenes = path.join(root, 'workbench-local', 'scenes');
  await mkdir(scenes, {recursive: true});
  const manifest = {id: 'demo', label: 'Demo', entry: 'Demo.tsx', exportName: 'Demo',
    controls: [{key: 'caption', label: 'Caption', type: 'text', default: 'one'}]};
  await writeFile(path.join(scenes, 'demo.json'), JSON.stringify(manifest));
  await writeFile(path.join(scenes, 'Demo.tsx'), source);
  await writeFile(path.join(scenes, 'value.js'), 'export const value=1;');
  return {root, scenes, manifest};
}

it('reuses unchanged parsing/traversal, single-flights concurrent loads, reports dependencies and isolates returned objects', async () => {
  const {root, scenes} = await fixture();
  const traversal = vi.spyOn(dependencies, 'localSourceDependencies');
  const observed = new Set<string>();
  const service = createSceneModules(root, undefined, {onDependency: file => observed.add(file)});
  const [first, concurrent] = await Promise.all([service.detail('demo'), service.detail('demo')]);
  expect(traversal).toHaveBeenCalledTimes(1);
  expect(concurrent).toEqual(first);
  (first.controls[0] as {default: string}).default = 'poison';
  expect((await service.detail('demo')).controls[0]).toMatchObject({default: 'one'});
  expect(traversal).toHaveBeenCalledTimes(1);
  expect(observed).toContain(path.join(scenes, 'demo.json'));
  expect(observed).toContain(path.join(await realpath(scenes), 'value.js'));
  expect(observed).toContain(path.join(await realpath(scenes), 'value.ts'));
});

it('invalidates same-size replacements with restored mtime, new resolution candidates, source imports and manifest edits', async () => {
  const {root, scenes, manifest} = await fixture();
  const service = createSceneModules(root);
  let previous = await service.detail('demo');
  const assertChanged = async () => {
    const next = await service.detail('demo');
    expect(next.sourceHash).not.toBe(previous.sourceHash);
    expect(next).toEqual(await createSceneModules(root).detail('demo'));
    previous = next;
  };
  const file = path.join(scenes, 'value.js'), info = await stat(file);
  await writeFile(file, 'export const value=2;');
  await utimes(file, info.atime, info.mtime);
  await assertChanged();
  await writeFile(path.join(scenes, 'value.ts'), 'export const value=3;');
  await assertChanged();
  await writeFile(path.join(scenes, 'deep.ts'), 'export const deep=4;');
  await writeFile(path.join(scenes, 'extra.ts'), "import {deep} from './deep'; export const extra=deep;");
  await writeFile(path.join(scenes, 'Demo.tsx'), "import {extra} from './extra'; export const Demo=()=>extra;");
  await assertChanged();
  await writeFile(path.join(scenes, 'deep.ts'), 'export const deep=5;');
  await assertChanged();
  await writeFile(path.join(scenes, 'demo.json'), JSON.stringify({...manifest, label: 'Edit'}));
  await assertChanged();
  expect((await service.list()).map(item => item.id)).toEqual(['demo']);
  await writeFile(path.join(scenes, 'new.json'), JSON.stringify({...manifest, id: 'new'}));
  expect((await service.list()).map(item => item.id)).toEqual(['demo', 'new']);
});

it('invalidates code and static asset symlink retargets and recovers from deletion and invalid manifests', async () => {
  const {root, scenes, manifest} = await fixture("import {value} from './alias'; import {staticFile} from 'remotion'; export const Demo=()=>value+staticFile('image.dat');");
  const publicDir = path.join(root, 'public');
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, 'a.dat'), 'aaaa');
  await writeFile(path.join(publicDir, 'b.dat'), 'bbbb');
  await symlink('a.dat', path.join(publicDir, 'image.dat'));
  await writeFile(path.join(scenes, 'other.js'), 'export const value=2;');
  await symlink('value.js', path.join(scenes, 'alias.js'));
  const service = createSceneModules(root), first = await service.detail('demo');
  await unlink(path.join(scenes, 'alias.js'));
  await symlink('other.js', path.join(scenes, 'alias.js'));
  const second = await service.detail('demo');
  expect(second.sourceHash).not.toBe(first.sourceHash);
  await unlink(path.join(publicDir, 'image.dat'));
  await symlink('b.dat', path.join(publicDir, 'image.dat'));
  const third = await service.detail('demo');
  expect(third.sourceHash).not.toBe(second.sourceHash);
  await unlink(path.join(scenes, 'other.js'));
  await expect(service.detail('demo')).rejects.toThrow();
  await writeFile(path.join(scenes, 'other.js'), 'export const value=3;');
  expect((await service.detail('demo')).sourceHash).not.toBe(third.sourceHash);
  await writeFile(path.join(scenes, 'demo.json'), '{bad');
  await expect(service.detail('demo')).rejects.toThrow('invalid JSON');
  await writeFile(path.join(scenes, 'demo.json'), JSON.stringify(manifest));
  await expect(service.detail('demo')).resolves.toMatchObject({id: 'demo'});
  await unlink(path.join(publicDir, 'b.dat'));
  await expect(service.detail('demo')).rejects.toThrow();
  await writeFile(path.join(publicDir, 'b.dat'), 'cccc');
  await expect(service.detail('demo')).resolves.toMatchObject({id: 'demo'});
});

it('freshly validates declared runtime identities and recovers after a package version mismatch', async () => {
  const {root, scenes, manifest} = await fixture("import * as THREE from 'three'; export const Demo=()=>THREE;");
  await writeFile(path.join(scenes, 'demo.json'), JSON.stringify({...manifest, dependencies: {three: '0.186.1'}}));
  const folder = path.join(root, 'node_modules', 'three');
  await mkdir(folder, {recursive: true});
  const packageFile = path.join(folder, 'package.json');
  const installed = {name: 'three', version: '0.186.1', module: 'index.js'};
  await writeFile(packageFile, JSON.stringify(installed));
  await writeFile(path.join(folder, 'index.js'), 'export const x=1;');
  const traversal = vi.spyOn(dependencies, 'localSourceDependencies');
  const service = createSceneModules(root), first = await service.detail('demo');
  await writeFile(path.join(folder, 'same.js'), 'export const x=1;');
  await unlink(path.join(folder, 'index.js'));
  await symlink('same.js', path.join(folder, 'index.js'));
  expect(await service.detail('demo')).toEqual(first);
  expect(traversal).toHaveBeenCalledTimes(2);
  await writeFile(packageFile, JSON.stringify({...installed, version: '0.186.2'}));
  await expect(service.detail('demo')).rejects.toThrow('版本不匹配');
  await writeFile(packageFile, JSON.stringify(installed));
  expect(await service.detail('demo')).toEqual(first);
  await writeFile(path.join(folder, 'index.js'), 'export const x=2;');
  expect((await service.detail('demo')).sourceHash).not.toBe(first.sourceHash);
});

it('reports missing transitive dependency candidates on the first failed load so their repair can be observed', async () => {
  const {root} = await fixture("import {value} from '../../shared/missing'; export const Demo=()=>value;");
  const shared = path.join(root, 'shared');
  await mkdir(shared);
  const observed = new Set<string>();
  const service = createSceneModules(root, undefined, {onDependency: file => observed.add(file)});
  await expect(service.detail('demo')).rejects.toThrow('动画依赖不存在');
  expect(observed).toContain(path.join(await realpath(shared), 'missing.ts'));
  await writeFile(path.join(shared, 'missing.ts'), 'export const value=1;');
  await expect(service.detail('demo')).resolves.toMatchObject({id: 'demo'});
});

it('keeps external mutable providers fresh and clones their outputs', async () => {
  const {root} = await fixture();
  const module = await createSceneModules(root).detail('demo');
  let calls = 0;
  const service = createSceneModules(root, {detail: async () => ({...module, label: String(++calls)}), list: async () => [module]});
  expect((await service.detail('demo')).label).toBe('1');
  expect((await service.detail('demo')).label).toBe('2');
  const listed = await service.list();
  (listed[0] as {label: string}).label = 'poison';
  expect(module.label).toBe('Demo');
});
