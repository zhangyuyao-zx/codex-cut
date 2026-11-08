import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolveProduction} from './production-binding';
import {localSourceDependencies} from './source-dependencies';
import {authoringRequirement} from './production-policy.mjs';
import {createContentDigester} from './cut-media-identity';

const meaningful=(s:unknown):s is string=>typeof s==='string'&&!!s.trim()&&!/待填写|待说明|待设计|待完成|待补|TODO/.test(s);
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const fullPlayback=(ranges:any[],duration:number)=>Array.isArray(ranges)&&ranges.some(r=>r.fromSeconds===0&&r.toSeconds>=duration-.15&&r.rate===1&&meaningful(r.observation));
export const AUTHORING_GATE_VERSION=1;

export function createProductionAuthoringGate(root:string,projectDir:string,observe?:(file:string)=>void){
 const contentDigest=createContentDigester();
 const digest=(file:string)=>{observe?.(file);return contentDigest(file);};
 const json=async(file:string)=>{observe?.(file);return JSON.parse(await readFile(file,'utf8'));};
 const kitRoot=path.resolve(root,'tools/dots-production');
 const dependencyCache=new Map<string,{sourceHash:string;hashes:Set<string>}>();
 async function checkedKit(version:string){
  const catalog=await json(path.join(kitRoot,'catalog.json'));
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('制作套件版本无效');
  const dir=path.join(kitRoot,'releases',version),release=await json(path.join(dir,'manifest.json'));
  for(const [name,hash] of Object.entries(release.files)){
   const file=path.resolve(dir,name);
   if(!file.startsWith(dir+path.sep)||await digest(file)!==hash)throw Error('固定制作源码变化：'+name);
  }
  return {catalog,version,direction:await import(pathToFileURL(path.join(dir,'direction.mjs')).href)};
 }
 async function inspect(input:{plan:any;cut:any;modules:any[];reviews:any[];stage:'design'|'review'|'assembly'|'delivery';sceneId?:string;renderId?:string;job?:any}){
  const errors:string[]=[],sceneHashes:Record<string,string>={},observations:Record<string,any>={};
  let requirement:Awaited<ReturnType<typeof authoringRequirement>>;
  for(const file of [path.join(projectDir,'content-project.json'),path.join(projectDir,'production/authoring.json'),path.join(root,'projects/production-policy.json')])observe?.(file);
  try{requirement=await authoringRequirement(root,projectDir);}catch(e:any){return {required:true,ok:false,errors:[e.message],sceneHashes};}
  if(!requirement.required)return {...requirement,ok:true,errors,sceneHashes};
  const fail=(message:string)=>errors.push(message);
  try{
   if(!requirement.configured)throw Error('缺少 production/authoring.json。先绑定本期全片编排、逐段动作脚本和参考包；不能以 prepare 已运行代替。');
   if(!/^C\d{8}-\d{3}$/.test(requirement.contentId??''))throw Error('工程缺少有效 content-project.json 内容身份，请先关联独立内容工程');
   const binding=await json(requirement.file),base=path.dirname(requirement.file);
   if(binding.schemaVersion!==1||binding.method!=='dots'||binding.contentId!==requirement.contentId||!Array.isArray(binding.scenes))throw Error('制作绑定身份或格式不符');
   const resolveFile=(s:any)=>{if(!meaningful(s))throw Error('制作绑定中的文件路径未填写');return path.resolve(base,s);};
   const filmFile=resolveFile(binding.film),film=await json(filmFile);
   if(!Array.isArray(film.handoffs))throw Error('全片编排缺少 handoffs 交接设计');
   const ids=input.plan.scenes.map((s:any)=>s.id);
   if(!ids.length||!same(ids,binding.scenes.map((s:any)=>s.sceneId))||!same(ids,film.scenes?.map((s:any)=>s.sceneId))||new Set(ids).size!==ids.length)throw Error('全片编排、制作绑定与当前原生段落顺序不一致');
   if(film.contentId!==requirement.contentId)throw Error('全片编排属于其他内容');
   const resolved=resolveProduction(input.plan,input.cut);
   if(resolved.stale||resolved.issues.length)throw Error('制作依据与当前粗剪不一致：'+resolved.issues.join('；'));
   const {catalog,version,direction}=await checkedKit(binding.kitVersion);
   const scripts:any[]=[],entries:any[]=[];
   for(const b of binding.scenes){
    const file=resolveFile(b.script),script=await json(file),scriptHash=await digest(file);
    const entry=film.scenes.find((s:any)=>s.sceneId===b.sceneId);
    if(await realpath(file)!==await realpath(path.resolve(path.dirname(filmFile),entry.script)))throw Error(b.sceneId+'：全片引用的脚本与绑定不一致');
    const native=input.plan.scenes.find((s:any)=>s.id===b.sceneId),range=resolved.scenes.find(s=>s.id===b.sceneId)!;
    const from=Math.round(range.startMs!*.03),end=Math.round(range.endMs!*.03);
    const words=resolved.words.filter(w=>w.startMs>=range.startMs!&&w.endMs<=range.endMs!).map(w=>({id:w.sourceId,text:w.text,start:Math.round(w.startMs*.03)-from,end:Math.round(w.endMs*.03)-from}));
    if(script.schemaVersion!==2||script.kitVersion!==version||script.sceneId!==native.id||script.contentId!==requirement.contentId||script.durationFrames!==end-from)fail(b.sceneId+'：脚本身份、固定版本或时长不匹配');
    const checked=direction.checkScene(script,words,{catalog,versions:[version]});
    for(const error of checked.errors)fail(b.sceneId+'：'+error);
    const prepFile=resolveFile(b.preparation),prep=await json(prepFile);
    if(prep.schemaVersion!==1||prep.version!==version||prep.brief?.contentId!==requirement.contentId)fail(b.sceneId+'：参考准备包身份不匹配');
    if(!Array.isArray(b.referenceIds)||!b.referenceIds.length)throw Error(b.sceneId+'：未选本段适用的参考');
    const references=[];
    for(const id of b.referenceIds){
     const ref=prep.referenceSources?.find((r:any)=>r.id===id);
     if(!ref||!meaningful(ref.learn)||!meaningful(ref.avoid))throw Error(b.sceneId+'：参考缺少实际来源、学习内容或避用条件');
     const clip=path.resolve(path.dirname(prepFile),ref.clip);
     if(await digest(clip)!==ref.clipSha256)throw Error(b.sceneId+'：参考片段已变或丢失');
     references.push(ref);
    }
    const targeted=!input.sceneId||input.sceneId===b.sceneId;
    if(targeted){
     const module=input.modules.find(m=>m.id===native.program?.moduleId);
     if(!module)fail(b.sceneId+'：实际场景代码未接入');
     else{
      // Native module sourceHash already includes transitive source/asset hashes.
      const cached=module.sourceHash?dependencyCache.get(module.modulePath):null;
      let hashes=cached?.sourceHash===module.sourceHash?cached?.hashes:undefined;
      if(!hashes){
       const dependencies=await localSourceDependencies(root,module.modulePath,observe);
       hashes=new Set<string>();
       for(const d of dependencies.filter(d=>d.filePath.endsWith('.json')))hashes.add(await digest(d.filePath));
       if(module.sourceHash){if(dependencyCache.size>=256)dependencyCache.clear();dependencyCache.set(module.modulePath,{sourceHash:module.sourceHash,hashes});}
      }
      if(!hashes.has(scriptHash))fail(b.sceneId+'：场景代码未导入当前动作脚本（允许导入哈希一致的项目副本），不能旁置一份文档充数');
     }
    }
    const handoffs=film.handoffs.filter((h:any)=>h.fromSceneId===b.sceneId||h.toSceneId===b.sceneId);
    sceneHashes[b.sceneId]=sha(JSON.stringify({scriptHash,references,handoffs,viewerJourney:film.viewerJourney}));
    scripts.push(script);entries.push({b,file,script,scriptHash,references,resolveFile,targeted});
   }
   const checkedFilm=direction.checkFilm(film,scripts);
   errors.push(...checkedFilm.errors.map((s:string)=>'全片：'+s));
   if(input.stage!=='design'&&!errors.length){
    const {checkReview}=await import(pathToFileURL(path.join(kitRoot,'production-pack.mjs')).href);
    for(const {b,file,script,scriptHash,references,resolveFile,targeted} of entries){
     if(!targeted)continue;
     const native=input.reviews.find((r:any)=>r.sceneId===b.sceneId);
     const render=input.renderId?native?.history.find((r:any)=>r.id===input.renderId):native?.approved??native?.latest;
     if(!render?.current||render.status!=='done'||!render.url)throw Error(b.sceneId+'：缺少当前完成样片');
     if(render.authoringDesign?.[b.sceneId]!==sceneHashes[b.sceneId])throw Error(b.sceneId+'：样片未绑定当前制作依据，请按当前设计重新渲染');
     const review=b.review;
     if(!review)throw Error(b.sceneId+'：缺少实际样片审阅依据');
     const evidenceFile=resolveFile(review.evidence),observationFile=resolveFile(review.observation);
     const e=await json(evidenceFile),o=await json(observationFile);
     for(const file of [e.specFile,e.video,e.reference?.file])if(typeof file==='string')observe?.(file);
     for(const copy of [e.viewedCopy,e.reference?.viewedCopy,...(Array.isArray(e.frames)?e.frames:[])])if(typeof copy?.file==='string')observe?.(path.resolve(path.dirname(evidenceFile),copy.file));
     const duration=(render.end-render.from)/30;
     if(e.schemaVersion!==1||e.id!==b.sceneId||!Number.isFinite(e.duration)||Math.abs(e.duration-duration)>.1||!Array.isArray(e.frames)||e.frames.length<2)throw Error(b.sceneId+'：审片范围未覆盖当前完整样片');
     if(!/^\/production-media\/renders\/[\w-]+\/review\.mp4$/.test(render.url))throw Error('样片地址无效');
     const video=path.resolve(projectDir,'production',render.url.slice('/production-media/'.length));
     if(await realpath(e.video)!==await realpath(video)||e.videoSha256!==await digest(video))throw Error(b.sceneId+'：审片引用的不是这次原生渲染');
     if(!Object.entries({sceneId:b.sceneId,key:render.key,renderId:render.id,designSha256:sceneHashes[b.sceneId]}).every(([k,v])=>o.productionBinding?.[k]===v))throw Error(b.sceneId+'：观察记录与当前设计/样片版本不匹配');
     const result=await checkReview({evidenceFile,observationFile,digestFile:digest});
     errors.push(...result.errors.map((s:string)=>b.sceneId+'：'+s));
     if(o.authorVerdict!=='candidate-for-user-review')fail(b.sceneId+'：实际观察仍要求返修');
     const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<.15;
     if(!e.reference||!references.some((r:any)=>
      (r.media.sha256===e.reference.sha256&&near(e.reference.fromSeconds,r.media.fromSeconds)&&near(e.reference.toSeconds,r.media.toSeconds))||
      (r.clipSha256===e.reference.sha256&&near(e.reference.fromSeconds,0)&&near(e.reference.toSeconds,r.media.toSeconds-r.media.fromSeconds))
     ))fail(b.sceneId+'：未对照本段绑定的真实参考区间');
     if(!fullPlayback(o.playbackRanges,e.duration))fail(b.sceneId+'：缺完整原速动态观察，静帧不能替代');
     for(const aspect of ['objects','composition','typography','motion','rhythm','transition']){
      const q=o.qualityChecks?.find((x:any)=>x.aspect===aspect);
      if(!meaningful(q?.observed)||!meaningful(q?.disposition))fail(b.sceneId+'：缺实际质量观察 '+aspect);
     }
     if(!o.targetSizeReview||!Number.isFinite(o.targetSizeReview.width)||o.targetSizeReview.width<=0||!meaningful(o.targetSizeReview.observed))fail(b.sceneId+'：缺目标观看尺寸的观察');
     if(!['listened','not-listened'].includes(o.audioReview?.status)||!meaningful(o.audioReview?.note))fail(b.sceneId+'：声音核对范围未说明');
     const audit=await json(resolveFile(review.rhythmAudit)),rhythmReview=await json(resolveFile(review.rhythmReview));
     if(audit.sceneSha256!==scriptHash||audit.videoSha256!==e.videoSha256||Math.abs(audit.durationSeconds-duration)>.1||!Number.isFinite(audit.durationSeconds))fail(b.sceneId+'：节奏检测已经过期或范围不完整');
     else errors.push(...direction.reviewRender(audit,script,rhythmReview).errors.map((s:string)=>b.sceneId+'：'+s));
     observations[b.sceneId]=o;
    }
    if(input.stage==='assembly'||input.stage==='delivery'){
     const pairs=[...film.handoffs.map((h:any)=>[h.fromSceneId,h.toSceneId]),...checkedFilm.reviewPrompts.filter((p:any)=>p.code==='COMPARE_SIMILAR_SCENES').map((p:any)=>p.sceneIds)];
     for(const [a,b] of pairs){
      const compared=(from:string,to:string)=>observations[from]?.comparedTo?.some((x:any)=>{const r=input.reviews.find((r:any)=>r.sceneId===to)?.approved;return x.sceneId===to&&x.key===r?.key&&x.renderId===r?.id&&meaningful(x.observed);});
      if(!compared(a,b)&&!compared(b,a))fail(`全片：缺 ${a} 与 ${b} 当前样片的交接/同类画面对照`);
     }
    }
    if(input.stage==='delivery'&&!errors.length){
     const job=input.job;
     if(!job?.current||job.status!=='done'||job.kind!=='assembly'||!/^\/production-media\/renders\/[\w-]+\/review\.mp4$/.test(job.url??''))throw Error('最终审阅需要当前已合成的整片');
     if(!same(job.authoringDesign,sceneHashes))throw Error('整片制作依据已变化，需要重新合成');
     if(!meaningful(binding.deliveryReview))throw Error('缺少当前整片的实际视听审阅记录 deliveryReview');
     const final=await json(resolveFile(binding.deliveryReview));
     const video=path.resolve(projectDir,'production',job.url.slice('/production-media/'.length));
     if(final.schemaVersion!==1||final.renderId!==job.id||final.key!==job.key||final.videoSha256!==await digest(video))throw Error('整片审阅记录与当前合成版本不一致');
     if(!fullPlayback(final.playbackRanges,(job.end-job.from)/30))fail('整片缺少完整原速观察');
     for(const aspect of ['continuity','rhythm','readability','sound']){
      const q=final.checks?.find((x:any)=>x.aspect===aspect);
      if(!meaningful(q?.observed)||!meaningful(q?.disposition)||!['retain','fixed'].includes(q.status))fail('整片审阅未完成：'+aspect);
     }
     if(final.audioReview?.status!=='listened'||!meaningful(final.audioReview.note))fail('整片混音尚未实际听辨');
     if(final.authorVerdict!=='candidate-for-user-review'||final.userAccepted!==false)fail('整片自检仍待处理，或混入了用户验收状态');
    }
   }
  }catch(e:any){fail(e.message);}
  return {...requirement,ok:errors.length===0,errors,sceneHashes,visualQuality:'requires-actual-author-judgment',userAccepted:false};
 }
 return {inspect,async assert(input:Parameters<typeof inspect>[0]){const r=await inspect(input);if(!r.ok)throw Error('制作流程未完成：\n'+r.errors.slice(0,12).join('\n')+'\n请读取 production.authoring 与本期绑定文件，补齐后再执行。');return r;}};
}
