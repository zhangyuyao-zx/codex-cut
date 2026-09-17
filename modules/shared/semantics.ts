import {z} from 'zod';
import type {CaptionCue, ProjectDocument} from './project.js';

/** The deterministic, local semantic vocabulary used by the packaging planner. */
export const semanticIntentSchema = z.enum([
  'hook',
  'title',
  'claim',
  'data',
  'step',
  'comparison',
  'warning',
  'summary',
  'cta',
]);
export type SemanticIntent = z.infer<typeof semanticIntentSchema>;

export const semanticAnalysisSourceSchema = z.enum(['local', 'manual', 'codex']);
export type SemanticAnalysisSource = z.infer<typeof semanticAnalysisSourceSchema>;

export const semanticEmphasisSchema = z.union([
  z.enum(['low', 'medium', 'high']),
  z.number().min(0).max(1),
]);
export type SemanticEmphasis = z.infer<typeof semanticEmphasisSchema>;

/**
 * A cue is intentionally independent of transcript text.  `captionIds` point
 * back to the reviewable source captions, while keywords/metric make the
 * decision understandable without running a model.
 */
export const semanticCueSchema = z.object({
  id: z.string().min(1),
  captionIds: z.array(z.string().min(1)),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  intent: semanticIntentSchema,
  keywords: z.array(z.string().min(1)),
  metric: z.string().nullable().default(null),
  emphasis: semanticEmphasisSchema.default('medium'),
  confidence: z.number().min(0).max(1).default(0.6),
  locked: z.boolean().default(false),
  lockSource: semanticAnalysisSourceSchema.nullable().default(null),
  analysisSource: semanticAnalysisSourceSchema.default('local'),
}).passthrough().superRefine((cue, context) => {
  if (cue.endFrame <= cue.startFrame) {
    context.addIssue({code: 'custom', path: ['endFrame'], message: 'endFrame must be after startFrame'});
  }
});
export type SemanticCue = z.infer<typeof semanticCueSchema>;

export const semanticAnalysisSchema = z.object({
  cues: z.array(semanticCueSchema).default([]),
  source: semanticAnalysisSourceSchema.default('local'),
  generatedAt: z.string().optional(),
}).passthrough();
export type SemanticAnalysis = z.infer<typeof semanticAnalysisSchema>;

export type SemanticAnalysisInput =
  | Pick<ProjectDocument, 'captions' | 'fps' | 'durationInFrames'>
  | Pick<ProjectDocument, 'captions' | 'fps'>
  | readonly CaptionCue[];

export type SemanticAnalyzerOptions = {
  fps?: number;
  durationInFrames?: number;
  priorCues?: readonly SemanticCue[];
};

const HOOK_MARKERS = [
  '?',
  '？',
  '为什么',
  '怎么',
  '如何',
  '到底',
  '你是否',
  '有没有',
  '想知道',
  '难道',
  '第一秒',
  '前三秒',
  '前几秒',
  '开头',
];
const TITLE_MARKERS = [
  '今天聊',
  '今天我们',
  '本期',
  '这一期',
  '主题是',
  '标题是',
  '开场',
  '先来聊聊',
];
const STEP_MARKERS = ['第一步', '首先', '第二步', '其次', '第三步', '最后', '接下来', '然后'];
const COMPARISON_MARKERS = ['对比', '相比', '之前之后', '之前', '之后', '但是', '而不是', '区别', '差异', '更好'];
const WARNING_MARKERS = ['不要', '不能', '风险', '警告', '注意', '避免', '千万', '小心', '切勿', '别再'];
const SUMMARY_MARKERS = ['总结', '所以', '总之', '核心', '结论', '换句话说', '归根结底', '记住'];
const CTA_MARKERS = ['关注', '评论', '点赞', '收藏', '私信', '告诉我', '转发', '订阅', '留言', '下期'];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** A small synchronous hash; unlike crypto APIs this also works in the browser worker. */
export const stableSemanticHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

