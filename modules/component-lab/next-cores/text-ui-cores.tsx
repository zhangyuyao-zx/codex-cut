import { type ReactNode } from "react";
import { interpolate } from "remotion";
import type { SmartPackagingNextCoreId } from "../../shared/smart-packaging-component-next-core.js";
import {
  CoreKicker,
  LabOnly,
  NEXT_COLORS,
  NextCoreStage,
  clamp01,
  ensureArray,
  hashSeed,
  runtimeFontFamily,
  runtimeFontSize,
  runtimeTextColor,
  seededUnit,
  useNextCoreMotion,
  type NextCoreMotionProps,
} from "./shared.js";

type TextCoreId = Extract<
  SmartPackagingNextCoreId,
  | "brand-lockup"
  | "gradient-text"
  | "impact-feedback"
  | "karaoke-progress"
  | "kinetic-type"
  | "split-flap"
  | "text-fracture"
  | "text-reveal"
  | "typewriter"
  | "word-relay"
>;

type UiCoreId = Extract<
  SmartPackagingNextCoreId,
  | "prompt-paste"
  | "response-stream"
  | "screen-frame"
  | "selection-control"
  | "spotlight-scan"
  | "terminal-type"
  | "ui-materialize"
>;

type AnnotationCoreId = Extract<
  SmartPackagingNextCoreId,
  "hud-focus" | "icon-feedback"
>;

interface TextCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  coreId: TextCoreId;
  text?: string;
  words?: string[];
  activeWordIndex?: number;
  headline?: string;
  label?: string;
  mark?: ReactNode;
  name?: string;
  tagline?: string;
  colors?: string[];
  direction?: "left" | "right" | "up" | "down";
  layout?: "stack" | "scatter" | "line";
  impactStyle?: "stamp" | "slam" | "pulse";
  characterSet?: string;
  fragments?: number;
  cursor?: string;
  accentColor?: string;
}

interface UiElement {
  id: string;
  label: string;
  kind?: "toolbar" | "panel" | "chip" | "field";
}

interface UiCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  coreId: UiCoreId;
  content?: ReactNode;
  title?: string;
  prompt?: string;
  state?: "idle" | "ready" | "running" | "complete";
  chunks?: string[];
  modelLabel?: string;
  sourceLabel?: string;
  options?: Array<{ id: string; label: string }>;
  selectedId?: string;
  label?: string;
  region?: { x: number; y: number; width: number; height: number };
  lines?: string[];
  activeLineIndex?: number;
  elements?: UiElement[];
  activeId?: string;
  accentColor?: string;
}

interface AnnotationCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  coreId: AnnotationCoreId;
  content?: ReactNode;
  targetX?: number;
  targetY?: number;
  radius?: number;
  label: string;
  icon?: ReactNode;
  state?: "success" | "warning" | "error" | "info";
  accentColor?: string;
}

const TextStageHeader = ({
  title,
  accent,
}: {
  title: string;
  accent: string;
}) => (
  <div style={{ position: "absolute", left: 96, top: 78 }}>
      <LabOnly><CoreKicker accent={accent}>{title}</CoreKicker></LabOnly>
  </div>
);

const splitWords = (text: string): string[] =>
  text.trim().split(/\s+/u).filter((word) => word.length > 0);

const BrandLockup = ({
  mark,
  name,
  tagline,
  reveal,
  accent,
}: {
  mark: ReactNode;
  name: string;
  tagline?: string;
  reveal: number;
  accent: string;
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      opacity: reveal,
      transform: `scale(${0.9 + reveal * 0.1})`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 42 }}>
      <div
        style={{
          width: 190,
          height: 190,
          display: "grid",
          placeItems: "center",
          borderRadius: 48,
          background: accent,
          color: runtimeTextColor(NEXT_COLORS.background),
          fontSize: runtimeFontSize(92),
          fontWeight: 950,
          boxShadow: `0 0 90px ${accent}44`,
        }}
      >
        {mark}
      </div>
      <div>
        <div style={{ fontSize: runtimeFontSize(126), fontWeight: 920, lineHeight: 0.94, letterSpacing: -6 }}>
          {name}
        </div>
        {tagline ? (
          <div style={{ marginTop: 24, color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(31), letterSpacing: 5 }}>
            {tagline}
          </div>
        ) : null}
      </div>
    </div>
  </div>
);

