# 直接对象编辑 · A 阶段

2026-10-22。基于 v0.2.3 增量实现；这是编辑升级的第一阶段，不是 B—E 全部完成或正式版本发布。对应[开发计划](../plans/2026-10-22-openfilm-editor-upgrade.md)。

## 已实现的闭环

已声明能力的普通 HTML 对象可以在实际画面上选中、拖动、等比缩放、旋转、双击改字；用户变换与作者动画分别保存。拖动期间本地预览，松手后保存一条命令；只点击和取消不会生成调整命令。右侧可输入变换数值，失焦或 Enter 提交；无效值恢复原值。中文输入组合期间不触发文字快捷键。

文字编辑支持完成、失焦提交、⌘/Ctrl Enter 提交和 Esc 取消。保存中与未提交的编辑保护导航和渲染；结果未确认时保留当前调整，可按相同操作 ID 重试，或放弃本地调整并读取实际已保存结果。撤销/重做重试也保留原操作与目标，不因一次丢失响应多撤销一步。重试不偷偷替换原始 before 值，不用自动覆盖来解决同字段冲突。

已适配场景的侧栏参数保存、参数锁及对象锁也使用编辑命令。对话仍在 Codex；现有逐段审阅、素材提需和用户确认规则保持。

## 对象协议与共享渲染

manifest 的可选能力声明示例：

```json
{"id":"headline","label":"标题","parameters":["caption","fontSize"],"canvas":{"transform":true,"text":"caption"}}
```

`canvas.text` 必须映射这个对象自己的 text 控件。没有声明 canvas 能力的旧对象继续沿用原来的选中和参数操作，不显示虚假的画布手柄。

场景使用 `EditableCanvasObject` 包住稳定布局；帧动画放在它内部。`SceneModuleSurface` 提供同一个 `CanvasEditsProvider`，预览与导出均使用它：

```tsx
<EditableCanvasObject id="headline" style={{position:'absolute',left:150,top:285,width:1350}}>
  <div style={{opacity:progress,translate:`0 ${(1-progress)*24}px`}}>{parameters.caption}</div>
</EditableCanvasObject>
```

`scene.editor.objectTransforms[objectId]` 保存 x/y/scale/rotation 的稀疏覆盖，缺项按 0/0/1/0 读取。位移使用视频逻辑像素，不受编辑器缩放影响；缩放围绕对象中心，旋转可按 Shift 吸附 15°。变换通过共享 `bindScenePrograms` 进入实际导出输入，不能只改浏览器 DOM。

本阶段支持这种明确的 HTML 对象边界，没有为旧场景批量加包装，也不把 Canvas/WebGL 内部像素自动解释成图层。完整图层、侧栏与时间线升级继续属于后续阶段。

