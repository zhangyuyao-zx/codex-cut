import { z } from "zod";
import { idSchema } from "../shared/timeline-v2/schema.js";

// Source words are resolved by the host against the current edited transcript.
// No wall clock, source-video offsets or approximate sentence staggering here.
export const speechAnchorSchema = z.object({
  wordId: idSchema,
  edge: z.enum(["START", "END"]),
  offsetMs: z.number().finite().min(-10_000).max(10_000).default(0),
}).strict();
const narrativeBeatSchema = z.object({
  beatId: idSchema,
  label: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(2_000),
  startWordId: idSchema,
  endWordId: idSchema,
  focusObjectId: idSchema,
  retainObjectIds: z.array(idSchema).max(128),
}).strict();
const lifetimeSchema = z.object({
  objectId: idSchema,
  enter: speechAnchorSchema,
  exit: speechAnchorSchema.nullable(),
}).strict();
export const motionPropertySchema = z.enum([
  "translateX", "translateY", "scale", "rotation", "opacity", "drawProgress", "numericValue", "pathProgress",
]);
const pointSchema = z.object({ x: z.number().finite().min(-4_000).max(4_000), y: z.number().finite().min(-4_000).max(4_000) }).strict();
const trackShape = {
  trackId: idSchema,
  objectId: idSchema,
  property: motionPropertySchema,
  from: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  to: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  easing: z.enum(["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_OUT"]),
  afterTrackIds: z.array(idSchema).max(32),
  // Translation/path coordinates are canvas permille, independent of resolution.
  path: z.array(pointSchema).min(2).max(256).optional(),
};
const trackSchema = z.object({ ...trackShape,
  start: speechAnchorSchema,
  end: speechAnchorSchema,
}).strict();
export const sceneMotionDraftSchema = z.object({
  version: z.literal(2),
  beats: z.array(narrativeBeatSchema).min(1).max(128),
  lifetimes: z.array(lifetimeSchema).max(256),
  tracks: z.array(trackSchema).max(1_024),
}).strict();
const frame = z.number().int().nonnegative();
export const compiledSceneMotionSchema = z.object({
  version: z.literal(2),
  beats: z.array(narrativeBeatSchema.extend({startFrame: frame, endFrame: frame}).strict()).min(1).max(128),
  lifetimes: z.array(lifetimeSchema.extend({startFrame: frame, endFrame: frame}).strict()).max(256),
  tracks: z.array(trackSchema.extend({startFrame: frame, endFrame: frame}).strict()).max(1_024),
}).strict();
export type SpeechAnchor = z.infer<typeof speechAnchorSchema>;
export type NarrativeBeat = z.infer<typeof narrativeBeatSchema>;
export type SceneMotionDraft = z.infer<typeof sceneMotionDraftSchema>;
export type CompiledSceneMotion = z.infer<typeof compiledSceneMotionSchema>;
export interface MotionWord { wordId: string; startFrame: number; endFrame: number }
export interface MotionRange { startFrame: number; endFrame: number }

export class SceneMotionError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "SceneMotionError"; }
}
function fail(code: string, message: string): never { throw new SceneMotionError(code, message); }
function unique(ids: readonly string[], label: string): void {
  if (new Set(ids).size !== ids.length) fail("MOTION_DUPLICATE_ID", `${label} 有重复标识。`);
}

export function resolveSpeechAnchor(anchor: SpeechAnchor, words: ReadonlyMap<string, MotionWord>, fps: number): number {
  const word = words.get(anchor.wordId);
  if (!word) return fail("MOTION_ANCHOR_STALE", `口播词 ${anchor.wordId} 已失效，请重新绑定对应讲解节点。`);
  const value = (anchor.edge === "START" ? word.startFrame : word.endFrame) + anchor.offsetMs * fps / 1_000;
  // Never reveal earlier than the specified boundary, even at fractional fps.
  return Math.ceil(value - 1e-9);
}

