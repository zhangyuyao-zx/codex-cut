import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {createSceneModules} from './scene-modules';
import type {SceneModuleInput} from './SceneModuleSurface';
import {buildTalkingHeadMediaPlan} from './scenes/TalkingHeadMedia';
import {viewAt} from '../tools/talking-head-production/releases/1.0.0';

const base = (parameters: Record<string, unknown> = {}): SceneModuleInput => ({
  id: 'demo', from: 300, duration: 240, title: 'Material handoff', words: [], mediaSrc: '/main.mp4',
  materials: [{id: 'evidence', src: '/source.jpg', kind: 'image'}],
  beats: [
    {wordId: 'w1', label: 'material-in', frame: 30, durationFrames: 12},
    {wordId: 'w2', label: 'material-focus', frame: 90, durationFrames: 20},
    {wordId: 'w3', label: 'return-person', frame: 190, durationFrames: 15},
  ],
  parameters: {personDurationFrames: 600, materialWidth: 1600, materialHeight: 1000, ...parameters},
});

describe('native talking-head material integration', () => {
  it('loads the real manifest and recursively fingerprints the versioned renderer', async () => {
    const service = createSceneModules(path.resolve(import.meta.dirname, '..'));
    const detail = await service.detail('talking-head-media');
    expect(detail.acceptsMaterials).toBe(true);
    expect(detail.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(detail.objects?.map((o) => o.id)).toEqual(['person', 'material', 'focus', 'headline', 'source']);
    const resolved = await service.validate({moduleId: 'talking-head-media', parameters: base().parameters});
    expect(resolved.resolvedParameters.treatment).toBe('handoff');
    expect(() => buildTalkingHeadMediaPlan(base(resolved.resolvedParameters))).not.toThrow();
  });
  it('uses the actual main-source trim and beat-specific durations through all roles', () => {
    const plan = buildTalkingHeadMediaPlan(base());
    expect(plan.person.trimBefore).toBe(300);
    expect(plan.show).toEqual({at: 30, duration: 12});
    expect(plan.end).toBe(205);
    expect(viewAt(plan.personInitial, plan.personChanges, 42).rect.width).toBe(600);
    expect(viewAt(plan.personInitial, plan.personChanges, 110).rect.width).toBe(300);
    expect(viewAt(plan.personInitial, plan.personChanges, 205).rect.width).toBe(1920);
  });
  it('rejects an unbound asset, duplicate IDs, missing cue, or overlapping real timings', () => {
    expect(() => buildTalkingHeadMediaPlan({...base(), materials: []})).toThrow('唯一素材');
    expect(() => buildTalkingHeadMediaPlan({...base(), materials: [...base().materials, ...base().materials]})).toThrow('唯一素材');
    expect(() => buildTalkingHeadMediaPlan(base({focusCue: 'absent'}))).toThrow('Missing beat');
    const scene = base(); scene.beats[1].frame = 35;
    expect(() => buildTalkingHeadMediaPlan(scene)).toThrow('overlap');
  });
  it('requires original screenshot dimensions, crop bounds and enough trimmed source footage', () => {
    expect(() => buildTalkingHeadMediaPlan(base({treatment: 'evidence', cropX: .8, cropWidth: .4}))).toThrow('原图内');
    const scene = base({treatment: 'evidence'}); scene.materials[0].kind = 'video';
    expect(() => buildTalkingHeadMediaPlan({...scene, parameters: {...scene.parameters, materialDurationFrames: 600}})).toThrow('实际截图');
    expect(() => buildTalkingHeadMediaPlan({...scene, parameters: {...scene.parameters, treatment: 'handoff', materialDurationFrames: 180, materialTrimBefore: 20}})).toThrow('insufficient');
    expect(() => buildTalkingHeadMediaPlan(base({personDurationFrames: 500}))).toThrow('insufficient');
  });
  it('preserves a whole-page context while extracting original pixels and supports hiding the host', () => {
    const plan = buildTalkingHeadMediaPlan(base({treatment: 'evidence', focusPerson: 'hidden'}));
    const page = viewAt(plan.materialInitial, plan.materialChanges, 130);
    expect(page.opacity).toBe(.34);
    expect(viewAt(plan.cropInitial, plan.cropChanges, 130).opacity).toBe(1);
    expect(viewAt(plan.personInitial, plan.personChanges, 130).opacity).toBe(0);
  });
});
