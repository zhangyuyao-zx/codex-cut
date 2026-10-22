# 操作与实现

## 工程位置

插件根目录 `local-config.json` 的 `workbenchRoot` 指向已有仓库；可用进程环境变量 `CODEX_CUT_ROOT` 覆盖。`workbench_status` 返回有效根目录。插件是本机连接版，依赖该仓库及其现有 Node、FFmpeg、Chromium、Remotion 运行时，不包含用户视频或模型凭据，也不自动下载依赖。

当前后端只有一个活动工程，不支持通过插件任意新建/切换多个工程。新视频必须先保护现有活动工程；不能把导入命令当作无损新建工程。

## 工具

- `open_workbench {}` 只启动/复用服务并返回 URL，不切换素材。使用 `open_in_codex` 等现有浏览器面板能力展示该 URL。
- `read_project {section:"summary"}` 是常规入口。`production` 返回完整方案；带 `sceneId` 只返回该段与编辑信息。`cut` 返回剪辑及词时间。
- `read_project {section:"storyboard"}` 返回整片真实关键帧、当前/历史样片标记、画面观察及设计描述相似提示。读取不会生成画面；没有关键帧时先执行下表的 production/storyboard。图片在本机返回的 frame.url，先实际查看再记录观察。
- `read_project {section:"visual-library",query?}` 读取新资产、风格包、参考、favorites、活动任务及当前可用的 replacementMedia。候选和可用资源分开看状态。`references` 只返回参考列表和进展；query 按用途、名称等文字筛选。
- `read_project {section:"visual-asset",member:{id,version}}` 读资产与真实模块详情；`style-pack` 用相同 member 读风格包。也可改用独立 `id`、`version`，两种写法不能混用。
- `read_project {section:"animations"}` 读取「我的动画」目录，包含保存版本、模块与按顺序排列的 cue；不是旧组件目录。
- 旧 `library` 仅返回新库 ready 资产与包，不返回旧 194 项。`component` 需 componentId，仅为历史工程兼容读取；不能用历史组件恢复新选型入口。
- `update_project {operation,expectedRevision,data}` 只接受下表公开操作。修订号有三个独立域：`cut/*` 对应 cut.revision，`production/*` 对应 plan.revision，`visual-library/*` 对应库 revision。不得用数字恰好相同推断来源。
- 所有生产/粗剪写操作会先检查 selection.hasUnsavedChanges；制作身份强制为 Codex，不能冒充用户解锁。库操作也读取当前 selection，并在结果的 projectSelection 提醒现有草稿，但不会用 production revision 拦截独立的库工作，也不替用户保存、丢弃或覆盖本地草稿。reference-prepare 与 cancel 即使服务端不使用 revision，桥接仍核对库 revision。
- `render_segment {sceneId,expectedRevision}` 返回后台任务；`read_project` 的 segmentReviews.latest 查看状态和视频 URL。帧区间 from/end 是左闭右开，包含分配的停顿。
- `approve_segment {sceneId,key,renderId,userConfirmed:true}` 必须对应用户已看过并认可的版本。key 与 renderId 来自该段 latest/history，不使用全局最近 sample 推断。
- `assemble_video {expectedRevision}` 要求 assemblyReady，复用确认画面，不再次调用模型或重制动画。

`read_project {section:"checkpoints"}` 读取备份清单和任务。`update_project` 的 checkpoints/create、verify、restore 使用当前 plan.revision；create 的 data 可含 label（80 字内），verify/restore 的 data 为 `{id:备份ID}`。后台任务从 checkpoints.task 读取；done 才能说完成，verified 只是文件校验。恢复只创建配对的新 code/project 目录，不切换活动工程，不接受浏览器目标路径。

## 常用修改 data

