import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Color,Euler,Vector3} from 'three';

type Input={parameters?:Record<string,unknown>;beats?:{label:string;frame:number}[]};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const x=clamp(n);return 1-(1-x)**3;};
const mix=(a:number,b:number,p:number)=>a+(b-a)*p;
const sans='"PingFang SC","Noto Sans CJK SC",system-ui,sans-serif';

/** An original, time-addressable shot. Scene composition is code, not a catalogue selection. */
export function FramePipeline({parameters:p={},beats=[]}:Input){
  const f=useCurrentFrame();
  const at=(label:string,fallback:number)=>beats.find(beat=>beat.label===label)?.frame??fallback;
  const multiply=at('multiply',65),trace=at('trace',180),queue=at('queue',320),conclude=at('conclude',445);
  const a=ease((f-multiply)/46),b=ease((f-trace)/38),c=ease((f-queue)/38),d=ease((f-conclude)/35);
  const accent=String(p.accent??'#315BFA'),ink=String(p.ink??'#18232E'),paper=String(p.background??'#F5F2EA');
  const tint=(amount:number)=>'#'+new Color(paper).lerp(new Color(accent),amount).getHexString();
  const fps=Math.max(1,Math.min(120,Number(p.frameRate??60))),seconds=Math.max(1,Math.min(600,Number(p.seconds??60)));
  const frames=Math.round(fps*seconds),counter=Math.round(mix(1,frames,ease((f-multiply)/65)));
  const rotation=new Euler(mix(-.13,-.50,a),mix(-.40,.40,a),mix(-.12,-.10,a));
  const project=(x:number,y:number,z:number)=>{
    const point=new Vector3(x,y,z).applyEuler(rotation),k=1050/(1050+point.z);
    return [point.x*k+mix(1275,1120,b),point.y*k+mix(540,495,b)];
  };
  const card=(i:number)=>{
    const column=i%12,row=Math.floor(i/12),reveal=ease((f-multiply-i*.38)/20);
    const x=mix(0,(column-5.5)*84,a),y=mix(0,(row-3.5)*66,a),z=mix(0,((column+row)%4-1.5)*22,a);
    const w=mix(470,76,a),h=w*9/16;
    const points=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([dx,dy])=>project(x+dx,y+dy,z));
    const target=[370,650];
    return <g key={i}><polygon points={points.map(([px,py])=>`${mix(px,target[0],b)},${mix(py,target[1],b)}`).join(' ')}
      fill={i===0?'#FA8159':tint((column+row)%5===0?.38:(column+row)%3===0?.22:.12)} stroke={paper} strokeWidth={mix(4,1.4,a)}
      opacity={(i===0?1:reveal*a)*(1-b)} />{i===0&&<polyline points={[[-.32,.27],[-.12,-.10],[.04,.12],[.23,-.27],[.35,.27]].map(([px,py])=>project(x+px*w,y+py*h,z)).map(([px,py])=>`${px},${py}`).join(' ')} fill="none" stroke={paper} strokeWidth={mix(9,1,a)} opacity={(1-a)*(1-b)} strokeLinejoin="round"/>}</g>;
  };
  const xs=[330,645,960,1275,1590],labels=['定位时间','布局与绘制','截成图片','搬运像素','视频编码'];
  const flow=clamp((f-trace-10)/118),headX=mix(xs[0],xs[4],flow);
  const waiting=Math.max(0,Math.floor((f-queue)/5));
  return <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{background:paper,fontFamily:sans,color:ink}}>
    <defs>
      <radialGradient id="frame-halo"><stop stopColor="#D8DFF5" stopOpacity=".8"/><stop offset="1" stopColor={paper} stopOpacity="0"/></radialGradient>
      <linearGradient id="frame-face" x2="1" y2="1"><stop stopColor={tint(.18)}/><stop offset="1" stopColor={tint(.3)}/></linearGradient>
      <filter id="frame-shadow" x="-35%" y="-35%" width="170%" height="190%"><feDropShadow dy="16" stdDeviation="17" floodColor="#274165" floodOpacity=".10"/></filter>
      <clipPath id="frame-page"><rect width="1920" height="1080"/></clipPath>
    </defs>
    <g clipPath="url(#frame-page)">
      <ellipse cx="1230" cy="530" rx="720" ry="510" fill="url(#frame-halo)" opacity={1-d}/>
      <text x="130" y="104" fill={ink} opacity=".4" fontSize="22" fontWeight="650" letterSpacing="4">A FRAME'S JOURNEY</text>
      <text x="1790" y="104" textAnchor="end" fill={ink} opacity=".4" fontSize="22">流程示意</text>

      <g opacity={1-b} data-editable-object="count">
        <text x="130" y="290" fill={ink} fontSize="76" fontWeight="720">{seconds===60?'一分钟':seconds+'秒'}，</text>
        <text x="130" y="385" fill={ink} fontSize="76" fontWeight="720">有多少张画面？</text>
        <text x="135" y="478" fill={ink} opacity=".6" fontSize="31">{seconds} 秒 × {fps} 帧 / 秒</text>
        <text x="125" y="700" fill={accent} fontSize="190" fontWeight="700" letterSpacing="-10">{counter.toLocaleString('en-US')}</text>
        <text x="137" y="755" fill={ink} opacity=".6" fontSize="29">张独立画面</text>
      </g>
      <g opacity={1-d}>{Array.from({length:96},(_,i)=>card(95-i))}</g>

      <g opacity={b*(1-d)}>
        <text x="130" y="270" fill={ink} fontSize="76" fontWeight="720">每一帧，都要走同一条路。</text>
        <text x="135" y="340" fill={ink} opacity=".52" fontSize="31">{frames.toLocaleString('en-US')} 张画面，反复完成这套工作。</text>
        <g transform={`translate(${mix(0,-400,c)} ${mix(0,-70,c)}) scale(${mix(1,1.25,c)})`}>
          <path d="M330 645 H1590" stroke="#CED6E5" strokeWidth="4" fill="none"/>
          <path d={`M330 645 H${headX}`} stroke={accent} strokeWidth="4" fill="none"/>
          {xs.map((x,i)=><g key={i} opacity={ease((f-trace-i*6)/18)*(i<2?1-c:1)}>
            <circle cx={x} cy="645" r="9" fill={headX>=x?accent:'#CED6E5'}/>
            <text x={x} y="765" textAnchor="middle" fill={ink} fontSize="29" fontWeight="650">{labels[i]}</text>
            <text x={x} y="811" textAnchor="middle" fill={ink} opacity=".45" fontSize="21">{['SEEK','PAINT','PNG / JPEG','COPY','ENCODE'][i]}</text>
          </g>)}
          <g transform="translate(250 465)" opacity={1-c} filter="url(#frame-shadow)">
            <rect width="160" height="110" rx="17" fill="white"/><rect width="160" height="23" rx="12" fill="#E7EAF1"/>
            <circle cx="15" cy="12" r="3" fill="#ACB7CB"/><circle cx="26" cy="12" r="3" fill="#ACB7CB"/>
            <text x="80" y="77" textAnchor="middle" fontSize="24" fill={ink} fontFamily="monospace">t = {(14.4+flow*.6).toFixed(2)}</text>
          </g>
          <g transform="translate(565 459)" opacity={1-c} fill="#B8C7F9">
            {[0,1,2].map(i=><rect key={i} x={i===0?0:64} y={i===2?62:0} width={i===0?52:96} height={i===0?110:48} rx="8" fill={i===0?accent:tint(.3)}/>)}
          </g>
          <g transform="translate(915 454) rotate(8 45 56)">
            <path d="M0 0 H66 L92 26 V114 H0Z" fill="white" stroke="#CED6E5" strokeWidth="2"/>
            <path d="M66 0 V26 H92" fill="#E1E7F5"/>
            <rect x="16" y="40" width="60" height="41" rx="5" fill="url(#frame-face)"/><path d="M20 75 L36 57 L47 66 L59 52 L72 75" fill="none" stroke={accent} strokeWidth="4"/>
          </g>
          <g transform="translate(1200 450)">
            {Array.from({length:Math.min(15,waiting)},(_,i)=><g key={i} transform={`translate(${i*5} ${-i*5})`}><rect x="0" y="0" width="116" height="96" rx="9" fill={i>9?'#FB936D':tint(.22)} stroke={paper} strokeWidth="3"/><path d="M17 70 L35 45 L52 60 L74 32 L99 70" stroke={i>9?'#D9582A':accent} strokeWidth="3" fill="none"/></g>)}
          </g>
          <g transform="translate(1535 459)">
            {Array.from({length:6},(_,i)=><g key={i} stroke="#7E8CA4" strokeWidth="4"><path d={`M${i*16+16} -10 V0 M${i*16+16} 100 V110`}/><path d={`M-10 ${i*16+10} H0 M110 ${i*16+10} H120`}/></g>)}
            <rect width="110" height="100" rx="12" fill={ink}/><rect x="13" y="13" width="84" height="74" rx="7" fill={mix(0,1,c)>.3?'#F0855C':'#334460'}/><text x="55" y="59" textAnchor="middle" fill="white" fontSize="22" fontWeight="700">CPU</text>
          </g>
          <g transform={`translate(${headX} 645)`}><rect x="-25" y="-20" width="50" height="40" rx="6" fill={accent} stroke={paper} strokeWidth="4"/></g>
        </g>
        <g opacity={c}>
          <text x="130" y="1010" fill="#CC613E" fontSize="31" fontWeight="650">{['压图片','复制数据','搬运像素'].filter((_,i)=>f>queue+i*23).join('    /    ')}</text>
        </g>
      </g>

      <g opacity={d} transform={`translate(0 ${mix(25,0,d)})`} data-editable-object="takeaway">
        <text x="130" y="395" fill={ink} fontSize="100" fontWeight="720">动画不一定复杂。</text>
        <text x="130" y="535" fill={accent} fontSize="100" fontWeight="720">{String(p.takeaway??'像素流转，才是负担。')}</text>
        <g transform="translate(140 690)">
          {[0,1,2,3,4,5,6].map(i=><rect key={i} x={i*125} y={Math.sin(i*.6)*12} width="104" height="65" rx="8" fill={i<5?tint(.22):'#F4B49A'} transform={`rotate(${i%2?3:-3} ${i*125+52} 32)`}/>)}
          <path d="M935 32 H1160" stroke={accent} strokeWidth="4" strokeDasharray="8 10"/>
          <rect x="1220" y="-12" width="120" height="90" rx="17" fill={ink}/><text x="1280" y="45" fill="white" textAnchor="middle" fontSize="26" fontWeight="700">CPU</text>
        </g>
      </g>
    </g>
  </svg>;
}

export const VisualAsset=FramePipeline;
