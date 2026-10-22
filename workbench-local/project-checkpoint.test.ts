import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,chmod,stat,readdir,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createProjectCheckpoint,verifyProjectCheckpoint,restoreProjectCheckpoint} from './project-checkpoint';
it('restores matching code, media, locks and saved animation without touching a changed original',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'checkpoint-'));
 try{
  const repo=path.join(root,'repo'),project=path.join(root,'project'),backup=path.join(root,'backup'),restored=path.join(root,'restored');
  for(const f of ['repo/workbench-local/scenes/scene.jsx','repo/modules/server/transcription.ts','repo/package-lock.json','project/cut/source.mp4','project/production/production.json','project/animation-templates/templates.json','project/visual-library/library.json','project/visual-library/assets/title/1.0.0/Asset.tsx','project/visual-library/references/ref-one/original.mp4']){await mkdir(path.dirname(path.join(root,f)),{recursive:true});await writeFile(path.join(root,f),'original:'+f);}
  await chmod(path.join(repo,"workbench-local/scenes/scene.jsx"),0o755);
  await writeFile(path.join(repo,'workbench-local/tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
  const savedCut={schemaVersion:1,state:{revision:7,words:[{id:'word-1',text:'原词',startMs:140,endMs:460}],confirmations:{roughCut:true}}};
  const savedProduction={schemaVersion:1,state:{revision:12,stylePack:{id:'fixed-style',version:'1.0.0'},scenes:[{id:'scene-1',editor:{objectTransforms:{title:{x:42,y:18}},objectLocks:{title:true},locks:['title.color'],overrides:{title:{color:'#ffcc00'}}}}],feedback:[],requests:[]},editorJournal:{entries:[{operationId:'saved-operation',status:'applied'}]}};
  await writeFile(path.join(repo,'package.json'),JSON.stringify({version:'0.2.3'}));
  await writeFile(path.join(project,'cut/roughcut.json'),JSON.stringify(savedCut));
  await writeFile(path.join(project,'production/production.json'),JSON.stringify(savedProduction));
  const captured=await createProjectCheckpoint({repo,project,destination:backup,label:'  客户确认版  '});
  expect(captured.label).toBe('客户确认版');
  expect(captured.source).toEqual({workbenchVersion:'0.2.3',cutRevision:7,productionRevision:12});
  await writeFile(path.join(repo,'workbench-local/scenes/scene.jsx'),'new code');
  await writeFile(path.join(repo,'package.json'),JSON.stringify({version:'9.0.0'}));
  await writeFile(path.join(project,'cut/roughcut.json'),'changed cut');
  await writeFile(path.join(project,'production/production.json'),'changed editor state');
  await writeFile(path.join(project,'visual-library/library.json'),'changed library');
  await writeFile(path.join(project,'cut/source.mp4'),'changed media');
  const result=await restoreProjectCheckpoint(backup,restored);
  expect(result.source).toEqual(captured.source);
  expect(result.contentIdentity).toEqual(captured.contentIdentity);
  expect(JSON.parse(await readFile(path.join(restored,'project/cut/roughcut.json'),'utf8'))).toEqual(savedCut);
  expect(JSON.parse(await readFile(path.join(restored,'project/production/production.json'),'utf8'))).toEqual(savedProduction);
  expect(await readFile(path.join(restored,'project/visual-library/library.json'),'utf8')).toBe('original:project/visual-library/library.json');
  expect(await readFile(path.join(restored,'project/cut/source.mp4'),'utf8')).toBe('original:project/cut/source.mp4');
  expect(await readFile(path.join(project,'production/production.json'),'utf8')).toBe('changed editor state');
  expect(await readFile(path.join(project,'cut/source.mp4'),'utf8')).toBe('changed media');
  expect(await readFile(path.join(restored,'code/package.json'),'utf8')).toBe(JSON.stringify({version:'0.2.3'}));
  expect(await readFile(path.join(restored,'code/workbench-local/scenes/scene.jsx'),'utf8')).toContain('original:');
  expect(await readFile(path.join(repo,'workbench-local/scenes/scene.jsx'),'utf8')).toBe('new code');
  expect(await readFile(path.join(restored,'project/visual-library/assets/title/1.0.0/Asset.tsx'),'utf8')).toBe('original:project/visual-library/assets/title/1.0.0/Asset.tsx');
  expect(await readFile(path.join(restored,'project/visual-library/references/ref-one/original.mp4'),'utf8')).toBe('original:project/visual-library/references/ref-one/original.mp4');
  expect((await stat(path.join(restored,'code/workbench-local/scenes/scene.jsx'))).mode & 0o777).toBe(0o755);
  expect(JSON.parse(await readFile(path.join(restored,'code/workbench-local/tsconfig.json'),'utf8')).compilerOptions.jsx).toBe('react-jsx');
  await expect(restoreProjectCheckpoint(backup,project)).rejects.toThrow('不能覆盖');
  await writeFile(path.join(backup,'project/cut/source.mp4'),'corrupt');
  await expect(verifyProjectCheckpoint(backup)).rejects.toThrow('校验失败');
  await writeFile(path.join(backup,'project/cut/source.mp4'),'original:project/cut/source.mp4');
  const manifestPath=path.join(backup,'checkpoint.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8')) as {files:Array<{path:string;mode:number}>};
  const sourceEntry=manifest.files.find(entry=>entry.path==='code/workbench-local/scenes/scene.jsx')!;
  sourceEntry.mode=sourceEntry.mode===0o755?0o644:0o755;
  await writeFile(manifestPath,JSON.stringify({...manifest,dependencies:'install-from-lockfile',schemaVersion:1,createdAt:'now'}));
  await expect(verifyProjectCheckpoint(backup)).rejects.toThrow('校验失败');
 }finally{await rm(root,{recursive:true,force:true});}
});

