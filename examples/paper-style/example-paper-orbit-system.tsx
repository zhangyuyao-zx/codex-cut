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
 const frame=useCurrentFrame(),items=(p.items??['内容','人物','图片','数据']) as string[],colors=palette(p),title=String(p.headline??'让不同的信息，组成一个整体。');
 if(items.length<2||items.length>6||items.some(t=>t.length>18))throw Error('环绕关系支持2–6项，每项最多18字');
 const center=event(beats,'center'),members=event(beats,'members',center+25),t=enter(frame,center,22);
 const cx=p.layout==='aside'?1300:960,cy=p.layout==='aside'?610:710,radiusX=p.layout==='aside'?350:510,radiusY=p.layout==='aside'?266:205;
 return <AbsoluteFill style={paperStyle(p)}>
  <div data-editable-object="headline" style={{position:'absolute',left:122,top:p.layout==='aside'?300:100,width:p.layout==='aside'?660:1600,opacity:t}}>
   <Eyebrow text={p.eyebrow??'THINK IN RELATIONSHIPS'}/>
   <h1 style={{fontWeight:900,fontSize:typeSize(title,p.layout==='aside'?88:101,60),letterSpacing:-3,lineHeight:1.18,margin:'26px 0',whiteSpace:'pre-line'}}><Highlight text={title} word={p.highlight??''} color={p.accent??'#2869FF'}/></h1>
   {p.caption&&<p style={{fontSize:30,lineHeight:1.55,opacity:.65}}>{p.caption}</p>}
  </div>
  <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
   {items.map((_,i)=>{const angle=(-90+i*360/items.length)*Math.PI/180,q={x:cx+Math.cos(angle)*radiusX,y:cy+Math.sin(angle)*radiusY},v=enter(frame,event(beats,'item-'+(i+1),members+i*10),18);return <line key={i} x1={cx} y1={cy} x2={cx+(q.x-cx)*v} y2={cy+(q.y-cy)*v} stroke={colors[i]} strokeWidth="4" opacity={v*.4}/>;})}
  </svg>
  <div data-editable-object="system" style={{position:'absolute',left:cx-122,top:cy-122,width:244,height:244,borderRadius:72,background:p.accent??'#2869FF',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:49,lineHeight:1.2,textAlign:'center',padding:24,boxSizing:'border-box',transform:'scale('+(0.7+t*.3)+') rotate('+(1-t)*-12+'deg)',opacity:t}}>{p.core??'表达'}</div>
  {items.map((text,i)=>{const angle=(-90+i*360/items.length)*Math.PI/180,q={x:cx+Math.cos(angle)*radiusX,y:cy+Math.sin(angle)*radiusY},v=enter(frame,event(beats,'item-'+(i+1),members+i*10),18);return <div data-editable-object="system" key={i} style={{position:'absolute',left:cx+(q.x-cx)*v-140,top:cy+(q.y-cy)*v-63,width:280,height:126,background:colors[i]+'22',border:'2px solid '+colors[i]+'66',borderRadius:35,display:'flex',alignItems:'center',justifyContent:'center',fontSize:37,lineHeight:1.3,fontWeight:800,textAlign:'center',padding:'0 17px',boxSizing:'border-box',opacity:v,transform:'rotate('+(i%2?3:-3)*(1-v)+'deg)'}}>{text}</div>;})}
 </AbsoluteFill>;
}
