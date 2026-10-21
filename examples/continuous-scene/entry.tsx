import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {FramePipeline} from './FramePipeline';

registerRoot(()=> <Composition id="ContinuousScene" component={FramePipeline} durationInFrames={540} fps={30} width={1920} height={1080} defaultProps={{parameters:{},beats:[]}}/>);
