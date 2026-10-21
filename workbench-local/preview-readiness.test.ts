import {describe, expect, it} from "vitest";
import {productionContextIdentityMatches, scenePreviewReadiness} from "./preview-readiness";

const context = () => ({
  plan: {revision: 7, source: {assetUrl: "/cut-media/source.mp4", cutRevision: 3}},
  cut: {revision: 3, asset: {url: "/cut-media/source.mp4"},
    preview: {url: "/cut-media/preview-3.mp4", revision: 3,
      provenance: {inputHash: "input", contentHash: "content"}}},
  resolved: {stale: false, issues: [] as string[]},
});

describe("scene preview readiness across independent polling responses", () => {
  it("uses only media shared by coherent current and scoped contexts", () => {
    expect(scenePreviewReadiness(context(), context())).toEqual({ready: true, mediaUrl: "/cut-media/preview-3.mp4"});
  });
  it("waits safely when a same-plan-revision global response has no preview", () => {
    const current = {...context(), cut: {...context().cut, preview: null}};
    expect(scenePreviewReadiness(current, context())).toMatchObject({ready: false, kind: "waiting"});
    expect(scenePreviewReadiness(context(), current)).toMatchObject({ready: false, kind: "waiting"});
    expect(scenePreviewReadiness(undefined, undefined).ready).toBe(false);
  });
  it("rejects stale scoped props after a source or cut revision change without a plan revision change", () => {
    const old = context();
    const nextCut = {...context(), cut: {...context().cut, revision: 4}};
    const nextSource = {...context(), cut: {...context().cut, asset: {url: "/cut-media/other.mp4"}}};
    for (const current of [nextCut, nextSource]) {
      expect(productionContextIdentityMatches(current, old)).toBe(false);
      expect(scenePreviewReadiness(current, old)).toMatchObject({ready: false, kind: "waiting"});
    }
    const nextPlan = {...context(), plan: {...context().plan, revision: 8}};
    expect(productionContextIdentityMatches(nextPlan, old)).toBe(false);
  });
  it("waits for a matching current preview URL and media identity", () => {
    const staleRevision = {...context(), cut: {...context().cut, preview: {...context().cut.preview, revision: 2}}};
    const newUrl = {...context(), cut: {...context().cut, preview: {...context().cut.preview, url: "/cut-media/new.mp4"}}};
    const newContent = {...context(), cut: {...context().cut, preview: {...context().cut.preview,
      provenance: {inputHash: "input", contentHash: "changed"}}}};
    for (const current of [staleRevision, newUrl, newContent])
      expect(scenePreviewReadiness(current, context())).toMatchObject({ready: false, kind: "waiting"});
    expect(scenePreviewReadiness(newUrl, newUrl)).toEqual({ready: true, mediaUrl: "/cut-media/new.mp4"});
  });
  it("exposes source, stale binding and cut failures locally", () => {
    const wrongSource = {...context(), plan: {...context().plan, source: {assetUrl: "/other.mp4", cutRevision: 3}}};
    const stalePlan = {...context(), plan: {...context().plan, source: {...context().plan.source, cutRevision: 2}}};
    const cutError = {...context(), cut: {...context().cut, error: "编码失败"}};
    const bindingError = {...context(), resolved: {stale: false, issues: ["动作引用词已删除"]}};
    for (const current of [wrongSource, stalePlan, cutError, bindingError])
      expect(scenePreviewReadiness(current, current)).toMatchObject({ready: false, kind: "error"});
    expect(scenePreviewReadiness(cutError, cutError)).toMatchObject({message: expect.stringContaining("编码失败")});
  });
});
