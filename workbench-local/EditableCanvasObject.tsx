import React, {createContext, useContext} from 'react';
import {objectTransformFor, type CanvasTransform} from './editor-commands';

type ObjectTransforms = Record<string, Partial<CanvasTransform>>;
const ObjectTransformsContext = createContext<ObjectTransforms>({});

/** The same author/user transform boundary is used by Player and export. */
export function CanvasEditsProvider({transforms, children}: {
  transforms?: ObjectTransforms;
  children: React.ReactNode;
}) {
  return <ObjectTransformsContext.Provider value={transforms ?? {}}>{children}</ObjectTransformsContext.Provider>;
}

/**
 * Keep animated transforms inside this object. The outer node owns the stable
 * layout and the user's independent transform, never a DOM-only preview patch.
 */
export function EditableCanvasObject({id, style, children}: {
  id: string;
  style?: Omit<React.CSSProperties, 'transform' | 'translate' | 'rotate' | 'scale' | 'transformOrigin'>;
  children: React.ReactNode;
}) {
  const transforms = useContext(ObjectTransformsContext);
  const value = objectTransformFor({objectTransforms: transforms}, id);
  return <div data-editable-object={id} data-canvas-object={id}
    style={{...style, transformOrigin: '50% 50%',
      translate: `${value.x}px ${value.y}px`, rotate: `${value.rotation}deg`, scale: value.scale}}>
    {children}
  </div>;
}
