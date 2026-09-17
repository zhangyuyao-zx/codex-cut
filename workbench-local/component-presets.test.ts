import {describe,it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {saveComponentPreset,listComponentPresets} from './component-presets';
const input={name:'我的强调',componentId:'component:v1:text-clean-card',props:{text:'重点内容'},x:0,y:0,scale:1,opacity:1};
describe('component preset reuse',()=>{
 it('persists validated parameters and keeps concurrent saves separate',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'cut-presets-'));
  try {const saved=await Promise.all([saveComponentPreset(dir,input),saveComponentPreset(dir,{...input,name:'第二版'})]);
   const reloaded=await listComponentPresets(dir);expect(reloaded).toHaveLength(2);expect(saved[0].id).not.toBe(saved[1].id);expect(reloaded.every(p=>p.props.text==='重点内容')).toBe(true);
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('rejects unknown components and accidental project/media bindings',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'cut-presets-'));
  try {await expect(saveComponentPreset(dir,{...input,componentId:'missing'})).rejects.toThrow();await expect(saveComponentPreset(dir,{...input,startWordId:'private'})).rejects.toThrow();expect(await listComponentPresets(dir)).toEqual([]);} finally {await rm(dir,{recursive:true,force:true});}
 });
});
