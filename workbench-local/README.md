# 独立工作台操作

当前是 Codex 驱动的本地视频工作台，v0.2.0 升级实现和验收进度见[执行计划](../docs/plans/2026-10-21-reference-distillation-style-packs.md)。对话留在 Codex，工作台显示当前工程和实际结果。旧 App 壳与内置 Agent 不在本版本中。

在仓库根目录执行 `npm start`、`npm run status`、`npm run stop`，或双击根目录启动/停止脚本。默认服务为 `http://127.0.0.1:4340`。命令行入口是 `node node_modules/tsx/dist/cli.mjs workbench-local/cli.ts`，修改前读取修订、选择与未保存草稿，保留用户覆盖和锁。

制作仍为六步内容优先流程：粗剪 → 视觉段落 → 视觉对象 → 信息布局 → 包装设计 → 动画实现。全片设计后逐段实现、生成带原声样片、由用户确认，再正式合成。风格包提供配套资产与共享样式，当前文稿决定每段表达和构图。

「视觉资产库」包含风格包、单项资产、对标与提炼。新库默认为空；需要原创几何示例时，启动服务后执行 `node examples/paper-style/import.mjs`。旧 194 项位于 `modules/legacy/`，只供历史工程兼容，不能继续用于新选型。

- [参考提炼与视觉资产库](../docs/REFERENCE_LIBRARY.md)：版本、状态、参数、媒体、风格包和接口。
- [场景协议](SCENE_MODULES.md)：原创场景、时间绑定与参数化。
- [恢复说明](RECOVERY.md)：代码、项目及视觉库的配对备份。
- [插件](plugin-package/codex-cut/README.md)：7 个本地工具及按需操作说明。
- [当前状态](PLAN_STATUS.md)：本轮进度与历史记录。

真实参考候选和不同内容样片已经生成，尚无资产 ready、用户段落认可或正式合成。历史技术记录中的旧路径和 QA 结果保留为当时证据，不能替代本次视听及用户验收；独立迁移背景见根目录 [MIGRATION.md](../MIGRATION.md)。
