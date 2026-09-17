import React, {useState} from 'react';
import {actionFrame, type ReviewAction} from './action-review';
export function ActionReview({actions, onSeek, disabledReason}: {disabledReason?: string; actions: ReviewAction[]; onSeek: (frame: number, objectId?: string) => void}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'start' | 'middle' | 'end'>('start');
  const selectedIndex = Math.min(index, actions.length - 1);
  const current = actions[selectedIndex];
  if (!current) return null;
  const anchorsOnly = actions.every(a => a.anchorOnly);
  function seek(i: number, p: typeof phase = 'start') {
    const item = actions[i];
    if (!item || disabledReason) return;
    setIndex(i); setPhase(p);
    const frame = actionFrame(item, p);
    if (frame !== null) onSeek(frame, item.objectId);
  }
  return <section className="action-review" aria-label="动作审阅">
    <div className="beat-review">
      <div><b>{anchorsOnly ? '口播定位' : '动作检查'}</b><small> {selectedIndex + 1} / {actions.length}</small></div>
      <div className="beat-navigation">
        <button disabled={!!disabledReason || selectedIndex === 0} onClick={() => seek(selectedIndex - 1)} aria-label={anchorsOnly ? '上一个口播点' : '上一个动作'}>←</button>
        <button disabled={!!disabledReason || selectedIndex >= actions.length - 1} onClick={() => seek(selectedIndex + 1)} aria-label={anchorsOnly ? '下一个口播点' : '下一个动作'}>{anchorsOnly ? '下一口播点 →' : '下一动作 →'}</button>
      </div>
      {current.endMs !== null && <div className="beat-phase" aria-label="动作检查位置">
        {(['start','middle','end'] as const).map((p,i) => <button key={p} className={phase === p ? 'active' : ''} aria-pressed={phase === p} disabled={!!disabledReason || actionFrame(current,p) === null} onClick={() => seek(selectedIndex,p)}>{['起点','中间','落点'][i]}</button>)}
      </div>}
    </div>
    <div className="beat-list">{actions.map((a,i) => <button disabled={!!disabledReason} key={a.id} className={i === selectedIndex ? 'active' : ''} aria-pressed={i === selectedIndex} onClick={() => seek(i)}><small>{a.startMs === null ? '待定位' : `${(a.startMs / 1000).toFixed(2)}s`}</small>{a.label}{a.quote && <span className="action-quote">“{a.quote}”</span>}</button>)}</div>
    {(current.before || current.after) && <p className="action-states">{current.before || '起态未记录'} → {current.after || '终态未记录'}</p>}
    <p className="hint">{disabledReason || current.issue || (current.endMs === null ? '点击口播定位画面。此段暂无完整动作时间记录。' : '定位到暂停帧检查；完整节奏仍以实际播放为准。')}</p>
  </section>;
}
