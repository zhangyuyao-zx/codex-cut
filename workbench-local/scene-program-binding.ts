import type { ProductionState } from "./production-store";
import type { resolveProduction } from "./production-binding";
import path from "node:path";

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
        parameters: { ...s.program!.parameters, ...s.editor?.overrides },
      });
      const sceneRequests=plan.requests.filter((r)=>r.sceneId===s.id);
      const materials=sceneRequests.flatMap((request)=>{
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
      const from = Math.round((range.startMs! * 30) / 1000),
        end = Math.round((range.endMs! * 30) / 1000);
      return {
        id: s.id,
        moduleId: s.program!.moduleId,
        modulePath: module.modulePath,
        exportName: module.exportName,
        sourceHash: module.sourceHash,
        from,
        duration: Math.max(1, end - from),
        title: s.title,
        parameters: module.resolvedParameters,
        mediaSrc: "source.mp4",
        words: resolved.words
          .filter((w) => w.startMs >= range.startMs! && w.endMs <= range.endMs!)
          .map((w) => ({
            id: w.sourceId,
            text: w.text,
            start: Math.round((w.startMs * 30) / 1000) - from,
            end: Math.round((w.endMs * 30) / 1000) - from,
          })),
        beats: range.beats.map((b) => ({
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
