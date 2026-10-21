import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia,renderStill,selectComposition} from '@remotion/renderer';
import {creativeRuntimeAliases,resolveCreativeDependencies,creativeRenderOptions} from '../../workbench-local/creative-runtime-dependencies';
import {remotionRuntime} from '../../workbench-local/runtime-paths';

const root=process.cwd(),out=path.resolve(root,process.argv[2]??'projects/creative-proof-20261021');
await mkdir(out,{recursive:true});
const dependencies=await resolveCreativeDependencies({three:'0.186.1'},root),runtime={...remotionRuntime(root),...creativeRenderOptions([dependencies.declared])},aliases=await creativeRuntimeAliases(root);
const serveUrl=await bundle({entryPoint:path.resolve(root,'examples/continuous-scene/entry.tsx'),outDir:path.join(out,'bundle'),webpackOverride:config=>({...config,resolve:{...config.resolve,alias:{...config.resolve?.alias,...Object.fromEntries(Object.entries(aliases).map(([name,entry])=>[name+'$',entry]))}}})});
const composition=await selectComposition({serveUrl,id:'ContinuousScene',...runtime});
for(const frame of [30,145,260,390,510])await renderStill({serveUrl,composition,frame,output:path.join(out,`frame-${frame}.png`),...runtime});
await renderMedia({serveUrl,composition,codec:'h264',outputLocation:path.join(out,'continuous-scene.mp4'),concurrency:2,muted:true,scale:2/3,...runtime});
// A real alternate parameter render checks that content edits reach the same implementation.
const changedProps={parameters:{seconds:30,frameRate:30,accent:'#B74F32',takeaway:'把工作，留给更合适的链路。'},beats:[]};
const changedComposition=await selectComposition({serveUrl,id:'ContinuousScene',inputProps:changedProps,...runtime});
await renderStill({serveUrl,composition:changedComposition,inputProps:changedProps,frame:145,output:path.join(out,'changed-content.png'),...runtime});
await writeFile(path.join(out,'receipt.json'),JSON.stringify({kind:'original-silent-technical-demo',frames:540,fps:30,dependencies:dependencies.declared,dependencyFingerprint:dependencies.fingerprint,output:'continuous-scene.mp4',userAccepted:false},null,2));
console.log(out);
