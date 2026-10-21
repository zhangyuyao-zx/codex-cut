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
 const frame=useCurrentFrame(),items=(p.steps??['理解内容','提取重点','编排画面','跟随口播']) as string[];
 if(items.length<2||items.length>6||items.some(t=>t.length>24))throw Error('阶梯图支持2–6步，每步最多24字');
 const start=event(beats,'begin'),wide=p.layout!=='aside',colors=palette(p),intro=enter(frame,start,18);
 const x0=wide?210:925,span=wide?1480:760,step=span/(items.length-1),base=wide?775:790,rise=wide?66:72;
 const points=items.map((_,i)=>({x:x0+i*step,y:base-i*rise}));
 const cues=items.map((_,i)=>event(beats,'step-'+(i+1),start+12+i*Number(p.intervalFrames??25)));
 const current=Math.max(0,cues.findLastIndex(t=>frame>=t)),prior=Math.max(0,current-1),move=enter(frame,cues[current],16);
 const moving={x:points[prior].x+(points[current].x-points[prior].x)*move,y:points[prior].y+(points[current].y-points[prior].y)*move};
 return <AbsoluteFill style={paperStyle(p)}>
  <div data-editable-object="headline" style={{position:'absolute',left:122,top:wide?104:278,width:wide?1640:700,opacity:intro,transform:'translateY('+(1-intro)*30+'px)'}}>
   <Eyebrow text={p.eyebrow??'ONE STEP AT A TIME'}/>
   <h1 style={{fontSize:typeSize(p.headline??'让表达，一步步清晰。',wide?112:94,64),lineHeight:1.16,fontWeight:900,letterSpacing:-3,margin:'28px 0',whiteSpace:'pre-line'}}><Highlight text={p.headline??'让表达，一步步清晰。'} word={p.highlight??''} color={p.accent??colors[0]}/></h1>
   {p.caption&&<div style={{fontSize:31,lineHeight:1.5,opacity:.64,maxWidth:wide?1240:620}}>{p.caption}</div>}
  </div>
  <svg width="1920" height="1080" style={{position:'absolute',inset:0,opacity:intro}}>
   <path d={points.map((q,i)=>(i?'L':'M')+q.x+' '+q.y).join(' ')} fill="none" stroke={p.ink??'#17191C'} strokeWidth="3" opacity=".12" strokeDasharray="7 11"/>
  </svg>
  {items.map((text,i)=>{const q=points[i],t=enter(frame,cues[i],18),active=i===current;return <div data-editable-object="steps" key={i} style={{position:'absolute',left:q.x-72,top:q.y-68,width:144,opacity:t,transform:'translateY('+(1-t)*40+'px) rotate('+(active?-3:0)+'deg)'}}>
    <div style={{height:136,borderRadius:30,background:colors[i],display:'flex',alignItems:'center',justifyContent:'center',color:i%3===1?'#1C2425':'#FFFFFF',boxShadow:'0 15px 0 rgba(20,25,30,.06)',fontSize:64,fontWeight:900}}>{String(i+1).padStart(2,'0')}</div>
    <div style={{position:'relative',left:wide?-45:-28,width:wide?234:200,marginTop:30,textAlign:'center',fontSize:wide?34:29,lineHeight:1.35,fontWeight:750,overflowWrap:'anywhere'}}>{text}</div>
  </div>;})}
  <div style={{position:'absolute',left:moving.x-14,top:moving.y-133,width:28,height:28,borderRadius:9,background:p.ink??'#17191C',transform:'rotate(45deg)',opacity:enter(frame,cues[0],12)}}/>
 </AbsoluteFill>;
}
