import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>();
  return {
    ...actual,
    Sequence: ({children, from, durationInFrames}: {children: React.ReactNode; from: number; durationInFrames: number}) =>
      React.createElement('div', {'data-from': from, 'data-duration': durationInFrames}, children),
    OffthreadVideo: ({src, muted, trimBefore, style, ...rest}: {
      src: string; muted: boolean; trimBefore: number; style: React.CSSProperties;
    }) => React.createElement('video', {src, muted, style, 'data-trim-before': trimBefore,
      'data-extra-props': Object.keys(rest).join(',')}),
    Img: ({src, style}: {src: string; style: React.CSSProperties}) => React.createElement('img', {src, style}),
  };
});

import {
  assertMediaSpan, evidenceCropGeometry, EvidenceCrop, FrameMedia, makeMediaView, requireBeat,
  resolveMediaSrc, validateChanges, viewAt, type MediaSource, type ViewChange,
} from '../tools/talking-head-production/releases/1.0.0';

const initial = makeMediaView({x: 0, y: 0, width: 100, height: 200});

describe('talking-head media scene-clock state', () => {
  it('interpolates all numeric fields with smooth cubic easing and holds merged targets', () => {
    const changes: ViewChange[] = [
      {at: 10, duration: 20, to: {rect: {x: 80, y: 40, width: 300, height: 100}, opacity: 0.2, zoom: 2}},
      {at: 40, duration: 10, to: {blur: 8, brightness: 0.5}},
    ];
    expect(viewAt(initial, changes, 9)).toEqual(initial);
    expect(viewAt(initial, changes, 10)).toEqual(initial);
    const quarter = viewAt(initial, changes, 15);
    expect(quarter.rect.x).toBe(12.5); // smoothstep(0.25) = 0.15625
    expect(quarter.opacity).toBeCloseTo(0.875);
    expect(quarter.zoom).toBe(1.15625);
    const midpoint = viewAt(initial, changes, 20);
    expect(midpoint.rect).toEqual({x: 40, y: 20, width: 200, height: 150});
    expect(midpoint.opacity).toBeCloseTo(0.6);
    const held = viewAt(initial, changes, 30);
    expect(viewAt(initial, changes, 39)).toEqual(held);
    expect(viewAt(initial, changes, 40)).toEqual(held);
    expect(viewAt(initial, changes, 50)).toEqual({...held, blur: 8, brightness: 0.5});
    expect(viewAt(initial, changes, 500)).toEqual(viewAt(initial, changes, 50));
    expect(initial.rect.width).toBe(100);
    expect(changes[0].to.rect?.x).toBe(80);
  });

  it('permits adjacent transitions and deterministic zero-duration steps', () => {
    const changes: ViewChange[] = [
      {at: 0, duration: 10, to: {rotation: 20}},
      {at: 10, duration: 0, to: {opacity: 0}},
      {at: 10, duration: 10, to: {opacity: 1, saturation: 0}},
      {at: 20, duration: 0, to: {rotation: 0}},
    ];
    expect(() => validateChanges(changes, 20)).not.toThrow();
    expect(viewAt(initial, changes, 9).opacity).toBe(1);
    expect(viewAt(initial, changes, 10)).toMatchObject({rotation: 20, opacity: 0});
    expect(viewAt(initial, changes, 15)).toMatchObject({rotation: 20, opacity: 0.5, saturation: 0.5});
    expect(viewAt(initial, changes, 20)).toMatchObject({rotation: 0, opacity: 1, saturation: 0});
    const result = viewAt(initial, [], 2);
    result.rect.x = 900;
    expect(initial.rect.x).toBe(0);
  });

  it.each([
    [{at: -1, duration: 1, to: {}}],
    [{at: 0.5, duration: 1, to: {}}],
    [{at: 0, duration: -1, to: {}}],
    [{at: 0, duration: 1.5, to: {}}],
    [{at: 0, duration: Number.NaN, to: {}}],
    [{at: 0, duration: 11, to: {}}],
    [{at: 11, duration: 0, to: {}}],
    [{at: 4, duration: 2, to: {}}, {at: 5, duration: 1, to: {}}],
    [{at: 4, duration: 0, to: {}}, {at: 3, duration: 0, to: {}}],
    [{at: 0, duration: 1, to: {opacity: 2}}],
    [{at: 0, duration: 1, to: {zoom: 0}}],
    [{at: 0, duration: 1, to: {focalY: -0.1}}],
    [{at: 0, duration: 1, to: {blur: Number.POSITIVE_INFINITY}}],
    [{at: 0, duration: 1, to: {rect: {x: 0, y: 0, width: 0, height: 1}}}],
  ])('rejects invalid changes %#', (...changes) => {
    expect(() => validateChanges(changes as ViewChange[], 10)).toThrow();
  });

  it('rejects invalid frames, duration bounds, and incomplete rectangles', () => {
    for (const frame of [-1, 1.2, Infinity, NaN]) expect(() => viewAt(initial, [], frame)).toThrow();
    expect(() => validateChanges([], -1)).toThrow();
    expect(() => validateChanges([], Infinity)).toThrow();
    expect(() => validateChanges([{at: 0, duration: 1, to: {rect: {x: 3} as never}}], 2)).toThrow();
    expect(() => makeMediaView(initial.rect, {brightness: -1})).toThrow();
  });
});

