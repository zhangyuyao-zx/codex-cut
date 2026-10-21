import React from "react";
export function ComponentSurface({
  renderer: Renderer,
  values,
  width,
  height,
  x = 0,
  y = 0,
  scale = 1,
  opacity = 1,
  appAdapter,
  componentId,
  mediaSrc,
  mediaStartFrame,
  mediaSources,
  visualAdapter,
  visualInput,
}: {
  renderer: React.ComponentType<any>;
  values: any;
  width: number;
  height: number;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  appAdapter?: boolean;
  componentId?: string;
  mediaSrc?: string;
  mediaStartFrame?: number;
  mediaSources?: import("./component-media").ComponentMedia[];
  visualAdapter?:boolean;
  visualInput?:any;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        opacity,
        overflow: "hidden",
      }}
    >
      {visualAdapter ? <Renderer {...visualInput} parameters={values} mediaSrc={mediaSrc??visualInput?.mediaSrc} materials={(visualInput?.materials??[]).map((m:any,i:number)=>({...m,...mediaSources?.[i]}))}/> : appAdapter ? (
        <Renderer
          componentId={componentId}
          parameters={values}
          mediaSrc={mediaSrc}
          mediaStartFrame={mediaStartFrame}
          mediaSources={mediaSources}
        />
      ) : (
        <Renderer {...values} />
      )}
    </div>
  );
}
