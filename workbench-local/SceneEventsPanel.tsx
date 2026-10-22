import React,{useEffect,useRef,useState} from 'react';
import type {TimelineEvent} from './TimelineEditor';

type Edit={offsetFrames?:number;durationFrames?:number;wordId?:string;reset?:boolean};
export function SceneEventsPanel({events,words,revision,disabled,onEdit,onDirtyChange}:{events:TimelineEvent[];
  words:{sourceId:string;text:string;startMs:number}[];revision:number;disabled:boolean;
  onEdit:(event:TimelineEvent,patch:Edit,revision:number)=>Promise<boolean>;onDirtyChange:(dirty:boolean)=>void}) {
  const [selected,setSelected]=useState('');
  const event=events.find(e=>e.id===selected)??events[0];
  const [offset,setOffset]=useState('0'),[duration,setDuration]=useState('1'),[word,setWord]=useState(''),[dirty,setDirty]=useState(false);
  const base=useRef(revision);
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
  useEffect(()=>{if(dirty)return;base.current=revision;setOffset(String(event?.offsetFrames??0));
    setDuration(String(event?.durationFrames??1));setWord(event?.wordId??'');},[event?.id,event?.wordId,event?.offsetFrames,event?.durationFrames,revision,dirty]);
  if(!events.length)return null;
  const changed=()=>{if(!dirty)base.current=revision;setDirty(true);};
  return <section className="timeline-event-fields" aria-label="口播与动作">
    <strong>口播与动作</strong>
    <select aria-label="选择动作" value={event.id} disabled={disabled||dirty} onChange={e=>setSelected(e.target.value)}>
      {events.map(e=><option key={e.id} value={e.id}>{e.label}{e.issue?' · 待处理':''}</option>)}
    </select>
    {event.issue&&<p className="warning">{event.issue}</p>}
    <form onSubmit={e=>{e.preventDefault();const offsetFrames=Number(offset),durationFrames=Number(duration);
      if(!Number.isSafeInteger(offsetFrames)||(event.durationEditable&&(!Number.isSafeInteger(durationFrames)||durationFrames<1)))return;
      void onEdit(event,{offsetFrames,...(event.durationEditable?{durationFrames}:{}),...(word!==event.wordId?{wordId:word}:{})},base.current).then(ok=>{if(ok)setDirty(false);});}}>
      <label>绑定的口播词<select aria-label="绑定的口播词" value={word} disabled={disabled} onChange={e=>{changed();setWord(e.target.value);}}>
        {!words.some(w=>w.sourceId===word)&&<option value={word}>原引用失效 · 请选择</option>}
        {words.map(w=><option key={w.sourceId} value={w.sourceId}>{(w.startMs/1000).toFixed(2)}s · {w.text}</option>)}
      </select></label>
      <label>相对口播的偏移（帧）<input aria-label="动作偏移帧" type="number" step="1" min="-30000" max="30000" value={offset} disabled={disabled} onChange={e=>{changed();setOffset(e.target.value);}}/></label>
      {event.durationEditable&&<label>动作时长（帧）<input aria-label="动作时长帧" type="number" step="1" min="1" max="30000" value={duration} disabled={disabled} onChange={e=>{changed();setDuration(e.target.value);}}/></label>}
      <div className="event-edit-row"><button type="submit" disabled={disabled||!dirty}>保存动作</button>
        <button type="button" disabled={disabled||(!dirty&&event.offsetFrames===0)} onClick={()=>{if(dirty){setDirty(false);return;}void onEdit(event,{reset:true},revision);}}>{dirty?'放弃修改':'恢复节奏'}</button></div>
    </form>
    <p className="hint">0 帧跟随这个词。负数提前，正数延后。删改前文后自动重新定位。{!event.durationEditable?'此动作的时长由场景代码控制。':''}</p>
  </section>;
}
