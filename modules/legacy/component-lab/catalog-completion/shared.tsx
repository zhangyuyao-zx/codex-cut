import { type ReactNode } from "react";
import { Easing, interpolate } from "remotion";
import {
  runtimeFontFamily,
  runtimeFontSize,
  runtimeTextColor,
  runtimeStyleProperties,
  useComponentRuntime,
} from "../../components/component-runtime-context.js";

export { runtimeFontFamily, runtimeFontSize, runtimeTextColor } from "../../components/component-runtime-context.js";

export const COMPLETION_COLORS = {
  background: "#071113",
  panel: "#0e2024",
  panelStrong: "#153137",
  line: "#29474d",
  text: "#edf8f8",
  muted: "#9ab1b5",
  cyan: "#2dd4d7",
  amber: "#f0b44d",
  coral: "#f5776b",
  lime: "#9cda71",
  violet: "#9b8df1",
} as const;

export const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

export const phase = (
  frame: number,
  start: number,
  end: number,
): number =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 0.82, 0.28, 1),
  });

export const pulse = (frame: number, period: number): number =>
  (Math.sin((frame / Math.max(1, period)) * Math.PI * 2) + 1) / 2;

export interface CompletionStageProps {
  eyebrow: string;
  title: string;
  detail: string;
  children?: ReactNode;
  accent?: string;
}

export const CompletionStage = ({
  eyebrow,
  title,
  detail,
  children,
  accent = COMPLETION_COLORS.cyan,
}: CompletionStageProps) => {
  const runtime = useComponentRuntime();
  const hasExplicitBackground = runtime?.style.backgroundColor !== undefined;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 78% 20%, #15383d 0, #0a181b 38%, #071113 74%)",
        color: runtimeTextColor(COMPLETION_COLORS.text),
        fontFamily: runtimeFontFamily("Inter, ui-sans-serif, system-ui, sans-serif"),
        ...runtimeStyleProperties(runtime?.style, { includeOpacity: false }),
        ...(runtime?.transparentStage && !hasExplicitBackground ? { background: "transparent" } : {}),
      }}
    >
      <LabOnly>
        <div
          style={{
            position: "absolute",
            left: 58,
            top: 48,
            fontSize: runtimeFontSize(16),
            fontWeight: 800,
            letterSpacing: 3.2,
            color: runtimeTextColor(accent),
          }}
        >
          {eyebrow}
        </div>
      </LabOnly>
      <div
        style={{
          position: "absolute",
          left: 58,
          top: 86,
          width: 650,
          fontSize: runtimeFontSize(42),
          lineHeight: 1.08,
          fontWeight: 900,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 190,
          width: 540,
          color: runtimeTextColor(COMPLETION_COLORS.muted),
          fontSize: runtimeFontSize(20),
          lineHeight: 1.45,
        }}
      >
        {detail}
      </div>
      {children}
    </div>
  );
};

/** Keep completion mechanism labels in the Lab only. */
export const LabOnly = ({ children }: { children: ReactNode }) =>
  useComponentRuntime() ? null : <>{children}</>;

export const DemoMedia = ({ label = "BOUND MEDIA" }: { label?: string }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(145deg,#183a40 0%,#11282d 46%,#091316 100%)",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "14%",
        top: "18%",
        width: "72%",
        height: "64%",
        borderRadius: 28,
        background:
          "radial-gradient(circle at 50% 35%,#4f8189 0,#25474d 36%,#102326 75%)",
        boxShadow: "0 36px 80px #0008",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "38%",
          top: "18%",
          width: "24%",
          height: "44%",
          borderRadius: "46% 46% 42% 42%",
          background: "linear-gradient(180deg,#d6e2df,#8aa8a8)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "27%",
          bottom: "8%",
          width: "46%",
          height: "36%",
          borderRadius: "50% 50% 12px 12px",
          background: "linear-gradient(180deg,#284c52,#13272b)",
        }}
      />
    </div>
    <div
      style={{
        position: "absolute",
        left: 28,
        bottom: 24,
        padding: "9px 13px",
        borderRadius: 8,
        background: "#071113cc",
        color: runtimeTextColor(COMPLETION_COLORS.cyan),
        fontSize: runtimeFontSize(14),
        letterSpacing: 2,
        fontWeight: 800,
      }}
    >
      {label}
    </div>
  </div>
);
