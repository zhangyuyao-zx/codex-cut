import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {invoke,tools} from './bridge.mjs';
const plugin=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {workbenchRoot:root}=JSON.parse(await readFile(resolve(plugin,'local-config.json'),'utf8'));
const digest=async f=>createHash('sha256').update(await readFile(resolve(root,f))).digest('hex');
test('seven discoverable tools and exact argument validation',async()=>{
 assert.equal(tools.length,7);assert.equal(new Set(tools.map(t=>t.name)).size,7);
 await assert.rejects(invoke('approve_segment',{sceneId:'x',key:'x',renderId:'x',userConfirmed:false}),/明确认可/);
 await assert.rejects(invoke('update_project',{operation:'production/approve',expectedRevision:0,data:{}}),/选项无效/);
 await assert.rejects(invoke('read_project',{url:'https://example.com'}),/不支持/);
});
test('real project read and stale mutation leave cut and production untouched',async t=>{
 const status=await invoke('workbench_status');if(!status.running){t.skip('Configured workbench is offline; live read-only check requires its existing service');return;}
 const files=['projects/local-workbench/cut/roughcut.json','projects/local-workbench/production/production.json'];
 const before=await Promise.all(files.map(digest));
 const c=await invoke('read_project',{section:'summary'});assert.equal(c.workbenchRoot,root);assert(Array.isArray(c.scenes));assert(!Object.hasOwn(c,'token'));
 if(c.scenes[0]){const detail=await invoke('read_project',{section:'production',sceneId:c.scenes[0].id});assert.equal(detail.scene.id,c.scenes[0].id);}
 await assert.rejects(invoke('update_project',{operation:'production/parameters',expectedRevision:999999,data:{sceneId:c.scenes[0]?.id??'unused-scene',patch:{}}}),/版本已变化|未保存/);
 assert.deepEqual(await Promise.all(files.map(digest)),before);
});
test('wrong localhost service identity rejected before any write',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 let count=0;globalThis.fetch=async()=>{count++;return new Response(JSON.stringify({appId:'other-app',ready:true,root}));};
 await assert.rejects(invoke('render_segment',{sceneId:'x',expectedRevision:0}),/不是配置/);assert.equal(count,1);
});
test('unsaved draft blocks writes before fetching token',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});const urls=[];
 globalThis.fetch=async url=>{urls.push(url);return new Response(JSON.stringify(url.endsWith('/health')?{appId:'codex-local-video-workbench',ready:true,root}:{selection:{hasUnsavedChanges:true}}));};
 await assert.rejects(invoke('render_segment',{sceneId:'x',expectedRevision:0}),/未保存/);assert(!urls.some(u=>u.endsWith('/bootstrap')));
});
test('stdio initialize, tool discovery and actual status response',async()=>{
 const child=spawn(process.execPath,['./scripts/bridge.mjs','--mcp'],{cwd:plugin,stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
 const exit=new Promise(r=>child.once('close',r));
 for(const msg of [{id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'}}},{method:'notifications/initialized'},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'workbench_status',arguments:{}}}])child.stdin.write(JSON.stringify({jsonrpc:'2.0',...msg})+'\n');
 child.stdin.end();assert.equal(await exit,0,err);const replies=out.trim().split('\n').map(JSON.parse);assert.equal(replies.length,3);assert.equal(replies[0].result.serverInfo.name,'codex-cut');assert.equal(replies[1].result.tools.length,7);const status=JSON.parse(replies[2].result.content[0].text);assert.equal(typeof status.running,'boolean');assert.equal(status.workbenchRoot,root);if(!status.running)assert(status.message);
});

function mockService(t,{dirty=false,productionRevision=7,cutRevision=13,libraryRevision=40,library={}}={}){
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});const calls=[];
 const state={revision:libraryRevision,assets:[],packs:[],references:[],favorites:[],active:null,...library};
 globalThis.fetch=async(url,options={})=>{
  const pathname=new URL(url).pathname,body=options.body?JSON.parse(options.body):undefined;calls.push({path:pathname,method:options.method??'GET',body,headers:options.headers});
  const output=pathname==='/api/health'?{appId:'codex-local-video-workbench',ready:true,root}:
   pathname==='/api/production'?{plan:{revision:productionRevision},selection:{hasUnsavedChanges:dirty,sceneId:'existing-scene'}}:
   pathname==='/api/cut'&&options.method!=='POST'?{revision:cutRevision}:
   pathname==='/api/visual-library'&&options.method!=='POST'?state:
   pathname==='/api/bootstrap'?{token:'test-only-token'}:{path:pathname,updated:options.method==='POST'};
  return new Response(JSON.stringify(output));
 };
 return {calls,state};
}

test('new detail selectors validate nested member shape before network and resolve both supported forms',async t=>{
 const {calls}=mockService(t);
 for(const args of [
  {section:'visual-asset',member:{id:'asset',version:'1.0.0',extra:'unsafe'}},
  {section:'visual-asset',member:{id:'../asset',version:'1.0.0'}},
  {section:'style-pack',member:{id:'pack'}},
  {section:'visual-asset',id:'asset'},
  {section:'style-pack',member:{id:'pack',version:'1.0.0'},id:'pack',version:'1.0.0'},
 ]) await assert.rejects(invoke('read_project',args));
 assert.equal(calls.length,0);
 assert.equal((await invoke('read_project',{section:'visual-asset',member:{id:'asset',version:'1.2.3'}})).path,'/api/visual-library/asset/asset/1.2.3');
 assert.equal((await invoke('read_project',{section:'style-pack',id:'pack',version:'2.0.0'})).path,'/api/visual-library/pack/pack/2.0.0');
 const schema=tools.find(tool=>tool.name==='read_project').inputSchema.properties.member;
 assert.deepEqual(schema.required,['id','version']);assert.equal(schema.additionalProperties,false);
 assert(new RegExp(schema.properties.version.pattern).test('1.2.3'));
});

test('new catalog reads preserve candidates, while legacy library alias exposes only new ready assets and packs',async t=>{
 const {calls}=mockService(t,{library:{assets:[{id:'new-ready',name:'Ready',status:'ready'},{id:'new-candidate',name:'Candidate',status:'review'}],packs:[{id:'pack-ready',status:'ready'},{id:'pack-draft',status:'draft'}],references:[{id:'ref-a',name:'Actual reference'}]}});
 const full=await invoke('read_project',{section:'visual-library'});assert.equal(full.assets.length,2);assert.equal(full.packs.length,2);
 const ready=await invoke('read_project',{section:'library'});assert.deepEqual(ready.items.map(item=>item.id),['new-ready']);assert.deepEqual(ready.packs.map(item=>item.id),['pack-ready']);assert.equal(ready.legacySelection,false);
 const searched=await invoke('read_project',{section:'visual-library',query:'Candidate'});assert.deepEqual(searched.assets.map(item=>item.id),['new-candidate']);
 assert.equal((await invoke('read_project',{section:'references',query:'Actual'})).references.length,1);
 assert(!calls.some(call=>call.path==='/api/library'));
 assert.equal((await invoke('read_project',{section:'component',componentId:'historical-id'})).legacyCompatibility,true);
});

test('library writes use library revision rather than production revision and preserve an existing user draft',async t=>{
 const {calls}=mockService(t,{dirty:true,productionRevision:7,libraryRevision:40});
 const output=await invoke('update_project',{operation:'visual-library/asset',expectedRevision:40,data:{asset:{id:'new'},expectedRevision:999}});
 const write=calls.find(call=>call.method==='POST');assert.equal(write.path,'/api/visual-library/asset');assert.equal(write.body.expectedRevision,40);
 assert.equal(output.projectSelection.hasUnsavedChanges,true);assert(!Object.hasOwn(output,'token'));assert(calls.some(call=>call.path==='/api/production'));
 calls.length=0;
 await assert.rejects(invoke('update_project',{operation:'visual-library/asset',expectedRevision:7,data:{asset:{}}}),/资产库版本/);
 assert(!calls.some(call=>call.method==='POST'||call.path==='/api/bootstrap'));
});

test('prepare and cancel still check library revision even when service endpoints ignore it',async t=>{
 const {calls}=mockService(t);
 for(const operation of ['visual-library/reference-prepare','visual-library/cancel']) {
  calls.length=0;
  await assert.rejects(invoke('update_project',{operation,expectedRevision:7,data:{referenceId:'ref-a',jobId:'job'}}),/资产库版本/);
  assert(!calls.some(call=>call.method==='POST'||call.path==='/api/bootstrap'));
  await invoke('update_project',{operation,expectedRevision:40,data:{referenceId:'ref-a',jobId:'job'}});
  assert.equal(calls.filter(call=>call.method==='POST').length,1);
 }
});

test('project asset/style operations continue blocking drafts and force Codex identity',async t=>{
 const {calls}=mockService(t,{dirty:true});
 for(const operation of ['production/visual-asset','production/style-pack'])
  await assert.rejects(invoke('update_project',{operation,expectedRevision:7,data:{}}),/未保存/);
 assert(!calls.some(call=>call.path==='/api/bootstrap'||call.method==='POST'));
});

test('project visual mutations retain production revision checks and cannot use library revision or user actor',async t=>{
 const {calls}=mockService(t);
 await assert.rejects(invoke('update_project',{operation:'production/visual-asset',expectedRevision:40,data:{}}),/制作版本/);
 assert(!calls.some(call=>call.path==='/api/bootstrap'||call.method==='POST'));
 await invoke('update_project',{operation:'production/style-pack',expectedRevision:7,data:{member:{id:'pack',version:'1.0.0'},mode:'preview',actor:'user'}});
 assert.equal(calls.find(call=>call.method==='POST').body.actor,'codex');
});

test('film overview and observations use exact project revision without granting user approval',async t=>{
 const {calls}=mockService(t);
 assert(tools.find(tool=>tool.name==='read_project').inputSchema.properties.section.enum.includes('storyboard'));
 assert.equal((await invoke('read_project',{section:'storyboard'})).path,'/api/production/storyboard');
 assert(!calls.some(call=>call.method==='POST'||call.path==='/api/bootstrap'));
 for(const operation of ['production/storyboard','production/visual-review','production/follow-style']){
  calls.length=0;
  await assert.rejects(invoke('update_project',{operation,expectedRevision:40,data:{sceneId:'existing-scene'}}),/制作版本/);
  assert(!calls.some(call=>call.method==='POST'||call.path==='/api/bootstrap'));
  await invoke('update_project',{operation,expectedRevision:7,data:{sceneId:'existing-scene',actor:'user'}});
  const write=calls.find(call=>call.method==='POST');
  assert.equal(write.path,'/api/'+operation);assert.equal(write.body.expectedRevision,7);assert.equal(write.body.actor,'codex');
  assert(!calls.some(call=>call.path.endsWith('/approve')));
 }
 calls.length=0;
 await assert.rejects(invoke('update_project',{operation:'production/visual-review',expectedRevision:7,data:{userConfirmed:true}}),/不能代替用户/);
 assert.equal(calls.length,0);
});

test('cut writes still use cut revision independently from production and library',async t=>{
 const {calls}=mockService(t);
 for(const expectedRevision of [7,40])await assert.rejects(invoke('update_project',{operation:'cut/ranges',expectedRevision,data:{ranges:[]}}),/粗剪版本/);
 assert(!calls.some(call=>call.method==='POST'));
 await invoke('update_project',{operation:'cut/ranges',expectedRevision:13,data:{ranges:[]}});
 const write=calls.find(call=>call.method==='POST');assert.equal(write.path,'/api/cut/ranges');assert.equal(write.body.expectedRevision,13);
});

test('update_project cannot select ready versions or forge accepted reviews',async t=>{
 const {calls}=mockService(t);
 for(const operation of ['visual-library/asset-status','visual-library/pack-status'])
  await assert.rejects(invoke('update_project',{operation,expectedRevision:40,data:{status:'ready',userConfirmed:true}}),/选项无效/);
 await assert.rejects(invoke('update_project',{operation:'visual-library/asset',expectedRevision:40,data:{userConfirmed:true}}),/不能代替用户/);
 await assert.rejects(invoke('update_project',{operation:'visual-library/asset-review',expectedRevision:40,data:{review:{kind:'accepted'}}}),/自评不等于用户/);
 assert.equal(calls.length,0);
 for(const operation of ['visual-library/asset-review','visual-library/pack-preview'])await invoke('update_project',{operation,expectedRevision:40,data:{member:{id:'asset',version:'1.0.0'},...(operation.endsWith('asset-review')?{review:{kind:'reuse',previewId:'actual-preview',note:'observed'}}:{})}});
 assert.equal(calls.filter(call=>call.method==='POST').length,2);
});
