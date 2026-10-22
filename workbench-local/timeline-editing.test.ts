import {describe,it,expect} from 'vitest';
import {cutTimelineSchema,resolveCutTimeline} from './cut-timeline';
import {snapFrame,splitTimelineClip} from './cut-editor-model';
import {sceneEvents,eventTimingsSchema} from './scene-event-timing';
import {resolveProduction} from './production-binding';
import {bindScenePrograms} from './scene-program-binding';
import {pcmPeaks} from './audio-waveform';

const timeline=()=>cutTimelineSchema.parse({schemaVersion:1,assets:[{id:'a',name:'source',durationFrames:180,sourceFileName:'source.mp4',proxyFileName:'proxy.mp4',
  words:[{id:'first',text:'前句',startMs:0,endMs:900},{id:'second',text:'后句',startMs:2000,endMs:2900},{id:'third',text:'结尾',startMs:4000,endMs:5000}]}],
  clips:[{id:'original',assetId:'a',inFrame:0,outFrame:180}]});
const cut=()=>({revision:1,asset:{url:'/cut-media/proxy.mp4',name:'test',durationMs:6000},timeline:timeline(),words:[],ranges:[],busy:false,
  preview:{url:'/cut-media/review.mp4',revision:1}});

describe('timeline edits and semantic clocks',()=>{
  it('split/reorder preserves every complete word identity; repeated insert stays distinct',()=>{
    const before=resolveCutTimeline(timeline());
    const split=splitTimelineClip(timeline(),'original',60,'right');
    expect(resolveCutTimeline(split).words.map(w=>w.id)).toEqual(before.words.map(w=>w.id));
    const moved=resolveCutTimeline({...split,clips:[split.clips[1]]});
    expect(moved.words[0]).toMatchObject({id:before.words[1].id,startMs:0});
    const repeat={...split.clips[1],id:'repeat',wordIdentity:undefined,legacyWordIds:false};
    const repeated=resolveCutTimeline({...split,clips:[...split.clips,repeat]});
    expect(new Set(repeated.words.map(w=>w.id)).size).toBe(repeated.words.length);
    expect(()=>splitTimelineClip(timeline(),'original',12,'bad')).toThrow('词内部');
    expect(()=>resolveCutTimeline({...split,clips:[...split.clips,{...split.clips[1],id:'duplicate'}]})).toThrow('身份冲突');
  });
  it('snapping is frame accurate and ignores targets outside the pixel tolerance',()=>{
    expect(snapFrame(29.6,[0,30,90],2)).toBe(30);expect(snapFrame(45.4,[30,90],2)).toBe(45);
  });
  it('a prior sentence deletion shifts the animation while preserving its offset and duration',async()=>{
    const c=cut(),words=resolveCutTimeline(c.timeline).words;
    const scene={id:'scene',title:'结尾',intent:'test',startWordId:words[1].id,endWordId:words[2].id,
      beats:[{wordId:words[1].id,label:'出现',durationFrames:10}],program:{moduleId:'demo',parameters:{}},
      editor:{overrides:{},locks:[],eventTimings:{['beat:'+words[1].id]:{offsetFrames:4,durationFrames:20}}}};
    const plan={revision:1,source:{assetUrl:c.asset.url,cutRevision:1},scenes:[scene],requests:[],feedback:[]};
    const before=resolveProduction(plan,c);expect(before.scenes[0].beats[0].timeMs).toBeCloseTo(2133.3333,3);
    const split=splitTimelineClip(c.timeline,'original',60,'right');
    const afterCut={...c,revision:2,timeline:{...split,clips:[split.clips[1]]},preview:{...c.preview,revision:2}};
    const synced={...plan,source:{...plan.source,cutRevision:2}};
    const resolved=resolveProduction(synced,afterCut);expect(resolved.issues).toEqual([]);
    expect(resolved.scenes[0].beats[0].timeMs).toBeCloseTo(133.3333,3);
    const [bound]=await bindScenePrograms(synced,resolved,{validate:async()=>({resolvedParameters:{}})});
    expect(bound.beats[0]).toMatchObject({frame:4,durationFrames:20,wordId:words[1].id});
    const removed=sceneEvents(scene,resolveCutTimeline({...split,clips:[{...split.clips[1],inFrame:90}]}).words.map(w=>({...w,sourceId:w.id})),0,3000);
    expect(removed.events[0].issue).toContain('引用的词已删除');
    expect(scene.editor.eventTimings['beat:'+words[1].id].offsetFrames).toBe(4);
  });
  it('semantic cue names keep offsets and reject out of range or unsupported durations',()=>{
    const scene={beats:[],program:{cueBindings:{show:'word'}},editor:{eventTimings:{'cue:show':{offsetFrames:6}}}};
    const words=[{sourceId:'word',startMs:1000}];const cues=[{id:'show',label:'显示',required:true}];
    expect(sceneEvents(scene,words,0,2000,cues).events[0]).toMatchObject({frame:36,offsetFrames:6,wordId:'word'});
    expect(sceneEvents({...scene,editor:{eventTimings:{'cue:show':{offsetFrames:-31}}}},words,0,2000,cues).issues.join()).toContain('超出本段');
    expect(sceneEvents({...scene,editor:{eventTimings:{'cue:show':{offsetFrames:0,durationFrames:5}}}},words,0,2000,cues).issues.join()).toContain('未声明');
    expect(()=>eventTimingsSchema.parse({'cue:show':{offsetFrames:.1}})).toThrow();
  });
  it('PCM waveform reduction handles split samples, silence and actual amplitudes',()=>{
    const data=Buffer.alloc(12);[0,16384,-32768,0,0,0].forEach((n,i)=>data.writeInt16LE(n,i*2));
    const peaks=pcmPeaks(2);peaks.write(data.subarray(0,3));peaks.write(data.subarray(3));expect(peaks.finish()).toEqual([.5,1,0]);
    const silent=pcmPeaks(100);silent.write(Buffer.alloc(200));expect(silent.finish()).toEqual([0]);
  });
});
