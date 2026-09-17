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
  runtimeFontSize,
  runtimeTextColor,
  seededUnit,
  useNextCoreMotion,
  type NextCoreMotionProps,
} from "./shared.js";

type SceneCoreId = Extract<
  SmartPackagingNextCoreId,
  | "ambient-particle"
  | "camera-transform"
  | "depth-camera"
  | "particle-celebration"
  | "smear-trail"
  | "space-camera"
  | "speed-ramp"
>;

type TransitionCoreId = Extract<
  SmartPackagingNextCoreId,
  | "cube-transition"
  | "geometric-wipe"
  | "particle-transition"
  | "scene-push"
  | "shared-morph"
  | "texture-dissolve"
  | "theme-transition"
>;

interface DepthLayer {
  id: string;
  label: string;
  content?: ReactNode;
  depth?: number;
  color?: string;
}

interface RatePoint {
  frame: number;
  rate: number;
}

interface SceneCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  coreId: SceneCoreId;
  content?: ReactNode;
  seed?: string | number;
  count?: number;
  density?: number;
  originX?: number;
  originY?: number;
  focusX?: number;
  focusY?: number;
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotation?: number;
  layers?: DepthLayer[];
  focusLayerId?: string;
  parallax?: number;
  travelX?: number;
  travelY?: number;
  depth?: number;
  direction?: "left" | "right" | "up" | "down";
  copies?: number;
  rateCurve?: RatePoint[];
  focusFrame?: number;
  accentColor?: string;
}

interface TransitionCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  coreId: TransitionCoreId;
  fromScene?: ReactNode;
  toScene?: ReactNode;
  seed?: string | number;
  count?: number;
  direction?: "left" | "right" | "up" | "down";
  perspective?: number;
  shape?: "circle" | "diamond" | "bars";
  distance?: number;
  sharedElementId?: string;
  texture?: "grain" | "cells" | "stripes";
  fromTheme?: string;
  toTheme?: string;
  accentColor?: string;
}

const defaultLayers: DepthLayer[] = [
  { id: "back", label: "BACKGROUND", depth: 0.18, color: "#0c2429" },
  { id: "mid", label: "CONTEXT", depth: 0.48, color: "#174149" },
  { id: "focus", label: "FOCUS OBJECT", depth: 0.78, color: NEXT_COLORS.cyan },
  { id: "front", label: "FOREGROUND", depth: 1, color: "#071012" },
];

const SceneHeader = ({ label, accent }: { label: string; accent: string }) => (
  <LabOnly>
    <div style={{ position: "absolute", left: 84, top: 68, zIndex: 100 }}>
      <CoreKicker accent={accent}>{label}</CoreKicker>
    </div>
  </LabOnly>
);

const BoundScene = ({ children, accent, label = "BOUND SCENE" }: { children: ReactNode; accent: string; label?: string }) => (
  <div style={{ position: "absolute", inset: "118px 76px 64px", borderRadius: 30, overflow: "hidden", border: `3px solid ${accent}55`, background: NEXT_COLORS.panel, boxShadow: "0 40px 110px #000b" }}>
    {children}
    <LabOnly><div style={{ position: "absolute", right: 24, bottom: 20, padding: "10px 15px", borderRadius: 9, background: `${NEXT_COLORS.background}df`, color: runtimeTextColor(accent), fontSize: runtimeFontSize(16), fontWeight: 850, letterSpacing: 2 }}>{label}</div></LabOnly>
  </div>
);

interface ParticleSpec {
  x: number;
  y: number;
  size: number;
  speed: number;
  delay: number;
  angle: number;
  colorIndex: number;
}

const particlesFor = (seedInput: string | number, count: number): ParticleSpec[] => {
  const seed = typeof seedInput === "number" ? seedInput : hashSeed(seedInput);
  return Array.from({ length: count }, (_, index) => ({
    x: seededUnit(seed + 3, index) * 100,
    y: seededUnit(seed + 7, index) * 100,
    size: 5 + seededUnit(seed + 11, index) * 18,
    speed: 0.45 + seededUnit(seed + 17, index) * 1.3,
    delay: seededUnit(seed + 23, index),
    angle: seededUnit(seed + 31, index) * Math.PI * 2,
    colorIndex: Math.floor(seededUnit(seed + 41, index) * 4),
  }));
};

