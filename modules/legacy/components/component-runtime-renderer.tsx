import {EXPLAINER_DEFINITIONS} from "../component-lab/catalog-completion/explainer-definitions.js";
import {ExplainerCore} from "../component-lab/catalog-completion/explainer-cores.js";
import { type ReactNode } from "react";
import {
  AreaChartCore,
  ClockDialCore,
  ColorTreatmentCore,
  CreditsRollCore,
  LoaderIndicatorCore,
  MediaFrameCore,
  MediaGridCore,
  RadialChartCore,
} from "../component-lab/new-cores/object-cores.js";
import {
  CameraOrbitCore,
  CameraShakeCore,
  CrossDissolveCore,
  LiquidTransitionCore,
} from "../component-lab/new-cores/camera-boundary-cores.js";
import {
  ChannelDistortionCore,
  KaleidoscopeSymmetryCore,
  LightOverlayCore,
  LiquidBlobCore,
  LiquidFlowCore,
  LiquidInkCore,
  LiquidRippleCore,
  LiquidSurfaceCore,
  LiquidSwirlCore,
} from "../component-lab/new-cores/surface-cores.js";
import { AudioCore, DataCore } from "../component-lab/next-cores/data-audio-cores.js";
import { MediaCore, RelationCore } from "../component-lab/next-cores/relation-media-cores.js";
import { SceneCore, TransitionCore } from "../component-lab/next-cores/scene-transition-cores.js";
import { AnnotationCore, TextCore, UiCore } from "../component-lab/next-cores/text-ui-cores.js";
import { CompletionAnnotationCore, CompletionCodeUiCore } from "../component-lab/catalog-completion/code-ui-cores.js";
import { CompletionDataCore, CompletionMediaCore, CompletionRelationCore, CompletionSceneCore } from "../component-lab/catalog-completion/media-data-cores.js";
import {
  ComponentRuntimeProvider,
  runtimeStyleProperties,
  type ComponentRuntimeStyle,
} from "./component-runtime-context.js";
import {
  componentRuntimeDefinition,
  componentRuntimeRequiredMediaNodeCount,
  validateComponentParameters,
  type ComponentRuntimeDefinition,
} from "./component-runtime-catalog.js";

export interface ComponentRuntimeRendererProps {
  componentId: string;
  parameters: Record<string, unknown>;
  content?: ReactNode;
  media?: readonly ReactNode[];
  fromScene?: ReactNode;
  toScene?: ReactNode;
  durationInFrames: number;
  speed?: number;
  style?: ComponentRuntimeStyle;
  transparentStage?: boolean;
}

const newCoreComponents: Record<string, (props: any) => ReactNode> = {
  "area-chart": AreaChartCore,
  "camera-orbit": CameraOrbitCore,
  "camera-shake": CameraShakeCore,
  "channel-distortion": ChannelDistortionCore,
  "clock-dial": ClockDialCore,
  "color-treatment": ColorTreatmentCore,
  "credits-roll": CreditsRollCore,
  "cross-dissolve": CrossDissolveCore,
  "kaleidoscope-symmetry": KaleidoscopeSymmetryCore,
  "light-overlay": LightOverlayCore,
  "liquid-blob": LiquidBlobCore,
  "liquid-flow": LiquidFlowCore,
  "liquid-ink": LiquidInkCore,
  "liquid-ripple": LiquidRippleCore,
  "liquid-surface": LiquidSurfaceCore,
  "liquid-swirl": LiquidSwirlCore,
  "liquid-transition": LiquidTransitionCore,
  "loader-indicator": LoaderIndicatorCore,
  "media-frame": MediaFrameCore,
  "media-grid": MediaGridCore,
  "radial-chart": RadialChartCore,
};

