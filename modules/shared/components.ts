import {z} from 'zod';
import {defaultTextStyle, defaultTransform, type AssetRef, type ProjectDocument, type TimelineClip} from './project.js';

export const componentIdValues = [
  'curvable-typewriter',
  'curvable-slide-reveal',
  'curvable-cascading-text',
  'curvable-text-swap',
  'curvable-text-hover',
  'curvable-paste-pill',
  'curvable-types',
  'curvable-bulb-bg',
  'curvable-two-drops-bg',
  'curvable-ellipse-bloom',
  'curvable-grainient-bg',
  'curvable-floating-stack',
  'curvable-prompt-input',
  'curvable-stats-grid',
  'playground-audio-waveform',
  'playground-audio-spectrum',
  'playground-beat-detection',
  'playground-volume-control',
  'workbench-circle-video-frame',
  'workbench-device-mockup',
  'workbench-verdict-stamp',
  'workbench-chapter-title',
  'workbench-count-up-proof',
  'workbench-upgrade-progress',
] as const;

export type WorkbenchComponentId = (typeof componentIdValues)[number];
export type ComponentPropValue = string | number;
export type ComponentProps = Record<string, ComponentPropValue>;
export type ComponentVisualAssetKind = Extract<AssetRef['kind'], 'video' | 'image'>;
export type ComponentAssetSlot = {
  id: 'primary';
  label: string;
  /** Asset kinds accepted by this slot. Audio is deliberately not accepted. */
  compatibleKinds: readonly ComponentVisualAssetKind[];
  /** Optional preference used by deterministic clip creation when several assets fit. */
  preferredKinds?: readonly ComponentVisualAssetKind[];
};
export const componentPropsSchema = z.record(z.string(), z.union([z.string(), z.number()]));
export const componentMetadataSchema = z.object({
  componentId: z.string().min(1),
  componentProps: componentPropsSchema,
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  license: z.string().min(1),
  adaptation: z.literal('local-workbench'),
  syntheticAudioPreview: z.boolean(),
}).passthrough();
export type ComponentControl = {
  key: string;
  label: string;
  type: 'text' | 'color' | 'number';
  min?: number;
  max?: number;
  step?: number;
};

export type ComponentSemanticRoutingMetadata = {
  semanticTags: string[];
  roles: string[];
  safeZoneProfile: 'center' | 'lower-third' | 'fullscreen';
  styleFamily: string;
  textCapacity: number;
};

export type WorkbenchComponentDefinition = {
  id: WorkbenchComponentId;
  name: string;
  source: 'Curvable' | 'Playground' | 'Workbench';
  sourceUrl: string;
  license: string;
  category: string;
  description: string;
  durationInFrames: number;
  supportsText: boolean;
  syntheticAudio: boolean;
  defaultProps: ComponentProps;
  controls: ComponentControl[];
  /** Optional visual asset slots. The two media components expose one `primary` slot. */
  assetSlots?: ComponentAssetSlot[];
  /** Singular alias kept for callers that only need the one primary slot. */
  assetSlot?: ComponentAssetSlot;
} & ComponentSemanticRoutingMetadata;

export type ReferenceComponentEntry = {
  id: string;
  name: string;
  source: string;
  category: string;
  summary: string;
  sourceUrl: string;
  license: string;
  executable: boolean;
};

const CURVABLE_URL = 'https://github.com/Curvable/motion/tree/main/src/components';
const PLAYGROUND_URL = 'https://github.com/jessai2026/remotion-playground/tree/main/src/compositions/Audio';
const WORKBENCH_URL = 'workbench://components';

const textControls: ComponentControl[] = [
  {key: 'text', label: '文字', type: 'text'},
  {key: 'accent', label: '主色', type: 'color'},
  {key: 'backgroundColor', label: '背景色', type: 'color'},
  {key: 'speed', label: '速度', type: 'number', min: 0.25, max: 3, step: 0.05},
];

