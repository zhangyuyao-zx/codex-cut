# 从具体画面复用

这些部件没有默认顶标题、三列布局或全屏照片。先选择实际表达任务，再选代码；需要改造时保留素材身份、字体和动作性质，构图由本期内容决定。

| 观看任务 | 可直接使用的代码 | 必须一起看的实例 | 不能简化成什么 |
|---|---|---|---|
| 真实页面从整体进入关键细节 | `media.jsx` 的 `EvidenceWindow`；`media.mjs` 的 `cameraAt` | 本期同页全貌、焦点和结果三个真实时刻 | 小角落放来源截图，主体仍是抽象词链 |
| 真实材料与解释在同一画面接力 | `Attention`、`EvidenceQuote`；1.3 的 `ImageCard`、`Entity` | `attention-accepted-20261107` | 仅缩小旧重点，但仍让它最亮 |
| 并列小演示，各自呈现不同过程 | 1.3 `DocumentResult`、`ApprovalSwitch`、`WaveProducts` | `parallel-cases-20261104` 的实际 MP4 和 sourceCode | 三个空白框加图标、加标题 |
| 条件成立后才执行，并出现反馈 | 1.3 `ProgressMeter`、`Panel`，按实际事件驱动 | `task-board-20261104` 的实际 MP4 和 sourceCode | 循环进度、绿勾或跨卡箭头替代过程 |
| 同一份材料被修订 | 1.3 `RecordCard`、`Entity`、`viewAt` | `trial-accepted-20261107`、`transfer-accepted-20261107` | 换一个新卡片把修改过程藏掉 |

实现位置：[components.jsx](../releases/1.3.0/components.jsx)、[objects.jsx](../releases/1.3.0/objects.jsx)、[objects.mjs](../releases/1.3.0/objects.mjs)、[媒体取景](media.jsx)。

实例 id 从本机参考注册表选取；私人参考不进入公开仓库，原实例的认可不转移到新影片。`studio reference` 导入真实区间，`studio capture` 把本期样片与参考放在一起。若本机缺参考，明确报告缺失，不能用技术示例代替审美基准。

`EvidenceWindow` 的 `source:{w,h}` 使用实际像素；`rect:{x,y,w,h}` 是成片位置；`crop`、`focus` 都使用原图坐标。整个选区按 contain 放入容器，不会为铺满容器静默裁掉边沿。放大有明确讲述对象后才发生，读到字段后落稳。图片不足以支持细节时换材料或只用作现场/人物依据，不放大伪造信息。

`cameraAt(frame,[{at:0,rect:whole},{at:cue.start,duration:cue.duration,rect:detail}])` 直接消费原生 cue。字幕、安全区和标题由当前场景决定；此部件不替作者放一套共同页眉。文字使用已确认的黑体字重，字号按当前主体和观看距离分级；不为了填空增加眉题或英文状态标签。

线条可用于有意义的真实网络、机械连接或局部指示；不要从箭头出发编排。优先尝试同位换态、边界内外、并列对比、具体物件迁移和证据放大。抽象机制可以绘制，但必须画出实际构成和变化，而非用名词框代替思考。
