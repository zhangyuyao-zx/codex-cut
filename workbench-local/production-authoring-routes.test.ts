import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import express from 'express';
import request from 'supertest';
import {it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({cut:null as any}));
vi.mock('./roughcut-service',async importOriginal=>({...await importOriginal<any>(),createRoughcutService:async()=>({get:async()=>structuredClone(fixture.cut),verifyPreview:async()=>{}})}));
vi.mock('./render-runtime-identity',()=>({renderRuntimeIdentity:async()=> 'runtime-test'}));
import {productionRoutes} from './production-routes';
import {createProductionStore} from './production-store';
import {SegmentReviewStore} from './segment-reviews';

it.each([1,2])('native API refuses render, approval and assembly for an incomplete schema %i project',async(schemaVersion)=>{
 const project=await mkdtemp(path.join(tmpdir(),'authoring-api-'));
 let routes:Awaited<ReturnType<typeof productionRoutes>>|undefined;
 try{
  await writeFile(path.join(project,'content-project.json'),JSON.stringify({version:1,contentId:'C20261108-001',name:'Isolated fixture'}));
  await mkdir(path.join(project,'production'));
  await writeFile(path.join(project,'production/authoring.json'),JSON.stringify({schemaVersion,method:'dots',contentId:'C20261108-001',film:'',scenes:[]}));
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

it('the actual render endpoint enforces image confirmation even when design preparation is valid',async()=>{
 const project=await mkdtemp(path.join(tmpdir(),'storyboard-api-'));
 let routes:Awaited<ReturnType<typeof productionRoutes>>|undefined;
 try{
  await writeFile(path.join(project,'content-project.json'),JSON.stringify({version:1,contentId:'C20261108-001',name:'Isolated static checkpoint test'}));
  await mkdir(path.join(project,'production'));
  const ref=path.join(project,'reference.mp4'),bytes='synthetic reference fixture';await writeFile(ref,bytes);
  await writeFile(path.join(project,'production/authoring.json'),JSON.stringify({schemaVersion:2,method:'dots',contentId:'C20261108-001',assets:{},references:{ref:{file:ref,sha256:createHash('sha256').update(bytes).digest('hex'),from:0,to:1,learn:'Synthetic test',avoid:'Not real viewing'}},scenes:[{sceneId:'scene',visualTask:'Synthetic design task',mediaMode:'abstract',selectionReason:'Synthetic test',assetIds:[],referenceIds:['ref'],prototypeSceneId:'scene'}],reviews:{},comparisons:[]}));
  fixture.cut={revision:3,asset:{url:'/cut-media/source.mp4',name:'fixture',durationMs:1000},words:[{id:'a',text:'开始',startMs:0,endMs:500},{id:'b',text:'结尾',startMs:500,endMs:1000}],ranges:[{startMs:0,endMs:1000}],busy:false,preview:{url:'/cut-media/preview.mp4',revision:3}};
  const store=await createProductionStore(path.join(project,'production'));
  await store.setScenes(0,{assetUrl:fixture.cut.asset.url,cutRevision:3},[{id:'scene',title:'Test',intent:'Test',startWordId:'a',endWordId:'b',beats:[],program:{moduleId:'editable-title',parameters:{}}}]);
  routes=await productionRoutes(process.cwd(),project,{detail:vi.fn()} as any);
  const app=express();app.use(express.json());app.use('/api/production',routes);app.use((error:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(409).json({error:error.message}));
  // Use the same scoped authoring inspection as preview/static design preparation.
  const context=(await request(app).get('/api/production/context?sceneId=scene')).body;
  expect(context.authoring.ok,JSON.stringify(context.authoring.errors)).toBe(true);
  const result=await request(app).post('/api/production/render').send({sceneId:'scene',expectedRevision:1});
  expect(result.status).toBe(409);expect(result.body.error).toContain('一张能代表最终效果');
  expect((await new SegmentReviewStore(path.join(project,'production/segment-reviews.json')).get()).renders).toEqual([]);
 }finally{await routes?.shutdown();await rm(project,{recursive:true,force:true});}
});
