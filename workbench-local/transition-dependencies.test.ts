import {describe,it,expect} from 'vitest';
import {previousTransitionScene,transitionRenderPlan,assertTransitionPredecessors} from './transition-dependencies';
import {preserveSceneEdits} from './editable-objects';
import type {ProductionState} from './production-store';
describe('incoming transition dependency isolation',()=>{
  it('reads previous plain scene only; direct cuts remain isolated; input is unchanged',()=>{
    const plan={scenes:[{id:'a',entryTransition:{type:'dissolve',frames:6}},{id:'b',entryTransition:{type:'slide-left',frames:8}},{id:'c'}],requests:[{id:'ra',sceneId:'a'},{id:'rb',sceneId:'b'},{id:'rc',sceneId:'c'}],feedback:[]} as unknown as ProductionState;
    const before=structuredClone(plan),b=transitionRenderPlan(plan,'b');
    expect(b.scenes.map(s=>s.id)).toEqual(['a','b']);expect(b.scenes[0].entryTransition).toBeUndefined();expect(b.scenes[1].entryTransition).toEqual(plan.scenes[1].entryTransition);
    expect(b.requests.map(r=>r.id)).toEqual(['ra','rb']);expect(transitionRenderPlan(plan,'c').scenes.map(s=>s.id)).toEqual(['c']);
    expect(()=>assertTransitionPredecessors({scenes:[{id:'a',title:'旧段'}, {id:'b',title:'新段',program:{moduleId:'test',parameters:{}},entryTransition:{type:'dissolve',frames:8}}] as any})).toThrow('上一段');
    const user={id:'b',title:'B',program:{moduleId:'old'},editor:{overrides:{},locks:[],entryTransition:null},entryTransition:undefined};
    const protectedScene=preserveSceneEdits([user],[{id:'b',program:{moduleId:'new'},entryTransition:{type:'dissolve',frames:8}}])[0];
    expect(protectedScene.entryTransition).toBeUndefined();expect(protectedScene.editor.entryTransition).toBeNull();
    expect(()=>preserveSceneEdits([user],[])).toThrow('用户调整');
    expect(previousTransitionScene(plan,'a')).toBeUndefined();expect(transitionRenderPlan(plan)).toBe(plan);expect(plan).toEqual(before);
  });
});