const textAndIntensityControls: ComponentControl[] = [...textControls, {key: 'intensity', label: '强度', type: 'number', min: 0, max: 1, step: 0.05}];
const textAndDensityControls: ComponentControl[] = [...textControls, {key: 'density', label: '密度', type: 'number', min: 0.2, max: 1, step: 0.05}];

const componentRouting: Partial<Record<WorkbenchComponentId, ComponentSemanticRoutingMetadata>> = {
  'curvable-typewriter': {semanticTags: ['title', 'hook'], roles: ['opener', 'orientation'], safeZoneProfile: 'center', styleFamily: 'kinetic-type', textCapacity: 30},
  'curvable-slide-reveal': {semanticTags: ['hook', 'claim', 'summary'], roles: ['hero', 'emphasis'], safeZoneProfile: 'center', styleFamily: 'slide-type', textCapacity: 28},
  'curvable-cascading-text': {semanticTags: ['step', 'summary'], roles: ['sequence', 'structure'], safeZoneProfile: 'center', styleFamily: 'cascading-type', textCapacity: 42},
  'curvable-text-swap': {semanticTags: ['claim', 'comparison'], roles: ['keyword', 'swap'], safeZoneProfile: 'center', styleFamily: 'text-swap', textCapacity: 28},
  'curvable-text-hover': {semanticTags: ['claim', 'data'], roles: ['emphasis', 'keyword'], safeZoneProfile: 'center', styleFamily: 'light-sweep', textCapacity: 26},
  'curvable-paste-pill': {semanticTags: ['cta', 'summary'], roles: ['status', 'call-to-action'], safeZoneProfile: 'lower-third', styleFamily: 'interface-pill', textCapacity: 24},
  'curvable-types': {semanticTags: ['hook', 'title'], roles: ['hero', 'opener'], safeZoneProfile: 'center', styleFamily: 'zoom-type', textCapacity: 24},
  'curvable-bulb-bg': {semanticTags: ['title', 'claim'], roles: ['background', 'mood'], safeZoneProfile: 'center', styleFamily: 'ambient-glow', textCapacity: 28},
  'curvable-two-drops-bg': {semanticTags: ['claim', 'summary'], roles: ['background', 'mood'], safeZoneProfile: 'fullscreen', styleFamily: 'gradient-flow', textCapacity: 28},
  'curvable-ellipse-bloom': {semanticTags: ['warning', 'hook'], roles: ['focus', 'emphasis'], safeZoneProfile: 'center', styleFamily: 'bloom-focus', textCapacity: 24},
  'curvable-grainient-bg': {semanticTags: ['claim', 'summary'], roles: ['background', 'texture'], safeZoneProfile: 'fullscreen', styleFamily: 'grain-gradient', textCapacity: 28},
  'curvable-floating-stack': {semanticTags: ['comparison', 'claim'], roles: ['cards', 'context'], safeZoneProfile: 'fullscreen', styleFamily: 'floating-cards', textCapacity: 36},
  'curvable-prompt-input': {semanticTags: ['hook', 'cta'], roles: ['interface', 'call-to-action'], safeZoneProfile: 'center', styleFamily: 'prompt-ui', textCapacity: 32},
  'curvable-stats-grid': {semanticTags: ['data', 'summary'], roles: ['metric', 'overview'], safeZoneProfile: 'center', styleFamily: 'stats-grid', textCapacity: 36},
  'playground-audio-waveform': {semanticTags: ['claim'], roles: ['audio-context'], safeZoneProfile: 'center', styleFamily: 'synthetic-audio', textCapacity: 24},
  'playground-audio-spectrum': {semanticTags: ['data'], roles: ['audio-context'], safeZoneProfile: 'center', styleFamily: 'synthetic-audio', textCapacity: 24},
  'playground-beat-detection': {semanticTags: ['hook'], roles: ['audio-context'], safeZoneProfile: 'center', styleFamily: 'synthetic-audio', textCapacity: 24},
  'playground-volume-control': {semanticTags: ['data'], roles: ['audio-context'], safeZoneProfile: 'center', styleFamily: 'synthetic-audio', textCapacity: 18},
  'workbench-circle-video-frame': {semanticTags: ['claim', 'title', 'context'], roles: ['visual-anchor', 'b-roll'], safeZoneProfile: 'center', styleFamily: 'circle-media', textCapacity: 30},
  'workbench-device-mockup': {semanticTags: ['claim', 'title', 'context'], roles: ['product-frame', 'b-roll'], safeZoneProfile: 'center', styleFamily: 'device-media', textCapacity: 30},
  'workbench-verdict-stamp': {semanticTags: ['claim', 'warning', 'summary'], roles: ['verdict', 'emphasis'], safeZoneProfile: 'center', styleFamily: 'verdict-stamp', textCapacity: 22},
  'workbench-chapter-title': {semanticTags: ['title', 'step'], roles: ['chapter', 'orientation'], safeZoneProfile: 'center', styleFamily: 'chapter-title', textCapacity: 34},
  'workbench-count-up-proof': {semanticTags: ['data'], roles: ['metric', 'proof'], safeZoneProfile: 'center', styleFamily: 'count-up-proof', textCapacity: 28},
  'workbench-upgrade-progress': {semanticTags: ['comparison', 'step', 'data'], roles: ['progress', 'before-after'], safeZoneProfile: 'center', styleFamily: 'upgrade-progress', textCapacity: 30},
};

