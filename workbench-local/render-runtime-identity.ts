import {createHash} from 'node:crypto';
import {readdir,realpath,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {remotionRuntime,runtimeCommand} from './runtime-paths';
import type {ContentDigest} from './cut-media-identity';

/** No runtime download or execution. Exact reuse requires a locally identified renderer. */
export async function renderRuntimeIdentity(root:string,digest:ContentDigest):Promise<string|null>{
  const runtime=remotionRuntime(root);
  if (!runtime.browserExecutable || !runtime.binariesDirectory) return null;
  const files:Array<{role:string;sha256:string}>=[];
  const add=async(role:string,file:string)=>files.push({role,sha256:await digest(await realpath(file))});
  await add('node',process.execPath);
  await add('ffmpeg',runtimeCommand('ffmpeg'));
  await add('ffprobe',runtimeCommand('ffprobe'));
  await add('chrome',runtime.browserExecutable);
  let locks=0;
  for(const name of ['package-lock.json','pnpm-lock.yaml']){
    const file=path.join(root,name);
    try{await stat(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
    await add('dependencies/'+name,file);locks++;
  }
  if(!locks)throw Error('渲染环境缺少依赖锁文件');
  for(const name of ['remotion','@remotion/renderer','@remotion/bundler','react','react-dom']){
    const directory=path.join(root,'node_modules',name),manifestFile=path.join(directory,'package.json');
    await add('installed/'+name+'/manifest',manifestFile);
    const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
    const entry=manifest.module||manifest.main;
    if(typeof entry==='string')await add('installed/'+name+'/entry',path.join(directory,entry));
  }
  const walk=async(directory:string,prefix:string):Promise<void>=>{
    for(const item of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const role=prefix+'/'+item.name,file=path.join(directory,item.name);
      if(item.isDirectory()) await walk(file,role);
      else if(item.isFile()||item.isSymbolicLink()) await add(role,file);
    }
  };
  await walk(runtime.binariesDirectory,'compositor');
  return createHash('sha256').update(JSON.stringify({version:1,node:process.version,files})).digest('hex');
}
