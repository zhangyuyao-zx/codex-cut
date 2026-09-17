import {prepareSceneModule,type CompiledSceneModuleV1} from "./scene-module-runtime.js";
import { evaluateSceneMotion } from "../contracts/scene-motion.js";
import { ComponentRuntimeRenderer } from "./component-runtime-renderer.js";
import { componentLibraryDefinition, resolveLibraryParameters } from "./component-library.js";
import type { SceneComponentInstanceV1 } from "../contracts/scene-program-contract.js";
import { type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Freeze,
  Img,
  Sequence,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  LAB_COLORS,
  type CoreMotionProps,
} from "../component-lab/new-cores/shared.js";
import type {
  SceneCustomGroupV1,
  SceneProgramMediaTimingV1,
  SceneProgramObjectV1,
  SceneProgramParagraphV1,
  SceneProgramV1,
} from "../contracts/scene-program-contract.js";

export interface SceneProgramRendererPropsV1 {
  program: SceneProgramV1;
  assetUrls: Readonly<Record<string, string>>;
}

export type SceneProgramRenderPrimitiveKindV1 =
  | "PRESERVE_FRAME"
  | "FLOW_NODE"
  | "FLOW_CONNECTOR"
  | "COMPARISON_SIDE"
  | "COMPARISON_DIVIDER"
  | "TIMELINE_TRACK"
  | "TIMELINE_NODE"
  | "DATA_GRID"
  | "DATA_EVIDENCE_ACCENT"
  | "RISK_AXES"
  | "RISK_QUADRANT"
  | "CONCLUSION_HIERARCHY"
  | "CONCLUSION_ACCENT"
  | "PIP_HIERARCHY"
  | "STRUCTURED_EMPHASIS"
  | "CUSTOM_GROUP_BACKPLATE"
  | "CUSTOM_RELATION";

export interface SceneProgramRenderPrimitiveV1 {
  primitiveId: string;
  kind: SceneProgramRenderPrimitiveKindV1;
  objectIds: string[];
  order: number;
  relationship?: string;
  groupKind?: SceneCustomGroupV1["kind"];
}

export interface SceneProgramRenderStructureV1 {
  paragraphId: string;
  patternId: string;
  primitives: SceneProgramRenderPrimitiveV1[];
}

export interface SceneProgramRenderModelV1 {
  programId: string;
  canvas: SceneProgramV1["canvas"];
  paragraphs: Array<{
    paragraphId: string;
    patternId: string;
    objectIds: string[];
    mediaAssetIds: string[];
    resolvedMediaUrls: string[];
    structures: SceneProgramRenderStructureV1;
  }>;
}

export interface SceneProgramMediaSegmentV1 {
  clipId: string;
  assetId: string;
  url: string;
  from: number;
  durationInFrames: number;
  playbackRate: number;
  sourceStartMs: number;
  sourceEndMs: number;
  trimBefore: number;
  trimAfter: number;
}

export interface SceneProgramMediaSegmentsV1 {
  segments: SceneProgramMediaSegmentV1[];
  missingAssetIds: string[];
}

function orderedObjectIds(paragraph: SceneProgramParagraphV1): string[] {
  return paragraph.objects
    .slice()
    .sort((left, right) => left.readingOrder - right.readingOrder || left.zIndex - right.zIndex)
    .map((object) => object.visualObjectId);
}

function primitive(
  paragraph: SceneProgramParagraphV1,
  kind: SceneProgramRenderPrimitiveKindV1,
  objectIds: readonly string[],
  order: number,
  extra: Pick<SceneProgramRenderPrimitiveV1, "relationship" | "groupKind"> = {},
): SceneProgramRenderPrimitiveV1 {
  return {
    primitiveId: `${paragraph.paragraphId}:primitive:${order}:${kind}`,
    kind,
    objectIds: [...objectIds],
    order,
    ...extra,
  };
}

/**
 * Derive the declarative render structure from confirmed program objects.
 * This model contains references and relationships only; geometry continues
 * to come from each compiled Layout object at render time.
 */
export function deriveSceneProgramRenderStructureV1(
  paragraph: SceneProgramParagraphV1,
): SceneProgramRenderStructureV1 {
  const objectIds = orderedObjectIds(paragraph);
  const patternId = paragraph.implementation.kind === "PATTERN"
    ? paragraph.implementation.patternId
    : "CUSTOM_SCENE";
  const primitives: SceneProgramRenderPrimitiveV1[] = [];
  switch (patternId) {
    case "LAYOUT_PRESERVE_V1":
      primitives.push(primitive(paragraph, "PRESERVE_FRAME", objectIds, 0));
      break;
    case "FLOW_V1":
      objectIds.forEach((objectId, index) => primitives.push(primitive(paragraph, "FLOW_NODE", [objectId], index)));
      objectIds.slice(1).forEach((objectId, index) => primitives.push(primitive(paragraph, "FLOW_CONNECTOR", [objectIds[index]!, objectId], objectIds.length + index)));
      break;
    case "COMPARISON_V1":
      objectIds.forEach((objectId, index) => primitives.push(primitive(paragraph, "COMPARISON_SIDE", [objectId], index)));
      primitives.push(primitive(paragraph, "COMPARISON_DIVIDER", objectIds, objectIds.length));
      break;
    case "TIMELINE_V1":
      primitives.push(primitive(paragraph, "TIMELINE_TRACK", objectIds, 0));
      objectIds.forEach((objectId, index) => primitives.push(primitive(paragraph, "TIMELINE_NODE", [objectId], index + 1)));
      break;
    case "DATA_PROOF_V1":
      primitives.push(primitive(paragraph, "DATA_GRID", objectIds, 0));
      objectIds.forEach((objectId, index) => primitives.push(primitive(paragraph, "DATA_EVIDENCE_ACCENT", [objectId], index + 1)));
      break;
    case "RISK_MATRIX_V1":
      primitives.push(primitive(paragraph, "RISK_AXES", objectIds, 0));
      primitives.push(primitive(paragraph, "RISK_QUADRANT", objectIds, 1));
      objectIds.forEach((objectId, index) => primitives.push(primitive(paragraph, "RISK_QUADRANT", [objectId], index + 2)));
      break;
    case "CONCLUSION_V1":
      primitives.push(primitive(paragraph, "CONCLUSION_HIERARCHY", objectIds, 0));
      objectIds.forEach((objectId, index) => primitives.push(primitive(paragraph, "CONCLUSION_ACCENT", [objectId], index + 1)));
      break;
    case "SCREEN_WITH_PERSON_PIP_V1":
      primitives.push(primitive(paragraph, "PIP_HIERARCHY", objectIds, 0));
      break;
    case "PERSON_WITH_STRUCTURED_EMPHASIS_V1":
      primitives.push(primitive(paragraph, "STRUCTURED_EMPHASIS", objectIds, 0));
      break;
    case "CUSTOM_SCENE":
      if (paragraph.implementation.kind !== "CUSTOM_SCENE") break;
      paragraph.implementation.groups
        .slice()
        .sort((left, right) => left.order - right.order)
        .forEach((group) => {
          primitives.push(primitive(paragraph, "CUSTOM_GROUP_BACKPLATE", group.visualObjectIds, group.order, { groupKind: group.kind, relationship: group.relationship }));
          primitives.push(primitive(paragraph, "CUSTOM_RELATION", group.visualObjectIds, group.order, { groupKind: group.kind, relationship: group.relationship }));
        });
      break;
  }
  return { paragraphId: paragraph.paragraphId, patternId, primitives };
}

