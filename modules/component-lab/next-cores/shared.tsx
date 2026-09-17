import { type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
} from "remotion";
import {
  runtimeFontFamily,
  runtimeFontSize,
  runtimeTextColor,
  runtimeStyleProperties,
  useComponentRuntime,
  useComponentRuntimeClock,
} from "../../components/component-runtime-context.js";
import type { SmartPackagingNextCoreId } from "../../shared/smart-packaging-component-next-core.js";

export { runtimeFontFamily, runtimeFontSize, runtimeTextColor } from "../../components/component-runtime-context.js";

export interface NextCoreMotionProps {
  coreId: SmartPackagingNextCoreId;
  intensity?: number;
  reducedMotion?: boolean;
}

export interface NextCoreMotionState {
  frame: number;
  fps: number;
  durationInFrames: number;
  intensity: number;
  reveal: number;
  phase: number;
  pulse: number;
}

export const NEXT_COLORS = {
  background: "#061012",
  panel: "#0d1e22",
  panelRaised: "#153036",
  ink: "#eff9f7",
  muted: "#91a8a8",
  cyan: "#33e2d2",
  amber: "#f5bd67",
  coral: "#ff766e",
  violet: "#9d8cff",
  lime: "#b8ed7d",
  blue: "#70a9ff",
} as const;

export const clampNumber = (
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number =>
  Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(value) ? (value as number) : fallback),
  );

export const clamp01 = (value: number): number =>
  clampNumber(value, 0, 1, 0);

export const useNextCoreMotion = ({
  intensity = 0.68,
  reducedMotion = false,
}: Omit<NextCoreMotionProps, "coreId"> = {}): NextCoreMotionState => {
  const { frame, durationInFrames, fps } = useComponentRuntimeClock();
  const resolvedIntensity = clampNumber(intensity, 0, 1, 0.68);
  const reveal = reducedMotion
    ? 1
    : interpolate(frame, [0, Math.max(1, Math.round(fps * 0.72))], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
  const phase = reducedMotion
    ? 0.62
    : (frame % Math.max(1, durationInFrames)) / Math.max(1, durationInFrames);
  return {
    frame,
    fps,
    durationInFrames,
    intensity: resolvedIntensity,
    reveal,
    phase,
    pulse: reducedMotion ? 0 : Math.sin(phase * Math.PI * 2),
  };
};

export const NextCoreStage = ({
  coreId,
  children,
  style,
}: {
  coreId: SmartPackagingNextCoreId;
  children: ReactNode;
  style?: CSSProperties;
}) => {
  const runtime = useComponentRuntime();
  const hasExplicitBackground = style?.background != null || style?.backgroundColor != null || style?.backgroundImage != null || runtime?.style.backgroundColor != null;
  return (
    <AbsoluteFill
      data-next-core-id={coreId}
      style={{
        overflow: "hidden",
        color: runtimeTextColor(NEXT_COLORS.ink),
        background:
          "radial-gradient(circle at 12% 8%, #173c43 0%, #0a1a1e 38%, #05090b 100%)",
        fontFamily:
          runtimeFontFamily("Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"),
        ...style,
        ...runtimeStyleProperties(runtime?.style, { includeOpacity: false }),
        ...(runtime?.transparentStage && !hasExplicitBackground ? { background: "transparent" } : {}),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const CoreKicker = ({
  children,
  accent = NEXT_COLORS.cyan,
}: {
  children: ReactNode;
  accent?: string;
}) => (
  <div
    style={{
      color: runtimeTextColor(accent),
      fontSize: runtimeFontSize(26),
      fontWeight: 850,
      letterSpacing: 4,
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

/**
 * Keep mechanism labels in the Lab while omitting them from authored runtime
 * output. User supplied titles, labels, and source nodes remain untouched.
 */
export const LabOnly = ({ children }: { children: ReactNode }) =>
  useComponentRuntime() ? null : <>{children}</>;

export const DemoScene = ({
  eyebrow = "CONFIRMED SCENE",
  title = "Evidence remains primary",
  detail = "The component changes presentation, never the underlying fact.",
  accent = NEXT_COLORS.cyan,
}: {
  eyebrow?: string;
  title?: string;
  detail?: string;
  accent?: string;
}) => (
  <AbsoluteFill
    style={{
      justifyContent: "flex-end",
      padding: 110,
      background:
        "linear-gradient(135deg, rgba(4,10,12,.98), rgba(13,39,45,.96))",
    }}
  >
    <div
      style={{
        width: 960,
        paddingLeft: 42,
        borderLeft: `8px solid ${accent}`,
      }}
    >
      <CoreKicker accent={accent}>{eyebrow}</CoreKicker>
      <div
        style={{
          maxWidth: 930,
          marginTop: 20,
          fontSize: runtimeFontSize(82),
          fontWeight: 860,
          lineHeight: 1.04,
        }}
      >
        {title}
      </div>
      <div
        style={{
          maxWidth: 900,
          marginTop: 24,
          color: runtimeTextColor(NEXT_COLORS.muted),
          fontSize: runtimeFontSize(32),
          lineHeight: 1.45,
        }}
      >
        {detail}
      </div>
    </div>
  </AbsoluteFill>
);

export const DemoMedia = ({
  index = 1,
  label = "BOUND MEDIA",
  accent = NEXT_COLORS.amber,
}: {
  index?: number;
  label?: string;
  accent?: string;
}) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      background: `linear-gradient(${118 + index * 11}deg, #091317, #17363d 56%, #070b0d)`,
    }}
  >
    <div
      style={{
        width: 270,
        height: 270,
        display: "grid",
        placeItems: "center",
        border: `5px solid ${accent}`,
        borderRadius: 54,
        color: runtimeTextColor(accent),
        boxShadow: `0 0 100px ${accent}3d`,
        fontSize: runtimeFontSize(92),
        fontWeight: 900,
      }}
    >
      {index}
    </div>
    <div
      style={{
        position: "absolute",
        left: 62,
        bottom: 48,
        color: runtimeTextColor(accent),
        fontSize: runtimeFontSize(22),
        fontWeight: 850,
        letterSpacing: 4,
      }}
    >
      {label}
    </div>
  </AbsoluteFill>
);

export const hashSeed = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const seededUnit = (seed: number, index: number): number => {
  const value = Math.sin((seed + index * 1013) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

export const deterministicNoise = (value: number): number =>
  Math.sin(value * 12.9898) * 0.58 + Math.sin(value * 4.1414 + 1.7) * 0.42;

export const polarPoint = (
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
): { x: number; y: number } => {
  const angle = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
};

export const arcPath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const start = polarPoint(centerX, centerY, radius, endAngle);
  const end = polarPoint(centerX, centerY, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

export const pointsToPath = (
  values: number[],
  width: number,
  height: number,
  padding = 0,
): string => {
  if (values.length === 0) return "";
  const maximum = Math.max(...values, 1);
  const minimum = Math.min(...values, 0);
  const span = Math.max(1, maximum - minimum);
  return values
    .map((value, index) => {
      const x =
        padding +
        (index / Math.max(1, values.length - 1)) * (width - padding * 2);
      const y =
        padding +
        (1 - (value - minimum) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

export const ensureArray = <T,>(
  value: readonly T[] | undefined,
  fallback: readonly T[],
  maximum: number,
): T[] => [...(value && value.length > 0 ? value : fallback)].slice(0, maximum);
