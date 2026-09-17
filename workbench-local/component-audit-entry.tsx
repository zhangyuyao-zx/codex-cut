// Offline QA entry: use the same adapter as library previews and production.
import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {AppLibraryComponent} from "./AppLibraryComponent";
registerRoot(() => <Composition id="ComponentAudit" component={AppLibraryComponent}
  width={1920} height={1080} fps={30} durationInFrames={150}
  defaultProps={{componentId:'component:v1:text-clean-card',parameters:{text:'组件检查'},mediaSources:[]}} />);
