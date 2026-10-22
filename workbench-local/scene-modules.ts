import {localSourceDependencies} from "./source-dependencies";
import {createReadStream} from 'node:fs';
import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {visualControlSchema} from "./visual-library-contract";
import {validateCreativeDependencies,resolveCreativeDependencies,assertNativeCreativeImports} from './creative-runtime-dependencies';
import type {CreativeDependencies} from './creative-runtime-dependency-contract';

/**
 * A scene module is authored as a normal TSX/JSX file, but its manifest is
 * inspected as data.  This service never imports or evaluates the module
 * source while listing, inspecting, or validating a module.
 */

export const SCENE_MODULE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,127})$/u;
const SCENE_MODULE_ENTRY_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9._-]*)(?:\.tsx|\.jsx)$/u;
const SCENE_MODULE_EXPORT_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

export type SceneModuleControlType = "text" | "number" | "color" | "boolean" | "select" | "list";

export interface SceneModuleControlBase {
  readonly key: string;
  readonly label: string;
  readonly type: SceneModuleControlType;
  readonly required?: boolean;
}

export interface SceneModuleTextControl extends SceneModuleControlBase {
  readonly type: "text";
  readonly default?: string;
}

export interface SceneModuleNumberControl extends SceneModuleControlBase {
  readonly type: "number";
  readonly default?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface SceneModuleColorControl extends SceneModuleControlBase {
  readonly type: "color";
  readonly default?: string;
}

export interface SceneModuleBooleanControl extends SceneModuleControlBase {
  readonly type: "boolean";
  readonly default?: boolean;
}

export interface SceneModuleSelectControl extends SceneModuleControlBase {
  readonly type: "select";
  readonly options: readonly string[];
  readonly default?: string;
}

export interface SceneModuleListControl extends SceneModuleControlBase {
  readonly type: "list";
  readonly itemType: "text" | "number";
  readonly default?: (string | number)[];
  readonly minItems?: number;
  readonly maxItems?: number;
}

export type SceneModuleControl =
  | SceneModuleTextControl
  | SceneModuleNumberControl
  | SceneModuleColorControl
  | SceneModuleBooleanControl
  | SceneModuleSelectControl
  | SceneModuleListControl;

export interface SceneModuleManifest {
  readonly dependencies?: CreativeDependencies;
  readonly styleBindings?: Readonly<Record<string,string>>;
  readonly id: string;
  readonly label: string;
  readonly entry: string;
  readonly exportName: string;
  readonly controls: readonly SceneModuleControl[];
  readonly objects?: readonly {
    id: string;
    label: string;
    parameters: string[];
    canvas?: {transform?: boolean; text?: string};
  }[];
  /** Modules without this field do not consume production material requests. */
  readonly acceptsMaterials?: boolean;
}

export interface SceneModuleDetail extends SceneModuleManifest {
  readonly acceptsMaterials: boolean;
  readonly modulePath: string;
  readonly moduleUrl: string;
  readonly sourceHash: string;
  readonly visualAsset?: {
    id:string;version:string;mount?:'OBJECT'|'SCENE'|'TRANSITION';
    cues:readonly {id:string;label:string;required:boolean}[];
    mediaSlots:readonly {id:string;label:string;kind:'image'|'video'|'either';required:boolean}[];
    constraints:{minFrames:number;maxFrames:number;notes:string};
  };
}

export type SceneModuleParameterValue = string | number | boolean | (string | number)[];
export type SceneModuleParameterMap = Readonly<Record<string, unknown>>;

export interface SceneModuleValidationInput {
  readonly moduleId: string;
  readonly parameters?: SceneModuleParameterMap;
}

export interface SceneModuleValidationResult extends SceneModuleDetail {
  readonly resolvedParameters: Readonly<
    Record<string, SceneModuleParameterValue>
  >;
}

export type SceneModuleErrorCode =
  "NOT_FOUND" | "INVALID_MANIFEST" | "BROKEN_MODULE" | "INVALID_PARAMETERS";

export class SceneModuleError extends Error {
  public readonly code: SceneModuleErrorCode;

