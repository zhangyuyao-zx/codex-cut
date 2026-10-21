import { type ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import {
  LAB_COLORS,
  LabOnly,
  SceneStage,
  clampNumber,
  deterministicNoise,
  percentagePoint,
  runtimeFontSize,
  runtimeTextColor,
  type CoreMotionProps,
  useCoreMotion,
} from "./shared.js";

export interface ChannelDistortionCoreProps extends CoreMotionProps {
  content: ReactNode;
  channelOffset?: number;
  scanlineStrength?: number;
}

export const ChannelDistortionCore = ({
  content,
  channelOffset = 10,
  scanlineStrength = 0.24,
  intensity,
  reducedMotion,
}: ChannelDistortionCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const burst = reducedMotion
    ? 0
    : Math.pow(Math.max(0, Math.sin(motion.phase * Math.PI * 6)), 10) * motion.intensity;
  const offset = clampNumber(channelOffset, 0, 24, 10) * burst;
  const tear = deterministicNoise(motion.frame * 0.31) * offset * 2.2;
  const scan = clampNumber(scanlineStrength, 0, 0.6, 0.24) * motion.intensity;
  return (
    <SceneStage coreId="channel-distortion">
      <AbsoluteFill>{content}</AbsoluteFill>
      {burst > 0.01 ? (
        <>
          <AbsoluteFill style={{ color: runtimeTextColor("#ff273f"), mixBlendMode: "screen", opacity: burst * 0.7, transform: `translateX(${-offset}px)`, clipPath: "inset(12% 0 61% 0)" }}>{content}</AbsoluteFill>
          <AbsoluteFill style={{ color: runtimeTextColor("#1ee9ff"), mixBlendMode: "screen", opacity: burst * 0.7, transform: `translateX(${offset}px)`, clipPath: "inset(57% 0 17% 0)" }}>{content}</AbsoluteFill>
          <AbsoluteFill style={{ transform: `translateX(${tear}px)`, clipPath: "inset(42% 0 44% 0)" }}>{content}</AbsoluteFill>
        </>
      ) : null}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: scan, background: "repeating-linear-gradient(0deg, transparent 0px, transparent 5px, #021013 6px, #021013 8px)", mixBlendMode: "multiply" }} />
      <LabOnly>
        <div style={{ position: "absolute", top: 38, left: 42, color: runtimeTextColor(burst > 0.1 ? LAB_COLORS.coral : LAB_COLORS.muted), fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>
          FINITE CHANNEL EVENT
        </div>
      </LabOnly>
    </SceneStage>
  );
};

export interface KaleidoscopeSymmetryCoreProps extends CoreMotionProps {
  content: ReactNode;
  segments?: number;
  rotationDegrees?: number;
}

export const KaleidoscopeSymmetryCore = ({
  content,
  segments = 6,
  rotationDegrees = 24,
  intensity,
  reducedMotion,
}: KaleidoscopeSymmetryCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const count = Math.round(clampNumber(segments, 4, 10, 6));
  const rotation = (reducedMotion ? 0.18 : motion.phase) * clampNumber(rotationDegrees, -90, 90, 24) * motion.intensity;
  const halfWidth = Math.max(7, 64 / count);
  return (
    <SceneStage coreId="kaleidoscope-symmetry" style={{ background: "#030709" }}>
      {Array.from({ length: count }, (_, index) => (
        <AbsoluteFill
          key={index}
          style={{
            clipPath: `polygon(50% 50%, ${50 - halfWidth}% -8%, ${50 + halfWidth}% -8%)`,
            transform: `rotate(${index * (360 / count) + rotation}deg) scaleX(${index % 2 === 0 ? 1 : -1}) scale(1.25)`,
            transformOrigin: "50% 50%",
            opacity: 0.7 + motion.intensity * 0.3,
          }}
        >
          {content}
        </AbsoluteFill>
      ))}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 80, height: 80, borderRadius: "50%", border: `3px solid ${LAB_COLORS.violet}`, transform: "translate(-50%, -50%)", boxShadow: `0 0 70px ${LAB_COLORS.violet}88` }} />
      <LabOnly><div style={{ position: "absolute", right: 42, top: 38, color: runtimeTextColor(LAB_COLORS.violet), fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>{count} CONTROLLED SLICES</div></LabOnly>
    </SceneStage>
  );
};

export interface LightOverlayCoreProps extends CoreMotionProps {
  content: ReactNode;
  preset?: "glow" | "leak" | "prism";
  hue?: string;
  originX?: number;
  originY?: number;
}

export const LightOverlayCore = ({
  content,
  preset = "leak",
  hue = LAB_COLORS.amber,
  originX = 78,
  originY = 22,
  intensity,
  reducedMotion,
}: LightOverlayCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const x = percentagePoint(originX, 78) + (reducedMotion ? 0 : motion.pulse * 3 * motion.intensity);
  const y = percentagePoint(originY, 22) + (reducedMotion ? 0 : Math.cos(motion.phase * Math.PI * 2) * 2);
  const overlay = preset === "glow"
    ? `radial-gradient(circle at ${x}% ${y}%, ${hue}cc 0%, ${hue}55 18%, transparent 52%)`
    : preset === "prism"
      ? `conic-gradient(from ${motion.phase * 40}deg at ${x}% ${y}%, transparent, #ff6d6d55, #ffdc7855, #70e49a44, #78a9ff55, transparent 42%)`
      : `radial-gradient(ellipse at ${x}% ${y}%, #fff8d9cc 0%, ${hue}77 12%, ${hue}22 34%, transparent 58%)`;
  return (
    <SceneStage coreId="light-overlay">
      <AbsoluteFill>{content}</AbsoluteFill>
      <AbsoluteFill style={{ background: overlay, mixBlendMode: "screen", opacity: 0.18 + motion.intensity * 0.6, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: `linear-gradient(115deg, transparent 18%, ${hue}12 47%, transparent 64%)`, mixBlendMode: "screen", opacity: motion.intensity * 0.55 }} />
      <LabOnly>
        <div style={{ position: "absolute", top: 38, left: 42, color: runtimeTextColor(hue), fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>{preset.toUpperCase()} LIGHT PRESET</div>
      </LabOnly>
    </SceneStage>
  );
};

export interface LiquidBlobCoreProps extends CoreMotionProps {
  content: ReactNode;
  primaryColor?: string;
  secondaryColor?: string;
  morphAmount?: number;
}

export const LiquidBlobCore = ({
  content,
  primaryColor = LAB_COLORS.cyan,
  secondaryColor = LAB_COLORS.violet,
  morphAmount = 0.7,
  intensity,
  reducedMotion,
}: LiquidBlobCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const morph = clampNumber(morphAmount, 0, 1, 0.7) * motion.intensity;
  const wave = reducedMotion ? 0.32 : motion.pulse;
  const cornerA = 42 + wave * 10 * morph;
  const cornerB = 58 - wave * 8 * morph;
  const rotation = reducedMotion ? -2 : motion.pulse * 3 * morph;
  return (
    <SceneStage coreId="liquid-blob" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1320, height: 810, position: "relative", borderRadius: `${cornerA}% ${cornerB}% ${48 - wave * 7 * morph}% ${52 + wave * 8 * morph}% / ${cornerB}% ${cornerA}% ${56 + wave * 6 * morph}% ${44 - wave * 8 * morph}%`, overflow: "hidden", transform: `rotate(${rotation}deg) scale(${0.91 + motion.reveal * 0.09})`, boxShadow: `0 0 0 4px ${primaryColor}aa, 0 42px 130px ${secondaryColor}45`, background: primaryColor }}>
        <AbsoluteFill style={{ transform: `rotate(${-rotation}deg) scale(1.08)` }}>{content}</AbsoluteFill>
        <AbsoluteFill style={{ background: `linear-gradient(135deg, ${primaryColor}44, transparent 50%, ${secondaryColor}33)`, mixBlendMode: "screen", pointerEvents: "none" }} />
      </div>
      <LabOnly>
        <div style={{ position: "absolute", bottom: 40, right: 48, color: runtimeTextColor(primaryColor), fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>BOUNDED CONTENT BLOB</div>
      </LabOnly>
    </SceneStage>
  );
};

export interface LiquidFlowCoreProps extends CoreMotionProps {
  content: ReactNode;
  preset?: "wave" | "oil" | "drip";
  flowDirection?: "left" | "right" | "up" | "down";
  primaryColor?: string;
  secondaryColor?: string;
}

const flowDirectionVector = (direction: LiquidFlowCoreProps["flowDirection"]) => {
  if (direction === "left") return { x: -1, y: 0 };
  if (direction === "up") return { x: 0, y: -1 };
  if (direction === "down") return { x: 0, y: 1 };
  return { x: 1, y: 0 };
};

export const LiquidFlowCore = ({
  content,
  preset = "wave",
  flowDirection = "right",
  primaryColor = LAB_COLORS.cyan,
  secondaryColor = LAB_COLORS.violet,
  intensity,
  reducedMotion,
}: LiquidFlowCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const vector = flowDirectionVector(flowDirection);
  const travel = (reducedMotion ? 0.35 : motion.phase) * 180 * motion.intensity;
  const amplitude = preset === "oil" ? 150 : preset === "drip" ? 90 : 115;
  const phase = (reducedMotion ? 0.4 : motion.phase) * Math.PI * 2;
  const waves = Array.from({ length: 4 }, (_, layer) => {
    const baseY = 360 + layer * 115;
    const a = amplitude * (0.55 + layer * 0.12) * motion.intensity;
    const y1 = baseY + Math.sin(phase + layer) * a;
    const y2 = baseY + Math.cos(phase * 0.8 + layer * 1.3) * a;
    const y3 = baseY + Math.sin(phase * 1.2 + layer * 0.7) * a;
    return `M -260 ${baseY} C 100 ${y1}, 360 ${y2}, 720 ${baseY} S 1340 ${y3}, 2180 ${baseY} L 2180 1160 L -260 1160 Z`;
  });
  return (
    <SceneStage coreId="liquid-flow">
      <AbsoluteFill style={{ transform: `translate(${vector.x * travel}px, ${vector.y * travel}px) scale(1.18)` }}>{content}</AbsoluteFill>
      <AbsoluteFill style={{ mixBlendMode: preset === "oil" ? "color" : "screen", opacity: 0.22 + motion.intensity * 0.34 }}>
        <svg viewBox="0 0 1920 1080" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          {waves.map((path, index) => <path key={index} d={path} fill={index % 2 === 0 ? primaryColor : secondaryColor} opacity={0.2 + index * 0.1} transform={`translate(${vector.x * -travel * (index + 1) * 0.35} ${vector.y * -travel * (index + 1) * 0.35})`} />)}
        </svg>
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 38, left: 42, color: runtimeTextColor(primaryColor), fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>{preset.toUpperCase()} FLOW · {flowDirection.toUpperCase()}</div>
    </SceneStage>
  );
};

export interface LiquidInkCoreProps extends CoreMotionProps {
  content: ReactNode;
  inkColor?: string;
  originX?: number;
  originY?: number;
  splatterCount?: number;
}

export const LiquidInkCore = ({
  content,
  inkColor = "#071417",
  originX = 38,
  originY = 48,
  splatterCount = 9,
  intensity,
  reducedMotion,
}: LiquidInkCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const x = percentagePoint(originX, 38);
  const y = percentagePoint(originY, 48);
  const count = Math.round(clampNumber(splatterCount, 3, 16, 9));
  const expansion = (reducedMotion ? 0.78 : motion.reveal) * (0.65 + motion.intensity * 0.35);
  const droplets = Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399963;
    const distance = 90 + (index % 5) * 54;
    const wobble = deterministicNoise(index + 3.2) * 22;
    return {
      x: 960 * (x / 100) + Math.cos(angle) * (distance + wobble),
      y: 540 * (y / 100) + Math.sin(angle) * (distance + wobble),
      radius: (18 + (index % 4) * 10) * expansion,
    };
  });
  return (
    <SceneStage coreId="liquid-ink">
      <AbsoluteFill>{content}</AbsoluteFill>
      <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "multiply", pointerEvents: "none" }}>
        <circle cx={1920 * (x / 100)} cy={1080 * (y / 100)} r={390 * expansion} fill={inkColor} opacity={0.32 + motion.intensity * 0.28} />
        {droplets.map((drop, index) => <circle key={index} cx={drop.x} cy={drop.y} r={drop.radius} fill={inkColor} opacity={0.24 + (index % 3) * 0.11} />)}
      </svg>
      <LabOnly>
        <div style={{ position: "absolute", right: 42, top: 38, color: runtimeTextColor(LAB_COLORS.amber), fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>{count} DETERMINISTIC SPLATTERS</div>
      </LabOnly>
    </SceneStage>
  );
};

export interface LiquidRippleCoreProps extends CoreMotionProps {
  content: ReactNode;
  originX: number;
  originY: number;
  ringCount?: number;
  amplitude?: number;
  color?: string;
}

export const LiquidRippleCore = ({
  content,
  originX,
  originY,
  ringCount = 5,
  amplitude = 0.65,
  color = LAB_COLORS.cyan,
  intensity,
  reducedMotion,
}: LiquidRippleCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const x = percentagePoint(originX, 50);
  const y = percentagePoint(originY, 50);
  const count = Math.round(clampNumber(ringCount, 2, 8, 5));
  const strength = clampNumber(amplitude, 0, 1, 0.65) * motion.intensity;
  return (
    <SceneStage coreId="liquid-ripple">
      <AbsoluteFill style={{ transform: `scale(${1 + Math.sin(motion.phase * Math.PI * 2) * 0.005 * strength})` }}>{content}</AbsoluteFill>
      {Array.from({ length: count }, (_, index) => {
        const local = reducedMotion ? (index + 1) / (count + 1) : (motion.phase + index / count) % 1;
        const size = 70 + local * 760;
        return <div key={index} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: size, height: size * 0.45, borderRadius: "50%", border: `${2 + strength * 4}px solid ${color}`, transform: "translate(-50%, -50%)", opacity: (1 - local) * strength * 0.78, boxShadow: `0 0 ${18 * strength}px ${color}55` }} />;
      })}
      <LabOnly>
        <div style={{ position: "absolute", left: 42, top: 38, color, fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>EXPLICIT WATER FOCUS</div>
      </LabOnly>
    </SceneStage>
  );
};

export interface LiquidSurfaceCoreProps extends CoreMotionProps {
  content: ReactNode;
  layers?: number;
  amplitude?: number;
  frequency?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

export const LiquidSurfaceCore = ({
  content,
  layers = 4,
  amplitude = 70,
  frequency = 1.2,
  primaryColor = LAB_COLORS.cyan,
  secondaryColor = LAB_COLORS.violet,
  intensity,
  reducedMotion,
}: LiquidSurfaceCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const count = Math.round(clampNumber(layers, 2, 6, 4));
  const waveAmplitude = clampNumber(amplitude, 10, 150, 70) * motion.intensity;
  const waveFrequency = clampNumber(frequency, 0.4, 3, 1.2);
  const phase = (reducedMotion ? 0.42 : motion.phase) * Math.PI * 2;
  return (
    <SceneStage coreId="liquid-surface">
      <AbsoluteFill>{content}</AbsoluteFill>
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "screen", pointerEvents: "none" }}>
        {Array.from({ length: count }, (_, layer) => {
          const baseY = 660 + layer * 88;
          const offset = phase * waveFrequency + layer * 0.9;
          const a = waveAmplitude * (1 - layer * 0.1);
          const path = `M -80 ${baseY} C 180 ${baseY + Math.sin(offset) * a}, 420 ${baseY + Math.cos(offset + 0.8) * a}, 680 ${baseY} S 1140 ${baseY + Math.sin(offset + 1.8) * a}, 1420 ${baseY} S 1770 ${baseY + Math.cos(offset + 2.4) * a}, 2020 ${baseY} L 2020 1160 L -80 1160 Z`;
          return <path key={layer} d={path} fill={layer % 2 === 0 ? primaryColor : secondaryColor} opacity={0.12 + (count - layer) * 0.055 * motion.intensity} />;
        })}
      </svg>
      <LabOnly>
        <div style={{ position: "absolute", right: 42, top: 38, color: runtimeTextColor(primaryColor), fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>{count} PARAMETRIC SURFACE LAYERS</div>
      </LabOnly>
    </SceneStage>
  );
};

export interface LiquidSwirlCoreProps extends CoreMotionProps {
  content: ReactNode;
  originX: number;
  originY: number;
  turns?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

export const LiquidSwirlCore = ({
  content,
  originX,
  originY,
  turns = 2.5,
  primaryColor = LAB_COLORS.cyan,
  secondaryColor = LAB_COLORS.violet,
  intensity,
  reducedMotion,
}: LiquidSwirlCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const x = percentagePoint(originX, 50);
  const y = percentagePoint(originY, 50);
  const resolvedTurns = clampNumber(turns, 1, 5, 2.5);
  const rotation = (reducedMotion ? 22 : motion.phase * 120) * motion.intensity;
  const pathPoints = Array.from({ length: 90 }, (_, index) => {
    const t = index / 89;
    const angle = t * Math.PI * 2 * resolvedTurns;
    const radius = 18 + t * 430;
    return `${index === 0 ? "M" : "L"} ${960 + Math.cos(angle) * radius} ${540 + Math.sin(angle) * radius * 0.62}`;
  }).join(" ");
  return (
    <SceneStage coreId="liquid-swirl">
      <AbsoluteFill style={{ transformOrigin: `${x}% ${y}%`, transform: `rotate(${rotation * 0.08}deg) scale(${1 + motion.intensity * 0.025})` }}>{content}</AbsoluteFill>
      <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transformOrigin: `${x}% ${y}%`, transform: `translate(${(x - 50) * 19.2}px, ${(y - 50) * 10.8}px) rotate(${rotation}deg)`, mixBlendMode: "screen", pointerEvents: "none" }}>
        <path d={pathPoints} fill="none" stroke={primaryColor} strokeWidth={90 * motion.intensity + 18} strokeLinecap="round" opacity={0.34} />
        <path d={pathPoints} fill="none" stroke={secondaryColor} strokeWidth={38 * motion.intensity + 10} strokeLinecap="round" opacity={0.64} />
      </svg>
      <LabOnly>
        <div style={{ position: "absolute", left: 42, top: 38, color: runtimeTextColor(primaryColor), fontWeight: 850, fontSize: runtimeFontSize(18), letterSpacing: 4 }}>BOUNDED SWIRL · {resolvedTurns.toFixed(1)} TURNS</div>
      </LabOnly>
    </SceneStage>
  );
};
