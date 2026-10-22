import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import './glass.css';
import './product-interaction.css';
import {ChromeIcon,useWorkbenchAppearance} from './WorkbenchChrome';
import {VisualLibrary} from './VisualLibrary';
import {Production} from './Production';
import {Roughcut} from './Roughcut';
import {CheckpointPanel} from './CheckpointPanel';

type Workspace='cut'|'production'|'library';
function App(){
  const [mode,setMode]=useState<Workspace>(()=>{
    try{const saved=localStorage.getItem('workbench.workspace');return saved==='production'||saved==='library'?saved:'cut';}catch{return 'cut';}
  });
  const lastWorkspace=useRef<'cut'|'production'>('production');
  const [leftCollapsed,setLeftCollapsed]=useState(()=>window.innerWidth < 980),[rightCollapsed,setRightCollapsed]=useState(()=>window.innerWidth < 760);
  useEffect(()=>{
    const compact=window.matchMedia('(max-width:760px)');
    const changed=()=>{if(compact.matches){setLeftCollapsed(true);setRightCollapsed(true);}};
    compact.addEventListener('change',changed);return()=>compact.removeEventListener('change',changed);
  },[]);
  const {solid,setSolid}=useWorkbenchAppearance();
  const [productionDirty,setProductionDirty]=useState(false),[cutDirty,setCutDirty]=useState(false),[libraryDirty,setLibraryDirty]=useState(false);
  const [resourceBusy,setResourceBusy]=useState(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[checkpointOpen,setCheckpointOpen]=useState(false),[checkpointSupport,setCheckpointSupport]=useState(false);
  const token=useRef('');
  const hasDraft=productionDirty||cutDirty||libraryDirty;
  const navigationBlocked=hasDraft||resourceBusy;
  useEffect(()=>{try{localStorage.setItem('workbench.workspace',mode);}catch{}if(mode!=='library')lastWorkspace.current=mode;},[mode]);
  async function api(path:string,body?:any){
    const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':body instanceof File?'application/octet-stream':'application/json','X-Workbench-Token':token.current},body:body instanceof File?body:body?JSON.stringify(body):undefined});
    const data=await r.json();if(!r.ok)throw Error(data.error);return data;
  }
  useEffect(()=>{
    let alive=true;
    void api('bootstrap').then(data=>{if(!alive)return;token.current=data.token;setCheckpointSupport(data.capabilities?.checkpoints===true);setReady(true);}).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[]);
  if(!ready)return <div className="loading">{error||'正在打开工作台…'}</div>;
  return <div className="app" data-mode={mode} data-left-collapsed={leftCollapsed} data-right-collapsed={rightCollapsed} data-solid={solid}>
    <header className="app-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true">C</span><div><strong>Codex Cut</strong><small>本地视频工作台</small></div></div>
      <nav className="workspace-tabs" aria-label="工作区">{([['cut','剪辑'],['production','制作与审阅']] as const).map(([id,label])=><button key={id} aria-current={mode===id?'page':undefined} disabled={navigationBlocked} className={mode===id?'active':''} onClick={()=>setMode(id)}>{label}</button>)}</nav>
      <div className="shell-tools">
        <span className={'editor-save-status'+(hasDraft?' is-dirty':'')}><i/>{hasDraft?'未保存':'已保存到本机'}</span>
        <button className={'resource-entry'+(mode==='library'?' active':'')} aria-label={mode==='library'?'返回视频工作区':'打开资源'} aria-pressed={mode==='library'} disabled={navigationBlocked} onClick={()=>setMode(mode==='library'?lastWorkspace.current:'library')}>{mode==='library'?'返回视频':'资源'}</button>
        <button className="shell-icon" title={leftCollapsed?'展开左侧面板':'收起左侧面板'} aria-label="切换资源栏" aria-pressed={!leftCollapsed} onClick={()=>{if(leftCollapsed&&window.innerWidth<760)setRightCollapsed(true);setLeftCollapsed(!leftCollapsed);}}><ChromeIcon kind="left"/></button>
        <button className="shell-icon" title={rightCollapsed?'展开属性面板':'收起属性面板'} aria-label="切换属性栏" aria-pressed={!rightCollapsed} onClick={()=>{if(rightCollapsed&&window.innerWidth<760)setLeftCollapsed(true);setRightCollapsed(!rightCollapsed);}}><ChromeIcon kind="right"/></button>
        <details className="appearance-menu" onKeyDown={e=>{if(e.key==='Escape')e.currentTarget.open=false;}}><summary title="外观与工具" aria-label="外观与工具"><ChromeIcon kind="glass"/></summary><div className="appearance-popover">
          <b>工作台外观</b><label><input type="checkbox" checked={solid} onChange={e=>setSolid(e.target.checked)}/>减少透明度</label><p>仅改变工作台，不影响成片。</p>
          {checkpointSupport&&<div className="checkpoint-menu-entry"><b>工程</b><button disabled={navigationBlocked} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');setCheckpointOpen(true);}}>备份与恢复</button></div>}
        </div></details>
      </div>
    </header>
    {checkpointOpen&&<CheckpointPanel api={api} hasDraft={hasDraft} onClose={()=>setCheckpointOpen(false)}/>}
    {mode==='library'?<VisualLibrary api={api} onDirtyChange={setLibraryDirty} onBusyChange={setResourceBusy} onOpenScene={()=>setMode('production')}/>:mode==='production'?<Production api={api} token={token.current} onDirtyChange={setProductionDirty}/>:<Roughcut api={api} token={token.current} onDirtyChange={setCutDirty}/>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
