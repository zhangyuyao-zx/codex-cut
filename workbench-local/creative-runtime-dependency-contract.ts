import {z} from 'zod';

/** Package names and exact versions only; runtime support is checked by the host. */
export const creativeDependencySchema=z.record(
  z.string().regex(/^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/u),
  z.string().regex(/^\d+\.\d+\.\d+$/u,'动画依赖必须声明精确版本，例如 4.0.489'),
).refine(value=>Object.keys(value).length<=16,'动画依赖过多');
export type CreativeDependencies=z.infer<typeof creativeDependencySchema>;
