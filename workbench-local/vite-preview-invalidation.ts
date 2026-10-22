import type {ViteDevServer,ModuleNode} from 'vite';
import path from 'node:path';

/** Use Vite's existing graph, without sending a full-page reload that drops drafts. */
export function createPreviewInvalidator(vite:ViteDevServer,root:string) {
  let timestamp=0;
  return (file:string)=>{
    const actual=path.resolve(file);
    if(!actual.startsWith(root+path.sep)||actual.includes(path.sep+'node_modules'+path.sep))return;
    const graph=vite.moduleGraph,modules=new Set(graph.getModulesByFile(actual)??[]);
    // A newly created .tsx may supersede a .ts resolution. The observed
    // missing candidate has no graph node yet; invalidate the former sibling.
    const stem=(name:string)=>name.replace(/\.[cm]?[jt]sx?$/,'');
    if(!modules.size&&/\.[cm]?[jt]sx?$/.test(actual))for(const [name,values] of graph.fileToModulesMap)
      if(stem(name)===stem(actual))for(const value of values)modules.add(value);
    const seen=new Set<ModuleNode>();timestamp=Math.max(Date.now(),timestamp+1);
    for(const module of modules)graph.invalidateModule(module,seen,timestamp,true);
  };
}
