import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'.');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const exists=async p=>{try{await fs.lstat(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}};
const [command,...args]=process.argv.slice(2);
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
  const catalog=await read(path.join(root,'catalog.json'));
  if(command==='list') {
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
  } else if(command==='init') {
    const target=path.resolve(value('--to'));
    if(await exists(target))throw new Error('Target exists; refusing to overwrite or merge user work');
    const version=catalog.currentVersion,release=await verifyRelease(version);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.mkdir(target);
    await fs.cp(path.join(root,'releases',version),path.join(target,'dots',version),{recursive:true,errorOnExist:true,force:false});
    for(const name of ['画面动作脚本.json','Scene.jsx'])await fs.copyFile(path.join(root,'releases',version,name),path.join(target,name));
    await fs.writeFile(path.join(target,'dots-lock.json'),JSON.stringify({version,source:root,files:release.files,sceneSchemaVersion:2,baselineIds:catalog.baselines.map(b=>b.id),status:'authoring-starter-not-user-approved'},null,2));
    await fs.writeFile(path.join(target,'README.md'),`# dots 制作起点\n\n固定版本 ${version}。先完成画面动作脚本中的理解目标、具体对象及子部件、布局和状态变化，再绑定当前工程真实词ID，编写Scene.jsx的AuthoredObjects。起点故意不提供可冒充完成画面的默认布局，未完成时会拒绝渲染。\n\n通过cuesFromBeats消费已含偏移的原生beats，state.mjs在同一时间轴给出完整对象状态及可暂停的数值；把值实际用于文字、图形和页面标注。\n\n调用：node '${path.join(root,'cli.mjs')}' check '${path.join(target,'画面动作脚本.json')}' --words '/当前段真实words.json'\n\n方法：${path.join(root,'README.md')}\n导演判断：${path.join(root,'DIRECTING.md')}\n\n本目录仅准备制作源码，不创建或切换Codex Cut工程，不生成声音，不写用户认可。原生参数/锁及逐段审阅继续沿用。\n`);
    console.log(JSON.stringify({ok:true,target,version,next:'Complete content-specific design and objects, bind real words, implement and render in the owning project'}));
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
    await verifyRelease(catalog.currentVersion);
    const {reviewRender}=await import(pathToFileURL(path.join(root,'releases',catalog.currentVersion,'direction.mjs')).href);
    const sceneFile=path.resolve(value('--scene')),video=path.resolve(value('--video'));
    const report=await read(path.resolve(value('--audit'))),review=await read(path.resolve(value('--review')));
    if(hash(await fs.readFile(sceneFile))!==report.sceneSha256||hash(await fs.readFile(video))!==report.videoSha256)throw new Error('Stale audit: video or authored scene has changed');
    const result=reviewRender(report,await read(sceneFile),review);
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
  } else throw new Error('Commands: list | verify | init --to NEW_DIR | init-film --to NEW_JSON | check SCRIPT --words ACTUAL_WORDS | check-film FILM_JSON | compare-frames --spec JSON --out NEW_DIR | audit-render --video VIDEO --scene SCENE --out JSON | gate-render --video VIDEO --scene SCENE --audit AUDIT --review REVIEW [--out JSON]');
}catch(e){console.error(e.message);process.exitCode=1;}
