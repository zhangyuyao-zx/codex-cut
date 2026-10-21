// Direct DirectedNarration calls select a branch from the scene ID suffix and
// look up these exact beat IDs. SavedAnimation remaps both and is not direct.
// Keep this preflight in sync with scenes/DirectedNarration.tsx.
const directedCues: Readonly<Record<number, readonly number[]>> = {
  1: [23, 28, 31, 36],
  2: [49, 52],
  4: [124],
  5: [],
  6: [142, 145],
  7: [153, 156, 158, 161],
  8: [189, 191, 196],
  9: [209, 211, 214],
  10: [235, 241, 243, 245, 248, 279],
  11: [327, 343],
  12: [345, 348],
};

export function assertSceneCueContract(scene: {
  id: string;
  title: string;
  moduleId: string;
  parameters: Record<string, unknown>;
  beats: {wordId: string}[];
}) {
  if (scene.moduleId !== "directed-narration") return;
  const branch = Number(scene.id.split("-").at(-1));
  const required = directedCues[branch];
  const prefix = `「${scene.title}」使用了 DJI 专用动画 directed-narration`;
  if (!required)
    throw Error(`${prefix}，段落 ID「${scene.id}」没有对应分镜。请改用适配当前内容的动画或已保存动画。`);
  const beatIds = new Set(scene.beats.map((beat) => beat.wordId));
  const missing = required.map((cue) => `dji-word-${cue}`).filter((id) => !beatIds.has(id));
  if (missing.length)
    throw Error(`${prefix}，缺少专用动作节拍：${missing.join("、")}。普通文稿词不能替代这些节拍；请适配动画或使用已保存动画。`);
  if (branch === 1 && String(scene.parameters.labels).split("|").length > 4)
    throw Error(`${prefix}，第 1 分镜最多支持 4 条文字，请调整文字或适配动画。`);
}
