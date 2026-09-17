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
const productionOps=['scenes','parameters','rebase','request','feedback','resolve-feedback','undo','cancel-render'];
const cutOps=['import','ranges','transcript','transcribe','render','undo'];
const operations=[...productionOps.map(x=>'production/'+x),...cutOps.map(x=>'cut/'+x)];
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const str={type:'string',minLength:1}; const rev={type:'integer',minimum:0};
export const tools=[
 {name:'workbench_status',description:'Check this machine’s configured Codex Cut workbench and running service. Does not start it or modify a project.',inputSchema:obj({}),annotations:{readOnlyHint:true}},
 {name:'open_workbench',description:'Start/reuse the existing local workbench and return its URL. Open that URL in the Codex browser panel. Never imports or resets a project.',inputSchema:obj({}),annotations:{readOnlyHint:false,destructiveHint:false}},
 {name:'read_project',description:'Read current selection, unsaved changes, cut, visual paragraphs and segment render/approval states, or the audited component library. Read summary before editing.',inputSchema:obj({section:{type:'string',enum:['summary','cut','production','library','component']},sceneId:str,query:{type:'string'},componentId:str}),annotations:{readOnlyHint:true}},
 {name:'update_project',description:'Apply an explicit revision-checked change through the existing API. No arbitrary HTTP or shell commands. Read current state first; do not overwrite user drafts. Operations and data schemas are in the plugin Skill references.',inputSchema:obj({operation:{type:'string',enum:operations},expectedRevision:rev,data:{type:'object'}},['operation','expectedRevision','data']),annotations:{readOnlyHint:false,destructiveHint:true}},
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
function summary(c){return {workbenchRoot:root,url:base,revision:c.plan.revision,cutRevision:c.cut.revision,asset:c.cut.asset,selection:c.selection,durationMs:c.resolved.durationMs,issues:c.resolved.issues,stale:c.resolved.stale,programError:c.programError,assemblyReady:c.assemblyReady,scenes:c.plan.scenes.map(s=>({id:s.id,title:s.title,intent:s.intent,implemented:!!s.program,design:c.designStatus[s.id]})),segmentReviews:c.segmentReviews,requests:c.plan.requests,feedback:c.plan.feedback,job:c.job,previousReview:c.previousReview};}
async function context(){return json('/api/production');}
async function mutate(path,data,{cut=false}={}){
 await healthy();
 const c=await context();
 if(c.selection?.hasUnsavedChanges) throw Error('工作台有未保存修改；请先让用户保存或放弃草稿，再继续');
 if(cut){const cutState=await json('/api/cut');if(data.expectedRevision!==cutState.revision)throw Error('粗剪版本已变化，请重新读取');}
 else if(data.expectedRevision!==undefined && data.expectedRevision!==c.plan.revision) throw Error('制作版本已变化，请重新读取');
 const {token}=await json('/api/bootstrap');
 const output=await json('/api/'+path,{method:'POST',headers:{'content-type':'application/json','x-workbench-token':token},body:JSON.stringify(data)});
 return output.plan?summary(output):output;
}
function validate(name,args){
 const t=tools.find(t=>t.name===name);if(!t) throw Error('未知工具');
 if(!args || typeof args!=='object'||Array.isArray(args))throw Error('工具参数必须为对象');
 for(const k of Object.keys(args))if(!Object.hasOwn(t.inputSchema.properties,k))throw Error('不支持的参数 '+k);
 for(const k of t.inputSchema.required)if(args[k]===undefined)throw Error('缺少参数 '+k);
 for(const [k,v] of Object.entries(args)){
  const p=t.inputSchema.properties[k];
  if(p.type==='string'&&(typeof v!=='string'||(p.minLength&&!v.trim())))throw Error('字符串参数无效 '+k);
  if(p.type==='integer'&&(!Number.isSafeInteger(v)||v<0))throw Error('版本参数无效');
  if(p.type==='object'&&(!v||typeof v!=='object'||Array.isArray(v)))throw Error('对象参数无效');
  if(p.enum&&!p.enum.includes(v))throw Error('参数选项无效 '+k);
  if(p.const!==undefined&&v!==p.const)throw Error('需要用户明确认可这个版本');
 }
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
  if(args.section==='library'){
   const d=await json('/api/library');const items=d.items||[];const q=(args.query||'').toLowerCase();
   return {...d,items:items.filter(x=>JSON.stringify([x.id,x.name,x.description]).toLowerCase().includes(q))};
  }
  if(args.section==='component'){if(!args.componentId)throw Error('请提供 componentId');return json('/api/library/detail/'+encodeURIComponent(args.componentId));}
  const c=await context();
  if(args.section==='production'&&args.sceneId){const scene=c.plan.scenes.find(s=>s.id===args.sceneId);if(!scene)throw Error('段落不存在');return {revision:c.plan.revision,cutRevision:c.cut.revision,selection:c.selection,source:c.plan.source,scene,resolved:c.resolved.scenes.find(s=>s.id===args.sceneId),editor:c.sceneEditors[args.sceneId],review:c.segmentReviews.find(s=>s.sceneId===args.sceneId),requests:c.plan.requests.filter(s=>s.sceneId===args.sceneId),feedback:c.plan.feedback.filter(s=>s.sceneId===args.sceneId)};}
  return args.section==='production'?c:summary(c);
 }
 if(name==='update_project')return mutate(args.operation,{...args.data,expectedRevision:args.expectedRevision,...(args.operation.startsWith('production/')?{actor:'codex'}:{})},{cut:args.operation.startsWith('cut/')});
 if(name==='render_segment')return mutate('production/render',args);
 if(name==='approve_segment'){const {userConfirmed,...request}=args;return mutate('production/approve-sample',request);}
 if(name==='assemble_video')return mutate('production/assemble',args);
 throw Error('未知工具');
}
async function respond(request){
 if(request.id===undefined)return;
 try{
  let result;
  if(request.method==='initialize')result={protocolVersion:request.params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'codex-cut',version:'0.1.0'}};
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
