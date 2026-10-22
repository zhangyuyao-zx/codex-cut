import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,rename,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createEditorEvents,type EditorEvent} from './editor-events';

describe('service editor events',()=>{
  it('notifies the observed domain after atomic replacement, ignores selection writes, and closes cleanly',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'editor-events-')),events=createEditorEvents();
    const seen:EditorEvent[]=[];
    const wait=()=>new Promise<EditorEvent>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('event timeout')),2500);const stop=events.subscribe(event=>{if(event.type!=='change')return;clearTimeout(timer);stop();resolve(event);});});
    try{
      const file=path.join(dir,'roughcut.json');await writeFile(file,'old');events.observe(file,'cut');
      events.subscribe(event=>seen.push(event));
      const changed=wait();await writeFile(file+'.tmp','new');await rename(file+'.tmp',file);expect(await changed).toMatchObject({type:'change',domains:['cut']});
      const before=events.sequence;await writeFile(path.join(dir,'editor-selection.json'),'selection');
      // A second real cut event flushes any pending observer work. Selection
      // must not have advanced the sequence between the two cut mutations.
      expect(events.sequence).toBe(before);
      const again=wait();await writeFile(file,'latest');await again;expect(seen.filter(event=>event.type==='change')).toHaveLength(2);
      events.close();const final=events.sequence;await writeFile(file,'closed');expect(events.sequence).toBe(final);
    }finally{events.close();await rm(dir,{recursive:true,force:true});}
  });
  it('detects missing dependency recovery and re-arms after directory replacement',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'editor-events-dir-')),events=createEditorEvents();
    const wait=()=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('event timeout')),2500);const stop=events.subscribe(event=>{if(event.type==='change'){clearTimeout(timer);stop();resolve();}});});
    try{
      const target=path.join(dir,'parts');await mkdir(target);const file=path.join(target,'missing.ts');events.observe(file);
      const recovered=wait();await writeFile(file,'export const x=1');await recovered;
      const replaced=wait();await rename(target,target+'-old');await mkdir(target);await writeFile(file,'export const x=2');await replaced;
      events.observe(file);const after=wait();await writeFile(file,'export const x=3');await after;
    }finally{events.close();await rm(dir,{recursive:true,force:true});}
  });
  it('separates progress from content identity and snapshots mutable task values',()=>{
    const events=createEditorEvents(),seen:EditorEvent[]=[];events.subscribe(event=>seen.push(event));
    const task={id:'one',progress:.1};events.task(task,null);task.progress=.9;
    expect(events.sequence).toBe(0);expect(seen).toMatchObject([{type:'task',job:{id:'one',progress:.1},sample:null}]);events.close();
  });
});
