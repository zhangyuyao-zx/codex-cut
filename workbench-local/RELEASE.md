# v0.3.2 · 参考研究与 dots 制作工具

新增通用研究记录、分类核查、证据浏览及结构检查，和独立的 dots 1.1.0 固定制作源码、状态轨道、段落及全片交接检查。保留既有工作台、Remotion、声音、工程选择和用户确认机制。修复插件环境变量配置优先级；默认插件测试不尝试修改活动工程。

- 当前启动入口：根目录 `打开工作台.command` 或 `npm start`。
- 更新与验证范围：[v0.3.2 记录](../docs/implementation/2026-11-05-reference-and-dots-tools.md)。
- 公共源码：[zhangyuyao-zx/codex-cut](https://github.com/zhangyuyao-zx/codex-cut)。
- 私人素材、工程、配置、研究原片与恢复数据不进入 Git，仍需单独保留。

## 历史：v0.1.0 独立工作台

开发已定版。此次只将工作台从旧 App 工程提取为独立工具，不增加新功能，不重启批量测试。

- 独立仓库标签：`codex-cut-workbench-v0.1.0-standalone`。
- 来源标签：旧仓库 `codex-cut-workbench-v0.1.0`，提交 `41c626ef6b9eb2f7fb310e83556d9aaf17e7bdf0`。
- 当前启动入口：根目录 `打开工作台.command` 或 `npm start`。
- 代码与迁移范围：[根 README](../README.md)、[迁移记录](../MIGRATION.md)。

原功能保留：剪辑、素材提需、194项最终组件、原创场景与动画包、可编辑参数、词级时间绑定、逐段审阅和合成、版本及工程备份。Codex 中对话，不启动旧内置 Agent。

Git 保存源码、锁文件与说明；`projects/`、`runtime/`、依赖安装目录和本机插件配置不进 Git，需另外保留。当时为本地版本，尚未同步远程；当前公共源码以 GitHub 主仓库为准。

全库连续动画审美、逐项完整交互、长时间使用及跨机器恢复仍沿用原待验收边界，在后续使用中处理。本次迁移检查不替代用户对具体视频的认可。
