import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  cp,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createAnimationTemplates,
  type AnimationTemplate,
} from "./animation-templates";
import { createSceneModules } from "./scene-modules";
import type { Scene } from "./production-store";
import {createComponentAssets} from './component-assets';

const temporaryDirectories: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-workbench-animation-templates-"));
  await mkdir(path.join(root, "workbench-local", "scenes"), { recursive: true });
  temporaryDirectories.push(root);
  return root;
}

const sourceManifest = {
  id: "source-animation",
  label: "Source animation",
  entry: "SourceAnimation.tsx",
  exportName: "SourceAnimation",
  acceptsMaterials: true,
  controls: [
    { key: "caption", label: "Caption", type: "text", required: true },
    { key: "count", label: "Count", type: "number", default: 2, min: 1, max: 9 },
  ],
  objects: [{ id: "headline", label: "Headline", parameters: ["caption", "count"] }],
} as const;

const sourceCode = `
import React from "react";
import { helperText } from "./helper";
import type { SceneModuleInput } from "../SceneModuleSurface";

export function SourceAnimation(props: SceneModuleInput) {
  const stableCue = props.beats.find((beat) => beat.wordId === "source-word-a");
  return <div data-helper={helperText} data-id={props.id} data-cue={stableCue?.frame ?? -1}>{props.parameters.caption}</div>;
}
`;

async function writeSourceModule(root: string): Promise<void> {
  const scenes = path.join(root, "workbench-local", "scenes");
  await writeFile(path.join(scenes, "source-animation.json"), JSON.stringify(sourceManifest));
  await writeFile(path.join(scenes, "SourceAnimation.tsx"), sourceCode);
  await writeFile(path.join(scenes, "helper.ts"), "export const helperText = 'bundled-helper';\n");
}

function sourceScene(): Scene {
  return {
    id: "dji-7",
    title: "原场景标题",
    startWordId: "source-word-a",
    endWordId: "source-word-b",
    intent: "原场景意图",
    beats: [
      { wordId: "source-word-a", label: "第一重点" },
      { wordId: "source-word-b", label: "第二重点" },
    ],
    editor: { overrides: { caption: "用户已调整" }, locks: ["caption"] },
    program: { moduleId: "source-animation", parameters: { caption: "代码默认", count: 3 } },
  };
}

function targetScene(): Scene {
  return {
    id: "target-2",
    title: "目标段落标题",
    startWordId: "target-word-a",
    endWordId: "target-word-b",
    intent: "目标段落意图",
    design: {} as Scene["design"],
    beats: [{ wordId: "old-target-beat", label: "旧动作" }],
    components: [
      {
        id: "component-1",
        componentId: "component",
        props: {},
        startWordId: "target-word-a",
        endWordId: "target-word-b",
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
      },
    ],
    editor: { overrides: { count: 7 }, locks: ["count"] },
  };
}

