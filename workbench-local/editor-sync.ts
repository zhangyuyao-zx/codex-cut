/** Coalesce overlapping invalidations without dropping a change during a read. */
export function createRefreshQueue<T>(read: () => Promise<T>) {
  let running: Promise<T> | undefined, pending = false;
  return {request(): Promise<T> {
    pending = true;
    if (running) return running;
    running = (async () => {
      let result!: T;
      do {pending = false; try {result = await read();} catch(error) {if(!pending)throw error;}} while (pending);
      return result;
    })().finally(() => {running = undefined;});
    return running;
  }};
}

/** At most one write and one latest pending value, rather than a playback backlog. */
export function createSelectionPublisher<T>(send: (value: T) => Promise<unknown>, onError: (error: unknown) => void) {
  let pending: {value: T; key: string} | undefined, running = false, sent = '', stopped = false;
  async function drain() {
    if (running || stopped) return;
    running = true;
    try {
      while (pending && !stopped) {
        const next = pending; pending = undefined;
        if (next.key === sent) continue;
        try {await send(next.value); sent = next.key;}
        catch (error) {onError(error);}
      }
    } finally {running = false;}
  }
  return {
    publish(value: T) {if (stopped) return; pending = {value, key: JSON.stringify(value)}; void drain();},
    stop() {stopped = true; pending = undefined;},
  };
}

type Change = {domains: string[]; sequence?: number};
/** Healthy SSE replaces polling. Disconnection keeps a bounded recovery path. */
export function subscribeEditorChanges(options: {onChange: (event: Change) => void | Promise<unknown>; onTask?: (event: any) => void | Promise<unknown>;
  makeSource?: () => EventSource; fallbackMs?: number; onVisibility?: boolean}) {
  let source: EventSource | undefined, fallback: ReturnType<typeof setInterval> | undefined, closed = false;
  let retry:ReturnType<typeof setTimeout>|undefined,failures=0,request=0;
  const all={domains:['production','cut','source','assets']};
  const deliver=(event:Change)=>{
    if(closed)return;
    const current=++request;
    let result:void|Promise<unknown>;
    try{result=options.onChange(event);}catch(error){result=Promise.reject(error);}
    void Promise.resolve(result).then(()=>{
      if(current!==request||closed)return;failures=0;if(retry)clearTimeout(retry);retry=undefined;
    }).catch(()=>{
      if(current!==request||closed||fallback)return;
      if(retry)clearTimeout(retry);
      retry=setTimeout(()=>{retry=undefined;deliver(all);},Math.min(1000*2**failures++,15000));
    });
  };
  const refresh = () => deliver(all);
  const startFallback = () => {
    if (fallback || closed) return;
    refresh(); fallback = setInterval(refresh, options.fallbackMs ?? 5000);
  };
  const stopFallback = () => {if (fallback) clearInterval(fallback); fallback = undefined;};
  try {
    source = options.makeSource ? options.makeSource() : new EventSource('/api/production/editor/events');
    source.addEventListener('snapshot', refresh);
    source.addEventListener('revision', refresh); // Compatible with a pre-upgrade local service.
    source.addEventListener('change', (event: MessageEvent) => {
      try {const value = JSON.parse(event.data); if (Array.isArray(value.domains)) deliver(value);}
      catch {startFallback();}
    });
    source.addEventListener('task', (event: MessageEvent) => {
      try {void Promise.resolve(options.onTask?.(JSON.parse(event.data))).catch(refresh);} catch {startFallback();}
    });
    source.onopen = stopFallback;
    source.onerror = startFallback;
  } catch {startFallback();}
  const visibility = () => {if (document.visibilityState === 'visible') refresh();};
  if (options.onVisibility !== false && typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
  return () => {closed = true;if(retry)clearTimeout(retry); source?.close(); stopFallback(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);};
}
/** Reuse immutable JSON subtrees when only task state or selection changed. */
export function reuseJsonFields<T>(previous: T | null | undefined, next: T): T {
  if (!previous || typeof previous !== 'object' || !next || typeof next !== 'object') return next;
  const result = {...next};
  for (const key of Object.keys(result) as Array<keyof T>) {
    if (Object.is(previous[key],next[key]) || JSON.stringify(previous[key]) === JSON.stringify(next[key])) result[key]=previous[key];
  }
  return result;
}
