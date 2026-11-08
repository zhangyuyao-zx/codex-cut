import {createHash} from 'node:crypto';
const text=v=>typeof v==='string'&&v.trim().length>0;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])])):value;

// Bind the approved still to its static design. Animation code, cues and soundtrack
// can subsequently develop; this is not a claim that code edits preserve appearance.
export function storyboardKey(book,plan,sceneId){
 const scene=book.scenes?.find(s=>s.sceneId===sceneId),native=plan.scenes?.find(s=>s.id===sceneId);
 if(!scene||!native)throw Error('未知分镜段落 '+sceneId);
 const assets=(scene.assetIds??[]).map(id=>{
  const a=book.assets?.[id];if(!a)throw Error('未知分镜素材 '+id);
  return {id,file:a.file,sha256:a.sha256};
 });
 const design=native.design?{message:native.design.message,relationship:native.design.relationship,objects:native.design.objects}:null;
 const editor=native.editor?{overrides:native.editor.overrides,objectTransforms:native.editor.objectTransforms,objectVisibility:native.editor.objectVisibility,objectOrder:native.editor.objectOrder}:null;
 const components=native.components?.map(({id,componentId,props,mediaBindings,styleDefaults,x,y,scale,opacity})=>({id,componentId,props,mediaBindings,styleDefaults,x,y,scale,opacity}));
 const identity={contentId:book.contentId,sceneId,visualTask:scene.visualTask,mediaMode:scene.mediaMode,assets,title:native.title,intent:native.intent,design,moduleId:native.program?.moduleId,parameters:native.program?.parameters,styleDefaults:native.program?.styleDefaults,components,stylePack:plan.stylePack,editor};
 return createHash('sha256').update(JSON.stringify(stable(identity))).digest('hex');
}

export async function storyboardStatus({book,plan,sceneId,digest,resolveFile}){
 const frame=book.storyboardFrames?.[sceneId];
 if(!frame)return {status:'missing',approved:false,reason:'先输出本段一张能代表最终效果的静态图，发给用户审阅'};
 try{
  if(frame.sceneId!==sceneId||!text(frame.file)||!text(frame.reason)||!text(frame.source)||!(frame.width>0&&frame.height>0))throw Error('静态图记录不完整');
  const visualKey=storyboardKey(book,plan,sceneId);
  if(frame.visualKey!==visualKey)throw Error('素材、文字或静态设计已变化，需要更新本段图片并重新确认');
  if(await digest(resolveFile(frame.file))!==frame.sha256)throw Error('已送审图片被修改或丢失，需要重新送审');
  const a=frame.approval;
  if(!a)return {status:'pending',approved:false,reason:'静态图等待用户明确确认；可以与其他段落一起送审'};
  if(a.kind!=='user'||a.sceneId!==sceneId||a.sha256!==frame.sha256||a.visualKey!==visualKey||!text(a.basis)||!Number.isFinite(Date.parse(a.at)))throw Error('静态图确认与当前段落/图片不匹配');
  return {status:'approved',approved:true,reason:'本段静态图已确认，可推进动画；带声样片仍需单独审阅'};
 }catch(e){return {status:'stale',approved:false,reason:e.message};}
}
