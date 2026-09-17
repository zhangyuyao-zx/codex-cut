import { randomUUID } from 'node:crypto';

/** One owner from preparation through cleanup; cancellation never releases early. */
export class RenderLane {
  private stopping = false;
  private owner: { id: string; controller: AbortController; finished: Promise<void> } | null = null;
  isBusy() { return this.owner !== null; }
  reserve() {
    if (this.stopping) throw Error("工作台正在停止，不能启动新渲染");
    if (this.owner) throw Error('正在处理渲染任务，请等待完成或取消');
    const controller = new AbortController();
    let finish!: () => void;
    const owner = { id: randomUUID(), controller, finished: new Promise<void>(r => { finish = r; }) };
    this.owner = owner;
    return {
      id: owner.id,
      signal: controller.signal,
      check: () => controller.signal.throwIfAborted(),
      release: () => { if (this.owner === owner) this.owner = null; finish(); },
    };
  }
  cancel(id: string) {
    if (!this.owner || this.owner.id !== id) throw Error('这个渲染任务已经结束，请刷新状态');
    this.owner.controller.abort(new Error('渲染已取消'));
  }
  async stop() {
    this.stopping = true;
    const owner = this.owner;
    if (!owner) return;
    owner.controller.abort(new Error('服务关闭，渲染已取消'));
    await owner.finished;
  }
}
