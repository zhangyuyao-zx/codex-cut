/**
 * Browser-safe execution boundary for SceneModule.
 *
 * This file intentionally has no Node.js or TypeScript compiler dependency. A
 * host compiler turns the small source language into the JSON IR below; this
 * module validates that IR and evaluates it without evaluating JavaScript.
 */

export const SCENE_MODULE_VERSION = 1 as const;
export const MAX_SCENE_MODULE_SOURCE_BYTES = 64 * 1024;
export const MAX_SCENE_MODULE_IR_NODES = 8_192;
export const MAX_SCENE_MODULE_DEPTH = 32;
export const MAX_SCENE_MODULE_EVALUATION_STEPS = 32_768;
export const MAX_SCENE_MODULE_OUTPUT_NODES = 256;
export const MAX_SCENE_MODULE_TEXT_LENGTH = 2_000;

const MAX_SCENE_MODULE_STRING_LENGTH = 16_384;
const MAX_SCENE_MODULE_PARAM_KEYS = 512;
const MAX_SCENE_MODULE_ID_LENGTH = 256;
const MAX_SCENE_MODULE_PATH_LENGTH = 8_192;
const MAX_SCENE_MODULE_PATH_NUMBER = 100_000;
const PERMILLE_MIN = -1_000;
const PERMILLE_MAX = 2_000;
const ROTATION_MAX = 360_000;
const FONT_WEIGHT_MIN = 100;
const FONT_WEIGHT_MAX = 900;
const LETTER_SPACING_MIN = -200;
const LETTER_SPACING_MAX = 200;
const CORNER_RADIUS_MAX = 1_000;

export type SceneModulePrimitive = string | number | boolean | null;
export type SceneModuleParamValue = SceneModulePrimitive;

export interface SceneModuleEvaluationContext {
  readonly frame: number;
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly params: Readonly<Record<string, SceneModuleParamValue>>;
}

export type SceneModuleContextField = "frame" | "fps" | "width" | "height" | "duration";

export type SceneModuleUnaryOperator = "+" | "-" | "!";
export type SceneModuleBinaryOperator =
  | "+" | "-" | "*" | "/" | "%" | "**"
  | "<" | "<=" | ">" | ">=" | "==" | "===" | "!=" | "!=="
  | "&&" | "||" | "??";

export type SceneModuleBuiltin =
  | "Math.min" | "Math.max" | "Math.abs" | "Math.round" | "Math.floor" | "Math.ceil"
  | "Math.sin" | "Math.cos" | "lerp" | "clamp";

export interface SceneModuleLiteralExpressionV1 {
  readonly type: "literal";
  readonly value: SceneModulePrimitive;
}

export interface SceneModuleContextExpressionV1 {
  readonly type: "context";
  readonly field: SceneModuleContextField;
}

export interface SceneModuleParamExpressionV1 {
  readonly type: "param";
  readonly name: string;
}

export interface SceneModuleConstExpressionV1 {
  readonly type: "const";
  readonly name: string;
}

export interface SceneModuleArrayExpressionV1 {
  readonly type: "array";
  readonly elements: readonly SceneModuleExpressionV1[];
}

export interface SceneModuleObjectPropertyV1 {
  readonly key: string;
  readonly value: SceneModuleExpressionV1;
}

export interface SceneModuleObjectExpressionV1 {
  readonly type: "object";
  readonly properties: readonly SceneModuleObjectPropertyV1[];
}

export interface SceneModuleUnaryExpressionV1 {
  readonly type: "unary";
  readonly operator: SceneModuleUnaryOperator;
  readonly argument: SceneModuleExpressionV1;
}

export interface SceneModuleBinaryExpressionV1 {
  readonly type: "binary";
  readonly operator: SceneModuleBinaryOperator;
  readonly left: SceneModuleExpressionV1;
  readonly right: SceneModuleExpressionV1;
}

export interface SceneModuleConditionalExpressionV1 {
  readonly type: "conditional";
  readonly test: SceneModuleExpressionV1;
  readonly whenTrue: SceneModuleExpressionV1;
  readonly whenFalse: SceneModuleExpressionV1;
}

export interface SceneModuleCallExpressionV1 {
  readonly type: "call";
  readonly callee: SceneModuleBuiltin;
  readonly arguments: readonly SceneModuleExpressionV1[];
}

export type SceneModuleExpressionV1 =
  | SceneModuleLiteralExpressionV1
  | SceneModuleContextExpressionV1
  | SceneModuleParamExpressionV1
  | SceneModuleConstExpressionV1
  | SceneModuleArrayExpressionV1
  | SceneModuleObjectExpressionV1
  | SceneModuleUnaryExpressionV1
  | SceneModuleBinaryExpressionV1
  | SceneModuleConditionalExpressionV1
  | SceneModuleCallExpressionV1;

