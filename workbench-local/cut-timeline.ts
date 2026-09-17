import {z} from 'zod';

// Proxy video, timeline, and renderer share this fixed frame rate.
export const CUT_FPS = 30;
const id = z.string().min(1).max(256);
const frame = z.number().int().nonnegative().max(100_000_000);
const filename = z.string().regex(/^[a-zA-Z0-9_.-]+$/).refine(name => name !== '.' && name !== '..');
const wordSchema = z.object({
  id, text: z.string(), startMs: z.number().finite().nonnegative(),
  endMs: z.number().finite().nonnegative(),
}).strict().refine(w => w.endMs > w.startMs, '词的结束时间必须晚于开始时间');
export const clipTransformSchema = z.object({
  x: z.number().finite().min(-3840).max(3840).default(0),
  y: z.number().finite().min(-2160).max(2160).default(0),
  scale: z.number().finite().min(0.05).max(8).default(1),
  rotation: z.number().finite().min(-360).max(360).default(0),
  // Cropping is normalized to source dimensions, before scale/rotation.
  crop: z.object({
    left: z.number().min(0).max(0.99), right: z.number().min(0).max(0.99),
    top: z.number().min(0).max(0.99), bottom: z.number().min(0).max(0.99),
  }).strict().refine(c => c.left + c.right < 1 && c.top + c.bottom < 1,
    '裁剪后必须保留画面').default({left: 0, right: 0, top: 0, bottom: 0}),
  volume: z.number().finite().min(0).max(4).default(1),
}).strict();
export const timelineAssetSchema = z.object({
  id, name: z.string().min(1), durationFrames: frame.positive(),
  sourceFileName: filename,
  proxyFileName: filename,
  words: z.array(wordSchema).max(50_000),
}).strict();
export const timelineClipSchema = z.object({
  id, assetId: id, inFrame: frame, outFrame: frame,
  transform: clipTransformSchema.default(() => clipTransformSchema.parse({})),
  // Set only by migration. New/repeated inserts must use occurrence word IDs.
  legacyWordIds: z.boolean().optional(),
}).strict();
export const cutTimelineSchema = z.object({
  schemaVersion: z.literal(1),
  assets: z.array(timelineAssetSchema).max(1000),
  clips: z.array(timelineClipSchema).max(10_000),
}).strict().superRefine((timeline, ctx) => {
  const assets = new Map(timeline.assets.map(a => [a.id, a]));
  const fail = (message: string) => ctx.addIssue({code: 'custom', message});
  if (assets.size !== timeline.assets.length) fail('素材 ID 重复');
  if (new Set(timeline.clips.map(c => c.id)).size !== timeline.clips.length) fail('片段 ID 重复');
  for (const asset of timeline.assets) {
    if (new Set(asset.words.map(w => w.id)).size !== asset.words.length) fail('素材内词 ID 重复');
    let prior = -1;
    for (const word of asset.words) {
      if (word.startMs < prior || word.endMs > asset.durationFrames * 1000 / CUT_FPS + 1e-6)
        fail('转写词顺序错误或超出素材时长');
      prior = word.startMs;
    }
  }
  for (const clip of timeline.clips) {
    const asset = assets.get(clip.assetId);
    if (!asset || clip.outFrame <= clip.inFrame || clip.outFrame > asset.durationFrames)
      fail('片段素材不存在或截取范围错误');
  }
});
export type CutTimeline = z.infer<typeof cutTimelineSchema>;
export type TimelineClip = z.infer<typeof timelineClipSchema>;
export type ClipTransform = z.infer<typeof clipTransformSchema>;

/** Clip identity survives reordering and trimming; a repeated insert gets a new id. */
export function timelineWordId(clipId: string, sourceWordId: string): string {
  return JSON.stringify([clipId, sourceWordId]);
}

/** Half-open source/timeline frame intervals, also used by the render plan. */
export function resolveCutTimeline(input: unknown) {
  const timeline = cutTimelineSchema.parse(input);
  const assets = new Map(timeline.assets.map(a => [a.id, a]));
  let offset = 0;
  const clips = timeline.clips.map(clip => {
    const startFrame = offset;
    offset += clip.outFrame - clip.inFrame;
    return {...clip, startFrame, endFrame: offset, asset: assets.get(clip.assetId)!};
  });
  const words = clips.flatMap(clip => {
    const startMs = clip.inFrame * 1000 / CUT_FPS;
    const endMs = clip.outFrame * 1000 / CUT_FPS;
    return clip.asset.words.flatMap(word => {
      const sourceStartMs = Math.max(startMs, word.startMs);
      const sourceEndMs = Math.min(endMs, word.endMs);
      if (sourceStartMs >= sourceEndMs) return [];
      return [{
        id: timelineWordId(clip.id, word.id), clipId: clip.id,
        legacySourceId: clip.legacyWordIds ? word.id : undefined,
        assetId: clip.assetId, sourceWordId: word.id, text: word.text,
        startMs: clip.startFrame * 1000 / CUT_FPS + (sourceStartMs - startMs),
        endMs: clip.startFrame * 1000 / CUT_FPS + (sourceEndMs - startMs),
        sourceStartMs, sourceEndMs,
      }];
    });
  });
  return {clips, words, durationFrames: offset};
}

/** At a cut boundary the next clip owns the frame; the end has no active clip. */
export function sourceAtTimelineFrame(input: unknown, atFrame: number) {
  if (!Number.isSafeInteger(atFrame) || atFrame < 0) return null;
  const clip = resolveCutTimeline(input).clips.find(c => atFrame >= c.startFrame && atFrame < c.endFrame);
  return clip ? {clipId: clip.id, assetId: clip.assetId,
    sourceFrame: clip.inFrame + atFrame - clip.startFrame, transform: clip.transform} : null;
}
