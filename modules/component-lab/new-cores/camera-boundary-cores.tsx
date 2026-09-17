import { type ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
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

export interface CameraOrbitCoreProps extends CoreMotionProps {
  content: ReactNode;
  focusX: number;
  focusY: number;
  yawDegrees?: number;
  pitchDegrees?: number;
  depth?: number;
}

export const CameraOrbitCore = ({
  content,
  focusX,
  focusY,
  yawDegrees = 8,
  pitchDegrees = 4,
  depth = 42,
  intensity,
  reducedMotion,
}: CameraOrbitCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const x = percentagePoint(focusX, 50);
  const y = percentagePoint(focusY, 50);
  const orbit = reducedMotion ? 0.18 : Math.sin(motion.phase * Math.PI * 2);
  const yaw = clampNumber(yawDegrees, -16, 16, 8) * orbit * motion.intensity;
  const pitch = clampNumber(pitchDegrees, -10, 10, 4) * Math.cos(motion.phase * Math.PI * 2) * motion.intensity;
  const translateDepth = clampNumber(depth, 0, 90, 42) * motion.intensity;
  return (
    <SceneStage coreId="camera-orbit" style={{ perspective: 1500 }}>
      <AbsoluteFill
        style={{
          transformOrigin: `${x}% ${y}%`,
          transform: `translateZ(${translateDepth}px) rotateX(${pitch}deg) rotateY(${yaw}deg) scale(1.075)`,
          boxShadow: "inset 0 0 140px #0008",
        }}
      >
        {content}
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: `3px solid ${LAB_COLORS.cyan}`,
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 38px ${LAB_COLORS.cyan}88`,
          opacity: 0.42 * motion.reveal,
        }}
      />
      <LabOnly>
        <div style={{ position: "absolute", left: 46, top: 42, color: runtimeTextColor(LAB_COLORS.cyan), fontSize: runtimeFontSize(18), fontWeight: 850, letterSpacing: 4 }}>
          EXPLICIT FOCAL ORBIT
        </div>
      </LabOnly>
    </SceneStage>
  );
};

export interface CameraShakeCoreProps extends CoreMotionProps {
  content: ReactNode;
  amplitude?: number;
  frequency?: number;
  decay?: number;
}

export const CameraShakeCore = ({
  content,
  amplitude = 14,
  frequency = 1.5,
  decay = 2.8,
  intensity,
  reducedMotion,
}: CameraShakeCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const durationSeconds = Math.max(0.001, motion.durationInFrames / motion.fps);
  const elapsedSeconds = motion.frame / motion.fps;
  const boundedSeconds = Math.min(elapsedSeconds, Math.min(1.4, durationSeconds));
  const envelope = reducedMotion || elapsedSeconds > 1.4
    ? 0
    : Math.exp(-clampNumber(decay, 0.5, 8, 2.8) * boundedSeconds);
  const cycles = clampNumber(frequency, 0.5, 5, 1.5) * boundedSeconds * 10;
  const strength = clampNumber(amplitude, 0, 28, 14) * motion.intensity * envelope;
  const x = deterministicNoise(cycles) * strength;
  const y = deterministicNoise(cycles + 7.13) * strength * 0.72;
  const rotation = deterministicNoise(cycles + 12.6) * strength * 0.08;
  return (
    <SceneStage coreId="camera-shake">
      <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(1.035)` }}>
        {content}
      </AbsoluteFill>
      <LabOnly>
        <div style={{ position: "absolute", left: 46, top: 42, padding: "12px 18px", borderRadius: 999, background: "#081316cc", color: runtimeTextColor(LAB_COLORS.amber), fontSize: runtimeFontSize(18), fontWeight: 850, letterSpacing: 3 }}>
          FINITE DECAY · {Math.round(envelope * 100)}%
        </div>
      </LabOnly>
    </SceneStage>
  );
};

export interface CrossDissolveCoreProps extends CoreMotionProps {
  fromScene: ReactNode;
  toScene: ReactNode;
  startFrame?: number;
  transitionFrames?: number;
  throughBlack?: boolean;
}

