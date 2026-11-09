import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {digest,probe,freshDirectory,html} from './production-pack.mjs';
import {standards,reviewTopics} from './studio/standards.mjs';
import {storyboardKey,storyboardStatus} from './studio/storyboard.mjs';
import {referenceFromRegistry,sceneReferenceStudy,registryReferenceStudy} from './studio/reference.mjs';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const run=args=>execFileSync('ffmpeg',['-v','error','-nostdin',...args],{stdio:'pipe'});
const bookPath=project=>path.join(project,'production/authoring.json');
export async function loadBook(project){const p=bookPath(project),bytes=await fs.readFile(p,'utf8'),book=JSON.parse(bytes);if(book.schemaVersion!==2)throw Error('旧工程继续按保存的 v1 协议运行；本工具不自动迁移已在制作的影片');return {p,bytes,book};}
async function saveBook(state){
 // Preserve user edits and the previous version. This is not a replacement for native project locking.
 if(await fs.readFile(state.p,'utf8')!==state.bytes)throw Error('制作记录已被修改，重新读取后再更新');
 await fs.mkdir(path.join(path.dirname(state.p),'direction-history'),{recursive:true});
 const backup=path.join(path.dirname(state.p),'direction-history',`${Date.now()}-${process.pid}.json`);
 await fs.writeFile(backup,state.bytes,{flag:'wx'});
 const temporary=state.p+'.'+process.pid+'.tmp';
 await fs.writeFile(temporary,JSON.stringify(state.book,null,2)+'\n',{flag:'wx'});
 if(await fs.readFile(state.p,'utf8')!==state.bytes){await fs.unlink(temporary);throw Error('制作记录在写入前发生变化，保留新编辑');}
 await fs.rename(temporary,state.p);
 return {file:state.p,backup,userAccepted:false};
}
export async function syncBook(project){
 const state=await loadBook(project),plan=(await read(path.join(project,'production/production.json'))).state;
 const ids=new Set(plan.scenes.map(s=>s.id));
 const removed=state.book.scenes.filter(s=>!ids.has(s.sceneId));
 state.book.retiredScenes=[...(state.book.retiredScenes??[]),...removed];
 state.book.scenes=plan.scenes.map(s=>state.book.scenes.find(x=>x.sceneId===s.id)??{sceneId:s.id,visualTask:'',mediaMode:null,selectionReason:'',assetIds:[],referenceIds:[],prototypeSceneId:null});
 return saveBook(state);
}
export async function registerAsset({project,id,file,source,supports}){
 if(!id||!source||!supports)throw Error('素材需要稳定 id、出处及其能说明的内容');
 const state=await loadBook(project);
 if(state.book.assets[id])throw Error('素材 id 已存在；更新需显式检查受影响画面，不能静默覆盖');
 state.book.assets[id]={file:path.resolve(file),sha256:await digest(file),source,supports};
 return saveBook(state);
}
export async function importReference({project,registry,id,sceneId}){
 const state=await loadBook(project),reference=await referenceFromRegistry(registry,id);
 const shot=sceneId?state.book.scenes.find(s=>s.sceneId===sceneId):null;
 if(sceneId&&!shot)throw Error('未知段落 '+sceneId);
 const existing=state.book.references[id];
 if(existing){
  if(!shot||!isDeepStrictEqual(existing,reference))throw Error('参考 id 已存在，不静默替换；原条目可用 study 只读核对');
  if(shot.referenceIds?.includes(id))return {file:state.p,unchanged:true,userAccepted:false,reference:existing,study:await sceneReferenceStudy({project,sceneId})};
 }
 state.book.references[id]=reference;
 if(shot)shot.referenceIds=[...new Set([...(shot.referenceIds??[]),id])];
 const result=await saveBook(state);
 return {...result,reference,...(sceneId?{study:await sceneReferenceStudy({project,sceneId})}:{})};
}
export async function registerStoryboardFrame({project,sceneId,file,reason,source}){
 if(!reason?.trim()||!source?.trim())throw Error('说明这张图代表本段的理由及实际导出来源');
 const state=await loadBook(project),nativeFile=path.join(project,'production/production.json');
 const nativeBytes=await fs.readFile(nativeFile,'utf8'),plan=JSON.parse(nativeBytes).state;
 const visualKey=storyboardKey(state.book,plan,sceneId);
 if(!plan.scenes.find(s=>s.id===sceneId)?.program)throw Error('先完成本段共用场景的静态排版，再导出代表画面');
 const input=path.resolve(file),info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height:format=format_name','-of','json',input],{encoding:'utf8'})),stream=info.streams?.find(s=>s.codec_type==='video');
 const ext={png:'png',mjpeg:'jpg',webp:'webp'}[stream?.codec_name];
 if(!ext||!['png_pipe','jpeg_pipe','webp_pipe','image2'].includes(info.format?.format_name)||!(stream.width>0&&stream.height>0))throw Error('分镜送审需要实际PNG/JPEG/WebP静态图片，不能用视频或文字计划代替');
 const sha256=await digest(input),destination=path.join(project,'production/design-frames',randomUUID(),'frame.'+ext);
 await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(input,destination);
 if(await digest(destination)!==sha256)throw Error('图片在复制时变化，请重新导出');
 if(await fs.readFile(nativeFile,'utf8')!==nativeBytes)throw Error('原生设计在登记期间变化，重新读取后再送审');
 const frame={sceneId,file:destination,sha256,width:stream.width,height:stream.height,visualKey,reason,source,createdAt:new Date().toISOString(),approval:null};
 state.book.storyboardFrames??={};state.book.storyboardFrames[sceneId]=frame;
 await saveBook(state);
 return {sceneId,frame,status:'pending-user-review',animationApproved:false,chatMarkdown:`${sceneId} · 分镜静态图（待确认）\n\n![${sceneId} 分镜](<${destination}>)\n\n${reason}`};
}
export async function approveStoryboardFrame({project,sceneId,sha256,basis}){
 if(!basis?.trim())throw Error('仅在用户明确确认具体图片后，记录对应消息或原话；制作流程同意不算图片确认');
 const state=await loadBook(project),nativeFile=path.join(project,'production/production.json');
 const nativeBytes=await fs.readFile(nativeFile,'utf8'),plan=JSON.parse(nativeBytes).state;
 const status=await storyboardStatus({book:state.book,plan,sceneId,digest,resolveFile:f=>path.resolve(path.dirname(state.p),f)});
 const frame=state.book.storyboardFrames?.[sceneId];
 if(!frame||frame.sha256!==sha256||!['pending','approved'].includes(status.status))throw Error('不能确认过期或未送审的静态图：'+status.reason);
 frame.approval={kind:'user',sceneId,sha256,visualKey:frame.visualKey,basis,at:new Date().toISOString()};
 if(await fs.readFile(nativeFile,'utf8')!==nativeBytes)throw Error('原生设计已变化，重新读取后再确认');
 await saveBook(state);
 return {sceneId,staticFrameApproved:true,videoApproved:false,next:'仅推进本段动画；带声样片仍需按原流程审阅'};
}
export async function captureReview({project,sceneId,renderId,out,times}){
 const {book}=await loadBook(project),root=path.join(project,'production');
 const render=sceneId==='film'?await read(path.join(root,'last-render.json')):(await read(path.join(root,'segment-reviews.json'))).renders.find(r=>r.id===renderId&&r.sceneId===sceneId);
 if(!render||render.id!==renderId||render.status!=='done'||!render.authoringDesign||!/^\/production-media\/renders\/[\w-]+\/review\.mp4$/.test(render.url))throw Error('需要完成且绑定制作依据的原生样片');
 const video=path.join(root,render.url.slice('/production-media/'.length)),videoSha256=await digest(video);
 const duration=Number(probe(video).format.duration);
 if(Math.abs(duration-(render.end-render.from)/30)>.15)throw Error('实际视频与原生记录时长不符');
 const chosen=times??[0,Math.min(duration/2,duration-1/30),Math.max(0,duration-1/30)];
 if(new Set(chosen).size<3||chosen.some(t=>!Number.isFinite(t)||t<0||t>=duration))throw Error('至少选择三个不同的有效时点，检查起态/过程/终态');
 const shot=book.scenes.find(s=>s.sceneId===sceneId);
 const topics=reviewTopics({film:sceneId==='film',real:sceneId==='film'?book.scenes.some(s=>s.mediaMode==='real'):shot?.mediaMode==='real'});
 const references=sceneId==='film'?[]:(shot?.referenceIds??[]).map(id=>({id,...book.references[id]}));
 await freshDirectory(out);
 await fs.copyFile(video,path.join(out,'current.mp4'));
 const frames=[];
 for(let i=0;i<chosen.length;i++){
  const file=path.resolve(out,`frame-${i}.png`);
  run(['-ss',String(chosen[i]),'-i',video,'-frames:v','1','-update','1',file]);
  frames.push({at:chosen[i],file,sha256:await digest(file)});
 }
 const referenceCopies=[];
 for(let i=0;i<references.length;i++){
  const ref=references[i],file=path.resolve(root,ref.file);
  if(await digest(file)!==ref.sha256)throw Error('参考文件已变化 '+ref.id);
  const copied=path.resolve(out,`reference-${i}.mp4`);
  run(['-ss',String(ref.from),'-i',file,'-t',String(ref.to-ref.from),'-an','-c:v','libx264','-preset','fast','-crf','19',copied]);
  referenceCopies.push({id:ref.id,file:copied,sha256:await digest(copied)});
 }
 if(await digest(video)!==videoSha256)throw Error('原生视频在采集期间变化，产物仅供排查');
 const capture={schemaVersion:2,sceneId,renderId,key:render.key,design:sceneId==='film'?render.authoringDesign:{[sceneId]:render.authoringDesign[sceneId]},video,videoSha256,duration,frames,references,referenceCopies,viewedCopy:{file:path.resolve(out,'current.mp4'),sha256:videoSha256},reviewTopics:topics.map(t=>t.id)};
 await fs.writeFile(path.join(out,'capture.json'),JSON.stringify(capture,null,2)+'\n');
 const observation={capture:path.resolve(out,'capture.json'),verdict:'unreviewed',playback:null,targetWidth:null,findings:[],referenceComparisons:[],audio:{status:'not-listened',observed:'尚未听辨'},userAccepted:false};
 await fs.writeFile(path.join(out,'review-draft.json'),JSON.stringify(observation,null,2)+'\n');
 await fs.writeFile(path.join(out,'index.html'),html('实际样片与参考',`<p>这是作者内部检查页。先原速带声看本期，再同尺度看对应参考；两片时长不同，不同步拉伸。尚未完成实际审查时，不作为已自查的用户送审稿。</p><div class="grid"><section><h2>本期实际输出</h2><video src="current.mp4" controls></video></section>${references.map((r,i)=>`<section><h2>${esc(r.label??r.id)}</h2><video src="reference-${i}.mp4" controls></video><p>${esc(r.learn)}</p><p>${esc(r.avoid)}</p>${r.sourceCode?`<p>改编源码：<code>${esc(r.sourceCode)}</code> · ${esc(r.sourceExport??'')}</p>`:''}</section>`).join('')}</div><div class="grid">${frames.map((f,i)=>`<figure><img src="frame-${i}.png"><figcaption>${f.at.toFixed(2)}s</figcaption></figure>`).join('')}</div><section><h2>本段实际对照</h2><p>先遮住字幕检查对象和事件，再带声检查时点、轻重与接力。与参考比较字块、容器、物件细部、运动触感。把实际差距写入现有 findings 与 referenceComparisons；像素变化和动作数量不能填写成节奏通过。</p>${topics.map(t=>`<p><strong>${esc(t.title)} · ${esc(t.id)}</strong><br>${esc(t.question)}</p>`).join('')}</section>`));
 const media={video:path.resolve(out,'current.mp4'),frames:frames.map(f=>({at:f.at,file:f.file}))};
 const chatMarkdown=`内部检查样片（${sceneId} / ${renderId}，${duration.toFixed(2)}秒；本次采集不代表作者已完成动态审查或用户验收）：\n\n![实际样片](<${media.video}>)\n\n${frames.map(f=>`![${f.at.toFixed(2)}秒](<${f.file}>)`).join('\n\n')}`;
 return {capture:path.join(out,'capture.json'),reviewDraft:path.join(out,'review-draft.json'),reviewTopics:topics,media,chatMarkdown,deliveryNote:'优先使用客户端的内嵌媒体或附件；本机路径不是公网地址。无法播放时明确说明，关键帧只供静态审阅。',visualJudgment:'unreviewed',userAccepted:false};
}

