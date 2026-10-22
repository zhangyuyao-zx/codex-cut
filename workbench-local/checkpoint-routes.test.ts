import {it,expect} from 'vitest';
import express from 'express';
import request from 'supertest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {checkpointRoutes} from './checkpoint-routes';

it('creates, verifies and restores a fixed pair without accepting browser paths or overwriting the project',async()=>{
  const root=await mkdtemp('/private/tmp/checkpoint-route-');
  try{
    const repo=path.join(root,'repo'),project=path.join(root,'project');
    await mkdir(path.join(repo,'workbench-local'),{recursive:true});await mkdir(path.join(project,'cut'),{recursive:true});
    await writeFile(path.join(repo,'workbench-local','example.ts'),'original code');await writeFile(path.join(project,'cut','source.mp4'),'original media');
    await writeFile(path.join(repo,'package.json'),JSON.stringify({version:'0.2.3'}));
    await writeFile(path.join(project,'cut','roughcut.json'),JSON.stringify({state:{revision:4}}));
    const routes=checkpointRoutes({repo,project,assertIdle:async()=>{}}),app=express();app.use(express.json());app.use('/api/checkpoints',routes);
    app.use((e:any,_req:any,res:any,_next:any)=>res.status(409).json({error:e.message}));
    const started=await request(app).post('/api/checkpoints/create').send({destination:project,label:'  客户版  ',source:{workbenchVersion:'9.0.0'},contentIdentity:{code:'forged'}});expect(started.status).toBe(200);
    await routes.waitForIdle();
    expect((await request(app).get('/api/checkpoints/task')).body.task.status).toBe('done');
    let result=(await request(app).get('/api/checkpoints')).body;expect(result.task.status).toBe('done');expect(result.items).toHaveLength(1);
    expect(result.items[0].label).toBe('客户版');expect(result.items[0].source).toEqual({workbenchVersion:'0.2.3',cutRevision:4});
    expect(result.items[0].contentIdentity).toEqual(result.task.contentIdentity);
    expect(result.task.label).toBe('客户版');
    const id=result.items[0].id;expect(result.items[0].path).not.toBe(project);
    expect((await request(app).post('/api/checkpoints/verify').send({id:'../project'})).status).toBe(409);
    await request(app).post('/api/checkpoints/verify').send({id});await routes.waitForIdle();expect((await request(app).get('/api/checkpoints')).body.task.verified).toBe(true);
    await writeFile(path.join(project,'cut','source.mp4'),'changed original');
    await request(app).post('/api/checkpoints/restore').send({id,destination:project});await routes.waitForIdle();result=(await request(app).get('/api/checkpoints')).body;
    expect(result.task.status).toBe('done');expect(await readFile(path.join(result.task.path,'project','cut','source.mp4'),'utf8')).toBe('original media');expect(await readFile(path.join(project,'cut','source.mp4'),'utf8')).toBe('changed original');
    expect(result.task.label).toBe('客户版');expect(result.task.source.cutRevision).toBe(4);
    const manifestPath=path.join(result.items[0].path,'checkpoint.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
    await writeFile(manifestPath,JSON.stringify({...manifest,contentIdentity:{...manifest.contentIdentity,code:'0'.repeat(64)}}));
    expect((await request(app).get('/api/checkpoints')).body.items).toEqual([]);
    delete manifest.label;delete manifest.source;delete manifest.contentIdentity;
    await writeFile(manifestPath,JSON.stringify(manifest));
    const legacy=(await request(app).get('/api/checkpoints')).body.items;
    expect(legacy).toHaveLength(1);expect(legacy[0].label).toBeUndefined();expect(legacy[0].source).toBeUndefined();
    await request(app).post('/api/checkpoints/restore').send({id});await routes.waitForIdle();
    expect((await request(app).get('/api/checkpoints/task')).body.task.status).toBe('done');
  }finally{await rm(root,{recursive:true,force:true});}
});

it('rejects invalid labels synchronously without admitting a task or exposing supplied metadata',async()=>{
  const root=await mkdtemp('/private/tmp/checkpoint-route-label-');
  try{
    let admissions=0;
    const routes=checkpointRoutes({repo:path.join(root,'repo'),project:path.join(root,'project'),assertIdle:async()=>{admissions++;}});
    const app=express();app.use(express.json());app.use(routes);app.use((e:any,_req:any,res:any,_next:any)=>res.status(409).json({error:e.message}));
    for(const label of [null,{},5,'bad\nname','bad\u0085name','x'.repeat(81)]){
      const result=await request(app).post('/create').send({label,source:{workbenchVersion:'forged'}});
      expect(result.status).toBe(409);expect(result.body.error).toContain('备份名称');expect(routes.isBusy()).toBe(false);
    }
    expect(admissions).toBe(0);expect((await request(app).get('/task')).body.task).toBeNull();
    expect((await request(app).get('/')).body.items).toEqual([]);
  }finally{await rm(root,{recursive:true,force:true});}
});

it('rejects a draft or render before starting and reserves the admission check itself',async()=>{
  const root=await mkdtemp('/private/tmp/checkpoint-route-');
  try{
    let allow:()=>void=()=>{};
    const admitted=new Promise<void>(r=>allow=r);
    const routes=checkpointRoutes({repo:path.join(root,'repo'),project:path.join(root,'project'),assertIdle:async()=>{await admitted;throw Error('请先保存');}});
    const app=express();app.use(express.json());app.use(routes);app.use((e:any,_req:any,res:any,_next:any)=>res.status(409).json({error:e.message}));
    const first=request(app).post('/create').send({}).then(r=>r);
    await new Promise(resolve=>setTimeout(resolve,20));expect(routes.isBusy()).toBe(true);
    expect((await request(app).post('/create').send({})).status).toBe(409);
    allow();expect((await first).body.error).toBe('请先保存');expect(routes.isBusy()).toBe(false);
    expect((await request(app).get('/')).body.items).toEqual([]);
  }finally{await rm(root,{recursive:true,force:true});}
});
