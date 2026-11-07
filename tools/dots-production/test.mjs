// Local engineering regression checks. Fixtures are synthetic, not real narration or visual approval.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const kit=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'.');
const workspace=path.resolve(kit,'../..');
const release=path.join(kit,'releases/1.1.0');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const {checkScene,checkFilm}=await import(pathToFileURL(path.join(release,'direction.mjs')).href);
const {compileObjectStates,objectStateAt,compileValueTrack,valueAt}=await import(pathToFileURL(path.join(release,'state.mjs')).href);
const {cuesFromBeats}=await import(pathToFileURL(path.join(release,'motion.mjs')).href);
const scene=await read(path.join(release,'examples/correction.scene.json'));
const words=await read(path.join(release,'examples/correction.words.json'));
const next=await read(path.join(release,'examples/next.scene.json'));
const nextWords=await read(path.join(release,'examples/next.words.json'));
const film=await read(path.join(release,'examples/film.json'));
const catalog=await read(path.join(kit,'catalog.json'));
const options={catalog,versions:['1.0.0','1.1.0']};
const results=[];
async function test(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
const check=s=>checkScene(s,words,options);
const base=check(scene);
const cli=(...args)=>spawnSync(process.execPath,[path.join(kit,'cli.mjs'),...args],{encoding:'utf8'});

await test('完整来源更正状态链通过结构检查',()=>assert.equal(base.ok,true,base.errors.join('\n')));
await test('下一段可只交接与阅读，无需强造变化',()=>assert.equal(checkScene(next,nextWords,options).ok,true));
await test('未改目标判断仍不能假称change已落实',()=>{const s=clone(scene);s.actions[1].changes=[];assert.match(check(s).errors.join(' '),/change needs concrete/);});
await test('子部件职责缺失可被发现',()=>{const s=clone(scene);s.objects[0].parts[0].reason='';assert.match(check(s).errors.join(' '),/missing reason/);});
await test('容器父子循环可被发现',()=>{const s=clone(scene);s.objects[0].parentId='judgment';s.objects[1].parentId='source';assert.match(check(s).errors.join(' '),/cyclic containment/);});
await test('实际词不存在时拒绝绑定',()=>{const s=clone(scene);s.actions[1].wordId='does-not-exist';assert.match(check(s).errors.join(' '),/wordId missing/);});
await test('动作越过段尾时拒绝',()=>{const s=clone(scene);s.actions[3].durationFrames=80;assert.match(check(s).errors.join(' '),/outside scene/);});
await test('初态接错时拒绝',()=>{const s=clone(scene);s.actions[3].changes[0].from='supported';assert.match(check(s).errors.join(' '),/current state is pending/);});
await test('声明终态未达到时拒绝',()=>{const s=clone(scene);s.objects[1].finalState='pending';assert.match(check(s).errors.join(' '),/final state is not reached/);});
await test('只换状态名字但内容相同时提示复看',()=>{const s=clone(scene);s.objects[1].states[2].data=clone(s.objects[1].states[1].data);assert.match(check(s).warnings.join(' '),/identical data/);});
await test('有理由的长停留不按固定时长拒绝',()=>{const s=clone(scene);s.holds=[{from:0,to:210,objectIds:['source','judgment'],reason:'人工测试：比较两份内容的阅读区间'}];assert.equal(check(s).ok,true);});
await test('停留对象引用有效',()=>{const s=clone(scene);s.holds[0].objectIds=['missing'];assert.match(check(s).errors.join(' '),/Hold: unknown object/);});
await test('时间空档保留复看位置，不自动判节奏失败',()=>{const s=clone(scene);s.holds=[];const r=check(s);assert.equal(r.ok,true);assert.ok(r.inspectionGaps.length>0);assert.ok(r.reviewPrompts.some(x=>x.code==='REVIEW_UNACCOUNTED_TIME'));});
await test('装饰循环不能掩盖未安排的时间',()=>{const s=clone(scene);s.holds=[];s.ambient=[{objectId:'source',from:0,to:210,purpose:'轻微活动感',yieldsTo:'主体变化时降弱'}];assert.deepEqual(check(s).inspectionGaps,check({...s,ambient:[]}).inspectionGaps);});

const judgement=scene.objects.find(x=>x.id==='judgment');
const timeline=compileObjectStates(judgement,scene.actions,base.cues);
await test('状态只在指定触发点改变',()=>{
  assert.equal(objectStateAt(83,timeline).stateId,'supported');
  assert.equal(objectStateAt(84,timeline).stateId,'pending');
  assert.equal(objectStateAt(161,timeline).stateId,'pending');
  assert.equal(objectStateAt(162,timeline).stateId,'revised');
});
await test('修订实际改正文，待核提示退出',()=>{
  const state=objectStateAt(200,timeline);assert.match(state.data.statement,/执行情况未知/);assert.equal(state.data.notice,null);
});
await test('完整快照替换，不合并旧警示',()=>{
  const object={id:'x',initialState:'old',finalState:'new',states:[{id:'old',data:{warning:'pending',label:'old'}},{id:'new',data:{label:'new'}}]};
  const t=compileObjectStates(object,[{id:'replace',changes:[{objectId:'x',from:'old',to:'new',at:'end'}]}],{replace:{start:0,duration:10}});
  assert.equal(Object.hasOwn(objectStateAt(10,t).data,'warning'),false);
});
await test('帧采样可回退，不依赖播放历史',()=>{objectStateAt(200,timeline);assert.equal(objectStateAt(0,timeline).stateId,'supported');});
await test('同帧两份状态被拒绝',()=>{
  const a=clone(scene.actions);a[3].wordId=a[2].wordId;a[3].changes[0].at='start';
  const cues={...base.cues,revise:base.cues.recheck};assert.throws(()=>compileObjectStates(judgement,a,cues),/simultaneous/);
});
await test('原生beat偏移只消费一次',()=>{
  const cues=cuesFromBeats([{label:'correct',wordId:'fixture-1',frame:64,durationFrames:12}],['correct'],210);
  const t=compileObjectStates(scene.objects[0],[scene.actions[1]],cues);assert.equal(t.steps[0].frame,76);
});

const track=compileValueTrack(await read(path.join(release,'examples/pause.track.json')),{run:{start:0,duration:60},resume:{start:120,duration:30}});
await test('进度能停在64%并由新触发继续',()=>{
  assert.equal(valueAt(30,track),.32);assert.equal(valueAt(60,track),.64);assert.equal(valueAt(119,track),.64);
  assert.ok(Math.abs(valueAt(135,track)-.82)<1e-9);assert.equal(valueAt(200,track),1);
});
await test('没有继续段就保持停止值',()=>{const t={...track,segments:track.segments.slice(0,1)};assert.equal(valueAt(999,t),.64);});
await test('进度轨道不能重叠或无说明跳值',()=>{
  assert.throws(()=>compileValueTrack({id:'bad',initial:0,segments:[{actionId:'a',from:.3,to:1,easing:'linear'}]},{a:{start:0,duration:30}}),/discontinuous/);
});

await test('全片交接保留同一实体和修订后状态',()=>assert.equal(checkFilm(film,[scene,next]).ok,true));
await test('续段悄悄恢复旧判断会被发现',()=>{
  const n=clone(next);n.objects[0]=clone(judgement);assert.match(checkFilm(film,[scene,n]).errors.join(' '),/silently resets/);
});
await test('明确为历史回看时可解释不同状态',()=>{
  const n=clone(next),f=clone(film);n.objects[0]=clone(judgement);f.handoffs[0].stateBridgeReasons={'judgment-01':'明确回看更正前的历史判断，画面要标历史'};assert.equal(checkFilm(f,[scene,n]).ok,true);
});
await test('缺少相邻交接会被发现',()=>{const f=clone(film);f.handoffs=[];assert.equal(checkFilm(f,[scene,next]).ok,false);});
await test('同构场景给审片提示，不用布局配额判失败',()=>{
  const b=clone(scene);b.sceneId='independent';const f=clone(film);f.scenes[1].sceneId=b.sceneId;f.handoffs[0].toSceneId=b.sceneId;f.handoffs[0].relation='new-task';f.handoffs[0].retainEntityIds=[];
  const result=checkFilm(f,[scene,b]);assert.equal(result.ok,true);assert.ok(result.reviewPrompts.some(x=>x.code==='COMPARE_SIMILAR_SCENES'));
});
await test('旧schema1保持可检查，不强制迁移',()=>{
  const legacy={...clone(scene),schemaVersion:1,kitVersion:'1.0.0'};
  delete legacy.explanation;delete legacy.composition;for(const o of legacy.objects){delete o.parts;delete o.states;}
  assert.equal(checkScene(legacy,words,options).ok,true);
});

await test('实际React构件消费停止值和颜色',async()=>{
  const req=createRequire(path.join(workspace,'package.json'));
  const esbuild=req('esbuild'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
  const built=await esbuild.build({entryPoints:[path.join(release,'components.jsx')],bundle:true,write:false,format:'cjs',platform:'node',external:['react','remotion']});
  const module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(req,module,module.exports);
  const Component=module.exports.ProgressMeter;
  const html=renderToStaticMarkup(React.createElement(Component,{value:valueAt(90,track),showPercent:true,fillColor:'#888888'}));
  assert.match(html,/64%/);assert.match(html,/width:64%/);assert.match(html,/#888888/);
  const legacy=renderToStaticMarkup(React.createElement(Component,{frame:30,cue:{start:0,duration:60},showPercent:true}));assert.match(legacy,/50%/);
  assert.throws(()=>renderToStaticMarkup(React.createElement(Component,{value:2})),/finite fraction/);
  await esbuild.transform(await fs.readFile(path.join(release,'Scene.jsx'),'utf8'),{loader:'jsx'});
});

await test('新版及旧版固定源码哈希通过',()=>{for(const version of ['1.1.0','1.0.0']){const r=cli('verify','--version',version);assert.equal(r.status,0,r.stderr);}});
await test('CLI实际初始化、检查及拒绝覆盖',async()=>{
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'dots-production-check-'));
  try {
    const target=path.join(parent,'scene'),filmPath=path.join(parent,'film.json');
    assert.equal(cli('init','--to',target).status,0);
    assert.equal((await read(path.join(target,'dots-lock.json'))).version,catalog.currentVersion);
    assert.equal(cli('init','--to',target).status,1);
    assert.equal(cli('init-film','--to',filmPath).status,0);assert.equal(cli('init-film','--to',filmPath).status,1);
    assert.equal(cli('check',path.join(target,'画面动作脚本.json'),'--words',path.join(release,'examples/correction.words.json')).status,1);
    assert.equal(cli('check',path.join(release,'examples/correction.scene.json'),'--words',path.join(release,'examples/correction.words.json')).status,0);
    assert.equal(cli('check-film',path.join(release,'examples/film.json')).status,0);
    const readme=await fs.readFile(path.join(target,'README.md'),'utf8');assert.ok(readme.includes('\n\n'));assert.ok(!readme.includes('\\n\\n'));
  } finally {await fs.rm(parent,{recursive:true,force:true});}
});

const report={version:'1.1.0',passed:results.every(x=>x.passed),checks:results.length,results,scope:'状态/时间/数据/构件HTML/初始化与兼容检查；人工样例词时间；不是实际影片、听辨或审美验收'};
console.log(JSON.stringify(report,null,2));
const out=process.argv.indexOf('--out');if(out>=0)await fs.writeFile(path.resolve(process.argv[out+1]),JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
