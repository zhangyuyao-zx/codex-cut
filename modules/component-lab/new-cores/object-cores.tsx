import { type ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import {
  DemoMedia,
  LabOnly,
  LAB_COLORS,
  SceneStage,
  arcPath,
  clampNumber,
  displayText,
  polarPoint,
  runtimeFontSize,
  runtimeTextColor,
  type CoreMotionProps,
  useCoreMotion,
} from "./shared.js";

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface AreaChartCoreProps extends CoreMotionProps {
  data: ChartDatum[];
  title: string;
  unit: string;
  accentColor?: string;
  showGrid?: boolean;
}

export const AreaChartCore = ({
  data,
  title,
  unit,
  accentColor = LAB_COLORS.cyan,
  showGrid = true,
  intensity,
  reducedMotion,
}: AreaChartCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const values = data.slice(0, 12).map((datum) => ({
    ...datum,
    value: Number.isFinite(datum.value) ? datum.value : 0,
  }));
  const maximum = Math.max(1, ...values.map((datum) => datum.value));
  const chartWidth = 1120;
  const chartHeight = 450;
  const points = values.map((datum, index) => ({
    x: values.length === 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth,
    y: chartHeight - (datum.value / maximum) * (chartHeight - 44),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
  const revealWidth = chartWidth * motion.reveal;
  const latest = values.at(-1);

  return (
    <SceneStage coreId="area-chart">
      <div style={{ padding: "86px 110px 70px", height: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(24), fontWeight: 850, letterSpacing: 4 }}>
              VERIFIED SERIES
            </div>
            <h1 style={{ fontSize: runtimeFontSize(62), margin: "18px 0 0", lineHeight: 1.08 }}>{displayText(title, 48)}</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: runtimeFontSize(72), fontWeight: 900, color: runtimeTextColor(accentColor) }}>
              {latest?.value ?? 0}
            </div>
            <div style={{ color: runtimeTextColor(LAB_COLORS.muted), fontSize: runtimeFontSize(26) }}>{displayText(unit, 16)}</div>
          </div>
        </div>
        <svg viewBox={`-40 -35 ${chartWidth + 80} ${chartHeight + 110}`} style={{ width: "100%", marginTop: 42, overflow: "visible" }}>
          <defs>
            <linearGradient id="area-fill-new-core" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.55 * motion.intensity} />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.03" />
            </linearGradient>
            <clipPath id="area-reveal-new-core">
              <rect x="-10" y="-10" width={revealWidth + 20} height={chartHeight + 40} />
            </clipPath>
          </defs>
          {showGrid
            ? [0, 0.25, 0.5, 0.75, 1].map((step) => (
                <line
                  key={step}
                  x1="0"
                  x2={chartWidth}
                  y1={chartHeight * step}
                  y2={chartHeight * step}
                  stroke="#aac7c4"
                  strokeOpacity="0.13"
                  strokeWidth="2"
                />
              ))
            : null}
          <g clipPath="url(#area-reveal-new-core)">
            <path d={areaPath} fill="url(#area-fill-new-core)" />
            <path d={linePath} fill="none" stroke={accentColor} strokeWidth="8" strokeLinejoin="round" />
            {points.map((point, index) => (
              <circle key={values[index]?.label ?? index} cx={point.x} cy={point.y} r="10" fill={accentColor} />
            ))}
          </g>
          {values.map((datum, index) => (
            <text
              key={`${datum.label}-axis`}
              x={points[index]?.x ?? 0}
              y={chartHeight + 54}
              textAnchor="middle"
              fill={runtimeTextColor(LAB_COLORS.muted)}
              fontSize={runtimeFontSize(24)}
              fontWeight="650"
            >
              {displayText(datum.label, 9)}
            </text>
          ))}
        </svg>
      </div>
    </SceneStage>
  );
};

export interface ClockDialCoreProps extends CoreMotionProps {
  hour: number;
  minute: number;
  second: number;
  label?: string;
  accentColor?: string;
}

export const ClockDialCore = ({
  hour,
  minute,
  second,
  label = "Confirmed time",
  accentColor = LAB_COLORS.amber,
  intensity,
  reducedMotion,
}: ClockDialCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const safeHour = ((Math.trunc(hour) % 24) + 24) % 24;
  const safeMinute = ((Math.trunc(minute) % 60) + 60) % 60;
  const safeSecond = ((Math.trunc(second) % 60) + 60) % 60;
  const settle = motion.reveal;
  const hourAngle = ((safeHour % 12) + safeMinute / 60) * 30 * settle;
  const minuteAngle = (safeMinute + safeSecond / 60) * 6 * settle;
  const secondAngle = safeSecond * 6 * settle;
  const hand = (angle: number, length: number) => polarPoint(350, 350, length, angle);
  const hourEnd = hand(hourAngle, 150);
  const minuteEnd = hand(minuteAngle, 220);
  const secondEnd = hand(secondAngle, 245);

  return (
    <SceneStage coreId="clock-dial" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 120 }}>
        <svg viewBox="0 0 700 700" style={{ width: 650, height: 650 }}>
          <circle cx="350" cy="350" r="310" fill="#0c1d21" stroke="#d9f5f0" strokeOpacity="0.2" strokeWidth="4" />
          {Array.from({ length: 60 }, (_, index) => {
            const start = polarPoint(350, 350, index % 5 === 0 ? 274 : 290, index * 6);
            const end = polarPoint(350, 350, 306, index * 6);
            return (
              <line
                key={index}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={index % 5 === 0 ? accentColor : "#d9f5f0"}
                strokeOpacity={index % 5 === 0 ? 0.9 : 0.28}
                strokeWidth={index % 5 === 0 ? 8 : 3}
                strokeLinecap="round"
              />
            );
          })}
          <line x1="350" y1="350" x2={hourEnd.x} y2={hourEnd.y} stroke="#eef8f6" strokeWidth="20" strokeLinecap="round" />
          <line x1="350" y1="350" x2={minuteEnd.x} y2={minuteEnd.y} stroke="#c7dcda" strokeWidth="12" strokeLinecap="round" />
          <line x1="350" y1="350" x2={secondEnd.x} y2={secondEnd.y} stroke={accentColor} strokeWidth="6" strokeLinecap="round" />
          <circle cx="350" cy="350" r="21" fill={accentColor} />
        </svg>
        <div style={{ width: 620 }}>
          <div style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(25), fontWeight: 850, letterSpacing: 4 }}>TIME EVIDENCE</div>
          <div style={{ fontSize: runtimeFontSize(118), fontWeight: 900, fontVariantNumeric: "tabular-nums", marginTop: 24 }}>
            {String(safeHour).padStart(2, "0")}:{String(safeMinute).padStart(2, "0")}
            <span style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(58) }}>:{String(safeSecond).padStart(2, "0")}</span>
          </div>
          <div style={{ color: runtimeTextColor(LAB_COLORS.muted), fontSize: runtimeFontSize(34), marginTop: 20 }}>{displayText(label, 32)}</div>
        </div>
      </div>
    </SceneStage>
  );
};