it('keeps content identity stable across names, timestamps and manifest order; validates optional metadata and legacy schema 1',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'checkpoint-metadata-'));
 try{
  const repo=path.join(root,'repo'),project=path.join(root,'project'),backup=path.join(root,'backup');
  await mkdir(path.join(repo,'workbench-local'),{recursive:true});await mkdir(path.join(project,'cut'),{recursive:true});await mkdir(path.join(project,'production'),{recursive:true});
  await writeFile(path.join(repo,'package.json'),JSON.stringify({version:'1.2.3-beta.1+paired'}));
  await writeFile(path.join(repo,'workbench-local/base.ts'),'base');
  await writeFile(path.join(project,'cut/roughcut.json'),JSON.stringify({state:{revision:0}}));
  await writeFile(path.join(project,'production/production.json'),JSON.stringify({state:{revision:3}}));
  const first=await createProjectCheckpoint({repo,project,destination:backup,label:' A '});
  const second=await createProjectCheckpoint({repo,project,destination:path.join(root,'second'),label:'B'});
  expect(second.contentIdentity).toEqual(first.contentIdentity);
  expect(first.contentIdentity).toMatchObject({algorithm:'sha256',code:expect.stringMatching(/^[a-f0-9]{64}$/),project:expect.stringMatching(/^[a-f0-9]{64}$/),combined:expect.stringMatching(/^[a-f0-9]{64}$/)});
  const manifestFile=path.join(backup,'checkpoint.json');
  const original=JSON.parse(await readFile(manifestFile,'utf8'));
  await writeFile(manifestFile,JSON.stringify({...original,createdAt:'another-time',label:'Renamed',files:[...original.files].reverse()}));
  expect((await verifyProjectCheckpoint(backup)).contentIdentity).toEqual(first.contentIdentity);
  for(const changes of [
   {label:1},{label:'bad\nname'},{label:' spaced '},{label:'x'.repeat(81)},
   {source:{workbenchVersion:14}},{source:{cutRevision:-1}},{source:{productionRevision:1.5}},
   {source:{cutRevision:Number.MAX_SAFE_INTEGER+1}},{source:{unexpected:'value'}},
   {contentIdentity:{...original.contentIdentity,algorithm:'md5'}},
   {contentIdentity:{...original.contentIdentity,code:'bad'}},
   {contentIdentity:{...original.contentIdentity,project:'0'.repeat(64)}},
  ]){
   await writeFile(manifestFile,JSON.stringify({...original,...changes}));
   await expect(verifyProjectCheckpoint(backup)).rejects.toThrow();
  }
  for(const source of [
   {...original.source,workbenchVersion:'9.0.0'},
   {...original.source,cutRevision:9},
   {...original.source,productionRevision:9},
   {},
  ]){
   await writeFile(manifestFile,JSON.stringify({...original,source}));
   await expect(verifyProjectCheckpoint(backup)).rejects.toThrow('来源元数据校验失败');
   await expect(restoreProjectCheckpoint(backup,path.join(root,'rejected'))).rejects.toThrow('来源元数据校验失败');
   await expect(stat(path.join(root,'rejected'))).rejects.toThrow();
  }
  delete original.label;delete original.source;delete original.contentIdentity;
  await writeFile(manifestFile,JSON.stringify(original));
  const legacy=await verifyProjectCheckpoint(backup);
  expect(legacy.source).toBeUndefined();expect(legacy.contentIdentity).toBeUndefined();
  await restoreProjectCheckpoint(backup,path.join(root,'legacy-restored'));
  expect(await readFile(path.join(root,'legacy-restored/code/workbench-local/base.ts'),'utf8')).toBe('base');
  await writeFile(path.join(repo,'workbench-local/base.ts'),'different code');
  const codeChanged=await createProjectCheckpoint({repo,project,destination:path.join(root,'code-changed')});
  expect(codeChanged.contentIdentity?.code).not.toBe(first.contentIdentity?.code);
  expect(codeChanged.contentIdentity?.project).toBe(first.contentIdentity?.project);
  await chmod(path.join(repo,'workbench-local/base.ts'),0o755);
  const modeChanged=await createProjectCheckpoint({repo,project,destination:path.join(root,'mode-changed')});
  expect(modeChanged.contentIdentity?.code).not.toBe(codeChanged.contentIdentity?.code);
  await writeFile(path.join(project,'cut/roughcut.json'),JSON.stringify({state:{revision:4}}));
  const projectChanged=await createProjectCheckpoint({repo,project,destination:path.join(root,'project-changed')});
  expect(projectChanged.contentIdentity?.code).toBe(modeChanged.contentIdentity?.code);
  expect(projectChanged.contentIdentity?.project).not.toBe(modeChanged.contentIdentity?.project);
 }finally{await rm(root,{recursive:true,force:true});}
});

