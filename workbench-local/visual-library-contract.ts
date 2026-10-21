import {z} from 'zod';

export const visualId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/u, '编号只能含小写字母、数字、下划线和短横线');
export const visualVersion = z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/u, '版本使用 1.0.0 格式');
const shortText = z.string().trim().min(1).max(4000);
const key = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/u).refine(k=>!['constructor','prototype','__proto__'].includes(k));
const color = z.string().regex(/^#[0-9a-f]{6}$/iu);
const common = {key, label:shortText, required:z.boolean().optional()};
export const visualControlSchema = z.discriminatedUnion('type', [
  z.object({...common,type:z.literal('text'),default:z.string().max(4000).optional()}).strict(),
  z.object({...common,type:z.literal('number'),default:z.number().finite().optional(),min:z.number().finite().optional(),max:z.number().finite().optional(),step:z.number().positive().optional()}).strict(),
  z.object({...common,type:z.literal('color'),default:color.optional()}).strict(),
  z.object({...common,type:z.literal('boolean'),default:z.boolean().optional()}).strict(),
  z.object({...common,type:z.literal('select'),options:z.array(shortText).min(1).max(40),default:z.string().optional()}).strict(),
  z.object({...common,type:z.literal('list'),itemType:z.enum(['text','number']),default:z.array(z.union([z.string().max(4000),z.number().finite()])).max(40).optional(),minItems:z.number().int().min(0).max(40).optional(),maxItems:z.number().int().min(1).max(40).optional()}).strict(),
]);
export type VisualControl = z.infer<typeof visualControlSchema>;
export type VisualValue = string | number | boolean | (string | number)[];
export const visualValuesSchema = z.record(key,z.union([z.string().max(4000),z.number().finite(),z.boolean(),z.array(z.union([z.string().max(4000),z.number().finite()])).max(40)]));
export const visualMemberSchema = z.object({id:visualId,version:visualVersion}).strict();
export type VisualMember = z.infer<typeof visualMemberSchema>;
export const visualSourceSchema = z.discriminatedUnion('kind',[
  z.object({kind:z.literal('authored'),note:shortText}).strict(),
  z.object({kind:z.literal('reference'),referenceId:visualId,startMs:z.number().finite().min(0),endMs:z.number().finite().positive(),observations:shortText}).strict(),
]);
export const visualAssetInputSchema = z.object({
  id:visualId,version:visualVersion,name:shortText,description:shortText,
  kind:z.enum(['component','effect','recipe']),mount:z.enum(['OBJECT','SCENE','TRANSITION']),
  requiresSourceMedia:z.boolean().default(false),
  previewBackground:color.default('#F1F1E8'),
  tags:z.array(shortText).max(24).default([]),source:visualSourceSchema,
  controls:z.array(visualControlSchema).max(64),
  objects:z.array(z.object({id:visualId,label:shortText,parameters:z.array(key).max(64)}).strict()).max(40).default([]),
  cues:z.array(z.object({id:visualId,label:shortText,required:z.boolean().default(true)}).strict()).max(40).default([]),
  mediaSlots:z.array(z.object({id:visualId,label:shortText,kind:z.enum(['image','video','either']),required:z.boolean().default(true)}).strict()).max(12).default([]),
  styleBindings:z.record(key,key).default({}),
  contentParameters:z.array(key).max(64).default([]),
  constraints:z.object({aspectRatios:z.array(z.literal('16:9')).min(1).default(['16:9']),minFrames:z.number().int().positive().max(108000).default(1),maxFrames:z.number().int().positive().max(108000).default(18000),notes:z.string().max(4000).default('')}).strict().default({aspectRatios:['16:9'],minFrames:1,maxFrames:18000,notes:''}),
  sampleValues:visualValuesSchema.default({}),
  code:z.string().min(1).max(512000),
}).strict().superRefine((asset,ctx)=>{
  const keys=asset.controls.map(c=>c.key);
  if(new Set(keys).size!==keys.length)ctx.addIssue({code:'custom',message:'参数编号重复'});
  for(const c of asset.controls){
    if(c.type==='number'&&c.min!==undefined&&c.max!==undefined&&c.min>c.max)ctx.addIssue({code:'custom',message:'参数上下限无效：'+c.key});
    if(c.type==='list'&&(c.minItems??0)>(c.maxItems??40))ctx.addIssue({code:'custom',message:'列表数量范围无效：'+c.key});
  }
  for(const values of [asset.objects.map(o=>o.id),asset.cues.map(c=>c.id),asset.mediaSlots.map(m=>m.id)])
    if(new Set(values).size!==values.length)ctx.addIssue({code:'custom',message:'对象、事件或素材槽编号重复'});
  for(const object of asset.objects)for(const k of object.parameters)if(!keys.includes(k))ctx.addIssue({code:'custom',message:`对象引用未知参数：${k}`});
  for(const k of Object.keys(asset.styleBindings))if(!keys.includes(k))ctx.addIssue({code:'custom',message:`风格映射引用未知参数：${k}`});
  for(const k of asset.contentParameters)if(!keys.includes(k))ctx.addIssue({code:'custom',message:`内容声明引用未知参数：${k}`});
  if(asset.constraints.maxFrames<asset.constraints.minFrames)ctx.addIssue({code:'custom',message:'最长时长不能小于最短时长'});
  if(asset.source.kind==='reference' && asset.source.endMs<=asset.source.startMs)ctx.addIssue({code:'custom',message:'参考片段起止无效'});
});
export type VisualAssetInput = z.infer<typeof visualAssetInputSchema>;
export type VisualAsset = Omit<VisualAssetInput,'code'> & {
  moduleId:string;sourceHash:string;createdAt:string;status:'draft'|'review'|'ready'|'archived';
  reviews:VisualReview[];previews:VisualPreview[];
};
export type VisualPreview = {id:string;kind:'reference'|'replacement';sourceHash:string;values:Record<string,VisualValue>;durationFrames:number;cueFrames?:Record<string,number>;referenceId?:string;url:string;createdAt:string;status:'rendering'|'done'|'failed'|'cancelled';progress:number;error?:string;targetIdentity:string;contentIdentity?:string;outputHash?:string};
export type VisualReview = {id:string;createdAt:string;previewId:string;note:string;kind:'visual'|'reuse'|'accepted';sourceHash:string};

export const stylePackInputSchema = z.object({
  id:visualId,version:visualVersion,name:shortText,description:shortText,
  source:visualSourceSchema,members:z.array(visualMemberSchema).min(1).max(80),
  tokens:visualValuesSchema,
  typography:z.string().max(4000).default(''),motion:z.string().max(4000).default(''),
  composition:z.string().max(6000).default(''),sound:z.string().max(4000).default(''),
  coverage:z.array(shortText).max(40),limitations:z.array(shortText).max(40).default([]),
  overrides:z.record(z.string().max(100),visualValuesSchema).default({}),
}).strict().superRefine((pack,ctx)=>{
  const members=pack.members.map(m=>memberKey(m));
  if(new Set(members).size!==members.length)ctx.addIssue({code:'custom',message:'风格包成员重复'});
  for(const k of Object.keys(pack.overrides))if(!members.includes(k))ctx.addIssue({code:'custom',message:`预设引用非成员资产：${k}`});
});
export type StylePackInput = z.infer<typeof stylePackInputSchema>;
export type StylePack = StylePackInput & {createdAt:string;status:'draft'|'ready'|'archived';acceptedAt?:string;demonstration?:{id:string;url:string;outputHash:string;createdAt:string;members:{id:string;version:string;sourceHash:string;previewId:string}[]}};
export type ReferenceVideo = {
  id:string;name:string;createdAt:string;sourceUrl?:string;sha256:string;durationMs:number;width:number;height:number;
  fileName:string;stage:'imported'|'preparing'|'analysis'|'authoring'|'review'|'complete'|'failed';
  progress:number;error?:string;proxy?:string;proxyHash?:string;analysisSourceHash?:string;frames:{timeMs:number;fileName:string}[];
  analysis?:ReferenceAnalysis;
};
export const referenceAnalysisSchema = z.object({
  summary:shortText,visualInspected:z.boolean(),audioInspected:z.boolean(),
  style:shortText,
  segments:z.array(z.object({id:visualId,startMs:z.number().min(0),endMs:z.number().positive(),purpose:shortText,observations:shortText,objects:z.array(shortText).max(40),motion:shortText,trigger:z.string().max(4000).default(''),dependencies:z.array(shortText).max(30).default([])}).strict()).min(1).max(500),
  uncertainties:z.array(shortText).max(100).default([]),
}).strict();
export type ReferenceAnalysis = z.infer<typeof referenceAnalysisSchema>;
export const memberKey=(m:VisualMember)=>`${m.id}@${m.version}`;
export const visualModuleId=(m:VisualMember)=>`va-${m.id}-v${m.version.replaceAll('.','-')}`;

export function resolveVisualValues(controls:readonly VisualControl[], input:Record<string,unknown>={}):Record<string,VisualValue>{
  const output:Record<string,VisualValue>={};
  for(const k of Object.keys(input))if(!controls.some(c=>c.key===k))throw Error(`未知参数：${k}`);
  for(const c of controls){
    const value=Object.hasOwn(input,c.key)?input[c.key]:c.default;
    if(value===undefined){if(c.required)throw Error(`请填写${c.label}`);continue;}
    if(c.type==='number' && (typeof value!=='number'||!Number.isFinite(value)||(c.min!==undefined&&value<c.min)||(c.max!==undefined&&value>c.max)))throw Error(`${c.label}超出有效范围`);
    if(c.type==='text' && (typeof value!=='string'||value.length>4000||(c.required&&!value.trim())))throw Error(`${c.label}需要有效文字`);
    if(c.type==='color' && (typeof value!=='string'||!color.safeParse(value).success))throw Error(`${c.label}需要六位颜色`);
    if(c.type==='boolean' && typeof value!=='boolean')throw Error(`${c.label}需要开关值`);
    if(c.type==='select' && (typeof value!=='string'||!c.options.includes(value)))throw Error(`${c.label}选项无效`);
    if(c.type==='list' && (!Array.isArray(value)||value.length<(c.minItems??0)||value.length>(c.maxItems??40)||value.some(v=>c.itemType==='number'?typeof v!=='number'||!Number.isFinite(v):typeof v!=='string'||v.length>4000)))throw Error(`${c.label}列表内容或数量无效`);
    output[c.key]=value as VisualValue;
  }
  return output;
}

export function styleValuesFor(asset:VisualAsset, pack:StylePack):Record<string,VisualValue>{
  const values:Record<string,VisualValue>={};
  if(!pack.members.some(m=>memberKey(m)===memberKey(asset)))return values;
  for(const [parameter,token] of Object.entries(asset.styleBindings))if(Object.hasOwn(pack.tokens,token))values[parameter]=pack.tokens[token];
  return {...values,...pack.overrides[memberKey(asset)]};
}
