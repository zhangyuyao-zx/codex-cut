import {type CSSProperties,type ReactNode} from 'react';
import {useComponentRuntimeClock,runtimeFontFamily,runtimeTextColor,runtimeFontSize} from "../../components/component-runtime-context.js";
import type {ExplainerId} from './explainer-definitions.js';
export interface ExplainerProps {
 coreId:ExplainerId;platform?:string;text?:string;replacement?:string;lines?:string;value?:number;values?:number[];
 startFrame?:number;transitionFrames?:number;stepFrames?:number;cueFrames?:number[];
 accentColor?:string;foregroundColor?:string;fontSize?:number;reducedMotion?:boolean;
 content?:ReactNode;media?:ReactNode[];fromScene?:ReactNode;toScene?:ReactNode;focusX?:number;focusY?:number;zoom?:number;
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const absolute:CSSProperties={position:'absolute',inset:0};
const box=(x:number,y:number,w:number,h:number):CSSProperties=>({position:'absolute',left:x,top:y,width:w,height:h});
/** All motion depends solely on the current frame. No timers, effects, CSS transitions or remote assets. */
export function ExplainerCore(p:ExplainerProps):ReactNode{
 const {frame,fps}=useComponentRuntimeClock();
 const start=p.startFrame??15,duration=p.transitionFrames??36,step=p.stepFrames??30;
 const progress=(at=start)=>p.reducedMotion?(frame>=at?1:0):ease((frame-at)/duration);
 const t=progress(),color=p.accentColor??'#5DDFBF',ink=p.foregroundColor??'#F5F5F7',size=p.fontSize??72;
 const lines=(p.lines??'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,10);
 const cue=(i:number)=>p.cueFrames?.[i]??start+i*step;
 const active=Math.max(-1,lines.reduce((a,_,i)=>frame>=cue(i)?i:a,-1));
 const text=(value:ReactNode,x:number,y:number,font=size,style:CSSProperties={})=><div style={{...box(x,y,1600,230),fontSize:runtimeFontSize(font),lineHeight:1.18,...style}}>{value}</div>;
 const slot=(content:ReactNode,style:CSSProperties={})=><div style={{...absolute,overflow:'hidden',...style}}>{content}</div>;
 const center=(content:ReactNode,style:CSSProperties={})=><div style={{...absolute,display:'flex',alignItems:'center',justifyContent:'center',...style}}>{content}</div>;
 const listText=(line:string,i:number,x:number,y:number,style:CSSProperties={})=>text(line,x,y,size,{opacity:frame>=cue(i)?1:0,transform:`translateY(${(1-progress(cue(i)))*35}px)`,...style});
 let result:ReactNode=null;
 const id=p.coreId;
 if(id==='title-demote-to-label')result=text(p.text,mix(350,110,t),mix(420,95,t),size,{transformOrigin:'top left',transform:`scale(${mix(1.65,0.65,t)})`});
 else if(id==='error-retype'){
  const old=Array.from(p.text??''),next=Array.from(p.replacement??'');
  const phase=clamp((frame-start)/duration*2);
  const value=frame<start?p.text:phase<1?old.slice(0,Math.ceil(old.length*(1-phase))).join(''):next.slice(0,Math.floor(next.length*clamp((frame-start-duration/2)/(duration/2)))).join('');
  result=center(<span>{value}<span style={{color}}>│</span></span>);
 }else if(id==='strike-and-replace')result=<>{text(p.text,180,330,size,{opacity:1-t*.65})}<div style={{...box(170,375,Math.min(1500,(p.text?.length??1)*size),5),background:color,transformOrigin:'left',transform:`scaleX(${progress()})`}}/>{text(p.replacement,180,530,size,{opacity:progress(start+duration),transform:`translateY(${(1-progress(start+duration))*24}px)`})}</>;
 else if(id==='tracking-in')result=center(<span style={{letterSpacing:(1-t)*35,opacity:t,whiteSpace:'pre-wrap',maxWidth:1650}}>{p.text}</span>);
 else if(id==='type-contrast-emphasis')result=center(<span style={{maxWidth:1600,fontWeight:mix(350,850,t),color:t>.6?color:ink,fontSize:runtimeFontSize(size*mix(1,1.25,t))}}>{p.text}</span>);
 else if(id==='count-badge-title')result=center(<div style={{display:'flex',gap:45,alignItems:'center'}}><span style={{border:`3px solid ${color}`,borderRadius:100,padding:'20px 40px',color,transform:`scale(${mix(.3,1,t)})`}}>{p.value}</span><span>{p.text}</span></div>);
 else if(id==='quote-hold-arrow')result=<>{text('“',120,200,200,{color})}{text(p.text,270,350,size,{width:1250})}<svg viewBox="0 0 1920 1080" style={absolute}><path d="M 1580 460 Q 1700 460 1700 650 L 1530 650 M 1555 625 L 1530 650 L 1555 675" fill="none" stroke={color} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1-t}/></svg></>;
 else if(id==='social-follow-card')result=center(<div style={{display:'flex',gap:45,alignItems:'center',opacity:t}}><div style={{border:`3px solid ${color}`,borderRadius:'50%',width:120,height:120,display:'grid',placeItems:'center',color}}>{p.platform==='X'?'𝕏':p.platform==='抖音'?'♪':p.platform==='订阅'?'▶':Array.from(p.text??'')[0]}</div><span>{p.text}</span><div style={{padding:'22px 42px',borderRadius:15,background:color,color:'#081018',fontSize:runtimeFontSize(size*.7)}}>{p.replacement}</div></div>);
 else if(id==='word-slot-cycle'){
  const i=Math.max(0,active),q=progress(cue(i));
  result=<>{text(p.text,180,200,size*.6,{opacity:.6})}{center(<div style={{height:160,overflow:'hidden',minWidth:800}}><div style={{color,opacity:active>=0?1:0,transform:`translateY(${(1-q)*160}px)`}}>{lines[i]}</div></div>)}</>;
 }else if(id==='lead-word-zoom-assemble'||id==='alt-block-lines'||id==='chapter-progress-list'||id==='chip-grid-single-select')result=<>{text(p.text,120,80,size*.65)}{lines.map((line,i)=>{
  const q=progress(cue(i)),selected=i===active;
  if(id==='chip-grid-single-select')return <div key={i} style={{...box(150+(i%3)*540,290+Math.floor(i/3)*180,490,130),display:'grid',placeItems:'center',fontSize:runtimeFontSize(size*.65),border:`2px solid ${selected?color:'#637078'}`,borderRadius:60,color:selected?'#081018':ink,background:selected?color:'transparent'}}>{line}</div>;
  if(id==='chapter-progress-list')return <div key={i}>{listText(`${String(i+1).padStart(2,'0')}  ${line}`,i,200,240+i*76,{fontSize:runtimeFontSize(size*.72),opacity:frame>=cue(i)?selected?1:.4:.15,color:selected?color:ink})}</div>;
  return <div key={i} style={{...box(180+(id==='alt-block-lines'&&i%2?200:0),210+i*100,1480,95),opacity:frame>=cue(i)?1:0,transformOrigin:'left center',transform:id==='lead-word-zoom-assemble'?`translate(${(1-q)*150}px,${(1-q)*80}px) scale(${mix(2.2,1,q)})`:undefined,fontSize:runtimeFontSize(size*.8),background:id==='alt-block-lines'?i%2?color:'#E8EDF0':'transparent',color:id==='alt-block-lines'?'#081018':i===0?color:ink,paddingLeft:20}}>{line}</div>;
 })}</>;
 else if(id==='danmu-bubble-praise'||id==='flying-words')result=<>{lines.map((line,i)=>{
  const age=Math.max(0,frame-cue(i)),q=p.reducedMotion?.5:clamp(age/Math.max(80,duration*4));
  return <div key={i} style={{...box(id==='danmu-bubble-praise'?170+(i%3)*500:960+Math.sin(i*2.3)*mix(100,850,q),id==='danmu-bubble-praise'?850-q*700-(i%3)*100:460+Math.cos(i*2.3)*mix(80,430,q),700,130),fontSize:runtimeFontSize(size*(id==='flying-words'?mix(.35,1.6,q):.55)),opacity:frame<cue(i)?0:Math.min(1,age/10)*(1-clamp((q-.85)/.15)),filter:id==='flying-words'?`blur(${(1-q)*2}px)`:undefined,color:i%2?ink:color,border:id==='danmu-bubble-praise'?`1px solid ${color}`:undefined,borderRadius:60,padding:20}}>{line}</div>;
 })}</>;
 else if(id==='source-converge'||id==='converging-arrows'||id==='map-route-pin'){
  const points=lines.map((_,i)=>({x:250+(i%2)*270,y:180+i*75}));
  result=<svg viewBox="0 0 1920 1080" style={absolute}>{lines.map((line,i)=>{
   const a=points[i]!,q=progress(cue(i));
   const bx=id==='map-route-pin'?380+i*280:1420,by=id==='map-route-pin'?540+Math.sin(i)*180:530;
   return <g key={i} opacity={frame>=cue(i)?1:0}><path d={`M ${a.x} ${a.y} Q 900 ${a.y} ${bx} ${by}`} fill="none" stroke={color} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1-q}/><circle cx={mix(a.x,bx,q)} cy={mix(a.y,by,q)} r={id==='map-route-pin'?14:6} fill={color}/><text x={id==='source-converge'?mix(a.x,bx-250,q):a.x} y={id==='source-converge'?mix(a.y,400+i*70,q):a.y-20} fill={ink} fontSize={size*.6}>{line}</text></g>;
 })}<text x={1150} y={780} fill={color} fontSize={size}>{p.text}</text></svg>;
 }else if(id==='countdown-arc-scatter'){
  const value=Math.max(0,Math.round(p.value??5)),remaining=Math.max(0,value-Math.floor(Math.max(0,frame-start)/fps));
  result=<svg viewBox="0 0 1920 1080" style={absolute}><text x={960} y={540} fill={color} fontSize={size*2} textAnchor="middle" opacity={t}>{remaining}</text><circle cx={960} cy={490} r={250} fill="none" stroke={color} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1-remaining/Math.max(1,value)} transform="rotate(-90 960 490)"/>{Array.from({length:Math.min(12,value+1)},(_,i)=><text key={i} x={960+Math.sin(i)*mix(430,0,t)} y={540+Math.cos(i)*mix(330,0,t)} fill={color} fontSize={size*2} opacity={1-t} textAnchor="middle">{i}</text>)}<text x={960} y={880} textAnchor="middle" fill={ink} fontSize={size*.65}>{p.text}</text></svg>;
 }else if(id==='metric-with-sparkline'){
  const values=p.values??[],min=Math.min(...values),span=Math.max(1,Math.max(...values)-min);
  const d=values.map((v,i)=>`${i?'L':'M'} ${260+i*1400/Math.max(1,values.length-1)} ${770-(v-min)/span*200}`).join(' ');
  result=<>{text(p.text,180,130,size*.65)}{text(Math.round((p.value??0)*t),180,270,size*2,{color})}<svg viewBox="0 0 1920 1080" style={absolute}><path d={d} fill="none" stroke={color} strokeWidth={7} pathLength={1} strokeDasharray={1} strokeDashoffset={1-t}/></svg></>;
 }
 else if(['ui-prop-theater','ui-flow-theater','glass-code-walk'].includes(id))result=<>{text(p.text,120,90,size*.6)}{lines.map((line,i)=>{
  const q=progress(cue(i)),selected=i===active;
  return <div key={i} style={{...box(id==='ui-flow-theater'?200+(i%3)*520:260+i*35,id==='ui-flow-theater'?310+Math.floor(i/3)*210:230+i*110, id==='ui-flow-theater'?430:1280,95),border:`1px solid ${selected?color:'#4F6068'}`,borderRadius:16,padding:22,fontSize:runtimeFontSize(size*.5),opacity:frame>=cue(i)?1:0,background:'rgba(18,28,34,.82)',transform:id==='glass-code-walk'?`perspective(1500px) rotateY(${mix(24,-8,q)}deg) translateX(${(1-q)*150}px)`:id==='ui-prop-theater'?`translateY(${(1-q)*120}px) scale(${mix(.6,1,q)})`:undefined,color:selected?color:ink}}>{id==='glass-code-walk'?`${i+1}  `:''}{line}</div>;
 })}{id==='ui-flow-theater'&&active>=0?<svg viewBox="0 0 1920 1080" style={absolute}><path d={`M ${560+(active%3)*520} ${450+Math.floor(active/3)*210} l 0 55 20 -12 12 25 15 -7 -13 -23 23 -3 z`} fill={color}/></svg>:null}</>;
 else if(['lower-third-nameplate','chevron-lower-third'].includes(id))result=<div style={{...box(110,770,1450,210),opacity:t,transform:`translateX(${(1-t)*-450}px)`,background:'rgba(8,16,24,.88)',clipPath:id==='chevron-lower-third'?'polygon(0 0,94% 0,100% 50%,94% 100%,0 100%,4% 50%)':undefined,borderLeft:`8px solid ${color}`,padding:'25px 90px'}}><div style={{fontSize:runtimeFontSize(size)}}>{p.text}</div><div style={{fontSize:runtimeFontSize(size*.45),color,marginTop:15}}>{p.replacement}</div></div>;
 else if(['chapter-title-card','outline-box-title','corner-bracket-frame','info-term-card','quote-card','quote-bracket-pull','number-slab-pop','impact-open-title','slab-punch-title','speed-slab-title','color-slam-beat-card'].includes(id)){
  const border=id==='outline-box-title';
  const impact=['impact-open-title','slab-punch-title','number-slab-pop'].includes(id);
  result=<>{id==='corner-bracket-frame'||id==='quote-bracket-pull'?<svg viewBox="0 0 1920 1080" style={absolute}><path d={id==='corner-bracket-frame'?'M 160 330 V 220 H 300 M 1620 220 H 1760 V 330 M 1760 710 V 820 H 1620 M 300 820 H 160 V 710':'M 300 220 H 160 V 820 H 300 M 1620 220 H 1760 V 820 H 1620'} fill="none" stroke={color} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1-t}/></svg>:null}{id==='color-slam-beat-card'?<div style={{...absolute,background:color,transform:`translateY(${(1-t)*1080}px)`}}/>:null}<div style={{...box(160,220,1600,600),display:'flex',flexDirection:'column',justifyContent:'center',padding:70,boxSizing:'border-box',opacity:t,transform:id==='chapter-title-card'?`perspective(1600px) rotateX(${(1-t)*65}deg)`:impact?`scale(${mix(1.7,1,t)})`:id==='speed-slab-title'?`translateX(${(1-t)*-1500}px) skewX(${-8*(1-t)}deg)`:undefined,border:border?`3px solid ${color}`:undefined,background:id==='number-slab-pop'?'rgba(120,145,150,.12)':'transparent'}}>
  {id==='chapter-title-card'?<div style={{fontSize:runtimeFontSize(size*.45),color,marginBottom:30}}>CHAPTER</div>:null}
  {['quote-card','quote-bracket-pull'].includes(id)?<span style={{color,fontSize:runtimeFontSize(150),height:120}}>“</span>:null}
  <div style={{fontSize:runtimeFontSize(id==='number-slab-pop'?size*2:size),color:ink,overflowWrap:'anywhere'}}>{id==='number-slab-pop'?p.value:p.text}</div>
  {p.replacement?<div style={{fontSize:runtimeFontSize(size*.5),marginTop:35,color}}>{p.replacement}</div>:null}
  {id==='number-slab-pop'?<div style={{fontSize:runtimeFontSize(size*.5),color}}>{p.text}</div>:null}
  </div></>;
 }else if(['highlighter-sweep','ink-underline','hand-drawn-ellipse','keyword-pop-highlight','pencil-sketch-draw','per-character-rise','soft-blur-in'].includes(id)){
  const label=p.text??'',width=Math.min(1550,Array.from(label).length*size),x=180,y=430;
  const term=p.replacement??'',at=term?label.indexOf(term):-1;
  result=<><div style={{...box(x,y,1600,250),fontSize:runtimeFontSize(size),filter:id==='soft-blur-in'?`blur(${(1-t)*20}px)`:undefined,opacity:id==='soft-blur-in'?t:1}}>
  {id==='highlighter-sweep'?<div style={{...box(-8,0,width+16,size*1.18),background:color,opacity:.3,transformOrigin:'left',transform:`scaleX(${t})`}}/>:null}
  {id==='per-character-rise'?Array.from(label).map((char,i)=><span key={i} style={{display:'inline-block',opacity:progress(start+i*3),transform:`translateY(${(1-progress(start+i*3))*100}px)`}}>{char===' '?' ':char}</span>):id==='keyword-pop-highlight'&&at>=0?<>{label.slice(0,at)}<span style={{color:t>.2?color:ink,display:'inline-block',transform:`scale(${1+Math.sin(t*Math.PI)*.25})`,fontWeight:800}}>{term}</span>{label.slice(at+term.length)}</>:label}
  </div>{['ink-underline','hand-drawn-ellipse','pencil-sketch-draw'].includes(id)?<svg viewBox="0 0 1920 1080" style={absolute}><path d={id==='hand-drawn-ellipse'?`M ${x-20} ${y+40} C ${x} ${y-55} ${x+width} ${y-55} ${x+width+25} ${y+40} C ${x+width} ${y+135} ${x} ${y+135} ${x-20} ${y+40}`:`M ${x} ${y+size*1.3} Q ${x+width*.35} ${y+size*1.3+8} ${x+width} ${y+size*1.3-3}`} fill="none" stroke={color} strokeWidth={id==='pencil-sketch-draw'?3:6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1-t}/></svg>:null}</>;
 }else if(['line-by-line-slide','split-text-stagger','info-card-assemble'].includes(id))result=<>{text(p.text,140,90,size*.6)}{lines.map((line,i)=><div key={i} style={{...box(170,240+i*130,1550,110),overflow:'hidden',borderBottom:id==='info-card-assemble'?`1px solid ${color}`:undefined}}><div style={{fontSize:runtimeFontSize(size*.8),opacity:frame>=cue(i)?1:0,transform:id==='split-text-stagger'?`translateY(${(1-progress(cue(i)))*120}px)`:`translateX(${(1-progress(cue(i)))*-600}px)`}}>{line}</div></div>)}</>;
 else if(id.endsWith('-transition')){
  const q=t,a=p.fromScene??p.media?.[0],b=p.toScene??p.media?.[1];
  if(id==='caret-wipe-transition')result=<>{slot(a)}{slot(b,{clipPath:`inset(0 ${100*(1-q)}% 0 0)`})}<div style={{...box(1920*q,0,8,1080),background:color,opacity:q>0&&q<1?1:0}}/></>;
  else if(id==='line-carry-transition')result=<>{slot(a,{opacity:1-q})}{slot(b,{clipPath:`inset(${50*(1-q)}% 0)`})}<div style={{...box(0,540,1920,4),background:color,transform:`scaleX(${Math.sin(q*Math.PI)})`}}/></>;
  else if(id==='overexpose-flip-transition')result=<>{slot(q<.5?a:b,{transform:`perspective(2000px) rotateY(${q<.5?q*180:(q-1)*180}deg)`,filter:`brightness(${1+Math.sin(q*Math.PI)*3})`})}<div style={{...absolute,background:'#fff',opacity:Math.pow(Math.sin(q*Math.PI),8)*.8}}/></>;
  else if(id==='black-slam-transition')result=<>{slot(q<.5?a:b,{transform:`scale(${1+Math.sin(q*Math.PI)*.15})`})}<div style={{...absolute,background:'#000',opacity:q>.35&&q<.65?1:0}}/></>;
  else if(id==='push-through-transition')result=<>{slot(a,{transform:`scale(${1+q*2})`,opacity:1-q,filter:`blur(${q*10}px)`})}{slot(b,{transform:`scale(${mix(.75,1,q)})`,opacity:q})}</>;
  else if(id==='pullback-cool-transition')result=<>{slot(a,{transform:`scale(${mix(1,.75,q)})`,opacity:1-q,filter:`saturate(${1-q*.5})`})}{slot(b,{opacity:q})}<div style={{...absolute,background:'#245FB0',opacity:Math.sin(q*Math.PI)*.2}}/></>;
  else if(id==='particle-weld-transition')result=<>{slot(a,{opacity:1-q})}{slot(b,{opacity:q})}<svg viewBox="0 0 1920 1080" style={absolute}>{Array.from({length:64},(_,i)=><circle key={i} cx={mix((i%8)*270,960,q)} cy={mix(Math.floor(i/8)*150,540,q)} r={Math.sin(q*Math.PI)*10} fill={color}/>)}</svg></>;
  else result=<>{slot(a,{transform:`translateX(${-q*1920}px)`,filter:`blur(${Math.sin(q*Math.PI)*18}px)`})}{slot(b,{transform:`translateX(${(1-q)*1920}px)`,filter:`blur(${Math.sin(q*Math.PI)*18}px)`})}</>;
 }else{
  const media=(p.media??[]).slice(0,['rack-focus-pair','behind-text-title','still-layout-relay','gooey-morph'].includes(id)?2:id==='word-relay-filmstrip'?lines.length:8),source=p.content??media[0],second=media[1];
  const fx=(p.focusX??65)/100,fy=(p.focusY??42)/100,z=p.zoom??1.7;
  if(['slow-push-in','slow-pull-reveal','crash-zoom-punch','orbit-drift','sway-parallax','media-pop-in'].includes(id)){
   const scale=id==='slow-pull-reveal'?mix(z,1,t):id==='media-pop-in'?mix(.5,1,t):mix(1,z,id==='crash-zoom-punch'?ease(t*3):t);
   result=slot(source,{transformOrigin:`${fx*100}% ${fy*100}%`,transform:`translate(${!p.reducedMotion&&id==='orbit-drift'?Math.sin(frame/75)*25:!p.reducedMotion&&id==='sway-parallax'?Math.sin(frame/60)*16:0}px,${!p.reducedMotion&&id==='orbit-drift'?Math.cos(frame/75)*15:0}px) scale(${scale})`,opacity:id==='media-pop-in'?t:1,filter:id==='crash-zoom-punch'?`blur(${Math.sin(t*Math.PI)*5}px)`:undefined});
  }else if(id==='news-card-desk')result=<>{slot(source,{left:100,top:120,width:1050,height:700,right:'auto',bottom:'auto',transform:`perspective(2000px) rotateY(${mix(8,0,t)}deg)`,opacity:t})}{text(p.text,1230,200,size*.75,{width:570})}{text(p.replacement,1230,650,size*.4,{width:550,color})}</>;
  else if(id==='pip-zoom-box')result=<>{slot(source)}<div style={{...box(1100,100,720,500),border:`4px solid ${color}`,overflow:'hidden',opacity:t}}><div style={{...box(-fx*1920*z+360,-fy*1080*z+250,1920*z,1080*z)}}>{source}</div></div></>;
  else if(['callout-line-label','scribble-annotation','scanline-annotate'].includes(id))result=<>{slot(source)}<svg viewBox="0 0 1920 1080" style={absolute}>{id==='scanline-annotate'?<>{lines.map((line,i)=><g key={i} opacity={frame>=cue(i)?1:0}><path d={`M 180 ${250+i*120} L 1660 ${250+i*120}`} stroke={color} strokeWidth={2}/><text x={200} y={230+i*120} fill={color} fontSize={size*.6}>{line}</text></g>)}<path d={`M 150 ${150+t*800} L 1750 ${150+t*800}`} stroke={color} strokeWidth={5}/></>:<><path d={`M ${fx*1920} ${fy*1080} Q 1250 250 1540 260 L 1750 260`} fill="none" stroke={color} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1-t}/><circle cx={fx*1920} cy={fy*1080} r={18} stroke={color} fill="none" strokeWidth={5}/>{id==='callout-line-label'?<text x={1320} y={220} fill={ink} fontSize={size*.7} opacity={t}>{p.text}</text>:null}</>}</svg></>;
  else if(id==='bed-echo-blur')result=<>{slot(source,{filter:'blur(35px)',transform:'scale(1.2)',opacity:.5})}{slot(source,{left:650,right:650})}</>;
  else if(id==='tilt-3d-page')result=slot(source,{inset:'100px 200px',transform:`perspective(1800px) rotateY(${mix(25,-12,t)}deg) rotateX(${mix(8,-5,t)}deg)`,borderRadius:16});
  else if(id==='behind-text-title')result=<>{slot(media[0])}{text(p.text,180,300,size*2,{color,opacity:t})}{slot(second)}</>;
  else if(id==='rack-focus-pair')result=<>{slot(media[0],{right:'50%',filter:`blur(${t*14}px)`,transform:`scale(${mix(1.05,1,t)})`})}{slot(second,{left:'50%',filter:`blur(${(1-t)*14}px)`,transform:`scale(${mix(1,1.05,t)})`})}</>;
  else if(id==='host-shrink-to-chip')result=<div style={{...box(mix(0,1300,t),mix(0,710,t),mix(1920,480,t),mix(1080,270,t)),overflow:'hidden',borderRadius:24*t}}>{slot(source)}</div>;
  else if(id==='host-card-glass-board'||id==='parallel-items-with-host'||id==='doc-park-left-pill-deal'||id==='split-60-40-story')result=<>{slot(source,{left:90,top:90,width:700,height:900,right:'auto',bottom:'auto',transform:`scale(${mix(1.08,1,t)})`,borderRadius:18})}{lines.map((line,i)=><div key={i} style={{...box(900,150+i*180,850,130),padding:25,fontSize:runtimeFontSize(size*.64),opacity:frame>=cue(i)?1:0,transform:`translateX(${(1-progress(cue(i)))*150}px)`,background:id==='host-card-glass-board'?'rgba(180,220,230,.10)':'transparent',border:id==='host-card-glass-board'?'1px solid rgba(220,240,250,.35)':undefined,borderRadius:18,color:i===active?color:ink}}>{line}</div>)}</>;
  else if(id==='cursor-actor-demo'||id==='cursor-locked-zoom'||id==='reticle-lock-on'||id==='magnifier-detail'){
   const x=mix(.15,fx,t),y=mix(.75,fy,t),zoom=id==='cursor-locked-zoom'?mix(1,z,t):1;
   result=<>{slot(source,{transformOrigin:`${x*100}% ${y*100}%`,transform:`scale(${zoom})`})}{id==='magnifier-detail'?<div style={{...box(fx*1920-220,fy*1080-220,440,440),border:`5px solid ${color}`,borderRadius:'50%',overflow:'hidden'}}><div style={{...box(-fx*1920*z+220,-fy*1080*z+220,1920*z,1080*z)}}>{source}</div></div>:<svg viewBox="0 0 1920 1080" style={absolute}>{id==='reticle-lock-on'?<g transform={`translate(${x*1920} ${y*1080}) scale(${mix(2,1,t)})`} stroke={color} strokeWidth={4} fill="none"><path d="M -120 -70 L -120 -110 -70 -110 M 70 -110 L 120 -110 120 -70 M 120 70 L 120 110 70 110 M -70 110 L -120 110 -120 70 M -20 0 L 20 0 M 0 -20 L 0 20"/></g>:<g transform={`translate(${x*1920} ${y*1080})`}><circle r={15+clamp((frame-start-duration)/20)*65} fill="none" stroke={color} strokeWidth={4} opacity={frame>=start+duration?1-clamp((frame-start-duration)/20):0}/><path d="M 0 0 L 0 62 17 47 15 26 17 -8 -17 -25 29 -3 Z" fill={ink} stroke="#182329" strokeWidth={3}/></g>}</svg>}</>;
  }else if(id==='evidence-scroll-tour')result=slot(source,{height:1620,top:-540*t,bottom:'auto'});
  else if(id==='still-layout-relay')result=<>{slot(media[0],{width:mix(1920,720,t),height:mix(1080,405,t),left:mix(0,110,t),top:mix(0,320,t),right:'auto',bottom:'auto'})}{slot(second,{width:mix(480,850,t),height:mix(270,600,t),left:mix(1500,970,t),top:mix(800,250,t),opacity:t,right:'auto',bottom:'auto'})}</>;
  else if(id==='grid-to-hero'||id==='gallery-wall-dolly'||id==='filmstrip-conveyor'||id==='word-relay-filmstrip'||id==='long-take-world'||id==='gooey-morph'){
   const n=media.length,travel=Math.max(0,n-1)*t;
   result=<>{media.map((item,i)=>{
    let style:CSSProperties={};
    if(id==='grid-to-hero')style={...box(mix(120+(i%3)*560,i===0?120:2100,t),mix(160+Math.floor(i/3)*330,110,t),mix(510,1680,t),mix(287,860,t)),opacity:i===0?1:1-t};
    if(id==='gallery-wall-dolly')style={...box(120+(i%3)*570-travel*100,120+Math.floor(i/3)*370,530,310),transform:`perspective(2000px) rotateY(${mix(18,0,t)}deg) scale(${mix(1.3,1,t)})`};
    if(id==='filmstrip-conveyor')style={...box(680+(i-travel)*680,290,620,420),borderTop:`25px dashed ${ink}`,borderBottom:`25px dashed ${ink}`,transform:`scale(${1-.18*Math.min(1,Math.abs(i-travel))})`};
    if(id==='word-relay-filmstrip')style={...box(150+(i-(active<=0?0:active-1+progress(cue(active))))*1620,170,1500,660),opacity:active<0?0:1};
    if(id==='long-take-world')style={...box(200+(i-travel)*1580,170+Math.sin(i)*70,1400,730),transform:`perspective(2000px) rotateY(${Math.max(-20,Math.min(20,(i-travel)*12))}deg)`};
    if(id==='gooey-morph')style={...box(mix(170+i*950,640+i*45,t),mix(250,300+i*20,t),mix(760,620,t),mix(520,450,t)),borderRadius:`${mix(15,50,t)}%`,filter:`blur(${Math.sin(t*Math.PI)*9}px)`,opacity:1-i*t*.4};
    return <div key={i} style={{...style,overflow:'hidden'}}>{slot(item)}{id==='word-relay-filmstrip'?text(lines[i]??'',50,530,size,{color}):null}</div>;
   })}</>;
  }
 }
 if(result===null)throw Error(`No explainer implementation for ${id}`);
 return <div data-explainer-core={id} style={{...absolute,color:runtimeTextColor(ink),fontFamily:runtimeFontFamily('Arial, sans-serif'),fontSize:runtimeFontSize(size),overflow:'hidden'}}>{result}</div>;
}
