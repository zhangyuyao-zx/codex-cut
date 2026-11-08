import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import {it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({cut:null as any}));
vi.mock('./roughcut-service',async importOriginal=>({...await importOriginal<any>(),createRoughcutService:async()=>({get:async()=>structuredClone(fixture.cut),verifyPreview:async()=>{}})}));
vi.mock('./render-runtime-identity',()=>({renderRuntimeIdentity:async()=> 'runtime-test'}));
import {productionRoutes} from './production-routes';
import {createProductionStore} from './production-store';
import {SegmentReviewStore} from './segment-reviews';

it('native API refuses render, approval and assembly when the authoring package is incomplete',async()=>{
 const project=await mkdtemp(path.join(tmpdir(),'authoring-api-'));
 let routes:Awaited<ReturnType<typeof productionRoutes>>|undefined;
 try{
  await writeFile(path.join(project,'content-project.json'),JSON.stringify({version:1,contentId:'C20261108-001',name:'Isolated fixture'}));
  await mkdir(path.join(project,'production'));
  await writeFile(path.join(project,'production/authoring.json'),JSON.stringify({schemaVersion:1,method:'dots',contentId:'C20261108-001',film:'',scenes:[]}));
  fixture.cut={revision:3,asset:{url:'/cut-media/source.mp4',name:'fixture',durationMs:1000},words:[{id:'a',text:'开始',startMs:0,endMs:500},{id:'b',text:'结尾',startMs:500,endMs:1000}],ranges:[{startMs:0,endMs:1000}],busy:false,preview:{url:'/cut-media/preview.mp4',revision:3}};
  const store=await createProductionStore(path.join(project,'production'));
  await store.setScenes(0,{assetUrl:fixture.cut.asset.url,cutRevision:3},[{id:'scene',title:'Test',intent:'Test',startWordId:'a',endWordId:'b',beats:[],program:{moduleId:'editable-title',parameters:{}}}]);
  routes=await productionRoutes(process.cwd(),project,{detail:vi.fn()} as any);
  const app=express();app.use(express.json());app.use('/api/production',routes);app.use((error:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(409).json({error:error.message}));
  const get=async()=>(await request(app).get('/api/production')).body;
  const c=await get();expect(c.authoring).toMatchObject({required:true,ok:false});
  const ledger=new SegmentReviewStore(path.join(project,'production/segment-reviews.json'));
  await ledger.save({id:'fixture',sceneId:'scene',key:c.segmentReviews[0].key,from:0,end:30,status:'done',revision:1,progress:1,pendingMaterials:false,url:'/production-media/renders/fixture/review.mp4',pictureHash:'0'.repeat(64)});
  for(const [url,body] of [
   ['/render',{sceneId:'scene',expectedRevision:1}],
   ['/approve-sample',{sceneId:'scene',renderId:'fixture',key:c.segmentReviews[0].key}],
   ['/assemble',{expectedRevision:1}],
  ] as const){const result=await request(app).post('/api/production'+url).send(body);expect(result.status).toBe(409);expect(result.body.error).toContain('制作流程未完成');}
  expect((await ledger.get()).approvals).toEqual([]);
  // Even a historical approved ledger cannot make an incomplete current package assembly-ready.
  await ledger.approve('scene','fixture',c.segmentReviews[0].key);
  const after=await get();expect(after.assemblyReady).toBe(false);expect(after.sample).toBeNull();expect(after.job).toBeNull();
  expect(after.authoringReviews.scene.ok).toBe(false);
 }finally{await routes?.shutdown();await rm(project,{recursive:true,force:true});}
});
