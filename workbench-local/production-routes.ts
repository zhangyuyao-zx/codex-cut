import {activeMaterialRequests} from './active-material-requests';
import {rendererSourceIdentity} from "./renderer-source-identity";
import {remotionRuntime, runtimeCommand} from "./runtime-paths";
import type { createComponentLibrary } from "./component-library";
import { Router } from "express";
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  cp,
  rename,
  access,
  unlink,
  mkdtemp,
  rm,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import { createWriteStream,constants } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createProductionStore } from "./production-store";
import { createRoughcutService, findCutWord } from "./roughcut-service";
import {
  resolveProduction,
  buildSpokenTimelineProps,
} from "./production-binding";
import { createComponentAssets } from "./component-assets";
import {
  resolveComponentMedia,
  validateComponentInterval,
} from "./component-media";
import { createSceneModules } from "./scene-modules";
import { createAnimationTemplates } from "./animation-templates";
import { reviewActions } from "./action-review";
import { bindScenePrograms } from "./scene-program-binding";
import { summarizeCreativeDesign } from "./creative-design";
import {
  legacyControls,
  legacyObjects,
  validateLegacyOverrides,
  preserveSceneEdits,
} from "./editable-objects";
import { createEditorSelection } from "./editor-selection";
import { RenderLane } from "./render-lane";
import {
  SegmentReviewStore,
  segmentRanges,
  segmentReviewState,
  assemblySegments,
  fileDigest,
} from "./segment-reviews";
import { productionCompositionSource } from "./production-composition";
import { assembleSegmentPictures } from "./segment-assembly";
import {createContentDigester} from './cut-media-identity';
import {buildSceneCutIdentity} from './scene-media-dependencies';
import {renderRuntimeIdentity} from './render-runtime-identity';
import {previousTransitionScene,transitionRenderPlan,withoutEntryTransition,assertTransitionPredecessors} from './transition-dependencies';
const exec = promisify(execFile);
export async function productionRoutes(
  root: string,
  projectDir: string,
  library: Awaited<ReturnType<typeof createComponentLibrary>>,
) {
  const dir = resolve(projectDir, "production"),
    assets = resolve(dir, "assets"),
    store = await createProductionStore(dir),
    cutStore = await createRoughcutService(resolve(projectDir, "cut"));
  await mkdir(assets, { recursive: true });
  const componentAssets = await createComponentAssets(
    resolve(dir, "component-assets"),
  );
  const sceneModules = createSceneModules(root);
  const animationTemplates = createAnimationTemplates(
    root,
    resolve(projectDir, "animation-templates"),
    {resolveComponentAsset: id=>componentAssets.resolve(id),componentAssetDirectory:resolve(dir,'component-assets'),materialDirectory:assets},
  );
  const selectionStore = await createEditorSelection(dir);
  const lane = new RenderLane();
  const contentDigest=createContentDigester();
  const segmentStore = new SegmentReviewStore(
    resolve(dir, "segment-reviews.json"),
  );
  await segmentStore.recover();
  let job: any = null,
    approval: any = null,
    sampleJob: any = null,
    lastGood: any = null;
  try {
    job = JSON.parse(await readFile(resolve(dir, "last-render.json"), "utf8"));
    if (["rendering", "cancelling"].includes(job.status))
      job = { ...job, status: "failed", error: "上次渲染已中断，可以重试。" };
  } catch {}
  try {
    approval = JSON.parse(
      await readFile(resolve(dir, "approval.json"), "utf8"),
    );
  } catch {}
  try {
    sampleJob = JSON.parse(
      await readFile(resolve(dir, "last-sample.json"), "utf8"),
    );
    if (["rendering", "cancelling"].includes(sampleJob.status))
      sampleJob = {
        ...sampleJob,
        status: "failed",
        error: "上次样片渲染已中断，可以重试。",
      };
  } catch {}
  try {
    lastGood = JSON.parse(
      await readFile(resolve(dir, "last-good-render.json"), "utf8"),
    );
  } catch {}
  if (!lastGood && job?.status === "done") {
    lastGood = { ...job };
    await writeFile(
      resolve(dir, "last-good-render.json"),
      JSON.stringify(lastGood),
    );
  }
  async function persistState(name: string, value: any) {
    const path = resolve(dir, name),
      temp = path + "." + randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(value));
    await rename(temp, path);
  }
  const persistSample = async () => {
    await persistState("last-sample.json", sampleJob);
    if (sampleJob?.sceneId && sampleJob.segmentReview)
      await segmentStore.save(sampleJob);
  };
  const persistJob = () => persistState("last-render.json", job);
  // Recovery is durable, not merely an in-memory label.
  if (job) await persistJob();
  if (sampleJob) await persistSample();
  async function context(sceneId?: string) {
    const [originalPlan, cut] = await Promise.all([
      store.get(),
      cutStore.get(),
    ]);
    if (sceneId && !originalPlan.scenes.some((s) => s.id === sceneId))
      throw Error("段落不存在");
    const effectivePlan = {...originalPlan, requests:activeMaterialRequests(originalPlan)};
    const selectPlan = (id?: string) =>
      id
        ? {
            ...effectivePlan,
            scenes: originalPlan.scenes.filter((s) => s.id === id),
            requests: effectivePlan.requests.filter((r) => r.sceneId === id),
            feedback: originalPlan.feedback.filter((r) => r.sceneId === id),
          }
        : effectivePlan;
    const plan = transitionRenderPlan(effectivePlan,sceneId);
    const resolved = resolveProduction(plan, cut);
    let moduleCatalog: any[] = [],
      moduleCatalogError = "";
    try {
      moduleCatalog = await (await sceneModules).list();
    } catch (e) {
      moduleCatalogError = (e as Error).message;
    }
    const codeFiles = [
        "Scene.tsx",
        "ProductionProgram.tsx",
        "production-binding.ts",
        "production-composition.ts",
        "production-render-entry.tsx",
        "ComponentSurface.tsx",
        "SceneModuleSurface.tsx",
        "SceneTransitionSurface.tsx",
        "scene-transition.ts",
        "scene-program-binding.ts",
        "component-media.ts",
        "AppLibraryComponent.jsx",
        "../modules/components/component-runtime-identity.generated.ts",
      ];
    const componentOnlyCode=new Set(['component-media.ts','AppLibraryComponent.jsx','../modules/components/component-runtime-identity.generated.ts']);
    const code = await Promise.all(codeFiles.map((f) => readFile(resolve(root, "workbench-local", f), "utf8")));
    const componentGraphs=new Map<string,Promise<{sourceIdentity?:string;error?:string}>>();
    const componentSources = await Promise.all(
      originalPlan.scenes.flatMap((s) =>
        (s.components || []).map(async (selected) => {
          const d = await library.detail(selected.componentId);
          let graph=componentGraphs.get(d.modulePath);
          if(!graph){
            graph=rendererSourceIdentity(root,d.modulePath,contentDigest)
              .then(sourceIdentity=>({sourceIdentity})).catch(error=>({error:(error as Error).message}));
            componentGraphs.set(d.modulePath,graph);
          }
          const identity=await graph;
          return {
            sceneId: s.id,
            source: identity.error ? "" : await readFile(d.modulePath, "utf8"),
            ...identity,
          };
        }),
      ),
    );
    let ranges: ReturnType<typeof segmentRanges> = [];
    try {
      ranges = segmentRanges(
        resolveProduction(originalPlan, cut).scenes,
        resolved.durationMs,
      );
    } catch {}
    const externalInputs:Array<{sceneId:string;role:string;fileName:string;sha256?:string;kind?:string;durationFrames?:number;error?:string}>=[];
    let externalInputError='';
    for(const scene of originalPlan.scenes){
      for(const request of effectivePlan.requests.filter(r=>r.sceneId===scene.id&&r.status==='provided')){
        try{
          if(!request.fileName||basename(request.fileName)!==request.fileName||/[\\\u0000]/.test(request.fileName))throw Error('素材绑定无效');
          externalInputs.push({sceneId:scene.id,role:'material:'+request.id,fileName:request.fileName,
            sha256:await contentDigest(resolve(assets,request.fileName))});
        }catch{const error=`素材「${request.description}」无法读取，请重新提供`;externalInputError=error;
          externalInputs.push({sceneId:scene.id,role:'material:'+request.id,fileName:request.fileName||'',error});}
      }
      for(const selected of scene.components||[])for(const binding of selected.mediaBindings||[]){
        if(binding.source!=='asset')continue;
        try{const asset=await componentAssets.resolve(binding.assetId);
          externalInputs.push({sceneId:scene.id,role:'component:'+selected.id+':'+asset.id,
            fileName:asset.fileName,sha256:await contentDigest(asset.path),kind:asset.kind,durationFrames:asset.durationFrames});
        }catch{const error='组件素材无法读取，请替换该组件绑定的图片或视频';externalInputError=error;
          externalInputs.push({sceneId:scene.id,role:'component:'+selected.id+':'+binding.assetId,fileName:'',error});}
      }
    }
    const keyFor = (designPlan: typeof plan) =>
      createHash("sha256")
        .update(
          JSON.stringify({
            design: {
              source: designPlan.source,
              scenes: designPlan.scenes,
              requests: designPlan.requests,
            },
            segmentFrameRanges: ranges.filter((r) =>
              designPlan.scenes.some((s) => s.id === r.sceneId),
            ),
            cutRevision: cut.revision,
            media: cut.preview,
            code,
            componentSources: componentSources.filter((x) =>
              designPlan.scenes.some((s) => s.id === x.sceneId),
            ),
            sceneSources: moduleCatalog
              .filter((m: any) =>
                designPlan.scenes.some((s) => s.program?.moduleId === m.id),
              )
              .map((m: any) => m.sourceHash),
            ...(externalInputs.some(x=>designPlan.scenes.some(s=>s.id===x.sceneId))?{
              externalInputs:externalInputs.filter(x=>designPlan.scenes.some(s=>s.id===x.sceneId))}:{}),
          }),
        )
        .digest("hex");
    let runtimeHash:string|null=null;
    let runtimeIdentityError='';
    let audited:Record<string,string>={};
    if(cut.timeline&&cut.preview?.provenance){
      try{
        runtimeHash=await renderRuntimeIdentity(root,contentDigest);
        const audit=JSON.parse(await readFile(resolve(root,'workbench-local/scene-media-contracts.json'),'utf8'));
        if(audit.version===1)audited=audit.modules;
      }catch(error){
        runtimeHash=null;
        runtimeIdentityError=(error as Error).message;
      }
    }
    const preciseScenes=new Set<string>();
    const plainSceneKeys=Object.fromEntries(await Promise.all(originalPlan.scenes.map(async scene=>{
      const own=selectPlan(scene.id);
      const single={...own,scenes:own.scenes.map(withoutEntryTransition)},range=ranges.find(r=>r.sceneId===scene.id);
      const fallback=()=>[scene.id,keyFor(single)] as const;
      if(!cut.timeline||!cut.preview?.provenance?.renderSource||!runtimeHash||!scene.program||!range||resolved.stale||resolved.issues.length||externalInputs.some(x=>x.sceneId===scene.id&&x.error))
        return fallback();
      try{
        const binding=resolveProduction(single,cut);
        const [program]=await bindScenePrograms(single,binding,await sceneModules);
        const layers=await componentLayers(single,binding,Math.round(resolved.durationMs*30/1000));
        const media=await buildSceneCutIdentity(cut,range,resolve(projectDir,'cut'),contentDigest,
          audited[program.moduleId]===program.sourceHash?'window':'full-cut');
        const {modulePath:unusedPath,...programInput}=program;
        const layerInputs=layers.map(({modulePath:unusedLayerPath,...layer}:any)=>layer);
        const hash=createHash('sha256').update(JSON.stringify({version:2,
          design:{scenes:single.scenes,requests:single.requests},range,program:programInput,layers:layerInputs,
          ...(layers.length?{componentCompositionDuration:Math.round(resolved.durationMs*30/1000)}:{}),
          ...(media.scope==='full-cut'?{globalRenderInputs:{duration:Math.round(resolved.durationMs*30/1000),
            words:resolved.words,scenes:originalPlan.scenes,requests:effectivePlan.requests,
            externalInputs,moduleSources:moduleCatalog.map(m=>({id:m.id,sourceHash:m.sourceHash}))}}:{}),
          media,encodingHash:cut.preview.provenance.encodingHash,runtimeHash,
          code:code.filter((_,i)=>layers.length||!componentOnlyCode.has(codeFiles[i])),
          componentSources:componentSources.filter(x=>x.sceneId===scene.id),
          externalInputs:externalInputs.filter(x=>x.sceneId===scene.id),
        })).digest('hex');
        preciseScenes.add(scene.id);
        return [scene.id,hash] as const;
      }catch{return fallback();}
    })));
    const sceneKeys=Object.fromEntries(originalPlan.scenes.map(scene=>{
      const previous=previousTransitionScene(originalPlan,scene.id);
      if(!previous)return [scene.id,plainSceneKeys[scene.id]];
      const range=ranges.find(r=>r.sceneId===scene.id),exit=ranges.find(r=>r.sceneId===previous.id);
      return [scene.id,createHash('sha256').update(JSON.stringify({version:1,plain:plainSceneKeys[scene.id],
        entryTransition:scene.entryTransition,outgoingPlain:plainSceneKeys[previous.id],range,exit})).digest('hex')];
    }));
    const key=sceneId?sceneKeys[sceneId]:originalPlan.scenes.length&&originalPlan.scenes.every(s=>preciseScenes.has(s.id))?
      createHash('sha256').update(JSON.stringify({version:2,duration:Math.round(resolved.durationMs*30/1000),
        scenes:originalPlan.scenes.map(s=>({id:s.id,key:sceneKeys[s.id]}))})).digest('hex'):keyFor(plan);
    const ledger = await segmentStore.get();
    const segmentReviews = ranges.map((r) => {
      const review = segmentReviewState(
        r,
        sceneKeys[r.sceneId],
        ledger.renders,
        ledger.approvals,
        originalPlan.feedback.filter(
          (f) => f.sceneId === r.sceneId && f.status === "open",
        ).length,
      );
      if (review.latest && review.latest.id === sampleJob?.id)
        Object.assign(review.latest, {
          progress: sampleJob.progress,
          stage: sampleJob.stage,
          status: sampleJob.status,
        });
      return review;
    });
    const approvedSamples = segmentReviews
      .filter((r) => r.status === "approved")
      .map((r) => r.approved);
    let assemblyReady = false;
    try {
      if(componentSources.some(x=>x.error))throw Error('组件实现不可用');
      if(externalInputError)throw Error('补充素材不可用：'+externalInputError);
      assemblySegments(
        segmentReviews,
        Math.round((resolved.durationMs * 30) / 1000),
      );
      assemblyReady = !resolved.stale && !resolved.issues.length;
    } catch {}
    const designStatus = Object.fromEntries(
      originalPlan.scenes.map((s) => [s.id, summarizeCreativeDesign(s)]),
    );
    let props: any = null,
      programError = "";
    try {
      assertTransitionPredecessors({scenes:plan.scenes});
      const componentError=componentSources.find(x=>x.error&&plan.scenes.some(s=>s.id===x.sceneId))?.error;
      if(componentError)throw Error('组件实现不可用：'+componentError);
      const selectedInputError=externalInputs.find(x=>x.error&&plan.scenes.some(s=>s.id===x.sceneId))?.error;
      if(selectedInputError)throw Error('补充素材不可用：'+selectedInputError);
      if(cut.timeline&&cut.preview?.provenance&&!runtimeHash)
        throw Error('无法确认渲染运行环境，请配置本地 Chromium 和 compositor 后重新检查'+(runtimeIdentityError?'：'+runtimeIdentityError:''));
      await cutStore.verifyPreview(cut.revision);
      if (plan.scenes.some((s) => s.program)) {
        if (moduleCatalogError) throw Error(moduleCatalogError);
        if (!cut.preview || cut.preview.revision !== cut.revision)
          throw Error("请先生成当前粗剪预览");
        props = {
          duration: Math.round((resolved.durationMs * 30) / 1000),
          words: resolved.words.map((w) => ({
            text: w.text,
            start: Math.round((w.startMs * 30) / 1000),
            end: Math.round((w.endMs * 30) / 1000),
          })),
          scenePrograms: await bindScenePrograms(
            { ...plan, scenes: plan.scenes.filter((s) => s.program) },
            resolveProduction(
              { ...plan, scenes: plan.scenes.filter((s) => s.program) },
              cut,
            ),
            await sceneModules,
          ),
        };
      } else props = buildSpokenTimelineProps(originalPlan, cut);
      if (!props.scenePrograms && lastGood?.url) {
        try {
          const snapshot = JSON.parse(
            await readFile(
              resolve(
                dir,
                "renders",
                basename(lastGood.url.replace(/\/review\.mp4$/, "")),
                "snapshot.json",
              ),
              "utf8",
            ),
          );
          if (snapshot.cut.preview?.url === cut.preview?.url) {
            props.wave = snapshot.props.wave || [];
            props.excerptWave = snapshot.props.excerptWave || [];
          }
        } catch {}
      }
      props.sceneEdits = resolved.scenes.map((s) => ({
        id: s.id,
        from: Math.round((s.startMs! * 30) / 1000),
        end: Math.round((s.endMs! * 30) / 1000),
        overrides: s.editor?.overrides || {},
      }));
      for (const s of plan.scenes)
        if (!s.program) validateLegacyOverrides(s.editor?.overrides);
      props.componentLayers = await componentLayers(
        plan,
        resolved,
        Math.round((resolved.durationMs * 30) / 1000),
      );
      if(props.scenePrograms) {
        props.scenePrograms=props.scenePrograms.map((input:any)=>{
          const current=plan.scenes.find(s=>s.id===input.id)!;
          const ownRange=ranges.find(r=>r.sceneId===input.id);
          const previous=previousTransitionScene(plan,input.id);
          const outgoing=previous && props.scenePrograms.find((s:any)=>s.id===previous.id);
          const exit=previous && ranges.find(r=>r.sceneId===previous.id);
          return {...input,...(current.entryTransition?{entryTransition:current.entryTransition}:{}),
            ...(ownRange?{transitionSpanFrames:ownRange.end-input.from}:{}),
            ...(outgoing&&exit?{transitionFromSceneId:outgoing.id,transitionOutgoingFrame:exit.end-1-outgoing.from}:{})};
        });
      }

    } catch (e) {
      props = null;
      programError = (e as Error).message;
      assemblyReady = false;
    }
    // A retained render from a different imported video is not this video's previous version.
    let previousReview = lastGood;
    if (previousReview) {
      let sourceAssetUrl = previousReview.sourceAssetUrl;
      if (!sourceAssetUrl && previousReview.url) {
        try {
          const snapshot = JSON.parse(
            await readFile(
              resolve(
                dir,
                "renders",
                basename(previousReview.url.replace(/\/review\.mp4$/, "")),
                "snapshot.json",
              ),
              "utf8",
            ),
          );
          sourceAssetUrl = snapshot.cut?.asset?.url;
        } catch {}
      }
      if (!sourceAssetUrl || sourceAssetUrl !== cut.asset?.url)
        previousReview = null;
    }
    const result={
      capabilities:{sceneTransitions:true},
      plan,
      cut,
      selection: await selectionStore.get(),
      previousReview,
      sceneEditors: Object.fromEntries(
        originalPlan.scenes.map((s) => {
          const m = s.program
            ? moduleCatalog.find((m) => m.id === s.program!.moduleId)
            : null;
          const controls = s.program
            ? m?.controls || []
            : legacyControls.map((c) =>
                c.key === "headline" ? { ...c, default: s.title } : c,
              );
          return [
            s.id,
            {
              objects: s.program ? m?.objects || [] : legacyObjects,
              controls,
              parameters: {
                ...Object.fromEntries(
                  controls
                    .filter((c: any) => c.default !== undefined)
                    .map((c: any) => [c.key, c.default]),
                ),
                ...s.program?.parameters,
                ...s.editor?.overrides,
              },
              locks: s.editor?.locks || [],
            },
          ];
        }),
      ),
      resolved,
      key,
      props,
      programError,
      sceneModules: moduleCatalog,
      designStatus,
      approvedSamples,
      segmentReviews,
      assemblyReady,
      sample: sampleJob
        ? {
            ...sampleJob,
            current: sceneKeys[sampleJob.sceneId] === sampleJob.key,
          }
        : null,
      job: job ? { ...job, current: job.key === key } : null,
      approval: approval?.key === key ? approval : null,
    };
    return Object.defineProperties(result,{renderInputs:{value:externalInputs},runtimeIdentity:{value:runtimeHash}}) as typeof result&{renderInputs:typeof externalInputs;runtimeIdentity:string|null};
  }
  async function assertTaskCurrent(task:any){
    const latest=await context(task.sceneId);
    if(latest.key!==task.key||!latest.props||latest.resolved.stale||latest.resolved.issues.length||
      (task.kind==='assembly'&&!latest.assemblyReady))
      throw Error('制作内容已更新，本次结果未发布，请生成当前版本');
  }
  async function componentLayers(
    plan: any,
    resolved: ReturnType<typeof resolveProduction>,
    cutDuration: number,
  ) {
    const layers: any[] = [];
    for (const s of plan.scenes)
      for (const selected of s.components || []) {
        const d = await library.validate(selected);
        const segment = resolved.scenes.find((sc) => sc.id === s.id)!;
        const start = findCutWord(resolved.words, selected.startWordId);
        const end = findCutWord(resolved.words, selected.endWordId);
        if (
          !start ||
          !end ||
          start.startMs >= end.endMs ||
          start.startMs < segment.startMs! ||
          end.endMs > segment.endMs!
        )
          throw Error("组件的出现区间必须在当前段落内，且引用词仍存在");
        const from = Math.round((start.startMs * 30) / 1000);
        const duration = Math.max(
          1,
          Math.round((end.endMs * 30) / 1000) - from,
        );
        validateComponentInterval(d.mount, d.resolvedParameters, duration);
        const mediaSources = await resolveComponentMedia({
          bindings: selected.mediaBindings,
          count: d.requiredMedia,
          from,
          duration,
          cutDuration,
          resolveAsset: (id) => componentAssets.resolve(id),
        });
        layers.push({
          ...selected,
          appAdapter: d.appAdapter,
          mediaSources,
          props: d.resolvedParameters,
          mediaSrc: d.requiredMedia ? "source.mp4" : undefined,
          mediaStartFrame: Math.round((start.startMs * 30) / 1000),
          width: d.width,
          height: d.height,
          modulePath: d.modulePath,
          exportName: d.exportName,
          from: Math.round((start.startMs * 30) / 1000),
          duration: Math.max(
            1,
            Math.round((end.endMs * 30) / 1000) -
              Math.round((start.startMs * 30) / 1000),
          ),
        });
      }
    return layers;
  }
  async function validateEdits(scenes: any[]) {
    assertTransitionPredecessors({scenes});
    for (const s of scenes) {
      if(s.entryTransition&&!s.program)throw Error("完整场景转场需要明确的动画实现");
      if (s.program) {
        const d = await sceneModules.validate({
          ...s.program,
          parameters: { ...s.program.parameters, ...s.editor?.overrides },
        });
        if (
          s.editor?.locks.some(
            (k: string) => !d.controls.some((c) => c.key === k),
          )
        )
          throw Error("锁定参数已被删除，请先迁移");
      } else {
        validateLegacyOverrides(s.editor?.overrides);
        if (
          s.editor?.locks.some(
            (k: string) => !legacyControls.some((c) => c.key === k),
          )
        )
          throw Error("锁定参数无效");
      }
    }
  }
  const router = Router();
  router.get("/animation-templates", async (_req, res, next) => {
    try {
      res.json({ items: await animationTemplates.list(), packageSupport: true });
    } catch (e) {
      next(e);
    }
  });
  router.get("/animation-templates/export/:id", async (req, res, next) => {
    let temporary = "";
    try {
      temporary = await mkdtemp(resolve(tmpdir(), "codex-animation-export-"));
      const output = resolve(temporary, "animation.cutanimation");
      await animationTemplates.exportPackage(String(req.params.id), output);
      const cleanup = temporary;
      res.download(output, "animation.cutanimation", (error) => {
        void rm(cleanup, {recursive:true, force:true}).catch(() => undefined);
        if(error && !res.headersSent) next(error);
      });
      temporary = "";
    } catch(error) { next(error); }
    finally { if(temporary) await rm(temporary,{recursive:true,force:true}); }
  });
  router.post("/animation-templates/import", async (req, res, next) => {
    let temporary = "";
    try {
      if(!req.is("application/octet-stream")) throw Error("请上传 .cutanimation 动画包");
      temporary = await mkdtemp(resolve(tmpdir(), "codex-animation-upload-"));
      const input = resolve(temporary, "animation.cutanimation");
      let bytes = 0;
      await pipeline(req, new Transform({transform(chunk,_encoding,callback) {
        bytes += chunk.length;
        callback(bytes > 1024 ** 3 ? Error("动画包上限1GB") : null,chunk);
      }}),createWriteStream(input,{flags:"wx",mode:0o600}));
      const imported = await animationTemplates.importPackage(input);
      res.json({...imported,items:await animationTemplates.list()});
    } catch(error) { next(error); }
    finally { if(temporary) await rm(temporary,{recursive:true,force:true}); }
  });
  router.post("/animation-templates/save", async (req, res, next) => {
    try {
      const plan = await store.get();
      if (req.body.expectedRevision !== plan.revision)
        throw Error("工程已变化，请刷新后再保存动画");
      const scene = plan.scenes.find((s) => s.id === req.body.sceneId);
      if (!scene) throw Error("段落不存在");
      const selection = await selectionStore.get();
      if (selection.hasUnsavedChanges)
        throw Error("请先保存当前画面调整，再收藏动画");
      const cut = await cutStore.get();
      const spoken = resolveProduction({...plan, scenes:[scene]}, cut);
      if(spoken.stale || spoken.issues.length) throw Error("请先修复当前段落的口播绑定再保存动画");
      const range = spoken.scenes[0];
      await componentLayers({...plan,scenes:[scene]},spoken,Math.round(spoken.durationMs*30/1000));
      const labels = reviewActions(undefined, range.beats, range.startMs, range.endMs, spoken.words);
      const canonicalWord = (id: string) => findCutWord(spoken.words, id)?.sourceId ?? id;
      const savedScene = {...scene,
        startWordId:canonicalWord(scene.startWordId), endWordId:canonicalWord(scene.endWordId),
        design:scene.design ? {...scene.design,actions:scene.design.actions.map(a=>({...a,wordId:canonicalWord(a.wordId)}))} : undefined,
        components:scene.components?.map(c=>({...c,startWordId:canonicalWord(c.startWordId),endWordId:canonicalWord(c.endWordId)})),
        beats:scene.beats.map((b,i)=>({...b,wordId:canonicalWord(b.wordId),label:labels[i].label}))};
      res.json(
        await animationTemplates.save({
          name: req.body.name,
          scene: savedScene,
          wordOrder:spoken.words.filter(w=>w.startMs>=range.startMs! && w.endMs<=range.endMs!).map(w=>w.sourceId),
          requests:activeMaterialRequests(plan).filter(r=>r.sceneId===scene.id),
          expectedSourceHash: req.body.expectedSourceHash,
        }),
      );
    } catch (e) {
      next(e);
    }
  });
  async function prepareAnimation(input: any, installDefaults = false) {
    const plan = await store.get(),
      cut = await cutStore.get();
    if (input.expectedRevision !== plan.revision)
      throw Error("工程已变化，请刷新后重新预览");
    if (!cut.preview || cut.preview.revision !== cut.revision)
      throw Error("请先生成当前粗剪预览");
    const target = plan.scenes.find((s) => s.id === input.sceneId);
    if (!target) throw Error("目标段落不存在");
    const candidate = await animationTemplates.instantiate({
      id: input.id,
      target,
      bindings: input.bindings,
    });
    const currentRequests = plan.requests.filter((r) => r.sceneId === target.id);
    const requests = await animationTemplates.instantiateMaterials(
      input.id, target, currentRequests, installDefaults,
    );
    const archivedPreview = new Map<string,string>();
    if (!installDefaults) {
      const saved = (await animationTemplates.list()).find(t => t.id === input.id || t.moduleId === input.id);
      for (const request of requests) {
        if (!request.animationSlot || currentRequests.some(r => r.id === request.id)) continue;
        const material = saved?.contents?.materials.find(m => m.id === request.animationSlot!.materialId);
        if (!material) throw Error("保存动画的素材槽位不存在，请重新保存动画");
        archivedPreview.set(request.animationSlot.materialId,
          "/saved-animations/" + candidate.program!.moduleId + "/" + material.archiveName);
      }
    }
    const draft = {
      ...plan,
      scenes: [candidate],
      requests,
      feedback: [],
    };
    const resolved = resolveProduction(draft, cut);
    if (resolved.stale || resolved.issues.length)
      throw Error(resolved.issues.join("\n") || "请先同步剪辑时间");
    const range = resolved.scenes[0];
    const words = resolved.words.filter(
      (w) => w.startMs >= range.startMs! && w.endMs <= range.endMs!,
    );
    let previous = -1;
    for (const beat of candidate.beats) {
      const selectedWord = findCutWord(words, beat.wordId);
      const index = selectedWord ? words.indexOf(selectedWord) : -1;
      if (index < 0 || index <= previous)
        throw Error("出现点必须按口播顺序选择，且全部位于目标段落内");
      previous = index;
    }
    await validateEdits([candidate]);
    const [bound] = await bindScenePrograms(draft, resolved, sceneModules);
    const layers = await componentLayers(
      draft,
      resolved,
      Math.round((resolved.durationMs * 30) / 1000),
    );
    const module = await sceneModules.detail(candidate.program!.moduleId);
    return {
      plan,
      candidate,
      requests,
      module,
      input: {
        ...bound,
        mediaSrc: cut.preview.url,
        materials: bound.materials.map((m) => ({
          ...m,
          src: archivedPreview.get(m.id) || "/production-media/assets/" + m.src,
        })),
        componentLayers: layers.map((l: any) => ({
          ...l,
          mediaSources: l.mediaSources.map((m: any) => ({
            ...m,
            src: m.assetId
              ? "/api/production/component-assets/file/" + m.assetId
              : cut.preview!.url,
          })),
        })),
      },
    };
  }
  router.post("/animation-templates/preview", async (req, res, next) => {
    try {
      const draft = await prepareAnimation(req.body);
      res.json({ module: draft.module, input: draft.input });
    } catch (e) {
      next(e);
    }
  });
  router.post("/animation-templates/apply", async (req, res, next) => {
    try {
      const selection = await selectionStore.get();
      if (selection.hasUnsavedChanges)
        throw Error("当前画面还有未保存修改，请先保存或放弃");
      const draft = await prepareAnimation(req.body, true);
      await store.setSceneWithRequests(
        req.body.expectedRevision, draft.candidate, draft.requests,
      );
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.use("/component-assets", componentAssets.router);
  router.get("/", async (_req, res) => res.json(await context()));
  router.get("/context", async (req, res, next) => {
    try {
      const sceneId=req.query.sceneId;
      if(sceneId!==undefined&&(typeof sceneId!=="string"||!sceneId))throw Error("段落标识无效");
      res.json(await context(sceneId));
    } catch(error) { next(error); }
  });
  router.post("/selection", async (req, res, next) => {
    try {
      const c = await context();
      const input = req.body;
      if (
        input.sceneId !== null &&
        !c.plan.scenes.some((s) => s.id === input.sceneId)
      )
        throw Error("所选段落不存在");
      if (
        input.objectId !== null &&
        !c.sceneEditors[input.sceneId]?.objects.some(
          (o: any) => o.id === input.objectId,
        )
      )
        throw Error("所选对象尚未声明可编辑");
      if (input.timeSeconds > c.resolved.durationMs / 1000 + 0.05)
        throw Error("播放位置超出视频范围");
      res.json(await selectionStore.set(input));
    } catch (e) {
      next(e);
    }
  });
  router.post("/parameters", async (req, res, next) => {
    try {
      const plan = await store.get();
      const s = plan.scenes.find((s) => s.id === req.body.sceneId);
      if (!s) throw Error("段落不存在");
      const patch = req.body.patch;
      if (!patch || typeof patch !== "object" || Array.isArray(patch))
        throw Error("参数修改必须为对象");
      if (
        req.body.actor !== "user" &&
        Object.keys(patch).some((k) => s.editor?.locks.includes(k))
      )
        throw Error("参数已锁定，请由用户解锁后修改");
      const next = {
        ...s,
        editor: {
          overrides: { ...s.editor?.overrides, ...patch },
          locks: s.editor?.locks || [],
        },
      };
      const scenes = plan.scenes.map((x) => (x.id === s.id ? next : x));
      await validateEdits([next]);
      await store.setScenes(
        req.body.expectedRevision,
        plan.source,
        scenes,
        "user",
      );
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/scene-edit", async (req, res, next) => {
    try {
      const [plan,cut]=await Promise.all([store.get(),cutStore.get()]);
      const scene=plan.scenes.find(s=>s.id===req.body.sceneId);
      if(!scene)throw Error("段落不存在");
      const patch=req.body.patch;
      if(!patch||typeof patch!=="object"||Array.isArray(patch)||
        Object.keys(patch).some(key=>!["title","intent","design","editor","entryTransition"].includes(key)))
        throw Error("单段编辑只能修改标题、说明、设计、衔接和用户参数");
      const edited={...scene,...patch,
        ...(patch.editor?{editor:{...scene.editor,...patch.editor}}:{})};
      if(Object.prototype.hasOwnProperty.call(patch,'entryTransition')) {
        edited.editor={overrides:{},locks:[],...edited.editor,entryTransition:patch.entryTransition};
        if(patch.entryTransition===null)delete edited.entryTransition;
      }
      assertTransitionPredecessors({scenes:plan.scenes.map(s=>s.id===scene.id?edited:s)});
      const scoped={...plan,scenes:[edited],requests:plan.requests.filter(r=>r.sceneId===scene.id)};
      await validateEdits([edited]);
      const check=resolveProduction(scoped,cut);
      if(check.issues.length||check.stale)throw Error(check.issues.join("\n")||"请先同步剪辑时间");
      await componentLayers(scoped,check,Math.round(check.durationMs*30/1000));
      if(edited.program)await bindScenePrograms(scoped,check,await sceneModules);
      await store.setScenes(req.body.expectedRevision,plan.source,
        plan.scenes.map(s=>s.id===scene.id?edited:s),"user");
      res.json(await context());
    } catch(error) { next(error); }
  });
  router.post("/scenes", async (req, res, next) => {
    try {
      const cut = await cutStore.get();
      const current = await store.get();
      const actor = req.body.actor === "user" ? "user" : "codex";
      const candidate = {
        ...current,
        source: req.body.source,
        scenes: preserveSceneEdits(current.scenes, req.body.scenes, actor),
      };
      await validateEdits(candidate.scenes);
      const check = resolveProduction(candidate, cut);
      if (check.issues.length || check.stale)
        throw Error(check.issues.join("\n") || "请重新读取当前剪辑再提交方案");
      await componentLayers(
        candidate,
        check,
        Math.round((check.durationMs * 30) / 1000),
      );
      if (candidate.scenes.some((s: any) => s.program))
        await bindScenePrograms(
          {
            ...candidate,
            scenes: candidate.scenes.filter((s: any) => s.program),
          },
          resolveProduction(
            {
              ...candidate,
              scenes: candidate.scenes.filter((s: any) => s.program),
            },
            cut,
          ),
          await sceneModules,
        );
      await store.setScenes(
        req.body.expectedRevision,
        req.body.source,
        candidate.scenes,
        actor,
      );
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/rebase", async (req, res, next) => {
    try {
      const [plan, cut] = await Promise.all([store.get(), cutStore.get()]);
      if (plan.source?.assetUrl !== cut.asset?.url)
        throw Error("素材已替换，需要重新设计");
      const c = resolveProduction(plan, cut);
      if (c.issues.length) throw Error(c.issues.join("\n"));
      await store.setScenes(
        req.body.expectedRevision,
        { assetUrl: cut.asset!.url, cutRevision: cut.revision },
        plan.scenes,
      );
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/request", async (req, res, next) => {
    try {
      const r = req.body.request;
      if (r.status === "provided") throw Error("请通过素材上传绑定真实文件");
      if (r.status === "waived" && !r.note?.trim())
        throw Error("请说明接受的替代方案");
      await store.setRequest(req.body.expectedRevision, r);
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/material", async (req, res, next) => {
    let file = "";
    try {
      const plan = await store.get();
      const request = plan.requests.find((r) => r.id === req.query.requestId);
      if (!request) throw Error("素材需求不存在");
      if (Number(req.query.revision) !== plan.revision)
        throw Error("方案已更新，请刷新后再补素材");
      const ext = extname(String(req.query.name)).toLowerCase();
      if (
        ![".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".webm"].includes(
          ext,
        )
      )
        throw Error("请提供图片或视频素材");
      const name = randomUUID() + ext;
      file = resolve(assets, name);
      let bytes = 0;
      await pipeline(
        req,
        new Transform({
          transform(c, _e, cb) {
            bytes += c.length;
            cb(bytes > 1024 ** 3 ? Error("素材上限1GB") : null, c);
          },
        }),
        createWriteStream(file, { flags: "wx" }),
      );
      const { stdout } = await exec(runtimeCommand("ffprobe"), [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "json",
        file,
      ]);
      if (
        !JSON.parse(stdout).streams?.some((s: any) => s.codec_type === "video")
      )
        throw Error("无法读取素材画面");
      await store.setRequest(plan.revision, {
        ...request,
        status: "provided",
        fileName: name,
        note: String(req.query.name),
      });
      file = "";
      res.json(await context());
    } catch (e) {
      next(e);
    } finally {
      if (file) await unlink(file).catch(() => {});
    }
  });
  router.post("/feedback", async (req, res, next) => {
    try {
      const c = await context();
      const f = req.body.feedback;
      if (f.timeMs < 0 || f.timeMs > c.resolved.durationMs)
        throw Error("反馈时间不在视频范围内");
      const target = c.segmentReviews.find((s) => s.sceneId === f.sceneId);
      if (
        !target ||
        f.timeMs < (target.from * 1000) / 30 - 1 ||
        f.timeMs > (target.end * 1000) / 30 + 1
      )
        throw Error("反馈时间不属于所选段落，请重新定位");
      await store.addFeedback(req.body.expectedRevision, {
        id: randomUUID(),
        sceneId: f.sceneId,
        timeMs: f.timeMs,
        text: f.text,
        status: "open",
        revision: c.plan.revision,
      });
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/resolve-feedback", async (req, res, next) => {
    try {
      await store.resolveFeedback(req.body.expectedRevision, req.body.id);
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/undo", async (req, res, next) => {
    try {
      await store.undo(req.body.expectedRevision);
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/approve", async (req, res, next) => {
    try {
      const c = await context();
      if (!c.props || c.resolved.stale || c.resolved.issues.length || !c.job?.current || c.job.status !== "done" || c.job.pendingMaterials)
        throw Error("请先补齐素材并观看当前版本的渲染");
      if (req.body.key !== c.key) throw Error("画面已变化，请重新审阅");
      approval = {
        key: c.key,
        revision: c.plan.revision,
        at: new Date().toISOString(),
      };
      await writeFile(resolve(dir, "approval.json"), JSON.stringify(approval));
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/approve-sample", async (req, res, next) => {
    try {
      if(typeof req.body.sceneId!=="string"||!req.body.sceneId)throw Error("段落标识无效");
      const c = await context(req.body.sceneId);
      const review = c.segmentReviews.find(
        (r) => r.sceneId === req.body.sceneId,
      );
      if (
        !c.props ||
        c.resolved.stale ||
        c.resolved.issues.length ||
        !review ||
        req.body.key !== review.key ||
        review.feedbackOpen
      )
        throw Error("段落已修改或还有反馈待处理，请重新审阅当前版本");
      const selected = review.history.find((r) => r.id === req.body.renderId);
      if (!selected?.current) throw Error("请选择当前段落的完整渲染版本");
      await segmentStore.approve(review.sceneId, selected.id, review.key);
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/cancel-render", async (req, res, next) => {
    try {
      const task = [job, sampleJob].find((t) => t?.id === req.body.id);
      if (!task || !["rendering", "cancelling"].includes(task.status))
        throw Error("这个渲染任务已经结束，请刷新状态");
      lane.cancel(task.id);
      task.status = "cancelling";
      // Final state is persisted by the task owner, avoiding competing writes.
      res.json(await context());
    } catch (e) {
      next(e);
    }
  });
  router.post("/assemble", async (req, res, next) => {
    let ticket: ReturnType<RenderLane["reserve"]> | undefined;
    try {
      ticket = lane.reserve();
      const c = await context();
      if (req.body.expectedRevision !== c.plan.revision)
        throw Error("方案已更新，请刷新后再合成");
      if (
        !c.assemblyReady ||
        !c.cut.preview ||
        c.cut.preview.revision !== c.cut.revision
      )
        throw Error("请先逐段确认当前版本，再合成整片");
      const clips = assemblySegments(
        c.segmentReviews,
        Math.round((c.resolved.durationMs * 30) / 1000),
      );
      const runDir = resolve(dir, "renders", randomUUID());
      const task: any = {
        id: ticket.id,
        sourceAssetUrl: c.cut.asset?.url,
        stage: "准备合成",
        status: "rendering",
        key: c.key,
        revision: c.plan.revision,
        progress: 0,
        from: 0,
        end: Math.round((c.resolved.durationMs * 30) / 1000),
        pendingMaterials: false,
        kind: "assembly",
        segments: clips.map((a) => ({
          sceneId: a.sceneId,
          renderId: a.id,
          key: a.key,
          from: a.from,
          end: a.end,
          at: a.at,
        })),
      };
      job = task;
      await persistJob();
      const owned = ticket;
      ticket = undefined;
      void (async () => {
        try {
          await mkdir(runDir, { recursive: true });
          await writeFile(
            resolve(runDir, "snapshot.json"),
            JSON.stringify(
              {
                plan: c.plan,
                cut: c.cut,
                props: c.props,
                renderInputs:c.renderInputs,
                runtimeIdentity:c.runtimeIdentity,
                key: c.key,
                segments: clips,
              },
              null,
              2,
            ),
          );
          const result = await assembleSegmentPictures({
            productionDir: dir,
            runDir,
            source: resolve(projectDir, "cut", basename(c.cut.preview!.provenance?.renderSource?.url||c.cut.preview!.url)),
            sourceHash: c.cut.preview!.provenance?.renderSource?.contentHash||c.cut.preview!.provenance?.contentHash,
            encodeSourceAudio:!!c.cut.preview!.provenance?.renderSource,
            clips,
            duration: task.end,
            signal: owned.signal,
            stage: (stage) => {
              task.stage = stage;
            },
          });
          owned.check();
          await assertTaskCurrent(task);
          owned.check();
          Object.assign(task, {
            status: "done",
            progress: 1,
            pictureHash: result.pictureHash,
            url:
              "/production-media/renders/" + basename(runDir) + "/review.mp4",
          });
          lastGood = { ...task };
          await persistState("last-good-render.json", lastGood);
          await persistJob();
        } catch (e) {
          Object.assign(task, {
            status: owned.signal.aborted ? "cancelled" : "failed",
            error: owned.signal.aborted
              ? "合成已取消，已确认段落仍保留。"
              : (e as Error).message,
          });
          await persistJob();
        } finally {
          owned.release();
        }
      })().catch((e) => console.error("保存合成状态失败", e));
      res.json(await context());
    } catch (e) {
      ticket?.release();
      next(e);
    }
  });
  router.post("/render", async (req, res, next) => {
    let ticket: ReturnType<RenderLane["reserve"]> | undefined;
    try {
      ticket = lane.reserve();
      const sceneId = req.body.sceneId;
      if (sceneId !== undefined && (typeof sceneId !== "string" || !sceneId))
        throw Error("段落标识无效");
      const c = await context(sceneId);
      if (
        req.body.expectedRevision !== undefined &&
        req.body.expectedRevision !== c.plan.revision
      )
        throw Error("方案已更新，请刷新后重试");
      if (c.resolved.stale || c.resolved.issues.length)
        throw Error(c.resolved.issues.join("\n") || "请先同步剪辑时间");
      if (!c.plan.scenes.length) throw Error("请先设计段落");
      if (!c.props) throw Error(c.programError);
      if (
        !sceneId &&
        c.plan.scenes.some((s) => s.program) &&
        c.plan.scenes.some((s) => !s.program)
      )
        throw Error("还有段落未实现动画，请让 Codex 完成后再生成全片");

      const range = sceneId
        ? c.segmentReviews.find((r) => r.sceneId === sceneId)
        : null;
      if (sceneId && !range) throw Error("段落不存在或范围无效");
      if (
        sceneId &&
        c.props.scenePrograms &&
        !c.props.scenePrograms.some((s: any) => s.id === sceneId)
      )
        throw Error("这一段还没有动画实现，请先完成制作");
      ticket.check();
      const task: any = {
        id: ticket.id,
        sourceAssetUrl: c.cut.asset?.url,
        stage: "准备素材",
        status: "rendering",
        key: range?.key ?? c.key,
        revision: c.plan.revision,
        progress: 0,
        segmentReview: !!sceneId,
        sceneId,
        from: range?.from ?? 0,
        end: range?.end ?? c.props.duration,
        pendingMaterials: c.plan.requests.some(
          (r) => r.status === "missing",
        ),
      };
      const persist = sceneId ? persistSample : persistJob;
      if (sceneId) sampleJob = task;
      else job = task;
      await persist();
      const owned = ticket;
      ticket = undefined; // the background task now owns release
      void (async () => {
        try {
          await render(c, task, persist, owned);
        } catch (e) {
          Object.assign(task, {
            status: owned.signal.aborted ? "cancelled" : "failed",
            error: owned.signal.aborted
              ? "渲染已取消，可重新生成。"
              : (e as Error).message,
          });
          await persist();
        } finally {
          owned.release();
        }
      })().catch((e) => console.error("保存渲染状态失败", e));
      res.json(await context());
    } catch (e) {
      ticket?.release();
      next(e);
    }
  });
  async function render(
    c: Awaited<ReturnType<typeof context>>,
    task: any,
    persist: () => Promise<any>,
    ticket: ReturnType<RenderLane["reserve"]>,
  ) {
    ticket.check();
    const runExec = (async (
      file: string,
      args: string[] = [],
      options: any = {},
    ) => {
      ticket.check();
      const process = exec(file, args, { ...options, signal: ticket.signal });
      const closed = new Promise<void>((done) =>
        process.child.once("close", () => done()),
      );
      try {
        return await process;
      } catch (e) {
        await closed;
        throw e;
      }
    }) as typeof exec;
    const runDir = resolve(dir, "renders", randomUUID()),
      publicDir = resolve(runDir, "media");
    await mkdir(publicDir, { recursive: true });
    const renderSource=c.cut.preview!.provenance?.renderSource;
    const sourceName=renderSource?'source.mkv':'source.mp4';
    await copyFile(
      resolve(projectDir, "cut", basename(renderSource?.url||c.cut.preview!.url)),
      resolve(publicDir, sourceName),
      constants.COPYFILE_FICLONE,
    );
    const sourceHash = renderSource?.contentHash||c.cut.preview!.provenance?.contentHash;
    if (sourceHash && await fileDigest(resolve(publicDir,sourceName)) !== sourceHash)
      throw Error("粗剪预览在准备渲染期间发生变化，请重新生成预览");
    const { stdout } = await runExec(
      runtimeCommand("ffmpeg"),
      [
        "-v",
        "error",
        "-i",
        resolve(publicDir, sourceName),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "8000",
        "-f",
        "s16le",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 100 * 1024 * 1024 },
    );
    const samples = stdout as unknown as Buffer;
    const envelope = (start: number, end: number) => {
      const count = samples.length / 2;
      const lo = Math.max(0, Math.floor(start * 8000));
      const hi = Math.min(count, Math.ceil(end * 8000));
      const values = Array.from({ length: 128 }, (_, i) => {
        let peak = 0;
        const from = lo + Math.floor(((hi - lo) * i) / 128);
        const to = lo + Math.floor(((hi - lo) * (i + 1)) / 128);
        for (let j = from; j < to; j++)
          peak = Math.max(peak, Math.abs(samples.readInt16LE(j * 2)) / 32768);
        return peak;
      });
      const max = Math.max(...values, 0.001);
      return values.map((v) => v / max);
    };
    const wave = envelope(0, c.props.duration / 30);
    const excerptWave = envelope(
      c.props.words[0].start / 30,
      c.props.words.at(-1)!.end / 30,
    );
    if (
      !c.props.scenePrograms &&
      c.plan.requests.filter((r) => r.status === "provided").length > 1
    )
      throw Error(
        "当前动画只有一个补充素材槽位，请让 Codex 为多个素材设计位置与顺序",
      );
    const supports: any[] = [];
    for (const r of c.plan.requests.filter((r) => r.status === "provided")) {
      if (!c.props.scenePrograms && r.sceneId !== "transcript")
        throw Error("这个素材槽位尚未配置画面实现，请让 Codex 接入后再渲染");
      if (!r.fileName || basename(r.fileName) !== r.fileName)
        throw Error("素材绑定无效");
      await access(resolve(assets, r.fileName));
      await copyFile(
        resolve(assets, r.fileName),
        resolve(publicDir, r.fileName),
      );
      const expected=c.renderInputs.find(x=>x.sceneId===r.sceneId&&x.role==='material:'+r.id)?.sha256;
      if(!expected||await fileDigest(resolve(publicDir,r.fileName))!==expected)
        throw Error('补充素材在准备渲染期间发生变化，请刷新后重新生成');
      if (c.props.scenePrograms) continue;
      const { stdout: probe } = await runExec(runtimeCommand("ffprobe"), [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        resolve(publicDir, r.fileName),
      ]);
      const from = c.props.timing.auto + 15,
        end = c.props.timing.text - 8;
      supports.push({
        src: r.fileName,
        kind: /\.(png|jpe?g|webp)$/i.test(r.fileName) ? "image" : "video",
        from,
        duration: Math.max(1, end - from),
        mediaFrames: Math.max(
          1,
          Math.round((Number(JSON.parse(probe).format?.duration) || 10) * 30),
        ),
      });
    }
    for (const layer of c.props.componentLayers || []) {
      for (const media of layer.mediaSources || []) {
        if (media.assetId) {
          const asset = await componentAssets.resolve(media.assetId);
          await copyFile(asset.path, resolve(publicDir, media.src));
          const expected=c.renderInputs.find(x=>x.role==='component:'+layer.id+':'+media.assetId)?.sha256;
          if(!expected||await fileDigest(resolve(publicDir,media.src))!==expected)
            throw Error('组件素材在准备渲染期间发生变化，请刷新后重新生成');
        }
      }
    }
    const props = {
      ...c.props,
      mediaSrc: sourceName,
      ...(c.props.scenePrograms?{scenePrograms:c.props.scenePrograms.map((s:any)=>({...s,mediaSrc:sourceName}))}:{}),
      componentLayers:c.props.componentLayers.map((l:any)=>({...l,
        mediaSrc:l.mediaSrc==='source.mp4'?sourceName:l.mediaSrc,
        mediaSources:l.mediaSources?.map((m:any)=>({...m,src:m.src==='source.mp4'?sourceName:m.src}))})),
      wave,
      excerptWave,
      supports,
      pendingMaterials: task.pendingMaterials,
    };
    await writeFile(
      resolve(runDir, "snapshot.json"),
      JSON.stringify(
        {
          plan: c.plan,
          cut: c.cut,
          props,
          renderInputs:c.renderInputs,
          runtimeIdentity:c.runtimeIdentity,
          key: task.key,
          from: task.from,
          end: task.end,
        },
        null,
        2,
      ),
    );
    const { bundle } = await import("@remotion/bundler");
    const { selectComposition, renderMedia } =
      await import("@remotion/renderer");
    let entryPoint = resolve(
      root,
      "workbench-local/production-render-entry.tsx",
    );
    if (props.componentLayers?.length || props.scenePrograms?.length) {
      await cp(resolve(root, "public"), publicDir, {
        recursive: true,
        force: false,
      });
      const moduleImports = (props.scenePrograms || [])
        .map(
          (s: any, i: number) =>
            `import * as scene${i} from ${JSON.stringify(s.modulePath)};`,
        )
        .join("\n");
      const moduleRenderers = (props.scenePrograms || [])
        .map(
          (s: any, i: number) => `scene${i}[${JSON.stringify(s.exportName)}]`,
        )
        .join(",");
      for (const s of props.scenePrograms || []) {
        await writeFile(
          resolve(runDir, `scene-${s.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.tsx`),
          await readFile(s.modulePath, "utf8"),
        );
      }
      const imports = props.componentLayers
        .map(
          (l: any, i: number) =>
            `import * as m${i} from ${JSON.stringify(l.modulePath)};`,
        )
        .join("\n");
      const renderers = props.componentLayers
        .map((l: any, i: number) => `m${i}[${JSON.stringify(l.exportName)}]`)
        .join(",");
      entryPoint = resolve(runDir, "component-render.tsx");
      await writeFile(
        entryPoint,
        productionCompositionSource(
          root,
          props,
          imports,
          renderers,
          moduleImports,
          moduleRenderers,
        ),
      );
    }
    ticket.check();
    task.stage = "编译画面";
    const serveUrl = await bundle({
      outDir: resolve(runDir, "bundle"),
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          extensionAlias: {
            ...config.resolve?.extensionAlias,
            ".js": [".js", ".ts", ".tsx"],
          },
        },
      }),
      entryPoint,
      publicDir,
    });
    ticket.check();
    await assertTaskCurrent(task);
    ticket.check();
    const runtime = remotionRuntime(root);
    const composition = await selectComposition({
      serveUrl,
      id: "Production",
      inputProps: props,
      ...runtime,
    });
    ticket.check();
    task.stage = "渲染画面";
    const { makeCancelSignal } = await import("@remotion/renderer");
    const cancellation = makeCancelSignal();
    const abortRender = () => cancellation.cancel();
    ticket.signal.addEventListener("abort", abortRender, { once: true });
    try {
      ticket.check();
      await renderMedia({
        cancelSignal: cancellation.cancelSignal,
        serveUrl,
        composition,
        inputProps: props,
        codec: "h264",
        muted: true,
        outputLocation: resolve(runDir, "picture.mp4"),
        concurrency: 2,
        ...runtime,
        frameRange: [task.from, task.end - 1],
        onProgress: (p) => {
          task.progress = p.progress;
        },
      });
    } finally {
      ticket.signal.removeEventListener("abort", abortRender);
    }
    ticket.check();
    task.stage = "合成原声";
    const audioArgs = task.sceneId
      ? [
          "-filter:a",
          `atrim=start=${task.from / 30}:end=${task.end / 30},asetpts=PTS-STARTPTS`,
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
        ]
      : renderSource ? ["-c:v","copy","-c:a","aac","-b:a","192k"] : ["-c", "copy"];
    await runExec(runtimeCommand("ffmpeg"), [
      "-v",
      "error",
      "-i",
      resolve(runDir, "picture.mp4"),
      "-i",
      resolve(publicDir, sourceName),
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      ...audioArgs,
      "-t",
      String((task.end - task.from) / 30),
      "-movflags",
      "+faststart",
      resolve(runDir, "review.mp4"),
    ]);
    ticket.check();
    await assertTaskCurrent(task);
    ticket.check();
    Object.assign(task, {
      pictureHash: await fileDigest(resolve(runDir, "picture.mp4")),
      status: "done",
      progress: 1,
      url: "/production-media/renders/" + basename(runDir) + "/review.mp4",
    });
    if (!task.sceneId) {
      lastGood = { ...task };
      await persistState("last-good-render.json", lastGood);
    }
    await persist();
  }
  return Object.assign(router, {
    shutdown: () => lane.stop(),
    assertCheckpointReady: async () => {
      if (lane.isBusy()) throw Error('包装正在生成，请完成后再备份');
      if ((await selectionStore.get()).hasUnsavedChanges) throw Error('当前画面还有未保存修改，请先保存');
    },
  });
}
