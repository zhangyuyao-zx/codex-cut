import {z} from 'zod';
import {submitSceneImplementationPlanV1RequestSchema} from './scene-program-contract.js';
const hash=z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export const sceneSampleSubmitSchema=z.object({paragraphId:z.string().min(1).max(256),implementation:submitSceneImplementationPlanV1RequestSchema}).strict();
export const sceneSampleConfirmSchema=z.object({reviewHash:hash}).strict();
export const sceneSampleRecordSchema=z.object({
 schemaVersion:z.literal(1),jobId:z.string().uuid(),paragraphId:z.string(),
 status:z.enum(['RENDERING','READY','APPROVED','FAILED','CANCELLED','INTERRUPTED']),
 implementation:submitSceneImplementationPlanV1RequestSchema,sourceHash:hash,
 sampleHash:hash,runtimeHash:hash,reviewHash:hash.nullable(),mediaHash:hash.nullable(),
 outputPath:z.string().nullable(),durationFrames:z.number().int().positive(),fps:z.number().positive(),
 progress:z.number().min(0).max(1),error:z.string().nullable(),createdAt:z.string(),approvedAt:z.string().nullable(),
}).strict();
export type SceneSampleRecord=z.infer<typeof sceneSampleRecordSchema>;
export type SceneSampleSnapshot={sample:SceneSampleRecord|null;stale:boolean};
