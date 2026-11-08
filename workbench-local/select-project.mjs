#!/usr/bin/env node
import {mkdir, readdir, writeFile, rename, unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {initializeProductionAuthoring} from './production-policy.mjs';
import {inspectService, withProjectSelectionLock} from './launcher.mjs';
import {canonicalPath, selectionFile, contentProjectIdentity, assertProjectPath, assertProjectStorage} from './project-location.mjs';

export async function selectProject({root, path, contentId, name, env=process.env, inspect = inspectService}) {
  root = canonicalPath(root);
  const directory = assertProjectPath(root, path);
  if (env.WORKBENCH_PROJECT_DIR && assertProjectPath(root,env.WORKBENCH_PROJECT_DIR) !== directory)
    throw Error('WORKBENCH_PROJECT_DIR 正在覆盖另一个工程，请先清除环境覆盖再选择');
  return withProjectSelectionLock({root,projectDir:directory,env}, async()=>{
  if ((await inspect({root,projectDir:directory,env})).kind !== 'free') throw Error('请先保存并停止 4340 工作台，再选择工程；不会自动停止或覆盖当前工程');
  if (contentId !== undefined && !/^C\d{8}-\d{3}$/.test(contentId)) throw Error('内容编号必须为 CYYYYMMDD-NNN');
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 200)) throw Error('工程名称须为 1–200 个字符');
  const entries = await readdir(directory).catch(error => {if(error.code === 'ENOENT') return []; throw error;});
  let identity = contentProjectIdentity(directory);
  if (entries.length === 0) {
    if (!contentId || !name) throw Error('创建空工程需要 --content-id 和 --name');
    await mkdir(directory, {recursive:true});
    await writeFile(resolve(directory,'content-project.json'),JSON.stringify({version:1,contentId,name},null,2)+'\n',{flag:'wx'});
    identity = {contentId,name};
    await initializeProductionAuthoring(root,directory);
  } else if (identity) {
    assertProjectStorage(directory);
    if (contentId && contentId !== identity.contentId) throw Error('已有工程属于另一个内容编号，未改写');
    if (name && name !== identity.name) throw Error('已有工程名称不同，请保留原身份，不通过选择命令改名');
  } else {
    if (contentId || name) throw Error('不能给非空旧目录写入新的内容身份；请新建独立目录');
    if (!['project.json','cut/roughcut.json','production/production.json'].some(file=>existsSync(resolve(directory,file))))
      throw Error('所选目录不是已知视频工程，也不是可新建的空目录');
  }
  if ((await inspect({root,projectDir:directory,env})).kind !== 'free') throw Error('选择期间工作台已启动，未切换活动目录；请停止后重试');
  const config = selectionFile(root), temporary = config + '.' + randomUUID() + '.tmp';
  await mkdir(dirname(config),{recursive:true});
  try {
    await writeFile(temporary,JSON.stringify({version:1,projectDir:directory},null,2)+'\n',{flag:'wx'});
    await rename(temporary,config);
  } finally {await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  return {projectDir:directory, contentId:identity?.contentId??null, name:identity?.name??null, started:false, imported:false};
  });
}

export function parseSelectionArgs(args) {
  const result = {};
  for(let i=0;i<args.length;i++) {
    const key = {'--path':'path','--content-id':'contentId','--name':'name'}[args[i]];
    if(!key || !args[i+1] || args[i+1].startsWith('--') || key in result) throw Error('用法：--path /绝对工程目录 [--content-id CYYYYMMDD-NNN --name 选题名称]');
    result[key]=args[++i];
  }
  return result;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  selectProject({root:resolve(dirname(fileURLToPath(import.meta.url)),'..'),...parseSelectionArgs(process.argv.slice(2))})
    .then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
