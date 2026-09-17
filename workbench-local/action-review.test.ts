import {describe, it, expect} from 'vitest';
import {reviewActions, actionFrame, localPlaybackTime} from './action-review';
const beats = [{wordId: 'a', label:'建立联系', timeMs: 34000}];
describe('action review timing', () => {
  it('keeps legacy word anchors without fabricating end times', () => {
    const a = reviewActions(undefined, beats, 33000, 38000)[0];
    expect(actionFrame(a,'start')).toBe(1020);
    expect(actionFrame(a,'middle')).toBeNull();
  });
  it('derives phases from explicit authored duration and offset', () => {
    const a = reviewActions({actions:[{wordId:'a',action:'移动',offsetMs:100,durationMs:1000}]}, beats,33000,38000)[0];
    expect(actionFrame(a,'start')).toBe(1023);
    expect(actionFrame(a,'middle')).toBe(1038);
    expect(actionFrame(a,'end')).toBe(1052);
  });
  it('marks deleted anchors and out of range actions unseekable', () => {
    for (const a of [{wordId:'gone'}, {wordId:'a',durationMs:5000}, {wordId:'a',offsetMs:-2000}]) {
      expect(reviewActions({actions:[a]},beats,33000,38000)[0].startMs).toBeNull();
    }
  });
  it('converts global frames to segment time without seeking outside the clip', () => {
    expect(localPlaybackTime(1050,34,3)).toBe(1);
    expect(localPlaybackTime(1000,34,3)).toBe(0);
    expect(localPlaybackTime(1200,34,3)).toBeCloseTo(3-1/30);
  });
});

it('shows a readable spoken phrase for legacy segment placeholders without inventing an action', () => {
 const words=[{sourceId:'a',text:'保',startMs:34000,endMs:34200},{sourceId:'b',text:'留人物。',startMs:34200,endMs:35000}];
 const item=reviewActions({actions:[{wordId:'a',action:'保 · 分镜5'}]},beats,33000,38000,words)[0];
 expect(item.label).toBe('保留人物。');expect(item.anchorOnly).toBe(true);expect(item.endMs).toBeNull();
});
