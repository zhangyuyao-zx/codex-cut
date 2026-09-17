import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
} from "remotion";
import { componentMediaRequirement } from "./component-media";
import { ComponentRuntimeRenderer } from "../modules/components/component-runtime-renderer";
import { ScenePrimitiveLibraryPreview } from "../modules/components/scene-program-renderer";
export function AppLibraryComponent({
  componentId,
  parameters,
  mediaSrc,
  mediaStartFrame = 0,
  mediaSources,
}) {
  const { durationInFrames } = useVideoConfig();
  let requirement;
  try {
    requirement = componentMediaRequirement(componentId, parameters);
  } catch {
    return (
      <AbsoluteFill
        style={{
          display: "grid",
          placeItems: "center",
          color: "#60645a",
          fontSize: 36,
        }}
      >
        请填写右侧内容参数
      </AbsoluteFill>
    );
  }
  const sources =
    mediaSources ??
    (mediaSrc
      ? [{ src: mediaSrc, kind: "video", startFrame: mediaStartFrame }]
      : []);
  if (sources.length < requirement.count)
    return (
      <AbsoluteFill
        style={{ display: "grid", placeItems: "center", fontSize: 36 }}
      >
        请选择 {requirement.count} 份素材
      </AbsoluteFill>
    );
  const media = sources.slice(0, requirement.count).map((s, i) => {
    const src = s.src.startsWith("/") ? s.src : staticFile(s.src);
    const style = {
      width: "100%",
      height: "100%",
      objectFit:
        componentId === "component:v1:stage-person-pip-circle"
          ? "cover"
          : "contain",
    };
    return s.kind === "image" ? (
      <Img key={i} src={src} style={style} />
    ) : (
      <OffthreadVideo
        key={i}
        src={src}
        trimBefore={s.startFrame}
        muted
        style={style}
      />
    );
  });
  if (componentId.startsWith("component:v1:"))
    return (
      <ScenePrimitiveLibraryPreview
        transparent
        componentId={componentId}
        parameters={requirement.parameters}
        content={media[0]}
      />
    );
  return (
    <ComponentRuntimeRenderer
      componentId={componentId}
      parameters={requirement.parameters}
      content={media[0]}
      media={media}
      fromScene={requirement.mount === "TRANSITION" ? media[0] : undefined}
      toScene={requirement.mount === "TRANSITION" ? media[1] : undefined}
      durationInFrames={durationInFrames}
      transparentStage={requirement.mount === "OBJECT"}
    />
  );
}
