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

export function VisualAsset({parameters:p,beats=[],mediaSrc,from=0}:any){
 const frame=useCurrentFrame(),begin=event(beats,'reveal'),t=enter(frame,begin,16),colors=palette(p),title=String(p.headline??'把舞台，留给真正重要的事。');
 const mode=p.personMode??'none',hasPerson=mode!=='none'&&!!mediaSrc;
 if(mode!=='none'&&!mediaSrc)throw Error('人物模式需要主视频，请选择换内容预览或准备目标素材');
 const inset=mode==='inset';
 return <AbsoluteFill style={paperStyle(p)}>
  <svg data-editable-object="stage" width="1920" height="1080" style={{position:'absolute',inset:0}}>
   <defs><linearGradient id="spot-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.colorTwo??'#F2C32A'} stopOpacity=".02"/><stop offset="1" stopColor={p.colorTwo??'#F2C32A'} stopOpacity=".21"/></linearGradient></defs>
   <path d="M 870 0 L 650 860 L 1300 860 L 1050 0 Z" fill="url(#spot-light)" opacity={t}/>
   <ellipse cx="975" cy="875" rx="340" ry="57" fill="#FFFFFF" opacity={t*.83}/>
  </svg>
  {hasPerson&&<div data-editable-object="stage" style={{position:'absolute',left:inset?1260:490,top:inset?640:130,width:inset?470:940,height:inset?265:570,borderRadius:inset?34:65,overflow:'hidden',transform:'translateY('+(1-t)*35+'px)',opacity:t,boxShadow:'0 22px 50px #18233016'}}>
    <OffthreadVideo src={src(mediaSrc)} trimBefore={from} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>
  </div>}
  <div data-editable-object="headline" style={{position:'absolute',left:inset?130:120,top:hasPerson&&!inset?744:inset?280:225,width:inset?1250:1680,textAlign:inset?'left':'center',opacity:t,transform:'translateY('+(1-t)*35+'px)'}}>
    {p.eyebrow&&<Eyebrow text={p.eyebrow}/>}
    <h1 style={{fontWeight:900,fontSize:typeSize(title,hasPerson&&!inset?87:124,60),lineHeight:1.16,letterSpacing:-3,whiteSpace:'pre-line',margin:'24px 0'}}><Highlight text={title} word={p.highlight??''} color={p.accent??'#2869FF'}/></h1>
    {p.caption&&<div style={{fontSize:32,lineHeight:1.5,opacity:.65,maxWidth:inset?990:1480,margin:inset?'0':'0 auto'}}>{p.caption}</div>}
  </div>
  {!hasPerson&&Array.from({length:8},(_,i)=>{const x=215+i*210,y=825+Math.sin(i/7*Math.PI)*65,a=enter(frame,begin+12+i*3,20);return <div key={i} style={{position:'absolute',left:x,top:y+(1-a)*70,width:82,height:82,borderRadius:i%3===0?22:'50%',background:colors[i%6],transform:'rotate('+(i%2?8:-8)+'deg)',opacity:a}}/>;})}
 </AbsoluteFill>;
}
