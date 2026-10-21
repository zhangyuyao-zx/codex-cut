import express from 'express';
import request from 'supertest';
import {it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createComponentLibrary} from './component-library';

it('starts with a true empty new catalog and never lists the retired library by default',async()=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cut-empty-library-'));
  try{const library=await createComponentLibrary(temp,path.join(temp,'presets')),app=express();app.use(library.router);
    const response=await request(app).get('/').expect(200);expect(response.body.items).toEqual([]);expect(response.body.counts.total).toBe(0);expect(response.body.legacySelection).toBe(false);
    await expect(library.detail('component:v1:text-clean-card')).resolves.toHaveProperty('appAdapter',true);
  }finally{await rm(temp,{recursive:true,force:true});}
});
