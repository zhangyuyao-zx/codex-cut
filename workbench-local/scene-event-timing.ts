import {z} from 'zod';

export const eventTimingSchema=z.object({offsetFrames:z.number().int().min(-30000).max(30000),
  durationFrames:z.number().int().min(1).max(30000).optional()}).strict();
export const eventTimingsSchema=z.record(z.string().min(1).max(4200),eventTimingSchema);
export type EventTiming=z.infer<typeof eventTimingSchema>;
export type TimedSceneEvent={id:string;label:string;wordId:string;anchorTimeMs:number|null;timeMs:number|null;
  frame:number|null;offsetFrames:number;durationFrames?:number;durationEditable:boolean;issue?:string};

/** Resolve edits from the current word map every time, never store an absolute clock. */
export function sceneEvents(scene:{beats:{wordId:string;label:string;durationFrames?:number}[];
  program?:{moduleId?:string;parameters?:Record<string,unknown>;cueBindings?:Record<string,string>};editor?:{eventTimings?:Record<string,EventTiming>}},
  words:readonly {sourceId:string;legacySourceId?:string;startMs:number}[],startMs:number|null,endMs:number|null,
  semantic?:readonly {id:string;label:string;required:boolean}[]):{events:TimedSceneEvent[];issues:string[]} {
  const definitions=semantic?semantic.filter(c=>c.required||scene.program?.cueBindings?.[c.id]).map(c=>({
    id:'cue:'+c.id,label:c.label,wordId:scene.program?.cueBindings?.[c.id]??'',durationFrames:undefined as number|undefined,
  })):scene.beats.map(b=>({...b,id:'beat:'+b.wordId}));
  const issues:string[]=[];
  for(const key of Object.keys(scene.editor?.eventTimings??{}))if(!definitions.some(d=>d.id===key))issues.push('动作调整失去绑定，请重新绑定或移除：'+key);
  const from=Math.round((startMs??0)*.03),end=Math.round((endMs??0)*.03);
  const events=definitions.map(d=>{
    const exact=words.find(w=>w.sourceId===d.wordId),aliases=words.filter(w=>w.legacySourceId===d.wordId);
    const word=exact??(aliases.length===1?aliases[0]:undefined);
    const edit=scene.editor?.eventTimings?.[d.id],offsetFrames=edit?.offsetFrames??0;
    const durationFrames=edit?.durationFrames??d.durationFrames;
    const anchorTimeMs=word?.startMs??null,frame=word?Math.round(word.startMs*.03)-from+offsetFrames:null;
    let issue=!word?'引用的词已删除或尚未绑定':startMs===null||endMs===null?'段落起止词需要重新定位':
      word.startMs<startMs||word.startMs>=endMs?'引用词不在本段内':
      frame!<0||from+frame!>=end?'动作调整超出本段，请重新定位':
      edit?.durationFrames!==undefined&&d.durationFrames===undefined?'此动作未声明可编辑时长':
      durationFrames!==undefined&&from+frame!+durationFrames>end?'动作时长超出本段':undefined;
    if(issue)issues.push('「'+d.label+'」'+issue);
    return {id:d.id,label:d.label,wordId:d.wordId,anchorTimeMs,frame,timeMs:anchorTimeMs===null?null:anchorTimeMs+offsetFrames*1000/30,
      offsetFrames,...(durationFrames===undefined?{}:{durationFrames}),durationEditable:d.durationFrames!==undefined,...(issue?{issue}:{})};
  });return {events,issues};
}