| operation | data |
|---|---|
| production/parameters | `{sceneId,patch:{参数名:值}}` |
| production/event-edit | `{sceneId,eventId,offsetFrames?,durationFrames?,wordId?,reset?}`；eventId 来自 summary/production.timelineEvents；调整相对词的偏移或重绑，显式声明的动作才可改时长。保留其他字段，expectedRevision 为当前制作修订 |
| production/editor/command | `{operationId:UUID,sceneId,objectId,changes:[{kind,key,before,after}]}`；共享画布编辑协议，见下方说明 |
| production/editor/undo、production/editor/redo | `{operationId:新的UUID,targetOperationId:原操作UUID}`；只能重放自己身份的操作，不能撤销用户调整 |
| production/scenes | `{source:当前plan.source,scenes:完整场景数组}`，先读取完整方案再只改目标段 |
| production/request | `{request:{id,sceneId,description,reason,status:"missing"}}` |
| production/feedback | `{feedback:{sceneId,timeMs,text}}`，timeMs 是全片毫秒 |
| production/resolve-feedback | `{id}`，仅已实际处理的反馈 |
| production/rebase | `{}`，粗剪变化后重新绑定前先检查文稿与失效引用 |
| production/undo | `{}`，仅无新对象命令日志的旧工程可用；不等于还原代码 |
| production/cancel-render | `{id:正在运行的任务ID}` |
| production/visual-asset | `{member:{id,version},sceneId,values,cueBindings:{cueId:真实wordId},trial:true}`；候选必须明确 trial，可用资产可省略。应用 SCENE 或可支持的 OBJECT 资产，TRANSITION 需先编排相邻画面 |
| production/style-pack | `{member:{id,version},mode:"preview"}` 返回 affected/conflicts/coverage/brief/selection/scenes；审阅覆盖与保留设置后，以相同方案 revision 提交 `mode:"apply"`。可先选择创作方向，再适配尚未映射的原创场景；不强行覆盖用户设置 |
| production/follow-style | `{sceneId}`，将该段未锁定的基础样式跟随当前包；只处理有 styleBindings 的字段。Codex 身份保留所有用户 overrides；用户在工作台点按钮时可清除未锁定样式覆盖，内容与位置等非样式字段保留 |
| production/storyboard | `{}`，从已有成功样片提取每段最多三张真实关键帧，不重新制作视频；耗时期间不要重复提交。返回更新总览 |
| production/visual-review | `{sceneId,key,renderId,frameIds:[真实帧id],style:"consistent"或"revise"或"unreviewed",composition:"distinct"或"intentional-repeat"或"revise"或"unreviewed",note,comparedTo?:[{sceneId,key,renderId,frameIds}]}`。只引用当前样片及实际查看的图片；未做相邻对照不填写 comparedTo。不是段落确认 |
| production/animation-templates/save | `{name,sceneId,expectedSourceHash}`，保存当前段落可复用动画；sourceHash 取该段当前模块信息，不能用过期源码快照 |
| production/animation-templates/preview | `{id:保存动画ID,sceneId,bindings:[目标wordId,...]}`，按目录 cues 的顺序绑定当前目标段落词；先检查返回的实际预览与媒体要求 |
| production/animation-templates/apply | 同 preview，写入目标段落。先预览并检查真实目标内容，保留当前用户参数与锁；保存文件不等于已应用 |
| cut/import | `{path:"用户指定的本地绝对路径"}`；保护当前项目，再导入，不能当作新建工程 |
| cut/ranges | `{ranges:[{startMs,endMs}]}`，是保留的原素材区间，不是要删除的区间 |
| cut/clips | `{clips:完整片段数组}`；从当前 cut.timeline 读取，只改目标片段的范围/属性/顺序，保留稳定 ID。新插入使用新 ID，不伪造 wordIdentity |
| cut/split | `{clipId,sourceFrame}`；sourceFrame 是该素材 30fps 帧位置，必须处于片段内部的词间；服务器生成新片段 ID 并保留词身份 |
| cut/transcript | `{words:[{id,text,startMs,endMs}]}`，源词 ID 要稳定 |
| cut/transcribe、cut/render、cut/undo | `{}`；转写和渲染可能为耗时任务，应查看状态而非连续重复提交 |

## 直接对象编辑

