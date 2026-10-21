import {describe,it,expect,vi} from 'vitest';
import {DirectedNarration} from './scenes/DirectedNarration';
import {bindScenePrograms} from './scene-program-binding';
import {resolveProduction} from './production-binding';
import type {ProductionState} from './production-store';
import type {RoughcutState} from './roughcut-service';
const cut:RoughcutState={revision:2,asset:{url:'/cut-media/source.mp4',name:'test',durationMs:5000},ranges:[{startMs:1000,endMs:5000}],words:[{id:'a',text:'另一篇',startMs:1500,endMs:2000},{id:'b',text:'完全不同',startMs:2500,endMs:3000},{id:'c',text:'文稿',startMs:3500,endMs:4000}],preview:{url:'/cut-media/preview.mp4',revision:2},busy:false};
const plan:ProductionState={revision:1,source:{assetUrl:cut.asset!.url,cutRevision:2},scenes:[{id:'arbitrary-id',title:'新的内容',intent:'按口播展开',startWordId:'a',endWordId:'c',beats:[{wordId:'b',label:'重点'}],program:{moduleId:'custom',parameters:{accent:'#123456'}}}],requests:[],feedback:[]};
const modules={validate:async(p:any)=>({modulePath:'/local/custom.tsx',exportName:'Scene',sourceHash:'sha',resolvedParameters:p.parameters})};
const materialModules={validate:async(p:any)=>({modulePath:'/local/custom.tsx',exportName:'Scene',sourceHash:'sha',resolvedParameters:p.parameters,acceptsMaterials:true})};
vi.mock('remotion', async(importOriginal) => ({...await importOriginal<typeof import('remotion')>(), useCurrentFrame: () => 0}));
describe('custom scene binding',()=>{
 it('binds arbitrary ids and text to local frames after roughcut',async()=>{const [s]=await bindScenePrograms(plan,resolveProduction(plan,cut),modules);expect(s.from).toBe(15);expect(s.duration).toBe(75);expect(s.beats[0].frame).toBe(30);expect(s.words.map(w=>w.text)).toEqual(['另一篇','完全不同','文稿']);expect(s.parameters).toEqual({accent:'#123456'});});
 it('rejects unimplemented scenes, stale cuts and deleted beats',async()=>{await expect(bindScenePrograms({...plan,scenes:[{...plan.scenes[0],program:undefined}]},resolveProduction(plan,cut),modules)).rejects.toThrow('动画实现');await expect(bindScenePrograms(plan,resolveProduction(plan,{...cut,revision:3}),modules)).rejects.toThrow('同步');const changed={...plan,scenes:[{...plan.scenes[0],beats:[{wordId:'missing',label:'不存在'}]}]};await expect(bindScenePrograms(changed,resolveProduction(changed,cut),modules)).rejects.toThrow('引用词已删除');});
 it('does not silently discard supplied materials',async()=>{const p={...plan,requests:[{id:'asset',sceneId:'arbitrary-id',description:'画面',reason:'解释',status:'provided' as const,fileName:'test.png'}]};await expect(bindScenePrograms(p,resolveProduction(p,cut),modules)).rejects.toThrow('补充素材');});
 it('binds current animation slots by material id and ignores slots owned by another module',async()=>{
   const p={...plan,requests:[
     {id:'ordinary',sceneId:'arbitrary-id',description:'普通',reason:'普通',status:'provided' as const,fileName:'ordinary.png'},
     {id:'slot-request',sceneId:'arbitrary-id',description:'槽位',reason:'槽位',status:'provided' as const,fileName:'slot.png',animationSlot:{templateId:'f543988b-d9d3-4130-a7fc-37491b0f685d',moduleId:'custom',materialId:'saved-material'}},
     {id:'stale-slot',sceneId:'arbitrary-id',description:'旧槽位',reason:'旧',status:'provided' as const,fileName:'stale.png',animationSlot:{templateId:'f543988b-d9d3-4130-a7fc-37491b0f685d',moduleId:'other-module',materialId:'ignored'}},
   ]};
   const [bound]=await bindScenePrograms(p,resolveProduction(p,cut),materialModules);
   expect(bound.materials).toEqual([
     {id:'ordinary',src:'ordinary.png',kind:'image'},
     {id:'saved-material',src:'slot.png',kind:'image'},
   ]);
 });
 it('rejects an unprovided current animation slot and duplicate effective ids',async()=>{
   const missing={...plan,requests:[{id:'slot',sceneId:'arbitrary-id',description:'槽位',reason:'槽位',status:'missing' as const,animationSlot:{templateId:'f543988b-d9d3-4130-a7fc-37491b0f685d',moduleId:'custom',materialId:'same'}}]};
   await expect(bindScenePrograms(missing,resolveProduction(missing,cut),materialModules)).rejects.toThrow('尚未提供');
   const duplicate={...plan,requests:[
     {id:'same',sceneId:'arbitrary-id',description:'普通',reason:'普通',status:'provided' as const,fileName:'a.png'},
     {id:'slot',sceneId:'arbitrary-id',description:'槽位',reason:'槽位',status:'provided' as const,fileName:'b.png',animationSlot:{templateId:'f543988b-d9d3-4130-a7fc-37491b0f685d',moduleId:'custom',materialId:'same'}},
   ]};
   await expect(bindScenePrograms(duplicate,resolveProduction(duplicate,cut),materialModules)).rejects.toThrow('编号重复');
 });
});

