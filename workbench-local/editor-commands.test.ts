import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {applyEditorCommand,objectTransformFor,assertObjectEditsCompatible,assertEditorTargetsCompatible,type EditorCommand,type EditorDescriptor,type EditorReplayRequest} from './editor-commands';
import {createProductionStore,type Scene,type ProductionStore} from './production-store';
const directories:string[]=[];
afterEach(async()=>{await Promise.all(directories.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
const initial:Scene={id:'scene',title:'标题',intent:'说明',startWordId:'a',endWordId:'b',beats:[],program:{moduleId:'module',parameters:{caption:'作者文字',amount:10}}};
const objects=[{id:'title',parameters:['caption'],canvas:{transform:true,text:'caption'}},{id:'amount',parameters:['amount'],canvas:{transform:true}}];
const controls=[{key:'caption',type:'text'},{key:'amount',type:'number',min:0,max:100}];
const descriptor=async(scene:Scene):Promise<EditorDescriptor>=>({objects,controls,resolvedParameters:{...scene.program?.parameters,...scene.editor?.overrides}});
const command=(revision:number,changes:EditorCommand['changes'],extra:Partial<EditorCommand>={}):EditorCommand=>({operationId:randomUUID(),expectedRevision:revision,sceneId:'scene',objectId:'title',actor:'user',changes,...extra});
const transform=(revision:number,key='x',before=0,after=100,extra:Partial<EditorCommand>={})=>command(revision,[{kind:'transform',key,before,after}],extra);
const replay=(target:string,revision:number):EditorReplayRequest=>({operationId:randomUUID(),targetOperationId:target,expectedRevision:revision,actor:'user'});
async function fixture(){const directory=await mkdtemp(join(tmpdir(),'editor-command-'));directories.push(directory);const store=await createProductionStore(directory);await store.setScenes(0,null,[structuredClone(initial)]);return {store,directory};}
async function baseEdit(store:ProductionStore,patch:Partial<Scene>){const state=await store.get();return store.setScenes(state.revision,state.source,state.scenes.map(s=>({...s,...patch})));}
describe('shared object edit reducer',()=>{
 it('resolves absent and sparse geometry, validates capability, value bounds and object ownership',async()=>{
  expect(objectTransformFor(undefined,'title')).toEqual({x:0,y:0,scale:1,rotation:0});expect(objectTransformFor({objectTransforms:{title:{x:12}}},'title').scale).toBe(1);
  const d=await descriptor(initial);
  for(const c of [transform(1,'scale',1,0),transform(1,'x',0,Infinity),transform(1,'rotation',0,3601),transform(1,'y',0,-20001),command(1,[{kind:'parameter',key:'amount',before:10,after:11}])])expect(()=>applyEditorCommand(undefined,d,c)).toThrow();
  expect(()=>applyEditorCommand(undefined,{...d,objects:[{id:'title',parameters:['caption']}]},transform(1))).toThrow('变换能力');
  expect(()=>assertObjectEditsCompatible({overrides:{},locks:[],objectTransforms:{deleted:{x:1}}},d)).toThrow('已删除');
 });
 it('rejects removed text-only targets and parameter mappings, and accepts an initially absent optional parameter',async()=>{
  const d=await descriptor(initial);
  expect(()=>assertEditorTargetsCompatible([{sceneId:'scene',objectId:'missing',parameters:['caption']}],'scene',d)).toThrow('已删除');
  expect(()=>assertEditorTargetsCompatible([{sceneId:'scene',objectId:'title',parameters:['amount']}],'scene',d)).toThrow('参数能力');
  const optional={...d,resolvedParameters:{}};
  expect(applyEditorCommand(undefined,optional,command(1,[{kind:'parameter',key:'caption',before:undefined,after:'初次填写'}])).editor.overrides.caption).toBe('初次填写');
  expect(()=>applyEditorCommand(undefined,{...optional,controls:[{key:'caption',type:'text',required:true}]},command(1,[{kind:'parameter',key:'caption',before:undefined,after:''}]))).toThrow();
 });
 it('does not mutate caller-owned editor data' ,async()=>{const editor={overrides:{caption:'用户文字'},locks:[],objectTransforms:{title:{y:30}}};const before=structuredClone(editor);applyEditorCommand(editor,await descriptor({...initial,editor}),transform(1));expect(editor).toEqual(before);});
});
describe('atomic production editor commands',()=>{
 it('deduplicates concurrent retries durably, rejects ID reuse, and groups a gesture into one history entry',async()=>{
  const {store,directory}=await fixture(),c=command(1,[{kind:'transform',key:'x',before:0,after:50},{kind:'transform',key:'y',before:0,after:60},{kind:'transform',key:'scale',before:1,after:1.3}]);
  const results=await Promise.all([store.editorCommand(c,descriptor),store.editorCommand(c,descriptor)]);expect(results.map(s=>s.revision)).toEqual([2,2]);
  const reopened=await createProductionStore(directory);expect((await reopened.editorCommand(c,descriptor)).revision).toBe(2);expect((await reopened.editorHistory()).undo).toHaveLength(1);
  await expect(reopened.editorCommand({...c,changes:[{kind:'transform',key:'x',before:0,after:51}]},descriptor)).rejects.toThrow('不同');
  const state=await reopened.editorUndo(replay(c.operationId,2),descriptor);expect(state.revision).toBe(3);expect(state.scenes[0].editor?.objectTransforms).toBeUndefined();
  const disk=JSON.parse(await readFile(join(directory,'production.json'),'utf8'));expect(disk.schemaVersion).toBe(1);expect(disk.editorJournal.entries[0].changes).toHaveLength(3);
 });
 it('rebases unrelated stale edits, rejects changed touched fields and future revisions without writes',async()=>{
  const {store,directory}=await fixture();await store.editorCommand(transform(1,'x',0,22),descriptor);
  await store.editorCommand(transform(1,'y',0,33),descriptor);
  const disk=await readFile(join(directory,'production.json'),'utf8');
  await expect(store.editorCommand(transform(1,'x',0,44),descriptor)).rejects.toThrow('字段');
  await expect(store.editorCommand(transform(90,'y',33,44),descriptor)).rejects.toThrow('未来');
  expect(await readFile(join(directory,'production.json'),'utf8')).toBe(disk);
 });
 it('lets Codex replay its own commands durably without undoing user edits or bypassing later locks',async()=>{
  const {store,directory}=await fixture(),user=transform(1),agent=transform(2,'y',0,55,{actor:'codex'});
  await store.editorCommand(user,descriptor);await store.editorCommand(agent,descriptor);
  const disk=await readFile(join(directory,'production.json'),'utf8');
  await expect(store.editorUndo({...replay(user.operationId,3),actor:'codex'},descriptor)).rejects.toThrow('自己的编辑');
  await expect(store.editorUndo(replay(agent.operationId,3),descriptor)).rejects.toThrow('自己的编辑');
  expect(await readFile(join(directory,'production.json'),'utf8')).toBe(disk);
  const undo={...replay(agent.operationId,3),actor:'codex' as const};
  await store.editorUndo(undo,descriptor);
  const reopened=await createProductionStore(directory);
  expect((await reopened.editorUndo(undo,descriptor)).revision).toBe(4);
  expect((await reopened.get()).scenes[0].editor?.objectTransforms).toEqual({title:{x:100}});
  await reopened.editorRedo({...replay(agent.operationId,4),actor:'codex'},descriptor);
  expect((await reopened.get()).scenes[0].editor?.objectTransforms).toEqual({title:{x:100,y:55}});
  await reopened.editorCommand(command(5,[{kind:'objectLock',key:'locked',before:false,after:true}]),descriptor);
  await expect(reopened.editorUndo({...replay(agent.operationId,6),actor:'codex'},descriptor)).rejects.toThrow('锁定');
 });
 it('undoes only touched fields, preserves agent edits and exact inherited override presence, and redoes after reopen',async()=>{
  const {store,directory}=await fixture(),c=command(1,[{kind:'parameter',key:'caption',before:'作者文字',after:'用户文字'},{kind:'transform',key:'x',before:0,after:40}]);
  await store.editorCommand(c,descriptor);
  await store.editorCommand(transform(2,'y',0,75,{actor:'codex'}),descriptor);
  await baseEdit(store,{program:{moduleId:'module',parameters:{caption:'新作者文字',amount:42}}});
  const undo=replay(c.operationId,2),undone=await store.editorUndo(undo,descriptor);expect(undone.revision).toBe(5);expect(undone.scenes[0].program?.parameters.amount).toBe(42);
  expect(undone.scenes[0].editor?.overrides).toEqual({});expect(undone.scenes[0].editor?.objectTransforms).toEqual({title:{y:75}});
  expect((await store.editorUndo(undo,descriptor)).revision).toBe(5);
  const reopened=await createProductionStore(directory),redone=await reopened.editorRedo(replay(c.operationId,5),descriptor);
  expect(redone.scenes[0].editor?.overrides.caption).toBe('用户文字');expect(redone.scenes[0].editor?.objectTransforms).toEqual({title:{x:40,y:75}});
  expect((await reopened.editorHistory()).undo.map(item=>item.operationId)).toEqual([c.operationId]);
 });
 it('rejects inverse replay after same-field divergence or same-value override-presence changes',async()=>{
  const {store}=await fixture(),c=transform(1);await store.editorCommand(c,descriptor);await store.editorCommand(transform(2,'x',100,200,{actor:'codex'}),descriptor);
  await expect(store.editorUndo(replay(c.operationId,1),descriptor)).rejects.toThrow('字段');
  const second=command(3,[{kind:'parameter',key:'caption',before:'作者文字',after:'新字'}]);await store.editorCommand(second,descriptor);await store.editorUndo(replay(second.operationId,4),descriptor);
  const state=await store.get();await store.setScenes(state.revision,null,state.scenes.map(s=>({...s,editor:{...s.editor!,overrides:{caption:'作者文字'}}})),'user');
  await expect(store.editorRedo(replay(second.operationId,6),descriptor)).rejects.toThrow('来源');
 });
 it('blocks Codex writes to object and parameter locks, while keeping the real actor and allowing explicit user unlock',async()=>{
  const {store,directory}=await fixture();await store.editorCommand(command(1,[{kind:'objectLock',key:'locked',before:false,after:true}]),descriptor);
  await expect(store.editorCommand(transform(2,'x',0,1,{actor:'codex'}),descriptor)).rejects.toThrow('锁定');
  await expect(store.editorCommand(command(2,[{kind:'objectLock',key:'locked',before:true,after:false}],{actor:'codex'}),descriptor)).rejects.toThrow('锁定');
  await store.editorCommand(transform(2),descriptor);await store.editorCommand(command(3,[{kind:'objectLock',key:'locked',before:true,after:false}]),descriptor);
  await store.editorCommand(transform(4,'y',0,11,{actor:'codex'}),descriptor);
  const state=await store.get();await store.setScenes(state.revision,null,state.scenes.map(s=>({...s,editor:{...s.editor!,locks:['caption']}})),'user');
  await expect(store.editorCommand(command(6,[{kind:'parameter',key:'caption',before:'作者文字',after:'代理修改'}],{actor:'codex'}),descriptor)).rejects.toThrow('锁定');
  const disk=JSON.parse(await readFile(join(directory,'production.json'),'utf8'));expect(disk.editorJournal.entries.at(-1).actor).toBe('codex');expect((await store.editorHistory()).undo).toHaveLength(3);
 });
 it('uses exact parameter lock commands, prevents Codex unlock and parameter writes, and preserves unrelated locks on inverse replay',async()=>{
  const {store}=await fixture(),lock=command(1,[{kind:'parameterLock',key:'caption',before:false,after:true}]);
  expect((await store.getEditorSnapshot()).hasCommands).toBe(false);
  await store.editorCommand(lock,descriptor);expect((await store.get()).scenes[0].editor?.locks).toEqual(['caption']);
  await expect(store.editorCommand(command(2,[{kind:'parameterLock',key:'caption',before:true,after:false}],{actor:'codex'}),descriptor)).rejects.toThrow('锁定');
  await expect(store.editorCommand(command(2,[{kind:'parameter',key:'caption',before:'作者文字',after:'代理文字'}],{actor:'codex'}),descriptor)).rejects.toThrow('锁定');
  await store.editorCommand(command(2,[{kind:'parameterLock',key:'amount',before:false,after:true}],{objectId:'amount'}),descriptor);
  await store.editorUndo(replay(lock.operationId,3),descriptor);expect((await store.get()).scenes[0].editor?.locks).toEqual(['amount']);
  await store.editorRedo(replay(lock.operationId,4),descriptor);expect((await store.get()).scenes[0].editor?.locks).toEqual(['amount','caption']);
  const unlock=command(5,[{kind:'parameterLock',key:'caption',before:true,after:false}]);await store.editorCommand(unlock,descriptor);expect((await store.get()).scenes[0].editor?.locks).toEqual(['amount']);
  await store.editorUndo(replay(unlock.operationId,6),descriptor);expect((await store.get()).scenes[0].editor?.locks).toEqual(['amount','caption']);
  expect((await store.getEditorSnapshot()).hasCommands).toBe(true);
 });
 it('rejects replay after replacing a module while all its object changes are undone',async()=>{
  const {store}=await fixture(),c=transform(1);await store.editorCommand(c,descriptor);await store.editorUndo(replay(c.operationId,2),descriptor);
  await store.setScenes(3,null,[{...initial,program:{moduleId:'replacement',parameters:initial.program!.parameters}}]);
  await expect(store.editorRedo(replay(c.operationId,4),descriptor)).rejects.toThrow('实现已更换');
  expect((await store.getEditorSnapshot()).hasCommands).toBe(true);
 });
 it('rejects missing targets, capability removal and module switching without mutating saved object edits',async()=>{
  const {store}=await fixture(),c=transform(1);await store.editorCommand(c,descriptor);
  await expect(store.editorUndo(replay(c.operationId,2),async scene=>({...await descriptor(scene),objects:[]}))).rejects.toThrow('已删除');
  await expect(store.editorCommand(transform(2,'y',0,2),async scene=>({...await descriptor(scene),objects:[{id:'title',parameters:['caption']}]}))).rejects.toThrow('变换能力');
  await expect(store.setScenes(2,null,[])).rejects.toThrow('用户调整');await expect(store.setScenes(2,null,[{...initial,program:{moduleId:'other',parameters:{}}}])).rejects.toThrow('迁移');
  await expect(store.setSceneWithRequests(2,{...initial,program:{moduleId:'other',parameters:{}}},[])).rejects.toThrow('迁移');
  expect((await store.get()).revision).toBe(2);
 });
 it('resolves descriptors inside the shared serialization queue against the latest state across store instances',async()=>{
  const {store,directory}=await fixture(),other=await createProductionStore(directory),seen:number[]=[];
  await Promise.all([store.setScenes(1,null,[{...initial,intent:'新的动画动作'}]),other.editorCommand(transform(1),async(scene,state)=>{seen.push(state.revision);expect(scene.intent).toBe('新的动画动作');return descriptor(scene);})]);
  expect(seen).toEqual([2]);expect((await store.get()).revision).toBe(3);
 });
 it('notifies all durable production commits across instances, ignores duplicate commands and detaches subscribers',async()=>{
  const {store,directory}=await fixture(),other=await createProductionStore(directory),events:number[]=[];
  const unsubscribe=store.subscribe(event=>events.push(event.revision));await baseEdit(other,{intent:'代理动画'});await other.undo(2);const c=transform(3);await other.editorCommand(c,descriptor);await other.editorCommand(c,descriptor);
  await other.editorUndo(replay(c.operationId,4),descriptor);expect(events).toEqual([2,3,4,5]);unsubscribe();await other.editorRedo(replay(c.operationId,5),descriptor);expect(events).toEqual([2,3,4,5]);
 });
 it('orders undo and redo by most recent action and protects both active and undone commands from global snapshot undo',async()=>{
  const {store}=await fixture(),a=transform(1),b=transform(2,'y',0,20);await store.editorCommand(a,descriptor);await store.editorCommand(b,descriptor);
  expect((await store.editorHistory()).undo.map(item=>item.operationId)).toEqual([b.operationId,a.operationId]);await expect(store.undo(3)).rejects.toThrow('对象操作撤销');
  await store.editorUndo(replay(b.operationId,3),descriptor);await store.editorUndo(replay(a.operationId,4),descriptor);
  expect((await store.editorHistory()).redo.map(item=>item.operationId)).toEqual([a.operationId,b.operationId]);await expect(store.undo(5)).rejects.toThrow('对象操作撤销');
 });
 it('persists gestures and precise undo/redo without adding legacy full-state snapshots',async()=>{
  const {store,directory}=await fixture(),file=join(directory,'production.json');
  const baseline=JSON.parse(await readFile(file,'utf8')).history;
  const first=transform(1),second=transform(2,'y',0,40);
  await store.editorCommand(first,descriptor);await store.editorCommand(second,descriptor);
  const undo=replay(second.operationId,3),redo=replay(second.operationId,4);
  await store.editorUndo(undo,descriptor);await store.editorRedo(redo,descriptor);
  const persisted=JSON.parse(await readFile(file,'utf8'));
  expect(persisted.history).toEqual(baseline);expect(persisted.editorJournal.entries).toHaveLength(2);
  expect(Object.keys(persisted.editorJournal.receipts)).toHaveLength(4);
  const reopened=await createProductionStore(directory);
  expect((await reopened.get()).scenes[0].editor?.objectTransforms).toEqual({title:{x:100,y:40}});
  expect((await reopened.editorRedo(redo,descriptor)).revision).toBe(5);
  await reopened.editorUndo(replay(first.operationId,5),descriptor);
  expect((await reopened.get()).scenes[0].editor?.objectTransforms).toEqual({title:{y:40}});
  expect(JSON.parse(await readFile(file,'utf8')).history).toEqual(baseline);
  await baseEdit(reopened,{intent:'后续作者编辑'});
  expect(JSON.parse(await readFile(file,'utf8')).history).toHaveLength(baseline.length+1);
 });
 it('reads old envelopes without a journal, preserves new fields through bulk/animation writes, and retains legacy global undo',async()=>{
  const {store,directory}=await fixture();const old=JSON.parse(await readFile(join(directory,'production.json'),'utf8'));expect(old.editorJournal).toBeUndefined();expect((await store.editorHistory()).undo).toEqual([]);
  await baseEdit(store,{intent:'第二版'});expect((await store.undo(2)).scenes[0].intent).toBe('说明');
  const state=await store.get(),edited={...initial,editor:{overrides:{caption:'保留'},locks:['caption'],objectTransforms:{title:{scale:1.2}},objectLocks:['title'],entryTransition:null}};
  await store.setScenes(state.revision,null,[edited],'user');await baseEdit(store,{program:{moduleId:'module',parameters:{caption:'Codex 内容'}}});const current=await store.get();
  await store.setSceneWithRequests(current.revision,{...current.scenes[0],editor:undefined},[]);
  const reopened=await createProductionStore(directory);expect((await reopened.get()).scenes[0].editor).toEqual(edited.editor);
  const snapshot=await reopened.getEditorSnapshot();expect(snapshot.history).toEqual({undo:[],redo:[]});expect(snapshot.state.revision).toBe(6);
 });
});
