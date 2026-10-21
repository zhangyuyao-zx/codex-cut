import React, {useEffect, useRef, useState} from 'react';
import {Player} from '@remotion/player';
import {ObjectProperties} from './ObjectProperties';
import {memberKey, resolveVisualValues, type ReferenceVideo, type StylePack, type VisualAsset, type VisualPreview, type VisualValue} from './visual-library-contract';
import type {SceneModuleDetail} from './scene-modules';
import type {SceneModuleInput} from './SceneModuleSurface';
import './visual-library.css';

type Scope = 'packs' | 'assets' | 'references';
type Library = {
  revision:number; assets:VisualAsset[]; packs:StylePack[]; references:ReferenceVideo[]; favorites:string[];
  active:{id:string;kind:'reference'|'preview'|'pack';subject:string}|null;
  lastTaskError?:string;
  capabilities?:{dynamicAssets?:boolean;stylePacks?:boolean;references?:boolean};
  replacementMedia?:{url:string;durationFrames:number}|null;
};
type AssetDetail = VisualAsset & {module:SceneModuleDetail;requiresSourceMedia?:boolean};
type Content = {values:Record<string,VisualValue>;durationFrames:number;cueFrames:Record<string,number>;referenceId:string};
type Draft = {content:Content;baseline:Content;saved:Content;kind:'reference'|'replacement'};
type ProductionContext = {
  plan:{revision:number;scenes:{id:string;title:string;startWordId:string;endWordId:string}[];requests?:{sceneId:string;status:string;fileName?:string;visualSlot?:{moduleId:string;slotId:string}}[]};
  resolved:{stale?:boolean;issues?:string[];scenes:{id:string;startMs:number|null;endMs:number|null}[];words:{sourceId:string;text:string;startMs:number;endMs:number}[]};
};
type PackCheck = {key:string;revision:number;affected:unknown[];conflicts:unknown[]};
const statusLabel = {draft:'候选',review:'待审阅',ready:'可用',archived:'已归档'};
const stageLabel:Record<ReferenceVideo['stage'],string> = {imported:'已导入，待准备',preparing:'正在准备',analysis:'待分析',authoring:'待提炼',review:'待审阅',complete:'已完成',failed:'准备失败'};
const errorText = (error:unknown) => error instanceof Error ? error.message : String(error);
const stamp = (ms:number) => `${Math.floor(ms/60000)}:${(ms/1000%60).toFixed(1).padStart(4,'0')}`;
const mediaUrl = (reference:ReferenceVideo,file=reference.proxy??reference.fileName) => `/api/visual-library/media/references/${encodeURIComponent(reference.id)}/${encodeURIComponent(file)}`;
const assetIdentity = (asset:VisualAsset) => `${memberKey(asset)}:${asset.sourceHash}`;
const same = (a:unknown,b:unknown) => JSON.stringify(a)===JSON.stringify(b);
const latestGood = (asset:VisualAsset) => [...asset.previews].reverse().find(p=>p.status==='done'&&p.sourceHash===asset.sourceHash&&p.url);

function applicationValues(asset:VisualAsset,draft:Draft):Record<string,VisualValue> {
  return Object.fromEntries(Object.entries(draft.content.values).filter(([parameter,value])=>
    !Object.hasOwn(asset.styleBindings,parameter)||!same(value,draft.baseline.values[parameter])));
}

function sceneMaterials(asset:VisualAsset,production:ProductionContext|null,sceneId:string):SceneModuleInput['materials'] {
  return asset.mediaSlots.flatMap(slot=>{
    const request=production?.plan.requests?.find(request=>request.sceneId===sceneId&&request.status==='provided'&&request.fileName&&request.visualSlot?.moduleId===asset.moduleId&&request.visualSlot.slotId===slot.id);
    if(!request?.fileName)return [];
    const kind=/\.(png|jpe?g|webp)$/i.test(request.fileName)?'image' as const:'video' as const;
    if(slot.kind!=='either'&&slot.kind!==kind)return [];
    return [{id:slot.id,src:'/production-media/assets/'+encodeURIComponent(request.fileName),kind}];
  });
}

function initialContent(asset:VisualAsset):Content {
  const sourceFrames=asset.source.kind==='reference'?Math.floor((asset.source.endMs-asset.source.startMs)*30/1000):150;
  const durationFrames=Math.max(asset.constraints.minFrames,Math.min(asset.constraints.maxFrames,sourceFrames));
  return {values:structuredClone(resolveVisualValues(asset.controls,asset.sampleValues)),durationFrames,
    cueFrames:Object.fromEntries(asset.cues.map((cue,index)=>[cue.id,Math.min(durationFrames-1,Math.floor(index*durationFrames/Math.max(1,asset.cues.length)))])),
    referenceId:asset.source.kind==='reference'?asset.source.referenceId:''};
}

function createAssetDraft(asset:VisualAsset):{draft:Draft;restored:boolean;exactCueFrames:boolean} {
  const baseline=initialContent(asset),preview=latestGood(asset);
  const savedCues=preview&&'cueFrames' in preview?preview.cueFrames as Record<string,number>|undefined:undefined;
  const savedReference=preview&&'referenceId' in preview&&typeof preview.referenceId==='string'?preview.referenceId:undefined;
  const content:Content=preview?{
    values:structuredClone(resolveVisualValues(asset.controls,preview.values)),durationFrames:preview.durationFrames,
    cueFrames:structuredClone(savedCues??baseline.cueFrames),
    referenceId:asset.source.kind==='reference'?asset.source.referenceId:savedReference??baseline.referenceId,
  }:structuredClone(baseline);
  return {draft:{baseline,content,saved:structuredClone(content),kind:preview?.kind??'reference'},restored:!!preview,exactCueFrames:!!savedCues};
}

function validateContent(asset:VisualAsset,content:Content,kind:'reference'|'replacement'):string {
  try {
    resolveVisualValues(asset.controls,content.values);
    if(!Number.isInteger(content.durationFrames)||content.durationFrames<asset.constraints.minFrames||content.durationFrames>asset.constraints.maxFrames)
      throw Error(`预览时长需在 ${asset.constraints.minFrames}–${asset.constraints.maxFrames} 帧之间`);
    if(kind==='reference'&&asset.source.kind==='reference'&&content.durationFrames>Math.floor((asset.source.endMs-asset.source.startMs)*30/1000))
      throw Error('原效果预览不能超过资产记录的来源片段，请缩短时长。');
    for(const cue of asset.cues) {
      const frame=content.cueFrames[cue.id];
      if(frame===undefined&&!cue.required)continue;
      if(!Number.isInteger(frame)||frame<0||frame>=content.durationFrames)throw Error(`请为「${cue.label}」填写预览范围内的出现帧`);
    }
    return '';
  }catch(error){return errorText(error);}
}

