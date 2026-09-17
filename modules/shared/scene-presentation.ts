import {z} from 'zod';
import type {AssetRef, ProjectFormat, TimelineClip} from './project.js';

/**
 * Scene presentation contract — host picture layout, scene background and
 * production surface mode.  This module is a pure shared vocabulary: no
 * Remotion, no UI, no network, no randomness.  The Resolver compiles
 * SceneSpec presentation into ordinary TimelineClip metadata
 * (`clip.metadata.presentation`) through the strict schema below; the
 * Remotion renderers, the Inspector and the PreviewCanvas all read that
 * same compiled schema instead of guessing strings.
 *
 * Coordinate contract (normalized, three-format stable):
 *  - HostPresentation.x/y are the normalized canvas coordinates of the host
 *    box CENTER (0.5/0.5 = canvas center).  `setCanvasProfile` remapping is
 *    therefore a no-op for presentation values.
 *  - width/height are fractions of the canvas width/height respectively.
 *  - borderWidth is a fraction of the canvas short edge (0 = no border).
 *  - cropX/cropY are normalized source focus points; cropScale >= 1 zooms
 *    the source around the focus point.
 */

// ── Surface modes ─────────────────────────────────────────────────────────

export const productionSurfaceModeSchema = z.enum(['transparent', 'card', 'takeover']);
export type ProductionSurfaceMode = z.infer<typeof productionSurfaceModeSchema>;

export const productionSurfaceModeLabels: Record<ProductionSurfaceMode, string> = {
  transparent: '透明叠加',
  card: '卡片',
  takeover: '全屏接管',
};

// ── HostPresentation ──────────────────────────────────────────────────────

export const hostVisibilitySchema = z.enum(['visible', 'hidden']);
export type HostVisibility = z.infer<typeof hostVisibilitySchema>;

export const hostShapeSchema = z.enum(['full', 'circle', 'rounded_rect', 'ellipse']);
export type HostShape = z.infer<typeof hostShapeSchema>;

export const hostAnchorSchema = z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom']);
export type HostAnchor = z.infer<typeof hostAnchorSchema>;

export const hostShadowSchema = z.enum(['none', 'soft', 'strong']);
export type HostShadow = z.infer<typeof hostShadowSchema>;

export const hostMotionPresetSchema = z.enum(['none', 'enter', 'exit', 'full-to-corner', 'corner-to-full', 'move-corner']);
export type HostMotionPreset = z.infer<typeof hostMotionPresetSchema>;

export const hostMotionPresetLabels: Record<HostMotionPreset, string> = {
  none: '无',
  enter: '入场',
  exit: '退场',
  'full-to-corner': '全屏 → 角落',
  'corner-to-full': '角落 → 全屏',
  'move-corner': '角落移动',
};

const hexColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const hostPresentationSchema = z.strictObject({
  visibility: hostVisibilitySchema.default('visible'),
  shape: hostShapeSchema.default('full'),
  anchor: hostAnchorSchema.default('center'),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  width: z.number().min(0.02).max(1.5).default(1),
  height: z.number().min(0.02).max(1.5).default(1),
  cropX: z.number().min(0).max(1).default(0.5),
  cropY: z.number().min(0).max(1).default(0.5),
  cropScale: z.number().min(1).max(4).default(1),
  borderWidth: z.number().min(0).max(0.2).default(0),
  borderColor: z.string().regex(hexColor).default('#ffffff'),
  shadow: hostShadowSchema.default('soft'),
  zIndex: z.number().int().min(-100).max(100).default(0),
  motionPreset: hostMotionPresetSchema.default('none'),
});
export type HostPresentation = z.infer<typeof hostPresentationSchema>;

/** The only "visible full screen" host presentation (A-roll itself). */
export const hostFullPresentation = (): HostPresentation =>
  hostPresentationSchema.parse({visibility: 'visible', shape: 'full', anchor: 'center', x: 0.5, y: 0.5, width: 1, height: 1});

/** A hidden host: no derived picture, the A-roll audio keeps playing. */
export const hostHiddenPresentation = (): HostPresentation =>
  hostPresentationSchema.parse({visibility: 'hidden', shape: 'full', anchor: 'center', x: 0.5, y: 0.5, width: 1, height: 1});

