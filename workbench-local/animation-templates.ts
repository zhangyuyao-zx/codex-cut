import { randomUUID } from "node:crypto";
import {
  mkdir,
  copyFile,
  chmod,
  lstat,
  readdir,
  readFile,
  rename,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import {constants} from 'node:fs';
import {fileDigest} from './segment-reviews';
import {resolveStaticAsset, staticAssetCalls} from './scene-static-assets';

import {
  createSceneModules,
  type SceneModuleControl,
  type SceneModuleDetail,
  type SceneModuleParameterValue,
} from "./scene-modules";
import type { Scene, MaterialRequest } from "./production-store";
import {animationContentsSchema, animationCues, captureAnimationContents, installAnimationAssets, instantiateAnimationComponents, instantiateAnimationMaterials, type AnimationContents, type AnimationContentOptions} from './animation-contents';
import {
  exportAnimationPackage,
  readAnimationPackage,
  publishAnimationPackageFile,
  removeImportedAnimationPackage,
  packageJsonEqual,
  type AnimationPackageFile,
  type AnimationPackageSourceFile,
  type ExportAnimationPackageResult,
} from './animation-packages';

/**
 * A saved animation is a snapshot of a scene module and its resolved controls.
 * Component intervals use the same ordered cue table as the animation.
 * Narration is rebound; media assets are captured as independent local files.
 */
export interface AnimationTemplateCue {
  readonly label: string;
}

export interface AnimationTemplate {
  readonly id: string;
  readonly name: string;
  /** The captured module id exposed to createSceneModules. */
  readonly moduleId: string;
  readonly createdAt: string;
  readonly sourceModuleId: string;
  readonly sourceSceneId: string;
  readonly sourceHash: string;
  readonly parameters: Readonly<Record<string, SceneModuleParameterValue>>;
  readonly locks: readonly string[];
  readonly cues: readonly AnimationTemplateCue[];
  readonly controls: readonly SceneModuleControl[];
  readonly objects: readonly {
    readonly id: string;
    readonly label: string;
    readonly parameters: readonly string[];
  }[];
  readonly acceptsMaterials: boolean;
  readonly contents?: AnimationContents;
}

export interface SaveAnimationTemplateInput {
  readonly name: string;
  readonly scene: Scene;
  readonly expectedSourceHash?: string;
  readonly wordOrder?: readonly string[];
  readonly requests?: readonly MaterialRequest[];
}

export interface InstantiateAnimationTemplateInput {
  readonly id: string;
  readonly target: Scene;
  /** Ordered target word ids, one for each saved cue. */
  readonly bindings: readonly string[];
}

export interface AnimationTemplates {
  list(): Promise<AnimationTemplate[]>;
  save(input: SaveAnimationTemplateInput): Promise<AnimationTemplate>;
  instantiate(input: InstantiateAnimationTemplateInput): Promise<Scene>;
  instantiateMaterials(id:string,target:Scene,requests:readonly MaterialRequest[],installDefaults?:boolean):Promise<MaterialRequest[]>;
  exportPackage(id: string, outputFile: string): Promise<ExportAnimationPackageResult>;
  importPackage(packageFile: string): Promise<{
    readonly template: AnimationTemplate;
    readonly alreadyPresent: boolean;
  }>;
}

export type AnimationTemplateErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "STALE_SOURCE"
  | "BUNDLE_FAILED"
  | "STORAGE_FAILED"
  | "PACKAGE_FAILED"
  | "PACKAGE_CONFLICT";

export class AnimationTemplateError extends Error {
  public readonly code: AnimationTemplateErrorCode;

  public constructor(code: AnimationTemplateErrorCode, message: string) {
    super(message);
    this.name = "AnimationTemplateError";
    this.code = code;
  }
}

interface TemplateFile {
  readonly schemaVersion: 1;
  readonly templates: AnimationTemplate[];
}

const TEMPLATE_FILE_NAME = "templates.json";
const TEMPLATE_SCHEMA_VERSION = 1 as const;
const SOURCE_MODULE_ID_PATTERN = /^saved-[a-f0-9-]{36}$/u;
const CONTROL_KEY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const MAX_TEMPLATE_NAME_LENGTH = 80;
const MAX_LOCK_LENGTH = 128;
const EXTERNAL_PACKAGES = [
  "react",
  "react/*",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "remotion",
  "remotion/*",
  "@remotion/*",
];

const writeQueues = new Map<string, Promise<void>>();

function runSerialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const marker = current.then(
    () => undefined,
    () => undefined,
  );
  writeQueues.set(key, marker);
  void marker.then(() => {
    if (writeQueues.get(key) === marker) writeQueues.delete(key);
  });
  return current;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    isRecord(error) &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function fail(code: AnimationTemplateErrorCode, message: string): never {
  throw new AnimationTemplateError(code, message);
}

function assertRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) fail("INVALID_INPUT", `${context} must be an object`);
  return value;
}

function assertTemplateName(value: unknown): string {
  if (typeof value !== "string")
    fail("INVALID_INPUT", "Template name must be text");
  if (value.length > MAX_TEMPLATE_NAME_LENGTH)
    fail(
      "INVALID_INPUT",
      `Template name must be at most ${MAX_TEMPLATE_NAME_LENGTH} characters`,
    );
  const name = value.trim();
  if (name.length === 0)
    fail("INVALID_INPUT", "Template name must not be blank");
  if (/[\u0000-\u001f\u007f]/u.test(name))
    fail("INVALID_INPUT", "Template name contains a control character");
  return name;
}

