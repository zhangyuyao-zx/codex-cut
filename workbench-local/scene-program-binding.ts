import type { ProductionState } from "./production-store";
import type { resolveProduction } from "./production-binding";
import path from "node:path";
import {assertSceneCueContract} from "./scene-cue-contract";
import {resolveVisualCues} from './visual-application';

function safeMaterialFileName(value:unknown): value is string {
  return typeof value==='string' && value.length>0 && value!=='.' && value!=='..' &&
    path.basename(value)===value && !value.includes('/') && !value.includes('\\') && !value.includes('\u0000');
}

export async function bindScenePrograms(
  plan: ProductionState,
  resolved: ReturnType<typeof resolveProduction>,
  modules: { validate: (program: any) => Promise<any> },
) {
  if (resolved.issues.length || resolved.stale)
    throw Error(resolved.issues.join("\n") || "请先同步粗剪时间");
  if (!plan.scenes.length || plan.scenes.some((s) => !s.program))
    throw Error("每个段落都需要明确的动画实现；不能混用未配置的场景");
  return Promise.all(
    plan.scenes.map(async (s) => {
      const module = await modules.validate({
        ...s.program,
        parameters: { ...s.program!.styleDefaults, ...s.program!.parameters, ...s.editor?.overrides },
      });
      const sceneRequests=plan.requests.filter((r)=>r.sceneId===s.id);
      const materials=sceneRequests.flatMap((request)=>{
        if(request.visualSlot){
          if(request.visualSlot.moduleId!==s.program!.moduleId)return [];
          if(request.status!=='provided'||!safeMaterialFileName(request.fileName))return [];
          return [{id:request.visualSlot.slotId,src:request.fileName,kind:/\.(png|jpe?g|webp)$/i.test(request.fileName)?'image':'video'}];
        }
        const slot=request.animationSlot;
        if(slot && slot.moduleId!==s.program!.moduleId) return [];
        if(slot) {
          if(request.status!=="provided" || !safeMaterialFileName(request.fileName))
            throw Error(`「${s.title}」的保存动画素材槽位尚未提供有效文件`);
          return [{id:slot.materialId,src:request.fileName,kind:/\.(png|jpe?g|webp)$/i.test(request.fileName)?"image":"video"}];
        }
        if(request.status!=="provided") return [];
        return [{id:request.id,src:request.fileName,kind:/\.(png|jpe?g|webp)$/i.test(request.fileName || "")?"image":"video"}];
      });
      const materialIds=new Set<string>();
      for(const material of materials) {
        if(materialIds.has(material.id)) throw Error(`「${s.title}」的补充素材编号重复：${material.id}`);
        materialIds.add(material.id);
      }
      if (materials.length && !module.acceptsMaterials)
        throw Error(
          `「${s.title}」的动画尚未实现补充素材位置，请先让 Codex 接入`,
        );
      const range = resolved.scenes.find((r) => r.id === s.id)!;
      const semantic=module.visualAsset;
      const beats=semantic?resolveVisualCues(semantic.cues,s.program!.cueBindings,resolved.words,range.startMs!,range.endMs!):range.beats;
      if(semantic){
        const length=Math.round(range.endMs!*30/1000)-Math.round(range.startMs!*30/1000);
        if(length<semantic.constraints.minFrames||length>semantic.constraints.maxFrames)throw Error('「'+s.title+'」超出资产支持时长：'+semantic.constraints.notes);
        for(const slot of semantic.mediaSlots){const material=materials.find(m=>m.id===slot.id);if(slot.required&&!material)throw Error('「'+s.title+'」缺少素材：'+slot.label);if(material&&slot.kind!=='either'&&slot.kind!==material.kind)throw Error('素材类型不符：'+slot.label);}
      }
      assertSceneCueContract({
        id: s.id,
        title: s.title,
        moduleId: s.program!.moduleId,
        parameters: module.resolvedParameters,
        beats,
      });
      const from = Math.round((range.startMs! * 30) / 1000),
        end = Math.round((range.endMs! * 30) / 1000);
      return {
        id: s.id,
        moduleId: s.program!.moduleId,
        modulePath: module.modulePath,
        exportName: module.exportName,
        sourceHash: module.sourceHash,
        ...(module.dependencies?{dependencies:module.dependencies}:{}),
        ownsBackground:module.visualAsset?.mount==='SCENE',
        from,
        duration: Math.max(1, end - from),
        title: s.title,
        parameters: module.resolvedParameters,
        ...(s.editor?.objectTransforms ? {objectTransforms: s.editor.objectTransforms} : {}),
        mediaSrc: "source.mp4",
        words: resolved.words
          .filter((w) => w.startMs >= range.startMs! && w.endMs <= range.endMs!)
          .map((w) => ({
            id: w.sourceId,
            text: w.text,
            start: Math.round((w.startMs * 30) / 1000) - from,
            end: Math.round((w.endMs * 30) / 1000) - from,
          })),
        beats: beats.map((b:any) => ({
          wordId: b.wordId,
          label: b.label,
          frame: Math.round((b.timeMs! * 30) / 1000) - from,
        })),
        materials,
        ...(s.entryTransition?{entryTransition:s.entryTransition}:{}),
      };
    }),
  );
}
