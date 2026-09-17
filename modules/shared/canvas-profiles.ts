import {z} from 'zod';

/**
 * The canvas choices available when a new project is created.
 *
 * This registry is deliberately data-only and deterministic.  Existing
 * projects keep the width/height stored in their project document; callers
 * should use getCanvasProfile only while creating a new document.
 */
export const canvasProfileFormatSchema = z.enum(['portrait', 'landscape', 'square']);
export type CanvasProfileFormat = z.infer<typeof canvasProfileFormatSchema>;

export const canvasProfileSchema = z.object({
  format: canvasProfileFormatSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  recommended: z.boolean(),
});
export type CanvasProfile = z.infer<typeof canvasProfileSchema>;

export const canvasProfiles: Readonly<Record<CanvasProfileFormat, CanvasProfile>> = Object.freeze({
  landscape: Object.freeze({
    format: 'landscape',
    label: '横屏 16:9',
    description: '适合 YouTube、B 站和桌面观看',
    width: 1920,
    height: 1080,
    recommended: true,
  }),
  portrait: Object.freeze({
    format: 'portrait',
    label: '竖屏 9:16',
    description: '适合抖音、视频号和手机全屏',
    width: 1080,
    height: 1920,
    recommended: false,
  }),
  square: Object.freeze({
    format: 'square',
    label: '方形 1:1',
    description: '适合社交平台方形画幅',
    width: 1080,
    height: 1080,
    recommended: false,
  }),
});

export const canvasProfileOptions = Object.freeze([
  canvasProfiles.landscape,
  canvasProfiles.portrait,
  canvasProfiles.square,
] satisfies readonly CanvasProfile[]);

export const getCanvasProfile = (format: CanvasProfileFormat = 'landscape'): CanvasProfile => canvasProfiles[format];
