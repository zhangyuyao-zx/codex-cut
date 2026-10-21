import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createVisualLibraryService,checkVisualSource} from './visual-library-service';
import {fileHash} from './visual-library-store';

it('keeps source inspection data-only and rejects hidden dependency imports',()=>{
  expect(()=>checkVisualSource("import React from 'react';export function VisualAsset(){return null;}")).not.toThrow();
  expect(()=>checkVisualSource("import x from './unknown.tsx';export const VisualAsset=()=>null;")).toThrow('导入');
  expect(()=>checkVisualSource("export function VisualAsset(){return import('remotion');}")).toThrow('动态');
  expect(()=>checkVisualSource('export const Other=()=>null;')).toThrow('VisualAsset');
});
it('pins original comparison to the inspected reference, interval and actual bytes before reserving render',async()=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cut-visual-source-')),dir=path.join(temp,'visual-library');
  try{
    const service=await createVisualLibraryService(process.cwd(),dir),folder=path.join(dir,'references/ref-one');await mkdir(folder,{recursive:true});const file=path.join(folder,'original.mp4');await writeFile(file,'source-identity-fixture');
    await service.store.addReference(0,{id:'ref-one',name:'测试',fileName:'original.mp4',createdAt:'now',sha256:await fileHash(file),durationMs:10000,width:1280,height:720,stage:'analysis',progress:1,frames:[]});
    await service.store.analyzeReference(1,'ref-one',{summary:'测试夹具',style:'测试',visualInspected:true,audioInspected:false,segments:[{id:'one',startMs:1000,endMs:2000,purpose:'test',observations:'fixture only',objects:[],motion:'none'}]});
    const member={id:'one-title',version:'1.0.0'};
    await service.store.saveAsset(2,{...member,name:'测试标题',description:'测试',kind:'component',mount:'OBJECT',source:{kind:'reference',referenceId:'ref-one',startMs:1000,endMs:2000,observations:'fixture'},controls:[],code:'export function VisualAsset(){return null;}'});
    await expect(service.renderPreview({member,kind:'reference',referenceId:'other',durationFrames:30})).rejects.toThrow('来源视频');
    await expect(service.renderPreview({member,kind:'reference',durationFrames:31})).rejects.toThrow('来源片段范围');
    expect(service.isBusy()).toBe(false);
    await writeFile(file,'changed source bytes');
    await expect(service.renderPreview({member,kind:'reference',durationFrames:30})).rejects.toThrow('原件已变化');expect(service.isBusy()).toBe(false);
  }finally{await rm(temp,{recursive:true,force:true});}
});
