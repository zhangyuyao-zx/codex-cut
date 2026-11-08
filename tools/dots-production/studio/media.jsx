import React from 'react';
import {Img,OffthreadVideo} from 'remotion';
import {mediaTransform,progress} from './media.mjs';
import tokens from '../releases/1.3.0/tokens.json';
export {cameraAt,progress} from './media.mjs';
export const colors=tokens.color;

/** Content-owned geometry, not a fixed title/card/arrow layout. Coordinates of focus marks stay in source pixels. */
export function EvidenceWindow({src,source,rect,crop,focus,video=false,startFrom=0,radius=24,background='#fff',style={}}){
 const t=mediaTransform(source,rect,crop);
 const mediaStyle={position:'absolute',left:t.x-t.clip.x,top:t.y-t.clip.y,width:source.w*t.scale,height:source.h*t.scale,maxWidth:'none'};
 return <div data-evidence-source={src} style={{position:'absolute',left:rect.x,top:rect.y,width:rect.w,height:rect.h,overflow:'hidden',borderRadius:radius,background,...style}}>
  <div style={{position:'absolute',left:t.clip.x,top:t.clip.y,width:t.clip.w,height:t.clip.h,overflow:'hidden'}}>
  {video?<OffthreadVideo src={src} startFrom={startFrom} muted style={mediaStyle}/>:<Img src={src} style={mediaStyle}/>}
  {focus&&<div style={{position:'absolute',left:t.x-t.clip.x+focus.x*t.scale,top:t.y-t.clip.y+focus.y*t.scale,width:focus.w*t.scale,height:focus.h*t.scale,border:`${focus.stroke??3}px solid ${focus.color??colors.red}`,borderRadius:focus.radius??8,boxSizing:'border-box',opacity:focus.opacity??1,boxShadow:focus.dim?'0 0 0 4000px #0b0b0d55':undefined}}/>}
  </div>
 </div>;
}

/** Distinct shapes and true content remain caller-owned; this only manages handoff timing/weight. */
export function Attention({frame,start=0,duration=14,retireAt,children,style={}}){
 const enter=progress(frame,start,duration),retire=retireAt==null?0:progress(frame,retireAt,duration);
 return <div style={{position:'absolute',opacity:enter*(1-retire*.72),transform:`translateY(${(1-enter)*18}px)`,...style}}>{children}</div>;
}

/** Optional quotation treatment. The exact source words are supplied, never invented by this primitive. */
export function EvidenceQuote({lines,active=-1,color=colors.paper,size=38,style={}}){
 return <div style={{fontFamily:tokens.font.headline,fontWeight:900,fontSize:size,lineHeight:1.35,letterSpacing:-.8,...style}}>{lines.map((line,i)=><div key={i} style={{color:i===active?colors.lime:color,opacity:active<0||active===i?1:.4}}>{line}</div>)}</div>;
}
