import React,{createContext,useContext,useEffect,useState} from 'react';
import {AbsoluteFill,useVideoConfig,delayRender,continueRender,cancelRender,Img} from 'remotion';
import tokens from './tokens.json';
import {at,clamp,mix,progress,easeOut,pop} from './motion.mjs';

const Theme=createContext(tokens);
export const useDots=()=>useContext(Theme);
// URLs are supplied by the caller (prefer literal staticFile references in its scene).
// No system-font fallback is silently used by the package.
export function Fonts({files,children}) {
  const [handle]=useState(()=>delayRender('dots fonts'));
  const key=JSON.stringify(files);
  useEffect(()=>{Promise.all(files.map(async ({family,src,weight})=>{
    const face=await new FontFace(family,`url(${JSON.stringify(src)})`,{weight:String(weight)}).load(); document.fonts.add(face);
  })).then(()=>continueRender(handle)).catch(cancelRender);},[handle,key]);
  return children;
}
export function Canvas({children,dark=false,theme={},dots=true}) {
  const {width,height}=useVideoConfig();
  const value={...tokens,...theme,color:{...tokens.color,...theme.color},font:{...tokens.font,...theme.font},size:{...tokens.size,...theme.size}};
  const cw=value.canvas.width,ch=value.canvas.height,scale=Math.min(width/cw,height/ch),bg=dark?value.color.ink:value.color.paper;
  return <Theme.Provider value={value}><AbsoluteFill style={{background:bg,overflow:'hidden'}}><div style={{...at((width-cw*scale)/2,(height-ch*scale)/2,cw,ch),transform:`scale(${scale})`,transformOrigin:'0 0',overflow:'hidden',color:dark?value.color.paper:value.color.ink,fontFamily:value.font.body}}>{dots&&<div style={{position:'absolute',inset:0,backgroundImage:`radial-gradient(circle,${dark?'#52565b55':'#afa99d66'} 1.15px,transparent 1.5px)`,backgroundSize:'32px 32px',backgroundPosition:'16px 16px'}}/>}{children}</div></AbsoluteFill></Theme.Provider>;
}
export function Type({children,role='body',color,style={},...rest}) {
  const t=useDots(),headline=role==='headline'||role==='cardTitle',meta=role==='meta';
  return <div {...rest} style={{fontFamily:meta?`${t.font.meta}, ${t.font.body}`:headline?t.font.headline:t.font.body,fontWeight:headline?900:meta?600:700,fontSize:t.size[role]??24,lineHeight:1.24,letterSpacing:meta?1:-.8,color,whiteSpace:'pre-line',...style}}>{children}</div>;
}
export function Panel({rect,children,color,radius=21,border,clip=true,style={},...rest}) {
  const t=useDots();return <div {...rest} style={{...at(rect.x,rect.y,rect.w,rect.h),boxSizing:'border-box',borderRadius:radius,background:color??t.color.panel,...border?{border:`1.5px solid ${border}`}:{},overflow:clip?'hidden':'visible',...style}}>{children}</div>;
}
export function Enter({frame,cue,children,rise=28,bounce=false,style={}}) {
  const raw=progress(frame,cue.start,cue.duration),p=easeOut(raw);
  return <div style={{...style,opacity:p,translate:`0 ${(1-p)*rise}px`,scale:bounce?mix(.9,1,pop(raw)):1}}>{children}</div>;
}
export function TextReveal({frame,cue,children,style={}}) {
  const p=easeOut(progress(frame,cue.start,cue.duration));return <div style={{overflow:'hidden',...style}}><div style={{translate:`0 ${(1-p)*115}%`}}>{children}</div></div>;
}
// Solid new state reveals over old state; avoids two sets of text shining through.
export function StateWipe({frame,cue,children,style={}}) {
  const p=easeOut(progress(frame,cue.start,cue.duration));return <div style={{position:'absolute',inset:0,...style,clipPath:`inset(0 ${(1-p)*100}% 0 0)`}}>{children}</div>;
}
export function Icon({kind='doc',size=28,color='currentColor',style={}}) {
  const paths={doc:<><path d="M8 3h12l6 7v19H8zM20 3v8h6M12 16h10M12 21h10"/></>,arrow:<path d="M3 16h25M19 7l9 9-9 9"/>,check:<path d="m6 17 6 6L27 7"/>,mail:<><rect x="4" y="7" width="24" height="18" rx="2"/><path d="m5 8 11 9L27 8"/></>,calendar:<><rect x="5" y="7" width="22" height="22" rx="3"/><path d="M5 14h22M10 3v8M22 3v8"/></>,cross:<path d="m8 8 16 16M24 8 8 24"/>};
  if(!paths[kind])throw new Error(`Unknown icon: ${kind}`);
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[kind]}</svg>;
}
export function TickLines({frame,cue,width=100,color='#aaa99e'}) {
  return <div>{[0,1,2].map(i=><div key={i} style={{height:6,marginBottom:7,borderRadius:4,background:i===0?'#0b0b0d':color,width:(width-i*17)*easeOut(progress(frame,cue.start+i*3,cue.duration))}}/>)}</div>;
}
// Child components use a 312x110 internal coordinate system; compose freely.
export function DocumentResult({frame,cues,resultLabel,resultTitle,resultDetail}) {
  const c=useDots().color;
  return <div style={{position:'relative',width:312,height:110}}><Enter frame={frame} cue={cues.input} style={at(0,21,130,66)}><Panel rect={{x:0,y:0,w:130,h:66}} color="#ece9df" radius={18}><div style={at(14,13)}><TickLines frame={frame} cue={cues.input}/></div></Panel></Enter><Enter frame={frame} cue={cues.connect} style={at(141,40)} rise={0}><Icon kind="arrow" size={26}/></Enter><Enter frame={frame} cue={cues.output} bounce style={at(183,8,128,97)}><Panel rect={{x:0,y:0,w:128,h:97}} color={c.ink} radius={19}><Type role="meta" color={c.lime} style={at(13,12)}>{resultLabel}</Type><Type role="label" color="white" style={at(13,34,102)}>{resultTitle}</Type><Type role="meta" color={c.pink} style={at(13,72)}>{resultDetail}</Type></Panel></Enter></div>;
}
export function ApprovalSwitch({frame,cues,pendingLabel,approvedLabel,doneLabel}) {
  const c=useDots().color,p=easeOut(progress(frame,cues.approve.start,cues.approve.duration));
  const done=frame>=cues.complete.start,approved=frame>=cues.approve.start+cues.approve.duration;
  return <div style={{position:'relative',width:312,height:110}}><Enter frame={frame} cue={cues.input} style={at(0,8,126,83)}><Panel rect={{x:0,y:0,w:126,h:83}} color={c.paper} radius={18}><div style={at(14,14)}><TickLines frame={frame} cue={cues.input} width={96}/></div><div style={{...at(14,61,44,7),background:c.red,borderRadius:4}}/></Panel></Enter><Enter frame={frame} cue={cues.request} rise={0} style={at(137,31)}><Icon kind="arrow" color="white"/></Enter><Enter frame={frame} cue={cues.request} style={at(179,7,100,58)}><div style={{height:58,borderRadius:40,background:p>.3?c.red:'#353941'}}/><div style={{...at(mix(5,47,p),5,48,48),background:'white',borderRadius:'50%',boxShadow:'0 3px 8px #0003'}}/></Enter><Enter frame={frame} cue={cues.request} rise={4} style={at(179,77,130)}><Type role="meta" color="white" style={{fontSize:13}}>{done?doneLabel:approved?approvedLabel:pendingLabel}</Type></Enter></div>;
}
export function WaveProducts({frame,fps,cues,labels,endFrame}) {
  const c=useDots().color,p=easeOut(progress(frame,cues.start.start,cues.start.duration));
  const t=Math.min(Math.max(frame-cues.start.start,0),Math.max(0,endFrame-cues.start.start))/fps;
  return <div style={{position:'relative',width:312,height:120}}><div style={{...at(0,0,280*p,77),overflow:'hidden',display:'flex',gap:5,alignItems:'center'}}>{Array.from({length:29},(_,i)=><div key={i} style={{width:5,flexShrink:0,borderRadius:4,background:c.ink,opacity:i<8||i>19?.25:1,height:10+(22+20*Math.sin(i*1.3+t*4.5)**2)*(.4+.6*Math.sin(i*.6+t*2)**2)}}/>)}</div>{labels.map((label,i)=><Enter key={i} frame={frame} cue={cues.products[i]} bounce rise={13} style={at(i*92,83,85,31)}><div style={{height:31,borderRadius:20,background:c.ink,display:'grid',placeItems:'center'}}><Type role="meta" color="white" style={{fontSize:13}}>{label}</Type></div></Enter>)}</div>;
}
export function ProgressMeter({frame,cue,width=235,label,showPercent=false}) {
  const c=useDots().color,p=progress(frame,cue.start,cue.duration);
  return <div style={{width}}><Type role="label" color={c.lime}>{showPercent?`${Math.round(p*100)}%`:label}</Type><div style={{height:10,marginTop:12,background:'#363b45',borderRadius:6,overflow:'hidden'}}><div style={{height:'100%',width:`${p*100}%`,background:c.red,borderRadius:6}}/></div></div>;
}
export function FullPage({src,sourceSize,rect,highlight,color,style={}}) {
  const c=useDots().color;
  if(!sourceSize||sourceSize.width<=0||sourceSize.height<=0)throw new Error('FullPage requires real sourceSize');
  const w=rect.w-8,h=rect.h-8,s=Math.min(w/sourceSize.width,h/sourceSize.height),iw=sourceSize.width*s,ih=sourceSize.height*s,ox=(w-iw)/2,oy=(h-ih)/2;
  return <Panel rect={rect} color="white" radius={22} border={c.ink} style={{...style,borderWidth:4}}><Img src={src} style={{...at(ox,oy,iw,ih),objectFit:'contain'}}/>{highlight&&<div style={{...at(ox+highlight.x*iw,oy+highlight.y*ih,highlight.w*iw,highlight.h*ih),boxSizing:'border-box',border:`2px solid ${color??c.red}`,borderRadius:8}}/>}</Panel>;
}