  public constructor(code: SceneModuleErrorCode, message: string) {
    super(message);
    this.name = "SceneModuleError";
    this.code = code;
  }
}

export interface SceneModules {
  list(): Promise<SceneModuleDetail[]>;
  detail(id: string): Promise<SceneModuleDetail>;
  validate(
    input: SceneModuleValidationInput,
  ): Promise<SceneModuleValidationResult>;
}

interface SceneDirectory {
  readonly logicalPath: string;
  readonly realPath: string;
}

interface ReadManifestResult {
  readonly manifest: SceneModuleManifest & { acceptsMaterials: boolean };
  readonly manifestBytes: Buffer;
  readonly scenesDirectory: SceneDirectory;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SCENE_MODULE_ID_PATTERN.test(value);
}

function isSafeParameterKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    value !== "__proto__" &&
    value !== "prototype" &&
    value !== "constructor"
  );
}

function isPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function notFound(id: unknown): SceneModuleError {
  return new SceneModuleError(
    "NOT_FOUND",
    `未知场景模块 (unknown scene module): ${String(id ?? "")}`,
  );
}

function invalidManifest(id: string, message: string): SceneModuleError {
  return new SceneModuleError(
    "INVALID_MANIFEST",
    `场景模块清单无效 (invalid manifest) [${id}]: ${message}`,
  );
}

function brokenModule(id: string, message: string): SceneModuleError {
  return new SceneModuleError(
    "BROKEN_MODULE",
    `场景模块损坏 (broken scene module) [${id}]: ${message}`,
  );
}

function invalidParameters(message: string): SceneModuleError {
  return new SceneModuleError(
    "INVALID_PARAMETERS",
    `动画参数无效 (invalid parameters): ${message}`,
  );
}

function isMissingPathError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

async function resolveScenesDirectory(
  root: string,
): Promise<SceneDirectory | null> {
  const logicalPath = path.resolve(root, "workbench-local", "scenes");
  let directoryInfo;
  try {
    directoryInfo = await stat(logicalPath);
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw new SceneModuleError(
      "BROKEN_MODULE",
      `无法读取场景模块目录 (cannot read scene module directory): ${logicalPath}`,
    );
  }
  if (!directoryInfo.isDirectory()) {
    throw new SceneModuleError(
      "BROKEN_MODULE",
      `场景模块目录不是文件夹 (scene module directory is not a directory): ${logicalPath}`,
    );
  }
  let realPath: string;
  try {
    realPath = await realpath(logicalPath);
  } catch {
    throw new SceneModuleError(
      "BROKEN_MODULE",
      `无法解析场景模块目录 (cannot resolve scene module directory): ${logicalPath}`,
    );
  }
  return { logicalPath, realPath };
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unexpected)
    throw new Error(`${context} contains unknown field ${unexpected}`);
}

function validateControlDefault(
  control: SceneModuleControl,
  value: unknown,
  context: string,
): void {
  if (control.type === "select" || control.type === "list") {
    checkParameterValue(control, value, control.key);
    return;
  }
  if (control.type === "text") {
    if (typeof value !== "string")
      throw new Error(`${context}.default must be text`);
    if (control.required && value.trim() === "") {
      throw new Error(
        `${context}.default must not be blank for a required text control`,
      );
    }
    return;
  }
  if (control.type === "color") {
    if (typeof value !== "string" || !COLOR_PATTERN.test(value)) {
      throw new Error(`${context}.default must be a six-digit hex color`);
    }
    return;
  }
  if (control.type === "boolean") {
    if (typeof value !== "boolean")
      throw new Error(`${context}.default must be boolean`);
    return;
  }
  if (!isFiniteNumber(value))
    throw new Error(`${context}.default must be a finite number`);
  if (control.min !== undefined && value < control.min) {
    throw new Error(`${context}.default is below min`);
  }
  if (control.max !== undefined && value > control.max) {
    throw new Error(`${context}.default is above max`);
  }
}

