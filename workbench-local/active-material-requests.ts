import type {MaterialRequest, ProductionState} from './production-store';
/** Animation slots belong to a specific scene implementation; inactive historical slots never enter picture dependencies. */
export function activeMaterialRequests(plan:Pick<ProductionState,'scenes'|'requests'>):MaterialRequest[]{
  const modules=new Map(plan.scenes.map(scene=>[scene.id,scene.program?.moduleId]));
  return plan.requests.filter(request=>!request.animationSlot || modules.get(request.sceneId)===request.animationSlot.moduleId);
}