export interface SceneModuleConstStatementV1 {
  readonly type: "const";
  readonly name: string;
  readonly expression: SceneModuleExpressionV1;
}

export interface SceneModuleReturnStatementV1 {
  readonly type: "return";
  readonly expression: SceneModuleExpressionV1;
}

export type SceneModuleStatementV1 = SceneModuleConstStatementV1 | SceneModuleReturnStatementV1;

export interface CompiledSceneModuleV1 {
  readonly version: 1;
  readonly functionName: "scene";
  readonly statements: readonly SceneModuleStatementV1[];
  readonly nodeCount: number;
}

export type SceneModuleNodeKind = "TEXT" | "RECT" | "ELLIPSE" | "LINE" | "PATH";

export interface SceneModuleNode {
  readonly id: string;
  readonly parentObjectId: string;
  readonly kind: SceneModuleNodeKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly opacity?: number;
  readonly rotation?: number;
  readonly scale?: number;
  readonly text?: string;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly path?: string;
  readonly drawProgress?: number;
  /** Optional SVG typography controls, in the same normalized units as height. */
  readonly fontSize?: number;
  readonly fontWeight?: number;
  readonly letterSpacing?: number;
  readonly textAlign?: "left" | "center" | "right";
  /** Optional normalized SVG corner radius. */
  readonly cornerRadius?: number;
}

export interface SceneModuleFrame {
  readonly nodes: readonly SceneModuleNode[];
}

export class SceneModuleRuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = "SceneModuleRuntimeError";
    this.code = code;
  }
}

export interface SceneModuleSchemaSuccess<T> {
  readonly success: true;
  readonly data: T;
}

export interface SceneModuleSchemaFailure {
  readonly success: false;
  readonly error: SceneModuleRuntimeError;
}

export interface SceneModuleSchema<T> {
  parse(value: unknown): T;
  safeParse(value: unknown): SceneModuleSchemaSuccess<T> | SceneModuleSchemaFailure;
}

function bytesOf(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_SCENE_MODULE_ID_LENGTH
    && /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value)
    && value !== "__proto__"
    && value !== "prototype"
    && value !== "constructor";
}

function safePropertyKey(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_SCENE_MODULE_ID_LENGTH
    && !value.includes("\u0000")
    && value !== "__proto__"
    && value !== "prototype"
    && value !== "constructor";
}