const AmbientParticles = ({ specs, phase, reveal, density, accent, staticFrame }: { specs: ParticleSpec[]; phase: number; reveal: number; density: number; accent: string; staticFrame: boolean }) => {
  const colors = [accent, NEXT_COLORS.amber, NEXT_COLORS.violet, NEXT_COLORS.blue];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {specs.map((spec, index) => {
        const localPhase = staticFrame ? 0.62 : (phase * spec.speed + spec.delay) % 1;
        const driftX = Math.sin(localPhase * Math.PI * 2 + spec.angle) * 32 * density;
        const driftY = (0.5 - localPhase) * 110 * density;
        return <span key={index} style={{ position: "absolute", left: `${spec.x}%`, top: `${spec.y}%`, width: spec.size, height: spec.size, borderRadius: index % 4 === 0 ? 4 : "50%", background: colors[spec.colorIndex], opacity: reveal * (0.18 + density * 0.54), transform: `translate(${driftX}px, ${driftY}px) scale(${0.65 + Math.sin(localPhase * Math.PI) * 0.7})`, boxShadow: `0 0 ${spec.size * 2}px ${colors[spec.colorIndex]}66` }} />;
      })}
    </div>
  );
};

const CelebrationParticles = ({ specs, phase, reveal, originX, originY, accent, staticFrame }: { specs: ParticleSpec[]; phase: number; reveal: number; originX: number; originY: number; accent: string; staticFrame: boolean }) => {
  const colors = [accent, NEXT_COLORS.amber, NEXT_COLORS.coral, NEXT_COLORS.violet];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {specs.map((spec, index) => {
        const t = staticFrame ? 0.76 : clamp01((phase - spec.delay * 0.18) * 1.35);
        const distance = 160 + spec.speed * 430;
        const x = Math.cos(spec.angle) * distance * t;
        const y = Math.sin(spec.angle) * distance * t + 510 * t * t;
        return <span key={index} style={{ position: "absolute", left: `${originX}%`, top: `${originY}%`, width: spec.size * 0.72, height: spec.size * 1.7, borderRadius: 4, background: colors[spec.colorIndex], opacity: reveal * (1 - t * 0.5), transform: `translate(${x}px, ${y}px) rotate(${t * 420 + spec.angle * 57}deg)` }} />;
      })}
    </div>
  );
};

const CameraTransform = ({ content, reveal, phase, props, accent }: { content: ReactNode; reveal: number; phase: number; props: SceneCoreProps; accent: string }) => {
  const settle = reveal;
  const breathing = props.reducedMotion ? 0 : Math.sin(phase * Math.PI * 2) * 0.006 * (props.intensity ?? 0.68);
  const scale = 1 + ((props.scale ?? 1.08) - 1) * settle + breathing;
  const tx = (props.translateX ?? -28) * settle;
  const ty = (props.translateY ?? 16) * settle;
  const rotation = (props.rotation ?? -0.8) * settle;
  return (
    <>
      <BoundScene accent={accent}>{<div style={{ position: "absolute", inset: -40, transformOrigin: `${props.focusX ?? 50}% ${props.focusY ?? 50}%`, transform: `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rotation}deg)` }}>{content}</div>}</BoundScene>
      <div style={{ position: "absolute", left: `${props.focusX ?? 50}%`, top: `${props.focusY ?? 50}%`, width: 46, height: 46, margin: -23, borderRadius: "50%", border: `4px solid ${accent}`, boxShadow: `0 0 24px ${accent}`, zIndex: 10, opacity: reveal }} />
    </>
  );
};

