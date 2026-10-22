import {describe,it,expect,vi,afterEach} from 'vitest';
import {createRefreshQueue,createSelectionPublisher,subscribeEditorChanges,reuseJsonFields} from './editor-sync';
import {createPreviewModuleCache} from './preview-modules';

const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(done=>{resolve=done;});return {promise,resolve};};
afterEach(()=>vi.useRealTimers());

describe('editor synchronization',()=>{
  it('keeps only the latest pending selection while a slow write is running',async()=>{
    const gate=deferred(),sent:number[]=[];
    const publish=createSelectionPublisher(async(value:number)=>{sent.push(value);if(value===1)await gate.promise;},error=>{throw error;});
    publish.publish(1);publish.publish(2);publish.publish(3);publish.publish(4);
    expect(sent).toEqual([1]);gate.resolve(null);await vi.waitFor(()=>expect(sent).toEqual([1,4]));
    publish.publish(4);await Promise.resolve();expect(sent).toEqual([1,4]);publish.stop();
  });
  it('retries a failed selection and does not send pending writes after disposal',async()=>{
    const error=vi.fn(),send=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(null);
    const publish=createSelectionPublisher(send,error);publish.publish(1);await vi.waitFor(()=>expect(error).toHaveBeenCalledTimes(1));
    publish.publish(1);await vi.waitFor(()=>expect(send).toHaveBeenCalledTimes(2));publish.stop();publish.publish(2);expect(send).toHaveBeenCalledTimes(2);
  });
  it('coalesces concurrent reads but performs one more snapshot when invalidated mid-read',async()=>{
    const first=deferred(),read=vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('latest');
    const refresh=createRefreshQueue(read),pending=refresh.request();refresh.request();refresh.request();expect(read).toHaveBeenCalledTimes(1);
    first.resolve('old');expect(await pending).toBe('latest');expect(read).toHaveBeenCalledTimes(2);
  });
  it('does not lose an invalidation when the older in-flight request fails',async()=>{
    let reject!:(error:Error)=>void;
    const first=new Promise((_resolve,failed)=>{reject=failed;});
    const read=vi.fn().mockReturnValueOnce(first).mockResolvedValue('new');
    const refresh=createRefreshQueue(read),pending=refresh.request();refresh.request();reject(Error('old request failed'));
    expect(await pending).toBe('new');expect(read).toHaveBeenCalledTimes(2);
  });
  it('retains Player and timeline subtrees for progress-only context changes',()=>{
    const previous={plan:{revision:2},cut:{revision:4},props:{scenePrograms:[{id:'s',from:0}]},job:{progress:0}};
    const next=reuseJsonFields(previous,structuredClone({...previous,job:{progress:.8}}));
    expect(next.plan).toBe(previous.plan);expect(next.cut).toBe(previous.cut);expect(next.props).toBe(previous.props);expect(next.job.progress).toBe(.8);
  });
  it('uses events while connected, bounded polling while disconnected, and a new snapshot after reconnect',()=>{
    vi.useFakeTimers();
    const listeners=new Map<string,(value:any)=>void>();
    const source={addEventListener:(type:string,listener:any)=>listeners.set(type,listener),close:vi.fn(),onopen:null as any,onerror:null as any};
    const change=vi.fn(),task=vi.fn();
    const stop=subscribeEditorChanges({onChange:change,onTask:task,makeSource:()=>source as unknown as EventSource,onVisibility:false,fallbackMs:5000});
    source.onopen();listeners.get('snapshot')!({});vi.advanceTimersByTime(20000);expect(change).toHaveBeenCalledTimes(1);
    listeners.get('task')!({data:JSON.stringify({job:{progress:.4}})});expect(task).toHaveBeenCalledTimes(1);expect(change).toHaveBeenCalledTimes(1);
    source.onerror();vi.advanceTimersByTime(10000);expect(change).toHaveBeenCalledTimes(4);
    source.onopen();listeners.get('snapshot')!({});vi.advanceTimersByTime(10000);expect(change).toHaveBeenCalledTimes(5);
    stop();expect(source.close).toHaveBeenCalledTimes(1);vi.advanceTimersByTime(10000);expect(change).toHaveBeenCalledTimes(5);
  });
  it('recovers a failed snapshot without needing the healthy event stream to reconnect',async()=>{
    vi.useFakeTimers();const listeners=new Map<string,(value:any)=>void>();
    const source={addEventListener:(type:string,listener:any)=>listeners.set(type,listener),close:vi.fn(),onopen:null as any,onerror:null as any};
    const change=vi.fn().mockRejectedValueOnce(Error('temporary 503')).mockResolvedValue(null);
    const stop=subscribeEditorChanges({onChange:change,makeSource:()=>source as unknown as EventSource,onVisibility:false});
    source.onopen();listeners.get('snapshot')!({});await vi.advanceTimersByTimeAsync(1000);expect(change).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20000);expect(change).toHaveBeenCalledTimes(2);stop();
  });
});

describe('preview module reuse',()=>{
  it('shares neighbor preload and active loading, but separates code versions',async()=>{
    const renderer=()=>null,importer=vi.fn().mockResolvedValue({Scene:renderer});
    const load=createPreviewModuleCache(importer),module={moduleUrl:'/scene.tsx',sourceHash:'one',exportName:'Scene'};
    const a=load(module),b=load({...module});expect(a).toBe(b);expect((await a).component).toBe(renderer);expect(importer).toHaveBeenCalledTimes(1);
    await load({...module,sourceHash:'two'});expect(importer).toHaveBeenCalledTimes(2);
  });
  it('does not permanently cache failed modules or missing exports',async()=>{
    const importer=vi.fn().mockRejectedValueOnce(Error('network')).mockResolvedValueOnce({}).mockResolvedValue({Scene:()=>null});
    const load=createPreviewModuleCache(importer),module={moduleUrl:'/scene.tsx',sourceHash:'one',exportName:'Scene'};
    await expect(load(module)).rejects.toThrow('network');await expect(load(module)).rejects.toThrow('入口');await expect(load(module)).resolves.toHaveProperty('component');
  });
});
