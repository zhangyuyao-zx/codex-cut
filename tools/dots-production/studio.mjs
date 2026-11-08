import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {digest,probe,freshDirectory,html} from './production-pack.mjs';
import {standards,reviewTopics} from './studio/standards.mjs';
import {storyboardKey,storyboardStatus} from './studio/storyboard.mjs';
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
export async function importReference({project,registry,id}){
 const state=await loadBook(project),r=(await read(registry)).entries.find(r=>r.id===id);
 if(!r?.media||!r.learn||!r.avoid)throw Error('参考注册项不存在或没有适用边界');
 const file=path.resolve(path.dirname(registry),r.media.file);
 if(await digest(file)!==r.media.sha256)throw Error('参考身份已变化');
 if(state.book.references[id])throw Error('参考 id 已存在，不静默替换');
 state.book.references[id]={file,sha256:r.media.sha256,from:r.media.fromSeconds,to:r.media.toSeconds,learn:r.learn,avoid:r.avoid};
 return saveBook(state);
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
 await fs.writeFile(path.join(out,'index.html'),html('实际样片与参考',`<p>先看完整动态与观看尺寸，再记录具体差距。文件生成不代表审阅完成。</p><video src="current.mp4" controls></video><div class="grid">${frames.map((f,i)=>`<figure><img src="frame-${i}.png"><figcaption>${f.at.toFixed(2)}s</figcaption></figure>`).join('')}</div><section><h2>本段实际对照</h2><p>在已有 findings 中用 topics 标注观察维度，一条观察可覆盖多项；不要复制问题作为观察。参考比较也标注 topics。没有实际看见就保留未审阅。</p>${topics.map(t=>`<p><strong>${esc(t.title)} · ${esc(t.id)}</strong><br>${esc(t.question)}</p>`).join('')}</section><details><summary>展开参考对照</summary>${references.map((r,i)=>`<section><p>${esc(r.learn)}</p><video src="reference-${i}.mp4" controls></video><p>${esc(r.avoid)}</p></section>`).join('')}</details>`));
 const media={video:path.resolve(out,'current.mp4'),frames:frames.map(f=>({at:f.at,file:f.file}))};
 const chatMarkdown=`实际视频（${sceneId} / ${renderId}，${duration.toFixed(2)}秒；验收状态以当前工程记录为准）：\n\n![实际样片](<${media.video}>)\n\n${frames.map(f=>`![${f.at.toFixed(2)}秒](<${f.file}>)`).join('\n\n')}`;
 return {capture:path.join(out,'capture.json'),reviewDraft:path.join(out,'review-draft.json'),reviewTopics:topics,media,chatMarkdown,deliveryNote:'优先使用客户端的内嵌媒体或附件；本机路径不是公网地址。无法播放时明确说明，关键帧只供静态审阅。',visualJudgment:'unreviewed',userAccepted:false};
}

export async function studioCommand(args){
 const [action,...rest]=args;
 if(action==='standards')return standards;
 const value=key=>{const n=rest.indexOf(key);if(n<0||!rest[n+1])throw Error('Missing '+key);return rest[n+1];};
 const project=path.resolve(value('--project'));
 if(action==='sync')return syncBook(project);
 if(action==='asset')return registerAsset({project,id:value('--id'),file:path.resolve(value('--file')),source:value('--source'),supports:value('--supports')});
 if(action==='reference')return importReference({project,registry:path.resolve(value('--registry')),id:value('--id')});
 if(action==='frame')return registerStoryboardFrame({project,sceneId:value('--scene'),file:value('--file'),reason:value('--reason'),source:value('--source')});
 if(action==='approve-frame')return approveStoryboardFrame({project,sceneId:value('--scene'),sha256:value('--sha256'),basis:value('--basis')});
 if(action==='capture')return captureReview({project,sceneId:value('--scene'),renderId:value('--render'),out:path.resolve(value('--out')),times:rest.includes('--times')?value('--times').split(',').map(Number):undefined});
 if(action==='resume'){
  const {book,p}=await loadBook(project);
  const plan=(await read(path.join(project,'production/production.json'))).state;
  const scenes=await Promise.all(book.scenes.map(async s=>({sceneId:s.sceneId,visualTask:s.visualTask,prototypeSceneId:s.prototypeSceneId,assets:s.assetIds,storyboardFrame:book.storyboardFrames?.[s.sceneId]??null,storyboardStatus:await storyboardStatus({book,plan,sceneId:s.sceneId,digest,resolveFile:f=>path.resolve(path.dirname(p),f)}),reviewTopics:reviewTopics({real:s.mediaMode==='real'}).map(t=>t.id),review:book.reviews?.[s.sceneId]??null})));
  return {entry:'tools/dots-production/WORKFLOW.md',craftGuide:'tools/dots-production/studio/CRAFT.md',standards,record:p,sourceOfTruth:'native production/cut, scene code, actual media',revision:plan.revision,soundtrack:plan.soundtrack??null,scenes,note:'每段静态图先经用户确认再做动画；图片确认不等于视频验收。动态观察仍用 read_project 的 authoring 验证。'};
 }
 throw Error('studio supports standards, sync, asset, reference, frame, approve-frame, capture, resume');
}
