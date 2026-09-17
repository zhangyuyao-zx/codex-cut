import React, {useEffect, useState} from 'react';

export function useWorkbenchAppearance() {
  const [solid, setSolid] = useState(() => {
    try { return localStorage.getItem('workbench.solid') === 'true'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('workbench.solid', String(solid)); } catch {} }, [solid]);
  return {solid, setSolid};
}

export function ChromeIcon({kind}: {kind: 'left' | 'right' | 'glass'}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'glass' ? <><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" opacity=".3"/></> : <><rect x="3" y="5" width="18" height="14" rx="3"/><path d={kind === 'left' ? 'M9 5v14' : 'M15 5v14'}/></>}
  </svg>;
}
