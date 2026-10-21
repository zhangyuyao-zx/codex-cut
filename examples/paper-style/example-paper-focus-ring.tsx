import React from 'react';
import {AbsoluteFill,OffthreadVideo,staticFile,useCurrentFrame,interpolate} from 'remotion';
const font='"Arial","PingFang SC","Microsoft YaHei",sans-serif';
const ease=(x:number)=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3);
const enter=(frame:number,start:number,length=18)=>ease((frame-start)/length);
const event=(beats:any[],id:string,fallback=0)=>beats.find(b=>b.label===id)?.frame??fallback;
const src=(value:string)=>value.startsWith('/')||value.startsWith('http')?value:staticFile(value);
const typeSize=(text:string,max=126,min=68)=>Math.max(min,Math.min(max,max-(Math.max(0,text.length-13)*3.4)));
function Highlight({text,word,color}:{text:string;word:string;color:string}){
 const at=word?text.indexOf(word):-1;
 return at<0?<>{text}</>:<>{text.slice(0,at)}<span style={{color}}>{word}</span>{text.slice(at+word.length)}</>;
}
const paperStyle=(p:any):React.CSSProperties=>({background:p.background??'#F1F1E8',color:p.ink??'#17191C',fontFamily:font,overflow:'hidden'});
const palette=(p:any)=>[p.accent??'#2869FF',p.colorTwo??'#F2C32A',p.colorThree??'#F27948',p.colorFour??'#9666EC','#4CC7AF','#E65769'];
function Eyebrow({text,color='#6A716F'}:{text:string;color?:string}){return <div style={{fontSize:23,fontWeight:650,letterSpacing:3,color,textTransform:'uppercase'}}>{text}</div>;}

export function VisualAsset({parameters:p,beats=[]}:any){
 const frame=useCurrentFrame(),start=event(beats,'focus'),t=enter(frame,start,24);
 const x=Number(p.x??960),y=Number(p.y??500),r=Number(p.radius??215),length=2*Math.PI*r;
 return <AbsoluteFill data-editable-object="focus" style={{fontFamily:font}}>
  <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
   <g opacity={t} transform={'rotate('+(-110+(1-t)*25)+' '+x+' '+y+')'}>
    <circle cx={x} cy={y} r={r} fill="none" stroke={p.accent??'#F2C32A'} strokeWidth={Number(p.stroke??17)} strokeDasharray={length} strokeDashoffset={length*(1-t)} strokeLinecap="round"/>
    <circle cx={x+7} cy={y-5} r={r-15} fill="none" stroke={p.accent??'#F2C32A'} strokeWidth="4" opacity=".4" strokeDasharray={length*.88} strokeDashoffset={length*(1-t)}/>
   </g>
  </svg>
  {p.label&&<div style={{position:'absolute',top:y+r+42,left:Math.max(80,x-r-150),width:r*2+300,textAlign:'center',fontSize:54,fontWeight:800,color:p.ink??'#17191C',opacity:enter(frame,start+8,14)}}>{p.label}</div>}
 </AbsoluteFill>;
}