function assertScene(
  scene: unknown,
  options: { readonly requireProgram: boolean; readonly rejectComponents: boolean },
): asserts scene is Scene {
  const value = assertRecord(scene, "scene");
  if (typeof value.id !== "string" || value.id.trim() === "")
    fail("INVALID_INPUT", "Scene id must be non-empty text");
  if (options.requireProgram && !isRecord(value.program))
    fail("INVALID_INPUT", "Cannot save an animation template without a program");
  if (options.rejectComponents && value.components !== undefined) {
    if (!Array.isArray(value.components))
      fail("INVALID_INPUT", "Scene components must be an array");
    if (value.components.length > 0)
      fail(
        "INVALID_INPUT",
        "Cannot save an animation template from a scene with components; save the scene animation before adding components",
      );
  }
  if (!Array.isArray(value.beats))
    fail("INVALID_INPUT", "Scene beats must be an array");
  for (const [index, beat] of value.beats.entries()) {
    if (!isRecord(beat) || typeof beat.label !== "string")
      fail("INVALID_INPUT", `Scene beat ${index} must have a label`);
    if (beat.label.trim() === "")
      fail("INVALID_INPUT", `Scene beat ${index} label must not be blank`);
    if (typeof beat.wordId !== "string" || beat.wordId.trim() === "")
      fail("INVALID_INPUT", `Scene beat ${index} must have a wordId`);
  }
}

function assertProgram(scene: Scene): {
  readonly moduleId: string;
  readonly parameters: Record<string, unknown>;
} {
  if (!scene.program)
    fail("INVALID_INPUT", "Cannot save an animation template without a program");
  if (
    typeof scene.program.moduleId !== "string" ||
    scene.program.moduleId.trim() === ""
  )
    fail("INVALID_INPUT", "Scene program moduleId must be non-empty text");
  if (!isRecord(scene.program.parameters))
    fail("INVALID_INPUT", "Scene program parameters must be an object");
  return {
    moduleId: scene.program.moduleId,
    parameters: scene.program.parameters,
  };
}

function assertLocks(value: unknown, context: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail("INVALID_INPUT", `${context} must be an array`);
  const locks: string[] = [];
  const seen = new Set<string>();
  for (const lock of value) {
    if (
      typeof lock !== "string" ||
      lock.trim() === "" ||
      lock.length > MAX_LOCK_LENGTH
    )
      fail("INVALID_INPUT", `${context} contains an invalid lock`);
    if (seen.has(lock)) fail("INVALID_INPUT", `${context} contains duplicate lock ${lock}`);
    seen.add(lock);
    locks.push(lock);
  }
  return locks;
}

function assertTargetEditor(target: Scene): {
  readonly overrides: Record<string, unknown>;
  readonly locks: readonly string[];
} {
  if (target.editor === undefined) return { overrides: {}, locks: [] };
  if (!isRecord(target.editor.overrides))
    fail("INVALID_INPUT", "Target editor overrides must be an object");
  return {
    overrides: target.editor.overrides,
    locks: assertLocks(target.editor.locks, "Target editor locks"),
  };
}

function sourceCueLabels(scene: Scene): AnimationTemplateCue[] {
  return scene.beats.map((beat) => ({ label: beat.label }));
}

function supportedControlKeys(detail: {
  readonly controls: readonly SceneModuleControl[];
}): Set<string> {
  return new Set(detail.controls.map((control) => control.key));
}

function assertEditorKeys(
  overrides: Record<string, unknown>,
  locks: readonly string[],
  controls: readonly SceneModuleControl[],
  context: string,
): void {
  const supported = supportedControlKeys({ controls });
  const unknownOverride = Object.keys(overrides).find(
    (key) => !supported.has(key),
  );
  if (unknownOverride)
    fail(
      "INVALID_INPUT",
      `${context} contains an unsupported edited parameter: ${unknownOverride}`,
    );
  const unknownLock = locks.find((key) => !supported.has(key));
  if (unknownLock)
    fail(
      "INVALID_INPUT",
      `${context} contains an unsupported locked parameter: ${unknownLock}`,
    );
}

function assertTemplateShape(value: unknown, index: number): AnimationTemplate {
  const context = `Template ${index}`;
  const record = assertRecord(value, context);
  const stringField = (key: string): string => {
    const field = record[key];
    if (typeof field !== "string" || field.length === 0)
      fail("STORAGE_FAILED", `${context}.${key} must be non-empty text`);
    return field;
  };
  const id = stringField("id");
  const name = stringField("name");
  const moduleId = stringField("moduleId");
  const createdAt = stringField("createdAt");
  const sourceModuleId = stringField("sourceModuleId");
  const sourceSceneId = stringField("sourceSceneId");
  const sourceHash = stringField("sourceHash");
  if (!SOURCE_MODULE_ID_PATTERN.test(moduleId))
    fail("STORAGE_FAILED", `${context}.moduleId is invalid`);
  if (!isRecord(record.parameters))
    fail("STORAGE_FAILED", `${context}.parameters must be an object`);
  if (!Array.isArray(record.locks))
    fail("STORAGE_FAILED", `${context}.locks must be an array`);
  if (!Array.isArray(record.cues))
    fail("STORAGE_FAILED", `${context}.cues must be an array`);
  if (!Array.isArray(record.controls))
    fail("STORAGE_FAILED", `${context}.controls must be an array`);
  if (!Array.isArray(record.objects))
    fail("STORAGE_FAILED", `${context}.objects must be an array`);
  if (typeof record.acceptsMaterials !== "boolean")
    fail("STORAGE_FAILED", `${context}.acceptsMaterials must be boolean`);
  const locks = assertLocks(record.locks, `${context}.locks`);
  const cues: AnimationTemplateCue[] = [];
  for (const [cueIndex, cue] of record.cues.entries()) {
    if (!isRecord(cue) || typeof cue.label !== "string" || cue.label.trim() === "")
      fail("STORAGE_FAILED", `${context}.cues[${cueIndex}] must have a label`);
    cues.push({ label: cue.label });
  }
  const controls: SceneModuleControl[] = [];
  for (const [controlIndex, control] of record.controls.entries()) {
    if (!isRecord(control))
      fail("STORAGE_FAILED", `${context}.controls[${controlIndex}] is invalid`);
    if (
      typeof control.key !== "string" ||
      !CONTROL_KEY_PATTERN.test(control.key) ||
      typeof control.label !== "string" ||
      typeof control.type !== "string"
    )
      fail("STORAGE_FAILED", `${context}.controls[${controlIndex}] is invalid`);
    controls.push(clone(control) as unknown as SceneModuleControl);
  }
  const objects: {
    id: string;
    label: string;
    parameters: string[];
  }[] = [];
  for (const [objectIndex, object] of record.objects.entries()) {
    if (
      !isRecord(object) ||
      typeof object.id !== "string" ||
      typeof object.label !== "string" ||
      !Array.isArray(object.parameters) ||
      object.parameters.some((key) => typeof key !== "string")
    )
      fail("STORAGE_FAILED", `${context}.objects[${objectIndex}] is invalid`);
    objects.push({
      id: object.id,
      label: object.label,
      parameters: [...(object.parameters as string[])],
    });
  }
  return {
    id,
    name,
    moduleId,
    createdAt,
    sourceModuleId,
    sourceSceneId,
    sourceHash,
    parameters: clone(record.parameters) as Record<string, SceneModuleParameterValue>,
    locks,
    cues,
    controls,
    objects,
    acceptsMaterials: record.acceptsMaterials,
    ...(record.contents === undefined ? {} : {contents:animationContentsSchema.parse(record.contents)}),
  };
}

