import React, { useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ProductionProgram } from "./ProductionProgram";
export function LegacyProgramPreview({
  props,
  startFrame,
  onTime,
  seekVersion = 0,
}: {
  props: any;
  startFrame: number;
  seekVersion?: number;
  onTime: (t: number) => void;
}) {
  const player = useRef<PlayerRef>(null);
  const timeCallback = useRef(onTime);
  timeCallback.current = onTime;
  // Playhead updates and equivalent API snapshots are not composition edits.
  // Keep the config stable so Remotion can retain one continuous playback clock.
  const propsKey = JSON.stringify(props);
  const inputProps = useMemo(() => ({
    ...props,
    supports: props.supports || [],
    pendingMaterials: false,
  }), [propsKey]);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    p.pause();
    p.seekTo(startFrame);
    const update = (e: any) => timeCallback.current(e.detail.frame / 30);
    p.addEventListener("frameupdate", update);
    return () => p.removeEventListener("frameupdate", update);
  }, [startFrame, seekVersion]);
  return (
    <Player
      ref={player}
      component={ProductionProgram}
      inputProps={inputProps}
      durationInFrames={props.duration}
      compositionWidth={1920}
      compositionHeight={1080}
      fps={30}
      controls
      clickToPlay={false}
      style={{ width: "100%" }}
    />
  );
}
