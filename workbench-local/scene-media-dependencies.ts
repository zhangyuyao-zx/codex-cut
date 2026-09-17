import {createHash} from 'node:crypto';
import path from 'node:path';
import {
  buildCutInputIdentity,
  type ContentDigest,
  type CutIdentityState,
} from './cut-media-identity';
import {describeCutWindowDependencies} from './cut-window-dependencies';

const IDENTITY_CONTRACT_VERSION = 1 as const;

export type SceneCutIdentityScope = 'window' | 'full-cut';

export type SceneCutIdentity = Readonly<{
  scope: SceneCutIdentityScope;
  hash: string;
}>;

function fail(message: string): never {
  throw new Error(`无法建立场景粗剪身份：${message}`);
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateDirectory(directory: string): void {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
    fail('媒体目录必须是绝对路径');
  }
}

function validateScope(scope: string): asserts scope is SceneCutIdentityScope {
  if (scope !== 'window' && scope !== 'full-cut') fail('requestedScope 无效');
}

/**
 * Build the media identity used by a scene key. Only a proven timeline window
 * gets a window-scoped identity; legacy and explicitly full-cut requests remain
 * whole-cut identities even when a window was supplied.
 */
export async function buildSceneCutIdentity(
  state: CutIdentityState,
  window: {from: number; end: number},
  directory: string,
  digest: ContentDigest,
  requestedScope: SceneCutIdentityScope,
): Promise<SceneCutIdentity> {
  validateScope(requestedScope);
  validateDirectory(directory);
  if (typeof digest !== 'function') fail('必须传入文件内容 digest 函数');

  // This validates the integer half-open window and rejects any incomplete
  // coverage before either identity branch is allowed to proceed.
  const windowDependencies = describeCutWindowDependencies(state, window);

  if (requestedScope === 'window' && windowDependencies.kind === 'timeline') {
    const fileNames: string[] = [];
    const seen = new Set<string>();
    for (const segment of windowDependencies.segments) {
      if (!seen.has(segment.proxyFileName)) {
        seen.add(segment.proxyFileName);
        fileNames.push(segment.proxyFileName);
      }
    }
    const files: Array<{fileName: string; sha256: string}> = [];
    for (const fileName of fileNames) {
      files.push({
        fileName,
        sha256: await digest(path.join(directory, fileName)),
      });
    }
    return {
      scope: 'window',
      hash: hashJson({
        contractVersion: IDENTITY_CONTRACT_VERSION,
        scope: 'window',
        window: {from: window.from, end: window.end},
        dependencies: windowDependencies.segments,
        files,
      }),
    };
  }

  const wholeCut = await buildCutInputIdentity(state, directory, digest);
  return {
    scope: 'full-cut',
    hash: hashJson({
      contractVersion: IDENTITY_CONTRACT_VERSION,
      scope: 'full-cut',
      window: {from: window.from, end: window.end},
      inputHash: wholeCut.inputHash,
    }),
  };
}
