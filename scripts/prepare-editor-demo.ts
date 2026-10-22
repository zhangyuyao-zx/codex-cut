import {execFile} from 'node:child_process';
import {mkdir, access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {createRoughcutService, projectCutWords} from '../workbench-local/roughcut-service';
import {createProductionStore} from '../workbench-local/production-store';
import {createEditorSelection} from '../workbench-local/editor-selection';
import {runtimeCommand} from '../workbench-local/runtime-paths';

// Reproducible technical project. It contains no real speech or user media.
const directory = resolve(process.argv[2] || 'projects/editor-stage-a-demo');
const stageB = process.argv.includes('--stage-b');
const seconds = stageB ? 12 : 4;
for (const file of ['production/production.json', 'cut/roughcut.json']) {
  try {await access(resolve(directory, file)); throw Error('演示目录已存在工程，拒绝覆盖：' + directory);}
  catch (error: any) {if (error.code !== 'ENOENT') throw error;}
}
await mkdir(directory, {recursive: true});
const source = resolve(directory, 'synthetic-source.mp4');
await promisify(execFile)(runtimeCommand('ffmpeg'), ['-v', 'error', '-n',
  '-f', 'lavfi', '-i', `color=c=0xf1f3ec:s=1920x1080:r=30:d=${seconds}`,
  '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(seconds),
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source]);
const cut = await createRoughcutService(resolve(directory, 'cut'));
let state = await cut.importFile(source, '独立编辑演示 · 合成静音素材');
const words = (stageB ? ['标题','编辑','演示','结束','数字','强调','演示','结束','流程','编排','演示','结束'] : ['独立', '编辑', '演示', '结束']).map((text, index) => ({id: 'demo-' + index, text, startMs: index * 1000, endMs: (index + 1) * 1000}));
state = state.timeline
  ? await cut.setAssetTranscript(state.revision, state.timeline.assets[0].id, words)
  : await cut.setTranscript(state.revision, words);
await cut.render();
state = await cut.get();
const timelineWords = projectCutWords(state);
const store = await createProductionStore(resolve(directory, 'production'));
const initial = await store.get();
const scenes = stageB ? [
  {id:'editor-title-demo',title:'文字 · 让想法清晰',moduleId:'editable-title'},
  {id:'editor-number-demo',title:'数字 · 把重点放大',moduleId:'editor-number'},
  {id:'editor-flow-demo',title:'流程 · 让信息递进',moduleId:'editor-flow'},
].map((item,index)=>({id:item.id,title:item.title,intent:'独立界面演示；静音素材与词锚点均为合成数据。',startWordId:timelineWords[index*4].sourceId,endWordId:timelineWords[index*4+3].sourceId,
  beats:[{wordId:timelineWords[index*4].sourceId,label:'开始'}],program:{moduleId:item.moduleId,parameters:{}}})) : [{
  id: 'editable-title-demo', title: '独立编辑演示', intent: '验证直接编辑和作者接续修改；时间锚点为合成数据，不是语音转写。',
  startWordId: timelineWords[0].sourceId, endWordId: timelineWords.at(-1)!.sourceId,
  beats: [{wordId: timelineWords[0].sourceId, label: '标题出现'}],
  program: {moduleId: 'editable-title', parameters: {}},
}];
const production = await store.setScenes(initial.revision, {assetUrl: state.asset!.url, cutRevision: state.revision}, scenes);
const selection = await createEditorSelection(resolve(directory, 'production'));
await selection.set({sceneId: production.scenes[0].id, objectId: 'headline', timeSeconds: 1, view: 'scene', baseRevision: production.revision, hasUnsavedChanges: false});
console.log(JSON.stringify({directory, productionRevision: production.revision, cutRevision: state.revision,
  note: '独立静音技术工程，不包含用户素材，不代表用户影片认可。'}, null, 2));
