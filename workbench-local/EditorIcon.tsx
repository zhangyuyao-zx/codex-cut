import React from 'react';

export type EditorIconName = 'layers'|'film'|'type'|'shape'|'image'|'video'|'group'|'eye'|'hidden'|'lock'|'unlock'|'more'|'up'|'down'|'undo'|'redo'|'cursor'|'close'|'check'|'expand';
const paths: Record<EditorIconName, React.ReactNode> = {
  layers: <><path d="m3 8 9-5 9 5-9 5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></>,
  type: <><path d="M5 6V4h14v2M12 4v16M8 20h8"/></>,
  shape: <><rect x="4" y="4" width="16" height="16" rx="4"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>,
  video: <><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/></>,
  group: <><rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="3 3"/><path d="M8 8h8v8H8Z"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  hidden: <><path d="m3 3 18 18M10 5a12 12 0 0 1 12 7 18 18 0 0 1-3 4M6 6a18 18 0 0 0-4 6s3.5 7 10 7a11 11 0 0 0 5-1"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  unlock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  up: <path d="m6 14 6-6 6 6"/>, down: <path d="m6 10 6 6 6-6"/>,
  undo: <><path d="M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12"/></>,
  redo: <><path d="m16 5 5 5-5 5M21 10H10a6 6 0 0 0 0 12"/></>,
  cursor: <path d="m5 3 15 10-7 1-3 7Z"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m5 12 4 4L19 6"/>, expand: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></>,
};
export function EditorIcon({name}: {name: EditorIconName}) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