const fallbackRouting = (definition: {category: string; syntheticAudio: boolean}): ComponentSemanticRoutingMetadata => ({
  semanticTags: definition.syntheticAudio ? ['claim'] : ['claim', 'summary'],
  roles: definition.syntheticAudio ? ['audio-context'] : ['support'],
  safeZoneProfile: definition.category === '背景' ? 'fullscreen' : 'center',
  styleFamily: definition.syntheticAudio ? 'synthetic-audio' : 'local-component',
  textCapacity: 28,
});

const makeDefinition = (definition: Omit<WorkbenchComponentDefinition, 'sourceUrl' | 'license' | keyof ComponentSemanticRoutingMetadata> & {file: string}): WorkbenchComponentDefinition => ({
  ...definition,
  assetSlot: definition.assetSlot ?? definition.assetSlots?.[0],
  sourceUrl: definition.source === 'Curvable' ? `${CURVABLE_URL}/${definition.file}` : definition.source === 'Playground' ? `${PLAYGROUND_URL}/${definition.file}` : `${WORKBENCH_URL}/${definition.id}`,
  license: definition.source === 'Workbench' ? 'project-original' : 'MIT',
  ...(componentRouting[definition.id] ?? fallbackRouting(definition)),
});

export const curatedComponents: WorkbenchComponentDefinition[] = [
  makeDefinition({id: 'curvable-typewriter', name: 'Typewriter', source: 'Curvable', file: 'typewriter.tsx', category: '文字', description: '逐字出现的打字机标题，带确定性的光标重音。', durationInFrames: 150, supportsText: true, syntheticAudio: false, defaultProps: {text: '把想法变成画面', accent: '#ffbd63', backgroundColor: '#11151c', speed: 1, intensity: 0.8}, controls: textAndIntensityControls}),
  makeDefinition({id: 'curvable-slide-reveal', name: 'SlideReveal', source: 'Curvable', file: 'slide-reveal.tsx', category: '文字', description: '沿水平轨道滑入并揭示一句标题。', durationInFrames: 135, supportsText: true, syntheticAudio: false, defaultProps: {text: '先让选择成立', accent: '#8b95ff', backgroundColor: '#10131a', speed: 1, intensity: 0.75}, controls: textAndIntensityControls}),
  makeDefinition({id: 'curvable-cascading-text', name: 'CascadingText', source: 'Curvable', file: 'cascading-text.tsx', category: '文字', description: '多行文字按阶梯节拍错峰落位。', durationInFrames: 150, supportsText: true, syntheticAudio: false, defaultProps: {text: '第一步\n第二步\n第三步', accent: '#73d4a7', backgroundColor: '#10151a', speed: 1, density: 0.75}, controls: textAndDensityControls}),
  makeDefinition({id: 'curvable-text-swap', name: 'TextSwap', source: 'Curvable', file: 'text-swap.tsx', category: '文字', description: '固定句干中的关键词按帧交换。', durationInFrames: 150, supportsText: true, syntheticAudio: false, defaultProps: {text: '效率|清晰|可控', accent: '#f47a78', secondaryColor: '#ffbd63', backgroundColor: '#17131a', speed: 1, intensity: 0.7}, controls: [...textControls, {key: 'secondaryColor', label: '辅色', type: 'color'}, {key: 'intensity', label: '强度', type: 'number', min: 0, max: 1, step: 0.05}]}),
  makeDefinition({id: 'curvable-text-hover', name: 'TextHover / LightSweep', source: 'Curvable', file: 'text-hover.tsx', category: '文字', description: '文字保持稳定，光带按确定性相位扫过。', durationInFrames: 150, supportsText: true, syntheticAudio: false, defaultProps: {text: '每一帧都可控', accent: '#71d9d1', backgroundColor: '#101519', speed: 1, intensity: 0.75}, controls: textAndIntensityControls}),
  makeDefinition({id: 'curvable-paste-pill', name: 'PastePill', source: 'Curvable', file: 'paste-pill.tsx', category: '界面', description: '胶囊提示从下方弹入，适合展示复制或完成状态。', durationInFrames: 135, supportsText: true, syntheticAudio: false, defaultProps: {text: '已复制到剪贴板', accent: '#f1e7d5', backgroundColor: '#23222a', speed: 1, intensity: 0.7}, controls: textAndIntensityControls}),
  makeDefinition({id: 'curvable-types', name: 'CurvableTypes / ZoomTypedReveal', source: 'Curvable', file: 'curvable-types.tsx', category: '文字', description: '大字由远及近放大并逐字揭示。', durationInFrames: 150, supportsText: true, syntheticAudio: false, defaultProps: {text: 'Zoom into the idea', accent: '#b98cff', backgroundColor: '#12101b', speed: 1, intensity: 0.8}, controls: textAndIntensityControls}),
  makeDefinition({id: 'curvable-bulb-bg', name: 'BulbBg', source: 'Curvable', file: 'bulb-bg.tsx', category: '背景', description: '暖色灯泡光晕以稳定相位呼吸，承载标题。', durationInFrames: 150, supportsText: true, syntheticAudio: false, defaultProps: {text: '一个好点子', accent: '#ffbd63', backgroundColor: '#111217', speed: 1, intensity: 0.75}, controls: textAndIntensityControls}),
  makeDefinition({id: 'curvable-two-drops-bg', name: 'TwoDropsBg', source: 'Curvable', file: 'two-drops-bg.tsx', category: '背景', description: '两枚渐变液滴沿互补轨道移动。', durationInFrames: 165, supportsText: true, syntheticAudio: false, defaultProps: {text: '流动的想法', accent: '#73d4a7', secondaryColor: '#8b95ff', backgroundColor: '#0d1218', speed: 1, intensity: 0.72}, controls: [...textControls, {key: 'secondaryColor', label: '辅色', type: 'color'}, {key: 'intensity', label: '强度', type: 'number', min: 0, max: 1, step: 0.05}]}),
  makeDefinition({id: 'curvable-ellipse-bloom', name: 'EllipseBloom', source: 'Curvable', file: 'ellipse-bloom.tsx', category: '背景', description: '椭圆光晕从中心扩散后回落。', durationInFrames: 150, supportsText: true, syntheticAudio: false, defaultProps: {text: '聚光于此', accent: '#f47a78', backgroundColor: '#171016', speed: 1, intensity: 0.8}, controls: textAndIntensityControls}),
  makeDefinition({id: 'curvable-grainient-bg', name: 'GrainientBg', source: 'Curvable', file: 'grainient-bg.tsx', category: '背景', description: '用纯 CSS/SVG 近似的渐变颗粒背景，不依赖网络或 WebGL。', durationInFrames: 165, supportsText: true, syntheticAudio: false, defaultProps: {text: '稳定的纹理', accent: '#ffbd63', secondaryColor: '#b98cff', backgroundColor: '#0e1116', speed: 1, density: 0.55}, controls: [...textControls, {key: 'secondaryColor', label: '辅色', type: 'color'}, {key: 'density', label: '颗粒密度', type: 'number', min: 0.2, max: 1, step: 0.05}]}),
  makeDefinition({id: 'curvable-floating-stack', name: 'FloatingStack', source: 'Curvable', file: 'floating-stack.tsx', category: '界面', description: '多张内容卡按层级浮起并保持轻微相位差。', durationInFrames: 165, supportsText: true, syntheticAudio: false, defaultProps: {text: '每层都在工作', accent: '#8b95ff', backgroundColor: '#11131c', speed: 1, density: 0.7}, controls: textAndDensityControls}),
  makeDefinition({id: 'curvable-prompt-input', name: 'PromptInput', source: 'Curvable', file: 'prompt-input.tsx', category: '界面', description: '提示词输入框逐字填入并提交，作为产品 UI 语法。', durationInFrames: 165, supportsText: true, syntheticAudio: false, defaultProps: {text: '让画面讲清楚因果', accent: '#71d9d1', backgroundColor: '#11151a', speed: 1, intensity: 0.7}, controls: textAndIntensityControls}),
  makeDefinition({id: 'curvable-stats-grid', name: 'StatsGrid', source: 'Curvable', file: 'stats-grid.tsx', category: '数据', description: '统计卡片由网格逐张点亮，数字保持可读。', durationInFrames: 165, supportsText: true, syntheticAudio: false, defaultProps: {text: '效率\n清晰\n可控', accent: '#73d4a7', secondaryColor: '#ffbd63', backgroundColor: '#10151a', speed: 1, value: 78}, controls: [...textControls, {key: 'secondaryColor', label: '辅色', type: 'color'}, {key: 'value', label: '数值', type: 'number', min: 0, max: 100, step: 1}]}),
  makeDefinition({id: 'playground-audio-waveform', name: 'AudioWaveform', source: 'Playground', file: 'AudioWaveform.jsx', category: '音频可视化', description: '确定性合成波形预览；此工作台版本没有绑定真实音频分析。', durationInFrames: 150, supportsText: true, syntheticAudio: true, defaultProps: {text: 'Synthetic waveform preview', accent: '#73d4a7', backgroundColor: '#0d1715', speed: 1, intensity: 0.8, density: 0.8}, controls: [...textControls, {key: 'intensity', label: '强度', type: 'number', min: 0, max: 1, step: 0.05}, {key: 'density', label: '密度', type: 'number', min: 0.2, max: 1, step: 0.05}]}),
  makeDefinition({id: 'playground-audio-spectrum', name: 'AudioSpectrum', source: 'Playground', file: 'AudioSpectrum.jsx', category: '音频可视化', description: '确定性合成频谱柱预览；此工作台版本没有绑定真实音频分析。', durationInFrames: 150, supportsText: true, syntheticAudio: true, defaultProps: {text: 'Synthetic spectrum preview', accent: '#8b95ff', backgroundColor: '#10121b', speed: 1, intensity: 0.8, density: 0.78}, controls: [...textControls, {key: 'intensity', label: '强度', type: 'number', min: 0, max: 1, step: 0.05}, {key: 'density', label: '密度', type: 'number', min: 0.2, max: 1, step: 0.05}]}),
  makeDefinition({id: 'playground-beat-detection', name: 'BeatDetection', source: 'Playground', file: 'BeatDetection.jsx', category: '音频可视化', description: '确定性合成节拍脉冲预览；此工作台版本没有绑定真实音频分析。', durationInFrames: 150, supportsText: true, syntheticAudio: true, defaultProps: {text: 'Synthetic beat preview', accent: '#f47a78', secondaryColor: '#ffbd63', backgroundColor: '#171116', speed: 1, intensity: 0.8, density: 0.7}, controls: [...textControls, {key: 'secondaryColor', label: '辅色', type: 'color'}, {key: 'intensity', label: '强度', type: 'number', min: 0, max: 1, step: 0.05}]}),
  makeDefinition({id: 'playground-volume-control', name: 'VolumeControl', source: 'Playground', file: 'VolumeControl.jsx', category: '音频可视化', description: '确定性合成音量表预览；此工作台版本没有绑定真实音频分析。', durationInFrames: 135, supportsText: true, syntheticAudio: true, defaultProps: {text: '-12 dB', accent: '#71d9d1', backgroundColor: '#101719', speed: 1, intensity: 0.75, value: 62}, controls: [...textControls, {key: 'intensity', label: '强度', type: 'number', min: 0, max: 1, step: 0.05}, {key: 'value', label: '音量值', type: 'number', min: 0, max: 100, step: 1}]}),
  makeDefinition({id: 'workbench-circle-video-frame', name: '圆形视频框', source: 'Workbench', file: 'workbench-circle-video-frame', category: '媒体框', description: '把一条视频或图片裁成稳定的圆形视觉锚点；嵌套视频始终静音。', durationInFrames: 165, supportsText: true, syntheticAudio: false, defaultProps: {text: '现场证据', accent: '#71d9d1', backgroundColor: '#0f151a', speed: 1, intensity: 0.8}, controls: textAndIntensityControls, assetSlots: [{id: 'primary', label: '主视觉素材', compatibleKinds: ['video', 'image'], preferredKinds: ['video', 'image']}] }),
  makeDefinition({id: 'workbench-device-mockup', name: '设备模型', source: 'Workbench', file: 'workbench-device-mockup', category: '媒体框', description: '在设备外框中展示视频或图片；嵌套视频始终静音以避免重复旁白。', durationInFrames: 180, supportsText: true, syntheticAudio: false, defaultProps: {text: '产品画面', accent: '#ffbd63', backgroundColor: '#101217', speed: 1, intensity: 0.78}, controls: textAndIntensityControls, assetSlots: [{id: 'primary', label: '设备屏幕素材', compatibleKinds: ['video', 'image'], preferredKinds: ['video', 'image']}] }),
  makeDefinition({id: 'workbench-verdict-stamp', name: '观点印章', source: 'Workbench', file: 'workbench-verdict-stamp', category: '强调', description: '用带图标的印章快速落下一句观点、警告或结论。', durationInFrames: 120, supportsText: true, syntheticAudio: false, defaultProps: {text: '结论成立', accent: '#f47a78', backgroundColor: '#171116', speed: 1, intensity: 0.82, icon: '✓'}, controls: textAndIntensityControls}),
  makeDefinition({id: 'workbench-chapter-title', name: '章节标题', source: 'Workbench', file: 'workbench-chapter-title', category: '文字', description: '以章节编号和标题交代下一步结构，适配横竖方三种画幅。', durationInFrames: 150, supportsText: true, syntheticAudio: false, defaultProps: {text: '让选择成立', title: '让选择成立', chapter: 1, accent: '#8b95ff', backgroundColor: '#10131a', speed: 1, intensity: 0.76}, controls: [...textControls, {key: 'chapter', label: '章节号', type: 'number', min: 1, max: 99, step: 1}, {key: 'title', label: '章节标题', type: 'text'}]}),
  makeDefinition({id: 'workbench-count-up-proof', name: '数字递增', source: 'Workbench', file: 'workbench-count-up-proof', category: '数据', description: '用确定性的数字递增把可核对的证据做成视觉重点。', durationInFrames: 135, supportsText: true, syntheticAudio: false, defaultProps: {text: '效率提升', value: 78, suffix: '%', accent: '#73d4a7', backgroundColor: '#10151a', speed: 1, intensity: 0.8}, controls: [...textControls, {key: 'value', label: '目标数值', type: 'number', min: 0, max: 999999, step: 1}, {key: 'suffix', label: '单位', type: 'text'}]}),
  makeDefinition({id: 'workbench-upgrade-progress', name: '升级进度条', source: 'Workbench', file: 'workbench-upgrade-progress', category: '数据', description: '同时呈现升级前后标签与进度，适合对比和步骤语义。', durationInFrames: 165, supportsText: true, syntheticAudio: false, defaultProps: {text: '升级进度', label: '升级进度', before: 32, after: 82, accent: '#71d9d1', backgroundColor: '#101719', speed: 1, intensity: 0.8}, controls: [...textControls, {key: 'label', label: '标签', type: 'text'}, {key: 'before', label: '升级前', type: 'number', min: 0, max: 100, step: 1}, {key: 'after', label: '升级后', type: 'number', min: 0, max: 100, step: 1}]}),
];

