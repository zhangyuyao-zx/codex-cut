import type {CanvasTransform} from './editor-commands';

export type CanvasPoint = {x: number; y: number};
export type CanvasGesture = {
  mode: 'move' | 'scale' | 'rotate';
  start: CanvasPoint;
  center: CanvasPoint;
  viewportScale: number;
  before: CanvasTransform;
};
const round = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Pointer coordinates are CSS pixels; persisted translations are video pixels. */
export function transformAtPointer(gesture: CanvasGesture, point: CanvasPoint, snap = false): CanvasTransform {
  const {before, start, center} = gesture;
  if (![point.x, point.y, gesture.viewportScale].every(Number.isFinite) || gesture.viewportScale <= 0) return before;
  if (gesture.mode === 'move') return {...before,
    x: round(clamp(before.x + (point.x - start.x) / gesture.viewportScale, -20000, 20000)),
    y: round(clamp(before.y + (point.y - start.y) / gesture.viewportScale, -20000, 20000))};
  if (gesture.mode === 'scale') {
    const radius = Math.hypot(start.x - center.x, start.y - center.y);
    if (radius < 1) return before;
    return {...before, scale: round(clamp(before.scale * Math.hypot(point.x - center.x, point.y - center.y) / radius, .05, 8))};
  }
  const angle = Math.atan2(point.y - center.y, point.x - center.x) - Math.atan2(start.y - center.y, start.x - center.x);
  const delta = Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI;
  const rotation = before.rotation + delta;
  return {...before, rotation: round(clamp(snap ? Math.round(rotation / 15) * 15 : rotation, -3600, 3600))};
}

export function transformChanges(before: CanvasTransform, after: CanvasTransform) {
  return (['x', 'y', 'scale', 'rotation'] as const)
    .filter(key => before[key] !== after[key])
    .map(key => ({kind: 'transform' as const, key, before: before[key], after: after[key]}));
}
