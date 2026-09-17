import {mkdtemp, mkdir, readFile, realpath, rm, unlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {createContentDigester} from './cut-media-identity';
import {rendererSourceIdentity} from './renderer-source-identity';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-renderer-source-identity-'));
  temporaryRoots.push(root);
  return root;
}

async function writeFixture(root: string): Promise<{
  entry: string;
  helper: string;
  nested: string;
  asset: string;
  unrelated: string;
}> {
  const sourceDirectory = path.join(root, 'src', 'shared');
  const publicDirectory = path.join(root, 'public');
  await mkdir(sourceDirectory, {recursive: true});
  await mkdir(publicDirectory, {recursive: true});
  const entry = path.join(root, 'src', 'entry.tsx');
  const helper = path.join(sourceDirectory, 'helper.ts');
  const nested = path.join(sourceDirectory, 'nested.ts');
  const asset = path.join(publicDirectory, 'icon.bin');
  const unrelated = path.join(root, 'unrelated.txt');
  await writeFile(entry, [
    "import {staticFile} from 'remotion';",
    "import {helper} from './shared/helper';",
    'export const value = `${helper}:${staticFile(\'icon.bin\')}`;',
  ].join('\n'));
  await writeFile(helper, "import {nested} from './nested';\nexport const helper = `helper-${nested}`;\n");
  await writeFile(nested, 'export const nested = "v1";\n');
  await writeFile(asset, Buffer.from('asset-v1'));
  await writeFile(unrelated, 'unrelated-v1');
  return {entry, helper, nested, asset, unrelated};
}

async function identity(root: string, entry: string = path.join(root, 'src', 'entry.tsx')): Promise<string> {
  return rendererSourceIdentity(root, entry, createContentDigester());
}

describe('renderer source identity', () => {
  it('is stable across different roots with the same relative source tree', async () => {
    const firstRoot = await temporaryRoot();
    const secondRoot = await temporaryRoot();
    const first = await writeFixture(firstRoot);
    await writeFixture(secondRoot);

    await expect(identity(firstRoot, first.entry)).resolves.toBe(await identity(secondRoot));
  });

  it('changes for direct, transitive, and static asset bytes but ignores unrelated files', async () => {
    const root = await temporaryRoot();
    const files = await writeFixture(root);
    const baseline = await identity(root, files.entry);

    await writeFile(files.helper, "import {nested} from './nested';\nexport const helper = `changed-${nested}`;\n");
    await expect(identity(root, files.entry)).resolves.not.toBe(baseline);

    await writeFile(files.helper, "import {nested} from './nested';\nexport const helper = `helper-${nested}`;\n");
    await writeFile(files.nested, 'export const nested = "v2";\n');
    await expect(identity(root, files.entry)).resolves.not.toBe(baseline);

    await writeFile(files.nested, 'export const nested = "v1";\n');
    await writeFile(files.asset, Buffer.from('asset-v2'));
    await expect(identity(root, files.entry)).resolves.not.toBe(baseline);

    await writeFile(files.asset, Buffer.from('asset-v1'));
    await writeFile(files.unrelated, 'unrelated-v2');
    await expect(identity(root, files.entry)).resolves.toBe(baseline);
  });

  it('changes when entry bytes change at the same path and includes the parsed asset path', async () => {
    const root = await temporaryRoot();
    const files = await writeFixture(root);
    const actualDigest = createContentDigester();
    const seen: string[] = [];
    const realRoot = await realpath(root);
    const recordingDigest = async (absoluteFile: string): Promise<string> => {
      seen.push(path.relative(realRoot, absoluteFile).split(path.sep).join('/'));
      return actualDigest(absoluteFile);
    };
    const baseline = await rendererSourceIdentity(root, files.entry, recordingDigest);
    expect(seen).toContain('src/entry.tsx');
    expect(seen).toContain('src/shared/helper.ts');
    expect(seen).toContain('src/shared/nested.ts');
    expect(seen).toContain('public/icon.bin');

    await writeFile(files.entry, `${await readFile(files.entry, 'utf8')}\n// same path, changed bytes\n`);
    await expect(rendererSourceIdentity(root, files.entry, createContentDigester())).resolves.not.toBe(baseline);
  });

  it('rejects missing local dependencies, missing static assets, and dependencies outside root', async () => {
    const root = await temporaryRoot();
    const files = await writeFixture(root);
    await writeFile(files.entry, [
      "import {missing} from './shared/missing';",
      'export const value = missing;',
    ].join('\n'));
    await expect(identity(root, files.entry)).rejects.toThrow(/依赖不存在/u);

    await writeFixture(root);
    await unlink(files.asset);
    await expect(identity(root, files.entry)).rejects.toThrow();

    const outsideDirectory = await mkdtemp(path.join(tmpdir(), 'codex-renderer-source-outside-'));
    temporaryRoots.push(outsideDirectory);
    const outsideFile = path.join(outsideDirectory, 'outside.ts');
    await writeFile(outsideFile, 'export const outside = "outside";\n');
    const importPath = path.relative(path.dirname(files.entry), outsideFile).split(path.sep).join('/');
    await writeFile(files.entry, `import {outside} from ${JSON.stringify(importPath)};\nexport const value = outside;\n`);
    await expect(identity(root, files.entry)).rejects.toThrow(/越过工程目录/u);
  });

  it('rejects source mutations during graph parsing and dependency hashing', async () => {
    const entryRoot = await temporaryRoot();
    const entryFiles = await writeFixture(entryRoot);
    const entryRealPath = await realpath(entryFiles.entry);
    const entryDigest = createContentDigester();
    let entryMutationPending = true;
    const mutatingEntryDigest = async (absoluteFile: string): Promise<string> => {
      const sha256 = await entryDigest(absoluteFile);
      if (entryMutationPending && absoluteFile === entryRealPath) {
        entryMutationPending = false;
        await writeFile(entryFiles.entry, `${await readFile(entryFiles.entry, 'utf8')}\n// changed during identity\n`);
      }
      return sha256;
    };
    await expect(rendererSourceIdentity(entryRoot, entryFiles.entry, mutatingEntryDigest))
      .rejects.toThrow(/发生变化|重试/u);

    const dependencyRoot = await temporaryRoot();
    const dependencyFiles = await writeFixture(dependencyRoot);
    const helperRealPath = await realpath(dependencyFiles.helper);
    const dependencyDigest = createContentDigester();
    let helperMutationPending = true;
    const mutatingHelperDigest = async (absoluteFile: string): Promise<string> => {
      if (helperMutationPending && absoluteFile === helperRealPath) {
        helperMutationPending = false;
        await writeFile(dependencyFiles.helper, "import {nested} from './nested';\nexport const helper = `changed-during-identity-${nested}`;\n");
      }
      return dependencyDigest(absoluteFile);
    };
    await expect(rendererSourceIdentity(dependencyRoot, dependencyFiles.entry, mutatingHelperDigest))
      .rejects.toThrow(/发生变化|重试/u);
  });
});