const DepthScene = ({ layers, focusId, phase, reveal, parallax, accent, spatial }: { layers: DepthLayer[]; focusId: string; phase: number; reveal: number; parallax: number; accent: string; spatial: boolean }) => (
  <div style={{ position: "absolute", inset: "150px 70px 55px", perspective: spatial ? 1400 : 1000, overflow: "hidden", borderRadius: 30, border: `3px solid ${accent}44`, background: "#030607" }}>
    {layers.map((layer, index) => {
      const depth = layer.depth ?? (index + 1) / layers.length;
      const focused = layer.id === focusId;
      const travel = spatial ? phase : Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
      const x = (travel - 0.5) * parallax * depth * (spatial ? 2.2 : 0.7);
      const y = spatial ? (0.5 - travel) * parallax * depth * 0.8 : (0.5 - travel) * parallax * depth * 0.32;
      const scale = 0.72 + depth * 0.26 + (focused ? 0.035 : 0);
      return <div key={layer.id} style={{ position: "absolute", left: `${8 + index * (70 / Math.max(1, layers.length - 1))}%`, top: `${18 + (index % 2) * 17}%`, width: 500 + depth * 380, height: 500 + depth * 170, marginLeft: -250, borderRadius: 46, overflow: "hidden", border: `4px solid ${focused ? accent : NEXT_COLORS.muted}55`, background: layer.color ?? NEXT_COLORS.panel, transform: `translate3d(${x}px, ${y}px, ${depth * 340}px) scale(${scale}) rotateY(${spatial ? (travel - 0.5) * -9 : 0}deg)`, opacity: reveal * (0.58 + depth * 0.42), filter: focused ? "none" : `blur(${(1 - depth) * 2.5}px)`, boxShadow: focused ? `0 0 60px ${accent}44` : "0 35px 70px #0008", zIndex: index }}>{layer.content ?? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: runtimeTextColor(focused ? NEXT_COLORS.background : NEXT_COLORS.ink), background: layer.color, fontSize: runtimeFontSize(32), fontWeight: 900, letterSpacing: 3 }}>{layer.label}</div>}</div>;
    })}
  </div>
);

const SmearTrail = ({ content, reveal, phase, copies, direction, accent, reducedMotion }: { content: ReactNode; reveal: number; phase: number; copies: number; direction: string; accent: string; reducedMotion?: boolean }) => {
  const axisX = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const speedPulse = reducedMotion ? 0 : Math.sin(phase * Math.PI) * 1;
  return (
    <BoundScene accent={accent}>
      {Array.from({ length: copies }, (_, index) => {
        const rear = copies - index;
        const amount = sign * rear * 28 * speedPulse * reveal;
        return <div key={index} style={{ position: "absolute", inset: 0, transform: `translate(${axisX ? amount : 0}px, ${axisX ? 0 : amount}px)`, opacity: index === copies - 1 ? 1 : reveal * (0.06 + index * 0.035), filter: index === copies - 1 ? "none" : `blur(${4 + rear * 2}px)`, mixBlendMode: index % 2 === 0 ? "screen" : "normal" }}>{content}</div>;
      })}
    </BoundScene>
  );
};

const SpeedRamp = ({ content, frame, duration, reveal, rateCurve, focusFrame, accent, reducedMotion }: { content: ReactNode; frame: number; duration: number; reveal: number; rateCurve: RatePoint[]; focusFrame: number; accent: string; reducedMotion?: boolean }) => {
  const normalized = frame / Math.max(1, duration - 1);
  const nearest = rateCurve.reduce((best, point) => Math.abs(point.frame - frame) < Math.abs(best.frame - frame) ? point : best, rateCurve[0]);
  const rate = reducedMotion ? 1 : nearest?.rate ?? 1;
  const emphasis = 1 - Math.min(1, Math.abs(frame - focusFrame) / Math.max(1, duration * 0.22));
  return (
    <>
      <BoundScene accent={accent}><div style={{ position: "absolute", inset: 0, transform: `scale(${1 + emphasis * 0.045})`, filter: `blur(${Math.max(0, rate - 1) * 1.2}px)` }}>{content}</div></BoundScene>
      <div style={{ position: "absolute", left: 110, right: 110, bottom: 78, height: 9, borderRadius: 99, background: NEXT_COLORS.panelRaised, zIndex: 30 }}><div style={{ width: `${normalized * 100}%`, height: "100%", borderRadius: 99, background: accent }} /><div style={{ position: "absolute", left: `${normalized * 100}%`, top: -10, width: 28, height: 28, marginLeft: -14, borderRadius: "50%", background: accent, boxShadow: `0 0 26px ${accent}` }} /></div>
      <div style={{ position: "absolute", right: 112, top: 145, padding: "14px 20px", borderRadius: 12, background: `${NEXT_COLORS.background}df`, color: runtimeTextColor(accent), fontSize: runtimeFontSize(28), fontWeight: 900, fontVariantNumeric: "tabular-nums", opacity: reveal }}>{rate.toFixed(1)}×</div>
    </>
  );
};

