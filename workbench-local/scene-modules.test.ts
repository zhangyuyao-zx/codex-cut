import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSceneModules } from "./scene-modules";

const temporaryDirectories: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-workbench-scenes-"));
  await mkdir(path.join(root, "workbench-local", "scenes"), { recursive: true });
  temporaryDirectories.push(root);
  return root;
}

async function writeModule(
  root: string,
  manifest: Record<string, unknown>,
  source = "export function Demo() { return null; }\n",
): Promise<void> {
  const scenes = path.join(root, "workbench-local", "scenes");
  await writeFile(path.join(scenes, `${String(manifest.id)}.json`), JSON.stringify(manifest));
  if (typeof manifest.entry === "string") {
    await writeFile(path.join(scenes, manifest.entry), source);
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("scene modules", () => {
  it("lists full details, validates defaults, and hashes manifest plus source without importing code", async () => {
    const root = await makeRoot();
    const manifest = {
      id: "demo-module",
      label: "Demo module",
      entry: "Demo.tsx",
      exportName: "Demo",
      controls: [
        { key: "caption", label: "Caption", type: "text", required: true },
        { key: "count", label: "Count", type: "number", default: 3, min: 1, max: 5 },
        { key: "accent", label: "Accent", type: "color", default: "#aBc123" },
        { key: "enabled", label: "Enabled", type: "boolean", default: true },
      ],
    } as const;
    const source = "throw new Error('inspection must not execute this');\n";
    await writeModule(root, manifest, source);
    const service = createSceneModules(root);
    const detail = await service.detail("demo-module");
    const expectedHash = createHash("sha256")
      .update(JSON.stringify(manifest))
      .update(source)
      .digest("hex");
    expect(detail).toMatchObject({
      ...manifest,
      acceptsMaterials: false,
      modulePath: path.join(root, "workbench-local", "scenes", "Demo.tsx"),
      moduleUrl: `/@fs${path.join(root, "workbench-local", "scenes", "Demo.tsx")}`,
      sourceHash: expectedHash,
    });
    expect((await service.list())[0]).toMatchObject(detail);
    await expect(
      service.validate({ moduleId: "demo-module", parameters: { caption: "  hello  " } }),
    ).resolves.toMatchObject({
      resolvedParameters: {
        caption: "  hello  ",
        count: 3,
        accent: "#aBc123",
        enabled: true,
      },
    });
  });

  it("invalidates only modules that import the changed local helper", async () => {
    const root = await makeRoot();
    for (const id of ["dependent", "independent"]) {
      await writeModule(root, {id,label:id,entry:id+".tsx",exportName:"Demo",controls:[]},
        id === "dependent" ? "import {value} from './helper.js'; export const Demo=()=>value;" : "export const Demo=()=>null;");
    }
    const helper=path.join(root,"workbench-local/scenes/helper.ts");
    await writeFile(helper,"export const value=1;");
    const modules=createSceneModules(root);
    const before=await Promise.all([modules.detail("dependent"),modules.detail("independent")]);
    await writeFile(helper,"export const value=2;");
    const after=await Promise.all([modules.detail("dependent"),modules.detail("independent")]);
    expect(after[0].sourceHash).not.toBe(before[0].sourceHash);
    expect(after[1].sourceHash).toBe(before[1].sourceHash);
  });

  it("changes sourceHash when only the module source changes", async () => {
    const root = await makeRoot();
    await writeModule(root, {
      id: "hash-check",
      label: "Hash check",
      entry: "Hash.tsx",
      exportName: "Hash",
      controls: [],
    }, "export const value = 1;\n");
    const service = createSceneModules(root);
    const before = await service.detail("hash-check");
    await writeFile(path.join(root, "workbench-local", "scenes", "Hash.tsx"), "export const value = 2;\n");
    const after = await service.detail("hash-check");
    expect(after.sourceHash).not.toBe(before.sourceHash);
  });

  it("rejects unknown keys, wrong types, non-finite values, ranges, and malformed colors", async () => {
    const root = await makeRoot();
    await writeModule(root, {
      id: "parameter-check",
      label: "Parameter check",
      entry: "Parameter.tsx",
      exportName: "Parameter",
      controls: [
        { key: "title", label: "Title", type: "text" },
        { key: "amount", label: "Amount", type: "number", min: 0, max: 10 },
        { key: "color", label: "Color", type: "color" },
        { key: "visible", label: "Visible", type: "boolean" },
      ],
    });
    const service = createSceneModules(root);
    await expect(service.validate({ moduleId: "parameter-check", parameters: { extra: 1 } })).rejects.toThrow(/unknown parameter|未知动画参数/iu);
    await expect(service.validate({ moduleId: "parameter-check", parameters: { title: 1 } })).rejects.toThrow(/类型|type/iu);
    await expect(service.validate({ moduleId: "parameter-check", parameters: { amount: Number.NaN } })).rejects.toThrow(/finite|有限/iu);
    await expect(service.validate({ moduleId: "parameter-check", parameters: { amount: 11 } })).rejects.toThrow(/不能大于|above|max/iu);
    await expect(service.validate({ moduleId: "parameter-check", parameters: { color: "#12345" } })).rejects.toThrow(/hex|十六进制|颜色/iu);
    await expect(service.validate({ moduleId: "parameter-check", parameters: { visible: "true" } })).rejects.toThrow(/boolean|类型/iu);
  });

  it("rejects blank required text and omits absent optional controls", async () => {
    const root = await makeRoot();
    await writeModule(root, {
      id: "required-check",
      label: "Required check",
      entry: "Required.tsx",
      exportName: "Required",
      controls: [
        { key: "requiredText", label: "Required", type: "text", required: true },
        { key: "optionalText", label: "Optional", type: "text" },
      ],
    });
    const service = createSceneModules(root);
    await expect(service.validate({ moduleId: "required-check", parameters: {} })).rejects.toThrow(/required|必填/iu);
    await expect(service.validate({ moduleId: "required-check", parameters: { requiredText: "  " } })).rejects.toThrow(/required|必填/iu);
    await expect(service.validate({ moduleId: "required-check", parameters: { requiredText: "ok" } })).resolves.toMatchObject({
      resolvedParameters: { requiredText: "ok" },
    });
    const result = await service.validate({ moduleId: "required-check", parameters: { requiredText: "ok" } });
    expect(result.resolvedParameters).not.toHaveProperty("optionalText");
  });

  it("reports unknown IDs and rejects lexical and symlink entry escapes", async () => {
    const root = await makeRoot();
    const scenes = path.join(root, "workbench-local", "scenes");
    await expect(createSceneModules(root).detail("missing-module")).rejects.toThrow(/unknown|未知/iu);
    await writeFile(path.join(root, "outside.tsx"), "export const Outside = null;\n");
    await writeFile(
      path.join(scenes, "lexical-escape.json"),
      JSON.stringify({
        id: "lexical-escape",
        label: "Escape",
        entry: "../outside.tsx",
        exportName: "Outside",
        controls: [],
      }),
    );
    await expect(createSceneModules(root).detail("lexical-escape")).rejects.toThrow(/invalid manifest|无效|entry/iu);

    await symlink(path.join(root, "outside.tsx"), path.join(scenes, "Escaped.tsx"));
    await writeFile(
      path.join(scenes, "symlink-escape.json"),
      JSON.stringify({
        id: "symlink-escape",
        label: "Escape",
        entry: "Escaped.tsx",
        exportName: "Outside",
        controls: [],
      }),
    );
    await expect(createSceneModules(root).detail("symlink-escape")).rejects.toThrow(/escape|逃出/iu);
  });

  it("returns an empty list for a missing scenes directory and surfaces invalid manifests", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-workbench-no-scenes-"));
    temporaryDirectories.push(root);
    await expect(createSceneModules(root).list()).resolves.toEqual([]);
    await mkdir(path.join(root, "workbench-local", "scenes"), { recursive: true });
    await writeFile(path.join(root, "workbench-local", "scenes", "broken.json"), "{ not json");
    await expect(createSceneModules(root).list()).rejects.toThrow(/invalid JSON|JSON|清单/iu);
  });
});
