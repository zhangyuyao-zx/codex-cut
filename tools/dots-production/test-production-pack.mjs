// Narrow tests of the new reuse path, stale evidence and real rendered component contents.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {preparePack,reviewPack,checkReview,digest} from './production-pack.mjs';
import {viewAt} from './releases/1.3.0/objects.mjs';
import {reviewRender} from './releases/1.3.0/direction.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),req=createRequire(path.resolve(root,'../../package.json'));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'dots-reuse-'));
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=(p,d)=>fs.writeFile(p,JSON.stringify(d));
const results=[];
async function test(name,fn){try{await fn();results.push({name,ok:true})}catch(e){results.push({name,ok:false,error:e.message})}}
try{
 const entity={id:'record',entityId:'original-record',pose:{x:0,y:0,w:340,h:260},states:[{id:'old',at:0,data:{title:'原材料',eyebrow:'输入',rows:[{id:'owner',label:'复核人',value:'未指定'}],note:'待核'}},{id:'new',at:40,data:{title:'原材料',eyebrow:'修订',rows:[{id:'owner',label:'复核人',value:'业务负责人',tone:'changed'}]}}],poses:[{start:10,duration:20,to:{x:400,opacity:.7}}]};
 await test('同一实体移动和修订，回退帧不依赖历史',()=>{assert.equal(viewAt(entity,50).entityId,viewAt(entity,0).entityId);assert.equal(viewAt(entity,30).pose.x,400);assert.equal(viewAt(entity,50).data.note,undefined);assert.equal(viewAt(entity,0).pose.x,0);assert.equal(viewAt(entity,40).data.rows[0].value,'业务负责人')});
 await test('内容变化实际进入组件并清除旧文案',async()=>{const build=await req('esbuild').build({entryPoints:[path.join(root,'releases/1.3.0/objects.jsx')],bundle:true,write:false,format:'cjs',platform:'node',external:['react','remotion']});const m={exports:{}};new Function('require','module','exports',build.outputFiles[0].text)(req,m,m.exports);const R=req('react'),render=req('react-dom/server').renderToStaticMarkup;const old=render(R.createElement(m.exports.RecordCard,{view:viewAt(entity,0)})),newer=render(R.createElement(m.exports.RecordCard,{view:viewAt(entity,50)}));assert.match(old,/未指定/);assert.doesNotMatch(newer,/未指定|待核/);assert.match(newer,/业务负责人/);assert.match(newer,/data-entity-id="original-record"/);assert.match(newer,/translate\(400 0\)/)});
 await test('重复快照和位姿重叠拒绝',()=>{assert.throws(()=>viewAt({...entity,poses:[...entity.poses,{start:15,duration:10,to:{x:9}}]},30),/overlapping/);assert.throws(()=>viewAt({...entity,states:[entity.states[0],{...entity.states[1],at:0}]},30),/snapshots/)});
 await test('节奏证据完整也不宣告视频可以交付',()=>{const r=reviewRender({schemaVersion:1,videoSha256:'v',sceneSha256:'s',durationSeconds:1,stillWindows:[]},{holds:[]},{videoSha256:'v',sceneSha256:'s',windows:[],playbackRanges:[{fromSeconds:0,toSeconds:1,rate:1,observation:'人工fixture'}]});assert.equal(r.ok,true);assert.equal(r.rhythmEvidenceComplete,true);assert.equal(r.deliveryReady,false)});
 const video=path.join(temp,'fixture.mp4');execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=black:s=320x180:r=30:d=1','-c:v','libx264','-pix_fmt','yuv420p',video]);
 const registryFile=path.join(temp,'registry.json'),briefFile=path.join(temp,'brief.json'),target=path.join(temp,'prepared');
 await write(registryFile,{entries:[{id:'fixture',kind:'reference',learn:'取一个机制',avoid:'不可当成成片认可',media:{file:'fixture.mp4',sha256:await digest(video),fromSeconds:0,toSeconds:.8}}]});
 await write(briefFile,{schemaVersion:1,sceneId:'sample',task:'字段更正',referenceIds:['fixture']});
 await test('准备入口携带真实区间、源码和身份，不覆盖旧目录',async()=>{const result=await preparePack({briefFile,registryFile,target,kitRoot:root,version:'1.3.0',release:await read(path.join(root,'releases/1.3.0/manifest.json'))});assert.equal(result.userAccepted,false);assert.equal((await read(path.join(target,'制作依据.json'))).referenceSources.length,1);await fs.stat(path.join(target,'references/fixture.mp4'));await assert.rejects(()=>preparePack({briefFile,registryFile,target,kitRoot:root,version:'1.3.0',release:{}}),/exists/)});
 const specFile=path.join(temp,'review-spec.json'),review=path.join(temp,'review');await write(specFile,{schemaVersion:1,id:'sample',video,checkpoints:[{id:'before',seconds:.1},{id:'after',seconds:.7}],intent:'fixture only'});
 await reviewPack({specFile,target:review});const evidenceFile=path.join(review,'evidence.json'),observationFile=path.join(review,'observation.json');
 await test('生成审片证据不会自动填写观察或通过',async()=>{const result=await checkReview({evidenceFile,observationFile});assert.equal(result.ok,false);assert.equal(result.userAccepted,false);assert.ok(result.errors.some(x=>x.includes('visible fact')))});
 const o=await read(observationFile);o.observations=[{checkpointId:'before',visibleFact:'测试黑色帧'},{checkpointId:'after',visibleFact:'仍为黑色帧'}];o.differences=[{observed:'人工测试素材无业务含义',disposition:'仅验证身份，不用于视觉结论',status:'retain'}];o.authorVerdict='candidate-for-user-review';await write(observationFile,o);
 await test('记录完整仍不提供自动美术结论',async()=>{const result=await checkReview({evidenceFile,observationFile});assert.equal(result.ok,true);assert.equal(result.visualQuality,'not-automatically-assessed');assert.equal(result.userAccepted,false)});
 await test('浏览页播放副本变化也会失效',async()=>{const copy=path.join(review,'current.mp4'),bytes=await fs.readFile(copy);await fs.appendFile(copy,'changed');assert.equal((await checkReview({evidenceFile,observationFile})).ok,false);await fs.writeFile(copy,bytes)});
 await test('修改视频或证据后原观察失效',async()=>{await fs.appendFile(video,'changed');assert.equal((await checkReview({evidenceFile,observationFile})).ok,false);const bad=path.join(temp,'stale-prepare');await assert.rejects(()=>preparePack({briefFile,registryFile,target:bad,kitRoot:root,version:'1.3.0',release:{}}),/hash changed/)});
}finally{await fs.rm(temp,{recursive:true,force:true})}
console.log(JSON.stringify({ok:results.every(x=>x.ok),results,scope:'组件内容与工程证据检查；不是实际样片审美验收'},null,2));if(results.some(x=>!x.ok))process.exitCode=1;
