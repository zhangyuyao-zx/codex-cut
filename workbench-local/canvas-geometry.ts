import {objectTransformFor, type CanvasObjectCapability, type CanvasTransform} from './editor-commands';

export type CanvasPoint = {x: number; y: number};
export type CanvasGesture = {
  mode: 'move' | 'scale' | 'rotate';
  start: CanvasPoint;
  center: CanvasPoint;
  viewportScale: number;
  parentRotation?: number;
  before: CanvasTransform;
};
const round = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Pointer coordinates are CSS pixels; persisted translations are video pixels. */
export function transformAtPointer(gesture: CanvasGesture, point: CanvasPoint, snap = false): CanvasTransform {
  const {before, start, center} = gesture;
  if (![point.x, point.y, gesture.viewportScale].every(Number.isFinite) || gesture.viewportScale <= 0) return before;
  if (gesture.mode === 'move') {
    const angle = -(gesture.parentRotation ?? 0) * Math.PI / 180;
    const dx = point.x-start.x, dy=point.y-start.y;
    return {...before,
      x: round(clamp(before.x + (dx*Math.cos(angle)-dy*Math.sin(angle)) / gesture.viewportScale, -20000, 20000)),
      y: round(clamp(before.y + (dx*Math.sin(angle)+dy*Math.cos(angle)) / gesture.viewportScale, -20000, 20000))};
  }
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

export function parentCanvasTransform(transforms: Record<string, Partial<CanvasTransform>> | undefined, objects: readonly CanvasObjectCapability[], id: string) {
  let parentId = objects.find(object => object.id === id)?.parentId, scale = 1, rotation = 0;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId); const parent = objectTransformFor({objectTransforms:transforms},parentId);
    scale *= parent.scale; rotation += parent.rotation;
    parentId = objects.find(object => object.id === parentId)?.parentId;
  }
  return {scale,rotation};
}

export function transformChanges(before: CanvasTransform, after: CanvasTransform) {
  return (['x', 'y', 'scale', 'rotation'] as const)
    .filter(key => before[key] !== after[key])
    .map(key => ({kind: 'transform' as const, key, before: before[key], after: after[key]}));
}
