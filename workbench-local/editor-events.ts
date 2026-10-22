import {watch, statSync, realpathSync, type FSWatcher} from 'node:fs';
import {dirname, basename, resolve} from 'node:path';

export type EditorDomain = 'production' | 'cut' | 'source' | 'assets';
export type EditorEvent = {type: 'change'; sequence: number; domains: EditorDomain[]} | {type: 'task'; job: any; sample: any};

/** One service-owned subscription. No project parsing, hashes or media reads on idle. */
export function createEditorEvents(onFileChange?:(file:string)=>void) {
  const listeners = new Set<(event: EditorEvent) => void>();
  const directories = new Map<string, {watcher: FSWatcher; identity: string; targets: Map<string, Set<EditorDomain>>}>();
  const files = new Map<string,{identity:string;domains:Set<EditorDomain>}>();
  const pending = new Set<EditorDomain>();
  let sequence = 0, closed = false, nativeDisabled=false, timer: ReturnType<typeof setTimeout> | undefined, poll:ReturnType<typeof setInterval>|undefined;
  const identity=(file:string)=>{
    try{const info=statSync(file,{bigint:true});return [realpathSync(file),info.dev,info.ino,info.size,info.mtimeNs,info.ctimeNs].map(String).join(':');}
    catch(error){return 'unavailable:'+(error as NodeJS.ErrnoException).code;}
  };
  const emit = (event: EditorEvent) => {for (const listener of listeners) listener(event);};
  const changed = (domain: EditorDomain) => {
    if (closed) return;
    sequence++;
    pending.add(domain);
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      const domains = [...pending]; pending.clear();
      emit({type: 'change', sequence, domains});
    }, 60);
    timer.unref();
  };
  function fallback() {
    if(closed||nativeDisabled)return;
    nativeDisabled=true;
    for(const item of directories.values())item.watcher.close();directories.clear();
    // One metadata-only scan for the service, independent of open tabs. This
    // also works when OS watcher limits are exhausted (EMFILE/ENOSPC).
    poll=setInterval(()=>{
      for(const [file,record] of files){const current=identity(file);if(current!==record.identity){record.identity=current;onFileChange?.(file);for(const domain of record.domains)changed(domain);}}
    },1000);poll.unref();
  }
  function observe(input: string, domain: EditorDomain = 'source') {
    if (closed) return;
    const file = resolve(input);
    const record=files.get(file)??{identity:identity(file),domains:new Set<EditorDomain>()};
    record.domains.add(domain);files.set(file,record);
    if(nativeDisabled)return;
    // Observe the parent too: atomic rename and directory/symlink replacement
    // must keep working after the original inode disappears.
    let directory = dirname(file);
    try {if (statSync(file).isDirectory()) add(file, '*', domain);} catch { /* A missing resolution candidate is still observed at its parent. */ }
    while (true) {
      try {if (statSync(directory).isDirectory()) break;} catch {}
      const parent = dirname(directory); if (parent === directory) return; directory = parent;
    }
    const target = directory === dirname(file) ? basename(file) : '*';
    add(directory, target, domain);
    if(dirname(directory)!==directory)add(dirname(directory),basename(directory),domain);
  }
  function add(directory: string, target: string, domain: EditorDomain) {
    if(nativeDisabled||closed)return;
    let item = directories.get(directory);
    let identity: string;
    try {const info = statSync(directory, {bigint: true}); identity = `${info.dev}:${info.ino}`;} catch {return;}
    const priorTargets = item?.targets;
    if (item && item.identity !== identity) {item.watcher.close(); directories.delete(directory); item = undefined;}
    if (!item) {
      try {
        const targets = priorTargets ?? new Map<string, Set<EditorDomain>>();
        const watcher = watch(directory, {persistent: false}, (_event, name) => {
          const affected = name === null ? [...targets.values()] : [targets.get('*'), targets.get(String(name))];
          if(affected.some(value=>value?.size))onFileChange?.(name===null?directory:resolve(directory,String(name)));
          for (const domains of affected) for (const current of domains ?? []) changed(current);
        });
        item = {watcher, identity, targets}; directories.set(directory, item);
        watcher.on('error', () => {
          watcher.close();fallback();
        });
      } catch {fallback();return;}
    }
    const domains = item.targets.get(target) ?? new Set<EditorDomain>();
    domains.add(domain); item.targets.set(target, domains);
  }
  return {
    observe, changed,
    get sequence() {return sequence;},
    subscribe(listener: (event: EditorEvent) => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    task(job: any, sample: any) {if (!closed) emit({type: 'task', job: job ? {...job} : null, sample: sample ? {...sample} : null});},
    close() {closed = true; if (timer) clearTimeout(timer);if(poll)clearInterval(poll); for (const {watcher} of directories.values()) watcher.close(); directories.clear();files.clear(); listeners.clear();},
  };
}
