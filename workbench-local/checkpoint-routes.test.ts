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
    const routes=checkpointRoutes({repo,project,assertIdle:async()=>{}}),app=express();app.use(express.json());app.use('/api/checkpoints',routes);
    app.use((e:any,_req:any,res:any,_next:any)=>res.status(409).json({error:e.message}));
    const started=await request(app).post('/api/checkpoints/create').send({destination:project});expect(started.status).toBe(200);
    await routes.waitForIdle();
    expect((await request(app).get('/api/checkpoints/task')).body.task.status).toBe('done');
    let result=(await request(app).get('/api/checkpoints')).body;expect(result.task.status).toBe('done');expect(result.items).toHaveLength(1);
    const id=result.items[0].id;expect(result.items[0].path).not.toBe(project);
    expect((await request(app).post('/api/checkpoints/verify').send({id:'../project'})).status).toBe(409);
    await request(app).post('/api/checkpoints/verify').send({id});await routes.waitForIdle();expect((await request(app).get('/api/checkpoints')).body.task.verified).toBe(true);
    await writeFile(path.join(project,'cut','source.mp4'),'changed original');
    await request(app).post('/api/checkpoints/restore').send({id,destination:project});await routes.waitForIdle();result=(await request(app).get('/api/checkpoints')).body;
    expect(result.task.status).toBe('done');expect(await readFile(path.join(result.task.path,'project','cut','source.mp4'),'utf8')).toBe('original media');expect(await readFile(path.join(project,'cut','source.mp4'),'utf8')).toBe('changed original');
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
