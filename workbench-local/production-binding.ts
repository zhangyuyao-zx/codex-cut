import type { Scene, ProductionState } from "./production-store";
import { findCutWord, projectCutWords, type RoughcutState } from "./roughcut-service";
import {resolveCutTimeline} from './cut-timeline';
export function resolveProduction(plan: ProductionState, cut: RoughcutState) {
  const issues: string[] = [];
  const words = projectCutWords(cut);
  const find = (id: string) => {
    if (!cut.timeline) return words.filter(w => w.sourceId === id);
    const word = findCutWord(words, id);
    if (!word && words.filter(w => w.legacySourceId === id).length > 1)
      issues.push(`旧词「${id}」对应多个保留片段，请重新选择具体出现位置。`);
    return word ? [word] : [];
  };
  if (!cut.asset || !plan.source || plan.source.assetUrl !== cut.asset.url)
    issues.push("制作方案与当前素材不一致，需要 Codex 为当前素材提交方案。");
  let previous = -1;
  const scenes = plan.scenes.map((s) => {
    const first = find(s.startWordId),
      last = find(s.endWordId);
    const startMs = first[0]?.startMs,
      endMs = last.at(-1)?.endMs;
    if (startMs === undefined || endMs === undefined)
      issues.push(`「${s.title}」引用的词已删除，请重新指定起止词。`);
    else if (endMs <= startMs || startMs < previous)
      issues.push(`「${s.title}」的段落顺序或范围不正确。`);
    previous = endMs ?? previous;
    let priorBeat = -1;
    const beats = s.beats.map((b) => {
      const w = find(b.wordId)[0];
      if (!w) issues.push(`「${s.title}」的动作「${b.label}」引用词已删除。`);
      else if (
        startMs !== undefined &&
        endMs !== undefined &&
        (w.startMs < startMs || w.startMs >= endMs)
      )
        issues.push(`「${b.label}」不在所属段落中。`);
      if (w && w.startMs < priorBeat)
        issues.push(`「${s.title}」的动作顺序与口播不一致。`);
      priorBeat = w?.startMs ?? priorBeat;
      return { ...b, wordId: w?.sourceId ?? b.wordId, timeMs: w?.startMs ?? null };
    });
    return { ...s, startMs: startMs ?? null, endMs: endMs ?? null, beats };
  });
  return {
    scenes,
    issues,
    stale: plan.source?.cutRevision !== cut.revision,
    words,
    durationMs: cut.timeline ? resolveCutTimeline(cut.timeline).durationFrames * 1000 / 30 : cut.ranges.reduce((n, r) => n + r.endMs - r.startMs, 0),
  };
}
/** This is an explicitly authored program, not a fallback layout for arbitrary content. */
export function buildSpokenTimelineProps(
  plan: ProductionState,
  cut: RoughcutState,
) {
  const binding = resolveProduction(plan, cut);
  if (binding.issues.length) throw Error(binding.issues.join("\n"));
  if (binding.stale) throw Error("粗剪已更新，请先同步并检查段落。");
  if (!cut.preview || cut.preview.revision !== cut.revision)
    throw Error("请先生成当前粗剪的连续预览。");
  const ids = ["intro", "transcript", "alignment"];
  if (
    plan.scenes.length !== 3 ||
    !ids.every((id) => plan.scenes.some((s) => s.id === id))
  )
    throw Error("当前方案尚未配置动画程序，请由 Codex 编写对应的场景实现。");
  const scene = (id: string) => plan.scenes.find((s) => s.id === id)!;
  const beat = (id: string, index: number) => {
    const b = scene(id).beats[index];
    if (!b) throw Error("动画程序缺少语义节拍");
    const w = findCutWord(binding.words, b.wordId);
    if (!w) throw Error("动作引用词不存在");
    return Math.round((w.startMs * 30) / 1000);
  };
  const intro = scene("intro"),
    selection = binding.words.filter(
      (w) => w.startMs >= (binding.scenes[0].beats[0]?.timeMs ?? 0),
    );
  const phrase = selection.slice(0, 8);
  if (
    phrase.length < 8 ||
    phrase.map((w) => w.text).join("") !== "导入一段口播视频"
  )
    throw Error(
      "当前动画程序针对“口播转写并对齐时间线”这段内容。文稿变化后需由 Codex 更新实现，不能套用旧动画。",
    );
  const groups = [0, 2, 4, 6].map((i) => ({
    text: phrase
      .slice(i, i + 2)
      .map((w) => w.text)
      .join(""),
    start: (phrase[i].startMs * 30) / 1000,
    end: (phrase[i + 1].endMs * 30) / 1000,
  }));
  return {
    words: groups,
    wave: [],
    excerptWave: [],
    duration: Math.round((binding.durationMs * 30) / 1000),
    timing: {
      auto: beat("transcript", 0),
      transcript: beat("transcript", 1),
      text: beat("alignment", 0),
      timeline: beat("alignment", 1),
      alignEnd: beat("alignment", 2) + 8,
    },
    values: {
      title: "每个词，",
      accent: "#E1F795",
      personScale: 1,
      personX: 0,
      personY: 0,
      titleScale: 1,
    },
    motion: { offsetFrames: 0 },
    headlines: {
      intro: intro.title,
      transcript: scene("transcript").title,
      alignment: scene("alignment").title,
    },
    mediaSrc: cut.preview.url,
  };
}
