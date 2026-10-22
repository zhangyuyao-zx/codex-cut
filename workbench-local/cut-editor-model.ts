import {CUT_FPS, clipTransformSchema, resolveCutTimeline, type CutTimeline} from './cut-timeline';

/** Read-only legacy projection. The server owns explicit migration on the first edit. */
export function cutEditorTimeline(state: {timeline?: CutTimeline; asset: {name:string;url:string;durationMs:number;durationFrames?:number}|null; words:any[]; ranges:{startMs:number;endMs:number}[]}): CutTimeline | null {
  if (state.timeline) return state.timeline;
  if (!state.asset) return null;
  const proxyFileName = state.asset.url.split('/').at(-1)!;
  const durationFrames = state.asset.durationFrames ?? Math.ceil(state.asset.durationMs * CUT_FPS / 1000);
  return {schemaVersion:1, assets:[{id:proxyFileName,name:state.asset.name,durationFrames,
    sourceFileName:proxyFileName,proxyFileName,words:state.words}],
    clips:state.ranges.map((r,i)=>({id:`legacy-${i}`,assetId:proxyFileName,
      inFrame:Math.max(0,Math.round(r.startMs*.03)),outFrame:Math.min(durationFrames,Math.round(r.endMs*.03)),
      transform:clipTransformSchema.parse({}),legacyWordIds:true}))};
}

export function snapFrame(frame:number, targets:readonly number[], tolerance:number):number {
  const rounded = Math.round(frame);
  const closest = targets.reduce<number|undefined>((best,n)=>Math.abs(n-rounded)<=tolerance &&
    (best===undefined || Math.abs(n-rounded)<Math.abs(best-rounded))?n:best,undefined);
  return closest ?? rounded;
}

export function splitTimelineClip(timeline:CutTimeline, clipId:string, sourceFrame:number, nextId:string):CutTimeline {
  const current=timeline.clips.find(c=>c.id===clipId);
  if(!current || !Number.isSafeInteger(sourceFrame) || sourceFrame<=current.inFrame || sourceFrame>=current.outFrame)
    throw Error('请把播放头放在片段内部再分割');
  const asset=timeline.assets.find(a=>a.id===current.assetId)!;
  if(asset.words.some(w=>w.startMs < sourceFrame*1000/CUT_FPS-0.01 && w.endMs > sourceFrame*1000/CUT_FPS+0.01))
    throw Error('播放头在一个词内部；请吸附到词的边界后再分割');
  const identity=current.wordIdentity??current.id;
  const next={...timeline,clips:timeline.clips.flatMap(c=>c.id!==clipId?[c]:[
    {...c,outFrame:sourceFrame,wordIdentity:identity},
    {...c,id:nextId,inFrame:sourceFrame,wordIdentity:identity},
  ])};
  resolveCutTimeline(next);return next;
}
