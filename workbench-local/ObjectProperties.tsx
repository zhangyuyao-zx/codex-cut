import React from 'react';

function groupFor(c: any) {
  if (/位置|大小|缩放|旋转|裁剪|宽度|高度|字号|offset|scale|rotation|fontSize|[XY]$/.test(c.label + ' ' + c.key)) return '位置与大小';
  if (/时间|时长|速度|延迟|节奏|duration|delay|speed/.test(c.label + ' ' + c.key)) return '动画';
  return c.type === 'text' ? '内容' : '外观';
}

export function ObjectProperties({editor, selected, values, locks, onSelect, onChange, onLock}: {
  editor: any; selected: string; values: Record<string, unknown>; locks: string[];
  onSelect: (id: string) => void; onChange: (key: string, value: unknown) => void; onLock: (key: string) => void;
}) {
  const object = editor?.objects.find((o: any) => o.id === selected);
  const controls = (editor?.controls || []).filter((c: any) => object ? object.parameters.includes(c.key) : !editor.objects?.length);
  const updateNumber = (c: any, v: number) => {
    if (Number.isFinite(v) && (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max)) onChange(c.key, v);
  };
  return <section className="object-properties">
    <h3>画面对象</h3>
    <div className="object-chips">{editor?.objects.map((o: any) => <button key={o.id} className={o.id === selected ? 'selected' : ''} aria-pressed={o.id === selected} onClick={() => onSelect(o.id)}>{o.label}</button>)}</div>
    {!editor?.objects?.length && <p className="hint">此段尚未声明画面对象；下方显示已公开参数。</p>}
    {editor?.objects?.length > 0 && !object && <p className="hint">在画面或上方选择对象，查看它的属性。</p>}
    {['内容','外观','位置与大小','动画'].map(group => {
      const fields = controls.filter((c: any) => groupFor(c) === group);
      return fields.length ? <section className="property-group" key={group}><h4>{group}</h4>{fields.map((c: any) => {
        const value = values[c.key] ?? c.default;
        const unit = c.unit || (/Scale$|scale/.test(c.key) ? '倍' : /[XY]$|fontSize|width|height/.test(c.key) ? 'px' : /rotation/i.test(c.key) ? '°' : '');
        const step = c.step ?? (/Scale$|scale|opacity/.test(c.key) ? 0.01 : 1);
        const ranged = c.type === 'number' && Number.isFinite(c.min) && Number.isFinite(c.max) && c.max > c.min;
        return <div className="field" key={c.key}>
          <div className="property-label"><label htmlFor={'property-' + c.key}>{c.label}{unit && <span className="property-unit"> · {unit}</span>}</label><div className="property-actions">{c.default !== undefined && <button type="button" title="恢复组件默认值" aria-label={'重置' + c.label} disabled={value === c.default} onClick={() => onChange(c.key, c.default)}>重置</button>}<button type="button" className="parameter-lock" aria-label={(locks.includes(c.key) ? '解锁' : '锁定') + c.label} aria-pressed={locks.includes(c.key)} title="锁定后 Codex 会保留你的调整" onClick={() => onLock(c.key)}>{locks.includes(c.key) ? '已锁定' : '锁定'}</button></div></div>
          {c.type === 'text' ? <textarea id={'property-' + c.key} value={String(value ?? '')} onChange={e => onChange(c.key,e.target.value)}/> :
            <div className={ranged ? 'number-control' : 'value-control'}>
              {ranged && <input type="range" aria-label={c.label + '滑杆'} min={c.min} max={c.max} step={step} value={Number(value ?? c.min)} onChange={e => updateNumber(c,e.target.valueAsNumber)}/>}
              <input id={'property-' + c.key} type={c.type === 'boolean' ? 'checkbox' : c.type === 'color' ? 'color' : 'number'} min={c.min} max={c.max} step={c.type === 'number' ? step : undefined} checked={c.type === 'boolean' ? Boolean(value) : undefined} value={c.type === 'boolean' ? undefined : String(value ?? '')} onChange={e => c.type === 'number' ? updateNumber(c,e.target.valueAsNumber) : onChange(c.key,c.type === 'boolean' ? e.target.checked : e.target.value)}/>
              {c.type === 'color' && <code>{String(value ?? '')}</code>}
            </div>}
        </div>;
      })}</section> : null;
    })}
    {locks.length > 0 && <p className="hint">锁定的属性仍可手动调整，Codex 会保留它们。</p>}
  </section>;
}
