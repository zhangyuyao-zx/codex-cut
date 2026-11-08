import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {syncBook,registerAsset,captureReview,registerStoryboardFrame,approveStoryboardFrame,studioCommand} from './studio.mjs';
import {digest} from './production-pack.mjs';
import {mediaTransform,cameraAt} from './studio/media.mjs';
import {reviewTopics,topicCoverage} from './studio/standards.mjs';
const json=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(p,data)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(data));};

test('static frame registration and explicit confirmation stay separate from video approval and native edits',async t=>{
 const p=await fs.mkdtemp(path.join(os.tmpdir(),'studio-still-'));t.after(()=>fs.rm(p,{recursive:true,force:true}));
 const native=path.join(p,'production/production.json'),book=path.join(p,'production/authoring.json'),image=path.join(p,'actual.png');
 const plan={state:{scenes:[{id:'a',title:'静态构图',program:{moduleId:'shot',parameters:{}}},{id:'b'}]}};
 await write(native,plan);await write(book,{schemaVersion:2,contentId:'C20261108-001',assets:{},references:{},scenes:[{sceneId:'a',visualTask:'查看图中主体'},{sceneId:'b',visualTask:'下一段'}],reviews:{a:{userAccepted:false}},comparisons:[]});
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=160x90','-frames:v','1','-update','1',image]);
 const nativeBefore=await digest(native);
 const register=()=>registerStoryboardFrame({project:p,sceneId:'a',file:image,reason:'技术测试的静态画面，不代表真实审美验收',source:'synthetic fixture for shared scene export'});
 const result=await register();assert.equal(result.animationApproved,false);assert.equal(result.frame.width,160);assert.match(result.chatMarkdown,/待确认/);assert.ok(result.chatMarkdown.includes(result.frame.file));
 const resume=()=>studioCommand(['resume','--project',p]);
 assert.equal((await resume()).scenes[0].storyboardStatus.status,'pending');
 await assert.rejects(approveStoryboardFrame({project:p,sceneId:'a',sha256:'wrong',basis:'synthetic user approval'}),/不能确认/);
 await assert.rejects(approveStoryboardFrame({project:p,sceneId:'a',sha256:result.frame.sha256,basis:''}),/用户明确确认/);
 const approval=await approveStoryboardFrame({project:p,sceneId:'a',sha256:result.frame.sha256,basis:'Synthetic test approval, not a real user confirmation'});
 assert.equal(approval.staticFrameApproved,true);assert.equal(approval.videoApproved,false);
 let resumed=await resume();assert.equal(resumed.scenes[0].storyboardStatus.status,'approved');assert.equal(resumed.scenes[1].storyboardStatus.status,'missing');
 assert.equal((await json(book)).reviews.a.userAccepted,false);assert.equal(await digest(native),nativeBefore);
 const old=await json(book);await register();resumed=await resume();assert.equal(resumed.scenes[0].storyboardStatus.status,'pending');assert.notEqual(resumed.scenes[0].storyboardFrame.file,old.storyboardFrames.a.file);assert.equal(await digest(old.storyboardFrames.a.file),old.storyboardFrames.a.sha256);
 const history=await fs.readdir(path.join(p,'production/direction-history'));assert.ok(history.length>=3);
 await fs.writeFile(resumed.scenes[0].storyboardFrame.file,'changed');assert.equal((await resume()).scenes[0].storyboardStatus.status,'stale');
});

