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

type CompletionDataCoreId = Extract<
  SmartPackagingCatalogCompletionCoreId,
  "map-data" | "metric-card"
>;

interface MapRegion {
  id: string;
  label: string;
  value: number;
  x: number;
  y: number;
}

interface CompletionDataCoreProps {
  coreId: CompletionDataCoreId;
  intensity: number;
  reducedMotion: boolean;
  accentColor?: string;
  title?: string;
  regions?: MapRegion[];
  activeRegionId?: string;
  unit?: string;
  label?: string;
  value?: number;
  delta?: number;
  trend?: "up" | "down" | "flat";
}

const mapPath = "M90 205 L180 126 L286 148 L362 88 L478 118 L562 78 L684 126 L794 96 L930 154 L1010 244 L920 316 L790 298 L690 356 L558 326 L462 370 L350 312 L236 338 L148 286 Z";

export const CompletionDataCore = ({
  coreId,
  intensity,
  reducedMotion,
  accentColor = COMPLETION_COLORS.cyan,
  title = "Verified signal by region",
  regions = [],
  activeRegionId,
  unit = "%",
  label = "Verified components",
  value = 108,
  delta = 13,
  trend = "up",
}: CompletionDataCoreProps) => {
  const { frame, durationInFrames } = useComponentRuntimeClock();
  const runtimeStyle = runtimeStyleProperties(useComponentRuntime()?.style, { includeOpacity: false });
  const amount = clamp01(intensity);

  if (coreId === "map-data") {
    const draw = reducedMotion ? 1 : phase(frame, 6, durationInFrames * 0.42);
    return (
      <AbsoluteFill style={{ background: "linear-gradient(145deg,#0c2024,#071113)", color: runtimeTextColor(COMPLETION_COLORS.text), fontFamily: runtimeFontFamily("Inter, ui-sans-serif, system-ui, sans-serif"), ...runtimeStyle }}>
        <LabOnly><div style={{ position: "absolute", left: 70, top: 48, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(16), fontWeight: 850, letterSpacing: 3 }}>BOUND MAP GEOMETRY</div></LabOnly>
        <div style={{ position: "absolute", left: 70, top: 82, fontSize: runtimeFontSize(39), fontWeight: 920 }}>{title}</div>
        <svg viewBox="0 0 1100 460" style={{ position: "absolute", left: 90, right: 90, top: 150, width: "calc(100% - 180px)", height: 450 }}>
          <path d={mapPath} pathLength={1} fill="#133036" stroke={accentColor} strokeWidth={4} strokeDasharray="1" strokeDashoffset={1 - draw} style={{ filter: `drop-shadow(0 0 ${14 * amount}px ${accentColor}55)` }} />
          {["M210 140 L250 330", "M390 103 L420 350", "M575 92 L610 330", "M770 110 L745 315", "M930 158 L870 305"].map((path, index) => <path key={path} d={path} fill="none" stroke="#2c5157" strokeWidth={2} opacity={draw * (0.55 + index * 0.04)} />)}
          {regions.map((region, index) => {
            const show = reducedMotion ? 1 : phase(frame, 24 + index * 7, 35 + index * 7);
            const active = region.id === activeRegionId;
            const radius = 8 + Math.min(28, Math.abs(region.value) * 0.22);
            return (
              <g key={region.id} opacity={show}>
                <circle cx={region.x} cy={region.y} r={radius + (active && !reducedMotion ? pulse(frame, 42) * 8 : 0)} fill={`${active ? accentColor : COMPLETION_COLORS.amber}33`} stroke={active ? accentColor : COMPLETION_COLORS.amber} strokeWidth={active ? 4 : 2} />
                <text x={region.x + radius + 8} y={region.y - 4} fill={runtimeTextColor(COMPLETION_COLORS.text)} fontSize={runtimeFontSize(18)} fontWeight={800}>{region.label}</text>
                <text x={region.x + radius + 8} y={region.y + 20} fill={runtimeTextColor(active ? accentColor : COMPLETION_COLORS.muted)} fontSize={runtimeFontSize(16)}>{region.value}{unit}</text>
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
    );
  }

  const reveal = reducedMotion ? 1 : phase(frame, 8, durationInFrames * 0.48);
  const displayedValue = Math.round(value * reveal * 10) / 10;
  const trendColor = trend === "up" ? COMPLETION_COLORS.lime : trend === "down" ? COMPLETION_COLORS.coral : COMPLETION_COLORS.muted;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 70% 25%,#18353b,#071113 68%)", color: runtimeTextColor(COMPLETION_COLORS.text), fontFamily: runtimeFontFamily("Inter, ui-sans-serif, system-ui, sans-serif"), display: "grid", placeItems: "center", ...runtimeStyle }}>
      <div style={{ width: 690, padding: "54px 58px", borderRadius: 34, background: "linear-gradient(145deg,#153238ee,#0d2024ee)", border: `2px solid ${accentColor}55`, boxShadow: `0 40px 90px #0009, 0 0 ${30 * amount}px ${accentColor}22` }}>
        <LabOnly><div style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(16), fontWeight: 850, letterSpacing: 3 }}>NUMBER DATA · BOUND</div></LabOnly>
        <div style={{ marginTop: 22, color: runtimeTextColor(COMPLETION_COLORS.muted), fontSize: runtimeFontSize(22), fontWeight: 750 }}>{label}</div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 16 }}>
          <strong style={{ fontSize: runtimeFontSize(112), lineHeight: 1, letterSpacing: -7 }}>{displayedValue}</strong>
          <span style={{ fontSize: runtimeFontSize(28), color: runtimeTextColor(COMPLETION_COLORS.muted) }}>{unit}</span>
        </div>
        <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, color: runtimeTextColor(trendColor), background: `${trendColor}16`, border: `1px solid ${trendColor}55`, fontSize: runtimeFontSize(19), fontWeight: 850 }}>
          <span>{trend === "up" ? "↗" : trend === "down" ? "↘" : "→"}</span>
          <span>{delta > 0 ? "+" : ""}{delta}{unit}</span>
          <span style={{ color: runtimeTextColor(COMPLETION_COLORS.muted), fontWeight: 650 }}>vs previous verified state</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