export interface ColorTreatmentCoreProps extends CoreMotionProps {
  content: ReactNode;
  shadowColor: string;
  highlightColor: string;
}

export const ColorTreatmentCore = ({
  content,
  shadowColor,
  highlightColor,
  intensity,
  reducedMotion,
}: ColorTreatmentCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const sweep = 18 + motion.phase * 64;
  return (
    <SceneStage coreId="color-treatment">
      <AbsoluteFill>{content}</AbsoluteFill>
      <AbsoluteFill style={{ background: shadowColor, mixBlendMode: "multiply", opacity: 0.18 + motion.intensity * 0.34 }} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(118deg, transparent 0%, transparent ${Math.max(0, sweep - 24)}%, ${highlightColor} ${sweep}%, transparent ${Math.min(100, sweep + 26)}%)`,
          mixBlendMode: "screen",
          opacity: (0.16 + motion.intensity * 0.26) * motion.reveal,
        }}
      />
      <LabOnly>
        <div style={{ position: "absolute", left: 56, top: 52, padding: "14px 20px", background: "#041013aa", border: `1px solid ${highlightColor}88`, borderRadius: 999, color: runtimeTextColor(highlightColor), fontSize: runtimeFontSize(20), fontWeight: 800, letterSpacing: 3 }}>
          CONTROLLED DUOTONE
        </div>
      </LabOnly>
    </SceneStage>
  );
};

export interface CreditEntry {
  primary: string;
  secondary?: string;
}

export interface CreditsRollCoreProps extends CoreMotionProps {
  title: string;
  entries: CreditEntry[];
  footer?: string;
  accentColor?: string;
}

export const CreditsRollCore = ({
  title,
  entries,
  footer,
  accentColor = LAB_COLORS.violet,
  intensity,
  reducedMotion,
}: CreditsRollCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const visibleEntries = entries.slice(0, 18);
  const trackHeight = Math.max(1, visibleEntries.length) * 92;
  const travel = Math.max(0, trackHeight - 430);
  const offset = reducedMotion ? Math.min(travel, 92) : motion.phase * travel;
  return (
    <SceneStage coreId="credits-roll" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1060, height: 760, display: "grid", gridTemplateColumns: "360px 1fr", background: "#0b171bd9", border: "1px solid #b7d7d126", borderRadius: 42, overflow: "hidden", boxShadow: "0 40px 120px #0009" }}>
        <div style={{ background: `linear-gradient(160deg, ${accentColor}33, transparent 72%)`, padding: "70px 52px", borderRight: "1px solid #b7d7d126" }}>
          <LabOnly><div style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(22), fontWeight: 850, letterSpacing: 4 }}>ROLLING LIST</div></LabOnly>
          <div style={{ fontSize: runtimeFontSize(54), fontWeight: 850, lineHeight: 1.1, marginTop: 26 }}>{displayText(title, 42)}</div>
          <div style={{ color: runtimeTextColor(LAB_COLORS.muted), fontSize: runtimeFontSize(24), marginTop: 28 }}>{visibleEntries.length} entries</div>
        </div>
        <div style={{ padding: "70px 64px", position: "relative", overflow: "hidden" }}>
          <div style={{ transform: `translateY(${-offset}px)` }}>
            {visibleEntries.map((entry, index) => (
              <div key={`${entry.primary}-${index}`} style={{ minHeight: 92, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28, borderBottom: "1px solid #cce4df1f" }}>
                <span style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(18), fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{String(index + 1).padStart(2, "0")}</span>
                <strong style={{ fontSize: runtimeFontSize(29), flex: 1 }}>{displayText(entry.primary, 42)}</strong>
                <span style={{ color: runtimeTextColor(LAB_COLORS.muted), fontSize: runtimeFontSize(22) }}>{displayText(entry.secondary ?? "", 24)}</span>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(#0b171b 0%, transparent 14%, transparent 82%, #0b171b 100%)" }} />
          {footer ? <div style={{ position: "absolute", right: 46, bottom: 30, color: runtimeTextColor(LAB_COLORS.muted), fontSize: runtimeFontSize(18) }}>{displayText(footer, 42)}</div> : null}
        </div>
      </div>
    </SceneStage>
  );
};

export type LoaderState = "loading" | "progress" | "success" | "error";

export interface LoaderIndicatorCoreProps extends CoreMotionProps {
  label: string;
  state: LoaderState;
  progress?: number;
  variant?: "ring" | "dots" | "bar";
  accentColor?: string;
}

export const LoaderIndicatorCore = ({
  label,
  state,
  progress,
  variant = "ring",
  accentColor = LAB_COLORS.cyan,
  intensity,
  reducedMotion,
}: LoaderIndicatorCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const resolvedProgress = state === "success" ? 1 : state === "error" ? 0 : clampNumber(progress, 0, 1, state === "progress" ? 0.62 : 0.3 + motion.phase * 0.5);
  const stateColor = state === "error" ? LAB_COLORS.coral : state === "success" ? "#70e49a" : accentColor;
  const dash = 2 * Math.PI * 118;
  return (
    <SceneStage coreId="loader-indicator" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ minWidth: 790, padding: "86px 100px", borderRadius: 42, background: "#0b181ce8", border: "1px solid #b8d6d12b", textAlign: "center", boxShadow: "0 38px 120px #0009" }}>
        {variant === "bar" ? (
          <div style={{ height: 26, borderRadius: 20, background: "#dff5f21a", overflow: "hidden", margin: "70px 0 72px" }}>
            <div style={{ width: `${resolvedProgress * 100}%`, height: "100%", borderRadius: 20, background: stateColor }} />
          </div>
        ) : variant === "dots" ? (
          <div style={{ height: 260, display: "flex", justifyContent: "center", alignItems: "center", gap: 24 }}>
            {[0, 1, 2].map((index) => {
              const active = reducedMotion
                ? index === 1
                  ? 1
                  : 0.35
                : Math.sin((motion.phase * 3 - index / 3) * Math.PI * 2) *
                    0.5 +
                  0.5;
              return <div key={index} style={{ width: 42, height: 42, borderRadius: "50%", background: stateColor, opacity: 0.28 + active * 0.72, transform: `scale(${0.82 + active * 0.32})` }} />;
            })}
          </div>
        ) : (
          <svg viewBox="0 0 300 300" style={{ width: 270, height: 270 }}>
            <circle cx="150" cy="150" r="118" fill="none" stroke="#dff5f21f" strokeWidth="22" />
            <circle cx="150" cy="150" r="118" fill="none" stroke={stateColor} strokeWidth="22" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={dash * (1 - resolvedProgress)} transform="rotate(-90 150 150)" />
            <text x="150" y="165" textAnchor="middle" fill={runtimeTextColor(LAB_COLORS.ink)} fontSize={runtimeFontSize(52)} fontWeight="900">{state === "loading" ? "…" : `${Math.round(resolvedProgress * 100)}%`}</text>
          </svg>
        )}
        <div style={{ color: runtimeTextColor(stateColor), fontSize: runtimeFontSize(22), fontWeight: 850, letterSpacing: 4, marginTop: 26 }}>{state.toUpperCase()}</div>
        <div style={{ fontSize: runtimeFontSize(42), fontWeight: 760, marginTop: 18 }}>{displayText(label, 32)}</div>
      </div>
    </SceneStage>
  );
};

export interface MediaFrameCoreProps extends CoreMotionProps {
  content: ReactNode;
  caption?: string;
  sourceLabel?: string;
  accentColor?: string;
}

export const MediaFrameCore = ({
  content,
  caption,
  sourceLabel,
  accentColor = LAB_COLORS.amber,
  intensity,
  reducedMotion,
}: MediaFrameCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const scale = interpolate(motion.reveal, [0, 1], [0.92, 1]);
  return (
    <SceneStage coreId="media-frame" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1440, height: 820, padding: 24, background: "#eef2ed", borderRadius: 18, boxShadow: `0 42px 120px #000b, 0 0 ${60 * motion.intensity}px ${accentColor}2d`, transform: `scale(${scale}) rotate(${-0.8 + motion.pulse * 0.18 * motion.intensity}deg)` }}>
        <div style={{ height: caption || sourceLabel ? 700 : "100%", position: "relative", overflow: "hidden", borderRadius: 8, background: "#081114" }}>{content}</div>
        {caption || sourceLabel ? (
          <div style={{ height: 96, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", color: runtimeTextColor("#102024") }}>
            <strong style={{ fontSize: runtimeFontSize(28) }}>{displayText(caption ?? "Evidence frame", 64)}</strong>
            <span style={{ color: runtimeTextColor("#466064"), fontSize: runtimeFontSize(19), fontWeight: 800, letterSpacing: 2 }}>{displayText(sourceLabel ?? "SOURCE", 24)}</span>
          </div>
        ) : null}
      </div>
    </SceneStage>
  );
};

export interface MediaGridItem {
  id: string;
  content: ReactNode;
  label?: string;
  sourceLabel?: string;
}

export interface MediaGridCoreProps extends CoreMotionProps {
  items: MediaGridItem[];
  title?: string;
  columns?: 2 | 3;
  layout?: "grid" | "focus-first";
  accentColor?: string;
}

export const MediaGridCore = ({
  items,
  title = "Evidence set",
  columns = 3,
  layout = "grid",
  accentColor = LAB_COLORS.cyan,
  intensity,
  reducedMotion,
}: MediaGridCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const visibleItems = items.slice(0, 9);
  return (
    <SceneStage coreId="media-grid">
      <div style={{ padding: "66px 78px", height: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 34 }}>
          <h1 style={{ margin: 0, fontSize: runtimeFontSize(50) }}>{displayText(title, 32)}</h1>
          <span style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(22), fontWeight: 850, letterSpacing: 3 }}>{visibleItems.length} VERIFIED MEDIA</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)", gap: 22, height: 850 }}>
          {visibleItems.map((item, index) => {
            const itemReveal = reducedMotion ? 1 : interpolate(motion.frame, [index * 4, index * 4 + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const focused = layout === "focus-first" && index === 0;
            return (
              <div key={item.id} style={{ minHeight: 0, position: "relative", overflow: "hidden", borderRadius: 24, border: `2px solid ${focused ? accentColor : "#b7d7d127"}`, opacity: itemReveal, transform: `translateY(${(1 - itemReveal) * 28}px)`, gridColumn: focused ? "span 2" : undefined, gridRow: focused ? "span 2" : undefined, background: "#0a1518" }}>
                {item.content}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "42px 24px 20px", background: "linear-gradient(transparent, #020607dc)", display: "flex", alignItems: "end", justifyContent: "space-between", gap: 18 }}>
                  <strong style={{ fontSize: runtimeFontSize(focused ? 28 : 21) }}>{displayText(item.label ?? `Media ${index + 1}`, 32)}</strong>
                  <span style={{ color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(15), fontWeight: 850 }}>{displayText(item.sourceLabel ?? "SOURCE", 16)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneStage>
  );
};

export interface RadialChartCoreProps extends CoreMotionProps {
  segments: ChartDatum[];
  title: string;
  unit: string;
  mode?: "donut" | "pie";
  centerLabel?: string;
}

const radialColors = [LAB_COLORS.cyan, LAB_COLORS.amber, LAB_COLORS.violet, LAB_COLORS.coral, "#70e49a", "#78a9ff"];

export const RadialChartCore = ({
  segments,
  title,
  unit,
  mode = "donut",
  centerLabel,
  intensity,
  reducedMotion,
}: RadialChartCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const visible = segments.slice(0, 6).map((segment) => ({ ...segment, value: Math.max(0, Number.isFinite(segment.value) ? segment.value : 0) }));
  const total = visible.reduce((sum, segment) => sum + segment.value, 0) || 1;
  let accumulated = 0;
  const paths = visible.map((segment, index) => {
    const start = (accumulated / total) * 360;
    accumulated += segment.value * motion.reveal;
    const end = (accumulated / total) * 360;
    const outerRadius = 260;
    const innerRadius = mode === "donut" ? 145 : 2;
    const outerStart = polarPoint(320, 320, outerRadius, start);
    const outerEnd = polarPoint(320, 320, outerRadius, Math.max(start + 0.001, end));
    const innerEnd = polarPoint(320, 320, innerRadius, Math.max(start + 0.001, end));
    const innerStart = polarPoint(320, 320, innerRadius, start);
    const largeArc = end - start > 180 ? 1 : 0;
    return {
      segment,
      color: segment.color ?? radialColors[index % radialColors.length],
      d: `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`,
    };
  });
  return (
    <SceneStage coreId="radial-chart" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1510, display: "grid", gridTemplateColumns: "700px 1fr", alignItems: "center", gap: 100 }}>
        <svg viewBox="0 0 640 640" style={{ width: 660, height: 660 }}>
          <circle cx="320" cy="320" r="285" fill="#0d1d21" stroke="#d6f0eb1c" strokeWidth="3" />
          {paths.map(({ segment, color, d }) => <path key={segment.label} d={d} fill={color} stroke="#081114" strokeWidth="8" />)}
          {mode === "donut" ? (
            <>
              <text x="320" y="305" textAnchor="middle" fill={runtimeTextColor(LAB_COLORS.ink)} fontSize={runtimeFontSize(72)} fontWeight="900">{Math.round(total)}</text>
              <text x="320" y="352" textAnchor="middle" fill={runtimeTextColor(LAB_COLORS.muted)} fontSize={runtimeFontSize(25)} fontWeight="750">{displayText(centerLabel ?? unit, 16)}</text>
            </>
          ) : null}
        </svg>
        <div>
          <div style={{ color: runtimeTextColor(LAB_COLORS.cyan), fontSize: runtimeFontSize(24), fontWeight: 850, letterSpacing: 4 }}>VERIFIED DISTRIBUTION</div>
          <h1 style={{ fontSize: runtimeFontSize(62), lineHeight: 1.08, margin: "22px 0 42px" }}>{displayText(title, 32)}</h1>
          <div style={{ display: "grid", gap: 18 }}>
            {paths.map(({ segment, color }) => (
              <div key={`${segment.label}-legend`} style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 18, alignItems: "center", paddingBottom: 16, borderBottom: "1px solid #cce4df1c" }}>
                <i style={{ width: 18, height: 18, borderRadius: 5, background: color }} />
                <span style={{ fontSize: runtimeFontSize(26) }}>{displayText(segment.label, 24)}</span>
                <strong style={{ fontSize: runtimeFontSize(27) }}>{segment.value} {displayText(unit, 10)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SceneStage>
  );
};

export const objectCoreDemoMedia = (index: number): ReactNode => (
  <DemoMedia index={index} label={`MEDIA ${index}`} accent={radialColors[(index - 1) % radialColors.length]} />
);
