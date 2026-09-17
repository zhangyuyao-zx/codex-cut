import React from "react";
import { Composition, registerRoot } from "remotion";
import { TranscriptAnimation } from "./Scene";
registerRoot(() => (
  <Composition
    id="Sample"
    component={TranscriptAnimation}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={341}
    defaultProps={{
      words: [{ text: "导入", start: 119, end: 132 }],
      wave: [],
      excerptWave: [],
      timing: {
        auto: 184,
        transcript: 209,
        text: 257,
        timeline: 278,
        alignEnd: 326,
      },
      duration: 341,
      values: {
        title: "每个词，",
        accent: "#E1F795",
        personScale: 1,
        personX: 0,
        personY: 0,
        titleScale: 1,
      },
      motion: { offsetFrames: 0 },
    }}
  />
));