type CompletionMediaCoreId = Extract<
  SmartPackagingCatalogCompletionCoreId,
  "media-pan-zoom" | "media-treatment"
>;

interface CameraPoint {
  x: number;
  y: number;
  scale: number;
}

interface CompletionMediaCoreProps {
  coreId: CompletionMediaCoreId;
  intensity: number;
  reducedMotion: boolean;
  accentColor?: string;
  content: ReactNode;
  start?: CameraPoint;
  end?: CameraPoint;
  mode?: "grain" | "scanline" | "halftone" | "vignette" | "blur";
  amount?: number;
}

export const CompletionMediaCore = ({
  coreId,
  intensity,
  reducedMotion,
  accentColor = COMPLETION_COLORS.cyan,
  content,
  start = { x: 50, y: 50, scale: 1 },
  end = { x: 58, y: 42, scale: 1.16 },
  mode = "grain",
  amount = 0.62,
}: CompletionMediaCoreProps) => {
  const { frame, durationInFrames } = useComponentRuntimeClock();
  const runtimeStyle = runtimeStyleProperties(useComponentRuntime()?.style, { includeOpacity: false });
  const strength = clamp01(amount * intensity);

  if (coreId === "media-pan-zoom") {
    const t = reducedMotion ? 1 : phase(frame, 4, durationInFrames - 8);
    const x = interpolate(t, [0, 1], [start.x, end.x]);
    const y = interpolate(t, [0, 1], [start.y, end.y]);
    const scale = interpolate(t, [0, 1], [start.scale, end.scale]);
    return (
      <AbsoluteFill style={{ background: COMPLETION_COLORS.background, overflow: "hidden", ...runtimeStyle }}>
        <div style={{ position: "absolute", inset: -90, transformOrigin: `${x}% ${y}%`, transform: `scale(${scale}) translate(${(50 - x) * 0.12}%, ${(50 - y) * 0.12}%)` }}>{content}</div>
        <LabOnly><div style={{ position: "absolute", left: 32, top: 28, padding: "9px 12px", borderRadius: 8, background: "#071113cc", color: runtimeTextColor(accentColor), fontFamily: runtimeFontFamily("ui-monospace, monospace"), fontSize: runtimeFontSize(14), fontWeight: 850, letterSpacing: 2 }}>BOUND FOCUS · {Math.round(x)}:{Math.round(y)} · {scale.toFixed(2)}×</div></LabOnly>
      </AbsoluteFill>
    );
  }

  const grainX = ((frame * 17) % 37) - 18;
  const grainY = ((frame * 29) % 31) - 15;
  const filter = mode === "blur" ? `blur(${strength * 3.2}px)` : "none";
  return (
    <AbsoluteFill style={{ background: COMPLETION_COLORS.background, overflow: "hidden", ...runtimeStyle }}>
      <div style={{ position: "absolute", inset: 0, filter }}>{content}</div>
      {mode === "grain" ? <div style={{ position: "absolute", inset: -24, opacity: 0.2 * strength, transform: reducedMotion ? "none" : `translate(${grainX}px,${grainY}px)`, backgroundImage: "radial-gradient(circle,#fff 0 0.8px,transparent 1px)", backgroundSize: "7px 7px", mixBlendMode: "overlay" }} /> : null}
      {mode === "scanline" ? <div style={{ position: "absolute", inset: 0, opacity: 0.38 * strength, backgroundImage: "repeating-linear-gradient(180deg,transparent 0 4px,#071113 5px 7px)", mixBlendMode: "multiply" }} /> : null}
      {mode === "halftone" ? <div style={{ position: "absolute", inset: 0, opacity: 0.34 * strength, backgroundImage: "radial-gradient(circle,#071113 0 1.6px,transparent 1.8px)", backgroundSize: "8px 8px", mixBlendMode: "multiply" }} /> : null}
      {mode === "vignette" ? <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle,transparent 36%,rgba(0,0,0,${0.78 * strength}) 100%)` }} /> : null}
      <LabOnly><div style={{ position: "absolute", right: 28, bottom: 24, padding: "8px 11px", borderRadius: 8, background: "#071113cc", color: runtimeTextColor(accentColor), fontFamily: runtimeFontFamily("ui-monospace, monospace"), fontSize: runtimeFontSize(13), fontWeight: 850, letterSpacing: 2 }}>TREATMENT · {mode.toUpperCase()}</div></LabOnly>
    </AbsoluteFill>
  );
};

type CompletionRelationCoreId = Extract<
  SmartPackagingCatalogCompletionCoreId,
  "icon-cloud" | "step-progress"
>;

interface RelationItem {
  id: string;
  icon?: string;
  label: string;
  detail?: string;
  state?: "completed" | "current" | "pending";
}

interface CompletionRelationCoreProps {
  coreId: CompletionRelationCoreId;
  intensity: number;
  reducedMotion: boolean;
  accentColor?: string;
  items?: RelationItem[];
  steps?: RelationItem[];
  activeId?: string;
  activeStepId?: string;
  orientation?: "horizontal" | "vertical";
  seed?: string;
  title?: string;
}

export const CompletionRelationCore = ({
  coreId,
  intensity,
  reducedMotion,
  accentColor = COMPLETION_COLORS.cyan,
  items = [],
  steps = [],
  activeId,
  activeStepId,
  orientation = "horizontal",
  seed = "component-catalog",
  title = "One project, reusable decisions",
}: CompletionRelationCoreProps) => {
  const { frame, durationInFrames } = useComponentRuntimeClock();
  const runtimeStyle = runtimeStyleProperties(useComponentRuntime()?.style, { includeOpacity: false });
  const amount = clamp01(intensity);

  if (coreId === "step-progress") {
    const actualSteps = steps.length > 0 ? steps : items;
    const vertical = orientation === "vertical";
    return (
      <AbsoluteFill style={{ background: "linear-gradient(145deg,#0d2024,#071113)", color: runtimeTextColor(COMPLETION_COLORS.text), fontFamily: runtimeFontFamily("Inter, ui-sans-serif, system-ui, sans-serif"), padding: 70, ...runtimeStyle }}>
        <div style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(16), fontWeight: 850, letterSpacing: 3 }}>APPROVED STEP SEQUENCE</div>
        <div style={{ marginTop: 12, fontSize: runtimeFontSize(42), fontWeight: 920 }}>{title}</div>
        <div style={{ position: "absolute", left: 90, right: 90, top: vertical ? 150 : 250, bottom: 70, display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "stretch", gap: vertical ? 22 : 14 }}>
          {actualSteps.map((step, index) => {
            const show = reducedMotion ? 1 : phase(frame, 8 + index * 10, 20 + index * 10);
            const active = step.id === activeStepId || step.state === "current";
            const completed = step.state === "completed" || actualSteps.findIndex((item) => item.id === activeStepId) > index;
            const color = active ? accentColor : completed ? COMPLETION_COLORS.lime : COMPLETION_COLORS.muted;
            return (
              <div key={step.id} style={{ position: "relative", flex: 1, minHeight: vertical ? 82 : 210, padding: vertical ? "18px 24px 18px 84px" : "72px 22px 20px", borderRadius: 18, background: active ? `${accentColor}1c` : COMPLETION_COLORS.panel, border: `1px solid ${active ? accentColor : COMPLETION_COLORS.line}`, opacity: show, transform: vertical ? `translateX(${(1 - show) * -28}px)` : `translateY(${(1 - show) * 28}px)`, boxShadow: active ? `0 0 ${24 * amount}px ${accentColor}30` : "none" }}>
                <div style={{ position: "absolute", left: vertical ? 24 : "50%", top: vertical ? 20 : 18, transform: vertical ? "none" : "translateX(-50%)", width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: completed ? color : "#0a1719", border: `2px solid ${color}`, color: runtimeTextColor(completed ? "#071113" : color), fontWeight: 900 }}>{completed ? "✓" : index + 1}</div>
                <strong style={{ display: "block", color, fontSize: runtimeFontSize(21) }}>{step.label}</strong>
                <span style={{ display: "block", marginTop: 10, color: runtimeTextColor(COMPLETION_COLORS.muted), fontSize: runtimeFontSize(16), lineHeight: 1.4 }}>{step.detail}</span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  const seedValue = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 48%,#15353b,#071113 65%)", color: runtimeTextColor(COMPLETION_COLORS.text), fontFamily: runtimeFontFamily("Inter, ui-sans-serif, system-ui, sans-serif"), ...runtimeStyle }}>
      <div style={{ position: "absolute", left: 60, top: 48, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(16), fontWeight: 850, letterSpacing: 3 }}>APPROVED ENTITY SET</div>
      <div style={{ position: "absolute", left: 60, top: 82, fontSize: runtimeFontSize(40), fontWeight: 920 }}>{title}</div>
      <div style={{ position: "absolute", left: "50%", top: "54%", width: 152, height: 152, transform: "translate(-50%,-50%)", borderRadius: "50%", display: "grid", placeItems: "center", textAlign: "center", background: `${accentColor}18`, border: `2px solid ${accentColor}`, boxShadow: `0 0 ${32 * amount}px ${accentColor}38`, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(20), fontWeight: 900 }}>BOUND<br />PROJECT</div>
      {items.map((item, index) => {
        const angle = (index / Math.max(1, items.length)) * Math.PI * 2 + (seedValue % 19) * 0.03;
        const radiusX = 300 + (index % 3) * 42;
        const radiusY = 190 + (index % 2) * 36;
        const drift = reducedMotion ? 0 : Math.sin(frame * 0.025 + index * 0.9) * 8 * amount;
        const x = Math.cos(angle) * radiusX + drift;
        const y = Math.sin(angle) * radiusY + drift * 0.35;
        const show = reducedMotion ? 1 : phase(frame, 7 + index * 5, 18 + index * 5);
        const active = item.id === activeId;
        return (
          <div key={item.id} style={{ position: "absolute", left: "50%", top: "54%", width: 112, minHeight: 88, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${0.84 + show * 0.16})`, opacity: show, borderRadius: 22, background: active ? `${accentColor}26` : COMPLETION_COLORS.panel, border: `1px solid ${active ? accentColor : COMPLETION_COLORS.line}`, boxShadow: active ? `0 0 ${22 * amount}px ${accentColor}45` : "0 16px 32px #0005", display: "grid", placeItems: "center", padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: runtimeFontSize(30) }}>{item.icon ?? "◆"}</div>
            <strong style={{ color: runtimeTextColor(active ? accentColor : COMPLETION_COLORS.text), fontSize: runtimeFontSize(14) }}>{item.label}</strong>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