// ── SceneBackground ───────────────────────────────────────────────────────

export const sceneBackgroundModeSchema = z.enum(['inherit', 'theme', 'media', 'visual']);
export type SceneBackgroundMode = z.infer<typeof sceneBackgroundModeSchema>;

export const sceneBackgroundModeLabels: Record<SceneBackgroundMode, string> = {
  inherit: '继承（跟随主题/相邻场景）',
  theme: '主题画布背景',
  media: '真实媒体铺满',
  visual: '生产视觉接管',
};

export const sceneBackgroundSchema = z.strictObject({
  mode: sceneBackgroundModeSchema.default('inherit'),
  assetId: z.string().min(1).nullable().default(null),
  themeId: z.string().min(1).nullable().default(null),
});
export type SceneBackground = z.infer<typeof sceneBackgroundSchema>;

export const defaultSceneBackground = (): SceneBackground =>
  sceneBackgroundSchema.parse({mode: 'inherit', assetId: null, themeId: null});

// ── ScenePresentation (SceneSpec extension) ───────────────────────────────

export const scenePresentationSchema = z.strictObject({
  host: hostPresentationSchema.nullable().default(null),
  background: sceneBackgroundSchema.default(() => defaultSceneBackground()),
});
export type ScenePresentation = z.infer<typeof scenePresentationSchema>;

export const defaultScenePresentation = (): ScenePresentation =>
  scenePresentationSchema.parse({host: null, background: defaultSceneBackground()});

/**
 * SceneSpec extension: optional and strict.  IMPORTANT: this must stay a
 * truly-optional field so that parsing an old SceneSpec keeps the
 * `presentation` key ABSENT (not defaulted in).  The Resolver distinguishes
 * `hasOwnProperty('presentation')` to decide whether presentation
 * convergence (delete/re-shape stale derived clips) may run; a schema-level
 * default would make that key always present and could delete/re-create
 * already-applied legacy `vd-pip-` fragments.  The legacy default
 * (`{host: null, background: inherit}`) is applied inside the Resolver /
 * validateSceneSpec instead (`scene.presentation ?? defaultScenePresentation()`).
 * Unknown keys inside presentation are rejected like every other
 * implementation field.
 */
export const sceneSpecPresentationSchema = scenePresentationSchema.optional();

// ── Compiled clip presentation (TimelineClip.metadata.presentation) ──────

export const presentationLayerSchema = z.enum(['background', 'primary', 'host', 'annotation']);
export type PresentationLayer = z.infer<typeof presentationLayerSchema>;

export const compiledPresentationSchema = z.strictObject({
  role: presentationLayerSchema,
  surfaceMode: productionSurfaceModeSchema,
  host: hostPresentationSchema.nullable().default(null),
  /**
   * The SEMANTIC scene background decision (inherit/theme/media/visual) as
   * the user chose it — the single Source-of-Truth for the Inspector and
   * every scene-level manual edit.  `inherit` is never silently solidified
   * into an effective theme/media here.  (Source-of-truth fix: the
   * background clip must not overwrite this with its resolved cover.)
   */
  background: sceneBackgroundSchema.default(() => defaultSceneBackground()),
  /**
   * OPTIONAL strict materialization for an `inherit` cover clip: the
   * theme/media background resolved from the project default at compile
   * time.  Schema-managed (never a scattered string), never overwrites
   * `background`, and the renderer re-resolves the CURRENT project default
   * at render time so an existing inherit cover follows
   * `packagingSettings.sceneBackground` changes without recompiling clips.
   */
  resolvedBackground: sceneBackgroundSchema.optional(),
});
export type CompiledPresentation = z.infer<typeof compiledPresentationSchema>;

