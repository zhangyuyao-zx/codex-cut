type ReviewTask={id:string;key:string;status:string;current?:boolean;url?:string;from?:number;sceneId?:string};
export type ReviewRequest={kind:'segment'|'assembly';id:string;key:string;sceneId?:string};
type Context={resolved:{scenes:{id:string;startMs:number|null;endMs:number|null}[]};segmentReviews?:{sceneId:string;latest?:ReviewTask|null}[];job?:ReviewTask|null};

/** Explicit keyframe navigation edits; ordinary selection opens a current rendered sample. */
export function sceneEntry(context:Context,id:string,frame?:number){
  const range=context.resolved.scenes.find(scene=>scene.id===id);
  if(!range||range.startMs===null||range.endMs===null)return null;
  const task=context.segmentReviews?.find(review=>review.sceneId===id)?.latest;
  const sample=frame===undefined&&task?.status==='done'&&task.current===true&&!!task.url;
  const seconds=frame!==undefined?Math.max(range.startMs/1000,Math.min((range.endMs-1)/1000,frame/30)):sample?(task.from??Math.round(range.startMs*30/1000))/30:range.startMs/1000;
  return {sceneId:id,seconds,frame:Math.round(seconds*30),view:sample?'sample' as const:'scene' as const};
}

/** Only a task explicitly requested by this screen may bring a new result into view. */
export function completedReview(request:ReviewRequest,context:Context,selected:string):{state:'waiting'|'obsolete'}|{state:'ready';task:ReviewTask;view:'sample'|'review'}{
  if(request.kind==='segment'&&request.sceneId!==selected)return {state:'obsolete'};
  const task=request.kind==='assembly'?context.job:context.segmentReviews?.find(review=>review.sceneId===request.sceneId)?.latest;
  if(!task)return {state:'waiting'};
  if(task.id!==request.id||task.key!==request.key||['failed','cancelled'].includes(task.status))return {state:'obsolete'};
  if(task.status!=='done')return {state:'waiting'};
  if(!task.current||!task.url)return {state:'obsolete'};
  return {state:'ready',task,view:request.kind==='assembly'?'review':'sample'};
}
