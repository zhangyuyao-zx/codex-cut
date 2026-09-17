import {defaultTextStyle, defaultTransform, type ProjectDocument, type TimelineClip} from './project.js';

export type RecipeMotion = 'rise' | 'pop' | 'wipe' | 'scan' | 'count' | 'split' | 'mosaic' | 'flash';
export type SemanticRoutingMetadata = {
  semanticTags: string[];
  roles: string[];
  safeZoneProfile: 'center' | 'lower-third' | 'fullscreen';
  styleFamily: string;
  textCapacity: number;
};
export type ExecutableRecipe = {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultText: string;
  durationInFrames: number;
  accent: string;
  motion: RecipeMotion;
  placement: 'center' | 'lower-third' | 'fullscreen';
} & SemanticRoutingMetadata;

export type ReferenceRecipeCard = {
  name: string;
  summary: string;
  category: string;
  duration: string;
  energy: string;
  sourceUrl: string;
  source?: string;
  license?: string;
  use?: string;
  intention?: string;
  tags?: string[];
};

type BaseRecipe = Omit<ExecutableRecipe, keyof SemanticRoutingMetadata>;
const baseRecipes: BaseRecipe[] = [
  {id: 'paper-title-card', name: '纸张开场标题', category: '开场', description: '克制的纸张质感标题，用于建立主题。', defaultText: '这件事，真正重要的是什么？', durationInFrames: 105, accent: '#f1e7d5', motion: 'rise', placement: 'fullscreen'},
  {id: 'spotlight-hero-card', name: '聚光主标题', category: '开场', description: '暗场聚光，突出一句核心观点。', defaultText: '先说结论', durationInFrames: 90, accent: '#ffbd63', motion: 'pop', placement: 'center'},
  {id: 'lower-third-person', name: '人物信息条', category: '人物', description: '口播常用的人名与身份说明。', defaultText: '张鑫｜创作者', durationInFrames: 150, accent: '#8b95ff', motion: 'rise', placement: 'lower-third'},
  {id: 'flying-words', name: '关键词飞入', category: '文字', description: '关键词逐拍进入，适合观点强调。', defaultText: '效率 · 清晰 · 可控', durationInFrames: 100, accent: '#f47a78', motion: 'pop', placement: 'center'},
  {id: 'list-reveal', name: '列表逐条揭示', category: '信息', description: '把三点内容按节奏逐条展示。', defaultText: '第一步\n第二步\n第三步', durationInFrames: 150, accent: '#73d4a7', motion: 'rise', placement: 'center'},
  {id: 'counter-confetti', name: '数字强调', category: '数据', description: '数字计数与轻量粒子重音。', defaultText: '3×', durationInFrames: 90, accent: '#ffbd63', motion: 'count', placement: 'center'},
  {id: 'scanline-annotate-focus', name: '扫描标注', category: '标注', description: '扫描线锁定画面中的关键信息。', defaultText: '重点看这里', durationInFrames: 120, accent: '#71d9d1', motion: 'scan', placement: 'center'},
  {id: 'before-after-slider-scrub', name: '前后对比', category: '对比', description: '用滑杆语法呈现改变前后。', defaultText: '之前  /  之后', durationInFrames: 135, accent: '#f1e7d5', motion: 'wipe', placement: 'fullscreen'},
  {id: 'comic-panel-split', name: '漫画分屏', category: '布局', description: '强调两组画面或观点的对照。', defaultText: '观点 A  ×  观点 B', durationInFrames: 120, accent: '#f47a78', motion: 'split', placement: 'fullscreen'},
  {id: 'mosaic-reframe', name: 'B-roll 拼贴', category: '布局', description: '用拼贴框架承载补充素材。', defaultText: '补充画面', durationInFrames: 150, accent: '#b98cff', motion: 'mosaic', placement: 'fullscreen'},
  {id: 'bottom-push-stack-wipe', name: '底部推叠转场', category: '转场', description: '由底部推入的章节过渡卡。', defaultText: '下一部分', durationInFrames: 60, accent: '#7985ff', motion: 'wipe', placement: 'fullscreen'},
  {id: 'white-flash-logo-simplify-cut', name: '闪白收尾', category: '收尾', description: '一次闪白完成品牌或 CTA 收束。', defaultText: '关注我，继续把事情讲清楚', durationInFrames: 100, accent: '#ffbd63', motion: 'flash', placement: 'fullscreen'},
];

