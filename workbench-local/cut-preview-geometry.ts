import type {ClipTransform} from './cut-timeline';

/** Mirrors the renderer's even-pixel crop and contain, before object transforms. */
export function cutPreviewGeometry(sourceWidth: number, sourceHeight: number, crop: ClipTransform['crop']) {
  if (![sourceWidth, sourceHeight].every(n => Number.isFinite(n) && n >= 2))
    throw Error('素材画面尺寸尚未就绪');
  const cropWidth = Math.max(2, Math.floor(sourceWidth * (1 - crop.left - crop.right) / 2) * 2);
  const cropHeight = Math.max(2, Math.floor(sourceHeight * (1 - crop.top - crop.bottom) / 2) * 2);
  const cropX = Math.min(sourceWidth - cropWidth, Math.floor(sourceWidth * crop.left / 2) * 2);
  const cropY = Math.min(sourceHeight - cropHeight, Math.floor(sourceHeight * crop.top / 2) * 2);
  const fit = Math.min(1920 / cropWidth, 1080 / cropHeight);
  return {
    widthPercent: cropWidth * fit / 1920 * 100,
    heightPercent: cropHeight * fit / 1080 * 100,
    mediaWidthPercent: sourceWidth / cropWidth * 100,
    mediaHeightPercent: sourceHeight / cropHeight * 100,
    mediaLeftPercent: -cropX / cropWidth * 100,
    mediaTopPercent: -cropY / cropHeight * 100,
  };
}
