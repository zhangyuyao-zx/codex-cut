import React,{useEffect,useRef,useState} from 'react';
import type {FilmReviewDescription,FilmReviewFrame} from './film-review';
import type {CompositionComparison} from './film-direction';
import './film-storyboard.css';

type Overview=FilmReviewDescription&{revision:number;comparisons:CompositionComparison[]};
type Api=(path:string,body?:any)=>Promise<any>;
const styleLabels={consistent:'风格一致',revise:'风格需调整',unreviewed:'风格待观察'};
const compositionLabels={distinct:'表达有区分', 'intentional-repeat':'有意复用',revise:'构图需调整',unreviewed:'构图待观察'};

function FilmStoryboardView({api,data,selected,disabled,onSelect}:{api:Api;data:any;selected:string;disabled:boolean;onSelect:(id:string,frame?:number)=>void}){
  const [open,setOpen]=useState(false),[overview,setOverview]=useState<Overview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [zoom,setZoom]=useState<{frame:FilmReviewFrame;title:string;sceneId:string}|null>(null);
  const [shownFrames,setShownFrames]=useState<Record<string,string>>({});
  const request=useRef(0),latest=useRef({api,open});latest.current={api,open};
  const renderIdentity=JSON.stringify(data.segmentReviews?.map((r:any)=>[r.sceneId,r.key,r.latest?.id,r.latest?.status]));
  const load=async()=>{
    const id=++request.current;
    try{const next=await latest.current.api('production/storyboard');if(id===request.current)setOverview(next);}
    catch(e){if(id===request.current)setError((e as Error).message);}
  };
  useEffect(()=>{
    if(!open)return;
    setError('');void load();
    return ()=>{request.current++;};
  },[open,renderIdentity]);
  useEffect(()=>{
    if(!zoom)return;
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setZoom(null);};
    window.addEventListener('keydown',close);return ()=>window.removeEventListener('keydown',close);
  },[zoom]);
  const capture=async()=>{
    setBusy(true);setError('');const id=++request.current;
    try{const next=await api('production/storyboard',{expectedRevision:data.plan.revision});if(id===request.current)setOverview(next);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const current=overview?.scenes.find(s=>s.sceneId===selected);
  const selectedIndex=data.plan.scenes.findIndex((s:any)=>s.id===selected);
  const neighbors=overview?.scenes.filter(s=>s.current&&s.frames.length&&[data.plan.scenes[selectedIndex-1]?.id,data.plan.scenes[selectedIndex+1]?.id].includes(s.sceneId))??[];
  return <section className="film-storyboard" aria-label="全片分镜总览">
    <button className="film-storyboard-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>
      <span><strong>全片分镜</strong><small>一起看构图、风格与前后变化</small></span><span>{data.plan.scenes.length} 段 · {open?'收起':'展开'}</span>
    </button>
    {open&&<div className="film-storyboard-content">
      <div className="film-storyboard-toolbar"><p>关键帧来自已生成样片。点击放大查看，或进入对应段落继续修改。</p>
        <button disabled={disabled||busy} onClick={capture}>{busy?'正在提取…':'更新关键帧'}</button>
      </div>
      {error&&<p role="alert" className="error">{error}</p>}
      {!overview?<p role="status" className="hint">正在读取全片画面…</p>:<div className="film-storyboard-grid">
        {data.plan.scenes.map((scene:any,index:number)=>{
          const shot=overview.scenes.find(s=>s.sceneId===scene.id),hint=overview.comparisons.find(h=>h.sceneId===scene.id);
          const review=[...overview.reviews].reverse().find(r=>r.sceneId===scene.id);
          const coverage=data.stylePackInfo?.coverage?.scenes.find((s:any)=>s.sceneId===scene.id);
          return <article key={scene.id} className={'film-shot'+(selected===scene.id?' selected':'')}>
            <div className="film-shot-heading"><button disabled={disabled} onClick={()=>onSelect(scene.id)}><span>{String(index+1).padStart(2,'0')}</span><strong>{scene.title}</strong></button>
              <small className={shot?.current?'current':'historical'}>{shot?.renderId?(shot.current?'当前样片':'历史画面'):'待制作'}</small></div>
            {shot?.frames.length?<ShotFrames key={shot.frames.map(f=>f.id).join(':')} frames={shot.frames} title={scene.title} index={index} onPick={frame=>setShownFrames(values=>({...values,[scene.id]:frame.id}))} onZoom={frame=>setZoom({frame,title:scene.title,sceneId:scene.id})}/>:<div className="film-shot-empty"><strong>{shot?.renderId?'待提取关键帧':'尚未生成画面'}</strong><span>{shot?.renderId?'点击上方「更新关键帧」；保留原样片。':scene.design?.message||scene.intent||'先按内容设计本段，再生成实际样片。'}</span></div>}
            <div className="film-shot-notes">
              {scene.design&&<p><b>画面任务</b>{scene.design.message}</p>}
              {coverage&&<p className={['unmapped','conflict','partial'].includes(coverage.status)?'needs-attention':''}><b>共同样式</b>{coverage.reason}</p>}
              {hint&&<p className="needs-attention">{hint.message}</p>}
              {review&&<p><b>{review.current?'画面观察':'历史观察'}</b>{styleLabels[review.style]} · {compositionLabels[review.composition]}<br/>{review.note}</p>}
              <button disabled={disabled||!shot?.frames.length} onClick={()=>onSelect(scene.id,shot?.frames.at(-1)?.frame)}>进入本段</button>
            </div>
          </article>;
        })}
      </div>}
      {current?.current&&current.frames.length>0&&<VisualObservation key={`${current.sceneId}:${current.key}:${current.renderId}`} api={api} overview={overview!} scene={current} neighbors={neighbors} shownFrames={shownFrames} revision={data.plan.revision} disabled={disabled||busy} onSaved={setOverview}/>}
      <p className="film-storyboard-footnote">样式偏差和相似描述用于提醒复查；画面观察记录不代替你的段落确认。</p>
    </div>}
    {zoom&&<div className="film-frame-lightbox" role="dialog" aria-modal="true" aria-label="放大关键帧" onClick={()=>setZoom(null)}>
      <div onClick={event=>event.stopPropagation()}><div className="film-frame-heading"><strong>{zoom.title} · {(zoom.frame.frame/30).toFixed(2)}s</strong><button autoFocus onClick={()=>setZoom(null)}>关闭</button></div>
        <img src={zoom.frame.url} alt={zoom.title}/><button disabled={disabled||!data.plan.scenes.some((s:any)=>s.id===zoom.sceneId)} onClick={()=>{onSelect(zoom.sceneId,zoom.frame.frame);setZoom(null);}}>到这一帧编辑</button>
      </div>
    </div>}
  </section>;
}

function ShotFrames({frames,title,index,onZoom,onPick}:{frames:FilmReviewFrame[];title:string;index:number;onZoom:(frame:FilmReviewFrame)=>void;onPick:(frame:FilmReviewFrame)=>void}){
  const [selected,setSelected]=useState(frames.length-1);
  const frame=frames[selected];
  return <div className="film-shot-frames">
    <button className="film-shot-poster" onClick={()=>onZoom(frame)} aria-label={`放大第 ${index+1} 段 ${(frame.frame/30).toFixed(2)} 秒画面`}>
      <img loading="lazy" src={frame.url} alt={`${title}，全片 ${(frame.frame/30).toFixed(2)} 秒`} width={frame.width} height={frame.height}/><span>{(frame.frame/30).toFixed(2)}s · 放大</span>
    </button>
    <div className="film-shot-frame-picks" aria-label={`${title}关键帧`}>{frames.map((f,i)=><button key={f.id} aria-pressed={selected===i} onClick={()=>{setSelected(i);onPick(f);}}>{['前段','中段','后段'][frames.length===2&&i===1?2:i]} · {(f.frame/30).toFixed(2)}s</button>)}</div>
  </div>;
}

function VisualObservation({api,overview,scene,neighbors,shownFrames,revision,disabled,onSaved}:{api:Api;overview:Overview;scene:Overview['scenes'][number];neighbors:Overview['scenes'];shownFrames:Record<string,string>;revision:number;disabled:boolean;onSaved:(value:Overview)=>void}){
  const [note,setNote]=useState(''),[style,setStyle]=useState('unreviewed'),[composition,setComposition]=useState('unreviewed'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [comparisonIds,setComparisonIds]=useState<string[]>([]);
  const reference=(s:typeof scene)=>({sceneId:s.sceneId,key:s.key,renderId:s.renderId,frameIds:[(s.frames.find(f=>f.id===shownFrames[s.sceneId])??s.frames.at(-1))!.id]});
  const save=async()=>{
    setBusy(true);setMessage('');
    try{const result=await api('production/visual-review',{expectedRevision:revision,...reference(scene),note,style,composition,comparedTo:overview.scenes.filter(s=>comparisonIds.includes(s.sceneId)).map(reference)});onSaved(result);setNote('');setMessage('观察已记录，段落确认状态不变。');}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  };
  return <details className="film-observation"><summary>记录当前段的画面观察</summary>
    <p>记录引用总览当前显示的关键帧；只勾选实际对照过的相邻段落。动作节奏仍需播放样片检查。</p>
    <div className="film-observation-controls"><label>风格<select value={style} onChange={e=>setStyle(e.target.value)}>{Object.entries(styleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>构图<select value={composition} onChange={e=>setComposition(e.target.value)}>{Object.entries(compositionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
    {neighbors.length>0&&<fieldset><legend>已实际对照的相邻段落</legend>{neighbors.map(s=><label key={s.sceneId}><input type="checkbox" checked={comparisonIds.includes(s.sceneId)} onChange={e=>setComparisonIds(ids=>e.target.checked?[...ids,s.sceneId]:ids.filter(id=>id!==s.sceneId))}/>{s.title}</label>)}</fieldset>}
    <textarea aria-label="画面观察说明" maxLength={4000} value={note} onChange={e=>setNote(e.target.value)} placeholder="记录实际看到的风格、构图或前后变化，以及需要调整的地方。"/>
    <button disabled={disabled||busy||!note.trim()} onClick={save}>{busy?'正在记录…':'保存画面观察'}</button>{message&&<p role="status">{message}</p>}
  </details>;
}

export const FilmStoryboard=React.memo(FilmStoryboardView);
