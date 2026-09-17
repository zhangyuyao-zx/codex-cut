import React from 'react';
import {Thumbnail} from '@remotion/player';
import {AppLibraryComponent} from "./AppLibraryComponent";
import {componentMediaRequirement} from './component-media';
class ThumbnailBoundary extends React.Component<{children: React.ReactNode}, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <span className="thumbnail-fallback">点击查看效果</span> : this.props.children; }
}
const demo = (i:number) => `/thumbnail-media-${i % 2}.svg`;
export function LibraryThumbnail({item}:{item:any}) {
  let count = 0;
  try { count = componentMediaRequirement(item.id,item.thumbnailProps || {}).count; } catch { return <span className="thumbnail-fallback">选择后填写内容</span>; }
  return <div className="component-thumbnail" aria-hidden="true"><ThumbnailBoundary><Thumbnail
    component={AppLibraryComponent} inputProps={{componentId:item.id, parameters:item.thumbnailProps, mediaSources:Array.from({length:count},(_,i)=>({src:demo(i),kind:'image',startFrame:0}))}}
    compositionWidth={1920} compositionHeight={1080} durationInFrames={150} fps={30} frameToDisplay={120} style={{width:'100%',aspectRatio:'16 / 9',pointerEvents:'none'}}
  /></ThumbnailBoundary></div>;
}
