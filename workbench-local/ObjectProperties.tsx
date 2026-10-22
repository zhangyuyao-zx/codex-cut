import React, {useEffect, useId, useState} from 'react';

function NumberPropertyInput({id, label, value, min, max, step, onChange}: {
  id?: string; label: string; value: unknown; min?: number; max?: number; step?: number | "any";
  onChange: (value: number) => void;
}) {
  const [draft,setDraft]=useState(String(value ?? ''));
  const [error,setError]=useState('');
  const errorId=useId();
  useEffect(()=>{setDraft(String(value ?? ''));setError('');},[value]);
  return <div className="number-property-input">
    <input id={id} aria-label={label} type="number" min={min} max={max} step={step}
      value={draft} aria-invalid={!!error} aria-describedby={error?errorId:undefined}
      onChange={event=>{
        const text=event.target.value, number=event.target.valueAsNumber;
        setDraft(text);
        if(text.trim()==='' || !Number.isFinite(number)) {setError('请输入有效数字');return;}
        if((min!==undefined && number<min)||(max!==undefined && number>max)) {
          setError(min!==undefined&&max!==undefined?`请输入 ${min} 至 ${max} 之间的数字`:min!==undefined?`请输入不小于 ${min} 的数字`:`请输入不大于 ${max} 的数字`);return;
        }
        setError('');onChange(number);
      }}/>
    {error&&<span id={errorId} className="error" role="status">{error}，尚未应用。</span>}
  </div>;
}

function groupFor(c: any) {
  if (/位置|大小|缩放|旋转|裁剪|宽度|高度|字号|offset|scale|rotation|fontSize|[XY]$/.test(c.label + ' ' + c.key)) return '位置与大小';
  if (/时间|时长|速度|延迟|节奏|duration|delay|speed/.test(c.label + ' ' + c.key)) return '动画';
  return c.type === 'text' || c.type === 'list' ? '内容' : '外观';
}

