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
  const request=useRef(0),latest=useRef({api,open,disabled});latest.current={api,open,disabled};
  const renderIdentity=JSON.stringify(data.segmentReviews?.map((r:any)=>[r.sceneId,r.key,r.latest?.id,r.latest?.status]));
  const load=async()=>{
    const id=++request.current;
    try{
      const next=await latest.current.api('production/storyboard');
      if(id!==request.current)return;
      setOverview(next);
      if(!latest.current.disabled&&next.scenes.some((scene:any)=>scene.renderId&&!scene.frames.length)){
        setBusy(true);
        const captured=await latest.current.api('production/storyboard',{expectedRevision:next.revision});
        if(id===request.current)setOverview(captured);
      }
    }catch(e){if(id===request.current)setError((e as Error).message);}
    finally{if(id===request.current)setBusy(false);}
  };
  useEffect(()=>{
    if(!open)return;
    setError('');void load();
    return ()=>{request.current++;};
  },[open,renderIdentity,disabled]);
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
  return <section className="film-storyboard" aria-label="全片分镜总览">
    <button className="film-storyboard-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>
      <span><strong>全片分镜</strong><small>一起看构图、风格与前后变化</small></span><span>{data.plan.scenes.length} 段 · {open?'收起':'展开'}</span>
    </button>
    {open&&<div className="film-storyboard-content">
      <div className="film-storyboard-toolbar"><p>关键帧来自已生成样片。点击放大查看，或进入对应段落继续修改。</p>
        <button disabled={disabled||busy} onClick={capture}>{busy?'正在准备画面…':'刷新画面'}</button>
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
            {shot?.frames.length?<ShotFrames key={shot.frames.map(f=>f.id).join(':')} frames={shot.frames} title={scene.title} index={index} onZoom={frame=>setZoom({frame,title:scene.title,sceneId:scene.id})}/>:<div className="film-shot-empty"><strong>{shot?.renderId?busy?'正在准备画面…':'画面尚未就绪':'尚未生成画面'}</strong><span>{shot?.renderId?disabled?'保存当前修改后，会自动准备已有样片的画面。':'从已有样片准备画面，不重新制作视频。':scene.design?.message||scene.intent||'告诉 Codex 你希望怎样呈现这一段。'}</span></div>}
            <div className="film-shot-notes">
              {scene.design&&<p><b>画面任务</b>{scene.design.message}</p>}
              {coverage&&['unmapped','conflict'].includes(coverage.status)&&<p className="needs-attention"><b>风格待适配</b>{coverage.reason}</p>}
              {hint&&<p className="needs-attention">{hint.message}</p>}
              {review?.current&&(review.style==='revise'||review.composition==='revise')&&<p className="needs-attention"><b>待调整</b>{review.note}</p>}
              {review&&<details className="film-check-note"><summary>{review.current?'Codex 检查记录':'历史检查记录'}</summary><p>{styleLabels[review.style]} · {compositionLabels[review.composition]}<br/>{review.note}</p></details>}
              <button disabled={disabled||!shot?.frames.length} onClick={()=>onSelect(scene.id,shot?.frames.at(-1)?.frame)}>进入本段</button>
            </div>
          </article>;
        })}
      </div>}
      <p className="film-storyboard-footnote">想调整哪段，直接告诉 Codex，或进入本段留下修改意见。</p>
    </div>}
    {zoom&&<div className="film-frame-lightbox" role="dialog" aria-modal="true" aria-label="放大关键帧" onClick={()=>setZoom(null)}>
      <div onClick={event=>event.stopPropagation()}><div className="film-frame-heading"><strong>{zoom.title} · {(zoom.frame.frame/30).toFixed(2)}s</strong><button autoFocus onClick={()=>setZoom(null)}>关闭</button></div>
        <img src={zoom.frame.url} alt={zoom.title}/><button disabled={disabled||!data.plan.scenes.some((s:any)=>s.id===zoom.sceneId)} onClick={()=>{onSelect(zoom.sceneId,zoom.frame.frame);setZoom(null);}}>到这一帧编辑</button>
      </div>
    </div>}
  </section>;
}

function ShotFrames({frames,title,index,onZoom}:{frames:FilmReviewFrame[];title:string;index:number;onZoom:(frame:FilmReviewFrame)=>void}){
  const [selected,setSelected]=useState(frames.length-1);
  const frame=frames[selected];
  return <div className="film-shot-frames">
    <button className="film-shot-poster" onClick={()=>onZoom(frame)} aria-label={`放大第 ${index+1} 段 ${(frame.frame/30).toFixed(2)} 秒画面`}>
      <img loading="lazy" src={frame.url} alt={`${title}，全片 ${(frame.frame/30).toFixed(2)} 秒`} width={frame.width} height={frame.height}/><span>{(frame.frame/30).toFixed(2)}s · 放大</span>
    </button>
    <div className="film-shot-frame-picks" aria-label={`${title}关键帧`}>{frames.map((f,i)=><button key={f.id} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{['前段','中段','后段'][frames.length===2&&i===1?2:i]} · {(f.frame/30).toFixed(2)}s</button>)}</div>
  </div>;
}

export const FilmStoryboard=React.memo(FilmStoryboardView);
