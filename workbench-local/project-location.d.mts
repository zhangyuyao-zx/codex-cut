export function canonicalPath(value: string): string;
export function selectionFile(root: string): string;
export function projectDirectory(root: string, env?: NodeJS.ProcessEnv): string;
export function assertProjectPath(root: string, directory: string): string;
export function assertProjectStorage(directory: string): {contentId: string; name: string} | null;
export function contentProjectIdentity(directory: string): {contentId: string; name: string} | null;