describe('required word cues', () => {
  const beats = [
    {wordId: 'w-1', label: '同名', frame: 12},
    {wordId: 'w-2', label: '同名', frame: 20},
    {wordId: 'w-3', label: '唯一', frame: 30, durationFrames: 4},
    {wordId: 'w-4', label: 'w-1', frame: 40},
  ];
  it('prioritizes exact word IDs and returns unique exact labels', () => {
    expect(requireBeat(beats, 'w-1')).toBe(beats[0]);
    expect(requireBeat(beats, '唯一')).toBe(beats[2]);
  });
  it('rejects missing, ambiguous, and invalid cues without guessing frame zero', () => {
    expect(() => requireBeat(beats, 'missing')).toThrow('Missing beat');
    expect(() => requireBeat(beats, '同名')).toThrow('Ambiguous beat');
    expect(() => requireBeat([...beats, {...beats[0], frame: 99}], 'w-1')).toThrow('Ambiguous beat');
    expect(() => requireBeat([{wordId: 'bad', label: 'bad', frame: -1}], 'bad')).toThrow();
  });
});

describe('actual media source spans', () => {
  const video: MediaSource = {id: 'clip', src: 'footage/clip.mp4', kind: 'video', durationFrames: 100, trimBefore: 20};
  it('allows only available video frames after a single source trim', () => {
    expect(() => assertMediaSpan(video, 300, 380)).not.toThrow();
    expect(() => assertMediaSpan(video, 300, 381)).toThrow('insufficient source frames');
    expect(() => assertMediaSpan({...video, durationFrames: undefined}, 0, 1)).toThrow('requires declared durationFrames');
    expect(() => assertMediaSpan({...video, trimBefore: 100}, 0, 1)).toThrow('implicit looping');
    expect(() => assertMediaSpan({id: 'page', src: '/page.png', kind: 'image'}, 100, 1000)).not.toThrow();
  });
  it('rejects invalid paths, times, dimensions, and trim metadata', () => {
    for (const src of ['', ' ', 'https://', 'file:///private/clip.mp4', './clip.mp4']) {
      expect(() => assertMediaSpan({...video, src}, 0, 1)).toThrow();
    }
    for (const [start, end] of [[0, 0], [2, 1], [-1, 5], [0, 0.5], [0, Infinity]]) {
      expect(() => assertMediaSpan(video, start, end)).toThrow();
    }
    for (const patch of [{trimBefore: -1}, {trimBefore: 0.5}, {durationFrames: Infinity}, {width: 0}]) {
      expect(() => assertMediaSpan({...video, ...patch}, 0, 1)).toThrow();
    }
  });
  it('preserves supported URLs and resolves local public files through staticFile', () => {
    for (const src of ['/media/photo.png', 'https://example.com/a.mp4', 'http://example.com/a.png', 'data:image/png;base64,AA==', 'blob:https://example.com/id']) {
      expect(resolveMediaSrc(src)).toBe(src);
    }
    expect(resolveMediaSrc('素材/a page.png')).toBe('/%E7%B4%A0%E6%9D%90/a%20page.png');
  });
  it('keeps the source trim and timeline entry independent of animated view changes, with muted video', () => {
    for (const view of [initial, makeMediaView({x: 20, y: 50, width: 600, height: 300}, {opacity: 0.2, zoom: 1.5})]) {
      const markup = renderToStaticMarkup(React.createElement(FrameMedia, {source: video, view, timelineStart: 30, timelineEnd: 90}));
      expect(markup).toContain('data-from="30"');
      expect(markup).toContain('data-duration="60"');
      expect(markup).toContain('data-trim-before="20"');
      expect(markup).toContain('muted=""');
      expect(markup).toContain('data-extra-props=""');
      expect(markup).not.toContain('loop=');
    }
  });
});

