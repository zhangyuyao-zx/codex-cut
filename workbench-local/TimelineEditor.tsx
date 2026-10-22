import React,{useEffect,useMemo,useRef,useState} from 'react';
import {resolveCutTimeline,type CutTimeline} from './cut-timeline';
import {snapFrame} from './cut-editor-model';
import type {AudioWaveform} from './audio-waveform';
import type {TimedSceneEvent} from './scene-event-timing';
import './timeline-editor.css';

export type TimelineScene={id:string;title:string;startMs:number|null;endMs:number|null};
export type TimelineEvent=TimedSceneEvent&{sceneId:string;sceneFrom:number;sceneEnd:number};
type Props={timeline:CutTimeline|null;frame:number;revision?:number;durationFrames?:number;selectedClipId?:string;selectedSceneId?:string;
  scenes?:TimelineScene[];events?:TimelineEvent[];disabled?:boolean;onSeek:(frame:number)=>void;
  onSelectClip?:(id:string,sourceFrame:number)=>void;onSelectScene?:(id:string,frame:number)=>void;
  onTrim?:(id:string,edge:'start'|'end',sourceFrame:number,revision?:number)=>void;
  onEventEdit?:(event:TimelineEvent,offsetFrames:number,durationFrames?:number,revision?:number)=>void;
  onGesture?:(active:boolean)=>void;api?:(path:string)=>Promise<any>;toolbar?:React.ReactNode};
const label=(frame:number)=>`${Math.floor(Math.max(0,frame)/1800).toString().padStart(2,'0')}:${(Math.max(0,frame)/30%60).toFixed(1).padStart(4,'0')}`;
const emptyScenes:TimelineScene[]=[],emptyEvents:TimelineEvent[]=[];

function Wave({wave,inFrame,outFrame,volume}:{wave:AudioWaveform;inFrame:number;outFrame:number;volume:number}) {
  const start=Math.floor(inFrame/30/wave.binSeconds),end=Math.ceil(outFrame/30/wave.binSeconds);
  const count=Math.max(1,end-start),step=Math.max(1,Math.ceil(count/400));
  const points=[];
  for(let i=start;i<end;i+=step){let peak=0;for(let j=i;j<Math.min(i+step,end);j++)peak=Math.max(peak,wave.peaks[j]??0);
    const x=(i-start)/count*1000,h=Math.min(1,peak*volume)*17;points.push(`M${x.toFixed(1)},${(20-h).toFixed(1)}V${(20+h).toFixed(1)}`);}
  return <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true"><path d={points.join('')} fill="none" stroke="currentColor" strokeWidth={Math.max(1,1000/(count/step))*.6}/></svg>;
}
const MemoWave=React.memo(Wave);

