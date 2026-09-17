import {resolve} from "node:path";
/** Shared generated Remotion composition. Fingerprint this picture code, not HTTP/editor plumbing. */
export function productionCompositionSource(root: string, props: any, imports: string, renderers: string, moduleImports: string, moduleRenderers: string) {
  return `import React from 'react';
import {Composition, registerRoot, Sequence, AbsoluteFill,OffthreadVideo,staticFile,Freeze} from 'remotion';
import {ProductionProgram} from ${JSON.stringify(resolve(root, "workbench-local/ProductionProgram.tsx"))};
import {ComponentSurface} from ${JSON.stringify(resolve(root, "workbench-local/ComponentSurface.tsx"))};
import {SceneModuleSurface} from ${JSON.stringify(resolve(root, "workbench-local/SceneModuleSurface.tsx"))};
import {SceneTransitionSurface} from ${JSON.stringify(resolve(root, "workbench-local/SceneTransitionSurface.tsx"))};
${imports}
${moduleImports}
const sceneRenderers=[${moduleRenderers}];
const renderers=[${renderers}];
const sceneLayers=(p,s)=> (Array.isArray(p.componentLayers)?p.componentLayers:[]).map((l,i)=>({...l,renderer:renderers[i]})).filter(l=>l.sceneId?s.id===l.sceneId:(l.from>=s.from&&l.from<s.from+(s.duration??0)));
const sceneInput=(p,s)=>({...s,componentLayers:sceneLayers(p,s)});
const sceneSurface=(p,s,i)=>{
 const outgoing=s.transitionFromSceneId?p.scenePrograms?.find(x=>x.id===s.transitionFromSceneId):undefined;
 const outgoingIndex=outgoing?p.scenePrograms.indexOf(outgoing):-1;
 const outgoingInput=outgoing&&outgoingIndex>=0?{renderer:sceneRenderers[outgoingIndex],scene:sceneInput(p,outgoing),frame:s.transitionOutgoingFrame??Math.max(0,outgoing.duration-1)}:undefined;
 const input=sceneInput(p,s);
 return s.entryTransition&&outgoingInput?<SceneTransitionSurface renderer={sceneRenderers[i]} scene={input} outgoing={outgoingInput} includeAudio/>:<SceneModuleSurface renderer={sceneRenderers[i]} scene={input} includeAudio/>;
};
const Program=(p)=><AbsoluteFill>{p.scenePrograms?.length?<>{p.scenePrograms[0].from>0&&<Sequence durationInFrames={p.scenePrograms[0].from}><Freeze frame={0}><SceneModuleSurface renderer={sceneRenderers[0]} scene={sceneInput(p,p.scenePrograms[0])}/></Freeze></Sequence>}{p.scenePrograms.map((s,i)=><Sequence key={s.id} from={s.from} durationInFrames={Math.max(s.duration,(p.scenePrograms[i+1]?.from??p.duration)-s.from)}>{sceneSurface(p,s,i)}</Sequence>)}</>:<ProductionProgram {...p}/>} {!p.scenePrograms?.length&&(Array.isArray(p.componentLayers)?p.componentLayers:[]).map((l,i)=><Sequence key={l.id} from={l.from} durationInFrames={l.duration}><ComponentSurface renderer={renderers[i]} values={l.props} {...l}/></Sequence>)}{p.scenePrograms?.length&&p.pendingMaterials&&<div style={{position:"absolute",bottom:30,right:30,color:"#fff",background:"#1b1b1b",padding:12}}>审阅草稿 · 有素材待补</div>}</AbsoluteFill>;
registerRoot(()=> <Composition id="Production" component={Program} durationInFrames={${props.duration}} width={1920} height={1080} fps={30} defaultProps={${JSON.stringify(props)}}/>);`;
}
