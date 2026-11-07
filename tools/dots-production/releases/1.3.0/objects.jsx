import React from 'react';
import {Img} from 'remotion';
import tokens from './tokens.json';
import {phase, lerp} from './objects.mjs';

export const palette=tokens.color;
const fonts=tokens.font;
export function Ink({x=0,y=0,size=28,color=palette.ink,weight='black',anchor='start',children,...rest}) {
  return <text x={x} y={y} fill={color} fontFamily={weight==='mono'?fonts.meta:weight==='bold'?fonts.body:fonts.headline} fontWeight={weight==='mono'?600:weight==='bold'?700:900} fontSize={size} textAnchor={anchor} {...rest}>{children}</text>;
}
export function Surface({x=0,y=0,w,h,r=24,color=palette.paper,stroke,...rest}) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={color} stroke={stroke} strokeWidth={stroke?1.5:0} {...rest}/>;
}
export function Board({children,dark=false,texture=true}) {
  const id=React.useId().replace(/:/g,'');
  return <svg width="100%" height="100%" viewBox="0 0 1280 720" style={{position:'absolute',inset:0,background:dark?palette.ink:palette.paper}}>
    {texture&&<><defs><pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r=".85" fill={dark?'#555a65':'#aaa496'} opacity={dark?.30:.30}/></pattern></defs><rect width="1280" height="720" fill={`url(#${id})`}/></>}{children}
  </svg>;
}

// Distinct DOM identities support observation/editing. This wrapper consumes pose directly.
// Native workbench editing still requires the corresponding manifest object declaration.
export function Entity({view,children}) {
  const {pose:p}=view;
  return <g data-dots-object={view.id} data-entity-id={view.entityId} data-state-id={view.stateId}
    data-editable-object={view.id} transform={`translate(${p.x??0} ${p.y??0}) scale(${p.scale??1})`}
    opacity={p.opacity??1} style={{filter:`saturate(${p.saturation??1})`}}>{children}</g>;
}
export function Badge({x,y,text,color=palette.ink,ink=palette.paper,w=116,size=15}) {
  return <g transform={`translate(${x} ${y})`}><Surface w={w} h={30} r={15} color={color}/><Ink x={w/2} y={21} size={size} color={ink} anchor="middle" weight="bold">{text}</Ink></g>;
}
export function RevealText({frame,start=0,duration=13,x,y,children,...props}) {
  const id=React.useId().replace(/:/g,''),p=phase(frame,start,duration);
  return <g><defs><clipPath id={id}><rect x={x-3} y={y-(props.size??56)-4} width={1260-x} height={(props.size??56)+14}/></clipPath></defs><g clipPath={`url(#${id})`}><Ink x={x} y={y+(1-p)*((props.size??56)+20)} {...props}>{children}</Ink></g></g>;
}

