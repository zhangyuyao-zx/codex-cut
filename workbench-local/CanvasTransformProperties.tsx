import React from 'react';
import type {CanvasTransform} from './editor-commands';

export function CanvasTransformProperties({value, locked, lockInherited, disabled, onChange, onLock, onActiveChange}: {
  value: CanvasTransform; locked: boolean; disabled: boolean;
  onChange: (key: keyof CanvasTransform, value: number) => void;
  onLock: () => void;
  onActiveChange?: (active: boolean) => void;
  lockInherited?: boolean;
}) {
  return <section className="canvas-transform-properties">
    <h4>画布调整 <button disabled={disabled || lockInherited} aria-pressed={locked} onClick={onLock}>{lockInherited ? '父组已锁定' : locked ? '解锁对象' : '锁定对象'}</button></h4>
    <div className="canvas-transform-grid">{([
      ['x', '水平偏移 · px', -20000, 20000, 1], ['y', '垂直偏移 · px', -20000, 20000, 1],
      ['scale', '等比缩放 · 倍', .05, 8, .01], ['rotation', '旋转 · °', -3600, 3600, 1],
    ] as const).map(([key, label, min, max, step]) => <label key={key}>{label}
      <input type="number" aria-label={label} min={min} max={max} step={step} disabled={disabled || locked}
        key={key + ':' + value[key]} defaultValue={Number(value[key].toFixed(3))}
        onFocus={() => onActiveChange?.(true)}
        onKeyDown={event => {if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') {event.currentTarget.value = String(value[key]); event.currentTarget.blur();}}}
        onBlur={event => {
          onActiveChange?.(false);
          const input = event.currentTarget, next = input.valueAsNumber;
          if (input.value.trim() === '' || !Number.isFinite(next) || next < min || next > max) {input.value = String(value[key]); return;}
          if (next !== value[key]) onChange(key, next);
        }}/>
    </label>)}</div>
  </section>;
}
