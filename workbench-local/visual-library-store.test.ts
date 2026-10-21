import {describe,it,expect,afterEach} from 'vitest';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createVisualLibraryStore,fileHash} from './visual-library-store';
import {visualAssetInputSchema,type VisualPreview} from './visual-library-contract';

const directories:string[]=[];
const member={id:'test-title',version:'1.0.0'};
const input=()=>visualAssetInputSchema.parse({...member,name:'标题',description:'可换文案标题',kind:'component',mount:'OBJECT',source:{kind:'authored',note:'测试原创'},controls:[{key:'text',label:'文字',type:'text',required:true,default:'第一句'},{key:'accent',label:'色彩',type:'color',default:'#2244FF'}],contentParameters:['text'],styleBindings:{accent:'accent'},sampleValues:{text:'第一句'},code:'export const VisualAsset=()=>null;'});
async function setup(){const dir=await mkdtemp(path.join(tmpdir(),'cut-visual-'));directories.push(dir);return {dir,store:await createVisualLibraryStore(dir)};}
afterEach(async()=>{await Promise.all(directories.splice(0).map(d=>rm(d,{recursive:true,force:true})));});

describe('versioned visual library',()=>{
  it('keeps immutable versions, revision checks and a stable reopen',async()=>{
    const {dir,store}=await setup();await store.saveAsset(0,input());const saved=await store.get();
    await expect(store.favorite(0,member,true)).rejects.toThrow('已变化');
    await expect(store.saveAsset(saved.revision,input())).rejects.toThrow('已存在');
    const reopened=await createVisualLibraryStore(dir);expect(await reopened.get()).toEqual(saved);
    await writeFile(path.join(dir,'assets/test-title/1.0.0/Asset.tsx'),'changed');
    await expect(reopened.verifyAsset(await reopened.getAsset(member))).rejects.toThrow('源码发生变化');
  });
  it('recovers an exact code write interrupted before catalog commit, rejects unrelated bytes',async()=>{
    const {dir,store}=await setup(),folder=path.join(dir,'assets/test-title/1.0.0');await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'Asset.tsx'),input().code);
    await store.saveAsset(0,input());expect((await store.get()).assets).toHaveLength(1);
    const {dir:other,store:otherStore}=await setup();await mkdir(path.join(other,'assets/test-title/1.0.0'),{recursive:true});await writeFile(path.join(other,'assets/test-title/1.0.0/Asset.tsx'),'unrelated');
    await expect(otherStore.saveAsset(0,input())).rejects.toThrow('不同内容');expect((await otherStore.get()).revision).toBe(0);
  });
  it('requires different content, actual current videos, inspection and explicit user selection',async()=>{
    const {dir,store}=await setup();await store.saveAsset(0,input());const asset=await store.getAsset(member);
    async function preview(kind:'reference'|'replacement',content:string){const id=randomUUID(),folder=path.join(dir,'previews',id);await mkdir(folder,{recursive:true});const file=path.join(folder,'review.mp4');await writeFile(file,'fixture movie '+id);
      const p:VisualPreview={id,kind,sourceHash:asset.sourceHash,values:{text:content},durationFrames:120,url:'/preview',createdAt:new Date().toISOString(),status:'done',progress:1,targetIdentity:id,contentIdentity:createHash('sha256').update(content+kind).digest('hex'),outputHash:await fileHash(file)};
      await store.addPreview(member,p);await store.review((await store.get()).revision,member,{previewId:id,kind:kind==='reference'?'visual':'reuse',note:'结构检查夹具，非真实视觉验收'});return p;}
    await preview('reference','第一句');await preview('replacement','第一句');
    await expect(store.setAssetStatus((await store.get()).revision,member,'ready',true)).rejects.toThrow('换内容');
    const second=await preview('replacement','另一段真实内容');
    await expect(store.setAssetStatus((await store.get()).revision,member,'ready')).rejects.toThrow('用户');
    await store.setAssetStatus((await store.get()).revision,member,'ready',true);expect((await store.getAsset(member)).status).toBe('ready');
    await writeFile(path.join(dir,'previews',second.id,'review.mp4'),'changed movie');
    await expect(store.setAssetStatus((await store.get()).revision,member,'ready',true)).rejects.toThrow('视频丢失或已变化');
  });
  it('cannot turn an uninspected reference or unfinished member into an available pack',async()=>{
    const {store}=await setup();const a=input();
    await expect(store.saveAsset(0,{...a,source:{kind:'reference',referenceId:'ref-one',startMs:0,endMs:1000,observations:'unknown'}})).rejects.toThrow('实际视觉分析');
    await store.saveAsset(0,a);await store.savePack(1,{id:'paper',version:'1.0.0',name:'纸面',description:'一套风格',source:{kind:'authored',note:'测试'},members:[member],tokens:{accent:'#EE4411'},coverage:['重点']});
    await expect(store.setPackStatus(2,{id:'paper',version:'1.0.0'},'ready',true)).rejects.toThrow('未验收资产');
  });
  it('reopening marks interrupted reference and preview jobs as failed once',async()=>{
    const {dir,store}=await setup();await store.saveAsset(0,input());const asset=await store.getAsset(member);
    await store.addPreview(member,{id:randomUUID(),kind:'reference',sourceHash:asset.sourceHash,values:{},durationFrames:120,url:'/preview',createdAt:'now',status:'rendering',progress:0,targetIdentity:'test'});
    const restarted=await createVisualLibraryStore(dir),state=await restarted.get();expect(state.assets[0].previews[0].status).toBe('failed');expect((await (await createVisualLibraryStore(dir)).get()).revision).toBe(state.revision);
  });
});
