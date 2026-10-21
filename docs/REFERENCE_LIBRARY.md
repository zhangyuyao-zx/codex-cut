# 参考提炼与视觉资产库

2026-10-21 · v0.2.1 实现说明。首轮支持 16:9；用户选择和影片审阅状态见[执行记录](plans/2026-10-21-reference-distillation-style-packs.md#11-执行记录2026-10-21)。

Codex 负责实际观察、内容理解、创意与代码；本地工作台负责素材、时间、参数、版本、渲染和确认记录。整片仍按「粗剪 → 视觉段落 → 视觉对象 → 信息布局 → 包装设计 → 动画实现」推进。选风格包后，仍需根据当前文稿重新设计重点、构图、素材和出现顺序。

项目原创场景与库资产是两种入口。可直接为当前内容编写 TSX、接上预览与参数，再按用户反馈修改；不必先完成资产入库。参考可提炼为风格、基础动作、对象关系和镜头衔接，也可形成完整场景。详见[连续场景原创示例](../examples/continuous-scene/README.md)。

## 从空库开始

顶部「视觉资产库」有三个范围：风格包、单项资产、对标与提炼。候选和可用状态分别展示。新工程的库默认为空；旧 194 项已经移至 `modules/legacy/`，只供历史工程解析，不参与新选型或推荐。

仓库提供五项可公开的原创几何示例，明确需要时，先启动工作台再在根目录执行：

```sh
node examples/paper-style/import.mjs
```

独立服务可指定 `WORKBENCH_URL=http://127.0.0.1:4341`。导入仅登记候选和固定成员风格包，不修改粗剪/制作方案、不设 ready。示例说明见 [paper-style](../examples/paper-style/README.md)。仓库的[风格演示](../assets/readme/style-pack-demo.mp4)只含原创几何与通用内容，不包含私人参考帧、人物、逐字稿或音乐。

## 参考提炼和验收

1. 导入参考并准备播放副本、抽帧。参考复制到活动工程的库内，不替换当前剪辑素材。
2. 实际观察选定范围的完整运动与关键状态，记录来源区间、对象关系、构图、动作、触发和不确定项。未试听保持 `audioInspected:false`；稀疏抽帧不能证明完整运动或声音已检查。
3. 独立重建可编辑候选。来源只说明可观察依据，不表示获得原工程或唯一制作方法；参考水印、整帧截图、品牌画面不能冒充可复用实现。
4. 生成原效果与不同内容的技术样片并分别查看。原效果绑定参考来源区间；replacement 使用当前连续粗剪，从第 0 帧开始。样片为静音，原声与同步在正式段落另查。
5. 记录 `visual` / `reuse` 检查。换内容必须改变声明的内容参数、声明所需的主视频或实际素材槽；未使用的附带视频、只改颜色、时长或出现点不足以证明复用。
6. 用户在工作台明确选定具体版本后，才可转为 ready。风格包还需要成员均 ready、真实连续演示存在且用户选定。资产选择不替代影片逐段确认。

资产状态为 `draft | review | ready | archived`；包状态为 `draft | ready | archived`。渲染和模型自评不会产生 `accepted`。普通插件桥接不公开 `asset-status` / `pack-status` 操作，不能通过直接 HTTP、改 JSON 或其它入口冒充用户选定。

## 资产协议

权威字段见 [visual-library-contract.ts](../workbench-local/visual-library-contract.ts)，保存入口为 `/api/visual-library/asset`，body 使用 `{expectedRevision,asset}`。

| 字段 | 含义 |
|---|---|
| `id`, `version`, `name`, `description` | 稳定标识与语义版本，如 `example@1.0.0`；已有版本不可覆盖 |
| `kind` / `mount` | `component | effect | recipe`；`OBJECT | SCENE | TRANSITION` |
| `source` | 原创 `{kind:"authored",note}`，或参考 `{kind:"reference",referenceId,startMs,endMs,observations}`；区间为源毫秒 |
| `requiresSourceMedia` | 是否需要真实主视频，不能用空白结果替代缺失素材 |
| `previewBackground` | 六位颜色，默认 `#F1F1E8`；预览底色与资产自身是否绘制背景分别处理 |
| `controls` / `sampleValues` | 控件和样例值，支持 `text/number/color/boolean/select/list` |
| `contentParameters` | 控件 key 数组，声明哪些参数表示内容；用于比较原效果与换内容身份 |
| `objects` | `{id,label,parameters:[key]}`，映射可编辑对象 |
| `cues` | `{id,label,required}`，稳定语义事件；应用时绑定当前真实词 ID |
| `mediaSlots` | `{id,label,kind:"image"|"video"|"either",required}`，独立补充素材槽 |
| `styleBindings` | `{参数key:tokenKey}`，将包 token 映射到资产参数 |
| `constraints` | `aspectRatios:["16:9"],minFrames,maxFrames,notes` |
| `code` | 导出 `VisualAsset` 的确定性 React/Remotion 源码 |
| `dependencies` | 可选 `{包名:精确版本}`，固定本机已支持的浏览器动画运行时 |

select 使用 `options` 与其中一个字符串默认值；list 使用 `itemType:"text"|"number"`、同类型数组默认值及 `minItems/maxItems`。列表保持数组，不拼成字符串。标量与列表参数同时接通校验、编辑、保存与渲染。

`VisualAsset` 接收与场景一致的 `parameters/title/from/duration/words/beats/mediaSrc/materials`。预览用 `cueFrames` 指定局部帧，事件 id 作为 beat 的 label/wordId；制作使用 `cueBindings:{cueId:真实wordId}`，由当前粗剪映射局部帧。缺失、删词、越段和时长不足明确报错。

React/Remotion 是隐式依赖；可在 `dependencies` 声明当前运行时支持的包，准确可用性见 `/api/visual-library` 的 `capabilities.runtimeDependencies`。本版支持 `three@0.186.1`、`@react-three/fiber@9.8.2`、`@remotion/three@4.0.489`。导入哪个包就声明哪个包；宿主同时验证其运行所需的固定版本依赖。资产保存不联网安装包。未声明、缺失或版本不符会在使用前给出明确错误。资产不接受任意路径、服务端包、动态 import 或 require 调用；这不是任意 JS 的安全沙箱。

项目原创场景也要在清单中声明这些动画依赖；检查覆盖入口及递归本地代码。预览、段落导出与保存动画采用相同精确运行时，依赖摘要参与结果身份。旧资产不声明依赖时保持兼容。媒体仍经明确输入绑定，目录读取不执行资产代码。

## 素材和段落应用

插件 `production/visual-asset` 使用 `{member:{id,version},sceneId,values,cueBindings,trial:true}`。非 ready 候选必须明确试用；归档资产拒绝应用。`SCENE` 成为 program，并为素材槽创建 `visualSlot:{moduleId,slotId}` 请求；在工作台补充真实文件。无素材槽的 `OBJECT` 可普通添加；带槽 OBJECT 需要 Codex 明确 `mediaBindings` 后提交段落。`TRANSITION` 需编排相邻画面，不能直接当叠加对象加入。

库样片可提供 `materialSceneId`，从该段落已提供的对应素材槽或明确组件媒体绑定读取素材。必需槽缺失、类型不符或视频不足长会拒绝渲染。不能仅把请求状态改为 provided 冒充上传。

`requiresSourceMedia` 声明主视频需求，`mediaSlots` 声明独立补充素材，二者不混用。详情与实际段落渲染共同验证绑定，不能以目录字段存在宣称素材已展示。

## 风格包和用户修改

包包含 `id,version,name,description,source,members,tokens,typography,motion,composition,sound,coverage,limitations,overrides`。`members` 固定资产版本；`overrides` 的 key 为 `资产id@版本`。文字、运动、构图与声音字段是使用规则，声音规则本身不会生成音乐或音效。

`production/style-pack` 先以 `{member,mode:"preview"}` 查看 `affected/conflicts/coverage/brief/selection/scenes`，核对影响后再以同一 production revision 提交 `mode:"apply"`。有明确 `styleBindings` 的原创资产与项目场景都可以使用包 token，不要求成为包内成员；成员专用 overrides 仍限固定成员。原生场景清单同样支持 `styleBindings:{控件key:tokenKey}`。

覆盖报告逐段区分已映射、部分映射、尚未适配、待实现和冲突，并列出被保留的已有参数。没有参数能自动映射时仍可先设为创作方向，再按风格编写原创场景。插件 summary 返回 `stylePackInfo.brief/coverage`，便于 Codex 延续整片方向。参数映射不是视觉验收：字体、材质、镜头、运动、密度及声音由 Codex 按实际内容实现并审阅，不从几段相同模板推导全片。

生效顺序为风格默认值 → 已保存显式参数 → 用户 `editor.overrides`。用户锁继续限制 Codex 写入；草稿、revision、素材、词绑定与渲染指纹的过期保护保留。库升级新增版本，不自动替换已用版本。

`pack-preview` 使用符合包样式的已成功成员样片生成真正连续视频，`demonstration` 保存输出哈希和成员样片来源。只有若干独立样片或一份规则说明不能宣称完成连续演示。

## 保存、备份和运行边界

活动库位于 `<WORKBENCH_PROJECT_DIR>/visual-library/`，包括 `library.json`、`assets/<id>/<version>/Asset.tsx`、`references/` 和 `previews/`。资产源码保存 SHA-256；参考原件、代理、分析来源、区间和样片身份均参与检查，变化后应重新导入或保存新版本。库使用一个 `RenderLane`，串行管理参考准备、资产预览和包演示；活动任务、取消、失败与重试通过库状态查看。

cut、production、visual-library 各用自己的 revision，不混用。库写入保留本地参数草稿；制作写入仍检查未保存修改。中断任务重开后明确显示失败，不伪装完成。

新 `SCENE` 资产可以通过现有保存动画链路捕获源码、语义 cue、已解析样式与实际素材；复用时重新绑定目标词并重映射素材。包含新库 `OBJECT` 的嵌套 `.cutanimation` 暂时拒绝保存/打包，避免形成无法独立恢复的引用。独立可分发风格包文件也不在本轮范围。

备份必须配对代码、项目与项目内视觉库；页面和 CLI 快照已包含 `visual-library`。运行时依赖另行配置。操作见 [RECOVERY.md](../workbench-local/RECOVERY.md)。公开 Git 只保存协议、实现与原创示例；用户参考、媒体、文稿和渲染保留在忽略的项目目录。

## 插件操作入口

仍为 7 个工具。`read_project` 增加 `visual-library/visual-asset/style-pack/references`；`visual-asset` 和 `style-pack` 按 `{member:{id,version}}` 读取。旧 `library` 仅返回新库 ready 资源，`component` 仅服务历史兼容。

参考、资产、风格包的写操作通过 `update_project` 现有白名单执行；精确 data 字段见[插件操作说明](../workbench-local/plugin-package/codex-cut/skills/video-workbench/references/operations.md)。所有视听检查、用户选择、逐段认可和正式合成分别记录。
