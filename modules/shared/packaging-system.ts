import {getComponentDefinition} from './components.js';
import {executableRecipes} from './recipes.js';
import type {NormalizedRect, PackagingDecision, PackagingDensity, ProjectDocument, TimelineClip} from './project.js';

export type ThemeTokens = {
  id: string;
  name: string;
  colors: {canvas: string; surface: string; surfaceAlt: string; text: string; muted: string; accent: string; accentAlt: string; danger: string};
  typography: {fontFamily: string; displaySize: number; titleSize: number; bodySize: number; displayWeight: number; titleWeight: number};
  spacing: {xs: number; sm: number; md: number; lg: number; xl: number};
  radius: {sm: number; md: number; lg: number; pill: number};
  shadow: {soft: string; strong: string; glow: string};
};

export const themeRegistry: readonly ThemeTokens[] = [
  {id: 'midnight-tech', name: '午夜科技', colors: {canvas: '#080b12', surface: '#111827', surfaceAlt: '#172033', text: '#f7f9ff', muted: '#9aa8bd', accent: '#77e6d1', accentAlt: '#8792ff', danger: '#ff7777'}, typography: {fontFamily: 'Inter, PingFang SC, system-ui, sans-serif', displaySize: 84, titleSize: 64, bodySize: 42, displayWeight: 800, titleWeight: 720}, spacing: {xs: 8, sm: 14, md: 22, lg: 34, xl: 54}, radius: {sm: 10, md: 18, lg: 28, pill: 999}, shadow: {soft: '0 16px 44px rgba(0,0,0,.28)', strong: '0 28px 80px rgba(0,0,0,.5)', glow: '0 0 42px rgba(119,230,209,.24)'}},
  {id: 'warm-paper', name: '暖纸编辑', colors: {canvas: '#eee7dc', surface: '#f8f3eb', surfaceAlt: '#e2d6c6', text: '#24201b', muted: '#766b5f', accent: '#d8643f', accentAlt: '#345c6f', danger: '#b43f36'}, typography: {fontFamily: 'Songti SC, STSong, serif', displaySize: 82, titleSize: 62, bodySize: 40, displayWeight: 760, titleWeight: 700}, spacing: {xs: 8, sm: 16, md: 24, lg: 38, xl: 58}, radius: {sm: 4, md: 9, lg: 16, pill: 999}, shadow: {soft: '0 12px 32px rgba(60,45,28,.16)', strong: '0 26px 62px rgba(60,45,28,.28)', glow: '0 0 36px rgba(216,100,63,.18)'}},
  {id: 'clean-business', name: '清晰商务', colors: {canvas: '#f3f6f9', surface: '#ffffff', surfaceAlt: '#e8edf3', text: '#17212e', muted: '#687688', accent: '#1769d2', accentAlt: '#15a57a', danger: '#d13d48'}, typography: {fontFamily: 'Inter, PingFang SC, system-ui, sans-serif', displaySize: 80, titleSize: 60, bodySize: 40, displayWeight: 780, titleWeight: 700}, spacing: {xs: 8, sm: 14, md: 22, lg: 32, xl: 50}, radius: {sm: 8, md: 14, lg: 22, pill: 999}, shadow: {soft: '0 12px 36px rgba(29,52,78,.13)', strong: '0 24px 68px rgba(29,52,78,.22)', glow: '0 0 34px rgba(23,105,210,.16)'}},
  {id: 'minimal-mono', name: '极简黑白', colors: {canvas: '#0a0a0a', surface: '#151515', surfaceAlt: '#262626', text: '#f7f7f4', muted: '#9a9a96', accent: '#f7f7f4', accentAlt: '#b9b9b4', danger: '#ff5d5d'}, typography: {fontFamily: 'Helvetica Neue, PingFang SC, system-ui, sans-serif', displaySize: 88, titleSize: 64, bodySize: 42, displayWeight: 800, titleWeight: 720}, spacing: {xs: 8, sm: 16, md: 24, lg: 36, xl: 56}, radius: {sm: 0, md: 4, lg: 8, pill: 999}, shadow: {soft: '0 14px 38px rgba(0,0,0,.3)', strong: '0 28px 78px rgba(0,0,0,.56)', glow: '0 0 0 rgba(0,0,0,0)'}},
] as const;

