import { describe, expect, it } from 'vitest';
import { RenderLane } from './render-lane';
describe('render ownership', () => {
  it('rejects concurrent preparation and holds ownership until cancelled work finishes', () => {
    const lane = new RenderLane(), first = lane.reserve();
    expect(() => lane.reserve()).toThrow();
    lane.cancel(first.id);
    expect(() => first.check()).toThrow('渲染已取消');
    expect(() => lane.reserve()).toThrow();
    first.release();
    const second = lane.reserve();
    expect(second.id).not.toBe(first.id);
    expect(() => lane.cancel(first.id)).toThrow();
    first.release(); // late cleanup cannot release the new job
    expect(() => lane.reserve()).toThrow();
    second.release();
  });
  it('shutdown waits for cleanup and rejects new work', async () => {
    const lane = new RenderLane(), task = lane.reserve();
    let stopped = false;
    const wait = lane.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(task.signal.aborted).toBe(true);
    expect(stopped).toBe(false);
    task.release();
    await wait;
    expect(stopped).toBe(true);
    expect(() => lane.reserve()).toThrow("正在停止");
  });
});
