import {z} from "zod";

export const sceneEntryTransitionSchema = z
  .object({
    type: z.enum(["dissolve", "slide-left"]),
    frames: z.number().int().min(2).max(30),
  })
  .strict();

export type SceneEntryTransition = z.infer<typeof sceneEntryTransitionSchema>;

/**
 * Returns the incoming B progress for a transition window. The available
 * span may be shorter than the configured duration when a segment is tiny.
 * The last available frame is always fully B, so an outgoing layer is never
 * left mounted after the window.
 */
export function transitionProgress(
  frame: number,
  configuredFrames: number,
  spanFrames: number,
): number {
  const window = Math.min(configuredFrames, spanFrames);
  if (!Number.isFinite(window) || window < 2) return 1;
  if (!Number.isFinite(frame) || frame <= 0) return 0;
  if (frame >= window - 1) return 1;
  return frame / (window - 1);
}
