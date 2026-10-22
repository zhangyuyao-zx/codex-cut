import {expect, it} from 'vitest';
import {transformAtPointer, transformChanges, parentCanvasTransform, type CanvasGesture} from './canvas-geometry';

const gesture: CanvasGesture = {mode: 'move', start: {x: 100, y: 80}, center: {x: 50, y: 50}, viewportScale: .25,
  before: {x: 32, y: -12, scale: 1.2, rotation: 30}};
it('converts CSS-pixel movement to video coordinates without changing existing scale or rotation', () => {
  expect(transformAtPointer(gesture, {x: 150, y: 70})).toEqual({x: 232, y: -52, scale: 1.2, rotation: 30});
  expect(transformAtPointer({...gesture, viewportScale: .5}, {x: 150, y: 70}).x).toBe(132);
});
it('scales around the object center and constrains degenerate gestures', () => {
  expect(transformAtPointer({...gesture, mode: 'scale', start: {x: 100, y: 50}}, {x: 150, y: 50}).scale).toBe(2.4);
  expect(transformAtPointer({...gesture, mode: 'scale', start: {x: 50, y: 50}}, {x: 150, y: 50})).toEqual(gesture.before);
  expect(transformAtPointer({...gesture, mode: 'scale'}, {x: 10000, y: 10000}).scale).toBe(8);
});
it('converts a nested child drag back through scaled and rotated parent coordinates', () => {
  const parent=parentCanvasTransform({group:{scale:2,rotation:90},outer:{scale:.5,rotation:15}},[
    {id:'child',parentId:'group',parameters:[]},{id:'group',parentId:'outer',parameters:[]},{id:'outer',parameters:[]},
  ],'child');
  expect(parent).toEqual({scale:1,rotation:105});
  const moved=transformAtPointer({...gesture,viewportScale:.5,parentRotation:90},{x:100,y:130});
  expect(moved.x).toBe(132);expect(moved.y).toBe(-12);
  expect(parentCanvasTransform(undefined,[{id:'root',parameters:[]}],'root')).toEqual({scale:1,rotation:0});
});
it('rotates through the angle wrap without jumping by 360 degrees and can snap', () => {
  const nearLeft = {...gesture, mode: 'rotate' as const, start: {x: -50, y: 51}};
  expect(transformAtPointer(nearLeft, {x: -50, y: 49}).rotation).toBeCloseTo(31.146, 3);
  expect(transformAtPointer({...gesture, mode: 'rotate', start: {x: 100, y: 50}}, {x: 50, y: 100}, true).rotation).toBe(120);
});
it('a gesture produces only changed fields and no command for a click or invalid viewport', () => {
  expect(transformChanges(gesture.before, transformAtPointer(gesture, gesture.start))).toEqual([]);
  expect(transformChanges(gesture.before, {...gesture.before, x: 72})).toEqual([{kind: 'transform', key: 'x', before: 32, after: 72}]);
  expect(transformAtPointer({...gesture, viewportScale: 0}, {x: 200, y: 200})).toEqual(gesture.before);
});
