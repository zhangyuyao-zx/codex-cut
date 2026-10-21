import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,unlink,lstat} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {memberKey,visualModuleId,visualId,visualVersion,visualAssetInputSchema,stylePackInputSchema,referenceAnalysisSchema,resolveVisualValues,styleValuesFor,type VisualAsset,type VisualAssetInput,type VisualMember,type StylePack,type VisualPreview,type VisualReview,type ReferenceVideo} from './visual-library-contract';

type State={schemaVersion:1;revision:number;assets:VisualAsset[];packs:StylePack[];references:ReferenceVideo[];favorites:string[]};
const queues=new Map<string,Promise<unknown>>();
const clone=<T>(v:T):T=>structuredClone(v);
export async function fileHash(file:string){const hash=createHash('sha256');for await(const c of createReadStream(file))hash.update(c);return hash.digest('hex');}
export async function regularWithin(root:string,...parts:string[]){
  const target=path.resolve(root,...parts),rel=path.relative(path.resolve(root),target);
  if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('文件越过资产目录');
  let current=path.resolve(root);
  const rootStat=await lstat(current);if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw Error('资产目录无效');
  const names=rel.split(path.sep);
  for(let i=0;i<names.length;i++){current=path.join(current,names[i]);const s=await lstat(current);if(s.isSymbolicLink())throw Error('资产路径不能使用软链接');if(i<names.length-1&&!s.isDirectory())throw Error('资产路径无效');if(i===names.length-1&&!s.isFile())throw Error('资产文件无效');}
  return target;
}
export async function atomicJson(file:string,data:unknown){await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});await rename(tmp,file);}finally{await unlink(tmp).catch(()=>undefined);}}