const GradientText = ({ text, reveal, colors }: { text: string; reveal: number; colors: string[] }) => (
  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 120 }}>
    <div
      style={{
        maxWidth: 1560,
        textAlign: "center",
        fontSize: runtimeFontSize(text.length > 24 ? 104 : 150),
        fontWeight: 950,
        lineHeight: 0.98,
        letterSpacing: -5,
        color: runtimeTextColor("transparent"),
        backgroundImage: `linear-gradient(105deg, ${(colors.length === 1 ? [colors[0], colors[0]] : colors).join(", ")})`,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        backgroundSize: `${120 + reveal * 90}% 100%`,
        backgroundPosition: `${100 - reveal * 100}% 50%`,
        opacity: reveal,
      }}
    >
      {text}
    </div>
  </div>
);

const ImpactText = ({ text, reveal, phase, accent, styleName }: { text: string; reveal: number; phase: number; accent: string; styleName: string }) => {
  const hit = interpolate(reveal, [0, 0.62, 1], [0, 1.16, 1]);
  const pulse = styleName === "pulse" ? Math.sin(phase * Math.PI * 2) * 0.018 : 0;
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 130 }}>
      <div style={{ position: "absolute", width: 860 * reveal, height: 860 * reveal, borderRadius: "50%", border: `4px solid ${accent}44`, boxShadow: `0 0 120px ${accent}22` }} />
      <div
        style={{
          maxWidth: 1500,
          padding: "36px 58px 44px",
          textAlign: "center",
          fontSize: runtimeFontSize(text.length > 14 ? 126 : 190),
          fontWeight: 960,
          lineHeight: 0.9,
          letterSpacing: -7,
          textTransform: "uppercase",
          border: styleName === "stamp" ? `10px solid ${accent}` : "none",
          color: runtimeTextColor(styleName === "stamp" ? accent : NEXT_COLORS.ink),
          transform: `rotate(${styleName === "stamp" ? -2.5 : 0}deg) scale(${hit + pulse})`,
          textShadow: styleName === "slam" ? `12px 12px 0 ${accent}66` : `0 0 45px ${accent}44`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const KaraokeWords = ({ words, activeIndex, reveal, accent }: { words: string[]; activeIndex: number; reveal: number; accent: string }) => (
  <div style={{ position: "absolute", left: 130, right: 130, top: 300, bottom: 230, display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", alignContent: "center", gap: "28px 34px" }}>
    {words.map((word, index) => {
      const visible = clamp01(reveal * words.length - index);
      const active = index === activeIndex;
      const completed = index < activeIndex;
      return (
        <div key={`${word}-${index}`} style={{ position: "relative", color: runtimeTextColor(active ? NEXT_COLORS.background : completed ? NEXT_COLORS.ink : NEXT_COLORS.muted), background: active ? accent : "transparent", borderRadius: 14, padding: "9px 14px 12px", fontSize: runtimeFontSize(74), fontWeight: active ? 930 : 760, lineHeight: 1, opacity: visible, transform: `translateY(${(1 - visible) * 34}px)` }}>
          {word}
          {completed ? <div style={{ position: "absolute", left: 12, right: 12, bottom: 2, height: 4, background: accent }} /> : null}
        </div>
      );
    })}
  </div>
);

const KineticWords = ({ words, reveal, accent, layout }: { words: string[]; reveal: number; accent: string; layout: string }) => (
  <div style={{ position: "absolute", inset: "170px 110px 90px", display: "flex", flexDirection: layout === "stack" ? "column" : "row", flexWrap: "wrap", alignItems: "center", alignContent: "center", justifyContent: "center", gap: layout === "stack" ? 4 : 26 }}>
    {words.map((word, index) => {
      const local = clamp01(reveal * 1.5 - index * 0.11);
      const angle = layout === "scatter" ? (seededUnit(hashSeed(word), index) - 0.5) * 14 * (1 - local) : 0;
      const offset = (1 - local) * (index % 2 === 0 ? -130 : 130);
      return (
        <div key={`${word}-${index}`} style={{ padding: "6px 16px", color: runtimeTextColor(index % 3 === 1 ? accent : NEXT_COLORS.ink), fontSize: runtimeFontSize(layout === "stack" ? 92 : 82), fontWeight: 930, lineHeight: 0.96, letterSpacing: -3, opacity: local, transform: `translate(${layout === "stack" ? 0 : offset}px, ${layout === "stack" ? offset * 0.4 : 0}px) rotate(${angle}deg)` }}>
          {word}
        </div>
      );
    })}
  </div>
);

const SplitFlap = ({ text, frame, reveal, charset, accent }: { text: string; frame: number; reveal: number; charset: string; accent: string }) => {
  const chars = [...text.slice(0, 24)];
  return (
    <div style={{ position: "absolute", inset: "250px 90px 160px", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", alignContent: "center", gap: 12 }}>
      {chars.map((character, index) => {
        const settled = reveal >= (index + 1) / Math.max(1, chars.length);
        const cycle = Math.abs(Math.floor(frame * 0.55 + index * 3)) % Math.max(1, charset.length);
        const shown = character === " " ? "·" : settled ? character : charset[cycle] ?? character;
        return (
          <div key={index} style={{ width: 76, height: 112, display: "grid", placeItems: "center", borderRadius: 8, border: `2px solid ${NEXT_COLORS.muted}55`, background: "linear-gradient(180deg, #16292d 0 48%, #071113 49% 51%, #132326 52%)", color: runtimeTextColor(settled ? accent : NEXT_COLORS.muted), fontFamily: runtimeFontFamily("ui-monospace, SFMono-Regular, monospace"), fontSize: runtimeFontSize(68), fontWeight: 860, boxShadow: settled ? `0 0 26px ${accent}33` : "none" }}>
            {shown}
          </div>
        );
      })}
    </div>
  );
};

const TextFracture = ({ text, reveal, fragments, accent }: { text: string; reveal: number; fragments: number; accent: string }) => {
  const pieces = Array.from({ length: fragments }, (_, index) => index);
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 120 }}>
      <div style={{ position: "relative", width: 1460, height: 340 }}>
        {pieces.map((piece) => {
          const start = (piece / fragments) * 100;
          const end = ((piece + 1) / fragments) * 100;
          const angle = (seededUnit(hashSeed(text), piece) - 0.5) * 18;
          const x = (seededUnit(hashSeed(text) + 9, piece) - 0.5) * 380 * (1 - reveal);
          const y = (seededUnit(hashSeed(text) + 17, piece) - 0.5) * 260 * (1 - reveal);
          return (
            <div key={piece} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", overflow: "hidden", clipPath: `polygon(${start}% 0, ${end}% 0, ${end + 5}% 100%, ${Math.max(0, start - 5)}% 100%)`, transform: `translate(${x}px, ${y}px) rotate(${angle * (1 - reveal)}deg)`, color: runtimeTextColor(piece % 2 === 0 ? NEXT_COLORS.ink : accent), fontSize: runtimeFontSize(text.length > 16 ? 112 : 164), fontWeight: 950, lineHeight: 0.95, textAlign: "center", letterSpacing: -6 }}>
              {text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TextReveal = ({ text, reveal, direction, accent }: { text: string; reveal: number; direction: string; accent: string }) => {
  const horizontal = direction === "left" || direction === "right";
  const reverse = direction === "right" || direction === "down";
  const clip = horizontal
    ? `inset(0 ${reverse ? 0 : (1 - reveal) * 100}% 0 ${reverse ? (1 - reveal) * 100 : 0}%)`
    : `inset(${reverse ? (1 - reveal) * 100 : 0}% 0 ${reverse ? 0 : (1 - reveal) * 100}% 0)`;
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 140 }}>
      <div style={{ position: "relative", maxWidth: 1450, textAlign: "center", fontSize: runtimeFontSize(text.length > 28 ? 98 : 142), fontWeight: 920, lineHeight: 1, letterSpacing: -5, clipPath: clip }}>
        {text}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: -18, height: 10, background: accent, transformOrigin: reverse ? "right" : "left", transform: `scaleX(${reveal})` }} />
      </div>
    </div>
  );
};

const WordRelay = ({ headline, label, reveal, accent }: { headline: string; label: string; reveal: number; accent: string }) => {
  const first = clamp01(reveal * 1.45);
  const second = clamp01(reveal * 1.45 - 0.32);
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      <div style={{ width: 1320 }}>
        <div style={{ color: runtimeTextColor(accent), fontSize: runtimeFontSize(28), fontWeight: 850, letterSpacing: 6, opacity: second, transform: `translateX(${(1 - second) * -80}px)` }}>{label}</div>
        <div style={{ marginTop: 26, fontSize: runtimeFontSize(headline.length > 24 ? 106 : 152), fontWeight: 950, lineHeight: 0.94, letterSpacing: -6, opacity: first, transform: `translateX(${(1 - first) * 120}px)` }}>{headline}</div>
        <div style={{ width: `${second * 100}%`, height: 8, marginTop: 44, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      </div>
    </div>
  );
};

export const TextCore = (props: TextCoreProps) => {
  const { coreId, accentColor = NEXT_COLORS.cyan } = props;
  const motion = useNextCoreMotion(props);
  const text = props.text ?? "Make the idea visible";
  const words = ensureArray(props.words, splitWords(text), 16);

  if (coreId === "brand-lockup") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="BRAND LOCKUP" accent={accentColor} /><BrandLockup mark={props.mark ?? "C"} name={props.name ?? "Codex Cut"} tagline={props.tagline} reveal={motion.reveal} accent={accentColor} /></NextCoreStage>;
  }
  if (coreId === "gradient-text") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="GRADIENT TEXT" accent={accentColor} /><GradientText text={text} reveal={motion.reveal} colors={ensureArray(props.colors, [NEXT_COLORS.cyan, NEXT_COLORS.blue, NEXT_COLORS.violet, NEXT_COLORS.coral], 6)} /></NextCoreStage>;
  }
  if (coreId === "impact-feedback") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="IMPACT FEEDBACK" accent={accentColor} /><ImpactText text={text} reveal={motion.reveal} phase={motion.phase} accent={accentColor} styleName={props.impactStyle ?? "slam"} /></NextCoreStage>;
  }
  if (coreId === "karaoke-progress") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="KARAOKE PROGRESS" accent={accentColor} /><KaraokeWords words={words} activeIndex={Math.max(0, Math.min(words.length - 1, props.activeWordIndex ?? 2))} reveal={motion.reveal} accent={accentColor} /></NextCoreStage>;
  }
  if (coreId === "kinetic-type") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="KINETIC TYPE" accent={accentColor} /><KineticWords words={words.slice(0, 8)} reveal={motion.reveal} accent={accentColor} layout={props.layout ?? "scatter"} /></NextCoreStage>;
  }
  if (coreId === "split-flap") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="SPLIT FLAP" accent={accentColor} /><SplitFlap text={text} frame={motion.frame} reveal={motion.reveal} charset={props.characterSet ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"} accent={accentColor} /></NextCoreStage>;
  }
  if (coreId === "text-fracture") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="TEXT FRACTURE" accent={accentColor} /><TextFracture text={text} reveal={motion.reveal} fragments={Math.max(3, Math.min(10, props.fragments ?? 7))} accent={accentColor} /></NextCoreStage>;
  }
  if (coreId === "text-reveal") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="TEXT REVEAL" accent={accentColor} /><TextReveal text={text} reveal={motion.reveal} direction={props.direction ?? "left"} accent={accentColor} /></NextCoreStage>;
  }
  if (coreId === "word-relay") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="WORD RELAY" accent={accentColor} /><WordRelay headline={props.headline ?? text} label={props.label ?? "THE CONCLUSION"} reveal={motion.reveal} accent={accentColor} /></NextCoreStage>;
  }

  const characterCount = Math.round(text.length * motion.reveal);
  return (
    <NextCoreStage coreId={coreId}>
      <TextStageHeader title="TYPEWRITER" accent={accentColor} />
      <div style={{ position: "absolute", left: 160, right: 160, top: 350, minHeight: 330, padding: "58px 66px", borderRadius: 34, border: `2px solid ${NEXT_COLORS.muted}44`, background: "rgba(4,10,12,.76)", fontFamily: runtimeFontFamily("ui-monospace, SFMono-Regular, monospace"), fontSize: runtimeFontSize(64), lineHeight: 1.38, boxShadow: `0 35px 100px #0008` }}>
        <span>{text.slice(0, characterCount)}</span>
        <span style={{ color: runtimeTextColor(accentColor), opacity: props.reducedMotion ? 0 : motion.phase % 0.16 < 0.08 ? 1 : 0 }}>{props.cursor ?? "▌"}</span>
      </div>
    </NextCoreStage>
  );
};

