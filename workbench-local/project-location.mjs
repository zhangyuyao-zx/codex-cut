import {existsSync, readFileSync, readdirSync, realpathSync} from 'node:fs';
import {basename, dirname, resolve, join, isAbsolute, sep} from 'node:path';

export function canonicalPath(value) {
  const path = resolve(value);
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : join(canonicalPath(parent), basename(path));
}

export function selectionFile(root) {
  return resolve(root, 'projects/active-project.json');
}

export function projectDirectory(root, env = process.env) {
  if (env.WORKBENCH_PROJECT_DIR) return assertProjectPath(root, env.WORKBENCH_PROJECT_DIR);
  const file = selectionFile(root);
  if (!existsSync(file)) return assertProjectPath(root, resolve(root, 'projects/local-workbench'));
  const selection = JSON.parse(readFileSync(file, 'utf8'));
  if (selection.version !== 1 || typeof selection.projectDir !== 'string' || !selection.projectDir.startsWith('/'))
    throw Error('活动工程配置无效，请重新选择明确的独立工程目录');
  return assertProjectPath(root, selection.projectDir);
}

export function assertProjectPath(root, directory) {
  if (!isAbsolute(directory || '')) throw Error('工程目录必须是绝对路径');
  root = canonicalPath(root);
  const path = canonicalPath(directory);
  if (path === root || root.startsWith(path.endsWith(sep) ? path : path + sep)) throw Error('工程目录不能是源码目录或其上层目录');
  return path;
}

// Check before creating media or stores, including direct environment launches.
export function assertProjectStorage(directory) {
  const identity = contentProjectIdentity(directory);
  if (existsSync(directory) && readdirSync(directory).length && !identity &&
      !['project.json','cut/roughcut.json','production/production.json'].some(file=>existsSync(resolve(directory,file))))
    throw Error('所选目录不是已知视频工程，也不是可新建的空目录');
  if (identity && existsSync(resolve(directory,'project.json'))) {
    const store = JSON.parse(readFileSync(resolve(directory,'project.json'),'utf8'));
    if (store.current?.id !== identity.contentId) throw Error('内容编号与已有视频工程身份不一致，未改写工程');
  }
  return identity;
}

export function contentProjectIdentity(directory) {
  const file = resolve(directory, 'content-project.json');
  if (!existsSync(file)) return null;
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (value.version !== 1 || typeof value.contentId !== 'string' || !/^C\d{8}-\d{3}$/.test(value.contentId) ||
      typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200)
    throw Error('内容工程身份无效，请核对 content-project.json，不覆盖旧工程');
  return {contentId:value.contentId, name:value.name};
}