describe('directed narration binding preflight',()=>{
 const branches: [number, number[]][] = [
   [1,[23,28,31,36]], [2,[49,52]], [4,[124]], [5,[]], [6,[142,145]],
   [7,[153,156,158,161]], [8,[189,191,196]], [9,[209,211,214]],
   [10,[235,241,243,245,248,279]], [11,[327,343]], [12,[345,348]],
 ];
 function dedicated(branch:number,cues:number[]) {
   const ids=(cues.length?cues:[100]).map(n=>'dji-word-'+n);
   const words=ids.map((id,i)=>({id,text:'词'+i,startMs:100+i*200,endMs:200+i*200}));
   const c:RoughcutState={...cut,ranges:[{startMs:0,endMs:5000}],words};
   const p:ProductionState={...plan,scenes:[{...plan.scenes[0],id:'dji-scene-'+branch,startWordId:ids[0],endWordId:ids.at(-1)!,
     beats:cues.map((n,i)=>({wordId:'dji-word-'+n,label:'动作'+i})),
     program:{moduleId:'directed-narration',parameters:{labels:branch===1?'甲|乙|丙|丁':'甲|乙|丙|丁|戊'}}}]};
   return {p,c};
 }
 it.each(branches)('preserves original branch %i and supplies every cue used by its actual renderer',async(branch,cues)=>{
   const {p,c}=dedicated(branch,cues);
   const [bound]=await bindScenePrograms(p,resolveProduction(p,c),modules);
   expect(()=>DirectedNarration({...bound,materials:[]})).not.toThrow();
   // A source word alone is insufficient: each required cue must be an action beat.
   for(const cue of cues) {
     const changed={...p,scenes:[{...p.scenes[0],beats:p.scenes[0].beats.filter(b=>b.wordId!=='dji-word-'+cue)}]};
     await expect(bindScenePrograms(changed,resolveProduction(changed,c),modules)).rejects.toThrow('dji-word-'+cue);
   }
 });
 it('rejects unsupported scene IDs and unrelated beats before the Player can render',async()=>{
   for(const id of ['new-scene','scene-3','scene-13']) {
     const p={...plan,scenes:[{...plan.scenes[0],id,program:{moduleId:'directed-narration',parameters:{}}}]};
     await expect(bindScenePrograms(p,resolveProduction(p,cut),modules)).rejects.toThrow('没有对应分镜');
   }
   const p={...plan,scenes:[{...plan.scenes[0],id:'new-1',program:{moduleId:'directed-narration',parameters:{}}}]};
   await expect(bindScenePrograms(p,resolveProduction(p,cut),modules)).rejects.toThrow('缺少专用动作节拍：dji-word-23');
 });
 it('rejects labels that would index past branch 1 cue slots, including user overrides',async()=>{
   const {p,c}=dedicated(1,[23,28,31,36]);
   p.scenes[0].editor={overrides:{labels:'一|二|三|四|五'},locks:['labels']};
   await expect(bindScenePrograms(p,resolveProduction(p,c),modules)).rejects.toThrow('最多支持 4 条文字');
 });
 it('leaves saved animation wrappers free to remap new IDs and words',async()=>{
   const p={...plan,scenes:[{...plan.scenes[0],program:{moduleId:'saved-f543988b-d9d3-4130-a7fc-37491b0f685d',parameters:{}}}]};
   const [bound]=await bindScenePrograms(p,resolveProduction(p,cut),modules);
   expect(bound.id).toBe('arbitrary-id');
   expect(bound.beats[0].wordId).toBe('b');
 });
});
