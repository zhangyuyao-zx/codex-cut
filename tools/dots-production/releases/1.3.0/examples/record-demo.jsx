// Component demonstration, not a fixed scene layout or a product recording.
// Supply the kit fonts in the owning composition. Names and rows are replaceable.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Board,RecordCard,FocusFrame} from '../objects.jsx';
import {viewAt,phase} from '../objects.mjs';
export function RecordDemo({title='交付材料',before='尚未明确',after='业务负责人'}) {
  const frame=useCurrentFrame();
  const model={id:'record',entityId:'record-original',pose:{x:100,y:170,w:380,h:330},
    poses:[{start:40,duration:24,to:{x:730}}],states:[
      {id:'before',at:0,data:{title,eyebrow:'同一份材料',rows:[{id:'owner',label:'复核责任',value:before,tone:'issue'}]}},
      {id:'after',at:100,data:{title,eyebrow:'同一份材料',rows:[{id:'owner',label:'复核责任',value:after,previous:before,tone:'changed'}]}}
    ]};
  return <Board><RecordCard view={viewAt(model,frame)}/>{frame>=76&&frame<100&&<FocusFrame x={748} y={289} w={344} h={64} p={phase(frame,76,12)}/>}</Board>;
}
