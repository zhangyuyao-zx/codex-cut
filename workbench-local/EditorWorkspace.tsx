import React, {useLayoutEffect, useRef, useState} from 'react';
import './editor-shell.css';

type PanelWidths = {left: number; right: number};
const defaults: PanelWidths = {left: 232, right: 280};
const clampWidth = (side: keyof PanelWidths, value: number) => Math.max(side === 'left' ? 196 : 240, Math.min(380, value));
export function EditorWorkspace({className, children}: {className: string; children: React.ReactNode}) {
  const [widths, setWidths] = useState<PanelWidths>(() => {
    try {
      const value = JSON.parse(localStorage.getItem('codex-cut.panel-widths') || 'null');
      return {left: Number.isFinite(value?.left) ? clampWidth('left', value.left) : defaults.left,
        right: Number.isFinite(value?.right) ? clampWidth('right', value.right) : defaults.right};
    } catch {return defaults;}
  });
  const widthsRef = useRef(widths); widthsRef.current = widths;
  const gesture = useRef<{side: keyof PanelWidths; start: number; before: number; pointerId: number} | null>(null);
  const persist = () => {try {localStorage.setItem('codex-cut.panel-widths', JSON.stringify(widthsRef.current));} catch {}};
  return <div className={className + ' editor-workspace'} style={{'--editor-left-width': widths.left + 'px', '--editor-right-width': widths.right + 'px'} as React.CSSProperties}>
    {children}
    {(['left', 'right'] as const).map(side => <div key={side} role="separator" tabIndex={0} aria-label={side === 'left' ? '调整左侧面板宽度' : '调整属性面板宽度'} aria-orientation="vertical"
      aria-valuemin={side === 'left' ? 196 : 240} aria-valuemax={380} aria-valuenow={Math.round(widths[side])}
      className={'editor-panel-divider divider-' + side}
      onPointerDown={event => {if (event.button !== 0) return; event.currentTarget.focus({preventScroll:true}); gesture.current = {side, start: event.clientX, before: widths[side], pointerId: event.pointerId}; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();}}
      onPointerMove={event => {const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
        const next={...widthsRef.current,[side]:clampWidth(side,g.before+(event.clientX-g.start)*(side==='left'?1:-1))}; widthsRef.current=next;setWidths(next);}}
      onPointerUp={event => {if (!gesture.current) return; gesture.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); persist();}}
      onPointerCancel={() => {const g = gesture.current; gesture.current = null; if (g) setWidths(current => ({...current, [g.side]: g.before}));}}
      onKeyDown={event => {if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return; event.preventDefault();
        const value = event.key === 'Home' ? defaults[side] : clampWidth(side, widths[side] + (event.key === 'ArrowRight' ? 10 : -10) * (side === 'left' ? 1 : -1));
        const next = {...widths, [side]: value}; setWidths(next); widthsRef.current = next; persist();}}/>)}
  </div>;
}

export function SidebarTabs({value, onChange, items}: {value: string; onChange: (value: string) => void; items: {id: string; label: string; count?: number}[]}) {
  return <div className="editor-sidebar-tabs" role="tablist">{items.map((item,index) => <button type="button" role="tab" key={item.id} aria-selected={item.id === value} onClick={() => onChange(item.id)}
    onKeyDown={event => {if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length; onChange(items[next].id); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();}}>{item.label}{item.count !== undefined && <small>{item.count}</small>}</button>)}</div>;
}

export function FittedCanvas({className = 'cut-canvas', children}: {className?: string; children: React.ReactNode}) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      const width = Math.max(0, element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      const height = Math.max(0, element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
      element.style.setProperty('--fit-width', Math.max(1, Math.min(width, height * 16 / 9)) + 'px');
    };
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);
  return <div ref={host} className={className + ' fitted-canvas'}>{children}</div>;
}

export function EditorDock({children}: {children: React.ReactNode}) {
  const [height, setHeight] = useState(() => {try {const h = Number(localStorage.getItem('codex-cut.dock-height')); return h >= 96 && h <= 300 ? h : 156;} catch {return 156;}});
  const start = useRef<{y: number; height: number} | null>(null);
  const value = useRef(height); value.current = height;
  const remember = () => {try {localStorage.setItem('codex-cut.dock-height', String(value.current));} catch {}};
  return <section className="editor-dock" style={{height}} aria-label="段落与分镜">
    <div className="editor-dock-divider" role="separator" tabIndex={0} aria-orientation="horizontal" aria-label="调整段落区高度" aria-valuemin={96} aria-valuemax={300} aria-valuenow={height}
      onPointerDown={event => {if (event.button !== 0) return; event.currentTarget.focus({preventScroll:true}); start.current = {y: event.clientY, height}; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();}}
      onPointerMove={event => {if (start.current) {const next=Math.max(96,Math.min(Math.min(300,window.innerHeight*.4),start.current.height+start.current.y-event.clientY));value.current=next;setHeight(next);}}}
      onPointerUp={event => {start.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); remember();}}
      onPointerCancel={() => {if (start.current) setHeight(start.current.height); start.current = null;}}
      onKeyDown={event => {if (!['ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 156 : Math.max(96, Math.min(300, height + (event.key === 'ArrowUp' ? 12 : -12))); setHeight(next); value.current = next; remember();}}/>
    <div className="editor-dock-content">{children}</div>
  </section>;
}
