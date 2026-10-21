import {createHash} from 'node:crypto';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {creativeDependencySchema,type CreativeDependencies} from './creative-runtime-dependency-contract';

// Maintainer-installed browser packages only. Asset input can never install code,
// select a filesystem path, or expand this registry to a server package/subpath.
const registry={
  '@remotion/three':{version:'4.0.489',peers:['@react-three/fiber','three']},
  '@react-three/fiber':{version:'9.8.2',peers:['three']},
  'three':{version:'0.186.1',peers:[]},
} as const;
export const creativeRuntimeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const implicitImports=new Set(['react','react/jsx-runtime','remotion']);

export function validateCreativeDependencies(input:unknown={}):CreativeDependencies {
  const dependencies=creativeDependencySchema.parse(input);
  for(const [name,version] of Object.entries(dependencies)) {
    const supported=registry[name as keyof typeof registry];
    if(!supported)throw Error(`不支持的浏览器动画依赖：${name}。请从资产库 runtimeDependencies 能力中选择；不能使用服务端包或任意路径`);
    if(version!==supported.version)throw Error(`动画依赖 ${name} 需要 ${supported.version}，收到 ${version}；请使用已安装的精确版本并保存新资产版本`);
  }
  return Object.fromEntries(Object.entries(dependencies).sort(([a],[b])=>a.localeCompare(b)));
}

async function installedDependency(root:string,name:keyof typeof registry) {
  const folder=await realpath(path.join(root,'node_modules',name)).catch(()=>{throw Error(`动画运行时缺少 ${name}@${registry[name].version}；请由工作台维护者从锁文件安装依赖后重试，保存资产不会自动安装`);});
  const manifest=JSON.parse(await readFile(path.join(folder,'package.json'),'utf8'));
  if(manifest.name!==name||manifest.version!==registry[name].version)
    throw Error(`动画运行时版本不匹配：${name} 需要 ${registry[name].version}，已安装 ${String(manifest.version)}；请由工作台维护者恢复锁定版本后重试`);
  // The pinned packages all publish a browser ESM entry via `module`.
  if(typeof manifest.module!=='string')throw Error(`动画依赖 ${name} 缺少浏览器 ESM 入口`);
  const entry=await realpath(path.resolve(folder,manifest.module)),relative=path.relative(folder,entry);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!(await stat(entry)).isFile())throw Error(`动画依赖 ${name} 的浏览器入口无效`);
  return {name,version:manifest.version as string,entry,manifestHash:createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),entryHash:createHash('sha256').update(await readFile(entry)).digest('hex')};
}

/** Resolution identity excludes local paths, so a snapshot can move between matching installs. */
export async function resolveCreativeDependencies(input:unknown={},root=creativeRuntimeRoot) {
  const declared=validateCreativeDependencies(input),names=new Set<keyof typeof registry>();
  const add=(name:keyof typeof registry)=>{if(names.has(name))return;names.add(name);for(const peer of registry[name].peers)add(peer);};
  for(const name of Object.keys(declared))add(name as keyof typeof registry);
  const resolved=await Promise.all([...names].sort().map(name=>installedDependency(root,name)));
  const fingerprint=resolved.length?createHash('sha256').update(JSON.stringify({version:1,renderBackend:'angle',declared,resolved:resolved.map(({entry,...record})=>record)})).digest('hex'):undefined;
  return {declared,resolved,fingerprint};
}

/** Remotion's default software GL cannot reliably render ThreeCanvas. Keep ordinary 2D unchanged. */
export function creativeRenderOptions(dependencies:readonly (CreativeDependencies|undefined)[]){
  return dependencies.some(value=>Object.keys(value??{}).some(name=>Object.hasOwn(registry,name)))?{chromiumOptions:{gl:'angle' as const}}:{};
}

/** Use these exact aliases for Vite preview and Remotion production bundles. */
export async function creativeRuntimeAliases(root=creativeRuntimeRoot):Promise<Record<string,string>> {
  // Optional creative packages cannot prevent old React/Remotion-only assets
  // from opening. Declared assets are checked separately before use.
  const resolved=await Promise.allSettled(Object.keys(registry).map(name=>installedDependency(root,name as keyof typeof registry)));
  return Object.fromEntries(resolved.flatMap(result=>result.status==='fulfilled'?[[result.value.name,result.value.entry]]:[]));
}

export async function creativeRuntimeCapabilities(root=creativeRuntimeRoot) {
  return {
    engine:'remotion',implicitImports:[...implicitImports],declaration:'dependencies: {packageName: exactVersion}',
    deterministicAnimation:'Drive ThreeCanvas with useCurrentFrame(); continuous useFrame loops are not supported.',
    packages:await Promise.all(Object.entries(registry).map(async([name,definition])=>{
      try{await resolveCreativeDependencies({[name]:definition.version},root);return {name,version:definition.version,available:true};}
      catch(error){return {name,version:definition.version,available:false,error:(error as Error).message};}
    })),
  };
}

/** Parse authored source without importing/evaluating it. This is not a JS sandbox. */
export function checkVisualSource(code:string,input:unknown={}) {
  const dependencies=validateCreativeDependencies(input);
  const source=ts.createSourceFile('Asset.tsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let exported=false;
  function visit(node:ts.Node) {
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier) {
      if(!ts.isStringLiteral(node.moduleSpecifier))throw Error('动画源码需要静态包导入');
      const name=node.moduleSpecifier.text;
      if(!implicitImports.has(name)&&!Object.hasOwn(dependencies,name))throw Error(`未声明或不支持的动画导入：${name}；请在 dependencies 中声明可用浏览器包的精确版本`);
      if(name==='@react-three/fiber'&&ts.isImportDeclaration(node)&&node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings)&&node.importClause.namedBindings.elements.some(item=>(item.propertyName??item.name).text==='useFrame'))
        throw Error('ThreeCanvas 动画请使用 Remotion useCurrentFrame，不支持连续 useFrame 循环');
    }
    if(ts.isImportEqualsDeclaration(node)||(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))))
      throw Error('新资产不支持动态 require/import 或 TypeScript require 导入，请静态声明浏览器依赖');
    if((ts.isFunctionDeclaration(node)||ts.isVariableStatement(node))&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)&&((ts.isFunctionDeclaration(node)&&node.name?.text==='VisualAsset')||(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text==='VisualAsset'))))exported=true;
    ts.forEachChild(node,visit);
  }
  visit(source);
  if(!exported)throw Error('源码需要导出 VisualAsset 组件');
}

/** Native project sources stay free-form, but supported creative packages must be pinned too. */
export function assertNativeCreativeImports(code:string,declared:CreativeDependencies={}){
  const source=ts.createSourceFile('Scene.tsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function check(specifier:string){
    const name=Object.keys(registry).find(name=>specifier===name||specifier.startsWith(name+'/'));
    if(!name)return;
    if(specifier!==name)throw Error(`原创场景动画依赖暂不支持子路径 ${specifier}；请使用 ${name} 的公开入口`);
    if(!Object.hasOwn(declared,name))throw Error(`原创场景导入了 ${name}，请在场景清单 dependencies 中声明已安装的精确版本`);
  }
  function visit(node:ts.Node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
      const typeOnly=ts.isImportDeclaration(node)?node.importClause?.isTypeOnly:node.isTypeOnly;
      if(!typeOnly)check(node.moduleSpecifier.text);
    }
    if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))check(node.arguments[0].text);
    ts.forEachChild(node,visit);
  }
  visit(source);
}