export const createCompiledPresentation = (input: {
  role: PresentationLayer;
  surfaceMode: ProductionSurfaceMode;
  host?: HostPresentation | null;
  background?: SceneBackground;
  resolvedBackground?: SceneBackground | null;
}): CompiledPresentation => {
  const compiled: Record<string, unknown> = {
    role: input.role,
    surfaceMode: input.surfaceMode,
    host: input.host ?? null,
    background: input.background ?? defaultSceneBackground(),
  };
  if (input.resolvedBackground) compiled.resolvedBackground = input.resolvedBackground;
  return compiledPresentationSchema.parse(compiled);
};

/** Strict parser for `clip.metadata.presentation`.  Never throws. */
export const parseCompiledPresentation = (metadata: Record<string, unknown> | undefined): CompiledPresentation | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = metadata.presentation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const parsed = compiledPresentationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

/**
 * Deterministic canvas layer contract (§6 + review fix).  The stable
 * project/theme canvas is the Composition root (never a clip) and captions
 * are the global caption layer.  Clip layers, bottom to top:
 *   1. canvas (root)
 *   2. background   — scene background / full media / takeover visual
 *      (BELOW the a-roll when the scene host is visible+full, so a theme /
 *      media background can never cover the full-screen person; ABOVE the
 *      a-roll for circle/rounded/ellipse/hidden hosts so the background
 *      always covers the leftover A-roll picture)
 *   3. a-roll       — legacy A-roll clips without a compiled role
 *   4. primary      — primary / supporting visuals (legacy b-roll/graphics)
 *   5. host         — derived Host Visual
 *   6. annotation   — overlays inside their container
 *   7. captions     — global CaptionLayer
 */
export const PRESENTATION_LAYER_Z = {
  background: 10,
  /** Background under a visible full-screen host (the A-roll is the person). */
  backgroundUnderFullHost: 4,
  aRoll: 5,
  primary: 30,
  host: 40,
  annotation: 50,
} as const;

export const CAPTION_LAYER_Z = 60;

// ── Background media playback contract (review fix round 2) ──────────────

export type BackgroundMediaPlayback = {
  /** Video backgrounds deterministically LOOP inside their real source window. */
  loop: boolean;
  trimBefore: number;
  trimAfter: number | undefined;
};

/**
 * Deterministic playback contract for a compiled background media clip
 * (scene-level AND project-level).  The clip covers its FULL timeline window
 * while the source window stays at the REAL asset boundaries
 * (`[sourceStartMs, sourceEndMs]` — never clamped to the clip length): a
 * short video deterministically loops inside that real window (Remotion Video
 * `loop`), an image deterministically holds its single frame, so a background
 * can never end early and expose the A-roll / black canvas underneath.  The
 * caller must pass a real existing AssetRef — media is never fabricated.
 */
export const resolveBackgroundMediaPlayback = (clip: TimelineClip, asset: AssetRef, fps: number): BackgroundMediaPlayback => {
  const trimBefore = Math.max(0, Math.round((clip.sourceStartMs / 1000) * fps));
  const trimAfter = clip.sourceEndMs === null ? undefined : Math.max(trimBefore + 1, Math.round((clip.sourceEndMs / 1000) * fps));
  return {loop: asset.kind === 'video', trimBefore, trimAfter};
};

/**
 * Deterministic render-order layer for any clip.  Clips without compiled
 * presentation keep their legacy track-order behavior: a-roll at the bottom,
 * everything else above it.  Host zIndex only orders inside the host layer.
 *
 * Background layering depends on the scene host state persisted in the
 * compiled presentation (review fix): a visible full host means the A-roll
 * IS the person — the background must sit under it; every other host state
 * (circle / rounded_rect / ellipse / hidden / absent) must cover the A-roll.
 */
export const resolveClipLayerZ = (clip: TimelineClip, trackKind: string): number => {
  const compiled = parseCompiledPresentation(clip.metadata);
  if (compiled) {
    const base = PRESENTATION_LAYER_Z[compiled.role];
    if (compiled.role === 'background') {
      const host = compiled.host;
      const hostIsFull = host !== null && host.visibility === 'visible' && host.shape === 'full';
      return hostIsFull ? PRESENTATION_LAYER_Z.backgroundUnderFullHost : base;
    }
    if (compiled.role === 'host' && compiled.host) return base + compiled.host.zIndex;
    return base;
  }
  if (trackKind === 'a-roll') return PRESENTATION_LAYER_Z.aRoll;
  if (clip.kind === 'audio') return 0;
  return PRESENTATION_LAYER_Z.primary;
};