const normalizeText = (text: string) => text.replace(/\s+/g, '').trim().toLocaleLowerCase();

const containsAny = (text: string, markers: readonly string[]) => markers.some((marker) => text.includes(marker));

const extractMetric = (text: string): string | null => {
  const match = text.match(/\d+(?:\.\d+)?\s*(?:%|％|倍|万|亿|千|百)?/);
  return match?.[0]?.replace(/\s+/g, '') ?? null;
};

const extractKeywords = (text: string, intent: SemanticIntent): string[] => {
  const terms = text.match(/[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_-]{1,}|\d+(?:\.\d+)?(?:%|％|倍|万|亿)?/g) ?? [];
  const markers = {
    hook: HOOK_MARKERS,
    title: TITLE_MARKERS,
    claim: [],
    data: ['数据', '数字', '比例', '增长'],
    step: STEP_MARKERS,
    comparison: COMPARISON_MARKERS,
    warning: WARNING_MARKERS,
    summary: SUMMARY_MARKERS,
    cta: CTA_MARKERS,
  }[intent] as readonly string[];
  const selected = [...terms, ...markers.filter((marker) => text.includes(marker))];
  const unique: string[] = [];
  for (const term of selected) {
    const normalized = term.trim();
    if (normalized && !unique.includes(normalized)) unique.push(normalized);
  }
  return unique.slice(0, 8);
};

const classifyIntent = (text: string, index: number, captions: readonly CaptionCue[]): SemanticIntent => {
  const normalized = normalizeText(text);
  // Explicit requests and safety language should never be weakened by a number
  // or a question mark later in the sentence.
  if (containsAny(normalized, CTA_MARKERS)) return 'cta';
  if (containsAny(normalized, WARNING_MARKERS)) return 'warning';
  if (containsAny(normalized, COMPARISON_MARKERS)) return 'comparison';
  if (containsAny(normalized, STEP_MARKERS)) return 'step';
  if (extractMetric(normalized)) return 'data';
  if (containsAny(normalized, SUMMARY_MARKERS)) return 'summary';
  const isFirstCaption = index === 0;
  const isEarly = captions[index] ? captions[index].startMs <= 5_000 : false;
  // A declared topic marker wins over a rhetorical “如何” inside the title.
  // Questions without a title marker remain hooks.
  if (isFirstCaption && containsAny(normalized, TITLE_MARKERS)) return 'title';
  if (containsAny(normalized, HOOK_MARKERS)) return 'hook';
  // A short topic introduction is a title; a longer/curious early sentence is
  // a hook.  This keeps “今天聊...” from being mislabeled as a hook.
  if (isFirstCaption && isEarly && normalized.length <= 24 && !/[。！？?!]/.test(text)) return 'title';
  return 'claim';
};

const asInput = (input: SemanticAnalysisInput, options?: SemanticAnalyzerOptions) => {
  if (Array.isArray(input)) {
    return {
      captions: input,
      fps: options?.fps ?? 30,
      durationInFrames: options?.durationInFrames,
    };
  }
  const projectLike = input as Pick<ProjectDocument, 'captions' | 'fps' | 'durationInFrames'>;
  return {
    captions: projectLike.captions,
    fps: projectLike.fps,
    durationInFrames: projectLike.durationInFrames,
  };
};

const bestOverlap = (cue: SemanticCue, captions: readonly CaptionCue[], fps: number): CaptionCue[] => {
  const startMs = cue.startFrame / fps * 1000;
  const endMs = cue.endFrame / fps * 1000;
  const overlap = captions.filter((caption) => Math.min(endMs, caption.endMs) > Math.max(startMs, caption.startMs));
  if (overlap.length) return overlap;
  const center = (startMs + endMs) / 2;
  const nearest = captions
    .map((caption) => ({caption, distance: Math.abs((caption.startMs + caption.endMs) / 2 - center)}))
    .sort((left, right) => left.distance - right.distance || left.caption.id.localeCompare(right.caption.id))[0];
  return nearest ? [nearest.caption] : [];
};

