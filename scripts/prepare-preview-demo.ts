import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductionStore} from '../workbench-local/production-store';

// Isolated performance fixture. Never points at an existing film or imports
// user media. Generated native source is ignored just like saved animations.
const root=resolve(import.meta.dirname,'..');
const directory=resolve(process.argv[2]||'projects/editor-preview-demo');
const id='saved-preview-load-'+Date.now();
await promisify(execFile)(process.execPath,[resolve(root,'node_modules/tsx/dist/cli.mjs'),resolve(root,'scripts/prepare-editor-demo.ts'),directory,'--stage-c'],{cwd:root});
const code=`import React from 'react';
import {AbsoluteFill,useCurrentFrame} from 'remotion';
import {EditableCanvasObject} from '../EditableCanvasObject';
import {previewNote} from './${id}-copy.jsx';
export function PreviewLoad({parameters}) {
 const frame=useCurrentFrame(),count=Number(parameters.count);
 return <AbsoluteFill style={{background:'#13231d',color:'#e2eedf',fontFamily:'PingFang SC,sans-serif'}}>
 <EditableCanvasObject id="caption" style={{position:'absolute',left:110,top:85,width:1640,height:95}}><div style={{fontSize:62,fontWeight:600}}>{String(parameters.caption)}</div></EditableCanvasObject>
 <svg viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}><defs><filter id="glow"><feGaussianBlur stdDeviation="2"/></filter></defs>
 {Array.from({length:count},(_,i)=>{const x=100+(i%50)*34,y=250+Math.floor(i/50)*25;return <g key={i} opacity={.3+.55*(1+Math.sin((frame+i)*.065))/2}><circle cx={x+Math.sin((frame+i)*.04)*5} cy={y} r={6} fill="#77bd93" filter="url(#glow)"/><circle cx={x} cy={y} r={3} fill="#cbefcc"/></g>;})}</svg>
 <div style={{position:'absolute',bottom:64,left:110,fontSize:27,color:'#9fbaa7'}}>{previewNote} · {count} 个逐帧对象</div>
 </AbsoluteFill>;
}`;
const manifest={id,label:'预览性能技术场景',entry:id+'.jsx',exportName:'PreviewLoad',controls:[
  {key:'caption',label:'标题',type:'text',default:'重场景 · 连续播放与精确定位'},
  {key:'count',label:'对象数量',type:'number',default:1000,min:50,max:2000,step:50}],
  objects:[{id:'caption',label:'画面标题',kind:'text',parameters:['caption'],canvas:{transform:true,text:'caption'}}]};
await writeFile(resolve(root,'workbench-local/scenes',id+'.jsx'),code,{flag:'wx'});
await writeFile(resolve(root,'workbench-local/scenes',id+'-copy.jsx'),'export const previewNote="合成提示音 · 不含用户素材";\n',{flag:'wx'});
await writeFile(resolve(root,'workbench-local/scenes',id+'.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
const store=await createProductionStore(resolve(directory,'production')),state=await store.get();
await store.setScenes(state.revision,state.source!,state.scenes.map((scene,index)=>index===1?{...scene,title:'重场景 · 1000 个动画对象',program:{moduleId:id,parameters:{}}}:scene));
console.log(JSON.stringify({directory,moduleId:id,note:'Only synthetic media. No approval or original film changes.'}));
