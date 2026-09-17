import {createHash} from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";

import {
  ANIMATION_PACKAGE_MAGIC,
  packageJsonEqual,
} from "./animation-packages";
import {
  createAnimationTemplates,
  type AnimationTemplate,
} from "./animation-templates";
import type {Scene} from "./production-store";

const temporaryDirectories: string[] = [];

async function makeRoot(prefix = "codex-animation-package-"): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  await mkdir(path.join(root, "workbench-local", "scenes"), {recursive: true});
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
    {key: "caption", label: "Caption", type: "text", required: true},
    {key: "count", label: "Count", type: "number", default: 2, min: 1, max: 9},
  ],
  objects: [{id: "headline", label: "Headline", parameters: ["caption", "count"]}],
} as const;

const sourceCode = `
import React from "react";
import {staticFile} from "remotion";
import photo from "./photo.png";

export function SourceAnimation(props) {
  return <div data-caption={props.parameters.caption}>
    <img src={staticFile("logo.png")} />
    <img src={photo} />
  </div>;
}
`;

async function writeSourceModule(root: string): Promise<void> {
  const scenes = path.join(root, "workbench-local", "scenes");
  await writeFile(path.join(scenes, "source-animation.json"), JSON.stringify(sourceManifest));
  await writeFile(path.join(scenes, "SourceAnimation.tsx"), sourceCode);
  await writeFile(path.join(scenes, "photo.png"), Buffer.from("imported photo bytes"));
  await mkdir(path.join(root, "public"), {recursive: true});
  await writeFile(path.join(root, "public", "logo.png"), Buffer.from("static logo bytes"));
}

function sourceScene(): Scene {
  return {
    id: "source-scene",
    title: "Source scene",
    startWordId: "source-word-a",
    endWordId: "source-word-b",
    intent: "source intent",
    beats: [
      {wordId: "source-word-a", label: "first"},
      {wordId: "source-word-b", label: "second"},
    ],
    editor: {overrides: {caption: "captured caption"}, locks: ["caption"]},
    program: {moduleId: "source-animation", parameters: {caption: "default", count: 3}},
  };
}

function targetScene(): Scene {
  return {
    id: "target-scene",
    title: "Target scene",
    startWordId: "target-word-a",
    endWordId: "target-word-b",
    intent: "target intent",
    design: {} as Scene["design"],
    beats: [{wordId: "old-target-beat", label: "old"}],
    components: [
      {
        id: "existing-component",
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
    editor: {overrides: {count: 7}, locks: ["count"]},
  };
}

function sourceSceneWithComponent(assetId: string): Scene {
  const component = {
    ...targetScene().components![0],
    id: "saved-component",
    startWordId: "component-start",
    endWordId: "component-end",
    props: {text: "captured component"},
    x: 360,
    scale: 0.8,
    mediaBindings: [{source: "asset" as const, assetId, startFrame: 0}],
  };
  return {...sourceScene(), components: [component]};
}

async function makeService(
  root: string,
  directory: string,
  options: Parameters<typeof createAnimationTemplates>[2] = {},
) {
  return createAnimationTemplates(root, directory, options);
}

function packageManifestOffset(packageBytes: Buffer): {readonly manifestStart: number; readonly manifestLength: number} {
  const magicLength = Buffer.byteLength(ANIMATION_PACKAGE_MAGIC);
  expect(packageBytes.subarray(0, magicLength).toString("ascii")).toBe(ANIMATION_PACKAGE_MAGIC);
  const manifestLength = packageBytes.readUInt32BE(magicLength + 2);
  return {manifestStart: magicLength + 1 + 1 + 4, manifestLength};
}

function rewritePackageManifest(
  packageBytes: Buffer,
  mutate: (manifest: Record<string, unknown>) => void,
): Buffer {
  const {manifestStart, manifestLength} = packageManifestOffset(packageBytes);
  const manifest = JSON.parse(
    packageBytes.subarray(manifestStart, manifestStart + manifestLength).toString("utf8"),
  ) as Record<string, unknown>;
  mutate(manifest);
  const replacement = Buffer.from(JSON.stringify(manifest));
  const header = Buffer.from(packageBytes.subarray(0, manifestStart));
  header.writeUInt32BE(replacement.length, Buffer.byteLength(ANIMATION_PACKAGE_MAGIC) + 2);
  return Buffer.concat([
    header,
    replacement,
    packageBytes.subarray(manifestStart + manifestLength),
  ]);
}

async function makeExportedPackage(): Promise<{
  readonly root: string;
  readonly service: ReturnType<typeof createAnimationTemplates>;
  readonly template: AnimationTemplate;
  readonly packageFile: string;
}> {
  const root = await makeRoot();
  await writeSourceModule(root);
  const originalMedia = path.join(root, "original.png");
  const materialDirectory = path.join(root, "materials");
  await mkdir(materialDirectory, {recursive: true});
  await writeFile(originalMedia, Buffer.from("component media bytes"));
  await writeFile(path.join(materialDirectory, "proof.png"), Buffer.from("supplementary media bytes"));
  const assetId = "f543988b-d9d3-4130-a7fc-37491b0f685d";
  const service = await makeService(root, path.join(root, "project-a", "templates"), {
    materialDirectory,
    resolveComponentAsset: async () => ({
      id: assetId,
      name: "original.png",
      kind: "image" as const,
      url: "unused",
      path: originalMedia,
      absolutePath: originalMedia,
      fileName: "original.png",
      extension: ".png",
      mimeType: "image/png",
      size: (await lstat(originalMedia)).size,
    }),
  });
  const template = await service.save({
    name: "Portable animation",
    scene: sourceSceneWithComponent(assetId),
    wordOrder: ["source-word-a", "component-start", "source-word-b", "component-end"],
    requests: [{
      id: "proof",
      sceneId: "source-scene",
      description: "supplementary material",
      reason: "test",
      status: "provided",
      fileName: "proof.png",
    }],
  });
  const packageFile = path.join(root, "portable.cutanimation");
  await service.exportPackage(template.id, packageFile);
  return {root, service, template, packageFile};
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})),
  );
});

