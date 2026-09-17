import {it,expect} from 'vitest';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runtimeCommand,remotionRuntime,whisperModelPath} from './runtime-paths';
it('resolves explicit and PATH-based tools without depending on a username or Homebrew layout',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'workbench-runtime-'));
 try{const binary=path.join(dir,'ffmpeg');await writeFile(binary,'#!/bin/sh\n');await chmod(binary,0o755);
 expect(runtimeCommand('ffmpeg',{PATH:dir})).toBe(binary);
 expect(runtimeCommand('ffprobe',{WORKBENCH_FFPROBE:binary})).toBe(binary);
 expect(()=>runtimeCommand('ffmpeg',{WORKBENCH_FFMPEG:path.join(dir,'missing')})).toThrow('不可执行');
 expect(whisperModelPath({WORKBENCH_WHISPER_MODEL:'/models/small.pt'})).toBe('/models/small.pt');
 expect(remotionRuntime(dir,{})).toEqual({});
 expect(()=>remotionRuntime(dir,{WORKBENCH_CHROME:'/missing/browser'})).toThrow('不存在');
 }finally{await rm(dir,{recursive:true,force:true});}
});