export function TimelineEditor({timeline,frame,revision,durationFrames,selectedClipId,selectedSceneId,scenes=emptyScenes,events=emptyEvents,disabled,
  onSeek,onSelectClip,onSelectScene,onTrim,onEventEdit,onGesture,api,toolbar}:Props) {
  const [zoom,setZoom]=useState(1),[snap,setSnap]=useState(true),[width,setWidth]=useState(600);
  const [waves,setWaves]=useState<Record<string,AudioWaveform>>({}),[waveError,setWaveError]=useState('');
  const [conflict,setConflict]=useState('');
  const [drag,setDrag]=useState<{kind:'seek'|'trim'|'event'|'duration';id?:string;edge?:'start'|'end';startX:number;base:number;next:number;revision?:number}|null>(null);
  const dragRef=useRef(drag);dragRef.current=drag;
  const suppressClick=useRef(false);
  const keyboardSeek=useRef({frame,at:0});
  const scroll=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null);
  const apiRef=useRef(api);apiRef.current=api;
  useEffect(()=>{const state=dragRef.current;if(state&&state.kind!=='seek'&&state.revision!==revision){
    dragRef.current=null;setDrag(null);onGesture?.(false);setConflict('工程已更新，本次拖动未覆盖新版本。请检查后重试。');
  }},[revision]);
  const cut=useMemo(()=>timeline?resolveCutTimeline(timeline):null,[timeline]);
  const total=Math.max(1,durationFrames??cut?.durationFrames??1),contentWidth=Math.max(240,width-76)*zoom;
  const pxPerFrame=contentWidth/total;
  const assetKey=useMemo(()=>JSON.stringify(timeline?.assets.filter(a=>timeline.clips.some(c=>c.assetId===a.id)).map(a=>[a.id,a.proxyFileName,a.durationFrames])??[]),[timeline]);
  useEffect(()=>{const node=scroll.current;if(!node)return;const observer=new ResizeObserver(()=>setWidth(node.clientWidth));observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!apiRef.current||!timeline)return;let canceled=false;setWaveError('');setWaves({});
    void(async()=>{for(const asset of timeline.assets.filter(a=>timeline.clips.some(c=>c.assetId===a.id))){
      if(canceled)break;try{const value=await apiRef.current!('cut/waveform?assetId='+encodeURIComponent(asset.id));
        if(!canceled)setWaves(current=>({...current,[asset.id]:value}));
      }catch{if(!canceled)setWaveError('部分音轨波形不可用，可继续编辑');}
    }})();return()=>{canceled=true;};
  },[assetKey]);
  const snapTargets=useMemo(()=>[0,total,...(cut?.clips.flatMap(c=>[c.startFrame,c.endFrame])??[]),
    ...(cut?.words.flatMap(w=>[Math.round(w.startMs*.03),Math.round(w.endMs*.03)])??[]),
    ...scenes.flatMap(s=>s.startMs===null?[]:[Math.round(s.startMs*.03)])],[cut,scenes,total]);
  const at=(clientX:number)=>Math.max(0,Math.min(total-1,Math.round((clientX-(track.current?.getBoundingClientRect().left??0))/pxPerFrame)));
  const snapped=(value:number)=>snap?snapFrame(value,snapTargets,Math.max(1,6/pxPerFrame)):Math.round(value);
  function begin(e:React.PointerEvent,kind:NonNullable<typeof drag>['kind'],id?:string,edge?:'start'|'end',base=0){
    if(disabled||e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);
    const state={kind,id,edge,startX:e.clientX,base,next:kind==='seek'?at(e.clientX):base,revision};
    setConflict('');
    suppressClick.current=false;
    dragRef.current=state;setDrag(state);if(kind==='seek')onSeek(state.next);else onGesture?.(true);
  }
  function move(e:React.PointerEvent){
    const state=dragRef.current;if(!state)return;
    let next=state.base+Math.round((e.clientX-state.startX)/pxPerFrame);
    if(state.kind==='seek')next=snapped(at(e.clientX));
    if(state.kind==='trim'){
      const c=cut?.clips.find(c=>c.id===state.id);if(!c)return;
      const global=state.edge==='start'?c.startFrame+next-c.inFrame:c.endFrame+next-c.outFrame;
      next+=snapped(global)-global;
      next=Math.max(state.edge==='start'?0:c.inFrame+1,Math.min(state.edge==='start'?c.outFrame-1:c.asset.durationFrames,next));
    }
    if(state.kind==='event'||state.kind==='duration'){
      const event=events.find(event=>event.sceneId+'|'+event.id===state.id);if(!event)return;
      const anchor=Math.round((event.anchorTimeMs??0)*.03);
      if(state.kind==='event')next=Math.max(event.sceneFrom-anchor,Math.min(event.sceneEnd-anchor-(event.durationFrames??1),snapped(anchor+next)-anchor));
      else next=Math.max(1,Math.min(event.sceneEnd-(event.sceneFrom+(event.frame??0)),next));
    }
    const updated={...state,next};dragRef.current=updated;setDrag(updated);if(state.kind==='seek')onSeek(next);
  }
  function end(e:React.PointerEvent,cancel=false){
    const state=dragRef.current;if(!state)return;dragRef.current=null;setDrag(null);onGesture?.(false);
    suppressClick.current=state.next!==state.base;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(cancel||state.next===state.base)return;
    if(state.kind==='trim'&&state.id&&state.edge)onTrim?.(state.id,state.edge,state.next,state.revision);
    if(state.kind==='event'||state.kind==='duration'){
      const event=events.find(event=>event.sceneId+'|'+event.id===state.id);if(event)onEventEdit?.(event,
        state.kind==='event'?state.next:event.offsetFrames,state.kind==='duration'?state.next:event.durationFrames,state.revision);
    }
  }
  const pointer={onPointerMove:move,onPointerUp:(e:React.PointerEvent)=>end(e),onPointerCancel:(e:React.PointerEvent)=>end(e,true),
    onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Escape'){dragRef.current=null;setDrag(null);onGesture?.(false);}}};
  const tickStep=Math.max(30,Math.ceil(total/Math.max(2,contentWidth/100)/30)*30);
  const ticks=Array.from({length:Math.floor(total/tickStep)+1},(_,i)=>i*tickStep);
  const eventPreview=(event:TimelineEvent)=>drag?.id===event.sceneId+'|'+event.id?{...event,
    offsetFrames:drag.kind==='event'?drag.next:event.offsetFrames,durationFrames:drag.kind==='duration'?drag.next:event.durationFrames}:event;
  return <section className="timeline-editor" aria-label="项目时间线">
    <div className="timeline-toolbar"><strong>时间线</strong><output>{label(drag?.kind==='seek'?drag.next:frame)}</output>
      {toolbar}<span className="timeline-tools-spacer"/>
      <button type="button" aria-pressed={snap} onClick={()=>setSnap(v=>!v)} title="吸附到片段与词的边界">吸附</button>
      <label className="timeline-zoom">缩放<input aria-label="时间线缩放" type="range" min="1" max="12" step=".25" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
    </div>
    <div className="timeline-scroll" ref={scroll}>
      <div className="timeline-content" style={{width:contentWidth+76}}>
        <div className="timeline-ruler"><span className="timeline-row-label">时间</span><div ref={track} className="timeline-track" style={{width:contentWidth}} {...pointer}
          role="slider" tabIndex={0} aria-label="播放位置" aria-valuemin={0} aria-valuemax={total-1} aria-valuenow={Math.max(0,Math.min(total-1,Math.round(frame)))} aria-valuetext={label(frame)} aria-disabled={disabled}
          onFocus={()=>{keyboardSeek.current.at=0;}}
          onKeyDown={e=>{if(e.key==='Escape'){pointer.onKeyDown(e);return;}if(disabled||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
            e.preventDefault();e.stopPropagation();const step=e.shiftKey?30:1,now=performance.now();
            const before=now-keyboardSeek.current.at<250?keyboardSeek.current.frame:frame;
            const next=e.key==='Home'?0:e.key==='End'?total-1:Math.max(0,Math.min(total-1,before+(e.key==='ArrowRight'?step:-step)));
            keyboardSeek.current={frame:next,at:now};onSeek(next);}}
          onPointerDown={e=>{keyboardSeek.current.at=0;e.currentTarget.focus({preventScroll:true});begin(e,'seek');}}>
          {ticks.map(t=><span key={t} style={{left:t/total*100+'%'}}>{label(t)}</span>)}</div></div>
        <div className="timeline-row"><span className="timeline-row-label">视频</span><div className="timeline-track" style={{width:contentWidth}}>
          {cut?.clips.map((clip,index)=>{
            const d=drag?.kind==='trim'&&drag.id===clip.id?drag:null;
            const start=clip.startFrame+(d?.edge==='start'?d.next-clip.inFrame:0),length=(d?.edge==='end'?d.next:clip.outFrame)-(d?.edge==='start'?d.next:clip.inFrame);
            return <div key={clip.id} className={'timeline-clip'+(clip.id===selectedClipId?' selected':'')} style={{left:start/total*100+'%',width:length/total*100+'%'}}>
              <button className="timeline-clip-body" type="button" disabled={disabled} aria-label={`片段 ${index+1} ${clip.asset.name}`} onClick={e=>{
                const f=Math.max(clip.startFrame,Math.min(clip.endFrame-1,at(e.clientX)));onSelectClip?.(clip.id,clip.inFrame+f-clip.startFrame);onSeek(f);
              }}><b>{String(index+1).padStart(2,'0')}</b><span>{clip.asset.name}</span></button>
              {onTrim&&(['start','end'] as const).map(edge=><button key={edge} type="button" disabled={disabled} className={'timeline-trim '+edge} aria-label={`片段 ${index+1} ${edge==='start'?'入点':'出点'}`} {...pointer}
                onPointerDown={e=>begin(e,'trim',clip.id,edge,edge==='start'?clip.inFrame:clip.outFrame)}
                onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onTrim(clip.id,edge,(edge==='start'?clip.inFrame:clip.outFrame)+(e.key==='ArrowRight'?1:-1));}}}/>)}
              {d&&<output>{(d.next/30).toFixed(2)}s</output>}
            </div>;
          })}
        </div></div>
        <div className="timeline-row audio"><span className="timeline-row-label">原声</span><div className="timeline-track" style={{width:contentWidth}}>
          {cut?.clips.map(clip=><div key={clip.id} className="timeline-wave" style={{left:clip.startFrame/total*100+'%',width:(clip.endFrame-clip.startFrame)/total*100+'%'}} title={clip.transform.volume===0?'已静音':waves[clip.assetId]?.silent?'静音音轨':'原声音量 '+Math.round(clip.transform.volume*100)+'%'}>
            {waves[clip.assetId]?<MemoWave wave={waves[clip.assetId]} inFrame={clip.inFrame} outFrame={clip.outFrame} volume={clip.transform.volume}/>:<small>{waveError?'波形不可用':'读取音轨…'}</small>}
          </div>)}
        </div></div>
        {!!scenes.length&&<div className="timeline-row scenes"><span className="timeline-row-label">段落</span><div className="timeline-track" style={{width:contentWidth}}>
          {scenes.filter(s=>s.startMs!==null&&s.endMs!==null).map(s=><button key={s.id} disabled={disabled} className={'timeline-scene'+(s.id===selectedSceneId?' selected':'')}
            style={{left:s.startMs!*.03/total*100+'%',width:Math.max(1,(s.endMs!-s.startMs!)*.03)/total*100+'%'}} onClick={e=>onSelectScene?.(s.id,at(e.clientX))}>{s.title}</button>)}
        </div></div>}
        {!!events.length&&<div className="timeline-row events"><span className="timeline-row-label">动作</span><div className="timeline-track" style={{width:contentWidth}}>
          {events.filter(event=>!event.issue&&event.frame!==null).map(event=>{
            const p=eventPreview(event),f=Math.round((p.anchorTimeMs??0)*.03)+p.offsetFrames;
            return <div key={event.sceneId+'|'+event.id} className={'timeline-event'+(event.sceneId===selectedSceneId?' selected':'')} style={{left:f/total*100+'%',width:p.durationFrames?p.durationFrames/total*100+'%':undefined}}>
              <button type="button" disabled={disabled||!onEventEdit} title={`${event.label} · ${label(f)} · 绑定口播，偏移 ${p.offsetFrames} 帧`} {...pointer}
                onPointerDown={e=>begin(e,'event',event.sceneId+'|'+event.id,undefined,event.offsetFrames)}
                onClick={()=>{if(!suppressClick.current)onSelectScene?.(event.sceneId,f);suppressClick.current=false;}}
                onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onEventEdit?.(event,event.offsetFrames+(e.key==='ArrowRight'?1:-1),event.durationFrames);}}}>◆ <span>{event.label}</span></button>
              {event.durationEditable&&<button type="button" disabled={disabled||!onEventEdit} className="timeline-event-end" aria-label={event.label+'时长'} {...pointer}
                onPointerDown={e=>begin(e,'duration',event.sceneId+'|'+event.id,undefined,event.durationFrames??1)}
                onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onEventEdit?.(event,event.offsetFrames,(event.durationFrames??1)+(e.key==='ArrowRight'?1:-1));}}}/>}
            </div>;
          })}
        </div></div>}
        <div className="timeline-playhead" aria-hidden="true" style={{left:76+Math.max(0,Math.min(total,frame))*pxPerFrame}}/>
      </div>
    </div>
    {(events.some(event=>event.issue)||waveError||conflict)&&<div className="timeline-status" role="status">{events.filter(event=>event.issue).map(event=><span key={event.sceneId+'|'+event.id}>{event.label}：{event.issue}</span>)}{waveError&&<span>{waveError}</span>}{conflict&&<span>{conflict}</span>}</div>}
  </section>;
}