function parseTemplateFile(value: unknown, source: string): TemplateFile {
  if (!isRecord(value))
    fail("STORAGE_FAILED", `Invalid animation template file at ${source}`);
  if (value.schemaVersion !== TEMPLATE_SCHEMA_VERSION)
    fail("STORAGE_FAILED", `Unsupported animation template schema at ${source}`);
  if (!Array.isArray(value.templates))
    fail("STORAGE_FAILED", `Animation template file has no templates array: ${source}`);
  const templates = value.templates.map((template, index) =>
    assertTemplateShape(template, index),
  );
  const ids = new Set<string>();
  for (const template of templates) {
    if (ids.has(template.id))
      fail("STORAGE_FAILED", `Animation template id is duplicated: ${template.id}`);
    ids.add(template.id);
  }
  return { schemaVersion: TEMPLATE_SCHEMA_VERSION, templates };
}

async function readTemplateFile(directory: string): Promise<TemplateFile> {
  const filePath = path.join(directory, TEMPLATE_FILE_NAME);
  try {
    const contents = await readFile(filePath, "utf8");
    return parseTemplateFile(JSON.parse(contents) as unknown, filePath);
  } catch (error) {
    if (isNodeError(error, "ENOENT"))
      return { schemaVersion: TEMPLATE_SCHEMA_VERSION, templates: [] };
    if (error instanceof AnimationTemplateError) throw error;
    if (error instanceof SyntaxError)
      fail("STORAGE_FAILED", `Invalid animation template JSON at ${filePath}`);
    fail(
      "STORAGE_FAILED",
      `Cannot read animation template metadata at ${filePath}`,
    );
  }
}

