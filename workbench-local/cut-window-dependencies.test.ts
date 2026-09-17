import {describe, expect, it} from 'vitest';
import {cutWindowDependencies, describeCutWindowDependencies} from './cut-window-dependencies';

const transform = (overrides: Record<string, unknown> = {}) => ({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  crop: {left: 0, right: 0, top: 0, bottom: 0},
  volume: 1,
  ...overrides,
});

const asset = (
  id: string,
  proxyFileName = `${id}-proxy.mp4`,
  words: Array<{id: string; text: string; startMs: number; endMs: number}> = [],
) => ({
  id,
  name: `${id} display name`,
  durationFrames: 120,
  sourceFileName: `${id}-source.mp4`,
  proxyFileName,
  words,
});

const clip = (id: string, assetId: string, inFrame: number, outFrame: number, extra: Record<string, unknown> = {}) => ({
  id,
  assetId,
  inFrame,
  outFrame,
  transform: transform(extra),
});

const timelineState = (clips = [clip('a-clip', 'a', 0, 30), clip('b-clip', 'b', 0, 30)]) => ({
  revision: 4,
  preview: {url: '/cut-media/old-preview.mp4', revision: 4},
  timeline: {
    schemaVersion: 1 as const,
    assets: [asset('a'), asset('b'), asset('unused')],
    clips,
  },
  // These legacy fields are intentionally noisy and must not participate in a timeline description.
  asset: {name: 'old asset', durationMs: 4000, url: '/cut-media/old-proxy.mp4'},
  words: [{id: 'irrelevant', text: 'ignored', startMs: 0, endMs: 100}],
  ranges: [{startMs: 0, endMs: 100}],
});

