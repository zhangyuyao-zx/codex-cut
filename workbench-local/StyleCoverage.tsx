import React from 'react';
import type {StyleCoverage as Coverage} from './visual-application';

/** Parameter coverage is visible evidence, never a claim that the film's art direction passed. */
export function StyleCoverage({coverage,compact=false,selectedSceneId,onFollow,disabled=false}:{coverage?:Coverage;compact?:boolean;selectedSceneId?:string;onFollow?:()=>void;disabled?:boolean}){
  if(!coverage)return null;
  const mapped=coverage.mapped+coverage.partial;
  const summary=<><strong>样式映射 {mapped} / {coverage.total} 段</strong>{coverage.unmapped>0&&<span>{coverage.unmapped} 段待设计适配</span>}{coverage.preserved>0&&<span>{coverage.preserved} 段保留已有设置</span>}</>;
  const selected=coverage.scenes.find(scene=>scene.sceneId===selectedSceneId);
  const mismatches=selected?.values?.filter(value=>JSON.stringify(value.expected)!==JSON.stringify(value.effective))??[];
  const display=(value:unknown)=>typeof value==='string'?value:JSON.stringify(value);
  const contents=<><p className="style-coverage-hint">共同样式在预览与导出时继承。保留你的调整和锁；构图、动作与实际效果需要看样片。</p>
    {mismatches.length>0&&<div className="style-value-differences"><strong>当前段落的不同设置</strong>{mismatches.map(value=><p key={value.parameter}><span>{value.label}：{display(value.effective)}</span><small>全片：{display(value.expected)} · {value.locked?'已锁定':value.source==='user'?'你的调整':'段落设置'}</small></p>)}</div>}
    {onFollow&&selected&&mismatches.length>0&&<button disabled={disabled||!mismatches.some(value=>!value.locked)} onClick={onFollow}>未锁定样式跟随全片</button>}
    <ul>{coverage.scenes.map(scene=><li key={scene.sceneId} data-state={scene.status}><strong>{scene.title}</strong><span>{scene.reason}</span></li>)}</ul></>;
  return compact?<details className="style-coverage compact"><summary>{summary}</summary>{contents}</details>:<section className="style-coverage"><div className="style-coverage-summary">{summary}</div>{contents}</section>;
}
