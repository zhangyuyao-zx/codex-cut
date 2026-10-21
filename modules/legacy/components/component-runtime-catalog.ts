import {REFERENCE_CORE_ALIASES} from "../component-lab/catalog-completion/reference-coverage.js";
import {EXPLAINER_DEFINITIONS, validateExplainerParameters, explainerMediaCount} from "../component-lab/catalog-completion/explainer-definitions.js";
import { SMART_PACKAGING_NEW_CORE_LAB_RECORDS_V1 } from "./smart-packaging-component-new-core.generated.js";
import { SMART_PACKAGING_CATALOG_COMPLETION_RECORDS_V1 } from "./smart-packaging-component-catalog-completion.generated.js";
import { SMART_PACKAGING_NEXT_CORE_LAB_RECORDS_V1 } from "./smart-packaging-component-next-core.generated.js";

export type ComponentRuntimeMount = "OBJECT" | "SCENE" | "TRANSITION";
export type ComponentParameterType =
  | "text"
  | "number"
  | "boolean"
  | "color"
  | "select"
  | "json";
export type ComponentParameterGroup = "content" | "style" | "motion";

export interface ComponentParameterControl {
  key: string;
  label: string;
  type: ComponentParameterType;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group?: ComponentParameterGroup;
  description?: string;
}

export interface ComponentRuntimeDefinition {
  componentId: string;
  coreId: string;
  rendererId: string;
  label: string;
  mount: ComponentRuntimeMount;
  controls: ComponentParameterControl[];
  defaultParameters: Record<string, unknown>;
  sampleParameters: Record<string, unknown>;
  mediaSlots: string[];
  searchAliases?: string[];
}

export const COMPONENT_RUNTIME_DEFINITIONS_VERSION = 1 as const;

const newComponentId = (coreId: string) => `component:new-core:v1:${coreId}`;
const nextComponentId = (coreId: string) => `component:next-core:v1:${coreId}`;
const completionComponentId = (coreId: string) => `component:catalog-completion:v1:${coreId}`;

const sampleMotion = { intensity: 0.68, reducedMotion: false } as const;
const data = [
  { label: "HOOK", value: 72 },
  { label: "PROOF", value: 88 },
  { label: "RESULT", value: 64 },
];
const chartData = [
  { label: "A", value: 42 },
  { label: "B", value: 68 },
  { label: "C", value: 56 },
  { label: "D", value: 81 },
];
const relationItems = [
  { id: "intent", title: "Intent", detail: "Confirmed viewer question" },
  { id: "evidence", title: "Evidence", detail: "Bound source object" },
  { id: "layout", title: "Layout", detail: "Capacity fit" },
  { id: "motion", title: "Motion", detail: "Reason stated" },
];
const relationNodes = [
  { id: "source", label: "Bound source", x: 14, y: 50 },
  { id: "decision", label: "Agent decision", x: 43, y: 24 },
  { id: "host", label: "Host validation", x: 43, y: 76 },
  { id: "preview", label: "Verified preview", x: 78, y: 50 },
];
const relationEdges = [
  { from: "source", to: "decision", label: "meaning" },
  { from: "source", to: "host", label: "identity" },
  { from: "decision", to: "preview", label: "plan" },
  { from: "host", to: "preview", label: "apply" },
];
const sceneLayers = [
  { id: "back", label: "BACKGROUND", depth: 0.18, color: "#0b2024" },
  { id: "context", label: "CONTEXT", depth: 0.45, color: "#153a41" },
  { id: "focus", label: "FOCUS", depth: 0.76, color: "#33e2d2" },
  { id: "front", label: "FOREGROUND", depth: 1, color: "#071012" },
];
const focusRegions = [
  { id: "toolbar", label: "Toolbar", x: 6, y: 7, width: 88, height: 15 },
  { id: "focus", label: "Primary control", x: 56, y: 34, width: 31, height: 31 },
  { id: "result", label: "Result", x: 14, y: 72, width: 72, height: 18 },
];
const stepItems = [
  { id: "brief", label: "Brief", detail: "Transcript-bound intent", state: "completed" },
  { id: "visual", label: "Visual", detail: "MAIN and support", state: "completed" },
  { id: "layout", label: "Layout", detail: "Approved master", state: "current" },
  { id: "export", label: "Export", detail: "Host validated", state: "pending" },
];
const codeLines = [
  "const main = paragraph.mainVisual;",
  "const support = paragraph.supportingVisuals;",
  "validateBoundSources(main, support);",
  "return host.renderPreview(paragraph);",
];
const completionItems = [
  { id: "transcript", icon: "T", label: "Transcript" },
  { id: "visual", icon: "V", label: "Visual roles" },
  { id: "layout", icon: "L", label: "Layout" },
  { id: "preview", icon: "P", label: "Preview" },
];
const audioSamples = Array.from({ length: 32 }, (_, index) =>
  Math.sin(index * 0.55) * 0.72,
);

