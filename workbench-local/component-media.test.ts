import { describe, it, expect } from "vitest";
import {
  componentMediaRequirement,
  validateComponentInterval,
  resolveComponentMedia,
} from "./component-media";
import { COMPONENT_LIBRARY } from "../modules/components/component-library";
const assetId = "cd6deac6-c969-4ca6-9d67-1e771c4a2a33";
const base = {
  from: 60,
  duration: 30,
  cutDuration: 120,
  resolveAsset: async (id: string) => {
    if (id !== assetId) throw Error("素材不存在");
    return { id, kind: "video" as const, durationFrames: 90 };
  },
};
describe("component media bindings", () => {
  it("rejects a transition that cannot finish in its selected interval", () => {
    expect(() =>
      validateComponentInterval(
        "TRANSITION",
        { startFrame: 58, transitionFrames: 44 },
        60,
      ),
    ).toThrow("超出");
    expect(() =>
      validateComponentInterval(
        "TRANSITION",
        { startFrame: 0, transitionFrames: 30 },
        60,
      ),
    ).not.toThrow();
  });
  it("requires explicit two-source bindings and preserves independent in-points", async () => {
    await expect(resolveComponentMedia({ ...base, count: 2 })).rejects.toThrow(
      "2 份",
    );
    const sources = await resolveComponentMedia({
      ...base,
      count: 2,
      bindings: [
        { source: "cut" },
        { source: "asset", assetId, startFrame: 20 },
      ],
    });
    expect(sources.map((s) => s.startFrame)).toEqual([60, 20]);
    expect(sources[1].assetId).toBe(assetId);
  });
  it("rejects missing assets, short sources and traversal before render", async () => {
    await expect(
      resolveComponentMedia({
        ...base,
        count: 1,
        bindings: [{ source: "asset", assetId, startFrame: 70 }],
      }),
    ).rejects.toThrow("长度不足");
    await expect(
      resolveComponentMedia({
        ...base,
        count: 1,
        bindings: [{ source: "asset", assetId: "../secret", startFrame: 0 }],
      }),
    ).rejects.toThrow();
    await expect(
      resolveComponentMedia({
        ...base,
        count: 1,
        bindings: [
          {
            source: "asset",
            assetId: "cd6deac6-c969-4ca6-9d67-1e771c4a2a34",
            startFrame: 0,
          },
        ],
      }),
    ).rejects.toThrow("不存在");
    await expect(
      resolveComponentMedia({ ...base, count: 1, from: 100 }),
    ).rejects.toThrow("超出");
  });
  it("resolves stills without imposing video duration and supports legacy single-source selection", async () => {
    expect(
      (await resolveComponentMedia({ ...base, count: 1 }))[0].startFrame,
    ).toBe(60);
    expect(
      (
        await resolveComponentMedia({
          ...base,
          count: 1,
          bindings: [{ source: "asset", assetId, startFrame: 0 }],
          resolveAsset: async (id) => ({ id, kind: "image" }),
        })
      )[0].kind,
    ).toBe("image");
  });
  it("derives required inputs from the final App definitions including transitions", () => {
    for (const definition of COMPONENT_LIBRARY) {
      const r = componentMediaRequirement(
        definition.componentId,
        definition.sampleParameters,
      );
      expect(r.labels.length).toBe(r.count);
      if (definition.mount === "TRANSITION") expect(r.count).toBe(2);
    }
  });
});
