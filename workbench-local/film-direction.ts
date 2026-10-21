import type {Scene} from './production-store';

export type CompositionComparison={sceneId:string;withSceneId:string;message:string};
const normalize=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');

/** An editorial prompt based on authored structure, never an aesthetic verdict. */
export function compositionComparisons(scenes:readonly Scene[]):CompositionComparison[]{
  const seen=new Map<string,{id:string;index:number}>(),result:CompositionComparison[]=[];
  scenes.forEach((scene,index)=>{
    if(!scene.design?.objects.length)return;
    const signature=JSON.stringify({relationship:normalize(scene.design.relationship),
      objects:scene.design.objects.map(object=>({role:object.role,layout:normalize(object.layout)})),
      actions:scene.design.actions.map(action=>({action:normalize(action.action),before:normalize(action.before??''),after:normalize(action.after??'')}))});
    const previous=seen.get(signature);
    if(previous)result.push({sceneId:scene.id,withSceneId:previous.id,
      message:`与第 ${previous.index+1} 段的布局和动作描述相同，请对照实际画面；有意复用可以保留。`});
    else seen.set(signature,{id:scene.id,index});
  });
  return result;
}
