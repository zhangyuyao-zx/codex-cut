import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {EditableCanvasObject} from '../EditableCanvasObject';
import type {SceneModuleInput} from '../SceneModuleSurface';
export function EditorNumber({parameters}:SceneModuleInput) {
  const frame=useCurrentFrame(), progress=interpolate(frame,[0,30],[0,1],{extrapolateRight:'clamp',extrapolateLeft:'clamp'});
  return <AbsoluteFill style={{background:'#f1f3ec',color:'#233a2e',fontFamily:'PingFang SC, sans-serif'}}>
    <div style={{position:'absolute',left:155,top:120,fontSize:23,color:'#88988b',letterSpacing:3}}>FOCUS / 02</div>
    <EditableCanvasObject id="caption" style={{position:'absolute',left:150,top:210,width:1600}}><div style={{fontSize:65,fontWeight:600}}>{String(parameters.caption)}</div></EditableCanvasObject>
    <EditableCanvasObject id="number" style={{position:'absolute',left:140,top:350,width:1300}}><div style={{fontSize:240,fontWeight:650,letterSpacing:-14,lineHeight:1.2,color:String(parameters.accent),opacity:progress,translate:`0 ${(1-progress)*35}px`}}>{Math.round(Number(parameters.value)*progress).toLocaleString('en-US')}</div></EditableCanvasObject>
    <EditableCanvasObject id="unit" style={{position:'absolute',left:160,top:685,width:1200}}><div style={{fontSize:34,color:'#738277',opacity:interpolate(frame,[25,45],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>{String(parameters.unit)}</div></EditableCanvasObject>
    <EditableCanvasObject id="note" style={{position:'absolute',left:160,top:890,width:1500}}><div style={{fontSize:29,color:'#8b998d'}}>{String(parameters.note)}</div></EditableCanvasObject>
  </AbsoluteFill>;
}