export const SceneCore = (props: SceneCoreProps) => {
  const { coreId, accentColor = NEXT_COLORS.cyan } = props;
  const motion = useNextCoreMotion(props);
  if (coreId === "ambient-particle") {
    const count = Math.max(8, Math.min(70, props.count ?? 42));
    return <NextCoreStage coreId={coreId}><SceneHeader label="AMBIENT PARTICLE" accent={accentColor} /><BoundScene accent={accentColor}>{props.content}</BoundScene><AmbientParticles specs={particlesFor(props.seed ?? "ambient", count)} phase={motion.phase} reveal={motion.reveal} density={Math.max(0.1, Math.min(1, props.density ?? 0.62))} accent={accentColor} staticFrame={Boolean(props.reducedMotion)} /></NextCoreStage>;
  }
  if (coreId === "camera-transform") return <NextCoreStage coreId={coreId}><SceneHeader label="CAMERA TRANSFORM" accent={accentColor} /><CameraTransform content={props.content} reveal={motion.reveal} phase={motion.phase} props={props} accent={accentColor} /></NextCoreStage>;
  if (coreId === "depth-camera" || coreId === "space-camera") {
    const layers = ensureArray(props.layers, defaultLayers, coreId === "space-camera" ? 8 : 6);
    return <NextCoreStage coreId={coreId}><SceneHeader label={coreId === "space-camera" ? "SPACE CAMERA" : "DEPTH CAMERA"} accent={accentColor} /><DepthScene layers={layers} focusId={props.focusLayerId ?? "focus"} phase={props.reducedMotion ? 0.62 : motion.phase} reveal={motion.reveal} parallax={coreId === "space-camera" ? props.depth ?? 145 : props.parallax ?? 80} accent={accentColor} spatial={coreId === "space-camera"} /></NextCoreStage>;
  }
  if (coreId === "particle-celebration") {
    const count = Math.max(12, Math.min(90, props.count ?? 58));
    return <NextCoreStage coreId={coreId}><SceneHeader label="PARTICLE CELEBRATION" accent={accentColor} /><BoundScene accent={accentColor}>{props.content}</BoundScene><CelebrationParticles specs={particlesFor(props.seed ?? "celebrate", count)} phase={motion.phase} reveal={motion.reveal} originX={props.originX ?? 50} originY={props.originY ?? 42} accent={accentColor} staticFrame={Boolean(props.reducedMotion)} /></NextCoreStage>;
  }
  if (coreId === "smear-trail") return <NextCoreStage coreId={coreId}><SceneHeader label="SMEAR TRAIL" accent={accentColor} /><SmearTrail content={props.content} reveal={motion.reveal} phase={motion.phase} copies={Math.max(2, Math.min(8, props.copies ?? 6))} direction={props.direction ?? "right"} accent={accentColor} reducedMotion={props.reducedMotion} /></NextCoreStage>;
  const curve = ensureArray(props.rateCurve, [{ frame: 0, rate: 1 }, { frame: 45, rate: 2.4 }, { frame: 80, rate: 0.45 }, { frame: 120, rate: 1.6 }, { frame: 179, rate: 1 }], 12);
  return <NextCoreStage coreId={coreId}><SceneHeader label="SPEED RAMP" accent={accentColor} /><SpeedRamp content={props.content} frame={motion.frame} duration={motion.durationInFrames} reveal={motion.reveal} rateCurve={curve} focusFrame={props.focusFrame ?? Math.round(motion.durationInFrames * 0.48)} accent={accentColor} reducedMotion={props.reducedMotion} /></NextCoreStage>;
};

const transitionProgress = (phase: number, reducedMotion?: boolean): number => reducedMotion ? 0.72 : clamp01(interpolate(phase, [0.08, 0.82], [0, 1]));