function safeOutputId(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_SCENE_MODULE_ID_LENGTH
    && !/[\u0000-\u001f\u007f<>]/u.test(value)
    && value !== "__proto__"
    && value !== "prototype"
    && value !== "constructor";
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function primitive(value: unknown): value is SceneModulePrimitive {
  return value === null
    || typeof value === "string" && value.length <= MAX_SCENE_MODULE_STRING_LENGTH
    || typeof value === "boolean"
    || finiteNumber(value);
}

function throwSchema(code: string, message: string): never {
  throw new SceneModuleRuntimeError(code, message);
}

function schema<T>(parseValue: (value: unknown) => T): SceneModuleSchema<T> {
  return {
    parse: parseValue,
    safeParse(value) {
      try {
        return {success: true, data: parseValue(value)};
      } catch (error) {
        const normalized = error instanceof SceneModuleRuntimeError
          ? error
          : new SceneModuleRuntimeError("SCHEMA_INVALID", "SceneModule schema validation failed");
        return {success: false, error: normalized};
      }
    },
  };
}

function parseSource(value: unknown): string {
  if (typeof value !== "string") throwSchema("SOURCE_INVALID", "SceneModule source must be a string");
  if (bytesOf(value) > MAX_SCENE_MODULE_SOURCE_BYTES) {
    throwSchema("SOURCE_TOO_LARGE", `SceneModule source exceeds ${MAX_SCENE_MODULE_SOURCE_BYTES} bytes`);
  }
  return value;
}

/** Shape/size validation shared by the host compiler and browser boundary. */
export const sourceSchema: SceneModuleSchema<string> = schema(parseSource);

const CONTEXT_FIELDS: readonly SceneModuleContextField[] = ["frame", "fps", "width", "height", "duration"];
const UNARY_OPERATORS: readonly SceneModuleUnaryOperator[] = ["+", "-", "!"];
const BINARY_OPERATORS: readonly SceneModuleBinaryOperator[] = [
  "+", "-", "*", "/", "%", "**", "<", "<=", ">", ">=", "==", "===", "!=", "!==", "&&", "||", "??",
];
const BUILTINS: readonly SceneModuleBuiltin[] = [
  "Math.min", "Math.max", "Math.abs", "Math.round", "Math.floor", "Math.ceil", "Math.sin", "Math.cos", "lerp", "clamp",
];

function validContextField(value: unknown): value is SceneModuleContextField {
  return typeof value === "string" && (CONTEXT_FIELDS as readonly string[]).includes(value);
}

function validUnary(value: unknown): value is SceneModuleUnaryOperator {
  return typeof value === "string" && (UNARY_OPERATORS as readonly string[]).includes(value);
}

function validBinary(value: unknown): value is SceneModuleBinaryOperator {
  return typeof value === "string" && (BINARY_OPERATORS as readonly string[]).includes(value);
}

function validBuiltin(value: unknown): value is SceneModuleBuiltin {
  return typeof value === "string" && (BUILTINS as readonly string[]).includes(value);
}

function expectedBuiltinArity(callee: SceneModuleBuiltin): {min: number; max: number} {
  if (callee === "Math.min" || callee === "Math.max") return {min: 1, max: 64};
  if (callee === "lerp" || callee === "clamp") return {min: 3, max: 3};
  return {min: 1, max: 1};
}

interface CompiledSchemaCount {
  value: number;
  depth: number;
}

function validateCompiledExpression(value: unknown, depth: number, count: CompiledSchemaCount, active = new WeakSet<object>()): void {
  if (depth > MAX_SCENE_MODULE_DEPTH) throwSchema("IR_DEPTH_EXCEEDED", "SceneModule IR nesting exceeds the depth limit");
  if (!isPlainRecord(value) || typeof value.type !== "string") throwSchema("IR_INVALID", "SceneModule expression is invalid");
  if (active.has(value)) throwSchema("IR_CYCLE", "SceneModule IR must be acyclic");
  active.add(value);
  count.value += 1;
  count.depth = Math.max(count.depth, depth);
  if (count.value > MAX_SCENE_MODULE_IR_NODES) throwSchema("IR_NODE_LIMIT", "SceneModule IR exceeds the node limit");

  switch (value.type) {
    case "literal":
      if (!exactKeys(value, ["type", "value"]) || !primitive(value.value)) throwSchema("IR_INVALID", "SceneModule literal is invalid");
      break;
    case "context":
      if (!exactKeys(value, ["type", "field"]) || !validContextField(value.field)) throwSchema("IR_INVALID", "SceneModule context expression is invalid");
      break;
    case "param":
      if (!exactKeys(value, ["type", "name"]) || !safeIdentifier(value.name)) throwSchema("IR_INVALID", "SceneModule parameter expression is invalid");
      break;
    case "const":
      if (!exactKeys(value, ["type", "name"]) || !safeIdentifier(value.name)) throwSchema("IR_INVALID", "SceneModule const expression is invalid");
      break;
    case "array":
      if (!exactKeys(value, ["type", "elements"]) || !Array.isArray(value.elements)) throwSchema("IR_INVALID", "SceneModule array expression is invalid");
      for (const element of value.elements) validateCompiledExpression(element, depth + 1, count, active);
      break;
    case "object":
      if (!exactKeys(value, ["type", "properties"]) || !Array.isArray(value.properties)) throwSchema("IR_INVALID", "SceneModule object expression is invalid");
      for (const property of value.properties) {
        if (!isPlainRecord(property) || !exactKeys(property, ["key", "value"]) || !safePropertyKey(property.key)) {
          throwSchema("IR_INVALID", "SceneModule object property is invalid");
        }
        validateCompiledExpression(property.value, depth + 1, count, active);
      }
      break;
    case "unary":
      if (!exactKeys(value, ["type", "operator", "argument"]) || !validUnary(value.operator)) throwSchema("IR_INVALID", "SceneModule unary expression is invalid");
      validateCompiledExpression(value.argument, depth + 1, count, active);
      break;
    case "binary":
      if (!exactKeys(value, ["type", "operator", "left", "right"]) || !validBinary(value.operator)) throwSchema("IR_INVALID", "SceneModule binary expression is invalid");
      validateCompiledExpression(value.left, depth + 1, count, active);
      validateCompiledExpression(value.right, depth + 1, count, active);
      break;
    case "conditional":
      if (!exactKeys(value, ["type", "test", "whenTrue", "whenFalse"])) throwSchema("IR_INVALID", "SceneModule conditional expression is invalid");
      validateCompiledExpression(value.test, depth + 1, count, active);
      validateCompiledExpression(value.whenTrue, depth + 1, count, active);
      validateCompiledExpression(value.whenFalse, depth + 1, count, active);
      break;
    case "call": {
      if (!exactKeys(value, ["type", "callee", "arguments"]) || !validBuiltin(value.callee) || !Array.isArray(value.arguments)) {
        throwSchema("IR_INVALID", "SceneModule call expression is invalid");
      }
      const arity = expectedBuiltinArity(value.callee);
      if (value.arguments.length < arity.min || value.arguments.length > arity.max) throwSchema("IR_INVALID", "SceneModule call arity is invalid");
      for (const argument of value.arguments) validateCompiledExpression(argument, depth + 1, count, active);
      break;
    }
    default:
      throwSchema("IR_INVALID", "SceneModule expression type is not allowed");
  }
  active.delete(value);
}

function validateCompiled(value: unknown): CompiledSceneModuleV1 {
  const nodeCount = isPlainRecord(value) ? value.nodeCount : undefined;
  if (!isPlainRecord(value)
    || !exactKeys(value, ["version", "functionName", "statements", "nodeCount"])
    || value.version !== SCENE_MODULE_VERSION
    || value.functionName !== "scene"
    || !Array.isArray(value.statements)
    || typeof nodeCount !== "number"
    || !Number.isSafeInteger(nodeCount)
    || nodeCount < 1
    || nodeCount > MAX_SCENE_MODULE_IR_NODES) {
    throwSchema("IR_INVALID", "Compiled SceneModule shape is invalid");
  }

  const count: CompiledSchemaCount = {value: 0, depth: 0};
  const names = new Set<string>();
  let returnCount = 0;
  for (const [index, statement] of value.statements.entries()) {
    if (!isPlainRecord(statement) || typeof statement.type !== "string") throwSchema("IR_INVALID", "SceneModule statement is invalid");
    if (statement.type === "const") {
      if (!exactKeys(statement, ["type", "name", "expression"]) || !safeIdentifier(statement.name) || names.has(statement.name)) {
        throwSchema("IR_INVALID", "SceneModule const statement is invalid");
      }
      names.add(statement.name);
      count.value += 1;
      if (count.value > MAX_SCENE_MODULE_IR_NODES) throwSchema("IR_NODE_LIMIT", "SceneModule IR exceeds the node limit");
      validateCompiledExpression(statement.expression, 1, count);
    } else if (statement.type === "return") {
      if (!exactKeys(statement, ["type", "expression"]) || index !== value.statements.length - 1 || returnCount !== 0) {
        throwSchema("IR_INVALID", "SceneModule return statement is invalid");
      }
      returnCount += 1;
      count.value += 1;
      if (count.value > MAX_SCENE_MODULE_IR_NODES) throwSchema("IR_NODE_LIMIT", "SceneModule IR exceeds the node limit");
      validateCompiledExpression(statement.expression, 1, count);
    } else {
      throwSchema("IR_INVALID", "SceneModule statement type is not allowed");
    }
  }
  if (returnCount !== 1 || count.value !== nodeCount) throwSchema("IR_INVALID", "Compiled SceneModule node count or return is invalid");
  return value as unknown as CompiledSceneModuleV1;
}

export const compiledSceneModuleSchema: SceneModuleSchema<CompiledSceneModuleV1> = schema(validateCompiled);

function normalizeContext(value: unknown): SceneModuleEvaluationContext {
  if (!isPlainRecord(value) || !exactKeys(value, ["duration", "fps", "frame", "height", "params", "width"])) {
    throwSchema("CONTEXT_INVALID", "SceneModule evaluation context is invalid");
  }
  const frame = value.frame;
  const fps = value.fps;
  const width = value.width;
  const height = value.height;
  const duration = value.duration;
  if (typeof frame !== "number" || !Number.isSafeInteger(frame) || frame < 0) throwSchema("CONTEXT_INVALID", "context.frame is invalid");
  if (typeof fps !== "number" || !finiteNumber(fps) || fps <= 0 || fps > 1_000) throwSchema("CONTEXT_INVALID", "context.fps is invalid");
  if (typeof width !== "number" || !Number.isSafeInteger(width) || width <= 0 || width > 16_384) throwSchema("CONTEXT_INVALID", "context.width is invalid");
  if (typeof height !== "number" || !Number.isSafeInteger(height) || height <= 0 || height > 16_384) throwSchema("CONTEXT_INVALID", "context.height is invalid");
  if (typeof duration !== "number" || !Number.isSafeInteger(duration) || duration <= 0 || duration > 10_000_000) throwSchema("CONTEXT_INVALID", "context.duration is invalid");
  // frame uses the edited timeline coordinate; duration is the local paragraph length.
  // The host owns paragraph range selection, so later paragraphs may have frame >= duration.
  if (!isPlainRecord(value.params)) throwSchema("PARAMS_INVALID", "SceneModule params must be a plain object");
  const params: Record<string, SceneModuleParamValue> = Object.create(null) as Record<string, SceneModuleParamValue>;
  const keys = Object.keys(value.params);
  if (keys.length > MAX_SCENE_MODULE_PARAM_KEYS) throwSchema("PARAMS_INVALID", "SceneModule params contain too many keys");
  for (const key of keys) {
    if (!safePropertyKey(key) || !primitive(value.params[key])) throwSchema("PARAMS_INVALID", `SceneModule param ${key} is invalid`);
    params[key] = value.params[key] as SceneModuleParamValue;
  }
  return {
    frame,
    fps,
    width,
    height,
    duration,
    params,
  };
}

function normalizeApprovedObjectIds(value: unknown): ReadonlySet<string> {
  const ids: string[] = [];
  if (Array.isArray(value)) {
    ids.push(...value as unknown[] as string[]);
  } else if (value instanceof Set) {
    for (const id of value) ids.push(id);
  } else {
    throwSchema("APPROVED_OBJECT_IDS_INVALID", "approvedObjectIds must be an array or Set");
  }
  const result = new Set<string>();
  for (const id of ids) {
    if (!safeOutputId(id)) throwSchema("APPROVED_OBJECT_IDS_INVALID", "approvedObjectIds contains an invalid id");
    result.add(id);
  }
  return result;
}

function outputNumber(value: unknown, field: string, min: number, max: number): number {
  if (!finiteNumber(value)) throwSchema("OUTPUT_INVALID", `SceneModule node ${field} is required and must be a finite number`);
  if (value < min || value > max) throwSchema("OUTPUT_INVALID", `SceneModule node ${field} is outside the allowed range [${min}, ${max}]`);
  return value;
}

function validateColor(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 128) throwSchema("OUTPUT_INVALID", `SceneModule ${field} color is invalid`);
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu.test(value)) return value;
  if (value === "none") return value;
  const match = /^rgba?\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)(?:\s*,\s*([^,]+))?\s*\)$/iu.exec(value);
  if (match === null) throwSchema("OUTPUT_INVALID", `SceneModule ${field} color is invalid`);
  const channels = match.slice(1, 4).map((channel) => Number(channel));
  if (channels.some((channel, index) => !Number.isFinite(channel) || channel < 0 || channel > 255 || !/^\d+(?:\.\d+)?$/u.test(match[index + 1]!))) {
    throwSchema("OUTPUT_INVALID", `SceneModule ${field} color is invalid`);
  }
  if (match[4] !== undefined && (!/^\d?(?:\.\d+)?$/u.test(match[4]) || Number(match[4]) < 0 || Number(match[4]) > 1)) {
    throwSchema("OUTPUT_INVALID", `SceneModule ${field} alpha is invalid`);
  }
  return value;
}

