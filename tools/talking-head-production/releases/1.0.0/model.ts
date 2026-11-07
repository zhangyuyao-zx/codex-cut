import {staticFile} from 'remotion';

export type Rect = {x: number; y: number; width: number; height: number};
/** Coordinates and extents relative to the original source, wholly inside it. */
export type NormalizedRect = Rect;

export type MediaView = {
  rect: Rect;
  opacity: number;
  radius: number;
  rotation: number;
  blur: number;
  saturation: number;
  brightness: number;
  zoom: number;
  focalX: number;
  focalY: number;
};

export type ViewChange = {at: number; duration: number; to: Partial<MediaView>};
export type Beat = {wordId: string; label: string; frame: number; durationFrames?: number};
export type MediaSource = {
  id: string;
  src: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
  /** Source duration and trim are measured at the composition FPS. */
  durationFrames?: number;
  trimBefore?: number;
};

const numericViewKeys = [
  'opacity', 'radius', 'rotation', 'blur', 'saturation', 'brightness', 'zoom', 'focalX', 'focalY',
] as const;
const rectKeys = ['x', 'y', 'width', 'height'] as const;

const finite = (value: number, name: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
};

const frameNumber = (value: number, name: string) => {
  finite(value, name);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative integral frame`);
  }
};

export const assertRect = (rect: Rect, name = 'rect'): void => {
  if (!rect || typeof rect !== 'object') throw new Error(`${name} is required`);
  for (const key of rectKeys) finite(rect[key], `${name}.${key}`);
  if (rect.width <= 0 || rect.height <= 0) throw new Error(`${name} dimensions must be positive`);
};

const assertViewPatch = (patch: Partial<MediaView>, name: string): void => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error(`${name} must be a view target`);
  }
  if ('rect' in patch) assertRect(patch.rect as Rect, `${name}.rect`);
  for (const key of numericViewKeys) {
    if (!(key in patch)) continue;
    const value = patch[key] as number;
    finite(value, `${name}.${key}`);
    if (['opacity', 'focalX', 'focalY'].includes(key) && (value < 0 || value > 1)) {
      throw new Error(`${name}.${key} must be in [0, 1]`);
    }
    if (['radius', 'blur', 'saturation', 'brightness'].includes(key) && value < 0) {
      throw new Error(`${name}.${key} must be nonnegative`);
    }
    if (key === 'zoom' && value <= 0) throw new Error(`${name}.zoom must be positive`);
  }
};

export const assertMediaView = (view: MediaView): void => {
  assertRect(view?.rect);
  assertViewPatch(view, 'view');
  for (const key of numericViewKeys) finite(view[key], `view.${key}`);
};

export const makeMediaView = (
  rect: Rect,
  patch: Partial<Omit<MediaView, 'rect'>> = {},
): MediaView => {
  const view: MediaView = {
    rect: {...rect}, opacity: 1, radius: 0, rotation: 0, blur: 0,
    saturation: 1, brightness: 1, zoom: 1, focalX: 0.5, focalY: 0.5, ...patch,
  };
  assertMediaView(view);
  return view;
};

/** Changes may touch at a boundary; a zero-duration change is an exact step. */
export const validateChanges = (changes: readonly ViewChange[], durationFrames: number): void => {
  frameNumber(durationFrames, 'durationFrames');
  if (!Array.isArray(changes)) throw new Error('changes must be an array');
  let previousEnd = 0;
  for (const [index, change] of changes.entries()) {
    if (!change || typeof change !== 'object') throw new Error(`changes[${index}] is invalid`);
    frameNumber(change.at, `changes[${index}].at`);
    frameNumber(change.duration, `changes[${index}].duration`);
    const end = change.at + change.duration;
    if (!Number.isSafeInteger(end) || end > durationFrames) {
      throw new Error(`changes[${index}] exceeds durationFrames ${durationFrames}`);
    }
    if (change.at < previousEnd) throw new Error(`changes[${index}] is unsorted or overlaps the previous change`);
    assertViewPatch(change.to, `changes[${index}].to`);
    previousEnd = end;
  }
};

const mergeView = (view: MediaView, patch: Partial<MediaView>): MediaView => ({
  ...view, ...patch, rect: {...(patch.rect ?? view.rect)},
});

export const viewAt = (initial: MediaView, changes: readonly ViewChange[], frame: number): MediaView => {
  assertMediaView(initial);
  frameNumber(frame, 'frame');
  // This validates ordering and fields without inventing a scene duration.
  validateChanges(changes, Number.MAX_SAFE_INTEGER);
  let state = mergeView(initial, {});
  for (const change of changes) {
    if (frame < change.at) break;
    const target = mergeView(state, change.to);
    if (change.duration === 0 || frame >= change.at + change.duration) {
      state = target;
      continue;
    }
    const progress = (frame - change.at) / change.duration;
    const eased = progress * progress * (3 - 2 * progress);
    const result = mergeView(state, {});
    for (const key of numericViewKeys) result[key] = state[key] + (target[key] - state[key]) * eased;
    for (const key of rectKeys) result.rect[key] = state.rect[key] + (target.rect[key] - state.rect[key]) * eased;
    return result;
  }
  return state;
};

export const requireBeat = (beats: readonly Beat[], key: string): Beat => {
  const wordMatches = beats.filter((beat) => beat.wordId === key);
  const matches = wordMatches.length > 0 ? wordMatches : beats.filter((beat) => beat.label === key);
  if (matches.length === 0) throw new Error(`Missing beat "${key}"`);
  if (matches.length > 1) throw new Error(`Ambiguous beat "${key}": ${matches.length} exact matches`);
  const beat = matches[0];
  frameNumber(beat.frame, `Beat "${key}" frame`);
  if (beat.durationFrames !== undefined) frameNumber(beat.durationFrames, `Beat "${key}" durationFrames`);
  return beat;
};

export const resolveMediaSrc = (src: string): string => {
  if (typeof src !== 'string' || !src.trim()) throw new Error('Media src must be a nonempty string');
  if (/^https?:/i.test(src)) {
    try {
      const url = new URL(src);
      if (!url.hostname) throw new Error('Missing host');
    } catch {
      throw new Error('Media src must be a valid HTTP(S) URL');
    }
    return src;
  }
  if (src.startsWith('/') || /^(data:|blob:)/i.test(src)) return src;
  if (/^[a-z][a-z\d+.-]*:/i.test(src)) throw new Error(`Unsupported media src scheme: ${src.split(':')[0]}`);
  return staticFile(src);
};

export const assertMediaSpan = (source: MediaSource, timelineStart: number, timelineEnd: number): void => {
  if (!source || typeof source !== 'object') throw new Error('Media source is required');
  if (typeof source.id !== 'string' || !source.id.trim()) throw new Error('Media source id must be nonempty');
  resolveMediaSrc(source.src);
  if (source.kind !== 'image' && source.kind !== 'video') throw new Error(`Media "${source.id}" has an invalid kind`);
  frameNumber(timelineStart, 'timelineStart');
  frameNumber(timelineEnd, 'timelineEnd');
  if (timelineEnd <= timelineStart) throw new Error('Media timelineEnd must be after timelineStart');
  for (const key of ['width', 'height'] as const) {
    if (source[key] !== undefined) {
      finite(source[key], `Media "${source.id}" ${key}`);
      if (source[key] <= 0) throw new Error(`Media "${source.id}" ${key} must be positive`);
    }
  }
  const trim = source.trimBefore ?? 0;
  frameNumber(trim, `Media "${source.id}" trimBefore`);
  if (source.durationFrames !== undefined) frameNumber(source.durationFrames, `Media "${source.id}" durationFrames`);
  if (source.kind === 'video') {
    if (source.durationFrames === undefined) throw new Error(`Video "${source.id}" requires declared durationFrames`);
    if (trim + timelineEnd - timelineStart > source.durationFrames) {
      throw new Error(`Video "${source.id}" has insufficient source frames after trimBefore; implicit looping is not supported`);
    }
  }
};

export type EvidenceCropGeometry = {viewport: Rect; image: Rect; scale: number};

/** Image placement is relative to viewport; viewport placement is relative to the view box. */
export const evidenceCropGeometry = (
  sourceWidth: number,
  sourceHeight: number,
  crop: NormalizedRect,
  rect: Rect,
): EvidenceCropGeometry => {
  finite(sourceWidth, 'Source width');
  finite(sourceHeight, 'Source height');
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error('Evidence source dimensions must be positive');
  assertRect(rect);
  assertRect(crop, 'crop');
  if (crop.x < 0 || crop.y < 0 || crop.x > 1 || crop.y > 1 || crop.width > 1 || crop.height > 1 ||
    crop.x + crop.width > 1 || crop.y + crop.height > 1) {
    throw new Error('crop must be normalized and wholly inside the source');
  }
  const width = sourceWidth * crop.width;
  const height = sourceHeight * crop.height;
  const scale = Math.min(rect.width / width, rect.height / height);
  const viewportWidth = width * scale;
  const viewportHeight = height * scale;
  return {
    scale,
    viewport: {x: (rect.width - viewportWidth) / 2, y: (rect.height - viewportHeight) / 2, width: viewportWidth, height: viewportHeight},
    image: {x: -sourceWidth * crop.x * scale, y: -sourceHeight * crop.y * scale, width: sourceWidth * scale, height: sourceHeight * scale},
  };
};