export const curatedComponentIds = curatedComponents.map((component) => component.id);

const componentById = new Map(curatedComponents.map((component) => [component.id, component]));

export const getComponentAssetSlot = (component: WorkbenchComponentDefinition | null | undefined, slotId: ComponentAssetSlot['id'] = 'primary'): ComponentAssetSlot | null => {
  if (!component) return null;
  return component.assetSlots?.find((slot) => slot.id === slotId) ?? (component.assetSlot?.id === slotId ? component.assetSlot : null);
};

export const getCompatibleComponentAssets = (component: WorkbenchComponentDefinition | null | undefined, assets: readonly AssetRef[], slotId: ComponentAssetSlot['id'] = 'primary'): AssetRef[] => {
  const slot = getComponentAssetSlot(component, slotId);
  if (!slot) return [];
  return assets.filter((asset) => slot.compatibleKinds.includes(asset.kind as ComponentVisualAssetKind));
};

const selectDefaultComponentAsset = (component: WorkbenchComponentDefinition, project: ProjectDocument): AssetRef | null => {
  const slot = getComponentAssetSlot(component);
  if (!slot) return null;
  const compatible = getCompatibleComponentAssets(component, project.assets).filter((asset) => !asset.offline);
  if (compatible.length === 0) return null;
  const preference = slot.preferredKinds ?? slot.compatibleKinds;
  return preference.reduce<AssetRef | null>((selected, kind) => selected ?? compatible.find((asset) => asset.kind === kind) ?? null, null) ?? compatible[0] ?? null;
};