const PATH_COMMANDS = new Set(["M", "m", "Z", "z", "L", "l", "H", "h", "V", "v", "C", "c", "S", "s", "Q", "q", "T", "t", "A", "a"]);
const PATH_ARITY: Readonly<Record<string, number>> = {
  M: 2, m: 2, Z: 0, z: 0, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1,
  C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2, A: 7, a: 7,
};
const PATH_TOKEN = /[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/yu;

function validateSvgPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SCENE_MODULE_PATH_LENGTH) {
    throwSchema("OUTPUT_INVALID", "SceneModule path is invalid");
  }
  let position = 0;
  let command: string | null = null;
  let numbersInGroup = 0;
  let sawCommand = false;
  let firstCommand = true;
  let commandHasGroup = false;
  while (position < value.length) {
    while (position < value.length && /[\s,]/u.test(value[position]!)) position += 1;
    if (position >= value.length) break;
    PATH_TOKEN.lastIndex = position;
    const token = PATH_TOKEN.exec(value);
    if (token === null || token.index !== position) throwSchema("OUTPUT_INVALID", "SceneModule path contains an unsafe token");
    position = PATH_TOKEN.lastIndex;
    const text = token[0]!;
    if (PATH_COMMANDS.has(text)) {
      if (command !== null && command !== "Z" && command !== "z" && !commandHasGroup) {
        throwSchema("OUTPUT_INVALID", "SceneModule path command has no numbers");
      }
      command = text;
      numbersInGroup = 0;
      commandHasGroup = text === "Z" || text === "z";
      sawCommand = true;
      if (firstCommand && text !== "M" && text !== "m") throwSchema("OUTPUT_INVALID", "SceneModule path must start with M or m");
      firstCommand = false;
      continue;
    }
    if (command === null || command === "Z" || command === "z") throwSchema("OUTPUT_INVALID", "SceneModule path number has no command");
    const number = Number(text);
    if (!Number.isFinite(number) || Math.abs(number) > MAX_SCENE_MODULE_PATH_NUMBER) throwSchema("OUTPUT_INVALID", "SceneModule path number is invalid");
    numbersInGroup += 1;
    const arity = PATH_ARITY[command]!;
    if (numbersInGroup === arity) {
      numbersInGroup = 0;
      commandHasGroup = true;
      if (command === "M") command = "L";
      if (command === "m") command = "l";
    } else if (numbersInGroup > arity) {
      throwSchema("OUTPUT_INVALID", "SceneModule path command has too many numbers");
    }
  }
  if (!sawCommand || command === null || numbersInGroup !== 0 || (command !== "Z" && command !== "z" && !commandHasGroup)) {
    throwSchema("OUTPUT_INVALID", "SceneModule path is incomplete");
  }
  return value;
}

