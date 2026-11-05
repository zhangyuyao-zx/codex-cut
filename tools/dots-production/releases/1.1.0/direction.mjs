// Production design checks. No automatic aesthetic score, template quota, or approval mutation.
import {compileObjectStates, compileValueTrack} from './state.mjs';
const text = x => typeof x === 'string' && Boolean(x.trim()) && !/待填写|待说明|待设计|待完成|待补|TODO/.test(x);
const array = x => Array.isArray(x) ? x : [];
const range = (a,b,n) => Number.isInteger(a) && Number.isInteger(b) && a>=0 && a<b && b<=n;
const same = (a,b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
function normalize(x) {
  if (Array.isArray(x)) return x.map(normalize);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])]));
  return x;
}

export function checkScene(script, rawWords, {catalog, versions} = {}) {
  const s = script ?? {}, errors=[], warnings=[], reviewPrompts=[], cues={};
  const fail = message => errors.push(message);
  const words = Array.isArray(rawWords) ? rawWords : rawWords?.words;
  if (!Array.isArray(words)) return {ok:false, errors:['Words must be an array or an object containing words'], warnings, reviewPrompts, cues};
  if (![1,2].includes(s.schemaVersion)) fail('Unsupported scene script schemaVersion');
  if (!/^\d+\.\d+\.\d+$/.test(s.kitVersion ?? '') || !array(versions).includes(s.kitVersion)) fail('Unknown kitVersion');
  if (!Number.isInteger(s.durationFrames) || s.durationFrames<=0) fail('durationFrames must match current scene');
  if (s.fps!==30) fail('Native Codex Cut local frame contract is 30fps; convert explicitly');
  for (const k of ['contentId','sceneId','relation','patternReason']) if (!text(s[k])) fail(`Missing ${k}`);
  if (s.patternId && !array(catalog?.patterns).some(p=>p.id===s.patternId)) fail('Unknown patternId; use null for original design');
  const wordMap = new Map();
  for (const word of words) {
    if (!word.id || wordMap.has(word.id)) fail(`Missing/duplicate word id: ${word.id}`);
    wordMap.set(word.id,word);
    if (s.schemaVersion===2 && (!Number.isInteger(word.start) || !Number.isInteger(word.end) || word.start<0 || word.end<word.start || word.end>s.durationFrames)) fail(`Word ${word.id}: expected current scene-local frame range`);
  }
  const objects=array(s.objects), objectMap=new Map(), actionIds=new Set();
  for (const object of objects) {
    if (!text(object.id) || objectMap.has(object.id)) fail(`Missing/duplicate object: ${object.id}`);
    objectMap.set(object.id,object);
    if (!text(object.source) || !text(object.container)) fail(`Object ${object.id}: missing source/container`);
  }
  if (!objects.length) fail('No objects');
  for (const action of array(s.actions)) {
    if (!text(action.id) || actionIds.has(action.id)) fail(`Missing/duplicate action id: ${action.id}`);
    actionIds.add(action.id);
    if (!objectMap.has(action.objectId)) fail(`Action ${action.id}: unknown object`);
    for (const k of ['before','process','after','focus','handoff']) if (!text(action[k])) fail(`Action ${action.id}: missing ${k}`);
    const word=wordMap.get(action.wordId);
    if (!word) {fail(`Action ${action.id}: wordId missing from actual scene`);continue;}
    const start=word.start+action.offsetFrames, duration=action.durationFrames;
    if (!Number.isInteger(word.start) || !Number.isInteger(action.offsetFrames) || !Number.isInteger(duration) || duration<=0 || !range(start,start+duration,s.durationFrames)) fail(`Action ${action.id}: invalid timing or outside scene`);
    else cues[action.id]={wordId:action.wordId,start,duration};
    if (action.before===action.after) warnings.push(`${action.id}: same before/after; inspect whether useful information changes`);
  }
  if (!actionIds.size) fail('No actions');
  for (const hold of array(s.holds)) {
    if (!range(hold.from,hold.to,s.durationFrames) || !text(hold.reason)) fail('Hold needs local range and a reading/comparison/pause reason');
    if (s.schemaVersion===2 && !array(hold.objectIds).length) fail('Hold must name the objects being read or compared');
    for (const id of array(hold.objectIds)) if (!objectMap.has(id)) fail(`Hold: unknown object ${id}`);
  }
  for (const motion of array(s.ambient)) if (!objectMap.has(motion.objectId) || !range(motion.from,motion.to,s.durationFrames) || !text(motion.purpose) || !text(motion.yieldsTo)) fail('Ambient motion needs object, bounded range, purpose and attention handoff');
  if (s.schemaVersion===1) {
    warnings.push('Legacy schema 1 retained: meaning, child parts and state continuity checks require schema 2 for new authoring. Existing projects are not migrated.');
    return {ok:!errors.length,errors,warnings,reviewPrompts,cues};
  }

  for (const key of ['question','beforeUnderstanding','afterUnderstanding','visualEvidence','narrationRole']) if (!text(s.explanation?.[key])) fail(`Missing explanation.${key}`);
  const composition=s.composition ?? {};
  for (const key of ['layoutFamily','hierarchy','reason']) if (!text(composition[key])) fail(`Missing composition.${key}`);
  if (!objectMap.has(composition.primaryObjectId)) fail('Composition needs an existing primaryObjectId');
  if (!array(composition.readingOrder).length) fail('Composition needs a reading order');
  for (const id of array(composition.readingOrder)) if (!objectMap.has(id)) fail(`Reading order: unknown object ${id}`);
  const entities=new Set();
  for (const object of objects) {
    for (const key of ['represents','whyThisForm']) if (!text(object[key])) fail(`Object ${object.id}: missing ${key}`);
    if (object.entityId) {
      if (entities.has(object.entityId)) fail(`Entity ${object.entityId}: use one logical object with several views/parts`);
      entities.add(object.entityId);
    }
    if (object.parentId && !objectMap.has(object.parentId)) fail(`Object ${object.id}: unknown parent`);
    const visited=new Set([object.id]);let p=object.parentId;
    while(p && objectMap.has(p)) {
      if (visited.has(p)) {fail(`Object ${object.id}: cyclic containment`);break;}
      visited.add(p);p=objectMap.get(p).parentId;
    }
    if (!object.atomic && !array(object.parts).length) fail(`Object ${object.id}: enumerate meaningful child parts or mark a genuinely atomic object`);
    const ids=new Set();
    for (const part of array(object.parts)) {
      if (!text(part.id) || ids.has(part.id)) fail(`Object ${object.id}: duplicate/missing part id`);
      ids.add(part.id);
      for (const key of ['form','role','reason']) if (!text(part[key])) fail(`Part ${object.id}/${part.id}: missing ${key}`);
    }
    if (array(object.states).length && (!text(object.initialState) || !text(object.finalState))) fail(`Object ${object.id}: states need initialState and finalState`);
  }
  let semantic=0;
  for (const action of array(s.actions)) {
    if (!['establish','change','feedback','handoff','exit'].includes(action.kind)) fail(`Action ${action.id}: unknown kind`);
    if (!text(action.meaning)) fail(`Action ${action.id}: missing meaning`);
    if (!objectMap.has(action.focusObjectId)) fail(`Action ${action.id}: unknown focusObjectId`);
    const parts=new Set(array(objectMap.get(action.objectId)?.parts).map(x=>x.id));
    for (const id of array(action.partIds)) if (!parts.has(id)) fail(`Action ${action.id}: unknown part ${id}`);
    if (action.kind==='change') {
      semantic++;
      if (!array(action.changes).length && !array(action.trackIds).length) fail(`Action ${action.id}: change needs concrete state or value changes`);
    }
    for (const change of array(action.changes)) {
      if (!objectMap.has(change.objectId)) fail(`Action ${action.id}: change references unknown object`);
      else if (!array(objectMap.get(change.objectId).states).length) fail(`Action ${action.id}: changed object needs state snapshots`);
      if (change.from===change.to) warnings.push(`${action.id}: state IDs are unchanged; inspect whether this explains anything`);
      const states=array(objectMap.get(change.objectId)?.states);
      if (change.from!==change.to && states.some(x=>x.id===change.from) && states.some(x=>x.id===change.to) && same(states.find(x=>x.id===change.from).data,states.find(x=>x.id===change.to).data)) warnings.push(`${action.id}: different state names with identical data`);
    }
  }
  for (const object of objects.filter(o=>array(o.states).length)) {
    try {compileObjectStates(object,array(s.actions),cues);} catch(e) {fail(e.message);}
  }
  const tracks=array(s.tracks), trackIds=new Set();
  for (const track of tracks) {
    if (!text(track.id) || trackIds.has(track.id)) fail(`Missing/duplicate track id: ${track.id}`);
    trackIds.add(track.id);
    if (!objectMap.has(track.objectId) || !text(track.property) || !text(track.meaning)) fail(`Track ${track.id}: needs object/property/meaning`);
    if (!array(track.segments).length) fail(`Track ${track.id}: no segments`);
    for (const segment of array(track.segments)) if (!actionIds.has(segment.actionId)) fail(`Track ${track.id}: unknown action`);
    try {compileValueTrack(track,cues);} catch(e) {fail(e.message);}
  }
  for (const action of array(s.actions)) for (const id of array(action.trackIds)) {
    if (!trackIds.has(id)) fail(`Action ${action.id}: unknown track ${id}`);
    else if (!tracks.find(t=>t.id===id).segments.some(x=>x.actionId===action.id)) fail(`Action ${action.id}: referenced track has no segment bound to this action`);
  }
  if (!semantic) reviewPrompts.push({code:'NO_STATE_CHANGE',sceneIds:[s.sceneId],reason:'本段主要是建立、反馈或保持。核对它是否确实只需呈现一个事实；不强制造过程。'});
  if (text(s.explanation?.visualEvidence)) reviewPrompts.push({code:'RENDER_EVIDENCE',sceneIds:[s.sceneId],reason:`实际画面应能看到：${s.explanation.visualEvidence}。数据填写完成不证明渲染已经呈现。`});
  // Ambient decoration never conceals an unexplained interval. This is a review index, not a motion-frequency rule.
  const intervals=[...Object.values(cues).map(c=>[c.start,c.start+c.duration]),...array(s.holds).filter(h=>range(h.from,h.to,s.durationFrames)).map(h=>[h.from,h.to])].sort((a,b)=>a[0]-b[0]);
  const inspectionGaps=[];let cursor=0;
  for(const [from,to] of intervals){if(from>cursor)inspectionGaps.push({from:cursor,to:from});cursor=Math.max(cursor,to);}
  if(Number.isInteger(s.durationFrames)&&cursor<s.durationFrames)inspectionGaps.push({from:cursor,to:s.durationFrames});
  if(inspectionGaps.length)reviewPrompts.push({code:'REVIEW_UNACCOUNTED_TIME',sceneIds:[s.sceneId],reason:'这些区间尚未登记动作或阅读/比较/暂停安排，按inspectionGaps回看实际样片。可能只是未记录完整，不自动判为静止或节奏失败；装饰循环不替代解释安排。'});
  return {ok:!errors.length,errors,warnings,reviewPrompts,cues,inspectionGaps,note:'Production structure and timing only; inspect actual frames, sound and film continuity before review. Never user acceptance.'};
}