const nextCoreComponents: Record<string, (props: any) => ReactNode> = {
  "ambient-particle": SceneCore,
  "audio-spectrum": AudioCore,
  "audio-waveform": AudioCore,
  "bar-chart": DataCore,
  "before-after": MediaCore,
  "brand-lockup": TextCore,
  "camera-transform": SceneCore,
  "card-deck": RelationCore,
  "card-flip": RelationCore,
  "card-stack": RelationCore,
  "chart-axis-rescale": DataCore,
  "clone-depth-echo": RelationCore,
  "connection-flyline": RelationCore,
  "cube-transition": TransitionCore,
  "depth-camera": SceneCore,
  "flow-diagram": RelationCore,
  "gauge-arc": DataCore,
  "geometric-wipe": TransitionCore,
  "gradient-text": TextCore,
  "hud-focus": AnnotationCore,
  "icon-feedback": AnnotationCore,
  "impact-feedback": TextCore,
  "karaoke-progress": TextCore,
  "kinetic-type": TextCore,
  "line-chart": DataCore,
  "list-sequence": RelationCore,
  "media-carousel": MediaCore,
  "media-tour": MediaCore,
  "numeric-counter": DataCore,
  "panel-grid": RelationCore,
  "particle-celebration": SceneCore,
  "particle-transition": TransitionCore,
  "progress-bar": DataCore,
  "prompt-paste": UiCore,
  "response-stream": UiCore,
  "scene-push": TransitionCore,
  "screen-frame": UiCore,
  "selection-control": UiCore,
  "shared-morph": TransitionCore,
  "smear-trail": SceneCore,
  "space-camera": SceneCore,
  "speed-ramp": SceneCore,
  "split-flap": TextCore,
  "spotlight-scan": UiCore,
  "stream-line-chart": DataCore,
  "terminal-type": UiCore,
  "text-fracture": TextCore,
  "text-reveal": TextCore,
  "texture-dissolve": TransitionCore,
  "theme-transition": TransitionCore,
  "time-relation": RelationCore,
  "typewriter": TextCore,
  "ui-materialize": UiCore,
  "unit-chart": DataCore,
  "word-relay": TextCore,
};

const completionCoreComponents: Record<string, (props: any) => ReactNode> = {
  "border-light-trace": CompletionAnnotationCore,
  "chat-thread": CompletionCodeUiCore,
  "code-block": CompletionCodeUiCore,
  "code-diff": CompletionCodeUiCore,
  "code-focus": CompletionCodeUiCore,
  "icon-cloud": CompletionRelationCore,
  "map-data": CompletionDataCore,
  "media-pan-zoom": CompletionMediaCore,
  "media-treatment": CompletionMediaCore,
  "metric-card": CompletionDataCore,
  "perspective-grid": CompletionSceneCore,
  "step-progress": CompletionRelationCore,
  "stroke-trace": CompletionAnnotationCore,
};

const componentFor = (definition: ComponentRuntimeDefinition): ((props: any) => ReactNode) | null => {
  if(EXPLAINER_DEFINITIONS.some(d=>d.componentId===definition.componentId))return ExplainerCore;
  if (definition.componentId.startsWith("component:new-core:v1:")) return newCoreComponents[definition.coreId] ?? null;
  if (definition.componentId.startsWith("component:next-core:v1:")) return nextCoreComponents[definition.coreId] ?? null;
  if (definition.componentId.startsWith("component:catalog-completion:v1:")) return completionCoreComponents[definition.coreId] ?? null;
  return null;
};

const withSourceContent = (
  coreId: string,
  parameters: Record<string, unknown>,
  content: ReactNode | undefined,
  media: readonly ReactNode[],
): Record<string, unknown> => {
  const next = { ...parameters };
  const first = content ?? media[0];
  if (["before-after"].includes(coreId)) {
    if (media[0] !== undefined) next.before = media[0];
    if (media[1] !== undefined) next.after = media[1];
  } else if (coreId === "card-flip") {
    if (media[0] !== undefined) next.front = media[0];
    if (media[1] !== undefined) next.back = media[1];
  } else if (["cross-dissolve", "liquid-transition", "cube-transition", "geometric-wipe", "particle-transition", "scene-push", "shared-morph", "texture-dissolve", "theme-transition"].includes(coreId)) {
    if (next.fromScene === undefined && media[0] !== undefined) next.fromScene = media[0];
    if (next.toScene === undefined && media[1] !== undefined) next.toScene = media[1];
  } else if (first !== undefined) {
    next.content = first;
  }
  const mapNestedMedia = (key: string) => {
    const value = next[key];
    if (!Array.isArray(value) || media.length === 0) return;
    next[key] = value.map((entry, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
      return { ...(entry as Record<string, unknown>), content: media[index] ?? (entry as Record<string, unknown>).content };
    });
  };
  for (const key of ["items", "panels", "layers"]) mapNestedMedia(key);
  return next;
};

