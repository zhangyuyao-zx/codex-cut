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
 const frame=useCurrentFrame(),text=String(p.headline??'让重要的内容，被看见。');
 const t=enter(frame,event(beats,'title'),16),align=p.align??'center',size=typeSize(text,Number(p.fontSize??124),64);
 if(text.length>64)throw Error('此标题最多支持64字，请缩短标题或另做长文版式');
 return <AbsoluteFill style={{fontFamily:font,color:p.ink??'#17191C',justifyContent:'center',alignItems:align==='left'?'flex-start':'center',padding:'0 130px'}}>
   <div data-editable-object="headline" style={{width:1660,maxWidth:'100%',textAlign:align,transform:'translate('+Number(p.x??0)+'px,'+(Number(p.y??0)+(1-t)*44)+'px)',opacity:t}}>
    <div style={{fontWeight:900,fontSize:size,lineHeight:1.18,letterSpacing:-3,whiteSpace:'pre-line',overflowWrap:'anywhere'}}>
      <Highlight text={text} word={p.highlight??''} color={p.accent??'#2869FF'}/>
    </div>
    {p.caption&&<div style={{fontSize:30,fontWeight:500,color:p.ink??'#17191C',opacity:.65,marginTop:30,lineHeight:1.5}}>{p.caption}</div>}
   </div>
 </AbsoluteFill>;
}
