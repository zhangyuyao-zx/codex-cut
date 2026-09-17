/** Review positions are editorial metadata, never invented animation timings. */
export interface ReviewAction {
  id: string;
  anchorOnly?: boolean;
  label: string;
  quote?: string;
  objectId?: string;
  before?: string;
  after?: string;
  startMs: number | null;
  endMs: number | null;
  issue?: string;
}
export function reviewActions(design: any, beats: any[], startMs: number | null, endMs: number | null, words: any[] = []): ReviewAction[] {
  const anchorOnly = !design?.actions?.length;
  const actions = design?.actions?.length ? design.actions : beats.map(b => ({wordId: b.wordId, action: b.label}));
  return actions.map((a: any, i: number) => {
    const beat = beats.find(b => b.wordId === a.wordId);
    const start = typeof beat?.timeMs === 'number' ? beat.timeMs + (a.offsetMs ?? 0) : null;
    const end = start !== null && typeof a.durationMs === 'number' ? start + a.durationMs : null;
    const invalid = start === null || !Number.isFinite(start) || startMs === null || endMs === null || start < startMs || start >= endMs || (end !== null && (!Number.isFinite(end) || end <= start || end > endMs));
    const wordIndex = words.findIndex(w => w.sourceId === a.wordId);
    let quote = '';
    if (wordIndex >= 0) {
      let first = wordIndex, last = wordIndex;
      while (first > 0 && wordIndex - first < 20 && !/[。！？!?，,；;]$/.test(words[first - 1].text) && words[first - 1].startMs >= (startMs ?? 0)) first--;
      while (last < words.length - 1 && last - first < 36 && !/[。！？!?，,；;]$/.test(words[last].text) && words[last + 1].endMs <= (endMs ?? Infinity)) last++;
      quote = words.slice(first,last+1).map(w => w.text).join('');
    }
    const placeholder = /分镜\s*\d+/.test(a.action || '') || (a.action || '').length < 3;
    const onlyAnchor = anchorOnly || (end === null && !a.before && !a.after);
    return {id: `${a.wordId}:${i}`, anchorOnly: onlyAnchor, label: placeholder ? (quote || "口播时间点") : a.action, quote: placeholder ? undefined : quote, objectId: a.objectId, before: a.before, after: a.after,
      startMs: invalid ? null : start, endMs: invalid ? null : end,
      issue: invalid ? '口播引用或动作范围需要重新定位' : undefined};
  });
}
export function actionFrame(action: ReviewAction, phase: 'start' | 'middle' | 'end', fps = 30): number | null {
  if (action.startMs === null || (phase !== 'start' && action.endMs === null)) return null;
  const start = Math.round(action.startMs * fps / 1000);
  const last = Math.max(start, Math.ceil((action.endMs ?? action.startMs) * fps / 1000) - 1);
  return phase === 'start' ? start : phase === 'end' ? last : Math.round((start + last) / 2);
}
export function localPlaybackTime(frame: number, offsetSeconds: number, durationSeconds: number) {
  return Math.max(0, Math.min(Math.max(0, durationSeconds - 1 / 30), frame / 30 - offsetSeconds));
}
