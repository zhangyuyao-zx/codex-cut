import ts from 'typescript';
import path from 'node:path';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolveStaticAsset, staticAssetCalls} from './scene-static-assets';
/** Inspect static imports without executing user scene code. Package versions are covered by the runtime lockfile. */
export async function localSourceDependencies(root:string,entry:string):Promise<Array<{path:string;filePath:string;bytes?:Buffer}>>{
 const base=await realpath(root),entryReal=await realpath(entry),seen=new Set<string>(),result:Array<{path:string;filePath:string;bytes?:Buffer}>=[];
 const visit=async(file:string)=>{
  const actual=await realpath(file),rel=path.relative(base,actual);
  if(rel.startsWith('..'+path.sep)||rel==='..'||path.isAbsolute(rel))throw Error('动画依赖越过工程目录：'+file);
  if(seen.has(actual))return;seen.add(actual);
  const isSource=/\.[cm]?[jt]sx?$/.test(actual);
  const bytes=isSource?await readFile(actual):undefined;result.push({path:rel.split(path.sep).join('/'),filePath:actual,bytes});
  if(!bytes)return;
  const emitted=ts.transpileModule(bytes.toString('utf8'),{fileName:actual,compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve}}).outputText;
  const imports=ts.preProcessFile(emitted,true,true).importedFiles;
  for(const call of staticAssetCalls(bytes.toString('utf8'),actual)) {
   if(call.asset!==null)await visit(await resolveStaticAsset(base,call.asset));
  }
  for(const item of imports){
   if(!item.fileName.startsWith('.')&&!path.isAbsolute(item.fileName))continue;
   const resolved=ts.resolveModuleName(item.fileName,actual,{allowJs:true,moduleResolution:ts.ModuleResolutionKind.Bundler,module:ts.ModuleKind.ESNext,resolveJsonModule:true},ts.sys).resolvedModule?.resolvedFileName;
   let dependency=resolved;
   if(!dependency){const asset=path.resolve(path.dirname(actual),item.fileName);try{if((await stat(asset)).isFile())dependency=asset;}catch{}}
   if(!dependency)throw Error(`动画依赖不存在：${item.fileName} (${rel})`);
   await visit(dependency);
  }
 };
 await visit(entry);
 return result.filter(d=>path.resolve(base,d.path)!==entryReal).sort((a,b)=>a.path.localeCompare(b.path));
}
