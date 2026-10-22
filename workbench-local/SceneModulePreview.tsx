import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { SceneTransitionSurface, type SceneTransitionOutgoing } from "./SceneTransitionSurface";
import {loadPreviewModule} from './preview-modules';
import {useCurrentFrame} from 'remotion';
import {usePreviewDiagnostics} from './preview-diagnostics';
class Boundary extends React.Component<
  {
    children: React.ReactNode;
    fallbackUrl?: string;
    onReady?: () => void;
    onError?: (message: string) => void;
  },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  componentDidCatch(e: Error) {
    this.props.onError?.(e.message);
  }
  render() {
    return this.state.error ? (
      <div>
        <p className="error">场景预览失败：{this.state.error}</p>
        {this.props.fallbackUrl && (
          <video
            controls
            src={this.props.fallbackUrl}
            style={{ width: "100%" }}
          />
        )}
      </div>
    ) : (
      this.props.children
    );
  }
}
type PreviewSurfaceProps = {
  renderer: React.ComponentType<any>;
  scene: any;
  includeAudio?: boolean;
  outgoing?: SceneTransitionOutgoing;
  onReady?: () => void;
};
function PreviewSurface({onReady,...props}: PreviewSurfaceProps) {
  const frame=useCurrentFrame();
  useEffect(()=>{onReady?.();},[]);
  return <><span hidden data-preview-frame={frame} data-preview-scene={props.scene.id}/><SceneTransitionSurface {...props}/></>;
}
function PreviewFailure({error,onError,fallbackUrl}:{error:Error;onError?:(message:string)=>void;fallbackUrl?:string}) {
  const callback=useRef(onError);callback.current=onError;
  useEffect(()=>{callback.current?.(error.message);},[error.message]);
  return <div role="alert" className="error">场景预览失败：{error.message}{fallbackUrl&&<video controls src={fallbackUrl} style={{width:'100%'}}/>}</div>;
}
export function SceneModulePreview({
  module,
  scene: sceneValue,
  outgoing: outgoingValue,
  onTime,
  seekVersion = 0,
  fallbackUrl,
  initialFrame = 0,
  onReady,
  onError,
  onSlowPreview,
  playerRef,
}: {
  module: any;
  scene: any;
  outgoing?: {module: any; scene: any; frame: number};
  seekVersion?: number;
  onTime: (seconds: number) => void;
  fallbackUrl?: string;
  initialFrame?: number;
  onReady?: () => void;
  onError?: (message: string) => void;
  onSlowPreview?:()=>void;
  playerRef?: React.RefObject<PlayerRef | null>;
}) {
  const localPlayer = useRef<PlayerRef>(null);
  const player = playerRef ?? localPlayer;
  // These are JSON scene snapshots. The parent also rerenders on frameupdate
  // and polling, so object identity alone must not change Player inputProps:
  // Remotion restarts its playback clock when its composition config changes.
  const sceneKey = JSON.stringify(sceneValue);
  const scene = useMemo(() => sceneValue, [sceneKey]);
  const outgoingSnapshotKey = JSON.stringify(outgoingValue);
  const outgoing = useMemo(() => outgoingValue, [outgoingSnapshotKey]);
  const timeCallback = useRef(onTime);
  timeCallback.current = onTime;
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const reportReady = useCallback(() => readyCallback.current?.(), []);
  const slowCallback=useRef(onSlowPreview);slowCallback.current=onSlowPreview;
  const lastPosition=useRef<{sceneId:string;frame:number;seekVersion:number;initialFrame:number}|null>(null);
  const moduleKey = module.moduleUrl + ":" + module.sourceHash;
  const outgoingKey = outgoing
    ? outgoing.module?.moduleUrl + ":" + outgoing.module?.sourceHash
    : "";
  const layerKey=JSON.stringify([...(scene.componentLayers??[]),...(outgoing?.scene?.componentLayers??[])].filter(l=>l.visualAdapter).map(l=>[l.moduleUrl,l.sourceHash,l.exportName]));
  const [layerRenderers,setLayerRenderers]=useState<Record<string,React.ComponentType<any>>>({});
  const [renderer, setRenderer] = useState<any>(),
    [outgoingRenderer, setOutgoingRenderer] = useState<any>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRenderer(undefined);
    setOutgoingRenderer(undefined);
    setError("");
    Promise.all([
      loadPreviewModule(module,"场景"),
      outgoing ? loadPreviewModule(outgoing.module,"转场退出场景") : Promise.resolve(undefined),
      Promise.all([...(scene.componentLayers??[]),...(outgoing?.scene?.componentLayers??[])].filter(l=>l.visualAdapter).map(async l=>[l.moduleUrl+':'+l.sourceHash,(await loadPreviewModule(l,'叠加资产')).component] as const)),
    ])
      .then(([nextRenderer,nextOutgoingRenderer,layers]) => {
        if (!active) return;
        setRenderer(nextRenderer);
        setOutgoingRenderer(nextOutgoingRenderer);
        setLayerRenderers(Object.fromEntries(layers));
      })
      .catch((e) => {
        if (active) {
          const message = e instanceof Error ? e.message : String(e);
          const prefixed = message.includes("转场退出场景") ? message : `场景模块加载失败：${message}`;
          setError(prefixed);
          onError?.(prefixed);
        }
      });
    return () => {
      active = false;
    };
  }, [module.moduleUrl, module.sourceHash, module.exportName, outgoingKey, outgoing?.module?.exportName,layerKey]);
  const playerDuration = Math.max(1, scene.transitionSpanFrames ?? scene.duration);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    let playing=false,lastTick=0,lastFrame=0,stalls=0,reported=false;
    const started=()=>{playing=true;lastTick=performance.now();lastFrame=p.getCurrentFrame();stalls=0;};
    const paused=()=>{playing=false;};
    const changed = (e: any) => {
      const now=performance.now(),frame=e.detail.frame;
      if(playing&&now-lastTick>150&&frame-lastFrame>4&&++stalls>=2&&!reported){reported=true;slowCallback.current?.();}
      lastTick=now;lastFrame=frame;
      lastPosition.current={sceneId:scene.id,frame,seekVersion,initialFrame};timeCallback.current((scene.from + frame) / 30);
    };
    p.addEventListener("frameupdate", changed);
    p.addEventListener('play',started);p.addEventListener('pause',paused);
    p.pause();
    const previous=lastPosition.current;
    const requested=previous&&previous.sceneId===scene.id&&previous.seekVersion===seekVersion&&previous.initialFrame===initialFrame?previous.frame:initialFrame;
    const frame = Math.min(playerDuration - 1, Math.max(0, requested));
    p.seekTo(frame);
    timeCallback.current((scene.from + frame) / 30);
    return () => {p.removeEventListener("frameupdate", changed);p.removeEventListener('play',started);p.removeEventListener('pause',paused);};
  }, [renderer, scene.id, scene.from, initialFrame, seekVersion, playerDuration]);
  const withLayers=(s:any)=>({...s,componentLayers:s.componentLayers?.map((l:any)=>({...l,...l.visualAdapter?{renderer:layerRenderers[l.moduleUrl+':'+l.sourceHash]}:{}}))});
  const outgoingInput = useMemo(() => outgoing && outgoingRenderer?.key === outgoingKey
    ? {renderer:outgoingRenderer.component,scene:withLayers(outgoing.scene),frame:outgoing.frame}
    : undefined, [outgoing, outgoingRenderer, outgoingKey, layerRenderers]);
  const inputProps = useMemo(() => ({
    renderer: renderer?.component,
    scene: withLayers(scene),
    outgoing: outgoingInput,
    includeAudio: true,
    onReady: reportReady,
  }), [renderer, scene, outgoingInput, layerRenderers, reportReady]);
  const host=useRef<HTMLDivElement>(null);
  const ready=renderer?.key === moduleKey && (!outgoing || !!outgoingInput);
  const diagnostics=usePreviewDiagnostics(host,player,moduleKey+':'+scene.id+':'+seekVersion+':'+sceneKey,module.objects??[],ready);
  return <div ref={host} style={{width:'100%',position:'relative'}}>{ready ? (
    <Boundary
      key={module.sourceHash + scene.id + outgoingKey}
      fallbackUrl={fallbackUrl}
      onReady={onReady}
      onError={onError}
    >
      <Player
        ref={player}
        component={PreviewSurface}
        inputProps={inputProps}
        errorFallback={({error})=><PreviewFailure error={error} onError={onError} fallbackUrl={fallbackUrl}/>}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        durationInFrames={playerDuration}
        controls
        clickToPlay={false}
        spaceKeyToPlayOrPause={false}
        style={{ width: "100%" }}
      />
    </Boundary>
  ) : (
    <div className="empty">
      {error || "正在加载场景…"}
      {error && fallbackUrl && (
        <video controls src={fallbackUrl} style={{ width: "100%" }} />
      )}
    </div>
  )}{diagnostics.length>0&&<div role="status" style={{position:'absolute',left:8,right:8,bottom:46,padding:'8px 10px',borderRadius:8,background:'rgba(35,25,16,.92)',color:'#ffddaa',fontSize:12,lineHeight:1.5,pointerEvents:'none'}}>{diagnostics.join('；')}</div>}</div>;
}
