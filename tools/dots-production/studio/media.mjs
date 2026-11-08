export const clamp=v=>Math.max(0,Math.min(1,v));
export const ease=v=>1-(1-clamp(v))**3;
export const progress=(frame,start,duration)=>ease((frame-start)/Math.max(1,duration));
export function cameraAt(frame,stops){
 if(!Array.isArray(stops)||!stops.length)throw Error('An explicit initial camera is required');
 let current=stops[0].rect;
 for(let i=1;i<stops.length;i++){
  const s=stops[i];if(frame<s.at)break;
  const p=progress(frame,s.at,s.duration??15);
  current=Object.fromEntries(['x','y','w','h'].map(k=>[k,current[k]+(s.rect[k]-current[k])*p]));
  if(p<1)break;
 }
 return current;
}
export function mediaTransform(source,box,crop={x:0,y:0,w:source.w,h:source.h}){
 if(![source.w,source.h,box.w,box.h,crop.w,crop.h].every(v=>Number.isFinite(v)&&v>0)||![crop.x,crop.y].every(v=>Number.isFinite(v)&&v>=0)||crop.x+crop.w>source.w+.01||crop.y+crop.h>source.h+.01)throw Error('The evidence crop must remain inside the real source');
 // Fit the selected evidence completely. A mismatched aspect ratio must never silently crop labels.
 const scale=Math.min(box.w/crop.w,box.h/crop.h);
 const clip={x:(box.w-crop.w*scale)/2,y:(box.h-crop.h*scale)/2,w:crop.w*scale,h:crop.h*scale};
 return {scale,x:clip.x-crop.x*scale,y:clip.y-crop.y*scale,clip};
}