async function writeAtomic(filePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let renamed = false;
  try {
    await writeFile(temporaryPath, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
    renamed = true;
  } finally {
    if (!renamed) await unlink(temporaryPath).catch(() => undefined);
  }
}

function wrapperSource(
  detail: SceneModuleDetail,
  sourceSceneId: string,
  sourceCueIds: readonly string[],
  beatIndices: readonly number[],
  moduleId: string,
  contents: AnimationContents,
): string {
  const sourceImport = `./${detail.entry}`;
  const sourceCueJson = JSON.stringify(sourceCueIds);
  const sourceIdJson = JSON.stringify(sourceSceneId);
  const materials=contents.materials.map(m=>`{id:${JSON.stringify(m.id)},kind:${JSON.stringify(m.kind)},src:__savedStaticFile(${JSON.stringify(`saved-animations/${moduleId}/${m.archiveName}`)})}`).join(',');
  return `import { ${detail.exportName} as __SavedSourceAnimation } from ${JSON.stringify(sourceImport)};
import {staticFile as __savedStaticFile} from 'remotion';
const __savedSourceSceneId = ${sourceIdJson};
const __savedSourceCueIds = ${sourceCueJson};
const __savedBeatIndices = ${JSON.stringify(beatIndices)};
export function SavedAnimation(props) {
  const mappedBeats = __savedSourceCueIds.map((sourceWordId, index) => {
    const beat = props.beats?.[__savedBeatIndices[index]];
    if (!beat) throw new Error(\`Missing saved animation cue \${index}\`);
    return { ...beat, wordId: sourceWordId };
  });
  const savedMaterials = [${materials}];
  const materials = [...(props.materials || []), ...savedMaterials.filter(s=>!(props.materials || []).some(m=>m.id===s.id))];
  return <__SavedSourceAnimation {...props} id={__savedSourceSceneId} beats={mappedBeats} materials={materials} />;
}
`;
}

async function bundleWrapper(
  detail: SceneModuleDetail,
  sourceSceneId: string,
  sourceCueIds: readonly string[],
  root: string,
  moduleId: string,
  beatIndices: readonly number[],
  contents: AnimationContents,
): Promise<{source: string; assets: Map<string, string>}> {
  const wrapper = wrapperSource(detail, sourceSceneId, sourceCueIds, beatIndices, moduleId, contents);
  const assets = new Map<string, string>();
  const canonicalRoot = await realpath(root);
  async function capture(file: string) {
    const actual = await realpath(file), relative = path.relative(canonicalRoot, actual);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('动画素材越过工程目录');
    const name = await fileDigest(actual) + path.extname(actual).toLowerCase();
    assets.set(name, actual);
    return `saved-animations/${moduleId}/${name}`;
  }
  try {
    const result = await build({
      stdin: {
        contents: wrapper,
        sourcefile: "__saved_animation_wrapper.tsx",
        resolveDir: path.dirname(detail.modulePath),
        loader: "tsx",
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "neutral",
      target: "es2022",
      jsx: "automatic",
      external: EXTERNAL_PACKAGES,
      logLevel: "silent",
      sourcemap: false,
      plugins: [{name: 'capture-animation-assets', setup(builder) {
        builder.onResolve({filter: /\.(png|jpe?g|webp|gif|svg|mp4|mov|webm|mp3|wav|m4a|ogg|woff2?|ttf|otf)$/i}, args => {
          if (!args.path.startsWith('.') && !path.isAbsolute(args.path)) return;
          return {path: path.resolve(args.resolveDir, args.path), namespace: 'saved-media'};
        });
        builder.onLoad({filter: /.*/, namespace: 'saved-media'}, async args => ({
          contents: `import {staticFile} from 'remotion'; export default staticFile(${JSON.stringify(await capture(args.path))});`, loader: 'js',
        }));
        builder.onLoad({filter: /\.[cm]?[jt]sx?$/}, async args => {
          let contents = await readFile(args.path, 'utf8');
          const calls = staticAssetCalls(contents, args.path);
          for (const call of calls.reverse()) {
            // Dynamic mediaSrc/materials are rebound by the target scene, not captured from the old narration.
            if (call.asset === null) continue;
            const url = await capture(await resolveStaticAsset(root, call.asset));
            contents = contents.slice(0, call.start) + JSON.stringify(url) + contents.slice(call.end);
          }
          return {contents, loader: /\.tsx$/.test(args.path) ? 'tsx' : /\.jsx$/.test(args.path) ? 'jsx' : /\.[cm]?ts$/.test(args.path) ? 'ts' : 'js', resolveDir: path.dirname(args.path)};
        });
      }}],
    });
    const output = result.outputFiles?.[0]?.text;
    if (!output) fail("BUNDLE_FAILED", "Animation template bundle produced no output");
    return {source: output, assets};
  } catch (error) {
    if (error instanceof AnimationTemplateError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    fail("BUNDLE_FAILED", `Cannot bundle animation template: ${message}`);
  }
}

function templateModuleManifest(
  template: AnimationTemplate,
): Record<string, unknown> {
  return {
    id: template.moduleId,
    label: `保存动画 · ${template.name}`,
    entry: `${template.moduleId}.jsx`,
    exportName: "SavedAnimation",
    controls: clone(template.controls),
    objects: clone(template.objects),
    acceptsMaterials: template.acceptsMaterials,
  };
}

const MAX_PACKAGE_SOURCE_BYTES = 16 * 1024 * 1024;
const PACKAGE_MEDIA_NAME_PATTERN = /^[a-f0-9]{64}\.(png|jpe?g|webp|gif|svg|mp4|mov|webm|mp3|wav|m4a|ogg|woff2?|ttf|otf)$/u;

function sameArtifactStat(left: any, right: any): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function readBoundedArtifact(file: string, maximum: number, context: string): Promise<string> {
  let before: any;
  try {
    before = await lstat(file, {bigint: true});
  } catch (error) {
    fail("PACKAGE_FAILED", `${context} 不存在`);
  }
  if (!before.isFile() || before.isSymbolicLink())
    fail("PACKAGE_FAILED", `${context} 必须是普通文件`);
  if (before.size > BigInt(maximum))
    fail("PACKAGE_FAILED", `${context} 超过 ${maximum} 字节上限`);
  const contents = await readFile(file, "utf8");
  const after = await lstat(file, {bigint: true});
  if (!sameArtifactStat(before, after))
    fail("PACKAGE_FAILED", `${context} 在读取期间发生变化`);
  return contents;
}

async function assertRegularArtifact(file: string, context: string): Promise<void> {
  let info: any;
  try {
    info = await lstat(file, {bigint: true});
  } catch {
    fail("PACKAGE_FAILED", `${context} 不存在`);
  }
  if (!info.isFile() || info.isSymbolicLink())
    fail("PACKAGE_FAILED", `${context} 必须是普通文件`);
}

function staticAnimationMediaReferences(source: string, moduleId: string): Set<string> {
  const prefix = `saved-animations/${moduleId}/`;
  const references = new Set<string>();
  let cursor = 0;
  while (true) {
    const start = source.indexOf(prefix, cursor);
    if (start < 0) break;
    let end = start + prefix.length;
    while (end < source.length && !/["'\s),`]/u.test(source[end])) end += 1;
    references.add(source.slice(start, end));
    cursor = end;
  }
  return references;
}

function packageMediaArchiveNames(template: AnimationTemplate, references: Set<string>): Set<string> {
  const names = new Set<string>();
  const prefix = `saved-animations/${template.moduleId}/`;
  for (const reference of references) {
    if (!reference.startsWith(prefix))
      fail("PACKAGE_FAILED", `源码静态素材引用越过动画目录：${reference}`);
    const name = reference.slice(prefix.length);
    if (!PACKAGE_MEDIA_NAME_PATTERN.test(name))
      fail("PACKAGE_FAILED", `源码静态素材引用名称无效：${name}`);
    names.add(name);
  }
  for (const asset of template.contents?.componentAssets || []) names.add(asset.archiveName);
  for (const material of template.contents?.materials || []) names.add(material.archiveName);
  return names;
}

/**
 * Package destinations are selected by this service from a fixed allow-list.
 * Check every existing directory in the absolute chain before reading or
 * publishing so a symlink cannot redirect a package artifact outside the
 * project root. Missing parents are allowed and will be created atomically by
 * the caller; the check is repeated for each destination immediately before
 * publication.
 */
async function assertNoSymlinkParents(
  base: string,
  relativePath: string,
  context: string,
): Promise<void> {
  if (!path.isAbsolute(base)) fail("PACKAGE_FAILED", `${context} 根目录必须是绝对路径`);
  const target = path.resolve(base, ...relativePath.split("/"));
  const basePath = path.resolve(base);
  const relativeToBase = path.relative(basePath, target);
  if (
    relativeToBase === ".." ||
    relativeToBase.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToBase)
  )
    fail("PACKAGE_FAILED", `${context} 越过允许目录`);
  const parent = path.dirname(target);
  const parts = path.relative(basePath, parent).split(path.sep).filter(Boolean);
  let current = basePath;
  let baseInfo: any;
  try {
    baseInfo = await lstat(current, { bigint: true });
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    fail("PACKAGE_FAILED", `${context} 根目录不可检查`);
  }
  if (baseInfo.isSymbolicLink()) fail("PACKAGE_FAILED", `${context} 根目录不能是符号链接`);
  if (!baseInfo.isDirectory()) fail("PACKAGE_FAILED", `${context} 根路径必须是目录`);
  for (const part of parts) {
    current = path.join(current, part);
    let info: any;
    try {
      info = await lstat(current, { bigint: true });
    } catch (error) {
      if (isNodeError(error, "ENOENT")) break;
      fail("PACKAGE_FAILED", `${context} 父目录不可检查`);
    }
    if (info.isSymbolicLink()) fail("PACKAGE_FAILED", `${context} 父目录不能是符号链接`);
    if (!info.isDirectory()) fail("PACKAGE_FAILED", `${context} 父路径必须是目录`);
  }
}

async function packageFileSources(
  root: string,
  template: AnimationTemplate,
): Promise<AnimationPackageSourceFile[]> {
  const sourceArchive = `workbench-local/scenes/${template.moduleId}.jsx`;
  const manifestArchive = `workbench-local/scenes/${template.moduleId}.json`;
  const sourcePath = path.join(root, ...sourceArchive.split("/"));
  const mediaDirectory = path.join(root, "public", "saved-animations", template.moduleId);
  await assertNoSymlinkParents(root, sourceArchive, "动画源码路径");
  await assertNoSymlinkParents(root, manifestArchive, "动画模块 manifest 路径");
  await assertNoSymlinkParents(
    root,
    `public/saved-animations/${template.moduleId}/.media`,
    "动画媒体路径",
  );
  const source = await readBoundedArtifact(sourcePath, MAX_PACKAGE_SOURCE_BYTES, "动画源码");
  const mediaNames = packageMediaArchiveNames(
    template,
    staticAnimationMediaReferences(source, template.moduleId),
  );
  const entries = new Map<string, any>();
  try {
    for (const entry of await readdir(mediaDirectory, {withFileTypes: true})) {
      if (!entry.isFile() || entry.isSymbolicLink())
        fail("PACKAGE_FAILED", `动画媒体目录包含非普通文件：${entry.name}`);
      if (!PACKAGE_MEDIA_NAME_PATTERN.test(entry.name))
        fail("PACKAGE_FAILED", `动画媒体目录包含未声明文件：${entry.name}`);
      entries.set(entry.name, entry);
    }
  } catch (error) {
    if (isNodeError(error, "ENOENT") && mediaNames.size === 0) {
      return [
        {path: sourceArchive, sourcePath},
        {path: manifestArchive, sourcePath: path.join(root, ...manifestArchive.split("/"))},
      ];
    }
    if (error instanceof AnimationTemplateError) throw error;
    fail("PACKAGE_FAILED", `动画媒体目录不可读：${mediaDirectory}`);
  }
  for (const name of mediaNames) {
    if (!entries.has(name)) fail("PACKAGE_FAILED", `缺少动画媒体：${name}`);
  }
  for (const name of entries.keys()) {
    if (!mediaNames.has(name)) fail("PACKAGE_FAILED", `存在未声明动画媒体：${name}`);
  }
  const files: AnimationPackageSourceFile[] = [
    {path: sourceArchive, sourcePath},
    {path: manifestArchive, sourcePath: path.join(root, ...manifestArchive.split("/"))},
  ];
  for (const name of [...mediaNames].sort())
    files.push({
      path: `public/saved-animations/${template.moduleId}/${name}`,
      sourcePath: path.join(mediaDirectory, name),
    });
  return files;
}

async function validateTemplateArtifacts(
  root: string,
  template: AnimationTemplate,
): Promise<void> {
  const sourceArchive = `workbench-local/scenes/${template.moduleId}.jsx`;
  const manifestArchive = `workbench-local/scenes/${template.moduleId}.json`;
  const sourcePath = path.join(root, ...sourceArchive.split("/"));
  const manifestPath = path.join(root, ...manifestArchive.split("/"));
  await assertNoSymlinkParents(root, sourceArchive, "动画源码路径");
  await assertNoSymlinkParents(root, manifestArchive, "动画模块 manifest 路径");
  const source = await readBoundedArtifact(sourcePath, MAX_PACKAGE_SOURCE_BYTES, "动画源码");
  const manifestText = await readBoundedArtifact(manifestPath, 2 * 1024 * 1024, "动画模块 manifest");
  let actualManifest: unknown;
  try {
    actualManifest = JSON.parse(manifestText) as unknown;
  } catch {
    fail("PACKAGE_FAILED", "动画模块 manifest 不是有效 JSON");
  }
  if (!packageJsonEqual(actualManifest, templateModuleManifest(template)))
    fail("PACKAGE_FAILED", "动画模块 manifest 与模板记录不一致");
  const references = staticAnimationMediaReferences(source, template.moduleId);
  const mediaNames = packageMediaArchiveNames(template, references);
  for (const name of mediaNames) {
    await assertNoSymlinkParents(
      root,
      `public/saved-animations/${template.moduleId}/${name}`,
      `动画媒体 ${name}`,
    );
    await assertRegularArtifact(path.join(root, "public", "saved-animations", template.moduleId, name), `动画媒体 ${name}`);
  }
  for (const reference of references) {
    const name = reference.slice(`saved-animations/${template.moduleId}/`.length);
    if (!mediaNames.has(name)) fail("PACKAGE_FAILED", `源码素材引用没有对应文件：${reference}`);
  }
}

function assertPackageFileSet(
  template: AnimationTemplate,
  files: readonly AnimationPackageFile[],
  expected: readonly AnimationPackageSourceFile[],
): void {
  if (files.length !== expected.length)
    fail("PACKAGE_FAILED", "动画包文件清单不完整");
  const actualByPath = new Map(files.map((file) => [file.path, file]));
  for (const source of expected) {
    if (!actualByPath.has(source.path))
      fail("PACKAGE_FAILED", `动画包缺少文件：${source.path}`);
  }
  if (files.some((file) => !expected.some((source) => source.path === file.path)))
    fail("PACKAGE_FAILED", "动画包包含未知额外文件");
  if (template.moduleId !== `saved-${template.id}`)
    fail("PACKAGE_FAILED", "模板编号与模块编号不一致");
}

function sourceCueIds(scene: Scene): string[] {
  return scene.beats.map((beat) => beat.wordId);
}

function assertSourceStillMatches(
  before: SceneModuleDetail,
  after: SceneModuleDetail,
  expectedSourceHash?: string,
): void {
  if (expectedSourceHash !== undefined && before.sourceHash !== expectedSourceHash)
    fail(
      "STALE_SOURCE",
      `Animation source changed before save (expected ${expectedSourceHash}, found ${before.sourceHash})`,
    );
  if (before.sourceHash !== after.sourceHash)
    fail(
      "STALE_SOURCE",
      `Animation source changed during save (before ${before.sourceHash}, after ${after.sourceHash})`,
    );
}

function sourceTemplateRecord(
  input: SaveAnimationTemplateInput,
  moduleId: string,
  detail: SceneModuleDetail,
  parameters: Readonly<Record<string, SceneModuleParameterValue>>,
): AnimationTemplate {
  const scene = input.scene;
  const locks = assertLocks(scene.editor?.locks, "Scene editor locks");
  assertEditorKeys(
    scene.editor?.overrides ?? {},
    locks,
    detail.controls,
    "Scene editor",
  );
  return {
    id: moduleId.slice("saved-".length),
    name: assertTemplateName(input.name),
    moduleId,
    createdAt: new Date().toISOString(),
    sourceModuleId: detail.id,
    sourceSceneId: scene.id,
    sourceHash: detail.sourceHash,
    parameters: clone(parameters),
    locks,
    cues: sourceCueLabels(scene),
    controls: clone(detail.controls),
    objects: clone(detail.objects ?? []),
    acceptsMaterials: detail.acceptsMaterials,
  };
}

function findTemplate(
  templates: readonly AnimationTemplate[],
  id: string,
): AnimationTemplate {
  if (typeof id !== "string" || id.trim() === "")
    fail("INVALID_INPUT", "Animation template id must be non-empty text");
  const template = templates.find((candidate) => candidate.id === id);
  if (!template) fail("NOT_FOUND", `Animation template not found: ${id}`);
  return template;
}

export function createAnimationTemplates(
  root: string,
  directory: string,
  options: AnimationContentOptions = {},
): AnimationTemplates {
  const resolvedRoot = path.resolve(root);
  const resolvedDirectory = path.resolve(directory);
  const sceneModules = createSceneModules(resolvedRoot);

  async function list(): Promise<AnimationTemplate[]> {
    const metadata = await readTemplateFile(resolvedDirectory);
    return metadata.templates.map((template) => clone(template));
  }

  async function save(
    input: SaveAnimationTemplateInput,
  ): Promise<AnimationTemplate> {
    assertRecord(input, "save input");
    const name = assertTemplateName(input.name);
    assertScene(input.scene, { requireProgram: true, rejectComponents: false });
    const program = assertProgram(input.scene);
    const sourceBefore = await sceneModules.detail(program.moduleId);
    const sourceTemplate = (await list()).find((candidate) => candidate.moduleId === program.moduleId);
    if (sourceTemplate?.contents?.materials.length && sourceTemplate.contents.materialSlotsVersion !== 1)
      fail(
        "INVALID_INPUT",
        "旧动画的补充素材仍是固定快照，请先由 Codex 升级源动画后再保存",
      );
    if (
      input.expectedSourceHash !== undefined &&
      (typeof input.expectedSourceHash !== "string" ||
        input.expectedSourceHash !== sourceBefore.sourceHash)
    )
      fail(
        "STALE_SOURCE",
        `Animation source hash is stale (expected ${String(input.expectedSourceHash)}, found ${sourceBefore.sourceHash})`,
      );
    const mergedParameters = {
      ...program.parameters,
      ...(input.scene.editor?.overrides ?? {}),
    };
    const resolved = await sceneModules.validate({
      moduleId: program.moduleId,
      parameters: mergedParameters,
    });
    if (resolved.sourceHash !== sourceBefore.sourceHash)
      fail(
        "STALE_SOURCE",
        `Animation source changed while resolving parameters (before ${sourceBefore.sourceHash}, after ${resolved.sourceHash})`,
      );
    const moduleId = `saved-${randomUUID()}`;
    const sourcePath = path.join(
      resolvedRoot,
      "workbench-local",
      "scenes",
      `${moduleId}.jsx`,
    );
    const manifestPath = path.join(
      resolvedRoot,
      "workbench-local",
      "scenes",
      `${moduleId}.json`,
    );
    const metadataPath = path.join(resolvedDirectory, TEMPLATE_FILE_NAME);
    const sourceCueWordIds = sourceCueIds(input.scene);
    const cues = animationCues(input.scene,input.wordOrder);
    const sourceTemplateId = SOURCE_MODULE_ID_PATTERN.test(program.moduleId)
      ? program.moduleId.slice("saved-".length)
      : undefined;
    const captureOptions: AnimationContentOptions = {
      ...options,
      moduleId: program.moduleId,
      ...(sourceTemplateId === undefined ? {} : {templateId: sourceTemplateId}),
    };
    const captured = await captureAnimationContents(input.scene,input.requests||[],cues,captureOptions);
    if(captured.contents.materials.length && !sourceBefore.acceptsMaterials) fail('INVALID_INPUT','当前动画尚未实现补充素材位置');
    // Bundle before touching the scenes directory. esbuild only parses and
    // transforms source; it never imports or executes the source module.
    const bundledSource = await bundleWrapper(
      sourceBefore,
      input.scene.id,
      sourceCueWordIds,
      resolvedRoot,
      moduleId,
      sourceCueWordIds.map(id=>cues.findIndex(c=>c.wordId===id)),
      captured.contents,
    );
    for(const [name,bytes] of captured.files)bundledSource.assets.set(name,bytes);
    const sourceAfter = await sceneModules.detail(program.moduleId);
    assertSourceStillMatches(sourceBefore, sourceAfter, input.expectedSourceHash);
    const template: AnimationTemplate = {...sourceTemplateRecord(
      { ...input, name },
      moduleId,
      sourceBefore,
      resolved.resolvedParameters,
    ), cues:cues.map(c=>({label:c.label})),contents:captured.contents};
    const manifest = templateModuleManifest(template);
    let createdSource = false;
    let createdManifest = false;
    const assetDirectory = path.join(resolvedRoot, 'public', 'saved-animations', moduleId);
    let createdAssets = false;
    try {
      if (bundledSource.assets.size) {
        await mkdir(path.dirname(assetDirectory), {recursive: true});
        await mkdir(assetDirectory);
        createdAssets = true;
        for (const [name, source] of bundledSource.assets) {
          const destination=path.join(assetDirectory,name);
          await copyFile(source,destination,constants.COPYFILE_EXCL);await chmod(destination,0o600);
          if(await fileDigest(destination)!==name.split('.')[0])throw Error('复制期间动画素材发生变化，请重试保存');
        }
      }
      await mkdir(path.dirname(sourcePath), { recursive: true });
      await writeFile(sourcePath, bundledSource.source, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      createdSource = true;
      // The manifest itself is atomically replaced only after the captured
      // source exists. The temporary path is unique, then moved into place.
      const manifestTemporary = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
      let manifestRenamed = false;
      try {
        await writeFile(manifestTemporary, `${JSON.stringify(manifest, null, 2)}\n`, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        });
        await rename(manifestTemporary, manifestPath);
        manifestRenamed = true;
        createdManifest = true;
      } finally {
        if (!manifestRenamed) await unlink(manifestTemporary).catch(() => undefined);
      }
      await runSerialized(resolvedDirectory, async () => {
        const current = await readTemplateFile(resolvedDirectory);
        if (current.templates.some((candidate) => candidate.id === template.id))
          fail("STORAGE_FAILED", `Animation template id is duplicated: ${template.id}`);
        const next: TemplateFile = {
          schemaVersion: TEMPLATE_SCHEMA_VERSION,
          templates: [...current.templates, template],
        };
        await writeAtomic(
          metadataPath,
          `${JSON.stringify(next, null, 2)}\n`,
        );
      });
      return clone(template);
    } catch (error) {
      if (createdManifest) await unlink(manifestPath).catch(() => undefined);
      if (createdSource) await unlink(sourcePath).catch(() => undefined);
      if (createdAssets) await rm(assetDirectory, {recursive: true, force: true});
      if (error instanceof AnimationTemplateError) throw error;
      if (isNodeError(error, "EEXIST"))
        fail("STORAGE_FAILED", `Animation template artifact already exists: ${moduleId}`);
      const message = error instanceof Error ? error.message : String(error);
      fail("STORAGE_FAILED", `Cannot persist animation template: ${message}`);
    }
  }

  async function instantiate(
    input: InstantiateAnimationTemplateInput,
  ): Promise<Scene> {
    assertRecord(input, "instantiate input");
    if (!input.target || typeof input.target !== "object")
      fail("INVALID_INPUT", "instantiate target must be a scene");
    assertScene(input.target, { requireProgram: false, rejectComponents: false });
    const templates = await list();
    const template = findTemplate(templates, input.id);
    if (!Array.isArray(input.bindings))
      fail("INVALID_INPUT", "Animation template bindings must be an array");
    if (input.bindings.length !== template.cues.length)
      fail(
        "INVALID_INPUT",
        `Animation template requires exactly ${template.cues.length} bindings; received ${input.bindings.length}`,
      );
    const seen = new Set<string>();
    for (const [index, binding] of input.bindings.entries()) {
      if (typeof binding !== "string" || binding.trim() === "")
        fail("INVALID_INPUT", `Animation template binding ${index} must be non-empty text`);
      if (seen.has(binding))
        fail("INVALID_INPUT", `Animation template binding is duplicated: ${binding}`);
      seen.add(binding);
    }
    const editor = assertTargetEditor(input.target);
    assertEditorKeys(
      editor.overrides,
      editor.locks,
      template.controls,
      "Target editor",
    );
    const resolved = await sceneModules.validate({
      moduleId: template.moduleId,
      parameters: { ...template.parameters, ...editor.overrides },
    });
    const beats = template.cues.map((cue, index) => ({
      wordId: input.bindings[index],
      label: cue.label,
    }));
    const target = clone(input.target);
    const components = template.contents ? instantiateAnimationComponents(template.id,template.contents,target,input.bindings) : target.components;
    if(template.contents)await installAnimationAssets(resolvedRoot,template.moduleId,template.contents,options);
    const { design: _discardedDesign, program: _discardedProgram, beats: _discardedBeats, ...preserved } = target;
    void _discardedDesign;
    void _discardedProgram;
    void _discardedBeats;
    return {
      ...preserved,
      ...(components===undefined?{}:{components}),
      beats,
      program: {
        moduleId: template.moduleId,
        parameters: resolved.resolvedParameters,
      },
    };
  }

  async function instantiateMaterials(
    id:string,
    target:Scene,
    requests:readonly MaterialRequest[],
    installDefaults=true,
  ):Promise<MaterialRequest[]> {
    if(!target || typeof target!=='object') fail('INVALID_INPUT','instantiate target must be a scene');
    assertScene(target,{requireProgram:false,rejectComponents:false});
    const template=findTemplate(await list(),id);
    const contents=template.contents ?? {
      components:[],
      componentAssets:[],
      materials:[],
      materialSlotsVersion:1 as const,
    };
    try {
      return await instantiateAnimationMaterials(
        resolvedRoot,
        template.moduleId,
        template.id,
        contents,
        target,
        requests,
        {...options,installMaterialDefaults:installDefaults},
      );
    } catch(error) {
      if(error instanceof AnimationTemplateError) throw error;
      const message=error instanceof Error ? error.message : String(error);
      fail('INVALID_INPUT',`无法应用动画补充素材：${message}`);
    }
  }

  async function exportPackage(
    id: string,
    outputFile: string,
  ): Promise<ExportAnimationPackageResult> {
    const templates = await list();
    const template = templates.find(
      (candidate) => candidate.id === id || candidate.moduleId === id,
    );
    if (!template) fail("NOT_FOUND", `Animation template not found: ${id}`);
    await validateTemplateArtifacts(resolvedRoot, template);
    const files = await packageFileSources(resolvedRoot, template);
    try {
      return await exportAnimationPackage({
        templateId: template.id,
        template,
        files,
        outputFile,
      });
    } catch (error) {
      if (error instanceof AnimationTemplateError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      fail("PACKAGE_FAILED", `Cannot export animation package: ${message}`);
    }
  }

  async function artifactMatches(
    destination: string,
    expected: AnimationPackageFile,
  ): Promise<{readonly exists: boolean; readonly matches: boolean}> {
    let info: any;
    try {
      info = await lstat(destination, {bigint: true});
    } catch (error) {
      if (isNodeError(error, "ENOENT")) return {exists: false, matches: false};
      throw error;
    }
    if (!info.isFile() || info.isSymbolicLink())
      return {exists: true, matches: false};
    if (info.size !== BigInt(expected.size)) return {exists: true, matches: false};
    return {
      exists: true,
      matches: (await fileDigest(destination)) === expected.sha256,
    };
  }

  async function importPackage(
    packageFile: string,
  ): Promise<{readonly template: AnimationTemplate; readonly alreadyPresent: boolean}> {
    let imported: Awaited<ReturnType<typeof readAnimationPackage>>;
    try {
      imported = await readAnimationPackage(packageFile);
    } catch (error) {
      if (error instanceof AnimationTemplateError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      fail("PACKAGE_FAILED", message);
    }
    try {
      let template: AnimationTemplate;
      try {
        template = assertTemplateShape(imported.manifest.template, 0);
      } catch (error) {
        if (error instanceof AnimationTemplateError)
          fail("PACKAGE_FAILED", error.message);
        throw error;
      }
      if (imported.manifest.templateId !== template.id)
        fail("PACKAGE_FAILED", "动画包 templateId 与模板记录不一致");
      if (template.moduleId !== `saved-${template.id}`)
        fail("PACKAGE_FAILED", "模板编号与模块编号不一致");
      const expectedFiles = await packageFileSources(imported.stagingDirectory, template);
      assertPackageFileSet(template, imported.manifest.files, expectedFiles);
      await validateTemplateArtifacts(imported.stagingDirectory, template);
      const expectedByPath = new Map(expectedFiles.map((file) => [file.path, file]));
      const metadataPath = path.join(resolvedDirectory, TEMPLATE_FILE_NAME);
      await assertNoSymlinkParents(resolvedDirectory, TEMPLATE_FILE_NAME, "动画模板记录路径");
      try {
        const metadataInfo = await lstat(metadataPath, { bigint: true });
        if (metadataInfo.isSymbolicLink())
          fail("PACKAGE_FAILED", "动画模板记录不能是符号链接");
      } catch (error) {
        if (error instanceof AnimationTemplateError) throw error;
        if (!isNodeError(error, "ENOENT"))
          fail("PACKAGE_FAILED", "动画模板记录不可检查");
      }
      return await runSerialized(resolvedDirectory, async () => {
        const current = await readTemplateFile(resolvedDirectory);
        const existing = current.templates.find(
          (candidate) => candidate.id === template.id || candidate.moduleId === template.moduleId,
        );
        if (existing) {
          if (!packageJsonEqual(existing, template))
            fail("PACKAGE_CONFLICT", `模板编号已存在但内容不同：${template.id}`);
          for (const file of imported.manifest.files) {
            const expected = expectedByPath.get(file.path);
            if (!expected) fail("PACKAGE_FAILED", `动画包包含未知文件：${file.path}`);
            await assertNoSymlinkParents(resolvedRoot, expected.path, `动画包目标 ${expected.path}`);
            const destination = path.join(resolvedRoot, ...expected.path.split("/"));
            const status = await artifactMatches(destination, file);
            if (!status.exists || !status.matches)
              fail("PACKAGE_CONFLICT", `已有模板文件缺失或内容不同：${file.path}`);
          }
          await validateTemplateArtifacts(resolvedRoot, template);
          return {template: clone(existing), alreadyPresent: true};
        }
        const created: string[] = [];
        try {
          for (const file of imported.manifest.files) {
            const expected = expectedByPath.get(file.path);
            if (!expected) fail("PACKAGE_FAILED", `动画包包含未知文件：${file.path}`);
            await assertNoSymlinkParents(resolvedRoot, expected.path, `动画包目标 ${expected.path}`);
            const destination = path.join(resolvedRoot, ...expected.path.split("/"));
            const status = await artifactMatches(destination, file);
            if (status.exists && !status.matches)
              fail("PACKAGE_CONFLICT", `已有文件内容不同，拒绝覆盖：${file.path}`);
            if (status.exists) continue;
            const staged = path.join(imported.stagingDirectory, ...expected.path.split("/"));
            await publishAnimationPackageFile(staged, destination);
            created.push(destination);
          }
          const next: TemplateFile = {
            schemaVersion: TEMPLATE_SCHEMA_VERSION,
            templates: [...current.templates, template],
          };
          await writeAtomic(metadataPath, `${JSON.stringify(next, null, 2)}\n`);
          return {template: clone(template), alreadyPresent: false};
        } catch (error) {
          await Promise.all(created.map((file) => unlink(file).catch(() => undefined)));
          throw error;
        }
      });
    } catch (error) {
      if (error instanceof AnimationTemplateError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      fail("PACKAGE_FAILED", `Cannot import animation package: ${message}`);
    } finally {
      await removeImportedAnimationPackage(imported.stagingDirectory);
    }
  }

  return { list, save, instantiate, instantiateMaterials, exportPackage, importPackage };
}
