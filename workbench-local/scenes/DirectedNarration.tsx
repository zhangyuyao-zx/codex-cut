import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate, Easing} from 'remotion';
import type {SceneModuleInput} from '../SceneModuleSurface';
const ease = Easing.bezier(.22,1,.36,1);
const pos=(left:number,top:number,width?:number,height?:number):React.CSSProperties=>({position:'absolute',left,top,width,height});
const blend=(a:number,b:number,t:number)=>a+(b-a)*t;
export function DirectedNarration({id,parameters:v,beats,mediaSrc,materials,from}:SceneModuleInput){
 const f=useCurrentFrame(), n=Number(id.split('-').at(-1));
 const bg=String(v.background),ink=String(v.textColor),accent=String(v.accent),muted='#a9b5ad',scale=Number(v.typeScale);
 const words=String(v.labels).split('|');
 const cue=(i:number)=>{const b=beats.find(b=>b.wordId==='dji-word-'+i);if(!b)throw Error('Missing directed cue '+i);return b.frame;};
 const ramp=(a:number,b:number)=>interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});
 const p=(i:number,d=10)=>ramp(cue(i),cue(i)+d);
 const reveal=(i:number,d=10):React.CSSProperties=>({opacity:p(i,d),transform:`translateY(${18*(1-p(i,d))}px)`});
 const src=(s:string)=>s.startsWith('/')?s:staticFile(s);
 const fullPerson=()=> <div data-editable-object="person" style={{...pos(0,0,1920,1080),transform:`translate(${Number(v.personX)}px,${Number(v.personY)}px) scale(${Number(v.personScale)})`}}><OffthreadVideo src={src(mediaSrc)} trimBefore={from} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></div>;
 const shade=(opacity=1)=><AbsoluteFill style={{pointerEvents:'none',opacity,background:'linear-gradient(90deg,rgba(0,0,0,.44),transparent 43%)'}}/>;
 const eyebrow=(t:string)=><div style={{...pos(110,100),fontSize:27,color:muted}}>{t}</div>;
 let body:React.ReactNode;
 if(n===1){
  const cues=[23,28,31,36];let active=-1;cues.forEach((i,j)=>{if(f>=cue(i))active=j;});
  body=<>{fullPerson()}{shade(p(23))}<div data-editable-object="graphics" style={pos(95,254,675)}>{words.map((t,i)=><div key={i} style={{...reveal(cues[i]),fontSize:(i===3?64:55)*scale,lineHeight:1.25,marginBottom:54,color:active===i?accent:ink,opacity:p(cues[i])*(active===i?1:.75)}}>{t}</div>)}</div></>;
 }else if(n===2){
  body=<>{eyebrow('一个解决方案')}<div data-editable-object="headline" style={{...pos(110,352,1700),textAlign:'center'}}><div style={{...reveal(49,8),fontSize:172*scale,fontWeight:600,letterSpacing:-7}}>Codex Cut</div><div style={{...reveal(52,8),fontSize:62*scale,color:accent,marginTop:34}}>{String(v.headline)}</div></div></>;
 }else if(n===4){
  body=<>{fullPerson()}{shade(p(124))}<div data-editable-object="headline" style={{...pos(105,245,650),...reveal(124),fontSize:74*scale,lineHeight:1.45}}>{words[0]}<br/><span style={{fontSize:98*scale,color:accent}}>{words[1]}</span></div></>;
 }else if(n===5){body=fullPerson();
 }else if(n===6){
  body=<>{eyebrow('文字表达示意')}<div data-editable-object="headline" style={pos(210,350,1500)}><div style={{...reveal(142,6),fontSize:125*scale}}>{words[0]}</div><div style={{...reveal(145,6),fontSize:166*scale,color:accent,marginTop:34}}>{words[1]}</div></div></>;
 }else if(n===7){
  const compact=p(156,6),current=f>=cue(161)?3:f>=cue(158)?2:f>=cue(156)?1:0;
  const material=materials.find(m=>m.kind==='video');
  body=<>{eyebrow('不同信息，使用不同载体')}<div data-editable-object="headline" style={{...pos(110,178,1700),fontSize:82*scale}}>{String(v.headline)}</div><div data-editable-object="graphics">
   <div style={{...pos(blend(480,110,compact),blend(345,455,compact),blend(960,380,compact),330),textAlign:'center',opacity:p(153,6)*(current===0?1:.72)}}><div style={{fontSize:blend(42,23,compact),color:muted,marginBottom:18}}>1 分钟 × 60 fps</div><div style={{fontSize:blend(254,86,compact)*scale,color:accent,fontWeight:600,lineHeight:1.13}}>3,600</div><div style={{fontSize:blend(51,28,compact),marginTop:19}}>张画面</div></div>
   {[0,1,2,3].map(i=><div key={i} style={{...pos(110+i*440,385),fontSize:34,color:current===i?accent:muted,opacity:i===0?compact:p([153,156,158,161][i],6)}}>{words[i]}</div>)}
   <div style={{...pos(550,455,380,330),...reveal(156,6),opacity:p(156,6)*(current===1?1:.7),background:'#26352f',borderRadius:12,overflow:'hidden'}}><svg width="380" height="270" viewBox="0 0 380 270"><circle cx="302" cy="67" r="25" fill={accent}/><path d="M0 270L122 55 265 270M173 270L300 135 380 270" fill="#8d9c81"/></svg><div style={{padding:10,fontSize:21,color:muted,textAlign:'center'}}>原创图片示意</div></div>
   <div style={{...pos(990,455,380,330),...reveal(158,6),opacity:p(158,6)*(current===2?1:.75),background:'#25322b',borderRadius:12,overflow:'hidden'}}>{material?<Sequence from={cue(158)} layout="none"><OffthreadVideo src={src(material.src)} muted style={{width:380,height:270,objectFit:'contain'}}/></Sequence>:null}<div style={{...pos(20,285),fontSize:22,color:muted}}>本机工作台录屏</div></div>
   <div style={{...pos(1430,455,380,330),...reveal(161,6),background:'#2c392e',borderRadius:12,padding:26}}><div style={{fontSize:25,color:muted}}>AI 对话示意</div><div style={{fontSize:27,marginTop:26}}>这里强调什么？</div><div style={{fontSize:31,lineHeight:1.6,color:accent,marginTop:31}}>先找到重点，<br/>再决定画面。</div></div>
   <div style={{...pos(110,940),fontSize:21,color:muted,opacity:p(153,6)}}>数字与媒体表达示意</div>
  </div></>;
 }else if(n===8){
  const k=cue(191),bad=f>=k&&f<k+12,returning=f>=k?ramp(k+12,k+24):1;
  const move=bad?1:f>=k+12?1-returning:0;
  const visibility=p(189,8),boundary=p(196,6)*(1-ramp(cue(196)+18,cue(196)+28));
  body=<>{fullPerson()}{shade(visibility*(1-move))}<div data-editable-object="graphics" style={{...pos(blend(100,670,move),blend(256,230,move),720),opacity:visibility,background:move>.4?'#f2f0e9':'transparent',borderRadius:12,padding:move>.4?22:0,color:move>.4?'#202820':ink}}><div style={{fontSize:72*scale}}>{words[0]}</div><div style={{fontSize:86*scale,color:move>.4?'#202820':accent,marginTop:8}}>{words[1]}</div><div style={{fontSize:28,marginTop:32,color:bad?'#df8278':ink,opacity:f>=k?1:0}}>{bad?'× 遮挡人物 · 错误位置示意':'✓ 避开人物与动作'}</div></div><div style={{...pos(44,44,1832,992),border:`3px solid ${accent}`,borderRadius:8,opacity:boundary,pointerEvents:'none'}}/></>;
 }else if(n===9){
  const changed=p(209,6),adjust=p(211,8),gone=p(214,6);
  body=<>{fullPerson()}{shade(1-gone)}<div data-editable-object="graphics" style={{...pos(100,256,650),opacity:1-gone,transform:`scale(${1-adjust*.12})`,transformOrigin:'top left'}}><div style={{fontSize:72*scale}}>{changed>.5?words[0]:'让效果'}</div><div style={{fontSize:86*scale,marginTop:8,color:accent}}>{changed>.5?words[1]:'服务内容。'}</div><div style={{...pos(-22,-22,660,280),border:`3px solid ${accent}`,opacity:adjust*(1-gone)}}>{[[0,0],[660,0],[0,280],[660,280]].map(([x,y],i)=><div key={i} style={{...pos(x-7,y-7,14,14),background:accent}}/>)}</div></div></>;
 }else if(n===10){
  const lab=p(235,12),cues=[241,243,245,248,279];
  body=<>{eyebrow('组件筛选 · 流程说明')}<div data-editable-object="headline" style={{...pos(110,191,1700),fontSize:100*scale}}>{String(v.headline)}</div><div data-editable-object="graphics">
   <div style={{...pos(110,435,1700),opacity:1-lab}}><div style={{fontSize:60,marginBottom:48}}>收集的组件</div><div style={{display:'flex',alignItems:'center',gap:35}}>{['文字','信息','对比'].map(t=><div key={t} style={{padding:'28px 42px',background:'#2b362f',borderRadius:14,fontSize:38,color:accent}}>{t}</div>)}<span style={{fontSize:65,color:accent}}>→</span><span style={{fontSize:50}}>视觉实验室</span></div></div>
   <div style={{opacity:lab}}><div style={{...pos(110,387),fontSize:27,color:muted}}>运行、分类、适配与评审，缺一不可</div>{cues.map((c,i)=>{const active=p(c,10),x=110+i*350;return <React.Fragment key={c}>{i<4&&<svg style={pos(x+230,552,120,80)} viewBox="0 0 120 80"><path d="M0 40H104M94 31L107 40 94 49" fill="none" stroke="#46544a" strokeWidth="3"/><path d="M0 40H104" fill="none" stroke={accent} strokeWidth="4" pathLength={1} strokeDasharray={1} strokeDashoffset={1-p(cues[i+1],12)}/></svg>}<div style={{...pos(x,485,230,210),borderRadius:16,background:i===4&&active>.5?accent:'#29352d',display:'flex',justifyContent:'center',alignItems:'center',fontSize:(i===3?37:44)*scale,color:i===4&&active>.5?'#202820':active>.5?accent:muted,opacity:.45+.55*active}}>{words[i]}</div></React.Fragment>;})}<div style={{...pos(110,803),fontSize:45*scale,...reveal(279,6)}}>完成检查，才进入生产库。</div></div>
  </div></>;
 }else if(n===11){
  const vis=p(327,10)*(1-p(343,6));
  body=<>{fullPerson()}<AbsoluteFill style={{background:'linear-gradient(transparent 68%,rgba(0,0,0,.62))',opacity:vis}}/><div data-editable-object="headline" style={{...pos(110,871,1700),textAlign:'center',fontSize:78*scale,opacity:vis}}>{String(v.headline)}</div></>;
 }else if(n===12){
  body=<><div style={{...pos(110,245,1700),textAlign:'center',fontSize:44,color:muted}}>把更多时间留给</div><div data-editable-object="headline" style={{...pos(110,408,1700),display:'flex',alignItems:'baseline',justifyContent:'center',gap:60}}><span style={{...reveal(345,4),fontSize:200*scale,color:accent}}>{words[0]}</span><span style={{...reveal(348,4),fontSize:72}}>与</span><span style={{...reveal(348,4),fontSize:200*scale,color:accent}}>{words[1]}</span></div><div style={{...pos(110,880,1700),textAlign:'center',fontSize:34,color:muted}}>Codex Cut</div></>;
 }else{throw Error('Unknown directed scene '+id);}
 return <AbsoluteFill style={{background:bg,color:ink,fontFamily:'PingFang SC, sans-serif'}}>{body}</AbsoluteFill>;
}
