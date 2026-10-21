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

export { runtimeFontFamily, runtimeFontSize, runtimeTextColor } from "../../components/component-runtime-context.js";

export interface CoreMotionProps {
  intensity?: number;
  reducedMotion?: boolean;
}

export interface CoreSceneProps extends CoreMotionProps {
  content: ReactNode;
}

export interface CoreMotionState {
  frame: number;
  fps: number;
  durationInFrames: number;
  intensity: number;
  reveal: number;
  phase: number;
  pulse: number;
}

export const LAB_COLORS = {
  background: "#071013",
  panel: "#0d1d21",
  panelRaised: "#12292e",
  ink: "#eef8f6",
  muted: "#8fa5a5",
  cyan: "#31e4d4",
  amber: "#f5bd62",
  coral: "#ff7668",
  violet: "#9d8cff",
} as const;

export const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

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

export const useCoreMotion = ({
  intensity = 0.65,
  reducedMotion = false,
}: CoreMotionProps = {}): CoreMotionState => {
  const { frame, durationInFrames, fps } = useComponentRuntimeClock();
  const resolvedIntensity = clampNumber(intensity, 0, 1, 0.65);
  const reveal = reducedMotion
    ? 1
    : interpolate(frame, [0, Math.max(1, Math.round(fps * 0.7))], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });
  const phase = reducedMotion
    ? 0.64
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

export const SceneStage = ({
  children,
  style,
  coreId,
}: {
  children: ReactNode;
  style?: CSSProperties;
  coreId?: string;
}) => {
  const runtime = useComponentRuntime();
  const hasExplicitBackground = style?.background != null || style?.backgroundColor != null || style?.backgroundImage != null || runtime?.style.backgroundColor != null;
  return (
    <AbsoluteFill
      data-new-core-id={coreId}
      style={{
        overflow: "hidden",
        background:
          "radial-gradient(circle at 18% 12%, #14343b 0%, #09171b 42%, #05090b 100%)",
        color: runtimeTextColor(LAB_COLORS.ink),
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

/**
 * Lab-only implementation labels stay visible in the component lab, but do
 * not become part of a project's authored content when a Core is mounted by
 * the runtime host. The runtime still preserves user supplied labels and
 * source nodes.
 */
export const LabOnly = ({ children }: { children: ReactNode }) =>
  useComponentRuntime() ? null : <>{children}</>;

export const DemoScene = ({
  eyebrow = "CODEX CUT",
  title = "Evidence stays primary",
  detail = "Motion serves the selected visual object.",
  accent = LAB_COLORS.cyan,
}: {
  eyebrow?: string;
  title?: string;
  detail?: string;
  accent?: string;
}) => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(135deg, rgba(5,10,12,0.98), rgba(14,38,43,0.96))",
      padding: 112,
      justifyContent: "flex-end",
    }}
  >
    <div
      style={{
        width: 900,
        borderLeft: `8px solid ${accent}`,
        paddingLeft: 42,
      }}
    >
      <div
        style={{
          color: runtimeTextColor(accent),
          fontSize: runtimeFontSize(28),
          fontWeight: 800,
          letterSpacing: 5,
          marginBottom: 20,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ fontSize: runtimeFontSize(84), fontWeight: 820, lineHeight: 1.05 }}>{title}</div>
      <div
        style={{
          color: runtimeTextColor(LAB_COLORS.muted),
          fontSize: runtimeFontSize(34),
          lineHeight: 1.45,
          marginTop: 26,
        }}
      >
        {detail}
      </div>
    </div>
  </AbsoluteFill>
);

export const DemoMedia = ({
  index = 1,
  label = "SOURCE MEDIA",
  accent = LAB_COLORS.amber,
}: {
  index?: number;
  label?: string;
  accent?: string;
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(${125 + index * 9}deg, #0b171c, #17333a 54%, #091012)`,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        width: 260,
        height: 260,
        borderRadius: "50%",
        border: `5px solid ${accent}`,
        boxShadow: `0 0 90px ${accent}44`,
        display: "grid",
        placeItems: "center",
        fontSize: runtimeFontSize(92),
        fontWeight: 900,
      }}
    >
      {index}
    </div>
    <div
      style={{
        position: "absolute",
        left: 70,
        bottom: 56,
        fontSize: runtimeFontSize(24),
        fontWeight: 800,
        letterSpacing: 4,
        color: runtimeTextColor(accent),
      }}
    >
      {label}
    </div>
  </AbsoluteFill>
);

export const percentagePoint = (
  value: number | undefined,
  fallback: number,
): number => clampNumber(value, 0, 100, fallback);

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

export const displayText = (value: string, maximum = 64): string =>
  value.length <= maximum ? value : `${value.slice(0, Math.max(1, maximum - 1))}…`;