describe('cut window dependencies', () => {
  it('describes timeline intersections with relative offsets, source frames, proxy identity, and full transforms', () => {
    const state = timelineState([
      clip('first', 'a', 10, 50, {x: 120, rotation: 15, volume: 0.4}),
      clip('second', 'b', 20, 80),
    ]);
    const result = describeCutWindowDependencies(state, {from: 25, end: 65});

    expect(result).toEqual({
      kind: 'timeline',
      window: {from: 25, end: 65},
      segments: [
        {
          windowOffsetFrames: {from: 0, end: 15},
          sourceInFrame: 35,
          sourceOutFrame: 50,
          proxyFileName: 'a-proxy.mp4',
          transform: transform({x: 120, rotation: 15, volume: 0.4}),
        },
        {
          windowOffsetFrames: {from: 15, end: 40},
          sourceInFrame: 20,
          sourceOutFrame: 45,
          proxyFileName: 'b-proxy.mp4',
          transform: transform(),
        },
      ],
    });
  });

  it('uses half-open boundaries: the next clip owns a boundary frame', () => {
    const result = cutWindowDependencies(timelineState([
      clip('first', 'a', 0, 30),
      clip('second', 'b', 40, 70),
    ]), {from: 30, end: 40});

    expect(result.segments).toEqual([{
      windowOffsetFrames: {from: 0, end: 10},
      sourceInFrame: 40,
      sourceOutFrame: 50,
      proxyFileName: 'b-proxy.mp4',
      transform: transform(),
    }]);
  });

  it('keeps repeated uses of one asset as separate ordered dependencies', () => {
    const result = describeCutWindowDependencies(timelineState([
      clip('first', 'a', 0, 20),
      clip('repeat', 'a', 60, 90, {scale: 1.5, volume: 0.7}),
    ]), {from: 0, end: 50});

    expect(result.kind).toBe('timeline');
    if (result.kind !== 'timeline') throw new Error('expected timeline dependency description');
    expect(result.segments).toHaveLength(2);
    expect(result.segments.map((segment) => ({
      proxyFileName: segment.proxyFileName,
      sourceInFrame: segment.sourceInFrame,
      sourceOutFrame: segment.sourceOutFrame,
      offset: segment.windowOffsetFrames,
      scale: segment.transform.scale,
      volume: segment.transform.volume,
    }))).toEqual([
      {proxyFileName: 'a-proxy.mp4', sourceInFrame: 0, sourceOutFrame: 20, offset: {from: 0, end: 20}, scale: 1, volume: 1},
      {proxyFileName: 'a-proxy.mp4', sourceInFrame: 60, sourceOutFrame: 90, offset: {from: 20, end: 50}, scale: 1.5, volume: 0.7},
    ]);
  });

  it('does not change when only a non-intersecting clip or ignored state metadata changes', () => {
    const base = timelineState([
      clip('used', 'a', 0, 30),
      clip('outside', 'b', 30, 60, {x: 10, volume: 0.2}),
    ]);
    const changed = timelineState([
      clip('used', 'a', 0, 30),
      clip('outside', 'b', 60, 90, {x: -700, rotation: 300, volume: 3}),
    ]);
    changed.revision = 99;
    changed.preview = {url: '/cut-media/new-random-preview.mp4', revision: 99};
    changed.timeline.assets[2] = {
      ...changed.timeline.assets[2],
      name: 'renamed unused asset',
      proxyFileName: 'unused-renamed-proxy.mp4',
      durationFrames: 100,
      words: [{id: 'unrelated', text: 'unused', startMs: 100, endMs: 200}],
    };

    expect(describeCutWindowDependencies(base, {from: 0, end: 30})).toEqual(
      describeCutWindowDependencies(changed, {from: 0, end: 30}),
    );
  });

  it('changes when an intersecting source window or transform changes', () => {
    const base = describeCutWindowDependencies(timelineState([
      clip('used', 'a', 0, 30, {volume: 1}),
    ]), {from: 5, end: 20});
    const sourceChanged = describeCutWindowDependencies(timelineState([
      clip('used', 'a', 10, 40, {volume: 1}),
    ]), {from: 5, end: 20});
    const transformChanged = describeCutWindowDependencies(timelineState([
      clip('used', 'a', 0, 30, {volume: 0.25, rotation: 45}),
    ]), {from: 5, end: 20});

    expect(sourceChanged).not.toEqual(base);
    expect(transformChanged).not.toEqual(base);
  });

  it('reflects a prefix deletion because the absolute window now comes from another source', () => {
    const before = describeCutWindowDependencies(timelineState([
      clip('prefix', 'a', 0, 10),
      clip('target', 'b', 0, 30),
    ]), {from: 0, end: 15});
    const after = describeCutWindowDependencies(timelineState([
      clip('target', 'b', 0, 30),
    ]), {from: 0, end: 15});

    expect(before).not.toEqual(after);
    expect(before.segments[0].proxyFileName).toBe('a-proxy.mp4');
    expect(after.segments[0].proxyFileName).toBe('b-proxy.mp4');
  });

  it('keeps legacy source ranges in conservative millisecond concatenation space', () => {
    const result = describeCutWindowDependencies({
      revision: 2,
      preview: {url: '/cut-media/random.mp4', revision: 2},
      asset: {name: 'legacy', durationMs: 4000, url: '/cut-media/legacy-proxy.mp4'},
      ranges: [
        {startMs: 100.5, endMs: 1000.5},
        {startMs: 2000.25, endMs: 3000.25},
      ],
    }, {from: 15, end: 45});

    expect(result.kind).toBe('legacy');
    if (result.kind !== 'legacy') throw new Error('expected legacy dependency description');
    expect(result).toMatchObject({
      kind: 'legacy',
      precision: 'milliseconds-conservative',
      canReuseExactly: false,
      window: {from: 15, end: 45},
      proxyFileName: 'legacy-proxy.mp4',
      rangesMs: [
        {startMs: 100.5, endMs: 1000.5},
        {startMs: 2000.25, endMs: 3000.25},
      ],
      sourceFrameRanges: [
        {sourceInFrame: 3, sourceOutFrame: 30},
        {sourceInFrame: 60, sourceOutFrame: 90},
      ],
      windowMs: {from: 500, end: 1500},
      segments: [
        {
          windowOffsetMs: {from: 0, end: 400},
          sourceStartMs: 600.5,
          sourceEndMs: 1000.5,
          originalRangeMs: {startMs: 100.5, endMs: 1000.5},
          proxyFileName: 'legacy-proxy.mp4',
        },
        {
          windowOffsetMs: {from: 400, end: 1000},
          sourceStartMs: 2000.25,
          sourceEndMs: 2600.25,
          originalRangeMs: {startMs: 2000.25, endMs: 3000.25},
          proxyFileName: 'legacy-proxy.mp4',
        },
      ],
    });
    expect(result.segments[0]).not.toHaveProperty('sourceInFrame');
  });

  it('fails explicitly for invalid windows, missing coverage, missing assets, bad ranges, and unsafe URLs', () => {
    const validTimeline = timelineState([clip('only', 'a', 10, 20)]);
    for (const window of [
      {from: -1, end: 2},
      {from: 0.5, end: 2},
      {from: 4, end: 4},
      {from: 5, end: 2},
    ]) {
      expect(() => describeCutWindowDependencies(validTimeline, window)).toThrow();
    }
    expect(() => describeCutWindowDependencies(validTimeline, {from: 20, end: 25})).toThrow(/超出|不完整/);
    expect(() => describeCutWindowDependencies(timelineState([
      clip('first', 'a', 0, 30),
      clip('last', 'b', 0, 30),
    ]), {from: 50, end: 61})).toThrow(/不完整/);
    expect(() => describeCutWindowDependencies({
      asset: null,
      ranges: [{startMs: 0, endMs: 100}],
    }, {from: 0, end: 1})).toThrow(/缺少素材/);
    expect(() => describeCutWindowDependencies({
      asset: {url: '/cut-media/legacy.mp4', durationMs: 1000},
      ranges: [],
    }, {from: 0, end: 1})).toThrow();
    expect(() => describeCutWindowDependencies({
      asset: {url: '/cut-media/legacy.mp4', durationMs: 1000},
      ranges: [{startMs: 500, endMs: 400}],
    }, {from: 0, end: 1})).toThrow();
    expect(() => describeCutWindowDependencies({
      asset: {url: '/cut-media/../escape.mp4', durationMs: 1000},
      ranges: [{startMs: 0, endMs: 100}],
    }, {from: 0, end: 1})).toThrow();
    expect(() => describeCutWindowDependencies({
      asset: {url: '/cut-media/legacy.mp4', durationMs: 1000},
      ranges: [{startMs: 0, endMs: 1200}],
    }, {from: 0, end: 1})).toThrow();
  });
});