interface CompletionSceneCoreProps {
  coreId: "perspective-grid";
  intensity: number;
  reducedMotion: boolean;
  accentColor?: string;
  content: ReactNode;
  horizon?: number;
  density?: number;
}

export const CompletionSceneCore = ({
  intensity,
  reducedMotion,
  accentColor = COMPLETION_COLORS.cyan,
  content,
  horizon = 48,
  density = 10,
}: CompletionSceneCoreProps) => {
  const { frame } = useComponentRuntimeClock();
  const runtimeStyle = runtimeStyleProperties(useComponentRuntime()?.style, { includeOpacity: false });
  const amount = clamp01(intensity);
  const travel = reducedMotion ? 0 : (frame * (0.5 + amount * 1.1)) % 72;
  const rows = Array.from({ length: Math.max(6, Math.round(density)) }, (_, index) => index);
  const columns = Array.from({ length: 17 }, (_, index) => index);
  return (
    <AbsoluteFill style={{ background: COMPLETION_COLORS.background, overflow: "hidden", ...runtimeStyle }}>
      {content}
      <div style={{ position: "absolute", inset: `${horizon}% -12% -40%`, transform: `perspective(700px) rotateX(66deg) translateY(${travel}px)`, transformOrigin: "50% 0", opacity: 0.32 + amount * 0.28, maskImage: "linear-gradient(180deg,transparent,#000 22%,#000 100%)" }}>
        {rows.map((row) => <div key={`r-${row}`} style={{ position: "absolute", left: 0, right: 0, top: row * 72, height: 1, background: accentColor, boxShadow: `0 0 ${4 + amount * 8}px ${accentColor}` }} />)}
        {columns.map((column) => <div key={`c-${column}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${(column / 16) * 100}%`, width: 1, background: accentColor, transformOrigin: "50% 0", transform: `rotate(${(column - 8) * 1.2}deg)` }} />)}
      </div>
      <LabOnly><div style={{ position: "absolute", right: 28, bottom: 24, padding: "8px 11px", borderRadius: 8, background: "#071113cc", color: runtimeTextColor(accentColor), fontFamily: runtimeFontFamily("ui-monospace, monospace"), fontSize: runtimeFontSize(13), fontWeight: 850, letterSpacing: 2 }}>SCENE SURFACE · GRID</div></LabOnly>
    </AbsoluteFill>
  );
};
