import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {canonicalPath, projectDirectory, contentProjectIdentity, selectionFile, assertProjectStorage} from './project-location.mjs';
import {createConfig, withProjectSelectionLock} from './launcher.mjs';
import {selectProject} from './select-project.mjs';

async function fixture(t) {
  const path=await mkdtemp(resolve(tmpdir(),'codex-project-entry-'));
  t.after(()=>rm(path,{recursive:true,force:true}));
  const root=canonicalPath(path);
  return {root, target:resolve(root,'projects/C20261029-001'), inspect:async()=>({kind:'free'})};
}

test('selection creates a separate empty identity, persists path and does not import or start',async t=>{
  const f=await fixture(t), legacy=resolve(f.root,'projects/local-workbench');
  await mkdir(legacy,{recursive:true});await writeFile(resolve(legacy,'project.json'),'untouched');
  const result=await selectProject({...f,path:f.target,contentId:'C20261029-001',name:'独立技术验证'});
  assert.equal(result.started,false);assert.equal(result.imported,false);
  assert.equal(projectDirectory(f.root,{}),f.target);
  assert.deepEqual(contentProjectIdentity(f.target),{contentId:'C20261029-001',name:'独立技术验证'});
  assert.equal(await readFile(resolve(legacy,'project.json'),'utf8'),'untouched');
  assert.equal((await selectProject({...f,path:f.target})).contentId,'C20261029-001');
  await assert.rejects(selectProject({...f,path:f.target,contentId:'C20261029-002'}),/另一个内容编号/);
});

test('new content selection inherits the private authoring policy without filling or approving design',async t=>{
  const f=await fixture(t);await mkdir(resolve(f.root,'projects'),{recursive:true});
  await writeFile(resolve(f.root,'projects/production-policy.json'),JSON.stringify({schemaVersion:1,method:'dots',requiredFromContentId:'C20261029-001'}));
  await selectProject({...f,path:f.target,contentId:'C20261029-001',name:'独立技术验证'});
  const file=resolve(f.target,'production/authoring.json');
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{schemaVersion:1,method:'dots',contentId:'C20261029-001',film:'',scenes:[]});
  await writeFile(file,'{"preserve":"user edits"}');
  await selectProject({...f,path:f.target});
  assert.equal(await readFile(file,'utf8'),'{"preserve":"user edits"}');
});

test('running or unknown service blocks selection before creating files',async t=>{
  const f=await fixture(t);
  for(const kind of ['ready','starting','foreign','unreachable'])
    await assert.rejects(selectProject({...f,path:f.target,contentId:'C20261029-001',name:'test',inspect:async()=>({kind})}),/先保存并停止/);
  await assert.rejects(readFile(selectionFile(f.root)),{code:'ENOENT'});
  await assert.rejects(readFile(resolve(f.target,'content-project.json')),{code:'ENOENT'});
});

test('existing media directories cannot be relabelled or overwritten as a new content project',async t=>{
  const f=await fixture(t);await mkdir(f.target,{recursive:true});
  await writeFile(resolve(f.target,'original.mp4'),'protected');
  await assert.rejects(selectProject({...f,path:f.target,contentId:'C20261029-001',name:'new'}),/非空旧目录/);
  await assert.rejects(selectProject({...f,path:f.target}),/不是已知视频工程/);
  assert.equal(await readFile(resolve(f.target,'original.mp4'),'utf8'),'protected');
});

test('explicit environment overrides saved selection and canonicalizes aliases; corrupt selection fails closed',async t=>{
  const f=await fixture(t);await mkdir(resolve(f.root,'projects'),{recursive:true});
  const other=resolve(f.root,'other'),alias=resolve(f.root,'alias');await mkdir(other);await symlink(other,alias);
  await writeFile(selectionFile(f.root),JSON.stringify({version:1,projectDir:f.target}));
  assert.equal(projectDirectory(f.root,{}),f.target);
  assert.equal(projectDirectory(f.root,{WORKBENCH_PROJECT_DIR:alias}),other);
  await writeFile(selectionFile(f.root),'{}');
  assert.throws(()=>projectDirectory(f.root,{}),/配置无效/);
});

test('environment and persisted paths cannot target source, ancestors or relative directories',async t=>{
  const f=await fixture(t);await mkdir(resolve(f.root,'projects'),{recursive:true});
  for(const path of [f.root,resolve(f.root,'..'),'/', 'relative/path']) {
    assert.throws(()=>projectDirectory(f.root,{WORKBENCH_PROJECT_DIR:path}),/工程目录/);
    await writeFile(selectionFile(f.root),JSON.stringify({version:1,projectDir:path}));
    assert.throws(()=>projectDirectory(f.root,{}),/工程目录|配置无效/);
  }
});

test('a conflicting environment override cannot report a different saved project',async t=>{
  const f=await fixture(t);
  await assert.rejects(selectProject({...f,path:f.target,contentId:'C20261029-001',name:'test',env:{WORKBENCH_PROJECT_DIR:resolve(f.root,'other')}}),/覆盖另一个工程/);
  await assert.rejects(readFile(selectionFile(f.root)),{code:'ENOENT'});
  await assert.rejects(readFile(resolve(f.target,'content-project.json')),{code:'ENOENT'});
});

test('startup storage check rejects unrelated files and mismatched identities before initializing',async t=>{
  const f=await fixture(t);await mkdir(f.target,{recursive:true});
  await writeFile(resolve(f.target,'original.mp4'),'protected');
  assert.throws(()=>assertProjectStorage(f.target),/不是已知视频工程/);
  await writeFile(resolve(f.target,'content-project.json'),JSON.stringify({version:1,contentId:'C20261029-001',name:'test'}));
  await writeFile(resolve(f.target,'project.json'),JSON.stringify({current:{id:'different'}}));
  assert.throws(()=>assertProjectStorage(f.target),/身份不一致/);
  assert.equal(await readFile(resolve(f.target,'original.mp4'),'utf8'),'protected');
});

test('selection and startup share a lock across different project directories',async t=>{
  const f=await fixture(t),other=resolve(f.root,'other');
  assert.equal(createConfig({root:f.root,projectDir:other}).lockPath,createConfig({root:f.root,projectDir:f.target}).lockPath);
  await withProjectSelectionLock({root:f.root,projectDir:other},async()=>{
    await assert.rejects(selectProject({...f,path:f.target,contentId:'C20261029-001',name:'test'}),/正在启动或选择/);
    await assert.rejects(readFile(selectionFile(f.root)),{code:'ENOENT'});
  });
  assert.equal((await selectProject({...f,path:f.target,contentId:'C20261029-001',name:'test'})).projectDir,f.target);
});
