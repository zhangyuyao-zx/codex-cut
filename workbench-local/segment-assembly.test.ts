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