export function ObjectProperties({editor, selected, values, locks, onSelect, onChange, onLock, disabled, hideObjectPicker}: {
  editor: any; selected: string; values: Record<string, unknown>; locks: string[];
  onSelect: (id: string) => void; onChange: (key: string, value: unknown) => void; onLock?: (key: string) => void;
  disabled?: boolean;
  hideObjectPicker?: boolean;
}) {
  const object = editor?.objects.find((o: any) => o.id === selected);
  const controls = (editor?.controls || []).filter((c: any) => object ? object.parameters.includes(c.key) : !editor.objects?.length);
  const updateNumber = (c: any, v: number) => {
    if (Number.isFinite(v) && (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max)) onChange(c.key, v);
  };
  return <section className="object-properties"><fieldset disabled={disabled} style={{border: 0, padding: 0, margin: 0, minWidth: 0}}>
    {!hideObjectPicker && <><h3>画面对象</h3>
    <div className="object-chips">{editor?.objects.map((o: any) => <button key={o.id} className={o.id === selected ? 'selected' : ''} aria-pressed={o.id === selected} onClick={() => onSelect(o.id)}>{o.label}</button>)}</div></>}
    {!editor?.objects?.length && <p className="hint">此段尚未声明画面对象；下方显示已公开参数。</p>}
    {editor?.objects?.length > 0 && !object && <p className="editor-empty-copy">选中画面或图层中的对象，查看它的属性。</p>}
    {['内容','外观','位置与大小','动画'].map(group => {
      const fields = controls.filter((c: any) => groupFor(c) === group);
      return fields.length ? <section className="property-group" key={group}><h4>{group}</h4>{fields.map((c: any) => {
        const value = values[c.key] ?? c.default;
        const unit = c.unit || (/Scale$|scale/.test(c.key) ? '倍' : /[XY]$|fontSize|width|height/.test(c.key) ? 'px' : /rotation/i.test(c.key) ? '°' : '');
        const step = c.step ?? (/Scale$|scale|opacity/.test(c.key) ? 0.01 : 1);
        const ranged = c.type === 'number' && Number.isFinite(c.min) && Number.isFinite(c.max) && c.max > c.min;
        return <div className="field" key={c.key}>
          <div className="property-label"><label htmlFor={'property-' + c.key}>{c.label}{unit && <span className="property-unit"> · {unit}</span>}</label><div className="property-actions">{c.default !== undefined && <button type="button" title="恢复组件默认值" aria-label={'重置' + c.label} disabled={JSON.stringify(value) === JSON.stringify(c.default)} onClick={() => onChange(c.key, structuredClone(c.default))}>重置</button>}{onLock&&<button type="button" className="parameter-lock" aria-label={(locks.includes(c.key) ? '解锁' : '锁定') + c.label} aria-pressed={locks.includes(c.key)} title="锁定后 Codex 会保留你的调整" onClick={() => onLock(c.key)}>{locks.includes(c.key) ? '已锁定' : '锁定'}</button>}</div></div>
          {c.type === 'text' ? <textarea id={'property-' + c.key} value={String(value ?? '')} onChange={e => onChange(c.key,e.target.value)}/> :
            c.type === 'select' ? <select id={'property-'+c.key} value={typeof value==='string'?value:''} onChange={e=>onChange(c.key,e.target.value)}>
              <option value="" disabled>请选择</option>{c.options.map((option:string)=><option key={option} value={option}>{option}</option>)}
            </select> : c.type === 'list' ? (()=>{
              const items:unknown[]=Array.isArray(value)?value:[];
              return <div className="list-control" id={'property-'+c.key}>
                {value!==undefined&&!Array.isArray(value)&&<p className="error">列表格式无效，请重置或逐项填写。</p>}
                {items.map((item,index)=><div className="list-control-item" key={index}>
                  {c.itemType==='number'?<NumberPropertyInput label={`${c.label}第 ${index+1} 项`} value={item} step="any" onChange={number=>onChange(c.key,items.map((current,i)=>i===index?number:current))}/>:
                    <input type="text" aria-label={`${c.label}第 ${index+1} 项`} value={typeof item==='string'?item:''} maxLength={4000} onChange={e=>onChange(c.key,items.map((current,i)=>i===index?e.target.value:current))}/>}
                  <button type="button" aria-label={`删除${c.label}第 ${index+1} 项`} disabled={items.length<=(c.minItems??0)} onClick={()=>onChange(c.key,items.filter((_,i)=>i!==index))}>−</button>
                </div>)}
                <button type="button" disabled={items.length>=(c.maxItems??40)} onClick={()=>onChange(c.key,[...items,c.itemType==='number'?0:''])}>＋ 添加{c.label}</button>
                <span className="hint">{items.length} 项{c.minItems!==undefined?` · 至少 ${c.minItems} 项`:''} · 最多 {c.maxItems??40} 项</span>
              </div>;
            })() :
            <div className={ranged ? 'number-control' : 'value-control'}>
              {ranged && <input type="range" aria-label={c.label + '滑杆'} min={c.min} max={c.max} step={step} value={Number(value ?? c.min)} onChange={e => updateNumber(c,e.target.valueAsNumber)}/>}
              {c.type==='number'?<NumberPropertyInput id={'property-'+c.key} label={c.label} min={c.min} max={c.max} step={step} value={value} onChange={number=>onChange(c.key,number)}/>:
                <input id={'property-' + c.key} type={c.type === 'boolean' ? 'checkbox' : 'color'} checked={c.type === 'boolean' ? Boolean(value) : undefined} value={c.type === 'boolean' ? undefined : String(value ?? '')} onChange={e => onChange(c.key,c.type === 'boolean' ? e.target.checked : e.target.value)}/>}
              {c.type === 'color' && <code>{String(value ?? '')}</code>}
            </div>}
        </div>;
      })}</section> : null;
    })}
    {locks.length > 0 && <p className="hint">锁定的属性仍可手动调整，Codex 会保留它们。</p>}
  </fieldset></section>;
}
