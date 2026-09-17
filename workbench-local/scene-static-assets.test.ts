import {it, expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {staticAssetCalls,resolveStaticAsset} from './scene-static-assets';

it('recognizes Remotion aliases and namespace calls without treating similarly named local functions as assets',()=>{
  const source="import {staticFile as asset} from 'remotion'; import * as R from 'remotion'; const a=asset('one.png'), b=R.staticFile(`two.svg`), c=asset(props.mediaSrc); function staticFile(x){return x}; staticFile('not-a-media-call'); asset();";
  expect(staticAssetCalls(source,'scene.tsx').map(x=>x.asset)).toEqual(['one.png','two.svg',null,null]);
});

it('rejects static assets that escape public, including symlinks',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'scene-static-assets-'));
  try {
    await mkdir(path.join(root,'public'));await writeFile(path.join(root,'private.png'),'private');
    await writeFile(path.join(root,'public','logo.png'),'logo');
    await symlink(path.join(root,'private.png'),path.join(root,'public','link.png'));
    await expect(resolveStaticAsset(root,'logo.png')).resolves.toMatch(/logo\.png$/);
    await expect(resolveStaticAsset(root,'../private.png')).rejects.toThrow('越过');
    await expect(resolveStaticAsset(root,'link.png')).rejects.toThrow('越过');
    await expect(resolveStaticAsset(root,'https://example.com/logo.png')).rejects.toThrow('无效');
  } finally {await rm(root,{recursive:true,force:true});}
});
