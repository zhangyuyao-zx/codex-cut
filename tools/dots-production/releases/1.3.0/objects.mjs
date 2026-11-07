// Deterministic object identity, complete content snapshots and independently timed poses.
// These values drive the visible components; they are not claims of visual quality.
export const clamp01 = n => Math.max(0, Math.min(1, n));
export const ease = n => 1 - Math.pow(1 - clamp01(n), 3);
export const phase = (frame, start, duration = 18) => ease((frame - start) / Math.max(1, duration));
export const lerp = (a, b, p) => a + (b - a) * p;
export const mixPose = (a, b, p) => Object.fromEntries(Object.keys({...a, ...b}).map(k => {
  const av = a[k] ?? b[k], bv = b[k] ?? a[k];
  if (!Number.isFinite(av) || !Number.isFinite(bv)) throw new Error(`Pose ${k} must be numeric`);
  return [k, lerp(av, bv, p)];
}));

export function validateEntity(entity) {
  if (!entity?.id || !entity.entityId) throw new Error('An authored object needs an id and persistent entityId');
  if (!Array.isArray(entity.states) || !entity.states.length || entity.states[0].at !== 0) throw new Error(`${entity.id}: initial content snapshot required at frame 0`);
  const names = new Set(); let previous = -1;
  for (const s of entity.states) {
    if (!Number.isInteger(s.at) || s.at <= previous || !s.id || names.has(s.id) || !s.data || Array.isArray(s.data)) throw new Error(`${entity.id}: invalid complete content snapshots`);
    previous = s.at; names.add(s.id);
  }
  let end = 0;
  for (const p of entity.poses ?? []) {
    if (!Number.isInteger(p.start) || !Number.isInteger(p.duration) || p.start < end || p.duration < 1) throw new Error(`${entity.id}: overlapping or invalid pose transitions`);
    mixPose(entity.pose, p.to, 1); end = p.start + p.duration;
  }
  mixPose(entity.pose, entity.pose, 0);
  return entity;
}

export function viewAt(entity, frame) {
  validateEntity(entity);
  let state = entity.states[0], pose = {...entity.pose};
  for (const s of entity.states) if (frame >= s.at) state = s;
  for (const p of entity.poses ?? []) {
    if (frame < p.start) break;
    const next = {...pose, ...p.to};
    if (frame < p.start + p.duration) {pose = mixPose(pose, next, phase(frame, p.start, p.duration)); break;}
    pose = next;
  }
  return {id:entity.id, entityId:entity.entityId, stateId:state.id, data:state.data, pose};
}

// A subordinate running layer yields explicitly when attention moves or the task stops.
export function activityAt(frame, {start=0, stop=Infinity, period=60, strength=1}={}) {
  if (frame < start || frame >= stop) return 0;
  return (Math.sin((frame-start)/period*Math.PI*2)*.5+.5)*strength;
}

export function cueFrame(words, id) {
  const word=words.find(w=>w.id===id);
  if (!word || !Number.isInteger(word.start)) throw new Error(`Missing real local word ${id}`);
  return word.start;
}