有 `capabilities.objectCommands` 时，summary/production 返回 `editorSnapshot`（制作与剪辑 revision、模块身份、hasCommands）和 `editorHistory`（用户操作摘要）。目标段落的 editor 返回对象参数与声明；`scene.editor.objectTransforms` 是按稳定对象 ID 保存的 x/y/scale/rotation 覆盖，`objectLocks` 保存对象锁。保留用户的 overrides、参数锁、对象覆盖和对象锁；不要通过改作者布局或硬编码绕开它们。

`editor/command` 的 kind 支持 transform、parameter、objectLock、parameterLock、visibility、layerOrder。transform 的 key 为 x/y/scale/rotation，位移为视频逻辑像素，scale 为 0.05–8，旋转为度；parameter 的 key 属于该对象的参数；objectLock 的 key 为 locked，parameterLock 的 key 为参数名，锁值为布尔。before 必须对应已读取的有效值；after 为目标值。多字段同一操作共用 operationId。

一次新操作使用新 UUID；网络结果不明时原样重试同一 operationId 与请求，不更换 before 或 revision。桥接允许这三项命令把较旧制作 revision 交给后端，由字段比较、锁和幂等回执决定能否接续；未来 revision 拒绝，其他制作操作仍要求当前 revision。同字段冲突不能用盲目更新 before 值来覆盖。undo/redo 使用新 operationId 与原 targetOperationId，仅能重放自己的 Codex 操作；用户操作由用户在工作台撤销。

原生场景的对象可声明 `canvas:{transform:true,text:"文字控件key"}`，并用 `EditableCanvasObject` 包住布局，把作者帧动画留在内部。不是任意 HTML/Canvas 像素自动可编辑；准确边界和示例见工作台 `docs/implementation/2026-10-22-direct-object-editing.md`。新工具架构仍需对应插件产物/宿主会话加载，不能声称当前会话自动热更新。

B 阶段增加 `visibility`（key 为 visible，布尔 before/after）与 `layerOrder`（key 为 siblings，同级对象 ID 数组 before/after）。只有声明 canvas.visibility/reorder 的对象支持；顺序从后向前，必须为完整同级排列，不能改变父级。当前值通过 `objectVisibleFor`、`objectOrderFor` 等共享函数计算，不能猜省略字段。`objectVisibility`、`objectOrder` 与变换、用户覆盖和锁一并保留；父组锁保护子对象及受排序影响的对象。用 editor 命令调整，不能通过改 DOM 或替换整份场景绕过保护。

## 参考与视觉库修改 data

以下操作均使用 `read_project {section:"visual-library"}` 返回的 revision。

| operation | data |
|---|---|
| visual-library/reference | `{reference:{path:"用户指定的本地绝对路径",name?,sourceUrl?}}`，复制进参考库，不替换当前剪辑工程；工作台也支持选文件导入 |
| visual-library/reference-prepare | `{referenceId}`，后台准备播放副本和抽帧；读 references 查看 stage/progress/error |
| visual-library/reference-analysis | `{referenceId,analysis:{summary,visualInspected,audioInspected,style,segments:[{id,startMs,endMs,purpose,observations,objects,motion,trigger,dependencies}],uncertainties}}`；时间均为参考源毫秒，检查标志仅填实际完成项 |
| visual-library/asset | `{asset:下述资产对象}`，保存新的固定版本；不能覆盖同 id/version |
| visual-library/asset-preview | `{member:{id,version},kind:"reference"或"replacement",values,durationFrames,cueFrames:{cueId:局部帧},referenceId?,materialSceneId?}`；referenceId 仅给原效果，replacement 使用当前连续粗剪 |
| visual-library/asset-review | `{member:{id,version},review:{previewId,kind:"visual"或"reuse",note}}`，引用实际成功样片；这是检查记录，不是用户认可 |
| visual-library/pack | `{pack:下述风格包对象}`，保存新的固定成员集合 |
| visual-library/pack-preview | `{member:{id,version}}`，使用符合包内风格参数的成功成员样片，后台生成真实连续演示；缺少样片时先补齐，不用列表冒充连续效果 |
| visual-library/favorite | `{member:{id,version},favorite:true或false}` |
| visual-library/cancel | `{jobId:active.id}`，停止当前参考准备、资产样片或风格演示任务；已有成功结果保留 |

