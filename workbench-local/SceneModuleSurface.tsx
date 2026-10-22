import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, staticFile, Sequence } from "remotion";
import { ComponentSurface } from "./ComponentSurface";
import { AppLibraryComponent } from "./AppLibraryComponent";
import type { SceneEntryTransition } from "./scene-transition";
import {CanvasEditsProvider} from './EditableCanvasObject';
import type {CanvasTransform} from './editor-commands';
export type SceneModuleInput = {
  id: string;
  from: number;
  duration: number;
  title: string;
  parameters: Record<string, unknown>;
  words: { id: string; text: string; start: number; end: number }[];
  beats: { wordId: string; label: string; frame: number; durationFrames?:number }[];
  mediaSrc: string;
  componentLayers?: any[];
  materials: { id: string; src: string; kind: "image" | "video" }[];
  entryTransition?: SceneEntryTransition;
  transitionSpanFrames?: number;
  transitionFromSceneId?: string;
  transitionOutgoingFrame?: number;
  ownsBackground?:boolean;
  objectTransforms?: Record<string, Partial<CanvasTransform>>;
  objectVisibility?: Record<string, boolean>;
  objectOrder?: Record<string, string[]>;
};
export function SceneModuleSurface({
  renderer: Renderer,
  scene,
  includeAudio = false,
}: {
  renderer: React.ComponentType<any>;
  scene: SceneModuleInput;
  includeAudio?: boolean;
}) {
  const source = scene.mediaSrc.startsWith("/")
    ? scene.mediaSrc
    : staticFile(scene.mediaSrc);
  return (
    <AbsoluteFill data-canvas-scene={scene.id} style={{background: "#000"}}>
      {!scene.ownsBackground&&<OffthreadVideo
        src={source}
        trimBefore={scene.from}
        muted
        style={{width: "100%", height: "100%", objectFit: "contain"}}
      />}
      <CanvasEditsProvider transforms={scene.objectTransforms} visibility={scene.objectVisibility} order={scene.objectOrder}><Renderer {...scene} /></CanvasEditsProvider>
      {scene.componentLayers?.map((l) => (
        <Sequence
          key={l.id}
          from={l.from - scene.from}
          durationInFrames={l.duration}
        >
          <ComponentSurface
            {...l}
            renderer={l.renderer || AppLibraryComponent}
            values={l.props}
          />
        </Sequence>
      ))}
      {includeAudio && (
        <Audio
          src={
            scene.mediaSrc.startsWith("/")
              ? scene.mediaSrc
              : staticFile(scene.mediaSrc)
          }
          trimBefore={scene.from}
        />
      )}
    </AbsoluteFill>
  );
}
