import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
} from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export interface ComponentRuntimeStyle {
  foregroundColor?: string | null;
  backgroundColor?: string | null;
  fontFamily?: string | null;
  fontSizePermille?: number;
  opacityPermille?: number;
  cornerRadiusPermille?: number;
}

export interface ComponentRuntimeClock {
  frame: number;
  fps: number;
  durationInFrames: number;
  speed: number;
}

export interface ComponentRuntimeContextValue extends ComponentRuntimeClock {
  style: ComponentRuntimeStyle;
  transparentStage: boolean;
}

const ComponentRuntimeContext = createContext<ComponentRuntimeContextValue | null>(null);

const safeSpeed = (speed: number | undefined): number =>
  Number.isFinite(speed) && (speed as number) > 0 ? (speed as number) : 1;

export const ComponentRuntimeProvider = ({
  children,
  durationInFrames,
  speed = 1,
  style = {},
  transparentStage = false,
}: {
  children: ReactNode;
  durationInFrames: number;
  speed?: number;
  style?: ComponentRuntimeStyle;
  transparentStage?: boolean;
}) => {
  const hostFrame = useCurrentFrame();
  const video = useVideoConfig();
  const resolvedSpeed = safeSpeed(speed);
  const resolvedDuration = Number.isFinite(durationInFrames) && durationInFrames > 0
    ? Math.max(1, Math.round(durationInFrames))
    : Math.max(1, video.durationInFrames);
  const frame = Math.max(0, Math.floor(hostFrame * resolvedSpeed));
  return (
    <ComponentRuntimeContext.Provider
      value={{
        frame,
        fps: video.fps,
        durationInFrames: resolvedDuration,
        speed: resolvedSpeed,
        style,
        transparentStage,
      }}
    >
      {children}
    </ComponentRuntimeContext.Provider>
  );
};

export const useComponentRuntime = (): ComponentRuntimeContextValue | null =>
  useContext(ComponentRuntimeContext);

export const useComponentRuntimeClock = (): ComponentRuntimeClock => {
  const context = useComponentRuntime();
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  return context ?? {
    frame,
    fps: video.fps,
    durationInFrames: Math.max(1, video.durationInFrames),
    speed: 1,
  };
};

/**
 * Keep authored Core typography in px while making the runtime's shared
 * presentation controls available to every nested text node. The fallback
 * stays the original value when a Core is rendered in the Lab without a
 * runtime provider.
 */
export const runtimeFontSize = (value: number): string =>
  `calc(${value}px * var(--component-font-scale, 1))`;

export const runtimeTextColor = (value: string | null | undefined): string =>
  `var(--component-foreground-color, ${value ?? "inherit"})`;

export const runtimeFontFamily = (value: string | null | undefined): string =>
  `var(--component-font-family, ${value ?? "inherit"})`;

export const runtimeStyleProperties = (
  style: ComponentRuntimeStyle | undefined,
  options?: { includeOpacity?: boolean },
): CSSProperties => {
  if (!style) return {};
  const fontScale = Number.isFinite(style.fontSizePermille)
    ? Math.max(0.25, Math.min(4, (style.fontSizePermille as number) / 1000))
    : 1;
  const opacity = Number.isFinite(style.opacityPermille)
    ? Math.max(0, Math.min(1, (style.opacityPermille as number) / 1000))
    : undefined;
  const radius = Number.isFinite(style.cornerRadiusPermille)
    ? Math.max(0, Math.min(240, (style.cornerRadiusPermille as number) * 0.048))
    : undefined;
  const includeOpacity = options?.includeOpacity ?? true;
  return {
    "--component-font-scale": String(fontScale),
    ...(style.foregroundColor
      ? { "--component-foreground-color": style.foregroundColor }
      : {}),
    ...(style.fontFamily
      ? { "--component-font-family": style.fontFamily }
      : {}),
    ...(style.foregroundColor ? { color: style.foregroundColor } : {}),
    ...(style.backgroundColor ? { background: style.backgroundColor } : {}),
    ...(style.fontFamily ? { fontFamily: style.fontFamily } : {}),
    ...(includeOpacity && opacity !== undefined ? { opacity } : {}),
    ...(radius === undefined ? {} : { borderRadius: radius }),
  } as CSSProperties;
};
