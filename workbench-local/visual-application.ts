import {findCutWord} from './roughcut-service';
import {memberKey,resolveVisualValues,styleValuesFor,type VisualAsset,type StylePack,type VisualControl,type VisualValue} from './visual-library-contract';
import type {ProductionState,Scene} from './production-store';
import {preserveSceneEdits} from './editable-objects';
import {resolveSceneModuleParameters,type SceneModuleDetail,type SceneModuleControl} from './scene-modules';

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

export type StyleCoverageEntry = {
  sceneId:string;title:string;status:'mapped'|'partial'|'unmapped'|'unimplemented'|'conflict';
  mapped:string[];preserved:string[];missing:string[];reason:string;
};
export type StyleCoverage = {total:number;mapped:number;partial:number;unmapped:number;preserved:number;scenes:StyleCoverageEntry[]};

/** Bindings are an opt-in vocabulary, not a requirement to use a pack's scene templates. */
export function boundStyleValues(bindings:Readonly<Record<string,string>>|undefined,pack:StylePack){
  return Object.fromEntries(Object.entries(bindings??{}).filter(([,token])=>Object.hasOwn(pack.tokens,token)).map(([parameter,token])=>[parameter,pack.tokens[token]]));
}

/** Changing a pack changes defaults only. Existing explicit parameters and user locks keep precedence. */
export function planStyleApplication(plan:ProductionState,pack:StylePack,assets:VisualAsset[],modules:readonly SceneModuleDetail[]=[]){
  const affected:string[]=[],conflicts:string[]=[],entries:StyleCoverageEntry[]=[];
  const assetFor=(id:string)=>assets.find(a=>a.moduleId===id||'visual:'+memberKey(a)===id);
  const scenes=plan.scenes.map(scene=>{
    const entry:StyleCoverageEntry={sceneId:scene.id,title:scene.title,status:'unmapped',mapped:[],preserved:[],missing:[],reason:''};
    try{
      let next:Scene={...scene};let primaryMapped=false;let changed=false;
      const apply=(definition:{controls:readonly SceneModuleControl[];styleBindings?:Readonly<Record<string,string>>},defaults:Record<string,VisualValue>,explicit:Record<string,unknown>,overrides:Record<string,unknown>={},prefix='')=>{
        resolveSceneModuleParameters(definition.controls,{...defaults,...explicit,...overrides});
        for(const [key,token] of Object.entries(definition.styleBindings??{}))if(!Object.hasOwn(pack.tokens,token)&&!Object.hasOwn(defaults,key))entry.missing.push(prefix+key);
        for(const [key,value] of Object.entries(defaults)){
          entry.mapped.push(prefix+key);
          const effective=Object.hasOwn(overrides,key)?overrides[key]:Object.hasOwn(explicit,key)?explicit[key]:value;
          if(JSON.stringify(effective)!==JSON.stringify(value))entry.preserved.push(prefix+key);
        }
        return defaults;
      };
      if(scene.program){
        const a=assetFor(scene.program.moduleId),m=modules.find(m=>m.id===scene.program!.moduleId);
        const definition=a??m;
        if(definition){
          const defaults=a?styleValuesFor(a,pack):boundStyleValues(m?.styleBindings,pack);
          if(Object.keys(defaults).length){
            next={...next,program:{...scene.program,styleDefaults:apply(definition,defaults,scene.program.parameters,scene.editor?.overrides)}};
            primaryMapped=changed=true;
          }else for(const key of Object.keys(definition.styleBindings??{}))entry.missing.push(key);
        }
      }
      if(scene.components)next.components=scene.components.map(c=>{
        const a=assetFor(c.componentId);if(!a)return c;
        const defaults=styleValuesFor(a,pack);if(!Object.keys(defaults).length)return c;
        changed=true;return {...c,styleDefaults:apply(a,defaults,c.props,{},c.id+'.')};
      });
      if(changed)affected.push(scene.title);
      entry.status=!scene.program?'unimplemented':!changed?'unmapped':!primaryMapped||entry.missing.length||entry.preserved.length?'partial':'mapped';
      entry.reason=entry.status==='unimplemented'?'尚未实现画面，可直接按此风格原创':entry.status==='unmapped'?'保持现有画面，需由 Codex 按风格适配':entry.status==='partial'?entry.preserved.length?'已映射样式；保留已有设置，需检查实际效果':'部分样式已映射，其余需适配':'样式参数已映射；构图、动作与声音仍需实际审阅';
      entries.push(entry);return next;
    }catch(e){
      entry.status='conflict';entry.reason=(e as Error).message;entries.push(entry);
      conflicts.push(scene.title+'：'+entry.reason);return scene;
    }
  });
  const coverage:StyleCoverage={total:entries.length,mapped:entries.filter(e=>e.status==='mapped').length,partial:entries.filter(e=>e.status==='partial').length,unmapped:entries.filter(e=>['unmapped','unimplemented','conflict'].includes(e.status)).length,preserved:entries.filter(e=>e.preserved.length).length,scenes:entries};
  return {affected,conflicts,coverage,brief:{typography:pack.typography,motion:pack.motion,composition:pack.composition,sound:pack.sound,coverage:pack.coverage,limitations:pack.limitations},selection:{id:pack.id,version:pack.version,name:pack.name,status:pack.status},scenes:preserveSceneEdits(plan.scenes,scenes,'codex')};
}
