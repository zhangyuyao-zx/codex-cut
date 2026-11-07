import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run = promisify(execFile);
const text = value => typeof value === 'string' && value.trim().length > 0;
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function sha256(file) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}

// This prepares actual picture evidence, never an aesthetic verdict or approval.
export async function compareFrames({specFile, outputDir}) {
  specFile = path.resolve(specFile);
  outputDir = path.resolve(outputDir);
  try { await fs.lstat(outputDir); throw new Error('Output exists; refusing to replace comparison evidence'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const bytes = await fs.readFile(specFile);
  const spec = JSON.parse(bytes);
  if (spec.schemaVersion !== 1 || !Array.isArray(spec.pairs) || !spec.pairs.length) throw new Error('Expected schemaVersion 1 and nonempty pairs');
  const ids = new Set(), sources = new Map(), pairs = [];
  // Validate all requests before creating output, including paths and time bounds.
  for (const pair of spec.pairs) {
    if (typeof pair?.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(pair.id) || ids.has(pair.id)) throw new Error('Pair needs a unique safe id');
    if (!text(pair.question)) throw new Error(`Pair ${pair.id}: describe the visual question being compared`);
    ids.add(pair.id);
    const selected = {id: pair.id, question: pair.question};
    for (const side of ['reference', 'current']) {
      const input = pair[side];
      if (!input || !text(input.video) || !Number.isFinite(input.timeSeconds) || input.timeSeconds < 0) throw new Error(`Pair ${pair.id}/${side}: local video and nonnegative timeSeconds required`);
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input.video)) throw new Error('Comparison inputs must be local media');
      const file = path.resolve(path.dirname(specFile), input.video);
      if (!sources.has(file)) {
        if (!(await fs.stat(file)).isFile()) throw new Error(`Not a media file: ${file}`);
        const result = await run('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,width,height,duration','-of','json',file]);
        const metadata = JSON.parse(result.stdout);
        const video = metadata.streams?.find(stream => stream.codec_type === 'video');
        const duration = Number(video?.duration ?? metadata.format?.duration);
        if (!video || !Number.isFinite(duration) || duration <= 0) throw new Error(`No usable video stream: ${file}`);
        sources.set(file, {path:file, sha256:await sha256(file), width:video.width, height:video.height, durationSeconds:duration});
      }
      if (input.timeSeconds >= sources.get(file).durationSeconds) throw new Error(`Pair ${pair.id}/${side}: time is outside the video`);
      selected[side] = {source:file, requestedTimeSeconds:input.timeSeconds, image:`${pair.id}-${side}.jpg`};
    }
    pairs.push(selected);
  }
  await fs.mkdir(path.dirname(outputDir), {recursive:true});
  await fs.mkdir(outputDir);
  for (const pair of pairs) {
    for (const side of ['reference','current']) {
      const item = pair[side], destination = path.join(outputDir,item.image);
      await run('ffmpeg', ['-v','error','-ss',String(item.requestedTimeSeconds),'-i',item.source,'-map','0:v:0','-frames:v','1','-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2','-q:v','2','-n',destination]);
      if (!(await fs.stat(destination)).size) throw new Error(`No frame extracted: ${item.image}`);
      item.imageSha256 = await sha256(destination);
    }
  }
  const manifest = {
    schemaVersion:1, kind:'visual-comparison-evidence', createdAt:new Date().toISOString(),
    specSha256:createHash('sha256').update(bytes).digest('hex'), sources:[...sources.values()], pairs,
    pictureSize:{width:1280,height:720,fit:'contain'},
    scope:'Requested-time stills only. Full frames are scaled equally without cropping; source aspect ratio is preserved. Motion, sound and aesthetic quality require actual observation.',
    visualJudgment:'not-performed', userAccepted:false,
  };
  await fs.writeFile(path.join(outputDir,'comparison.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dots 画面对照</title>
<style>body{margin:0;background:#202329;color:#f2eee4;font:16px system-ui;line-height:1.6}main{max-width:1480px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:22px}section{padding:20px 0;border-top:1px solid #50545c}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}img{display:block;width:100%;height:auto;background:#000}figcaption{padding:8px 0}a{color:#d1f84c}small{color:#c4c6c8}.phone{max-width:390px}.phone .pair{grid-template-columns:1fr}button{padding:8px 12px;margin:0 10px 15px 0;cursor:pointer}@media(max-width:800px){.pair{grid-template-columns:1fr}}
</style><main><h1>同尺度实际画面对照</h1><p>逐组回答下面的视觉问题。生成对照不表示精致度通过；动作、声音及相邻交接需另看对应片段。</p><button onclick="document.querySelector('#pairs').classList.toggle('phone')">切换 390px 窄幅检查</button><small>窄幅是可读性辅助，不能替代实际设备。点击画面可查看原图。</small><div id="pairs">${pairs.map(pair=>`<section><h2>${escape(pair.question)}</h2><div class="pair">${['reference','current'].map(side=>`<figure><figcaption>${side==='reference'?'参考':'当前作品'} · ${pair[side].requestedTimeSeconds.toFixed(3)}s</figcaption><a href="${pair[side].image}" target="_blank" rel="noopener"><img src="${pair[side].image}" alt="${escape(pair.id)} ${side}"></a></figure>`).join('')}</div></section>`).join('')}</div><p><a href="comparison.json">素材、时间及文件哈希</a></p></main></html>`;
  await fs.writeFile(path.join(outputDir,'index.html'),html,{flag:'wx'});
  return {outputDir,pairs:pairs.length,index:path.join(outputDir,'index.html'),visualJudgment:'not-performed',userAccepted:false};
}
