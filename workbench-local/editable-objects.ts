export type EditableObject = {
  id: string;
  label: string;
  parameters: string[];
};
export const legacyObjects: EditableObject[] = [
  {
    id: "person",
    label: "人物画面",
    parameters: ["personScale", "personX", "personY"],
  },
  {
    id: "headline",
    label: "标题文字",
    parameters: ["headline", "titleScale", "accent"],
  },
];
export const legacyControls: any[] = [
  {
    key: "personScale",
    label: "人物大小",
    type: "number",
    default: 1,
    min: 0.25,
    max: 2,
  },
  {
    key: "personX",
    label: "人物水平位置",
    type: "number",
    default: 0,
    min: -960,
    max: 960,
  },
  {
    key: "personY",
    label: "人物垂直位置",
    type: "number",
    default: 0,
    min: -540,
    max: 540,
  },
  { key: "headline", label: "标题文字", type: "text", default: "" },
  {
    key: "titleScale",
    label: "标题大小",
    type: "number",
    default: 1,
    min: 0.5,
    max: 2,
  },
  { key: "accent", label: "强调色", type: "color", default: "#E1F795" },
];
export function validateLegacyOverrides(values: Record<string, unknown> = {}) {
  for (const [key, value] of Object.entries(values)) {
    const c = legacyControls.find((c) => c.key === key);
    if (!c) throw Error("未知编辑参数：" + key);
    if (
      c.type === "number" &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < c.min ||
        value > c.max)
    )
      throw Error(c.label + "超出有效范围");
    if (c.type === "text" && (typeof value !== "string" || value.length > 4000))
      throw Error(c.label + "必须为文字");
    if (
      c.type === "color" &&
      (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))
    )
      throw Error("颜色格式无效");
  }
}
/** Bulk creative changes preserve separately-owned user edits. Explicit parameter edits use a narrow endpoint. */
export function preserveSceneEdits(
  previous: any[],
  next: any[],
  actor: "user" | "codex" = "codex",
) {
  if (actor === "user") return next;
  for (const old of previous) {
    const parameterEdits=old.editor && (Object.keys(old.editor.overrides).length || old.editor.locks.length);
    if(parameterEdits || old.editor?.entryTransition!==undefined) {
      const candidate=next.find(s=>s.id===old.id);
      if(!candidate)throw Error('段落含用户调整，不能直接删除：'+old.title);
      if(parameterEdits && candidate.program?.moduleId!==old.program?.moduleId)
        throw Error('段落含用户调整，更换动画需先迁移参数：'+old.title);
    }
  }
  return next.map((s) => {
    const old = previous.find((p) => p.id === s.id);
    return { ...s, ...(old?.editor ? { editor: old.editor } : {}),
      ...(old?.editor?.entryTransition===undefined?{}:{entryTransition:old.editor.entryTransition??undefined}) };
  });
}
