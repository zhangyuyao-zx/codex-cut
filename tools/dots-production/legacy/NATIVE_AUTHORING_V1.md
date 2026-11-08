# 既有 schema 1 工程保存协议

本页仅供已保存 schema 1 的工程接续；新工程从 [WORKFLOW](../WORKFLOW.md) 开始。以下为历史协议，文内“新工程”描述当时版本行为。

2026-11-08，入口协议 1；固定视觉源码仍为 1.3.0。`prepare` 只准备材料。制作要求接入 `/render`、`/approve-sample`、`/assemble` 和整片 `/approve`，检查结果由 `read_project` 的 `authoring / authoringReviews / authoringDelivery` 返回。

这套接入检查文件身份、实际依赖、时间和审阅记录；它不能鉴定造型是否精致、观察是否诚实或视频是否好看。作者仍须实际观看、听辨、对照与返修，用户仍按已有流程验收。

## 新工程默认与适用范围

本机在忽略 Git 的 `projects/production-policy.json` 配置默认要求：

```json
{"schemaVersion":1,"method":"dots","requiredFromContentId":"CYYYYMMDD-NNN","identityRequiredRoots":["/absolute/content-workspace"],"exemptions":{}}
```

日期编号以前的作品不迁移。此后的内容工程默认要求绑定；指定工作区内缺内容身份的目录也不能靠漏写身份绕过。工作区之外未关联的临时工程不受 `identityRequiredRoots` 影响。有 `production/authoring.json` 的工程始终主动启用检查。

`select-project.mjs` 新建工程时自动生成空绑定，保留所有设计待作者完成。已存在的工程、声音和用户确认不覆盖。用户已选其他制作方向时，按已有授权在 `exemptions` 记录内容编号、`method` 与 `basis`（选型出处和理由），再按所属方法开工；不得为了避过失败检查临时换方向。已填过的 Dots 绑定继续有效，转换方法需处理本期已有设计，不能静默丢弃。

这是可配置的制作流程约束，不是防恶意作者修改源码、策略文件或直接调用 ffmpeg 的安全沙箱。绕开入口的临时输出只能作为草稿，不构成当前原生审阅完成。

## 先完成设计，再绑定代码

1. 读全片和已确认声音；按当前内容选择实际参考与真实素材，完成逐段动作脚本、全片问题链及相邻交接。脚本与全片不能留占位词。
2. 全片 `scenes` 中，每段写自己的 `referenceIds`；只选本段真正学习的机制和避用条件。引用的 `script` 路径相对于全片文件。准备包可以被多段复用，每段也可以单独使用准备包。
3. 把设计接入原生 `design / beats / program`，保留参数覆盖和锁。场景静态依赖必须包含当前动作脚本 JSON，允许导入仓库内内容哈希一致的副本。导入证明文件没有脱节，不证明画面已经实现了文档中的每句话。
4. 从真实粗剪导出段落局部词时间。原生场景的局部零点是段落首词，帧数按 30 fps 四舍五入；不要把全片词时间直接交给段落检查器。样片还包含分配到本段的前后停顿，动态审片必须覆盖样片完整时长。
5. 在源码根绑定本期文件：

```sh
npm run dots -- bind-native --project /path/to/native-project --film /path/to/全片编排.json --preparation /path/to/制作依据.json
```

绑定保存 `kitVersion`，以后目录默认版本更新仍按工程锁定版本核验，不自动迁移既有作品。早期绑定未写顶层版本时，读取已经复制到本期准备包里的固定版本，兼容现有工作。

命令仅填充新工程的空绑定；已填绑定拒绝覆盖，后续按当前文件局部修改。它不会替作者填设计、选参考、标记通过或写用户接受。多准备包情况直接维护绑定中每段的 `preparation`。路径相对于绑定文件，也可以使用绝对路径。

```json
{
  "schemaVersion": 1, "method": "dots", "kitVersion": "1.3.0", "contentId": "CYYYYMMDD-NNN",
  "film": "/path/to/全片编排.json",
  "scenes": [{
    "sceneId": "s01", "script": "/path/to/s01.scene.json",
    "preparation": "/path/to/制作依据.json", "referenceIds": ["selected-reference"]
  }]
}
```

读取 `production.authoring`，修完缺项后调用原生 `render_segment`。原生入口核对全片段落顺序、脚本、真实词时间、准备包及参考片段字节；单段渲染只要求该段代码已实现，但全片设计须先完成。渲染任务保存设计身份；渲染期间依据改变，本次输出不发布为当前结果。

## 样片观察绑定当前输出