/** Stable secondary sort keys for clips sharing a layer (track, then position). */
export const resolveClipLayerTiebreak = (trackIndex: number, clipIndex: number): [number, number] => [trackIndex, clipIndex];

// ── Host box math (normalized → canvas pixels) ────────────────────────────

export type HostBox = {left: number; top: number; width: number; height: number};

/** Box in canvas pixels for a host presentation; circle forces equal sides. */
export const hostBoxPx = (host: HostPresentation, canvasWidth: number, canvasHeight: number): HostBox => {
  const width = host.width * canvasWidth;
  const height = host.height * canvasHeight;
  if (host.shape === 'circle') {
    const diameter = Math.min(width, height);
    return {
      left: host.x * canvasWidth - diameter / 2,
      top: host.y * canvasHeight - diameter / 2,
      width: diameter,
      height: diameter,
    };
  }
  return {
    left: host.x * canvasWidth - width / 2,
    top: host.y * canvasHeight - height / 2,
    width,
    height,
  };
};

/** Border radius in px for a host shape (0 for full). */
export const hostBorderRadiusPx = (host: HostPresentation, box: HostBox): number => {
  if (host.shape === 'full') return 0;
  if (host.shape === 'circle' || host.shape === 'ellipse') return Math.min(box.width, box.height) / 2;
  return Math.min(box.width, box.height) * 0.16;
};

/** PiP-scale per format, mirroring the frozen sceneSpecPipTransform scales. */
export const hostCornerScaleForFormat = (format: ProjectFormat): number =>
  format === 'portrait' ? 0.42 : format === 'square' ? 0.4 : 0.38;

/** Normalized horizontal offset of a corner anchor (mirrors the frozen PiP). */
export const hostCornerHorizontalOffset = (format: ProjectFormat): number =>
  format === 'portrait' ? 0.2 : format === 'square' ? 0.25 : 0.3;

/** Normalized vertical offset of a corner anchor (mirrors the frozen PiP). */
export const hostCornerVerticalOffset = (format: ProjectFormat): number =>
  format === 'portrait' ? 0.24 : 0.26;

/**
 * Deterministic corner box for an anchor.  `rounded_rect` keeps the frozen
 * PiP proportions (width = height = scale); `circle` forces equal pixel
 * sides via min(W, H); `ellipse` keeps the PiP width with a shorter height.
 */