export function compileSceneMotion(
  input: unknown,
  words: ReadonlyMap<string, MotionWord>,
  objectIds: readonly string[],
  range: MotionRange,
  fps: number,
): CompiledSceneMotion {
  const draft = sceneMotionDraftSchema.parse(input);
  if (!Number.isFinite(fps) || fps <= 0) fail("MOTION_TIMEBASE_INVALID", "动画需要有效的时间基准。");
  unique(draft.beats.map(b => b.beatId), "讲解节点");
  unique(draft.tracks.map(t => t.trackId), "动作");
  unique(draft.lifetimes.map(l => l.objectId), "显示区间");
  const objects = new Set(objectIds);
  const target = (id: string): void => { if (!objects.has(id)) fail("MOTION_TARGET_MISSING", `动画对象 ${id} 不属于当前场景。`); };
  const bounds = (start: number, end: number, label: string): void => {
    if (start < range.startFrame || end > range.endFrame || end <= start)
      fail("MOTION_TIME_CONFLICT", `${label} 的动作或阅读区间放不进当前口播，请调整本段设计。`);
  };
  const beats = draft.beats.map(b => {
    target(b.focusObjectId); b.retainObjectIds.forEach(target);
    unique(b.retainObjectIds, "保留对象");
    const startFrame = resolveSpeechAnchor({ wordId: b.startWordId, edge: "START", offsetMs: 0 }, words, fps);
    const endFrame = resolveSpeechAnchor({ wordId: b.endWordId, edge: "END", offsetMs: 0 }, words, fps);
    bounds(startFrame, endFrame, b.label);
    return { ...b, startFrame, endFrame };
  });
  for (let i = 1; i < beats.length; i++) {
    if (beats[i]!.startFrame < beats[i - 1]!.startFrame || beats[i]!.endFrame < beats[i - 1]!.endFrame) fail("MOTION_BEAT_ORDER", "讲解节点必须按当前口播顺序提交。");
  }
  const lifetimes = draft.lifetimes.map(l => {
    target(l.objectId);
    const startFrame = resolveSpeechAnchor(l.enter, words, fps);
    const endFrame = l.exit ? resolveSpeechAnchor(l.exit, words, fps) : range.endFrame;
    bounds(startFrame, endFrame, l.objectId);
    return { ...l, startFrame, endFrame };
  });
  const tracks = draft.tracks.map(t => {
    target(t.objectId); unique(t.afterTrackIds, "动作依赖");
    const startFrame = resolveSpeechAnchor(t.start, words, fps);
    const endFrame = resolveSpeechAnchor(t.end, words, fps);
    bounds(startFrame, endFrame, t.trackId);
    if (["opacity", "drawProgress", "pathProgress"].includes(t.property) && (Math.min(t.from, t.to) < 0 || Math.max(t.from, t.to) > 1))
      fail("MOTION_VALUE_INVALID", `${t.property} 必须在 0 到 1 之间。`);
    if (t.property === "scale" && (Math.min(t.from, t.to) <= 0 || Math.max(t.from, t.to) > 20))
      fail("MOTION_VALUE_INVALID", "缩放必须大于 0 且不超过 20。");
    if ((t.property === "pathProgress") !== (t.path !== undefined)) fail("MOTION_PATH_INVALID", "路径动画必须明确提供路径点。");
    return { ...t, startFrame, endFrame };
  }).sort((a, b) => a.startFrame - b.startFrame || a.trackId.localeCompare(b.trackId));
  const byId = new Map(tracks.map(t => [t.trackId, t]));
  for (const t of tracks) {
    const life=lifetimes.find(l=>l.objectId===t.objectId);
    if (life && (t.startFrame < life.startFrame || t.endFrame > life.endFrame)) fail("MOTION_LIFETIME_CONFLICT", `动作 ${t.trackId} 超出对象显示区间。`);
    for (const id of t.afterTrackIds) {
      const dependency = byId.get(id);
      if (!dependency) fail("MOTION_DEPENDENCY_MISSING", `动作 ${t.trackId} 的依赖 ${id} 不存在。`);
      // Positive durations plus this ordering also reject all dependency cycles.
      if (dependency.endFrame > t.startFrame) fail("MOTION_DEPENDENCY_CONFLICT", `动作 ${t.trackId} 开始时，${id} 尚未完成。`);
    }
    const conflict = tracks.find(other => other !== t && other.objectId === t.objectId
      && (other.property === t.property || (other.property === "pathProgress" && ["translateX", "translateY"].includes(t.property))
        || (t.property === "pathProgress" && ["translateX", "translateY"].includes(other.property)))
      && other.startFrame < t.endFrame && other.endFrame > t.startFrame);
    if (conflict) fail("MOTION_TRACK_CONFLICT", `对象 ${t.objectId} 的动作 ${t.trackId} 与 ${conflict.trackId} 同时控制同一属性。`);
  }
  for (const beat of beats) for (const id of new Set([beat.focusObjectId,...beat.retainObjectIds])) {
    const life = lifetimes.find(l => l.objectId === id);
    if (life && (life.startFrame > beat.startFrame || life.endFrame < beat.endFrame))
      fail("MOTION_RETAIN_CONFLICT", `${beat.label} 要保留 ${id}，但其显示区间不覆盖这一拍。`);
  }
  return compiledSceneMotionSchema.parse({version: 2, beats, lifetimes, tracks});
}

export interface MotionPose {
  visible: boolean;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
  opacity: number;
  drawProgress: number;
  numericValue?: number;
}
function ease(progress: number, easing: CompiledSceneMotion["tracks"][number]["easing"]): number {
  switch (easing) {
    case "LINEAR": return progress;
    case "EASE_IN": return progress * progress;
    case "EASE_OUT": return 1 - (1 - progress) ** 2;
    case "EASE_IN_OUT": return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
  }
}
function pointAlong(path: Array<{x: number; y: number}>, progress: number): {x: number; y: number} {
  const lengths = path.slice(1).map((point, i) => Math.hypot(point.x - path[i]!.x, point.y - path[i]!.y));
  let distance = progress * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (distance <= length || i === lengths.length - 1) {
      const ratio = length === 0 ? 0 : distance / length;
      return { x: path[i]!.x + (path[i + 1]!.x - path[i]!.x) * ratio, y: path[i]!.y + (path[i + 1]!.y - path[i]!.y) * ratio };
    }
    distance -= length;
  }
  return path[0]!;
}