const sampleParametersByCore: Record<string, Record<string, unknown>> = {
  "area-chart": { ...sampleMotion, title: "Audience retention", unit: "%", data: chartData, accentColor: "#31e4d4", showGrid: true },
  "clock-dial": { ...sampleMotion, hour: 10, minute: 28, second: 36, label: "Launch window", accentColor: "#f5bd62" },
  "color-treatment": { ...sampleMotion, shadowColor: "#042e35", highlightColor: "#ffc66d" },
  "credits-roll": { ...sampleMotion, title: "Production team", entries: relationItems.map(({ title, detail }) => ({ primary: title, secondary: detail })), footer: "Bound entries", accentColor: "#9d8cff" },
  "loader-indicator": { ...sampleMotion, label: "Rendering verified media", state: "progress", progress: 0.72, variant: "ring", accentColor: "#31e4d4" },
  "media-frame": { ...sampleMotion, caption: "Confirmed source frame", sourceLabel: "SOURCE A", accentColor: "#f5bd62" },
  "media-grid": { ...sampleMotion, title: "Evidence comparison", columns: 3, layout: "focus-first", items: relationItems.map((item, index) => ({ id: `media-${index + 1}`, label: item.title, sourceLabel: `SRC ${index + 1}` })), accentColor: "#31e4d4" },
  "radial-chart": { ...sampleMotion, title: "Object allocation", unit: "items", mode: "donut", centerLabel: "total", segments: chartData.map((point) => ({ ...point, color: "#31e4d4" })) },
  "camera-orbit": { ...sampleMotion, focusX: 44, focusY: 55, yawDegrees: 8, pitchDegrees: 4, depth: 42 },
  "camera-shake": { ...sampleMotion, amplitude: 15, frequency: 1.6, decay: 3.1 },
  "cross-dissolve": { ...sampleMotion, startFrame: 58, transitionFrames: 44, throughBlack: false },
  "liquid-transition": { ...sampleMotion, startFrame: 54, transitionFrames: 52, originX: 48, originY: 54, accentColor: "#9d8cff" },
  "channel-distortion": { ...sampleMotion, channelOffset: 11, scanlineStrength: 0.22 },
  "kaleidoscope-symmetry": { ...sampleMotion, segments: 6, rotationDegrees: 28 },
  "light-overlay": { ...sampleMotion, preset: "leak", hue: "#ffb457", originX: 78, originY: 24 },
  "liquid-blob": { ...sampleMotion, primaryColor: "#31e4d4", secondaryColor: "#9d8cff", morphAmount: 0.72 },
  "liquid-flow": { ...sampleMotion, preset: "wave", flowDirection: "right", primaryColor: "#31e4d4", secondaryColor: "#9d8cff" },
  "liquid-ink": { ...sampleMotion, inkColor: "#071417", originX: 40, originY: 50, splatterCount: 10 },
  "liquid-ripple": { ...sampleMotion, originX: 52, originY: 58, ringCount: 5, amplitude: 0.68, color: "#31e4d4" },
  "liquid-surface": { ...sampleMotion, layers: 4, amplitude: 72, frequency: 1.2, primaryColor: "#31e4d4", secondaryColor: "#9d8cff" },
  "liquid-swirl": { ...sampleMotion, originX: 50, originY: 52, turns: 2.6, primaryColor: "#31e4d4", secondaryColor: "#9d8cff" },

  "ambient-particle": { ...sampleMotion, seed: "runtime-ambient", count: 42, density: 0.58, accentColor: "#33e2d2" },
  "audio-spectrum": { ...sampleMotion, samples: audioSamples, label: "Voice energy", bands: 24, accentColor: "#33e2d2" },
  "audio-waveform": { ...sampleMotion, samples: audioSamples, label: "Bound waveform", windowSize: 32, accentColor: "#f5bd67" },
  "bar-chart": { ...sampleMotion, data, title: "Information retained", unit: "%", ordering: "source", accentColor: "#33e2d2" },
  "before-after": { ...sampleMotion, beforeLabel: "BEFORE", afterLabel: "AFTER", divider: 58, accentColor: "#33e2d2" },
  "brand-lockup": { ...sampleMotion, mark: "C", name: "Codex Cut", tagline: "HOST VERIFIED", accentColor: "#33e2d2" },
  "camera-transform": { ...sampleMotion, focusX: 54, focusY: 48, translateX: -34, translateY: 20, scale: 1.09, rotation: -0.8, accentColor: "#33e2d2" },
  "card-deck": { ...sampleMotion, items: relationItems, fanAngle: 7, title: "Four decisions", accentColor: "#33e2d2" },
  "card-flip": { ...sampleMotion, axis: "y", title: "Claim to proof", accentColor: "#33e2d2" },
  "card-stack": { ...sampleMotion, items: relationItems, spread: 28, title: "Order of responsibility", accentColor: "#f5bd67" },
  "chart-axis-rescale": { ...sampleMotion, beforeData: data.map((point) => ({ ...point, value: point.value * 0.42 })), afterData: data, title: "Honest new scale", unit: "%", accentColor: "#ff766e" },
  "clone-depth-echo": { ...sampleMotion, count: 5, depth: 36, title: "One object through depth", accentColor: "#9d8cff" },
  "connection-flyline": { ...sampleMotion, nodes: relationNodes, edges: relationEdges, showDirection: true, title: "Evidence stays connected", accentColor: "#33e2d2" },
  "cube-transition": { ...sampleMotion, direction: "left", perspective: 1450, accentColor: "#33e2d2" },
  "depth-camera": { ...sampleMotion, layers: sceneLayers, focusLayerId: "focus", parallax: 82, accentColor: "#33e2d2" },
  "flow-diagram": { ...sampleMotion, nodes: relationNodes, edges: relationEdges, title: "Meaning to preview", direction: "horizontal", accentColor: "#f5bd67" },
  "gauge-arc": { ...sampleMotion, value: 84, minimum: 0, maximum: 100, unit: "%", label: "Evidence coverage", thresholds: [60, 80], accentColor: "#33e2d2" },
  "geometric-wipe": { ...sampleMotion, shape: "diamond", direction: "right", accentColor: "#f5bd67" },
  "gradient-text": { ...sampleMotion, text: "Make the hierarchy visible", colors: ["#33e2d2", "#70a9ff", "#9d8cff"], direction: "right" },
  "hud-focus": { ...sampleMotion, targetX: 67, targetY: 49, label: "PRIMARY CONTROL", radius: 15, accentColor: "#33e2d2" },
  "icon-feedback": { ...sampleMotion, icon: "✓", state: "success", label: "Evidence bound", accentColor: "#b8ed7d" },
  "impact-feedback": { ...sampleMotion, text: "PROOF FIRST", impactStyle: "slam", accentColor: "#ff766e" },
  "karaoke-progress": { ...sampleMotion, words: ["Agent", "creates", "the", "ceiling"], activeWordIndex: 2, accentColor: "#33e2d2" },
  "kinetic-type": { ...sampleMotion, words: ["ONE", "PROJECT", "ZERO", "REPEATED", "DECISIONS"], layout: "scatter", accentColor: "#f5bd67" },
  "line-chart": { ...sampleMotion, data, title: "Comprehension", unit: "%", showGrid: true, accentColor: "#33e2d2" },
  "list-sequence": { ...sampleMotion, items: relationItems, title: "Decision sequence", numbered: true, accentColor: "#33e2d2" },
  "media-carousel": { ...sampleMotion, items: relationItems.map((item, index) => ({ id: `source-${index + 1}`, label: item.title })), activeId: "source-2", accentColor: "#33e2d2" },
  "media-tour": { ...sampleMotion, focusRegions, activeRegionId: "focus", accentColor: "#33e2d2" },
  "numeric-counter": { ...sampleMotion, value: 55, startValue: 0, precision: 0, unit: "CORES", label: "IMPLEMENTED", accentColor: "#33e2d2" },
  "panel-grid": { ...sampleMotion, panels: relationItems, columns: 2, activeId: "layout", title: "Inspectable decisions", accentColor: "#9d8cff" },
  "particle-celebration": { ...sampleMotion, seed: "runtime-celebration", count: 52, originX: 50, originY: 42, accentColor: "#b8ed7d" },
  "particle-transition": { ...sampleMotion, seed: "runtime-boundary", count: 48, direction: "left", accentColor: "#33e2d2" },
  "progress-bar": { ...sampleMotion, progress: 0.72, label: "Implementation", unit: "%", segments: 6, accentColor: "#33e2d2" },
  "prompt-paste": { ...sampleMotion, prompt: "Use the confirmed source and explain the operation.", state: "ready", sourceLabel: "HOST CLIPBOARD", accentColor: "#33e2d2" },
  "response-stream": { ...sampleMotion, chunks: ["Read the source.", "Bind the visual object.", "Validate capacity.", "Render the preview."], state: "complete", modelLabel: "Packaging Director", accentColor: "#33e2d2" },
  "scene-push": { ...sampleMotion, direction: "left", distance: 1760, accentColor: "#33e2d2" },
  "screen-frame": { ...sampleMotion, title: "Codex Cut", sourceLabel: "BOUND SCREEN", accentColor: "#33e2d2" },
  "selection-control": { ...sampleMotion, options: [{ id: "person", label: "Person" }, { id: "screen", label: "Screen" }], selectedId: "screen", label: "MAIN VISUAL", accentColor: "#33e2d2" },
  "shared-morph": { ...sampleMotion, sharedElementId: "proof-card", accentColor: "#9d8cff" },
  "smear-trail": { ...sampleMotion, direction: "right", copies: 6, accentColor: "#ff766e" },
  "space-camera": { ...sampleMotion, layers: sceneLayers, focusLayerId: "focus", travelX: 120, travelY: -40, depth: 150, accentColor: "#9d8cff" },
  "speed-ramp": { ...sampleMotion, rateCurve: [{ frame: 0, rate: 1 }, { frame: 42, rate: 2.2 }, { frame: 84, rate: 0.6 }, { frame: 150, rate: 1 }], focusFrame: 84, accentColor: "#f5bd67" },
  "split-flap": { ...sampleMotion, text: "EVIDENCE BOUND", characterSet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", accentColor: "#f5bd67" },
  "spotlight-scan": { ...sampleMotion, region: { x: 56, y: 34, width: 28, height: 42 }, label: "ACTIVE CONTROL", accentColor: "#33e2d2" },
  "stream-line-chart": { ...sampleMotion, data: chartData, title: "Live telemetry", unit: "ms", windowSize: 4, accentColor: "#b8ed7d" },
  "terminal-type": { ...sampleMotion, lines: ["inspect --timeline", "bind --object source", "validate --capacity", "render --preview"], activeLineIndex: 3, prompt: "$", accentColor: "#b8ed7d" },
  "text-fracture": { ...sampleMotion, text: "BREAK THE PATTERN", fragments: 8, accentColor: "#ff766e" },
  "text-reveal": { ...sampleMotion, text: "The main visual carries the message", direction: "left", accentColor: "#33e2d2" },
  "texture-dissolve": { ...sampleMotion, seed: "runtime-texture", texture: "grain", accentColor: "#ff766e" },
  "theme-transition": { ...sampleMotion, fromTheme: "CALM", toTheme: "FOCUS", direction: "right" },
  "time-relation": { ...sampleMotion, events: [{ id: "hook", label: "Hook", time: 0, detail: "Question" }, { id: "proof", label: "Proof", time: 18, detail: "Result" }], title: "Argument timeline", timeUnit: "s", conclusion: "Evidence follows the claim", accentColor: "#33e2d2" },
  "typewriter": { ...sampleMotion, text: "The host verifies what may render.", cursor: "▌", accentColor: "#b8ed7d" },
  "ui-materialize": { ...sampleMotion, elements: [{ id: "toolbar", label: "Timeline", kind: "toolbar" }, { id: "sources", label: "Sources", kind: "panel" }, { id: "preview", label: "Preview", kind: "panel" }, { id: "status", label: "Status", kind: "chip" }], activeId: "preview", accentColor: "#33e2d2" },
  "unit-chart": { ...sampleMotion, value: 37, total: 50, label: "Verified units", unit: "items", columns: 10, accentColor: "#33e2d2" },
  "word-relay": { ...sampleMotion, headline: "One persistent project brain", label: "PRODUCT PRINCIPLE", accentColor: "#33e2d2" },

  "border-light-trace": { ...sampleMotion, targetRect: { x: 57.5, y: 31, width: 27.5, height: 39 }, cornerRadius: 20, direction: "clockwise", label: "BOUND PREVIEW", accentColor: "#2dd4d7" },
  "chat-thread": { ...sampleMotion, title: "Plan to preview", activeMessageId: "host", messages: [{ id: "user", role: "User", text: "Use the bound screen." }, { id: "agent", role: "Agent", text: "I will use the approved layout." }, { id: "host", role: "Host", text: "Sources and ranges verified." }], accentColor: "#2dd4d7" },
  "code-block": { ...sampleMotion, title: "preview.tsx", language: "TSX", lineNumbers: true, lines: codeLines, depth: 1.2, accentColor: "#9b8df1" },
  "code-diff": { ...sampleMotion, title: "layout.diff", activeLineIndex: 2, lines: [{ id: "1", kind: "context", text: "const main = paragraph.mainVisual;" }, { id: "2", kind: "delete", text: "const support = [];" }, { id: "3", kind: "add", text: "const support = paragraph.supportingVisuals;" }], accentColor: "#9cda71" },
  "code-focus": { ...sampleMotion, title: "guardrails.ts", mode: "scroll", activeLineIndex: 2, lines: [...codeLines, "validateCapacity(effects);"], accentColor: "#f0b44d" },
  "icon-cloud": { ...sampleMotion, title: "Bound project objects", activeId: "preview", seed: "runtime-cloud", items: completionItems, accentColor: "#2dd4d7" },
  "map-data": { ...sampleMotion, title: "Coverage by region", activeRegionId: "lab", unit: "%", regions: [{ id: "source", label: "Source", value: 78, x: 235, y: 218 }, { id: "lab", label: "Lab", value: 100, x: 620, y: 236 }], accentColor: "#2dd4d7" },
  "media-pan-zoom": { ...sampleMotion, start: { x: 50, y: 50, scale: 1 }, end: { x: 53, y: 37, scale: 1.18 }, accentColor: "#2dd4d7" },
  "media-treatment": { ...sampleMotion, mode: "halftone", amount: 0.52, accentColor: "#f0b44d" },
  "metric-card": { ...sampleMotion, label: "Runtime component catalog", value: 89, unit: "CORES", delta: 13, trend: "up", accentColor: "#2dd4d7" },
  "perspective-grid": { ...sampleMotion, horizon: 47, density: 11, accentColor: "#9b8df1" },
  "step-progress": { ...sampleMotion, title: "Continuous project process", activeStepId: "layout", orientation: "horizontal", steps: stepItems, accentColor: "#2dd4d7" },
  "stroke-trace": { ...sampleMotion, path: "M 80 260 C 180 80 340 70 450 220 S 760 350 1040 180", viewBox: "0 0 1120 420", strokeWidth: 9, label: "Approved path", accentColor: "#f0b44d" },
};

const sourceNodeSlotsByCore: Record<string, string[]> = {
  "color-treatment": ["content"],
  "media-frame": ["content"],
  "media-grid": ["media"],
  "camera-orbit": ["content"],
  "camera-shake": ["content"],
  "cross-dissolve": ["fromScene", "toScene"],
  "cube-transition": ["fromScene", "toScene"],
  "geometric-wipe": ["fromScene", "toScene"],
  "liquid-transition": ["fromScene", "toScene"],
  "channel-distortion": ["content"],
  "kaleidoscope-symmetry": ["content"],
  "light-overlay": ["content"],
  "liquid-blob": ["content"],
  "liquid-flow": ["content"],
  "liquid-ink": ["content"],
  "liquid-ripple": ["content"],
  "liquid-surface": ["content"],
  "liquid-swirl": ["content"],
  "ambient-particle": ["content"],
  "before-after": ["media"],
  "camera-transform": ["content"],
  "card-flip": ["media"],
  "clone-depth-echo": ["content"],
  "depth-camera": ["media"],
  "media-carousel": ["media"],
  "media-tour": ["content"],
  "particle-celebration": ["content"],
  "particle-transition": ["fromScene", "toScene"],
  "scene-push": ["fromScene", "toScene"],
  "screen-frame": ["content"],
  "shared-morph": ["fromScene", "toScene"],
  "smear-trail": ["content"],
  "space-camera": ["media"],
  "speed-ramp": ["content"],
  "spotlight-scan": ["content"],
  "texture-dissolve": ["fromScene", "toScene"],
  "theme-transition": ["fromScene", "toScene"],
  "hud-focus": ["content"],
  "border-light-trace": ["content"],
  "media-pan-zoom": ["content"],
  "media-treatment": ["content"],
  "perspective-grid": ["content"],
};

// These props are ReactNode fields in the authored Core interface but are
// supplied by the host through the ordered `media` slot. They must never be
// accepted as JSON parameters.
const sourceNodeParameterAliasesByCore: Record<string, string[]> = {
  "before-after": ["before", "after"],
  "card-flip": ["front", "back"],
  "cube-transition": ["fromScene", "toScene"],
  "geometric-wipe": ["fromScene", "toScene"],
};

const labelsByCore = new Map<string, string>([
  ...SMART_PACKAGING_NEW_CORE_LAB_RECORDS_V1.map((item) => [item.coreId, item.label] as const),
  ...SMART_PACKAGING_NEXT_CORE_LAB_RECORDS_V1.map((item) => [item.coreId, item.label] as const),
  ...SMART_PACKAGING_CATALOG_COMPLETION_RECORDS_V1.map((item) => [item.coreId, item.label] as const),
]);

const exportNamesByCore = new Map<string, string>([
  ...SMART_PACKAGING_NEW_CORE_LAB_RECORDS_V1.map((item) => [item.coreId, item.implementation.exportName] as const),
  ...SMART_PACKAGING_NEXT_CORE_LAB_RECORDS_V1.map((item) => [item.coreId, item.implementation.exportName] as const),
  ...SMART_PACKAGING_CATALOG_COMPLETION_RECORDS_V1.map((item) => [item.coreId, item.implementation.exportName] as const),
]);

const slotProps = (coreId: string): Set<string> => new Set(sourceNodeSlotsByCore[coreId] ?? []);

const selectOptions: Record<string, string[]> = {
  state: ["loading", "progress", "success", "error", "idle", "ready", "running", "complete", "success", "warning", "error", "info"],
  variant: ["ring", "dots", "bar"],
  preset: ["glow", "leak", "prism", "wave", "oil", "drip"],
  flowDirection: ["left", "right", "up", "down"],
  direction: ["left", "right", "up", "down", "clockwise", "counterclockwise", "horizontal", "vertical"],
  axis: ["x", "y"],
  layout: ["grid", "focus-first", "stack", "scatter", "line"],
  mode: ["donut", "pie", "highlight", "scroll", "grain", "scanline", "halftone", "vignette", "blur"],
  impactStyle: ["stamp", "slam", "pulse"],
  ordering: ["source", "ascending", "descending"],
  shape: ["circle", "diamond", "bars"],
  texture: ["grain", "cells", "stripes"],
  trend: ["up", "down", "flat"],
  orientation: ["horizontal", "vertical"],
};

const colorKeys = new Set([
  "accentColor", "color", "shadowColor", "highlightColor", "hue", "inkColor", "primaryColor", "secondaryColor",
]);
const jsonKeys = new Set([
  "data", "beforeData", "afterData", "entries", "items", "segments", "nodes", "edges", "layers", "events", "focusRegions", "regions", "steps", "messages", "lines", "options", "elements", "rateCurve", "samples", "colors", "words", "chunks", "start", "end", "targetRect", "region", "panels", "thresholds",
]);
const boolKeys = new Set(["reducedMotion", "showGrid", "throughBlack", "showDirection", "numbered", "lineNumbers"]);
const textKeys = new Set([
  "title", "unit", "label", "caption", "sourceLabel", "footer", "seed", "flowDirection", "focusLayerId", "activeId", "activeRegionId", "activeStepId", "activeMessageId", "selectedId", "front", "back", "mark", "name", "tagline", "text", "headline", "prompt", "modelLabel", "language", "characterSet", "cursor", "icon", "conclusion", "timeUnit", "sharedElementId", "fromTheme", "toTheme", "viewBox", "path", "beforeLabel", "afterLabel", "centerLabel", "coreId",
]);

const parameterDescription: Record<string, string> = {
  intensity: "Motion/effect intensity in the authored range.",
  reducedMotion: "Use the Core's deterministic static or reduced-motion state.",
  data: "Ordered labeled numeric points; each point requires a non-empty label and finite value.",
  beforeData: "Ordered labeled numeric points before the rescale.",
  afterData: "Ordered labeled numeric points after the rescale.",
  entries: "Ordered entries with a primary string and optional secondary string.",
  items: "Ordered content or relation items. Source media content is injected through media slots.",
  segments: "Either a bounded segment count or labeled numeric radial segments, depending on the Core.",
  layers: "Ordered depth layers with stable id, label, and optional depth/color.",
  nodes: "Stable graph nodes with id, label, and optional normalized coordinates.",
  edges: "Graph edges referencing existing node ids.",
  messages: "Ordered messages with id, role, and text.",
  lines: "Ordered text lines, or typed diff-line objects for code-diff.",
  samples: "Finite audio samples in the supported range.",
  seed: "Deterministic seed; authored Cores accept a string or finite numeric seed.",
  rateCurve: "Ordered frame/rate points used by the speed-ramp Core.",
  content: "A source node slot supplied by the host; never serialized in parameters.",
};

// A few authored Core interfaces expose presentation props that were omitted
// from the historical research contract. Keep them adjustable in the runtime
// catalog as well.
const extraSupportedPropsByCore: Record<string, string[]> = {
  "before-after": ["title"],
  "camera-transform": ["accentColor"],
  "card-deck": ["title"],
  "card-flip": ["title"],
  "card-stack": ["title"],
  "clone-depth-echo": ["title"],
  "connection-flyline": ["title"],
  "cube-transition": ["accentColor"],
  "panel-grid": ["title"],
  "scene-push": ["accentColor"],
  "spotlight-scan": ["title", "sourceLabel"],
  "theme-transition": ["accentColor"],
  "icon-cloud": ["title"],
  "step-progress": ["title"],
};

const numberBounds = (key: string, coreId: string): Pick<ComponentParameterControl, "min" | "max" | "step"> => {
  if (key === "density" && coreId === "perspective-grid") return { min: 1, max: 48, step: 1 };
  if (key === "intensity" || key === "density" || key === "progress" || key === "morphAmount" || key === "amount") return { min: 0, max: 1, step: 0.01 };
  if (["focusX", "focusY", "originX", "originY", "targetX", "targetY", "horizon", "divider"].includes(key)) return { min: 0, max: 100, step: 0.1 };
  if (key === "hour") return { min: 0, max: 23, step: 1 };
  if (["minute", "second"].includes(key)) return { min: 0, max: 59, step: 1 };
  if (["columns", "count", "bands", "layers", "segments", "copies", "ringCount", "splatterCount", "fragments", "windowSize"].includes(key)) return { min: 1, max: 512, step: 1 };
  if (key === "precision") return { min: 0, max: 2, step: 1 };
  if (key === "scale") return { min: 0.1, max: 4, step: 0.01 };
  if (key === "cornerRadius") return { min: 0, max: 1000, step: 1 };
  if (key === "transitionFrames" || key === "startFrame" || key === "focusFrame" || key === "distance") return { min: 0, max: 10000, step: 1 };
  if (key === "direction" && coreId === "stroke-trace") return { min: 0, max: 1, step: 0.01 };
  return { step: 0.01 };
};

const controlFor = (coreId: string, key: string, required: boolean): ComponentParameterControl => {
  const bounds = numberBounds(key, coreId);
  const scalarSeed = key === "seed" && ["ambient-particle", "particle-celebration", "particle-transition"].includes(coreId);
  const jsonForThisCore = jsonKeys.has(key)
    && !(key === "segments" && coreId !== "radial-chart")
    && !(key === "layers" && coreId === "liquid-surface");
  const type: ComponentParameterType = boolKeys.has(key)
    ? "boolean"
    : colorKeys.has(key)
      ? "color"
      : jsonForThisCore || scalarSeed
        ? "json"
        : selectOptions[key]
          ? "select"
          : textKeys.has(key) || key === "icon"
            ? "text"
            : "number";
  return {
    key,
    label: key.replace(/([A-Z])/gu, " $1").replace(/^./u, (char) => char.toUpperCase()),
    type,
    required,
    ...(type === "number" ? bounds : {}),
    ...(type === "select" ? { options: selectOptions[key] } : {}),
    group: ["intensity", "reducedMotion", "startFrame", "transitionFrames", "focusFrame", "speed"].includes(key) ? "motion" : colorKeys.has(key) || ["showGrid", "lineNumbers", "accentColor"].includes(key) ? "style" : "content",
    ...(parameterDescription[key] ? { description: parameterDescription[key] } : {}),
  };
};

const definitionFor = (
  componentId: string,
  coreId: string,
  label: string,
  rendererId: string,
  mount: ComponentRuntimeMount,
  requiredProps: readonly string[],
  optionalProps: readonly string[],
): ComponentRuntimeDefinition => {
  const slots = new Set([
    ...slotProps(coreId),
    ...(sourceNodeParameterAliasesByCore[coreId] ?? []),
  ]);
  const sampleParameters = { ...(sampleParametersByCore[coreId] ?? sampleMotion) };
  const keys = [...new Set([...requiredProps, ...optionalProps, ...(extraSupportedPropsByCore[coreId] ?? [])])].filter((key) => key !== "coreId" && !slots.has(key));
  const controls = keys.map((key) => controlFor(coreId, key, requiredProps.includes(key)));
  // Keep the defaults limited to presentation and motion knobs. Required
  // content and optional content are intentionally omitted so callers cannot
  // accidentally render the catalog's example data as project data. The
  // Core's own defaults remain authoritative for omitted presentation props.
  const defaultParameters = Object.fromEntries(
    controls
      .filter((control) => !control.required && (control.group === "style" || control.group === "motion"))
      .filter((control) => sampleParameters[control.key] !== undefined)
      .map((control) => [control.key, JSON.parse(JSON.stringify(sampleParameters[control.key])) as unknown]),
  );
  return {
    componentId,
    coreId,
    rendererId,
    label,
    mount,
    controls,
    defaultParameters,
    sampleParameters,
    mediaSlots: [...(sourceNodeSlotsByCore[coreId] ?? [])],
  };
};

const newDefinitions = SMART_PACKAGING_NEW_CORE_LAB_RECORDS_V1.map((record) =>
  definitionFor(
    newComponentId(record.coreId),
    record.coreId,
    record.label,
    record.implementation.exportName,
    record.batch === "CAMERA_BOUNDARY_CORE" && ["cross-dissolve", "liquid-transition"].includes(record.coreId)
      ? "TRANSITION"
      : record.batch === "OBJECT_CORE" ? "OBJECT" : "SCENE",
    record.inputContract.requiredProps,
    record.inputContract.optionalProps,
  ),
);

const nextDefinitions = SMART_PACKAGING_NEXT_CORE_LAB_RECORDS_V1.map((record) => {
  const coreId = record.coreId;
  return definitionFor(
    nextComponentId(coreId),
    coreId,
    record.label,
    record.implementation.exportName,
    record.renderFamily === "TRANSITION" ? "TRANSITION" : record.renderFamily === "SCENE" ? "SCENE" : "OBJECT",
    record.inputContract.requiredProps,
    record.inputContract.optionalProps,
  );
});

const completionDefinitions = SMART_PACKAGING_CATALOG_COMPLETION_RECORDS_V1.map((record) => {
  const coreId = record.coreId;
  return definitionFor(
    completionComponentId(coreId),
    coreId,
    record.label,
    record.implementation.exportName,
    record.renderFamily === "SCENE" ? "SCENE" : "OBJECT",
    record.inputContract.requiredProps,
    record.inputContract.optionalProps,
  );
});

export const COMPONENT_RUNTIME_DEFINITIONS: readonly ComponentRuntimeDefinition[] = Object.freeze([
  ...EXPLAINER_DEFINITIONS,
  ...newDefinitions,
  ...nextDefinitions,
  ...completionDefinitions,
].map((definition) => Object.freeze({...definition,searchAliases:Object.entries(REFERENCE_CORE_ALIASES).filter(([,core])=>core===definition.coreId).map(([alias])=>alias)})));

const definitionsById = new Map(
  COMPONENT_RUNTIME_DEFINITIONS.map((definition) => [definition.componentId, definition]),
);

export const componentRuntimeDefinition = (
  componentId: string,
): ComponentRuntimeDefinition | null => definitionsById.get(componentId) ?? null;

/**
 * Return the number of ordered media nodes the host must bind for a definition.
 * This only describes the `media` slot. Transition scene pairs continue to use
 * the explicit `fromScene`/`toScene` slots, and content-only relation cards do
 * not require source media.
 */
export const componentRuntimeRequiredMediaNodeCount = (
  componentId: string,
  parameters: Record<string, unknown> = {},
): number => {
  const definition = componentRuntimeDefinition(componentId);
  if (!definition) throw new Error(`Unknown component runtime id: ${componentId}`);
  if (!definition.mediaSlots.includes("media")) return 0;
  if(EXPLAINER_DEFINITIONS.some(d=>d.componentId===componentId))return explainerMediaCount(definition.coreId,parameters);
  if (["before-after", "card-flip"].includes(definition.coreId)) return 2;
  const collectionKey = ["media-grid", "media-carousel"].includes(definition.coreId)
    ? "items"
    : ["depth-camera", "space-camera"].includes(definition.coreId)
      ? "layers"
      : null;
  if (!collectionKey) return 1;
  const collection = parameters[collectionKey];
  return Array.isArray(collection) && collection.length > 0 ? collection.length : 1;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateJsonValue = (value: unknown, path: string): void => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain only finite numbers`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, item]) => validateJsonValue(item, `${path}.${key}`));
    return;
  }
  throw new Error(`${path} must be JSON-compatible`);
};

const requireRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (!isPlainObject(value)) throw new Error(`${path} must be an object`);
  return value;
};

const requireStringField = (record: Record<string, unknown>, key: string, path: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${path}.${key} must be a non-empty string`);
  return value;
};