export function parseSceneModuleControl(
  value: unknown,
  id: string,
  index: number,
): SceneModuleControl {
  const context = `controls[${index}]`;
  if (!isRecord(value))
    throw invalidManifest(id, `${context} must be an object`);
  if (value.type === "select" || value.type === "list") {
    const parsed = visualControlSchema.safeParse(value);
    if (!parsed.success)
      throw invalidManifest(id, `${context}: ${parsed.error.issues.map(issue => issue.message).join("; ")}`);
    const control = parsed.data as SceneModuleSelectControl | SceneModuleListControl;
    if (control.type === "list" && (control.minItems ?? 0) > (control.maxItems ?? 40))
      throw invalidManifest(id, `${context}.minItems cannot exceed maxItems`);
    if (hasOwn(control, "default")) {
      try { checkParameterValue(control, control.default, control.key); }
      catch (error) { throw invalidManifest(id, `${context}.default: ${error instanceof Error ? error.message : "invalid"}`); }
    }
    return control;
  }
  try {
    assertExactKeys(
      value,
      ["key", "label", "type", "required", "default", "min", "max", "step"],
      context,
    );
  } catch (error) {
    throw invalidManifest(
      id,
      error instanceof Error ? error.message : `${context} is invalid`,
    );
  }
  if (!isSafeParameterKey(value.key)) {
    throw invalidManifest(id, `${context}.key must be a safe parameter key`);
  }
  if (typeof value.label !== "string" || value.label.trim() === "") {
    throw invalidManifest(id, `${context}.label must be non-empty text`);
  }
  if (
    value.type !== "text" &&
    value.type !== "number" &&
    value.type !== "color" &&
    value.type !== "boolean"
  ) {
    throw invalidManifest(id, `${context}.type is unsupported`);
  }
  if (hasOwn(value, "required") && typeof value.required !== "boolean") {
    throw invalidManifest(id, `${context}.required must be boolean`);
  }
  const required = value.required as boolean | undefined;
  const base = {
    key: value.key,
    label: value.label,
    type: value.type,
    ...(hasOwn(value, "required") ? { required } : {}),
  } as const;
  if (
    value.type !== "number" &&
    (hasOwn(value, "min") || hasOwn(value, "max") || hasOwn(value, "step"))
  ) {
    throw invalidManifest(
      id,
      `${context}.min/max are only valid for number controls`,
    );
  }
  if (value.type === "number") {
    if (hasOwn(value, "step") && (!isFiniteNumber(value.step) || value.step <= 0))
      throw invalidManifest(id, `${context}.step must be positive and finite`);
    if (hasOwn(value, "min") && !isFiniteNumber(value.min)) {
      throw invalidManifest(id, `${context}.min must be finite`);
    }
    if (hasOwn(value, "max") && !isFiniteNumber(value.max)) {
      throw invalidManifest(id, `${context}.max must be finite`);
    }
    const min = value.min as number | undefined;
    const max = value.max as number | undefined;
    if (min !== undefined && max !== undefined && min > max) {
      throw invalidManifest(id, `${context}.min cannot exceed max`);
    }
    const control: SceneModuleNumberControl = {
      ...base,
      type: "number",
      ...(hasOwn(value, "default") ? { default: value.default as number } : {}),
      ...(hasOwn(value, "min") ? { min } : {}),
      ...(hasOwn(value, "max") ? { max } : {}),
      ...(hasOwn(value, "step") ? { step: value.step as number } : {}),
    };
    if (hasOwn(value, "default")) {
      try {
        validateControlDefault(control, value.default, context);
      } catch (error) {
        throw invalidManifest(
          id,
          error instanceof Error
            ? error.message
            : `${context}.default is invalid`,
        );
      }
    }
    return control;
  }
  const control = {
    ...base,
    type: value.type,
    ...(hasOwn(value, "default") ? { default: value.default } : {}),
  } as SceneModuleControl;
  if (hasOwn(value, "default")) {
    try {
      validateControlDefault(control, value.default, context);
    } catch (error) {
      throw invalidManifest(
        id,
        error instanceof Error
          ? error.message
          : `${context}.default is invalid`,
      );
    }
  }
  return control;
}

