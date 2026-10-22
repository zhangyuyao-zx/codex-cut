import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {EditableCanvasObject} from '../EditableCanvasObject';
import type {SceneModuleInput} from '../SceneModuleSurface';
export function EditorFlow({parameters}:SceneModuleInput) {
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:'#f1f3ec',color:'#233a2e',fontFamily:'PingFang SC, sans-serif'}}>
    <div style={{position:'absolute',left:155,top:120,fontSize:23,color:'#88988b',letterSpacing:3}}>PROCESS / 03</div>
    <EditableCanvasObject id="caption" style={{position:'absolute',left:150,top:230,width:1600}}><div style={{fontSize:76,fontWeight:600}}>{String(parameters.caption)}</div></EditableCanvasObject>
    <EditableCanvasObject id="flow" style={{position:'absolute',left:150,top:420,width:1620,height:380}}>
      <svg width="1620" height="380" style={{position:'absolute',inset:0}}><path d="M360 175H1260" stroke="#d1dbce" strokeWidth="3" strokeDasharray="7 9" fill="none"/></svg>
      {(['first','second','third'] as const).map((id,index)=>{
        const progress=interpolate(frame,[12+index*24,30+index*24],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
        return <EditableCanvasObject key={id} id={id} parentId="flow" style={{position:'absolute',left:index*560,top:20,width:480,height:300}}>
          <div style={{height:300,padding:'40px 42px',borderRadius:30,background:index===1?String(parameters.accent):'#e4e9df',color:index===1?'#f4f6f0':'#43604d',opacity:progress,translate:`0 ${(1-progress)*30}px`,boxShadow:'0 12px 35px #3a554409'}}>
            <div style={{fontSize:24,opacity:.5,marginBottom:58}}>0{index+1}</div><div style={{fontSize:46,fontWeight:550}}>{String(parameters[id])}</div>
          </div>
        </EditableCanvasObject>;
      })}
    </EditableCanvasObject>
    <div style={{position:'absolute',left:155,bottom:105,fontSize:27,color:'#8b998d'}}>每一个动作，都服务于正在讲述的内容。</div>
  </AbsoluteFill>;
}
