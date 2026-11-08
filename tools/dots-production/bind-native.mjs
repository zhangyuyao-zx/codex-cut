import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
/** Bind existing authored artifacts. Never invent design, observations or approval. */
export async function bindNative({projectDir,filmFile,preparationFile}){
 const identity=await read(path.join(projectDir,'content-project.json'));
 const film=await read(filmFile),prep=await read(preparationFile);
 if(film.contentId!==identity.contentId||prep.brief?.contentId!==identity.contentId||!/^\d+\.\d+\.\d+$/.test(prep.version)||!Array.isArray(film.scenes)||!film.scenes.length)throw Error('Film/preparation must belong to this content project and pin a kit version');
 const target=path.join(projectDir,'production/authoring.json');
 await fs.mkdir(path.dirname(target),{recursive:true});
 const lock=await fs.open(target+'.bind-lock','wx');
 const temporary=target+'.'+randomUUID()+'.tmp';
 try{
 try{const old=await read(target);if(old.schemaVersion===2)throw Error('新工程使用 studio 流程；不能把 schema 2 降级绑定为旧协议');if(old.film||old.scenes?.length)throw Error('Existing authoring binding is populated; edit its current version instead of overwriting');}catch(e){if(e.code!=='ENOENT')throw e;}
 const scenes=[];
 for(const entry of film.scenes){
  const script=path.resolve(path.dirname(filmFile),entry.script);await fs.access(script);
  const referenceIds=entry.referenceIds;
  if(!Array.isArray(referenceIds)||!referenceIds.length||referenceIds.some(id=>!prep.referenceSources.some(r=>r.id===id)))throw Error('Select this scene’s referenceIds in the film plan: '+entry.sceneId);
  scenes.push({sceneId:entry.sceneId,script,preparation:path.resolve(preparationFile),referenceIds});
 }
 // Only an unbound legacy project can reach this point; schema 2 is never downgraded.
 await fs.writeFile(temporary,JSON.stringify({schemaVersion:1,method:'dots',kitVersion:prep.version,contentId:identity.contentId,film:path.resolve(filmFile),scenes},null,2)+'\n');
 await fs.rename(temporary,target);
 return {file:target,contentId:identity.contentId,scenes:scenes.length,checked:false,userAccepted:false,next:'Read native production.authoring; correct missing design and code binding before rendering.'};
 }finally{await lock.close();await fs.unlink(target+'.bind-lock');await fs.rm(temporary,{force:true});}
}
