import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {objectTransformFor, type CanvasObjectCapability, type CanvasTransform} from './editor-commands';
import {transformAtPointer, parentCanvasTransform, type CanvasGesture} from './canvas-geometry';
import './canvas-editor.css';

type CanvasEditing = {
  transforms?: Record<string, Partial<CanvasTransform>>;
  locks?: string[];
  values: Record<string, unknown>;
  disabled?: boolean;
  onInteractionStart: () => void;
  onActiveChange: (active: boolean) => void;
  onTransformPreview: (id: string, value: CanvasTransform | null) => void;
  onTransformCommit: (id: string, before: CanvasTransform, after: CanvasTransform) => void;
  onTextPreview: (id: string, key: string, value: string | null) => void;
  onTextCommit: (id: string, key: string, before: string, after: string) => void;
};
type SelectionBox = {x: number; y: number; width: number; height: number; rotation: number};
type TextEdit = {id: string; key: string; before: string; value: string};

export function ObjectPreview({objects, selected, sceneId, onSelect, onObjectContextMenu, canvas, children}: {
  objects: readonly CanvasObjectCapability[];
  selected: string;
  sceneId?: string;
  onSelect: (id: string) => void;
  onObjectContextMenu?: (anchor: {id: string; x: number; y: number}) => void;
  canvas?: CanvasEditing;
  children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({canvas, objects, selected, sceneId});
  current.current = {canvas, objects, selected, sceneId};
  const gesture = useRef<(CanvasGesture & {id: string; pointerId: number; last: CanvasTransform}) | null>(null);
  const [box, setBox] = useState<SelectionBox | null>(null);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  const textRef = useRef<TextEdit | null>(null);
  const lastTap = useRef<{id: string; at: number} | null>(null);
  const findNode = (id: string) => Array.from(host.current?.querySelectorAll<HTMLElement>('[data-canvas-object]') ?? [])
    .find(node => node.dataset.canvasObject === id && (!current.current.sceneId || node.closest<HTMLElement>('[data-canvas-scene]')?.dataset.canvasScene === current.current.sceneId));
  const capability = objects.find(object => object.id === selected);
  const locked = canvas?.locks?.includes(selected) ?? false;

  useLayoutEffect(() => {
    const container = host.current;
    if (!container || !canvas || !capability?.canvas) {setBox(null); return;}
    let frame = 0;
    const measure = () => {
      frame = 0;
      const node = findNode(current.current.selected), root = node?.closest<HTMLElement>('[data-canvas-scene]');
      if (!node || !root) {setBox(null); return;}
      const rect = node.getBoundingClientRect(), bounds = container.getBoundingClientRect();
      const viewportScale = root.getBoundingClientRect().width / 1920;
      const value = objectTransformFor({objectTransforms: current.current.canvas?.transforms}, current.current.selected);
      const parent = parentCanvasTransform(current.current.canvas?.transforms,current.current.objects,current.current.selected);
      const next = {x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top,
        width: node.offsetWidth * viewportScale * value.scale * parent.scale, height: node.offsetHeight * viewportScale * value.scale * parent.scale, rotation: value.rotation + parent.rotation};
      if (!next.width || !next.height) {setBox(null); return;}
      setBox(previous => previous && Object.keys(next).every(key => Math.abs(previous[key as keyof SelectionBox] - next[key as keyof SelectionBox]) < .05) ? previous : next);
    };
    const schedule = () => {if (!frame) frame = requestAnimationFrame(measure);};
    const observer = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element && record.target.closest('[data-canvas-editor-ui]')))) schedule();
    });
    observer.observe(container, {attributes: true, childList: true, characterData: true, subtree: true});
    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    measure();
    return () => {observer.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true);};
  }, [selected, !!canvas, capability?.canvas, canvas?.transforms]);

  const cancelGesture = () => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    if (host.current?.hasPointerCapture(active.pointerId)) host.current.releasePointerCapture(active.pointerId);
    current.current.canvas?.onTransformPreview(active.id, null);
    current.current.canvas?.onActiveChange(false);
  };
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {if (event.key === 'Escape' && gesture.current) {event.preventDefault(); cancelGesture();}};
    window.addEventListener('keydown', cancel);
    return () => {window.removeEventListener('keydown', cancel); if (gesture.current) cancelGesture();};
  }, []);

  const finishText = (save: boolean) => {
    const edit = textRef.current;
    if (!edit) return;
    textRef.current = null; setTextEdit(null);
    if (save && edit.value !== edit.before) current.current.canvas?.onTextCommit(edit.id, edit.key, edit.before, edit.value);
    else current.current.canvas?.onTextPreview(edit.id, edit.key, null);
    current.current.canvas?.onActiveChange(false);
  };
  const beginText = (id: string) => {
    const state = current.current, editCanvas = state.canvas;
    const object = state.objects.find(item => item.id === id), key = object?.canvas?.text;
    if (!editCanvas || editCanvas.disabled || textRef.current || !key || editCanvas.locks?.includes(id)) return;
    editCanvas.onInteractionStart(); onSelect(id);
    const value = String(editCanvas.values[key] ?? ''), edit = {id, key, before: value, value};
    textRef.current = edit; setTextEdit(edit); editCanvas.onActiveChange(true);
  };

  return <div ref={host} tabIndex={0} role="region" aria-label="视频画布" className={'object-preview' + (canvas ? ' canvas-editable' : '')}
    onContextMenu={event => {
      if (!onObjectContextMenu || canvas?.disabled) return;
      const id = (event.target as Element).closest<HTMLElement>('[data-editable-object]')?.dataset.editableObject;
      if (!id || !objects.some(object => object.id === id)) return;
      event.preventDefault(); onObjectContextMenu({id, x:event.clientX, y:event.clientY});
    }}
    onClickCapture={event => {
      if ((event.target as Element).closest('[data-canvas-editor-ui]')) return;
      const id = (event.target as Element).closest?.('[data-editable-object]')?.getAttribute('data-editable-object');
      if (id && objects.some(object => object.id === id)) {event.preventDefault(); event.stopPropagation(); onSelect(id);}
    }}
    onPointerDownCapture={event => {
      if (!canvas || event.button !== 0 || textRef.current) return;
      const target = event.target as Element, handle = target.closest<HTMLElement>('[data-canvas-handle]');
      if (target.closest('[data-canvas-editor-ui]') && !handle) return;
      const id = handle ? selected : target.closest<HTMLElement>('[data-canvas-object]')?.dataset.canvasObject;
      if (!id) return;
      const object = objects.find(item => item.id === id);
      if (!object) return;
      if (canvas.disabled) return;
      event.currentTarget.focus({preventScroll:true});
      onSelect(id);
      if (!object.canvas?.transform || canvas.disabled || canvas.locks?.includes(id)) {
        if (id !== selected) canvas.onInteractionStart();
        return;
      }
      canvas.onInteractionStart();
      const node = findNode(id), root = node?.closest<HTMLElement>('[data-canvas-scene]');
      if (!node || !root) return;
      const rect = node.getBoundingClientRect(), before = objectTransformFor({objectTransforms: canvas.transforms}, id);
      const parent = parentCanvasTransform(canvas.transforms, objects, id);
      gesture.current = {id, pointerId: event.pointerId, before, last: before,
        mode: (handle?.dataset.canvasHandle as CanvasGesture['mode']) ?? 'move',
        start: {x: event.clientX, y: event.clientY}, center: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
        viewportScale: root.getBoundingClientRect().width / 1920 * parent.scale, parentRotation:parent.rotation};
      event.currentTarget.setPointerCapture(event.pointerId);
      canvas.onActiveChange(true); event.preventDefault(); event.stopPropagation();
    }}
    onPointerMove={event => {
      const active = gesture.current;
      if (!active || event.pointerId !== active.pointerId) return;
      if (active.mode === 'move' && Math.hypot(event.clientX - active.start.x, event.clientY - active.start.y) < 3 && active.last === active.before) return;
      active.last = transformAtPointer(active, {x: event.clientX, y: event.clientY}, event.shiftKey);
      canvas?.onTransformPreview(active.id, active.last); event.preventDefault();
    }}
    onPointerUp={event => {
      const active = gesture.current;
      if (!active || event.pointerId !== active.pointerId) return;
      gesture.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      canvas?.onTransformCommit(active.id, active.before, active.last);
      canvas?.onActiveChange(false);
      if (active.mode === 'move' && JSON.stringify(active.before) === JSON.stringify(active.last)) {
        const now = performance.now(), previous = lastTap.current;
        if (previous?.id === active.id && now - previous.at < 450) {lastTap.current = null; beginText(active.id);}
        else lastTap.current = {id: active.id, at: now};
      } else lastTap.current = null;
      event.preventDefault(); event.stopPropagation();
    }}
    onPointerCancel={cancelGesture}
    onLostPointerCapture={() => {if (gesture.current) cancelGesture();}}
    onDoubleClickCapture={event => {
      if (!canvas || canvas.disabled || textRef.current || (event.target as Element).closest('[data-canvas-editor-ui]')) return;
      const id = (event.target as Element).closest<HTMLElement>('[data-canvas-object]')?.dataset.canvasObject ||
        objects.find(object => {
          const rect = findNode(object.id)?.getBoundingClientRect();
          return rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        })?.id;
      if (!id) return;
      beginText(id);
      event.preventDefault(); event.stopPropagation();
    }}>
    <style>{selected && (!canvas || !capability?.canvas) ? `.object-preview [data-editable-object="${selected.replace(/[^a-zA-Z0-9_-]/g, '')}"]{outline:2px solid #0a84ff;outline-offset:3px;}` : ''}</style>
    {children}
    {box && capability?.canvas && <div data-canvas-editor-ui className={'canvas-selection-frame' + (locked ? ' is-locked' : '')}
      style={{left: box.x, top: box.y, width: box.width, height: box.height, transform: `translate(-50%,-50%) rotate(${box.rotation}deg)`}}>
      <span className="canvas-selection-label">{capability.label || selected}{locked ? ' · 已锁定' : ''}</span>
      {capability.canvas.transform && !locked && !canvas?.disabled && !textEdit && <>
        <button type="button" data-canvas-handle="scale" className="canvas-scale-handle" aria-label="等比缩放所选对象" title="拖动等比缩放"/>
        <button type="button" data-canvas-handle="rotate" className="canvas-rotate-handle" aria-label="旋转所选对象" title="拖动旋转 · Shift 吸附 15°">↻</button>
      </>}
    </div>}
    {textEdit && <form data-canvas-editor-ui className="canvas-inline-editor" aria-label="编辑画面文字"
      onSubmit={event => {event.preventDefault(); finishText(true);}}
      onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) finishText(true);}}>
      <textarea autoFocus aria-label="画面文字" maxLength={4000} value={textEdit.value}
        onChange={event => {
          const next = {...textEdit, value: event.target.value}; textRef.current = next; setTextEdit(next);
          canvas?.onTextPreview(next.id, next.key, next.value);
        }}
        onKeyDown={event => {
          event.stopPropagation();
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') {event.preventDefault(); finishText(false);}
          else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {event.preventDefault(); finishText(true);}
        }}/>
      <div><small>⌘ Enter 完成 · Esc 取消</small><button type="button" onClick={() => finishText(false)}>取消</button><button type="submit">完成</button></div>
    </form>}
  </div>;
}