const overlapsExistingLocked = (candidate: SemanticCue, locked: readonly SemanticCue[]) => locked.some((cue) =>
  Math.min(candidate.endFrame, cue.endFrame) > Math.max(candidate.startFrame, cue.startFrame),
);

/**
 * Pure deterministic local analysis.  Calling it with the same captions and
 * timing yields byte-for-byte equivalent cue values (apart from no timestamp).
 */
export function analyzeSemanticCues(
  input: SemanticAnalysisInput,
  priorOrOptions: readonly SemanticCue[] | SemanticAnalyzerOptions = [],
  maybeOptions: SemanticAnalyzerOptions = {},
): SemanticCue[] {
  const options: SemanticAnalyzerOptions = Array.isArray(priorOrOptions)
    ? {...maybeOptions, priorCues: priorOrOptions as readonly SemanticCue[]}
    : priorOrOptions as SemanticAnalyzerOptions;
  const normalizedInput = asInput(input, options);
  const captions = [...normalizedInput.captions].sort((left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id));
  const fps = normalizedInput.fps > 0 ? normalizedInput.fps : 30;
  const prior = [...(options.priorCues ?? [])].map((cue) => semanticCueSchema.parse(cue));
  const locked = prior.filter((cue) => cue.locked);
  const generated: SemanticCue[] = [];

  captions.forEach((caption, index) => {
    if (!caption.text.trim()) return;
    const startFrame = Math.max(0, Math.floor(caption.startMs / 1000 * fps));
    const endFrame = Math.max(startFrame + 1, Math.ceil(caption.endMs / 1000 * fps));
    const intent = classifyIntent(caption.text, index, captions);
    const candidate: SemanticCue = {
      id: `semantic-${stableSemanticHash(`${caption.id}|${normalizeText(caption.text)}|${startFrame}|${endFrame}|${intent}`)}`,
      captionIds: [caption.id],
      startFrame,
      endFrame,
      intent,
      keywords: extractKeywords(caption.text, intent),
      metric: intent === 'data' ? extractMetric(caption.text) : null,
      emphasis: ['hook', 'warning', 'cta', 'data'].includes(intent) ? 'high' : 'medium',
      confidence: clamp(caption.confidence ?? 0.72, 0, 1),
      locked: false,
      lockSource: null,
      analysisSource: 'local',
    };
    if (!overlapsExistingLocked(candidate, locked)) generated.push(candidate);
  });

  // Locked cues are authoritative.  Keep their IDs and decisions verbatim so
  // caption reflow/re-analysis cannot silently overwrite a manual review.
  const preserved = prior.filter((cue) => cue.locked);
  const all = [...preserved, ...generated];
  const deduped = new Map<string, SemanticCue>();
  for (const cue of all) {
    if (!deduped.has(cue.id)) deduped.set(cue.id, cue);
  }
  return [...deduped.values()].sort((left, right) => left.startFrame - right.startFrame || left.endFrame - right.endFrame || left.id.localeCompare(right.id));
}

/** Compatibility alias used by callers that treat analysis as a noun. */
export const analyzeSemantics = analyzeSemanticCues;

export const createSemanticCueId = (parts: readonly (string | number)[]): string => `semantic-${stableSemanticHash(parts.join('|'))}`;

/** Return locked cues with the nearest current captions associated for display. */
export const resolveSemanticCueCaptions = (cue: SemanticCue, captions: readonly CaptionCue[], fps = 30): CaptionCue[] =>
  cue.captionIds.length ? captions.filter((caption) => cue.captionIds.includes(caption.id)) : bestOverlap(cue, captions, fps);

const manualConfidence = (captionIds: readonly string[], captions: readonly CaptionCue[], fallback: number) => {
  const values = captionIds
    .map((id) => captions.find((caption) => caption.id === id)?.confidence)
    .filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
};

