import {describe,expect,it} from "vitest";
import {sceneEntryTransitionSchema,transitionProgress} from "./scene-transition";

describe("scene transition contract",()=>{
  it("validates the narrow entry transition schema",()=>{
    expect(sceneEntryTransitionSchema.parse({type:"dissolve",frames:2})).toEqual({type:"dissolve",frames:2});
    expect(sceneEntryTransitionSchema.parse({type:"slide-left",frames:30})).toEqual({type:"slide-left",frames:30});
    expect(()=>sceneEntryTransitionSchema.parse({type:"dissolve",frames:1})).toThrow();
    expect(()=>sceneEntryTransitionSchema.parse({type:"wipe",frames:4})).toThrow();
    expect(()=>sceneEntryTransitionSchema.parse({type:"dissolve",frames:4,extra:true})).toThrow();
  });

  it("maps zero to A, the final window frame to B, and short spans directly to B",()=>{
    expect(transitionProgress(0,6,6)).toBe(0);
    expect(transitionProgress(1,6,6)).toBe(0.2);
    expect(transitionProgress(5,6,6)).toBe(1);
    expect(transitionProgress(9,6,6)).toBe(1);
    expect(transitionProgress(0,6,3)).toBe(0);
    expect(transitionProgress(2,6,3)).toBe(1);
    expect(transitionProgress(0,6,1)).toBe(1);
    expect(transitionProgress(0,1,6)).toBe(1);
  });
});
