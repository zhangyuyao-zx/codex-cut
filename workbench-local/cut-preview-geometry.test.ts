import {describe,expect,it} from 'vitest';
import {cutPreviewGeometry} from './cut-preview-geometry';
describe('cut preview and export geometry',()=>{
  it('contains a cropped result instead of shrinking it inside the original canvas',()=>{
    const result=cutPreviewGeometry(1280,720,{left:.25,right:.25,top:.25,bottom:.25});
    expect(result.widthPercent).toBe(100);
    expect(result.heightPercent).toBe(100);
    expect(result.mediaWidthPercent).toBe(200);
    expect(result.mediaLeftPercent).toBe(-50);
  });
  it('contains portrait footage without stretching and keeps an asymmetric crop offset',()=>{
    const result=cutPreviewGeometry(720,1280,{left:0,right:0,top:.25,bottom:0});
    expect(result.widthPercent).toBeCloseTo(42.1875);
    expect(result.heightPercent).toBe(100);
    expect(result.mediaTopPercent).toBeCloseTo(-100/3);
  });
  it('keeps at least two even pixels for a narrow crop',()=>{
    const result=cutPreviewGeometry(1280,720,{left:.49999,right:.49999,top:0,bottom:0});
    expect(result.mediaWidthPercent).toBe(64000);
    expect(Number.isFinite(result.widthPercent)).toBe(true);
    expect(()=>cutPreviewGeometry(0,0,{left:0,right:0,top:0,bottom:0})).toThrow();
  });
});
