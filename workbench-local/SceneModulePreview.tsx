import React, { useEffect, useState, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { SceneTransitionSurface, type SceneTransitionOutgoing } from "./SceneTransitionSurface";
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
  useEffect(()=>{onReady?.();},[]);
  return <SceneTransitionSurface {...props}/>;
}
function PreviewFailure({error,onError,fallbackUrl}:{error:Error;onError?:(message:string)=>void;fallbackUrl?:string}) {
  const callback=useRef(onError);callback.current=onError;
  useEffect(()=>{callback.current?.(error.message);},[error.message]);
  return <div role="alert" className="error">场景预览失败：{error.message}{fallbackUrl&&<video controls src={fallbackUrl} style={{width:'100%'}}/>}</div>;
}
export function SceneModulePreview({
  module,
  scene,
  outgoing,
  onTime,
  seekVersion = 0,
  fallbackUrl,
  initialFrame = 0,
  onReady,
  onError,
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
}) {
  const player = useRef<PlayerRef>(null);
  const moduleKey = module.moduleUrl + ":" + module.sourceHash;
  const outgoingKey = outgoing
    ? outgoing.module?.moduleUrl + ":" + outgoing.module?.sourceHash
    : "";
  const [renderer, setRenderer] = useState<any>(),
    [outgoingRenderer, setOutgoingRenderer] = useState<any>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRenderer(undefined);
    setOutgoingRenderer(undefined);
    setError("");
    const load = async (candidate:any, label:string) => {
      if (!candidate?.moduleUrl || !candidate?.exportName)
        throw Error(`${label}缺少模块入口`);
      let loaded:any;
      try {
        loaded = await import(
          /* @vite-ignore */ `${candidate.moduleUrl}?version=${candidate.sourceHash}`
        );
      } catch (e) {
        throw Error(`${label}加载失败：${e instanceof Error ? e.message : String(e)}`);
      }
      if (typeof loaded[candidate.exportName] !== "function")
        throw Error(`${label}没有可渲染入口`);
      return {component:loaded[candidate.exportName],key:candidate.moduleUrl + ":" + candidate.sourceHash};
    };
    Promise.all([
      load(module,"场景"),
      outgoing ? load(outgoing.module,"转场退出场景") : Promise.resolve(undefined),
    ])
      .then(([nextRenderer,nextOutgoingRenderer]) => {
        if (!active) return;
        setRenderer(nextRenderer);
        setOutgoingRenderer(nextOutgoingRenderer);
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
  }, [module.moduleUrl, module.sourceHash, module.exportName, outgoingKey, outgoing?.module?.exportName]);
  const playerDuration = Math.max(1, scene.transitionSpanFrames ?? scene.duration);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const changed = (e: any) => onTime((scene.from + e.detail.frame) / 30);
    p.addEventListener("frameupdate", changed);
    p.pause();
    const frame = Math.min(playerDuration - 1, Math.max(0, initialFrame));
    p.seekTo(frame);
    onTime((scene.from + frame) / 30);
    return () => p.removeEventListener("frameupdate", changed);
  }, [renderer, scene.id, scene.from, onTime, initialFrame, seekVersion, playerDuration]);
  const outgoingInput = outgoing && outgoingRenderer?.key === outgoingKey
    ? {renderer:outgoingRenderer.component,scene:outgoing.scene,frame:outgoing.frame}
    : undefined;
  return renderer?.key === moduleKey && (!outgoing || outgoingInput) ? (
    <Boundary
      key={module.sourceHash + scene.id + outgoingKey}
      fallbackUrl={fallbackUrl}
      onReady={onReady}
      onError={onError}
    >
      <Player
        ref={player}
        component={PreviewSurface}
        inputProps={{ renderer:renderer.component, scene, outgoing:outgoingInput, includeAudio: true, onReady }}
        errorFallback={({error})=><PreviewFailure error={error} onError={onError} fallbackUrl={fallbackUrl}/>}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        durationInFrames={playerDuration}
        controls
        clickToPlay={false}
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
  );
}