export const CrossDissolveCore = ({
  fromScene,
  toScene,
  startFrame,
  transitionFrames = 36,
  throughBlack = false,
  intensity,
  reducedMotion,
}: CrossDissolveCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const duration = Math.round(clampNumber(transitionFrames, 2, Math.max(2, motion.durationInFrames), 36));
  const start = Math.round(clampNumber(startFrame, 0, Math.max(0, motion.durationInFrames - 1), Math.max(0, motion.durationInFrames / 2 - duration / 2)));
  const progress = reducedMotion
    ? motion.frame < start + duration / 2 ? 0 : 1
    : interpolate(motion.frame, [start, start + duration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
  const blackOpacity = throughBlack ? Math.sin(progress * Math.PI) * motion.intensity : 0;
  return (
    <SceneStage coreId="cross-dissolve">
      <AbsoluteFill style={{ opacity: 1 - progress }}>{fromScene}</AbsoluteFill>
      <AbsoluteFill style={{ opacity: progress }}>{toScene}</AbsoluteFill>
      {throughBlack ? <AbsoluteFill style={{ background: "#000", opacity: blackOpacity * 0.72 }} /> : null}
      <LabOnly>
        <div style={{ position: "absolute", right: 44, top: 40, color: runtimeTextColor(LAB_COLORS.cyan), fontSize: runtimeFontSize(18), fontWeight: 850, letterSpacing: 3 }}>
          BOUNDARY {Math.round(progress * 100)}%
        </div>
      </LabOnly>
    </SceneStage>
  );
};

export interface LiquidTransitionCoreProps extends CoreMotionProps {
  fromScene: ReactNode;
  toScene: ReactNode;
  startFrame?: number;
  transitionFrames?: number;
  originX?: number;
  originY?: number;
  accentColor?: string;
}

export const LiquidTransitionCore = ({
  fromScene,
  toScene,
  startFrame,
  transitionFrames = 45,
  originX = 50,
  originY = 50,
  accentColor = LAB_COLORS.violet,
  intensity,
  reducedMotion,
}: LiquidTransitionCoreProps) => {
  const motion = useCoreMotion({ intensity, reducedMotion });
  const duration = Math.round(clampNumber(transitionFrames, 4, Math.max(4, motion.durationInFrames), 45));
  const start = Math.round(clampNumber(startFrame, 0, Math.max(0, motion.durationInFrames - 1), Math.max(0, motion.durationInFrames / 2 - duration / 2)));
  const progress = reducedMotion
    ? motion.frame < start + duration / 2 ? 0 : 1
    : interpolate(motion.frame, [start, start + duration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
  const x = percentagePoint(originX, 50);
  const y = percentagePoint(originY, 50);
  const radius = progress * 150;
  const wobble = reducedMotion ? 0 : Math.sin(progress * Math.PI * 6) * 4 * (1 - progress) * motion.intensity;
  const secondary = [
    { x: x - 12, y: y + 9, factor: 0.7 },
    { x: x + 15, y: y - 7, factor: 0.58 },
    { x: x + 4, y: y + 18, factor: 0.46 },
  ];
  const maskParts = [
    `radial-gradient(circle at ${x}% ${y}%, #000 0 ${Math.max(0, radius + wobble)}%, transparent ${Math.max(0, radius + wobble + 0.7)}%)`,
    ...secondary.map(({ x: pointX, y: pointY, factor }) =>
      `radial-gradient(circle at ${pointX}% ${pointY}%, #000 0 ${Math.max(0, radius * factor)}%, transparent ${Math.max(0, radius * factor + 0.7)}%)`,
    ),
  ].join(", ");
  return (
    <SceneStage coreId="liquid-transition">
      <AbsoluteFill>{fromScene}</AbsoluteFill>
      <AbsoluteFill
        style={{
          WebkitMaskImage: maskParts,
          WebkitMaskComposite: "source-over",
          maskImage: maskParts,
          maskComposite: "add",
        }}
      >
        {toScene}
      </AbsoluteFill>
      {progress > 0 && progress < 1 ? (
        <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: `${radius * 2}%`, aspectRatio: "1", borderRadius: "48% 52% 58% 42% / 44% 56% 44% 56%", border: `5px solid ${accentColor}`, transform: "translate(-50%, -50%)", boxShadow: `0 0 ${40 + 50 * motion.intensity}px ${accentColor}88`, opacity: 0.68 * (1 - Math.abs(progress - 0.5) * 1.4), pointerEvents: "none" }} />
      ) : null}
      <LabOnly>
        <div style={{ position: "absolute", right: 44, top: 40, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(18), fontWeight: 850, letterSpacing: 3 }}>
          LIQUID BOUNDARY {Math.round(progress * 100)}%
        </div>
      </LabOnly>
    </SceneStage>
  );
};