const BrowserChrome = ({ children, title, sourceLabel, accent }: { children: ReactNode; title: string; sourceLabel?: string; accent: string }) => (
  <div style={{ position: "absolute", left: 125, right: 125, top: 155, bottom: 100, borderRadius: 34, overflow: "hidden", border: `2px solid ${NEXT_COLORS.muted}55`, background: "#071012", boxShadow: "0 42px 110px #000a" }}>
    <div style={{ height: 76, display: "flex", alignItems: "center", gap: 12, padding: "0 28px", borderBottom: `2px solid ${NEXT_COLORS.muted}33`, background: "#142428" }}>
      {[NEXT_COLORS.coral, NEXT_COLORS.amber, NEXT_COLORS.lime].map((color) => <span key={color} style={{ width: 18, height: 18, borderRadius: "50%", background: color }} />)}
      <div style={{ marginLeft: 24, color: runtimeTextColor(NEXT_COLORS.ink), fontSize: runtimeFontSize(22), fontWeight: 760 }}>{title}</div>
      {sourceLabel ? <div style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 999, color: runtimeTextColor(accent), background: `${accent}18`, fontSize: runtimeFontSize(16), fontWeight: 800, letterSpacing: 2 }}>{sourceLabel}</div> : <LabOnly><div style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 999, color: runtimeTextColor(accent), background: `${accent}18`, fontSize: runtimeFontSize(16), fontWeight: 800, letterSpacing: 2 }}>BOUND UI</div></LabOnly>}
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 76, bottom: 0 }}>{children}</div>
  </div>
);

