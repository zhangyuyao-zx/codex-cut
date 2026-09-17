import type {ProductionState,Scene} from './production-store';

/** Incoming transitions read only the preceding plain scene, never its entry transition. */
export function previousTransitionScene(plan:Pick<ProductionState,'scenes'>,sceneId:string):Scene|undefined {
  const index=plan.scenes.findIndex(s=>s.id===sceneId);
  if(index<1 || !plan.scenes[index].entryTransition) return undefined;
  return plan.scenes[index-1];
}
export function withoutEntryTransition(scene:Scene):Scene {
  const {entryTransition:unused,...plain}=scene;
  if(!scene.editor)return plain;
  const {entryTransition:unusedUserChoice,...editor}=scene.editor;
  return {...plain,editor};
}
export function transitionRenderPlan(plan:ProductionState,sceneId?:string):ProductionState {
  if(!sceneId)return plan;
  const selected=plan.scenes.find(s=>s.id===sceneId);
  if(!selected)throw Error('段落不存在');
  const previous=previousTransitionScene(plan,sceneId);
  const ids=new Set([sceneId,...previous?[previous.id]:[]]);
  return {...plan,scenes:plan.scenes.filter(s=>ids.has(s.id)).map(s=>s.id===sceneId?s:withoutEntryTransition(s)),
    requests:plan.requests.filter(r=>ids.has(r.sceneId)),feedback:plan.feedback.filter(f=>f.sceneId===sceneId)};
}

export function assertTransitionPredecessors(plan:Pick<ProductionState,'scenes'>):void {
  for(const scene of plan.scenes) {
    if(!scene.entryTransition)continue;
    if(!scene.program)throw Error('完整场景转场需要明确的动画实现');
    const previous=previousTransitionScene(plan,scene.id);
    if(previous&&!previous.program)throw Error(`「${scene.title}」的衔接需要先完成上一段「${previous.title}」的动画实现`);
  }
}