async function templateService(root: string) {
  return createAnimationTemplates(root, path.join(root, "animation-templates"));
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("animation templates", () => {
  it('reuses editable components and frozen media in a second project, rebinding intervals without replacing existing edits',async()=>{
    const root=await makeRoot();await writeSourceModule(root);
    const originalMedia=path.join(root,'original.png');await writeFile(originalMedia,'original component pixels');
    const materialDirectory=path.join(root,'materials');await mkdir(materialDirectory);
    await writeFile(path.join(materialDirectory,'proof.png'),'original request pixels');
    const assetId='f543988b-d9d3-4130-a7fc-37491b0f685d';
    const component={...targetScene().components![0],id:'overlay',startWordId:'component-start',endWordId:'component-end',props:{text:'用户组件文案'},x:360,scale:0.8,mediaBindings:[{source:'asset' as const,assetId,startFrame:0}]};
    const source={...sourceScene(),components:[component]};
    const directory=path.join(root,'first-project/templates');
    const service=createAnimationTemplates(root,directory,{materialDirectory,resolveComponentAsset:async()=>({id:assetId,name:'original.png',kind:'image',url:'unused',path:originalMedia,absolutePath:originalMedia,fileName:'original.png',extension:'.png',mimeType:'image/png',size:25})});
    const template=await service.save({name:'完整动画',scene:source,wordOrder:['source-word-a','component-start','source-word-b','component-end'],requests:[{id:'evidence',sceneId:source.id,description:'真实截图',reason:'解释步骤',status:'provided',fileName:'proof.png'}]});
    expect(template.cues.map(c=>c.label)).toEqual(['第一重点','组件 1 出现','第二重点','组件 1 结束']);
    expect(template.contents?.materials).toHaveLength(1);
    expect(source.components[0].mediaBindings[0].assetId).toBe(assetId);
    const capturedId=template.contents!.componentAssets[0].id;
    expect(capturedId).not.toBe(assetId);
    await rm(originalMedia);await rm(path.join(materialDirectory,'proof.png'));
    const newDirectory=path.join(root,'second-project/templates'),assetDirectory=path.join(root,'second-project/production/component-assets');
    await cp(directory,newDirectory,{recursive:true});
    const nextService=createAnimationTemplates(root,newDirectory,{componentAssetDirectory:assetDirectory});
    const bindings=['new-a','new-b','new-c','new-d'];
    const candidate=await nextService.instantiate({id:template.id,target:targetScene(),bindings});
    expect(candidate.components).toHaveLength(2);
    expect(candidate.components![0]).toEqual(targetScene().components![0]);
    expect(candidate.components![1]).toMatchObject({startWordId:'new-b',endWordId:'new-d',props:{text:'用户组件文案'},x:360,scale:0.8,mediaBindings:[{source:'asset',assetId:capturedId}]});
    expect(candidate.editor).toEqual(targetScene().editor);
    const installed=await (await createComponentAssets(assetDirectory)).resolve(capturedId);
    expect(await readFile(installed.path,'utf8')).toBe('original component pixels');
    const capturedSource=await readFile(path.join(root,'workbench-local/scenes',template.moduleId+'.jsx'),'utf8');
    expect(capturedSource).toContain('__savedBeatIndices = [0, 2]');
    expect(capturedSource).toContain('saved-animations/'+template.moduleId);
    expect(capturedSource).toContain('evidence');
    candidate.components![1].x=777;
    const again=await nextService.instantiate({id:template.id,target:candidate,bindings});
    expect(again.components).toHaveLength(2);expect(again.components![1].x).toBe(777);
    await writeFile(installed.path,'conflicting pixels');
    await expect(nextService.instantiate({id:template.id,target:targetScene(),bindings})).rejects.toThrow('冲突');
    expect(await readFile(installed.path,'utf8')).toBe('conflicting pixels');
  });

  it('marks captured materials as replaceable and refuses to silently upgrade an old fixed snapshot', async()=>{
    const root=await makeRoot();
    await writeSourceModule(root);
    const materialDirectory=path.join(root,'materials');
    await mkdir(materialDirectory);
    await writeFile(path.join(materialDirectory,'proof.png'),'proof pixels');
    const directory=path.join(root,'templates');
    const service=createAnimationTemplates(root,directory,{materialDirectory});
    const template=await service.save({
      name:'可替换素材',scene:sourceScene(),
      requests:[{id:'proof',sceneId:'dji-7',description:'证据图',reason:'验证',status:'provided',fileName:'proof.png'}],
    });
    expect(template.contents?.materialSlotsVersion).toBe(1);
    const sourceText=await readFile(path.join(root,'workbench-local/scenes',`${template.moduleId}.jsx`),'utf8');
    expect(sourceText).toContain('props.materials');
    expect(sourceText).toContain('savedMaterials.filter');

    const metadataPath=path.join(directory,'templates.json');
    const metadata=JSON.parse(await readFile(metadataPath,'utf8')) as {templates:Array<Record<string,unknown>>};
    const storedContents=metadata.templates[0].contents as Record<string,unknown>;
    delete storedContents.materialSlotsVersion;
    await writeFile(metadataPath,`${JSON.stringify(metadata,null,2)}\n`);
    await expect(service.save({
      name:'误升级',
      scene:{...sourceScene(),program:{moduleId:template.moduleId,parameters:template.parameters}},
    })).rejects.toThrow(/固定快照|升级源动画/iu);
  });

  it("freezes imported and staticFile media, fingerprints original changes, and keeps target narration dynamic", async () => {
    const root = await makeRoot();
    await writeSourceModule(root);
    await mkdir(path.join(root, 'public'));
    const scenes = path.join(root, 'workbench-local', 'scenes');
    const logo = Buffer.from('original static logo');
    const photo = Buffer.from('original imported photo');
    await writeFile(path.join(root, 'public', 'logo.png'), logo);
    await writeFile(path.join(scenes, 'photo.png'), photo);
    await writeFile(path.join(scenes, 'SourceAnimation.tsx'), `
      import {staticFile as asset} from 'remotion';
      import photo from './photo.png';
      export function SourceAnimation(props) {
        return <div><img src={asset('logo.png')}/><img src={photo}/><video src={asset(props.mediaSrc)}/></div>;
      }`);
    const modules = createSceneModules(root), service = await templateService(root);
    const originalHash = (await modules.detail('source-animation')).sourceHash;
    const template = await service.save({name: 'media snapshot', scene: sourceScene()});
    const assetDir = path.join(root, 'public', 'saved-animations', template.moduleId);
    const captured = await readdir(assetDir);
    expect(captured).toHaveLength(2);
    const savedHash = (await modules.detail(template.moduleId)).sourceHash;
    const output = await readFile(path.join(scenes, template.moduleId + '.jsx'), 'utf8');
    expect(output).toContain(`saved-animations/${template.moduleId}/`);
    expect(output).toContain('props.mediaSrc');
    await writeFile(path.join(root, 'public', 'logo.png'), 'changed logo');
    await writeFile(path.join(scenes, 'photo.png'), 'changed photo');
    expect((await modules.detail('source-animation')).sourceHash).not.toBe(originalHash);
    expect((await modules.detail(template.moduleId)).sourceHash).toBe(savedHash);
    const savedBytes = await Promise.all(captured.map(name => readFile(path.join(assetDir, name), 'utf8')));
    expect(savedBytes.sort()).toEqual([photo.toString(), logo.toString()].sort());
    await writeFile(path.join(assetDir, captured[0]), 'tampered snapshot media');
    expect((await modules.detail(template.moduleId)).sourceHash).not.toBe(savedHash);
  });

  it("snapshots a bundled source plus manifest, then maps ordered target beats", async () => {
    const root = await makeRoot();
    await writeSourceModule(root);
    const service = await templateService(root);
    const sourceHash = (await createSceneModules(root).detail("source-animation")).sourceHash;

    const template = await service.save({
      name: "  可复用重点动画  ",
      scene: sourceScene(),
      expectedSourceHash: sourceHash,
    });

    expect(template).toMatchObject({
      name: "可复用重点动画",
      moduleId: expect.stringMatching(/^saved-[a-f0-9-]{36}$/u),
      sourceModuleId: "source-animation",
      sourceSceneId: "dji-7",
      parameters: { caption: "用户已调整", count: 3 },
      locks: ["caption"],
      cues: [{ label: "第一重点" }, { label: "第二重点" }],
      controls: sourceManifest.controls,
      objects: sourceManifest.objects,
      acceptsMaterials: true,
    });

    const scenes = path.join(root, "workbench-local", "scenes");
    const savedSource = await readFile(path.join(scenes, `${template.moduleId}.jsx`), "utf8");
    const savedManifest = JSON.parse(
      await readFile(path.join(scenes, `${template.moduleId}.json`), "utf8"),
    ) as Record<string, unknown>;
    expect(savedSource).toContain("bundled-helper");
    expect(savedSource).toContain("source-word-a");
    expect(savedSource).toContain("dji-7");
    expect(savedSource).toContain("SavedAnimation");
    expect(savedSource).not.toContain('React.createElement');
    expect(savedSource).toContain('react/jsx-runtime');
    expect(savedSource).toContain("props.beats?.[__savedBeatIndices[index]]");
    expect(savedSource).toContain("{ ...beat, wordId: sourceWordId }");
    expect(savedSource).not.toContain('from "./helper"');
    expect(savedManifest).toMatchObject({
      id: template.moduleId,
      entry: `${template.moduleId}.jsx`,
      exportName: "SavedAnimation",
      controls: sourceManifest.controls,
      objects: sourceManifest.objects,
      acceptsMaterials: true,
    });

    const metadata = JSON.parse(
      await readFile(path.join(root, "animation-templates", "templates.json"), "utf8"),
    ) as { templates: Array<Record<string, unknown>> };
    expect(JSON.stringify(metadata)).not.toContain("source-word-a");
    expect(JSON.stringify(metadata)).not.toContain("source-word-b");

    const instantiated = await service.instantiate({
      id: template.id,
      target: targetScene(),
      bindings: ["target-word-a", "target-word-b"],
    });
    expect(instantiated).toMatchObject({
      id: "target-2",
      title: "目标段落标题",
      intent: "目标段落意图",
      startWordId: "target-word-a",
      endWordId: "target-word-b",
      components: targetScene().components,
      beats: [
        { wordId: "target-word-a", label: "第一重点" },
        { wordId: "target-word-b", label: "第二重点" },
      ],
      editor: { overrides: { count: 7 }, locks: ["count"] },
      program: {
        moduleId: template.moduleId,
        parameters: { caption: "用户已调整", count: 7 },
      },
    });
    expect(instantiated).not.toHaveProperty("design");
    expect(instantiated).not.toHaveProperty("program.parameters.source-word-a");

    const savedModule = await createSceneModules(root).detail(template.moduleId);
    expect(savedModule).toMatchObject({
      controls: sourceManifest.controls,
      objects: sourceManifest.objects,
      acceptsMaterials: true,
    });

  });

  it("keeps the saved bundle immutable when the original source changes later", async () => {
    const root = await makeRoot();
    await writeSourceModule(root);
    const service = await templateService(root);
    const template = await service.save({ name: "Immutable", scene: sourceScene() });
    const sourcePath = path.join(root, "workbench-local", "scenes", "SourceAnimation.tsx");
    const savedPath = path.join(root, "workbench-local", "scenes", `${template.moduleId}.jsx`);
    const before = await readFile(savedPath, "utf8");
    await writeFile(sourcePath, `${sourceCode}\n// changed after save\n`);
    expect(await readFile(savedPath, "utf8")).toBe(before);
    expect((await createSceneModules(root).detail("source-animation")).sourceHash).not.toBe(template.sourceHash);
  });

  it("rejects invalid names, missing programs, components, stale hashes, and bad bindings", async () => {
    const root = await makeRoot();
    await writeSourceModule(root);
    const service = await templateService(root);
    const sourceHash = (await createSceneModules(root).detail("source-animation")).sourceHash;

    await expect(service.save({ name: "", scene: sourceScene() })).rejects.toThrow(/blank|name/iu);
    await expect(
      service.save({ name: "x".repeat(81), scene: sourceScene() }),
    ).rejects.toThrow(/80|name/iu);
    const noProgram = { ...sourceScene(), program: undefined } as Scene;
    await expect(service.save({ name: "x", scene: noProgram })).rejects.toThrow(/program/iu);
    const withComponents = {
      ...sourceScene(),
      components: targetScene().components,
    };
    await expect(service.save({ name: "x", scene: withComponents })).rejects.toThrow(/component|组件/iu);
    await expect(
      service.save({ name: "x", scene: sourceScene(), expectedSourceHash: "stale" }),
    ).rejects.toThrow(/stale|hash/iu);

    const template = await service.save({ name: "Bindings", scene: sourceScene(), expectedSourceHash: sourceHash });
    await expect(
      service.instantiate({ id: template.id, target: targetScene(), bindings: ["target-word-a"] }),
    ).rejects.toThrow(/exactly|bindings/iu);
    await expect(
      service.instantiate({ id: template.id, target: targetScene(), bindings: ["target-word-a", "target-word-a"] }),
    ).rejects.toThrow(/duplicated|duplicate/iu);
    await expect(
      service.instantiate({ id: template.id, target: targetScene(), bindings: ["", "target-word-b"] }),
    ).rejects.toThrow(/non-empty|binding/iu);
    await expect(
      service.instantiate({
        id: template.id,
        target: { ...targetScene(), editor: { overrides: { unsupported: 1 }, locks: [] } },
        bindings: ["target-word-a", "target-word-b"],
      }),
    ).rejects.toThrow(/unsupported|edited/iu);
  });

  it("supports a zero-cue source and leaves no stray atomic artifacts", async () => {
    const root = await makeRoot();
    const scenes = path.join(root, "workbench-local", "scenes");
    await writeFile(
      path.join(scenes, "zero-cue.json"),
      JSON.stringify({
        id: "zero-cue",
        label: "Zero cue",
        entry: "ZeroCue.jsx",
        exportName: "ZeroCue",
        controls: [],
      }),
    );
    await writeFile(
      path.join(scenes, "ZeroCue.jsx"),
      "export function ZeroCue() { return null; }\n",
    );
    const service = await templateService(root);
    const template = await service.save({
      name: "Zero cues",
      scene: {
        id: "source-zero",
        title: "Zero",
        startWordId: "start",
        endWordId: "end",
        intent: "Zero",
        beats: [],
        program: { moduleId: "zero-cue", parameters: {} },
      },
    });
    expect(template.cues).toEqual([]);
    await expect(
      service.instantiate({
        id: template.id,
        target: {
          id: "target-zero",
          title: "Target",
          startWordId: "start",
          endWordId: "end",
          intent: "Target",
          beats: [],
        },
        bindings: [],
      }),
    ).resolves.toMatchObject({ beats: [], program: { moduleId: template.moduleId } });
    const names = await readdir(scenes);
    expect(names.filter((name) => name.includes("atomic") || name.endsWith(".tmp"))).toEqual([]);
  });
});
