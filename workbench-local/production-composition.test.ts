import {transform} from "esbuild";
import vm from "node:vm";
import React from "react";
import {describe, expect, it} from "vitest";
import {productionCompositionSource} from "./production-composition";
import {resolveOutgoingFreezeFrame} from "./SceneTransitionSurface";

type MockElement = React.ReactElement<any>;

function mockComponent(name: string) {
  const component = (props: any) => React.createElement(name, props);
  Object.defineProperty(component, "name", {value: name});
  return component;
}

function childrenOf(node: MockElement): MockElement[] {
  return React.Children.toArray(node.props.children).filter(
    (child): child is MockElement => React.isValidElement(child),
  );
}

function containsType(node: React.ReactNode, type: unknown): boolean {
  if (!React.isValidElement(node)) return false;
  if (node.type === type) return true;
  return React.Children.toArray((node.props as {children?: React.ReactNode}).children).some((child) =>
    containsType(child, type),
  );
}

function replaceGeneratedImports(source: string, root: string): string {
  const production = `${root}/workbench-local/ProductionProgram.tsx`;
  const surface = `${root}/workbench-local/SceneModuleSurface.tsx`;
  const transition = `${root}/workbench-local/SceneTransitionSurface.tsx`;
  const component = `${root}/workbench-local/ComponentSurface.tsx`;
  return source
    .replace(
      "import React from 'react';",
      "const React=require('react');",
    )
    .replace(
      "import {Composition, registerRoot, Sequence, AbsoluteFill,OffthreadVideo,staticFile,Freeze} from 'remotion';",
      "const {Composition, registerRoot, Sequence, AbsoluteFill,OffthreadVideo,staticFile,Freeze}=require('remotion');",
    )
    .replace(
      new RegExp(`import \\{ProductionProgram\\} from ${JSON.stringify(production)};`),
      "const {ProductionProgram}=require('production-program');",
    )
    .replace(
      new RegExp(`import \\{ComponentSurface\\} from ${JSON.stringify(component)};`),
      "const {ComponentSurface}=require('component-surface');",
    )
    .replace(
      new RegExp(`import \\{SceneModuleSurface\\} from ${JSON.stringify(surface)};`),
      "const {SceneModuleSurface}=require('scene-surface');",
    )
    .replace(
      new RegExp(`import \\{SceneTransitionSurface\\} from ${JSON.stringify(transition)};`),
      "const {SceneTransitionSurface}=require('scene-transition-surface');",
    );
}

async function evaluateComposition(source: string, fixture: any) {
  const remotion = {
    Composition: mockComponent("Composition"),
    registerRoot: undefined as undefined | ((factory: () => MockElement) => void),
    Sequence: mockComponent("Sequence"),
    AbsoluteFill: mockComponent("AbsoluteFill"),
    OffthreadVideo: mockComponent("OffthreadVideo"),
    Freeze: mockComponent("Freeze"),
    staticFile: (value: string) => value,
  };
  let rootElement: MockElement | undefined;
  remotion.registerRoot = (factory) => {
    rootElement = factory();
  };
  const componentRenderer = mockComponent("ComponentRenderer");
  const sceneRenderer = mockComponent("SceneRenderer");
  const productionProgram = mockComponent("ProductionProgram");
  const componentSurface = mockComponent("ComponentSurface");
  const sceneSurface = mockComponent("SceneModuleSurface");
  const transitionSurface = mockComponent("SceneTransitionSurface");
  const root = "/tmp/project";
  const transformed = await transform(replaceGeneratedImports(source, root), {
    loader: "tsx",
    format: "cjs",
    jsx: "transform",
    target: "es2022",
  });
  const modules: Record<string, unknown> = {
    react: React,
    remotion,
    "production-program": {ProductionProgram: productionProgram},
    "component-surface": {ComponentSurface: componentSurface},
    "scene-surface": {SceneModuleSurface: sceneSurface},
    "scene-transition-surface": {SceneTransitionSurface: transitionSurface},
  };
  const context = vm.createContext({
    require: (id: string) => {
      if (!(id in modules)) throw new Error(`unexpected generated import ${id}`);
      return modules[id];
    },
    componentRenderer,
    sceneRenderer,
  });
  new vm.Script(transformed.code).runInContext(context);
  expect(rootElement).toBeDefined();
  const composition = rootElement!;
  const program = composition.props.component as (props: any) => MockElement;
  return {
    tree: program(fixture),
    mocks: {
      Composition: remotion.Composition,
      Sequence: remotion.Sequence,
      Freeze: remotion.Freeze,
      OffthreadVideo: remotion.OffthreadVideo,
      ComponentSurface: componentSurface,
      SceneModuleSurface: sceneSurface,
      SceneTransitionSurface: transitionSurface,
      componentRenderer,
    },
  };
}

