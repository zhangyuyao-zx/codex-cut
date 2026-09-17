import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  Loop,
  useCurrentFrame,
  staticFile,
} from "remotion";
import { TranscriptAnimation, type Props } from "./Scene";
export type ProgramProps = Props & {
  pendingMaterials: boolean;
  sceneEdits?: {
    id: string;
    from: number;
    end: number;
    overrides: Record<string, unknown>;
  }[];
  supports: {
    src: string;
    kind: "image" | "video";
    from: number;
    duration: number;
    mediaFrames: number;
  }[];
};
export function ProductionProgram(props: ProgramProps) {
  const frame = useCurrentFrame();
  const edit = props.sceneEdits?.find((s) => frame >= s.from && frame < s.end);
  const values = { ...props.values, ...edit?.overrides };
  const headlines =
    props.headlines && edit?.overrides.headline !== undefined
      ? { ...props.headlines, [edit.id]: String(edit.overrides.headline) }
      : props.headlines;
  return (
    <AbsoluteFill>
      <TranscriptAnimation
        {...props}
        values={values as Props["values"]}
        headlines={headlines}
      />
      {props.supports.map((s, i) => (
        <Sequence
          key={i}
          from={s.from}
          durationInFrames={s.duration}
          layout="none"
        >
          <div
            style={{
              position: "absolute",
              left: 112,
              top: 377,
              width: 620,
              height: 349,
              borderRadius: 18,
              overflow: "hidden",
              background: "#171b1e",
            }}
          >
            {s.kind === "image" ? (
              <Img
                src={s.src.startsWith("/") ? s.src : staticFile(s.src)}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <Loop durationInFrames={s.mediaFrames}>
                <OffthreadVideo
                  src={s.src.startsWith("/") ? s.src : staticFile(s.src)}
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </Loop>
            )}
          </div>
        </Sequence>
      ))}
      <div
        style={{
          position: "absolute",
          right: 110,
          bottom: 43,
          font: "18px PingFang SC",
          color: props.pendingMaterials ? "#e5c47b" : "#8b9497",
          background: "#171b1e",
          padding: "6px 14px",
        }}
      >
        {props.pendingMaterials ? "审阅草稿 · 有素材待补" : "流程示意"}
      </div>
    </AbsoluteFill>
  );
}