export type ComponentAssetTiming = Pick<TimelineClip, 'sourceStartMs' | 'sourceEndMs'>;

/**
 * Resolve the source window for a visual component that follows an existing
 * A-roll/B-roll video at the insertion playhead. The timeline is frame-based,
 * while the media contract is milliseconds, so the conversion deliberately
 * uses the project's fps and the source clip's playback rate.
 */
export const resolveComponentAssetTiming = (project: ProjectDocument, asset: AssetRef, playheadFrame: number): ComponentAssetTiming => {
  if (asset.kind !== 'video') return {sourceStartMs: 0, sourceEndMs: null};
  const fps = Number.isFinite(project.fps) && project.fps > 0 ? project.fps : 1;
  const matchingSourceClip = project.tracks
    .filter((track) => track.id === 'track-a-roll' || track.id === 'track-b-roll')
    .flatMap((track) => track.clips)
    .filter((clip) => clip.assetId === asset.id && clip.kind === 'video' && playheadFrame >= clip.startFrame && playheadFrame < clip.startFrame + clip.durationInFrames)
    .sort((left, right) => left.startFrame - right.startFrame || left.id.localeCompare(right.id))[0];
  const assetEnd = asset.durationMs > 0 ? asset.durationMs : null;
  if (!matchingSourceClip) return {sourceStartMs: 0, sourceEndMs: assetEnd};
  const playbackRate = Number.isFinite(matchingSourceClip.playbackRate) && matchingSourceClip.playbackRate > 0 ? matchingSourceClip.playbackRate : 1;
  const elapsedMs = Math.max(0, playheadFrame - matchingSourceClip.startFrame) / fps * 1000 * playbackRate;
  const clipEnd = matchingSourceClip.sourceEndMs;
  const sourceBoundary = clipEnd === null ? assetEnd : assetEnd === null ? clipEnd : Math.min(clipEnd, assetEnd);
  const unclampedStart = Math.max(0, matchingSourceClip.sourceStartMs + elapsedMs);
  const sourceStartMs = sourceBoundary === null ? unclampedStart : Math.min(unclampedStart, sourceBoundary);
  return {sourceStartMs, sourceEndMs: sourceBoundary === null ? null : Math.max(sourceStartMs, sourceBoundary)};
};

