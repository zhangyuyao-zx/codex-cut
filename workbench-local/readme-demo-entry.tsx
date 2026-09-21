import React from "react";
import {
  AbsoluteFill,
  Composition,
  Sequence,
  registerRoot,
} from "remotion";
import {ComponentRuntimeRenderer} from "../modules/components/component-runtime-renderer";

const FPS = 30;
const SCENE_FRAMES = 75;

const motion = {
  intensity: 0.72,
  reducedMotion: false,
};

const RuntimeScene = ({
  componentId,
  parameters,
}: {
  componentId: string;
  parameters: Record<string, unknown>;
}) => (
  <AbsoluteFill style={{backgroundColor: "#0b0d0c"}}>
    <ComponentRuntimeRenderer
      componentId={componentId}
      parameters={parameters}
      durationInFrames={SCENE_FRAMES}
    />
  </AbsoluteFill>
);

const ReadmeDemo = () => (
  <AbsoluteFill style={{backgroundColor: "#0b0d0c"}}>
    <Sequence durationInFrames={SCENE_FRAMES}>
      <RuntimeScene
        componentId="component:next-core:v1:word-relay"
        parameters={{
          ...motion,
          label: "CODEX CUT / CONTENT INTELLIGENCE",
          headline: "从口播内容到可执行画面",
          accentColor: "#b7ca86",
        }}
      />
    </Sequence>

    <Sequence from={SCENE_FRAMES} durationInFrames={SCENE_FRAMES}>
      <RuntimeScene
        componentId="component:next-core:v1:connection-flyline"
        parameters={{
          ...motion,
          title: "一段内容，一条可检查的视觉链路",
          accentColor: "#b7ca86",
          showDirection: true,
          nodes: [
            {id: "words", label: "口播词句", x: 13, y: 50},
            {id: "meaning", label: "重点与关系", x: 40, y: 24},
            {id: "timing", label: "逐词时间", x: 40, y: 76},
            {id: "scene", label: "单段动画", x: 69, y: 24},
            {id: "review", label: "真实样片", x: 86, y: 62},
          ],
          edges: [
            {from: "words", to: "meaning", label: "理解"},
            {from: "words", to: "timing", label: "对齐"},
            {from: "meaning", to: "scene", label: "编排"},
            {from: "timing", to: "review", label: "触发"},
            {from: "scene", to: "review", label: "渲染"},
          ],
        }}
      />
    </Sequence>

    <Sequence from={SCENE_FRAMES * 2} durationInFrames={SCENE_FRAMES}>
      <RuntimeScene
        componentId="component:catalog-completion:v1:step-progress"
        parameters={{
          ...motion,
          title: "每个视觉段落单独制作、单独确认",
          activeStepId: "motion",
          orientation: "horizontal",
          accentColor: "#b7ca86",
          steps: [
            {id: "segment", label: "视觉段落", detail: "明确画面任务", state: "completed"},
            {id: "objects", label: "信息对象", detail: "主次与关系", state: "completed"},
            {id: "layout", label: "布局包装", detail: "设计构图", state: "completed"},
            {id: "motion", label: "动画实现", detail: "绑定口播", state: "current"},
            {id: "review", label: "用户确认", detail: "样片通过", state: "pending"},
          ],
        }}
      />
    </Sequence>

    <Sequence from={SCENE_FRAMES * 3} durationInFrames={SCENE_FRAMES}>
      <RuntimeScene
        componentId="component:next-core:v1:numeric-counter"
        parameters={{
          ...motion,
          value: 194,
          startValue: 0,
          precision: 0,
          unit: "ANIMATION CORES",
          label: "AUDITED AND EDITABLE",
          accentColor: "#b7ca86",
        }}
      />
    </Sequence>
  </AbsoluteFill>
);

registerRoot(() => (
  <Composition
    id="CodexCutReadmeDemo"
    component={ReadmeDemo}
    width={1920}
    height={1080}
    fps={FPS}
    durationInFrames={SCENE_FRAMES * 4}
  />
));