describe("animation packages", () => {
  it("exports a bounded streaming package and imports it into an isolated project", async () => {
    const fixture = await makeExportedPackage();
    const bytes = await readFile(fixture.packageFile);
    expect(bytes.length).toBeGreaterThan(0);
    expect((await fixture.service.exportPackage(fixture.template.id, path.join(fixture.root, "second.cutanimation"))).sha256)
      .toMatch(/^[a-f0-9]{64}$/u);

    const importedRoot = await makeRoot("codex-animation-package-import-");
    const componentAssetDirectory = path.join(importedRoot, "component-assets");
    const importedService = await makeService(
      importedRoot,
      path.join(importedRoot, "project-b", "templates"),
      {componentAssetDirectory},
    );
    const imported = await importedService.importPackage(fixture.packageFile);
    expect(imported.alreadyPresent).toBe(false);
    expect(imported.template).toEqual(fixture.template);
    expect(await importedService.list()).toEqual([fixture.template]);

    const scenes = path.join(importedRoot, "workbench-local", "scenes");
    const mediaDirectory = path.join(importedRoot, "public", "saved-animations", fixture.template.moduleId);
    expect(await readdir(scenes)).toEqual(expect.arrayContaining([
      `${fixture.template.moduleId}.jsx`,
      `${fixture.template.moduleId}.json`,
    ]));
    expect((await readdir(mediaDirectory)).length).toBeGreaterThanOrEqual(3);
    const instantiated = await importedService.instantiate({
      id: fixture.template.id,
      target: targetScene(),
      bindings: ["target-a", "target-component-start", "target-b", "target-component-end"],
    });
    expect(instantiated.components).toHaveLength(2);
    expect(instantiated.components?.[1]).toMatchObject({
      startWordId: "target-component-start",
      endWordId: "target-component-end",
      props: {text: "captured component"},
    });

    const repeated = await importedService.importPackage(fixture.packageFile);
    expect(repeated.alreadyPresent).toBe(true);
    expect(await importedService.list()).toHaveLength(1);
    expect(await readFile(path.join(scenes, `${fixture.template.moduleId}.jsx`), "utf8"))
      .toContain("saved-animations");
  });

  it("reuses shared artifacts for another project and rejects collisions without overwriting", async () => {
    const fixture = await makeExportedPackage();
    const secondDirectory = path.join(fixture.root, "project-b", "templates");
    const secondService = await makeService(fixture.root, secondDirectory);
    const first = await secondService.importPackage(fixture.packageFile);
    expect(first.alreadyPresent).toBe(false);
    const sourcePath = path.join(
      fixture.root,
      "workbench-local",
      "scenes",
      `${fixture.template.moduleId}.jsx`,
    );
    const original = await readFile(sourcePath);
    await writeFile(sourcePath, Buffer.concat([original, Buffer.from("\n// collision\n")]));
    await expect(secondService.importPackage(fixture.packageFile)).rejects.toThrow(/冲突|不同|缺失/iu);
    expect(await readFile(sourcePath)).toEqual(Buffer.concat([original, Buffer.from("\n// collision\n")]));
    expect(await secondService.list()).toEqual([fixture.template]);

    const metadataPath = path.join(secondDirectory, "templates.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {templates: AnimationTemplate[]; schemaVersion: 1};
    metadata.templates[0] = {...metadata.templates[0], name: "tampered metadata"};
    await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`);
    await expect(secondService.importPackage(fixture.packageFile)).rejects.toThrow(/内容不同|冲突/iu);
  });

  it("rejects exclusive output collisions, malformed members, truncation, and payload tampering", async () => {
    const fixture = await makeExportedPackage();
    const output = path.join(fixture.root, "exclusive.cutanimation");
    await fixture.service.exportPackage(fixture.template.id, output);
    const before = await readFile(output);
    await expect(fixture.service.exportPackage(fixture.template.id, output)).rejects.toThrow();
    expect(await readFile(output)).toEqual(before);

    const importedRoot = await makeRoot("codex-animation-package-invalid-");
    const importedService = await makeService(importedRoot, path.join(importedRoot, "templates"));
    const traversal = rewritePackageManifest(before, (manifest) => {
      const files = manifest.files as Array<Record<string, unknown>>;
      files[0].path = "../escape.jsx";
    });
    await writeFile(path.join(importedRoot, "traversal.cutanimation"), traversal);
    await expect(importedService.importPackage(path.join(importedRoot, "traversal.cutanimation"))).rejects.toThrow(/路径|无效/iu);

    const unknown = rewritePackageManifest(before, (manifest) => {
      const files = manifest.files as Array<Record<string, unknown>>;
      files[0].path = "unknown.bin";
    });
    await writeFile(path.join(importedRoot, "unknown.cutanimation"), unknown);
    await expect(importedService.importPackage(path.join(importedRoot, "unknown.cutanimation"))).rejects.toThrow(/未知|清单|完整|不存在/iu);

    const truncated = path.join(importedRoot, "truncated.cutanimation");
    await writeFile(truncated, before.subarray(0, before.length - 1));
    await expect(importedService.importPackage(truncated)).rejects.toThrow(/截断|hash|尾部/iu);

    const tainted = Buffer.from(before);
    tainted[tainted.length - 1] ^= 0xff;
    const taintedPath = path.join(importedRoot, "tainted.cutanimation");
    await writeFile(taintedPath, tainted);
    await expect(importedService.importPackage(taintedPath)).rejects.toThrow(/hash|内容/iu);
    expect(await readdir(importedRoot)).not.toContain("escape.jsx");
  });

  it("rejects symlinked package destination parents and deeply nested comparison values", async () => {
    const fixture = await makeExportedPackage();
    const root = await makeRoot("codex-animation-package-symlink-");
    const outside = await mkdtemp(path.join(os.tmpdir(), "codex-animation-package-outside-"));
    temporaryDirectories.push(outside);
    await rm(path.join(root, "workbench-local", "scenes"), {recursive: true, force: true});
    await symlink(outside, path.join(root, "workbench-local", "scenes"), "dir");
    const service = await makeService(root, path.join(root, "templates"));
    await expect(service.importPackage(fixture.packageFile)).rejects.toThrow(/符号链接|父目录/iu);

    const left: Record<string, unknown> = {};
    const right: Record<string, unknown> = {};
    let leftCursor: Record<string, unknown> = left;
    let rightCursor: Record<string, unknown> = right;
    for (let index = 0; index < 258; index += 1) {
      const nextLeft: Record<string, unknown> = {};
      const nextRight: Record<string, unknown> = {};
      leftCursor.next = nextLeft;
      rightCursor.next = nextRight;
      leftCursor = nextLeft;
      rightCursor = nextRight;
    }
    expect(() => packageJsonEqual(left, right)).toThrow(/嵌套/iu);
  });
});