const manualCueText = (captionIds: readonly string[], captions: readonly CaptionCue[]) => captionIds
  .map((id) => captions.find((caption) => caption.id === id)?.text ?? '')
  .filter(Boolean)
  .join(' ');

const manualEmphasisRank = (value: SemanticEmphasis) => typeof value === 'number'
  ? value
  : value === 'high' ? 1 : value === 'medium' ? .6 : .25;

/**
 * Manual semantic merge used by the workbench. The first cue remains the
 * stable identity; the result is locked because it is an explicit editorial
 * decision and must survive later automatic analysis.
 */
export const mergeSemanticCuesManually = (
  first: SemanticCue,
  second: SemanticCue,
  captions: readonly CaptionCue[] = [],
): SemanticCue => {
  if (first.id === second.id) throw new Error('Cannot merge a semantic cue with itself');
  const captionIds = [...new Set([...first.captionIds, ...second.captionIds])].sort((left, right) => {
    const leftCaption = captions.find((caption) => caption.id === left);
    const rightCaption = captions.find((caption) => caption.id === right);
    return (leftCaption?.startMs ?? Number.MAX_SAFE_INTEGER) - (rightCaption?.startMs ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right);
  });
  const text = manualCueText(captionIds, captions);
  const emphasis = manualEmphasisRank(first.emphasis) >= manualEmphasisRank(second.emphasis) ? first.emphasis : second.emphasis;
  return semanticCueSchema.parse({
    ...first,
    captionIds,
    startFrame: Math.min(first.startFrame, second.startFrame),
    endFrame: Math.max(first.endFrame, second.endFrame),
    keywords: text ? extractKeywords(text, first.intent) : [...new Set([...first.keywords, ...second.keywords])],
    metric: first.intent === 'data' && text ? extractMetric(text) : first.metric ?? second.metric,
    emphasis,
    confidence: (first.confidence + second.confidence) / 2,
    locked: true,
    lockSource: 'manual',
    analysisSource: 'manual',
  });
};

/** Split a multi-caption semantic cue before `firstRightCaptionId`. */
export const splitSemanticCueManually = (
  cue: SemanticCue,
  firstRightCaptionId: string,
  newCueId: string,
  captions: readonly CaptionCue[],
  fps: number,
): [SemanticCue, SemanticCue] => {
  const splitIndex = cue.captionIds.indexOf(firstRightCaptionId);
  if (splitIndex <= 0 || splitIndex >= cue.captionIds.length) throw new Error('Semantic split must be at an internal caption boundary');
  if (!newCueId || newCueId === cue.id) throw new Error('Semantic split requires a distinct cue ID');
  const leftIds = cue.captionIds.slice(0, splitIndex);
  const rightIds = cue.captionIds.slice(splitIndex);
  const rightCaption = captions.find((caption) => caption.id === firstRightCaptionId);
  const requestedFrame = rightCaption ? Math.floor(rightCaption.startMs / 1000 * fps) : Math.round((cue.startFrame + cue.endFrame) / 2);
  const splitFrame = Math.max(cue.startFrame + 1, Math.min(cue.endFrame - 1, requestedFrame));
  const build = (id: string, captionIds: string[], startFrame: number, endFrame: number): SemanticCue => {
    const text = manualCueText(captionIds, captions);
    return semanticCueSchema.parse({
      ...cue,
      id,
      captionIds,
      startFrame,
      endFrame,
      keywords: text ? extractKeywords(text, cue.intent) : cue.keywords,
      metric: cue.intent === 'data' && text ? extractMetric(text) : cue.metric,
      confidence: manualConfidence(captionIds, captions, cue.confidence),
      locked: true,
      lockSource: 'manual',
      analysisSource: 'manual',
    });
  };
  return [
    build(cue.id, leftIds, cue.startFrame, splitFrame),
    build(newCueId, rightIds, splitFrame, cue.endFrame),
  ];
};
