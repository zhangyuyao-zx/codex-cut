import {createHash} from 'node:crypto';
import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {localSourceDependencies} from './source-dependencies';
import type {ContentDigest} from './cut-media-identity';

const IDENTITY_CONTRACT_VERSION = 1 as const;

type IdentityFile = Readonly<{
  path: string;
  sha256: string;
}>;

function fail(message: string): never {
  throw new Error(`无法建立渲染源码身份：${message}`);
}

function relativePosix(root: string, file: string): string {
  const relative = path.relative(root, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`依赖路径越过工程目录：${file}`);
  }
  return relative.split(path.sep).join('/');
}

function sortFiles(files: readonly IdentityFile[]): IdentityFile[] {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * Build a stable identity for one renderer entry and the local files that its
 * static dependency parser actually reaches. Source modules are inspected as
 * data; no module is imported or executed here. Media and other non-source
 * assets are hashed through the injected streaming-capable digest function.
 */
export async function rendererSourceIdentity(
  root: string,
  entry: string,
  digest: ContentDigest,
): Promise<string> {
  if (typeof root !== 'string' || !path.isAbsolute(root)) {
    fail('工程根目录必须是绝对路径');
  }
  if (typeof entry !== 'string' || entry.length === 0) {
    fail('入口文件不能为空');
  }
  if (typeof digest !== 'function') fail('必须传入文件内容 digest 函数');

  const rootRealPath = await realpath(root);
  const entryPath = path.isAbsolute(entry) ? entry : path.resolve(rootRealPath, entry);
  const entryRealPath = await realpath(entryPath);
  const entryRelativePath = relativePosix(rootRealPath, entryRealPath);

  // Take the entry snapshot before parsing. The parser reads source bytes to
  // resolve the graph, so the final digest below can prove that the entry did
  // not change while the graph was being inspected.
  const entrySha256BeforeParse = await digest(entryRealPath);
  const dependencies = await localSourceDependencies(rootRealPath, entryRealPath);

  const entryFile: IdentityFile = {
    path: entryRelativePath,
    sha256: entrySha256BeforeParse,
  };
  const dependencyFiles = sortFiles(await Promise.all(dependencies.map(async (dependency) => {
    const dependencyPath = relativePosix(rootRealPath, dependency.filePath);
    const sha256 = await digest(dependency.filePath);
    if (dependency.bytes !== undefined) {
      const parsedBytesSha256 = createHash('sha256').update(dependency.bytes).digest('hex');
      if (parsedBytesSha256 !== sha256) {
        fail(`源码依赖在解析期间发生变化，需要重试：${dependencyPath}`);
      }
    }
    return {path: dependencyPath, sha256};
  })));
  const entrySha256AfterDependencies = await digest(entryRealPath);
  if (entrySha256AfterDependencies !== entrySha256BeforeParse) {
    fail('入口源码在解析期间发生变化，需要重试');
  }
  const document = {
    contractVersion: IDENTITY_CONTRACT_VERSION,
    entry: entryFile,
    dependencies: dependencyFiles,
  };
  return createHash('sha256').update(JSON.stringify(document)).digest('hex');
}
