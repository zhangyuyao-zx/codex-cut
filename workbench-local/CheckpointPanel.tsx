import React,{useEffect,useRef,useState} from 'react';

export function CheckpointPanel({api,onClose,hasDraft}:{api:(path:string,body?:any)=>Promise<any>;onClose:()=>void;hasDraft:boolean}){
  const dialog=useRef<HTMLDialogElement>(null), alive=useRef(true), taskStamp=useRef('');
  const [data,setData]=useState<any>(),[id,setId]=useState(''),[error,setError]=useState(''),[sending,setSending]=useState(false);
  async function refresh(){
    try {const d=await api('checkpoints');if(alive.current){taskStamp.current=d.task?.id+':'+d.task?.status;setData(d);setId(old=>old || d.items[0]?.id || '');}}
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
    try{await api('checkpoints/'+operation,operation==='create'?{}:{id});await refresh();}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{if(alive.current)setSending(false);}
  }
  const blocked=hasDraft || sending || !!data?.busy || !data;
  const task=data?.task;
  return <dialog ref={dialog} className="checkpoint-panel" aria-labelledby="checkpoint-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <div className="checkpoint-heading"><div><small>工程保护</small><h2 id="checkpoint-title">备份与恢复</h2></div><button aria-label="关闭备份与恢复" onClick={onClose}>关闭</button></div>
    <p>同时保存工程、动画源码和依赖锁。恢复会创建新副本，便于校验或继续制作。</p>
    {hasDraft && <p className="checkpoint-warning">有未保存调整，请先返回工作区保存。</p>}
    {error && <p role="alert">{error}</p>}
    <section><h3>当前工程</h3><button className="primary" disabled={blocked} onClick={()=>void run('create')}>创建备份</button><p className="hint">包含已保存的素材与作品；复制较大的视频需要一些时间。</p></section>
    <section><h3>已有备份</h3>
      <label>选择备份<select aria-label="选择备份" value={id} disabled={sending || data?.busy} onChange={e=>setId(e.target.value)}><option value="">{data?.items.length?'请选择':'暂无备份'}</option>{data?.items.map((item:any)=><option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · {item.files}个文件 · {(item.bytes/1024**2).toFixed(1)} MB</option>)}</select></label>
      <div className="checkpoint-actions"><button disabled={blocked || !id} onClick={()=>void run('verify')}>校验备份</button><button disabled={blocked || !id} onClick={()=>void run('restore')}>恢复到新副本</button></div>
    </section>
    {task && <section aria-live="polite"><h3>{task.operation==='create'?'创建备份':task.operation==='verify'?'校验备份':'恢复副本'}</h3><p>{task.status==='running'?'正在处理，请稍候…':task.status==='done'?`已完成 · ${task.files} 个文件校验通过`:task.error}</p>{task.status==='done' && <><code>{task.path}</code>{task.operation==='restore' && <p>副本包含 code 与 project 两个配对目录。原工作区仍保持当前工程；切换副本需按恢复说明启动，运行依赖需从锁文件安装。</p>}</>}</section>}
    {data && <footer><small>备份位置</small><code>{data.directory}</code><p className="hint">备份不包含已安装的运行依赖。文件校验通过与成功启动、视频效果验收分别进行。</p></footer>}
  </dialog>;
}
