import { describe, it, expect } from "vitest";
import { resolveProduction } from "./production-binding";
import type { ProductionState } from "./production-store";
import type { RoughcutState } from "./roughcut-service";
import {cutTimelineSchema} from './cut-timeline';
const cut: RoughcutState = {
  revision: 2,
  asset: { url: "/cut-media/source.mp4", name: "test", durationMs: 4000 },
  ranges: [
    { startMs: 0, endMs: 1000 },
    { startMs: 2000, endMs: 4000 },
  ],
  words: [
    { id: "first", text: "开始", startMs: 0, endMs: 500 },
    { id: "removed", text: "删除", startMs: 1200, endMs: 1500 },
    { id: "beat", text: "重点", startMs: 2300, endMs: 2700 },
    { id: "end", text: "结尾", startMs: 3300, endMs: 3900 },
  ],
  preview: null,
  busy: false,
};
const plan: ProductionState = {
  revision: 1,
  source: { assetUrl: "/cut-media/source.mp4", cutRevision: 1 },
  scenes: [
    {
      id: "scene",
      title: "重点",
      intent: "先说再出现",
      startWordId: "first",
      endWordId: "end",
      beats: [{ wordId: "beat", label: "出现重点" }],
    },
  ],
  requests: [],
  feedback: [],
};
describe("production anchors", () => {
  it('requires an occurrence choice when an old word straddles a removed interval', () => {
    const timeline = cutTimelineSchema.parse({schemaVersion: 1, assets: [{id:'a',name:'test',durationFrames:90,
      sourceFileName:'source.mp4',proxyFileName:'proxy.mp4',words:[{id:'first',text:'跨切口',startMs:0,endMs:2500}]}],
      clips:[{id:'left',assetId:'a',inFrame:0,outFrame:30,legacyWordIds:true},
        {id:'right',assetId:'a',inFrame:60,outFrame:90,legacyWordIds:true}]});
    const scene = {...plan.scenes[0],startWordId:'first',endWordId:'first',beats:[]};
    expect(resolveProduction({...plan,scenes:[scene]},{...cut,timeline}).issues.join()).toContain('多个保留片段');
    const rebound = {...scene,startWordId:JSON.stringify(['left','first']),endWordId:JSON.stringify(['right','first'])};
    expect(resolveProduction({...plan,scenes:[rebound]},{...cut,timeline}).issues).toEqual([]);
  });
  it('keeps migrated scene bindings but does not bind them to a repeated insert', () => {
    const timeline = cutTimelineSchema.parse({schemaVersion: 1, assets: [{id: 'a', name: 'test',
      durationFrames: 120, sourceFileName: 'source.mp4', proxyFileName: 'proxy.mp4', words: cut.words}],
      clips: [{id: 'repeated', assetId: 'a', inFrame: 0, outFrame: 120},
        {id: 'legacy-0', assetId: 'a', inFrame: 0, outFrame: 30, legacyWordIds: true},
        {id: 'legacy-1', assetId: 'a', inFrame: 60, outFrame: 120, legacyWordIds: true}]});
    const resolved = resolveProduction(plan, {...cut, timeline});
    expect(resolved.issues).toEqual([]);
    expect(resolved.scenes[0].startMs).toBe(4000);
    expect(resolved.scenes[0].beats[0].timeMs).toBe(5300);
    expect(resolved.durationMs).toBe(7000);
  });
  it("relocates spoken events after an earlier cut and marks the review stale", () => {
    const r = resolveProduction(plan, cut);
    expect(r.issues).toEqual([]);
    expect(r.stale).toBe(true);
    expect(r.scenes[0].beats[0].timeMs).toBe(1300);
  });
  it("reports removed anchors instead of substituting text", () => {
    const r = resolveProduction(
      {
        ...plan,
        scenes: [
          {
            ...plan.scenes[0],
            beats: [{ wordId: "removed", label: "不能伪造" }],
          },
        ],
      },
      cut,
    );
    expect(r.issues.join()).toContain("引用词已删除");
  });
  it("rejects a different source even when word ids repeat", () => {
    expect(
      resolveProduction(plan, {
        ...cut,
        asset: { ...cut.asset!, url: "/cut-media/another.mp4" },
      }).issues.join(),
    ).toContain("素材不一致");
  });
  it("flags reversed animation beats", () => {
    const r = resolveProduction(
      {
        ...plan,
        scenes: [
          {
            ...plan.scenes[0],
            beats: [
              { wordId: "end", label: "晚" },
              { wordId: "beat", label: "早" },
            ],
          },
        ],
      },
      cut,
    );
    expect(r.issues.join()).toContain("顺序");
  });
});
