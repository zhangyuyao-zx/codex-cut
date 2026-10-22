# Codex 自定义场景协议

> 2026-10-21 / v0.2.0：新复用资产通过[视觉资产库协议](../docs/REFERENCE_LIBRARY.md)登记；本文件继续说明场景与保存动画。旧 194 项仅供历史工程引用，不参与新选型。下方早期验证数字和路径保留为当时证据。

## 源码与素材快照

模块指纹覆盖入口、递归本地导入及字面量 `staticFile()` 引用的 public 素材；检查不执行场景代码。保存为动画时，本地导入的图片/音视频/字体以及明确的静态素材路径复制到 `public/saved-animations/<moduleId>/`，按内容哈希命名，保存代码引用副本。后续原素材改动不会改变保存动画；副本损坏会改变模块指纹。预览及正式渲染使用同一份副本。

`mediaSrc` 继续由目标段落绑定，不冻结旧口播。组件媒体与已提供的提需素材现已归档到素材副本；组件进入目标正常素材库，可继续调参；提需素材保持原ID作为模块内素材入口。任意运行时计算路径、网络素材和独立包导入导出尚未完成，不能据此宣称任意动画已经可迁移。备份必须保留 saved 模块、项目模板元数据与 public 下的素材副本。

实际验证脚本 `workbench-local/qa/template-assets-proof.ts`：保存两种素材引用后修改原图，再渲染保存版本，画面仍是原红/蓝两图；完整自动检查96项通过。此为功能证据，不是创意审美认可。

目标：新增动画不再修改播放主程序。Codex 先读剪后文稿，再写场景代码与参数定义，使用 production/scenes 绑定到口播。用户在工作台改参数和审阅，导出使用同一实现。

## 新增场景

原创场景是正常入口，不必先成为库资产。按表达直接编写镜头、看实际效果并修改；有复用价值时再提炼。原生清单可选 `styleBindings:{控件key:风格tokenKey}`，让原创布局沿用整片样式；保留用户显式设置与锁，未适配部分会显示在风格覆盖报告中。

使用 Three.js 时在清单声明 `dependencies`，例如 `{"three":"0.186.1","@remotion/three":"4.0.489"}`（导入 Fiber 时另声明 `@react-three/fiber@9.8.2`）。准确能力见资产库响应 `capabilities.runtimeDependencies`。入口和本地辅助代码的动画导入需要声明；依赖与帧时间参与预览/导出的相同结果身份，保存动画保留版本要求。缺失或不匹配时拒绝复用，不自动安装。使用 ThreeCanvas 时通过 useCurrentFrame 驱动状态。

在 `workbench-local/scenes/` 新增一个 `<id>.json` 和一个 `.tsx` 文件。定义示例见 hero-keyword.json / HeroKeyword.tsx 和 word-flow.json / WordFlow.tsx。manifest 包含 id、label、entry、exportName、controls；entry 只能是此目录内的文件。controls 描述 text/number/color/boolean/select/list 参数及默认值、范围和必填规则。select/list 使用与新库相同的控件类型，列表值保持数组。

每个段落增加：

```json
{"program":{"moduleId":"hero-keyword","parameters":{"caption":"真实文稿的核心观点","accent":"#dff4a3","fontSize":84}}}
```

通过 `npx tsx workbench-local/cli.ts production/context` 读取现有方案、模块定义和真实词ID，再经 production/scenes 提交完整方案，携带 expectedRevision。不得直接覆盖项目JSON。

一个方案启用自定义场景后，所有段落都必须有明确实现。没有 program 的旧三段方案继续使用原播放器；两种方式不能混合以免无实现段落被静默替代。

## 场景函数接收的数据

- title：用户可编辑的画面标题。
- parameters：经过模块定义校验、应用默认值后的参数。
- from / duration：段落在剪后视频中的起点和长度，单位30fps帧。
- words：本段逐字稿，id/text/start/end；start/end为段内局部帧。
- beats：口播动作，wordId/label/frame 及可选 durationFrames；frame 为段内局部帧，已包含用户相对词锚点的偏移。声明时长的场景须实际消费 durationFrames，不能在实现里继续写死旧时长。
- mediaSrc：实际粗剪视频；使用 OffthreadVideo 时 trimBefore={from}，声音静音。
- materials：本段已补充素材的 id/src/kind。只有声明 acceptsMaterials=true 且代码确实实现展示时才能使用；未实现素材展示的模块不能接收已提供的素材。

动画由 useCurrentFrame 驱动。按 beats[i].frame 开始动作，不把所有重点同时显示。不使用随机数、墙上时钟或CSS动画决定画面。参数和口播文本不能写死回代码；设计说明不是画面文字。