export async function createVisualLibraryStore(directory:string){
  const dir=path.resolve(directory),file=path.join(dir,'library.json');
  await mkdir(dir,{recursive:true});
  async function load():Promise<State>{
    try{const s=JSON.parse(await readFile(file,'utf8'));if(s.schemaVersion!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!['assets','packs','references','favorites'].every(k=>Array.isArray(s[k])))throw Error('资产目录记录损坏');
      for(const a of s.assets){const {moduleId,sourceHash,createdAt,status,reviews,previews,...metadata}=a;visualAssetInputSchema.parse({...metadata,code:'export const VisualAsset=()=>null;'});if(moduleId!==visualModuleId(a)||!/^\w{64}$/u.test(sourceHash)||!['draft','review','ready','archived'].includes(status)||typeof createdAt!=='string'||!Array.isArray(reviews)||!Array.isArray(previews))throw Error('资产记录损坏');}
      for(const p of s.packs){const {createdAt,status,acceptedAt,demonstration,...metadata}=p;stylePackInputSchema.parse(metadata);if(!['draft','ready','archived'].includes(status))throw Error('风格包记录损坏');}
      for(const r of s.references){visualId.parse(r.id);if(!r.fileName||path.basename(r.fileName)!==r.fileName||!Number.isFinite(r.durationMs)||r.durationMs<=0||!Array.isArray(r.frames))throw Error('参考视频记录损坏');}
      const assetIds=s.assets.map(memberKey),packIds=s.packs.map(memberKey);if(new Set(assetIds).size!==assetIds.length||new Set(packIds).size!==packIds.length)throw Error('资产版本重复');return s;}
    catch(e:any){if(e.code==='ENOENT')return {schemaVersion:1,revision:0,assets:[],packs:[],references:[],favorites:[]};throw e;}
  }
  function serialized<T>(fn:()=>Promise<T>):Promise<T>{const prev=queues.get(file)??Promise.resolve();const next=prev.catch(()=>undefined).then(fn);queues.set(file,next);void next.finally(()=>{if(queues.get(file)===next)queues.delete(file);}).catch(()=>undefined);return next;}
  async function mutate(expected:number|undefined,fn:(state:State)=>Promise<void>|void){return serialized(async()=>{const s=await load();if(expected!==undefined&&s.revision!==expected)throw Error('资产库已变化，请刷新后重试');await fn(s);s.revision++;await atomicJson(file,s);return clone(s);});}
  async function getAsset(m:VisualMember){visualId.parse(m.id);visualVersion.parse(m.version);const a=(await load()).assets.find(a=>memberKey(a)===memberKey(m));if(!a)throw Error('资产版本不存在');return clone(a);}
  async function verifyAsset(a:VisualAsset){const source=await regularWithin(dir,'assets',a.id,a.version,'Asset.tsx');if(await fileHash(source)!==a.sourceHash)throw Error('资产源码发生变化，请保存为新版本');return source;}
  async function saveAsset(expected:number,input:unknown){const parsed=visualAssetInputSchema.parse(input);resolveVisualValues(parsed.controls,parsed.sampleValues);return mutate(expected,async s=>{
    if(s.assets.some(a=>memberKey(a)===memberKey(parsed)))throw Error('该资产版本已存在，请使用新的版本号');
    if(parsed.source.kind==='reference'){
      const source=parsed.source,ref=s.references.find(r=>r.id===source.referenceId);
      if(!ref||!ref.analysis?.visualInspected||ref.analysisSourceHash!==ref.sha256)throw Error('请先完成参考视频的实际视觉分析');
      if(await fileHash(await regularWithin(dir,'references',ref.id,ref.fileName))!==ref.sha256)throw Error('参考原件已变化，请作为新参考导入并重新分析');
      if(source.endMs>ref.durationMs)throw Error('候选片段超出参考视频');
    }
    const {code,...metadata}=parsed,folder=path.join(dir,'assets',parsed.id,parsed.version);
    await mkdir(path.dirname(folder),{recursive:true});await mkdir(folder,{recursive:true});
    const source=path.join(folder,'Asset.tsx');
    try{await writeFile(source,code,{flag:'wx',mode:0o600});}catch(e:any){
      // A crash between saving code and committing the catalog can be retried with exactly the same bytes.
      if(e.code!=='EEXIST'||await fileHash(await regularWithin(dir,'assets',parsed.id,parsed.version,'Asset.tsx'))!==createHash('sha256').update(code).digest('hex'))throw Error('资产源码保存失败，该目录已有不同内容，请使用新版本：'+String(e));
    }
    const asset:VisualAsset={...metadata,moduleId:visualModuleId(parsed),sourceHash:createHash('sha256').update(code).digest('hex'),createdAt:new Date().toISOString(),status:'draft',reviews:[],previews:[]};
    s.assets.push(asset);
  });}
  async function setAssetStatus(expected:number,m:VisualMember,status:VisualAsset['status'],userConfirmed=false){return mutate(expected,async s=>{
    const a=s.assets.find(a=>memberKey(a)===memberKey(m));if(!a)throw Error('资产不存在');await verifyAsset(a);
    if(status==='ready'){
      if(!userConfirmed)throw Error('需要用户选定这个资产版本');
      const current=a.previews.filter(p=>p.status==='done'&&p.sourceHash===a.sourceHash);
      const original=current.findLast(p=>p.kind==='reference'&&a.reviews.some(r=>r.kind==='visual'&&r.previewId===p.id&&r.sourceHash===a.sourceHash));
      const contentValues=(p:VisualPreview)=>JSON.stringify(a.contentParameters.map(key=>[key,p.values[key]??a.controls.find(c=>c.key===key)?.default]));
      const replacement=current.findLast(p=>p.kind==='replacement'&&p.contentIdentity!==original?.contentIdentity&&original&&(contentValues(p)!==contentValues(original)||((a.requiresSourceMedia||a.mediaSlots.length>0)&&p.contentIdentity!==original.contentIdentity))&&a.reviews.some(r=>r.kind==='reuse'&&r.previewId===p.id&&r.sourceHash===a.sourceHash));
      if(!original||!replacement||!original.contentIdentity||!replacement.contentIdentity||original.contentIdentity===replacement.contentIdentity)throw Error('请先完成原效果与不同内容的实际渲染、视觉和复用检查；只改时长或颜色不算换内容');
      for(const preview of [original,replacement])if(!preview.outputHash||await fileHash(await regularWithin(dir,'previews',preview.id,'review.mp4'))!==preview.outputHash)throw Error('预览视频丢失或已变化，请重新渲染检查');
      if(a.source.kind==='reference'){
        const ref=s.references.find(r=>r.id===(a.source as any).referenceId);
        if(!ref?.analysis?.visualInspected||ref.analysisSourceHash!==ref.sha256)throw Error('参考分析未完成');
        if(await fileHash(await regularWithin(dir,'references',ref.id,ref.fileName))!==ref.sha256)throw Error('参考原件已变化，请重新导入分析');
      }
      a.reviews.push({id:randomUUID(),createdAt:new Date().toISOString(),previewId:replacement.id,note:'用户选定此版本入库',kind:'accepted',sourceHash:a.sourceHash});
    }
    a.status=status;
  });}
  async function addPreview(m:VisualMember,p:VisualPreview){return mutate(undefined,s=>{const a=s.assets.find(a=>memberKey(a)===memberKey(m));if(!a)throw Error('资产不存在');if(a.previews.some(x=>x.id===p.id))throw Error('预览编号重复');a.previews.push(p);if(a.status==='draft')a.status='review';});}
  function advanceReferenceReview(s:State){for(const r of s.references)if(r.stage==='authoring'&&s.assets.some(a=>a.source.kind==='reference'&&a.source.referenceId===r.id&&a.previews.some(p=>p.status==='done'&&p.sourceHash===a.sourceHash)))r.stage='review';}
  async function updatePreview(m:VisualMember,id:string,patch:Partial<VisualPreview>){return mutate(undefined,s=>{const a=s.assets.find(a=>memberKey(a)===memberKey(m));const p=a?.previews.find(p=>p.id===id);if(!p)throw Error('预览不存在');Object.assign(p,patch);advanceReferenceReview(s);});}
  async function review(expected:number,m:VisualMember,input:unknown){const data=z.object({previewId:z.string().uuid(),kind:z.enum(['visual','reuse']),note:z.string().min(1).max(4000)}).strict().parse(input);return mutate(expected,s=>{
    const a=s.assets.find(a=>memberKey(a)===memberKey(m)),p=a?.previews.find(p=>p.id===data.previewId&&p.status==='done'&&p.sourceHash===a.sourceHash);
    if(!a||!p)throw Error('请先生成当前源码版本的实际预览');
    if(data.kind==='reuse'&&p.kind!=='replacement')throw Error('复用检查需要换内容样片');
    a.reviews.push({...data,id:randomUUID(),createdAt:new Date().toISOString(),sourceHash:a.sourceHash});
  });}
  async function savePack(expected:number,input:unknown){const pack=stylePackInputSchema.parse(input);return mutate(expected,async s=>{
    if(s.packs.some(p=>memberKey(p)===memberKey(pack)))throw Error('风格包版本已存在');
    for(const member of pack.members){const asset=s.assets.find(a=>memberKey(a)===memberKey(member));if(!asset)throw Error('风格包引用未知资产：'+memberKey(member));await verifyAsset(asset);resolveVisualValues(asset.controls,{...asset.sampleValues,...styleValuesFor(asset,{...pack,createdAt:'',status:'draft'})});}
    s.packs.push({...pack,createdAt:new Date().toISOString(),status:'draft'});
  });}
  async function getPack(m:VisualMember){visualId.parse(m.id);visualVersion.parse(m.version);const pack=(await load()).packs.find(p=>memberKey(p)===memberKey(m));if(!pack)throw Error('风格包不存在');return clone(pack);}
  async function saveDemonstration(m:VisualMember,demo:NonNullable<StylePack['demonstration']>){return mutate(undefined,s=>{const p=s.packs.find(p=>memberKey(p)===memberKey(m));if(!p)throw Error('风格包不存在');p.demonstration=demo;});}
  async function setPackStatus(expected:number,m:VisualMember,status:StylePack['status'],userConfirmed=false){return mutate(expected,async s=>{
    const p=s.packs.find(p=>memberKey(p)===memberKey(m));if(!p)throw Error('风格包不存在');
    if(status==='ready'){
      if(!userConfirmed)throw Error('需要用户选定此风格包版本');
      for(const member of p.members){const asset=s.assets.find(a=>memberKey(a)===memberKey(member));if(!asset||asset.status!=='ready')throw Error('包内仍有未验收资产：'+memberKey(member));await verifyAsset(asset);}
      if(!p.demonstration||await fileHash(await regularWithin(dir,'previews',p.demonstration.id,'review.mp4'))!==p.demonstration.outputHash)throw Error('请先生成并查看风格包的连续演示');
      p.acceptedAt=new Date().toISOString();
    }
    p.status=status;
  });}
  async function addReference(expected:number,reference:ReferenceVideo){return mutate(expected,s=>{if(s.references.some(r=>r.id===reference.id))throw Error('参考编号重复');s.references.push(reference);});}
  async function updateReference(id:string,patch:Partial<ReferenceVideo>){return mutate(undefined,s=>{const r=s.references.find(r=>r.id===id);if(!r)throw Error('参考视频不存在');Object.assign(r,patch,{id:r.id});});}
  async function analyzeReference(expected:number,id:string,input:unknown){const analysis=referenceAnalysisSchema.parse(input);return mutate(expected,async s=>{
    const r=s.references.find(r=>r.id===id);if(!r)throw Error('参考视频不存在');
    for(const segment of analysis.segments)if(segment.endMs<=segment.startMs||segment.endMs>r.durationMs)throw Error('分析片段超出参考范围');
    if(await fileHash(await regularWithin(dir,'references',r.id,r.fileName))!==r.sha256)throw Error('参考原件已变化，请作为新参考导入');
    r.analysis=analysis;r.analysisSourceHash=r.sha256;r.stage=analysis.visualInspected?'authoring':'analysis';
  });}
  async function favorite(expected:number,m:VisualMember,value:boolean){return mutate(expected,s=>{const k=memberKey(m);if(!s.assets.some(a=>memberKey(a)===k)&&!s.packs.some(p=>memberKey(p)===k))throw Error('资产或风格包不存在');s.favorites=s.favorites.filter(x=>x!==k);if(value)s.favorites.push(k);});}
  // Opening a library never runs authored code. Interrupted jobs are made explicit.
  await serialized(async()=>{const s=await load();let changed=false;for(const r of s.references)if(r.stage==='preparing'){r.stage='failed';r.error='上次准备已中断，可重新准备';changed=true;}for(const a of s.assets)for(const p of a.previews)if(p.status==='rendering'){p.status='failed';p.error='上次渲染已中断，可重新生成';changed=true;}const stages=s.references.map(r=>r.stage).join();advanceReferenceReview(s);if(stages!==s.references.map(r=>r.stage).join())changed=true;if(changed){s.revision++;await atomicJson(file,s);}});
  return {dir,get:async()=>clone(await load()),getAsset,verifyAsset,saveAsset,setAssetStatus,addPreview,updatePreview,review,savePack,getPack,setPackStatus,saveDemonstration,addReference,updateReference,analyzeReference,favorite};
}
export type VisualLibraryStore=Awaited<ReturnType<typeof createVisualLibraryStore>>;
