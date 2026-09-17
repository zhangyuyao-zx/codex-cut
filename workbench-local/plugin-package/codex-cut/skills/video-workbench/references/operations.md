# 操作与实现

## 工程位置

插件根目录 `local-config.json` 的 `workbenchRoot` 指向已有仓库；可用进程环境变量 `CODEX_CUT_ROOT` 覆盖。`workbench_status` 返回有效根目录。插件是本机连接版，依赖该仓库及其现有 Node、FFmpeg、Chromium、Remotion 运行时，不包含用户视频或模型凭据，也不自动下载依赖。

当前后端只有一个活动工程，不支持通过插件任意新建/切换多个工程。新视频必须先保护现有活动工程；不能把导入命令当作无损新建工程。

## 工具

- `open_workbench {}` 只启动/复用服务并返回 URL，不切换素材。使用 `open_in_codex` 等现有浏览器面板能力展示该 URL。
- `read_project {section:"summary"}` 是常规入口。`production` 返回完整方案；带 `sceneId` 只返回该段与编辑信息。`cut` 返回剪辑及词时间。`library` 可用 query 筛选当前组件，`component` 需要 componentId。
- `update_project {operation,expectedRevision,data}` 只接受公开操作。`expectedRevision` 必须来自刚读取的对应 cut/production。所有制作操作以 Codex 身份保留用户覆盖；不会冒充用户解锁。
- `render_segment {sceneId,expectedRevision}` 返回后台任务；`read_project` 的 segmentReviews.latest 查看状态和视频 URL。帧区间 from/end 是左闭右开，包含分配的停顿。
- `approve_segment {sceneId,key,renderId,userConfirmed:true}` 必须对应用户已看过并认可的版本。key 与 renderId 来自该段 latest/history，不使用全局最近 sample 推断。
- `assemble_video {expectedRevision}` 要求 assemblyReady，复用确认画面，不再次调用模型或重制动画。

## 常用修改 data

| operation | data |
|---|---|
| production/parameters | `{sceneId,patch:{参数名:值}}` |
| production/scenes | `{source:当前plan.source,scenes:完整场景数组}`，先读取完整方案再只改目标段 |
| production/request | `{request:{id,sceneId,description,reason,status:"missing"}}` |
| production/feedback | `{feedback:{sceneId,timeMs,text}}`，timeMs 是全片毫秒 |
| production/resolve-feedback | `{id}`，仅已实际处理的反馈 |
| production/rebase | `{}`，粗剪变化后重新绑定前先检查文稿与失效引用 |
| production/undo | `{}`，撤销上一方案修订，不等于还原代码 |
| production/cancel-render | `{id:正在运行的任务ID}` |
| cut/import | `{path:"用户指定的本地绝对路径"}`；保护当前项目，再导入，不能当作新建工程 |
| cut/ranges | `{ranges:[{startMs,endMs}]}`，是保留的原素材区间，不是要删除的区间 |
| cut/transcript | `{words:[{id,text,startMs,endMs}]}`，源词 ID 要稳定 |
| cut/transcribe、cut/render、cut/undo | `{}`；转写和渲染可能为耗时任务，应查看状态而非连续重复提交 |

素材上传目前在工作台完成，或按项目已有接口绑定真实文件。不能将 request.status 手改成 provided 冒充上传成功。组件媒体绑定按当前 `SCENE_MODULES.md` 与库详情处理。

## 动画代码

在 `workbench-local/scenes/` 中编写或调整参数化场景与清单。读项目 `SCENE_MODULES.md`、`scene-program-binding.ts`，沿用 Remotion 引擎；不要因其他 Skill 可用就另起 HyperFrames 项目。新场景应声明可编辑对象和参数，使用传入真实素材与 beats，保持确定性 seek。素材/文字/颜色/位置在用户参数中，动作与布局逻辑在代码中。

段落 schema 与 design 对象参考 `production-store.ts`、`creative-design.ts`；参数与锁定参考 `editable-objects.ts`。只保存设计文字不会自动产生动画。

存在共享模块时修改代码可能影响多段，先核对调用者与确认状态。确认记录 `projects/local-workbench/production/segment-reviews.json` 和关联 renders 是成果资产，不可当缓存删除。旧视频可查看不等于完整源码一键回滚。

## 工具未加载时

新安装插件通常需新任务加载。当前任务可用同一插件的脚本入口：

`node <插件根>/scripts/bridge.mjs workbench_status`

`node <插件根>/scripts/bridge.mjs read_project '{"section":"summary"}'`

命令与 MCP 共用 invoke，不修改凭据或扩大任意 shell/HTTP 访问。不要把脚本成功说成当前任务已经加载了 MCP。
