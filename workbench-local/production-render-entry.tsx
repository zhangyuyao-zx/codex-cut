import React from "react";
import { Composition, registerRoot } from "remotion";
import { ProductionProgram, type ProgramProps } from "./ProductionProgram";
const defaults: ProgramProps = {
  words: [{ text: "口播", start: 0, end: 30 }],
  wave: [],
  excerptWave: [],
  timing: { auto: 60, transcript: 80, text: 120, timeline: 140, alignEnd: 170 },
  duration: 180,
  values: {
    title: "每个词，",
    accent: "#E1F795",
    personScale: 1,
    personX: 0,
    personY: 0,
    titleScale: 1,
  },
  motion: { offsetFrames: 0 },
  pendingMaterials: false,
  supports: [],
};
registerRoot(() => (
  <Composition
    id="Production"
    component={ProductionProgram}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={180}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({ durationInFrames: props.duration })}
  />
));