export const getComponentDefinition = (componentId: unknown): WorkbenchComponentDefinition | null => {
  if (typeof componentId !== 'string') return null;
  return componentById.get(componentId as WorkbenchComponentId) ?? null;
};

export const getComponentProps = (clip: TimelineClip): ComponentProps => {
  const definition = getComponentDefinition(clip.metadata.componentId);
  const stored = clip.metadata.componentProps;
  const props = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
  const merged: ComponentProps = {...(definition?.defaultProps ?? {})};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' || typeof value === 'number') merged[key] = value;
  }
  if (clip.text !== null && definition?.supportsText) merged.text = clip.text;
  return merged;
};

export const createComponentClip = (componentId: WorkbenchComponentId, project: ProjectDocument, playheadFrame = project.playheadFrame): TimelineClip => {
  const definition = getComponentDefinition(componentId);
  if (!definition) throw new Error(`Unknown workbench component: ${componentId}`);
  const componentProps = {...definition.defaultProps};
  const defaultAsset = selectDefaultComponentAsset(definition, project);
  const startFrame = Math.max(0, Math.min(playheadFrame, Math.max(0, project.durationInFrames - 1)));
  const sourceTiming = defaultAsset ? resolveComponentAssetTiming(project, defaultAsset, startFrame) : {sourceStartMs: 0, sourceEndMs: null};
  const sourceAvailableFrames = sourceTiming.sourceEndMs === null
    ? definition.durationInFrames
    : Math.max(1, Math.floor((sourceTiming.sourceEndMs - sourceTiming.sourceStartMs) / 1000 * Math.max(1, project.fps)));
  return {
    id: crypto.randomUUID(),
    trackId: 'track-graphics',
    kind: 'component',
    name: definition.name,
    assetId: defaultAsset?.id ?? null,
    startFrame,
    durationInFrames: Math.max(1, Math.min(definition.durationInFrames, sourceAvailableFrames)),
    sourceStartMs: sourceTiming.sourceStartMs,
    sourceEndMs: sourceTiming.sourceEndMs,
    playbackRate: 1,
    volume: 1,
    muted: true,
    transform: {...defaultTransform(), borderRadius: 24},
    text: definition.supportsText ? String(componentProps.text ?? '') : null,
    textStyle: definition.supportsText ? {...defaultTextStyle(), fontSize: 54} : null,
    recipeId: null,
    engine: 'remotion',
    metadata: {
      componentId: definition.id,
      componentProps,
      source: definition.source,
      sourceUrl: definition.sourceUrl,
      license: definition.license,
      adaptation: 'local-workbench',
      syntheticAudioPreview: definition.syntheticAudio,
    },
  };
};

export const updateComponentProps = (clip: TimelineClip, updates: ComponentProps): Record<string, unknown> => {
  const nextProps = {...getComponentProps(clip), ...updates};
  return {
    ...clip.metadata,
    componentProps: nextProps,
  };
};
