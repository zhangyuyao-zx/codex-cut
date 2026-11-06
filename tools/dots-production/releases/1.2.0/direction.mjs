import {checkScene as checkStructure,checkFilm} from './structure.mjs';
export {checkFilm};
const list=x=>Array.isArray(x)?x:[];
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const boilerplate=/阅读上一变化|等待下一问题|听旁白补充|先辨认本段主体|read (the )?previous|wait for (the )?next/i;

// Report the intervals between authored actions even when a hold is declared.
// A hold is a claim about viewer work, never evidence that time was designed well.
export function actionGaps(cues,durationFrames){
 const spans=Object.values(cues).map(x=>[x.start,x.start+x.duration]).sort((a,b)=>a[0]-b[0]);
 const gaps=[];let end=0;
 for(const [a,b] of spans){if(a>end)gaps.push({from:end,to:a});end=Math.max(end,b);}
 if(end<durationFrames)gaps.push({from:end,to:durationFrames});return gaps;
}
export function inspectHolds(scene){
 const errors=[];const ids=new Set();
 for(const h of list(scene.holds)){
  if(!nonempty(h.id)||ids.has(h.id))errors.push('Hold requires a unique id');ids.add(h.id);
  if(boilerplate.test(h.reason??''))errors.push(`Hold ${h.id??'?'}: generic waiting reason cannot clear an interval`);
  if(!['read','compare','semantic-stop'].includes(h.kind))errors.push(`Hold ${h.id??'?'}: specify read, compare or semantic-stop`);
  if(!list(h.readableContent).length||h.readableContent.some(x=>!nonempty(x)))errors.push(`Hold ${h.id??'?'}: quote the actual visible content being read`);
  if(!nonempty(h.viewerTask)||!nonempty(h.exitCondition))errors.push(`Hold ${h.id??'?'}: concrete viewer task and exit condition required`);
 }
 return errors;
}
export function checkScene(scene,words,options){
 const r=checkStructure(scene,words,options);
 // Legacy checks remain available from their pinned releases. Current checking
 // always exposes motion gaps; strict hold authoring applies to 1.2 projects.
 const gaps=actionGaps(r.cues,scene.durationFrames);
 const strict=scene.kitVersion==='1.2.0';
 const errors=[...r.errors,...(strict?inspectHolds(scene):[])];
 if(strict){
  const regions=list(scene.rhythm?.inspectionRegions);
  if(!regions.some(x=>x.role==='semantic'))errors.push('rhythm.inspectionRegions needs the main semantic picture, excluding subtitles/timers');
  for(const x of regions)if(!nonempty(x.id)||![x.x,x.y,x.w,x.h].every(Number.isFinite)||x.x<0||x.y<0||x.w<=0||x.h<=0||x.x+x.w>1.001||x.y+x.h>1.001)errors.push('Invalid normalized inspection region');
 }
 return {...r,ok:errors.length===0,errors,inspectionGaps:gaps,declaredHolds:list(scene.holds),
  deliveryReady:false,renderAuditRequired:true,
  note:'Structure only. Holds never erase action gaps. audit-render and a current-artifact review are required before delivery; none of these represent user acceptance.'};
}

export function reviewRender(report,scene,review){
 const errors=inspectHolds(scene), windows=list(report.stillWindows);
 if(report.schemaVersion!==1||!report.videoSha256||!report.sceneSha256)errors.push('Missing actual render evidence identity');
 if(!review||review.videoSha256!==report.videoSha256||review.sceneSha256!==report.sceneSha256)errors.push('Review must match the exact video and authored scene');
 const seen=list(review?.windows);const known=new Set(windows.map(w=>w.id));
 for(const item of seen)if(!known.has(item.id))errors.push(`Unknown reviewed window ${item.id}`);
 for(const w of windows){
  const item=seen.find(x=>x.id===w.id);
  if(!item||item.observationMethod!=='normal-speed-playback'||!nonempty(item.observed)||!nonempty(item.readingTask))errors.push(`Unresolved actual still window ${w.id} (${w.fromSeconds}-${w.toSeconds}s)`);
  else {
   const hold=list(scene.holds).find(h=>h.id===item.holdId);
   if(!hold||hold.from/scene.fps>w.fromSeconds+.3||hold.to/scene.fps<w.toSeconds-.3)errors.push(`Window ${w.id}: no matching specific authored hold`);
   if(item.decision!=='retain-purposeful-hold')errors.push(`Window ${w.id}: rework remains required`);
  }
 }
 if(!list(review?.playbackRanges).some(x=>x.fromSeconds<=.1&&x.toSeconds>=report.durationSeconds-.15&&x.rate===1&&nonempty(x.observation)))errors.push('A recorded whole-segment normal-speed visual observation is required; ended=true is not observation');
 return {ok:errors.length===0,errors,deliveryReady:errors.length===0,stillWindows:windows,userAccepted:false,
  note:'Production rhythm evidence only. Observations must be made by the author; pixel movement does not establish meaning or aesthetic quality.'};
}
