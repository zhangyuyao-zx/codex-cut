import React from "react";
import {AbsoluteFill, Freeze, useCurrentFrame} from "remotion";
import {SceneModuleSurface, type SceneModuleInput} from "./SceneModuleSurface";
import {transitionProgress} from "./scene-transition";

export type SceneTransitionOutgoing = {
  renderer: React.ComponentType<any>;
  scene: SceneModuleInput;
  frame: number;
};

export function resolveOutgoingFreezeFrame(frame: number, fallbackSpanFrames: number): number {
  return Number.isFinite(frame)
    ? Math.max(0, Math.floor(frame))
    : Math.max(0, Math.floor(fallbackSpanFrames) - 1);
}

export function SceneTransitionSurface({
  renderer,
  scene,
  outgoing,
  includeAudio = false,
}: {
  renderer: React.ComponentType<any>;
  scene: SceneModuleInput;
  outgoing?: SceneTransitionOutgoing;
  includeAudio?: boolean;
}) {
  const frame = useCurrentFrame();
  const transition = scene.entryTransition;
  const hasOutgoing = Boolean(outgoing && transition);
  const progress = hasOutgoing
    ? transitionProgress(
        frame,
        transition!.frames,
        scene.transitionSpanFrames ?? scene.duration,
      )
    : 1;
  const outgoingVisible = hasOutgoing && progress < 1;
  const isSlide = transition?.type === "slide-left";

  // The outgoing scene is a complete canvas (including its frozen source
  // video), so a dissolve must keep it opaque while the incoming canvas is
  // painted over it. Fading both layers would expose whatever is behind the
  // transition and darken the result.
  const outgoingStyle: React.CSSProperties = isSlide
    ? {
        transform: `translateX(${-progress * 100}%)`,
        opacity: 1,
      }
    : {opacity: 1};
  const incomingStyle: React.CSSProperties = isSlide
    ? {
        transform: `translateX(${(1 - progress) * 100}%)`,
        opacity: 1,
      }
    : {opacity: progress};

  return (
    <AbsoluteFill style={{overflow: "hidden"}}>
      {outgoingVisible && outgoing && (
        <AbsoluteFill style={{...outgoingStyle, pointerEvents: "none"}}>
          <Freeze
            frame={resolveOutgoingFreezeFrame(
              outgoing.frame,
              outgoing.scene.transitionSpanFrames ?? outgoing.scene.duration,
            )}
          >
            <SceneModuleSurface
              renderer={outgoing.renderer}
              scene={outgoing.scene}
              includeAudio={false}
            />
          </Freeze>
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          ...incomingStyle,
          // Keep the ordinary preview/edit surface interactive. During a
          // dissolve's first frame the transparent incoming layer should not
          // intercept clicks, but once it contributes pixels it may receive
          // them; slide transitions are interactive for the whole window.
          pointerEvents: isSlide || progress > 0 ? "auto" : "none",
        }}
      >
        <SceneModuleSurface
          renderer={renderer}
          scene={scene}
          includeAudio={includeAudio}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