库后台任务通过 visual-library.active 和资产 previews 或参考 stage 轮询，失败/取消需报告原错误并修正原因再重试。风格演示的 active.kind 是 pack；完成后包详情的 demonstration 包含真实 URL、输出指纹及成员样片来源。没有 demonstration 不宣称连续演示完成。取消本身不等于删除产物或恢复源码。

资产对象字段：

```text
id, version(1.0.0), name, description,
kind(component|effect|recipe), mount(OBJECT|SCENE|TRANSITION), requiresSourceMedia, previewBackground,
source({kind:"authored",note} 或 {kind:"reference",referenceId,startMs,endMs,observations}),
tags[], controls[], objects[{id,label,parameters[]}], cues[{id,label,required}],
mediaSlots[{id,label,kind:image|video|either,required}], styleBindings{参数key:tokenKey},
contentParameters:[内容控件key],
constraints{aspectRatios:["16:9"],minFrames,maxFrames,notes}, sampleValues{}, dependencies?{包名:精确版本}, code
```

`code` 导出 `VisualAsset`。React/Remotion 是隐式依赖；其它动画导入通过 `dependencies` 声明，先读 visual-library.capabilities.runtimeDependencies 取得本机实际包名、版本及可用性。本版提供 Three.js、React Three Fiber 和 Remotion ThreeCanvas；运行所需包缺失或版本不符时先由维护者恢复锁文件，资产保存不会自动安装。媒体从 mediaSrc/materials 取得；不接受自由路径、服务端包或动态 require/import 调用。requiresSourceMedia 声明主视频，mediaSlots 声明独立素材；真实文件绑定与 required 检查保持不变。

controls 是有 key/label/type/required/default 的判别对象；text、color、boolean 各用对应默认值，number 可加 min/max/step，select 用 options 与其中一个字符串默认值，list 用 itemType:text|number、minItems/maxItems 与同类型数组默认值。values/sampleValues 是标量或文字/数字数组；不能把数组拼成字符串。`previewBackground` 是六位预览底色，默认 #F1F1E8；`contentParameters` 明确哪些控件表示内容，换内容检查只使用有效内容参数、声明所需的主视频和实际素材槽；未使用的附带视频不计为复用差异。语义事件的标识在资产预览中作为 beats 的 label 和 wordId，应用后 cueBindings 映射到真实稳定词 ID。

风格包对象包含 `id,version,name,description,source,members:[{id,version}],tokens,typography,motion,composition,sound,coverage[],limitations[],overrides`。overrides 的键为 `资产id@版本`，值为该成员参数覆盖。它固定引用本机版本；当前没有风格包跨机器安装文件。参数与细节的权威合同在配置工程的 `workbench-local/visual-library-contract.ts`。

检查顺序：实际参考观察 → 原效果技术样片 → 换真实内容技术样片 → 记录 visual/reuse → 用户在工作台选定可用。原效果和 replacement 都是静音；需在正式段落另查原声与同步。asset-status/pack-status 不在 update_project 白名单；也不接受 data.userConfirmed。不要通过直接 HTTP、改 JSON 或其它工具绕过用户选定。`accepted` 只由明确用户选择产生，不能由模型自评填入。

新库默认为空。需要仓库的五项原创几何示例时，由用户明确选择后运行配置工程的 `node examples/paper-style/import.mjs`；不会自动安装或设为 ready。旧 194 项源码在 `modules/legacy/`，只供历史兼容。

段落素材上传在工作台完成，或按已有接口绑定真实文件。不能将 request.status 手改为 provided 冒充上传成功。新资产媒体绑定按库详情和 `SCENE_MODULES.md` 处理；旧组件仅维护已有工程。

## 动画代码

原创项目场景直接在 `workbench-local/scenes/` 编写 TSX 与清单，用 production/scenes 绑定当前段落；不必先入库。清单可声明 dependencies 和 styleBindings，准确协议读项目 `SCENE_MODULES.md`。设计与实现沿用 Remotion，按需要使用 SVG、Canvas、着色器、ThreeCanvas。先实现代表创意的镜头，再补齐必要的对象参数与口播绑定；交付前保护用户覆盖和锁。认可后可保存动画或提炼新库资产，不用几个固定场景替代创作。

