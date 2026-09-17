import {describe, expect, it} from 'vitest';
import {cutTimelineSchema, resolveCutTimeline, sourceAtTimelineFrame} from './cut-timeline';

const asset = (id: string) => ({id, name: id, durationFrames: 90,
  sourceFileName: `${id}.mp4`, proxyFileName: `${id}-proxy.mp4`,
  words: [{id: 'w1', text: '相同词 ID', startMs: 500, endMs: 1500},
    {id: 'w2', text: '后半', startMs: 2000, endMs: 2500}]});
const clip = (id: string, assetId: string, inFrame = 0, outFrame = 90) =>
  ({id, assetId, inFrame, outFrame});
const project = () => ({schemaVersion: 1, assets: [asset('a'), asset('b')],
  clips: [clip('first', 'a'), clip('second', 'b'), clip('repeat', 'a')]});

describe('multi-source cut timeline', () => {
  it('keeps repeated-source and cross-asset word occurrences distinct', () => {
    const result = resolveCutTimeline(project());
    expect(result.durationFrames).toBe(270);
    expect(result.clips[0].transform).toMatchObject({scale: 1, volume: 1, x: 0, y: 0, rotation: 0});
    expect(result.words.map(w => w.startMs)).toEqual([500, 2000, 3500, 5000, 6500, 8000]);
    expect(new Set(result.words.map(w => w.id)).size).toBe(6);
    expect(result.words[0].sourceWordId).toBe(result.words[4].sourceWordId);
  });
  it('retains binding identities when clips move and trims only intersected words', () => {
    const input = project();
    const previous = resolveCutTimeline(input);
    input.clips = [clip('repeat', 'a', 30, 60), clip('first', 'a')];
    const next = resolveCutTimeline(input);
    expect(next.words[0]).toMatchObject({id: previous.words[4].id,
      sourceStartMs: 1000, sourceEndMs: 1500, startMs: 0, endMs: 500});
    expect(next.words[1].id).toBe(previous.words[0].id);
    expect(next.durationFrames).toBe(120);
  });
  it('maps every output frame exactly once across reversed and repeated source ranges', () => {
    const input = project();
    input.clips = [clip('later', 'a', 60, 90), clip('earlier', 'a', 0, 30), clip('b', 'b', 30, 60)];
    for (let f = 0; f < 90; f++) {
      const hit = sourceAtTimelineFrame(input, f)!;
      expect(hit.sourceFrame).toBe(f < 30 ? 60 + f : f < 60 ? f - 30 : f - 30);
      expect(hit.assetId).toBe(f < 60 ? 'a' : 'b');
    }
    expect(sourceAtTimelineFrame(input, 30)?.clipId).toBe('earlier');
    expect(sourceAtTimelineFrame(input, 90)).toBeNull();
    expect(sourceAtTimelineFrame(input, -1)).toBeNull();
    expect(sourceAtTimelineFrame(input, 0.5)).toBeNull();
  });
  it('rejects missing assets, duplicate occurrence identities, and invalid frame ranges', () => {
    for (const clips of [[clip('x', 'missing')], [clip('x', 'a'), clip('x', 'b')],
      [clip('x', 'a', 30, 30)], [clip('x', 'a', 0, 91)], [clip('x', 'a', 0.5, 30)]]) {
      expect(() => resolveCutTimeline({...project(), clips})).toThrow();
    }
  });
  it('persists transforms without accepting empty crops, nonfinite values, or negative volume', () => {
    const transform = {x: 120, y: -60, scale: 1.5, rotation: 90, volume: 0,
      crop: {left: 0.1, right: 0.2, top: 0, bottom: 0.1}};
    const input = {...project(), clips: [{...clip('x', 'a'), transform}]};
    expect(sourceAtTimelineFrame(JSON.parse(JSON.stringify(cutTimelineSchema.parse(input))), 0)?.transform).toEqual(transform);
    for (const bad of [{...transform, x: Infinity}, {...transform, volume: -1},
      {...transform, crop: {...transform.crop, left: 0.8}}])
      expect(() => resolveCutTimeline({...input, clips: [{...clip('x', 'a'), transform: bad}]})).toThrow();
  });
  it('allows an empty timeline and rejects duplicate or out-of-bounds transcript words', () => {
    expect(resolveCutTimeline({schemaVersion: 1, assets: [], clips: []}).durationFrames).toBe(0);
    for (const words of [[asset('a').words[0], asset('a').words[0]],
      [{id: 'x', text: '越界', startMs: 2900, endMs: 3100}]])
      expect(() => resolveCutTimeline({...project(), assets: [{...asset('a'), words}, asset('b')]})).toThrow();
  });
});
