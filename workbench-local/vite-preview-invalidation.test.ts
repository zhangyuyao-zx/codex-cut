import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {createPreviewInvalidator} from './vite-preview-invalidation';

it('updates a cached transitive browser module when native watching is unavailable, without a page reload',async()=>{
  const root=await realpath(await mkdtemp(path.join(tmpdir(),'preview-vite-')));
  await writeFile(path.join(root,'dependency.ts'),'export const text="before"');
  await writeFile(path.join(root,'entry.ts'),'import {text} from "./dependency"; export const value=text;');
  const vite=await createServer({root,configFile:false,server:{middlewareMode:true,hmr:false,watch:null,fs:{allow:[root]}},cacheDir:path.join(root,'.cache')});
  try{
    const first=await vite.transformRequest('/entry.ts?version=one');
    await vite.transformRequest('/dependency.ts');
    expect(first?.code).not.toContain('?t=');
    await writeFile(path.join(root,'dependency.ts'),'export const text="after"');
    createPreviewInvalidator(vite,root)(path.join(root,'dependency.ts'));
    const next=await vite.transformRequest('/entry.ts?version=two');
    expect(next?.code).toMatch(/dependency\.ts\?t=\d+/);
    expect((await vite.transformRequest('/dependency.ts'))?.code).toContain('after');
  }finally{await vite.close();await rm(root,{recursive:true,force:true});}
});
