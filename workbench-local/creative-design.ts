import {z} from 'zod';

const MAX_TEXT_LENGTH = 4_000;
const MAX_ID_LENGTH = 200;

const textSchema = z
  .string({error: '必须是字符串'})
  .trim()
  .min(1, '不能为空')
  .max(MAX_TEXT_LENGTH, `不能超过 ${MAX_TEXT_LENGTH} 个字符`);

const idSchema = z
  .string({error: '必须是字符串'})
  .trim()
  .min(1, '不能为空')
  .max(MAX_ID_LENGTH, `不能超过 ${MAX_ID_LENGTH} 个字符`);

const creativeObjectSchema = z
  .object({
    id: idSchema,
    role: z.enum(['main', 'support'], {error: 'role 必须是 main 或 support'}),
    content: textSchema,
    source: textSchema,
    layout: textSchema,
  })
  .strict();

const creativeActionSchema = z
  .object({
    objectId: idSchema,
    wordId: z.string().trim().min(1).max(4096),
    action: textSchema,
    purpose: textSchema,
    before: textSchema.optional(),
    after: textSchema.optional(),
    offsetMs: z.number().finite().min(-5000).max(60000).optional(),
    durationMs: z.number().finite().positive().max(60000).optional(),
  })
  .strict();

/**
 * The model-facing creative decision.  It contains semantic objects and
 * spoken-word bindings only; it deliberately contains no executable code.
 */
export const creativeDesignSchema = z
  .object({
    message: textSchema,
    relationship: textSchema,
    objects: z
      .array(creativeObjectSchema, {error: 'objects 必须是数组'})
      .min(1, 'objects 至少需要一个对象')
      .max(40, 'objects 不能超过 40 个对象'),
    actions: z
      .array(creativeActionSchema, {error: 'actions 必须是数组'})
      .max(100, 'actions 不能超过 100 个动作'),
    rationale: textSchema,
  })
  .strict()
  .superRefine((design, context) => {
    const seen = new Set<string>();
    design.objects.forEach((object, index) => {
      if (seen.has(object.id)) {
        context.addIssue({
          code: 'custom',
          path: ['objects', index, 'id'],
          message: `对象 id 必须唯一，重复值为「${object.id}」`,
        });
      }
      seen.add(object.id);
    });

    if (!design.objects.some((object) => object.role === 'main')) {
      context.addIssue({
        code: 'custom',
        path: ['objects'],
        message: 'objects 至少需要一个 role=main 的主对象',
      });
    }
  });

export type CreativeDesign = z.infer<typeof creativeDesignSchema>;

export interface CreativeDesignSummary {
  complete: boolean;
  missing: string[];
}

type ValidationIssue = {
  path: PropertyKey[];
  message: string;
  code?: string;
  keys?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return 'design';
  return `design.${path
    .map((part) => (typeof part === 'number' ? `[${part}]` : String(part)))
    .join('.')
    .replace(/\.\[/gu, '[')}`;
}

function formatSchemaIssue(issue: ValidationIssue): string {
  if (issue.code === 'unrecognized_keys' && issue.keys?.length) {
    return `${formatPath(issue.path)} 包含不允许的字段：${issue.keys.join('、')}`;
  }
  if (issue.code === 'invalid_type' && issue.message.startsWith('Invalid input')) {
    return `${formatPath(issue.path)} 类型无效`;
  }
  return `${formatPath(issue.path)}：${issue.message}`;
}

function schemaIssues(error: {issues: readonly ValidationIssue[]}): string[] {
  return error.issues.slice(0, 12).map(formatSchemaIssue);
}

function sceneWordIds(scene: Record<string, unknown>): Set<string> {
  const beats = scene.beats;
  if (!Array.isArray(beats)) return new Set<string>();
  return new Set(
    beats.flatMap((beat) => {
      if (!isRecord(beat) || typeof beat.wordId !== 'string') return [];
      return [beat.wordId];
    }),
  );
}

function referenceIssues(
  scene: Record<string, unknown>,
  design: CreativeDesign,
): string[] {
  const objectIds = new Set(design.objects.map((object) => object.id));
  const wordIds = sceneWordIds(scene);
  const issues: string[] = [];

  design.actions.forEach((action, index) => {
    if (!objectIds.has(action.objectId)) {
      issues.push(
        `design.actions[${index}].objectId「${action.objectId}」未找到对应的 design.objects.id`,
      );
    }
    if (!wordIds.has(action.wordId)) {
      issues.push(
        `design.actions[${index}].wordId「${action.wordId}」未找到对应的 scene.beats.wordId`,
      );
    }
  });

  return issues;
}

function parseDesign(scene: Record<string, unknown>):
  | {success: true; data: CreativeDesign}
  | {success: false; issues: string[]} {
  const parsed = creativeDesignSchema.safeParse(scene.design);
  if (!parsed.success) return {success: false, issues: schemaIssues(parsed.error)};
  const references = referenceIssues(scene, parsed.data);
  if (references.length) return {success: false, issues: references};
  return {success: true, data: parsed.data};
}

/**
 * Validate a scene's optional creative design and its data-only references.
 * Scenes without design remain readable for legacy projects.
 */
export function validateCreativeDesignReferences(scene: any): void {
  if (!isRecord(scene)) throw new Error('场景必须是对象');
  if (scene.design === undefined) return;

  const parsed = parseDesign(scene);
  if (!parsed.success) {
    throw new Error(`创意设计无效：${parsed.issues.join('；')}`);
  }
}

/**
 * Summarize readiness without filling in missing design values or references.
 */
export function summarizeCreativeDesign(scene: any): CreativeDesignSummary {
  if (!isRecord(scene)) return {complete: false, missing: ['scene：场景对象缺失']};
  if (scene.design === undefined) return {complete: false, missing: ['design：创意设计缺失']};

  const parsed = parseDesign(scene);
  return parsed.success
    ? {complete: true, missing: []}
    : {complete: false, missing: parsed.issues};
}
