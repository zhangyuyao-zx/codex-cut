import {describe, expect, it} from 'vitest';

import {
  creativeDesignSchema,
  summarizeCreativeDesign,
  validateCreativeDesignReferences,
} from './creative-design';

const validDesign = {
  message: '把核心结论从口播里提炼成可读的视觉层级',
  relationship: '主对象承载结论，辅助对象解释来源与变化',
  objects: [
    {
      id: 'headline',
      role: 'main' as const,
      content: '核心结论',
      source: '口播词重点',
      layout: '画面中央大字',
    },
    {
      id: 'detail',
      role: 'support' as const,
      content: '补充说明',
      source: '场景上下文',
      layout: '右下角小字',
    },
  ],
  actions: [
    {
      objectId: 'headline',
      wordId: 'word-1',
      action: '在重音词出现时进入',
      purpose: '让观众先看到核心结论',
    },
    {
      objectId: 'detail',
      wordId: 'word-2',
      action: '随后补充说明',
      purpose: '建立主次关系',
    },
  ],
  rationale: '信息先聚焦结论，再用辅助对象补足语境。',
};

function sceneWithDesign(design: unknown = validDesign): Record<string, unknown> {
  return {
    id: 'scene-1',
    beats: [
      {wordId: 'word-1', label: '重点'},
      {wordId: 'word-2', label: '说明'},
    ],
    design,
  };
}

describe('creative design contract', () => {
  it('preserves explicit action states and timing while rejecting invalid durations', () => {
    const action = {...validDesign.actions[0], before: '未连接', after: '已连接', offsetMs: -100, durationMs: 600};
    expect(creativeDesignSchema.parse({...validDesign, actions: [action]}).actions[0]).toEqual(action);
    for (const durationMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 60001]) {
      expect(creativeDesignSchema.safeParse({...validDesign, actions: [{...action, durationMs}]}).success).toBe(false);
    }
  });
  it('accepts a valid design, including multiple main objects for changing states', () => {
    const design = {
      ...validDesign,
      objects: [
        validDesign.objects[0],
        {...validDesign.objects[0], id: 'headline-next', content: '变化后的结论'},
        validDesign.objects[1],
      ],
    };
    const scene = sceneWithDesign(design);

    expect(creativeDesignSchema.safeParse(design).success).toBe(true);
    expect(() => validateCreativeDesignReferences(scene)).not.toThrow();
    expect(summarizeCreativeDesign(scene)).toEqual({complete: true, missing: []});
  });

  it('keeps legacy scenes readable while reporting the missing design', () => {
    const legacyScene = {id: 'legacy-scene', beats: [{wordId: 'word-1', label: '旧场景'}]};

    expect(() => validateCreativeDesignReferences(legacyScene)).not.toThrow();
    expect(summarizeCreativeDesign(legacyScene)).toEqual({
      complete: false,
      missing: ['design：创意设计缺失'],
    });
  });

  it('reports incomplete design fields instead of inventing legacy values', () => {
    const incomplete = {objects: [], actions: [], rationale: '只剩理由'};
    const scene = sceneWithDesign(incomplete);

    expect(() => validateCreativeDesignReferences(scene)).toThrow(/message|不能为空|objects/iu);
    const summary = summarizeCreativeDesign(scene);
    expect(summary.complete).toBe(false);
    expect(summary.missing.some((entry) => /message|objects/iu.test(entry))).toBe(true);
  });

  it('rejects duplicate object ids and requires a main object', () => {
    const duplicate = {
      ...validDesign,
      objects: [
        validDesign.objects[0],
        {...validDesign.objects[1], id: 'headline'},
      ],
    };
    expect(creativeDesignSchema.safeParse(duplicate).success).toBe(false);
    expect(() => validateCreativeDesignReferences(sceneWithDesign(duplicate))).toThrow(/唯一|重复/iu);

    const supportOnly = {
      ...validDesign,
      objects: [{...validDesign.objects[1], id: 'only-support'}],
      actions: [],
    };
    expect(() => validateCreativeDesignReferences(sceneWithDesign(supportOnly))).toThrow(/main|主对象/iu);
  });

  it('rejects actions that reference an unknown object or beat', () => {
    const unknownObject = {
      ...validDesign,
      actions: [{...validDesign.actions[0], objectId: 'missing-object'}],
    };
    expect(() => validateCreativeDesignReferences(sceneWithDesign(unknownObject))).toThrow(
      /objectId.*missing-object|objects.*missing-object/iu,
    );

    const unknownBeat = {
      ...validDesign,
      actions: [{...validDesign.actions[0], wordId: 'missing-word'}],
    };
    expect(() => validateCreativeDesignReferences(sceneWithDesign(unknownBeat))).toThrow(
      /wordId.*missing-word|beats.*missing-word/iu,
    );
  });

  it('rejects blank trimmed fields, overlong ids, and unknown keys', () => {
    const blank = {...validDesign, message: '   '};
    expect(creativeDesignSchema.safeParse(blank).success).toBe(false);
    expect(() => validateCreativeDesignReferences(sceneWithDesign(blank))).toThrow(/message.*不能为空/iu);

    const blankObjectField = {
      ...validDesign,
      objects: [{...validDesign.objects[0], layout: '\t'}],
    };
    expect(creativeDesignSchema.safeParse(blankObjectField).success).toBe(false);

    const longId = {
      ...validDesign,
      objects: [{...validDesign.objects[0], id: 'x'.repeat(201)}, validDesign.objects[1]],
    };
    expect(creativeDesignSchema.safeParse(longId).success).toBe(false);

    const extra = {...validDesign, unexpected: '禁止'};
    expect(creativeDesignSchema.safeParse(extra).success).toBe(false);
  });
});
