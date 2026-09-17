import {createHash, randomUUID} from 'node:crypto';
import {chmod, copyFile, link, lstat, mkdir, readFile, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {componentSelectionSchema, materialRequestSchema, type Scene, type MaterialRequest} from './production-store';
import type {ResolvedComponentAsset} from './component-assets';
import {fileDigest} from './segment-reviews';

const assetSchema = z.object({
  id: z.string().uuid(), name: z.string().min(1).max(255), kind: z.enum(['image','video']),
  archiveName: z.string().regex(/^[a-f0-9]{64}\.(png|jpe?g|webp|mp4)$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().positive(),
  extension: z.enum(['.png','.jpg','.jpeg','.webp','.mp4']), mimeType: z.string().regex(/^(image|video)\/[a-z0-9.+-]+$/),
  durationFrames: z.number().int().positive().optional(),
}).strict();
export const animationContentsSchema = z.object({
  components: z.array(z.object({selection: componentSelectionSchema, startCue: z.number().int().nonnegative(), endCue: z.number().int().nonnegative()}).strict()).max(12),
  componentAssets: z.array(assetSchema).max(384),
  materials: z.array(z.object({id:z.string().min(1).max(200),description:z.string(),archiveName:z.string().regex(/^[a-f0-9]{64}\.(png|jpe?g|webp|mp4|mov|webm)$/),kind:z.enum(['image','video'])}).strict()),
  // Version 1 marks captures whose material ids are replaceable slots. Older
  // saved wrappers omitted this field and keep their frozen source snapshot.
  materialSlotsVersion: z.literal(1).optional(),
}).strict();
export type AnimationContents = z.infer<typeof animationContentsSchema>;
export type AnimationContentOptions = {
  resolveComponentAsset?: (id:string)=>Promise<ResolvedComponentAsset>;
  componentAssetDirectory?: string;
  materialDirectory?: string;
  /** Source module identity used when re-capturing animation slots. */
  moduleId?: string;
  templateId?: string;
  /** Preview may validate defaults without publishing them to target assets. */
  installMaterialDefaults?: boolean;
};
async function regularInfo(file:string) {
  const info=await lstat(file);
  if(!info.isFile() || info.isSymbolicLink()) throw Error('动画素材必须是实际文件：'+file);
  return info;
}
async function digestRegular(file:string) {
  await regularInfo(file);return fileDigest(file);
}

function isSafeBasename(value:string): boolean {
  return value.length>0 && value!=='.' && value!=='..' &&
    path.basename(value)===value && !value.includes('/') && !value.includes('\\') &&
    !value.includes('\u0000');
}

function assertAnimationModuleIdentity(moduleId:string,templateId:string): void {
  if(!/^saved-[a-f0-9-]{36}$/.test(moduleId) || moduleId!==`saved-${templateId}`)
    throw Error('保存动画槽位身份无效');
  if(!z.string().uuid().safeParse(templateId).success) throw Error('保存动画模板编号无效');
}

/** One ordered set of anchors is shared by source animation and component intervals. */
export function animationCues(scene:Scene,wordOrder?:readonly string[]) {
  const labels=new Map<string,string>();
  for(const beat of scene.beats)labels.set(beat.wordId,beat.label);
  for(const [index,c] of (scene.components||[]).entries()) {
    for(const [id,label] of [[c.startWordId,`组件 ${index+1} 出现`],[c.endWordId,`组件 ${index+1} 结束`]]) {
      if(!labels.has(id))labels.set(id,label);
    }
  }
  if(scene.components?.length && !wordOrder)throw Error('保存组件需要当前段落的完整口播顺序');
  const ordered=wordOrder?wordOrder.filter(id=>labels.has(id)):[...labels.keys()];
  if(ordered.length!==labels.size || new Set(ordered).size!==ordered.length)throw Error('动画或组件引用的词不在当前段落中');
  return ordered.map(wordId=>({wordId,label:labels.get(wordId)!}));
}

export async function captureAnimationContents(scene:Scene,requests:readonly MaterialRequest[],cues:readonly {wordId:string}[],options:AnimationContentOptions) {
  const contents:AnimationContents={components:[],componentAssets:[],materials:[],materialSlotsVersion:1},files=new Map<string,string>();
  const ids=new Map<string,string>();
  const materialIds=new Set<string>();
  async function capture(file:string) {
    const info=await regularInfo(file),sha256=await fileDigest(file),extension=path.extname(file).toLowerCase();
    if(!/^\.(png|jpe?g|webp|mp4|mov|webm)$/.test(extension))throw Error('动画素材格式不支持：'+extension);
    const archiveName=sha256+extension;files.set(archiveName,file);return {size:info.size,sha256,extension,archiveName};
  }
  for(const raw of scene.components||[]) {
    const selection=componentSelectionSchema.parse(raw);
    const startCue=cues.findIndex(c=>c.wordId===selection.startWordId),endCue=cues.findIndex(c=>c.wordId===selection.endWordId);
    if(startCue<0 || endCue<startCue)throw Error('组件出现与结束顺序无效');
    for(const binding of selection.mediaBindings||[])if(binding.source==='asset') {
      let savedId=ids.get(binding.assetId);
      if(!savedId) {
        if(!options.resolveComponentAsset)throw Error('当前环境未接入组件素材归档');
        const source=await options.resolveComponentAsset(binding.assetId),captured=await capture(source.path);
        savedId=randomUUID();ids.set(binding.assetId,savedId);
        contents.componentAssets.push(assetSchema.parse({id:savedId,name:source.name,kind:source.kind,archiveName:captured.archiveName,sha256:captured.sha256,size:captured.size,extension:captured.extension,mimeType:source.mimeType,...(source.durationFrames?{durationFrames:source.durationFrames}:{})}));
      }
      binding.assetId=savedId;
    }
    contents.components.push({selection,startCue,endCue});
  }
  for(const request of requests.filter(r=>r.sceneId===scene.id)) {
    const slot=request.animationSlot;
    const currentSlot=slot !== undefined && options.moduleId !== undefined && options.templateId !== undefined &&
      slot.moduleId===options.moduleId && slot.templateId===options.templateId;
    if(slot !== undefined && !currentSlot) {
      if(slot.moduleId===options.moduleId || slot.templateId===options.templateId)
        throw Error('补充素材槽位所有者与当前动画不一致');
      continue;
    }
    if(slot !== undefined && (options.moduleId===undefined || options.templateId===undefined)) {
      if(slot.moduleId===options.moduleId || slot.templateId===options.templateId)
        throw Error('补充素材槽位缺少当前动画身份，无法重新保存');
      continue;
    }
    if(request.status!=='provided') {
      if(currentSlot) throw Error('当前动画补充素材槽位未提供实际文件，无法重新保存');
      continue;
    }
    if(!options.materialDirectory || !request.fileName || !isSafeBasename(request.fileName))throw Error('补充素材路径无效');
    const captured=await capture(path.join(options.materialDirectory,request.fileName));
    const id=slot?.materialId ?? request.id;
    if(materialIds.has(id))throw Error('保存动画中补充素材编号重复：'+id);
    materialIds.add(id);
    contents.materials.push({id,description:request.description,archiveName:captured.archiveName,kind:/\.(mp4|mov|webm)$/.test(captured.extension)?'video':'image'});
  }
  return {contents:animationContentsSchema.parse(contents),files};
}

/** Restore immutable archived media into the normal editable asset library. Never overwrite a collision. */
export async function installAnimationAssets(root:string,moduleId:string,contents:AnimationContents,options:AnimationContentOptions) {
  if(!/^saved-[a-f0-9-]{36}$/.test(moduleId))throw Error('保存动画编号无效');
  if(contents.componentAssets.length && !options.componentAssetDirectory)throw Error('当前环境未接入组件素材库');
  for(const material of contents.materials) {
    if(await digestRegular(path.join(root,'public','saved-animations',moduleId,material.archiveName))!==material.archiveName.split('.')[0])throw Error('保存的补充素材已损坏：'+material.description);
  }
  for(const asset of contents.componentAssets) {
    const source=path.join(root,'public','saved-animations',moduleId,asset.archiveName);
    if((await regularInfo(source)).size!==asset.size || await fileDigest(source)!==asset.sha256)throw Error('保存动画素材已损坏：'+asset.name);
    const directory=options.componentAssetDirectory!,fileName=asset.id+asset.extension;
    await mkdir(directory,{recursive:true});
    const destination=path.join(directory,fileName);
    try {await publishImmutable(destination,{file:source,sha256:asset.sha256});}catch(error:any) {
      if(error.code!=='EEXIST')throw error;
      if(await digestRegular(destination)!==asset.sha256)throw Error('素材编号冲突，未覆盖现有文件');
    }
    const metadata={schemaVersion:1,id:asset.id,name:asset.name,kind:asset.kind,fileName,extension:asset.extension,mimeType:asset.mimeType,url:'/api/production/component-assets/file/'+asset.id,size:asset.size,...(asset.durationFrames?{durationFrames:asset.durationFrames}:{}),createdAt:new Date().toISOString()};
    const target=path.join(directory,asset.id+'.json');
    try {await publishImmutable(target,Buffer.from(JSON.stringify(metadata)));}catch(error:any) {
      if(error.code!=='EEXIST')throw error;
      await regularInfo(target);
      const existing=JSON.parse(await readFile(target,'utf8'));
      for(const [key,value] of Object.entries(metadata))if(key!=='createdAt' && existing[key]!==value)throw Error('素材元数据冲突，未覆盖现有记录');
    }
  }
}

type StableFileInfo = {
  dev: bigint;
  ino: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
};

async function stableRegularInfo(file:string):Promise<StableFileInfo> {
  const info=await lstat(file,{bigint:true});
  if(!info.isFile() || info.isSymbolicLink()) throw Error('动画素材必须是实际文件：'+file);
  return {dev:info.dev,ino:info.ino,size:info.size,mtimeNs:info.mtimeNs,ctimeNs:info.ctimeNs};
}

function sameStableFileInfo(left:StableFileInfo,right:StableFileInfo):boolean {
  return left.dev===right.dev && left.ino===right.ino && left.size===right.size &&
    left.mtimeNs===right.mtimeNs && left.ctimeNs===right.ctimeNs;
}

async function ensureMaterialDirectory(directory:string):Promise<string> {
  if(typeof directory!=='string' || directory.trim()==='') throw Error('补充素材目录无效');
  const resolved=path.resolve(directory);
  await mkdir(resolved,{recursive:true});
  const info=await lstat(resolved,{bigint:true});
  if(!info.isDirectory() || info.isSymbolicLink()) throw Error('补充素材目录必须是实际目录');
  return resolved;
}

async function assertNoSymlinkParents(base:string,relativePath:string):Promise<void> {
  const resolvedBase=path.resolve(base), target=path.resolve(resolvedBase,...relativePath.split('/'));
  const relative=path.relative(resolvedBase,target);
  if(relative==='..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw Error('保存动画素材路径越过工程目录');
  let current=resolvedBase;
  const baseInfo=await lstat(current,{bigint:true});
  if(baseInfo.isSymbolicLink() || !baseInfo.isDirectory()) throw Error('保存动画素材根目录无效');
  const parts=path.dirname(relative).split(path.sep).filter(Boolean);
  for(const part of parts) {
    current=path.join(current,part);
    let info:any;
    try { info=await lstat(current,{bigint:true}); }
    catch(error:any) { if(error?.code==='ENOENT') return; throw error; }
    if(info.isSymbolicLink()) throw Error('保存动画素材父目录不能是符号链接');
    if(!info.isDirectory()) throw Error('保存动画素材父路径必须是目录');
  }
}

async function copyImmutableMaterial(root:string,source:string,destination:string,expectedHash:string):Promise<boolean> {
  // Checking the project chain prevents an archive directory link from
  // redirecting reads outside the saved animation root.
  await assertNoSymlinkParents(path.resolve(root),path.relative(path.resolve(root),source));
  const before=await stableRegularInfo(source);
  const actualHash=await fileDigest(source);
  if(actualHash!==expectedHash) throw Error('保存动画补充素材已损坏，无法复制');
  const afterHash=await stableRegularInfo(source);
  if(!sameStableFileInfo(before,afterHash)) throw Error('保存动画素材在读取期间发生变化，请重试');
  let created=false;
  try {
    try {
      await publishImmutable(destination,{file:source,sha256:expectedHash});
      created=true;
    } catch(error:any) {
      if(error?.code!=='EEXIST') throw error;
      const existing=await stableRegularInfo(destination);
      if(existing.size!==before.size || await fileDigest(destination)!==expectedHash)
        throw Error('动画素材快照文件冲突，未覆盖已有文件');
    }
    const sourceAfter=await stableRegularInfo(source);
    if(!sameStableFileInfo(before,sourceAfter)) throw Error('保存动画素材在复制期间发生变化，请重试');
    const destinationInfo=await stableRegularInfo(destination);
    if(destinationInfo.size!==before.size || await fileDigest(destination)!==expectedHash)
      throw Error('动画素材快照校验失败');
    return created;
  } catch(error) {
    if(created) await unlink(destination).catch(()=>undefined);
    throw error;
  }
}

/**
 * Creates the material requests belonging to one saved animation application.
 * Ordinary requests are carried through; animation slots owned by another
 * template are removed so switching templates cannot leave stale bindings.
 * Archived defaults are copied as immutable files and are never used to
 * overwrite an existing target file.
 */
export async function instantiateAnimationMaterials(
  root:string,
  moduleId:string,
  templateId:string,
  contents:AnimationContents,
  target:Scene,
  requests:readonly MaterialRequest[],
  options:AnimationContentOptions,
):Promise<MaterialRequest[]> {
  assertAnimationModuleIdentity(moduleId,templateId);
  const parsedContents=animationContentsSchema.parse(contents);
  const parsedRequests= z.array(materialRequestSchema).parse(requests);
  for(const request of parsedRequests) if(request.sceneId!==target.id) throw Error('补充素材请求必须属于目标段落');
  const requestIds=new Set<string>();
  for(const request of parsedRequests) {
    if(requestIds.has(request.id)) throw Error('补充素材请求编号重复：'+request.id);
    requestIds.add(request.id);
  }
  const materialIds=new Set<string>();
  for(const material of parsedContents.materials) {
    if(materialIds.has(material.id)) throw Error('保存动画中补充素材编号重复：'+material.id);
    materialIds.add(material.id);
  }

  const ordinary=parsedRequests.filter(request=>request.animationSlot===undefined);
  // Old wrappers have fixed material snapshots in their source. Keep those
  // snapshots untouched and do not invent editable requests for them.
  if(parsedContents.materialSlotsVersion!==1) return ordinary;

  const owned=new Map<string,MaterialRequest>();
  for(const request of parsedRequests) {
    const slot=request.animationSlot;
    if(!slot) continue;
    const isOwned=slot.templateId===templateId && slot.moduleId===moduleId;
    if(!isOwned) {
      if(slot.templateId===templateId || slot.moduleId===moduleId)
        throw Error('补充素材槽位所有者冲突');
      continue;
    }
    if(!materialIds.has(slot.materialId)) throw Error('补充素材槽位引用了不存在的保存素材：'+slot.materialId);
    if(owned.has(slot.materialId)) throw Error('补充素材槽位重复：'+slot.materialId);
    if(request.status==='provided') {
      if(!request.fileName || !isSafeBasename(request.fileName)) throw Error('已提供的补充素材路径无效');
      if(!options.materialDirectory) throw Error('当前环境未接入补充素材目录');
      const existingDirectory=options.installMaterialDefaults===false
        ? path.resolve(options.materialDirectory)
        : await ensureMaterialDirectory(options.materialDirectory);
      await stableRegularInfo(path.join(existingDirectory,request.fileName));
    }
    owned.set(slot.materialId,request);
  }

  const installDefaults=options.installMaterialDefaults!==false;
  if(parsedContents.materials.length && installDefaults && !options.materialDirectory)
    throw Error('保存动画包含补充素材，但当前环境没有素材目录');

  const materialDirectory=parsedContents.materials.length && installDefaults
    ? await ensureMaterialDirectory(options.materialDirectory!)
    : undefined;
  const output=[...ordinary],createdDefaults:string[]=[];
  try {
    for(const material of parsedContents.materials) {
      const existing=owned.get(material.id);
      if(existing) { output.push(existing); continue; }
      const source=path.join(path.resolve(root),'public','saved-animations',moduleId,material.archiveName);
      await stableRegularInfo(source);
      const extension=path.extname(material.archiveName).toLowerCase();
      const stem=createHash('sha256').update(JSON.stringify([templateId,target.id,material.id])).digest('hex');
      const fileName=`animation-${stem}${extension}`;
      const destination=materialDirectory ? path.join(materialDirectory,fileName) : undefined;
      if(destination && await copyImmutableMaterial(path.resolve(root),source,destination,material.archiveName.slice(0,64)))
        createdDefaults.push(destination);
      const requestId=`animation-${createHash('sha256').update(JSON.stringify([templateId,target.id,material.id,'request'])).digest('hex')}`;
      if(requestIds.has(requestId)) throw Error('生成的补充素材请求编号与已有请求冲突');
      requestIds.add(requestId);
      output.push({
        id:requestId,
        sceneId:target.id,
        description:material.description,
        reason:'保存动画提供可替换素材槽位',
        status:'provided',
        fileName,
        animationSlot:{templateId,moduleId,materialId:material.id},
      });
    }
    return output;
  } catch(error) {
    await Promise.all(createdDefaults.map((file)=>unlink(file).catch(()=>undefined)));
    throw error;
  }
}

async function publishImmutable(destination:string,contents:Buffer|{file:string;sha256:string}) {
  const temporary=destination+'.'+randomUUID()+'.tmp';
  try {
    if(Buffer.isBuffer(contents))await writeFile(temporary,contents,{flag:'wx',mode:0o600});
    else {
      await copyFile(contents.file,temporary);await chmod(temporary,0o600);
      if(await fileDigest(temporary)!==contents.sha256)throw Error('复制期间动画素材发生变化');
    }
    await link(temporary,destination); // Atomic publication with exclusive destination semantics.
  } finally {await unlink(temporary).catch(()=>undefined);}
}

export function instantiateAnimationComponents(templateId:string,contents:AnimationContents,target:Scene,bindings:readonly string[]) {
  const result=structuredClone(target.components||[]);
  for(const saved of contents.components) {
    const id='animation-'+createHash('sha256').update(JSON.stringify([templateId,target.id,saved.selection.id])).digest('hex').slice(0,32);
    if(result.some(c=>c.id===id))continue; // Preserve edits when applying the same animation again.
    if(!bindings[saved.startCue] || !bindings[saved.endCue])throw Error('组件缺少新的口播绑定');
    result.push({...structuredClone(saved.selection),id,startWordId:bindings[saved.startCue],endWordId:bindings[saved.endCue]});
  }
  if(result.length>12)throw Error('应用后组件超过12个，请先整理目标段落中的组件');
  return result;
}