test('sync preserves authored decisions and archives removed shots without editing the native plan',async t=>{
 const p=await fs.mkdtemp(path.join(os.tmpdir(),'studio-sync-'));t.after(()=>fs.rm(p,{recursive:true,force:true}));
 const native=path.join(p,'production/production.json'),book=path.join(p,'production/authoring.json');
 await write(native,{state:{scenes:[{id:'kept'},{id:'new'}]}});
 await write(book,{schemaVersion:2,scenes:[{sceneId:'kept',visualTask:'keep my choice'},{sceneId:'removed',visualTask:'keep in history'}],reviews:{kept:{verdict:'revise'}}});
 const before=await digest(native);await syncBook(p);const result=await json(book);
 assert.equal(result.scenes[0].visualTask,'keep my choice');assert.equal(result.scenes[1].visualTask,'');assert.equal(result.retiredScenes[0].sceneId,'removed');assert.equal(result.reviews.kept.verdict,'revise');assert.equal(await digest(native),before);
});
test('capture extracts real frames of the selected native output and never claims it was reviewed',async t=>{
 const p=await fs.mkdtemp(path.join(os.tmpdir(),'studio-capture-'));t.after(()=>fs.rm(p,{recursive:true,force:true}));
 const base=path.join(p,'production'),video=path.join(base,'renders/r1/review.mp4');await fs.mkdir(path.dirname(video),{recursive:true});
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=160x90:r=30:d=2','-c:v','libx264','-pix_fmt','yuv420p',video]);
 await write(path.join(base,'authoring.json'),{schemaVersion:2,assets:{},references:{},scenes:[{sceneId:'s',referenceIds:[]}],reviews:{}});
 await write(path.join(base,'segment-reviews.json'),{renders:[{id:'r1',sceneId:'s',status:'done',url:'/production-media/renders/r1/review.mp4',from:0,end:60,key:'key',authoringDesign:{s:'design'}}]});
 const before=await digest(path.join(base,'authoring.json'));
 const result=await captureReview({project:p,sceneId:'s',renderId:'r1',out:path.join(p,'review')});
 const capture=await json(result.capture),draft=await json(result.reviewDraft);
 assert.equal(capture.frames.length,3);assert.equal(capture.videoSha256,await digest(video));assert.equal(capture.renderId,'r1');assert.equal(draft.verdict,'unreviewed');assert.equal(draft.playback,null);assert.equal(result.userAccepted,false);assert.equal(await digest(path.join(base,'authoring.json')),before);
 assert.ok(capture.reviewTopics.includes('typography'));assert.ok(capture.reviewTopics.includes('objects'));assert.ok(!capture.reviewTopics.includes('materials'));
 assert.equal(draft.findings.length,0);assert.equal(draft.referenceComparisons.length,0);
 assert.equal(await digest(result.media.video),capture.videoSha256);assert.equal(result.media.frames.length,3);
 assert.ok(result.chatMarkdown.includes(result.media.video));assert.ok(result.chatMarkdown.includes(result.media.frames[0].file));
 const page=await fs.readFile(path.join(p,'review/index.html'),'utf8');assert.match(page,/字块与观看尺度/);assert.match(page,/框内物件与美术细部/);
 const image=capture.frames[0].file;await registerAsset({project:p,id:'frame',file:image,source:'synthetic fixture',supports:'technical test'});
 await assert.rejects(registerAsset({project:p,id:'frame',file:image,source:'x',supports:'y'}),/已存在/);
 await assert.rejects(captureReview({project:p,sceneId:'s',renderId:'unknown',out:path.join(p,'invalid')}),/原生样片/);
});
test('review prompts follow shot material and film scope without inventing observations',()=>{
 const abstract=reviewTopics();assert.ok(!abstract.some(t=>t.id==='materials'));
 const real=reviewTopics({real:true});assert.ok(real.some(t=>t.id==='materials'));
 const film=reviewTopics({film:true,real:true});assert.ok(film.every(t=>!t.reference));
 assert.ok(topicCoverage({findings:[],referenceComparisons:[]},real).some(e=>e.includes('字块')));
 assert.ok(topicCoverage({findings:[{topics:['not-a-topic']}]},real).some(e=>e.includes('有效')));
});
test('the default CLI routes to studio and refuses implicit legacy creation before writing',async t=>{
 const p=await fs.mkdtemp(path.join(os.tmpdir(),'dots-routing-'));t.after(()=>fs.rm(p,{recursive:true,force:true}));
 const cli=fileURLToPath(new URL('./cli.mjs',import.meta.url));
 const help=execFileSync(process.execPath,[cli],{encoding:'utf8'});assert.match(help,/studio standards/);assert.match(help,/WORKFLOW.md/);
 for(const command of ['init','init-film','prepare','bind-native']){
  assert.throws(()=>execFileSync(process.execPath,[cli,command,'--to',path.join(p,'output')],{encoding:'utf8',stdio:'pipe'}),e=>e.status===1&&String(e.stderr).includes('历史创建命令'));
 }
 assert.deepEqual(await fs.readdir(p),[]);
 const data=JSON.parse(execFileSync(process.execPath,[cli,'studio','standards'],{encoding:'utf8'}));assert.equal(data.id,'dots-craft');
});
test('source crop is wholly visible, focus coordinates stay aligned, and camera seeking is deterministic',()=>{
 const t=mediaTransform({w:2000,h:1000},{w:300,h:300},{x:500,y:200,w:1000,h:500});
 assert.equal(t.x+500*t.scale,0);assert.equal(t.y+200*t.scale,75);assert.equal(500*t.scale,150);
 assert.deepEqual(t.clip,{x:0,y:75,w:300,h:150});
 const narrow=mediaTransform({w:2000,h:1000},{w:300,h:300},{x:1000,y:0,w:500,h:1000});
 assert.deepEqual(narrow.clip,{x:75,y:0,w:150,h:300});
 assert.equal(narrow.x-narrow.clip.x+1000*narrow.scale,0);
 assert.throws(()=>mediaTransform({w:100,h:100},{w:30,h:30},{x:50,y:0,w:70,h:100}),/inside/);
 const stops=[{at:0,rect:{x:0,y:0,w:100,h:100}},{at:30,duration:15,rect:{x:20,y:20,w:50,h:50}}];
 assert.deepEqual(cameraAt(0,stops),stops[0].rect);assert.deepEqual(cameraAt(45,stops),stops[1].rect);assert.deepEqual(cameraAt(20,stops),stops[0].rect);
});
