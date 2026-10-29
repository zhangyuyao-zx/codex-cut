import {randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {chmod,copyFile,lstat,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {runtimeCommand} from './runtime-paths';
import {fileDigest} from './segment-reviews';
import type {ContentDigest} from './cut-media-identity';
const exec=promisify(execFile);
export const soundtrackSchema=z.object({
  fileName:z.string().regex(/^[a-f0-9-]{36}\.[a-z0-9]{1,8}$/),
  contentHash:z.string().regex(/^[a-f0-9]{64}$/),
  name:z.string().min(1).max(1000),cutRevision:z.number().int().nonnegative().safe(),
  durationFrames:z.number().int().positive().safe(),durationSeconds:z.number().finite().positive(),
}).strict();
export type ProductionSoundtrack=z.infer<typeof soundtrackSchema>;
export function soundtrackPath(productionDir:string,value:ProductionSoundtrack):string {
  const metadata=soundtrackSchema.parse(value);
  return path.resolve(productionDir,'soundtracks',metadata.fileName);
}
async function soundtrackDirectory(productionDir:string){
  const directory=path.resolve(productionDir,'soundtracks'),info=await lstat(directory);
  if(!info.isDirectory()||info.isSymbolicLink())throw Error('完整混音素材目录无效');
  return directory;
}
async function regularFile(file:string){const info=await lstat(file);if(!info.isFile()||info.size===0)throw Error('完整混音必须是非空的普通音频文件');}
export async function probeSoundtrack(file:string,durationFrames:number):Promise<number>{
  await regularFile(file);
  const {stdout}=await exec(runtimeCommand('ffprobe'),['-v','error','-select_streams','a:0','-show_entries','stream=codec_type,duration:format=duration','-of','json',file]);
  const probe=JSON.parse(stdout),audio=probe.streams?.find((s:any)=>s.codec_type==='audio');
  if(!audio)throw Error('完整混音文件没有可用音频轨道');
  const seconds=Number(audio.duration??probe.format?.duration);
  if(!Number.isFinite(seconds)||seconds<=0)throw Error('无法核实完整混音时长');
  if(Math.abs(seconds-durationFrames/30)>1/30+0.000001)throw Error('完整混音时长必须匹配当前粗剪（容差一帧）');
  // Decode the actual track: a readable container alone is not proof of usable audio.
  const decoded=await exec(runtimeCommand('ffmpeg'),['-v','error','-xerror','-i',file,'-map','0:a:0','-progress','pipe:1','-nostats','-f','null','-'],{maxBuffer:1024*1024});
  if(![...decoded.stdout.matchAll(/^out_time_us=(\d+)$/gm)].some(match=>Number(match[1])>0))throw Error('完整混音没有可解码的音频样本');
  return seconds;
}
export async function importSoundtrack(productionDir:string,input:string,cutRevision:number,durationFrames:number):Promise<ProductionSoundtrack>{
  if(typeof input!=='string'||!path.isAbsolute(input)||/[\u0000-\u001f]/.test(input))throw Error('完整混音路径必须是本地绝对文件路径');
  await regularFile(input);
  const extension=path.extname(input).slice(1).toLowerCase();
  if(!/^[a-z0-9]{1,8}$/.test(extension))throw Error('完整混音文件扩展名无效');
  const fileName=randomUUID()+'.'+extension,directory=path.resolve(productionDir,'soundtracks'),destination=path.join(directory,fileName);
  await mkdir(directory,{recursive:true});
  await soundtrackDirectory(productionDir);
  try{
    await copyFile(input,destination,constants.COPYFILE_EXCL);
    const durationSeconds=await probeSoundtrack(destination,durationFrames),contentHash=await fileDigest(destination);
    await chmod(destination,0o444);
    return soundtrackSchema.parse({fileName,contentHash,name:path.basename(input),cutRevision,durationFrames,durationSeconds});
  }catch(error){await unlink(destination).catch(()=>{});throw error;}
}
export async function verifySoundtrack(productionDir:string,value:ProductionSoundtrack,cutRevision:number,durationFrames:number,digest:ContentDigest=fileDigest):Promise<string>{
  const metadata=soundtrackSchema.parse(value);
  if(metadata.cutRevision!==cutRevision||metadata.durationFrames!==durationFrames)throw Error('完整混音对应的粗剪已过期，请重新制作并绑定混音或明确清除');
  const file=soundtrackPath(productionDir,metadata);
  try{await soundtrackDirectory(productionDir);await regularFile(file);if(await digest(file)!==metadata.contentHash)throw Error('hash');}
  catch{throw Error('完整混音素材已丢失或变化，请重新绑定或明确清除');}
  return file;
}
/** Verify the copied bytes, so replacement between context and copy never reaches mux. */
export async function copySoundtrack(productionDir:string,value:ProductionSoundtrack,destination:string,cutRevision:number,durationFrames:number){
  const source=await verifySoundtrack(productionDir,value,cutRevision,durationFrames);
  await copyFile(source,destination,constants.COPYFILE_EXCL);
  if(await fileDigest(destination)!==value.contentHash)throw Error('完整混音在准备渲染期间发生变化');
  return destination;
}
/** Full-film frame coordinates; every segment samples the same continuous audio. */
export function productionAudioArgs(from:number,end:number,trim:boolean,encode:boolean):string[]{
  return trim?['-filter:a',`atrim=start=${from/30}:end=${end/30},asetpts=PTS-STARTPTS`,'-c:v','copy','-c:a','aac','-b:a','192k']:
    encode?['-c:v','copy','-c:a','aac','-b:a','192k']:['-c','copy'];
}
