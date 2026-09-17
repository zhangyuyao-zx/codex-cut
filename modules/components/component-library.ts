import { z } from "zod";
import { COMPONENT_RUNTIME_DEFINITIONS, componentRuntimeDefinition, validateComponentParameters, type ComponentRuntimeDefinition } from "./component-runtime-catalog.js";
import { SMART_PACKAGING_COMPONENT_PRIMITIVES_V1 } from "./smart-packaging-component-pilot.js";

const mediaIds = new Set(["stage-person-full", "stage-screen-main", "stage-evidence-main", "stage-detail-inset", "stage-person-pip-circle", "screen-smart-zoom-restore", "screen-spotlight-dim", "evidence-clean-card", "evidence-source-label", "evidence-device-frame"]);
const textIds = new Set(["text-clean-card", "text-marker-underline", "text-context-label", "text-mini-explanation", "annotation-arrow", "annotation-callout", "evidence-source-label", "evidence-device-frame"]);
const radiusIds = new Set(["stage-screen-main","stage-evidence-main","stage-detail-inset","text-clean-card","text-mini-explanation","screen-smart-zoom-restore","screen-spotlight-dim","annotation-callout","evidence-clean-card","evidence-source-label","evidence-device-frame"]);
const backgroundIds = new Set([...radiusIds,"text-context-label"]);
const primitiveSchema = z.object({
  text: z.string().max(2000).optional(),
  foregroundColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).default("#eff9f7"),
  backgroundColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).default("#10272c"),
  fontSize: z.number().min(8).max(180).default(36),
  cornerRadius: z.number().min(0).max(100).default(16),
}).strict();

export const PRIMITIVE_RUNTIME_DEFINITIONS: readonly ComponentRuntimeDefinition[] = SMART_PACKAGING_COMPONENT_PRIMITIVES_V1.map((entry) => {
  const coreId = entry.primitiveId.replace("component:v1:", "");
  return {
    componentId: entry.primitiveId, coreId, rendererId: `component-${coreId}`, label: entry.label,
    mount: "OBJECT" as const,
    mediaSlots: mediaIds.has(coreId) ? ["content"] : [],
    controls: [
      ...(textIds.has(coreId) ? [{key: "text", label: "文字", type: "text" as const, required: true, group: "content" as const}] : []),
      {key: "foregroundColor", label: "文字 / 强调色", type: "color" as const, group: "style" as const},
      {key: "backgroundColor", label: "背景色", type: "color" as const, group: "style" as const},
      {key: "fontSize", label: "字号", type: "number" as const, min: 8, max: 180, group: "style" as const},
      {key: "cornerRadius", label: "圆角", type: "number" as const, min: 0, max: 100, group: "style" as const},
    ].filter(control => control.key === "backgroundColor" ? backgroundIds.has(coreId) : control.key === "fontSize" ? textIds.has(coreId) : control.key === "cornerRadius" ? radiusIds.has(coreId) : true),
    defaultParameters: {foregroundColor: "#eff9f7", backgroundColor: "#10272c", fontSize: 36, cornerRadius: 16},
    sampleParameters: {...(textIds.has(coreId) ? {text: "在这里编辑你的文字"} : {}), foregroundColor: "#eff9f7", backgroundColor: "#10272c", fontSize: 36, cornerRadius: 16},
  };
}).map(definition => ({...definition,defaultParameters:Object.fromEntries(Object.entries(definition.defaultParameters).filter(([key])=>definition.controls.some(control=>control.key===key))),sampleParameters:Object.fromEntries(Object.entries(definition.sampleParameters).filter(([key])=>definition.controls.some(control=>control.key===key)))}));
export const COMPONENT_LIBRARY = [...PRIMITIVE_RUNTIME_DEFINITIONS, ...COMPONENT_RUNTIME_DEFINITIONS];
export function componentLibraryDefinition(id: string): ComponentRuntimeDefinition | null {
  return PRIMITIVE_RUNTIME_DEFINITIONS.find((entry) => entry.componentId === id) ?? componentRuntimeDefinition(id);
}
export function validateLibraryParameters(id: string, parameters: Record<string, unknown>): Record<string, unknown> {
  const primitive = PRIMITIVE_RUNTIME_DEFINITIONS.find((entry) => entry.componentId === id);
  if (!primitive) return validateComponentParameters(id, parameters);
  const keys = new Set(primitive.controls.map(control=>control.key));
  for (const key of Object.keys(parameters)) if(!keys.has(key)) throw new Error(`未知组件参数 ${key}`);
  const parsed = primitiveSchema.parse(parameters);
  if (textIds.has(primitive.coreId) && !parsed.text?.trim()) throw new Error("请填写组件文字");
  return Object.fromEntries(Object.entries(parsed).filter(([key])=>keys.has(key)));
}
/** Only project data and presentation defaults enter production; sample content never does. */
export function resolveLibraryParameters(id: string, input: Record<string, unknown>, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const definition = componentLibraryDefinition(id);
  if (!definition) throw new Error(`未知组件 ${id}`);
  const projected: Record<string, unknown> = {...definition.defaultParameters};
  const aliases:Record<string,unknown>={label:input.label ?? input.title,footer:input.footer ?? input.informationDuty};
  for (const control of definition.controls) {
    const value=input[control.key] ?? aliases[control.key];
    if (value !== undefined && value !== null) projected[control.key] = value;
  }
  return validateLibraryParameters(id, {...projected, ...overrides});
}