风格适配依据 summary/production 返回的 stylePackInfo：brief 提供文字、运动、构图、声音方向；coverage 指出已映射、部分映射、保留设置和待设计段落。声明相同 token 的原创资产无需加入包成员；专用预设仍限成员。参数映射不生成构图或音乐，也不表示实际画面已通过。

stylePackInfo.tokens 是固定包的共同样式值，`coverage.scenes[].values` 列出每个映射字段的 expected、effective、source 与 locked。字体、字号、线宽、圆角、间距、时长及缓动可以使用相同机制。优先级为共同默认值 → 段落显式参数 → 用户 overrides。新段落在预览、渲染和参数检查时自动继承；共同样式不要再复制成段落显式参数，否则后者会被保留为差异。未声明绑定或未实际读取该参数的代码需要 Codex 适配，不能靠填报映射宣称统一。

全片分镜放在现有包装页，可折叠、放大、选择前中后三帧并跳到具体段落。设计描述相同只提示复查，不按组件 ID 判定重复、不强迫更换构图。Codex 需对照真实画面检查视觉语言与表达变化，并播放检查节奏；无视觉能力只做准备和结构检查。观察保存在 production/storyboard/reviews.json，与用户确认独立；段落、样片文件或对照来源变化后自动标为历史观察。只更新受影响段落，继续沿用用户逐段确认与最终合成。

段落 schema 与 design 对象参考 `production-store.ts`、`creative-design.ts`；参数与锁定参考 `editable-objects.ts`。只保存设计文字不会自动产生动画。

存在共享模块时修改代码可能影响多段，先核对调用者与确认状态。确认记录 `projects/local-workbench/production/segment-reviews.json` 和关联 renders 是成果资产，不可当缓存删除。旧视频可查看不等于完整源码一键回滚。

## 保存与恢复边界

命名工程备份捕获实际代码、依赖锁与配对工程：作者场景与静态依赖、overrides、参数/对象锁、变换/图层、口播事件、操作日志、素材与固定视觉库版本均在范围内。新备份清单给出来源工作台版本、粗剪/制作 revision 及代码/工程/配对 SHA-256；这些摘要取自已捕获文件。旧 schema 1 无摘要备份继续校验与恢复。单独回退 production.json 或打开旧视频，不是源码恢复。

恢复必须从新副本的 code 启动，并把 WORKBENCH_PROJECT_DIR 指向同份副本的 project；先按锁文件安装运行依赖，另配 FFmpeg/浏览器/合成器。不要把恢复出的 project 直接交给当前最新代码，或将恢复插件中的 local-config.json 原路径当作新副本路径。完整指令见 RECOVERY.md。根 scripts/assets/docs 不在工程快照内，README 演示重建需用 Git 对应版本。


新 SCENE 资产可通过现有保存动画链路捕获固定源码、解析后的样式、语义 cue 与真实素材；应用时重新绑定目标词并重映射素材。包含新库 OBJECT 的嵌套 `.cutanimation` 暂时拒绝保存/打包，不能输出缺实现的伪成功包。风格包当前也没有独立安装文件。

活动库为 `<WORKBENCH_PROJECT_DIR>/visual-library/`，与代码和项目配对备份。库内一个 RenderLane 串行处理准备、样片和包演示；先完成或取消任务再备份。参考原件、代理、分析来源区间和样片均校验身份；读取数据索引不执行资产代码。完整说明见配置工程的 `docs/REFERENCE_LIBRARY.md` 与 `workbench-local/RECOVERY.md`。

## 工具未加载时

新安装插件通常需新任务加载。当前任务可用同一插件的脚本入口：

`node <插件根>/scripts/bridge.mjs workbench_status`

`node <插件根>/scripts/bridge.mjs read_project '{"section":"summary"}'`

命令与 MCP 共用 invoke，不修改凭据或扩大任意 shell/HTTP 访问。不要把脚本成功说成当前任务已经加载了 MCP。