describe('original-pixel evidence crops', () => {
  const crop = {x: 0.25, y: 0.2, width: 0.5, height: 0.4};
  it('places the exact source region and letterboxes without stretching', () => {
    const geometry = evidenceCropGeometry(1000, 2000, crop, {x: 123, y: 456, width: 800, height: 600});
    expect(geometry.scale).toBe(0.75);
    expect(geometry.viewport).toEqual({x: 212.5, y: 0, width: 375, height: 600});
    expect(geometry.image).toEqual({x: -187.5, y: -300, width: 750, height: 1500});
    // The selected original top-left lands exactly on the crop viewport origin.
    expect(250 * geometry.scale + geometry.image.x).toBe(0);
    expect(400 * geometry.scale + geometry.image.y).toBe(0);
    expect(geometry.image.width / geometry.image.height).toBe(1000 / 2000);
  });
  it('letterboxes a wide source region vertically', () => {
    expect(evidenceCropGeometry(1200, 600, {x: 0, y: 0, width: 1, height: 1}, initial.rect)).toEqual({
      scale: 1 / 12, viewport: {x: 0, y: 75, width: 100, height: 50},
      image: {x: -0, y: -0, width: 100, height: 50},
    });
  });
  it('rejects unavailable dimensions, invalid regions, and non-image evidence', () => {
    for (const invalidCrop of [{...crop, x: -0.1}, {...crop, width: 0}, {...crop, x: 0.9}, {...crop, height: NaN}]) {
      expect(() => evidenceCropGeometry(1000, 2000, invalidCrop, initial.rect)).toThrow();
    }
    expect(() => evidenceCropGeometry(0, 2000, crop, initial.rect)).toThrow();
    expect(() => renderToStaticMarkup(React.createElement(EvidenceCrop, {
      source: {id: 'page', src: '/page.png', kind: 'image'}, crop, view: initial,
    }))).toThrow('requires intrinsic source width and height');
    expect(() => renderToStaticMarkup(React.createElement(EvidenceCrop, {
      source: {id: 'clip', src: '/clip.mp4', kind: 'video', width: 1000, height: 2000, durationFrames: 30}, crop, view: initial,
    }))).toThrow('requires an image source');
  });
  it('renders the original image file and exact crop geometry with view filters on content', () => {
    const markup = renderToStaticMarkup(React.createElement(EvidenceCrop, {
      source: {id: 'page', src: '/original-page.png', kind: 'image', width: 1000, height: 2000}, crop,
      view: makeMediaView({x: 10, y: 20, width: 800, height: 600}, {opacity: 0.8, blur: 2, saturation: 0.5}),
    }));
    expect(markup).toContain('src="/original-page.png"');
    expect(markup).toContain('left:-187.5px;top:-300px;width:750px;height:1500px');
    expect(markup).toContain('filter:blur(2px) saturate(0.5) brightness(1)');
    expect(markup).toContain('opacity:0.8');
  });
});
