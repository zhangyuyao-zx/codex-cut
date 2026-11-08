import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
export const digest=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]+$/.test(id);
export const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',file],{encoding:'utf8'}));
const run=args=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin',...args],{stdio:'pipe'});
export async function freshDirectory(dir){try{await fs.lstat(dir);throw new Error('Target exists; refusing to merge or overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}await fs.mkdir(dir,{recursive:true});}
const css='body{margin:0;background:#f2eee4;color:#111;font:17px system-ui;padding:32px;max-width:1400px}h1{font-size:36px}h2{margin-top:32px}section{padding:24px;background:white;border-radius:22px;margin:24px 0}video,img{max-width:100%;border-radius:12px}video{width:640px}p{line-height:1.7}code{word-break:break-all}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}.note{color:#666}summary{cursor:pointer;font-weight:700}';
export const html=(title,body)=>`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style><body><h1>${esc(title)}</h1>${body}</body></html>`;

export async function preparePack({briefFile,registryFile,target,kitRoot,version,release}) {
  const brief=await read(briefFile),registry=await read(registryFile);
  if(brief.schemaVersion!==1||!safe(brief.sceneId)||!brief.task||!Array.isArray(brief.referenceIds)||!brief.referenceIds.length)throw new Error('Brief requires schemaVersion 1, sceneId, task and selected referenceIds');
  if(!Array.isArray(registry.entries)||new Set(registry.entries.map(x=>x.id)).size!==registry.entries.length)throw new Error('Reference registry contains duplicate/missing entries');
  const chosen=[];
  for(const id of brief.referenceIds){
    if(!safe(id)||chosen.some(x=>x.id===id))throw new Error('Invalid or duplicate selected reference id');
    const ref=registry.entries.find(x=>x.id===id);if(!ref)throw new Error(`Unknown reference ${id}`);
    if(!['reference','accepted-reconstruction','failure','transfer-candidate'].includes(ref.kind)||!ref.learn||!ref.avoid)throw new Error(`${id}: kind, learn and avoid are required`);
    const file=path.resolve(path.dirname(registryFile),ref.media.file),sha256=await digest(file),duration=Number(probe(file).format.duration);
    if(ref.media.sha256!==sha256)throw new Error(`${id}: source hash changed`);
    const from=ref.media.fromSeconds,to=ref.media.toSeconds;
    if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<=from||to>duration+.02)throw new Error(`${id}: invalid source range`);
    chosen.push({...ref,media:{file,sha256,fromSeconds:from,toSeconds:to}});
  }
  await freshDirectory(target);
  await fs.cp(path.join(kitRoot,'releases',version),path.join(target,'dots',version),{recursive:true,errorOnExist:true,force:false});
  for(const name of ['Scene.jsx','画面动作脚本.json'])await fs.copyFile(path.join(kitRoot,'releases',version,name),path.join(target,name));
  const script=await read(path.join(target,'画面动作脚本.json'));script.sceneId=brief.sceneId;script.contentId=brief.contentId??'AUTHORING';script.kitVersion=version;
  await fs.writeFile(path.join(target,'画面动作脚本.json'),JSON.stringify(script,null,2)+'\n');
  await fs.mkdir(path.join(target,'references'));
  const cards=[];
  for(const ref of chosen){
    const clip=`references/${ref.id}.mp4`,poster=`references/${ref.id}.jpg`,start=ref.media.fromSeconds,length=ref.media.toSeconds-start;
    run(['-ss',String(start),'-i',ref.media.file,'-t',String(length),'-map','0:v:0','-map','0:a?','-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2','-c:v','libx264','-crf','19','-preset','veryfast','-c:a','aac','-movflags','+faststart','-n',path.join(target,clip)]);
    run(['-ss',String(start+length*.62),'-i',ref.media.file,'-frames:v','1','-vf','scale=960:-2','-n',path.join(target,poster)]);
    ref.clip=clip;ref.clipSha256=await digest(path.join(target,clip));ref.poster=poster;
    cards.push(`<section><h2>${esc(ref.label??ref.id)}</h2><p class="note">${esc(ref.kind)} · 源区间 ${start}–${ref.media.toSeconds}s</p><video controls preload="metadata" poster="${poster}" src="${clip}"></video><p><b>提取：</b>${esc(ref.learn)}</p><p><b>避免：</b>${esc(ref.avoid)}</p>${ref.sourceCode?`<p>实现来源：<code>${esc(ref.sourceCode)}</code></p>`:''}</section>`);
  }
  const manifest={schemaVersion:1,version,brief,registryFile,referenceSources:chosen,phase:'design-before-authoring',visualQuality:'unreviewed',userAccepted:false};
  await fs.writeFile(path.join(target,'制作依据.json'),JSON.stringify(manifest,null,2)+'\n');
  await fs.writeFile(path.join(target,'dots-lock.json'),JSON.stringify({version,files:release.files,referenceIds:chosen.map(r=>r.id),status:'authoring-candidate'},null,2)+'\n');
  await fs.writeFile(path.join(target,'index.html'),html(brief.task,`<p>先看适用的小样，再确定本段具体对象、构图和动作。案例是比较依据，不能替代当前内容设计。</p>${cards.join('')}<p>检查对象和状态对应 → 实际渲染 → review-pack先观察后对照。所有新样片均待实际审阅。</p>`));
  await fs.writeFile(path.join(target,'README.md'),`# ${brief.task}\n\n打开 index.html：已绑定真实参考区间、已认可重建或失败样例。\n\n固定版本 ${version}。objects.jsx提供可改造的物件，objects.mjs让同一实体的内容快照与位姿驱动实际画面；已有components.jsx与state.mjs继续可用。根据本段内容完成Scene.jsx，不默认生成整段卡片布局。\n\n实际渲染后使用 review-pack；先记录画面事实，再展开设计意图与参考。结构/证据完整与美术判断分别记录。用户确认继续在现有工作台完成。\n`);
  return {target,version,referenceIds:chosen.map(r=>r.id),index:path.join(target,'index.html'),visualQuality:'unreviewed',userAccepted:false};
}

export async function reviewPack({specFile,target}) {
  const spec=await read(specFile),base=path.dirname(specFile);
  if(spec.schemaVersion!==1||!safe(spec.id)||!Array.isArray(spec.checkpoints)||!spec.checkpoints.length)throw new Error('Review spec requires id and actual checkpoint frames');
  const video=path.resolve(base,spec.video),duration=Number(probe(video).format.duration),sha256=await digest(video);
  const ids=new Set();for(const p of spec.checkpoints){if(!safe(p.id)||ids.has(p.id)||!Number.isFinite(p.seconds)||p.seconds<0||p.seconds>=duration)throw new Error('Invalid checkpoint');ids.add(p.id);}
  let reference=null;
  if(spec.reference){const file=path.resolve(base,spec.reference.file),sha=await digest(file),d=Number(probe(file).format.duration);if(sha!==spec.reference.sha256)throw new Error('Reference changed');const {fromSeconds:from,toSeconds:to}=spec.reference;if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<=from||to>d+.02)throw new Error('Invalid reference range');reference={...spec.reference,file};}
  await freshDirectory(target);await fs.copyFile(video,path.join(target,'current.mp4'));
  const frames=[];for(const p of spec.checkpoints){const name=`${p.id}.jpg`;run(['-ss',String(p.seconds),'-i',video,'-frames:v','1','-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2','-n',path.join(target,name)]);frames.push({...p,file:name,sha256:await digest(path.join(target,name))});}
  if(reference)run(['-ss',String(reference.fromSeconds),'-i',reference.file,'-t',String(reference.toSeconds-reference.fromSeconds),'-map','0:v:0','-an','-c:v','libx264','-crf','19','-preset','veryfast','-movflags','+faststart','-n',path.join(target,'reference.mp4')]);
  const evidence={schemaVersion:1,id:spec.id,video,videoSha256:sha256,viewedCopy:{file:'current.mp4',sha256:await digest(path.join(target,'current.mp4'))},specFile,specSha256:await digest(specFile),duration,frames,reference:reference?{...reference,viewedCopy:{file:'reference.mp4',sha256:await digest(path.join(target,'reference.mp4'))}}:null,observationStatus:'not-performed'};
  await fs.writeFile(path.join(target,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  await fs.writeFile(path.join(target,'observation.json'),JSON.stringify({schemaVersion:1,id:spec.id,videoSha256:sha256,evidenceSha256:await digest(path.join(target,'evidence.json')),observations:[],differences:[],authorVerdict:'unreviewed',userAccepted:false},null,2)+'\n');
  const frameHtml=frames.map(p=>`<figure><img src="${p.file}"><figcaption>${esc(p.id)} · ${p.seconds}s</figcaption></figure>`).join('');
  await fs.writeFile(path.join(target,'index.html'),html('先看实际画面，再核对设计',`<section><h2>第一遍：观察事实</h2><video controls preload="metadata" src="current.mp4"></video><p>先不展开设计：第一眼看哪里？哪个对象变化？变化后能看到什么？保留疑点，不从设计说明补全画面。</p><div class="grid">${frameHtml}</div></section><details><summary>第二遍：展开设计与参考</summary><section><p>${esc(spec.intent)}</p>${reference?'<video controls preload="metadata" src="reference.mp4"></video>':''}<p>${esc(spec.comparisonQuestion)}</p></section></details><p>将实际发现写入observation.json。此页不生成合格结论，也不写用户认可。</p>`));
  return {target,evidence:path.join(target,'evidence.json'),visualQuality:'unreviewed',userAccepted:false};
}

export async function checkReview({evidenceFile,observationFile,digestFile=digest}) {
  const e=await read(evidenceFile),o=await read(observationFile),errors=[];
  if(await digestFile(e.video)!==e.videoSha256||await digestFile(e.specFile)!==e.specSha256)errors.push('Current video/spec changed; this observation is stale');
  if(!e.viewedCopy||await digestFile(path.join(path.dirname(evidenceFile),e.viewedCopy.file))!==e.viewedCopy.sha256)errors.push('The viewed video copy changed');
  if(e.reference&&(await digestFile(e.reference.file)!==e.reference.sha256||!e.reference.viewedCopy||await digestFile(path.join(path.dirname(evidenceFile),e.reference.viewedCopy.file))!==e.reference.viewedCopy.sha256))errors.push('The compared reference changed');
  if(await digestFile(evidenceFile)!==o.evidenceSha256||o.videoSha256!==e.videoSha256||o.id!==e.id)errors.push('Observation identity mismatch');
  for(const f of e.frames)if(await digestFile(path.join(path.dirname(evidenceFile),f.file))!==f.sha256)errors.push(`Evidence frame changed: ${f.id}`);
  const observed=Array.isArray(o.observations)?o.observations:[];
  for(const f of e.frames){const hit=observed.find(x=>x.checkpointId===f.id);if(!hit||typeof hit.visibleFact!=='string'||!hit.visibleFact.trim())errors.push(`Missing visible fact for ${f.id}`);}
  if(!Array.isArray(o.differences)||!o.differences.length)errors.push('Record comparison differences, including limitations');
  for(const d of o.differences??[])if(!d.observed||!d.disposition||!['retain','fixed','open'].includes(d.status))errors.push('Each difference needs an observation and disposition');
  if(!['revise','candidate-for-user-review'].includes(o.authorVerdict))errors.push('Author observation not completed');
  if(o.authorVerdict==='candidate-for-user-review'&&(o.differences??[]).some(x=>x.status==='open'))errors.push('Unresolved differences remain');
  if(o.userAccepted!==false)errors.push('This helper cannot record user acceptance');
  return {ok:errors.length===0,errors,evidenceRecorded:errors.length===0,authorVerdict:o.authorVerdict,visualQuality:'not-automatically-assessed',userAccepted:false};
}