export function createSceneProgramRenderModelV1(
  program: SceneProgramV1,
  assetUrls: Readonly<Record<string, string>>,
): SceneProgramRenderModelV1 {
  return {
    programId: program.programId,
    canvas: { ...program.canvas },
    paragraphs: program.paragraphs.map((paragraph) => ({
      paragraphId: paragraph.paragraphId,
      patternId: paragraph.implementation.kind === "PATTERN"
        ? paragraph.implementation.patternId
        : "CUSTOM_SCENE",
      objectIds: paragraph.objects.map((object) => object.visualObjectId),
      mediaAssetIds: paragraph.objects.flatMap((object) => object.source.kind === "MEDIA" ? object.source.assetIds : []),
      resolvedMediaUrls: paragraph.objects.flatMap((object) => object.source.kind === "MEDIA"
        ? object.source.assetIds.flatMap((assetId) => typeof assetUrls[assetId] === "string" ? [assetUrls[assetId]] : [])
        : []),
      structures: deriveSceneProgramRenderStructureV1(paragraph),
    })),
  };
}

function rectPixels(
  rect: { xPermille: number; yPermille: number; widthPermille: number; heightPermille: number },
  canvas: SceneProgramV1["canvas"],
): { left: number; top: number; width: number; height: number } {
  return {
    left: (rect.xPermille / 1_000) * canvas.width,
    top: (rect.yPermille / 1_000) * canvas.height,
    width: (rect.widthPermille / 1_000) * canvas.width,
    height: (rect.heightPermille / 1_000) * canvas.height,
  };
}

function readableText(value: string | null, fallback: string): string {
  return value === null || value.trim().length === 0 ? fallback : value;
}

function objectMediaIds(object: SceneProgramObjectV1): string[] {
  return object.source.kind === "MEDIA" ? object.source.assetIds : [];
}

function sourceFrameForMilliseconds(milliseconds: number, framesPerSecond: number): number {
  return Math.max(0, Math.round((milliseconds / 1_000) * framesPerSecond));
}

export function mediaFitStyle(object: Pick<SceneProgramObjectV1,"alignment">): CSSProperties {
  const position = object.alignment === "TOP" ? "center top"
    : object.alignment === "BOTTOM" ? "center bottom"
      : object.alignment === "LEFT" ? "left center"
        : object.alignment === "RIGHT" ? "right center"
          : "center center";
  return {
    height: "100%",
    objectFit: object.alignment === "CENTER" ? "contain" : "cover",
    objectPosition: position,
    width: "100%",
  };
}

function mediaCropStyle(object: SceneProgramObjectV1): CSSProperties {
  const crop = object.crop;
  if (crop === undefined) return { height: "100%", position: "relative", width: "100%" };
  return {
    height: `${100_000 / crop.heightPermille}%`,
    left: `${-(crop.xPermille * 100) / crop.widthPermille}%`,
    position: "absolute",
    top: `${-(crop.yPermille * 100) / crop.heightPermille}%`,
    width: `${100_000 / crop.widthPermille}%`,
  };
}

/**
 * Remotion's trimBefore/trimAfter values are absolute media frame boundaries.
 * Derive them from the exact Timeline intersection instead of letting JSX hide
 * source-time arithmetic that cannot be independently verified.
 */
export function deriveSceneProgramMediaSegmentsV1(
  object: SceneProgramObjectV1,
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  assetUrls: Readonly<Record<string, string>>,
): SceneProgramMediaSegmentsV1 {
  const timings: readonly SceneProgramMediaTimingV1[] = object.source.kind === "MEDIA"
    ? object.source.clipTimings
    : [];
  const segments: SceneProgramMediaSegmentV1[] = [];
  const missingAssetIds: string[] = [];
  for (const timing of timings) {
    if (timing.playbackDirection === "reverse") {
      throw new Error("SCENE_PROGRAM_REVERSE_VIDEO_UNSUPPORTED");
    }
    const url = assetUrls[timing.assetId];
    if (typeof url !== "string" || url.length === 0) {
      missingAssetIds.push(timing.assetId);
      continue;
    }
    const from = Math.max(0, timing.timelineFrameRange.startFrame - paragraph.frameRange.startFrame);
    const durationInFrames = timing.timelineFrameRange.endFrame - timing.timelineFrameRange.startFrame;
    const playbackRate = timing.playbackRate.numerator / timing.playbackRate.denominator;
    const timelineOffsetFrames = timing.timelineFrameRange.startFrame - timing.clipTimelineFrameRange.startFrame;
    const sourceStartMs = timing.sourceRange.startMs
      + (timelineOffsetFrames * 1_000 * timing.playbackRate.numerator)
        / (program.canvas.framesPerSecond * timing.playbackRate.denominator);
    const sourceEndMs = sourceStartMs
      + (durationInFrames * 1_000 * timing.playbackRate.numerator)
        / (program.canvas.framesPerSecond * timing.playbackRate.denominator);
    if (durationInFrames <= 0
      || sourceStartMs < timing.sourceRange.startMs - 1
      || sourceEndMs > timing.sourceRange.endMs + 1) {
      throw new Error("SCENE_PROGRAM_MEDIA_TIMING_INVALID");
    }
    const trimBefore = sourceFrameForMilliseconds(sourceStartMs, program.canvas.framesPerSecond);
    const trimAfter = Math.max(
      trimBefore + 1,
      sourceFrameForMilliseconds(sourceEndMs, program.canvas.framesPerSecond),
    );
    segments.push({
      clipId: timing.clipId,
      assetId: timing.assetId,
      url,
      from,
      durationInFrames,
      playbackRate,
      sourceStartMs,
      sourceEndMs,
      trimBefore,
      trimAfter,
    });
  }
  return { segments, missingAssetIds: [...new Set(missingAssetIds)] };
}

function mediaContent(
  object: SceneProgramObjectV1,
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  assetUrls: Readonly<Record<string, string>>,
): ReactNode {
  const mediaIds = objectMediaIds(object);
  const isVideo = object.kind === "PERSON" || object.kind === "SCREEN_RECORDING" || object.kind === "FOOTAGE";
  if (isVideo) {
    const timings: readonly SceneProgramMediaTimingV1[] = object.source.kind === "MEDIA" ? object.source.clipTimings : [];
    if (timings.some((timing) => timing.playbackDirection === "reverse")) {
      return <div data-scene-adapter-error="SCENE_PROGRAM_REVERSE_VIDEO_UNSUPPORTED" style={{ alignItems: "center", color: LAB_COLORS.coral, display: "flex", fontSize: 18, height: "100%", justifyContent: "center", padding: 18, textAlign: "center" }}>R4 Remotion adapter 不支持反向视频。</div>;
    }
    const mediaSegments = deriveSceneProgramMediaSegmentsV1(object, paragraph, program, assetUrls);
    const segments = mediaSegments.segments.map((segment) => {
      return [
        <Sequence
          key={`${object.visualObjectId}:${segment.clipId}`}
          name={`Media ${segment.clipId}`}
          from={segment.from}
          durationInFrames={segment.durationInFrames}
          premountFor={Math.min(2, segment.from)}
        >
          <OffthreadVideo
            src={segment.url}
            muted
            trimBefore={segment.trimBefore}
            trimAfter={segment.trimAfter}
            playbackRate={segment.playbackRate}
            data-clip-id={segment.clipId}
            data-source-start-ms={String(Math.round(segment.sourceStartMs))}
            data-source-end-ms={String(Math.round(segment.sourceEndMs))}
            data-playback-direction="forward"
            style={mediaFitStyle(object)}
          />
        </Sequence>,
      ];
    });
    if (segments.length > 0) return <div style={mediaCropStyle(object)}>{segments}</div>;
    return (
      <div style={{ alignItems: "center", color: LAB_COLORS.muted, display: "flex", fontSize: 18, height: "100%", justifyContent: "center", padding: 18, textAlign: "center" }}>
        {timings.length === 0 ? `视频对象缺少宿主派生的 Timeline timing：${mediaIds.join(", ")}` : `真实素材 URL 未提供：${mediaSegments.missingAssetIds.join(", ")}`}
      </div>
    );
  }
  const url = mediaIds
    .map((assetId) => assetUrls[assetId])
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  if (url === undefined) {
    return (
      <div style={{ alignItems: "center", color: LAB_COLORS.muted, display: "flex", fontSize: 18, height: "100%", justifyContent: "center", padding: 18, textAlign: "center" }}>
        {mediaIds.length > 0 ? `真实素材 URL 未提供：${mediaIds.join(", ")}` : "该对象没有媒体源"}
      </div>
    );
  }
  return <div style={mediaCropStyle(object)}><Img src={url} style={mediaFitStyle(object)} /></div>;
}

