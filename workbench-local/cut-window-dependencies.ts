import {
  CUT_FPS,
  resolveCutTimeline,
  type ClipTransform,
} from './cut-timeline';

/** An absolute, half-open output window in the fixed 30fps cut timeline. */
export type AbsoluteCutWindow = Readonly<{
  from: number;
  end: number;
}>;

/** The small part of a cut state needed to describe its media dependencies. */
export type CutWindowState = Readonly<{
  timeline?: unknown;
  asset?: Readonly<{
    url?: unknown;
    durationMs?: unknown;
    name?: unknown;
  }> | null;
  ranges?: readonly unknown[];
  /** Accepted for structural compatibility and intentionally ignored. */
  revision?: unknown;
  preview?: unknown;
  words?: readonly unknown[];
}>;

export type TimelineCutWindowSegment = Readonly<{
  /** Output frames relative to the requested window. Both ends are half-open. */
  windowOffsetFrames: Readonly<AbsoluteCutWindow>;
  /** Source frame window in the proxy file. Both ends are half-open. */
  sourceInFrame: number;
  sourceOutFrame: number;
  proxyFileName: string;
  transform: ClipTransform;
}>;

export type TimelineCutWindowDependencies = Readonly<{
  kind: 'timeline';
  window: AbsoluteCutWindow;
  segments: readonly TimelineCutWindowSegment[];
}>;

export type LegacyCutWindowSegment = Readonly<{
  /** Milliseconds relative to the requested output window. */
  windowOffsetMs: Readonly<{
    from: number;
    end: number;
  }>;
  /** The source millisecond window represented by this legacy FFmpeg range. */
  sourceStartMs: number;
  sourceEndMs: number;
  /** The original state range, retained so callers do not mistake this for frame precision. */
  originalRangeMs: Readonly<{
    startMs: number;
    endMs: number;
  }>;
  proxyFileName: string;
}>;

export type LegacySourceRange = Readonly<{
  originalRangeMs: Readonly<{
    startMs: number;
    endMs: number;
  }>;
  /** The source frame bounds produced by the old FFmpeg trim expression. */
  sourceInFrame: number;
  sourceOutFrame: number;
}>;

export type LegacyCutWindowDependencies = Readonly<{
  kind: 'legacy';
  /** Legacy ranges are represented conservatively in milliseconds, not exact source frames. */
  precision: 'milliseconds-conservative';
  /** The old path has no proof that a window maps exactly after frame rounding and concat. */
  canReuseExactly: false;
  window: AbsoluteCutWindow;
  proxyFileName: string;
  /** Every original range is retained; local segments alone are insufficient for reuse. */
  rangesMs: readonly Readonly<{
    startMs: number;
    endMs: number;
  }>[];
  /** Actual `Math.round(ms * 30 / 1000)` source bounds used by the old video trim. */
  sourceFrameRanges: readonly LegacySourceRange[];
  windowMs: Readonly<{
    from: number;
    end: number;
  }>;
  segments: readonly LegacyCutWindowSegment[];
}>;

export type CutWindowDependencies =
  | TimelineCutWindowDependencies
  | LegacyCutWindowDependencies;

