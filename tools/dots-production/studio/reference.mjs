import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {digest} from '../production-pack.mjs';

const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const sourceExtension=/\.[cm]?[jt]sx?$/;

// Read reference implementations as data. Never import or execute their code.
export async function referenceSource(entry,{withCode=false}={}){
 const files=[],seen=new Set(),packages=new Set(),assets=new Set();let dynamicAssets=false;
 async function visit(file){
  file=await fs.realpath(file);if(seen.has(file))return;seen.add(file);
  const isSource=sourceExtension.test(file),isJson=file.endsWith('.json');
  if(!isSource&&!isJson)throw Error('参考源码依赖不是可读取的代码或JSON：'+file);
  const code=await fs.readFile(file,'utf8');
  files.push({file,sha256:await digest(file),...(withCode?{code}:{})});
  if(!isSource)return;
  const tree=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true);
  function scan(node){
   if(ts.isCallExpression(node)&&node.expression.getText(tree)==='staticFile'){
    const arg=node.arguments[0];
    if(arg&&(ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg)))assets.add(arg.text);
    else dynamicAssets=true;
   }
   ts.forEachChild(node,scan);
  }
  scan(tree);
  const emitted=ts.transpileModule(code,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve}}).outputText;
  for(const item of ts.preProcessFile(emitted,true,true).importedFiles){
   const name=item.fileName;
   if(!name.startsWith('.')&&!path.isAbsolute(name)){packages.add(name);continue;}
   const resolved=ts.resolveModuleName(name,file,{allowJs:true,moduleResolution:ts.ModuleResolutionKind.Bundler,module:ts.ModuleKind.ESNext,resolveJsonModule:true},ts.sys).resolvedModule?.resolvedFileName;
   if(!resolved)throw Error('参考的本地依赖不存在：'+name+' ('+file+')');
   await visit(resolved);
  }
 }
 const file=await fs.realpath(entry);await visit(file);
 return {entryFile:file,files,packages:[...packages].sort(),staticAssets:[...assets].sort(),dynamicAssets,
  note:'源码仅供改编。字体和素材需按本期真实文件接入；原镜头文字、品牌角标及硬编码时间不直接沿用。'};
}

export async function referenceFromRegistry(registry,id){
 const row=(await read(registry)).entries?.find(r=>r.id===id);
 if(!row?.media||!row.learn||!row.avoid)throw Error('参考注册项不存在或没有适用边界：'+id);
 const base=path.dirname(path.resolve(registry)),file=path.resolve(base,row.media.file);
 if(await digest(file)!==row.media.sha256)throw Error('参考身份已变化：'+id);
 const from=row.media.fromSeconds,to=row.media.toSeconds;
 if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<=from)throw Error('参考区间无效：'+id);
 const reference={file,sha256:row.media.sha256,from,to,learn:row.learn,avoid:row.avoid,
  ...(row.label?{label:row.label}:{}),...(row.kind?{kind:row.kind}:{}),
  ...(row.acceptanceScope?{acceptanceScope:row.acceptanceScope}:{}),
  ...(row.adaptation?{adaptation:row.adaptation}:{})};
 if(row.sourceCode){
  reference.sourceCode=path.resolve(base,row.sourceCode);
  if(row.sourceExport)reference.sourceExport=row.sourceExport;
  reference.sourceIdentity=(await referenceSource(reference.sourceCode)).files;
 }
 return reference;
}

async function inspectReference(reference,id,base,{withCode=false,registryRow}={}){
 let r={...reference},sourceOrigin='registered';
 try{
  const file=path.resolve(base,r.file);
  if(await digest(file)!==r.sha256)throw Error('参考视频已变化');
  if(!Number.isFinite(r.from)||!Number.isFinite(r.to)||r.from<0||r.to<=r.from)throw Error('参考区间无效');
  // Old imports discarded sourceCode. An explicit registry can supply it for
  // reading only when it names exactly the same video and interval.
  if(!r.sourceCode&&registryRow){
   if(registryRow.sha256!==r.sha256||registryRow.from!==r.from||registryRow.to!==r.to)throw Error('注册表与本段参考的文件身份或区间不一致');
   r={...registryRow,...r,sourceCode:registryRow.sourceCode,sourceIdentity:registryRow.sourceIdentity,sourceExport:registryRow.sourceExport,adaptation:registryRow.adaptation};
   sourceOrigin='registry-read-only';
  }
  let source={status:'missing',reason:'这条参考没有实现源码。选择相近的已认可实现或读取原片；不能把参考名称当作已改编。'};
  if(r.sourceCode){
   try{
    const bundle=await referenceSource(path.resolve(base,r.sourceCode),{withCode});
    const identity=bundle.files.map(({file,sha256})=>({file,sha256}));
    if(r.sourceIdentity&&JSON.stringify(identity)!==JSON.stringify(r.sourceIdentity))throw Error('参考源码或本地依赖已变化；先核对来源，不静默使用新代码');
    source={status:'available',origin:sourceOrigin,identityPinned:Boolean(r.sourceIdentity),...bundle,entryExport:r.sourceExport??null};
   }catch(e){source={status:'unavailable',reason:e.message};}
  }
  return {id,label:r.label??id,kind:r.kind??null,media:{file,sha256:r.sha256,from:r.from,to:r.to},learn:r.learn,avoid:r.avoid,adaptation:r.adaptation??null,acceptanceScope:r.acceptanceScope??'仅作参考；认可不转移至本期',source};
 }catch(e){return {id,unavailable:true,reason:e.message};}
}

/** Current reference + implementation, returned beside speech, without changing the project. */
export async function sceneReferenceStudy({project,sceneId,registry,withCode=false}){
 const file=path.resolve(project,'production/authoring.json');
 let book;
 try{book=await read(file);}catch(e){return {readOnly:true,available:false,reason:e.code==='ENOENT'?'本工程尚无制作参考记录':e.message,references:[]};}
 if(book.schemaVersion!==2)return {readOnly:true,available:false,reason:'既有工程按其保存协议接续，不自动迁移',references:[]};
 const shot=book.scenes?.find(s=>s.sceneId===sceneId);
 if(!shot)return {readOnly:true,available:false,reason:'本段尚未同步至制作记录',references:[]};
 const references=[];
 for(const id of shot.referenceIds??[]){
  const ref=book.references?.[id];
  if(!ref){references.push({id,unavailable:true,reason:'本段引用的参考不存在'});continue;}
  let registryRow;
  if(registry&&!ref.sourceCode){
   try{registryRow=await referenceFromRegistry(registry,id);}catch(e){references.push({id,unavailable:true,reason:e.message});continue;}
  }
  references.push(await inspectReference(ref,id,path.dirname(file),{withCode,registryRow}));
 }
 return {available:references.some(r=>!r.unavailable),sceneId,visualTask:shot.visualTask,references,
  nextAction:references.some(r=>r.source?.status==='available')?'打开相近镜头和源码，从已完成的造型、内部动作改编本段；语义事件与时序使用当前口播。':'按本段表达任务选择具体镜头；旧导入缺源码时用 studio study --registry 读取同一参考的实现。',
  authoringNote:'先确定对象与事件再审代表静态图；图通过后实现动画。参考学习、实际动态审查和用户认可分别完成。',readOnly:true};
}

export async function registryReferenceStudy({registry,id,withCode=false}){
 const r=await referenceFromRegistry(registry,id);
 return {readOnly:true,references:[await inspectReference(r,id,path.dirname(path.resolve(registry)),{withCode})]};
}
