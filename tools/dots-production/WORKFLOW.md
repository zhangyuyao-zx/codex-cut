# Dots 制作：从材料与样片推进

这是新工程唯一的制作流程入口（2026-11-08，authoring schema 2）。新流程替代“先写齐全片逐段动作 JSON，再验证文件齐全”的默认路径。既有 schema 1 工程继续读取保存版本，操作见 [历史协议](legacy/NATIVE_AUTHORING_V1.md)；不自动改写正在制作或已验收的影片。

目标是形成达到本期已确认标准的实际画面。检查器只保护输入、依赖、版本和流程次序。**技术有效、作者已看片、用户已认可，始终是三个不同状态。** 不承诺工具自动鉴定美感，也不把写出一段自评当作视觉能力。

## 开始与接续

读取当前原生工程、采用稿、声音、用户覆盖/锁和未处理反馈。保留本期已确认参数；新内容使用本机当前声音配置。核对实际 projectDir/contentId、运行服务的 gateVersion，不凭旧聊天猜状态。

使用 `studio standards` 读取当前完整采用标准（13条导演经验、9项美术设计和15项后续决定）。标准唯一维护在 `studio/standards.json`，部件及实片定位见 `studio/CRAFT.md`；不要从旧目录索引、历史复盘或聊天记忆选择另一套默认流程。运行服务的能力版本须为2；旧工程仍按保存的schema兼容读取。版本不一致时先完成空闲升级再新建制作，不以插件文件已更新代替服务更新。

`production/production.json`（通过原生接口维护）负责分镜、词锚点、设计意图、参数、声音、反馈和用户版本。`production/authoring.json` 只保存未被原生工程承载的选材、参考、代表样片关系与实际观察。可运行场景代码负责具体造型和动作；不再另写同一动作状态表、全片脚本及词时间副本来证明代码“符合设计”。需要复杂状态机时可选用 1.3 的 `viewAt`，它是实现手段，非每段填表任务。

## 实际制作顺序

