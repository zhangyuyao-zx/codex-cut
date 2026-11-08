# 制作入口版本路由

新工程从 [WORKFLOW.md](WORKFLOW.md) 开始，使用 `production/authoring.json` schema 2：全片简排 → 选材 → 代表样片 → 实际比较 → 扩展与整片审阅。

原生服务 `productionAuthoringGateVersion:2` 同时读取两个明确版本。已有 schema 1 工程沿用 [v1 保存协议](legacy/NATIVE_AUTHORING_V1.md)，不迁移正在制作的工程或已验收影片；旧协议不会成为新项目的默认起点。

源码、运行服务、安装插件与实际产物分别核对。技术检查只证明身份、依赖和过程条件；美术判断由实际观察完成，用户批准仍使用原生入口。