function validateOutputFrame(value: unknown, approvedObjectIds: ReadonlySet<string>): SceneModuleFrame {
  if (!isPlainRecord(value) || !exactKeys(value, ["nodes"]) || !Array.isArray(value.nodes)) throwSchema("OUTPUT_INVALID", "SceneModule frame must contain nodes");
  if (value.nodes.length > MAX_SCENE_MODULE_OUTPUT_NODES) throwSchema("OUTPUT_INVALID", "SceneModule frame contains too many nodes");
  const ids = new Set<string>();
  const nodes: SceneModuleNode[] = [];
  for (const rawNode of value.nodes) {
    if (!isPlainRecord(rawNode)) throwSchema("OUTPUT_INVALID", "SceneModule node is invalid");
    const allowedKeys = ["cornerRadius", "drawProgress", "fill", "fontSize", "fontWeight", "height", "id", "kind", "letterSpacing", "opacity", "parentObjectId", "path", "rotation", "scale", "stroke", "strokeWidth", "text", "textAlign", "width", "x", "y"];
    if (Object.keys(rawNode).some((key) => !allowedKeys.includes(key))) throwSchema("OUTPUT_INVALID", "SceneModule node contains an unsupported field");
    if (!safeOutputId(rawNode.id) || ids.has(rawNode.id)) throwSchema("OUTPUT_INVALID", "SceneModule node ids must be unique and safe");
    if (!safeOutputId(rawNode.parentObjectId) || !approvedObjectIds.has(rawNode.parentObjectId)) throwSchema("OUTPUT_INVALID", "SceneModule node parentObjectId is not approved");
    if (rawNode.kind !== "TEXT" && rawNode.kind !== "RECT" && rawNode.kind !== "ELLIPSE" && rawNode.kind !== "LINE" && rawNode.kind !== "PATH") {
      throwSchema("OUTPUT_INVALID", "SceneModule node kind is invalid");
    }
    const x = outputNumber(rawNode.x, "x", PERMILLE_MIN, PERMILLE_MAX);
    const y = outputNumber(rawNode.y, "y", PERMILLE_MIN, PERMILLE_MAX);
    const width = outputNumber(rawNode.width, "width", 0, PERMILLE_MAX);
    const height = outputNumber(rawNode.height, "height", 0, PERMILLE_MAX);
    const node: SceneModuleNode = {
      id: rawNode.id,
      parentObjectId: rawNode.parentObjectId,
      kind: rawNode.kind,
      x,
      y,
      width,
      height,
    };
    if (hasOwn(rawNode, "opacity")) (node as {opacity?: number}).opacity = outputNumber(rawNode.opacity, "opacity", 0, 1);
    if (hasOwn(rawNode, "rotation")) (node as {rotation?: number}).rotation = outputNumber(rawNode.rotation, "rotation", -ROTATION_MAX, ROTATION_MAX);
    if (hasOwn(rawNode, "scale")) (node as {scale?: number}).scale = outputNumber(rawNode.scale, "scale", 0, 100);
    if (hasOwn(rawNode, "strokeWidth")) (node as {strokeWidth?: number}).strokeWidth = outputNumber(rawNode.strokeWidth, "strokeWidth", 0, 1_000);
    if (hasOwn(rawNode, "drawProgress")) (node as {drawProgress?: number}).drawProgress = outputNumber(rawNode.drawProgress, "drawProgress", 0, 1);
    if (hasOwn(rawNode, "fontSize")) (node as {fontSize?: number}).fontSize = outputNumber(rawNode.fontSize, "fontSize", 0, PERMILLE_MAX);
    if (hasOwn(rawNode, "fontWeight")) {
      if (typeof rawNode.fontWeight !== "number"
        || !Number.isSafeInteger(rawNode.fontWeight)
        || rawNode.fontWeight < FONT_WEIGHT_MIN
        || rawNode.fontWeight > FONT_WEIGHT_MAX
        || rawNode.fontWeight % 100 !== 0) {
        throwSchema("OUTPUT_INVALID", "SceneModule node fontWeight is invalid");
      }
      (node as {fontWeight?: number}).fontWeight = rawNode.fontWeight;
    }
    if (hasOwn(rawNode, "letterSpacing")) {
      (node as {letterSpacing?: number}).letterSpacing = outputNumber(rawNode.letterSpacing, "letterSpacing", LETTER_SPACING_MIN, LETTER_SPACING_MAX);
    }
    if (hasOwn(rawNode, "textAlign")) {
      if (rawNode.textAlign !== "left" && rawNode.textAlign !== "center" && rawNode.textAlign !== "right") {
        throwSchema("OUTPUT_INVALID", "SceneModule node textAlign is invalid");
      }
      (node as {textAlign?: "left" | "center" | "right"}).textAlign = rawNode.textAlign;
    }
    if (hasOwn(rawNode, "cornerRadius")) {
      (node as {cornerRadius?: number}).cornerRadius = outputNumber(rawNode.cornerRadius, "cornerRadius", 0, CORNER_RADIUS_MAX);
    }
    if (hasOwn(rawNode, "text")) {
      if (typeof rawNode.text !== "string" || rawNode.text.length > MAX_SCENE_MODULE_TEXT_LENGTH || /[<>]/u.test(rawNode.text)) {
        throwSchema("OUTPUT_INVALID", "SceneModule text is invalid");
      }
      (node as {text?: string}).text = rawNode.text;
    }
    if (hasOwn(rawNode, "fill")) (node as {fill?: string}).fill = validateColor(rawNode.fill, "fill");
    if (hasOwn(rawNode, "stroke")) (node as {stroke?: string}).stroke = validateColor(rawNode.stroke, "stroke");
    if (hasOwn(rawNode, "path")) (node as {path?: string}).path = validateSvgPath(rawNode.path);
    ids.add(rawNode.id);
    nodes.push(node);
  }
  return {nodes};
}