export async function studioCommand(args){
 const [action,...rest]=args;
 if(action==='standards')return standards;
 const value=key=>{const n=rest.indexOf(key);if(n<0||!rest[n+1])throw Error('Missing '+key);return rest[n+1];};
 if(action==='study'){
  const withCode=rest.includes('--with-code'),registry=rest.includes('--registry')?path.resolve(value('--registry')):undefined;
  if(rest.includes('--project'))return sceneReferenceStudy({project:path.resolve(value('--project')),sceneId:value('--scene'),registry,withCode});
  if(!registry)throw Error('study 需要 --project/--scene 或 --registry/--id');
  return registryReferenceStudy({registry,id:value('--id'),withCode});
 }
 const project=path.resolve(value('--project'));
 if(action==='sync')return syncBook(project);
 if(action==='asset')return registerAsset({project,id:value('--id'),file:path.resolve(value('--file')),source:value('--source'),supports:value('--supports')});
 if(action==='reference')return importReference({project,registry:path.resolve(value('--registry')),id:value('--id'),sceneId:rest.includes('--scene')?value('--scene'):undefined});
 if(action==='frame')return registerStoryboardFrame({project,sceneId:value('--scene'),file:value('--file'),reason:value('--reason'),source:value('--source')});
 if(action==='approve-frame')return approveStoryboardFrame({project,sceneId:value('--scene'),sha256:value('--sha256'),basis:value('--basis')});
 if(action==='capture')return captureReview({project,sceneId:value('--scene'),renderId:value('--render'),out:path.resolve(value('--out')),times:rest.includes('--times')?value('--times').split(',').map(Number):undefined});
 if(action==='resume'){
  const {book,p}=await loadBook(project);
  const plan=(await read(path.join(project,'production/production.json'))).state;
  const sceneId=rest.includes('--scene')?value('--scene'):null;
  if(sceneId&&!book.scenes.some(s=>s.sceneId===sceneId))throw Error('未知段落 '+sceneId);
  const scenes=await Promise.all(book.scenes.filter(s=>!sceneId||s.sceneId===sceneId).map(async s=>({sceneId:s.sceneId,visualTask:s.visualTask,prototypeSceneId:s.prototypeSceneId,assets:s.assetIds,references:(s.referenceIds??[]).map(id=>({id,...book.references[id]})),storyboardFrame:book.storyboardFrames?.[s.sceneId]??null,storyboardStatus:await storyboardStatus({book,plan,sceneId:s.sceneId,digest,resolveFile:f=>path.resolve(path.dirname(p),f)}),reviewTopics:reviewTopics({real:s.mediaMode==='real'}).map(t=>t.id),review:book.reviews?.[s.sceneId]??null})));
  return {entry:'tools/dots-production/WORKFLOW.md',craftGuide:'tools/dots-production/studio/CRAFT.md',standards,record:p,sourceOfTruth:'native production/cut, scene code, actual media',revision:plan.revision,soundtrack:plan.soundtrack??null,scenes,...(sceneId?{referenceStudy:await sceneReferenceStudy({project,sceneId})}:{}),note:'从适合本段的具体镜头与源码改编对象和事件，再审代表静态图。图片确认后做动画；带声实际对照完成后才扩展。'};
 }
 throw Error('studio supports standards, sync, asset, reference, study, frame, approve-frame, capture, resume');
}
