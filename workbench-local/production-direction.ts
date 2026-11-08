import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {resolveProduction} from './production-binding';
import {localSourceDependencies} from './source-dependencies';
import {createContentDigester} from './cut-media-identity';
import type {AuthoringRequirement} from './production-policy.mjs';
import {reviewTopics,topicCoverage} from '../tools/dots-production/studio/standards.mjs';

export type DirectionInput={plan:any;cut:any;modules:any[];reviews:any[];stage:'design'|'review'|'assembly'|'delivery';sceneId?:string;renderId?:string;job?:any};
const text=(v:any)=>typeof v==='string'&&v.trim().length>0;
const hash=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
const fullPlayback=(p:any,duration:number)=>p?.rate===1&&p?.from===0&&Number.isFinite(p.to)&&p.to>=duration-.15&&text(p.observed);

/** Checks provenance, current artifacts and workflow order. It NEVER grades beauty or honest observation. */
export function createDirectionGate(root:string,projectDir:string,observe?:(file:string)=>void){
 const contentDigest=createContentDigester();
 const digest=async(file:string)=>{observe?.(file);return contentDigest(file);};
 const json=async(file:string)=>{observe?.(file);return JSON.parse(await readFile(file,'utf8'));};
 async function inspect(input:DirectionInput,book:any,requirement:AuthoringRequirement){
  const errors:string[]=[],sceneHashes:Record<string,string>={},sceneStates:Record<string,string>={};
  const base=path.dirname(requirement.file),target=input.sceneId;
  const file=(s:any)=>{if(!text(s))throw Error('缺少文件路径');return path.resolve(base,s);};
  const fail=(message:string)=>errors.push(message);
  const selected=(id:string)=>!target||target===id;
  const findRender=(id:string,renderId?:string)=>{const r=input.reviews.find(r=>r.sceneId===id);return renderId?r?.history.find((x:any)=>x.id===renderId):r?.approved?.current?r.approved:r?.latest;};
  try{
   if(book.method!=='dots'||book.contentId!==requirement.contentId||!/^C\d{8}-\d{3}$/.test(book.contentId))throw Error('制作记录与内容工程身份不符');
   const ids=input.plan.scenes.map((s:any)=>s.id);
   if(!ids.length||!same(ids,book.scenes?.map((s:any)=>s.sceneId))||new Set(ids).size!==ids.length)throw Error('先按原生分镜同步全片简表；保留段落顺序，不复制词时间或动作脚本');
   if(target&&!ids.includes(target))throw Error('未知段落');
   const resolved=resolveProduction(input.plan,input.cut);
   if(resolved.stale||resolved.issues.length)throw Error('原生粗剪依据已变化：'+resolved.issues.join('；'));
   const entries:Record<string,any>={},baseHashes:Record<string,string>={};
   for(const s of book.scenes){
    if(!text(s.visualTask))throw Error(s.sceneId+'：全片简表缺本段具体观看任务');
    const native=input.plan.scenes.find((n:any)=>n.id===s.sceneId);
    const module=input.modules.find(m=>m.id===native.program?.moduleId);
    const assets=(s.assetIds??[]).map((id:string)=>{const a=book.assets?.[id];if(!a)throw Error(s.sceneId+'：未知素材 '+id);return {id,...a};});
    const references=(s.referenceIds??[]).map((id:string)=>{const r=book.references?.[id];if(!r)throw Error(s.sceneId+'：未知参考 '+id);return {id,...r};});
    if(new Set(s.assetIds??[]).size!==assets.length||new Set(s.referenceIds??[]).size!==references.length)throw Error(s.sceneId+'：重复素材或参考');
    baseHashes[s.sceneId]=hash({scene:s,sourceHash:module?.sourceHash,assets,references});
    entries[s.sceneId]={s,native,module,assets,references};
   }
   for(const {s} of Object.values(entries)){
    const prototype=entries[s.prototypeSceneId];
    if(s.prototypeSceneId&&(!prototype||prototype.s.prototypeSceneId!==s.prototypeSceneId))throw Error(s.sceneId+'：代表样片必须指向本片一段独立代表，不使用循环或链式继承');
    sceneHashes[s.sceneId]=hash({own:baseHashes[s.sceneId],prototype:baseHashes[s.prototypeSceneId]??null});
   }
   // Only the requested shot needs detailed implementation. Other shots may remain a coarse plan.
   for(const {s,module,assets,references} of Object.values(entries)){
    if(!selected(s.sceneId))continue;
    if(!module){fail(s.sceneId+'：尚未接入场景代码');continue;}
    if(!['real','illustration','abstract'].includes(s.mediaMode)||!text(s.selectionReason))fail(s.sceneId+'：先选择具体真实素材或说明抽象/示意表达的依据');
    if(s.mediaMode==='real'&&!assets.length)fail(s.sceneId+'：真实素材选择尚未落到文件');
    if(!s.prototypeSceneId)fail(s.sceneId+'：选择代表样片；新表达可以以本段为代表，先单段试作');
    if(s.prototypeSceneId!==s.sceneId&&!text(s.reuseReason))fail(s.sceneId+'：说明如何复用已验证的表达，不把同样颜色当作适配');
    if(!references.length)fail(s.sceneId+'：选择本段实际比较的参考');
    const dependencies=await localSourceDependencies(root,module.modulePath,observe);
    const used=new Set(await Promise.all(dependencies.map(d=>digest(d.filePath))));
    for(const a of assets){
     if(await digest(file(a.file))!==a.sha256)fail(s.sceneId+'：素材已变或未固定 '+a.id);
     if(!text(a.source)||!text(a.supports))fail(s.sceneId+'：素材缺出处及其能说明的内容 '+a.id);
     if(!used.has(a.sha256))fail(s.sceneId+'：选中的素材未被场景静态依赖使用 '+a.id+'（使用字面量 staticFile 或本地导入）');
    }
    for(const r of references){
     if(await digest(file(r.file))!==r.sha256)fail(s.sceneId+'：参考文件已变 '+r.id);
     if(!Number.isFinite(r.from)||!Number.isFinite(r.to)||r.from<0||r.to<=r.from||!text(r.learn)||!text(r.avoid))fail(s.sceneId+'：参考缺实际区间和适用/避用条件 '+r.id);
    }
    sceneStates[s.sceneId]='implemented-not-reviewed';
   }
   const reviewErrors=new Map<string,string[]>();
   async function checkReview(id:string,renderId?:string){
    const memoKey=id+':'+(renderId??'selected');if(reviewErrors.has(memoKey))return reviewErrors.get(memoKey)!;
    const found:string[]=[];reviewErrors.set(memoKey,found);
    try{
     const render=findRender(id,renderId),review=book.reviews?.[id];
     if(!render?.current||render.status!=='done'||!render.url)throw Error('缺当前完整样片');
     if(render.authoringDesign?.[id]!==sceneHashes[id])throw Error('样片制作依据已经变化');
     if(!review)throw Error('实际样片尚未观察');
     for(const r of entries[id].references)if(await digest(file(r.file))!==r.sha256)throw Error('参考文件已变化 '+r.id);
     await checkCapture(review,render,id);
     if(review.verdict!=='candidate')throw Error('作者仍要求返修');
     for(const r of entries[id].references)if(!review.referenceComparisons?.some((c:any)=>c.id===r.id&&Number.isFinite(c.at)&&c.at>=r.from&&c.at<=r.to&&text(c.observed)))throw Error('缺实际参考比较 '+r.id);
     sceneStates[id]='author-reviewed-not-user-accepted';
    }catch(e:any){found.push(id+'：'+e.message);}
    return found;
   }
   async function checkCapture(review:any,render:any,id:string){
    const capture=await json(file(review.capture));
    if(capture.schemaVersion!==2||capture.sceneId!==id||capture.renderId!==render.id||capture.key!==render.key||!same(capture.design,id==='film'?sceneHashes:{[id]:sceneHashes[id]}))throw Error('审阅依据不是当前样片版本');
    if(!/^\/production-media\/renders\/[\w-]+\/review\.mp4$/.test(render.url))throw Error('渲染地址无效');
    const video=path.resolve(projectDir,'production',render.url.slice('/production-media/'.length));
    const duration=(render.end-render.from)/30;
    if(await realpath(file(capture.video))!==await realpath(video)||capture.videoSha256!==await digest(video))throw Error('审阅视频身份失效');
    if(!Number.isFinite(capture.duration)||Math.abs(capture.duration-duration)>.15)throw Error('审阅时长不符');
    if(!Array.isArray(capture.frames)||capture.frames.length<3)throw Error('缺起态/过程/终态实际帧');
    for(const f of capture.frames)if(!Number.isFinite(f.at)||f.at<0||f.at>=duration||await digest(file(f.file))!==f.sha256)throw Error('实际帧丢失、被改或越界');
    if(!same(capture.references,id==='film'?[]:entries[id].references))throw Error('对照参考已经变化');
    const topics=reviewTopics({film:id==='film',real:id==='film'?book.scenes.some((s:any)=>s.mediaMode==='real'):entries[id].s.mediaMode==='real'});
    if(!same(capture.reviewTopics,topics.map((t:any)=>t.id)))throw Error('当前样片缺完整美术对照提示；重新 studio capture，无需重渲染');
    if(!capture.viewedCopy||await digest(file(capture.viewedCopy.file))!==capture.viewedCopy.sha256||capture.viewedCopy.sha256!==capture.videoSha256)throw Error('实际播放副本已变化');
    for(const ref of capture.references){const copy=capture.referenceCopies?.find((c:any)=>c.id===ref.id);if(!copy||await digest(file(copy.file))!==copy.sha256)throw Error('参考播放副本已变化 '+ref.id);}
    if(!fullPlayback(review.playback,duration))throw Error('缺完整原速观察；抽帧不能替代动态审阅');
    if(!Array.isArray(review.findings)||!review.findings.length||review.findings.some((f:any)=>!Number.isFinite(f.at)||f.at<0||f.at>duration||!text(f.observed)||!text(f.decision)||!['retain','fixed'].includes(f.status)))throw Error('实际画面发现仍未处理');
    const coverage=topicCoverage(review,topics);if(coverage.length)throw Error(coverage.join('；'));
    if(!Number.isFinite(review.targetWidth)||review.targetWidth<=0)throw Error('缺目标观看尺寸核对');
    if(!['listened','not-listened'].includes(review.audio?.status)||!text(review.audio?.observed))throw Error('声音观察范围不明');
    if(review.userAccepted!==undefined&&review.userAccepted!==false)throw Error('作者记录不能代写用户验收');
   }
   if(!errors.length){
    if(input.stage==='design'){
     // A first prototype is renderable without inventing reviews. Expansion requires actual calibration.
     const prototypes=[...new Set(book.scenes.filter((s:any)=>selected(s.sceneId)&&(!target||s.prototypeSceneId!==s.sceneId)).map((s:any)=>s.prototypeSceneId))] as string[];
     for(const p of prototypes)for(const e of await checkReview(p))fail('先校准代表样片，随后扩展。'+e);
    }else{
     for(const id of ids.filter((id:string)=>selected(id)))errors.push(...await checkReview(id,input.renderId));
     if(input.stage==='assembly'||input.stage==='delivery'){
      for(let i=1;i<ids.length;i++){
       const pair=[ids[i-1],ids[i]];
       const compared=book.comparisons?.some((c:any)=>same(c.scenes?.map((x:any)=>x.sceneId),pair)&&c.scenes.every((x:any)=>{const r=findRender(x.sceneId);return x.renderId===r?.id&&x.key===r?.key;})&&text(c.observed));
       if(!compared)fail(pair.join(' / ')+'：尚未对照当前实际接点');
      }
     }
     if(input.stage==='delivery'&&!errors.length){
      const r=book.filmReview,job=input.job;
      if(!job?.current||job.status!=='done'||job.kind!=='assembly')throw Error('最终自检需要当前整片合成');
      if(!r)throw Error('当前整片尚未回看');
      await checkCapture(r,job,'film');
      if(r.audio.status!=='listened'||r.verdict!=='candidate')throw Error('整片混音未听辨或仍需返修');
     }
    }
   }
  }catch(e:any){fail(e.message);}
  return {...requirement,gateVersion:2,workflow:'artifact-first-v2',ok:!errors.length,errors,sceneHashes,sceneStates,
   technicalValidation:errors.length?'blocked':'valid',visualJudgment:'not-automatically-assessed',userAccepted:false,
   nextAction:errors[0]??(input.stage==='design'?'渲染当前段，实际对照造型、动作和注意力；技术有效不代表视觉通过。':'记录已绑定当前输出；用户验收沿用原生入口。')};
 }
 return {inspect};
}
