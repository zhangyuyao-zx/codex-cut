import { type ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { SmartPackagingCatalogCompletionCoreId } from "../../shared/smart-packaging-component-catalog-completion.js";
import {
  runtimeStyleProperties,
  useComponentRuntime,
  useComponentRuntimeClock,
} from "../../components/component-runtime-context.js";
import {
  COMPLETION_COLORS,
  LabOnly,
  clamp01,
  phase,
  pulse,
  runtimeFontFamily,
  runtimeFontSize,
  runtimeTextColor,
} from "./shared.js";

type CompletionAnnotationCoreId = Extract<
  SmartPackagingCatalogCompletionCoreId,
  "border-light-trace" | "stroke-trace"
>;

interface CompletionAnnotationCoreProps {
  coreId: CompletionAnnotationCoreId;
  intensity: number;
  reducedMotion: boolean;
  accentColor?: string;
  content?: ReactNode;
  targetRect?: { x: number; y: number; width: number; height: number };
  cornerRadius?: number;
  direction?: "clockwise" | "counterclockwise";
  path?: string;
  viewBox?: string;
  strokeWidth?: number;
  label?: string;
}

export const CompletionAnnotationCore = ({
  coreId,
  intensity,
  reducedMotion,
  accentColor = COMPLETION_COLORS.cyan,
  content,
  targetRect = { x: 55, y: 33, width: 32, height: 38 },
  cornerRadius = 18,
  direction = "clockwise",
  path = "M 90 190 C 210 40 430 48 550 175 S 820 330 970 135",
  viewBox = "0 0 1080 420",
  strokeWidth = 8,
  label,
}: CompletionAnnotationCoreProps) => {
  const { frame, durationInFrames } = useComponentRuntimeClock();
  const runtimeStyle = runtimeStyleProperties(useComponentRuntime()?.style, { includeOpacity: false });
  const amount = clamp01(intensity);

  if (coreId === "stroke-trace") {
    const draw = reducedMotion ? 1 : phase(frame, 8, durationInFrames * 0.58);
    return (
      <AbsoluteFill
        style={{
          background: "linear-gradient(145deg,#0d2024,#071113)",
          color: runtimeTextColor(COMPLETION_COLORS.text),
          fontFamily: runtimeFontFamily("Inter, ui-sans-serif, system-ui, sans-serif"),
          ...runtimeStyle,
        }}
      >
        <svg
          viewBox={viewBox}
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            top: 120,
            width: "calc(100% - 144px)",
            height: 420,
            overflow: "visible",
          }}
        >
          <path
            d={path}
            fill="none"
            stroke="#24454a"
            strokeWidth={strokeWidth + 5}
            strokeLinecap="round"
          />
          <path
            d={path}
            fill="none"
            pathLength={1}
            stroke={accentColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="1"
            strokeDashoffset={1 - draw}
            style={{ filter: `drop-shadow(0 0 ${14 * amount}px ${accentColor})` }}
          />
        </svg>
        <LabOnly>
          <div style={{ position: "absolute", left: 78, top: 62, fontSize: runtimeFontSize(18), color: runtimeTextColor(accentColor), fontWeight: 850, letterSpacing: 3 }}>
            BOUND VECTOR PATH
          </div>
        </LabOnly>
        <div style={{ position: "absolute", left: 78, top: 91, fontSize: runtimeFontSize(35), fontWeight: 900 }}>
          {label ?? "Trace only the approved shape"}
        </div>
      </AbsoluteFill>
    );
  }

  const orbit = reducedMotion
    ? 0.14
    : ((frame / Math.max(1, durationInFrames)) * (direction === "clockwise" ? 1 : -1) + 1) % 1;
  const perimeter = 2 * (targetRect.width + targetRect.height);
  return (
    <AbsoluteFill style={{ background: COMPLETION_COLORS.background, ...runtimeStyle }}>
      {content}
      <div
        style={{
          position: "absolute",
          left: `${targetRect.x}%`,
          top: `${targetRect.y}%`,
          width: `${targetRect.width}%`,
          height: `${targetRect.height}%`,
          borderRadius: cornerRadius,
          border: `2px solid ${accentColor}88`,
          boxShadow: `0 0 ${18 + 20 * amount}px ${accentColor}33`,
        }}
      >
        <svg viewBox={`0 0 ${targetRect.width} ${targetRect.height}`} style={{ position: "absolute", inset: -3, width: "calc(100% + 6px)", height: "calc(100% + 6px)", overflow: "visible" }}>
          <rect
            x={1}
            y={1}
            width={Math.max(1, targetRect.width - 2)}
            height={Math.max(1, targetRect.height - 2)}
            rx={Math.min(cornerRadius / 4, targetRect.height / 2)}
            fill="none"
            pathLength={perimeter}
            stroke={accentColor}
            strokeWidth={1.3}
            strokeDasharray={`${perimeter * 0.2} ${perimeter * 0.8}`}
            strokeDashoffset={-orbit * perimeter}
            style={{ filter: `drop-shadow(0 0 ${4 + 6 * amount}px ${accentColor})` }}
          />
        </svg>
        {label ? (
          <div style={{ position: "absolute", left: 14, top: 14, padding: "7px 10px", borderRadius: 6, background: "#071113dd", color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(13), letterSpacing: 2, fontWeight: 850 }}>
            {label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

type CompletionCodeUiCoreId = Extract<
  SmartPackagingCatalogCompletionCoreId,
  "chat-thread" | "code-block" | "code-diff" | "code-focus"
>;

interface ChatMessage {
  id: string;
  role: string;
  text: string;
}

interface CodeDiffLine {
  id: string;
  kind: "add" | "delete" | "context";
  text: string;
}

interface CompletionCodeUiCoreProps {
  coreId: CompletionCodeUiCoreId;
  intensity: number;
  reducedMotion: boolean;
  accentColor?: string;
  title?: string;
  messages?: ChatMessage[];
  activeMessageId?: string;
  lines?: string[] | CodeDiffLine[];
  activeLineIndex?: number;
  language?: string;
  lineNumbers?: boolean;
  mode?: "highlight" | "scroll";
  depth?: number;
}

const codeColors = {
  keyword: "#c8a7ff",
  string: "#9cda71",
  function: "#64d7e3",
  punctuation: "#90a8ad",
};

const colorCode = (line: string) => {
  const pieces = line.split(/(const|return|function|=>|"[^"]*"|'[^']*'|\b\d+\b)/gu);
  return pieces.map((piece, index) => {
    const color = /^(const|return|function|=>)$/u.test(piece)
      ? codeColors.keyword
      : /^("[^"]*"|'[^']*')$/u.test(piece)
        ? codeColors.string
        : /^\d+$/u.test(piece)
          ? COMPLETION_COLORS.amber
          : index % 2 === 0
            ? COMPLETION_COLORS.text
            : codeColors.punctuation;
    return <span key={`${index}-${piece}`} style={{ color }}>{piece}</span>;
  });
};

const CodeWindow = ({
  title,
  language,
  children,
  depth = 0,
}: {
  title: string;
  language: string;
  children: ReactNode;
  depth?: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: 88,
      right: 88,
      top: 72,
      bottom: 72,
      borderRadius: 24,
      overflow: "hidden",
      background: "#09171a",
      border: `1px solid ${COMPLETION_COLORS.line}`,
      boxShadow: "0 36px 80px #0008",
      transform: `perspective(1200px) rotateX(${depth}deg) rotateY(${-depth * 0.7}deg)`,
    }}
  >
    <div style={{ height: 58, padding: "0 22px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#10282d", borderBottom: `1px solid ${COMPLETION_COLORS.line}` }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[COMPLETION_COLORS.coral, COMPLETION_COLORS.amber, COMPLETION_COLORS.lime].map((color) => <div key={color} style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />)}
      </div>
      <strong style={{ color: runtimeTextColor(COMPLETION_COLORS.text), fontSize: runtimeFontSize(17) }}>{title}</strong>
      <span style={{ color: runtimeTextColor(COMPLETION_COLORS.cyan), fontSize: runtimeFontSize(13), letterSpacing: 2 }}>{language}</span>
    </div>
    {children}
  </div>
);

export const CompletionCodeUiCore = ({
  coreId,
  intensity,
  reducedMotion,
  accentColor = COMPLETION_COLORS.cyan,
  title = "Bound source",
  messages = [],
  activeMessageId,
  lines = [],
  activeLineIndex = 0,
  language = "TSX",
  lineNumbers = true,
  mode = "highlight",
  depth = 0,
}: CompletionCodeUiCoreProps) => {
  const { frame, durationInFrames } = useComponentRuntimeClock();
  const runtimeStyle = runtimeStyleProperties(useComponentRuntime()?.style, { includeOpacity: false });
  const amount = clamp01(intensity);

  if (coreId === "chat-thread") {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(145deg,#0b1b1f,#071113)", color: runtimeTextColor(COMPLETION_COLORS.text), fontFamily: runtimeFontFamily("Inter, ui-sans-serif, system-ui, sans-serif"), ...runtimeStyle }}>
        <div style={{ position: "absolute", left: 80, top: 48, fontSize: runtimeFontSize(17), letterSpacing: 3, color: runtimeTextColor(accentColor), fontWeight: 850 }}>APPROVED MESSAGE SEQUENCE</div>
        <div style={{ position: "absolute", left: 80, top: 82, fontSize: runtimeFontSize(38), fontWeight: 920 }}>{title}</div>
        <div style={{ position: "absolute", left: 190, right: 190, top: 150, bottom: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 16 }}>
          {messages.map((message, index) => {
            const show = reducedMotion ? 1 : phase(frame, 10 + index * 14, 22 + index * 14);
            const active = message.id === activeMessageId;
            const isAgent = /assistant|agent|ai/iu.test(message.role);
            return (
              <div key={message.id} style={{ alignSelf: isAgent ? "flex-start" : "flex-end", width: "76%", padding: "18px 22px", borderRadius: isAgent ? "8px 24px 24px" : "24px 8px 24px 24px", background: isAgent ? "#142d32" : `${accentColor}20`, border: `1px solid ${active ? accentColor : COMPLETION_COLORS.line}`, opacity: show, transform: `translateY(${(1 - show) * 28}px)`, boxShadow: active ? `0 0 ${24 * amount}px ${accentColor}33` : "none" }}>
                <div style={{ fontSize: runtimeFontSize(12), letterSpacing: 2, color: runtimeTextColor(isAgent ? accentColor : COMPLETION_COLORS.amber), fontWeight: 850 }}>{message.role.toUpperCase()}</div>
                <div style={{ marginTop: 7, fontSize: runtimeFontSize(20), lineHeight: 1.38 }}>{message.text}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  const plainLines = (lines as Array<string | CodeDiffLine>).map((line) =>
    typeof line === "string" ? line : line.text,
  );

  if (coreId === "code-diff") {
    const diffLines = lines as CodeDiffLine[];
    return (
      <AbsoluteFill style={{ background: COMPLETION_COLORS.background, fontFamily: runtimeFontFamily("ui-monospace, SFMono-Regular, Menlo, monospace"), ...runtimeStyle }}>
        <CodeWindow title={title} language="DIFF">
          <div style={{ padding: "22px 0", fontSize: runtimeFontSize(18), lineHeight: 1.58 }}>
            {diffLines.map((line, index) => {
              const reveal = reducedMotion ? 1 : phase(frame, 8 + index * 5, 15 + index * 5);
              const active = index === activeLineIndex;
              const color = line.kind === "add" ? COMPLETION_COLORS.lime : line.kind === "delete" ? COMPLETION_COLORS.coral : COMPLETION_COLORS.muted;
              const background = line.kind === "add" ? "#173328" : line.kind === "delete" ? "#351c1c" : "transparent";
              return (
                <div key={line.id} style={{ display: "grid", gridTemplateColumns: "58px 30px 1fr", minHeight: 29, padding: "0 24px", color, background, opacity: reveal, boxShadow: active ? `inset 4px 0 ${accentColor}` : "none" }}>
                  <span style={{ color: runtimeTextColor("#536f74") }}>{index + 1}</span>
                  <strong>{line.kind === "add" ? "+" : line.kind === "delete" ? "−" : " "}</strong>
                  <span>{line.text}</span>
                </div>
              );
            })}
          </div>
        </CodeWindow>
      </AbsoluteFill>
    );
  }

  if (coreId === "code-focus") {
    const rowHeight = 31;
    const targetOffset = mode === "scroll" ? Math.max(0, activeLineIndex - 5) * rowHeight : 0;
    const scrollT = reducedMotion ? 1 : phase(frame, 18, durationInFrames * 0.6);
    const offset = targetOffset * scrollT;
    return (
      <AbsoluteFill style={{ background: COMPLETION_COLORS.background, fontFamily: runtimeFontFamily("ui-monospace, SFMono-Regular, Menlo, monospace"), ...runtimeStyle }}>
        <CodeWindow title={title} language={language}>
          <div style={{ position: "absolute", inset: "58px 0 0", overflow: "hidden" }}>
            <div style={{ padding: "22px 0", transform: `translateY(${-offset}px)`, fontSize: runtimeFontSize(18), lineHeight: `${rowHeight}px` }}>
              {plainLines.map((line, index) => {
                const distance = Math.abs(index - activeLineIndex);
                const active = distance === 0;
                const focus = reducedMotion ? 1 : phase(frame, 16 + distance * 2, 29 + distance * 2);
                return (
                  <div key={`${index}-${line}`} style={{ display: "grid", gridTemplateColumns: "64px 1fr", padding: "0 26px", background: active ? `${accentColor}1f` : "transparent", boxShadow: active ? `inset 4px 0 ${accentColor}` : "none", opacity: active ? 1 : 0.46 + focus * 0.28 }}>
                    <span style={{ color: runtimeTextColor(active ? accentColor : "#536f74") }}>{index + 1}</span>
                    <code>{colorCode(line)}</code>
                  </div>
                );
              })}
            </div>
          </div>
        </CodeWindow>
      </AbsoluteFill>
    );
  }

  const revealCount = reducedMotion
    ? plainLines.length
    : Math.ceil(interpolate(frame, [8, durationInFrames * 0.62], [0, plainLines.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const breathe = reducedMotion ? 0 : (pulse(frame, 90) - 0.5) * 1.6 * amount;
  return (
    <AbsoluteFill style={{ background: COMPLETION_COLORS.background, fontFamily: runtimeFontFamily("ui-monospace, SFMono-Regular, Menlo, monospace"), ...runtimeStyle }}>
      <CodeWindow title={title} language={language} depth={depth + breathe}>
        <div style={{ padding: "24px 0", fontSize: runtimeFontSize(18), lineHeight: 1.62 }}>
          {plainLines.map((line, index) => (
            <div key={`${index}-${line}`} style={{ display: "grid", gridTemplateColumns: lineNumbers ? "64px 1fr" : "1fr", padding: "0 26px", minHeight: 30, opacity: index < revealCount ? 1 : 0 }}>
              {lineNumbers ? <span style={{ color: runtimeTextColor("#536f74") }}>{index + 1}</span> : null}
              <code>{colorCode(line)}</code>
            </div>
          ))}
        </div>
      </CodeWindow>
    </AbsoluteFill>
  );
};