export function checkFilm(film, scripts) {
  const errors=[],warnings=[],reviewPrompts=[];
  const fail=x=>errors.push(x), entries=array(film?.scenes), scenes=new Map();
  if (film?.schemaVersion!==1 || !text(film.contentId) || !text(film.viewerJourney)) fail('Film needs schemaVersion 1, contentId and viewerJourney');
  if (!entries.length) fail('Film needs scenes');
  for (let i=0;i<entries.length;i++) {
    const entry=entries[i], script=scripts[i];
    if (!script || entry.sceneId!==script.sceneId || script.contentId!==film.contentId) {fail(`Film scene ${entry.sceneId}: identity/content mismatch`);continue;}
    if (scenes.has(script.sceneId)) fail(`Duplicate film scene ${script.sceneId}`);
    scenes.set(script.sceneId,script);
    if (script.schemaVersion!==2) warnings.push(`${script.sceneId}: legacy scene lacks complete director fields`);
    if (!text(script.explanation?.question) || !text(script.composition?.layoutFamily)) fail(`${script.sceneId}: needs question and composition for whole-film comparison`);
  }
  const handoffs=array(film?.handoffs), bridges=new Map();
  if (handoffs.length!==Math.max(0,entries.length-1)) fail('Every adjacent scene pair needs one handoff');
  for (const bridge of handoffs) {
    const key=bridge.fromSceneId+'>'+bridge.toSceneId;
    if (bridges.has(key)) fail(`Duplicate handoff ${key}`);
    bridges.set(key,bridge);
    const i=entries.findIndex(e=>e.sceneId===bridge.fromSceneId);
    if (i<0 || entries[i+1]?.sceneId!==bridge.toSceneId) fail(`Handoff ${key}: not an adjacent pair`);
    if (!['continuation','comparison','return','new-task'].includes(bridge.relation)) fail(`Handoff ${key}: invalid relation`);
    if (!['same-stage','recompose','clear-stage'].includes(bridge.visualMode)) fail(`Handoff ${key}: invalid visual mode`);
    if (!text(bridge.reason) || !text(bridge.nextQuestion)) fail(`Handoff ${key}: reason/next question missing`);
    const from=scenes.get(bridge.fromSceneId),to=scenes.get(bridge.toSceneId);
    if (!from || !to) continue;
    for (const entity of array(bridge.retainEntityIds)) {
      const a=array(from.objects).find(o=>o.entityId===entity),b=array(to.objects).find(o=>o.entityId===entity);
      if (!a || !b) {fail(`Handoff ${key}: retained entity ${entity} missing on one side`);continue;}
      const end=array(a.states).find(x=>x.id===a.finalState),start=array(b.states).find(x=>x.id===b.initialState);
      if (end && start && !same(end.data,start.data) && !text(bridge.stateBridgeReasons?.[entity])) fail(`Handoff ${key}: ${entity} silently resets; explain the state bridge or preserve it`);
    }
    if (bridge.visualMode==='clear-stage' && array(bridge.retainEntityIds).length) reviewPrompts.push({code:'RETENTION_THROUGH_TRANSITION',sceneIds:[from.sceneId,to.sceneId],reason:'清场后仍保留实体身份；实际过渡要让观众认得出它，不能仅靠JSON里的相同ID。'});
  }
  const signature=s=>JSON.stringify([s.composition?.layoutFamily,array(s.objects).map(o=>o.role),array(s.actions).map(a=>a.kind)]);
  for (let i=0;i<scripts.length;i++) for (let j=i+1;j<scripts.length;j++) {
    const a=scripts[i],b=scripts[j];if(!a||!b)continue;
    if (signature(a)===signature(b)) {
      const relation=j===i+1?bridges.get(a.sceneId+'>'+b.sceneId)?.relation:null;
      reviewPrompts.push({code:'COMPARE_SIMILAR_SCENES',sceneIds:[a.sceneId,b.sceneId],reason:`布局类型、对象职责顺序和动作类型顺序相似${relation?`；已声明${relation}`:''}。并排看实际样片，判断内部对象是否有不同工作、或是否属于有意连续/比较/回访。相似不自动判为失败。`});
    }
  }
  return {ok:!errors.length,errors,warnings,reviewPrompts,questionChain:scripts.filter(Boolean).map(s=>({sceneId:s.sceneId,question:s.explanation?.question,after:s.explanation?.afterUnderstanding})),note:'Whole-film design prompts; no layout quota, motion-frequency threshold, aesthetic pass or user approval.'};
}
