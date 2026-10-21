import React from 'react';
import type {StyleCoverage as Coverage} from './visual-application';

/** Parameter coverage is visible evidence, never a claim that the film's art direction passed. */
export function StyleCoverage({coverage,compact=false}:{coverage?:Coverage;compact?:boolean}){
  if(!coverage)return null;
  const mapped=coverage.mapped+coverage.partial;
  const summary=<><strong>样式映射 {mapped} / {coverage.total} 段</strong>{coverage.unmapped>0&&<span>{coverage.unmapped} 段待设计适配</span>}{coverage.preserved>0&&<span>{coverage.preserved} 段保留已有设置</span>}</>;
  const contents=<><p className="style-coverage-hint">字体、构图、动作和声音仍按内容设计；参数映射不代表画面已通过审阅。</p><ul>{coverage.scenes.map(scene=><li key={scene.sceneId} data-state={scene.status}><strong>{scene.title}</strong><span>{scene.reason}</span></li>)}</ul></>;
  return compact?<details className="style-coverage compact"><summary>{summary}</summary>{contents}</details>:<section className="style-coverage"><div className="style-coverage-summary">{summary}</div>{contents}</section>;
}
