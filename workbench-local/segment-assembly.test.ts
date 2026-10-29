import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {it,expect} from 'vitest';
import {assembleSegmentPictures} from './segment-assembly';

it('rejects a replaced source snapshot before invoking assembly or publishing a video',async()=>{
  const directory = await mkdtemp(path.join(os.tmpdir(),'codex-assembly-proof-'));
  try {
    const source=path.join(directory,'source.mp4'),runDir=path.join(directory,'run');
    await writeFile(source,'replaced source');
    await expect(assembleSegmentPictures({productionDir:directory,runDir,source,
      sourceHash:'0'.repeat(64),clips:[],duration:30})).rejects.toThrow('预览在准备合成期间发生变化');
    await expect(readFile(path.join(runDir,'review.mp4'))).rejects.toMatchObject({code:'ENOENT'});
    await expect(readFile(path.join(runDir,'concat.txt'))).rejects.toMatchObject({code:'ENOENT'});
  } finally {await rm(directory,{recursive:true,force:true});}
});

it('assembles accepted pictures with the imported full mix and crops sample audio on film time',async()=>{
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
  const {mkdir}=await import('node:fs/promises');
  const {runtimeCommand}=await import('./runtime-paths');
  const {importSoundtrack,productionAudioArgs}=await import('./production-soundtrack');
  const {fileDigest}=await import('./segment-reviews');
  const exec=promisify(execFile),ffmpeg=runtimeCommand('ffmpeg');
  const directory=await mkdtemp(path.join(os.tmpdir(),'codex-assembly-audio-'));
  try{
    const source=path.join(directory,'original.wav'),master=path.join(directory,'master.wav');
    await exec(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2',source]);
    await exec(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=220:duration=1','-f','lavfi','-i','sine=frequency=880:duration=1','-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[out]','-map','[out]',master]);
    const metadata=await importSoundtrack(directory,master,3,60);
    const id='11111111-1111-1111-1111-111111111111',pictureDir=path.join(directory,'renders',id);
    await mkdir(pictureDir,{recursive:true});
    const picture=path.join(pictureDir,'picture.mp4');
    await exec(ffmpeg,['-v','error','-f','lavfi','-i','color=s=1920x1080:r=30:d=1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-an',picture]);
    const pictureHash=await fileDigest(picture);
    const clips=[0,1].map(i=>({id:'clip'+i,sceneId:'scene'+i,key:'key',from:i*30,end:(i+1)*30,status:'done',revision:1,progress:1,pendingMaterials:false,url:`/production-media/renders/${id}/review.mp4`,pictureHash,at:'fixture'}));
    const runDir=path.join(directory,'assembled');
    await assembleSegmentPictures({productionDir:directory,runDir,source,sourceHash:await fileDigest(source),clips,duration:60,soundtrack:{productionDir:directory,metadata,cutRevision:3}});
    const frequency=async(file:string,at:number)=>{
      const {stdout}=await exec(ffmpeg,['-v','error','-ss',String(at),'-t','0.5','-i',file,'-map','0:a:0','-ac','1','-ar','8000','-f','s16le','-'],{encoding:'buffer',maxBuffer:1024*1024});
      let crossings=0;for(let i=2;i<stdout.length;i+=2)if(stdout.readInt16LE(i-2)<0&&stdout.readInt16LE(i)>=0)crossings++;
      return crossings/0.5;
    };
    expect(await frequency(path.join(runDir,'review.mp4'),0.2)).toBeCloseTo(220,-1);
    expect(await frequency(path.join(runDir,'review.mp4'),1.2)).toBeCloseTo(880,-1);
    const sample=path.join(directory,'sample.mp4');
    await exec(ffmpeg,['-v','error','-i',picture,'-i',master,'-map','0:v:0','-map','1:a:0',...productionAudioArgs(30,60,true,true),'-t','1',sample]);
    expect(await frequency(sample,0.2)).toBeCloseTo(880,-1);
    const invalid={...metadata,contentHash:'0'.repeat(64)};
    await expect(assembleSegmentPictures({productionDir:directory,runDir:path.join(directory,'blocked'),source,clips,duration:60,soundtrack:{productionDir:directory,metadata:invalid,cutRevision:3}})).rejects.toThrow('丢失或变化');
  }finally{await rm(directory,{recursive:true,force:true});}
},15000);