/** Pure random-access evaluation. Later tracks never reset earlier completed tracks. */
export function evaluateSceneMotion(motion: CompiledSceneMotion, objectId: string, currentFrame: number, reducedMotion = false): MotionPose {
  const life = motion.lifetimes.find(l => l.objectId === objectId);
  const pose: MotionPose = { visible: !life || (currentFrame >= life.startFrame && currentFrame < life.endFrame), translateX: 0, translateY: 0, scale: 1, rotation: 0, opacity: 1, drawProgress: 1 };
  const applied = new Set<string>();
  for (const track of motion.tracks) {
    if (track.objectId !== objectId) continue;
    const channels = track.property === "pathProgress" ? ["translateX", "translateY"] : [track.property];
    if (currentFrame < track.startFrame && channels.some(channel => applied.has(channel))) continue;
    const linear = Math.max(0, Math.min(1, (currentFrame - track.startFrame) / (track.endFrame - track.startFrame)));
    const progress = reducedMotion ? (currentFrame >= track.startFrame ? 1 : 0) : ease(linear, track.easing);
    const value = track.from + (track.to - track.from) * progress;
    if (track.property === "pathProgress") {
      const point = pointAlong(track.path!, value);
      pose.translateX = point.x; pose.translateY = point.y;
    } else pose[track.property] = value;
    for (const channel of channels) applied.add(channel);
  }
  return pose;
}

/** Validate persisted frame data independently of an Agent submission. */
export function assertCompiledSceneMotion(motion:CompiledSceneMotion,objectIds:readonly string[],range:MotionRange):void {
  const targets=new Set(objectIds);
  unique(motion.beats.map(b=>b.beatId),"讲解节点");unique(motion.tracks.map(t=>t.trackId),"动作");unique(motion.lifetimes.map(l=>l.objectId),"显示区间");
  const bounds=(item:MotionRange)=>{if(item.startFrame<range.startFrame||item.endFrame>range.endFrame||item.endFrame<=item.startFrame)fail("MOTION_TIME_CONFLICT","已保存动画超出当前段落。");};
  for(const item of [...motion.lifetimes,...motion.tracks]){bounds(item);if(!targets.has(item.objectId))fail("MOTION_TARGET_MISSING",`已保存动画对象 ${item.objectId} 不存在。`);}
  for(const beat of motion.beats){bounds(beat);for(const id of [beat.focusObjectId,...beat.retainObjectIds])if(!targets.has(id))fail("MOTION_TARGET_MISSING",`讲解步骤对象 ${id} 不存在。`);}
  for(let i=1;i<motion.beats.length;i++)if(motion.beats[i]!.startFrame<motion.beats[i-1]!.startFrame||motion.beats[i]!.endFrame<motion.beats[i-1]!.endFrame)fail("MOTION_BEAT_ORDER","已保存讲解节点顺序无效。");
  for(let i=1;i<motion.tracks.length;i++)if(motion.tracks[i]!.startFrame<motion.tracks[i-1]!.startFrame)fail("MOTION_TRACK_ORDER","已保存动作顺序无效。");
  for(const beat of motion.beats)for(const id of [beat.focusObjectId,...beat.retainObjectIds]){const life=motion.lifetimes.find(l=>l.objectId===id);if(life&&(life.startFrame>beat.startFrame||life.endFrame<beat.endFrame))fail("MOTION_RETAIN_CONFLICT","已保存重点对象未覆盖讲解步骤。");}
  const byId=new Map(motion.tracks.map(t=>[t.trackId,t]));
  for(const track of motion.tracks){
    const life=motion.lifetimes.find(l=>l.objectId===track.objectId);
    if(life&&(track.startFrame<life.startFrame||track.endFrame>life.endFrame))fail("MOTION_LIFETIME_CONFLICT","已保存动作超出显示区间。");
    const channels=(property:string)=>property==="pathProgress"?["translateX","translateY"]:[property];
    if(motion.tracks.some(other=>other!==track&&other.objectId===track.objectId&&channels(other.property).some(c=>channels(track.property).includes(c))&&other.startFrame<track.endFrame&&other.endFrame>track.startFrame))fail("MOTION_TRACK_CONFLICT","已保存动作重复控制属性。");
    for(const id of track.afterTrackIds){const dep=byId.get(id);if(!dep||dep.endFrame>track.startFrame)fail("MOTION_DEPENDENCY_CONFLICT","已保存动作依赖无效。");}
    if((track.property==="pathProgress")!==(track.path!==undefined))fail("MOTION_PATH_INVALID","已保存路径动画缺少路径。");
    if(["opacity","drawProgress","pathProgress"].includes(track.property)&&(Math.min(track.from,track.to)<0||Math.max(track.from,track.to)>1))fail("MOTION_VALUE_INVALID","已保存动画数值越界。");
    if(track.property==="scale"&&(Math.min(track.from,track.to)<=0||Math.max(track.from,track.to)>20))fail("MOTION_VALUE_INVALID","已保存缩放无效。");
  }
}
