# 历史固定源码与工具说明

本页为既有 1.0—1.3 作品和主动选择复杂状态实现的技术参考；新工程使用 [WORKFLOW](../WORKFLOW.md)，不按本页重新走旧流程。

## 固定源码套件 1.3.0

将已经整理出的 dots 表达方法落到可复用的制作代码、段落脚本和全片编排中。每段从当前文案的理解任务出发，设计具体对象、内部变化和前后交接；构图不固定为同一套卡片。

本目录提供制作源码，不是工作台原生 visual-library 风格包。初始化不会切换工程、生成旁白、设置资产 ready 或写入用户认可。沿用现有 Remotion、参数覆盖、锁、词时间绑定与逐段带声审阅。

## 快速开始

先在仓库根 `npm ci`，需要 Node.js 22.13+。套件独立于工作台服务，可以离线准备制作文件。

```bash
npm run dots -- list
npm run dots -- verify
npm run dots -- legacy prepare --brief /path/to/制作任务.json --references /path/to/本机参考注册表.json --to /path/to/旧协议开发副本
npm run dots -- legacy init-film --to .cache/dots-film-demo.json
```

制作任务和本机注册表的起点在 `templates/制作任务.json`、`templates/本机参考注册表示例.json`。注册表绑定已有本地视频的真实 SHA-256 与具体区间；按当前理解任务选一两组适用依据，需要时附相关失败样例。认可重建只代表它本身获认可，不转移给新作品。`sourceCode` 可记录原实现的本机位置。

`prepare` 校验身份并截取可播放参考、生成入口页，复制固定源码与 `dots-lock.json`。所有参考和本机路径只留在项目制作目录，不提交公共仓库。需要现有 `ffmpeg`/`ffprobe`。只接受不存在的新目录，拒绝合并或覆盖；失败后的不完整目录也保留，排除原因后另建输出。

`legacy init` 可用于历史源码开发副本，但会明确返回 `referencePackMissing:true`；需要恢复旧参考包时用 `legacy prepare`。全片起点同样拒绝覆盖。它们都不选择或改写活动工程。新视频只使用 [当前制作流程](../WORKFLOW.md)，不以这些命令初始化。

生成的 `Scene.jsx` 需要作者完成 `AuthoredObjects`，未实现时会明确报错。先填好本段理解目标、具体物件、子部件的职责与理由、空间关系和状态链，再编写画面。它不提供可误认成成片的通用默认布局。

## 两层设计与同一时间依据

| 层次 | 保存什么 | 检查什么 |
|---|---|---|
| 段落动作脚本 schema 2 | 观众问题、声画分工、布局理由、对象和子部件、初终态、词绑定、动作及阅读保持 | 漏填、错引用、时间越界、状态矛盾、缺少解释的计划空档 |
| 全片编排 schema 1 | 问题链、已有段落脚本路径、相邻交接、保留实体和状态衔接理由 | 相邻关系、实体起终态接续，以及需人工复看的相似构图 |

```bash
npm run dots -- check /path/to/当前段动作脚本.json --words /path/to/当前段局部词时间.json
npm run dots -- check-film /path/to/全片编排.json
```

固定源码中的 examples 只演示对象机制，不能当作已完成的正式制作包；当前节奏字段、真实素材和审阅记录仍需本期补齐。正式制作必须用当前工程的真实词 ID 与实际词时间，不能把示例时间套进新音轨。段落脚本的动作与场景代码都消费同一时间依据，已解析的偏移不能再重复加一次。

`inspectionGaps` 保留动作计划中动作之间的间隙，已声明的阅读保持也不会消除它；供作者结合 `declaredHolds` 检查。它不是成片静止检测，也不代表必须加动画。构图相似提醒同样不等于应该换布局：同一对象的连续解释、共同尺度比较和有意义的回访可以保留。

## 代码能力

- `components.jsx / tokens.json`：背景、容器、文字、状态与过程部件，统一可调整的色彩、字重、间距和运动起点。字体由作品所在环境提供，仓库不附字体文件。
- `motion.mjs`：按当前帧计算动作，消费语义 cue；定位和重渲染不依赖播放历史。
- `state.mjs`：编译完整对象状态和有限数值轨道。更正判断时切换完整状态，清除旧提示；进度可按真实事件暂停、保持、继续，不靠循环假装持续推进。
- `direction.mjs`：段落及全片结构检查，保留 schema 1 旧段落读取；不把结构有效、视觉观察和用户认可混成一个状态。
- `catalog.json`：11 类表达机制的适用关系、避用条件和检查点。按表达关系查询；它不是每期都必须使用的布局清单。
- `objects.jsx`：可改造的材料条目、真实图片容器、步骤槽、局部焦点和资源部件。`Board` 不强制固定顶标题；整幅构图由本段内容决定。`RecordCard` 的正文、字段和旧值来自实际快照，不仅变颜色或补一个勾。
- `objects.mjs`：`viewAt` 同时返回持久 `entityId`、完整内容快照和当前位姿；同一材料迁移时仍读同一实体。建立、迁移和内部修订独立定时，回退与重渲染可重复。`activityAt` 提供有起止的次要活动，不能拿循环掩盖信息空档。
- `recipes.json`：注意力交接、材料试跑、决策后果和字段订正的适用条件。它们是可组合行为，不是固定场景分镜。

