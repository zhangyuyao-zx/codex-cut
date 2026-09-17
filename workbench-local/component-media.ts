import { z } from "zod";
import {
  componentLibraryDefinition,
  validateLibraryParameters,
} from "../modules/components/component-library";
import { componentRuntimeRequiredMediaNodeCount } from "../modules/components/component-runtime-catalog";
export const componentMediaBindingSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("cut") }).strict(),
  z
    .object({
      source: z.literal("asset"),
      assetId: z.string().uuid(),
      startFrame: z.number().int().min(0).max(10800000).default(0),
    })
    .strict(),
]);
export type ComponentMediaBinding = z.infer<typeof componentMediaBindingSchema>;
export type ComponentMedia = {
  src: string;
  kind: "image" | "video";
  startFrame: number;
  assetId?: string;
};
export function componentMediaRequirement(
  id: string,
  input: Record<string, unknown>,
) {
  const definition = componentLibraryDefinition(id);
  if (!definition) throw Error("组件不在 App 最终盘点库中");
  const parameters = validateLibraryParameters(id, input);
  const count =
    definition.mount === "TRANSITION"
      ? 2
      : Math.max(
          definition.mediaSlots.includes("content") ? 1 : 0,
          id.startsWith("component:v1:")
            ? definition.mediaSlots.length
            : componentRuntimeRequiredMediaNodeCount(id, parameters),
        );
  const labels =
    definition.mount === "TRANSITION"
      ? ["前画面", "后画面"]
      : definition.coreId === "before-after"
        ? ["对比前", "对比后"]
        : definition.coreId === "card-flip"
          ? ["正面", "背面"]
          : Array.from({ length: count }, (_, i) => `素材 ${i + 1}`);
  return { count, labels, parameters, mount: definition.mount };
}
export async function resolveComponentMedia(options: {
  bindings?: unknown;
  count: number;
  from: number;
  duration: number;
  cutDuration: number;
  resolveAsset: (id: string) => Promise<{
    id: string;
    kind: "image" | "video";
    durationFrames?: number;
    extension?: string;
  }>;
}): Promise<ComponentMedia[]> {
  const { count, from, duration, cutDuration, resolveAsset } = options;
  // Preserve already saved single-source components. New multi-source components require every slot.
  const bindings =
    options.bindings === undefined
      ? count === 1
        ? [{ source: "cut" as const }]
        : []
      : z.array(componentMediaBindingSchema).max(32).parse(options.bindings);
  if (bindings.length !== count)
    throw Error(`需要绑定 ${count} 份素材，当前为 ${bindings.length} 份`);
  return Promise.all(
    bindings.map(async (b, i) => {
      if (b.source === "cut") {
        if (from + duration > cutDuration)
          throw Error(`素材 ${i + 1} 超出粗剪时长`);
        return { src: "source.mp4", kind: "video" as const, startFrame: from };
      }
      const a = await resolveAsset(b.assetId);
      if (
        a.kind === "video" &&
        (!a.durationFrames || b.startFrame + duration > a.durationFrames)
      )
        throw Error(
          `素材 ${i + 1} 视频长度不足，请调早素材起点、缩短组件时长或更换素材`,
        );
      return {
        src: `component-${a.id}${a.extension ?? (a.kind === "image" ? ".png" : ".mp4")}`,
        assetId: a.id,
        kind: a.kind,
        startFrame: a.kind === "image" ? 0 : b.startFrame,
      };
    }),
  );
}

export function validateComponentInterval(
  mount: string,
  parameters: Record<string, unknown>,
  duration: number,
) {
  if (mount !== "TRANSITION") return;
  const start =
    typeof parameters.startFrame === "number" ? parameters.startFrame : 0;
  const length =
    typeof parameters.transitionFrames === "number"
      ? parameters.transitionFrames
      : 0;
  if (start >= duration || start + length > duration)
    throw Error("转场动画超出所选区间，请缩短转场时长或延长出现区间");
}
