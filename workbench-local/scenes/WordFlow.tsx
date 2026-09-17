import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
  Img,
} from "remotion";
import type { SceneModuleInput } from "../SceneModuleSurface";
export function WordFlow({
  title,
  parameters,
  beats,
  mediaSrc,
  from,
  materials,
}: SceneModuleInput) {
  const frame = useCurrentFrame(),
    accent = String(parameters.accent),
    size = Number(parameters.fontSize);
  return (
    <AbsoluteFill
      style={{
        background: "#f3f3ec",
        color: "#20251d",
        fontFamily: "PingFang SC",
        padding: 100,
      }}
    >
      <div style={{ fontSize: 22, color: "#707766", letterSpacing: 3 }}>
        把重点，讲清楚
      </div>
      <h1
        data-editable-object="headline"
        style={{
          fontSize: size,
          letterSpacing: -3,
          lineHeight: 1.15,
          maxWidth: 1320,
          margin: "25px 0 80px",
        }}
      >
        {title}
      </h1>
      <div
        data-editable-object="person"
        style={{
          transform: `translate(${Number(parameters.personX || 0)}px, ${Number(parameters.personY || 0)}px) scale(${Number(parameters.personScale || 1)})`,
          transformOrigin: "top right",
          position: "absolute",
          right: 90,
          top: 85,
          width: 270,
          height: 152,
          borderRadius: 18,
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
        data-editable-object="cards"
        style={{ display: "flex", gap: 24, alignItems: "stretch", height: 480 }}
      >
        {beats.map((b, i) => {
          const progress = interpolate(frame, [b.frame, b.frame + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={b.wordId + i}
              style={{
                flex: 1,
                background: "#fff",
                border: "1px solid #d8ddd0",
                borderRadius: 26,
                padding: 42,
                opacity: progress,
                transform: `translateY(${(1 - progress) * 24}px)`,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "12px 18px",
                  borderRadius: 50,
                  background: accent,
                  fontSize: 24,
                }}
              >
                0{i + 1}
              </div>
              <div
                style={{
                  fontSize: Math.min(54, 240 / Math.max(3, b.label.length)),
                  fontWeight: 700,
                  marginTop: 62,
                  lineHeight: 1.35,
                }}
              >
                {b.label}
              </div>
              <div
                style={{
                  height: 4,
                  background: accent,
                  marginTop: 50,
                  width: `${progress * 100}%`,
                }}
              />
            </div>
          );
        })}
      </div>
      {materials.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 36,
            right: 100,
            display: "flex",
            gap: 12,
          }}
        >
          {materials.map((m) => (
            <div
              key={m.id}
              style={{
                width: 220,
                height: 124,
                overflow: "hidden",
                borderRadius: 12,
              }}
            >
              {m.kind === "image" ? (
                <Img
                  src={m.src.startsWith("/") ? m.src : staticFile(m.src)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <OffthreadVideo
                  src={m.src.startsWith("/") ? m.src : staticFile(m.src)}
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
}
