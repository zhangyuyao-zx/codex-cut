export const clamp = (v) => Math.max(0, Math.min(1, v));
export const mix = (a, b, p) => a + (b-a)*p;
export function progress(frame, start, duration) {
  if (![frame,start,duration].every(Number.isFinite) || duration <= 0) throw new Error('Motion needs finite frame/start and positive duration');
  return clamp((frame-start)/duration);
}
export const easeOut = (p) => 1-Math.pow(1-clamp(p),3);
export const smooth = (p) => {p=clamp(p); return p*p*(3-2*p);};
export const pop = (p) => {p=clamp(p)-1; return 1+2.7*p*p*p+1.7*p*p;};
export const at = (x,y,w,h) => ({position:'absolute',left:x,top:y,...w!=null?{width:w}:{},...h!=null?{height:h}:{}});

// Native Codex Cut beats already include the user's offset. Never add it twice.
// Each semantic cue is a unique beat.label and retains its real wordId.
export function cuesFromBeats(beats, names, durationFrames) {
  const result = {};
  for (const name of names) {
    const matches = beats.filter(b=>b.label===name);
    if (matches.length!==1) throw new Error(`Cue ${name}: expected one bound beat, got ${matches.length}`);
    const b=matches[0];
    if (!b.wordId || !Number.isInteger(b.frame) || !Number.isInteger(b.durationFrames) || b.frame<0 || b.durationFrames<=0 || b.frame+b.durationFrames>durationFrames) throw new Error(`Cue ${name}: invalid local frame/duration or missing real wordId`);
    result[name]={start:b.frame,duration:b.durationFrames,wordId:b.wordId};
  }
  return result;
}

export function grid({x,y,w,h}, columns, rows=1, gap=21) {
  if (![x,y,w,h,gap].every(Number.isFinite) || !Number.isInteger(columns) || !Number.isInteger(rows) || columns<1 || rows<1 || gap<0) throw new Error('Invalid grid');
  const cw=(w-gap*(columns-1))/columns,ch=(h-gap*(rows-1))/rows;
  if(cw<=0 || ch<=0) throw new Error('Grid does not fit');
  return Array.from({length:columns*rows},(_,i)=>({x:x+(i%columns)*(cw+gap),y:y+Math.floor(i/columns)*(ch+gap),w:cw,h:ch}));
}
