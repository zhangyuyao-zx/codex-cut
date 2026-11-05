import React from 'react';
import {Canvas,Type,Panel,Enter,TextReveal,DocumentResult,ApprovalSwitch,WaveProducts} from './components';
import {grid,at} from './motion.mjs';

// Example of composition, not the required layout for a whole film.
// Caller supplies all story text and local-frame semantic cues.
export function CardsExample({frame,fps,content,cues,theme={}}) {
  const boxes=grid({x:64,y:229,w:1152,h:354},3,1,21);
  return <Canvas theme={theme}>
    <TextReveal frame={frame} cue={cues.heading} style={at(64,66,1152,124)}><Type role="headline">{content.heading}</Type></TextReveal>
    {boxes.map((rect,i)=><Enter key={i} frame={frame} cue={cues.cards[i]} rise={50} style={at(rect.x,rect.y,rect.w,rect.h)}>
      <Panel rect={{x:0,y:0,w:rect.w,h:rect.h}} radius={31} color={['white','#0b0b0d','#ff4e25'][i]}>
        <Type role="meta" color={i===1?'#94948a':i===2?'#762916':'#857d72'} style={at(28,24)}>{content.cards[i].label}</Type>
        <Type role="cardTitle" color={i===1?'white':'#0b0b0d'} style={at(28,57,rect.w-56,102)}>{content.cards[i].title}</Type>
        <div style={at(28,212)}>{i===0?<DocumentResult frame={frame} cues={cues.document} {...content.document}/>:i===1?<ApprovalSwitch frame={frame} cues={cues.approval} {...content.approval}/>:<WaveProducts frame={frame} fps={fps} cues={cues.wave} labels={content.products} endFrame={cues.wave.endFrame}/>}</div>
      </Panel>
    </Enter>)}
  </Canvas>;
}
