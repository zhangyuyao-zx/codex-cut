import {realpathSync, statSync} from 'node:fs';
import path from 'node:path';

/** Request-local observations, including missing resolution candidates. ctime
 * and inode detect replacement even when size and mtime have been restored.
 * No contents or parser results are trusted on mtime alone. */
function identity(file: string): string {
  try {
    const actual = realpathSync(file), info = statSync(file, {bigint: true});
    return JSON.stringify([actual, ...[info.dev, info.ino, info.mode, info.size,
      info.mtimeNs, info.ctimeNs].map(String)]);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing';
    throw error;
  }
}

export function observeNativeSceneFiles() {
  const observations = new Map<string, string>();
  return {
    observe(file: string) {
      const absolute = path.resolve(file);
      if (!observations.has(absolute)) observations.set(absolute, identity(absolute));
    },
    unchanged() {
      try { return [...observations].every(([file, previous]) => identity(file) === previous); }
      catch { return false; }
    },
    paths() { return [...observations.keys()]; },
  };
}
