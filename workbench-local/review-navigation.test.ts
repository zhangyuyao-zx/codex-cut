import {expect,it} from 'vitest';
import {sceneEntry,completedReview,type ReviewRequest} from './review-navigation';
const task={id:'render-1',key:'key-1',status:'done',current:true,url:'/sample.mp4',from:120};
const context={resolved:{scenes:[{id:'scene',startMs:4200,endMs:8000}]},segmentReviews:[{sceneId:'scene',latest:task}],job:{...task,id:'assembly-1'}};
const request:ReviewRequest={kind:'segment',id:task.id,key:task.key,sceneId:'scene'};
it('opens current sample at its real media range while explicit frame selection edits the frame',()=>{
  expect(sceneEntry(context,'scene')).toMatchObject({view:'sample',seconds:4});
  expect(sceneEntry(context,'scene',210)).toMatchObject({view:'scene',seconds:7,frame:210});
  expect(sceneEntry(context,'scene',999)?.seconds).toBeLessThan(8);
  expect(sceneEntry(context,'missing')).toBeNull();
});
it('never defaults to a failed or historical render when entering a scene',()=>{
  for(const patch of [{status:'failed'},{current:false},{url:''}])expect(sceneEntry({...context,segmentReviews:[{sceneId:'scene',latest:{...task,...patch}}]},'scene')?.view).toBe('scene');
});
it('opens only the requested completed current task and ignores superseded work or a changed scene',()=>{
  expect(completedReview(request,context,'scene')).toMatchObject({state:'ready',view:'sample'});
  expect(completedReview(request,context,'other')).toEqual({state:'obsolete'});
  for(const patch of [{id:'newer'},{key:'changed'},{current:false},{status:'cancelled'},{status:'failed'}])expect(completedReview(request,{...context,segmentReviews:[{sceneId:'scene',latest:{...task,...patch}}]},'scene')).toEqual({state:'obsolete'});
  expect(completedReview(request,{...context,segmentReviews:[{sceneId:'scene',latest:{...task,status:'rendering'}}]},'scene')).toEqual({state:'waiting'});
});
it('opens the matching assembly and rejects an obsolete assembly identity',()=>{
  expect(completedReview({kind:'assembly',id:'assembly-1',key:task.key},context,'scene')).toMatchObject({state:'ready',view:'review'});
  expect(completedReview({kind:'assembly',id:'older-assembly',key:task.key},context,'scene')).toEqual({state:'obsolete'});
});