// Content comes from the same complete snapshot as stateId, not separately written status copy.
export function RecordCard({view,accent=palette.red}) {
  const {pose:p,data:d}=view,w=p.w??360,h=p.h??330;
  const dark=!!d.dark,bg=dark?palette.panel:'#fff',fg=dark?palette.paper:palette.ink;
  return <Entity view={view}><Surface w={w} h={h} r={22} color={bg} stroke={dark?'#363b45':'#dedbd4'}/>
    <rect x={23} y={24} width={5} height={25} rx={2.5} fill={accent}/>
    <Ink x={40} y={43} size={15} color={dark?'#b2b5bd':'#77786f'} weight="mono">{d.eyebrow}</Ink>
    <Ink x={24} y={91} size={d.titleSize??30} color={fg}>{d.title}</Ink>
    {(d.rows??[]).map((row,i)=>{
      const yy=119+i*(d.rowHeight??66),selected=row.tone==='changed'||row.tone==='issue';
      const fill=row.tone==='changed'?palette.lime:row.tone==='issue'?'#ffe6d9':dark?'#111318':'#f2f0e9';
      return <g key={row.id} data-dots-field={row.id}><Surface x={18} y={yy} w={w-36} h={64} r={12} color={fill}/>
        <Ink x={31} y={yy+22} size={13} color={selected?palette.ink:dark?'#a3a7af':'#73756c'} weight="bold">{row.label}</Ink>
        <Ink x={31} y={yy+52} size={row.size??24} color={selected?palette.ink:fg}>{row.segments?row.segments.map((s,j)=><tspan key={j} fill={s.accent?accent:undefined}>{s.text}</tspan>):row.value}</Ink>
        {row.previous&&<Ink x={w-33} y={yy+22} size={12} color={selected?'#596230':'#85877f'} anchor="end" weight="bold">原：{row.previous}</Ink>}
      </g>;
    })}
    {d.note&&<Ink x={24} y={h-22} size={14} color={dark?'#afb2b9':'#73756c'} weight="bold">{d.note}</Ink>}
  </Entity>;
}
export function ImageCard({view,src,position='50% 50%',credit,shade=0,sourceRect,sourceSize}) {
  const {pose:p}=view,w=p.w,h=p.h,id=React.useId().replace(/:/g,'');
  return <Entity view={view}><defs><clipPath id={id}><rect width={w} height={h} rx="24"/></clipPath></defs>
    <g clipPath={`url(#${id})`}>{sourceRect&&sourceSize?<svg width={w} height={h} viewBox={`${sourceRect.x} ${sourceRect.y} ${sourceRect.w} ${sourceRect.h}`} preserveAspectRatio="xMidYMid slice"><image href={src} width={sourceSize.w} height={sourceSize.h}/></svg>:<foreignObject width={w} height={h}><div xmlns="http://www.w3.org/1999/xhtml" style={{width:w,height:h,background:palette.panel}}><Img src={src} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:position}}/></div></foreignObject>}<rect width={w} height={h} fill={palette.ink} opacity={shade}/></g>
    {credit&&<Ink x={0} y={h+22} size={12} color="#aaaeb3" weight="bold">{credit}</Ink>}
  </Entity>;
}
export function StepSlots({x,y,width=640,labels,active=0,completed=[],color=palette.lime}) {
  const gap=14,w=(width-gap*(labels.length-1))/labels.length;
  return <g transform={`translate(${x} ${y})`}>{labels.map((label,i)=><g key={label} transform={`translate(${i*(w+gap)} 0)`}>
    <Surface w={w} h={70} r={17} color={i===active?color:palette.panel}/>
    <Ink x={18} y={24} size={12} color={i===active?palette.ink:'#9297a2'} weight="mono">{String(i+1).padStart(2,'0')}</Ink>
    <Ink x={18} y={51} size={23} color={i===active?palette.ink:palette.paper}>{label}</Ink>
    {completed.includes(i)&&<circle cx={w-20} cy={20} r={4} fill={i===active?palette.ink:color}/>}
  </g>)}</g>;
}
export function FocusFrame({x,y,w,h,p=1,color=palette.red}) {
  return <rect x={x} y={y} width={w} height={h} rx="18" fill="none" stroke={color} strokeWidth={3} opacity={p} pathLength={1} strokeDasharray={1} strokeDashoffset={1-p}/>;
}
export function ResourceUnits({x,y,count=3,assigned=0,color=palette.lime}) {
  return <g transform={`translate(${x} ${y})`}>{Array.from({length:count},(_,i)=><g key={i} transform={`translate(${i*37} 0)`}>
    <Surface w={28} h={36} r={7} color={i<assigned?color:palette.panel} stroke={i<assigned?undefined:'#50545f'}/>
    <path d="M9 12H19M9 18H19M9 24H16" stroke={i<assigned?palette.ink:'#737989'} strokeWidth="2" strokeLinecap="round"/>
  </g>)}</g>;
}