C 编辑器以 `scene.beats[].durationFrames` 显式声明该动作时长可编辑。`scene.editor.eventTimings` 可选，键为 `beat:<原始词ID>` 或视觉资产的 `cue:<cueID>`，值 `{offsetFrames,durationFrames?}`。每次从当前词时间重算，不保存绝对开始帧；被删词或越界调整需重新绑定。用 `production/event-edit` 窄接口修改，不绕开用户草稿或覆盖别的 editor 字段。

整段动画存档新增可选 layerState/cueTimings，保留图层调整和相对动作节奏；新词按存档 cue 索引绑定。无法迁移目标已有调整、同词事件不同偏移或时长时明确拒绝。当前不自动从任意场景代码抽取对象/组。详见 [C 技术记录与兼容边界](../docs/implementation/2026-10-22-timeline-and-animation-reuse.md)。

主播放器负责口播音轨。单场景预览使用同一段音频，最终画面渲染后无损封装粗剪音轨。段落之间没有设计覆盖的空隙保留粗剪原画面。历史工程已有旧组件仍按隔离兼容实现解析；新叠加选用视觉资产库。

## 验证与版本

先做参数校验、真实逐帧检查，再导出完整MP4并核对音频。每次导出保留方案、参数、场景入口源码与编译bundle。参数修改和program绑定随方案修订撤销；这不等于任意依赖源码的完整历史恢复。用户批准当前实际成片后才能标记认可。

修改主入口或manifest会改变模块指纹。修改导入的共享依赖也必须验证并更新模块版本；当前不声称已实现递归源码依赖的完整追踪和恢复。长片性能、复杂定制动画、多场景转场和逐模块视觉验收独立进行。

## 六步创作方法与逐段确认

粗剪完成后，Codex 阅读全片文稿，再一并设计视觉段落、视觉对象、布局、包装动作；这四项是同一份方案中的决定，不是四个独立审批页。方案经用户讨论确认后，逐段实现并输出带原声视频供用户确认。程序不从组件清单反推内容。

每段 `design` 的字段：

```json
{"message":"观众应该记住的命题","relationship":"信息之间的关系","objects":[{"id":"person","role":"main","content":"口播人物","source":"当前粗剪视频","layout":"左侧主要画面"},{"id":"claim","role":"support","content":"核心观点","source":"文稿提炼","layout":"右侧大字"}],"actions":[{"objectId":"claim","wordId":"word-15","action":"淡入观点","purpose":"跟随说到的重点"}],"rationale":"为什么选择这样的表达"}
```

动作引用同段 beats 中的真实 wordId。objects 允许随时间改变主次关系；不能把“主视觉”简化成永远面积最大。缺素材沿用同段 requests，明确需求和理由。source 是设计说明，不替代实际媒体绑定。设计对象与任意场景代码之间尚不能自动证明视觉一致，Codex 必须检查真实帧，用户审美认可另计。

- `production/scenes` 可以保存全片方案和已实现的部分场景；未实现段落无需先伪造 program。完整全片导出仍要求实现齐备。
- `production/render {"sceneId":"..."}` 只渲染这一段的完整分配帧范围（含相邻口播间停顿），保留全片帧坐标，再按相同范围裁切原声。每段渲染及确认独立保存，不覆盖其他段落。
- 段落认可用于记录用户对具体版本的判断。主流程逐段确认后通过 `production/assemble` 合成；Codex 不代替用户认可作品。旧直接全片渲染接口仅供兼容调试。
- design 是可选设计笔记，不影响预览或导出。全片仍检查动画实现、参数、素材和时间引用是否有效。
- 样片认可绑定该段设计、组件/模块、素材及当前粗剪；其他段落的修改不使它失效。本段设计或公共实现/粗剪变化会要求重新审阅。当前粗剪版本变更采取保守失效，尚非精确局部影响分析。
- 已声明对象的用户覆盖值和锁随场景修订保存；完整源码历史仍未完成。

## 对象编辑与用户参数保护

manifest 可声明 `objects:[{id,label,parameters:[控制项key]}]`；场景实际对象容器标记 `data-editable-object="id"`。只公开已映射到代码的参数。当前接通原三段动画的人物/标题，以及 hero-keyword、word-flow 中声明的对象；不是任意图层自动可编辑。

直接画布编辑使用可选 `canvas:{transform:true,text:"文字控件key",visibility:true,reorder:true}`，并用公共 `EditableCanvasObject` 包住稳定布局。`text` 必须是本对象的 text 控件；`kind` 可为 text/image/video/shape/group；固定分组使用 `parentId`，父级必须存在且不能循环，包装节点也传相同 `parentId`。默认对象仍兼容。未声明的隐藏/排序能力不显示为可用操作。