class EvaluationBudget {
  private steps = 0;

  step(): void {
    this.steps += 1;
    if (this.steps > MAX_SCENE_MODULE_EVALUATION_STEPS) throw new SceneModuleRuntimeError("EVALUATION_BUDGET_EXCEEDED", "SceneModule evaluation step budget exceeded");
  }
}

interface InternalObject {
  [key: string]: InternalValue;
}

type InternalValue = SceneModulePrimitive | InternalValue[] | InternalObject;

function requireNumber(value: InternalValue, operation: string): number {
  if (!finiteNumber(value)) throw new SceneModuleRuntimeError("VALUE_INVALID", `${operation} requires finite numbers`);
  return value;
}

function requirePrimitiveValue(value: InternalValue, operation: string): SceneModulePrimitive {
  if (!primitive(value)) throw new SceneModuleRuntimeError("VALUE_INVALID", `${operation} requires primitive values`);
  return value;
}

function ensureResult(value: InternalValue): InternalValue {
  if (typeof value === "number" && !Number.isFinite(value)) throw new SceneModuleRuntimeError("NONFINITE_VALUE", "SceneModule produced a non-finite number");
  if (typeof value === "string" && value.length > MAX_SCENE_MODULE_STRING_LENGTH) throw new SceneModuleRuntimeError("VALUE_INVALID", "SceneModule produced an oversized string");
  return value;
}

