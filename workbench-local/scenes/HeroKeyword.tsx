import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import type { SceneModuleInput } from "../SceneModuleSurface";
export function HeroKeyword({
  title,
  parameters,
  beats,
  mediaSrc,
  from,
}: SceneModuleInput) {
  const f = useCurrentFrame(),
    onset = beats[0]?.frame ?? 0,
    p = interpolate(f, [onset, onset + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  return (
    <AbsoluteFill
      style={{
        background: "#edf0e6",
        fontFamily: "PingFang SC",
        color: "#20271c",
      }}
    >
      <div
        data-editable-object="person"
        style={{
          transform: `translate(${Number(parameters.personX || 0)}px, ${Number(parameters.personY || 0)}px) scale(${Number(parameters.personScale || 1)})`,
          transformOrigin: "top left",
          position: "absolute",
          left: 70,
          top: 70,
          width: 1030,
          height: 940,
          borderRadius: 30,
          overflow: "hidden",
        }}
      >
        <OffthreadVideo
          src={mediaSrc.startsWith("/") ? mediaSrc : staticFile(mediaSrc)}
          trimBefore={from}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div
        data-editable-object="headline"
        style={{ position: "absolute", left: 1190, top: 180, width: 640 }}
      >
        <div style={{ fontSize: 28, color: "#717b66" }}>{title}</div>
        <div
          style={{
            fontSize: Number(parameters.fontSize),
            fontWeight: 750,
            lineHeight: 1.25,
            whiteSpace: "pre-line",
            marginTop: 65,
            opacity: p,
            transform: `translateY(${(1 - p) * 18}px)`,
          }}
        >
          {String(parameters.caption)}
        </div>
        <div
          style={{
            width: 160 * p,
            height: 12,
            background: String(parameters.accent),
            marginTop: 50,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}
