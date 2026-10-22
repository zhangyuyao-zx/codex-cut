/** Shared, deterministic object editing protocol. No DOM or filesystem dependencies. */
export type CanvasTransform = {x:number;y:number;scale:number;rotation:number};
export const IDENTITY_TRANSFORM: Readonly<CanvasTransform> = Object.freeze({x:0,y:0,scale:1,rotation:0});
export type ObjectEditor = {overrides:Record<string,unknown>;locks:string[];objectTransforms?:Record<string,Partial<CanvasTransform>>;objectLocks?:string[]};
export type CanvasObjectCapability = {id:string;label?:string;parameters:readonly string[];canvas?:{transform?:boolean;text?:string}};
export type EditorControl = {key:string;type:string;required?:boolean;min?:number;max?:number;options?:readonly string[];itemType?:string;minItems?:number;maxItems?:number};
export type EditorDescriptor = {objects:readonly CanvasObjectCapability[];controls:readonly EditorControl[];resolvedParameters:Readonly<Record<string,unknown>>};
export type EditorChange = {kind:'transform'|'parameter'|'objectLock'|'parameterLock';key:string;before:unknown;after:unknown};
export type EditorCommand = {operationId:string;expectedRevision:number;sceneId:string;objectId:string;actor:'user'|'codex';changes:EditorChange[]};
export type EditorReplayRequest = {operationId:string;targetOperationId:string;expectedRevision:number;actor:'user'|'codex'};
export type EditorField = {present:boolean;value?:unknown};
export type EditorFieldChange = {kind:EditorChange['kind'];key:string;before:EditorField;after:EditorField};
export type EditorJournalEntry = {operationId:string;fingerprint:string;sceneId:string;objectId:string;actor:'user'|'codex';label:string;moduleId?:string;changes:EditorFieldChange[];status:'applied'|'undone';actionRevision:number};
export type EditorJournal = {entries:EditorJournalEntry[];receipts:Record<string,string>};
export type EditorHistory = {undo:EditorHistoryItem[];redo:EditorHistoryItem[]};
export type EditorTarget = {sceneId:string;objectId:string;parameters:string[]};
export type EditorHistoryItem = {operationId:string;sceneId:string;objectId:string;label:string};
export class EditorCommandError extends Error {
  constructor(public readonly code:'INVALID_COMMAND'|'EDITOR_CONFLICT'|'EDITOR_LOCKED'|'NOT_FOUND',message:string){super(message);this.name='EditorCommandError';}
}
const fail=(message:string):never=>{throw new EditorCommandError('INVALID_COMMAND',message);};
const conflict=(message:string):never=>{throw new EditorCommandError('EDITOR_CONFLICT',message);};
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
export function editorValueEqual(a:unknown,b:unknown):boolean{return JSON.stringify(a)===JSON.stringify(b);}
export function objectTransformFor(editor:Pick<ObjectEditor,'objectTransforms'>|undefined,objectId:string):CanvasTransform {
  const transform=editor?.objectTransforms?.[objectId];
  return {x:transform?.x??0,y:transform?.y??0,scale:transform?.scale??1,rotation:transform?.rotation??0};
}
export function validateOperationId(id:unknown):asserts id is string {
  if(typeof id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))fail('操作 ID 必须为 UUID');
}
export function validateEditorRevision(expected:unknown,current:number){
  if(typeof expected!=='number'||!Number.isSafeInteger(expected)||expected<0)fail('编辑版本无效');
  if((expected as number)>current)conflict('编辑版本来自未来，请重新读取工程');
}
function target(descriptor:EditorDescriptor,objectId:string){
  const object=descriptor.objects.find(o=>o.id===objectId);
  if(!object)throw new EditorCommandError('NOT_FOUND','编辑对象已删除或未声明：'+objectId);
  return object;
}
function validateParameter(control:EditorControl|undefined,value:unknown,allowAbsent=false){
  if(!control)fail('编辑参数已删除');
  const c=control!;
  if(value===undefined&&allowAbsent&&!c.required)return;
  if(c.type==='number') {if(typeof value!=='number'||!Number.isFinite(value)||(c.min!==undefined&&value<c.min)||(c.max!==undefined&&value>c.max))fail('数值参数超出有效范围：'+c.key);}
  else if(c.type==='text') {if(typeof value!=='string'||value.length>4000||(c.required&&!value.trim()))fail('文字参数无效：'+c.key);}
  else if(c.type==='color') {if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))fail('颜色参数无效：'+c.key);}
  else if(c.type==='boolean') {if(typeof value!=='boolean')fail('布尔参数无效：'+c.key);}
  else if(c.type==='select') {if(typeof value!=='string'||!c.options?.includes(value))fail('选项参数无效：'+c.key);}
  else if(c.type==='list') {if(!Array.isArray(value)||value.length>(c.maxItems??40)||value.length<(c.minItems??0)||value.some(v=>c.itemType==='number'?typeof v!=='number'||!Number.isFinite(v):typeof v!=='string'||v.length>4000))fail('列表参数无效：'+c.key);}
  else fail('不支持的编辑参数：'+c.key);
}
function validateField(object:CanvasObjectCapability,descriptor:EditorDescriptor,kind:string,key:string,value:unknown,allowAbsent=false){
  if(kind==='transform') {
    if(!object.canvas?.transform)fail('对象未提供画布变换能力：'+object.id);
    if(!own(IDENTITY_TRANSFORM,key)||typeof value!=='number'||!Number.isFinite(value))fail('画布变换无效：'+key);
    const n=value as number;
    if(key==='scale'?(n<0.05||n>8):key==='rotation'?Math.abs(n)>3600:Math.abs(n)>20000)fail('画布变换超出有效范围：'+key);
  } else if(kind==='parameter') {
    if(!object.parameters.includes(key))fail('参数不属于当前对象：'+key);
    validateParameter(descriptor.controls.find(c=>c.key===key),value,allowAbsent);
  } else if(kind==='parameterLock'){
    if(!object.parameters.includes(key)||!descriptor.controls.some(control=>control.key===key)||typeof value!=='boolean')fail('参数锁命令无效：'+key);
  } else if(kind==='objectLock') {if(key!=='locked'||typeof value!=='boolean')fail('对象锁命令无效');}
  else fail('未知编辑命令');
}
export function readEditorField(editor:ObjectEditor,objectId:string,descriptor:EditorDescriptor,kind:EditorChange['kind'],key:string):EditorField {
  if(kind==='transform') {const fields=editor.objectTransforms?.[objectId]??{};return {present:own(fields,key),value:objectTransformFor(editor,objectId)[key as keyof CanvasTransform]};}
  if(kind==='parameter')return {present:own(editor.overrides,key),value:descriptor.resolvedParameters[key]};
  if(kind==='parameterLock'){const locked=editor.locks.includes(key);return {present:locked,value:locked};}
  const locked=editor.objectLocks?.includes(objectId)??false;return {present:locked,value:locked};
}
function writeField(editor:ObjectEditor,objectId:string,kind:EditorChange['kind'],key:string,field:EditorField){
  if(kind==='transform') {
    const transforms=editor.objectTransforms??={},fields=transforms[objectId]??{};
    if(field.present)(fields as Record<string,unknown>)[key]=field.value;else delete (fields as Record<string,unknown>)[key];
    if(Object.keys(fields).length)transforms[objectId]=fields;else delete transforms[objectId];
    if(Object.keys(transforms).length)editor.objectTransforms=transforms;else delete editor.objectTransforms;
  } else if(kind==='parameter') {if(field.present)editor.overrides[key]=structuredClone(field.value);else delete editor.overrides[key];}
  else if(kind==='parameterLock'){const locks=new Set(editor.locks);if(field.value===true)locks.add(key);else locks.delete(key);editor.locks=[...locks];}
  else {const locks=new Set(editor.objectLocks??[]);if(field.value===true)locks.add(objectId);else locks.delete(objectId);if(locks.size)editor.objectLocks=[...locks];else delete editor.objectLocks;}
}
export function assertObjectEditsCompatible(editor:ObjectEditor|undefined,descriptor:EditorDescriptor){
  if(!editor)return;
  for(const id of new Set([...Object.keys(editor.objectTransforms??{}),...(editor.objectLocks??[])])){
    const object=target(descriptor,id);
    for(const [key,value] of Object.entries(editor.objectTransforms?.[id]??{}))validateField(object,descriptor,'transform',key,value);
  }
  for(const key of [...Object.keys(editor.overrides),...editor.locks])if(!descriptor.controls.some(c=>c.key===key))fail('用户编辑参数已被删除，请先迁移：'+key);
}
function assertUnlocked(editor:ObjectEditor,object:CanvasObjectCapability,actor:string,changes:readonly {kind:EditorChange['kind'];key:string}[],descriptor:EditorDescriptor){
  const lockedParameters=new Set([...editor.locks,...descriptor.objects.filter(candidate=>editor.objectLocks?.includes(candidate.id)).flatMap(candidate=>candidate.parameters)]);
  if(actor==='codex'&&((editor.objectLocks??[]).includes(object.id)||changes.some(c=>(c.kind==='parameter'||c.kind==='parameterLock')&&lockedParameters.has(c.key))))throw new EditorCommandError('EDITOR_LOCKED','对象或参数已锁定，请由用户解锁后修改');
}
export function applyEditorCommand(editorInput:ObjectEditor|undefined,descriptor:EditorDescriptor,command:EditorCommand):{editor:ObjectEditor;changes:EditorFieldChange[]}{
  validateOperationId(command.operationId);
  if(command.actor!=='user'&&command.actor!=='codex')fail('编辑 actor 无效');
  if(!Array.isArray(command.changes)||!command.changes.length||command.changes.length>100)fail('编辑命令必须含 1–100 项变更');
  const object=target(descriptor,command.objectId),editor=structuredClone(editorInput??{overrides:{},locks:[]});
  assertObjectEditsCompatible(editor,descriptor);assertUnlocked(editor,object,command.actor,command.changes,descriptor);
  const seen=new Set<string>();
  const changes=command.changes.map(change=>{
    if(!change||typeof change.key!=='string')fail('编辑字段无效');
    const id=change.kind+':'+change.key;if(seen.has(id))fail('同一次操作不能重复修改字段');seen.add(id);
    validateField(object,descriptor,change.kind,change.key,change.before,true);validateField(object,descriptor,change.kind,change.key,change.after);
    const before=readEditorField(editor,object.id,descriptor,change.kind,change.key);
    if(!editorValueEqual(before.value,change.before))conflict('字段已被其他操作修改：'+change.key);
    const after={present:(change.kind==='objectLock'||change.kind==='parameterLock')?change.after===true:true,value:structuredClone(change.after)};
    return {kind:change.kind,key:change.key,before,after};
  });
  for(const c of changes)writeField(editor,object.id,c.kind,c.key,c.after);
  return {editor,changes};
}
export function replayEditorChanges(editorInput:ObjectEditor|undefined,descriptor:EditorDescriptor,entry:EditorJournalEntry,direction:'undo'|'redo',actor:'user'|'codex'):ObjectEditor {
  const editor=structuredClone(editorInput??{overrides:{},locks:[]}),object=target(descriptor,entry.objectId);
  assertObjectEditsCompatible(editor,descriptor);assertUnlocked(editor,object,actor,entry.changes,descriptor);
  for(const change of entry.changes){
    const expected=direction==='undo'?change.after:change.before,desired=direction==='undo'?change.before:change.after;
    const current=readEditorField(editor,object.id,descriptor,change.kind,change.key);
    if(current.present!==expected.present||!editorValueEqual(current.value,expected.value))conflict('字段值或覆盖来源已变化，不能'+(direction==='undo'?'撤销':'重做')+'：'+change.key);
    validateField(object,descriptor,change.kind,change.key,desired.value,!desired.present);
  }
  for(const change of entry.changes)writeField(editor,object.id,change.kind,change.key,direction==='undo'?change.before:change.after);
  return editor;
}
export function editorHistoryFor(journal:EditorJournal|undefined):EditorHistory {
  const entries=(journal?.entries??[]).filter(e=>e.actor==='user').sort((a,b)=>a.actionRevision-b.actionRevision);
  const summarize=(e:EditorJournalEntry)=>({operationId:e.operationId,sceneId:e.sceneId,objectId:e.objectId,label:e.label});
  return {undo:entries.filter(e=>e.status==='applied').slice(-100).reverse().map(summarize),redo:entries.filter(e=>e.status==='undone').slice(-100).reverse().map(summarize)};
}

export function editorTargetsFor(journal:EditorJournal|undefined):EditorTarget[]{
  return (journal?.entries??[]).filter(entry=>entry.status==='applied').map(entry=>({sceneId:entry.sceneId,objectId:entry.objectId,parameters:entry.changes.filter(change=>change.kind==='parameter'||change.kind==='parameterLock').map(change=>change.key)}));
}
export function assertEditorTargetsCompatible(targets:readonly EditorTarget[],sceneId:string,descriptor:EditorDescriptor){
  for(const entry of targets.filter(entry=>entry.sceneId===sceneId)){
    const object=target(descriptor,entry.objectId);
    for(const key of entry.parameters)if(!object.parameters.includes(key))fail('编辑对象的参数能力已被删除，请先迁移：'+entry.objectId+'/'+key);
  }
}