function motionProgress(
  paragraph: SceneProgramParagraphV1,
  object: SceneProgramObjectV1,
  frame: number,
): number {
  if (paragraph.motion) return 1;
  const relevant = paragraph.states
    .filter((state) => state.targetObjectIds.includes(object.visualObjectId))
    .map((state) => state.frame)
    .sort((left, right) => left - right);
  const start = relevant[0] ?? paragraph.frameRange.startFrame;
  const intensity = object.binding.controls.intensityPermille / 1_000;
  const speed = (object.binding.controls.speedPermille ?? 1_000) / 1_000;
  const duration = Math.max(1, Math.round((14 - intensity * 8) / speed));
  return object.binding.controls.reducedMotion
    ? 1
    : interpolate(frame, [start, start + duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

function controlledOpacity(object: SceneProgramObjectV1, progress: number): number {
  const intensity = object.binding.controls.intensityPermille / 1_000;
  return 0.3 + progress * (0.45 + intensity * 0.25);
}

function objectMotionPose(object: SceneProgramObjectV1, paragraph: SceneProgramParagraphV1, frame: number) {
  if (!paragraph.motion) return undefined;
  const life=paragraph.motion.lifetimes.find(l=>l.objectId===object.visualObjectId);
  const manual=object.userLocks?.includes("TIMING") ? object.activeFrameRange : undefined;
  const pose=evaluateSceneMotion(paragraph.motion,object.visualObjectId,frame-(manual&&life?manual.startFrame-life.startFrame:0),object.binding.controls.reducedMotion);
  return manual ? {...pose,visible:frame>=manual.startFrame&&frame<manual.endFrame} : pose;
}

function objectSurfaceStyle(
  object: SceneProgramObjectV1,
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  frame: number,
): CSSProperties {
  const pixel = rectPixels(object.frame, program.canvas);
  const progress = motionProgress(paragraph, object, frame);
  const style = object.style;
  const styleOpacity = (style?.opacityPermille ?? 1_000) / 1_000;
  const pose = objectMotionPose(object, paragraph, frame);
  return {
    background: style?.backgroundColor ?? undefined,
    borderRadius: style === undefined ? undefined : `${style.cornerRadiusPermille / 10}%`,
    boxSizing: "border-box",
    clipPath: pose && pose.drawProgress < 1 ? `inset(0 ${(1-pose.drawProgress)*100}% 0 0)` : undefined,
    height: pixel.height,
    left: pixel.left,
    opacity: (pose?.opacity ?? (0.14 + progress * 0.86)) * styleOpacity,
    overflow: "hidden",
    position: "absolute",
    top: pixel.top,
    transform: pose ? `translate(${pose.translateX * program.canvas.width / 1000}px, ${pose.translateY * program.canvas.height / 1000}px) scale(${pose.scale}) rotate(${pose.rotation}deg)` : `translateY(${(1 - progress) * 12}px)`,
    width: pixel.width,
    zIndex: object.zIndex,
  };
}

function textStyle(program: SceneProgramV1, object: SceneProgramObjectV1): CSSProperties {
  const palette = program.designSystem.palette;
  const local = object.style;
  const baseFontSize = object.kind === "NUMBER" ? 46 : object.textRole === "THESIS" ? 30 : 21;
  return {
    background: local?.backgroundColor ?? undefined,
    borderRadius: local === undefined ? undefined : `${local.cornerRadiusPermille / 10}%`,
    color: local?.foregroundColor ?? (object.textRole === "THESIS" || object.kind === "NUMBER" ? palette.primaryText : palette.secondaryText),
    fontFamily: local?.fontFamily ?? program.designSystem.typography.family,
    fontSize: baseFontSize * ((local?.fontSizePermille ?? 1_000) / 1_000),
    fontWeight: object.textRole === "THESIS" ? program.designSystem.typography.thesisWeight : program.designSystem.typography.bodyWeight,
    lineHeight: 1.25,
    overflow: "hidden",
    padding: 16,
    whiteSpace: "pre-wrap",
  };
}

function requiredEvidenceMessage(componentId: string): ReactNode {
  return <div data-scene-evidence-error={componentId} style={{ alignItems: "center", color: LAB_COLORS.coral, display: "flex", height: "100%", justifyContent: "center", padding: 20, textAlign: "center" }}>宿主未提供该组件所需的实际证据。</div>;
}

function domPrimitive(
  object: SceneProgramObjectV1,
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  frame: number,
  assetUrls: Readonly<Record<string, string>>,
  providedMedia?: ReactNode,
): ReactNode {
  const parameters = object.binding.parameters ?? {};
  const palette = {...program.designSystem.palette,
    ...(typeof parameters.foregroundColor === "string" ? {primaryText:parameters.foregroundColor,secondaryText:parameters.foregroundColor,accent:parameters.foregroundColor} : {}),
    ...(typeof parameters.backgroundColor === "string" ? {surface:parameters.backgroundColor,background:parameters.backgroundColor} : {}),
    ...(object.style?.foregroundColor ? {primaryText:object.style.foregroundColor,secondaryText:object.style.foregroundColor,accent:object.style.foregroundColor} : {}),
    ...(object.style?.backgroundColor ? {surface:object.style.backgroundColor,background:object.style.backgroundColor} : {}),
  };
  const fontFamily = object.style?.fontFamily ?? program.designSystem.typography.family;
  const fontSize = (fallback: number) => (typeof parameters.fontSize === "number" ? parameters.fontSize : fallback) * ((object.style?.fontSizePermille ?? 1000) / 1000);
  const cornerRadius = (fallback: number) => object.style?.cornerRadiusPermille !== undefined ? object.style.cornerRadiusPermille / 10 : typeof parameters.cornerRadius === "number" ? parameters.cornerRadius : fallback;
  const progress = motionProgress(paragraph, object, frame);
  const title = typeof parameters.text === "string" ? parameters.text : readableText(object.text, object.informationDuty);
  const border = `1px solid ${palette.accent}66`;
  const media = providedMedia !== undefined ? <div style={{position:"relative",height:"100%",width:"100%"}}>{providedMedia}</div> : mediaContent(object, paragraph, program, assetUrls);
  switch (object.binding.rendererId) {
    case "component-stage-person-full":
      return <div data-scene-adapter="stage-person-full" style={{ border: `2px solid ${palette.accent}44`, height: "100%", overflow: "hidden", width: "100%" }}>{media}</div>;
    case "component-stage-screen-main":
      return <div data-scene-adapter="stage-screen-main" style={{ background: palette.background, border: `2px solid ${palette.accent}`, borderRadius: cornerRadius(12), height: "100%", overflow: "hidden", width: "100%" }}>{media}</div>;
    case "component-stage-evidence-main":
      return <div data-scene-adapter="stage-evidence-main" style={{ background: palette.surface, border, borderRadius: cornerRadius(14), height: "100%", overflow: "hidden", width: "100%" }}>{media}</div>;
    case "component-stage-detail-inset":
      return <div data-scene-adapter="stage-detail-inset" style={{ background: palette.surface, border, borderRadius: cornerRadius(18), height: "100%", overflow: "hidden", padding: 10, width: "100%" }}>{media}</div>;
    case "component-stage-person-pip-circle":
      return <div style={{width:"100%",height:"100%",containerType:"size",display:"grid",placeItems:"center"}}><div data-scene-adapter="stage-person-pip-circle" style={{ border: `3px solid ${palette.accent}`, boxSizing:"border-box", borderRadius: "50%", height: "min(100cqw, 100cqh)", overflow: "hidden", width: "min(100cqw, 100cqh)" }}>{media}</div></div>;
    case "component-text-clean-card":
      return <div style={{ background: `${palette.surface}ee`, border, borderRadius: cornerRadius(16), boxShadow: `0 18px 38px ${palette.background}88`, color: palette.primaryText, fontFamily, fontSize: fontSize(26), fontWeight: program.designSystem.typography.thesisWeight, opacity: progress, padding: 20 }}>{title}</div>;
    case "component-text-marker-underline":
      return <div style={{ color: palette.primaryText, fontFamily, fontSize: fontSize(25), fontWeight: program.designSystem.typography.thesisWeight, padding: 12 }}>{title}<div style={{ background: palette.accent, height: 5, marginTop: 8, transform: `scaleX(${progress})`, transformOrigin: "left", width: "100%" }} /></div>;
    case "component-text-context-label":
      return <div style={{ background: `${palette.surface}dd`, borderLeft: `5px solid ${palette.accent}`, color: palette.secondaryText, fontFamily, fontSize: fontSize(20), padding: "12px 18px" }}><span style={{ color: palette.accent }}>{title}</span></div>;
    case "component-text-mini-explanation":
      return <div style={{ background: `${palette.surface}e8`, border, borderRadius: cornerRadius(14), color: palette.secondaryText, fontFamily, fontSize: fontSize(20), lineHeight: 1.35, padding: 18 }}>{title}</div>;
    case "component-screen-smart-zoom-restore":
      return <div data-scene-adapter="screen-smart-zoom-restore" style={{ background: `${palette.background}55`, border: `2px solid ${palette.accent}`, borderRadius: cornerRadius(12), height: "100%", opacity: paragraph.motion ? 1 : controlledOpacity(object, progress), overflow: "hidden", width: "100%" }}>{media}</div>;
    case "component-screen-spotlight-dim":
      return <div data-scene-adapter="screen-spotlight-dim" style={{ background: `${palette.background}88`, border: `2px solid ${palette.accent}`, borderRadius: cornerRadius(12), height: "100%", opacity: paragraph.motion ? 1 : controlledOpacity(object, progress), overflow: "hidden", width: "100%" }}>{media}</div>;
    case "component-annotation-arrow":
      return <div data-scene-adapter="annotation-arrow" style={{ color: palette.accent, fontFamily, fontSize: fontSize(20), padding: 12, textShadow:"0 2px 6px #0009" }}><span>{title}</span><svg viewBox="0 0 1000 140" style={{display:"block",width:"100%",overflow:"visible",filter:"drop-shadow(0 2px 3px #0009)"}}><path d="M 12 70 H 952" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1-progress} fill="none"/><path d="M 910 28 L 956 70 L 910 112" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={progress}/></svg></div>;
    case "component-annotation-circle":
      return <div style={{ border: `4px solid ${palette.accent}`, borderRadius: "50%", height: "80%", margin: "10%", opacity: progress, width: "80%" }} />;
    case "component-annotation-callout":
      return <div style={{ background: `${palette.surface}dd`, border: `1px solid ${palette.accent}`, borderRadius: cornerRadius(12), color: palette.primaryText, fontFamily, fontSize: fontSize(19), padding: 15 }}>{title}</div>;
    case "component-annotation-cursor":
      return <div style={{ alignItems: "center", display: "flex", justifyContent: "center", opacity: progress }}><div style={{ background: palette.accent, borderRadius: "50%", height: 24, width: 24 }} /></div>;
    case "component-annotation-click-ripple":
      return <div style={{ alignItems: "center", display: "flex", justifyContent: "center", opacity: progress }}><div style={{ background: palette.accent, borderRadius: "50%", boxShadow: `0 0 0 ${Math.round((1 - progress) * 26)}px ${palette.accent}44`, height: 24, width: 24 }} /></div>;
    case "component-evidence-clean-card":
      return <div style={{ background: palette.surface, border, borderRadius: cornerRadius(14), height: "100%", overflow: "hidden", width: "100%" }}>{media}</div>;
    case "component-evidence-source-label":
      return <div style={{ background: palette.surface, border, borderRadius: cornerRadius(14), height: "100%", overflow: "hidden", position: "relative", width: "100%" }}>{media}<span style={{ background: `${palette.background}dd`, bottom: 0, color: palette.secondaryText, fontFamily, fontSize: fontSize(14), left: 0, padding: "7px 10px", position: "absolute" }}>{title}</span></div>;
    case "component-evidence-device-frame":
      return <div style={{ background: palette.surface, border: `3px solid ${palette.accent}`, borderRadius: cornerRadius(22), height: "100%", overflow: "hidden", padding: 8, position: "relative", width: "100%" }}>{media}<span style={{ background: `${palette.background}dd`, bottom: 0, color: palette.secondaryText, fontFamily, fontSize: fontSize(14), left: 0, padding: "7px 10px", position: "absolute" }}>{title}</span></div>;
    default:
      return <div data-scene-adapter-error={object.binding.rendererId}>缺少该组件的确定性 adapter。</div>;
  }
}

/** Uses the same primitive branches as project rendering; only the source is an explicitly labeled preview fixture. */
export function ScenePrimitiveLibraryPreview({componentId, parameters, content, style, transparent = false}: {componentId:string;parameters:Record<string,unknown>;content?:ReactNode;style?:SceneComponentInstanceV1["style"];transparent?:boolean}):ReactNode {
  const frame=useCurrentFrame();
  const {durationInFrames}=useVideoConfig();
  const definition=componentLibraryDefinition(componentId)!;
  const program={canvas:{width:1920,height:1080,framesPerSecond:30},designSystem:{palette:{background:"#061012",surface:"#10272c",primaryText:"#eff9f7",secondaryText:"#b7d7d1",accent:"#31e4d4"},typography:{family:"sans-serif",thesisWeight:800,bodyWeight:500}}} as SceneProgramV1;
  const object={style,visualObjectId:"preview:primitive",frame:{xPermille:0,yPermille:0,widthPermille:1000,heightPermille:1000},source:{kind:"CONSTRUCTED",evidenceWordIds:[]},kind:"TEXT",text:typeof parameters.text === "string" ? parameters.text : null,informationDuty:definition.label,alignment:"FILL",binding:{rendererId:definition.rendererId,parameters,controls:{intensityPermille:650,reducedMotion:false}}} as unknown as SceneProgramObjectV1;
  const paragraph={frameRange:{startFrame:0,endFrame:durationInFrames},states:[]} as unknown as SceneProgramParagraphV1;
  const isText=definition.controls.some(control=>control.key==='text') && !definition.mediaSlots.length;
  return <AbsoluteFill style={{background:transparent ? "transparent" : "#071417",padding:definition.mediaSlots.length ? 0 : 80,opacity:(style?.opacityPermille ?? 1000)/1000,...(isText?{display:"grid",alignItems:"center"}:{})}}>{isText?<div style={{width:"100%",overflowWrap:"anywhere"}}>{domPrimitive(object,paragraph,program,frame,{},content)}</div>:domPrimitive(object,paragraph,program,frame,{},content)}</AbsoluteFill>;
}

function baseObjectContent(
  object: SceneProgramObjectV1,
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  frame: number,
  assetUrls: Readonly<Record<string, string>>,
): ReactNode {
  const media = object.source.kind === "MEDIA" ? mediaContent(object, paragraph, program, assetUrls) : null;
  const motion: CoreMotionProps = {
    intensity: object.binding.controls.intensityPermille / 1_000,
    reducedMotion: object.binding.controls.reducedMotion,
  };
  if (object.binding.treatment === "COMPONENT" && object.binding.rendererKind === "REMOTION_REACT") {
    const definition = object.binding.componentId ? componentLibraryDefinition(object.binding.componentId) : null;
    if (!definition) return requiredEvidenceMessage(object.binding.rendererId);
    const parameters = {...resolveLibraryParameters(definition.componentId, object.binding.resolvedInput, object.binding.parameters), ...motion};
    const original = object.activeFrameRange ?? paragraph.frameRange;
    const life = object.userLocks?.includes("TIMING") ? undefined : paragraph.motion?.lifetimes.find(l => l.objectId === object.visualObjectId);
    const active = life ? {startFrame:Math.max(original.startFrame,life.startFrame),endFrame:Math.min(original.endFrame,life.endFrame)} : original;
    if (active.endFrame <= active.startFrame) return null;
    const pixel = rectPixels(object.frame, program.canvas);
    return <Sequence from={active.startFrame - paragraph.frameRange.startFrame} durationInFrames={active.endFrame - active.startFrame} layout="none">
      <FittedComponent width={pixel.width} height={pixel.height}>
        <ComponentRuntimeRenderer componentId={definition.componentId} parameters={parameters} content={media ? <Freeze frame={frame-paragraph.frameRange.startFrame}>{media}</Freeze> : undefined} media={media ? [<Freeze frame={frame-paragraph.frameRange.startFrame}>{media}</Freeze>] : []} durationInFrames={active.endFrame - active.startFrame} speed={(object.binding.controls.speedPermille ?? 1000) / 1000} style={object.style ? {...object.style,opacityPermille:undefined} : undefined} />
      </FittedComponent>
    </Sequence>;
  }
  if (object.binding.treatment === "COMPONENT" && object.binding.rendererKind === "DOM_CLASS") {
    return domPrimitive(object, paragraph, program, frame, assetUrls);
  }
  if (media !== null) return media;
  const pose = objectMotionPose(object, paragraph, frame);
  return <div style={textStyle(program, object)}>{pose?.numericValue === undefined ? readableText(object.text, object.informationDuty) : String(Math.round(pose.numericValue * 100) / 100)}</div>;
}

function objectLayer(
  object: SceneProgramObjectV1,
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  frame: number,
  assetUrls: Readonly<Record<string, string>>,
): ReactNode {
  if (objectMotionPose(object, paragraph, frame)?.visible === false) return null;
  const style = objectSurfaceStyle(object, paragraph, program, frame);
  return <div data-scene-object-id={object.visualObjectId} style={style}>{baseObjectContent(object, paragraph, program, frame, assetUrls)}</div>;
}

function structureBounds(
  objectIds: readonly string[],
  objects: ReadonlyMap<string, SceneProgramObjectV1>,
  canvas: SceneProgramV1["canvas"],
): { left: number; top: number; right: number; bottom: number } | null {
  const pixels = objectIds.flatMap((objectId) => {
    const object = objects.get(objectId);
    return object === undefined ? [] : [rectPixels(object.frame, canvas)];
  });
  if (pixels.length === 0) return null;
  return {
    left: Math.min(...pixels.map((pixel) => pixel.left)),
    top: Math.min(...pixels.map((pixel) => pixel.top)),
    right: Math.max(...pixels.map((pixel) => pixel.left + pixel.width)),
    bottom: Math.max(...pixels.map((pixel) => pixel.top + pixel.height)),
  };
}

function renderStructurePrimitive(
  primitiveValue: SceneProgramRenderPrimitiveV1,
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  objects: ReadonlyMap<string, SceneProgramObjectV1>,
  frame: number,
): ReactNode {
  if (paragraph.motion && primitiveValue.objectIds.some(id => { const object=objects.get(id);return object ? objectMotionPose(object,paragraph,frame)?.visible === false : true; })) return null;
  const bounds = structureBounds(primitiveValue.objectIds, objects, program.canvas);
  if (bounds === null) return null;
  const palette = program.designSystem.palette;
  const reveal = paragraph.motion ? 1 : interpolate(frame, [paragraph.frameRange.startFrame + primitiveValue.order, paragraph.frameRange.startFrame + primitiveValue.order + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const common: CSSProperties = {
    boxSizing: "border-box",
    left: bounds.left,
    opacity: 0.28 + reveal * 0.72,
    pointerEvents: "none",
    position: "absolute",
    top: bounds.top,
    zIndex: 1,
  };
  const border = `2px solid ${palette.accent}88`;
  switch (primitiveValue.kind) {
    case "PRESERVE_FRAME":
      return <div data-scene-primitive="PRESERVE_FRAME" style={{ ...common, border, borderRadius: 8, height, width }} />;
    case "FLOW_NODE":
      return <div data-scene-primitive="FLOW_NODE" style={{ ...common, border, borderRadius: 10, height, width }} />;
    case "FLOW_CONNECTOR": {
      const source = structureBounds([primitiveValue.objectIds[0]!], objects, program.canvas);
      const target = structureBounds([primitiveValue.objectIds[1]!], objects, program.canvas);
      if (source === null || target === null) return null;
      const sourceOnLeft = (source.left + source.right) <= (target.left + target.right);
      const firstEdge = sourceOnLeft ? source.right : target.right;
      const secondEdge = sourceOnLeft ? target.left : source.left;
      const left = Math.min(firstEdge, secondEdge);
      const right = Math.max(firstEdge, secondEdge);
      const top = (source.top + source.bottom + target.top + target.bottom) / 4;
      return <div data-scene-primitive="FLOW_CONNECTOR" style={{ background: palette.accent, height: 3, left, opacity: common.opacity, position: "absolute", top, width: Math.max(3, right - left), zIndex: 2 }} />;
    }
    case "COMPARISON_SIDE":
      return <div data-scene-primitive="COMPARISON_SIDE" style={{ ...common, border, borderRadius: 8, height, width }} />;
    case "COMPARISON_DIVIDER":
      return <div data-scene-primitive="COMPARISON_DIVIDER" style={{ background: palette.accent, height, left: bounds.left + width / 2, opacity: common.opacity, position: "absolute", top: bounds.top, width: 3, zIndex: 2 }} />;
    case "TIMELINE_TRACK":
      return <div data-scene-primitive="TIMELINE_TRACK" style={{ background: palette.accent, height: 3, left: bounds.left, opacity: common.opacity, position: "absolute", top: bounds.top + height / 2, width, zIndex: 2 }} />;
    case "TIMELINE_NODE":
      return <div data-scene-primitive="TIMELINE_NODE" style={{ background: palette.accent, borderRadius: "50%", height: 14, left: bounds.left + width / 2 - 7, opacity: common.opacity, position: "absolute", top: bounds.top + height / 2 - 7, width: 14, zIndex: 3 }} />;
    case "DATA_GRID":
      return <div data-scene-primitive="DATA_GRID" style={{ ...common, background: `linear-gradient(90deg, ${palette.accent}22 1px, transparent 1px) 0 0 / 16% 100%, linear-gradient(${palette.accent}22 1px, transparent 1px) 0 0 / 100% 25%`, border, height, width }} />;
    case "DATA_EVIDENCE_ACCENT":
      return <div data-scene-primitive="DATA_EVIDENCE_ACCENT" style={{ background: palette.positive, height: 5, left: bounds.left, opacity: common.opacity, position: "absolute", top: bounds.bottom - 5, width, zIndex: 3 }} />;
    case "RISK_AXES":
      return <div data-scene-primitive="RISK_AXES" style={{ ...common, background: `linear-gradient(90deg, transparent 49.5%, ${palette.accent}aa 49.5% 50.5%, transparent 50.5%), linear-gradient(transparent 49.5%, ${palette.accent}aa 49.5% 50.5%, transparent 50.5%)`, height, width }} />;
    case "RISK_QUADRANT":
      return <div data-scene-primitive="RISK_QUADRANT" style={{ ...common, border, height, width }} />;
    case "CONCLUSION_HIERARCHY":
      return <div data-scene-primitive="CONCLUSION_HIERARCHY" style={{ ...common, borderLeft: `7px solid ${palette.accent}`, height, width }} />;
    case "CONCLUSION_ACCENT":
      return <div data-scene-primitive="CONCLUSION_ACCENT" style={{ background: palette.accent, height: 6, left: bounds.left, opacity: common.opacity, position: "absolute", top: bounds.bottom - 6, width, zIndex: 3 }} />;
    case "PIP_HIERARCHY":
      return <div data-scene-primitive="PIP_HIERARCHY" style={{ ...common, border: `2px solid ${palette.accent}66`, borderRadius: 18, boxShadow: `0 20px 60px ${palette.background}99`, height, width }} />;
    case "STRUCTURED_EMPHASIS":
      return <div data-scene-primitive="STRUCTURED_EMPHASIS" style={{ ...common, borderLeft: `6px solid ${palette.accent}`, borderRadius: 8, height, width }} />;
    case "CUSTOM_GROUP_BACKPLATE": {
      const radius = primitiveValue.groupKind === "OVERLAY" ? 18 : primitiveValue.groupKind === "ROW" ? 8 : primitiveValue.groupKind === "COLUMN" ? 12 : 4;
      const borderStyle = primitiveValue.groupKind === "SEQUENCE" ? "dashed" : "solid";
      return <div data-scene-primitive="CUSTOM_GROUP_BACKPLATE" data-custom-group-kind={primitiveValue.groupKind} data-custom-order={String(primitiveValue.order)} style={{ ...common, border: `2px ${borderStyle} ${palette.accent}88`, borderRadius: radius, height, width }} />;
    }
    case "CUSTOM_RELATION":
      return <div data-scene-primitive="CUSTOM_RELATION" data-custom-group-kind={primitiveValue.groupKind} style={{ ...common, color: palette.accent, fontFamily: program.designSystem.typography.family, fontSize: 14, height: "auto", padding: "4px 8px", width: Math.max(1, width) }}>{primitiveValue.relationship}</div>;
  }
}

function structureLayer(
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  frame: number,
): ReactNode {
  const structure = deriveSceneProgramRenderStructureV1(paragraph);
  const objects = new Map(paragraph.objects.map((object) => {
    if (!paragraph.motion) return [object.visualObjectId, object] as const;
    const pose = objectMotionPose(object,paragraph,frame)!;
    return [object.visualObjectId, {...object, frame:{...object.frame,xPermille:object.frame.xPermille + pose.translateX + object.frame.widthPermille*(1-pose.scale)/2,yPermille:object.frame.yPermille + pose.translateY + object.frame.heightPermille*(1-pose.scale)/2,widthPermille:object.frame.widthPermille*pose.scale,heightPermille:object.frame.heightPermille*pose.scale}}] as const;
  }));
  return <AbsoluteFill data-scene-structure={structure.patternId} style={{ pointerEvents: "none" }}>
    {structure.primitives.map((primitiveValue) => <div key={primitiveValue.primitiveId}>{renderStructurePrimitive(primitiveValue, paragraph, program, objects, frame)}</div>)}
  </AbsoluteFill>;
}

function patternBackdrop(
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  frame: number,
): ReactNode {
  const palette = program.designSystem.palette;
  const patternId = paragraph.implementation.kind === "PATTERN" ? paragraph.implementation.patternId : "CUSTOM_SCENE";
  const progress = interpolate(frame, [paragraph.frameRange.startFrame, paragraph.frameRange.startFrame + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const common: CSSProperties = { height: "100%", opacity: 0.55 + progress * 0.45, position: "absolute", width: "100%" };
  switch (patternId) {
    case "LAYOUT_PRESERVE_V1":
      return <div data-scene-pattern="LAYOUT_PRESERVE_V1" style={{ ...common, background: `linear-gradient(135deg, ${palette.background}, ${palette.surface})` }} />;
    case "FLOW_V1":
      return <div data-scene-pattern="FLOW_V1" style={{ ...common, background: `repeating-linear-gradient(90deg, transparent 0 120px, ${palette.accent}1a 121px 123px)` }} />;
    case "COMPARISON_V1":
      return <div data-scene-pattern="COMPARISON_V1" style={{ ...common, background: `linear-gradient(90deg, ${palette.accent}16 0 49.5%, ${palette.negative}24 50% 100%)` }} />;
    case "TIMELINE_V1":
      return <div data-scene-pattern="TIMELINE_V1" style={{ ...common, background: `linear-gradient(${palette.accent}22, ${palette.accent}22) 0 68% / 100% 3px no-repeat` }} />;
    case "DATA_PROOF_V1":
      return <div data-scene-pattern="DATA_PROOF_V1" style={{ ...common, background: `linear-gradient(90deg, ${palette.accent}11 1px, transparent 1px) 0 0 / 8% 100%, linear-gradient(${palette.accent}11 1px, transparent 1px) 0 0 / 100% 12%` }} />;
    case "RISK_MATRIX_V1":
      return <div data-scene-pattern="RISK_MATRIX_V1" style={{ ...common, background: `linear-gradient(90deg, transparent 49.7%, ${palette.accent}66 50%, transparent 50.3%), linear-gradient(transparent 49.7%, ${palette.accent}66 50%, transparent 50.3%)` }} />;
    case "CONCLUSION_V1":
      return <div data-scene-pattern="CONCLUSION_V1" style={{ ...common, background: `radial-gradient(circle at 80% 80%, ${palette.accent}33, transparent 48%), ${palette.background}` }} />;
    case "SCREEN_WITH_PERSON_PIP_V1":
      return <div data-scene-pattern="SCREEN_WITH_PERSON_PIP_V1" style={{ ...common, background: `linear-gradient(145deg, ${palette.background}, ${palette.surface} 72%, ${palette.accent}22)` }} />;
    case "PERSON_WITH_STRUCTURED_EMPHASIS_V1":
      return <div data-scene-pattern="PERSON_WITH_STRUCTURED_EMPHASIS_V1" style={{ ...common, background: `radial-gradient(circle at 22% 40%, ${palette.accent}20, transparent 44%), ${palette.background}` }} />;
    default:
      return <div data-scene-pattern="CUSTOM_SCENE" style={{ ...common, background: `radial-gradient(circle at 50% 20%, ${palette.accent}22, transparent 55%), ${palette.background}` }} />;
  }
}

function FittedComponent({width, height, children}: {width: number; height: number; children: ReactNode}): ReactNode {
  const scale = Math.min(width / 1920, height / 1080);
  return <div style={{position: "absolute", width:1920, height:1080, left:(width-1920*scale)/2, top:(height-1080*scale)/2, transform:`scale(${scale})`, transformOrigin:"0 0"}}>{children}</div>;
}

export function SceneComponentInstanceRenderer({instance, paragraph, program, assetUrls, content, toScene}: {
  instance: SceneComponentInstanceV1; paragraph: SceneProgramParagraphV1; program: SceneProgramV1;
  assetUrls: Readonly<Record<string,string>>; content?: ReactNode; toScene?: ReactNode;
}): ReactNode {
  const localFrame = useCurrentFrame();
  const speechStart=paragraph.motion?.lifetimes.find(life=>life.objectId===instance.instanceId)?.startFrame;
  const motionFrame=instance.timingLocked&&speechStart!==undefined?speechStart+localFrame:instance.activeFrameRange.startFrame+localFrame;
  const evaluated = paragraph.motion ? evaluateSceneMotion(paragraph.motion, instance.instanceId, motionFrame) : undefined;
  const pose=evaluated&&instance.timingLocked?{...evaluated,visible:true}:evaluated;
  if (pose && !pose.visible) return null;
  const motionStyle: CSSProperties = pose ? {transform:`translate(${pose.translateX * program.canvas.width / 1000}px, ${pose.translateY * program.canvas.height / 1000}px) scale(${pose.scale}) rotate(${pose.rotation}deg)`} : {};
  const definition = componentLibraryDefinition(instance.componentId);
  if (!definition) return requiredEvidenceMessage(instance.componentId);
  const targets = instance.targetObjectIds.flatMap((id) => {
    const object = paragraph.objects.find((item) => item.visualObjectId === id);
    return object ? [object] : [];
  });
  const nodes = targets.map((object) => <Freeze frame={instance.activeFrameRange.startFrame - paragraph.frameRange.startFrame + localFrame}>{mediaContent(object, paragraph, program, assetUrls)}</Freeze>);
  const suppliedContent = definition.mount === "SCENE" ? content : nodes[0];
  const duration = instance.activeFrameRange.endFrame - instance.activeFrameRange.startFrame;
  const pixel = rectPixels(instance.frame, program.canvas);
  let rendered: ReactNode;
  if (instance.componentId.startsWith("component:v1:")) {
    const source = targets[0]?.source ?? {kind:"CONSTRUCTED" as const,evidenceWordIds:[]};
    const base = paragraph.objects[0]!;
    const synthetic: SceneProgramObjectV1 = {...base, kind:targets[0]?.kind ?? "TEXT", visualObjectId:instance.instanceId, source, frame:instance.frame, text: typeof instance.parameters.text === "string" ? instance.parameters.text : null,
      style: instance.style ? {foregroundColor:null,backgroundColor:null,fontFamily:null,fontSizePermille:1000,opacityPermille:1000,cornerRadiusPermille:typeof instance.parameters.cornerRadius === "number" ? instance.parameters.cornerRadius*10 : 0,...instance.style} : undefined, binding: {...base.binding, rendererId:definition.rendererId, parameters:instance.parameters, controls:{...base.binding.controls,speedPermille:instance.speedPermille}}};
    rendered = domPrimitive(synthetic, {...paragraph,frameRange:instance.activeFrameRange}, program, instance.activeFrameRange.startFrame + localFrame, assetUrls, nodes[0]);
  } else {
    rendered = <FittedComponent width={definition.mount === "OBJECT" ? pixel.width : program.canvas.width} height={definition.mount === "OBJECT" ? pixel.height : program.canvas.height}>
      <ComponentRuntimeRenderer componentId={instance.componentId} parameters={instance.parameters} content={suppliedContent} media={nodes} fromScene={nodes.length >= 2 ? nodes[0] : content} toScene={nodes.length >= 2 ? nodes[1] : toScene} durationInFrames={duration} speed={instance.speedPermille / 1000} style={instance.style ? {...instance.style,opacityPermille:undefined} : undefined} />
    </FittedComponent>;
  }
  return definition.mount === "OBJECT"
    ? <div data-component-instance-id={instance.instanceId} style={{...motionStyle,position:"absolute",left:pixel.left,top:pixel.top,width:pixel.width,height:pixel.height,overflow:"hidden",zIndex:instance.zIndex,opacity:(pose?.opacity ?? 1)*(instance.style?.opacityPermille ?? 1000)/1000}}>{rendered}</div>
    : <AbsoluteFill data-component-instance-id={instance.instanceId} style={{...motionStyle,opacity:(pose?.opacity ?? 1)*(instance.style?.opacityPermille ?? 1000)/1000}}>{rendered}</AbsoluteFill>;
}

const moduleEvaluators=new WeakMap<CompiledSceneModuleV1,ReturnType<typeof prepareSceneModule>>();
export function renderSceneModuleFrame(paragraph:SceneProgramParagraphV1,program:SceneProgramV1,absoluteFrame:number):ReactNode {
  const fps=program.canvas.framesPerSecond;
  return (paragraph.modules??[]).map(module=>{
    let evaluate=moduleEvaluators.get(module.compiled);
    if(!evaluate){evaluate=prepareSceneModule(module.compiled);moduleEvaluators.set(module.compiled,evaluate);}
    const output=evaluate({frame:absoluteFrame,fps,width:program.canvas.width,height:program.canvas.height,duration:paragraph.frameRange.endFrame-paragraph.frameRange.startFrame,params:{...module.parameters,...module.anchorFrames}},paragraph.objects.map(object=>object.visualObjectId));
    return output.nodes.map(node=>{
      const parent=paragraph.objects.find(object=>object.visualObjectId===node.parentObjectId)!;
      const pose=objectMotionPose(parent,paragraph,absoluteFrame) ?? {visible:true,opacity:1,translateX:0,translateY:0,rotation:0,scale:1};
      if(!pose.visible||(node.opacity??1)<=0)return null;
      const baseFrame=module.parentFrames[node.parentObjectId]??parent.frame;
      const scaleX=parent.frame.widthPermille/baseFrame.widthPermille,scaleY=parent.frame.heightPermille/baseFrame.heightPermille;
      const offsetX=parent.frame.xPermille-baseFrame.xPermille*scaleX,offsetY=parent.frame.yPermille-baseFrame.yPermille*scaleY;
      const common={fill:node.fill??program.designSystem.palette.primaryText,stroke:node.stroke??"none",strokeWidth:node.strokeWidth??1};
      const progress=node.drawProgress??1;
      if(progress<=0)return null;
      const fontSize=node.fontSize??node.height;
      // Text glyphs compensate the stretched 1000-square SVG; alignment must compensate too.
      const textWidth=node.width*program.canvas.width/program.canvas.height;
      const textX=node.textAlign === "center" ? textWidth/2 : node.textAlign === "right" ? textWidth : 0;
      const radius=node.cornerRadius===undefined?undefined:Math.min(node.cornerRadius,node.height/2,node.width*program.canvas.width/program.canvas.height/2);
      const textAnchor=node.textAlign === "center" ? "middle" : node.textAlign === "right" ? "end" : undefined;
      const element=node.kind==="TEXT" ? <text x={textX} y={fontSize} transform={`translate(${node.x} ${node.y}) scale(${program.canvas.height/program.canvas.width} 1)`} fontSize={fontSize} fontFamily={program.designSystem.typography.family} {...(node.fontWeight===undefined ? {} : {fontWeight:node.fontWeight})} {...(node.letterSpacing===undefined ? {} : {letterSpacing:node.letterSpacing})} {...(textAnchor===undefined ? {} : {textAnchor})} {...common}>{node.text}</text>
        : node.kind==="RECT" ? <rect x={node.x} y={node.y} width={node.width} height={node.height} {...(radius===undefined ? {} : {rx:radius*program.canvas.height/program.canvas.width,ry:radius})} {...common}/>
        : node.kind==="ELLIPSE" ? <ellipse cx={node.x+node.width/2} cy={node.y+node.height/2} rx={node.width/2} ry={node.height/2} {...common}/>
        : node.kind==="LINE" ? <line x1={node.x} y1={node.y} x2={node.x+node.width} y2={node.y+node.height} {...common} pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress}/>
        : <path d={node.path} transform={`translate(${node.x} ${node.y})`} {...common} pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress}/>;
      return <svg key={`${module.moduleId}:${node.id}`} data-scene-module-id={module.moduleId} data-scene-node-id={node.id} data-parent-object-id={node.parentObjectId} viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible",pointerEvents:"none",zIndex:parent.zIndex,opacity:pose.opacity*(node.opacity??1)*(parent.style?.opacityPermille??1000)/1000}}>
        <g transform={`translate(${pose.translateX} ${pose.translateY}) translate(${offsetX} ${offsetY}) scale(${scaleX} ${scaleY}) translate(${node.x} ${node.y}) rotate(${pose.rotation+(node.rotation??0)}) scale(${pose.scale*(node.scale??1)}) translate(${-node.x} ${-node.y})`}>{element}</g>
      </svg>;
    });
  });
}

function paragraphComposition(
  paragraph: SceneProgramParagraphV1,
  program: SceneProgramV1,
  absoluteFrame: number,
  assetUrls: Readonly<Record<string, string>>,
  includeEffects = true,
): ReactNode {
  const active = (paragraph.componentInstances ?? []).map(instance => {
    const life = paragraph.motion?.lifetimes.find(l => l.objectId === instance.instanceId);
    return life&&!instance.timingLocked ? {...instance, activeFrameRange:{startFrame:Math.max(instance.activeFrameRange.startFrame,life.startFrame),endFrame:Math.min(instance.activeFrameRange.endFrame,life.endFrame)}} : instance;
  }).filter((instance) => absoluteFrame >= instance.activeFrameRange.startFrame && absoluteFrame < instance.activeFrameRange.endFrame);
  const replaced=new Set((paragraph.modules??[]).flatMap(module=>module.replacesObjectIds));
  const customGraphics=replaced.size>0&&paragraph.objects.filter(object=>object.source.kind!=="MEDIA").every(object=>replaced.has(object.visualObjectId));
  let composition: ReactNode = <AbsoluteFill data-scene-paragraph-id={paragraph.paragraphId}>
    {!customGraphics&&patternBackdrop(paragraph, program, absoluteFrame)}
    {!customGraphics&&structureLayer(paragraph, program, absoluteFrame)}
    {renderSceneModuleFrame(paragraph, program, absoluteFrame)}
    {paragraph.objects.slice().sort((left,right) => left.zIndex-right.zIndex || left.readingOrder-right.readingOrder)
      .filter(object=>!replaced.has(object.visualObjectId))
      .filter((object) => !object.activeFrameRange || (absoluteFrame >= object.activeFrameRange.startFrame && absoluteFrame < object.activeFrameRange.endFrame))
      .map((object) => <div key={object.visualObjectId} style={{display:"contents"}}>{objectLayer(object, paragraph, program, absoluteFrame, assetUrls)}</div>)}
    {active.filter((instance) => componentLibraryDefinition(instance.componentId)?.mount === "OBJECT").map((instance) =>
      <Sequence key={instance.instanceId} from={instance.activeFrameRange.startFrame-paragraph.frameRange.startFrame} durationInFrames={instance.activeFrameRange.endFrame-instance.activeFrameRange.startFrame} layout="none">
        <SceneComponentInstanceRenderer instance={instance} paragraph={paragraph} program={program} assetUrls={assetUrls}/>
      </Sequence>)}
  </AbsoluteFill>;
  for (const instance of active.filter((entry) => componentLibraryDefinition(entry.componentId)?.mount !== "OBJECT" && (includeEffects || componentLibraryDefinition(entry.componentId)?.mount !== "TRANSITION")).sort((a,b)=>(componentLibraryDefinition(a.componentId)?.mount === "TRANSITION" ? 1 : 0)-(componentLibraryDefinition(b.componentId)?.mount === "TRANSITION" ? 1 : 0) || a.zIndex-b.zIndex || a.instanceId.localeCompare(b.instanceId))) {
    const next = componentLibraryDefinition(instance.componentId)?.mount === "TRANSITION" ? program.paragraphs.find((entry) => entry.order === paragraph.order+1) : undefined;
    const nextScene = next ? <Freeze frame={0}>{paragraphComposition(next,program,next.frameRange.startFrame,assetUrls,false)}</Freeze> : undefined;
    composition = <Sequence key={instance.instanceId} from={instance.activeFrameRange.startFrame-paragraph.frameRange.startFrame} durationInFrames={instance.activeFrameRange.endFrame-instance.activeFrameRange.startFrame} layout="none">
      <SceneComponentInstanceRenderer instance={instance} paragraph={paragraph} program={program} assetUrls={assetUrls} content={<Freeze frame={absoluteFrame-paragraph.frameRange.startFrame}>{composition}</Freeze>} toScene={nextScene}/>
    </Sequence>;
  }
  return composition;
}

function ParagraphSequenceContent({
  paragraph,
  program,
  assetUrls,
}: {
  paragraph: SceneProgramParagraphV1;
  program: SceneProgramV1;
  assetUrls: Readonly<Record<string, string>>;
}): ReactNode {
  const localFrame = useCurrentFrame();
  return paragraphComposition(paragraph, program, localFrame + paragraph.frameRange.startFrame, assetUrls);
}

export function SceneProgramComposition({ program, assetUrls }: SceneProgramRendererPropsV1): ReactNode {
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill data-scene-program-id={program.programId} style={{ background: program.designSystem.palette.background, color: program.designSystem.palette.primaryText, overflow: "hidden" }}>
    {program.paragraphs.map((paragraph) => {
      const duration = Math.max(1, Math.min(
        Math.max(1, durationInFrames - paragraph.frameRange.startFrame),
        paragraph.frameRange.endFrame - paragraph.frameRange.startFrame,
      ));
      return <Sequence
        key={paragraph.paragraphId}
        name={`Paragraph ${paragraph.paragraphId}`}
        from={paragraph.frameRange.startFrame}
        durationInFrames={duration}
        premountFor={Math.min(2, paragraph.frameRange.startFrame)}
      >
        <ParagraphSequenceContent paragraph={paragraph} program={program} assetUrls={assetUrls} />
      </Sequence>;
    })}
  </AbsoluteFill>;
}

export const SceneProgramRenderer = SceneProgramComposition;
export const renderSceneProgramV1 = SceneProgramComposition;

export { objectLayer as renderSceneProgramObjectFrame };
