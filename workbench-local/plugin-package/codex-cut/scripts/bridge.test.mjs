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
test('real project read and stale mutation leave cut and production untouched',async()=>{
 const files=['projects/local-workbench/cut/roughcut.json','projects/local-workbench/production/production.json'];
 const before=await Promise.all(files.map(digest));
 const status=await invoke('workbench_status');assert(status.running);
 const c=await invoke('read_project',{section:'summary'});assert.equal(c.workbenchRoot,root);assert(c.scenes.length>0);assert(!Object.hasOwn(c,'token'));
 const detail=await invoke('read_project',{section:'production',sceneId:c.scenes[0].id});assert.equal(detail.scene.id,c.scenes[0].id);
 await assert.rejects(invoke('update_project',{operation:'production/parameters',expectedRevision:999999,data:{sceneId:c.scenes[0].id,patch:{}}}),/版本已变化/);
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
 child.stdin.end();assert.equal(await exit,0,err);const replies=out.trim().split('\n').map(JSON.parse);assert.equal(replies.length,3);assert.equal(replies[0].result.serverInfo.name,'codex-cut');assert.equal(replies[1].result.tools.length,7);assert(JSON.parse(replies[2].result.content[0].text).running);
});
