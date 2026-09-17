import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {
  captureAnimationContents,
  instantiateAnimationMaterials,
  type AnimationContents,
} from './animation-contents';
import type {MaterialRequest,Scene} from './production-store';

const temporaryDirectories:string[]=[];
const templateId='f543988b-d9d3-4130-a7fc-37491b0f685d';
const moduleId=`saved-${templateId}`;

afterEach(async()=>{
  await Promise.all(temporaryDirectories.splice(0).map((directory)=>rm(directory,{recursive:true,force:true})));
});

function scene(id='target-scene'):Scene {
  return {
    id,title:'目标段落',startWordId:'start',endWordId:'end',intent:'测试',
    beats:[{wordId:'start',label:'开始'},{wordId:'end',label:'结束'}],
  };
}

function request(sceneId:string,overrides:Partial<MaterialRequest>={}):MaterialRequest {
  return {id:'ordinary',sceneId,description:'普通素材',reason:'测试保留',status:'missing',...overrides};
}

async function fixture(bytes=Buffer.from('default-pixels')) {
  const root=await mkdtemp(path.join(os.tmpdir(),'codex-animation-contents-'));
  temporaryDirectories.push(root);
  const archiveHash=createHash('sha256').update(bytes).digest('hex');
  const archiveName=`${archiveHash}.png`;
  const archiveDirectory=path.join(root,'public','saved-animations',moduleId);
  await mkdir(archiveDirectory,{recursive:true});
  await writeFile(path.join(archiveDirectory,archiveName),bytes);
  return {root,bytes,archiveName,archiveHash};
}

function contents(archiveName:string,version:1|undefined=1):AnimationContents {
  return {
    components:[],componentAssets:[],materials:[{id:'slot-a',description:'默认图片',archiveName,kind:'image'}],
    ...(version===undefined?{}:{materialSlotsVersion:version}),
  };
}

describe('saved animation material slots',()=>{
  it('copies immutable defaults, then preserves an existing user replacement',async()=>{
    const fixtureData=await fixture();
    const target=scene();
    const materialDirectory=path.join(fixtureData.root,'production-assets');
    const initial=await instantiateAnimationMaterials(
      fixtureData.root,moduleId,templateId,contents(fixtureData.archiveName),target,
      [request(target.id)],{materialDirectory},
    );
    const generated=initial.find((item)=>item.animationSlot?.materialId==='slot-a')!;
    expect(generated).toMatchObject({status:'provided',sceneId:target.id,animationSlot:{templateId,moduleId,materialId:'slot-a'}});
    expect(await readFile(path.join(materialDirectory,generated.fileName!))).toEqual(fixtureData.bytes);

    const replacement=Buffer.from('user replacement pixels');
    await writeFile(path.join(materialDirectory,generated.fileName!),replacement);
    const reapplied=await instantiateAnimationMaterials(
      fixtureData.root,moduleId,templateId,contents(fixtureData.archiveName),target,
      [generated],{materialDirectory},
    );
    expect(reapplied).toEqual([generated]);
    expect(await readFile(path.join(materialDirectory,generated.fileName!))).toEqual(replacement);
  });

  it('validates defaults without publishing during preview and uses the same logical identity on apply',async()=>{
    const fixtureData=await fixture();
    const target=scene();
    const preview=await instantiateAnimationMaterials(
      fixtureData.root,moduleId,templateId,contents(fixtureData.archiveName),target,
      [],{installMaterialDefaults:false},
    );
    const previewRequest=preview[0];
    expect(previewRequest.animationSlot?.materialId).toBe('slot-a');
    expect(previewRequest.fileName).toMatch(/^animation-[a-f0-9]{64}\.png$/u);
    await expect(readdir(fixtureData.root)).resolves.not.toContain('production-assets');

    const materialDirectory=path.join(fixtureData.root,'production-assets');
    const applied=await instantiateAnimationMaterials(
      fixtureData.root,moduleId,templateId,contents(fixtureData.archiveName),target,
      [],{materialDirectory},
    );
    expect(applied[0].id).toBe(previewRequest.id);
    expect(applied[0].fileName).toBe(previewRequest.fileName);
    expect(await readFile(path.join(materialDirectory,applied[0].fileName!))).toEqual(fixtureData.bytes);
  });

  it('rejects a same-name archive tamper without publishing a target file',async()=>{
    const fixtureData=await fixture();
    await writeFile(path.join(fixtureData.root,'public','saved-animations',moduleId,fixtureData.archiveName),'tampered');
    const materialDirectory=path.join(fixtureData.root,'production-assets');
    await expect(instantiateAnimationMaterials(
      fixtureData.root,moduleId,templateId,contents(fixtureData.archiveName),scene(),[],{materialDirectory},
    )).rejects.toThrow(/损坏/iu);
    await expect(readdir(materialDirectory)).resolves.toEqual([]);
  });

  it('drops old animation slots but keeps ordinary requests for legacy fixed snapshots',async()=>{
    const fixtureData=await fixture();
    const ordinary=request('target-scene');
    const oldSlot=request('target-scene',{id:'old-slot',status:'provided',fileName:'old.png',animationSlot:{templateId,moduleId,materialId:'slot-a'}});
    const legacyContents={...contents(fixtureData.archiveName),materialSlotsVersion:undefined};
    const output=await instantiateAnimationMaterials(
      fixtureData.root,moduleId,templateId,legacyContents,scene(),[ordinary,oldSlot],{},
    );
    expect(output).toEqual([ordinary]);
  });

  it('captures current module slots by material id and marks new contents as version 1',async()=>{
    const fixtureData=await fixture(Buffer.from('replacement'));
    const materialDirectory=path.join(fixtureData.root,'request-assets');
    await mkdir(materialDirectory);
    await writeFile(path.join(materialDirectory,'replacement.png'),fixtureData.bytes);
    const captured=await captureAnimationContents(
      scene(),
      [request('target-scene',{id:'request-id',status:'provided',fileName:'replacement.png',animationSlot:{templateId,moduleId,materialId:'slot-a'}})],
      [{wordId:'start'},{wordId:'end'}],
      {materialDirectory,moduleId,templateId},
    );
    expect(captured.contents.materialSlotsVersion).toBe(1);
    expect(captured.contents.materials).toMatchObject([{id:'slot-a',description:'普通素材'}]);
  });
});
