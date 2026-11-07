import React, {type CSSProperties} from 'react';
import {Img, OffthreadVideo, Sequence} from 'remotion';
import {
  assertMediaSpan, assertMediaView, evidenceCropGeometry, resolveMediaSrc,
  type MediaSource, type MediaView, type NormalizedRect,
} from './model';

type Decoration = {borderColor?: string; borderWidth?: number; shadow?: boolean};
export type FrameMediaProps = Decoration & {
  source: MediaSource;
  /** Computed in the parent scene clock, before entering this component's Sequence. */
  view: MediaView;
  timelineStart: number;
  timelineEnd: number;
  fit?: 'cover' | 'contain';
};
export type EvidenceCropProps = Decoration & {
  source: MediaSource;
  crop: NormalizedRect;
  view: MediaView;
};

const boxStyle = (view: MediaView, decoration: Decoration): CSSProperties => {
  assertMediaView(view);
  const borderWidth = decoration.borderWidth ?? 0;
  if (!Number.isFinite(borderWidth) || borderWidth < 0) throw new Error('Media borderWidth must be finite and nonnegative');
  return {
    position: 'absolute', left: view.rect.x, top: view.rect.y,
    width: view.rect.width, height: view.rect.height,
    overflow: 'hidden', borderRadius: view.radius,
    opacity: view.opacity, transform: `rotate(${view.rotation}deg)`,
    transformOrigin: 'center center',
    boxShadow: decoration.shadow ? '0 12px 40px rgba(0, 0, 0, 0.28)' : undefined,
  };
};

const contentStyle = (view: MediaView): CSSProperties => ({
  filter: `blur(${view.blur}px) saturate(${view.saturation}) brightness(${view.brightness})`,
  transform: `scale(${view.zoom})`,
  transformOrigin: `${view.focalX * 100}% ${view.focalY * 100}%`,
});

/** The ring overlays media without changing its size or inheriting its filters. */
const Border = ({view, borderColor = '#fff', borderWidth = 0}: Decoration & {view: MediaView}) => borderWidth > 0 ? (
  <div style={{position: 'absolute', inset: 0, borderRadius: view.radius, pointerEvents: 'none',
    boxShadow: `inset 0 0 0 ${borderWidth}px ${borderColor}`}} />
) : null;

export const FrameMedia = ({
  source, view, timelineStart, timelineEnd, fit = 'cover', ...decoration
}: FrameMediaProps) => {
  assertMediaSpan(source, timelineStart, timelineEnd);
  if (fit !== 'cover' && fit !== 'contain') throw new Error('Media fit must be cover or contain');
  const outerStyle = boxStyle(view, decoration);
  const mediaStyle: CSSProperties = {
    display: 'block', width: '100%', height: '100%', objectFit: fit,
    objectPosition: `${view.focalX * 100}% ${view.focalY * 100}%`, ...contentStyle(view),
  };
  const src = resolveMediaSrc(source.src);
  return (
    <Sequence from={timelineStart} durationInFrames={timelineEnd - timelineStart} layout="none">
      <div style={outerStyle}>
        {source.kind === 'video'
          ? <OffthreadVideo src={src} trimBefore={source.trimBefore ?? 0} muted style={mediaStyle} />
          : <Img src={src} style={mediaStyle} />}
        <Border view={view} {...decoration} />
      </div>
    </Sequence>
  );
};

export const EvidenceCrop = ({source, crop, view, ...decoration}: EvidenceCropProps) => {
  // This component has no source clock: it displays original image pixels only.
  assertMediaSpan(source, 0, 1);
  if (source.kind !== 'image') throw new Error(`EvidenceCrop "${source.id}" requires an image source`);
  if (source.width === undefined || source.height === undefined) {
    throw new Error(`EvidenceCrop "${source.id}" requires intrinsic source width and height`);
  }
  const geometry = evidenceCropGeometry(source.width, source.height, crop, view.rect);
  const outerStyle = boxStyle(view, decoration);
  return (
    <div style={outerStyle}>
      <div style={{position: 'absolute', left: geometry.viewport.x, top: geometry.viewport.y,
        width: geometry.viewport.width, height: geometry.viewport.height, overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: 0, ...contentStyle(view)}}>
          <Img src={resolveMediaSrc(source.src)} style={{position: 'absolute', display: 'block',
            left: geometry.image.x, top: geometry.image.y, width: geometry.image.width, height: geometry.image.height,
            maxWidth: 'none'}} />
        </div>
      </div>
      <Border view={view} {...decoration} />
    </div>
  );
};
