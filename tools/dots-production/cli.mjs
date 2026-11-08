import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'.');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const exists=async p=>{try{await fs.lstat(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}};
const [requested,...rest]=process.argv.slice(2);
const legacy=requested==='legacy';
const [command,...args]=legacy?rest:[requested,...rest];
const legacyCreators=new Set(['prepare','bind-native','init','init-film']);
const value=key=>{const i=args.indexOf(key);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Missing value for ${key}`);return args[i+1]};

async function verifyRelease(version) {
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid kit version');
  const dir=path.join(root,'releases',version),release=await read(path.join(dir,'manifest.json'));
  for(const [name,sha] of Object.entries(release.files)) {
    const target=path.resolve(dir,name);
    if(!target.startsWith(dir+path.sep))throw new Error('Invalid manifest path');
    if(hash(await fs.readFile(target))!==sha)throw new Error(`Version file changed: ${name}`);
  }
  return release;
}

try {
  if(legacyCreators.has(command)&&!legacy)throw Error('历史创建命令已移入 legacy；新工程从 WORKFLOW.md 和 studio 开始。仅恢复旧协议时显式使用 legacy '+command+'。');
  const catalog=await read(path.join(root,'catalog.json'));
  if(!command||command==='help'||command==='--help') {
    console.log('Dots 当前制作入口：tools/dots-production/WORKFLOW.md\n命令：studio standards | studio sync/reference/asset/frame/approve-frame/resume/capture --project PROJECT_DIR\n素材与参考实例：studio/CRAFT.md\n可选诊断：list | verify | compare-frames\n已有 schema 1 工程：legacy/NATIVE_AUTHORING_V1.md；历史创建工具只在 legacy 命名空间。');
  } else if(command==='studio') {
    const {studioCommand}=await import('./studio.mjs');
    console.log(JSON.stringify(await studioCommand(args),null,2));
  } else if(command==='list') {
    const relation=args.includes('--relation')?value('--relation'):null;
    console.log(JSON.stringify(catalog.patterns.filter(p=>!relation||p.tags.includes(relation)),null,2));
  } else if(command==='verify') {
    const version=args.includes('--version')?value('--version'):catalog.currentVersion;
    const release=await verifyRelease(version);
    for(const b of catalog.baselines)if(hash(await fs.readFile(path.join(root,b.file)))!==b.sha256)throw new Error(`Approved baseline changed: ${b.id}`);
    if(version===catalog.currentVersion && release.templates)for(const name of release.templates) {
      if(hash(await fs.readFile(path.join(root,'templates',name)))!==release.files[name])throw new Error(`Current template differs from release: ${name}`);
    }
    console.log(JSON.stringify({ok:true,version,codeFiles:Object.keys(release.files).length,approvedBaselines:catalog.baselines.length}));
  } else if(command==='prepare') {
    const version=catalog.currentVersion,release=await verifyRelease(version);
    const {preparePack}=await import('./production-pack.mjs');
    console.log(JSON.stringify(await preparePack({briefFile:path.resolve(value('--brief')),registryFile:path.resolve(value('--references')),target:path.resolve(value('--to')),kitRoot:root,version,release}),null,2));
  } else if(command==='bind-native') {
    const {bindNative}=await import('./bind-native.mjs');
    console.log(JSON.stringify(await bindNative({projectDir:path.resolve(value('--project')),filmFile:path.resolve(value('--film')),preparationFile:path.resolve(value('--preparation'))}),null,2));
  } else if(command==='review-pack') {
    const {reviewPack}=await import('./production-pack.mjs');
    console.log(JSON.stringify(await reviewPack({specFile:path.resolve(value('--spec')),target:path.resolve(value('--out'))}),null,2));
  } else if(command==='check-review') {
    const {checkReview}=await import('./production-pack.mjs');
    const result=await checkReview({evidenceFile:path.resolve(value('--evidence')),observationFile:path.resolve(value('--observation'))});
    console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
  } else if(command==='init') {
    const target=path.resolve(value('--to'));
    if(await exists(target))throw new Error('Target exists; refusing to overwrite or merge user work');
    const version=catalog.currentVersion,release=await verifyRelease(version);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.mkdir(target);
    await fs.cp(path.join(root,'releases',version),path.join(target,'dots',version),{recursive:true,errorOnExist:true,force:false});
    for(const name of ['画面动作脚本.json','Scene.jsx'])await fs.copyFile(path.join(root,'releases',version,name),path.join(target,name));
    await fs.writeFile(path.join(target,'dots-lock.json'),JSON.stringify({version,source:root,files:release.files,sceneSchemaVersion:2,baselineIds:catalog.baselines.map(b=>b.id),status:'authoring-starter-not-user-approved'},null,2));
    await fs.writeFile(path.join(target,'README.md'),`# Dots 历史协议开发副本\n\n固定视觉源码 ${version}。本副本仅用于已有 schema 1 工程的恢复或显式选择的历史技术开发，不是新视频制作入口。历史操作见 ${path.join(root,'legacy/NATIVE_AUTHORING_V1.md')}；新工程统一从 ${path.join(root,'WORKFLOW.md')} 开始。\n\n已有脚本以本期真实词ID驱动自定义对象及完整状态，原生参数、锁、声音和具体版本验收继续保留。\n`);
    console.log(JSON.stringify({ok:true,target,version,referencePackMissing:true,next:'Legacy source copy only; new video projects use WORKFLOW.md and studio.'}));
  } else if(command==='init-film') {
    const target=path.resolve(value('--to'));
    if(await exists(target))throw new Error('Target exists; refusing to overwrite film plan');
    await verifyRelease(catalog.currentVersion);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,await fs.readFile(path.join(root,'releases',catalog.currentVersion,'全片编排.json')),{flag:'wx'});
    console.log(JSON.stringify({ok:true,target,next:'Reference existing scene scripts by path; write the question chain and adjacent handoffs'}));
  } else if(command==='compare-frames') {
    const {compareFrames}=await import('./compare-frames.mjs');
    console.log(JSON.stringify(await compareFrames({specFile:value('--spec'),outputDir:value('--out')}),null,2));
  } else if(command==='audit-render') {
    const {auditRender}=await import('./audit-render.mjs');
    const report=await auditRender({video:path.resolve(value('--video')),sceneFile:path.resolve(value('--scene'))});
    const out=path.resolve(value('--out'));await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({out,sceneId:report.sceneId,stillWindows:report.stillWindows,deliveryReady:false}));
  } else if(command==='gate-render') {
    const sceneFile=path.resolve(value('--scene')),video=path.resolve(value('--video'));
    const scene=await read(sceneFile),version=scene.kitVersion;
    await verifyRelease(version);
    const {reviewRender}=await import(pathToFileURL(path.join(root,'releases',version,'direction.mjs')).href);
    const report=await read(path.resolve(value('--audit'))),review=await read(path.resolve(value('--review')));
    if(hash(await fs.readFile(sceneFile))!==report.sceneSha256||hash(await fs.readFile(video))!==report.videoSha256)throw new Error('Stale audit: video or authored scene has changed');
    const result=reviewRender(report,scene,review);
    if(args.includes('--out'))await fs.writeFile(path.resolve(value('--out')),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
  } else if(command==='check' || command==='check-film') {
    if(!args[0]||args[0].startsWith('--'))throw new Error(`${command} requires a JSON path`);
    // Import only the fixed installed checker; user JSON cannot supply executable module paths.
    await verifyRelease(catalog.currentVersion);
    const {checkScene,checkFilm}=await import(pathToFileURL(path.join(root,'releases',catalog.currentVersion,'direction.mjs')).href);
    const file=path.resolve(args[0]),input=await read(file);
    let result;
    if(command==='check') {
      const words=await read(path.resolve(value('--words')));
      const versions=(await fs.readdir(path.join(root,'releases'),{withFileTypes:true})).filter(d=>d.isDirectory()&&/^\d+\.\d+\.\d+$/.test(d.name)).map(d=>d.name);
      result=checkScene(input,words,{catalog,versions});
    } else {
      const scripts=[];
      if(!Array.isArray(input.scenes))throw new Error('Film scenes must be an array');
      for(const entry of input.scenes) {
        if(typeof entry.script!=='string'||!entry.script.trim())throw new Error('Film scene requires a script path');
        scripts.push(await read(path.resolve(path.dirname(file),entry.script)));
      }
      result=checkFilm(input,scripts);
    }
    console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
  } else throw new Error('未知命令；运行 help 查看当前 studio 入口。旧协议命令说明只在 legacy/NATIVE_AUTHORING_V1.md 和 legacy/SOURCE_TOOLS_1_3.md。');
}catch(e){console.error(e.message);process.exitCode=1;}
