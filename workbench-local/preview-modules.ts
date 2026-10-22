type ModuleEntry = {moduleUrl: string; sourceHash: string; exportName: string};
type Renderer = import('react').ComponentType<any>;

/** Shared by selection and idle preloading. Failed imports remain retryable. */
export function createPreviewModuleCache(importModule: (url: string) => Promise<any>) {
  const entries = new Map<string, Promise<{component: Renderer; key: string}>>();
  const attempts = new Map<string,number>();
  return (candidate: ModuleEntry, label = '场景') => {
    if (!candidate?.moduleUrl || !candidate?.sourceHash || !candidate?.exportName) return Promise.reject(Error(`${label}缺少模块入口`));
    const key = candidate.moduleUrl + ':' + candidate.sourceHash, identity = key + ':' + candidate.exportName;
    let result = entries.get(identity);
    if (!result) {
      const attempt=attempts.get(identity)??0;
      result = importModule(`${candidate.moduleUrl}?version=${encodeURIComponent(candidate.sourceHash)}${attempt?'&retry='+attempt:''}`).then(loaded => {
        if (typeof loaded[candidate.exportName] !== 'function') throw Error(`${label}没有可渲染入口`);
        return {component: loaded[candidate.exportName] as Renderer, key};
      }).catch(error => {
        if (entries.get(identity) === result) entries.delete(identity);
        attempts.set(identity,attempt+1);if(attempts.size>80)attempts.delete(attempts.keys().next().value!);
        throw Error(`${label}加载失败：${error instanceof Error ? error.message : String(error)}`);
      });
      entries.set(identity, result);
      if (entries.size > 40) entries.delete(entries.keys().next().value!);
    }
    return result;
  };
}

export const loadPreviewModule = createPreviewModuleCache(url => import(/* @vite-ignore */ url));
