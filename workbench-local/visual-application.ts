import {findCutWord} from './roughcut-service';
import {memberKey,resolveVisualValues,styleValuesFor,type VisualAsset,type StylePack} from './visual-library-contract';
import type {ProductionState,Scene} from './production-store';
import {preserveSceneEdits} from './editable-objects';

/** Semantic event names survive different transcripts; word identities own the actual clock. */
export function resolveVisualCues(cues:readonly {id:string;label:string;required:boolean}[],bindings:Record<string,string>={},words:any[],startMs:number,endMs:number){
  for(const id of Object.keys(bindings))if(!cues.some(c=>c.id===id))throw Error('未知动画事件：'+id);
  return cues.flatMap(c=>{
    const wordId=bindings[c.id];if(!wordId){if(c.required)throw Error('请绑定出现点：'+c.label);return [];}
    const word=findCutWord(words,wordId);
    if(!word)throw Error('动画事件引用的词已删除，请重新绑定：'+c.label);
    if(word.startMs<startMs||word.startMs>=endMs)throw Error('动画事件必须位于当前段落内：'+c.label);
    return [{wordId:word.sourceId,label:c.id,timeMs:word.startMs}];
  });
}

/** Changing a pack changes defaults only. Explicit parameters and user overrides keep precedence. */
export function planStyleApplication(plan:ProductionState,pack:StylePack,assets:VisualAsset[]){
  const affected:string[]=[],conflicts:string[]=[];
  const assetFor=(id:string)=>assets.find(a=>a.moduleId===id||'visual:'+memberKey(a)===id);
  const apply=(asset:VisualAsset,explicit:Record<string,unknown>,overrides:Record<string,unknown>={})=>{
    const defaults=styleValuesFor(asset,pack);
    resolveVisualValues(asset.controls,{...defaults,...explicit,...overrides});return defaults;
  };
  const scenes=plan.scenes.map(scene=>{
    try{
      let next:Scene={...scene};let changed=false;
      const a=scene.program&&assetFor(scene.program.moduleId);
      if(a&&pack.members.some(m=>memberKey(m)===memberKey(a))){next={...next,program:{...scene.program!,styleDefaults:apply(a,scene.program!.parameters,scene.editor?.overrides)}};changed=true;}
      if(scene.components)next.components=scene.components.map(c=>{
        const a=assetFor(c.componentId);if(!a||!pack.members.some(m=>memberKey(m)===memberKey(a)))return c;
        changed=true;return {...c,styleDefaults:apply(a,c.props)};
      });
      if(changed)affected.push(scene.title);return next;
    }catch(e){conflicts.push(scene.title+'：'+(e as Error).message);return scene;}
  });
  return {affected,conflicts,selection:{id:pack.id,version:pack.version,name:pack.name,status:pack.status},scenes:preserveSceneEdits(plan.scenes,scenes,'codex')};
}
