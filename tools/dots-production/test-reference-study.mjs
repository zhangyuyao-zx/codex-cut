import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {importReference,studioCommand} from './studio.mjs';
import {referenceSource,sceneReferenceStudy} from './studio/reference.mjs';
import {digest} from './production-pack.mjs';

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dots-reference-study-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'production'));
 await fs.writeFile(path.join(root,'helper.jsx'),'export const Button=()=>null;');
 await fs.writeFile(path.join(root,'shot.jsx'),`import React from 'react';import {Button} from './helper';import {staticFile} from 'remotion';export function Shot(){return <Button/>}const files=[staticFile('paper.png'),staticFile(file)];globalThis.referenceExecuted=true;`);
 const video=path.join(root,'reference.mp4');await fs.writeFile(video,'synthetic video identity');
 const registry=path.join(root,'registry.json');
 await fs.writeFile(registry,JSON.stringify({entries:[{id:'approved',label:'Synthetic reference',kind:'accepted-reconstruction',media:{file:'reference.mp4',sha256:await digest(video),fromSeconds:1,toSeconds:4},learn:'a button changes the same document',avoid:'do not reuse branding or old time',sourceCode:'shot.jsx',sourceExport:'Shot',adaptation:{parts:['Button'],eventSequence:['request','feedback']},acceptanceScope:'fixture only'}]}));
 const book=path.join(root,'production/authoring.json'),native=path.join(root,'production/production.json');
 await fs.writeFile(book,JSON.stringify({schemaVersion:2,assets:{},references:{},scenes:[{sceneId:'s',visualTask:'new task',referenceIds:[]}],reviews:{}}));
 await fs.writeFile(native,JSON.stringify({state:{revision:1,scenes:[{id:'s'}]}}));
 return {root,registry,book,native};
}

test('reference import retains actual source dependencies and adaptation, study and resume are read-only',async t=>{
 const f=await fixture(t),nativeBefore=await digest(f.native);
 await importReference({project:f.root,registry:f.registry,id:'approved',sceneId:'s'});
 const book=JSON.parse(await fs.readFile(f.book,'utf8'));
 assert.equal(book.references.approved.sourceCode,path.join(f.root,'shot.jsx'));
 assert.deepEqual(book.scenes[0].referenceIds,['approved']);
 assert.equal(book.references.approved.sourceIdentity.length,2);
 const before=await digest(f.book);
 const study=await studioCommand(['study','--project',f.root,'--scene','s','--with-code']);
 const ref=study.references[0];assert.equal(ref.source.status,'available');assert.equal(ref.source.entryExport,'Shot');
 assert.deepEqual(ref.adaptation.eventSequence,['request','feedback']);
 assert.equal(ref.source.files.length,2);assert(ref.source.files.some(f=>f.code.includes('Button=()=>null')));
 assert.deepEqual(ref.source.staticAssets,['paper.png']);assert.equal(ref.source.dynamicAssets,true);
 assert.equal(globalThis.referenceExecuted,undefined);
 const resume=await studioCommand(['resume','--project',f.root,'--scene','s']);
 assert.equal(resume.referenceStudy.references[0].source.entryExport,'Shot');
 assert.equal(await digest(f.book),before);assert.equal(await digest(f.native),nativeBefore);
 assert.equal((await importReference({project:f.root,registry:f.registry,id:'approved',sceneId:'s'})).unchanged,true);
 assert.equal(await digest(f.book),before);
 await assert.rejects(importReference({project:f.root,registry:f.registry,id:'approved'}),/已存在/);
 await fs.writeFile(path.join(f.root,'helper.jsx'),'export const Button=()=>"changed";');
 const stale=await sceneReferenceStudy({project:f.root,sceneId:'s'});
 assert.equal(stale.references[0].source.status,'unavailable');assert.match(stale.references[0].source.reason,/源码或本地依赖已变化/);
 assert.equal(await digest(f.book),before);
});

test('one unchanged reference can be associated with another scene without replacing it or approvals',async t=>{
 const f=await fixture(t);await importReference({project:f.root,registry:f.registry,id:'approved',sceneId:'s'});
 const b=JSON.parse(await fs.readFile(f.book,'utf8'));
 b.scenes.push({sceneId:'second',referenceIds:[]});
 b.storyboardFrames={s:{approval:{basis:'preserve'}}};
 await fs.writeFile(f.book,JSON.stringify(b));const nativeBefore=await digest(f.native);
 await importReference({project:f.root,registry:f.registry,id:'approved',sceneId:'second'});
 const result=JSON.parse(await fs.readFile(f.book,'utf8'));
 assert.deepEqual(result.references,b.references);assert.deepEqual(result.storyboardFrames,b.storyboardFrames);
 assert.deepEqual(result.scenes[1].referenceIds,['approved']);assert.equal(await digest(f.native),nativeBefore);
 await fs.writeFile(path.join(f.root,'helper.jsx'),'export const Button=()=>"new source";');
 await assert.rejects(importReference({project:f.root,registry:f.registry,id:'approved',sceneId:'second'}),/不静默替换/);
});

test('old reference can read matching registry source without silently migrating its project or approvals',async t=>{
 const f=await fixture(t);await importReference({project:f.root,registry:f.registry,id:'approved',sceneId:'s'});
 const b=JSON.parse(await fs.readFile(f.book,'utf8'));
 delete b.references.approved.sourceCode;delete b.references.approved.sourceIdentity;
 b.storyboardFrames={s:{approval:{basis:'preserve previous approval'}}};
 await fs.writeFile(f.book,JSON.stringify(b));const before=await digest(f.book);
 assert.equal((await sceneReferenceStudy({project:f.root,sceneId:'s'})).references[0].source.status,'missing');
 const study=await studioCommand(['study','--project',f.root,'--scene','s','--registry',f.registry]);
 assert.equal(study.references[0].source.origin,'registry-read-only');assert.equal(await digest(f.book),before);
 const registry=JSON.parse(await fs.readFile(f.registry,'utf8'));registry.entries[0].media.toSeconds=5;
 await fs.writeFile(f.registry,JSON.stringify(registry));
 const wrong=await sceneReferenceStudy({project:f.root,sceneId:'s',registry:f.registry});
 assert.equal(wrong.references[0].unavailable,true);assert.match(wrong.references[0].reason,/区间不一致/);
 assert.equal(await digest(f.book),before);
});

test('standalone study resolves source but missing dependencies and changed media do not silently pass',async t=>{
 const f=await fixture(t),before=await digest(f.book);
 const study=await studioCommand(['study','--registry',f.registry,'--id','approved','--with-code']);
 assert.equal(study.readOnly,true);assert.equal(study.references[0].source.files.length,2);
 assert.equal(await digest(f.book),before);
 await fs.unlink(path.join(f.root,'helper.jsx'));
 await assert.rejects(referenceSource(path.join(f.root,'shot.jsx')),/本地依赖不存在/);
 await fs.writeFile(path.join(f.root,'reference.mp4'),'changed');
 await assert.rejects(studioCommand(['study','--registry',f.registry,'--id','approved']),/参考身份已变化/);
 assert.equal(await digest(f.book),before);
});
