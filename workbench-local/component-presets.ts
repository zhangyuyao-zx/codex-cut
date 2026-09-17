import {mkdir, readdir, readFile, writeFile, rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {validateLibraryParameters} from "../modules/components/component-library";
const presetSchema = z.object({name:z.string().trim().min(1).max(60), componentId:z.string(), props:z.record(z.string(),z.unknown()), x:z.number().finite(), y:z.number().finite(), scale:z.number().finite().positive().max(10), opacity:z.number().min(0).max(1)}).strict();
export async function saveComponentPreset(dir:string,input:unknown) {
  const value=presetSchema.parse(input);
  const props=validateLibraryParameters(value.componentId,value.props);
  const preset={...value,props,id:randomUUID(),createdAt:new Date().toISOString()};
  await mkdir(dir,{recursive:true});
  const file=resolve(dir,preset.id+'.json'), temp=file+'.tmp';
  await writeFile(temp,JSON.stringify(preset,null,2)+'\n'); await rename(temp,file);
  return preset;
}
export async function listComponentPresets(dir:string) {
  let files:string[];
  try {files=await readdir(dir);} catch(e:any) {if(e.code==='ENOENT') return []; throw e;}
  return Promise.all(files.filter(f=>/^[a-f0-9-]+\.json$/.test(f)).sort().map(async f=>JSON.parse(await readFile(resolve(dir,f),'utf8'))));
}