const SceneSurface = ({ children, label, accent }: { children: ReactNode; label: string; accent: string }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: NEXT_COLORS.panel }}>
    {children}
    <div style={{ position: "absolute", left: 34, bottom: 28, padding: "10px 15px", borderRadius: 9, background: `${NEXT_COLORS.background}df`, color: runtimeTextColor(accent), fontSize: runtimeFontSize(16), fontWeight: 850, letterSpacing: 2 }}>{label}</div>
  </div>
);

const CubeBoundary = ({ fromScene, toScene, progress, direction, perspective, accent }: { fromScene: ReactNode; toScene: ReactNode; progress: number; direction: string; perspective: number; accent: string }) => {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const angle = progress * 90 * sign;
  const fromTransform = horizontal ? `rotateY(${angle}deg)` : `rotateX(${-angle}deg)`;
  const toTransform = horizontal ? `rotateY(${angle - 90 * sign}deg)` : `rotateX(${-angle + 90 * sign}deg)`;
  const originFrom = direction === "left" ? "left" : direction === "right" ? "right" : direction === "up" ? "top" : "bottom";
  const originTo = direction === "left" ? "right" : direction === "right" ? "left" : direction === "up" ? "bottom" : "top";
  return (
    <div style={{ position: "absolute", inset: "125px 80px 65px", perspective, background: "#020405", overflow: "hidden", borderRadius: 30, border: `3px solid ${accent}44` }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: originFrom, transform: fromTransform, backfaceVisibility: "hidden" }}><SceneSurface label="FROM" accent={NEXT_COLORS.amber}>{fromScene}</SceneSurface></div>
      <div style={{ position: "absolute", inset: 0, transformOrigin: originTo, transform: toTransform, backfaceVisibility: "hidden" }}><SceneSurface label="TO" accent={accent}>{toScene}</SceneSurface></div>
    </div>
  );
};

const GeometricBoundary = ({ fromScene, toScene, progress, shape, direction, accent }: { fromScene: ReactNode; toScene: ReactNode; progress: number; shape: string; direction: string; accent: string }) => {
  const clip = shape === "circle" ? `circle(${progress * 78}% at 50% 50%)` : shape === "diamond" ? `polygon(50% ${50 - progress * 72}%, ${50 + progress * 72}% 50%, 50% ${50 + progress * 72}%, ${50 - progress * 72}% 50%)` : direction === "right" ? `inset(0 ${100 - progress * 100}% 0 0)` : `inset(0 0 0 ${100 - progress * 100}%)`;
  return (
    <BoundScene accent={accent}><div style={{ position: "absolute", inset: 0 }}><SceneSurface label="FROM" accent={NEXT_COLORS.amber}>{fromScene}</SceneSurface></div><div style={{ position: "absolute", inset: 0, clipPath: clip }}><SceneSurface label="TO" accent={accent}>{toScene}</SceneSurface></div><div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: shape === "bars" ? `repeating-linear-gradient(90deg, transparent 0 9%, ${accent}33 9% 10%)` : "transparent", opacity: 1 - Math.abs(progress - 0.5) * 2 }} /></BoundScene>
  );
};

const ParticleBoundary = ({ fromScene, toScene, progress, specs, direction, accent }: { fromScene: ReactNode; toScene: ReactNode; progress: number; specs: ParticleSpec[]; direction: string; accent: string }) => {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  return (
    <BoundScene accent={accent}>
      <div style={{ position: "absolute", inset: 0, opacity: clamp01(1 - progress * 1.45) }}><SceneSurface label="FROM" accent={NEXT_COLORS.amber}>{fromScene}</SceneSurface></div>
      <div style={{ position: "absolute", inset: 0, opacity: clamp01((progress - 0.28) * 1.45) }}><SceneSurface label="TO" accent={accent}>{toScene}</SceneSurface></div>
      {specs.map((spec, index) => {
        const local = clamp01((progress - spec.delay * 0.34) * 1.6);
        const distance = sign * (240 + spec.speed * 520) * (local - 0.5);
        return <span key={index} style={{ position: "absolute", left: `${spec.x}%`, top: `${spec.y}%`, width: spec.size * 1.8, height: spec.size, borderRadius: 3, background: index % 3 === 0 ? accent : NEXT_COLORS.amber, opacity: Math.sin(local * Math.PI), transform: `translate(${horizontal ? distance : 0}px, ${horizontal ? 0 : distance}px) rotate(${spec.angle * 60 + local * 180}deg)` }} />;
      })}
    </BoundScene>
  );
};

