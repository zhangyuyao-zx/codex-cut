import {readFile, access, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const exists=async file=>{try{await access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
export const AUTHORING_GATE_VERSION=3;

/** Local workspace policy is private. A missing binding cannot opt a required project out. */
export async function authoringRequirement(root,projectDir){
 const file=path.resolve(projectDir,'production/authoring.json');
 const policyFile=path.resolve(root,'projects/production-policy.json');
 const identityFile=path.resolve(projectDir,'content-project.json');
 const identity=await exists(identityFile)?await json(identityFile):null;
 let required=false;
 let selectedMethod=null;
 if(await exists(policyFile)){
  const p=await json(policyFile);
  if(p.schemaVersion!==1||p.method!=='dots'||!/^C\d{8}-\d{3}$/.test(p.requiredFromContentId))throw Error('制作默认策略无效：'+policyFile);
  if(p.identityRequiredRoots!==undefined&&(!Array.isArray(p.identityRequiredRoots)||p.identityRequiredRoots.some(r=>typeof r!=='string'||!path.isAbsolute(r))))throw Error('制作策略的工程范围必须是绝对目录');
  const validIdentity=/^C\d{8}-\d{3}$/.test(identity?.contentId??'');
  const identityRequired=!p.identityRequiredRoots||p.identityRequiredRoots.some(root=>{const rel=path.relative(root,projectDir);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));});
  // Explicitly scoped local defaults do not affect unrelated temporary/legacy projects.
  required=validIdentity?identity.contentId>=p.requiredFromContentId:identityRequired;
  const exemption=validIdentity?p.exemptions?.[identity.contentId]:null;
  if(exemption){
   if(typeof exemption.method!=='string'||!exemption.method.trim()||exemption.method==='dots'||typeof exemption.basis!=='string'||!exemption.basis.trim())throw Error('其他制作方向需要已有选型依据：'+identity.contentId);
   required=false;selectedMethod=exemption.method;
  }
 }
 const configured=await exists(file);
 if(configured)required=true;
 return {required,configured,file,contentId:identity?.contentId??null,method:required?'dots':selectedMethod,gateVersion:AUTHORING_GATE_VERSION};
}


export async function initializeProductionAuthoring(root,projectDir){
 const r=await authoringRequirement(root,projectDir);
 if(r.required&&!r.configured){await mkdir(path.dirname(r.file),{recursive:true});await writeFile(r.file,JSON.stringify({schemaVersion:2,method:'dots',contentId:r.contentId,assets:{},references:{},scenes:[],storyboardFrames:{},reviews:{},comparisons:[]},null,2)+'\n',{flag:'wx'});}
 return {...r,configured:r.configured||r.required};
}
