import {resolveCutTimeline} from './cut-timeline';

/** Paths are passed as argv inputs, never interpolated into the filter graph. */
export function buildCutRenderPlan(input: unknown) {
  const timeline = resolveCutTimeline(input);
  if (!timeline.clips.length) throw Error('请至少保留一个片段');
  const files = [...new Set(timeline.clips.map(c => c.asset.proxyFileName))];
  const filters: string[] = [];
  for (const [i, clip] of timeline.clips.entries()) {
    const source = files.indexOf(clip.asset.proxyFileName);
    const t = clip.transform, crop = t.crop;
    const duration = (clip.outFrame - clip.inFrame) / 30;
    filters.push(`[${source}:v:0]trim=start_frame=${clip.inFrame}:end_frame=${clip.outFrame},setpts=PTS-STARTPTS,` +
      `crop=w='max(2,trunc(iw*${1-crop.left-crop.right}/2)*2)':h='max(2,trunc(ih*${1-crop.top-crop.bottom}/2)*2)':x=iw*${crop.left}:y=ih*${crop.top},` +
      `scale=1920:1080:force_original_aspect_ratio=decrease,setsar=1,` +
      `scale=w='max(2,trunc(iw*${t.scale}/2)*2)':h='max(2,trunc(ih*${t.scale}/2)*2)',format=rgba,` +
      `rotate=${t.rotation}*PI/180:ow=rotw(${t.rotation}*PI/180):oh=roth(${t.rotation}*PI/180):c=none[object${i}]`);
    filters.push(`color=c=black:s=1920x1080:r=30:d=${duration}[canvas${i}]`);
    filters.push(`[canvas${i}][object${i}]overlay=x=(W-w)/2+${t.x}:y=(H-h)/2+${t.y}:shortest=1,` +
      `trim=end_frame=${clip.outFrame-clip.inFrame},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
    filters.push(`[${source}:a:0]atrim=start=${clip.inFrame/30}:end=${clip.outFrame/30},asetpts=PTS-STARTPTS,` +
      `aresample=48000,aformat=channel_layouts=stereo,volume=${t.volume},apad,atrim=duration=${duration}[a${i}]`);
  }
  filters.push(timeline.clips.map((_,i)=>`[v${i}][a${i}]`).join('') +
    `concat=n=${timeline.clips.length}:v=1:a=1[vout][aout]`);
  return {files, filter: filters.join(';'), durationFrames: timeline.durationFrames};
}
