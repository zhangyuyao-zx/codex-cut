import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
const palette = {
  bg: "#171B1E",
  paper: "#F2F0E9",
  muted: "#8B9497",
  line: "#343B3E",
  accent: "#E1F795",
};
const mono = { fontFamily: "Menlo, monospace", letterSpacing: 3 };
const box = (
  left: number,
  top: number,
  width?: number,
  height?: number,
): React.CSSProperties => ({ position: "absolute", left, top, width, height });
type Word = { text: string; start: number; end: number };
export type Props = {
  words: Word[];
  wave: number[];
  excerptWave: number[];
  timing: {
    auto: number;
    transcript: number;
    text: number;
    timeline: number;
    alignEnd: number;
  };
  duration: number;
  mediaSrc?: string;
  headlines?: { intro: string; transcript: string; alignment: string };
  values: {
    title: string;
    accent: string;
    personScale: number;
    personX: number;
    personY: number;
    titleScale: number;
  };
  motion: { offsetFrames: number };
};
const ease = Easing.bezier(0.22, 1, 0.36, 1);
function progress(f: number, a: number, b: number) {
  return interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function Wave({
  data,
  x,
  y,
  w,
  opacity = 1,
  accent,
}: {
  accent: string;
  data: number[];
  x: number;
  y: number;
  w: number;
  opacity?: number;
}) {
  return (
    <svg style={{ ...box(x, y, w, 50), opacity }} viewBox="0 0 800 50">
      {data.map((v, i) => (
        <rect
          key={i}
          x={(i * 800) / data.length}
          y={25 - Math.max(2, v * 44) / 2}
          width={3}
          height={Math.max(2, v * 44)}
          rx={1.5}
          fill={accent}
          opacity={0.5 + v * 0.5}
        />
      ))}
    </svg>
  );
}
export function TranscriptAnimation({
  words,
  wave,
  excerptWave,
  timing: t,
  values,
  motion,
  mediaSrc,
  headlines,
}: Props) {
  const C = { ...palette, accent: values.accent };
  const f = useCurrentFrame();
  const a = progress(f, t.auto - 12, t.auto + 15),
    b = progress(f, t.text - 8, t.timeline);
  const inText = progress(f, t.auto, t.transcript + 3);
  const timeline = progress(f, t.timeline - 6, t.timeline + 12);
  const w = mix(mix(840, 620, a), 430, b),
    y = mix(mix(288, 377, a), 330, b);
  const phase = b > 0.5 ? 2 : a > 0.5 ? 1 : 0;
  const origin = words[0].start,
    end = words.at(-1)!.end,
    span = end - origin;
  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        color: C.paper,
        fontFamily: "PingFang SC, sans-serif",
      }}
    >
      <Audio
        src={
          mediaSrc
            ? mediaSrc.startsWith("/")
              ? mediaSrc
              : staticFile(mediaSrc)
            : staticFile("narration.m4a")
        }
      />
      <div style={{ ...box(96, 74), ...mono, fontSize: 17, color: C.muted }}>
        CODEX CUT <span style={{ color: C.line, margin: "0 20px" }}>/</span>{" "}
        从口播到时间线
      </div>
      <div
        style={{
          ...box(1510, 70, 310),
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {["导入", "转写", "对齐"].map((v, i) => (
          <span
            key={v}
            style={{ fontSize: 19, color: phase === i ? C.accent : C.muted }}
          >
            <span style={{ ...mono, fontSize: 14, marginRight: 10 }}>
              0{i + 1}
            </span>
            {v}
          </span>
        ))}
      </div>
      <div style={{ ...box(96, 120, 1728, 1), background: C.line }} />
      <div style={{ opacity: 1 - a }}>
        <div
          style={{ ...box(112, 229), ...mono, color: C.muted, fontSize: 18 }}
        >
          01 / 视频是起点
        </div>
        <div
          data-editable-object="headline"
          style={{
            ...box(1090, 345, 710),
            fontSize: 77 * values.titleScale,
            lineHeight: 1.35,
            fontWeight: 600,
            letterSpacing: -3,
          }}
        >
          一段口播。
          <br />
          <span style={{ color: C.accent }}>
            {headlines?.intro || "剪辑的起点。"}
          </span>
        </div>
        <div
          style={{
            ...box(1095, 603, 620),
            fontSize: 27,
            color: C.muted,
            lineHeight: 1.9,
          }}
        >
          导入视频，
          <br />
          从你已经说过的话开始。
        </div>
      </div>
      <div
        data-editable-object="headline"
        style={{
          ...box(112, 197),
          fontSize: 66 * values.titleScale,
          fontWeight: 600,
          letterSpacing: -2,
          opacity: a * (1 - b),
        }}
      >
        {headlines ? (
          <span style={{ color: C.accent }}>{headlines.transcript}</span>
        ) : (
          <>
            说过的话，<span style={{ color: C.accent }}>变成可编辑的字。</span>
          </>
        )}
      </div>
      <div
        data-editable-object="headline"
        style={{
          ...box(112, 188),
          fontSize: 66 * values.titleScale,
          fontWeight: 600,
          letterSpacing: -2,
          opacity: b,
        }}
      >
        {headlines ? (
          headlines.alignment
        ) : (
          <>
            {values.title}
            <span style={{ color: C.accent }}>都有自己的时间。</span>
          </>
        )}
      </div>
      <div
        data-editable-object="person"
        style={{
          ...box(
            112 + values.personX,
            y + values.personY,
            w * values.personScale,
            (w * values.personScale * 9) / 16,
          ),
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 26px 75px #0005",
        }}
      >
        <OffthreadVideo
          src={
            mediaSrc
              ? mediaSrc.startsWith("/")
                ? mediaSrc
                : staticFile(mediaSrc)
              : staticFile("talking-head.mp4")
          }
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            ...box(22, 20),
            background: "#111a",
            padding: "8px 14px",
            borderRadius: 6,
            fontSize: 15,
            ...mono,
            color: "#fff",
          }}
        >
          原始口播
        </div>
      </div>
      <Wave
        accent={C.accent}
        data={wave}
        x={112}
        y={y + (w * 9) / 16 + 22}
        w={w}
        opacity={1 - b}
      />
      <svg
        style={{ ...box(777, 521, 90, 60), opacity: a * (1 - b) }}
        viewBox="0 0 90 60"
      >
        <path
          d="M0 30H80M67 17L80 30L67 43"
          stroke={C.accent}
          strokeWidth="2"
          fill="none"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - inText}
        />
      </svg>
      <div
        style={{
          ...box(930, 360),
          ...mono,
          color: C.muted,
          fontSize: 18,
          opacity: a * (1 - b),
        }}
      >
        TRANSCRIPT / 逐字稿
      </div>
      <div
        style={{ ...box(674, 337), fontSize: 18, color: C.muted, opacity: b }}
      >
        文字
      </div>
      <div
        style={{ ...box(1365, 429), fontSize: 53, opacity: inText * (1 - b) }}
      >
        后，
      </div>
      <div
        style={{
          ...box(930, 530),
          fontSize: 53,
          opacity: progress(f, t.transcript - 8, t.transcript + 12) * (1 - b),
        }}
      >
        它会自动生成逐字稿，
      </div>
      <div
        style={{
          ...box(930, 635),
          fontSize: 43,
          color: C.muted,
          opacity: progress(f, t.transcript + 6, t.transcript + 22) * (1 - b),
        }}
      >
        并把文字和时间线精确对齐。
      </div>
      <div
        style={{
          ...box(112, 651),
          fontSize: 18,
          color: C.muted,
          opacity: timeline,
        }}
      >
        时间线
      </div>
      <div
        style={{
          ...box(112, 698, 1640, 2),
          background: C.line,
          opacity: timeline,
        }}
      />
      <Wave
        accent={C.accent}
        data={excerptWave}
        x={674}
        y={819}
        w={994}
        opacity={timeline}
      />
      {words.map((word, i) => {
        const land = progress(
          f,
          t.timeline + i * 4 + motion.offsetFrames,
          t.alignEnd - 12 + i * 4 + motion.offsetFrames,
        );
        const tx = 674 + ((word.start - origin) / span) * 994;
        const next = i + 1 < words.length ? words[i + 1].start : end;
        const tw = ((next - word.start) / span) * 994 - 6;
        const px = mix(mix(930 + i * 106, 674 + i * 250, b), tx + 22, land);
        const py = mix(mix(429, 395, b), 744, land);
        const reveal = progress(f, t.auto + i * 3, t.transcript + i * 3);
        return (
          <React.Fragment key={word.text}>
            <div
              style={{
                ...box(tx, 658),
                ...mono,
                fontSize: 16,
                color: C.muted,
                opacity: timeline,
              }}
            >
              {(word.start / 30).toFixed(2)}s
            </div>
            <div
              style={{
                ...box(tx, 728, tw, 76),
                borderRadius: 8,
                background: C.accent,
                opacity: land,
              }}
            />
            <svg
              style={{
                ...box(tx + tw / 2, 500, 2, 180),
                opacity: timeline * (1 - land) * 0.4,
              }}
            >
              <path
                d="M1 0V180"
                stroke={C.accent}
                strokeWidth="1.5"
                strokeDasharray="4 8"
              />
            </svg>
            <div
              style={{
                ...box(px, py),
                fontSize: mix(mix(53, 49, b), 32, land),
                fontWeight: land > 0.9 ? 600 : 500,
                color: land > 0.85 ? C.bg : C.accent,
                opacity: reveal,
                whiteSpace: "nowrap",
              }}
            >
              {word.text}
            </div>
            <div
              style={{
                ...box(
                  mix(930 + i * 106, 674 + i * 250, b),
                  mix(512, 478, b),
                  mix(106, 220, b),
                  2,
                ),
                background: C.accent,
                opacity: reveal * (1 - land),
              }}
            />
          </React.Fragment>
        );
      })}
      <div style={{ ...box(96, 958, 1728, 1), background: C.line }} />
      <div style={{ ...box(112, 990), fontSize: 18, color: C.muted }}>
        真实口播 <span style={{ margin: "0 18px", color: C.line }}>—</span>{" "}
        逐字稿 <span style={{ margin: "0 18px", color: C.line }}>—</span>{" "}
        精确对齐
      </div>
      <div style={{ ...box(1590, 987), ...mono, fontSize: 18, color: C.muted }}>
        0{phase + 1} / 03
      </div>
    </AbsoluteFill>
  );
}