const requireSourceSlots = (
  definition: ComponentRuntimeDefinition,
  parameters: Record<string, unknown>,
  content: ReactNode | undefined,
  media: readonly ReactNode[],
  fromScene: ReactNode | undefined,
  toScene: ReactNode | undefined,
): void => {
  for (const slot of definition.mediaSlots) {
    if (slot === "content" && content === undefined && media[0] === undefined) {
      throw new Error(`${definition.componentId}: source slot "content" is required`);
    }
    if (slot === "media") {
      const expected = componentRuntimeRequiredMediaNodeCount(definition.componentId, parameters);
      if (media.length < expected) throw new Error(`${definition.componentId}: source slot "media" requires at least ${expected} node(s)`);
    }
    if (slot === "fromScene" && fromScene === undefined && media[0] === undefined) {
      throw new Error(`${definition.componentId}: source slot "fromScene" is required`);
    }
    if (slot === "toScene" && toScene === undefined && media[1] === undefined) {
      throw new Error(`${definition.componentId}: source slot "toScene" is required`);
    }
  }
};

const safeDuration = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Component runtime durationInFrames must be a positive finite number");
  return Math.max(1, Math.round(value));
};

const safeSpeed = (value: number | undefined): number => {
  if (value === undefined) return 1;
  if (!Number.isFinite(value) || value <= 0 || value > 16) throw new Error("Component runtime speed must be a finite number in (0, 16]");
  return value;
};

export const ComponentRuntimeRenderer = ({
  componentId,
  parameters,
  content,
  media: inputMedia = [],
  fromScene,
  toScene,
  durationInFrames,
  speed = 1,
  style,
  transparentStage = false,
}: ComponentRuntimeRendererProps) => {
  const definition = componentRuntimeDefinition(componentId);
  if (!definition) throw new Error(`Unknown component runtime id: ${componentId}`);
  const component = componentFor(definition);
  if (!component) throw new Error(`${componentId}: no actual Core export is registered for ${definition.rendererId}`);
  const RuntimeComponent = component;
  const media = [...inputMedia];
  const validated = validateComponentParameters(componentId, parameters);
  requireSourceSlots(definition, validated, content, media, fromScene, toScene);
  // Optional editorial copy is blank when omitted. Core demonstration titles
  // must not appear in a real project merely because a model omitted a field.
  const editorialKeys=new Set(["title","label","caption","sourceLabel","footer","name","tagline","headline","prompt","modelLabel","conclusion","centerLabel","beforeLabel","afterLabel","unit","text"]);
  for(const control of definition.controls) if(!control.required && editorialKeys.has(control.key) && validated[control.key] === undefined) validated[control.key]="";
  const props = withSourceContent(definition.coreId, validated, content, media);
  if (fromScene !== undefined) props.fromScene = fromScene;
  if (toScene !== undefined) props.toScene = toScene;
  if(EXPLAINER_DEFINITIONS.some(d=>d.componentId===componentId)){props.content=media[0]??content;props.media=media;props.fromScene=fromScene??media[0];props.toScene=toScene??media[1];}
  props.coreId = definition.coreId;
  return (
    <div
      data-component-runtime-id={componentId}
      data-component-runtime-mount={definition.mount}
      style={{
        position: "relative",
        width: 1920,
        height: 1080,
        overflow: "hidden",
        ...runtimeStyleProperties(style),
      }}
    >
      <ComponentRuntimeProvider
        durationInFrames={safeDuration(durationInFrames)}
        speed={safeSpeed(speed)}
        style={style}
        transparentStage={transparentStage}
      >
        <RuntimeComponent {...props} />
      </ComponentRuntimeProvider>
    </div>
  );
};

export default ComponentRuntimeRenderer;