1. **全片简排。** 读完整文案，原生分镜写理解任务和顺序；简表每段只写一句具体观看任务。比较哪些段落是连续推进、哪些是不同表达。此时不编造详细物件和完整动作。尚未实现的后续段落不阻止代表样片。
2. **先找到能说明内容的材料。** 真实人物、公司、机器、产品和事件，主动检索直接相关的原图、原片、界面、数据及原始资料。先检查来源、内容、分辨率和真实边界，再决定构图。真实材料需要承担相应的可见证明；文章标题或公司 logo 不能替代实际产品和业务细节。抽象机制有理由使用图解；不为了“有真实素材”硬配无关照片。选材细则见 [FACELESS](../../workbench-local/methods/FACELESS.md#真实素材优先先选材再定具体构图)。
3. **用本期难点做代表。** 根据不同表达任务选择代表段落；开头获认可不代表产品演示、历史现场和抽象机制也已验证。给本段具体编排造型、字体块面、内部事件和注意力，直接用真实内容制作完整起态/过程/终态，再渲染带声片段。其他段落仍可停留在简排。素材或造型尚未找到时，继续相关研究，不能批量生成通用卡片当占位成片。
4. **实际对照后再扩展。** 先看本期真实输出，再看适用的已认可基准及原片区间。比较整幅重心、字重字级、框内构成、细节、动作落稳、节奏和接点；在手机观看尺寸复看。具体差距需要处理；独立表达不能通过换标题、左右或颜色宣称复用成功。代表段落自查未完成，原生入口不会允许依此扩展或渲染整片。作者完成这些工作，不给用户新增表单或审批环节。
5. **整片编排与审阅。** 使用同一种材料、持续解释同一个对象可以有意复用；不同任务仍按语义选择载体。实际比较相邻和同类段落，并连续回看整片。稳定阅读有任务才保留；字幕变化、无关循环和整图漂浮不能充当叙事推进。按既有逐段认可、合成、整片回看和最终交付流程执行。

制作阶段始终使用 [具体画面与部件索引](studio/CRAFT.md) 查代码和对应真实实例。共享颜色、字体、圆角、局部材质和运动性质；不提供默认 `Top + 方框 + Arrow` 整场骨架。布局由对象和观看任务确定。特别复杂的段落回查 [导演判断](DIRECTING.md)，无需每期重做原片研究。

## 一份制作记录

新独立工程由原生初始化产生 schema 2 空记录。建立原生分镜后运行：

```sh
npm run dots -- studio sync --project /path/to/project
npm run dots -- studio reference --project /path/to/project --registry /path/to/reference-registry.json --id selected-reference
npm run dots -- studio asset --project /path/to/project --id product-ui --file /path/to/ui.png --source '来源页面及截图日期' --supports '本图能直接看见的具体内容'
npm run dots -- studio resume --project /path/to/project
```

`sync` 保留已有设计和历史，不替作者填写观看任务，不动原生分镜、声音、锁和用户确认。`asset` 固定真实文件哈希。原始材料保留；需要公开目录副本时按同一字节或单独登记裁切后的身份，保留原件出处。场景通过字面量 `staticFile('…')` 或本地导入消费它，便于核验真实依赖。动态外部 URL 不作为已固定的素材证据。

记录示意（省略后续段落，文件路径相对于 `production/authoring.json`）：

```json
{
  "schemaVersion":2,"method":"dots","contentId":"CYYYYMMDD-NNN",
  "assets":{"product-ui":{"file":"/actual/ui.png","sha256":"actual-hash","source":"source","supports":"visible evidence"}},
  "references":{"chosen":{"file":"/actual/reference.mp4","sha256":"actual-hash","from":25,"to":32,"learn":"内部事件接力","avoid":"不能只复制外壳"}},
  "scenes":[{"sceneId":"s01","visualTask":"让观众看见同一张发票中哪些字段待核对","mediaMode":"real","selectionReason":"真实处理页面包含原单、提取字段与警告","assetIds":["product-ui"],"referenceIds":["chosen"],"prototypeSceneId":"s01"}],
  "reviews":{},"comparisons":[]
}
```

`mediaMode` 是 `real / illustration / abstract`；原生分镜及 `design/beats/program` 仍是时间和实现入口。`prototypeSceneId` 指本段表示先试作；指另一段时补 `reuseReason`，并须有那段当前有效的实际观察。代表之间不可循环。文本是作者的判断，不是自动审美分数；不能靠改字段名称掩盖没有实际比较。

读取 `production.authoring.nextAction`，按当前步骤推进。`technicalValidation:valid` 仅表示技术条件满足，`visualJudgment:not-automatically-assessed` 明确表示工具没有判定美术。`sceneStates` 说明是否已有当前作者观察，不代替用户认可。

## 样片的证据与观察

通过原生 `render_segment` 生成实际样片后，工具直接读取保存的 render 身份，不手抄 key、时长或哈希：

```sh
npm run dots -- studio capture --project /path/to/project --scene s01 --render actual-render-id --times 0,1.6,3.2,5.8 --out /path/to/new-review
```

输出实际视频副本、所选真实帧、适用参考片段、`capture.json` 和空白 `review-draft.json`。缺省取帧只提供导航，观察关键过程时主动选择对应时点。`capture` 不修改工程，不自动填通过，不声称已看视频或听声音。看完后把本段观察放进唯一制作记录 `reviews.s01`；无需再维护审片规格、六项表、节奏说明等四份互相复制的文件。

观察含 `capture` 路径、`playback:{from:0,to:实际时长,rate:1,observed}`、`targetWidth`、`findings:[{at,topics,observed,decision,status}]`、`referenceComparisons:[{id,at,topics,observed}]`、`audio:{status,observed}` 和 `verdict`。`topics` 对应 capture 给出的实际比较维度；一条观察可覆盖多项，不再另建质量表。参考比较须覆盖构图、字体、物件细部和运动，不仅比较解释含义。`status` 为 `retain / fixed / revise`，`verdict` 为 `unreviewed / revise / candidate`。只在处理所有本期关键差距后选 candidate。观察须落到具体物件、时刻和可见现象，不能复制问题或批量写“已按风格设计”。静帧、原速播放、抽帧序列和听辨分别如实记录；缺乏某种观察能力时保留未完成，不能靠填写范围补出事实。已有schema 2样片若缺新版对照提示，重新capture并实际补查即可，图片与声音未变时无需重渲染。

素材、源代码、参考、原生段落或采用样片改变，会使相关身份失效；修改审阅措辞本身不会强制重渲染。用户认可仍由原生批准记录维护，作者不得写 `userAccepted:true`。

相邻实片比较写入 `comparisons:[{scenes:[{sceneId,renderId,key},{sceneId,renderId,key}],observed}]`。同类新段落在记录中与其代表比较；如果实际表达已超出代表覆盖范围，把本段作为新代表试作。合成后同样用 `studio capture --scene film` 取当前整片证据，观察放进 `filmReview`；实际混音听辨完成后才可最终自检结束。

## 对话审阅与交付

用实际视频和关键画面直接在对话中交付审阅，沿用用户现有的逐段及整片认可。`studio capture` 返回 `media` 和可直接引用的 `chatMarkdown`，不增加审批节点。优先使用客户端支持的内嵌视频、图片或附件，说明版本和时长；网页只是辅助入口。用户在手机端时不能只给本机网页、`localhost`或磁盘路径，并声称手机可以访问。当前客户端确实无法播放或传递视频时如实说明，提供可查看的关键画面并保留动态审阅未完成；未获授权不把私人媒体上传公开服务。

## 哪些东西不再作为默认要求

- 新工程不要求 `prepare → 全片编排.json → 每段动作脚本.json → words.json → bind-native`。这些接口保留在 legacy 路径，服务已有作品及主动选择复杂状态脚本的开发任务。
- 不用“某 JSON 导入了代码”冒充画面实现；实际源文件/媒体纳入原生渲染身份，并检查采用素材是否属于实际代码依赖。是否被正确展示仍看实片。
- 不以“六个质量字段写满”“每两秒有动作”“必须几种布局”证明质量。技术诊断需要时调用；不能消耗主要精力补表，而跳过具体造型。
- 研究保持独立，仍用 `tools/reference-study`；采用结论通过部件、实例和本期画面进入制作。历史研究与默认执行步骤不混排。

公共更新不替换私人素材和声音。正在使用 v1 的影片没有被强迁移；新工程默认 v2。服务/插件版本、源码与安装来源分别核对；运行中的旧会话不会仅因文件更新就忘掉旧指令。遇到在途渲染或未保存编辑先保留，不自动打断。