const requireFiniteField = (record: Record<string, unknown>, key: string, path: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path}.${key} must be a finite number`);
  return value;
};

const validateRecordArray = (
  value: unknown,
  key: string,
  validateItem: (item: Record<string, unknown>, path: string) => void,
): void => {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${key} must be a non-empty array`);
  value.forEach((item, index) => validateItem(requireRecord(item, `${key}[${index}]`), `${key}[${index}]`));
};

const cloneJson = <T,>(value: T): T => {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const validateShape = (key: string, value: unknown): void => {
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new Error(`${key} must be an array or object`);
  }
  if (Array.isArray(value) && value.length === 0) throw new Error(`${key} must not be empty`);
  if (["data", "beforeData", "afterData", "segments"].includes(key)) {
    validateRecordArray(value, key, (point, path) => {
      requireStringField(point, "label", path);
      requireFiniteField(point, "value", path);
    });
    return;
  }
  if (["items", "panels"].includes(key)) {
    validateRecordArray(value, key, (item, path) => {
      requireStringField(item, "id", path);
      const hasDisplayText = ["title", "label", "primary", "text", "icon"].some((field) => typeof item[field] === "string" && item[field].trim() !== "");
      if (!hasDisplayText) throw new Error(`${path} must include a non-empty title, label, primary, text, or icon`);
    });
    return;
  }
  if (key === "entries") {
    validateRecordArray(value, key, (entry, path) => {
      requireStringField(entry, "primary", path);
      if (entry.secondary !== undefined && typeof entry.secondary !== "string") throw new Error(`${path}.secondary must be a string`);
    });
    return;
  }
  if (key === "layers") {
    validateRecordArray(value, key, (layer, path) => {
      requireStringField(layer, "id", path);
      requireStringField(layer, "label", path);
      if (layer.depth !== undefined) requireFiniteField(layer, "depth", path);
      if (layer.color !== undefined) requireStringField(layer, "color", path);
    });
    return;
  }
  if (key === "nodes") {
    validateRecordArray(value, key, (node, path) => {
      requireStringField(node, "id", path);
      requireStringField(node, "label", path);
      if (node.x !== undefined) requireFiniteField(node, "x", path);
      if (node.y !== undefined) requireFiniteField(node, "y", path);
    });
    return;
  }
  if (key === "edges") {
    validateRecordArray(value, key, (edge, path) => {
      requireStringField(edge, "from", path);
      requireStringField(edge, "to", path);
      if (edge.label !== undefined) requireStringField(edge, "label", path);
    });
    return;
  }
  if (key === "regions") {
    validateRecordArray(value, key, (region, path) => {
      requireStringField(region, "id", path);
      requireStringField(region, "label", path);
      for (const field of ["x", "y"]) requireFiniteField(region, field, path);
      for (const field of ["width", "height"]) if (region[field] !== undefined) requireFiniteField(region, field, path);
    });
    return;
  }
  if (key === "focusRegions") {
    validateRecordArray(value, key, (region, path) => {
      requireStringField(region, "id", path);
      requireStringField(region, "label", path);
      for (const field of ["x", "y", "width", "height"]) requireFiniteField(region, field, path);
    });
    return;
  }
  if (key === "steps") {
    validateRecordArray(value, key, (step, path) => {
      requireStringField(step, "id", path);
      requireStringField(step, "label", path);
      if (step.detail !== undefined) requireStringField(step, "detail", path);
      if (step.state !== undefined) requireStringField(step, "state", path);
    });
    return;
  }
  if (key === "messages") {
    validateRecordArray(value, key, (message, path) => {
      requireStringField(message, "id", path);
      requireStringField(message, "role", path);
      requireStringField(message, "text", path);
    });
    return;
  }
  if (key === "options") {
    validateRecordArray(value, key, (option, path) => {
      requireStringField(option, "id", path);
      requireStringField(option, "label", path);
    });
    return;
  }
  if (key === "elements") {
    validateRecordArray(value, key, (element, path) => {
      requireStringField(element, "id", path);
      requireStringField(element, "label", path);
      if (element.kind !== undefined) requireStringField(element, "kind", path);
    });
    return;
  }
  if (key === "events") {
    validateRecordArray(value, key, (event, path) => {
      requireStringField(event, "id", path);
      requireStringField(event, "label", path);
      requireFiniteField(event, "time", path);
      if (event.detail !== undefined) requireStringField(event, "detail", path);
    });
    return;
  }
  if (key === "rateCurve") {
    validateRecordArray(value, key, (point, path) => {
      requireFiniteField(point, "frame", path);
      requireFiniteField(point, "rate", path);
    });
    return;
  }
  if (key === "lines") {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${key} must be a non-empty array`);
    value.forEach((line, index) => {
      if (typeof line === "string") {
        if (line.trim() === "") throw new Error(`${key}[${index}] must be a non-empty string`);
        return;
      }
      const record = requireRecord(line, `${key}[${index}]`);
      requireStringField(record, "id", `${key}[${index}]`);
      requireStringField(record, "kind", `${key}[${index}]`);
      requireStringField(record, "text", `${key}[${index}]`);
    });
    return;
  }
  if (key === "samples") {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${key} must be a non-empty array`);
    value.forEach((sample, index) => {
      if (typeof sample !== "number" || !Number.isFinite(sample)) throw new Error(`${key}[${index}] must be a finite number`);
    });
    return;
  }
  if (["colors", "words", "chunks"].includes(key)) {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${key} must be a non-empty array`);
    value.forEach((item, index) => {
      if (typeof item !== "string" || item.trim() === "") throw new Error(`${key}[${index}] must be a non-empty string`);
    });
    return;
  }
  if (key === "thresholds") {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${key} must be a non-empty array`);
    value.forEach((item, index) => {
      if (typeof item !== "number" || !Number.isFinite(item)) throw new Error(`${key}[${index}] must be a finite number`);
    });
    return;
  }
  if (["start", "end"].includes(key)) {
    const record = requireRecord(value, key);
    for (const field of ["x", "y", "scale"]) requireFiniteField(record, field, key);
    return;
  }
  if (["targetRect", "region"].includes(key)) {
    const record = requireRecord(value, key);
    for (const field of ["x", "y", "width", "height"]) requireFiniteField(record, field, key);
    return;
  }
};

