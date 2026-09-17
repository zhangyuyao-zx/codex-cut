import {z} from 'zod';
import {sceneChoreographySchema,compileChoreography} from './scene-choreography.js';
import {canonicalHash} from "../shared/timeline-v2/canonical.js";
import {hashSchema,idSchema} from "../shared/timeline-v2/schema.js";
import {speechAnchorSchema} from './scene-motion.js';
import {compiledSceneModuleSchema,type CompiledSceneModuleV1} from "../components/scene-module-runtime.js";
const key=z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).refine(value=>!['constructor','prototype','__proto__'].includes(value));
export const sceneModuleParametersSchema=z.record(key,z.union([z.string().max(2000),z.number().finite(),z.boolean(),z.null()])).refine(value=>Object.keys(value).length<=128);
const normalizedSceneModuleDraftSchema=z.object({
 choreography:sceneChoreographySchema.optional(),
 moduleId:idSchema,
 replacesObjectIds:z.array(idSchema).max(64).default([]),
 source:z.string().min(1).max(65536),
 anchors:z.record(key,speechAnchorSchema).refine(value=>Object.keys(value).length<=128),
 parameters:sceneModuleParametersSchema,
}).strict().refine(value=>Object.keys(value.anchors).every(name=>!(name in value.parameters)), 'Speech anchors and editable parameters must have distinct names');
export const sceneModuleDraftSchema=z.preprocess(value=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return value;
 const raw=value as Record<string,unknown>;
 if(!raw.choreography||raw.source!==undefined)return raw;
 const parsed=sceneChoreographySchema.safeParse(raw.choreography);
 if(!parsed.success)return raw;
 const compiled=compileChoreography(parsed.data);
 return {...raw,...compiled,anchors:raw.anchors??compiled.anchors,parameters:raw.parameters===undefined?compiled.parameters:
   raw.parameters&&typeof raw.parameters==='object'&&!Array.isArray(raw.parameters)?{...compiled.parameters,...raw.parameters}:raw.parameters,choreography:parsed.data};
},normalizedSceneModuleDraftSchema).superRefine((value,ctx)=>{
 if(value.choreography){
  const compiled=compileChoreography(value.choreography);
  if(Object.keys(value.parameters).length!==Object.keys(compiled.parameters).length||Object.entries(value.parameters).some(([key,v])=>!(key in compiled.parameters)||typeof v!==typeof compiled.parameters[key]))ctx.addIssue({code:'custom',message:'Choreography parameter names and types must match the trusted plan'});
  if(value.source!==compiled.source||canonicalHash(value.anchors)!==canonicalHash(compiled.anchors))ctx.addIssue({code:'custom',message:'Choreography source and anchors must match the trusted plan'});
 }
});
const ir=z.custom<CompiledSceneModuleV1>(value=>compiledSceneModuleSchema.safeParse(value).success,'Invalid SceneModule IR');
export const sceneModuleManifestSchema=z.object({
 moduleId:idSchema,replacesObjectIds:z.array(idSchema).max(64).default([]),sourceHash:hashSchema,moduleHash:hashSchema,
 parentFrames:z.record(idSchema,z.object({xPermille:z.number().int().min(0).max(999),yPermille:z.number().int().min(0).max(999),widthPermille:z.number().int().min(1).max(1000),heightPermille:z.number().int().min(1).max(1000)}).strict()).default({}),
 compiled:ir,parameters:sceneModuleParametersSchema,
 anchorFrames:z.record(key,z.number().int().nonnegative()),
}).strict().superRefine((value,ctx)=>{
 const {moduleHash,...semantic}=value;
 if(moduleHash!==canonicalHash(semantic))ctx.addIssue({code:'custom',message:'SceneModule identity does not match content'});
 if(Object.keys(value.anchorFrames).some(name=>name in value.parameters))ctx.addIssue({code:'custom',message:'Speech anchors cannot be overridden by parameters'});
});
export type SceneModuleDraft=z.infer<typeof sceneModuleDraftSchema>;
export type SceneModuleManifest=z.infer<typeof sceneModuleManifestSchema>;
