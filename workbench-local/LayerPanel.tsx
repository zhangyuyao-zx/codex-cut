import React, {useEffect, useRef} from 'react';
import {objectLockedFor, objectOrderFor, objectVisibleFor, type CanvasObjectCapability, type EditorChange, type ObjectEditor} from './editor-commands';
import {EditorIcon, type EditorIconName} from './EditorIcon';

export type LayerMenuAnchor = {id: string; x: number; y: number};
type LayerProps = {
  objects: readonly CanvasObjectCapability[]; editor: ObjectEditor | undefined; selected: string; disabled: boolean;
  onSelect: (id: string) => void; onEdit: (id: string, changes: EditorChange[]) => void;
};
export function layerRows(objects: readonly CanvasObjectCapability[], editor: ObjectEditor | undefined) {
  const rows: {object: CanvasObjectCapability; depth: number}[] = [];
  const visit = (parentId: string | undefined, depth: number) => {
    const siblings = objects.filter(object => object.parentId === parentId);
    if (!siblings.length) return;
    for (const id of objectOrderFor(editor, {objects}, siblings[0].id).slice().reverse()) {
      const object = siblings.find(item => item.id === id);
      if (object) {rows.push({object, depth}); visit(id, depth + 1);}
    }
  };
  visit(undefined, 0); return rows;
}
function kindIcon(object: CanvasObjectCapability): EditorIconName {
  return object.kind === 'text' ? 'type' : object.kind || (object.canvas?.text ? 'type' : 'shape');
}
export function LayerPanel({objects, editor, selected, disabled, onSelect, onEdit, onMenu}: LayerProps & {onMenu: (anchor: LayerMenuAnchor) => void}) {
  const rows = layerRows(objects, editor);
  return <section className="editor-layers" aria-label="当前段落图层">
    <div className="panel-section-heading"><span>画面图层</span><small>{objects.length} 个</small></div>
    {!rows.length && <p className="editor-empty-copy">这一段尚未声明可编辑对象。可以继续预览，也可以让 Codex 为需要调整的内容提供编辑入口。</p>}
    <div role="tree" aria-label="图层">{rows.map(({object, depth}, index) => {
      const visible = objectVisibleFor(editor, object.id), locked = objectLockedFor(editor, {objects}, object.id);
      const ownLock = editor?.objectLocks?.includes(object.id) ?? false;
      return <div key={object.id} role="treeitem" aria-level={depth + 1} aria-selected={object.id === selected} tabIndex={object.id === selected || (!selected && index === 0) ? 0 : -1}
        className={'layer-row' + (object.id === selected ? ' selected' : '') + (!visible ? ' layer-hidden' : '')}
        style={{'--layer-depth': depth} as React.CSSProperties}
        onClick={() => !disabled && onSelect(object.id)}
        onContextMenu={event => {if (disabled) return; event.preventDefault(); onSelect(object.id); onMenu({id: object.id, x: event.clientX, y: event.clientY});}}
        onKeyDown={event => {
          if (disabled || event.target !== event.currentTarget) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault(); const next = rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]; onSelect(next.object.id);
            const siblings = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="treeitem"]'); siblings?.[rows.indexOf(next)]?.focus();}
          if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onSelect(object.id);}
          if (event.key === 'F10' && event.shiftKey) {event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); onMenu({id: object.id, x: rect.right - 20, y: rect.bottom});}
        }}>
        <span className="layer-kind"><EditorIcon name={kindIcon(object)}/></span>
        <span className="layer-label" title={object.label || object.id}>{object.label || object.id}{locked && <small>{ownLock ? '已锁定' : '父组已锁定'}</small>}</span>
        <div className="layer-row-actions">
          {object.canvas?.visibility && <button type="button" aria-label={(visible ? '隐藏' : '显示') + (object.label || object.id)} title={visible ? '隐藏图层' : '显示图层'} disabled={disabled || locked} onClick={event => {event.stopPropagation(); onEdit(object.id, [{kind: 'visibility', key: 'visible', before: visible, after: !visible}]);}}><EditorIcon name={visible ? 'eye' : 'hidden'}/></button>}
          <button type="button" aria-label={(ownLock ? '解锁' : '锁定') + (object.label || object.id)} title={locked && !ownLock ? '请先解锁父组' : ownLock ? '解锁图层' : '锁定图层'} disabled={disabled || (locked && !ownLock)} className={locked ? 'visible-action' : ''} onClick={event => {event.stopPropagation(); onEdit(object.id, [{kind: 'objectLock', key: 'locked', before: ownLock, after: !ownLock}]);}}><EditorIcon name={locked ? 'lock' : 'unlock'}/></button>
          <button type="button" aria-label={'更多图层操作：' + (object.label || object.id)} disabled={disabled} onClick={event => {event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); onSelect(object.id); onMenu({id: object.id, x: rect.right, y: rect.bottom + 4});}}><EditorIcon name="more"/></button>
        </div>
      </div>;
    })}</div>
    {rows.length > 0 && <p className="panel-footnote">上方图层显示在前面。固定分组内调整顺序。</p>}
  </section>;
}