export const validateComponentParameters = (
  componentId: string,
  parameters: Record<string, unknown>,
): Record<string, unknown> => {
  const definition = componentRuntimeDefinition(componentId);
  if (!definition) throw new Error(`Unknown component runtime id: ${componentId}`);
  if (!isPlainObject(parameters)) throw new Error(`Parameters for ${componentId} must be an object`);
  const controlsByKey = new Map(definition.controls.map((control) => [control.key, control]));
  for (const key of Object.keys(parameters)) {
    if (!controlsByKey.has(key)) throw new Error(`${componentId}: unknown parameter "${key}"`);
  }
  const validated: Record<string, unknown> = {};
  for (const control of definition.controls) {
    const value = parameters[control.key];
    if (value === undefined || value === null) {
      if (control.required) throw new Error(`${componentId}: required parameter "${control.key}" is missing`);
      continue;
    }
    if (control.type === "text" && (typeof value !== "string" || (control.required && control.key !== "unit" && value.trim() === ""))) {
      throw new Error(`${componentId}: "${control.key}" must be a non-empty string`);
    }
    if (control.type === "color" && (typeof value !== "string" || value.trim() === "")) {
      throw new Error(`${componentId}: "${control.key}" must be a color string`);
    }
    if (control.type === "boolean" && typeof value !== "boolean") {
      throw new Error(`${componentId}: "${control.key}" must be a boolean`);
    }
    if (control.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${componentId}: "${control.key}" must be a finite number`);
      if (control.min !== undefined && value < control.min) throw new Error(`${componentId}: "${control.key}" must be >= ${control.min}`);
      if (control.max !== undefined && value > control.max) throw new Error(`${componentId}: "${control.key}" must be <= ${control.max}`);
    }
    if (control.type === "select" && (typeof value !== "string" || !control.options?.includes(value))) {
      throw new Error(`${componentId}: "${control.key}" must be one of ${control.options?.join(", ")}`);
    }
    if (control.type === "json") {
      validateJsonValue(value, `${componentId}.${control.key}`);
      if (control.key !== "seed") validateShape(control.key, value);
    }
    validated[control.key] = cloneJson(value);
  }
  if (typeof validated.minimum === "number" && typeof validated.maximum === "number" && validated.maximum <= validated.minimum) {
    throw new Error(`${componentId}: "maximum" must be greater than "minimum"`);
  }
  validateExplainerParameters(definition.coreId,validated);
  return validated;
};

export const validateAllComponentRuntimeSamples = (): void => {
  for (const definition of COMPONENT_RUNTIME_DEFINITIONS) {
    validateComponentParameters(definition.componentId, definition.sampleParameters);
  }
};
