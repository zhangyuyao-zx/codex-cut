import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {runtimeCommand} from './runtime-paths';

export type AudioWaveform={version:1;binSeconds:number;peaks:number[];silent:boolean};

/** Bounded streaming PCM reduction. No synthetic/decorative waveform samples. */
export function pcmPeaks(samplesPerBin:number) {
  let carry=Buffer.alloc(0),count=0,peak=0;const peaks:number[]=[];
  return {
    write(chunk:Buffer){
      const bytes=carry.length?Buffer.concat([carry,chunk]):chunk;
      const end=bytes.length-(bytes.length%2);
      for(let i=0;i<end;i+=2){peak=Math.max(peak,Math.abs(bytes.readInt16LE(i))/32768);
        if(++count>=samplesPerBin){peaks.push(Math.round(peak*10000)/10000);peak=0;count=0;}}
      carry=Buffer.from(bytes.subarray(end));
    },
    finish(){if(count)peaks.push(Math.round(peak*10000)/10000);return peaks;},
  };
}

export function createAudioWaveforms(directory:string) {
  let queue=Promise.resolve();const pending=new Map<string,Promise<AudioWaveform>>();
  return async(fileName:string,durationSeconds:number):Promise<AudioWaveform>=>{
    if(!/^[A-Za-z0-9_.-]+$/.test(fileName)||fileName==='.'||fileName==='..'||!Number.isFinite(durationSeconds)||durationSeconds<=0)
      throw Error('无效的波形素材');
    const file=path.join(directory,fileName),stamp=await stat(file,{bigint:true});
    const key=createHash('sha256').update([fileName,stamp.size,stamp.mtimeNs,stamp.ctimeNs,durationSeconds,'pcm-peaks-v1'].join(':')).digest('hex');
    const cache=path.join(directory,'waveforms',key+'.json');
    try{const value=JSON.parse(await readFile(cache,'utf8')) as AudioWaveform;
      if(value.version===1&&value.binSeconds>0&&value.peaks.length<=20_100&&value.peaks.every(n=>Number.isFinite(n)&&n>=0&&n<=1))return value;
    }catch{/* Missing/invalid derived cache is regenerated. */}
    const existing=pending.get(key);if(existing)return existing;
    if(pending.size>=4)throw Error('波形正在分析，请稍后重试');
    const result=queue.then(async()=>{
      const binSeconds=Math.max(.05,Math.ceil(durationSeconds/20_000*1000)/1000);
      const reducer=pcmPeaks(Math.max(1,Math.round(binSeconds*1000)));
      await new Promise<void>((resolve,reject)=>{
        const child=spawn(runtimeCommand('ffmpeg'),['-v','error','-i',file,'-t',String(durationSeconds),'-map','0:a:0','-vn','-ac','1','-ar','1000','-f','s16le','pipe:1'],{stdio:['ignore','pipe','pipe']});
        let error='';const timeout=setTimeout(()=>child.kill('SIGKILL'),120_000);
        child.stdout.on('data',(data:Buffer)=>reducer.write(data));
        child.stderr.on('data',(data:Buffer)=>{if(error.length<2000)error+=data.toString();});
        child.once('error',reason=>{clearTimeout(timeout);reject(reason);});
        child.once('close',code=>{clearTimeout(timeout);if(code===0)resolve();else reject(Error('音轨波形不可用：'+(error||'分析超时')));});
      });
      const after=await stat(file,{bigint:true});
      if(after.size!==stamp.size||after.mtimeNs!==stamp.mtimeNs||after.ctimeNs!==stamp.ctimeNs)throw Error('素材在分析期间变化，请重试');
      const peaks=reducer.finish();if(peaks.length>20_100)throw Error('波形样本超出范围');
      const value:AudioWaveform={version:1,binSeconds,peaks,silent:peaks.every(n=>n===0)};
      await mkdir(path.dirname(cache),{recursive:true});const temp=cache+'.'+randomUUID()+'.tmp';
      await writeFile(temp,JSON.stringify(value),{mode:0o600});await rename(temp,cache);return value;
    });
    pending.set(key,result);queue=result.then(()=>{},()=>{});
    void result.finally(()=>pending.delete(key)).catch(()=>{});return result;
  };
}