export const cornerHostPresentation = (
  format: ProjectFormat,
  anchor: HostAnchor,
  shape: Extract<HostShape, 'circle' | 'rounded_rect' | 'ellipse'>,
): HostPresentation => {
  const scale = hostCornerScaleForFormat(format);
  const horizontalOffset = hostCornerHorizontalOffset(format);
  const verticalOffset = hostCornerVerticalOffset(format);
  const right = anchor === 'top-right' || anchor === 'bottom-right';
  const bottom = anchor === 'bottom-left' || anchor === 'bottom-right';
  const centered = anchor === 'center';
  const x = centered ? 0.5 : right ? 1 - horizontalOffset : horizontalOffset;
  const y = centered ? 0.5 : bottom ? 1 - verticalOffset : verticalOffset;
  let width = scale;
  let height = scale;
  if (shape === 'circle') {
    // Equal PIXEL sides: diameter = scale * min(W, H) → width fraction
    // = scale * min(W,H)/W, height fraction = scale * min(W,H)/H.
    const widthRatio = format === 'landscape' ? 1080 / 1920 : 1;
    const heightRatio = format === 'portrait' ? 1080 / 1920 : 1;
    width = scale * widthRatio;
    height = scale * heightRatio;
  } else if (shape === 'ellipse') {
    height = scale * 0.72;
  }
  return clampHostPresentation(hostPresentationSchema.parse({
    visibility: 'visible',
    shape,
    anchor,
    x: clamp01(x),
    y: clamp01(y),
    width,
    height,
    cropX: 0.5,
    cropY: 0.5,
    cropScale: 1,
    borderWidth: 0.008,
    borderColor: '#ffffff',
    shadow: 'soft',
    zIndex: 0,
    motionPreset: 'none',
  }));
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Keep a host box center inside [0,1] with its half-size (clamped). */
export const clampHostPresentation = (host: HostPresentation): HostPresentation => {
  const halfWidth = Math.min(host.width / 2, 0.5);
  const halfHeight = Math.min(host.height / 2, 0.5);
  return hostPresentationSchema.parse({
    ...host,
    x: clamp01(host.x) < halfWidth ? halfWidth : clamp01(host.x) > 1 - halfWidth ? 1 - halfWidth : clamp01(host.x),
    y: clamp01(host.y) < halfHeight ? halfHeight : clamp01(host.y) > 1 - halfHeight ? 1 - halfHeight : clamp01(host.y),
  });
};

// ── Limited motion presets (pure, seek-safe) ──────────────────────────────

export type HostMotionState = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  /** Extra scale applied on top of the box size (enter/exit emphasis). */
  scale: number;
  /** Border radius fraction of the box half-size (0..1 → px by renderer). */
  radiusFraction: number;
  cropX: number;
  cropY: number;
  cropScale: number;
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const MOTION_DURATION_SECONDS: Record<Exclude<HostMotionPreset, 'none'>, number> = {
  enter: 0.5,
  exit: 0.45,
  'full-to-corner': 0.8,
  'corner-to-full': 0.8,
  'move-corner': 0.6,
};

/** Mirror of an anchor (for move-corner start state). */
export const mirrorHostAnchor = (anchor: HostAnchor): HostAnchor => {
  if (anchor === 'top-left') return 'bottom-right';
  if (anchor === 'bottom-right') return 'top-left';
  if (anchor === 'top-right') return 'bottom-left';
  if (anchor === 'bottom-left') return 'top-right';
  return anchor;
};

type MotionEndpoints = {
  start: Pick<HostPresentation, 'x' | 'y' | 'width' | 'height' | 'cropX' | 'cropY' | 'cropScale'>;
  end: Pick<HostPresentation, 'x' | 'y' | 'width' | 'height' | 'cropX' | 'cropY' | 'cropScale'>;
  /** 0 → 1 (end radius fraction), applied to the interpolated box. */
  radiusFraction: number;
  /** Opacity at start / end of the preset phase. */
  opacityStart: number;
  opacityEnd: number;
};

const interpolateBox = (start: MotionEndpoints['start'], end: MotionEndpoints['end'], t: number) => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t,
  width: start.width + (end.width - start.width) * t,
  height: start.height + (end.height - start.height) * t,
  cropX: start.cropX + (end.cropX - start.cropX) * t,
  cropY: start.cropY + (end.cropY - start.cropY) * t,
  cropScale: start.cropScale + (end.cropScale - start.cropScale) * t,
});

/**
 * Deterministic per-frame host motion.  Every preset is a start/end pair of
 * presentation boxes plus one deterministic easing; the same frame always
 * returns the same state (pure function of frame/fps/duration/host).
 */