function scene(id: string, from: number, duration: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    from,
    duration,
    title: id,
    parameters: {},
    words: [],
    beats: [],
    mediaSrc: "source.mp4",
    materials: [],
    ...extra,
  };
}

describe("generated production composition", () => {
  it("executes scene dispatch with scoped layers and a frozen predecessor", async () => {
    const source = productionCompositionSource(
      "/tmp/project",
      {duration: 40},
      "const componentModule={Component:componentRenderer,ComponentB:componentRenderer};",
      "componentModule.Component,componentModule.ComponentB",
      "const sceneModule={Scene:sceneRenderer};",
      "sceneModule.Scene",
    );
    const fixture = {
      duration: 40,
      mediaSrc: "source.mp4",
      scenePrograms: [
        scene("a", 3, 12),
        scene("b", 15, 18, {
          entryTransition: {type: "dissolve", frames: 4},
          transitionSpanFrames: 6,
          transitionFromSceneId: "a",
          transitionOutgoingFrame: 99,
        }),
      ],
      componentLayers: [
        {id: "a-layer", sceneId: "a", from: 3, duration: 12, props: {}},
        {id: "b-layer", sceneId: "b", from: 15, duration: 18, props: {}},
      ],
    };
    const {tree, mocks} = await evaluateComposition(source, fixture);
    const rootChildren = childrenOf(tree);
    const sceneFragment = rootChildren[0];
    const sequences = childrenOf(sceneFragment).filter(
      (child) => child.type === mocks.Sequence,
    );
    const firstPad = sequences.find((child) => child.props.from === undefined);
    expect(firstPad).toBeDefined();
    const bSequence = sequences.find((child) => child.props.from === 15);
    expect(bSequence).toBeDefined();
    const transition = bSequence!.props.children as MockElement;
    expect(transition.type).toBe(mocks.SceneTransitionSurface);
    expect(transition.props.outgoing.frame).toBe(99);
    expect(transition.props.scene.componentLayers.map((layer: any) => layer.id)).toEqual(["b-layer"]);
    expect(transition.props.outgoing.scene.componentLayers.map((layer: any) => layer.id)).toEqual(["a-layer"]);
    expect(transition.props.scene.componentLayers[0].renderer).toBe(mocks.componentRenderer);
    expect(transition.props.outgoing.scene.componentLayers[0].renderer).toBe(mocks.componentRenderer);
    expect(containsType(tree, mocks.ComponentSurface)).toBe(false);
    expect(containsType(tree, mocks.OffthreadVideo)).toBe(false);
  });

  it("preserves the legacy global layer branch", async () => {
    const source = productionCompositionSource(
      "/tmp/project",
      {duration: 30},
      "const componentModule={Component:componentRenderer};",
      "componentModule.Component",
      "const sceneModule={Scene:sceneRenderer};",
      "sceneModule.Scene",
    );
    const {tree, mocks} = await evaluateComposition(source, {
      duration: 30,
      mediaSrc: "source.mp4",
      componentLayers: [{id: "legacy", from: 0, duration: 30, props: {}}],
    });
    const rootChildren = childrenOf(tree);
    expect(containsType(tree, mocks.ComponentSurface)).toBe(true);
  });

  it("keeps an explicit outgoing frame beyond the spoken duration", () => {
    expect(resolveOutgoingFreezeFrame(99, 4)).toBe(99);
    expect(resolveOutgoingFreezeFrame(-2, 4)).toBe(0);
    expect(resolveOutgoingFreezeFrame(Number.NaN, 4)).toBe(3);
  });
});
