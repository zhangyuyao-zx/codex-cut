import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {authoringRequirement} from './production-policy.mjs';
import {createProductionAuthoringGate as createLegacyGate} from './legacy-production-authoring';
import {createDirectionGate, type DirectionInput} from './production-direction';

export {AUTHORING_GATE_VERSION} from './production-policy.mjs';

/** One entry, selected by the saved project's version. Never migrate an active film implicitly. */
export function createProductionAuthoringGate(root:string,projectDir:string,observe?:(file:string)=>void){
 const legacy=createLegacyGate(root,projectDir,observe),direction=createDirectionGate(root,projectDir,observe);
 async function inspect(input:DirectionInput):Promise<any>{
  try{
   for(const file of [path.join(projectDir,'content-project.json'),path.join(root,'projects/production-policy.json')])observe?.(file);
   const requirement=await authoringRequirement(root,projectDir);
   observe?.(requirement.file);
   if(requirement.configured){
    const book=JSON.parse(await readFile(requirement.file,'utf8'));
    if(book.schemaVersion===2)return direction.inspect(input,book,requirement);
    if(book.schemaVersion!==1)throw Error('不支持的制作记录版本；不能自动降级或覆盖');
   }
   const result=await legacy.inspect(input);
   return {...result,workflow:'legacy-v1',technicalValidation:result.ok?'valid':'blocked',
    visualJudgment:'not-automatically-assessed',nextAction:'既有工程按保存的协议继续；新工程从 tools/dots-production/WORKFLOW.md 开始。'};
  }catch(e:any){return {required:true,ok:false,errors:[e.message],sceneHashes:{},technicalValidation:'blocked',visualJudgment:'not-automatically-assessed'};}
 }
 return {inspect,async assert(input:DirectionInput){const result=await inspect(input);if(!result.ok)throw Error('制作流程未完成：\n'+result.errors.slice(0,12).join('\n')+'\n'+(result.nextAction??'读取 production.authoring 后处理当前步骤。'));return result;}};
}