用原生样片的实际 MP4 创建 `review-pack`，至少保留变化前后检查帧，再运行 `audit-render`。先正常速度看完整片段，记录实际看见的事实；随后对照选定参考的同一区间及目标观看尺寸。工具不能替作者生成观察。

在该段绑定中添加：

```json
"review": {
  "evidence": "/path/to/review/evidence.json",
  "observation": "/path/to/review/observation.json",
  "rhythmAudit": "/path/to/audit.json",
  "rhythmReview": "/path/to/rhythm-review.json"
}
```

`observation.json` 保留 `review-pack` 的原始身份字段、逐帧事实和差距处理；补充以下实际观察：

- `productionBinding`：`sceneId/key/renderId` 取当前 `segmentReviews`，`designSha256` 取 `authoring.sceneHashes[sceneId]`。渲染本身也必须带当前设计身份，不能靠事后修改观察记录让旧样片变新。
- `playbackRanges`：`fromSeconds:0`、`toSeconds:实际完整样片时长`、`rate:1`、`observation:实际动态发现`。
- `qualityChecks`：`objects / composition / typography / motion / rhythm / transition` 各一条 `aspect/observed/disposition`。具体记录部件和内部细节、整幅排布、字重字级、动作含义、阅读停留和注意力交接；“已检查”“符合风格”不能作为有用的观察。
- `targetSizeReview`：实际检查的 `width` 与 `observed`。窄幅浏览不冒充真机审阅。
- `audioReview`：`status:listened|not-listened` 和 `note`。段落阶段可如实记录未听，不能由画面推断声音；最终整片需要实际听辨混音。
- `authorVerdict:candidate-for-user-review` 仅在未解决差距已经处理后填写；`revise` 不能进入确认。`userAccepted` 保持 `false`，用户确认由原生审阅维护。

节奏记录沿用 `gate-render` 协议，覆盖完整样片，所有静止窗口都需实际复看及具体阅读任务；字幕移动、循环装饰和播放结束不算解释推进。

## 相邻对照、整片与最终状态

合成前，把实际比较加入任一侧的观察记录：

```json
"comparedTo": [{"sceneId":"s02","key":"当前采用样片key","renderId":"当前采用样片id","observed":"实际交接及相似处的发现与取舍"}]
```

覆盖每个相邻组合及 `check-film` 提示的同类组合。比较对象必须是当前已确认样片；同一构图可以有意连续使用，不要求用布局数量凑变化。逐段确认及这些记录完整后，才能调用原生合成。

合成后，完整原速回看并听辨最终混音，在绑定顶层增加 `deliveryReview`，指向以下记录：

```json
{
  "schemaVersion": 1,
  "renderId": "当前整片job.id", "key": "当前整片job.key",
  "videoSha256": "实际合成文件SHA256",
  "playbackRanges": [{"fromSeconds":0,"toSeconds":131.8,"rate":1,"observation":"实际整片发现"}],
  "checks": [
    {"aspect":"continuity","observed":"实际相邻交接","disposition":"取舍或修正结果","status":"retain"},
    {"aspect":"rhythm","observed":"实际推进与停留","disposition":"取舍或修正结果","status":"retain"},
    {"aspect":"readability","observed":"实际字级与阅读条件","disposition":"取舍或修正结果","status":"retain"},
    {"aspect":"sound","observed":"实际旁白、音乐与音效关系","disposition":"取舍或修正结果","status":"retain"}
  ],
  "audioReview":{"status":"listened","note":"实际听辨范围及发现"},
  "authorVerdict":"candidate-for-user-review", "userAccepted":false
}
```

示例时长必须替换，不能复制为观影事实。未完成的输出可下载预览检查；工作台不会把它标为最终自检完成，整片确认入口会拒绝。文件、参考、设计、样片或采用版本变化后重新核对受影响部分，不重跑无关已通过检查。旧记录和旧成片保留为历史，不能证明新版本。

## 实现验证

相关代码检查：`npm run typecheck`；`npm test -- workbench-local/production-authoring.test.ts workbench-local/production-authoring-routes.test.ts`；`node --test workbench-local/project-location.test.mjs tools/dots-production/test-native-binding.mjs`。这些测试使用隔离夹具，验证拦截与身份失效，不代表实际影片或审美通过。

源码更新后，还要核对运行服务 `/api/health` 的 `productionAuthoringGateVersion:1`、安装插件与源码版本。安装目录文件已更新不等于旧对话内已加载的新 Skill；服务端约束不依赖模型是否记得读文档。保留旧工程；存在渲染任务或未保存编辑时，先保护当前工作，不强行重启。