export const resolveHostMotion = (
  host: HostPresentation,
  frame: number,
  fps: number,
  durationInFrames: number,
  canvasFormat: ProjectFormat,
): HostMotionState => {
  const staticState: HostMotionState = {
    x: host.x,
    y: host.y,
    width: host.width,
    height: host.height,
    opacity: 1,
    scale: 1,
    radiusFraction: host.shape === 'full' ? 0 : host.shape === 'rounded_rect' ? 0.16 : 0.5,
    cropX: host.cropX,
    cropY: host.cropY,
    cropScale: host.cropScale,
  };
  const preset = host.motionPreset;
  if (preset === 'none') return staticState;
  if (preset === 'enter') {
    const durationFrames = Math.max(1, Math.round(MOTION_DURATION_SECONDS.enter * fps));
    const t = easeOutCubic(clamp01(frame / durationFrames));
    return {...staticState, opacity: t, scale: 0.88 + 0.12 * t};
  }
  if (preset === 'exit') {
    const durationFrames = Math.max(1, Math.round(MOTION_DURATION_SECONDS.exit * fps));
    const exitStart = Math.max(0, durationInFrames - durationFrames);
    if (frame < exitStart) return staticState;
    const t = easeInOutCubic(clamp01((frame - exitStart) / durationFrames));
    return {...staticState, opacity: 1 - t, scale: 1 - 0.06 * t};
  }

  const full: MotionEndpoints['start'] = {x: 0.5, y: 0.5, width: 1, height: 1, cropX: 0.5, cropY: 0.5, cropScale: 1};
  const corner = cornerHostPresentation(canvasFormat, host.anchor, host.shape === 'full' ? 'rounded_rect' : host.shape);
  const cornerEndpoint: MotionEndpoints['end'] = {x: corner.x, y: corner.y, width: corner.width, height: corner.height, cropX: host.cropX, cropY: host.cropY, cropScale: host.cropScale};
  const hostEndpoint: MotionEndpoints['end'] = {x: host.x, y: host.y, width: host.width, height: host.height, cropX: host.cropX, cropY: host.cropY, cropScale: host.cropScale};
  const radiusFraction = host.shape === 'circle' || host.shape === 'ellipse' ? 0.5 : host.shape === 'rounded_rect' ? 0.16 : 0;

  let endpoints: MotionEndpoints;
  if (preset === 'full-to-corner') {
    endpoints = {start: full, end: hostEndpoint, radiusFraction, opacityStart: 1, opacityEnd: 1};
  } else if (preset === 'corner-to-full') {
    endpoints = {start: cornerEndpoint, end: full, radiusFraction: 0, opacityStart: 1, opacityEnd: 1};
  } else {
    // move-corner: mirrored anchor corner → the host's own corner box.
    const mirrored = cornerHostPresentation(canvasFormat, mirrorHostAnchor(host.anchor), host.shape === 'full' ? 'rounded_rect' : host.shape);
    endpoints = {
      start: {x: mirrored.x, y: mirrored.y, width: mirrored.width, height: mirrored.height, cropX: host.cropX, cropY: host.cropY, cropScale: host.cropScale},
      end: hostEndpoint,
      radiusFraction,
      opacityStart: 1,
      opacityEnd: 1,
    };
  }
  const durationFrames = Math.max(1, Math.round(MOTION_DURATION_SECONDS[preset] * fps));
  const t = easeInOutCubic(clamp01(frame / durationFrames));
  const box = interpolateBox(endpoints.start, endpoints.end, t);
  const opacity = endpoints.opacityStart + (endpoints.opacityEnd - endpoints.opacityStart) * t;
  // Radius fraction ramps from the start shape to the end shape along the preset.
  const startRadiusFraction = preset === 'corner-to-full' ? endpoints.radiusFraction : preset === 'full-to-corner' ? 0 : endpoints.radiusFraction;
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    opacity,
    scale: 1,
    radiusFraction: startRadiusFraction + (endpoints.radiusFraction - startRadiusFraction) * t,
    cropX: box.cropX,
    cropY: box.cropY,
    cropScale: box.cropScale,
  };
};

// ── Canvas drag / resize / snap helpers (PreviewCanvas) ───────────────────

export const SNAP_EPSILON = 0.012;

/**
 * Move a host presentation by a normalized delta (client px / canvas px).
 * Local preview only — the caller commits once on pointer up.
 */
export const moveHostPresentation = (host: HostPresentation, deltaXN: number, deltaYN: number): HostPresentation =>
  clampHostPresentation({...host, x: host.x + deltaXN, y: host.y + deltaYN});

/**
 * Proportional corner resize: both sides scale by the same factor around the
 * box center; circle stays a circle.
 */
export const resizeHostPresentation = (host: HostPresentation, factor: number): HostPresentation =>
  hostPresentationSchema.parse({
    ...host,
    width: Math.max(0.02, Math.min(1.5, host.width * factor)),
    height: Math.max(0.02, Math.min(1.5, host.height * factor)),
  });

export type SnapTargets = {
  caption?: {x: number; y: number; width: number; height: number};
  person?: {x: number; y: number; width: number; height: number};
};

