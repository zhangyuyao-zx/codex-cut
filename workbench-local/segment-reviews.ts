import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type SegmentRange = {sceneId: string; from: number; end: number};
/** Assign inter-phrase silence to the preceding scene; cover every output frame exactly once. */
export function segmentRanges(scenes: {id: string; startMs: number | null; endMs: number | null}[], durationMs: number): SegmentRange[] {
  const total = Math.round(durationMs * 30 / 1000);
  if (!scenes.length) return [];
  if (!Number.isSafeInteger(total) || total < 1) throw Error('视频时长无效');
  const starts = scenes.map(s => Math.round(s.startMs! * 30 / 1000));
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (s.startMs === null || s.endMs === null || !Number.isFinite(s.startMs) || !Number.isFinite(s.endMs) || s.startMs < 0 || s.endMs <= s.startMs || s.endMs > durationMs + 0.1 || (i > 0 && (s.startMs < scenes[i-1].endMs! || starts[i] <= starts[i-1]))) throw Error('段落范围需要重新定位');
  }
  return scenes.map((s, i) => {
    const range = {sceneId: s.id, from: i === 0 ? 0 : starts[i], end: starts[i+1] ?? total};
    if (range.end <= range.from || range.end > total) throw Error('段落帧范围无效');
    return range;
  });
}
export type SegmentRender = SegmentRange & {
  id: string; key: string; status: string; url?: string; pictureHash?: string;
  revision: number; pendingMaterials: boolean; progress: number;
  stage?: string; error?: string; sourceAssetUrl?: string;
};
export type SegmentApproval = SegmentRender & {at: string};
type Ledger = {version: 1; renders: SegmentRender[]; approvals: SegmentApproval[]};
export function segmentReviewState(range: SegmentRange, key: string, renders: SegmentRender[], approvals: SegmentApproval[], feedbackOpen = 0) {
  const history = renders.filter(r => r.sceneId === range.sceneId).map(r => ({...r, current: r.key === key && r.from === range.from && r.end === range.end}));
  const latest = history.at(-1) ?? null;
  const saved = approvals.filter(a => a.sceneId === range.sceneId).at(-1);
  const approved = saved ? {...saved, current: saved.key === key && saved.from === range.from && saved.end === range.end} : null;
  const status = feedbackOpen ? 'changes' : approved?.current ? 'approved' : latest?.current && latest.status === 'done' ? 'pending' : history.length || approved ? 'changes' : 'unrendered';
  return {...range, key, latest, approved, history, feedbackOpen, status};
}
export function assemblySegments(reviews: ReturnType<typeof segmentReviewState>[], total: number) {
  if (!reviews.length) throw Error('请先制作视觉段落');
  let frame = 0;
  const clips = reviews.map(r => {
    const a = r.approved;
    if (r.status !== 'approved' || !a?.current || !a.url || !a.pictureHash || a.pendingMaterials || a.status !== 'done') throw Error('还有段落未确认或已修改，请逐段审阅后再合成');
    if (a.from !== frame || a.end <= frame) throw Error('已确认段落存在间隙或重叠，请重新渲染受影响段落');
    frame = a.end;
    return a;
  });
  if (frame !== total) throw Error('已确认段落未覆盖完整视频');
  return clips;
}
export async function fileDigest(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
/** Immutable render identities and append-only approval history, serialized atomic writes. */
export class SegmentReviewStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}
  private async load(): Promise<Ledger> {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (value.version !== 1 || !Array.isArray(value.renders) || !Array.isArray(value.approvals)) throw Error('段落审阅记录格式损坏');
      return value;
    } catch(e: any) {
      if (e.code === 'ENOENT') return {version: 1, renders: [], approvals: []};
      throw e;
    }
  }
  async get() {await this.queue; return this.load();}
  private change(fn: (state: Ledger) => void) {
    const work = this.queue.then(async () => {
      const state = await this.load(); fn(state);
      await mkdir(dirname(this.file), {recursive: true});
      const temp = this.file + '.' + randomUUID() + '.tmp';
      await writeFile(temp, JSON.stringify(state, null, 2));
      await rename(temp, this.file);
    });
    this.queue = work.catch(() => {}); return work;
  }
  save(render: SegmentRender) {
    const snapshot = structuredClone(render);
    return this.change(state => {
      const i = state.renders.findIndex(r => r.id === snapshot.id);
      if (i >= 0) {
        if (state.renders[i].status === 'done') {
          if (JSON.stringify(state.renders[i]) !== JSON.stringify(snapshot)) throw Error('已完成段落不可覆盖');
          return;
        }
        state.renders[i] = snapshot;
      } else state.renders.push(snapshot);
    });
  }
  approve(sceneId: string, renderId: string, key: string) {
    return this.change(state => {
      const r = state.renders.find(r => r.id === renderId && r.sceneId === sceneId);
      if (!r || r.key !== key || r.status !== 'done' || r.pendingMaterials || !r.url || !r.pictureHash) throw Error('请先观看当前段落的完整渲染并补齐素材');
      state.approvals.push({...r, at: new Date().toISOString()});
    });
  }
  recover() {
    return this.change(state => {
      for (const r of state.renders) if (['rendering', 'cancelling'].includes(r.status)) {
        r.status = 'failed'; r.error = '上次渲染已中断，可重新制作；已确认版本仍保留。';
      }
    });
  }
}