最小运行示例见 [record-demo.jsx](../releases/1.3.0/examples/record-demo.jsx)。字体由调用方提供；业务内容是示意。新物件仍须按原生场景 manifest 声明可编辑内容和参数，不能把 DOM 上的实体标记误当成工作台已自动支持编辑。

更具体的选用方法见 [导演与画面设计](../DIRECTING.md)，原生接入读 [场景协议](../../../workbench-local/SCENE_MODULES.md) 和 [非真人讲解方法](../../../workbench-local/methods/FACELESS.md)。

## 版本与复用

`releases/1.0.0` 至 `releases/1.3.0` 分开保留，每版 manifest 固定文件 SHA-256；`verify` 检查源码及当前模板是否一致。历史协议开发副本使用 `catalog.currentVersion` 固定视觉源码（当前 1.3.0）；这个号码不代表当前制作流程。已有作品继续使用自己的保存版本，更新仓库不批量改写既有作品。

公共版不附参考原片、私人重建基准、产品页面、音轨或字体。`catalog.baselines` 因此为空，技术示例不代表已获审美认可。实际项目需要自己的材料、渲染与审阅证据。

参考研究和制作能力分别维护。研究任意新参考可用 [reference-study](../../reference-study/README.md)；做新视频时直接调用已整理的适用方法和代码，不要求重新分析整条参考。只有出现新问题或现有依据不够时，才补查相关片段。

## 验证

### 先看实际输出，再看自己的解释

代表样片渲染后，用 `templates/审片规格.json` 记录实际视频、起态/过程/终态时间和适用参考。不要只取一张好看的终态：同一对象移动的两端、字段修改前后、旧提示退出和下一主体接手都应有证据。

```bash
npm run dots -- review-pack --spec /path/to/审片规格.json --out /path/to/新审片目录
npm run dots -- check-review --evidence /path/to/新审片目录/evidence.json --observation /path/to/新审片目录/observation.json
```

浏览页先显示实际视频与检查帧，设计意图及参考折叠在第二遍。先记下看见的对象、内容、变化和疑点，随后对照参考的造型与行为；不能用自己的方案替画面补全。正常速度播放和静帧分别记录，未听辨不得评价声音。`observation.json` 初始为空，不自动填“通过”。它可承载本期现有观察，无需用户另外填表。

`check-review` 核验原视频、播放副本、参考、实际帧、规格与观察的身份，以及事实/差距处理是否填写完整。修改素材后旧观察失效；未处理差距不能标成候选已完成。它无法判断观察是否准确、内容是否好看，返回 `visualQuality:not-automatically-assessed` 和 `userAccepted:false`。实际视觉判断与原有用户审阅继续由人完成。

### 实际画面对照

代表样片使用[精致度校准方法](../DIRECTING.md#用真实样片校准精致度)。先写本期需要比较的问题和实际时间，再生成证据。规格中的视频路径相对于规格文件，也可使用绝对本地路径：

```json
{
  "schemaVersion": 1,
  "pairs": [{
    "id": "detail",
    "question": "关键控件的部件、字级和当前焦点是否足够清楚？",
    "reference": {"video": "reference.mp4", "timeSeconds": 30.5},
    "current": {"video": "sample.mp4", "timeSeconds": 5.2}
  }]
}
```

```bash
npm run dots -- compare-frames --spec /path/to/comparison-spec.json --out /path/to/new-comparison-directory
```

需要现有 `ffmpeg`/`ffprobe`。命令只读取本地媒体，拒绝覆盖输出目录，核对取帧时间，生成同尺度1280×720完整画面（保留比例）、可切换390px窄幅的浏览页和来源/图片哈希。原始素材不修改，也不上传。输出明确为 `visualJudgment: not-performed`；静帧不能证明动作、声音或美术达标。窄幅辅助可读性检查，不冒充真实设备审阅。

在实际观察记录中指出差距及处理，再回看对应运动和相邻段。`gate-render` 只核验节奏证据；旧 1.2.0 的 `deliveryReady` 不等于视觉目标已达到或用户已认可，新 1.3.0 不再把它设为 true。对照工具辅助现有样片审阅，不新增用户审批关卡。

### 源码检查

```bash
node tools/dots-production/test.mjs
node tools/dots-production/test-rhythm.mjs
node tools/dots-production/test-production-pack.mjs
```

分别覆盖旧版兼容与状态、节奏证据、新物件的实际内容/位姿和准备/审片入口。按改动运行受影响检查，不因日常文案微调重跑全部。测试通过后，仍需检查实际起态—过程—终态、目标尺寸可读性、相邻画面及带声整片。
