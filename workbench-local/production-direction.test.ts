import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {afterEach,expect,it} from 'vitest';
import {createProductionAuthoringGate} from './production-authoring';
import {reviewTopics} from '../tools/dots-production/studio/standards.mjs';
import {storyboardKey} from '../tools/dots-production/studio/storyboard.mjs';
const dirs:string[]=[];
afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
const write=async(p:string,data:any)=>{await mkdir(path.dirname(p),{recursive:true});await writeFile(p,JSON.stringify(data));};
const digest=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex');

// These are identity/workflow fixtures, deliberately not claimed as actual pictures or observation.
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'direction-v2-'));dirs.push(root);
 const project=path.join(root,'project'),base=path.join(project,'production'),contentId='C20261108-001';
 await write(path.join(project,'content-project.json'),{contentId});await mkdir(path.join(root,'public'),{recursive:true});
 const asset=path.join(root,'public','image.png'),ref=path.join(root,'reference.mp4');
 await writeFile(asset,'synthetic image bytes');await writeFile(ref,'synthetic reference');
 const code=path.join(root,'shot.jsx');await writeFile(code,"import {staticFile} from 'remotion'; export const image=staticFile('image.png');");
 const book:any={schemaVersion:2,method:'dots',contentId,assets:{image:{file:asset,sha256:await digest(asset),source:'test-source',supports:'test-support'}},references:{ref:{file:ref,sha256:await digest(ref),from:0,to:2,learn:'test-learn',avoid:'test-avoid'}},scenes:[{sceneId:'a',visualTask:'观察具体界面细节',mediaMode:'real',selectionReason:'真实界面承担主体',assetIds:['image'],referenceIds:['ref'],prototypeSceneId:'a'},{sceneId:'b',visualTask:'之后比较另一种表达'}],reviews:{},comparisons:[]};
 const plan:any={source:{assetUrl:'/audio.mp4',cutRevision:1},scenes:['a','b'].map((id,i)=>({id,startWordId:id+'1',endWordId:id+'2',intent:'test',beats:[],...(i===0?{program:{moduleId:'shot',parameters:{}}}:{})}))};
 const cut:any={revision:1,asset:{url:'/audio.mp4'},ranges:[{startMs:0,endMs:4000}],words:['a','b'].flatMap((id,i)=>[{id:id+'1',text:'开始',startMs:i*2000,endMs:i*2000+1000},{id:id+'2',text:'结束',startMs:i*2000+1000,endMs:i*2000+2000}])};
 const modules=[{id:'shot',sourceHash:'source-v1',modulePath:code}],reviews:any[]=[];
 const gate=createProductionAuthoringGate(root,project);
 const inspect=async(stage:any='design',sceneId='a',job?:any)=>{await write(path.join(base,'authoring.json'),book);return gate.inspect({plan,cut,modules,reviews,stage,sceneId:sceneId==='*'?undefined:sceneId,job});};
 async function reviewA(){
  const design=(await inspect()).sceneHashes;
  const video=path.join(base,'renders','run','review.mp4');await mkdir(path.dirname(video),{recursive:true});await writeFile(video,'synthetic output');
  const frames=[];for(let i=0;i<3;i++){const f=path.join(base,`frame${i}.png`);await writeFile(f,`synthetic frame ${i}`);frames.push({at:i*.7,file:f,sha256:await digest(f)});}
  const render={id:'run',key:'native-key',sceneId:'a',from:0,end:60,status:'done',current:true,url:'/production-media/renders/run/review.mp4',authoringDesign:design};
  reviews.push({sceneId:'a',latest:render,history:[render]});
  const topics=reviewTopics({real:true});
  const capture=path.join(base,'capture.json');await write(capture,{schemaVersion:2,sceneId:'a',renderId:'run',key:'native-key',design:{a:design.a},video,videoSha256:await digest(video),duration:2,frames,references:[{id:'ref',...book.references.ref}],viewedCopy:{file:video,sha256:await digest(video)},referenceCopies:[{id:'ref',file:ref,sha256:await digest(ref)}],reviewTopics:topics.map(t=>t.id)});
  book.reviews.a={capture,verdict:'candidate',playback:{rate:1,from:0,to:2,observed:'Synthetic test declaration, not real viewing'},findings:[{at:1,topics:topics.map(t=>t.id),observed:'Synthetic fixture, not art judgment',decision:'test',status:'retain'}],referenceComparisons:[{id:'ref',at:1,topics:topics.filter(t=>t.reference).map(t=>t.id),observed:'Synthetic fixture'}],targetWidth:390,audio:{status:'not-listened',observed:'Synthetic fixture'},userAccepted:false};
  return {render,video,capture};
 }
 return {root,project,book,plan,modules,reviews,inspect,reviewA,asset,ref,code};
}
it('allows a representative before unrelated shot details; blocks bulk expansion without actual calibration',async()=>{
 const f=await fixture();expect((await f.inspect()).ok).toBe(true);
 expect((await f.inspect('design','*')).ok).toBe(false);
 f.plan.scenes[1].program=f.plan.scenes[0].program;
 f.book.scenes[1]={...f.book.scenes[0],sceneId:'b',prototypeSceneId:'a',reuseReason:'same evidence-window behavior, different framing'};
 expect((await f.inspect('design','b')).errors.join()).toContain('先校准代表样片');
 await f.reviewA();expect((await f.inspect('design','b')).ok).toBe(true);
 f.book.reviews.a.verdict='revise';expect((await f.inspect('design','b')).ok).toBe(false);
});
it('a claimed material is insufficient when the actual code does not use it',async()=>{
 const f=await fixture();await writeFile(f.code,'export const fake = "diagram";');
 expect((await f.inspect()).errors.join()).toContain('未被场景静态依赖使用');
});
it('native timing, material identity and prototype source changes invalidate affected output',async()=>{
 const f=await fixture();await f.reviewA();expect((await f.inspect('review')).ok).toBe(true);
 f.modules[0].sourceHash='source-v2';expect((await f.inspect('review')).errors.join()).toContain('制作依据已经变化');
 f.modules[0].sourceHash='source-v1';await writeFile(f.asset,'changed');expect((await f.inspect()).ok).toBe(false);
});
it('editing observation prose does not force rerendering, but pending findings cannot pass',async()=>{
 const f=await fixture();await f.reviewA();const before=(await f.inspect()).sceneHashes;
 f.book.reviews.a.findings[0].observed='a more precise note';expect((await f.inspect()).sceneHashes).toEqual(before);
 f.book.reviews.a.findings[0].status='revise';expect((await f.inspect('review')).ok).toBe(false);
});
it('cannot substitute static frames for playback or merge author judgment into user acceptance',async()=>{
 const f=await fixture();await f.reviewA();f.book.reviews.a.playback=null;
 expect((await f.inspect('review')).errors.join()).toContain('完整原速');
 f.book.reviews.a.playback={rate:1,from:0,to:2,observed:'test'};f.book.reviews.a.userAccepted=true;
 expect((await f.inspect('review')).errors.join()).toContain('代写用户验收');
});
it('reference/playback copies stay bound to actual bytes',async()=>{
 const f=await fixture();const r=await f.reviewA();await writeFile(r.video,'changed output');
 expect((await f.inspect('review')).errors.join()).toContain('视频身份失效');
});
it('a semantic-only review cannot stand in for typography, object detail and motion comparison',async()=>{
 const f=await fixture();await f.reviewA();
 f.book.reviews.a.findings[0].topics=['understanding'];
 f.book.reviews.a.referenceComparisons[0].topics=['composition'];
 const result=await f.inspect('review');expect(result.ok).toBe(false);
 expect(result.errors.join()).toContain('字块与观看尺度');
 expect(result.errors.join()).toContain('框内物件与美术细部');
 expect(result.errors.join()).toContain('内部动作、触感与节奏');
});
it('older schema 2 captures need refreshed prompts, not a forced rerender',async()=>{
 const f=await fixture();const {capture}=await f.reviewA();
 const before=(await f.inspect()).sceneHashes;
 const evidence=JSON.parse(await readFile(capture,'utf8'));delete evidence.reviewTopics;await write(capture,evidence);
 const result=await f.inspect('review');expect(result.ok).toBe(false);
 expect(result.errors.join()).toContain('重新 studio capture');
 expect((await f.inspect()).sceneHashes).toEqual(before);
});
it('render waits for the exact segment image while design preparation and existing video review remain available',async()=>{
 const f=await fixture();expect((await f.inspect('design')).ok).toBe(true);
 expect((await f.inspect('render')).errors.join()).toContain('一张能代表最终效果');
 const visualKey=storyboardKey(f.book,f.plan,'a'),sha256=await digest(f.asset);
 const frame:any={sceneId:'a',file:f.asset,sha256,visualKey,width:160,height:90,reason:'Synthetic identity fixture',source:'Synthetic static export'};
 f.book.storyboardFrames={a:frame};expect((await f.inspect('render')).errors.join()).toContain('等待用户明确确认');
 frame.approval={kind:'user',sceneId:'a',sha256,visualKey,at:new Date().toISOString(),basis:'Synthetic approval, not user acceptance'};
 expect((await f.inspect('render')).ok).toBe(true);expect((await f.inspect('review')).ok).toBe(false);
 f.plan.scenes[1].program=f.plan.scenes[0].program;f.book.scenes[1]={...f.book.scenes[0],sceneId:'b',prototypeSceneId:'b'};
 expect((await f.inspect('render','b')).ok).toBe(false);
 f.book.storyboardFrames.b=frame;expect((await f.inspect('render','b')).storyboard.b.status).toBe('stale');
 frame.approval.sha256='wrong';expect((await f.inspect('render')).ok).toBe(false);frame.approval.sha256=sha256;
 await f.reviewA();delete f.book.storyboardFrames;expect((await f.inspect('review')).ok).toBe(true);
});
it('static design changes invalidate image acceptance, while implementing motion does not',async()=>{
 const f=await fixture();const visualKey=storyboardKey(f.book,f.plan,'a'),sha256=await digest(f.asset);
 f.book.storyboardFrames={a:{sceneId:'a',file:f.asset,sha256,visualKey,width:160,height:90,reason:'Synthetic fixture',source:'Synthetic export',approval:{kind:'user',sceneId:'a',sha256,visualKey,at:new Date().toISOString(),basis:'Synthetic approval'}}};
 f.modules[0].sourceHash='motion-implementation';f.plan.scenes[0].program.cueBindings={reveal:'a1'};f.plan.scenes[0].beats=[{wordId:'a1',label:'reveal'}];
 expect((await f.inspect('render')).ok).toBe(true);
 f.plan.scenes[0].program.styleDefaults={titleSize:90};expect((await f.inspect('render')).storyboard.a.status).toBe('stale');delete f.plan.scenes[0].program.styleDefaults;
 f.plan.scenes[0].program.parameters={title:'Changed visible wording'};expect((await f.inspect('render')).ok).toBe(false);f.plan.scenes[0].program.parameters={};
 await writeFile(f.asset,'modified source and image bytes');expect((await f.inspect('render')).ok).toBe(false);
});