const PromptPaste = ({ prompt, state, reveal, accent, sourceLabel }: { prompt: string; state: string; reveal: number; accent: string; sourceLabel?: string }) => {
  const pasted = Math.round(prompt.length * reveal);
  return (
    <BrowserChrome title="Prompt composer" sourceLabel={sourceLabel} accent={accent}>
      <div style={{ padding: 62 }}>
        <div style={{ color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(20), letterSpacing: 3 }}>PROMPT · {state.toUpperCase()}</div>
        <div style={{ minHeight: 330, marginTop: 22, padding: "34px 40px", borderRadius: 24, border: `2px solid ${reveal > 0.95 ? accent : NEXT_COLORS.muted}66`, background: "#0a171a", fontSize: runtimeFontSize(36), lineHeight: 1.5 }}>
          {prompt.slice(0, pasted)}
          {pasted < prompt.length ? <span style={{ color: runtimeTextColor(accent) }}>▌</span> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
          <div style={{ padding: "16px 28px", borderRadius: 14, background: pasted === prompt.length ? accent : NEXT_COLORS.panelRaised, color: runtimeTextColor(pasted === prompt.length ? NEXT_COLORS.background : NEXT_COLORS.muted), fontSize: runtimeFontSize(21), fontWeight: 850 }}>SUBMIT</div>
        </div>
      </div>
    </BrowserChrome>
  );
};

const ResponseStream = ({ chunks, state, reveal, accent, modelLabel }: { chunks: string[]; state: string; reveal: number; accent: string; modelLabel?: string }) => (
  <BrowserChrome title={modelLabel ?? "Director Agent"} sourceLabel={state} accent={accent}>
    <div style={{ padding: "42px 52px", display: "flex", flexDirection: "column", gap: 16 }}>
      {chunks.map((chunk, index) => {
        const local = clamp01(reveal * chunks.length - index);
        return (
          <div key={`${chunk}-${index}`} style={{ display: "flex", gap: 18, padding: "20px 24px", borderRadius: 18, background: index === 0 ? `${accent}12` : "transparent", opacity: local, transform: `translateY(${(1 - local) * 22}px)` }}>
            <div style={{ flex: "0 0 auto", width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 10, background: index === chunks.length - 1 ? accent : NEXT_COLORS.panelRaised, color: runtimeTextColor(index === chunks.length - 1 ? NEXT_COLORS.background : NEXT_COLORS.muted), fontSize: runtimeFontSize(16), fontWeight: 900 }}>{index + 1}</div>
            <div style={{ color: runtimeTextColor(index === chunks.length - 1 ? NEXT_COLORS.ink : NEXT_COLORS.muted), fontSize: runtimeFontSize(28), lineHeight: 1.42 }}>{chunk}</div>
          </div>
        );
      })}
    </div>
  </BrowserChrome>
);

const SelectionControl = ({ options, selectedId, reveal, accent, label }: { options: Array<{ id: string; label: string }>; selectedId: string; reveal: number; accent: string; label?: string }) => (
  <div style={{ position: "absolute", left: 210, right: 210, top: 230, bottom: 160, display: "flex", flexDirection: "column", justifyContent: "center" }}>
    <div style={{ color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(24), letterSpacing: 4 }}>{label ?? "HOST-BOUND OPTIONS"}</div>
    <div style={{ display: "grid", gridTemplateColumns: options.length > 4 ? "1fr 1fr" : "1fr", gap: 18, marginTop: 32 }}>
      {options.map((option, index) => {
        const local = clamp01(reveal * 1.4 - index * 0.08);
        const selected = option.id === selectedId;
        return (
          <div key={option.id} style={{ display: "flex", alignItems: "center", gap: 24, padding: "24px 28px", borderRadius: 20, border: `2px solid ${selected ? accent : NEXT_COLORS.muted}55`, background: selected ? `${accent}18` : NEXT_COLORS.panel, opacity: local, transform: `translateX(${(1 - local) * 60}px)` }}>
            <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", border: `3px solid ${selected ? accent : NEXT_COLORS.muted}`, color: runtimeTextColor(accent), fontSize: runtimeFontSize(20), fontWeight: 900 }}>{selected ? "●" : ""}</div>
            <div style={{ fontSize: runtimeFontSize(31), fontWeight: selected ? 850 : 650 }}>{option.label}</div>
            {selected ? <div style={{ marginLeft: "auto", color: runtimeTextColor(accent), fontSize: runtimeFontSize(18), fontWeight: 850, letterSpacing: 3 }}>SELECTED</div> : null}
          </div>
        );
      })}
    </div>
  </div>
);

const TerminalType = ({ lines, activeLine, reveal, accent, prompt }: { lines: string[]; activeLine: number; reveal: number; accent: string; prompt: string }) => (
  <BrowserChrome title="Terminal" sourceLabel="HOST COMMANDS" accent={accent}>
    <div style={{ padding: "44px 48px", fontFamily: runtimeFontFamily("ui-monospace, SFMono-Regular, monospace"), fontSize: runtimeFontSize(27), lineHeight: 1.62 }}>
      {lines.map((line, index) => {
        const local = clamp01(reveal * lines.length - index);
        return <div key={`${line}-${index}`} style={{ color: runtimeTextColor(index === activeLine ? NEXT_COLORS.ink : NEXT_COLORS.muted), opacity: local }}><span style={{ color: runtimeTextColor(accent) }}>{prompt}</span> {line.slice(0, Math.round(line.length * local))}{index === activeLine && local < 1 ? <span style={{ color: runtimeTextColor(accent) }}>▌</span> : null}</div>;
      })}
    </div>
  </BrowserChrome>
);

const UiMaterialize = ({ elements, activeId, reveal, accent }: { elements: UiElement[]; activeId?: string; reveal: number; accent: string }) => (
  <BrowserChrome title="Interface structure" sourceLabel="MATERIALIZED" accent={accent}>
    <div style={{ position: "absolute", inset: 34, display: "grid", gridTemplateColumns: "250px 1fr", gridTemplateRows: "76px 1fr", gap: 18 }}>
      {elements.map((element, index) => {
        const local = clamp01(reveal * 1.45 - index * 0.1);
        const active = element.id === activeId;
        const grid = element.kind === "toolbar" ? { gridColumn: "1 / 3" } : element.kind === "panel" ? { gridRow: "2", gridColumn: index % 2 === 0 ? "1" : "2" } : {};
        return <div key={element.id} style={{ ...grid, minHeight: element.kind === "chip" ? 72 : 110, padding: 24, borderRadius: 18, border: `2px solid ${active ? accent : NEXT_COLORS.muted}44`, background: active ? `${accent}16` : NEXT_COLORS.panel, opacity: local, transform: `scale(${0.92 + local * 0.08})`, color: runtimeTextColor(active ? accent : NEXT_COLORS.ink), fontSize: runtimeFontSize(24), fontWeight: 760 }}>{element.label}</div>;
      })}
    </div>
  </BrowserChrome>
);

export const UiCore = (props: UiCoreProps) => {
  const { coreId, accentColor = NEXT_COLORS.cyan } = props;
  const motion = useNextCoreMotion(props);
  const title = props.title ?? "Confirmed screen evidence";
  if (coreId === "prompt-paste") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="PROMPT PASTE" accent={accentColor} /><PromptPaste prompt={props.prompt ?? "Use the confirmed transcript to explain the result with one clear visual hierarchy."} state={props.state ?? "ready"} reveal={motion.reveal} accent={accentColor} sourceLabel={props.sourceLabel} /></NextCoreStage>;
  }
  if (coreId === "response-stream") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="RESPONSE STREAM" accent={accentColor} /><ResponseStream chunks={ensureArray(props.chunks, ["Read the confirmed visual paragraph.", "Bind the main and supporting visual objects.", "Select a layout whose capacity fits.", "Explain why this motion improves comprehension."], 8)} state={props.state ?? "complete"} reveal={motion.reveal} accent={accentColor} modelLabel={props.modelLabel} /></NextCoreStage>;
  }
  if (coreId === "selection-control") {
    const options = ensureArray(props.options, [{ id: "a", label: "Person remains the main visual" }, { id: "b", label: "Screen becomes the main visual" }, { id: "c", label: "Evidence comparison" }], 8);
    return <NextCoreStage coreId={coreId}><TextStageHeader title="SELECTION CONTROL" accent={accentColor} /><SelectionControl options={options} selectedId={props.selectedId ?? options[1]?.id ?? ""} reveal={motion.reveal} accent={accentColor} label={props.label} /></NextCoreStage>;
  }
  if (coreId === "terminal-type") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="TERMINAL TYPE" accent={accentColor} /><TerminalType lines={ensureArray(props.lines, ["inspect --timeline current", "bind --object screen-recording", "validate --capacity strict", "render --lab-only"], 10)} activeLine={props.activeLineIndex ?? 3} reveal={motion.reveal} accent={accentColor} prompt={props.prompt ?? "$"} /></NextCoreStage>;
  }
  if (coreId === "ui-materialize") {
    return <NextCoreStage coreId={coreId}><TextStageHeader title="UI MATERIALIZE" accent={accentColor} /><UiMaterialize elements={ensureArray(props.elements, [{ id: "toolbar", label: "Timeline controls", kind: "toolbar" }, { id: "sources", label: "Bound source inventory", kind: "panel" }, { id: "preview", label: "Real preview surface", kind: "panel" }, { id: "status", label: "Validation status", kind: "chip" }], 8)} activeId={props.activeId ?? "preview"} reveal={motion.reveal} accent={accentColor} /></NextCoreStage>;
  }
  if (coreId === "spotlight-scan") {
    const region = props.region ?? { x: 56, y: 34, width: 28, height: 42 };
    const scanX = region.x + (props.reducedMotion ? region.width / 2 : motion.phase * region.width);
    return (
      <NextCoreStage coreId={coreId}>
        <TextStageHeader title="SPOTLIGHT SCAN" accent={accentColor} />
        <BrowserChrome title={title} sourceLabel={props.sourceLabel} accent={accentColor}>{props.content}</BrowserChrome>
        <div style={{ position: "absolute", inset: "231px 125px 100px", pointerEvents: "none", background: `radial-gradient(circle at ${scanX}% ${region.y + region.height / 2}%, transparent 0 10%, rgba(1,5,6,.76) 27%)` }} />
        <div style={{ position: "absolute", left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%`, border: `4px solid ${accentColor}`, borderRadius: 22, boxShadow: `0 0 44px ${accentColor}66` }}><span style={{ position: "absolute", left: 16, top: 14, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(18), fontWeight: 850, letterSpacing: 2 }}>{props.label ?? "FOCUS REGION"}</span></div>
      </NextCoreStage>
    );
  }
  return (
    <NextCoreStage coreId={coreId}>
      <TextStageHeader title="SCREEN FRAME" accent={accentColor} />
      <BrowserChrome title={title} sourceLabel={props.sourceLabel} accent={accentColor}>
        <div style={{ position: "absolute", inset: 0, opacity: motion.reveal, transform: `scale(${0.96 + motion.reveal * 0.04})` }}>{props.content}</div>
      </BrowserChrome>
    </NextCoreStage>
  );
};

const FocusCorners = ({ size, accent }: { size: number; accent: string }) => (
  <>
    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], index) => (
      <div key={index} style={{ position: "absolute", left: x === 0 ? 0 : "auto", right: x === 1 ? 0 : "auto", top: y === 0 ? 0 : "auto", bottom: y === 1 ? 0 : "auto", width: size, height: size, borderLeft: x === 0 ? `7px solid ${accent}` : "none", borderRight: x === 1 ? `7px solid ${accent}` : "none", borderTop: y === 0 ? `7px solid ${accent}` : "none", borderBottom: y === 1 ? `7px solid ${accent}` : "none" }} />
    ))}
  </>
);

export const AnnotationCore = (props: AnnotationCoreProps) => {
  const { coreId, accentColor = NEXT_COLORS.cyan, label } = props;
  const motion = useNextCoreMotion(props);
  if (coreId === "icon-feedback") {
    const palette = props.state === "error" ? NEXT_COLORS.coral : props.state === "warning" ? NEXT_COLORS.amber : props.state === "info" ? NEXT_COLORS.blue : accentColor;
    return (
      <NextCoreStage coreId={coreId}>
        <TextStageHeader title="ICON FEEDBACK" accent={palette} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: motion.reveal, transform: `scale(${0.72 + motion.reveal * 0.28})` }}>
            <div style={{ width: 250, height: 250, display: "grid", placeItems: "center", borderRadius: "50%", border: `9px solid ${palette}`, background: `${palette}18`, color: runtimeTextColor(palette), fontSize: runtimeFontSize(120), fontWeight: 950, boxShadow: `0 0 ${80 + motion.pulse * 15}px ${palette}55` }}>{props.icon ?? (props.state === "warning" ? "!" : props.state === "error" ? "×" : "✓")}</div>
            <div style={{ marginTop: 42, fontSize: runtimeFontSize(58), fontWeight: 900 }}>{label}</div>
            <div style={{ marginTop: 14, color: runtimeTextColor(palette), fontSize: runtimeFontSize(22), fontWeight: 850, letterSpacing: 4 }}>{(props.state ?? "success").toUpperCase()}</div>
          </div>
        </div>
      </NextCoreStage>
    );
  }
  const x = props.targetX ?? 66;
  const y = props.targetY ?? 48;
  const radius = props.radius ?? 16;
  const size = radius * 2;
  return (
    <NextCoreStage coreId={coreId}>
      <div style={{ position: "absolute", inset: 0 }}>{props.content}</div>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${x}% ${y}%, transparent 0 ${radius * 0.72}%, rgba(0,5,6,.72) ${radius + 8}%)`, opacity: motion.reveal }} />
      <div style={{ position: "absolute", left: `${x - size / 2}%`, top: `${y - size / 2}%`, width: `${size}%`, height: `${size}%`, transform: `scale(${0.72 + motion.reveal * 0.28})` }}>
        <FocusCorners size={54} accent={accentColor} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 26, height: 26, margin: -13, borderRadius: "50%", border: `4px solid ${accentColor}`, boxShadow: `0 0 30px ${accentColor}` }} />
        <div style={{ position: "absolute", left: "50%", bottom: -64, padding: "12px 18px", borderRadius: 10, background: `${NEXT_COLORS.background}e8`, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(20), fontWeight: 850, letterSpacing: 2, whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </NextCoreStage>
  );
};
