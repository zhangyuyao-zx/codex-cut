import {Router} from 'express';
import {creativeRuntimeAliases,creativeRuntimeCapabilities,resolveCreativeDependencies,creativeRenderOptions} from './creative-runtime-dependencies';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createReadStream} from 'node:fs';
import {Transform} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {z} from 'zod';
import {RenderLane} from './render-lane';
import {runtimeCommand,remotionRuntime} from './runtime-paths';
import {createVisualLibraryStore,regularWithin,fileHash} from './visual-library-store';
import {memberKey,visualMemberSchema,visualId,resolveVisualValues,visualAssetInputSchema,styleValuesFor,type VisualAsset,type VisualPreview,type ReferenceVideo} from './visual-library-contract';
import type {SceneModuleDetail} from './scene-modules';
import {createRoughcutService} from './roughcut-service';
import {productionStateSchema} from './production-store';
import {createComponentAssets} from './component-assets';
import {resolveComponentMedia} from './component-media';
import {resolveProduction} from './production-binding';

const exec=promisify(execFile);
const revision=z.number().int().nonnegative().safe();
export {checkVisualSource} from './creative-runtime-dependencies';

export async function createVisualLibraryService(root:string,directory:string){
  const store=await createVisualLibraryStore(directory,root),router=Router(),lane=new RenderLane();
  const cutDir=path.resolve(directory,'../cut'),cutStore=await createRoughcutService(cutDir);
  let targetCache:{key:string;value:{url:string;file:string;durationFrames:number;revision:number}}|undefined;
  async function replacementMedia(){
    const cut=await cutStore.get();if(!cut.preview||cut.preview.revision!==cut.revision)return undefined;
    const key=cut.revision+':'+cut.preview.url;if(targetCache?.key===key)return targetCache.value;
    const name=path.basename(cut.preview.url),file=await regularWithin(cutDir,name);
    const info=JSON.parse((await exec(runtimeCommand('ffprobe'),['-v','error','-show_entries','format=duration','-of','json',file])).stdout);
    const value={url:cut.preview.url,file,durationFrames:Math.floor(Number(info.format?.duration)*30),revision:cut.revision};targetCache={key,value};return value;
  }
  let active:{id:string;kind:'reference'|'preview'|'pack';subject:string}|null=null;
  let lastTaskError:string|undefined;
  async function detailByModule(id:string):Promise<SceneModuleDetail|undefined>{
    const asset=(await store.get()).assets.find(a=>a.moduleId===id);if(!asset)return undefined;
    const modulePath=await store.verifyAsset(asset);
    const dependencyRuntime=await resolveCreativeDependencies(asset.dependencies,root);
    const digest=createHash('sha256').update(asset.sourceHash).update(JSON.stringify({controls:asset.controls,objects:asset.objects,cues:asset.cues,mediaSlots:asset.mediaSlots}));
    if(dependencyRuntime.fingerprint)digest.update('\0dependencies\0'+dependencyRuntime.fingerprint);
    const hash=digest.digest('hex');
    return {id:asset.moduleId,label:asset.name,entry:'Asset.tsx',exportName:'VisualAsset',controls:asset.controls,objects:asset.objects,styleBindings:asset.styleBindings,acceptsMaterials:asset.mediaSlots.length>0,...asset.dependencies?{dependencies:asset.dependencies}:{},modulePath,moduleUrl:'/@fs'+modulePath,sourceHash:hash,visualAsset:{id:asset.id,version:asset.version,mount:asset.mount,cues:asset.cues,mediaSlots:asset.mediaSlots,constraints:asset.constraints}};
  }
  const sceneProvider={detail:detailByModule,list:async()=>Promise.all((await store.get()).assets.map(a=>detailByModule(a.moduleId).then(d=>d!)))};
  async function assetDetail(member:unknown){const a=await store.getAsset(visualMemberSchema.parse(member));return {...a,module:await detailByModule(a.moduleId)};}
  const response=async()=>{let target;try{target=await replacementMedia();}catch{/* The library remains usable while a target cut is not prepared. */}return {...await store.get(),active,lastTaskError,...target?{replacementMedia:{url:target.url,durationFrames:target.durationFrames,revision:target.revision}}:{},capabilities:{runtimeDependencies:await creativeRuntimeCapabilities(root),dynamicAssets:true,stylePacks:true,references:true,legacySelection:false}};};
  const route=(fn:(req:any,res:any)=>Promise<unknown>)=>(req:any,res:any,next:any)=>void fn(req,res).catch(next);
  router.get('/',route(async(_req,res)=>res.json(await response())));
  router.get('/asset/:id/:version',route(async(req,res)=>res.json(await assetDetail(req.params))));
  router.get('/pack/:id/:version',route(async(req,res)=>res.json(await store.getPack(visualMemberSchema.parse(req.params)))));
  router.post('/asset',route(async(req,res)=>{const input=visualAssetInputSchema.parse(req.body.asset);await store.saveAsset(revision.parse(req.body.expectedRevision),input);res.json(await response());}));
  router.post('/asset-status',route(async(req,res)=>{await store.setAssetStatus(revision.parse(req.body.expectedRevision),visualMemberSchema.parse(req.body.member),z.enum(['draft','review','ready','archived']).parse(req.body.status),req.body.userConfirmed===true);res.json(await response());}));
  router.post('/asset-review',route(async(req,res)=>{await store.review(revision.parse(req.body.expectedRevision),visualMemberSchema.parse(req.body.member),req.body.review);res.json(await response());}));
  router.post('/pack',route(async(req,res)=>{await store.savePack(revision.parse(req.body.expectedRevision),req.body.pack);res.json(await response());}));
  router.post('/pack-status',route(async(req,res)=>{await store.setPackStatus(revision.parse(req.body.expectedRevision),visualMemberSchema.parse(req.body.member),z.enum(['draft','ready','archived']).parse(req.body.status),req.body.userConfirmed===true);res.json(await response());}));
  router.post('/favorite',route(async(req,res)=>{await store.favorite(revision.parse(req.body.expectedRevision),visualMemberSchema.parse(req.body.member),z.boolean().parse(req.body.favorite));res.json(await response());}));

  async function importReference(expected:number,input:{path?:string;name:string;sourceUrl?:string},stream:NodeJS.ReadableStream){
    const state=await store.get();if(state.revision!==expected)throw Error('资产库已变化，请刷新后重试');
    const id='ref-'+randomUUID(),folder=path.join(store.dir,'references',id);
    await mkdir(folder,{recursive:true});
    const extension=path.extname(input.name).toLowerCase();if(!['.mp4','.mov','.m4v','.webm','.mkv'].includes(extension))throw Error('请选择可读取的视频文件');
    const output=path.join(folder,'original'+extension);let bytes=0;
    try{
    await pipeline(stream,new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;if(bytes>2*1024**3)done(Error('参考视频超过 2GB，请先导出代理版本'));else done(null,chunk);}}),createWriteStream(output,{flags:'wx',mode:0o600}));
    const info=JSON.parse((await exec(runtimeCommand('ffprobe'),['-v','error','-show_streams','-show_format','-of','json',output],{maxBuffer:1024*1024})).stdout);
    const video=info.streams?.find((s:any)=>s.codec_type==='video'),durationMs=Number(info.format?.duration)*1000;
    if(!video||!Number.isFinite(durationMs)||durationMs<=0)throw Error('无法读取视频画面或时长');
    const hash=await fileHash(output),existing=state.references.find(r=>r.sha256===hash);if(existing){await rm(folder,{recursive:true,force:true});return existing;}
    const reference:ReferenceVideo={id,name:input.name,createdAt:new Date().toISOString(),...(input.sourceUrl?{sourceUrl:input.sourceUrl}:{}),fileName:path.basename(output),sha256:hash,durationMs,width:video.width,height:video.height,stage:'imported',progress:0,frames:[]};
    await store.addReference(expected,reference);return reference;
    }catch(error){await rm(folder,{recursive:true,force:true});throw error;}
  }
  router.post('/reference',route(async(req,res)=>{
    const input=z.object({path:z.string().min(1),name:z.string().min(1).max(200).optional(),sourceUrl:z.string().url().optional()}).strict().parse(req.body.reference);
    if(!path.isAbsolute(input.path))throw Error('请提供本地视频的绝对路径');
    const reference=await importReference(revision.parse(req.body.expectedRevision),{...input,name:input.name??path.basename(input.path)},createReadStream(input.path));res.json({...await response(),reference});
  }));
  router.post('/reference-upload',route(async(req,res)=>{
    const name=z.string().min(1).max(200).parse(req.query.name);
    const reference=await importReference((await store.get()).revision,{name},req);res.json({...await response(),reference});
  }));
  async function prepareReference(id:string){
    visualId.parse(id);const reference=(await store.get()).references.find(r=>r.id===id);if(!reference)throw Error('参考视频不存在');
    const task=lane.reserve();active={id:task.id,kind:'reference',subject:id};
    try{await store.updateReference(id,{stage:'preparing',progress:0,error:undefined});}catch(e){active=null;task.release();throw e;}
    void(async()=>{
      try{
        const source=await regularWithin(store.dir,'references',id,reference.fileName),folder=path.dirname(source),proxy=path.join(folder,'proxy.mp4');
        if(await fileHash(source)!==reference.sha256)throw Error('参考原件已变化，请作为新参考导入');
        await exec(runtimeCommand('ffmpeg'),['-v','error','-y','-i',source,'-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2','-r','30','-c:v','libx264','-preset','fast','-crf','21','-c:a','aac','-movflags','+faststart',proxy],{signal:task.signal,maxBuffer:1024*1024});
        task.check();await store.updateReference(id,{progress:0.65});
        const step=Math.max(1,Math.ceil(reference.durationMs/24000)),frames:ReferenceVideo['frames']=[];
        for(let timeMs=0;timeMs<reference.durationMs;timeMs+=step*1000){
          task.check();const fileName=`frame-${Math.round(timeMs)}.jpg`;
          await exec(runtimeCommand('ffmpeg'),['-v','error','-y','-ss',String(timeMs/1000),'-i',source,'-frames:v','1','-vf','scale=640:-2',path.join(folder,fileName)],{signal:task.signal,maxBuffer:1024*1024});
          frames.push({timeMs,fileName});
        }
        if(await fileHash(source)!==reference.sha256)throw Error('参考原件在准备期间发生变化，请重新导入');
        await store.updateReference(id,{stage:reference.analysis?.visualInspected?'authoring':'analysis',progress:1,proxy:'proxy.mp4',proxyHash:await fileHash(proxy),frames,error:undefined});
      }catch(error){await store.updateReference(id,{stage:'failed',error:task.signal.aborted?'准备已取消，可重新准备':(error as Error).message});}
      finally{active=null;task.release();}
    })();return task.id;
  }
  router.post('/reference-prepare',route(async(req,res)=>{const id=await prepareReference(req.body.referenceId);res.json({...await response(),jobId:id});}));
  router.post('/reference-analysis',route(async(req,res)=>{await store.analyzeReference(revision.parse(req.body.expectedRevision),visualId.parse(req.body.referenceId),req.body.analysis);res.json(await response());}));

  router.get('/media/references/:id/:file',route(async(req,res)=>{
    const id=visualId.parse(req.params.id),ref=(await store.get()).references.find(r=>r.id===id);if(!ref)throw Error('参考视频不存在');
    const name=req.params.file;if(![ref.fileName,ref.proxy,...ref.frames.map(f=>f.fileName)].includes(name))throw Error('参考文件不存在');
    res.sendFile(await regularWithin(store.dir,'references',id,name));
  }));
  router.get('/media/previews/:id/review.mp4',route(async(req,res)=>{const id=z.string().uuid().parse(req.params.id);res.sendFile(await regularWithin(store.dir,'previews',id,'review.mp4'));}));
  async function renderPreview(input:any){
    const member=visualMemberSchema.parse(input.member),asset=await store.getAsset(member),modulePath=await store.verifyAsset(asset);
    const dependencyRuntime=await resolveCreativeDependencies(asset.dependencies,root);
    const values=resolveVisualValues(asset.controls,input.values??asset.sampleValues);
    const durationFrames=z.number().int().min(asset.constraints.minFrames).max(asset.constraints.maxFrames).parse(input.durationFrames??150);
    const kind=z.enum(['reference','replacement']).parse(input.kind);
    const cueFrames=z.record(z.string(),z.number().int().min(0).max(durationFrames-1)).parse(input.cueFrames??{});
    for(const cue of asset.cues)if(cue.required&&cueFrames[cue.id]===undefined)throw Error('请绑定出现点：'+cue.label);
    if(kind==='reference'&&asset.source.kind==='reference'&&input.referenceId&&input.referenceId!==asset.source.referenceId)throw Error('原效果对照必须使用资产记录的来源视频');
    const refId=kind==='reference'?(asset.source.kind==='reference'?asset.source.referenceId:input.referenceId):undefined;
    const ref=refId?(await store.get()).references.find(r=>r.id===refId):undefined;
    const target=kind==='replacement'?await replacementMedia():undefined;
    const media=target?.file??(ref?await regularWithin(store.dir,'references',ref.id,ref.proxy??ref.fileName):undefined);
    if(ref){
      if(await fileHash(await regularWithin(store.dir,'references',ref.id,ref.fileName))!==ref.sha256)throw Error('参考原件已变化，请重新导入分析');
      if(ref.proxy&&(!ref.proxyHash||await fileHash(media!)!==ref.proxyHash))throw Error('参考播放副本缺少当前身份或已变化，请重新准备');
      if(asset.source.kind==='reference'&&durationFrames>Math.floor((asset.source.endMs-asset.source.startMs)*30/1000))throw Error('原效果预览不能超过记录的来源片段范围');
    }
    if(asset.requiresSourceMedia&&!media)throw Error('此资产需要主视频，请先准备连续粗剪预览');
    if(target&&durationFrames>target.durationFrames)throw Error('换内容预览超出当前粗剪时长');
    const materialInputs:{id:string;file:string;kind:'image'|'video';startFrame?:number}[]=[];
    if(asset.mediaSlots.length&&input.materialSceneId){
      const projectDir=path.dirname(store.dir),plan=productionStateSchema.parse(JSON.parse(await readFile(path.join(projectDir,'production/production.json'),'utf8')).state);
      const scene=plan.scenes.find(s=>s.id===input.materialSceneId);if(!scene)throw Error('素材所在段落不存在');
      for(const slot of asset.mediaSlots){const request=plan.requests.find(r=>r.sceneId===scene.id&&r.visualSlot?.moduleId===asset.moduleId&&r.visualSlot.slotId===slot.id&&r.status==='provided'&&r.fileName);
        if(request){const file=await regularWithin(path.join(projectDir,'production/assets'),request.fileName!);materialInputs.push({id:slot.id,file,kind:/\.(png|jpe?g|webp)$/iu.test(file)?'image':'video'});}}
      // Object assets reuse the existing explicit component media bindings as well.
      if(!materialInputs.length){const selected=scene.components?.find(c=>c.componentId==='visual:'+memberKey(asset));if(selected){
        const cut=await cutStore.get(),spoken=resolveProduction(plan,cut),range=spoken.scenes.find(s=>s.id===scene.id)!;
        if(spoken.stale||spoken.issues.length)throw Error('请先同步当前粗剪，再读取组件素材');
        const assets=await createComponentAssets(path.join(projectDir,'production/component-assets'));
        const resolved=await resolveComponentMedia({bindings:selected.mediaBindings,count:asset.mediaSlots.length,from:Math.round(range.startMs!*30/1000),duration:durationFrames,cutDuration:Math.round(spoken.durationMs*30/1000),resolveAsset:id=>assets.resolve(id)});
        for(let i=0;i<resolved.length;i++){const m=resolved[i],file=m.assetId?(await assets.resolve(m.assetId)).path:(await replacementMedia())?.file;if(!file)throw Error('缺少连续粗剪素材');materialInputs.push({id:asset.mediaSlots[i].id,file,kind:m.kind,startFrame:m.startFrame});}
      }}
    }
    for(const slot of asset.mediaSlots){const material=materialInputs.find(m=>m.id===slot.id);if(slot.required&&!material)throw Error('请先将候选添加到目标段落，并补充素材：'+slot.label);if(material&&slot.kind!=='either'&&material.kind!==slot.kind)throw Error('素材类型不符合槽位：'+slot.label);
      if(material?.kind==='video'){const probe=JSON.parse((await exec(runtimeCommand('ffprobe'),['-v','error','-show_entries','format=duration','-of','json',material.file])).stdout);if((material.startFrame??0)+durationFrames>Math.floor(Number(probe.format?.duration)*30))throw Error('素材长度不足，请换更长的素材或缩短预览：'+slot.label);}}
    const materialHashes=await Promise.all(materialInputs.map(async m=>({id:m.id,hash:await fileHash(m.file)})));
    const mediaHash=media?await fileHash(media):undefined;
    const task=lane.reserve(),id=task.id,folder=path.join(store.dir,'previews',id);active={id,kind:'preview',subject:memberKey(member)};
    const identity=createHash('sha256').update(JSON.stringify({values,cueFrames,mediaHash,durationFrames,...dependencyRuntime.fingerprint?{dependencyFingerprint:dependencyRuntime.fingerprint}:{}})).digest('hex');
    // A supplied video is not content evidence for an asset that never consumes it.
    const contentIdentity=createHash('sha256').update(JSON.stringify({values:Object.fromEntries(Object.entries(values).filter(([key])=>asset.contentParameters?.includes(key))),mediaHash:asset.requiresSourceMedia?mediaHash:undefined,materialHashes})).digest('hex');
    const preview:VisualPreview={id,kind,sourceHash:asset.sourceHash,...dependencyRuntime.fingerprint?{dependencyFingerprint:dependencyRuntime.fingerprint}:{},values,durationFrames,cueFrames,...ref?{referenceId:ref.id}:{},url:`/api/visual-library/media/previews/${id}/review.mp4`,createdAt:new Date().toISOString(),status:'rendering',progress:0,targetIdentity:identity,contentIdentity};
    try{await mkdir(folder,{recursive:true});await store.addPreview(member,preview);}catch(e){active=null;task.release();throw e;}
    void(async()=>{
      try{
        task.check();const {bundle}=await import('@remotion/bundler'),{selectComposition,renderMedia,makeCancelSignal}=await import('@remotion/renderer');
        if(media)await copyFile(media,path.join(folder,'source.mp4'));
        const materials=[];for(const m of materialInputs){const name='slot-'+m.id+path.extname(m.file).toLowerCase();await copyFile(m.file,path.join(folder,name));materials.push({id:m.id,src:name,kind:m.kind,startFrame:m.startFrame??0});}
        const from=ref&&asset.source.kind==='reference'&&kind==='reference'?Math.floor(asset.source.startMs*30/1000):0;
        if(ref&&from+durationFrames>Math.floor(ref.durationMs*30/1000))throw Error('参考素材时长不足，请缩短预览区间');
        const scene={id:asset.id,title:asset.name,parameters:values,from,duration:durationFrames,words:[],beats:asset.cues.filter(c=>cueFrames[c.id]!==undefined).map(c=>({wordId:c.id,label:c.id,frame:cueFrames[c.id]})),materials,mediaSrc:media?'source.mp4':''};
        const entry=path.join(folder,'entry.tsx');
        await writeFile(entry,`import React from 'react';import {AbsoluteFill,Composition,registerRoot} from 'remotion';import {VisualAsset} from ${JSON.stringify(modulePath)};const Preview=(props)=><AbsoluteFill style={{background:${JSON.stringify(asset.mount==='OBJECT'?asset.previewBackground:'transparent')}}}><VisualAsset {...props}/></AbsoluteFill>;registerRoot(()=> <Composition id="Preview" component={Preview} width={1920} height={1080} fps={30} durationInFrames={${durationFrames}} defaultProps={${JSON.stringify(scene)}}/>);`);
        const aliases=await creativeRuntimeAliases(root);
        const serveUrl=await bundle({entryPoint:entry,publicDir:folder,webpackOverride:config=>({...config,resolve:{...config.resolve,alias:{...config.resolve?.alias,...Object.fromEntries(Object.entries(aliases).map(([name,entry])=>[name+'$',entry]))}}}),onProgress:()=>task.check()});task.check();
        const runtime={...remotionRuntime(root),...creativeRenderOptions([asset.dependencies])},composition=await selectComposition({serveUrl,id:'Preview',...runtime});
        const cancellation=makeCancelSignal();task.signal.addEventListener('abort',()=>cancellation.cancel(),{once:true});
        await renderMedia({serveUrl,composition,codec:'h264',outputLocation:path.join(folder,'review.mp4'),concurrency:2,muted:true,cancelSignal:cancellation.cancelSignal,...runtime,onProgress:p=>{if(p.progress-preview.progress>=0.1){preview.progress=p.progress;void store.updatePreview(member,id,{progress:p.progress}).catch(()=>undefined);}}});
        task.check();if((await store.getAsset(member)).sourceHash!==asset.sourceHash)throw Error('源码已变化，本次结果未发布');
        await store.verifyAsset(asset);if((await resolveCreativeDependencies(asset.dependencies,root)).fingerprint!==dependencyRuntime.fingerprint)throw Error('动画依赖运行时已变化，请重新生成预览');await store.updatePreview(member,id,{status:'done',progress:1,outputHash:await fileHash(path.join(folder,'review.mp4'))});
      }catch(error){await store.updatePreview(member,id,{status:task.signal.aborted?'cancelled':'failed',error:task.signal.aborted?'已取消，可重新生成':(error as Error).message});}
      finally{active=null;task.release();}
    })();return id;
  }
  router.post('/asset-preview',route(async(req,res)=>{revision.parse(req.body.expectedRevision);if((await store.get()).revision!==req.body.expectedRevision)throw Error('资产库已变化，请刷新');const id=await renderPreview(req.body);res.json({...await response(),jobId:id});}));
  router.post('/pack-preview',route(async(req,res)=>{
    if((await store.get()).revision!==revision.parse(req.body.expectedRevision))throw Error('资产库已变化，请刷新');
    const member=visualMemberSchema.parse(req.body.member),pack=await store.getPack(member),clips:{file:string;id:string;version:string;sourceHash:string;previewId:string;dependencyFingerprint?:string}[]=[];
    for(const m of pack.members){const asset=await store.getAsset(m);await store.verifyAsset(asset);const style=styleValuesFor(asset,pack),runtime=await resolveCreativeDependencies(asset.dependencies,root);
      const preview=asset.previews.findLast(p=>p.status==='done'&&p.sourceHash===asset.sourceHash&&p.dependencyFingerprint===runtime.fingerprint&&Object.entries(style).every(([key,value])=>JSON.stringify(p.values[key])===JSON.stringify(value)));
      if(!preview||!preview.outputHash)throw Error('请先按本包样式生成成员的实际预览：'+asset.name);
      const file=await regularWithin(store.dir,'previews',preview.id,'review.mp4');if(await fileHash(file)!==preview.outputHash)throw Error('成员样片已变化，请重新渲染：'+asset.name);
      clips.push({file,id:asset.id,version:asset.version,sourceHash:asset.sourceHash,previewId:preview.id,...runtime.fingerprint?{dependencyFingerprint:runtime.fingerprint}:{}});}
    const task=lane.reserve();active={id:task.id,kind:'pack',subject:memberKey(member)};lastTaskError=undefined;
    void(async()=>{try{const folder=path.join(store.dir,'previews',task.id);await mkdir(folder,{recursive:true});
      // All inputs are generated 1080p30 clips. Copy into controlled paths so the concat file never contains user text.
      for(let i=0;i<clips.length;i++)await copyFile(clips[i].file,path.join(folder,'clip-'+i+'.mp4'));
      await writeFile(path.join(folder,'concat.txt'),clips.map((_,i)=>"file 'clip-"+i+".mp4'").join('\n'));
      await exec(runtimeCommand('ffmpeg'),['-v','error','-y','-f','concat','-safe','1','-i',path.join(folder,'concat.txt'),'-c','copy','-movflags','+faststart',path.join(folder,'review.mp4')],{signal:task.signal,maxBuffer:1024*1024});task.check();
      await store.saveDemonstration(member,{id:task.id,url:'/api/visual-library/media/previews/'+task.id+'/review.mp4',outputHash:await fileHash(path.join(folder,'review.mp4')),createdAt:new Date().toISOString(),members:clips.map(({file,...m})=>m)});
    }catch(error){lastTaskError=task.signal.aborted?'风格包演示已取消':(error as Error).message;}finally{active=null;task.release();}})();res.json({...await response(),jobId:task.id});
  }));
  router.post('/cancel',route(async(req,res)=>{lane.cancel(z.string().uuid().parse(req.body.jobId));res.json({cancelling:true});}));
  return {router,store,sceneProvider,assetDetail,prepareReference,renderPreview,isBusy:()=>lane.isBusy(),shutdown:()=>lane.stop(),response};
}
export type VisualLibraryService=Awaited<ReturnType<typeof createVisualLibraryService>>;