`editor.objectTransforms`、`objectVisibility` 和 `objectOrder` 与用户参数一起保存，预览及导出共享。排序数组从后向前，同级必须全部声明 reorder，不能把排序当作换父级。未覆盖顺序时保留作者 DOM/style；明确覆盖后由包装节点 zIndex 执行。分组需采用真实、固定的嵌套定位；作者不应在可编辑子对象之外引入未适配的坐标变换。父组锁保护子对象。完整协议见 [B 阶段实现](../docs/implementation/2026-10-22-editor-shell-and-layers.md)。

- `editor:{overrides,locks}` 与基础参数分开。渲染使用基础值叠加用户覆盖，页面显示选中对象对应字段。
- 默认 `production/scenes` 是 Codex 创作更新，保留已有 editor。带用户调整的段落不能直接删除或更换不兼容模块，需先迁移。`actor:user` 用于用户页面保存，不能用来绕过用户锁。
- 用户明确要求修改某参数时，用 `production/parameters {sceneId,patch}`，携带 expectedRevision。此接口会修改覆盖值，但拒绝 Codex 写入锁定字段。结构代码修改必须使用传入参数，不能硬编码规避用户覆盖。
- `production/context` 返回 selection：段落、对象、全片秒数、视图、baseRevision、hasUnsavedChanges、更新时间。先读取再修改；有草稿时不把旧保存值当最新意图。选择状态独立保存，不增加创作修订。
- 保存、重开、撤销和冲突保护已验证。上一成功全片单独保留，失败可通过“上一版视频”播放；不等于源码自动恢复，也不表示旧视频包含新修改。


### 段落审阅接口

- `segmentReviews[]` 按时间线顺序返回 `{sceneId,from,end,key,status,latest,approved,history,feedbackOpen}`，帧区间为左闭右开。`current` 表示版本及范围仍匹配当前工程，旧视频不会丢弃。
- `/approve-sample` 提交 `sceneId,key,renderId`，不得拿最近一次全局 sample 代替选中段落。确认时要求渲染完成、范围/指纹匹配、素材齐备、反馈已处理。
- `/assemble {expectedRevision}` 仅使用所有段落当前已确认画面；不重新执行动画代码。最终使用完整粗剪音轨，不拼接每段 AAC。
- 变更已确认段落需要新渲染与用户确认。旧确认保持可追溯；回到完全相同指纹和范围时可复用原确认。共享渲染代码与粗剪变更保守要求重新审阅。
- `segment-reviews.json` 与其关联的 renders 输出为已确认版本资产，不能在清理中删除。


## 连续动作与审阅（2026-09-17）

制作方法见 [CREATIVE_METHOD.md](CREATIVE_METHOD.md)。沿用六步流程，不新增必经阶段。
`design.actions[]` 保留 objectId / wordId / action / purpose；可补 before / after（起态、终态），offsetMs（相对绑定词，-5000～60000），durationMs（实际动作时长，>0 且不超过60000）。字段缺失时保持旧方案可读，不猜测中间或落点。
这些是设计与审阅元数据，不会自动生成动画；场景代码必须使用同一口播绑定和时长实现，实际验帧核对。动作越出段落或绑定词丢失时，审阅入口提示重新定位。一个词可绑定多个不同对象动作，不伪造额外转写词。
工作台动作检查可前后切换，定位起点/中间/结束前一帧；历史视频不套用当前动作表。场景预览暂停定位，段落 MP4 以 from/30 换算局部时间。没有实际播放仍不能确认样片。

## 新视觉资产与保存动画（2026-10-21）

新库 `SCENE` 在 program 中固定 `moduleId`、`parameters`、`styleDefaults` 和 `cueBindings`。语义 cue 映射目标真实词 ID，最终仍由当前 TimeMap 确定帧。参数合并顺序为 `styleDefaults` → `parameters` → `editor.overrides`，锁与未保存草稿保护继续生效。`previewBackground`、`contentParameters`、`requiresSourceMedia` 和媒体槽的定义见新库协议。

资产素材槽以请求 `visualSlot:{moduleId,slotId}` 固定到具体实现，实际文件从段落补充素材取得；库技术样片使用 `materialSceneId` 读取该绑定。只声明素材槽或改 provided 状态不能替代真实文件与实际展示。

保存新库 SCENE 动画时会解析固定源码、合并样式与用户参数、捕获素材，记录语义 cue 与保存动画 cue 的对应。应用保存动画时重新绑定目标词并重映射素材，保留目标内容编辑。已有源码、素材哈希及版本过期检查继续执行。

包含新库 OBJECT 的嵌套动画尚不能独立打包为 `.cutanimation`，当前明确拒绝保存/打包；不要用缺少实现的包冒充成功。工作台风格包也不是独立可安装文件。需要保留整个项目与视觉库时，使用[配对备份](RECOVERY.md)。
