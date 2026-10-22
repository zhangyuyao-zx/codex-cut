import React, {createContext, useContext} from 'react';
import {objectTransformFor, objectParentKey, objectVisibleFor, type CanvasTransform} from './editor-commands';

type ObjectTransforms = Record<string, Partial<CanvasTransform>>;
type CanvasEdits = {objectTransforms?:ObjectTransforms;objectVisibility?:Record<string,boolean>;objectOrder?:Record<string,string[]>};
const ObjectTransformsContext = createContext<CanvasEdits>({});

/** The same author/user transform boundary is used by Player and export. */
export function CanvasEditsProvider({transforms, visibility, order, children}: {
  transforms?: ObjectTransforms;
  visibility?: Record<string,boolean>;
  order?: Record<string,string[]>;
  children: React.ReactNode;
}) {
  return <ObjectTransformsContext.Provider value={{objectTransforms:transforms,objectVisibility:visibility,objectOrder:order}}>{children}</ObjectTransformsContext.Provider>;
}

/**
 * Keep animated transforms inside this object. The outer node owns the stable
 * layout and the user's independent transform, never a DOM-only preview patch.
 */
export function EditableCanvasObject({id, parentId, style, children}: {
  id: string;
  parentId?: string;
  style?: Omit<React.CSSProperties, 'transform' | 'translate' | 'rotate' | 'scale' | 'transformOrigin'>;
  children: React.ReactNode;
}) {
  const edits = useContext(ObjectTransformsContext);
  const value = objectTransformFor(edits, id);
  const order=edits.objectOrder?.[objectParentKey(parentId)],index=order?.indexOf(id)??-1;
  return <div data-editable-object={id} data-canvas-object={id}
    style={{...style, ...(!objectVisibleFor(edits,id)?{display:'none'}:{}), ...(index>=0?{zIndex:index}:{}), transformOrigin: '50% 50%',
      translate: `${value.x}px ${value.y}px`, rotate: `${value.rotation}deg`, scale: value.scale}}>
    {children}
  </div>;
}
