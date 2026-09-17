import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,chmod,stat,readdir,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createProjectCheckpoint,verifyProjectCheckpoint,restoreProjectCheckpoint} from './project-checkpoint';
it('restores matching code, media, locks and saved animation without touching a changed original',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'checkpoint-'));
 try{
  const repo=path.join(root,'repo'),project=path.join(root,'project'),backup=path.join(root,'backup'),restored=path.join(root,'restored');
  for(const f of ['repo/workbench-local/scenes/scene.jsx','repo/modules/server/transcription.ts','repo/package-lock.json','project/cut/source.mp4','project/production/production.json','project/animation-templates/templates.json']){await mkdir(path.dirname(path.join(root,f)),{recursive:true});await writeFile(path.join(root,f),'original:'+f);}
  await chmod(path.join(repo,"workbench-local/scenes/scene.jsx"),0o755);
  await writeFile(path.join(repo,'workbench-local/tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
  await createProjectCheckpoint({repo,project,destination:backup});
  await writeFile(path.join(repo,'workbench-local/scenes/scene.jsx'),'new code');
  await restoreProjectCheckpoint(backup,restored);
  expect(await readFile(path.join(restored,'code/workbench-local/scenes/scene.jsx'),'utf8')).toContain('original:');
  expect(await readFile(path.join(repo,'workbench-local/scenes/scene.jsx'),'utf8')).toBe('new code');
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
