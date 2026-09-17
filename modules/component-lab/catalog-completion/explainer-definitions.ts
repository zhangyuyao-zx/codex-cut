import type {ComponentRuntimeDefinition,ComponentParameterControl} from "../../components/component-runtime-catalog.js";
/** Independently authored explainers. Reference names identify generic effects, not imported implementations. */
export const EXPLAINER_SPECS = [
 ['title-demote-to-label','标题缩为角标','text'],
 ['error-retype','纠错重打','text'],
 ['strike-and-replace','划掉并替换','text'],
 ['word-slot-cycle','词槽轮换','list'],
 ['lead-word-zoom-assemble','关键词放大归队','list'],
 ['tracking-in','字距收拢','text'],
 ['type-contrast-emphasis','字重对比强调','text'],
 ['alt-block-lines','交错色块文字','list'],
 ['count-badge-title','数字徽章标题','text'],
 ['quote-hold-arrow','引文保留与箭头','text'],
 ['chapter-progress-list','章节焦点推进','list'],
 ['chip-grid-single-select','标签网格单项选中','list'],
 ['countdown-arc-scatter','倒计时圆弧散开','number'],
 ['danmu-bubble-praise','弹幕逐条飘入','list'],
 ['social-follow-card','关注卡 · 抖音 / X / 订阅','text'],
 ['source-converge','多路资料汇聚','list'],
 ['converging-arrows','多向箭头汇聚','list'],
 ['map-route-pin','路径与地点落点','list'],
 ['metric-with-sparkline','指标与迷你趋势线','number'],
 ['cursor-actor-demo','光标点击演示','media'],
 ['cursor-locked-zoom','光标锚定放大','media'],
 ['host-shrink-to-chip','人物缩为小窗','media'],
 ['behind-text-title','主体前后景标题','pair'],
 ['magnifier-detail','局部放大镜','media'],
 ['rack-focus-pair','双画面焦点交接','pair'],
 ['grid-to-hero','网格展开为主画面','media'],
 ['filmstrip-conveyor','胶片输送带','media'],
 ['gallery-wall-dolly','画廊移动镜头','media'],
 ['evidence-scroll-tour','证据页面滚动巡览','media'],
 ['doc-park-left-pill-deal','文档停靠与要点发牌','media'],
 ['still-layout-relay','静态画面布局接力','pair'],
 ['long-take-world','连续空间镜头','media'],
 ['word-relay-filmstrip','词语胶片接力','list'],
 ['ui-prop-theater','界面分层展开','list'],
 ['ui-flow-theater','界面流程演示','list'],
 ['glass-code-walk','代码透视巡览','list'],
 ['host-card-glass-board','人物与讲解玻璃板','media'],
 ['parallel-items-with-host','人物与并列要点','media'],
 ['flying-words','纵深飞行文字','list'],
 ['bed-echo-blur','竖片模糊背景铺底','media'],
 ['tilt-3d-page','页面透视倾斜','media'],
 ['reticle-lock-on','准星锁定','media'],
 ['gooey-morph','素材黏连汇合','pair'],
 ['caret-wipe-transition','光标擦除转场','transition'],
 ['line-carry-transition','线条接续转场','transition'],
 ['overexpose-flip-transition','曝光翻页转场','transition'],
 ['black-slam-transition','黑场冲击转场','transition'],
 ['push-through-transition','穿透推进转场','transition'],
 ['whip-pan-transition','快速甩镜转场','transition'],
 ['chevron-lower-third','箭形人物字幕条','text'],
 ['lower-third-nameplate','人物身份字幕条','text'],
 ['chapter-title-card','章节标题卡','text'],
 ['news-card-desk','新闻证据桌面卡','media'],
 ['outline-box-title','线框标题','text'],
 ['corner-bracket-frame','四角框标题','text'],
 ['info-card-assemble','信息分层组装','list'],
 ['info-term-card','术语与定义','text'],
 ['keyword-pop-highlight','句内关键词强调','text'],
 ['highlighter-sweep','荧光笔扫过','text'],
 ['ink-underline','墨迹下划线','text'],
 ['hand-drawn-ellipse','手绘圈词','text'],
 ['scribble-annotation','手绘标注箭头','media'],
 ['media-pop-in','证据画面弹入','media'],
 ['pip-zoom-box','局部悬浮放大窗','media'],
 ['slow-pull-reveal','细节拉回全貌','media'],
 ['slow-push-in','画面缓推','media'],
 ['crash-zoom-punch','快速冲击放大','media'],
 ['orbit-drift','画面环绕漂移','media'],
 ['sway-parallax','画面轻摆视差','media'],
 ['callout-line-label','引线文字标注','media'],
 ['scanline-annotate','扫描线逐项标注','media'],
 ['quote-card','引文与署名','text'],
 ['quote-bracket-pull','引文括号展开','text'],
 ['number-slab-pop','数字牌面弹入','number'],
 ['impact-open-title','开场冲击标题','text'],
 ['slab-punch-title','双行冲击标题','text'],
 ['speed-slab-title','速度标题','text'],
 ['per-character-rise','逐字上升','text'],
 ['line-by-line-slide','逐行滑入','list'],
 ['split-text-stagger','文字遮罩错位入场','list'],
 ['soft-blur-in','文字柔焦入场','text'],
 ['pencil-sketch-draw','铅笔逐笔描绘','text'],
 ['split-60-40-story','六四分区讲解','media'],
 ['color-slam-beat-card','色块重音卡','text'],
 ['pullback-cool-transition','拉远冷调转场','transition'],
 ['particle-weld-transition','粒子聚合转场','transition'],
] as const;
export type ExplainerId=typeof EXPLAINER_SPECS[number][0];
const number=(key:string,label:string,min:number,max:number,group:'style'|'motion'|'content'='motion'):ComponentParameterControl=>({key,label,type:'number',min,max,group});
export const EXPLAINER_DEFINITIONS:ComponentRuntimeDefinition[]=EXPLAINER_SPECS.map(([coreId,label,kind])=>{
 const controls:ComponentParameterControl[]=[
  {key:'accentColor',label:'强调色',type:'color',group:'style'},
  {key:'foregroundColor',label:'文字颜色',type:'color',group:'style'},
  number('fontSize','字号',20,160,'style'),
  number('startFrame','动作开始帧',0,18000),number('transitionFrames','动作时长（帧）',1,600),
  {key:'reducedMotion',label:'减少位移动画',type:'boolean',group:'motion'},
 ];
 if(coreId==='behind-text-title')controls.find(c=>c.key==='fontSize')!.description='需要两个素材：背景和已抠好的透明人物前景；不会自动抠像。';
 const defaults:Record<string,unknown>={accentColor:'#5DDFBF',foregroundColor:'#F5F5F7',fontSize:72,startFrame:15,transitionFrames:36,reducedMotion:false};
 if(coreId==='color-slam-beat-card')defaults.foregroundColor='#081018';
 let content:Record<string,unknown>={};
 if(['text','number','list'].includes(kind)||['behind-text-title','news-card-desk','callout-line-label'].includes(coreId)){
  controls.push({key:'text',label:'主文字',type:'text',required:true,group:'content'});
  content.text=kind==='number'?'效率变化':'让信息逐步出现';
 }
 if(['error-retype','strike-and-replace','social-follow-card','info-term-card','quote-card','lower-third-nameplate','chevron-lower-third','slab-punch-title','keyword-pop-highlight','news-card-desk'].includes(coreId)){
  controls.push({key:'replacement',label:coreId==='social-follow-card'?'按钮文字':coreId==='keyword-pop-highlight'?'强调词':coreId==='news-card-desk'?'来源 / 日期':['error-retype','strike-and-replace'].includes(coreId)?'替换文字':'辅助文字',type:'text',required:true,group:'content'});content.replacement=coreId==='social-follow-card'?'关注':coreId==='keyword-pop-highlight'?'信息':'让重点清晰可见';
 }
 if(kind==='list'||['doc-park-left-pill-deal','host-card-glass-board','parallel-items-with-host','scanline-annotate','split-60-40-story'].includes(coreId)){
  controls.push({key:'lines',label:'条目（每项一行）',type:'text',required:true,group:'content'},number('stepFrames','条目间隔（帧）',1,1800),{key:'cueFrames',label:'逐项出现帧',type:'json',group:'motion',description:'相对组件起点的逐项时间；留空使用间隔预览。实际口播应绑定对应词的时间。'});
  content.lines='理解内容\n提取重点\n编排画面\n按口播展开';defaults.stepFrames=30;
 }
 if(kind==='number'||coreId==='count-badge-title'){
  controls.push({...number('value','数值',0,1000000,'content'),required:true});content.value=coreId==='countdown-arc-scatter'?5:24;
 }
 if(coreId==='metric-with-sparkline'){
  controls.push({key:'values',label:'趋势数值',type:'json',required:true,group:'content'});content.values=[10,16,12,28,24,40];
 }
 if(coreId==='social-follow-card'){controls.push({key:'platform',label:'平台样式',type:'select',options:['通用','抖音','X','订阅'],group:'style'});defaults.platform='通用';}
 if(['media','pair'].includes(kind)){
  controls.push(number('focusX','焦点 X（%）',0,100,'style'),number('focusY','焦点 Y（%）',0,100,'style'),number('zoom','放大倍率',1,4,'style'));
  Object.assign(defaults,{focusX:65,focusY:42,zoom:1.7});
 }
 const hidden=new Set<string>();
 const hasCopy=['text','number','list'].includes(kind)||['behind-text-title','news-card-desk','callout-line-label','doc-park-left-pill-deal','host-card-glass-board','parallel-items-with-host','scanline-annotate','split-60-40-story'].includes(coreId);
 if(!hasCopy){hidden.add('fontSize');hidden.add('foregroundColor');}
 if(['word-relay-filmstrip','flying-words','danmu-bubble-praise'].includes(coreId))hidden.add('text');
 const focuses=['cursor-actor-demo','cursor-locked-zoom','reticle-lock-on','magnifier-detail','pip-zoom-box','slow-push-in','slow-pull-reveal','crash-zoom-punch','orbit-drift','sway-parallax','callout-line-label','scribble-annotation'];
 if(!focuses.includes(coreId)){hidden.add('focusX');hidden.add('focusY');}
 if(!['cursor-locked-zoom','magnifier-detail','pip-zoom-box','slow-push-in','slow-pull-reveal','crash-zoom-punch','orbit-drift','sway-parallax'].includes(coreId))hidden.add('zoom');
 if(['bed-echo-blur'].includes(coreId)){hidden.add('startFrame');hidden.add('transitionFrames');hidden.add('reducedMotion');}
 if(['tracking-in','soft-blur-in','per-character-rise','line-by-line-slide','split-text-stagger','bed-echo-blur','tilt-3d-page','rack-focus-pair','host-shrink-to-chip','grid-to-hero','gallery-wall-dolly','evidence-scroll-tour','still-layout-relay','long-take-world','gooey-morph','media-pop-in','slow-push-in','slow-pull-reveal','crash-zoom-punch','orbit-drift','sway-parallax','black-slam-transition','overexpose-flip-transition','push-through-transition','whip-pan-transition','pullback-cool-transition'].includes(coreId))hidden.add('accentColor');
 const effectiveControls=controls.filter(c=>!hidden.has(c.key));
 const keep=(data:Record<string,unknown>)=>Object.fromEntries(Object.entries(data).filter(([key])=>!hidden.has(key)));
 return {componentId:`component:catalog-completion:v1:${coreId}`,coreId,rendererId:`ExplainerCore:${coreId}`,label,mount:kind==='transition'?'TRANSITION':kind==='media'||kind==='pair'?'SCENE':'OBJECT',mediaSlots:kind==='transition'?['fromScene','toScene']:kind==='pair'||['filmstrip-conveyor','gallery-wall-dolly','grid-to-hero','word-relay-filmstrip','long-take-world'].includes(coreId)?['media']:kind==='media'?['media']:[],controls:effectiveControls,defaultParameters:keep(defaults),sampleParameters:keep({...defaults,...content})};
});
export function validateExplainerParameters(coreId:string,p:Record<string,unknown>):void{
 if(!EXPLAINER_SPECS.some(s=>s[0]===coreId))return;
 for(const key of ['accentColor','foregroundColor'])if(p[key]!==undefined&&!/^#[a-fA-F0-9]{6}$/.test(String(p[key])))throw Error(`${key}: 请使用六位十六进制颜色`);
 for(const key of ['text','replacement','lines'])if(typeof p[key]==='string'&&p[key].length>1000)throw Error(`${key}: 最多1000字`);
 if(typeof p.lines==='string'&&(p.lines.split('\n').filter(s=>s.trim()).length>explainerItemLimit(coreId)||!p.lines.trim()))throw Error(`该版式支持1–${explainerItemLimit(coreId)}行`);
 if(p.cueFrames!==undefined){
  if(!Array.isArray(p.cueFrames)||p.cueFrames.length>10||p.cueFrames.some((v,i,a)=>typeof v!=='number'||!Number.isInteger(v)||v<0||v>18000||(i>0&&v<=a[i-1])))throw Error('逐项时间需要递增的非负整数帧');
  if(typeof p.lines==='string'&&p.cueFrames.length!==p.lines.split('\n').filter(s=>s.trim()).length)throw Error('逐项时间数必须与条目数一致');
 }
 if(p.values!==undefined&&(!Array.isArray(p.values)||p.values.length<2||p.values.length>64||p.values.some(v=>typeof v!=='number'||!Number.isFinite(v))))throw Error('趋势需要2–64个有限数值');
}

export function explainerMediaCount(coreId:string,parameters:Record<string,unknown>):number{
 const kind=EXPLAINER_SPECS.find(s=>s[0]===coreId)?.[2];
 if(!kind||kind==='transition')return 0;
 if(['grid-to-hero','filmstrip-conveyor','gallery-wall-dolly','long-take-world'].includes(coreId))return 3;
 if(coreId==='word-relay-filmstrip')return String(parameters.lines??'').split('\n').filter(s=>s.trim()).length;
 return kind==='pair'?2:kind==='media'?1:0;
}

export function explainerItemLimit(coreId:string):number{
 if(['map-route-pin','host-card-glass-board','parallel-items-with-host','doc-park-left-pill-deal','split-60-40-story'].includes(coreId))return 5;
 if(['line-by-line-slide','split-text-stagger','info-card-assemble','scanline-annotate','source-converge','converging-arrows'].includes(coreId))return 6;
 if(['ui-prop-theater','glass-code-walk'].includes(coreId))return 7;
 if(['alt-block-lines','lead-word-zoom-assemble','word-relay-filmstrip'].includes(coreId))return 8;
 if(coreId==='ui-flow-theater')return 9;
 return 10;
}