const PushBoundary = ({ fromScene, toScene, progress, direction, distance, accent }: { fromScene: ReactNode; toScene: ReactNode; progress: number; direction: string; distance: number; accent: string }) => {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const from = sign * progress * distance;
  const to = sign * (progress - 1) * distance;
  return (
    <BoundScene accent={accent}><div style={{ position: "absolute", inset: 0, transform: `translate(${horizontal ? from : 0}px, ${horizontal ? 0 : from}px)` }}><SceneSurface label="FROM" accent={NEXT_COLORS.amber}>{fromScene}</SceneSurface></div><div style={{ position: "absolute", inset: 0, transform: `translate(${horizontal ? to : 0}px, ${horizontal ? 0 : to}px)` }}><SceneSurface label="TO" accent={accent}>{toScene}</SceneSurface></div></BoundScene>
  );
};

const SharedMorphBoundary = ({ fromScene, toScene, progress, sharedId, accent }: { fromScene: ReactNode; toScene: ReactNode; progress: number; sharedId: string; accent: string }) => {
  const x = 320 + progress * 1040;
  const y = 680 - Math.sin(progress * Math.PI) * 330;
  const size = 110 + Math.sin(progress * Math.PI) * 70;
  return (
    <BoundScene accent={accent}>
      <div style={{ position: "absolute", inset: 0, opacity: clamp01(1 - progress * 1.25) }}><SceneSurface label="FROM" accent={NEXT_COLORS.amber}>{fromScene}</SceneSurface></div>
      <div style={{ position: "absolute", inset: 0, opacity: clamp01((progress - 0.2) * 1.25) }}><SceneSurface label="TO" accent={accent}>{toScene}</SceneSurface></div>
      <div style={{ position: "absolute", left: x, top: y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, display: "grid", placeItems: "center", borderRadius: 30 + progress * 50, border: `6px solid ${accent}`, background: `${NEXT_COLORS.background}e8`, color: runtimeTextColor(accent), fontSize: runtimeFontSize(21), fontWeight: 900, boxShadow: `0 0 60px ${accent}66`, transform: `rotate(${progress * 180}deg)` }}>{sharedId.slice(0, 3).toUpperCase()}</div>
    </BoundScene>
  );
};

const TextureBoundary = ({ fromScene, toScene, progress, seed, texture, accent }: { fromScene: ReactNode; toScene: ReactNode; progress: number; seed: string | number; texture: string; accent: string }) => {
  const cells = particlesFor(seed, 96);
  return (
    <BoundScene accent={accent}>
      <div style={{ position: "absolute", inset: 0 }}><SceneSurface label="FROM" accent={NEXT_COLORS.amber}>{fromScene}</SceneSurface></div>
      <div style={{ position: "absolute", inset: 0, opacity: progress }}><SceneSurface label="TO" accent={accent}>{toScene}</SceneSurface></div>
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "repeat(8, 1fr)", pointerEvents: "none" }}>
        {cells.map((cell, index) => {
          const threshold = texture === "stripes" ? (index % 12) / 12 : texture === "grain" ? cell.delay : (Math.floor(index / 12) + (index % 12)) / 19;
          const active = clamp01((progress - threshold * 0.58) * 3.1);
          return <div key={index} style={{ background: index % 3 === 0 ? accent : NEXT_COLORS.background, opacity: Math.sin(active * Math.PI) * 0.78, transform: `scale(${0.5 + active * 0.7}) rotate(${cell.angle * 40}deg)` }} />;
        })}
      </div>
    </BoundScene>
  );
};

