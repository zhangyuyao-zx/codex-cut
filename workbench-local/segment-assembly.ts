import {runtimeCommand} from "./runtime-paths";
import {constants} from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileDigest, type SegmentApproval } from './segment-reviews';
const exec = promisify(execFile);
/** Reuse accepted pictures without re-rendering or re-encoding, then mux one continuous cut audio. */
export async function assembleSegmentPictures(options: {
  productionDir: string; runDir: string; source: string; clips: SegmentApproval[];
  sourceHash?: string;
  encodeSourceAudio?: boolean;
  duration: number; signal?: AbortSignal; stage?: (stage: string) => void;
}) {
  const {runDir, clips, duration, signal} = options;
  const run = async (file: string, args: string[]) => {
    signal?.throwIfAborted();
    const process = exec(file, args, {signal, maxBuffer: 4 * 1024 * 1024});
    const closed = new Promise<void>(done => process.child.once('close', () => done()));
    try {return await process;} catch(e) {await closed; throw e;}
  };
  await mkdir(resolve(runDir, 'segments'), {recursive:true});
  await mkdir(resolve(runDir, 'media'), {recursive:true});
  options.stage?.('核对已确认画面');
  for (let i = 0; i < clips.length; i++) {
    signal?.throwIfAborted();
    const clip = clips[i];
    const match = /^\/production-media\/renders\/([a-f0-9-]{36})\/review\.mp4$/.exec(clip.url || '');
    if (!match) throw Error('段落渲染文件地址无效');
    const output = resolve(runDir, 'segments', `${i}.mp4`);
    await copyFile(resolve(options.productionDir, 'renders', match[1], 'picture.mp4'), output,constants.COPYFILE_FICLONE);
    if (await fileDigest(output) !== clip.pictureHash) throw Error('已确认画面文件已变化，请重新审阅该段');
  }
  await copyFile(options.source, resolve(runDir, 'media', 'source.mp4'),constants.COPYFILE_FICLONE);
  if (options.sourceHash && await fileDigest(resolve(runDir,'media','source.mp4')) !== options.sourceHash)
    throw Error('粗剪预览在准备合成期间发生变化，请重新生成预览');
  await writeFile(resolve(runDir, 'concat.txt'), clips.map((_,i) => `file 'segments/${i}.mp4'`).join('\n'));
  options.stage?.('拼接已确认画面');
  await run(runtimeCommand("ffmpeg"), ['-v','error','-f','concat','-safe','1','-i',resolve(runDir,'concat.txt'),'-map','0:v:0','-an','-c:v','copy',resolve(runDir,'picture.mp4')]);
  const probe = await run(runtimeCommand("ffprobe"), ['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=nb_read_frames,width,height,avg_frame_rate:format=duration','-of','json',resolve(runDir,'picture.mp4')]);
  const media = JSON.parse(probe.stdout);
  const v = media.streams?.[0];
  if (Number(v?.nb_read_frames) !== duration || v.width !== 1920 || v.height !== 1080 || v.avg_frame_rate !== '30/1' || Math.abs(Number(media.format?.duration) - duration/30) > 0.002) throw Error('拼接后的帧数、规格或时长与时间线不一致');
  options.stage?.('合入完整原声');
  await run(runtimeCommand("ffmpeg"), ['-v','error','-i',resolve(runDir,'picture.mp4'),'-i',resolve(runDir,'media','source.mp4'),'-map','0:v:0','-map','1:a:0',
    ...(options.encodeSourceAudio?['-c:v','copy','-c:a','aac','-b:a','192k']:['-c','copy']),
    '-t',String(duration/30),'-movflags','+faststart',resolve(runDir,'review.mp4')]);
  signal?.throwIfAborted();
  return {pictureHash: await fileDigest(resolve(runDir,'picture.mp4')), media};
}
