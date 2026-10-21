import {afterEach,expect,it} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {checkVisualSource,creativeRuntimeAliases,creativeRuntimeCapabilities,creativeRuntimeRoot,resolveCreativeDependencies,assertNativeCreativeImports} from './creative-runtime-dependencies';
import {createVisualLibraryStore} from './visual-library-store';
import {createVisualLibraryService} from './visual-library-service';
import {createSceneModules} from './scene-modules';
import {createAnimationTemplates} from './animation-templates';
import type {Scene} from './production-store';

const temporary:string[]=[];
async function directory(){const dir=await mkdtemp(path.join(tmpdir(),'cut-creative-runtime-'));temporary.push(dir);return dir;}
afterEach(async()=>{await Promise.all(temporary.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
const dependencies={'@remotion/three':'4.0.489','@react-three/fiber':'9.8.2',three:'0.186.1'};
const code=`import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {Vector3} from 'three';
export function VisualAsset(){const frame=useCurrentFrame();const position=new Vector3(0,0,0);return <ThreeCanvas width={1920} height={1080}><ambientLight/><mesh position={position} rotation={[0,frame/30,0]}><boxGeometry/><meshStandardMaterial color="orange"/></mesh></ThreeCanvas>;}`;
const input={id:'three-box',version:'1.0.0',name:'Three box',description:'Deterministic Three scene',kind:'component',mount:'SCENE',source:{kind:'authored',note:'test fixture'},controls:[],dependencies,code};

it('accepts declared installed Three assets, publishes exact capabilities, and bundles actual browser packages',async()=>{
  const dir=await directory(),service=await createVisualLibraryService(creativeRuntimeRoot,dir);
  await service.store.saveAsset(0,input);
  expect((await service.store.getAsset(input)).dependencies).toEqual(dependencies);
  expect((await service.response()).capabilities.runtimeDependencies.packages).toEqual(expect.arrayContaining([{name:'three',version:'0.186.1',available:true}]));
  const detail=await service.sceneProvider.detail('va-three-box-v1-0-0');
  expect(detail?.dependencies).toEqual(dependencies);
  const aliases=await creativeRuntimeAliases(),runtime=await resolveCreativeDependencies(dependencies);
  expect(Object.keys(aliases).sort()).toEqual(Object.keys(dependencies).sort());
  expect(runtime.resolved.map(r=>r.name).sort()).toEqual(Object.keys(dependencies).sort());
  const result=await build({stdin:{contents:code,loader:'tsx',resolveDir:creativeRuntimeRoot},bundle:true,write:false,platform:'browser',format:'esm',plugins:[{name:'exact-runtime-aliases',setup(builder){builder.onResolve({filter:/^(@remotion\/three|@react-three\/fiber|three)$/},args=>({path:aliases[args.path]}));}}],external:['react','react/*','react-dom','react-dom/*','remotion'],logLevel:'silent'});
  expect(result.outputFiles[0].text).toContain('ThreeCanvas');
});

it('rejects undeclared, server, path, dynamic and wrong-version imports before storing any asset',async()=>{
  const store=await createVisualLibraryStore(await directory());
  for(const asset of [
    {...input,dependencies:undefined},
    {...input,dependencies:{three:'0.1.0'}},
    {...input,dependencies:{express:'5.1.0'},code:"import x from 'express';export const VisualAsset=()=>null;"},
    {...input,dependencies:{'node:fs':'1.0.0'}},
  ])await expect(store.saveAsset(0,asset)).rejects.toThrow();
  for(const source of ["import x from './file';", "import x from 'three/addons';", "import fs = require('fs');", "const x=import('three');", "import {useFrame as loop} from '@react-three/fiber';"])
    expect(()=>checkVisualSource(source+'export const VisualAsset=()=>null;',dependencies)).toThrow();
  expect((await store.get()).assets).toHaveLength(0);
  await store.saveAsset(0,{...input,dependencies:undefined,code:'export const VisualAsset=()=>null;'});
  expect(await store.verifyAsset(await store.getAsset(input))).toContain('Asset.tsx');
});

it('keeps harmless saved source names compatible while requiring native creative import pins',async()=>{
  const store=await createVisualLibraryStore(await directory());
  await store.saveAsset(0,{...input,dependencies:undefined,code:'const state={require:true,useFrame:1};export const VisualAsset=()=>state.require?state.useFrame:null;'});
  await expect(store.verifyAsset(await store.getAsset(input))).resolves.toContain('Asset.tsx');
  expect(()=>assertNativeCreativeImports("import {Vector3} from 'three';")).toThrow('dependencies');
  expect(()=>assertNativeCreativeImports("export {Vector3} from 'three';",dependencies)).not.toThrow();
  expect(()=>assertNativeCreativeImports("import type {Vector3} from 'three';")).not.toThrow();
});

async function fixtureRuntime(root:string){
  for(const [name,version] of Object.entries(dependencies)){
    const folder=path.join(root,'node_modules',name);await mkdir(folder,{recursive:true});
    await writeFile(path.join(folder,'package.json'),JSON.stringify({name,version,module:'browser.js'}));
    await writeFile(path.join(folder,'browser.js'),'export const fixture=true;');
  }
}

it('blocks missing/changed installations and refuses preview review with a stale dependency fingerprint',async()=>{
  const root=await directory(),dir=await directory();
  await expect(resolveCreativeDependencies(dependencies,root)).rejects.toThrow('缺少');
  expect(await creativeRuntimeAliases(root)).toEqual({});
  const store=await createVisualLibraryStore(dir,root);
  await expect(store.saveAsset(0,input)).rejects.toThrow('缺少');
  await fixtureRuntime(root);await store.saveAsset(0,input);
  const before=await resolveCreativeDependencies(dependencies,root),asset=await store.getAsset(input),id=randomUUID();
  await store.addPreview(input,{id,kind:'reference',sourceHash:asset.sourceHash,dependencyFingerprint:before.fingerprint,values:{},durationFrames:30,url:'/fixture',createdAt:'now',status:'done',progress:1,targetIdentity:'fixture'});
  await writeFile(path.join(root,'node_modules/three/browser.js'),'export const fixture=false;');
  expect((await resolveCreativeDependencies(dependencies,root)).fingerprint).not.toBe(before.fingerprint);
  await expect(store.review((await store.get()).revision,input,{previewId:id,kind:'visual',note:'stale fixture'})).rejects.toThrow('当前源码');
  await writeFile(path.join(root,'node_modules/three/package.json'),JSON.stringify({name:'three',version:'0.1.0',module:'browser.js'}));
  await expect(store.verifyAsset(asset)).rejects.toThrow('版本不匹配');
  await expect(store.setAssetStatus((await store.get()).revision,input,'ready',true)).rejects.toThrow('版本不匹配');
  expect((await creativeRuntimeCapabilities(root)).packages.find(p=>p.name==='@remotion/three')?.available).toBe(false);
});

it('preserves runtime declarations and native style bindings in saved animation snapshots and rejects incompatible reuse',async()=>{
  const root=await directory();await symlink(path.join(creativeRuntimeRoot,'node_modules'),path.join(root,'node_modules'),'dir');
  const scenes=path.join(root,'workbench-local/scenes');await mkdir(scenes,{recursive:true});
  const manifest={id:'three-source',label:'Three',entry:'Three.tsx',exportName:'VisualAsset',controls:[{key:'accent',label:'Accent',type:'color',default:'#FF8800'}],dependencies,styleBindings:{accent:'accentColor'}};
  await writeFile(path.join(scenes,'three-source.json'),JSON.stringify(manifest));await writeFile(path.join(scenes,'Three.tsx'),code);
  const modules=createSceneModules(root),detail=await modules.detail('three-source');
  expect(detail.styleBindings).toEqual({accent:'accentColor'});
  const scene:Scene={id:'source',title:'Source',intent:'fixture',startWordId:'a',endWordId:'b',beats:[{wordId:'a',label:'start'}],program:{moduleId:'three-source',parameters:{}},editor:{overrides:{accent:'#112233'},locks:['accent']}};
  const templates=createAnimationTemplates(root,path.join(root,'templates'));
  const saved=await templates.save({name:'Three saved',scene,expectedSourceHash:detail.sourceHash});
  expect(saved.dependencies).toEqual(dependencies);expect(saved.styleBindings).toEqual(manifest.styleBindings);expect(saved.locks).toEqual(['accent']);expect(saved.parameters.accent).toBe('#112233');
  const savedCode=await readFile(path.join(scenes,saved.moduleId+'.jsx'),'utf8');
  expect(savedCode).toContain('from "@remotion/three"');expect(savedCode).toContain('from "three"');
  expect(savedCode.length).toBeLessThan(20000);
  const savedDetail=await modules.detail(saved.moduleId);expect(savedDetail.dependencies).toEqual(dependencies);
  await rm(path.join(root,'node_modules'));
  await expect(modules.detail(saved.moduleId)).rejects.toThrow('缺少');
  await expect(templates.instantiate({id:saved.id,target:{...scene,program:undefined},bindings:['a']})).rejects.toThrow('缺少');
  await writeFile(path.join(scenes,'three-source.json'),JSON.stringify({...manifest,dependencies:undefined,styleBindings:{unknown:'accentColor'}}));
  await expect(modules.detail('three-source')).rejects.toThrow('styleBindings');
  await writeFile(path.join(scenes,'three-source.json'),JSON.stringify({...manifest,dependencies:undefined,styleBindings:{accent:'../bad'}}));
  await expect(modules.detail('three-source')).rejects.toThrow('styleBindings');
});
