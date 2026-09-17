/** Real-media regression; writes only a fresh isolated verification project. No approvals enter the user's project. */
import express from 'express';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {productionRoutes} from './production-routes';
import {createComponentLibrary} from './component-library';
import {resolveProduction} from './production-binding';
const exec=promisify(execFile), root=process.cwd();
const parent=resolve(root,'projects/local-workbench/verification');await mkdir(parent,{recursive:true});
const dir=await mkdtemp(resolve(parent,'segment-flow-'));await mkdir(resolve(dir,'cut'));await mkdir(resolve(dir,'production'));
const cut=JSON.parse(await readFile(resolve(root,'projects/local-workbench/cut/roughcut.json'),'utf8')).state;
const plan=JSON.parse(await readFile(resolve(root,'projects/local-workbench/production/production.json'),'utf8')).state;
const resolved=resolveProduction(plan,cut);
const names=['dji-redo-5','dji-redo-6'];
assert(names.every(id=>plan.scenes.some((s:any)=>s.id===id)),'This fixture expects the accepted DJI storyboard');
const start=34,end=38.4,duration=(end-start)*1000;
await exec('/opt/homebrew/bin/ffmpeg',['-v','error','-ss',String(start),'-i',resolve(root,'projects/local-workbench/cut',basename(cut.preview.url)),'-t',String(end-start),'-map','0:v:0','-map','0:a:0','-c:v','libx264','-preset','ultrafast','-crf','20','-r','30','-c:a','aac',resolve(dir,'cut','source.mp4')]);
const source={name:'隔离验证片段',durationMs:duration,url:'/cut-media/source.mp4'};
const state={revision:0,asset:source,words:resolved.words.filter(w=>w.startMs>=start*1000&&w.endMs<=end*1000).map(w=>({id:w.sourceId,text:w.text,startMs:w.startMs-start*1000,endMs:w.endMs-start*1000})),ranges:[{startMs:0,endMs:duration}],preview:{url:source.url,revision:0},busy:false};
await writeFile(resolve(dir,'cut','roughcut.json'),JSON.stringify({schemaVersion:1,state,files:{sourceFileName:"source.mp4",proxyFileName:"source.mp4"},history:[]}));
await writeFile(resolve(dir,'production','production.json'),JSON.stringify({schemaVersion:1,state:{...plan,revision:0,source:{assetUrl:source.url,cutRevision:0},scenes:plan.scenes.filter((s:any)=>names.includes(s.id)),requests:[],feedback:[]},history:[]}));
const library=await createComponentLibrary(root);
let router=await productionRoutes(root,dir,library);
let server:ReturnType<express.Express['listen']>;
let url='';
async function boot(){const app=express();app.use(express.json());app.use('/production',router);app.use((e:any,_q:any,r:any,_n:any)=>r.status(400).json({error:e.message}));server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));url=`http://127.0.0.1:${(server.address() as any).port}`;}
async function stop(){await router.shutdown();await new Promise<void>(r=>server.close(()=>r()));}
async function api(path='',body?:any,fail=false){const r=await fetch(url+'/production/'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const c=await r.json();if(fail){assert(!r.ok);return c;}if(!r.ok)throw Error(c.error);return c;}
async function done(kind:'sample'|'job') {for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,1000));const c=await api();if(c[kind]?.status==='done')return c;if(['failed','cancelled'].includes(c[kind]?.status))throw Error(c[kind].error);}throw Error('Render timeout');}
try{
 await boot();let c=await api();assert(!c.assemblyReady);await api('assemble',{expectedRevision:0},true);
 for(const sceneId of names){await api('render',{sceneId,expectedRevision:c.plan.revision});c=await done('sample');const r=c.segmentReviews.find((r:any)=>r.sceneId===sceneId);assert.equal(r.status,'pending');await api('approve-sample',{sceneId,key:r.key,renderId:r.latest.id});console.log('rendered and approved test scene',sceneId,r.from,r.end);}
 c=await api();assert(c.assemblyReady);const before=c.segmentReviews;
 const second=c.plan.scenes[1];await api('parameters',{expectedRevision:c.plan.revision,sceneId:second.id,actor:'user',patch:{typeScale:1.1}});
 c=await api();assert.equal(c.segmentReviews[0].status,'approved');assert.equal(c.segmentReviews[1].status,'changes');assert(!c.assemblyReady);assert.equal(c.segmentReviews[1].approved.url,before[1].approved.url);
 await api('approve-sample',{sceneId:second.id,key:before[1].key,renderId:before[1].latest.id},true);await api('assemble',{expectedRevision:c.plan.revision},true);
 // Restore the exact saved scene in the test fixture; the identical fingerprint restores its existing acceptance.
 await api('scenes',{expectedRevision:c.plan.revision,actor:'user',source:c.plan.source,scenes:[c.plan.scenes[0],second]});
 await stop();router=await productionRoutes(root,dir,library);await boot();c=await api();assert(c.assemblyReady);assert.equal(c.segmentReviews.length,2);
 await api('assemble',{expectedRevision:c.plan.revision});c=await done('job');assert(c.job.current);assert.equal(c.job.kind,'assembly');assert.equal(c.job.end,132);
 const movie=resolve(dir,'production',c.job.url.replace('/production-media/',''));
 const probeArgs=['-v','error','-select_streams','a:0','-show_packets','-show_data_hash','sha256','-show_entries','packet=pts,duration,data_hash','-of','json'];
 const originalAudio=JSON.parse((await exec('/opt/homebrew/bin/ffprobe',[...probeArgs,resolve(dir,'cut','source.mp4')])).stdout);
 const assembledAudio=JSON.parse((await exec('/opt/homebrew/bin/ffprobe',[...probeArgs,movie])).stdout);
 assert.deepEqual(assembledAudio,originalAudio);
 await exec('/opt/homebrew/bin/ffmpeg',['-v','error','-i',movie,'-f','null','-']);
 const frameHashes=async(file:string)=>(await exec('/opt/homebrew/bin/ffmpeg',['-v','error','-i',file,'-map','0:v:0','-f','framemd5','-'],{maxBuffer:4*1024*1024})).stdout.split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1)?.trim());
 const expected:string[]=[];for(const r of c.segmentReviews){const clip=resolve(dir,'production',r.approved.url.replace('/production-media/','').replace('/review.mp4','/picture.mp4'));expected.push(...await frameHashes(clip) as string[]);}
 assert.deepEqual(await frameHashes(movie),expected);
 await writeFile(resolve(dir,'verification.json'),JSON.stringify({testProject:true,scenes:2,frames:132,audioPackets:assembledAudio.packets.length,pictureFramesIdentical:true,restartPreserved:true,unrelatedSceneApprovalPreserved:true,staleAssemblyRejected:true,movie,context:c},null,2));
 console.log('PASS isolated end-to-end',dir);
}finally{await stop();}
