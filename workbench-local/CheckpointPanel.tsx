import React,{useEffect,useRef,useState} from 'react';
import type {ProjectCheckpointSource} from './project-checkpoint';

function sourceDescription(source?:ProjectCheckpointSource){
  return `代码 v${source?.workbenchVersion ?? '未知'} · 剪辑 r${source?.cutRevision ?? '未知'} · 制作 r${source?.productionRevision ?? '未知'}`;
}

export function CheckpointPanel({api,onClose,hasDraft}:{api:(path:string,body?:any)=>Promise<any>;onClose:()=>void;hasDraft:boolean}){
  const dialog=useRef<HTMLDialogElement>(null), alive=useRef(true), taskStamp=useRef('');
  const [data,setData]=useState<any>(),[id,setId]=useState(''),[label,setLabel]=useState(''),[error,setError]=useState(''),[sending,setSending]=useState(false);
  async function refresh(){
    try {const d=await api('checkpoints');if(alive.current){taskStamp.current=d.task?.id+':'+d.task?.status;setData(d);setId(old=>d.items.some((item:any)=>item.id===old) || (d.busy && d.task?.operation==='create' && d.task.checkpointId===old) ? old : d.items[0]?.id || '');}}
    catch(e){if(alive.current)setError(e instanceof Error?e.message:String(e));}
  }
  useEffect(()=>{alive.current=true;dialog.current?.showModal();void refresh();return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    const timer=setInterval(()=>void api('checkpoints/task').then(d=>{
      if(!alive.current)return;
      const stamp=d.task?.id+':'+d.task?.status,changed=stamp!==taskStamp.current;taskStamp.current=stamp;
      setData((old:any)=>old?{...old,task:d.task,busy:d.busy}:old);
      if(changed && !d.busy)void refresh();
    }).catch(e=>{if(alive.current)setError(e.message);}),1200);
    return()=>clearInterval(timer);
  },[]);
  async function run(operation:string){
    setError('');setSending(true);
    try{const started=await api('checkpoints/'+operation,operation==='create'?{label}:{id});if(operation==='create' && started.task?.checkpointId)setId(started.task.checkpointId);await refresh();}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{if(alive.current)setSending(false);}
  }
  const blocked=hasDraft || sending || !!data?.busy || !data;
  const task=data?.task;
  const selected=data?.items.find((item:any)=>item.id===id);
  return <dialog ref={dialog} className="checkpoint-panel" aria-labelledby="checkpoint-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <div className="checkpoint-heading"><div><small>工程保护</small><h2 id="checkpoint-title">备份与恢复</h2></div><button aria-label="关闭备份与恢复" onClick={onClose}>关闭</button></div>
    <p>保存当前版本，包括画面设计、手动调整和素材。恢复时创建新副本，保留当前工程。</p>
    {hasDraft && <p className="checkpoint-warning">有未保存调整，请先返回工作区保存。</p>}
    {error && <p role="alert">{error}</p>}
    <section><h3>当前工程</h3><label>备份名称（可选）<input aria-label="备份名称" placeholder="例如：客户确认版 · 字幕微调前" maxLength={80} value={label} disabled={blocked} onChange={e=>setLabel(e.target.value)} /></label><button className="primary" disabled={blocked} onClick={()=>void run('create')}>创建备份</button><p className="hint">名称最多 80 个字符；备份包含已保存的素材与作品，复制较大的视频需要一些时间。</p></section>
    <section><h3>已有备份</h3>
      <label>选择备份<select aria-label="选择备份" value={id} disabled={sending || data?.busy} onChange={e=>setId(e.target.value)}><option value="">{data?.items.length?'请选择':'暂无备份'}</option>{data?.items.map((item:any)=><option key={item.id} value={item.id}>{item.label || '未命名备份'} · {new Date(item.createdAt).toLocaleString()} · {sourceDescription(item.source)}</option>)}</select></label>
      {selected && <div className="checkpoint-details"><p><strong>{selected.label || '未命名备份'}</strong><br/>{sourceDescription(selected.source)}<br/>{selected.files} 个文件 · {(selected.bytes/1024**2).toFixed(1)} MB</p><details><summary>版本详情</summary>{selected.contentIdentity ? <><small>内容标识 · SHA-256</small><code>代码：{selected.contentIdentity.code}{'\n'}工程：{selected.contentIdentity.project}{'\n'}配对：{selected.contentIdentity.combined}</code></> : <p className="hint">这是旧版备份，没有版本摘要或内容标识，仍可校验和恢复。</p>}<p className="hint">版本摘要来自备份清单；点击“校验备份”检查实际文件。</p></details></div>}
      <div className="checkpoint-actions"><button disabled={blocked || !id} onClick={()=>void run('verify')}>校验备份</button><button disabled={blocked || !id} onClick={()=>void run('restore')}>恢复到新副本</button></div>
    </section>
    {task && <section aria-live="polite"><h3>{task.operation==='create'?'创建备份':task.operation==='verify'?'校验备份':'恢复副本'}</h3><p>{task.status==='running'?'正在处理，请稍候…':task.status==='done'?`已完成 · ${task.files} 个文件校验通过`:task.error}</p>{task.status==='done' && <><p>{task.label || '未命名备份'} · {sourceDescription(task.source)}</p><code>{task.path}</code>{task.operation==='restore' && <p>副本包含 code 与 project 两个配对目录，恢复了该版本的实际源码和工程文件。当前运行的工作台不会自动切换；需按恢复说明从副本 code 启动并使用配对 project，运行依赖从锁文件安装。</p>}</>}</section>}
    {data && <footer><small>备份位置</small><code>{data.directory}</code><p className="hint">备份不包含已安装的运行依赖。文件校验通过与成功启动、视频效果验收分别进行。</p></footer>}
  </dialog>;
}