it('rejects invalid create labels before writing and omits invalid captured versions or revisions',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'checkpoint-input-'));
 try{
  const repo=path.join(root,'repo'),project=path.join(root,'project'),backup=path.join(root,'backup');
  await mkdir(repo);await mkdir(path.join(project,'cut'),{recursive:true});await mkdir(path.join(project,'production'),{recursive:true});
  await writeFile(path.join(repo,'package.json'),JSON.stringify({version:'not a version'}));
  await writeFile(path.join(project,'cut/roughcut.json'),JSON.stringify({state:{revision:-1}}));
  await writeFile(path.join(project,'production/production.json'),JSON.stringify({state:{revision:'3'}}));
  for(const label of [null,{},42,'\nname','name\u007f','x'.repeat(81)]){
   await expect(createProjectCheckpoint({repo,project,destination:backup,label:label as string})).rejects.toThrow('备份名称');
   await expect(stat(backup)).rejects.toThrow();
  }
  const captured=await createProjectCheckpoint({repo,project,destination:backup,label:'  '});
  expect(captured.label).toBeUndefined();expect(captured.source).toEqual({});
  await expect(verifyProjectCheckpoint(backup)).resolves.toMatchObject({source:{}});
 }finally{await rm(root,{recursive:true,force:true});}
});