function evaluateExpression(
  expression: SceneModuleExpressionV1,
  context: SceneModuleEvaluationContext,
  constants: Record<string, InternalValue>,
  budget: EvaluationBudget,
  depth: number,
): InternalValue {
  budget.step();
  if (depth > MAX_SCENE_MODULE_DEPTH) throw new SceneModuleRuntimeError("EVALUATION_DEPTH_EXCEEDED", "SceneModule evaluation depth exceeded");
  switch (expression.type) {
    case "literal": return expression.value;
    case "context": return context[expression.field];
    case "param": {
      if (!hasOwn(context.params, expression.name)) throw new SceneModuleRuntimeError("PARAM_MISSING", `SceneModule parameter ${expression.name} is missing`);
      return context.params[expression.name]!;
    }
    case "const": {
      if (!hasOwn(constants, expression.name)) throw new SceneModuleRuntimeError("CONST_MISSING", `SceneModule const ${expression.name} is unavailable`);
      return constants[expression.name]!;
    }
    case "array": {
      const result: InternalValue[] = [];
      for (const element of expression.elements) result.push(evaluateExpression(element, context, constants, budget, depth + 1));
      return result;
    }
    case "object": {
      const result: Record<string, InternalValue> = Object.create(null) as Record<string, InternalValue>;
      for (const property of expression.properties) result[property.key] = evaluateExpression(property.value, context, constants, budget, depth + 1);
      return result;
    }
    case "unary": {
      const argument = requirePrimitiveValue(evaluateExpression(expression.argument, context, constants, budget, depth + 1), `unary ${expression.operator}`);
      if (expression.operator === "!") return !argument;
      return ensureResult(expression.operator === "+" ? requireNumber(argument, "unary +") : -requireNumber(argument, "unary -"));
    }
    case "binary": {
      if (expression.operator === "&&" || expression.operator === "||" || expression.operator === "??") {
        const left = requirePrimitiveValue(evaluateExpression(expression.left, context, constants, budget, depth + 1), `binary ${expression.operator}`);
        if (expression.operator === "&&") return left ? evaluateExpression(expression.right, context, constants, budget, depth + 1) : left;
        if (expression.operator === "||") return left ? left : evaluateExpression(expression.right, context, constants, budget, depth + 1);
        return left === null ? evaluateExpression(expression.right, context, constants, budget, depth + 1) : left;
      }
      const left = requirePrimitiveValue(evaluateExpression(expression.left, context, constants, budget, depth + 1), `binary ${expression.operator}`);
      const right = requirePrimitiveValue(evaluateExpression(expression.right, context, constants, budget, depth + 1), `binary ${expression.operator}`);
      switch (expression.operator) {
        case "+":
          if (!((typeof left === "number" || typeof left === "string") && (typeof right === "number" || typeof right === "string"))) {
            throw new SceneModuleRuntimeError("VALUE_INVALID", "binary + requires numbers or strings");
          }
          return ensureResult(typeof left === "string" || typeof right === "string"
            ? `${left}${right}`
            : left + right);
        case "-": return ensureResult(requireNumber(left, "binary -") - requireNumber(right, "binary -"));
        case "*": return ensureResult(requireNumber(left, "binary *") * requireNumber(right, "binary *"));
        case "/": return ensureResult(requireNumber(left, "binary /") / requireNumber(right, "binary /"));
        case "%": return ensureResult(requireNumber(left, "binary %") % requireNumber(right, "binary %"));
        case "**": return ensureResult(requireNumber(left, "binary **") ** requireNumber(right, "binary **"));
        case "<": return (left as number | string) < (right as number | string);
        case "<=": return (left as number | string) <= (right as number | string);
        case ">": return (left as number | string) > (right as number | string);
        case ">=": return (left as number | string) >= (right as number | string);
        case "==": return left == right;
        case "===": return left === right;
        case "!=": return left != right;
        case "!==": return left !== right;
        default: throw new SceneModuleRuntimeError("IR_INVALID", `Unsupported binary operator ${expression.operator}`);
      }
    }
    case "conditional": {
      const test = requirePrimitiveValue(evaluateExpression(expression.test, context, constants, budget, depth + 1), "conditional test");
      return test ? evaluateExpression(expression.whenTrue, context, constants, budget, depth + 1) : evaluateExpression(expression.whenFalse, context, constants, budget, depth + 1);
    }
    case "call": {
      const args = expression.arguments.map((argument) => requireNumber(evaluateExpression(argument, context, constants, budget, depth + 1), expression.callee));
      let result: number;
      switch (expression.callee) {
        case "Math.min": result = Math.min(...args); break;
        case "Math.max": result = Math.max(...args); break;
        case "Math.abs": result = Math.abs(args[0]!); break;
        case "Math.round": result = Math.round(args[0]!); break;
        case "Math.floor": result = Math.floor(args[0]!); break;
        case "Math.ceil": result = Math.ceil(args[0]!); break;
        case "Math.sin": result = Math.sin(args[0]!); break;
        case "Math.cos": result = Math.cos(args[0]!); break;
        case "lerp": result = args[0]! + (args[1]! - args[0]!) * args[2]!; break;
        case "clamp": result = Math.min(Math.max(args[0]!, args[1]!), args[2]!); break;
      }
      return ensureResult(result!);
    }
  }
}

