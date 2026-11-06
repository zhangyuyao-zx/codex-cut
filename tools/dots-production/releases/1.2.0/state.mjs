// Deterministic state helpers. Consume resolved scene-local cues, not word offsets.
import {progress, easeOut, smooth} from './motion.mjs';

const copy = x => JSON.parse(JSON.stringify(x));
const validCue = c => c && Number.isInteger(c.start) && c.start >= 0 && Number.isInteger(c.duration) && c.duration > 0;

export function compileObjectStates(object, actions, cues) {
  const states = new Map();
  for (const state of object.states ?? []) {
    if (!state.id || states.has(state.id) || !state.data || typeof state.data !== 'object' || Array.isArray(state.data)) {
      throw new Error(`${object.id}: invalid or duplicate state snapshot`);
    }
    states.set(state.id, copy(state.data));
  }
  if (!states.has(object.initialState)) throw new Error(`${object.id}: missing initial state`);
  const steps = [];
  for (const action of actions) {
    for (const change of action.changes ?? []) {
      if (change.objectId !== object.id) continue;
      const cue = cues[action.id];
      if (!validCue(cue)) throw new Error(`${action.id}: missing resolved local cue`);
      if (!['start', 'end'].includes(change.at)) throw new Error(`${action.id}: change.at must be start or end`);
      if (!states.has(change.from) || !states.has(change.to)) throw new Error(`${action.id}: unknown state`);
      steps.push({actionId: action.id, frame: cue.start + (change.at === 'end' ? cue.duration : 0), from: change.from, stateId: change.to, data: states.get(change.to)});
    }
  }
  steps.sort((a,b) => a.frame-b.frame);
  let previous = object.initialState;
  for (let i=0;i<steps.length;i++) {
    const step = steps[i];
    if (i && step.frame === steps[i-1].frame) throw new Error(`${object.id}: simultaneous snapshots are ambiguous; combine them`);
    if (step.from !== previous) throw new Error(`${object.id}: ${step.actionId} expects ${step.from}, current state is ${previous}`);
    previous = step.stateId;
  }
  if (object.finalState && object.finalState !== previous) throw new Error(`${object.id}: declared final state is not reached`);
  return {objectId: object.id, initial: {stateId: object.initialState, data: states.get(object.initialState)}, steps};
}

// Complete snapshots replace old data. Old pending labels / warning badges do not merge into the new state.
export function objectStateAt(frame, timeline) {
  if (!Number.isFinite(frame)) throw new Error('Frame must be finite');
  let current = timeline.initial;
  for (const step of timeline.steps) {
    if (step.frame > frame) break;
    current = step;
  }
  return {stateId: current.stateId, data: copy(current.data)};
}

export function compileValueTrack(track, cues) {
  if (!Number.isFinite(track.initial)) throw new Error(`${track.id}: initial value must be finite`);
  const segments = (track.segments ?? []).map(s => {
    const cue = cues[s.actionId];
    if (!validCue(cue) || !Number.isFinite(s.from) || !Number.isFinite(s.to)) throw new Error(`${track.id}: invalid value segment`);
    if (!['linear', 'out', 'smooth'].includes(s.easing)) throw new Error(`${track.id}: unknown easing`);
    return {...s, start: cue.start, duration: cue.duration};
  }).sort((a,b) => a.start-b.start);
  let end = -1, value = track.initial;
  for (const segment of segments) {
    if (segment.start < end) throw new Error(`${track.id}: overlapping value segments`);
    if (Math.abs(segment.from-value) > 1e-9) throw new Error(`${track.id}: discontinuous value; model the jump explicitly`);
    end = segment.start + segment.duration;
    value = segment.to;
  }
  return {id: track.id, initial: track.initial, segments};
}

// Gaps and the tail keep the last value. A stopped progress bar can remain at 0.64 instead of drifting to 1.
export function valueAt(frame, track) {
  if (!Number.isFinite(frame)) throw new Error('Frame must be finite');
  let value = track.initial;
  for (const segment of track.segments) {
    if (frame < segment.start) break;
    let p = progress(frame, segment.start, segment.duration);
    p = segment.easing === 'out' ? easeOut(p) : segment.easing === 'smooth' ? smooth(p) : p;
    value = segment.from + (segment.to-segment.from)*p;
    if (frame < segment.start + segment.duration) break;
  }
  return value;
}