function parseManifest(
  value: unknown,
  expectedId: string,
): SceneModuleManifest & { acceptsMaterials: boolean } {
  if (!isRecord(value))
    throw invalidManifest(expectedId, "manifest must be an object");
  try {
    assertExactKeys(
      value,
      [
        "id",
        "label",
        "entry",
        "exportName",
        "controls",
        "acceptsMaterials",
        "objects",
        "dependencies",
        "styleBindings",
      ],
      "manifest",
    );
  } catch (error) {
    throw invalidManifest(
      expectedId,
      error instanceof Error ? error.message : "manifest has unknown fields",
    );
  }
  if (!isSafeId(value.id) || value.id !== expectedId) {
    throw invalidManifest(
      expectedId,
      `id must equal the safe lowercase filename id ${expectedId}`,
    );
  }
  if (typeof value.label !== "string" || value.label.trim() === "") {
    throw invalidManifest(expectedId, "label must be non-empty text");
  }
  if (
    typeof value.entry !== "string" ||
    value.entry.includes("/") ||
    value.entry.includes("\\") ||
    path.basename(value.entry) !== value.entry ||
    !SCENE_MODULE_ENTRY_PATTERN.test(value.entry)
  ) {
    throw invalidManifest(
      expectedId,
      "entry must be one safe .tsx/.jsx filename in the scenes folder",
    );
  }
  if (
    typeof value.exportName !== "string" ||
    !SCENE_MODULE_EXPORT_PATTERN.test(value.exportName)
  ) {
    throw invalidManifest(
      expectedId,
      "exportName must be a safe JavaScript export name",
    );
  }
  if (!Array.isArray(value.controls)) {
    throw invalidManifest(expectedId, "controls must be an array");
  }
  const controls: SceneModuleControl[] = [];
  const keys = new Set<string>();
  for (const [index, controlValue] of value.controls.entries()) {
    const control = parseSceneModuleControl(controlValue, expectedId, index);
    if (keys.has(control.key))
      throw invalidManifest(expectedId, `duplicate control key ${control.key}`);
    keys.add(control.key);
    controls.push(control);
  }
  if (
    hasOwn(value, "acceptsMaterials") &&
    typeof value.acceptsMaterials !== "boolean"
  ) {
    throw invalidManifest(expectedId, "acceptsMaterials must be boolean");
  }
  const objects: NonNullable<SceneModuleManifest['objects']>[number][] = [];
  if (value.objects !== undefined) {
    if (!Array.isArray(value.objects) || value.objects.length > 100)
      throw invalidManifest(
        expectedId,
        "objects must be an array of at most 100 objects",
      );
    const ids = new Set<string>();
    for (const o of value.objects) {
      if (
        !isRecord(o) ||
        !isSafeId(o.id) ||
        typeof o.label !== "string" ||
        !o.label.trim() ||
        !Array.isArray(o.parameters) ||
        o.parameters.some((k) => typeof k !== "string" || !keys.has(k)) ||
        new Set(o.parameters).size !== o.parameters.length ||
        ids.has(o.id)
      )
        throw invalidManifest(
          expectedId,
          "invalid editable object or unknown parameter",
        );
      assertExactKeys(o, ["id", "label", "parameters", "canvas"], "object");
      let canvas: {transform?: boolean; text?: string} | undefined;
      if (o.canvas !== undefined) {
        if (!isRecord(o.canvas)) throw invalidManifest(expectedId, 'canvas must describe declared editing capabilities');
        assertExactKeys(o.canvas, ['transform', 'text'], 'object.canvas');
        if (o.canvas.transform !== undefined && typeof o.canvas.transform !== 'boolean')
          throw invalidManifest(expectedId, 'canvas.transform must be boolean');
        const textKey = o.canvas.text;
        if (textKey !== undefined && (typeof textKey !== 'string' || !o.parameters.includes(textKey) ||
          !controls.some(c => c.key === textKey && c.type === 'text')))
          throw invalidManifest(expectedId, 'canvas.text must refer to a text control of this object');
        canvas = o.canvas as {transform?: boolean; text?: string};
      }
      ids.add(o.id);
      objects.push({
        id: o.id,
        label: o.label,
        parameters: o.parameters as string[],
        ...(canvas ? {canvas} : {}),
      });
    }
  }
  const acceptsMaterials =
    value.acceptsMaterials === undefined
      ? false
      : (value.acceptsMaterials as boolean);
  let dependencies:CreativeDependencies|undefined;
  if(value.dependencies!==undefined) {
    try{dependencies=validateCreativeDependencies(value.dependencies);}
    catch(error){throw invalidManifest(expectedId,(error as Error).message);}
  }
  let styleBindings:Record<string,string>|undefined;
  if(value.styleBindings!==undefined) {
    if(!isRecord(value.styleBindings)||Object.entries(value.styleBindings).some(([key,token])=>!keys.has(key)||!isSafeParameterKey(token)||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(token)))
      throw invalidManifest(expectedId,'styleBindings must map declared controls to safe token keys');
    styleBindings={...value.styleBindings} as Record<string,string>;
  }
  return {
    id: value.id,
    label: value.label,
    entry: value.entry,
    exportName: value.exportName,
    controls,
    objects,
    acceptsMaterials,
    ...(dependencies===undefined?{}:{dependencies}),
    ...(styleBindings===undefined?{}:{styleBindings}),
  };
}