/**
 * Evaluate one compiled SceneModule frame through the restricted JSON IR.
 * `approvedObjectIds` is the host-owned parent-object allowlist.
 */
export function evaluateSceneModule(
  compiled: CompiledSceneModuleV1,
  contextValue: SceneModuleEvaluationContext,
  approvedObjectIds: readonly string[] | ReadonlySet<string>,
): SceneModuleFrame {
  return evaluateCheckedSceneModule(compiledSceneModuleSchema.parse(compiled),contextValue,approvedObjectIds);
}

/** Copy and validate once for a render session; callers cannot mutate the captured IR. */
export function prepareSceneModule(compiled:CompiledSceneModuleV1){
  const checked=structuredClone(compiledSceneModuleSchema.parse(compiled));
  return (context:SceneModuleEvaluationContext,approved:readonly string[]|ReadonlySet<string>)=>evaluateCheckedSceneModule(checked,context,approved);
}

function evaluateCheckedSceneModule(checked:CompiledSceneModuleV1,contextValue:SceneModuleEvaluationContext,approvedObjectIds:readonly string[]|ReadonlySet<string>):SceneModuleFrame{
  const context = normalizeContext(contextValue);
  const approved = normalizeApprovedObjectIds(approvedObjectIds);
  const constants: Record<string, InternalValue> = Object.create(null) as Record<string, InternalValue>;
  const budget = new EvaluationBudget();
  let returned: InternalValue | undefined;
  for (const statement of checked.statements) {
    budget.step();
    if (statement.type === "const") {
      constants[statement.name] = evaluateExpression(statement.expression, context, constants, budget, 1);
    } else {
      returned = evaluateExpression(statement.expression, context, constants, budget, 1);
    }
  }
  if (returned === undefined) throw new SceneModuleRuntimeError("OUTPUT_INVALID", "SceneModule did not return a frame");
  return validateOutputFrame(returned, approved);
}