const snap1d = (value: number, targets: number[], epsilon: number = SNAP_EPSILON): number => {
  for (const target of targets) {
    if (Math.abs(value - target) <= epsilon) return target;
  }
  return value;
};

/**
 * Deterministic edge/center snapping: box center snaps to canvas center, box
 * edges snap to canvas edges and to the caption / person safe-zone edges.
 */
export const snapHostPresentation = (host: HostPresentation, canvasWidth: number, canvasHeight: number, targets: SnapTargets = {}): HostPresentation => {
  const halfW = host.width / 2;
  const halfH = host.height / 2;
  const centerTargetsX = [0.5];
  const centerTargetsY = [0.5];
  const edgeTargetsX = [0, 1];
  const edgeTargetsY = [0, 1];
  const zones: Array<{zone: SnapTargets['caption'] | SnapTargets['person']; axis: 'x' | 'y'; edges: number[]}> = [];
  for (const zone of [targets.caption, targets.person]) {
    if (!zone) continue;
    zones.push({zone, axis: 'x', edges: [zone.x, zone.x + zone.width]});
    zones.push({zone, axis: 'y', edges: [zone.y, zone.y + zone.height]});
  }
  let x = host.x;
  let y = host.y;
  // Edges first (stronger intent), then centers.
  for (const {axis, edges} of zones) {
    if (axis === 'x') {
      x = snap1d(x + halfW, edges, SNAP_EPSILON) - halfW;
      x = snap1d(x - halfW, edges, SNAP_EPSILON) + halfW;
    } else {
      y = snap1d(y + halfH, edges, SNAP_EPSILON) - halfH;
      y = snap1d(y - halfH, edges, SNAP_EPSILON) + halfH;
    }
  }
  x = snap1d(x + halfW, edgeTargetsX, SNAP_EPSILON) - halfW;
  x = snap1d(x - halfW, edgeTargetsX, SNAP_EPSILON) + halfW;
  y = snap1d(y + halfH, edgeTargetsY, SNAP_EPSILON) - halfH;
  y = snap1d(y - halfH, edgeTargetsY, SNAP_EPSILON) + halfH;
  x = snap1d(x, centerTargetsX, SNAP_EPSILON * 0.8);
  y = snap1d(y, centerTargetsY, SNAP_EPSILON * 0.8);
  return clampHostPresentation({...host, x, y});
};

// ── Clip-level presentation intent ────────────────────────────────────────

/** A derived Host Visual clip keeps the A-roll as the only audio source. */
export const DERIVED_HOST_VISUAL_MUTED = true;

/** Host presentation → the clip transform kept in sync for editing UIs. */
export const hostPresentationToTransform = (
  host: HostPresentation,
  canvasWidth: number,
  canvasHeight: number,
): TimelineClip['transform'] => ({
  x: (host.x - 0.5) * canvasWidth,
  y: (host.y - 0.5) * canvasHeight,
  scale: 1,
  rotation: 0,
  opacity: host.visibility === 'hidden' ? 0 : 1,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  cropLeft: 0,
  borderRadius: host.shape === 'full' ? 0 : 24,
});

// ── Scene-level manual host lock (review fix) ─────────────────────────────

const HOST_PRESENTATION_KEYS = [
  'visibility', 'shape', 'anchor', 'x', 'y', 'width', 'height',
  'cropX', 'cropY', 'cropScale', 'borderWidth', 'borderColor', 'shadow',
  'zIndex', 'motionPreset',
] as const satisfies ReadonlyArray<keyof HostPresentation>;

/**
 * Strict field-by-field equality between two parsed HostPresentations.
 * Used by the Resolver to detect a locked scene-level manual host decision
 * (a locked scene clip whose compiled host differs from the re-analysis
 * proposal) — the manual command must survive re-analysis even when the
 * derived host fragments were removed (e.g. circle → full/hidden).
 */
export const hostPresentationsEqual = (left: HostPresentation | null, right: HostPresentation | null): boolean => {
  if (left === null || right === null) return left === right;
  return HOST_PRESENTATION_KEYS.every((key) => left[key] === right[key]);
};
