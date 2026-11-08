import {mkdtemp,rm,mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {afterEach,expect,it} from 'vitest';
import {createProductionAuthoringGate} from './production-authoring';
import {authoringRequirement,initializeProductionAuthoring} from './production-policy.mjs';

const temps:string[]=[];
const json=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
const write=async(p:string,v:any)=>{await mkdir(path.dirname(p),{recursive:true});await writeFile(p,JSON.stringify(v));};
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex');
const temp=async()=>{const p=await mkdtemp(path.join(tmpdir(),'native-authoring-'));temps.push(p);return p;};
afterEach(async()=>{await Promise.all(temps.splice(0).map(p=>rm(p,{recursive:true,force:true})));});

it('workspace policy covers unidentified/current/future projects; accepted legacy projects stay unchanged',async()=>{
 const root=await temp(),project=path.join(root,'project');
 await write(path.join(root,'projects/production-policy.json'),{schemaVersion:1,method:'dots',requiredFromContentId:'C20261108-001'});
 expect((await authoringRequirement(root,project)).required).toBe(true);
 await write(path.join(project,'content-project.json'),{contentId:'C20261107-001'});
 expect((await initializeProductionAuthoring(root,project)).configured).toBe(false);
 for(const contentId of ['C20261108-001','C20261109-001']){
  await write(path.join(project,'content-project.json'),{contentId});
  expect((await authoringRequirement(root,project)).required).toBe(true);
 }
 const starter=await initializeProductionAuthoring(root,project);
 expect(await json(starter.file)).toMatchObject({contentId:'C20261109-001',film:'',scenes:[]});
 await write(starter.file,{schemaVersion:1,method:'dots',film:'preserved',scenes:[]});
 await initializeProductionAuthoring(root,project);
 expect((await json(starter.file)).film).toBe('preserved');
});

/** Synthetic bytes exercise identities and gates only; never visual or audio acceptance. */
async function fixture(count=1){
 const root=await temp(),project=path.join(root,'project'),contentId='C20261108-001';
 await cp(path.resolve('tools/dots-production'),path.join(root,'tools/dots-production'),{recursive:true});
 await write(path.join(root,'projects/production-policy.json'),{schemaVersion:1,method:'dots',requiredFromContentId:contentId});
 await write(path.join(project,'content-project.json'),{contentId});
 const ref=path.join(project,'reference.mp4');await writeFile(ref,'synthetic reference, not actual media');
 const preparation=path.join(project,'preparation.json');
 await write(preparation,{schemaVersion:1,version:'1.3.0',brief:{contentId},referenceSources:[{id:'fixture',learn:'字段改变带来判断改变',avoid:'不能只更换卡片颜色',clip:'reference.mp4',clipSha256:await hash(ref),media:{file:ref,sha256:await hash(ref),fromSeconds:0,toSeconds:7}}]});
 const film:any={schemaVersion:1,contentId,viewerJourney:'从依据变化理解判断为何修订',scenes:[],handoffs:[]};
 const binding:any={schemaVersion:1,method:'dots',kitVersion:'1.3.0',contentId,film:'../film.json',scenes:[]};
 const plan:any={source:{assetUrl:'/fixture.mp4',cutRevision:1},scenes:[]};
 const cut:any={revision:1,asset:{url:'/fixture.mp4'},ranges:[{startMs:0,endMs:count*7000}],words:[]};
 const modules:any[]=[];
 for(let n=0;n<count;n++){
  const sceneId='s'+n,script=await json(path.resolve('tools/dots-production/releases/1.3.0/examples/correction.scene.json'));
  script.contentId=contentId;script.sceneId=sceneId;
  // The bundled correction fixture demonstrates objects only; supply this test's
  // authored holds and semantic region instead of treating it as an accepted film.
  script.holds=script.holds.map((h:any,i:number)=>({...h,id:'hold'+i,kind:'compare',readableContent:['任务已经完成','执行情况未知'],viewerTask:'比较订正前后措辞',exitCondition:'辨认执行结果仍未知'}));
  script.rhythm={inspectionRegions:[{id:'main',role:'semantic',x:0,y:0,w:1,h:.85}]};
  script.actions.forEach((a:any)=>a.wordId=sceneId+'-'+a.wordId);
  const source=path.join(project,sceneId+'.json');await write(source,script);
  const words=await json(path.resolve('tools/dots-production/releases/1.3.0/examples/correction.words.json'));
  words.at(-1).end=210;
  cut.words.push(...words.map((w:any)=>({id:sceneId+'-'+w.id,text:w.text,startMs:n*7000+w.start/30*1000,endMs:n*7000+w.end/30*1000})));
  plan.scenes.push({id:sceneId,title:'Fixture '+n,startWordId:sceneId+'-fixture-0',endWordId:sceneId+'-fixture-3',beats:[],program:{moduleId:sceneId}});
  film.scenes.push({sceneId,script:sceneId+'.json'});
  if(n)film.handoffs.push({fromSceneId:'s'+(n-1),toSceneId:sceneId,relation:'comparison',visualMode:'recompose',reason:'比较另一份材料的订正',nextQuestion:'这个判断依据是否足够',retainEntityIds:[]});
  binding.scenes.push({sceneId,script:source,preparation,referenceIds:['fixture']});
  const modulePath=path.join(root,sceneId+'.jsx');await writeFile(modulePath,`import design from './project/${sceneId}.json'; export default design;`);
  modules.push({id:sceneId,modulePath});
 }
 await write(path.join(project,'film.json'),film);await write(path.join(project,'production/authoring.json'),binding);
 const gate=createProductionAuthoringGate(root,project),reviews:any[]=[];
 const inspect=(stage:'design'|'review'|'assembly'|'delivery'='design',sceneId?:string,job?:any)=>gate.inspect({plan,cut,modules,reviews,stage,sceneId,job});
 const ready=await inspect();expect(ready.errors).toEqual([]);
 async function addReviews(){
  for(const [n,b] of binding.scenes.entries()){
   const run=path.join(project,'production/renders/run'+n);await mkdir(run,{recursive:true});
   const video=path.join(run,'review.mp4');await writeFile(video,'synthetic output '+n);
   const dir=path.join(project,'review'+n);await mkdir(dir);await cp(video,path.join(dir,'current.mp4'));await cp(ref,path.join(dir,'reference.mp4'));
   const specFile=path.join(dir,'spec.json');await write(specFile,{id:b.sceneId});
   const frames=[];
   for(const id of ['before','after']){const file=id+'.jpg';await writeFile(path.join(dir,file),'synthetic frame '+id);frames.push({id,file,sha256:await hash(path.join(dir,file))});}
   const evidenceFile=path.join(dir,'evidence.json');
   await write(evidenceFile,{schemaVersion:1,id:b.sceneId,video,duration:7,videoSha256:await hash(video),viewedCopy:{file:'current.mp4',sha256:await hash(video)},specFile,specSha256:await hash(specFile),frames,reference:{file:ref,sha256:await hash(ref),fromSeconds:0,toSeconds:7,viewedCopy:{file:'reference.mp4',sha256:await hash(ref)}}});
   const render={id:'render'+n,key:'key'+n,sceneId:b.sceneId,current:true,status:'done',from:n*210,end:(n+1)*210,url:'/production-media/renders/run'+n+'/review.mp4',authoringDesign:ready.sceneHashes};
   const playbackRanges=[{fromSeconds:0,toSeconds:7,rate:1,observation:'人工测试数据，不代表实际观察'}];
   await write(path.join(dir,'observation.json'),{schemaVersion:1,id:b.sceneId,evidenceSha256:await hash(evidenceFile),videoSha256:await hash(video),productionBinding:{sceneId:b.sceneId,key:render.key,renderId:render.id,designSha256:ready.sceneHashes[b.sceneId]},playbackRanges,observations:frames.map(f=>({checkpointId:f.id,visibleFact:'人工夹具身份检查'})),differences:[{observed:'测试内容无实际画面',disposition:'只验证流程状态',status:'retain'}],authorVerdict:'candidate-for-user-review',userAccepted:false,qualityChecks:['objects','composition','typography','motion','rhythm','transition'].map(aspect=>({aspect,observed:'测试字段',disposition:'仅校验存在'})),targetSizeReview:{width:390,observed:'测试字段'},audioReview:{status:'not-listened',note:'fixture 没有实际音频'}});
   const audit={schemaVersion:1,videoSha256:await hash(video),sceneSha256:await hash(b.script),durationSeconds:7,stillWindows:[]};
   await write(path.join(dir,'audit.json'),audit);await write(path.join(dir,'rhythm.json'),{...audit,windows:[],playbackRanges});
   b.review={evidence:evidenceFile,observation:path.join(dir,'observation.json'),rhythmAudit:path.join(dir,'audit.json'),rhythmReview:path.join(dir,'rhythm.json')};
   reviews.push({sceneId:b.sceneId,history:[render],latest:render,approved:render});
  }
  await write(path.join(project,'production/authoring.json'),binding);
 }
 return {root,project,film,binding,cut,modules,gate,reviews,inspect,addReviews};
}

it('design gate binds complete film, actual word timing, code dependency and reference bytes',async()=>{
 const f=await fixture(2);
 const file=f.binding.scenes[0].script,original=await json(file);
 await write(file,{...original,patternReason:'待填写'});
 expect((await f.inspect()).ok).toBe(false);await write(file,original);
 f.modules[0].sourceHash='before-source-change';expect((await f.inspect()).ok).toBe(true);
 await writeFile(f.modules[0].modulePath,'export default {};');
 f.modules[0].sourceHash='after-source-change';
 expect((await f.inspect()).errors.join()).toContain('未导入');
 await writeFile(f.modules[0].modulePath,"import design from './project/s0.json'; export default design;");
 f.modules[0].sourceHash='restored-source';
 f.cut.words[3].endMs-=100;
 expect((await f.inspect()).errors.join()).toContain('时长不匹配');f.cut.words[3].endMs+=100;
 f.film.scenes.reverse();await write(path.join(f.project,'film.json'),f.film);
 expect((await f.inspect()).errors.join()).toContain('顺序不一致');f.film.scenes.reverse();await write(path.join(f.project,'film.json'),f.film);
 await writeFile(path.join(f.project,'reference.mp4'),'changed');
 expect((await f.inspect()).errors.join()).toContain('参考片段已变');
});

it('review refuses incomplete playback, revise verdict, missing quality observation, and old media identity',async()=>{
 const f=await fixture();await f.addReviews();expect((await f.inspect('review')).errors).toEqual([]);
 const file=f.binding.scenes[0].review.observation,original=await json(file);
 const mutations=[
  {...original,playbackRanges:[]},
  {...original,authorVerdict:'revise'},
  {...original,qualityChecks:original.qualityChecks.slice(1)},
  {...original,productionBinding:{...original.productionBinding,renderId:'old'}}
 ];
 for(const mutation of mutations){await write(file,mutation);expect((await f.inspect('review')).ok).toBe(false);}
 await write(file,original);
 f.reviews[0].latest.authoringDesign={};expect((await f.inspect('review')).errors.join()).toContain('样片未绑定当前制作依据');
});

it('design edits invalidate existing render review even if native code key has not changed',async()=>{
 const f=await fixture();await f.addReviews();
 f.film.viewerJourney='增加另一个需要理解的问题';await write(path.join(f.project,'film.json'),f.film);
 expect((await f.inspect('design')).ok).toBe(true);
 expect((await f.inspect('review')).errors.join()).toContain('样片未绑定当前制作依据');
});

it('a future catalog default does not upgrade or invalidate a pinned production project',async()=>{
 const f=await fixture();const file=path.join(f.root,'tools/dots-production/catalog.json'),catalog=await json(file);
 catalog.currentVersion='9.9.9';await write(file,catalog);
 expect((await f.inspect()).errors).toEqual([]);
});

it('assembly requires adjacent and similar scenes to be compared against current selected renders',async()=>{
 const f=await fixture(2);await f.addReviews();
 expect((await f.inspect('assembly')).errors.join()).toContain('当前样片的交接/同类画面对照');
 const file=f.binding.scenes[0].review.observation,o=await json(file);
 o.comparedTo=[{sceneId:'s1',key:'key1',renderId:'render1',observed:'测试交接身份，不代表实际画面验收'}];await write(file,o);
 expect((await f.inspect('assembly')).errors).toEqual([]);
 f.reviews[1].approved={...f.reviews[1].approved,id:'new-render'};
 expect((await f.inspect('assembly')).ok).toBe(false);
});

it('final delivery needs current whole-film playback and actual mixed-audio observations',async()=>{
 const f=await fixture();await f.addReviews();
 const job={...f.reviews[0].approved,kind:'assembly'};
 expect((await f.inspect('delivery',undefined,job)).errors.join()).toContain('deliveryReview');
 const file=path.join(f.project,'delivery.json');f.binding.deliveryReview=file;
 await write(path.join(f.project,'production/authoring.json'),f.binding);
 const review={schemaVersion:1,renderId:job.id,key:job.key,videoSha256:await hash(path.join(f.project,'production/renders/run0/review.mp4')),playbackRanges:[{fromSeconds:0,toSeconds:7,rate:1,observation:'测试记录，无实际观影'}],checks:['continuity','rhythm','readability','sound'].map(aspect=>({aspect,observed:'测试记录',disposition:'仅验证状态',status:'retain'})),audioReview:{status:'not-listened',note:'合成夹具没有声音'},authorVerdict:'candidate-for-user-review',userAccepted:false};
 await write(file,review);expect((await f.inspect('delivery',undefined,job)).errors.join()).toContain('实际听辨');
 review.audioReview={status:'listened',note:'合成测试字段，不是真实听审'};await write(file,review);
 expect((await f.inspect('delivery',undefined,job)).errors).toEqual([]);
 review.videoSha256='changed';await write(file,review);
 expect((await f.inspect('delivery',undefined,job)).ok).toBe(false);
});
