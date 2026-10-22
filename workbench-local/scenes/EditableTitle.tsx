import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {EditableCanvasObject} from '../EditableCanvasObject';
import type {SceneModuleInput} from '../SceneModuleSurface';

/** Independent authored motion stays inside the user's layout transform. */
export function EditableTitle({parameters}: SceneModuleInput) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Number(parameters.motionFrames)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(.22, 1, .36, 1)});
  const noteProgress = interpolate(frame, [16, 16 + Number(parameters.motionFrames)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(.22, 1, .36, 1)});
  const accent = String(parameters.accent);
  return <AbsoluteFill style={{background: '#f1f3ec', color: '#1b2923', fontFamily: 'PingFang SC, sans-serif'}}>
    <div style={{position: 'absolute', left: 154, top: 128, fontSize: 24, letterSpacing: 3, color: '#708077'}}>CODEX CUT · 可视化编辑</div>
    <svg width={430} height={430} viewBox="0 0 430 430" style={{position: 'absolute', right: 70, top: 268, opacity: .13}}>
      <circle cx="215" cy="215" r="182" fill="none" stroke={accent} strokeWidth="2"/>
      <circle cx="215" cy="215" r="120" fill={accent}/>
      <circle cx="345" cy="86" r="14" fill={accent}/>
    </svg>
    <EditableCanvasObject id="headline" style={{position: 'absolute', left: 150, top: 285, width: 1350}}>
      <div data-canvas-text="caption" style={{fontSize: Number(parameters.fontSize), fontWeight: 650, lineHeight: 1.3,
        letterSpacing: -4, whiteSpace: 'pre-wrap', opacity: progress, translate: `0 ${(1 - progress) * 24}px`}}>{String(parameters.caption)}</div>
    </EditableCanvasObject>
    <EditableCanvasObject id="note" style={{position: 'absolute', left: 154, top: 685, width: 850}}>
      <div data-canvas-text="note" style={{display: 'flex', alignItems: 'center', gap: 18, fontSize: 36, lineHeight: 1.5,
        color: accent, opacity: noteProgress, translate: `0 ${(1 - noteProgress) * 14}px`}}>
        <span style={{width: 10, height: 36, borderRadius: 5, background: accent, flexShrink: 0}}/>{String(parameters.note)}
      </div>
    </EditableCanvasObject>
    <div style={{position: 'absolute', left: 154, bottom: 110, fontSize: 22, color: '#7d8b80'}}>你的调整独立保存，动画可以继续演进。</div>
  </AbsoluteFill>;
}