function fail(message: string): never {
  throw new Error(`无法描述粗剪窗口依赖：${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validateWindow(window: AbsoluteCutWindow): AbsoluteCutWindow {
  if (!isRecord(window) || !Number.isSafeInteger(window.from) || !Number.isSafeInteger(window.end) ||
      window.from < 0 || window.end <= window.from) {
    fail('窗口必须是非负整数帧的半开区间 [from,end)，且 end > from');
  }
  return {from: window.from, end: window.end};
}

function cloneTransform(transform: ClipTransform): ClipTransform {
  return {
    x: transform.x,
    y: transform.y,
    scale: transform.scale,
    rotation: transform.rotation,
    crop: {
      left: transform.crop.left,
      right: transform.crop.right,
      top: transform.crop.top,
      bottom: transform.crop.bottom,
    },
    volume: transform.volume,
  };
}

function describeTimeline(input: unknown, window: AbsoluteCutWindow): TimelineCutWindowDependencies {
  const resolved = resolveCutTimeline(input);
  if (window.end > resolved.durationFrames) {
    fail('窗口超出时间线，不能返回不完整的依赖描述');
  }
  const segments: TimelineCutWindowSegment[] = [];

  for (const clip of resolved.clips) {
    const overlapFrom = Math.max(window.from, clip.startFrame);
    const overlapEnd = Math.min(window.end, clip.endFrame);
    if (overlapFrom >= overlapEnd) continue;

    segments.push({
      windowOffsetFrames: {
        from: overlapFrom - window.from,
        end: overlapEnd - window.from,
      },
      sourceInFrame: clip.inFrame + overlapFrom - clip.startFrame,
      sourceOutFrame: clip.inFrame + overlapEnd - clip.startFrame,
      proxyFileName: clip.asset.proxyFileName,
      transform: cloneTransform(clip.transform),
    });
  }

  if (!segments.length) fail('窗口没有覆盖任何时间线片段');
  return {kind: 'timeline', window, segments};
}

function parseLegacyProxyFileName(url: unknown): string {
  if (typeof url !== 'string' || !url.startsWith('/cut-media/')) {
    fail('legacy 素材 URL 必须以 /cut-media/ 开头');
  }
  const rawName = url.slice('/cut-media/'.length);
  if (!rawName || rawName === '.' || rawName === '..' || rawName.includes('/') || rawName.includes('\\') ||
      rawName.includes('?') || rawName.includes('#') || rawName.includes('\u0000')) {
    fail('legacy 素材 URL 必须只包含一个安全文件名');
  }

  let decodedName: string;
  try {
    decodedName = decodeURIComponent(rawName);
  } catch {
    fail('legacy 素材 URL 含有无效编码');
  }
  if (!decodedName || decodedName === '.' || decodedName === '..' || decodedName.includes('/') ||
      decodedName.includes('\\') || decodedName.includes('\u0000')) {
    fail('legacy 素材 URL 不能包含路径穿越');
  }
  return rawName;
}

type LegacyRange = Readonly<{
  startMs: number;
  endMs: number;
}>;

function parseLegacyRanges(state: CutWindowState): LegacyRange[] {
  if (!Array.isArray(state.ranges) || state.ranges.length === 0) {
    fail('legacy state 必须包含至少一个毫秒范围');
  }
  const ranges: LegacyRange[] = [];
  let previousEndMs = 0;
  for (const [index, value] of state.ranges.entries()) {
    if (!isRecord(value) || !isFiniteNonNegative(value.startMs) || !isFiniteNonNegative(value.endMs) ||
        value.endMs <= value.startMs) {
      fail(`legacy 范围 ${index} 必须满足 0 <= startMs < endMs`);
    }
    if (index > 0 && value.startMs < previousEndMs) {
      fail('legacy 范围必须按时间顺序且不能重叠');
    }
    const range = {startMs: value.startMs, endMs: value.endMs};
    ranges.push(range);
    previousEndMs = range.endMs;
  }
  return ranges;
}

function describeLegacy(state: CutWindowState, window: AbsoluteCutWindow): LegacyCutWindowDependencies {
  if (!isRecord(state.asset) || state.asset === null) fail('legacy state 缺少素材');
  const proxyFileName = parseLegacyProxyFileName(state.asset.url);
  const ranges = parseLegacyRanges(state);
  const durationMs = state.asset.durationMs;
  if (durationMs !== undefined) {
    if (!isFiniteNonNegative(durationMs) || durationMs <= 0) {
      fail('legacy 素材 durationMs 必须是正数');
    }
    const validatedDurationMs = durationMs;
    const outOfBounds = ranges.find((range) => range.endMs > validatedDurationMs);
    if (outOfBounds) fail('legacy 范围超出素材 durationMs');
  }

  const sourceFrameRanges: LegacySourceRange[] = ranges.map((range) => {
    const sourceInFrame = Math.round(range.startMs * CUT_FPS / 1000);
    const sourceOutFrame = Math.round(range.endMs * CUT_FPS / 1000);
    if (sourceOutFrame <= sourceInFrame) {
      fail('legacy 范围经过 FFmpeg 帧取整后为空');
    }
    return {
      originalRangeMs: {startMs: range.startMs, endMs: range.endMs},
      sourceInFrame,
      sourceOutFrame,
    };
  });

  const windowMs = {
    from: window.from * 1000 / CUT_FPS,
    end: window.end * 1000 / CUT_FPS,
  };
  const segments: LegacyCutWindowSegment[] = [];
  let outputOffsetMs = 0;
  for (const range of ranges) {
    const rangeDurationMs = range.endMs - range.startMs;
    const rangeOutputEndMs = outputOffsetMs + rangeDurationMs;
    const overlapFrom = Math.max(windowMs.from, outputOffsetMs);
    const overlapEnd = Math.min(windowMs.end, rangeOutputEndMs);
    if (overlapFrom < overlapEnd) {
      segments.push({
        windowOffsetMs: {
          from: overlapFrom - windowMs.from,
          end: overlapEnd - windowMs.from,
        },
        sourceStartMs: range.startMs + overlapFrom - outputOffsetMs,
        sourceEndMs: range.startMs + overlapEnd - outputOffsetMs,
        originalRangeMs: {startMs: range.startMs, endMs: range.endMs},
        proxyFileName,
      });
    }
    outputOffsetMs = rangeOutputEndMs;
  }

  if (windowMs.end > outputOffsetMs + 1e-7) {
    fail('窗口超出 legacy 粗剪范围，不能返回不完整的保守描述');
  }
  if (!segments.length) fail('窗口没有覆盖任何 legacy 粗剪范围');
  return {
    kind: 'legacy',
    precision: 'milliseconds-conservative',
    canReuseExactly: false,
    window,
    proxyFileName,
    rangesMs: ranges.map((range) => ({startMs: range.startMs, endMs: range.endMs})),
    sourceFrameRanges,
    windowMs,
    segments,
  };
}

/**
 * Describe only the media and transforms that can affect an absolute cut window.
 *
 * Timeline state is resolved through `resolveCutTimeline`, so clip order, trims,
 * repeated assets, and transforms are reflected in the returned segments. Legacy
 * ranges deliberately stay in milliseconds because the old FFmpeg path converts
 * them to frame trims internally; this function does not claim exact frame parity.
 */
export function describeCutWindowDependencies(
  state: CutWindowState,
  requestedWindow: AbsoluteCutWindow,
): CutWindowDependencies {
  const window = validateWindow(requestedWindow);
  if (!isRecord(state)) fail('state 必须是对象');
  if (Object.prototype.hasOwnProperty.call(state, 'timeline') && state.timeline !== undefined) {
    return describeTimeline(state.timeline, window);
  }
  return describeLegacy(state, window);
}

/** Short alias for callers that already use the cut-window terminology. */
export const cutWindowDependencies = describeCutWindowDependencies;