参考：[Remotion 可交互标记的组织建议](https://www.remotion.dev/docs/studio/interactivity-best-practices)、[Player 的画面尺寸与输入协议](https://www.remotion.dev/docs/player/player)。工作台使用自己的稳定对象 ID、覆盖与命令，沿用现有 Remotion 渲染，不以 Studio 的源码写回替换用户参数存储。

## 操作、持久化与同步

前端和服务端共用 `editor-commands.ts` 的协议与纯验证/应用函数：

```json
{
  "operationId":"唯一UUID",
  "expectedRevision":8,
  "sceneId":"editable-title-demo",
  "objectId":"headline",
  "actor":"user",
  "changes":[{"kind":"transform","key":"x","before":0,"after":120}]
}
```

- `transform` 修改 x/y/scale/rotation；`parameter` 修改所属参数；`objectLock` 用 key `locked`；`parameterLock` 用参数 key。文字、数值、列表和颜色继续按声明校验。
- `POST /api/production/editor/command` 写入一条操作；`/editor/undo` 和 `/editor/redo` 使用新的 operationId 与原 targetOperationId。
- 日志、幂等回执和新 production 状态通过原有串行队列一起原子写入。相同 ID、相同请求只执行一次；同 ID 不同请求拒绝。
- 旧 revision 在目标字段仍等于 before 时可以安全接续。未来 revision、目标删除、能力不兼容和同字段冲突明确拒绝。锁继续限制 Codex；桥接强制 actor 为 codex，不能冒充用户解锁或撤销用户操作。
- 逆操作只恢复本次涉及字段及原覆盖来源，其他作者改动保留；撤销覆盖后可以重新继承当前作者值。新命令不再向旧 history 追加整片快照，原来的普通方案写入保持原行为。
- `context.editorSnapshot` 返回制作/剪辑版本、模块身份和是否存在新命令；`editorHistory` 按最近动作返回用户撤销/重做摘要。快照读取采用有限重试，避免混合制作和剪辑修订。
- `GET /api/production/editor/events` 用 SSE 通知 revision，断线重连读取权威快照。现有轮询仍作为任务更新和兼容降级；D 阶段再收敛其余轮询。选择和进度不写进制作修订。

画布操作期间，提前发出的 scoped 轮询不能覆盖手中的画面；命令完成后一起采用匹配的全局/段落快照。正常关闭服务会结束 SSE 订阅和连接，避免监听端口因事件流一直占用。

## 独立工程与验证证据

创建可再生成的四秒技术工程：

```sh
npx tsx scripts/prepare-editor-demo.ts projects/editor-stage-a-demo
WORKBENCH_PROJECT_DIR=projects/editor-stage-a-demo WORKBENCH_PORT=4342 npm run dev
```

准备脚本使用合成底色视频、静音 AAC 和明确的合成词锚点；不存在真实人物、口播或转写事实。目录已有工程时拒绝覆盖。实际渲染需要本机 Remotion 浏览器具备正常进程权限。开发环境不传递文件监视事件时，可仅在测试进程使用 `CHOKIDAR_USEPOLLING=1`。

本轮实际证据位于被 Git 忽略的 `projects/editor-stage-a-demo-20261022/`：

1. 浏览器拖动标题后保存 x=157.377、y=-78.689；缩放后 scale=1.137；双击改字保存新的 caption，侧栏字号保存为 104。
2. 用 Codex 身份修改另一对象的说明、颜色、动作时长，并实际修改该对象的动画代码；原来的文案、位置、缩放继续保留。
3. 浏览器撤销改字时保留后来的作者内容，再重做；重开后读取相同调整。另实际操作旋转手柄并验证记录。
4. 真正生成 1920×1080、120 帧、4 秒 H.264/AAC 样片；查看实际第 30 帧，并核对输出 snapshot 中的 objectTransforms 与工程相同。原轨为静音，不能据此声称真人音画同步已经验收。
5. 操作核心、旧状态兼容、锁、幂等、冲突、操作级逆转、坐标换算、场景绑定及插件 actor/草稿守卫完成针对性检查；没有重跑全套旧组件测试。

首次导出核对发现变换没有进入实际返回输入，已修正共享绑定位置并增加覆盖测试；最终输出见 `verification/render-frame-30-final.png` 与 `verification/final-output.json`。先前失败/旧技术样片不是有效验收结果。

全部试验使用独立合成工程和 4342；没有重做 DJI，也没有向用户影片写入确认。技术验证不等于用户的视觉接受。

## 当前边界与下一阶段

- 新工程及旧字段的兼容读取已覆盖；首次写入的新字段与命令日志不保证能被原 v0.2.3 代码读取。回退应使用变更前工程副本，完整迁移与配套源码恢复在 E 阶段验收。
- 有新命令日志的工程停用旧“整份方案撤销”，防止回滚抹掉后来编辑；适配对象使用明确的画面操作撤销。旧场景的所有操作尚未统一迁移，不能把本阶段称为完整历史/版本编辑器。
- 源码桥接已加入三项 editor 操作与上下文；宿主当前已加载的旧插件工具架构不能视为已热更新。正式插件产物、版本号与完整安装交付仍随 E 阶段处理。
- B 阶段继续完成共同编辑外壳、图层和上下文属性；当前界面仍基于 v0.2.3，不代表已经交付计划中的完整视觉重设计。
