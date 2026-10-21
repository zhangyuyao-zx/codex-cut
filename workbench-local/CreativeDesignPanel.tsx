import React from 'react';

/** Design notes explain the scene; only actual bound parameters edit its pixels. */
export function CreativeDesignPanel({design,beats}:{design:any;beats:any[]}){
  if(!design)return <section className="creative-design"><p className="hint">告诉 Codex 你希望怎样呈现这段内容，方案和实际画面会一起更新。</p></section>;
  return <section className="creative-design">
    <h3>这一段怎么呈现</h3>
    <p>{design.message}</p>
    <details><summary>查看设计思路</summary>
      {design.relationship&&<p><b>表达关系：</b>{design.relationship}</p>}
      <div className="design-summary-grid">{design.objects.map((object:any)=><article key={object.id}><small>{object.role==='main'?'主视觉':'辅助信息'}</small><h4>{object.content}</h4><p>{object.layout}</p></article>)}</div>
      {design.actions.length>0&&<ol>{design.actions.map((action:any,index:number)=><li key={index}><b>{beats.find(beat=>beat.wordId===action.wordId)?.label}</b> {design.objects.find((object:any)=>object.id===action.objectId)?.content} · {action.action}</li>)}</ol>}
      {design.rationale&&<p className="hint">{design.rationale}</p>}
    </details>
    <p className="hint">想换构图或动作，直接告诉 Codex。右侧属性用于调整已经接通的画面参数。</p>
  </section>;
}