it('accepts a named backup through the CLI and returns captured metadata for create, verify and restore',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'checkpoint-cli-'));
 try{
  const repo=path.join(root,'repo'),project=path.join(root,'project'),backup=path.join(root,'backup'),restored=path.join(root,'restored');
  await mkdir(repo);await mkdir(project);await writeFile(path.join(repo,'package.json'),JSON.stringify({version:'1.0.0'}));
  const cli=fileURLToPath(new URL('./checkpoint-cli.ts',import.meta.url));
  const run=promisify(execFile);
  const create=JSON.parse((await run(process.execPath,['--import','tsx',cli,'create',repo,project,backup,'--label','  CLI 配对版  '])).stdout);
  expect(create.label).toBe('CLI 配对版');expect(create.source.workbenchVersion).toBe('1.0.0');
  const verified=JSON.parse((await run(process.execPath,['--import','tsx',cli,'verify',backup])).stdout);
  expect(verified.contentIdentity).toEqual(create.contentIdentity);
  const result=JSON.parse((await run(process.execPath,['--import','tsx',cli,'restore',backup,restored])).stdout);
  expect(result.label).toBe('CLI 配对版');expect(result.contentIdentity).toEqual(create.contentIdentity);
  await expect(run(process.execPath,['--import','tsx',cli,'create',repo,project,path.join(root,'bad'),'--label','bad\nlabel'])).rejects.toMatchObject({code:1,stderr:expect.stringContaining('备份名称')});
  await expect(stat(path.join(root,'bad'))).rejects.toThrow();
 }finally{await rm(root,{recursive:true,force:true});}
});
it('rejects linked files and path traversal rather than copying outside the checkpoint',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'checkpoint-security-'));
 try{
  await mkdir(path.join(root,'repo/workbench-local'),{recursive:true});await mkdir(path.join(root,'project'));
  await writeFile(path.join(root,'outside'),'private');await symlink(path.join(root,'outside'),path.join(root,'repo/workbench-local/link'));
  await expect(createProjectCheckpoint({repo:path.join(root,'repo'),project:path.join(root,'project'),destination:path.join(root,'backup')})).rejects.toThrow('软链接');
  await mkdir(path.join(root,'malicious'));await writeFile(path.join(root,'malicious/checkpoint.json'),JSON.stringify({schemaVersion:1,createdAt:'now',dependencies:'install-from-lockfile',files:[{path:'code/../../outside'}]}));
  await expect(verifyProjectCheckpoint(path.join(root,'malicious'))).rejects.toThrow('路径');
 }finally{await rm(root,{recursive:true,force:true});}
});

it('rescans the complete allowed source set and leaves a pre-existing destination untouched',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'checkpoint-rescan-'));
 try{
  const repo=path.join(root,'repo'),project=path.join(root,'project'),backup=path.join(root,'backup');
  await mkdir(path.join(repo,'workbench-local'),{recursive:true});await mkdir(project,{recursive:true});
  await writeFile(path.join(repo,'workbench-local','base.jsx'),'base');
  await expect(createProjectCheckpoint({
   repo,project,destination:backup,
   beforeFinalScan:async()=>{await writeFile(path.join(repo,'workbench-local','added.jsx'),'added');},
  })).rejects.toThrow('文件集合发生变化');
  await expect(stat(backup)).rejects.toThrow();
  expect((await readdir(root)).filter(name=>name.includes('.partial-'))).toEqual([]);

  const occupied=path.join(root,'occupied');await mkdir(occupied);
  await expect(createProjectCheckpoint({
   repo,project,destination:occupied,
  })).rejects.toThrow(/已存在|EEXIST/);
  expect(await readdir(occupied)).toEqual([]);

  const raced=path.join(root,'raced');
  await expect(createProjectCheckpoint({
   repo,project,destination:raced,
   beforeFinalScan:async()=>{await mkdir(raced);},
  })).rejects.toThrow(/已存在|EEXIST/);
  expect(await readdir(raced)).toEqual([]);
 }finally{await rm(root,{recursive:true,force:true});}
});

it('rejects a symlinked checkpoint parent even when the linked target contains the bytes',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'checkpoint-parent-link-'));
 try{
  const repo=path.join(root,'repo'),project=path.join(root,'project'),backup=path.join(root,'backup');
  await mkdir(path.join(repo,'workbench-local'),{recursive:true});await mkdir(project,{recursive:true});
  await writeFile(path.join(repo,'workbench-local','base.jsx'),'base');
  await createProjectCheckpoint({repo,project,destination:backup});
  const linkedTarget=path.join(root,'linked-workbench-local');
  await rename(path.join(backup,'code','workbench-local'),linkedTarget);
  await symlink(linkedTarget,path.join(backup,'code','workbench-local'),'dir');
  await expect(verifyProjectCheckpoint(backup)).rejects.toThrow(/软链接/);
 }finally{await rm(root,{recursive:true,force:true});}
});
