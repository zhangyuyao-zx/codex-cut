# 段落复用与稳定渲染源

本项继续原收尾计划，不新增制作阶段、内置Agent或确认关卡。用户确认仍绑定具体段落、帧范围、设计指纹与实际画面文件；原确认记录不迁移、不重写。

## 实现

- 粗剪先生成内部逐帧无损H264（CRF0、全I帧）/PCM MKV，再生成浏览器可播放的H264/AAC MP4。两者共享同一次剪辑结果。编辑预览读MP4，实际包装渲染与整片合成读内部源。
- 分开源文件是实际验证所得：有损全片H264重编码会使未改剪辑窗口的像素改变，不能把它直接作为精确局部缓存源。Remotion内置解码器不支持FFV1；实际验证通过的是无损H264 MKV。
- 预览provenance保存输入、预览、内部源与编码器摘要。读取及快照复制后验证；失败保留原两份源，旧任务不发布。APFS快照复制使用COPYFILE_FICLONE，可用时采用写时复制，其他文件系统回退普通复制。
- version2段落key包含绝对帧窗口、窗口内源帧与变换、相关素材内容、局部词/动作、参数与用户覆盖、模块源码、实际组件层与补充素材、渲染环境和编码配置。全局粗剪revision与随机文件URL不单独使这些段落失效。
- `scene-media-contracts.json`固定五个已核查模块的完整sourceHash。只有hash仍相同才用窗口依赖；未知/改过模块使用全片媒体与全局输入依赖。不能仅凭模块自己声明“局部”跳过校验。
- 部分组件消费全片duration，存在组件层时保留此依赖；未使用组件的段落不纳入App组件媒体/运行器源码。共享实际渲染代码修改仍会使消费者失效。
- 组件入口与实际静态依赖直接计算摘要，不只信生成索引；入口前后摘要及解析源码快照需一致。依赖异常禁止相应制作及合成，一次context按入口去重。
- 旧range工程与缺少内部源的旧预览保持保守key；没有内部源不启用精确窗口复用。显式迁移timeline后，新生成粗剪才建立新合同。不得自动给旧认可换key。
- 补充素材/组件素材内容变动进入相应段落指纹，复制后的摘要记录在snapshot。缺失素材禁止相应制作；最终合成仍需当前源、逐段确认、完整无缝帧覆盖与实际pictureHash。
- 精确复用要求识别本地Node、Chromium、compositor、FFmpeg/FFprobe与依赖锁文件；缺失明确渲染环境时提示配置，不能把无法识别当作已验收。

## 验证入口与证据

仓库根目录运行：

```sh
npx vitest run --config workbench-local/vitest.config.ts
npx tsc -p workbench-local/tsconfig.json
npx tsx workbench-local/qa/cut-provenance.ts
npx tsx workbench-local/qa/partial-render-assets.ts
npx tsx workbench-local/qa/partial-render-source-changes.ts
npx tsx workbench-local/qa/partial-render.ts /absolute/path/to/source.MP4
```

这些QA脚本每次新建临时工程，不修改正式项目。Chromium实际渲染需允许本机启动；沙盒拒绝启动不是媒体验证通过。QA中的程序化确认仅检验状态机制，不能作为用户审美认可。

真实DJI口播副本已验证：修改第二段变换不使第一段key或确认失效；第一段新旧实际渲染逐帧像素一致；旧确认第一段与新第二段实际合成72帧、AAC原声，完整解码通过；拼接第一段复用原已确认picture的原字节。相同剪辑重新生成、单段文案、单段词时间和取消/重试矩阵通过。当前结果位于 `qa/partial-render-evidence/real-media.json`；预览/源/内部源篡改拒绝位于 `qa/cut-provenance-evidence/result.json`。

外部素材内容矩阵已通过：同文件名的补充PNG、同asset ID的组件PNG被替换时，只改变所属B段指纹；丢失补充素材令props不可用并禁止合成，恢复原内容恢复原指纹。该脚本粗剪编码和probe为mock，production context为实际路由；证据为 `qa/partial-render-evidence/external-assets.json`，不能作为实际视频解码或用户确认。

源码动态矩阵通过：隔离root修改Hero源码后审计不匹配，B变换使A也失效，证明退化到全片依赖；还原恢复局部行为。删除依赖锁时context保持200、props不可用且禁止合成，恢复锁恢复可用。该项粗剪编码为mock，证据为 `qa/partial-render-evidence/source-changes.json`。

本增量已部署4340；正式工程JSON与旧确认记录未改写。已有录屏加入内容摘要，随后单位图实际实现与生成索引更新。正式旧range工程采用全局代码保守指纹，因此底层代码更新使旧渲染需重新生成，不迁移原确认。证据为 `qa/partial-render-evidence/deployment.json`。

渲染与合成在发布前重新检查当前内容指纹和素材有效性；内容变化时不发布过期结果，保留上一成功视频。真实视频QA已覆盖启动任务后修改第二段文案、旧任务拒绝发布、恢复文案后重试成功。该测试为正常并发编辑时序，不是全文件系统原子快照或所有并发排列的证明。

此项不是全部收尾完成。持续使用尚待验收，以FINISH_CHECKLIST及最新验证记录为准。实际样例不是另一台物理机器的验证，也不是正式影片的新美术方案。