const recipeRouting: Record<string, SemanticRoutingMetadata> = {
  'paper-title-card': {semanticTags: ['title', 'hook'], roles: ['opener', 'orientation'], safeZoneProfile: 'fullscreen', styleFamily: 'paper-editorial', textCapacity: 34},
  'spotlight-hero-card': {semanticTags: ['hook', 'claim', 'summary'], roles: ['hero', 'emphasis'], safeZoneProfile: 'center', styleFamily: 'spotlight', textCapacity: 28},
  'lower-third-person': {semanticTags: ['title', 'claim'], roles: ['lower-third', 'context'], safeZoneProfile: 'lower-third', styleFamily: 'editorial-lower-third', textCapacity: 26},
  'flying-words': {semanticTags: ['claim', 'data'], roles: ['emphasis', 'keyword'], safeZoneProfile: 'center', styleFamily: 'kinetic-type', textCapacity: 24},
  'list-reveal': {semanticTags: ['step', 'summary'], roles: ['structure', 'sequence'], safeZoneProfile: 'center', styleFamily: 'structured-list', textCapacity: 42},
  'counter-confetti': {semanticTags: ['data'], roles: ['metric', 'emphasis'], safeZoneProfile: 'center', styleFamily: 'numeric-counter', textCapacity: 14},
  'scanline-annotate-focus': {semanticTags: ['warning', 'data', 'claim'], roles: ['annotation', 'focus'], safeZoneProfile: 'center', styleFamily: 'scan-annotation', textCapacity: 22},
  'before-after-slider-scrub': {semanticTags: ['comparison'], roles: ['comparison', 'transition'], safeZoneProfile: 'fullscreen', styleFamily: 'before-after', textCapacity: 28},
  'comic-panel-split': {semanticTags: ['comparison'], roles: ['comparison', 'split-screen'], safeZoneProfile: 'fullscreen', styleFamily: 'comic-split', textCapacity: 28},
  'mosaic-reframe': {semanticTags: ['claim', 'comparison'], roles: ['b-roll', 'context'], safeZoneProfile: 'fullscreen', styleFamily: 'mosaic', textCapacity: 30},
  'bottom-push-stack-wipe': {semanticTags: ['step', 'summary'], roles: ['chapter', 'transition'], safeZoneProfile: 'fullscreen', styleFamily: 'stack-wipe', textCapacity: 24},
  'white-flash-logo-simplify-cut': {semanticTags: ['cta', 'summary'], roles: ['closer', 'call-to-action'], safeZoneProfile: 'fullscreen', styleFamily: 'flash-cta', textCapacity: 34},
};

export const executableRecipes: ExecutableRecipe[] = baseRecipes.map((recipe) => ({
  ...recipe,
  ...recipeRouting[recipe.id],
}));

export const createRecipeClip = (recipeId: string, project: ProjectDocument): TimelineClip => {
  const recipe = executableRecipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) throw new Error(`Unknown executable recipe: ${recipeId}`);
  return {
    id: crypto.randomUUID(),
    trackId: 'track-graphics',
    kind: 'recipe',
    name: recipe.name,
    assetId: null,
    startFrame: project.playheadFrame,
    durationInFrames: recipe.durationInFrames,
    sourceStartMs: 0,
    sourceEndMs: null,
    playbackRate: 1,
    volume: 1,
    muted: true,
    transform: {...defaultTransform(), borderRadius: 24},
    text: recipe.defaultText,
    textStyle: {...defaultTextStyle(), color: '#ffffff', fontSize: recipe.placement === 'lower-third' ? 46 : 72},
    recipeId: recipe.id,
    engine: 'remotion',
    metadata: {accent: recipe.accent, motion: recipe.motion, placement: recipe.placement},
  };
};