export function ObjectLayerMenu({objects, editor, disabled, anchor, onEdit, onClose}: Omit<LayerProps, 'selected'|'onSelect'> & {anchor: LayerMenuAnchor; onClose: () => void}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => {if (!menu.current?.contains(event.target as Node)) onClose();};
    const close = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); onClose();}};
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', close);
    return () => {document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', close);};
  }, [anchor.id]);
  const object = objects.find(item => item.id === anchor.id);
  if (!object) return null;
  const order = objectOrderFor(editor, {objects}, object.id), index = order.indexOf(object.id);
  const reorder = order.length > 1 && order.every(id => objects.find(item => item.id === id)?.canvas?.reorder);
  const locked = objectLockedFor(editor, {objects}, object.id), ownLock = editor?.objectLocks?.includes(object.id) ?? false;
  const visible = objectVisibleFor(editor, object.id);
  const move = (to: number) => {const next = order.filter(id => id !== object.id); next.splice(to, 0, object.id); onEdit(object.id, [{kind: 'layerOrder', key: 'siblings', before: order, after: next}]); onClose();};
  return <div ref={menu} className="editor-object-menu" role="menu" aria-label={(object.label || object.id) + '图层操作'} style={{left: Math.max(8, Math.min(anchor.x, window.innerWidth - 210)), top: Math.max(8, Math.min(anchor.y, window.innerHeight - 275))}}
    onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget as Node)) onClose();}}
    onKeyDown={event => {if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return; event.preventDefault(); const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();}}>
    <small>{object.label || object.id}</small>
    {reorder && <><button role="menuitem" disabled={disabled || locked || index === order.length - 1} onClick={() => move(order.length - 1)}>置于顶层 <span>↑↑</span></button><button role="menuitem" disabled={disabled || locked || index === order.length - 1} onClick={() => move(index + 1)}>上移一层 <EditorIcon name="up"/></button><button role="menuitem" disabled={disabled || locked || index === 0} onClick={() => move(index - 1)}>下移一层 <EditorIcon name="down"/></button><button role="menuitem" disabled={disabled || locked || index === 0} onClick={() => move(0)}>置于底层 <span>↓↓</span></button><hr/></>}
    {object.canvas?.visibility && <button role="menuitem" disabled={disabled || locked} onClick={() => {onEdit(object.id, [{kind:'visibility',key:'visible',before:visible,after:!visible}]); onClose();}}>{visible ? '隐藏图层' : '显示图层'}<EditorIcon name={visible ? 'hidden' : 'eye'}/></button>}
    <button role="menuitem" disabled={disabled || (locked && !ownLock)} onClick={() => {onEdit(object.id,[{kind:'objectLock',key:'locked',before:ownLock,after:!ownLock}]); onClose();}}>{locked && !ownLock ? '父组已锁定' : ownLock ? '解锁图层' : '锁定图层'}<EditorIcon name={locked ? 'unlock' : 'lock'}/></button>
    {!reorder && <p>此对象不支持调整图层顺序。</p>}
  </div>;
}
