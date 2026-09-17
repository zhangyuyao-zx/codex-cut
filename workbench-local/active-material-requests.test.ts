import {expect,it} from 'vitest';
import {activeMaterialRequests} from './active-material-requests';
import type {Scene,MaterialRequest} from './production-store';
it('keeps normal requests and current animation slots but excludes detached historical slots without deleting state',()=>{
  const scene:Scene={id:'a',title:'A',intent:'A',startWordId:'start',endWordId:'end',beats:[],program:{moduleId:'current',parameters:{}}};
  const ordinary:MaterialRequest={id:'normal',sceneId:'a',description:'normal',reason:'normal',status:'missing'};
  const current:MaterialRequest={...ordinary,id:'current-slot',animationSlot:{moduleId:'current',templateId:'d42fa4bf-9555-4caa-b5ec-14ed30324125',materialId:'left'}};
  const detached:MaterialRequest={...current,id:'detached-slot',animationSlot:{...current.animationSlot!,moduleId:'previous'}};
  const plan={scenes:[scene],requests:[ordinary,current,detached]};expect(activeMaterialRequests(plan)).toEqual([ordinary,current]);expect(plan.requests).toHaveLength(3);
  expect(activeMaterialRequests({...plan,scenes:[{...scene,program:undefined}]})).toEqual([ordinary]);
  expect(activeMaterialRequests({...plan,scenes:[{...scene,program:{moduleId:'previous',parameters:{}}}]})).toEqual([ordinary,detached]);
});