function FrameInput({label,value,min=0,max,onChange}:{label:string;value:number;min?:number;max:number;onChange:(value:number)=>void}) {
  const [text,setText]=useState(String(value)),[invalid,setInvalid]=useState(false);
  useEffect(()=>{setText(String(value));setInvalid(false);},[value]);
  return <label className="vl-frame-input"><span>{label}</span><input type="number" min={min} max={max} step={1} value={text} aria-invalid={invalid}
    onChange={event=>{const number=event.target.valueAsNumber;setText(event.target.value);const valid=Number.isInteger(number)&&number>=min&&number<=max;setInvalid(!valid);if(valid)onChange(number);}}/>
    {invalid&&<small role="status">请输入 {min}–{max} 的整数；当前输入尚未应用。</small>}</label>;
}

class PreviewBoundary extends React.Component<{children:React.ReactNode},{error:string}> {
  state={error:''};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<div className="vl-empty" role="alert"><strong>实时预览暂不可用</strong><p>{this.state.error}</p><small>下方已生成的成功样片仍可观看。</small></div>:this.props.children;}
}

function AssetPlayer({detail,content,reference,validation,kind,replacementMedia,attempt,materials}:{detail:AssetDetail;content:Content;reference?:ReferenceVideo;validation:string;kind:'reference'|'replacement';replacementMedia?:Library['replacementMedia'];attempt:number;materials:SceneModuleInput['materials']}) {
  const key=assetIdentity(detail)+':'+detail.module.sourceHash+':'+attempt;
  const [loaded,setLoaded]=useState<{key:string;component:React.ComponentType<SceneModuleInput>}|null>(null);
  const [failure,setFailure]=useState<{key:string;message:string}|null>(null);
  useEffect(()=>{
    let current=true;
    void import(/* @vite-ignore */ `${detail.module.moduleUrl}?version=${encodeURIComponent(detail.module.sourceHash)}&attempt=${attempt}`)
      .then(module=>{if(typeof module[detail.module.exportName]!=='function')throw Error('资产没有可播放的组件入口');if(current){setLoaded({key,component:module[detail.module.exportName]});setFailure(null);}})
      .catch(error=>{if(current)setFailure({key,message:errorText(error)});});
    return ()=>{current=false;};
  },[key,detail.module.moduleUrl,detail.module.exportName]);
  const missingSlots=detail.mediaSlots.filter(slot=>slot.required&&!materials.some(material=>material.id===slot.id));
  if(missingSlots.length)return <div className="vl-empty"><strong>目标段落仍有素材槽未绑定</strong><p>{missingSlots.map(slot=>slot.label).join('、')}</p><small>候选可先在右侧试用，补充段落素材后回来点击「刷新目标段素材」。</small></div>;
  if(validation)return <div className="vl-empty" role="status"><strong>请补全当前参数</strong><p>{validation}</p></div>;
  if(kind==='reference'&&(detail.source.kind==='reference'||content.referenceId)&&!reference?.proxy)return <div className="vl-empty"><strong>参考视频的播放副本尚未就绪</strong><p>请到「对标与提炼」准备这条视频后继续。</p></div>;
  if(kind==='reference'&&!reference?.proxy&&detail.requiresSourceMedia)return <div className="vl-empty"><strong>当前资产需要主视频</strong><p>请在下方选择已经准备好的参考素材。</p></div>;
  if(kind==='reference'&&reference?.proxy&&content.durationFrames+(detail.source.kind==='reference'?Math.floor(detail.source.startMs*30/1000):0)>Math.floor(reference.durationMs*30/1000))return <div className="vl-empty"><strong>预览范围超过参考视频</strong><p>{detail.source.kind==='reference'?'请缩短预览时长，原效果保持固定来源。':'请缩短预览时长，或更换足够长的参考素材。'}</p></div>;
  if(kind==='replacement'&&!replacementMedia?.url&&detail.requiresSourceMedia)return <div className="vl-empty"><strong>当前资产需要主视频</strong><p>请先在剪辑页生成当前视频的连续粗剪，再查看换内容效果。</p></div>;
  if(kind==='replacement'&&replacementMedia?.url&&content.durationFrames>replacementMedia.durationFrames)return <div className="vl-empty"><strong>预览范围超过当前粗剪</strong><p>请将时长缩短到 {replacementMedia.durationFrames} 帧以内。</p></div>;
  if(failure?.key===key)return <div className="vl-empty" role="alert"><strong>资产加载失败</strong><p>{failure.message}</p></div>;
  if(loaded?.key!==key)return <div className="vl-empty" role="status">正在加载真实资产预览…</div>;
  const source=detail.source;
  const scene:SceneModuleInput={id:detail.id,title:detail.name,duration:content.durationFrames,
    from:kind==='reference'&&source.kind==='reference'?Math.floor(source.startMs*30/1000):0,parameters:content.values,words:[],
    beats:detail.cues.filter(cue=>content.cueFrames[cue.id]!==undefined).map(cue=>({wordId:cue.id,label:cue.id,frame:content.cueFrames[cue.id]})),
    materials,mediaSrc:kind==='replacement'?(replacementMedia?.url??''):(reference?.proxy?mediaUrl(reference):'')};
  return <PreviewBoundary key={key}><Player key={key} component={loaded.component} inputProps={scene} durationInFrames={content.durationFrames}
    compositionWidth={1920} compositionHeight={1080} fps={30} controls initiallyMuted loop initialFrame={Math.max(0,Math.min(content.durationFrames-1,Math.max(0,...Object.values(content.cueFrames))+24))} renderMuteButton={()=>null} renderVolumeSlider={()=>null} clickToPlay={false} style={{width:'100%',height:'100%',backgroundColor:detail.mount==='OBJECT'?detail.previewBackground:'transparent'}}
    errorFallback={({error})=><div className="vl-empty" role="alert"><strong>实时预览失败</strong><p>{error.message}</p><small>可继续编辑参数，已有样片保留在下方。</small></div>}/></PreviewBoundary>;
}

function SourceInfo({source,references}:{source:VisualAsset['source'];references:ReferenceVideo[]}) {
  return <details className="vl-source"><summary>来源与使用范围</summary>{source.kind==='authored'?<p>{source.note}</p>:<>
    <p>{references.find(reference=>reference.id===source.referenceId)?.name??'参考视频'} · {stamp(source.startMs)}–{stamp(source.endMs)}</p><p>{source.observations}</p>
  </>}</details>;
}

