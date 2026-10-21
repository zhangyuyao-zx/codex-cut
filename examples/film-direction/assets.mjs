// Three authored compositions sharing real controls; not a mandatory scene vocabulary.
const commonCode=`import React from 'react';
import {AbsoluteFill,useCurrentFrame,interpolate,Easing} from 'remotion';
const at=(beats,label,fallback=0)=>beats.find(b=>b.label===label)?.frame??fallback;
const progress=(frame,start,p)=>interpolate(frame,[start,start+Number(p.motionFrames)],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:p.motionEasing==='firm'?Easing.bezier(.4,0,.2,1):Easing.bezier(.22,1,.36,1)});
const root=p=>({background:p.background,color:p.ink,fontFamily:p.fontFamily,overflow:'hidden'});
const pos=(left,top,width)=>({position:'absolute',left,top,width});
`;
const controls=[
  {key:'background',label:'背景',type:'color',default:'#F3F0E9'},
  {key:'ink',label:'正文色',type:'color',default:'#202D35'},
  {key:'accent',label:'强调色',type:'color',default:'#D96641'},
  {key:'fontFamily',label:'字体',type:'text',default:'Arial, "PingFang SC", sans-serif'},
  {key:'headingSize',label:'标题字号',type:'number',default:96,min:48,max:130},
  {key:'bodySize',label:'正文字号',type:'number',default:36,min:24,max:48},
  {key:'lineWidth',label:'线条粗细',type:'number',default:3,min:1,max:8},
  {key:'radius',label:'圆角',type:'number',default:24,min:0,max:60},
  {key:'padding',label:'画面留白',type:'number',default:112,min:60,max:160},
  {key:'motionFrames',label:'动作时长（帧）',type:'number',default:18,min:6,max:60},
  {key:'motionEasing',label:'运动节奏',type:'select',default:'gentle',options:['gentle','firm']},
];
const definitions=[
  {id:'film-direction-title',name:'编辑式标题',cues:['begin','emphasis'],
    content:[{key:'headline',label:'标题',type:'text',default:'让重点，\n站到前面。'},{key:'caption',label:'说明',type:'text',default:'先理解内容，再决定画面。'}],
    body:`export function VisualAsset({parameters:p,beats=[]}){
      const f=useCurrentFrame(),a=progress(f,at(beats,'begin'),p),b=progress(f,at(beats,'emphasis',35),p);
      const lines=String(p.headline).split('\\n');return <AbsoluteFill data-editable-object="style" style={root(p)}>
        <div style={{...pos(p.padding,130,1500),fontSize:p.bodySize*.65,letterSpacing:5,color:p.accent,opacity:a}}>CONTENT / FIRST</div>
        <div data-editable-object="headline" style={{...pos(p.padding,280,1670),fontSize:p.headingSize*1.8,fontWeight:800,lineHeight:1.18,letterSpacing:-7}}>
          <div style={{opacity:a,translate:'0 '+(35*(1-a))+'px'}}>{lines[0]}</div>
          <div style={{opacity:b,color:p.accent,translate:'0 '+(35*(1-b))+'px'}}>{lines.slice(1).join(' ')}</div>
        </div>
        <div style={{...pos(p.padding,820,1500),fontSize:p.bodySize,opacity:b*.7}}>{p.caption}</div>
        <div style={{position:'absolute',right:p.padding,top:190,width:70,height:70,borderRadius:p.radius,background:p.accent,rotate:(15*a)+'deg',scale:String(a)}}/>
      </AbsoluteFill>;}`},
  {id:'film-direction-metric',name:'数字与量级',cues:['begin','count'],
    content:[{key:'headline',label:'标题',type:'text',default:'把抽象数量，变成直观感受。'},{key:'amount',label:'数量',type:'number',default:3600,min:1,max:99999},{key:'caption',label:'说明',type:'text',default:'张画面 / 分钟'}],
    body:`export function VisualAsset({parameters:p,beats=[]}){
      const f=useCurrentFrame(),a=progress(f,at(beats,'begin'),p),t=progress(f,at(beats,'count',20),{...p,motionFrames:Number(p.motionFrames)*2});
      return <AbsoluteFill data-editable-object="style" style={root(p)}>
        <div style={{...pos(p.padding,130,1660),fontSize:p.headingSize*.72,fontWeight:700,opacity:a}}>{p.headline}</div>
        <div data-editable-object="headline" style={{...pos(p.padding,360,1100),fontSize:p.headingSize*3.25,fontWeight:800,letterSpacing:-12,color:p.accent,fontVariantNumeric:'tabular-nums',opacity:a}}>{Math.round(Number(p.amount)*t).toLocaleString('en-US')}</div>
        <div style={{...pos(p.padding+12,740,900),fontSize:p.bodySize,opacity:a*.7}}>{p.caption}</div>
        <svg style={{position:'absolute',right:p.padding+40,top:360}} width="470" height="470" viewBox="0 0 470 470"><circle cx="235" cy="235" r="170" fill="none" stroke={p.ink} strokeOpacity=".1" strokeWidth={p.lineWidth*10}/><circle cx="235" cy="235" r="170" fill="none" stroke={p.accent} strokeWidth={p.lineWidth*10} strokeLinecap="round" strokeDasharray={1068} strokeDashoffset={1068*(1-t)} transform="rotate(-90 235 235)"/><text x="235" y="260" textAnchor="middle" fill={p.ink} fontFamily={p.fontFamily} fontSize={p.headingSize*.8} fontWeight="700">60 fps</text></svg>
      </AbsoluteFill>;}`},
  {id:'film-direction-flow',name:'对象传递与流程',cues:['begin','step-1','step-2','step-3'],
    content:[{key:'headline',label:'标题',type:'text',default:'让关系，在画面里发生。'},{key:'items',label:'步骤',type:'list',itemType:'text',default:['理解内容','组织重点','实现动画'],minItems:3,maxItems:3},{key:'caption',label:'说明',type:'text',default:'同一套视觉语言，让不同内容有各自的表达。'}],
    body:`export function VisualAsset({parameters:p,beats=[]}){
      const f=useCurrentFrame(),a=progress(f,at(beats,'begin'),p);return <AbsoluteFill data-editable-object="style" style={root(p)}>
        <div data-editable-object="headline" style={{...pos(p.padding,145,1650),fontSize:p.headingSize,fontWeight:750,opacity:a}}>{p.headline}</div>
        <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>{[0,1].map(i=>{const t=progress(f,at(beats,'step-'+(i+2),40+i*30),p);return <g key={i}><path d={'M '+(p.padding+450+i*570)+' 575 h 120'} stroke={p.ink} strokeOpacity=".12" strokeWidth={p.lineWidth} fill="none"/><path d={'M '+(p.padding+450+i*570)+' 575 h 120'} stroke={p.accent} strokeWidth={p.lineWidth} fill="none" pathLength="1" strokeDasharray="1" strokeDashoffset={1-t}/><circle cx={p.padding+450+i*570+120*t} cy="575" r="7" fill={p.accent} opacity={t>0&&t<1?1:0}/></g>;})}</svg>
        {p.items.map((label,i)=>{const t=progress(f,at(beats,'step-'+(i+1),15+i*30),p);return <div key={i} data-editable-object="steps" style={{...pos(p.padding+i*570,450,450),height:250,borderRadius:p.radius,border:p.lineWidth+'px solid '+p.ink,boxSizing:'border-box',padding:38,opacity:t,translate:'0 '+(24*(1-t))+'px'}}><div style={{fontSize:p.bodySize*.7,color:p.accent,fontWeight:700,marginBottom:48}}>0{i+1}</div><div style={{fontSize:p.bodySize*1.3,fontWeight:650}}>{label}</div></div>;})}
        <div style={{...pos(p.padding,850,1650),fontSize:p.bodySize,opacity:a*.7}}>{p.caption}</div>
      </AbsoluteFill>;}`},
];
export const assets=definitions.map(def=>({id:def.id,version:'1.0.0',name:def.name,description:'共享字体、色板、留白与运动设置的原创构图示例。',kind:'recipe',mount:'SCENE',requiresSourceMedia:false,previewBackground:'#F3F0E9',tags:['全片设计示例'],
  source:{kind:'authored',note:'公开原创几何与通用文字，不含参考视频或用户素材。'},controls:[...controls,...def.content],styleBindings:Object.fromEntries(controls.map(c=>[c.key,c.key])),contentParameters:def.content.map(c=>c.key),
  objects:[{id:'headline',label:'主信息',parameters:def.content.map(c=>c.key)},{id:'style',label:'当前段样式',parameters:controls.map(c=>c.key)}],cues:def.cues.map(id=>({id,label:id,required:true})),constraints:{aspectRatios:['16:9'],minFrames:60,maxFrames:600,notes:'示例为短镜头，真实内容可由 Codex 改写结构。'},code:commonCode+def.body}));
export const pack={id:'film-direction-editorial',version:'1.0.0',name:'编辑式暖纸',description:'用共同视觉语言连接不同表达任务；字体、层级、线条和动作均绑定实际控件。',source:{kind:'authored',note:'原创风格与通用内容的功能演示。'},members:assets.map(({id,version})=>({id,version})),tokens:Object.fromEntries(controls.map(c=>[c.key,c.default])),
  typography:'Arial 与苹方；主信息加粗，正文留足空间。',motion:'内容随语义点推进，使用共同的缓动与动作时长；不为变化而变化。',composition:'允许标题、数字、图解和真实素材等不同主视觉，共享留白与层级。',sound:'真实制作沿用口播；此几何演示不含声音。',coverage:['标题','数字','流程'],limitations:['示例不代替真实口播的创作与声音审阅'],overrides:{}};
