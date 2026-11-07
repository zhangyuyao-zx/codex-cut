import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Canvas} from './dots/1.3.0/components';
import {cuesFromBeats} from './dots/1.3.0/motion.mjs';
import {compileObjectStates,objectStateAt,compileValueTrack,valueAt} from './dots/1.3.0/state.mjs';
import script from './画面动作脚本.json';
// Prefer the verified visual parts, while authoring this scene's composition.
// import {Entity, RecordCard, ImageCard, StepSlots, RevealText} from './dots/1.3.0/objects.jsx';
// import {viewAt} from './dots/1.3.0/objects.mjs';
// RecordCard consumes complete content snapshots. Use one entityId through movement and revision.

// Author the actual objects after completing the content decision.
// states[id].data supplies the full current content; tracks[id] supplies a continuous value.
// Use these values in real labels, shapes, page highlights and relations.
// Do not replace every state change with another entrance, checkmark, or generic status row.
function AuthoredObjects({frame,cues,states,tracks,parameters}) {
  throw new Error('Finish this scene’s content-specific composition in AuthoredObjects before rendering. No default card layout is supplied.');
}

// The font wrapper, native editable controls and real media are provided by the owning scene.
export function Scene({parameters,beats,duration}) {
  const frame=useCurrentFrame();
  const cues=cuesFromBeats(beats,script.actions.map(a=>a.id),duration);
  const states=Object.fromEntries(script.objects.filter(o=>o.states?.length).map(o=>[
    o.id,objectStateAt(frame,compileObjectStates(o,script.actions,cues))
  ]));
  const tracks=Object.fromEntries((script.tracks??[]).map(t=>[t.id,valueAt(frame,compileValueTrack(t,cues))]));
  return <Canvas theme={{color:{red:parameters.accent??'#ff4e25'}}}>
    <AuthoredObjects frame={frame} cues={cues} states={states} tracks={tracks} parameters={parameters}/>
  </Canvas>;
}
