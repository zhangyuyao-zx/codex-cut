import {readFile, realpath, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline';
const exec = promisify(execFile);
const pluginRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(resolve(pluginRoot,'local-config.json'),'utf8'));
const base='http://127.0.0.1:4340';
const root=await realpath(process.env.CODEX_CUT_ROOT || config.workbenchRoot);
const productionOps=['scenes','parameters','rebase','request','feedback','resolve-feedback','undo','cancel-render','visual-asset','style-pack'];
const cutOps=['import','ranges','transcript','transcribe','render','undo'];
const libraryOps=['reference','reference-prepare','reference-analysis','asset','asset-preview','asset-review','pack','pack-preview','favorite','cancel'];
const operations=[...productionOps.map(x=>'production/'+x),...cutOps.map(x=>'cut/'+x),...libraryOps.map(x=>'visual-library/'+x)];
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const str={type:'string',minLength:1}; const rev={type:'integer',minimum:0};
const memberId={type:'string',pattern:'^[a-z0-9][a-z0-9_-]{0,63}$'};
const memberVersion={type:'string',pattern:'^\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}$'};
const member=obj({id:memberId,version:memberVersion},['id','version']);
export const tools=[
 {name:'workbench_status',description:'Check this machine’s configured Codex Cut workbench and running service. Does not start it or modify a project.',inputSchema:obj({}),annotations:{readOnlyHint:true}},
 {name:'open_workbench',description:'Start/reuse the existing local workbench and return its URL. Open that URL in the Codex browser panel. Never imports or resets a project.',inputSchema:obj({}),annotations:{readOnlyHint:false,destructiveHint:false}},
 {name:'read_project',description:'Read project state, the new visual asset library, pinned asset/style-pack versions or reference videos. visual-asset/style-pack require member:{id,version} (or id and version). library is an alias for new ready assets/packs only; component is historical compatibility, never new selection. Read summary before project edits.',inputSchema:obj({section:{type:'string',enum:['summary','cut','production','library','component','visual-library','visual-asset','style-pack','references']},sceneId:str,query:{type:'string'},componentId:str,member,id:memberId,version:memberVersion}),annotations:{readOnlyHint:true}},
 {name:'update_project',description:'Apply an allowlisted revision-checked change. Read expectedRevision from the same domain: cut, production, or visual-library. Production edits preserve user drafts/locks; library writes do not replace local drafts. Asset visual/reuse checks are receipts, not user acceptance; ready status is selected only by the user in the workbench. No arbitrary HTTP/shell commands.',inputSchema:obj({operation:{type:'string',enum:operations},expectedRevision:rev,data:{type:'object'}},['operation','expectedRevision','data']),annotations:{readOnlyHint:false,destructiveHint:true}},
 {name:'render_segment',description:'Render one authored visual paragraph with narration. Returns a background task; poll read_project for completion. Does not approve it.',inputSchema:obj({sceneId:str,expectedRevision:rev},['sceneId','expectedRevision']),annotations:{readOnlyHint:false,destructiveHint:false}},
 {name:'approve_segment',description:'Record the USER’s explicit acceptance of this exact rendered version. Never use for self-review, inferred approval, tests on the real project, or approval of a plan instead of its movie.',inputSchema:obj({sceneId:str,key:str,renderId:str,userConfirmed:{type:'boolean',const:true}},['sceneId','key','renderId','userConfirmed']),annotations:{readOnlyHint:false,destructiveHint:false}},
 {name:'assemble_video',description:'Assemble all currently approved paragraphs without regenerating their pictures, with one continuous cut audio track. Requires all paragraphs current and approved. Final film still needs user review.',inputSchema:obj({expectedRevision:rev},['expectedRevision']),annotations:{readOnlyHint:false,destructiveHint:false}},
];
async function json(path, options={}){
 const response=await fetch(base+path,{...options,redirect:'error',signal:AbortSignal.timeout(options.method==='POST'?180000:15000)});
 const data=await response.json().catch(()=>{throw Error('工作台返回了非 JSON 响应，请检查本地服务');});
 if(!response.ok) throw Error(data.error || `工作台请求失败 ${response.status}`);
 return data;
}
async function healthy(){
 const h=await json('/api/health');
 if(h.appId!=='codex-local-video-workbench' || !h.ready || await realpath(h.root)!==root) throw Error('4340 端口不是配置的就绪工作台；不会操作其他项目');
 return h;
}
function summary(c){return {workbenchRoot:root,url:base,revision:c.plan.revision,cutRevision:c.cut.revision,asset:c.cut.asset,selection:c.selection,stylePackInfo:c.stylePackInfo,durationMs:c.resolved.durationMs,issues:c.resolved.issues,stale:c.resolved.stale,programError:c.programError,assemblyReady:c.assemblyReady,scenes:c.plan.scenes.map(s=>({id:s.id,title:s.title,intent:s.intent,implemented:!!s.program,design:c.designStatus[s.id]})),segmentReviews:c.segmentReviews,requests:c.plan.requests,feedback:c.plan.feedback,job:c.job,previousReview:c.previousReview};}
async function context(){return json('/api/production');}
async function mutate(path,data,{domain='production'}={}){
 await healthy();
 const c=await context();
 if(domain!=='library'&&c.selection?.hasUnsavedChanges) throw Error('工作台有未保存修改；请先让用户保存或放弃草稿，再继续');
 if(domain==='library'){const library=await json('/api/visual-library');if(data.expectedRevision!==library.revision)throw Error('资产库版本已变化，请重新读取 visual-library');}
 else if(domain==='cut'){const cutState=await json('/api/cut');if(data.expectedRevision!==cutState.revision)throw Error('粗剪版本已变化，请重新读取');}
 else if(data.expectedRevision!==undefined && data.expectedRevision!==c.plan.revision) throw Error('制作版本已变化，请重新读取');
 const {token}=await json('/api/bootstrap');
 const output=await json('/api/'+path,{method:'POST',headers:{'content-type':'application/json','x-workbench-token':token},body:JSON.stringify(data)});
 return output.plan?summary(output):domain==='library'?{...output,projectSelection:c.selection}:output;
}
function validateValue(schema,value,key){
 if(schema.type==='string'&&(typeof value!=='string'||(schema.minLength&&!value.trim())||(schema.pattern&&!new RegExp(schema.pattern,'u').test(value))))throw Error('字符串参数无效 '+key);
 if(schema.type==='integer'&&(!Number.isSafeInteger(value)||value<(schema.minimum??0)))throw Error('版本参数无效 '+key);
 if(schema.type==='boolean'&&typeof value!=='boolean')throw Error('开关参数无效 '+key);
 if(schema.enum&&!schema.enum.includes(value))throw Error('参数选项无效 '+key);
 if(schema.const!==undefined&&value!==schema.const)throw Error('需要用户明确认可这个版本');
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('对象参数无效 '+key);
  for(const required of schema.required??[])if(!Object.hasOwn(value,required)||value[required]===undefined)throw Error('缺少参数 '+key+'.'+required);
  for(const [name,field] of Object.entries(value)){
   if(schema.additionalProperties===false&&!Object.hasOwn(schema.properties??{},name))throw Error('不支持的参数 '+name);
   if(schema.properties?.[name])validateValue(schema.properties[name],field,key+'.'+name);
  }
 }
}
function validate(name,args){
 const tool=tools.find(tool=>tool.name===name);if(!tool)throw Error('未知工具');
 validateValue(tool.inputSchema,args,'arguments');
 if(name==='read_project'&&['visual-asset','style-pack'].includes(args.section))readMember(args);
 if(name==='update_project'){
  if(Object.hasOwn(args.data,'userConfirmed'))throw Error('update_project 不能代替用户选定资产或风格包；请由用户在工作台明确选择');
  if(args.operation==='visual-library/asset-review'&&args.data.review?.kind==='accepted')throw Error('资产检查记录只能是 visual/reuse；模型自评不等于用户选定');
 }
}
function readMember(args){
 if(args.member&&(args.id!==undefined||args.version!==undefined))throw Error('member 与独立 id/version 请选择一种写法');
 const selected=args.member??{id:args.id,version:args.version};validateValue(member,selected,'member');return selected;
}
export async function invoke(name,args={}){
 validate(name,args);
 if(name==='workbench_status'){
  await access(resolve(root,'workbench-local/launcher.mjs'));
  try {return {running:true,url:base,workbenchRoot:root,health:await healthy()};}catch(e){return {running:false,url:base,workbenchRoot:root,message:e.message};}
 }
 if(name==='open_workbench'){
  await access(resolve(root,'workbench-local/launcher.mjs'));
  await exec(process.execPath,[resolve(root,'workbench-local/launcher.mjs'),'start','--no-open'],{cwd:root,timeout:50000,maxBuffer:1024*1024});
  return {url:base,workbenchRoot:root,health:await healthy(),next:'在 Codex 浏览器面板打开 url；先读取当前项目，不自动导入新素材。'};
 }
 await healthy();
 if(name==='read_project'){
  if(args.section==='cut')return json('/api/cut');
  if(args.section==='visual-asset'||args.section==='style-pack'){
   const selected=readMember(args);return json('/api/visual-library/'+(args.section==='visual-asset'?'asset/':'pack/')+encodeURIComponent(selected.id)+'/'+encodeURIComponent(selected.version));
  }
  if(['library','visual-library','references'].includes(args.section)){
   const d=await json('/api/visual-library'),q=(args.query||'').toLowerCase();
   const matches=item=>JSON.stringify([item.id,item.name,item.description,item.tags,item.coverage,item.analysis?.summary]).toLowerCase().includes(q);
   if(args.section==='references')return {revision:d.revision,references:(d.references??[]).filter(matches),active:d.active};
   if(args.section==='library'){
    const assets=(d.assets??[]).filter(asset=>asset.status==='ready'&&matches(asset)),packs=(d.packs??[]).filter(pack=>pack.status==='ready'&&matches(pack));
    return {revision:d.revision,items:assets,assets,packs,legacySelection:false};
   }
   return {...d,assets:(d.assets??[]).filter(matches),packs:(d.packs??[]).filter(matches),references:(d.references??[]).filter(matches)};
  }
  if(args.section==='component'){if(!args.componentId)throw Error('请提供 componentId');return {...await json('/api/library/detail/'+encodeURIComponent(args.componentId)),legacyCompatibility:true};}
  const c=await context();
  if(args.section==='production'&&args.sceneId){const scene=c.plan.scenes.find(s=>s.id===args.sceneId);if(!scene)throw Error('段落不存在');return {revision:c.plan.revision,cutRevision:c.cut.revision,selection:c.selection,source:c.plan.source,scene,resolved:c.resolved.scenes.find(s=>s.id===args.sceneId),editor:c.sceneEditors[args.sceneId],review:c.segmentReviews.find(s=>s.sceneId===args.sceneId),requests:c.plan.requests.filter(s=>s.sceneId===args.sceneId),feedback:c.plan.feedback.filter(s=>s.sceneId===args.sceneId)};}
  return args.section==='production'?c:summary(c);
 }
 if(name==='update_project'){
  return mutate(args.operation,{...args.data,expectedRevision:args.expectedRevision,...(args.operation.startsWith('production/')?{actor:'codex'}:{})},{domain:args.operation.startsWith('visual-library/')?'library':args.operation.startsWith('cut/')?'cut':'production'});
 }
 if(name==='render_segment')return mutate('production/render',args);
 if(name==='approve_segment'){const {userConfirmed,...request}=args;return mutate('production/approve-sample',request);}
 if(name==='assemble_video')return mutate('production/assemble',args);
 throw Error('未知工具');
}
async function respond(request){
 if(request.id===undefined)return;
 try{
  let result;
  if(request.method==='initialize')result={protocolVersion:request.params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'codex-cut',version:'0.2.0'}};
  else if(request.method==='ping')result={};
  else if(request.method==='tools/list')result={tools};
  else if(request.method==='tools/call'){
   try{const data=await invoke(request.params.name,request.params.arguments||{});result={content:[{type:'text',text:JSON.stringify(data)}]};}
   catch(e){result={isError:true,content:[{type:'text',text:e.message}]};}
  }else{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32601,message:'Method not found'}})+'\n');return;}
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\n');
 }catch(e){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32603,message:e.message}})+'\n');}
}
if(process.argv[2]==='--mcp'){
 const lines=createInterface({input:process.stdin});let queue=Promise.resolve();
 for await(const line of lines){if(!line.trim())continue;try{const req=JSON.parse(line);queue=queue.then(()=>respond(req));}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n');}}
 await queue;
}else if(process.argv[2] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await invoke(process.argv[2],JSON.parse(process.argv[3]||'{}')),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