const ThemeBoundary = ({ fromScene, toScene, progress, fromTheme, toTheme, direction, accent }: { fromScene: ReactNode; toScene: ReactNode; progress: number; fromTheme: string; toTheme: string; direction: string; accent: string }) => {
  const angle = direction === "up" ? 0 : direction === "down" ? 180 : direction === "left" ? 90 : 270;
  return (
    <BoundScene accent={accent}>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - progress }}><SceneSurface label={fromTheme} accent={NEXT_COLORS.amber}>{fromScene}</SceneSurface></div>
      <div style={{ position: "absolute", inset: 0, opacity: progress, filter: `saturate(${0.5 + progress * 0.75})` }}><SceneSurface label={toTheme} accent={accent}>{toScene}</SceneSurface></div>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${angle}deg, transparent ${Math.max(0, progress * 115 - 24)}%, ${accent}aa ${progress * 115}%, transparent ${Math.min(100, progress * 115 + 24)}%)`, mixBlendMode: "screen", opacity: 0.8 }} />
      <div style={{ position: "absolute", left: 34, top: 30, display: "flex", gap: 14, alignItems: "center", padding: "12px 18px", borderRadius: 999, background: `${NEXT_COLORS.background}df`, color: runtimeTextColor(accent), fontSize: runtimeFontSize(18), fontWeight: 850 }}><span>{fromTheme}</span><span>→</span><span>{toTheme}</span></div>
    </BoundScene>
  );
};

export const TransitionCore = (props: TransitionCoreProps) => {
  const { coreId, accentColor = NEXT_COLORS.cyan, fromScene, toScene } = props;
  const motion = useNextCoreMotion(props);
  const progress = transitionProgress(motion.phase, props.reducedMotion);
  const direction = props.direction ?? "left";
  if (coreId === "cube-transition") return <NextCoreStage coreId={coreId}><SceneHeader label="CUBE TRANSITION" accent={accentColor} /><CubeBoundary fromScene={fromScene} toScene={toScene} progress={progress} direction={direction} perspective={props.perspective ?? 1450} accent={accentColor} /></NextCoreStage>;
  if (coreId === "geometric-wipe") return <NextCoreStage coreId={coreId}><SceneHeader label="GEOMETRIC WIPE" accent={accentColor} /><GeometricBoundary fromScene={fromScene} toScene={toScene} progress={progress} shape={props.shape ?? "diamond"} direction={direction} accent={accentColor} /></NextCoreStage>;
  if (coreId === "particle-transition") return <NextCoreStage coreId={coreId}><SceneHeader label="PARTICLE TRANSITION" accent={accentColor} /><ParticleBoundary fromScene={fromScene} toScene={toScene} progress={progress} specs={particlesFor(props.seed ?? "particle-boundary", Math.max(18, Math.min(80, props.count ?? 56)))} direction={direction} accent={accentColor} /></NextCoreStage>;
  if (coreId === "scene-push") return <NextCoreStage coreId={coreId}><SceneHeader label="SCENE PUSH" accent={accentColor} /><PushBoundary fromScene={fromScene} toScene={toScene} progress={progress} direction={direction} distance={Math.max(900, props.distance ?? 1760)} accent={accentColor} /></NextCoreStage>;
  if (coreId === "shared-morph") return <NextCoreStage coreId={coreId}><SceneHeader label="SHARED MORPH" accent={accentColor} /><SharedMorphBoundary fromScene={fromScene} toScene={toScene} progress={progress} sharedId={props.sharedElementId ?? "shared"} accent={accentColor} /></NextCoreStage>;
  if (coreId === "texture-dissolve") return <NextCoreStage coreId={coreId}><SceneHeader label="TEXTURE DISSOLVE" accent={accentColor} /><TextureBoundary fromScene={fromScene} toScene={toScene} progress={progress} seed={props.seed ?? "texture"} texture={props.texture ?? "grain"} accent={accentColor} /></NextCoreStage>;
  return <NextCoreStage coreId={coreId}><SceneHeader label="THEME TRANSITION" accent={accentColor} /><ThemeBoundary fromScene={fromScene} toScene={toScene} progress={progress} fromTheme={props.fromTheme ?? "CALM"} toTheme={props.toTheme ?? "FOCUS"} direction={direction} accent={accentColor} /></NextCoreStage>;
};
