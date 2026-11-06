import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
const hash=x=>createHash('sha256').update(x).digest('hex');
const validBox=b=>b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.x>=0&&b.y>=0&&b.w>0&&b.h>0&&b.x+b.w<=1.001&&b.y+b.h<=1.001;

// Compare against a stable reference until a visible change occurs. This also
// catches slow cumulative changes; tiny pulses and compression noise are ignored.
export function scanFrames(frames,width,height,{fps=6,minSeconds=2.5,pixelDelta=18,changedRatio=.006,regions=[{x:0,y:0,w:1,h:1}],exclusions=[]}={}){
 if(!regions.length||!regions.every(validBox)||!exclusions.every(validBox))throw Error('Valid semantic regions are required');
 const mask=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const nx=x/width,ny=y/height;
  const inside=b=>nx>=b.x&&nx<b.x+b.w&&ny>=b.y&&ny<b.y+b.h;
  if(regions.some(inside)&&!exclusions.some(inside))mask.push(y*width+x);
 }
 if(mask.length<width*height*.1)throw Error('Inspection mask covers less than 10% of picture; cannot assess a token-sized region');
 let reference=null,runStart=0,index=0;const windows=[];
 const finish=end=>{if((end-runStart)/fps>=minSeconds)windows.push({id:`still-${runStart}-${end}`,fromSeconds:runStart/fps,toSeconds:end/fps,durationSeconds:(end-runStart)/fps});};
 for(const frame of frames){
  if(!reference){reference=frame;index++;continue;}
  let changes=0;for(const i of mask)if(Math.abs(frame[i]-reference[i])>=pixelDelta)changes++;
  if(changes/mask.length>=changedRatio){finish(index);reference=frame;runStart=index;}
  index++;
 }
 finish(index);return windows;
}
export async function auditRender({video,sceneFile,fps=6,minSeconds=2.5}){
 const sceneBytes=await fs.readFile(sceneFile),scene=JSON.parse(sceneBytes),videoBytes=await fs.readFile(video);
 const regions=(scene.rhythm?.inspectionRegions??[]).filter(x=>x.role==='semantic');
 if(!regions.length)throw Error('Author explicit semantic inspection regions; do not include subtitle/progress-bar regions');
 const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=duration,width,height,avg_frame_rate','-of','json',video],{encoding:'utf8'});
 if(probe.status!==0)throw Error(probe.stderr);const stream=JSON.parse(probe.stdout).streams[0];
 const width=480,height=Math.round(width*stream.height/stream.width),frameSize=width*height;
 const child=spawn('ffmpeg',['-v','error','-i',video,'-vf',`fps=${fps},scale=${width}:${height}:flags=area,format=gray`,'-f','rawvideo','-pix_fmt','gray','pipe:1']);
 const chunks=[];let error='';child.stderr.on('data',b=>error+=b);
 const exited=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve)});
 for await(const b of child.stdout)chunks.push(b);
 const code=await exited;if(code)throw Error(error);
 const raw=Buffer.concat(chunks),frames=[];for(let i=0;i+frameSize<=raw.length;i+=frameSize)frames.push(raw.subarray(i,i+frameSize));
 const stillWindows=scanFrames(frames,width,height,{fps,minSeconds,regions,exclusions:scene.rhythm?.exclusions??[]});
 return {schemaVersion:1,sceneId:scene.sceneId,videoSha256:hash(videoBytes),sceneSha256:hash(sceneBytes),durationSeconds:Number(stream.duration),sampleFps:fps,inspectionRegions:regions,exclusions:scene.rhythm?.exclusions??[],threshold:{minSeconds,pixelDelta:18,changedRatio:.006},stillWindows,
  deliveryReady:false,note:'Motion screening, not aesthetic scoring. All detected windows remain visible, including declared holds. Normal-speed review is required.'};
}
