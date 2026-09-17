import React, { useEffect, useRef } from "react";
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
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    p.pause();
    p.seekTo(startFrame);
    const update = (e: any) => onTime(e.detail.frame / 30);
    p.addEventListener("frameupdate", update);
    return () => p.removeEventListener("frameupdate", update);
  }, [startFrame, onTime, seekVersion]);
  return (
    <Player
      ref={player}
      component={ProductionProgram}
      inputProps={{
        ...props,
        supports: props.supports || [],
        pendingMaterials: false,
      }}
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
