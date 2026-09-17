import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, expect, it} from 'vitest';
import {SegmentReviewStore, segmentRanges, segmentReviewState, assemblySegments, type SegmentRender} from './segment-reviews';
const dirs: string[]=[];
afterEach(async()=>{for(const d of dirs.splice(0)) await rm(d,{recursive:true,force:true});});
async function store(){const dir=await mkdtemp(join(tmpdir(),'segment-review-'));dirs.push(dir);return new SegmentReviewStore(join(dir,'reviews.json'));}
const a: SegmentRender={sceneId:'a',from:0,end:31,id:'render-a',key:'a-key',status:'done',url:'/render-a.mp4',pictureHash:'hash-a',revision:1,pendingMaterials:false,progress:1};
const b: SegmentRender={...a,sceneId:'b',from:31,end:60,id:'render-b',key:'b-key'};
it('covers opening, gaps and ending once at frame precision',()=>{
 expect(segmentRanges([{id:'a',startMs:100,endMs:900},{id:'b',startMs:1033.333,endMs:1800}],2000)).toEqual([{sceneId:'a',from:0,end:31},{sceneId:'b',from:31,end:60}]);
 expect(()=>segmentRanges([{id:'a',startMs:0,endMs:1200},{id:'b',startMs:1100,endMs:1500}],2000)).toThrow();
});
it('preserves separate render histories and approvals across restarts and concurrent saves',async()=>{
 const s=await store();await Promise.all([s.save(a),s.save(b)]); await s.approve('a',a.id,a.key);await s.approve('b',b.id,b.key);
 const ledger=await s.get();expect(ledger.renders).toHaveLength(2);expect(ledger.approvals).toHaveLength(2);
 await s.recover();expect((await s.get()).approvals).toEqual(ledger.approvals);
 const reviews=[a,b].map(r=>segmentReviewState(r,r.key,ledger.renders,ledger.approvals));expect(assemblySegments(reviews,60)).toHaveLength(2);
 // A change in B leaves A accepted, B's immutable old picture still available.
 const changed=segmentReviewState(b,'new-key',ledger.renders,ledger.approvals);
 expect(changed.status).toBe('changes');expect(changed.approved?.url).toBe(b.url);expect(reviews[0].status).toBe('approved');
 expect(()=>assemblySegments([reviews[0],changed],60)).toThrow();
});
it('rejects stale, incomplete and cross-scene confirmations, protects completed pictures',async()=>{
 const s=await store(); await s.save(a);
 await expect(s.approve('b',a.id,a.key)).rejects.toThrow();await expect(s.approve('a',a.id,'new-key')).rejects.toThrow();
 await expect(s.save({...a,url:'/overwritten.mp4'})).rejects.toThrow();
 await s.save({...b,pendingMaterials:true});await expect(s.approve('b',b.id,b.key)).rejects.toThrow();
});
it('new render does not overwrite accepted version; failed jobs recover without losing it',async()=>{
 const s=await store();await s.save(a);await s.approve('a',a.id,a.key);await s.save({...a,id:'new',key:'new',status:'rendering'});await s.recover();
 const ledger=await s.get();const review=segmentReviewState(a,'new',ledger.renders,ledger.approvals);
 expect(review.history).toHaveLength(2);expect(review.latest?.status).toBe('failed');expect(review.approved?.id).toBe(a.id);
});
it('open feedback blocks assembly and interval edits invalidate confirmation',()=>{
 const approved={...a,at:'now'};
 expect(segmentReviewState(a,a.key,[a],[approved],1).status).toBe('changes');
 expect(segmentReviewState({...a,end:32},a.key,[a],[approved]).approved?.current).toBe(false);
 expect(()=>assemblySegments([segmentReviewState(a,a.key,[a],[approved])],60)).toThrow();
});
