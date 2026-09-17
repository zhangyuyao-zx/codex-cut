import {listComponentPresets, saveComponentPreset} from "./component-presets";
import { resolve } from "node:path";
import { Router } from "express";
import {
  COMPONENT_LIBRARY,
  componentLibraryDefinition,
  validateLibraryParameters,
} from "../modules/components/component-library";
import { componentMediaRequirement } from "./component-media";
import { createComponentFavoritesStore } from "./component-favorites";
function blank(sample: any): any {
  return Array.isArray(sample)
    ? []
    : sample && typeof sample === "object"
      ? Object.fromEntries(
          Object.entries(sample).map(([k, v]) => [k, blank(v)]),
        )
      : typeof sample === "number"
        ? 0
        : typeof sample === "boolean"
          ? false
          : "";
}
export async function createComponentLibrary(root: string, presetDir = resolve(root, "projects/local-workbench/library-presets")) {
  // New workbench objects use a 1920px design surface. Keep saved values untouched.
  const initialDefaults=(d:any)=>({...d.defaultParameters,...(d.componentId.startsWith('component:v1:') && d.controls.some((c:any)=>c.key==='fontSize')?{fontSize:96}:{})});
  const modulePath = resolve(root, "workbench-local/AppLibraryComponent.jsx");
  const item = (d: any) => ({
    id: d.componentId,
    name: d.label,
    description: "沿用 App 最终盘点的组件与参数接口",
    category: ({ OBJECT: "对象", SCENE: "场景", TRANSITION: "转场" } as any)[
      d.mount
    ],
    source: "App 已盘点组件",
    license: "沿用项目现有组件授权记录",
    runtime: true,
    appAdapter: true,
    mount: d.mount,
    preview: null,
    thumbnail: null,
    thumbnailProps: {...d.sampleParameters,...initialDefaults(d)},
    mediaSlots: d.mediaSlots,
  });
  async function detail(id: string) {
    const d = componentLibraryDefinition(id);
    if (!d) throw Error("组件不在 App 最终盘点库中");
    return {
      ...item(d),
      modulePath,
      moduleUrl: "/@fs" + modulePath,
      exportName: "AppLibraryComponent",
      width: 1920,
      height: 1080,
      fields: d.controls.map((c) => ({
        ...c,
        name: c.key,
        sample: d.sampleParameters[c.key] ?? (c.key === 'cueFrames' ? [0] : undefined),
        value:
          initialDefaults(d)[c.key] ??
          (!c.required ? undefined : c.type === "boolean"
            ? false
            : c.type === "number"
              ? (c.min ?? 0)
              : c.type === "json"
                ? blank(d.sampleParameters[c.key])
                : c.type === "select"
                  ? (c.options?.[0] ?? "")
                  : ""),
      })),
    };
  }
  async function validate(selection: any) {
    const d = componentLibraryDefinition(selection.componentId);
    if (!d) throw Error("组件不在 App 最终盘点库中");
    const parameters = validateLibraryParameters(
      d.componentId,
      selection.props,
    );
    const needed = componentMediaRequirement(d.componentId, parameters).count;
    return {
      ...(await detail(d.componentId)),
      resolvedParameters: parameters,
      requiredMedia: needed,
    };
  }

  const favoriteStore = createComponentFavoritesStore(
    resolve(presetDir, "..", "component-favorites.json"),
    COMPONENT_LIBRARY.map((definition) => definition.componentId),
  );
  const router = Router();
  router.get("/", async (_q, r, next) => {
    try {
      const favoriteIds = await favoriteStore.list();
      r.json({
        presets: await listComponentPresets(presetDir),
        items: COMPONENT_LIBRARY.map(item),
        favorites: favoriteIds,
        counts: {
          total: COMPONENT_LIBRARY.length,
          runtime: COMPONENT_LIBRARY.length,
          favorites: favoriteIds.length,
        },
      });
    } catch (e) {
      next(e);
    }
  });
  router.post("/favorites", async (q, r, next) => {
    try {
      const favoriteIds = await favoriteStore.set(q.body);
      r.json({ favorites: favoriteIds, favoriteIds });
    } catch (e) {
      next(e);
    }
  });
  router.post("/presets", async (q,r,next) => {try {r.json(await saveComponentPreset(presetDir,q.body));} catch(e) {next(e);} });
  router.get("/detail/:id", async (q, r, next) => {
    try {
      r.json(await detail(String(q.params.id)));
    } catch (e) {
      next(e);
    }
  });
  return { router, detail, validate, favorites: favoriteStore };
}