function checkDescription(value:unknown):string {
  if(typeof value==='string')return value;
  if(!value||typeof value!=='object')return '参数调整';
  const record=value as Record<string,unknown>;
  return [record.title??record.sceneTitle??record.sceneId,record.label??record.parameter??record.key,record.reason??record.message].filter(v=>typeof v==='string').join(' · ')||'保留当前锁定内容';
}

export function VisualLibrary({api,onDirtyChange,onOpenScene}:{api:(path:string,body?:any)=>Promise<any>;onDirtyChange:(dirty:boolean)=>void;onOpenScene:()=>void}) {
  const [library,setLibrary]=useState<Library|null>(null),[scope,setScope]=useState<Scope>('packs'),[filter,setFilter]=useState('ready'),[query,setQuery]=useState('');
  const [favoritesOnly,setFavoritesOnly]=useState(false);
  const [selection,setSelection]=useState<Record<Scope,string>>({packs:'',assets:'',references:''});
  const [drafts,setDrafts]=useState<Record<string,Draft>>({}),[detail,setDetail]=useState<AssetDetail|null>(null),[detailError,setDetailError]=useState('');
  const [error,setError]=useState(''),[connectionError,setConnectionError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState('');
  const [production,setProduction]=useState<ProductionContext|null>(null),[productionError,setProductionError]=useState(''),[targetScene,setTargetScene]=useState('');
  const [cueBindings,setCueBindings]=useState<Record<string,Record<string,string>>>({}),[selectedObject,setSelectedObject]=useState('');
  const [previewKind,setPreviewKind]=useState<'reference'|'replacement'>('reference'),[reviewNote,setReviewNote]=useState(''),[reviewPreview,setReviewPreview]=useState('');
  const [detailReload,setDetailReload]=useState(0);
  const [playlistIndex,setPlaylistIndex]=useState(0),[playlistRunning,setPlaylistRunning]=useState(false),[packCheck,setPackCheck]=useState<PackCheck|null>(null);
  const [packPlayback,setPackPlayback]=useState<'demonstration'|'members'>('demonstration');
  const apiRef=useRef(api),onDirtyRef=useRef(onDirtyChange),requestSequence=useRef(0),productionSequence=useRef(0),referenceVideo=useRef<HTMLVideoElement>(null);
  apiRef.current=api;onDirtyRef.current=onDirtyChange;
  const dirty=Object.values(drafts).some(draft=>!same(draft.content,draft.saved));
  useEffect(()=>{onDirtyRef.current(dirty);},[dirty]);
  useEffect(()=>()=>onDirtyRef.current(false),[]);
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  function acceptLibrary(next:Library){setLibrary(current=>current&&current.revision>next.revision?current:next);}
  async function refresh(){const sequence=++requestSequence.current;try{const next=await apiRef.current('visual-library');if(sequence!==requestSequence.current)return;acceptLibrary(next);setConnectionError('');}catch(error){if(sequence===requestSequence.current)setConnectionError(errorText(error));}}
  async function loadProduction(){const sequence=++productionSequence.current;try{const next=await apiRef.current('production');if(sequence!==productionSequence.current)return;setProduction(next);setProductionError('');setTargetScene(current=>next.plan.scenes.some((scene:any)=>scene.id===current)?current:next.plan.scenes.some((scene:any)=>scene.id===next.selection?.sceneId)?next.selection.sceneId:next.plan.scenes[0]?.id??'');}catch(error){if(sequence===productionSequence.current)setProductionError(errorText(error));}}
  useEffect(()=>{void refresh();void loadProduction();const timer=setInterval(()=>void refresh(),2000);return()=>{clearInterval(timer);requestSequence.current++;productionSequence.current++;};},[]);
  const asset=library?.assets.find(candidate=>memberKey(candidate)===selection.assets),pack=library?.packs.find(candidate=>memberKey(candidate)===selection.packs),reference=library?.references.find(candidate=>candidate.id===selection.references);
  const key=asset?assetIdentity(asset):'',draft=drafts[key],content=draft?.content;
  const currentDetail=asset&&detail&&assetIdentity(detail)===key?detail:null;
  useEffect(()=>{
    if(!asset)return;
    let current=true;setDetailError('');setSelectedObject('');setReviewNote('');setReviewPreview('');
    try{
      const existing=drafts[key];
      if(existing)setPreviewKind(existing.kind);
      else {
        const restored=createAssetDraft(asset);
        setDrafts(previous=>previous[key]?previous:{...previous,[key]:restored.draft});
        setPreviewKind(restored.draft.kind);
        if(restored.restored)setNotice('已恢复最近保存样片参数'+(asset.cues.length&&!restored.exactCueFrames?'；旧样片未记录事件帧，出现点使用当前示例基准，请核对。':'。'));
      }
    }catch(error){setDetailError(errorText(error));}
    void apiRef.current(`visual-library/asset/${encodeURIComponent(asset.id)}/${encodeURIComponent(asset.version)}`)
      .then(next=>{if(current)setDetail(next);}).catch(error=>{if(current)setDetailError(errorText(error));});
    return()=>{current=false;};
  },[key,detailReload]);
  useEffect(()=>{setPackCheck(null);setPlaylistIndex(0);setPlaylistRunning(false);setPackPlayback('demonstration');},[selection.packs]);
  function updateContent(patch:Partial<Content>){if(!key)return;setDrafts(previous=>{const current=previous[key];return current?{...previous,[key]:{...current,content:{...current.content,...patch,...(asset?.source.kind==='reference'?{referenceId:asset.source.referenceId}:{})}}}:previous;});}
  function changePreviewKind(kind:'reference'|'replacement'){setPreviewKind(kind);setDrafts(previous=>previous[key]?{...previous,[key]:{...previous[key],kind}}:previous);}
  function markSaved(savedKey:string,saved:Content){setDrafts(previous=>{const current=previous[savedKey];return current?{...previous,[savedKey]:{...current,saved:structuredClone(saved)}}:previous;});}
  async function action(name:string,fn:()=>Promise<void>){setBusy(name);setError('');setNotice('');try{await fn();}catch(error){setError(errorText(error));void refresh();}finally{setBusy('');}}
  function choose(nextScope:Scope,id:string){setScope(nextScope);setSelection(previous=>({...previous,[nextScope]:id}));setError('');setNotice('');if(nextScope==='assets'&&filter==='ready'&&library?.assets.find(asset=>memberKey(asset)===id)?.status!=='ready')setFilter('all');}
  const validation=asset&&content?validateContent(asset,content,previewKind):'';
  const sourceReferenceId=asset?.source.kind==='reference'?asset.source.referenceId:content?.referenceId;
  const selectedReference=library?.references.find(candidate=>candidate.id===sourceReferenceId);
  const previewDurationMax=asset?Math.min(asset.constraints.maxFrames,previewKind==='reference'&&asset.source.kind==='reference'?Math.floor((asset.source.endMs-asset.source.startMs)*30/1000):asset.constraints.maxFrames):1;
  const mappedMaterials=asset?sceneMaterials(asset,production,targetScene):[];
  const missingMaterialSlots=asset?.mediaSlots.filter(slot=>slot.required&&!mappedMaterials.some(material=>material.id===slot.id))??[];
  const mediaBlocked=!!(asset&&content&&(previewKind==='reference'?
    ((!!sourceReferenceId||!!currentDetail?.requiresSourceMedia)&&!selectedReference?.proxy)||!!selectedReference&&content.durationFrames+(asset.source.kind==='reference'?Math.floor(asset.source.startMs*30/1000):0)>Math.floor(selectedReference.durationMs*30/1000):
    (!!currentDetail?.requiresSourceMedia&&!library?.replacementMedia?.url)||!!library?.replacementMedia&&content.durationFrames>library.replacementMedia.durationFrames));
  const previews=asset?[...asset.previews].reverse():[],successful=previews.filter(preview=>preview.status==='done'&&preview.sourceHash===asset?.sourceHash);
  const reviewTarget=successful.find(preview=>preview.id===reviewPreview)??successful[0];
  const recentPreview=previews[0],bindings=cueBindings[`${key}:${targetScene}`]??{};
  const targetRange=production?.resolved.scenes.find(scene=>scene.id===targetScene);
  const targetWords=production?.resolved.words.filter(word=>targetRange?.startMs!==null&&targetRange?.startMs!==undefined&&targetRange.endMs!==null&&word.startMs>=targetRange.startMs&&word.endMs<=targetRange.endMs)??[];
  const missingBindings=asset?.cues.some(cue=>(cue.required||!!bindings[cue.id])&&!targetWords.some(word=>word.sourceId===bindings[cue.id]))??false;
  const playlist=pack?pack.members.flatMap(member=>{const item=library?.assets.find(asset=>memberKey(asset)===memberKey(member));const preview=item&&latestGood(item);return item&&preview?[{asset:item,preview}]:[];}):[];
  const playlistItem=playlist[Math.min(playlistIndex,Math.max(0,playlist.length-1))];
  const playDemonstration=!!pack?.demonstration?.url&&packPlayback==='demonstration';
  const active=library?.active;
  const items:({id:string;name:string;description:string;status:string;version?:string;tags?:string[];preview?:VisualPreview})[]=scope==='assets'?(library?.assets??[]).map(asset=>({...asset,id:memberKey(asset),preview:latestGood(asset)})):
    scope==='packs'?(library?.packs??[]).map(pack=>({...pack,id:memberKey(pack),tags:pack.coverage})):
      (library?.references??[]).map(reference=>({id:reference.id,name:reference.name,description:reference.analysis?.summary??'准备视频，分析真实画面，再由 Codex 提炼候选资产。',status:reference.stage==='complete'?'ready':'draft',tags:[stageLabel[reference.stage]]}));
  const filtered=items.filter(item=>(scope==='references'||!favoritesOnly||library?.favorites.includes(item.id))&&(filter==='all'||(filter==='ready'?item.status==='ready':item.status==='draft'||item.status==='review'))&&`${item.name} ${item.description} ${item.tags?.join(' ')??''}`.toLowerCase().includes(query.toLowerCase()));
  const favoriteMember=scope==='assets'?asset:scope==='packs'?pack:undefined;
  async function upload(file:File){await action('upload',async()=>{const result=await apiRef.current('visual-library/reference-upload?name='+encodeURIComponent(file.name),file);if(result.revision!==undefined)acceptLibrary(result);const id=result.reference?.id??result.referenceId;if(!id)throw Error('视频已上传，但尚未返回参考编号；请刷新后查看');choose('references',id);setFilter('all');const prepared=await apiRef.current('visual-library/reference-prepare',{referenceId:id});acceptLibrary(prepared);setNotice('视频已导入，正在准备播放副本与抽帧索引。');});}
  async function generate(){if(!asset||!content||!library)return;const snapshot=structuredClone(content),savedKey=key;await action('preview',async()=>{const result=await apiRef.current('visual-library/asset-preview',{expectedRevision:library.revision,member:{id:asset.id,version:asset.version},kind:previewKind,values:snapshot.values,durationFrames:snapshot.durationFrames,cueFrames:snapshot.cueFrames,...(previewKind==='reference'&&sourceReferenceId?{referenceId:sourceReferenceId}:{}),...(asset.mediaSlots.length&&targetScene?{materialSceneId:targetScene}:{})});acceptLibrary(result);markSaved(savedKey,snapshot);setNotice('预览参数已保存，样片正在生成。');});}
  async function applyAsset(){if(!asset||!content||!production||!draft)return;const snapshot=structuredClone(content),savedKey=key;
    const values=applicationValues(asset,{...draft,content:snapshot});
    await action('apply-asset',async()=>{await apiRef.current('production/visual-asset',{expectedRevision:production.plan.revision,member:{id:asset.id,version:asset.version},sceneId:targetScene,values,cueBindings:bindings,trial:asset.status!=='ready'});markSaved(savedKey,snapshot);onOpenScene();});}
  async function checkPack(){if(!pack||!production)return;await action('check-pack',async()=>{const result=await apiRef.current('production/style-pack',{expectedRevision:production.plan.revision,member:{id:pack.id,version:pack.version},mode:'preview'});setPackCheck({key:memberKey(pack),revision:production.plan.revision,affected:Array.isArray(result.affected)?result.affected:[],conflicts:Array.isArray(result.conflicts)?result.conflicts:[]});});}
  const canApplyPack=pack&&packCheck?.key===memberKey(pack)&&packCheck.revision===production?.plan.revision;
  const cueSelect=(cue:VisualAsset['cues'][number])=><label key={cue.id}>{cue.label}<select value={bindings[cue.id]??''} onChange={event=>{const wordId=event.target.value;setCueBindings(previous=>({...previous,[`${key}:${targetScene}`]:{...bindings,[cue.id]:wordId}}));}}><option value="">{cue.required?'选择真实口播词':'沿用默认错峰'}</option>{targetWords.map((word,index)=><option value={word.sourceId} key={word.sourceId}>{index+1}. {word.text} · {(word.startMs/1000).toFixed(2)}s</option>)}</select></label>;

  return <div className="visual-library library-workspace">
    <aside className="left vl-browser">
      <div className="vl-heading"><span className="eyebrow">视觉资产库</span><h2>为表达找到画面</h2><p>按用途挑选资产，在真实段落中检验。</p></div>
      <nav className="vl-scopes" aria-label="资源范围">{([['packs','风格包'],['assets','单项资产'],['references','对标与提炼']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={scope===value} onClick={()=>setScope(value)}>{label}</button>)}</nav>
      <label className="vl-search"><span className="sr-only">按表达用途搜索</span><input type="search" placeholder="搜索用途、画面关系或名称" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <div className="vl-filters" aria-label="资产状态">{[['ready','可用'],['candidate','候选'],['all','全部']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
      {scope==='references'&&<label className="vl-upload">{busy==='upload'?'正在导入视频…':'＋ 导入对标视频'}<input aria-label="导入对标视频" type="file" accept="video/*,.mkv,.mov" disabled={!!busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void upload(file);}}/></label>}
      <div className="vl-resource-list" aria-label="资源列表">
        {!library?<div className="vl-list-empty" role="status">{connectionError||'正在读取资产库…'}</div>:!filtered.length?<div className="vl-list-empty"><strong>{query?'没有找到匹配用途的资源':filter==='ready'?'这里还没有可用资源':'这里还没有资源'}</strong><p>{scope==='references'?'导入真实视频，准备后交给 Codex 分析与提炼。':filter==='ready'?'可以查看候选，试用后再确认具体版本。':'请让 Codex 为当前内容制作资产，或先从对标视频提炼。'}</p>{filter==='ready'&&<button onClick={()=>setFilter('candidate')}>查看候选</button>}</div>:
          filtered.map(item=><button className={'vl-resource-card '+(selection[scope]===item.id?'selected':'')} key={item.id} aria-pressed={selection[scope]===item.id} onClick={()=>choose(scope,item.id)}>
            <span className="vl-card-top"><span className={'vl-badge '+(item.status==='ready'?'ready':'')}>{statusLabel[item.status as keyof typeof statusLabel]??item.status}</span>{item.version&&<small>v{item.version}</small>}</span><strong>{item.name}</strong><p>{item.description}</p><span className="vl-card-tags">{item.tags?.slice(0,3).join(' · ')}</span>
            {item.preview&&<span className="vl-preview-available">已有实际样片</span>}
          </button>)}
      </div>
      {dirty&&<p className="vl-draft-note">未保存的参数保留在本次会话中，可切换资源后继续编辑。</p>}
    </aside>

    <main className="production-center vl-center">
      {scope!=='references'&&<div className="vl-action-row"><button type="button" aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(value=>!value)}>{favoritesOnly?'显示全部资源':'只看收藏'}</button>{favoriteMember&&<button type="button" disabled={!!busy} onClick={()=>void action('favorite',async()=>{acceptLibrary(await apiRef.current('visual-library/favorite',{expectedRevision:library!.revision,member:{id:favoriteMember.id,version:favoriteMember.version},favorite:!library!.favorites.includes(memberKey(favoriteMember))}));})}>{library?.favorites.includes(memberKey(favoriteMember))?'★ 已收藏':'☆ 收藏'}</button>}</div>}
      <div className="vl-center-heading"><div><span className="eyebrow">{scope==='packs'?'风格与覆盖范围':scope==='assets'?'真实效果预览':'参考视频与观察'}</span><h2>{scope==='packs'?(pack?.name??'选择一套视觉语言'):scope==='assets'?(asset?.name??'挑选适合表达的效果'):(reference?.name??'从真实画面开始')}</h2></div><button type="button" onClick={()=>{void refresh();if(scope==='assets')setDetailReload(reload=>reload+1);}}>刷新</button></div>
      {connectionError&&<p className="vl-alert" role="status">连接暂时中断：{connectionError}。已读取的内容继续保留。</p>}
      {error&&<p className="vl-alert error" role="alert">{error}</p>}{notice&&<p className="vl-notice" role="status">{notice}</p>}
      {library?.lastTaskError&&<p className="vl-alert error" role="alert">上次后台任务：{library.lastTaskError}</p>}
      {active&&!(scope==='assets'&&asset&&active.kind==='preview'&&active.subject===memberKey(asset))&&!(scope==='references'&&reference&&active.kind==='reference'&&active.subject===reference.id)&&!(scope==='packs'&&pack&&active.kind==='pack'&&active.subject===memberKey(pack))&&<p className="vl-notice" role="status">{active.kind==='preview'?'正在生成另一个资产的样片。':active.kind==='pack'?'正在生成另一个风格包的连续演示。':'正在准备另一条参考视频。'}<button className="vl-text-button" onClick={()=>choose(active.kind==='preview'?'assets':active.kind==='pack'?'packs':'references',active.subject)}>查看进度</button></p>}
      {scope==='assets'&&asset?<>
        <div className="vl-preview" onClick={e=>{const id=(e.target as Element).closest('[data-editable-object]')?.getAttribute('data-editable-object');if(id&&asset.objects.some(o=>o.id===id))setSelectedObject(id);}}>{detailError?<div className="vl-empty" role="alert">{detailError}</div>:currentDetail&&content?<AssetPlayer detail={currentDetail} content={content} reference={selectedReference} validation={validation} kind={previewKind} replacementMedia={library?.replacementMedia} attempt={detailReload} materials={mappedMaterials}/>:<div className="vl-empty" role="status">正在读取资产…</div>}</div>
        <div className="vl-preview-caption"><span>16:9 · 资产效果静音预览</span><span>口播原声在目标段落中处理</span></div>
        <p className="vl-description">{asset.description}</p>
        {content&&<div className="vl-preview-settings"><FrameInput label="时长（帧，30 帧/秒）" value={content.durationFrames} min={asset.constraints.minFrames} max={previewDurationMax} onChange={durationFrames=>updateContent({durationFrames})}/>
          <label>样片用途<select value={previewKind} onChange={event=>changePreviewKind(event.target.value as 'reference'|'replacement')}><option value="reference">原效果检查</option><option value="replacement">换内容复用检查</option></select></label>
          {previewKind==='reference'?(asset.source.kind==='reference'?<div className="vl-fixed-reference"><span>原效果来源已固定</span><strong>{selectedReference?.name??asset.source.referenceId}</strong><small>{stamp(asset.source.startMs)}–{stamp(asset.source.endMs)} · 最多 {previewDurationMax} 帧，不可改选其他参考。</small></div>:<label>原效果参考素材<select value={content.referenceId} onChange={event=>updateContent({referenceId:event.target.value})}><option value="">不使用参考视频</option>{library?.references.map(reference=><option value={reference.id} key={reference.id}>{reference.name}{reference.proxy?'':'（待准备）'}</option>)}</select></label>):<p className="vl-muted">{library?.replacementMedia?.url?'换内容使用当前视频的连续粗剪，从第 0 帧开始。':'当前还没有可用的连续粗剪；无需主视频的资产仍可检查自身效果。'}</p>}
        </div>}
        {asset.mediaSlots.length>0&&<div className="vl-material-summary"><span>预览补充素材来自右侧所选目标段落。</span><button className="vl-text-button" onClick={()=>void loadProduction()}>刷新目标段素材</button>{missingMaterialSlots.length>0&&<small>尚缺：{missingMaterialSlots.map(slot=>slot.label).join('、')}。可先试用候选并补素材，无需提前入库。</small>}</div>}
        <div className="vl-action-row"><button className="primary" disabled={!!busy||!!active||!content||!currentDetail||!!validation||mediaBlocked||asset.status==='archived'||missingMaterialSlots.length>0} onClick={()=>void generate()}>保存并生成样片</button>{active?.kind==='preview'&&active.subject===memberKey(asset)&&<button disabled={!!busy} onClick={()=>void action('cancel',async()=>{await apiRef.current('visual-library/cancel',{jobId:active.id});setNotice('正在停止本次生成，已有成功样片保留。');})}>停止生成</button>}</div>
        {recentPreview&&recentPreview.status!=='done'&&<div className="vl-job" role="status"><span>{recentPreview.status==='rendering'?`正在生成 · ${Math.round(recentPreview.progress*100)}%`:recentPreview.status==='cancelled'?'本次生成已取消':'本次生成失败'}</span>{recentPreview.status==='rendering'&&<progress max={1} value={recentPreview.progress}/>} {recentPreview.error&&<p>{recentPreview.error}</p>}</div>}
        <section className="vl-section"><h3>已生成的成功样片</h3>{!successful.length?<p className="vl-muted">尚无成功样片。实时预览不等同于已生成或已审阅的版本。</p>:<>
          <label>选择样片<select value={reviewTarget?.id??''} onChange={event=>setReviewPreview(event.target.value)}>{successful.map((preview,index)=><option value={preview.id} key={preview.id}>{preview.kind==='reference'?'原效果':'换内容'} · {new Date(preview.createdAt).toLocaleString()} {index===0?'· 最新成功':''}</option>)}</select></label>
          {reviewTarget&&<><div className="vl-preview"><video key={reviewTarget.id} src={reviewTarget.url} controls muted onError={()=>setError('这条样片暂时无法播放，可选择其他成功版本或重试。')}/></div><p className="vl-muted">静音样片 · {reviewTarget.durationFrames} 帧。此视频保留生成时的参数。</p></>}
          <label>本次检查记录<textarea placeholder="记录实际看到的效果、换内容后的适配情况" value={reviewNote} maxLength={4000} onChange={event=>setReviewNote(event.target.value)}/></label>
          <div className="vl-action-row"><button disabled={!!busy||!reviewTarget||!reviewNote.trim()} onClick={()=>void action('review',async()=>{const next=await apiRef.current('visual-library/asset-review',{expectedRevision:library!.revision,member:{id:asset.id,version:asset.version},review:{previewId:reviewTarget!.id,kind:reviewTarget!.kind==='replacement'?'reuse':'visual',note:reviewNote.trim()}});acceptLibrary(next);setReviewNote('');setNotice('检查记录已保存。');})}>{reviewTarget?.kind==='replacement'?'记录复用检查':'记录视觉检查'}</button>
            {asset.status!=='ready'&&asset.status!=='archived'&&<button disabled={!!busy} onClick={()=>void action('ready',async()=>{const next=await apiRef.current('visual-library/asset-status',{expectedRevision:library!.revision,member:{id:asset.id,version:asset.version},status:'ready',userConfirmed:true});acceptLibrary(next);setNotice('当前资产版本已标记为可用。');})}>确认此版本可用</button>}</div>
        </>}</section>
        <SourceInfo source={asset.source} references={library?.references??[]}/>
      </>:scope==='packs'&&pack?<>
        <div className="vl-pack-playback" aria-label="风格包播放内容"><button disabled={!pack.demonstration?.url} aria-pressed={playDemonstration} onClick={()=>{setPackPlayback('demonstration');setPlaylistRunning(false);}}>连续演示</button><button disabled={!playlist.length} aria-pressed={!playDemonstration&&!!playlist.length} onClick={()=>setPackPlayback('members')}>成员样片</button></div>
        <div className="vl-preview">{playDemonstration?<video key={pack.demonstration!.id} src={pack.demonstration!.url} controls muted onError={()=>setError('连续演示暂时无法播放，可切换成员样片或重新生成。')}/>:playlistItem?<video key={playlistItem.preview.id} src={playlistItem.preview.url} controls muted autoPlay={playlistRunning} onPlay={()=>setPlaylistRunning(true)} onEnded={()=>{if(playlistIndex+1<playlist.length)setPlaylistIndex(index=>index+1);else{setPlaylistRunning(false);setPlaylistIndex(0);}}} onError={()=>setError('这条成员样片暂时无法播放，可切换其他成员。')}/>:<div className="vl-empty"><strong>尚无真实连续演示</strong><p>先生成符合风格参数的成员样片，再生成整包演示。</p></div>}</div>
        <div className="vl-preview-caption"><span>{playDemonstration?`真实连续演示 · ${new Date(pack.demonstration!.createdAt).toLocaleString()}`:playlistItem?`${playlistItem.asset.name} · ${playlistIndex+1}/${playlist.length}`:'16:9 · 样片区域'}</span><span>{playDemonstration?'已生成视频 · 静音':'成员样片顺序播放 · 非连续演示'}</span></div>
        {!playDemonstration&&playlist.length>1&&<div className="vl-action-row">{playlist.map((item,index)=><button key={item.preview.id} aria-pressed={playlistIndex===index} onClick={()=>{setPackPlayback('members');setPlaylistIndex(index);}}>{item.asset.name}</button>)}</div>}
        <div className="vl-action-row"><button className="primary" disabled={!!busy||!!active||pack.status==='archived'} onClick={()=>void action('pack-preview',async()=>{acceptLibrary(await apiRef.current('visual-library/pack-preview',{expectedRevision:library!.revision,member:{id:pack.id,version:pack.version}}));setPackPlayback('demonstration');setPlaylistRunning(false);setNotice('正在生成真实连续演示；已有成功演示和成员样片保留。');})}>{pack.demonstration?'重新生成连续演示':'生成连续演示'}</button>{active?.kind==='pack'&&active.subject===memberKey(pack)&&<button disabled={!!busy} onClick={()=>void action('cancel-pack',async()=>{await apiRef.current('visual-library/cancel',{jobId:active.id});setNotice('正在停止连续演示生成；已有成功视频保留。');})}>停止生成演示</button>}</div>
        {active?.kind==='pack'&&active.subject===memberKey(pack)&&<div className="vl-job" role="status">正在合成此风格包的真实连续演示…</div>}
        {!pack.demonstration?.url&&<p className="vl-muted">成员列表和独立样片不等于整包完成；先生成并观看连续演示，再确认此版本可用。</p>}
        <p className="vl-description">{pack.description}</p>
        <div className="vl-pack-details">{([['文字与字体',pack.typography],['运动节奏',pack.motion],['构图关系',pack.composition],['声音方向',pack.sound]] as const).filter(([,text])=>text).map(([label,text])=><section key={label}><h3>{label}</h3><p>{text}</p></section>)}</div>
        <section className="vl-section"><h3>适用表达</h3><div className="vl-tags">{pack.coverage.map(text=><span key={text}>{text}</span>)}</div>{pack.limitations.length>0&&<><h3>使用限制</h3><ul>{pack.limitations.map(text=><li key={text}>{text}</li>)}</ul></>}</section>
        <section className="vl-section"><h3>包内资产 · 固定版本</h3><div className="vl-member-list">{pack.members.map(member=>{const asset=library?.assets.find(asset=>memberKey(asset)===memberKey(member));return <button key={memberKey(member)} onClick={()=>choose('assets',memberKey(member))}><strong>{asset?.name??member.id}</strong><span>v{member.version} · {asset?statusLabel[asset.status]:'暂不可用'}</span><span>打开真实效果 →</span></button>;})}</div></section>
        <SourceInfo source={pack.source} references={library?.references??[]}/>
      </>:scope==='references'&&reference?<>
        <div className="vl-preview"><video ref={referenceVideo} key={reference.id+':'+reference.proxy} src={mediaUrl(reference)} controls onError={()=>setError('当前视频暂时无法播放；可点击「准备播放副本与抽帧」后重试。')}/></div>
        <div className="vl-preview-caption"><span>{stamp(reference.durationMs)} · {reference.width} × {reference.height}</span><span>{stageLabel[reference.stage]}</span></div>
        {reference.stage==='preparing'&&<div className="vl-job" role="status"><span>准备中 · {Math.round(reference.progress*100)}%</span><progress max={1} value={reference.progress}/></div>}
        {reference.error&&<p className="vl-alert error" role="alert">{reference.error}</p>}
        <div className="vl-action-row"><button disabled={!!busy||!!active} onClick={()=>void action('prepare',async()=>{const next=await apiRef.current('visual-library/reference-prepare',{referenceId:reference.id});acceptLibrary(next);})}>{reference.proxy?'重新准备视频':'准备播放副本与抽帧'}</button>{active?.kind==='reference'&&active.subject===reference.id&&<button disabled={!!busy} onClick={()=>void action('cancel-reference',async()=>{await apiRef.current('visual-library/cancel',{jobId:active.id});setNotice('正在停止视频准备。');})}>停止准备</button>}</div>
        {reference.frames.length>0&&<section className="vl-section"><h3>抽帧索引 · {reference.frames.length} 帧</h3><p className="vl-muted">用于定位片段，不代表已完整观看、分析或提炼。</p><div className="vl-frame-grid">{reference.frames.slice(0,12).map(frame=><button key={frame.fileName} onClick={()=>{if(referenceVideo.current){referenceVideo.current.currentTime=frame.timeMs/1000;referenceVideo.current.pause();}}}><img src={mediaUrl(reference,frame.fileName)} alt={`参考视频 ${stamp(frame.timeMs)} 的抽帧`} loading="lazy"/><span>{stamp(frame.timeMs)}</span></button>)}</div>{reference.frames.length>12&&<p className="vl-muted">此处显示前 12 帧，其余可由 Codex 继续读取。</p>}</section>}
        {reference.analysis?<section className="vl-section"><h3>已记录的观察</h3><p>{reference.analysis.summary}</p><p>{reference.analysis.style}</p><p className="vl-muted">画面：{reference.analysis.visualInspected?'已记录实际检查':'尚未实际检查'} · 声音：{reference.analysis.audioInspected?'已记录实际检查':'尚未实际检查'}</p><div className="vl-analysis-segments">{reference.analysis.segments.map(segment=><article key={segment.id}><button onClick={()=>{if(referenceVideo.current){referenceVideo.current.currentTime=segment.startMs/1000;referenceVideo.current.pause();}}}>{stamp(segment.startMs)}–{stamp(segment.endMs)}</button><h4>{segment.purpose}</h4><p>{segment.observations}</p><p>运动：{segment.motion}</p>{segment.trigger&&<p>触发：{segment.trigger}</p>}{segment.dependencies.length>0&&<p>依赖：{segment.dependencies.join('、')}</p>}</article>)}</div>{reference.analysis.uncertainties.length>0&&<><h4>仍待核实</h4><ul>{reference.analysis.uncertainties.map(text=><li key={text}>{text}</li>)}</ul></>}</section>:<div className="vl-section"><h3>下一步：实际观看与提炼</h3><p>准备视频不会自动完成分析。将右侧指令交给 Codex，记录片段、画面职责与不确定项后，再制作候选资产。</p></div>}
      </>:<div className="vl-preview vl-welcome"><div className="vl-empty"><span className="vl-welcome-mark">◈</span><strong>{scope==='packs'?'让整片保持统一的视觉语言':scope==='assets'?'从表达任务挑选真实效果':'从真实参考开始提炼'}</strong><p>{scope==='packs'?'选择风格包，查看它覆盖的表达与已有成员样片。':scope==='assets'?'选择资产，调参数、看真实效果，再绑定到口播段落。':'导入视频，准备播放副本，再由 Codex 实际观察与制作。'}</p><small>资产库为空时不会自动填入示例内容。</small></div></div>}
    </main>

    <aside className="right vl-inspector">
      {scope==='assets'&&asset&&content?<>
        <div className="vl-inspector-title"><h3>参数与应用</h3><span className={'vl-badge '+(asset.status==='ready'?'ready':'')}>{statusLabel[asset.status]}</span></div>
        <div className="vl-action-row"><button disabled={same(content,draft.saved)} onClick={()=>setDrafts(previous=>({...previous,[key]:{...previous[key],content:structuredClone(previous[key].saved)}}))}>丢弃未保存修改</button><button onClick={()=>{try{updateContent(initialContent(asset));}catch(error){setError(errorText(error));}}}>恢复示例参数</button></div>
        <ObjectProperties editor={{objects:asset.objects,controls:asset.controls}} selected={selectedObject} values={content.values} locks={[]} onSelect={setSelectedObject} onChange={(parameter,value)=>updateContent({values:{...content.values,[parameter]:value as VisualValue}})}/>
        {asset.cues.length>0&&<details className="vl-section"><summary>样片时机（高级）</summary><p className="vl-muted">这些是预览出现点；应用到段落时改绑真实文稿词。</p>{asset.cues.map(cue=><FrameInput key={cue.id} label={cue.label+(cue.required?'':'（可选）')} value={content.cueFrames[cue.id]??0} max={content.durationFrames-1} onChange={frame=>updateContent({cueFrames:{...content.cueFrames,[cue.id]:frame}})}/>)}</details>}
        <section className="vl-section"><h3>应用到当前视频</h3><button className="vl-text-button" onClick={()=>void loadProduction()}>刷新段落与文稿</button>{productionError&&<p className="error" role="alert">{productionError}</p>}
          {production?.plan.scenes.length?<><label>目标段落<select value={targetScene} onChange={event=>setTargetScene(event.target.value)}>{production.plan.scenes.map(scene=><option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label>
            {asset.cues.filter(cue=>cue.required).map(cueSelect)}
            {asset.cues.some(cue=>!cue.required)&&<details className="vl-section"><summary>逐项口播对齐（可选）</summary><p className="vl-muted">可为每个动作另选触发词；不指定时使用资产的默认错峰。</p>{asset.cues.filter(cue=>!cue.required).map(cueSelect)}</details>}
            {asset.mediaSlots.length>0&&<section className="vl-slot-status"><h4>目标段落补充素材</h4>{asset.mediaSlots.map(slot=>{const mapped=mappedMaterials.find(material=>material.id===slot.id);return <div key={slot.id}><span>{slot.label}{slot.required?'（必需）':''}</span><strong className={mapped?'provided':''}>{mapped?'已绑定真实文件':slot.required?'尚未提供':'可选，未绑定'}</strong></div>;})}<button className="vl-text-button" onClick={()=>void loadProduction()}>刷新目标段素材</button><p className="vl-muted">先试用候选 → 到段落补素材 → 回库刷新并预览 → 记录检查 → 用户选定可用。</p></section>}
            {production.resolved.stale&&<p className="vl-alert">粗剪已变化，请先同步方案后应用。</p>}
            {missingBindings&&<p className="vl-muted">请为必需事件选择当前段落中的真实词；失效的旧绑定也需重新选择。</p>}
            <button className="primary vl-apply" disabled={!!busy||!!validation||missingBindings||!targetScene||production.resolved.stale||asset.status==='archived'} onClick={()=>void applyAsset()}>{asset.status==='ready'?'添加到段落':'在段落中试用'}</button>
          </>:<p className="vl-muted">当前还没有可绑定的视觉段落。先在包装页建立段落后继续。</p>}
        </section>
      </>:scope==='packs'&&pack?<>
        <div className="vl-inspector-title"><h3>将风格应用到方案</h3><span className={'vl-badge '+(pack.status==='ready'?'ready':'')}>{statusLabel[pack.status]}</span></div><p className="vl-muted">先查看会影响哪些段落。用户已锁定的参数会保留。</p>
        <button onClick={()=>void loadProduction()}>刷新当前方案</button>{productionError&&<p className="error">{productionError}</p>}
        <button className="primary vl-apply" disabled={!!busy||!production?.plan.scenes.length||pack.status==='archived'} onClick={()=>void checkPack()}>预览应用范围</button>
        {canApplyPack&&packCheck&&<section className="vl-section"><h3>将调整 {packCheck.affected.length} 项</h3>{packCheck.affected.length>0?<ul>{packCheck.affected.map((item,index)=><li key={index}>{checkDescription(item)}</li>)}</ul>:<p className="vl-muted">当前方案没有匹配的可调整参数。</p>}{packCheck.conflicts.length>0&&<><h4>保留的内容与冲突</h4><ul>{packCheck.conflicts.map((item,index)=><li key={index}>{checkDescription(item)}</li>)}</ul></>}
          <button className="primary vl-apply" disabled={!!busy||!packCheck.affected.length} onClick={()=>void action('apply-pack',async()=>{await apiRef.current('production/style-pack',{expectedRevision:production!.plan.revision,member:{id:pack.id,version:pack.version},mode:'apply'});onOpenScene();})}>{pack.status==='ready'?'确认应用风格包':'试用此候选风格包'}</button></section>}
        {pack.status==='draft'&&<section className="vl-section"><p className="vl-muted">试用不等于入库。包内各资产通过检查并已生成连续演示后，可明确确认这个风格版本。</p>{!pack.demonstration?.url&&<p className="vl-muted">尚未生成真实连续演示，暂不能确认入库。</p>}{pack.members.some(member=>library?.assets.find(a=>memberKey(a)===memberKey(member))?.status!=='ready')&&<p className="vl-muted">先选定要保留的成员资产，再确认整套风格。</p>}<button disabled={!!busy||!pack.demonstration?.url||pack.members.some(member=>library?.assets.find(a=>memberKey(a)===memberKey(member))?.status!=='ready')} onClick={()=>void action('ready-pack',async()=>{acceptLibrary(await apiRef.current('visual-library/pack-status',{expectedRevision:library!.revision,member:{id:pack.id,version:pack.version},status:'ready',userConfirmed:true}));setNotice('当前风格包版本已标记为可用。');})}>确认此风格包可用</button></section>}
      </>:scope==='references'&&reference?<>
        <h3>继续提炼</h3><p>把这条指令交给 Codex，继续查看实际画面、记录表达机制并制作候选。</p><div className="vl-command">请提炼参考视频 {reference.id}</div><button onClick={()=>void action('copy',async()=>{await navigator.clipboard.writeText('请提炼参考视频 '+reference.id);setNotice('提炼指令已复制。');})}>复制指令</button>
        <section className="vl-section"><h3>当前进展</h3><p>{stageLabel[reference.stage]}</p><p className="vl-muted">播放副本与抽帧属于素材准备；观察记录、候选实现和实际审阅分别完成。</p></section>
        <section className="vl-section"><h3>已提炼的资产</h3>{library?.assets.filter(asset=>asset.status!=='archived'&&asset.source.kind==='reference'&&asset.source.referenceId===reference.id).map(asset=><button className="vl-related" key={memberKey(asset)} onClick={()=>choose('assets',memberKey(asset))}>{asset.name} · v{asset.version}<span>{statusLabel[asset.status]} →</span></button>)}{!library?.assets.some(asset=>asset.source.kind==='reference'&&asset.source.referenceId===reference.id)&&<p className="vl-muted">尚无候选资产。此处不会把抽帧自动当成完成提炼。</p>}</section>
      </>:<div className="vl-inspector-empty"><h3>{scope==='references'?'提炼与进展':'参数与应用'}</h3><p>从左侧选择资源后，在这里查看可调整参数和应用范围。</p></div>}
    </aside>
  </div>;
}