export const getThemeTokens = (themeId?: unknown) => themeRegistry.find((theme) => theme.id === themeId) ?? themeRegistry[0];

export type UnifiedIconDefinition = {id: string; name: string; semanticTags: readonly string[]; styleFamily: 'geometric-outline'; colorStrategy: 'inherit-theme-accent'; viewBox: '0 0 24 24'; paths: readonly string[]; source: 'workbench-original'; license: 'project-original'};
const iconGeometryRegistry: readonly Omit<UnifiedIconDefinition, 'source' | 'license' | 'colorStrategy'>[] = [
  {id: 'spark-focus', name: '重点火花', semanticTags: ['hook', 'title'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2z']},
  {id: 'trend-up', name: '增长趋势', semanticTags: ['data', 'claim'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M4 17l5-5 4 3 7-8', 'M15 7h5v5']},
  {id: 'quote-mark', name: '核心观点', semanticTags: ['claim', 'summary'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M5 7h6v6H7v4H4v-6c0-2.2.3-3.2 1-4z', 'M14 7h6v6h-4v4h-3v-6c0-2.2.3-3.2 1-4z']},
  {id: 'step-path', name: '步骤路径', semanticTags: ['step'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M4 18h5v-5h5V8h6', 'M17 5l3 3-3 3']},
  {id: 'compare-split', name: '对比拆分', semanticTags: ['comparison'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M12 3v18', 'M4 8h5M6 5L3 8l3 3', 'M15 16h5m-2-3l3 3-3 3']},
  {id: 'warning-ring', name: '风险提醒', semanticTags: ['warning'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M12 3L2.8 20h18.4L12 3z', 'M12 9v5', 'M12 17h.01']},
  {id: 'check-seal', name: '确认完成', semanticTags: ['summary', 'cta'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M12 3l2.2 2 3-.1.8 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.8 2.9-3-.1-2.2 2-2.2-2-3 .1-.8-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.8-2.9 3 .1L12 3z', 'M8 12l2.5 2.5L16 9']},
  {id: 'target-ring', name: '目标聚焦', semanticTags: ['hook', 'claim'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M12 3a9 9 0 1 0 9 9', 'M12 7a5 5 0 1 0 5 5', 'M12 11v2', 'M16 4h4v4']},
  {id: 'lightbulb-line', name: '思路灵感', semanticTags: ['title', 'claim'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M9 18h6', 'M10 21h4', 'M8.5 15.5A6 6 0 1 1 15.5 15.5c-.8.6-1.3 1.3-1.5 2.5h-4c-.2-1.2-.7-1.9-1.5-2.5z']},
  {id: 'play-forward', name: '继续行动', semanticTags: ['cta'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M5 4l10 8L5 20V4z', 'M16 6l5 6-5 6']},
  {id: 'layers-stack', name: '分层结构', semanticTags: ['step', 'summary'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5']},
  {id: 'number-grid', name: '数据矩阵', semanticTags: ['data'], styleFamily: 'geometric-outline', viewBox: '0 0 24 24', paths: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z']},
] as const;
export const iconRegistry: readonly UnifiedIconDefinition[] = iconGeometryRegistry.map((icon) => ({...icon, colorStrategy: 'inherit-theme-accent', source: 'workbench-original', license: 'project-original'}));
export const getIconDefinition = (iconId?: unknown) => iconRegistry.find((icon) => icon.id === iconId) ?? null;

export type MotionPreset = {id: string; name: string; entrance: string; hold: string; exit: string; durationFrames: number; easing: string; direction: 'up' | 'down' | 'left' | 'right' | 'none'};
export const motionPresetRegistry: readonly MotionPreset[] = [
  {id: 'rise-soft', name: '柔和上升', entrance: 'fade-rise', hold: 'still', exit: 'fade', durationFrames: 18, easing: 'out-cubic', direction: 'up'},
  {id: 'pop-focus', name: '重点弹入', entrance: 'scale-pop', hold: 'pulse-once', exit: 'fade-scale', durationFrames: 14, easing: 'out-back', direction: 'none'},
  {id: 'count-up-medium', name: '数字递增', entrance: 'count-up', hold: 'glow', exit: 'fade', durationFrames: 24, easing: 'out-quart', direction: 'up'},
  {id: 'scan-reveal', name: '扫描显现', entrance: 'scan', hold: 'tracking-line', exit: 'fade', durationFrames: 22, easing: 'linear', direction: 'right'},
  {id: 'slide-left', name: '左侧滑入', entrance: 'slide', hold: 'still', exit: 'slide-fade', durationFrames: 18, easing: 'out-cubic', direction: 'left'},
  {id: 'wipe-vertical', name: '垂直揭示', entrance: 'wipe', hold: 'still', exit: 'wipe', durationFrames: 20, easing: 'in-out-cubic', direction: 'up'},
  {id: 'pulse-soft', name: '柔和脉冲', entrance: 'fade', hold: 'pulse', exit: 'fade', durationFrames: 16, easing: 'in-out-sine', direction: 'none'},
  {id: 'fade-clean', name: '干净淡入', entrance: 'fade', hold: 'still', exit: 'fade', durationFrames: 15, easing: 'in-out-quad', direction: 'none'},
] as const;
export const getMotionPreset = (presetId?: unknown) => motionPresetRegistry.find((preset) => preset.id === presetId) ?? null;

export type SfxPreset = {id: string; name: string; trigger: 'entrance' | 'emphasis' | 'exit'; durationMs: number; defaultVolume: number; duckingGain: number; synthesis: {wave: 'sine' | 'triangle'; frequency: number; endFrequency: number; attackMs: number; releaseMs: number}};
export const sfxPresetRegistry: readonly SfxPreset[] = [
  {id: 'soft-pop', name: '柔和弹入', trigger: 'entrance', durationMs: 180, defaultVolume: .16, duckingGain: .45, synthesis: {wave: 'sine', frequency: 180, endFrequency: 320, attackMs: 10, releaseMs: 130}},
  {id: 'data-tick', name: '数据轻点', trigger: 'emphasis', durationMs: 120, defaultVolume: .12, duckingGain: .4, synthesis: {wave: 'triangle', frequency: 720, endFrequency: 980, attackMs: 3, releaseMs: 90}},
  {id: 'alert-soft', name: '轻提醒', trigger: 'entrance', durationMs: 240, defaultVolume: .13, duckingGain: .35, synthesis: {wave: 'sine', frequency: 380, endFrequency: 260, attackMs: 12, releaseMs: 180}},
  {id: 'transition-whoosh', name: '轻转场', trigger: 'entrance', durationMs: 300, defaultVolume: .11, duckingGain: .32, synthesis: {wave: 'triangle', frequency: 120, endFrequency: 520, attackMs: 35, releaseMs: 190}},
  {id: 'confirm-chime', name: '确认提示', trigger: 'emphasis', durationMs: 260, defaultVolume: .13, duckingGain: .38, synthesis: {wave: 'sine', frequency: 520, endFrequency: 780, attackMs: 8, releaseMs: 200}},
] as const;
export const getSfxPreset = (presetId?: unknown) => sfxPresetRegistry.find((preset) => preset.id === presetId) ?? null;

const PACKAGING_DENSITY_MINIMUM_GAP_SECONDS: Record<PackagingDensity, number> = {restrained: 6, standard: 3, frequent: 1.2};
export const getPackagingDensityMinimumGapFrames = (density: PackagingDensity, fps: number) => Math.max(1, Math.round(PACKAGING_DENSITY_MINIMUM_GAP_SECONDS[density] * fps));

/** Keep automatic left/right packaging placement proportional across every supported aspect ratio. */
export const resolveSubjectLayoutOffset = (width: number, layout: 'center' | 'left' | 'right') => {
  const distance = width * (230 / 1080);
  return layout === 'left' ? distance : layout === 'right' ? -distance : 0;
};

export type PackagingSettingsImpact = {updatedClipIds: string[]; protectedClipIds: string[]};
export type PackagingGlobalChange = {themeId?: string; subjectLayout?: 'center' | 'left' | 'right'; motionPresetId?: string | null; sfxPresetId?: string | null};
/** Preview the exact global-theme/layout impact before the UI commits it. */
export const previewPackagingSettingsImpact = (
  project: ProjectDocument,
  patch: PackagingGlobalChange,
): PackagingSettingsImpact => {
  const updatedClipIds: string[] = [];
  const protectedClipIds: string[] = [];
  for (const clip of project.tracks.flatMap((track) => track.clips)) {
    if (clip.metadata.autoGenerated !== true) continue;
    const targetX = patch.subjectLayout ? resolveSubjectLayoutOffset(project.width, patch.subjectLayout) : 0;
    const affected = Boolean(patch.themeId && clip.metadata.themeId !== patch.themeId)
      || Boolean(patch.subjectLayout && clip.kind !== 'audio' && clip.transform.x !== targetX)
      || Boolean(patch.motionPresetId && clip.kind !== 'audio' && clip.metadata.motionPresetId !== patch.motionPresetId)
      || Boolean(patch.sfxPresetId && clip.kind === 'audio' && clip.metadata.sfxPresetId !== patch.sfxPresetId);
    if (!affected) continue;
    if (clip.metadata.manualOverride === true || clip.metadata.packagingLocked === true) protectedClipIds.push(clip.id);
    else updatedClipIds.push(clip.id);
  }
  return {updatedClipIds, protectedClipIds};
};

export const assertRegisteredPackagingDecision = (decision: PackagingDecision) => {
  if (decision.recipeId && !executableRecipes.some((recipe) => recipe.id === decision.recipeId)) throw new Error(`Unknown packaging recipe: ${decision.recipeId}`);
  if (decision.componentId && !getComponentDefinition(decision.componentId)) throw new Error(`Unknown packaging component: ${decision.componentId}`);
  if (decision.iconId && !getIconDefinition(decision.iconId)) throw new Error(`Unknown packaging icon: ${decision.iconId}`);
  if (decision.motionPresetId && !getMotionPreset(decision.motionPresetId)) throw new Error(`Unknown packaging motion preset: ${decision.motionPresetId}`);
  if (decision.sfxPresetId && !getSfxPreset(decision.sfxPresetId)) throw new Error(`Unknown packaging SFX preset: ${decision.sfxPresetId}`);
  if (!themeRegistry.some((theme) => theme.id === decision.themeId)) throw new Error(`Unknown packaging theme: ${decision.themeId}`);
  for (const alternative of decision.alternatives) {
    if (typeof alternative === 'string') {
      if (!executableRecipes.some((recipe) => recipe.id === alternative) && !getComponentDefinition(alternative)) throw new Error(`Unknown packaging alternative: ${alternative}`);
      continue;
    }
    if (alternative.recipeId && !executableRecipes.some((recipe) => recipe.id === alternative.recipeId)) throw new Error(`Unknown packaging alternative recipe: ${alternative.recipeId}`);
    if (alternative.componentId && !getComponentDefinition(alternative.componentId)) throw new Error(`Unknown packaging alternative component: ${alternative.componentId}`);
  }
  return decision;
};

const writeAscii = (view: DataView, offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
/** Deterministic PCM WAV bytes. No file, network, WebAudio or random state. */
export const createProceduralWav = (presetId: string, options: {sampleRate?: number; volume?: number} = {}) => {
  const preset = getSfxPreset(presetId);
  if (!preset) throw new Error(`Unknown SFX preset: ${presetId}`);
  const sampleRate = Math.max(8_000, Math.min(48_000, Math.round(options.sampleRate ?? 48_000)));
  const volume = Math.max(0, Math.min(.5, options.volume ?? preset.defaultVolume));
  const length = Math.max(1, Math.round(sampleRate * preset.durationMs / 1000));
  const bytes = new Uint8Array(44 + length * 2);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); writeAscii(view, 8, 'WAVE'); writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeAscii(view, 36, 'data'); view.setUint32(40, length * 2, true);
  let phase = 0;
  for (let index = 0; index < length; index += 1) {
    const timeMs = index / sampleRate * 1000;
    const progress = index / Math.max(1, length - 1);
    const frequency = preset.synthesis.frequency + (preset.synthesis.endFrequency - preset.synthesis.frequency) * progress;
    phase += Math.PI * 2 * frequency / sampleRate;
    const attack = Math.min(1, timeMs / Math.max(1, preset.synthesis.attackMs));
    const release = Math.min(1, (preset.durationMs - timeMs) / Math.max(1, preset.synthesis.releaseMs));
    const oscillator = preset.synthesis.wave === 'triangle' ? 2 / Math.PI * Math.asin(Math.sin(phase)) : Math.sin(phase);
    view.setInt16(44 + index * 2, Math.round(oscillator * attack * release * volume * 32767), true);
  }
  return bytes;
};

export const createProceduralWavDataUrl = (presetId: string, options: {sampleRate?: number; volume?: number} = {}) => {
  const bytes = createProceduralWav(presetId, options);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    encoded += alphabet[a >> 2];
    encoded += alphabet[((a & 3) << 4) | (b >> 4)];
    encoded += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : '=';
    encoded += hasC ? alphabet[c & 63] : '=';
  }
  return `data:audio/wav;base64,${encoded}`;
};

export type ResolvedSafeZones = {caption: NormalizedRect; person: NormalizedRect; template: NormalizedRect};
export const resolveSafeZones = (project: ProjectDocument, profile: 'center' | 'lower-third' | 'fullscreen' = 'center'): ResolvedSafeZones => {
  const caption = project.format === 'landscape'
    ? {x: .08, y: .75, width: .84, height: .17}
    : project.format === 'portrait'
      ? {x: .07, y: .74, width: .86, height: .18}
      : {x: .09, y: .76, width: .82, height: .14};
  const defaultPerson = project.packagingSettings.subjectLayout === 'left'
    ? project.format === 'square' ? {x: .06, y: .12, width: .38, height: .3} : {x: .04, y: .1, width: .36, height: .28}
    : project.packagingSettings.subjectLayout === 'right'
      ? project.format === 'square' ? {x: .56, y: .12, width: .38, height: .3} : {x: .6, y: .1, width: .36, height: .28}
      : project.format === 'square' ? {x: .28, y: .11, width: .44, height: .31} : {x: .32, y: .1, width: .36, height: .28};
  const centeredTemplate = project.packagingSettings.subjectLayout === 'left'
    ? project.format === 'square' ? {x: .5, y: .28, width: .42, height: .2} : {x: .48, y: .2, width: .48, height: .28}
    : project.packagingSettings.subjectLayout === 'right'
      ? project.format === 'square' ? {x: .08, y: .28, width: .42, height: .2} : {x: .04, y: .2, width: .48, height: .28}
      : project.format === 'square' ? {x: .12, y: .43, width: .76, height: .19} : {x: .1, y: .42, width: .8, height: .2};
  const template = profile === 'lower-third'
    ? project.format === 'square' ? {x: .08, y: .59, width: .84, height: .12} : {x: .05, y: .56, width: .9, height: .12}
    : profile === 'fullscreen'
      ? project.format === 'square' ? {x: .05, y: .06, width: .9, height: .64} : {x: .04, y: .05, width: .92, height: .62}
      : centeredTemplate;
  return {caption, person: project.packagingSettings.personSafeZone ?? defaultPerson, template};
};

const intersects = (left: NormalizedRect, right: NormalizedRect) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
export type EditorialConstraintCheck = {ruleId: string; passed: boolean; message: string; severity: 'error' | 'warning' | 'info'};
export const validatePackagingEditorial = (project: ProjectDocument, decision: PackagingDecision, clip?: TimelineClip | null): EditorialConstraintCheck[] => {
  const cue = project.semanticCues.find((candidate) => candidate.id === decision.cueId);
  const recipe = decision.recipeId ? executableRecipes.find((candidate) => candidate.id === decision.recipeId) ?? null : null;
  const component = decision.componentId ? getComponentDefinition(decision.componentId) : null;
  const routing = recipe ?? component;
  const safeZones = resolveSafeZones(project, routing?.safeZoneProfile ?? 'center');
  const text = cue?.captionIds.map((id) => project.captions.find((caption) => caption.id === id)?.text ?? '').join('') || clip?.text || '';
  const highEmphasisClips = project.tracks.flatMap((track) => track.clips).filter((candidate) => candidate.id !== clip?.id && candidate.metadata.packagingDecisionId !== decision.id && candidate.metadata.autoGenerated === true && candidate.metadata.emphasis === 'high');
  const highEmphasisOverlap = cue ? highEmphasisClips.some((candidate) => candidate.startFrame < cue.endFrame && candidate.startFrame + candidate.durationInFrames > cue.startFrame) : false;
  const cueIsHighEmphasis = cue?.emphasis === 'high' || typeof cue?.emphasis === 'number' && cue.emphasis >= .75;
  const minimumGapFrames = getPackagingDensityMinimumGapFrames(project.packagingSettings.density, project.fps);
  const highEmphasisTooClose = cueIsHighEmphasis && highEmphasisClips.some((candidate) => {
    const candidateEnd = candidate.startFrame + candidate.durationInFrames;
    const gap = cue ? cue.startFrame >= candidateEnd ? cue.startFrame - candidateEnd : candidate.startFrame >= cue.endFrame ? candidate.startFrame - cue.endFrame : 0 : Infinity;
    return gap < minimumGapFrames;
  });
  const icon = getIconDefinition(decision.iconId);
  const existingIconFamilies = new Set(project.tracks.flatMap((track) => track.clips).map((candidate) => candidate.metadata.iconStyleFamily).filter((value): value is string => typeof value === 'string'));
  const sfx = getSfxPreset(decision.sfxPresetId);
  return [
    {ruleId: 'registered-selection', passed: Boolean(recipe || component), message: recipe || component ? '配方或组件已注册' : '没有可执行的配方或组件', severity: 'error'},
    {ruleId: 'text-capacity', passed: !routing || text.length <= routing.textCapacity, message: !routing || text.length <= routing.textCapacity ? `文字容量 ${text.length}/${routing?.textCapacity ?? '∞'}` : `文字 ${text.length} 字，超过组件容量 ${routing.textCapacity} 字`, severity: 'warning'},
    {ruleId: 'caption-safe-zone', passed: !intersects(safeZones.template, safeZones.caption), message: intersects(safeZones.template, safeZones.caption) ? '包装区域与字幕安全区相交' : '未遮挡字幕安全区', severity: 'error'},
    {ruleId: 'person-safe-zone', passed: routing?.safeZoneProfile === 'fullscreen' ? project.packagingSettings.allowFullscreen : !intersects(safeZones.template, safeZones.person), message: routing?.safeZoneProfile === 'fullscreen' ? (project.packagingSettings.allowFullscreen ? '已允许全屏卡' : '工程禁止全屏卡') : (intersects(safeZones.template, safeZones.person) ? '包装区域与人物保护区相交' : '未遮挡人物保护区'), severity: 'error'},
    {ruleId: 'single-high-emphasis', passed: !highEmphasisOverlap, message: highEmphasisOverlap ? '同一时段已有高强调视觉' : '本屏只有一个核心重点', severity: 'warning'},
    {ruleId: 'high-emphasis-spacing', passed: !highEmphasisTooClose, message: highEmphasisTooClose ? `相邻高强调不足 ${(minimumGapFrames / project.fps).toFixed(1)} 秒` : `高强调间隔满足 ${(minimumGapFrames / project.fps).toFixed(1)} 秒`, severity: 'warning'},
    {ruleId: 'icon-style-consistency', passed: !icon || existingIconFamilies.size === 0 || existingIconFamilies.has(icon.styleFamily), message: !icon || existingIconFamilies.size === 0 || existingIconFamilies.has(icon.styleFamily) ? '图标风格保持统一' : '图标风格与工程不一致', severity: 'warning'},
    {ruleId: 'voice-safe-sfx', passed: !sfx || sfx.defaultVolume <= .18 && sfx.duckingGain <= .5, message: !sfx ? '无音效版本可正常生成' : `音效 ${Math.round(sfx.defaultVolume * 100)}%，旁白避让 ${Math.round(sfx.duckingGain * 100)}%`, severity: 'warning'},
  ];
};
