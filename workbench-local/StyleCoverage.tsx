import React from 'react';
import type {StyleCoverage as Coverage} from './visual-application';

export function StyleCoverage({coverage,compact=false,selectedSceneId,onFollow,disabled=false}:{coverage?:Coverage;compact?:boolean;selectedSceneId?:string;onFollow?:()=>void;disabled?:boolean}){
  if(!coverage)return null;
  const selected=coverage.scenes.find(scene=>scene.sceneId===selectedSceneId);
  const differences=selected?.values?.filter(value=>JSON.stringify(value.expected)!==JSON.stringify(value.effective))??[];
  const display=(value:unknown)=>typeof value==='string'?value:JSON.stringify(value);
  const technical=<><p className="style-coverage-hint">字体、配色和运动设置随全片继承；你的调整和锁会保留。</p><ul>{coverage.scenes.map(scene=><li key={scene.sceneId} data-state={scene.status}><strong>{scene.title}</strong><span>{scene.reason}</span></li>)}</ul></>;
  const contents=<>
    {differences.length>0&&<div className="style-value-differences"><strong>本段保留的样式</strong>{differences.map(value=><p key={value.parameter}><span>{value.label}：{display(value.effective)}</span><small>全片：{display(value.expected)} · {value.locked?'已锁定':value.source==='user'?'你的调整':'段落设置'}</small></p>)}</div>}
    {onFollow&&selected&&differences.length>0&&<button disabled={disabled||!differences.some(value=>!value.locked)} onClick={onFollow}>未锁定样式跟随全片</button>}
    {compact?<details className="style-technical"><summary>查看适配详情</summary>{technical}</details>:technical}
  </>;
  return compact?<details className="style-coverage compact"><summary><strong>{differences.length?'本段有 '+differences.length+' 项样式保留':coverage.unmapped>0?coverage.unmapped+' 段风格待适配':'风格设置'}</strong></summary>{contents}</details>:<section className="style-coverage"><div className="style-coverage-summary"><strong>样式适配 {coverage.mapped+coverage.partial} / {coverage.total} 段</strong></div>{contents}</section>;
}