async function readManifest(
  root: string,
  id: string,
): Promise<ReadManifestResult> {
  if (!isSafeId(id)) throw notFound(id);
  const scenesDirectory = await resolveScenesDirectory(root);
  if (!scenesDirectory) throw notFound(id);
  const manifestPath = path.resolve(scenesDirectory.logicalPath, `${id}.json`);
  if (!isPathWithin(scenesDirectory.logicalPath, manifestPath))
    throw notFound(id);

  let manifestRealPath: string;
  try {
    manifestRealPath = await realpath(manifestPath);
  } catch (error) {
    if (isMissingPathError(error)) throw notFound(id);
    throw brokenModule(
      id,
      `无法解析清单路径 (cannot resolve manifest): ${manifestPath}`,
    );
  }
  if (!isPathWithin(scenesDirectory.realPath, manifestRealPath)) {
    throw brokenModule(
      id,
      "清单符号链接逃出 scenes 目录 (manifest symlink escapes scenes directory)",
    );
  }
  let manifestInfo;
  try {
    manifestInfo = await stat(manifestPath);
  } catch (error) {
    if (isMissingPathError(error)) throw notFound(id);
    throw brokenModule(
      id,
      `无法读取清单 (cannot stat manifest): ${manifestPath}`,
    );
  }
  if (!manifestInfo.isFile())
    throw brokenModule(id, "清单路径不是文件 (manifest is not a file)");
  let manifestBytes: Buffer;
  try {
    manifestBytes = await readFile(manifestPath);
  } catch {
    throw brokenModule(
      id,
      `无法读取清单 (cannot read manifest): ${manifestPath}`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(manifestBytes.toString("utf8")) as unknown;
  } catch (error) {
    throw invalidManifest(
      id,
      `JSON 无法解析 (invalid JSON): ${error instanceof Error ? error.message : "parse failed"}`,
    );
  }
  const manifest = parseManifest(value, id);
  return { manifest, manifestBytes, scenesDirectory };
}

async function readSource(
  id: string,
  manifest: SceneModuleManifest,
  scenesDirectory: SceneDirectory,
): Promise<{ modulePath: string; sourceBytes: Buffer }> {
  const modulePath = path.resolve(scenesDirectory.logicalPath, manifest.entry);
  if (
    path.dirname(modulePath) !== scenesDirectory.logicalPath ||
    !isPathWithin(scenesDirectory.logicalPath, modulePath)
  ) {
    throw brokenModule(
      id,
      "entry must remain directly inside the scenes directory",
    );
  }
  let moduleRealPath: string;
  try {
    moduleRealPath = await realpath(modulePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw brokenModule(id, `entry file is missing: ${manifest.entry}`);
    }
    throw brokenModule(
      id,
      `无法解析 entry (cannot resolve entry): ${manifest.entry}`,
    );
  }
  if (!isPathWithin(scenesDirectory.realPath, moduleRealPath)) {
    throw brokenModule(
      id,
      "entry 符号链接逃出 scenes 目录 (entry symlink escapes scenes directory)",
    );
  }
  let sourceInfo;
  try {
    sourceInfo = await stat(modulePath);
  } catch (error) {
    if (isMissingPathError(error))
      throw brokenModule(id, `entry file is missing: ${manifest.entry}`);
    throw brokenModule(
      id,
      `无法读取 entry (cannot stat entry): ${manifest.entry}`,
    );
  }
  if (!sourceInfo.isFile())
    throw brokenModule(id, `entry is not a file: ${manifest.entry}`);
  try {
    return { modulePath, sourceBytes: await readFile(modulePath) };
  } catch {
    throw brokenModule(
      id,
      `无法读取 entry (cannot read entry): ${manifest.entry}`,
    );
  }
}

function checkParameterValue(
  control: SceneModuleControl,
  value: unknown,
  key: string,
): SceneModuleParameterValue {
  if (control.type === "select") {
    if (typeof value !== "string" || !control.options.includes(value))
      throw invalidParameters(`参数 ${key} 选项无效 (invalid select option)`);
    return value;
  }
  if (control.type === "list") {
    if (!Array.isArray(value) || value.length < (control.minItems ?? 0) || value.length > (control.maxItems ?? 40) ||
      value.some(item => control.itemType === "number" ? !isFiniteNumber(item) : typeof item !== "string" || item.length > 4000))
      throw invalidParameters(`参数 ${key} 列表内容或数量无效 (invalid list items or bounds)`);
    return [...value] as (string | number)[];
  }
  if (control.type === "text") {
    if (typeof value !== "string")
      throw invalidParameters(`参数 ${key} 类型必须是 text`);
    if (control.required && value.trim() === "") {
      throw invalidParameters(
        `缺少必填文本参数 (required text is blank): ${key}`,
      );
    }
    return value;
  }
  if (control.type === "color") {
    if (typeof value !== "string" || !COLOR_PATTERN.test(value)) {
      throw invalidParameters(
        `参数 ${key} 必须是六位十六进制颜色 (expected #RRGGBB)`,
      );
    }
    return value;
  }
  if (control.type === "boolean") {
    if (typeof value !== "boolean")
      throw invalidParameters(`参数 ${key} 类型必须是 boolean`);
    return value;
  }
  if (!isFiniteNumber(value))
    throw invalidParameters(`参数 ${key} 必须是有限 number`);
  if (control.min !== undefined && value < control.min) {
    throw invalidParameters(`参数 ${key} 不能小于 ${control.min}`);
  }
  if (control.max !== undefined && value > control.max) {
    throw invalidParameters(`参数 ${key} 不能大于 ${control.max}`);
  }
  return value;
}

export function resolveSceneModuleParameters(
  controls: readonly SceneModuleControl[],
  rawParameters: unknown = {},
): Record<string, SceneModuleParameterValue> {
  if (!isRecord(rawParameters)) throw invalidParameters("parameters must be an object");
  const byKey = new Map(controls.map(control => [control.key, control]));
  if (byKey.size !== controls.length) throw invalidParameters("duplicate control keys");
  for (const key of Object.keys(rawParameters))
    if (!byKey.has(key)) throw invalidParameters(`未知动画参数 (unknown parameter): ${key}`);
  const resolved: Record<string, SceneModuleParameterValue> = {};
  for (const control of controls) {
    const value = hasOwn(rawParameters, control.key) ? rawParameters[control.key] : control.default;
    if (value === undefined && !hasOwn(rawParameters, control.key) && !hasOwn(control, "default")) {
      if (control.required) throw invalidParameters(`缺少必填参数 (missing required parameter): ${control.key}`);
      continue;
    }
    resolved[control.key] = checkParameterValue(control, value, control.key);
  }
  return resolved;
}

export interface ExternalSceneModules {
  list(): Promise<SceneModuleDetail[]>;
  detail(id: string): Promise<SceneModuleDetail | undefined>;
}

export function createSceneModules(root: string, external?: ExternalSceneModules): SceneModules {
  async function detail(id: string): Promise<SceneModuleDetail> {
    if (!isSafeId(id)) throw notFound(id);
    const provided = await external?.detail(id);
    if (provided) return provided;
    const { manifest, manifestBytes, scenesDirectory } = await readManifest(
      root,
      id,
    );
    const { modulePath, sourceBytes } = await readSource(
      id,
      manifest,
      scenesDirectory,
    );
    const sourceDigest = createHash("sha256").update(manifestBytes).update(sourceBytes);
    assertNativeCreativeImports(sourceBytes.toString('utf8'),manifest.dependencies);
    const runtime=await resolveCreativeDependencies(manifest.dependencies,root);
    if(runtime.fingerprint)sourceDigest.update('\0dependencies\0'+runtime.fingerprint);
    for (const dependency of await localSourceDependencies(root, modulePath)) {
      if(/\.[cm]?[jt]sx?$/iu.test(dependency.path))assertNativeCreativeImports(dependency.bytes?dependency.bytes.toString('utf8'):await readFile(dependency.filePath,'utf8'),manifest.dependencies);
      sourceDigest.update("\0" + dependency.path + "\0");
      if(dependency.bytes)sourceDigest.update(dependency.bytes);
      else for await(const chunk of createReadStream(dependency.filePath))sourceDigest.update(chunk);
    }
    const sourceHash = sourceDigest.digest("hex");
    return {
      ...manifest,
      modulePath,
      moduleUrl: `/@fs${modulePath}`,
      sourceHash,
    };
  }

  async function list(): Promise<SceneModuleDetail[]> {
    const provided = await external?.list() ?? [];
    const scenesDirectory = await resolveScenesDirectory(root);
    if (!scenesDirectory) return provided;
    let entries;
    try {
      entries = await readdir(scenesDirectory.logicalPath, {
        withFileTypes: true,
      });
    } catch {
      throw new SceneModuleError(
        "BROKEN_MODULE",
        `无法列出场景模块 (cannot list scene modules): ${scenesDirectory.logicalPath}`,
      );
    }
    const manifestIds = entries
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
      .sort((left, right) => left.localeCompare(right));
    const modules: SceneModuleDetail[] = [...provided];
    const providedIds = new Set(provided.map(module => module.id));
    for (const id of manifestIds) if (!providedIds.has(id)) modules.push(await detail(id));
    return modules;
  }

  async function validate(
    input: SceneModuleValidationInput,
  ): Promise<SceneModuleValidationResult> {
    if (!isRecord(input))
      throw invalidParameters("validate input must be an object");
    const moduleId = input.moduleId;
    const module = await detail(moduleId);
    const rawParameters = hasOwn(input, "parameters")
      ? input.parameters
      : undefined;
    const resolvedParameters = resolveSceneModuleParameters(module.controls, rawParameters === undefined ? {} : rawParameters);
    return { ...module, resolvedParameters };
  }

  return { list, detail, validate };
}
