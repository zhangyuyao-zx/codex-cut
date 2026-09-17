import { describe, expect, it } from "vitest";
import { expandRangeToFrame, wordIdsBetween } from "./roughcut-selection.js";

const words = [
  { id: "w1" },
  { id: "w2" },
  { id: "w3" },
  { id: "w4" },
];

describe("roughcut transcript selection", () => {
  it("returns an inclusive ordered range for forward and backward anchors", () => {
    expect(wordIdsBetween(words, "w2", "w4")).toEqual(["w2", "w3", "w4"]);
    expect(wordIdsBetween(words, "w4", "w2")).toEqual(["w2", "w3", "w4"]);
  });

  it("returns a single word for the same anchor and ignores unknown ids", () => {
    expect(wordIdsBetween(words, "w3", "w3")).toEqual(["w3"]);
    expect(wordIdsBetween(words, "missing", "w3")).toEqual([]);
  });

  it("expands restore intervals outward and clamps them to the asset", () => {
    const expanded = expandRangeToFrame({ startMs: 1_320, endMs: 2_260 }, 2_300);
    expect(expanded.startMs).toBeCloseTo(1_300, 8);
    expect(expanded.endMs).toBeCloseTo(2_266.666666666667, 8);

    const clamped = expandRangeToFrame({ startMs: 2_230, endMs: 2_299 }, 2_250);
    expect(clamped.startMs).toBeCloseTo(2_200, 8);
    expect(clamped.endMs).toBe(2_250);
  });
});
