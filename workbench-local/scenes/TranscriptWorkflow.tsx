import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate, Easing} from 'remotion';
import type {SceneModuleInput} from '../SceneModuleSurface';
const ease=Easing.bezier(.22,1,.36,1);
const p=(f:number,a:number,b:number)=>interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const at=(left:number,top:number,width?:number,height?:number):React.CSSProperties=>({position:'absolute',left,top,width,height});
const mono:React.CSSProperties={fontFamily:'Menlo, monospace',letterSpacing:2};
export function TranscriptWorkflow({title,parameters:v,beats,mediaSrc,from}:SceneModuleInput){
 const f=useCurrentFrame();
 const cue=(label:string,fallback:number)=>beats.find(b=>b.label===label)?.frame??fallback;
 const auto=cue('生成逐字稿',68),align=cue('文字对齐时间线',142),aligned=cue('精确对齐',183),edit=cue('像修改文档',248),select=cue('删除废话',292),picture=cue('画面和声音',369),sync=cue('同步粗剪',431);
 const a=p(f,auto-7,auto+19),b=p(f,align-8,align+18),c=p(f,edit-8,edit+18),d=p(f,select,select+15),e=p(f,picture,sync+1);
 const bg=String(v.background),paper=String(v.textColor),accent=String(v.accent),muted='#909B9F',line='#374044';
 const scale=Number(v.personScale),x=112+Number(v.personX),y=mix(mix(336,392,a),404,b)+Number(v.personY),w=mix(mix(920,680,a),640,b)*scale;
 const phase=c>.5?3:b>.5?2:a>.5?1:0;
 const tokens=String(v.transcript).split(' ').filter(Boolean);
 const rowX=864,trackWidth=944;
 const removeWidth=280*(1-e),cutX=370,tailX=cutX+removeWidth;
 return <AbsoluteFill style={{background:bg,color:paper,fontFamily:'PingFang SC, sans-serif'}}>
  <div style={{...at(112,72),...mono,fontSize:18,color:muted}}>CODEX CUT <span style={{margin:'0 20px',color:line}}>/</span> {title}</div>
  <div style={{...at(1270,72,538),display:'flex',justifyContent:'space-between'}}>{['导入','转写','对齐','粗剪'].map((t,i)=><span key={t} style={{fontSize:20,color:phase===i?accent:muted}}><span style={{...mono,fontSize:12,marginRight:10}}>0{i+1}</span>{t}</span>)}</div>
  <div data-editable-object="headline" style={{...at(112,164,1680),fontSize:Number(v.titleSize)*1.1,fontWeight:550,letterSpacing:-2,lineHeight:1.25}}>
   {phase===0?<>{String(v.introTitle)}<span style={{color:accent}}>开始。</span></>:phase===1?<>{String(v.transcriptTitle)}<span style={{color:accent}}>成为文字。</span></>:phase===2?<>{String(v.alignTitle)}<span style={{color:accent}}>都有时间。</span></>:<>{String(v.editTitle)}<span style={{color:accent}}>音画一起剪。</span></>}
  </div>
  <div data-editable-object="person" style={{...at(x,y,w,w*9/16),borderRadius:14,overflow:'hidden',boxShadow:'0 20px 65px #0004'}}>
   <OffthreadVideo src={mediaSrc.startsWith('/')?mediaSrc:staticFile(mediaSrc)} trimBefore={from} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/>
  </div>
  <div style={{...at(1136,404,672),opacity:1-a,transform:`translateY(${-a*20}px)`}}>
   <div style={{fontSize:22,color:accent,letterSpacing:3}}>从素材到可编辑内容</div>
   <div style={{fontSize:48,fontWeight:500,marginTop:28,lineHeight:1.65}}>把已经说过的话，<br/>变成可以编辑的内容。</div>
   <div style={{marginTop:36,fontSize:24,color:muted}}>视频 → 文字 → 时间线</div>
  </div>
  <div data-editable-object="transcript" style={{...at(rowX,350,trackWidth,222),opacity:a,transform:`translateY(${(1-a)*20}px)`}}>
   <div style={{color:muted,fontSize:20,marginBottom:20}}>逐字稿 <span style={{float:'right',fontSize:17}}>编辑动作示意</span></div>
   <div style={{height:198,position:'relative'}}>
    <div style={{opacity:1-c,position:'absolute',inset:0,display:'flex',gap:18,alignItems:'center'}}>{tokens.map((t,i)=>{const appear=p(f,auto+i*7,auto+i*7+10);return <div key={i} style={{opacity:appear,transform:`translateY(${(1-appear)*12}px)`,fontSize:Number(v.wordSize),fontWeight:550,color:paper,padding:'12px 8px',borderBottom:`3px solid ${i<Math.floor(mix(0,tokens.length,p(f,align,aligned+8)))?accent:'transparent'}`}}>{t}</div>;})}</div>
    <div style={{...at(0,17,trackWidth),opacity:c,fontSize:37,lineHeight:1.85}}>
     <div>{String(v.keptLine)}<span style={{fontSize:16,color:muted,marginLeft:28}}>保留</span></div>
     <div style={{display:'flex',alignItems:'center',gap:26,opacity:1-e,transform:`translateY(${-e*10}px)`}}><span style={{background:`rgba(245,142,128,${d*.18})`,color:d>.5?'#F3A99D':muted,textDecoration:d>.85?'line-through':'none',padding:'0 8px',marginLeft:-8,borderRadius:5}}>{String(v.repeatedLine)}</span><span style={{fontSize:16,color:'#F3A99D',opacity:d}}>重复一句，删除</span></div>
     <div style={{...at(0,76),opacity:e,color:accent,fontSize:24}}>已保留完整表达</div>
    </div>
   </div>
  </div>
  <div data-editable-object="timeline" style={{...at(rowX,632,trackWidth,280),opacity:b,transform:`translateY(${(1-b)*24}px)`}}>
   <div style={{color:muted,fontSize:20,marginBottom:22}}>时间线 <span style={{float:'right',fontSize:17}}>画面 / 声音</span></div>
   <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:muted,...mono,marginBottom:12}}>{['00:00','00:02','00:04','00:06','00:08'].map(t=><span key={t}>{t}</span>)}</div>
   <div style={{opacity:1-c}}>{[0,1].map(row=><div key={row} style={{...at(0,70+row*83,trackWidth,66),display:'flex',gap:5}}>{tokens.map((t,i)=><div key={i} style={{flex:1,borderRadius:6,background:row?'#233337':'#313d34',border:`1px solid ${row?'#395057':'#536345'}`,position:'relative',overflow:'hidden',transform:`translateX(${(1-p(f,align+i*3,aligned+8))*(i%2?20:-20)}px)`}}>{row?<svg width="100%" height="64" viewBox="0 0 250 64">{Array.from({length:40},(_,j)=>{const h=7+Math.abs(Math.sin(j*1.12+i*2.4)*Math.cos(j*.31))*34;return <rect key={j} x={j*6.3} y={32-h/2} width={2.5} height={h} rx={1} fill={accent} opacity={.75}/>;})}</svg>:<span style={{position:'absolute',left:18,top:19,fontSize:22}}>{t}</span>}</div>)}</div>)}</div>
   <div style={{opacity:c}}>{[0,1].map(row=><div key={row} style={{...at(0,70+row*83,trackWidth,66)}}>
    {[{x:0,w:cutX-5,label:'保留 A',kind:'keep'},{x:cutX,w:removeWidth-5,label:'重复口播',kind:'remove'},{x:tailX,w:trackWidth-650,label:'保留 B',kind:'keep'}].map((part,i)=><div key={i} style={{...at(part.x,0,Math.max(0,part.w),66),overflow:'hidden',borderRadius:6,background:part.kind==='remove'?'#4A3333':row?'#233337':'#313d34',border:part.w>3?`1px solid ${part.kind==='remove'?'#AD6B64':row?'#395057':'#536345'}`:'none',opacity:part.kind==='remove'?1-e:1}}>{row?<svg width="400" height="64" viewBox="0 0 400 64">{Array.from({length:60},(_,j)=>{const h=8+Math.abs(Math.sin(j*.92+i)*Math.cos(j*.38))*36;return <rect key={j} x={j*6.5} y={32-h/2} width={2.5} height={h} fill={part.kind==='remove'?'#F3A99D':accent}/>;})}</svg>:<span style={{whiteSpace:'nowrap',position:'absolute',left:20,top:20,fontSize:21}}>{part.label}</span>}</div>)}
   </div>)}</div>
   <div style={{...at(mix(15,350,p(f,aligned,edit)),54,2,187),background:accent,opacity:1-c}}><div style={{...at(-5,-3,12,8),background:accent,clipPath:'polygon(0 0,100% 0,50% 100%)'}}/></div>
   <div style={{...at(cutX-1,64,2,176),background:accent,opacity:e}}/>
   <div style={{...at(0,251,trackWidth),fontSize:23,color:accent,opacity:p(f,sync-4,sync+10)}}>✓ 同时删除　　✓ 同步收拢　　✓ 音画保持对齐</div>
  </div>
 </AbsoluteFill>;
}
