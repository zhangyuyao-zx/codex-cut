import ts from 'typescript';
import path from 'node:path';
import {realpath, stat} from 'node:fs/promises';

/** Find actual Remotion staticFile calls, including imported aliases. Never execute scene code. */
export function staticAssetCalls(source: string, fileName: string) {
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true,
    /\.[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const names = new Set<string>(), namespaces = new Set<string>();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'remotion') continue;
    const binding = statement.importClause?.namedBindings;
    if (binding && ts.isNamespaceImport(binding)) namespaces.add(binding.name.text);
    if (binding && ts.isNamedImports(binding)) for (const spec of binding.elements) {
      if ((spec.propertyName?.text ?? spec.name.text) === 'staticFile') names.add(spec.name.text);
    }
  }
  const calls: Array<{start: number; end: number; asset: string | null}> = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const e = node.expression;
      const matches = ts.isIdentifier(e) ? names.has(e.text) :
        ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && namespaces.has(e.expression.text) && e.name.text === 'staticFile';
      if (matches) {
        const arg = node.arguments[0];
        calls.push({start: arg?.getStart(ast) ?? node.getStart(ast), end: arg?.end ?? node.end,
          asset: node.arguments.length === 1 && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) ? arg.text : null});
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return calls;
}

export async function resolveStaticAsset(root: string, asset: string) {
  if (!asset || asset.includes('\\') || asset.includes('\0') || path.isAbsolute(asset) || /^[a-z]+:/i.test(asset)) throw Error(`静态素材路径无效：${asset}`);
  const base = await realpath(path.join(root, 'public'));
  const file = await realpath(path.resolve(base, asset));
  const relative = path.relative(base, file);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || !(await stat(file)).isFile()) throw Error(`静态素材越过 public 目录：${asset}`);
  return file;
}
