# Codex Cut 插件安装记录

## 0.2.2 · 2026-10-21

- 源码：仓库 `workbench-local/plugin-package/codex-cut`；个人源 `~/plugins/codex-cut`。
- 保留已有 local-config.json，复制更新后的 manifest、桥接、Skill 和说明，再执行宿主现有的 `codex plugin add codex-cut@personal --json`。
- 命令返回 version 0.2.2、安装路径 `~/.codex/plugins/cache/personal/codex-cut/0.2.2`。核对 manifest、bridge、Skill 和 operations 与源码字节一致，本机连接配置未改。
- 安装副本通过脚本实际读取新 storyboard 入口；工作台 4340/4341 已加载 filmDirection 能力。插件工具 schema 在宿主新聊天加载，不将旧聊天脚本验证当作热更新。
- 本轮增加全片实际关键帧、观察和跟随样式操作，工具仍为 7 个；模型身份继续为 Codex，修订、草稿和用户确认边界保留。

## 0.1.0 历史记录 · 2026-09-17

- 插件：`codex-cut@personal`，版本 `0.1.0`。
- 源码：本目录 `codex-cut/`。
- 个人插件源：`~/plugins/codex-cut`。
- 个人市场：`~/.agents/plugins/marketplace.json`，由官方脚手架新建，没有覆盖既有市场。
- 实际安装缓存：`$CODEX_HOME/plugins/cache/personal/codex-cut/0.1.0`。
- `codex plugin list --json` 回读：installed=true、enabled=true，source=local。
- 插件 manifest 与 Skill 校验通过。5 项桥接测试从源码和安装缓存分别通过：7 个工具发现、MCP initialize/stdio 实际状态读取、真实项目读取且无修改、过期修订拒绝、错误服务身份和未保存草稿保护。
- `open_workbench` 实际复用 PID 5175，未重启或覆盖视频工程；服务仍为 http://127.0.0.1:4340/。
- 本轮未在正式工程写入确认、修改剪辑或重新制作视频。
- 当前任务不会因安装而自动重新加载工具；需新建用户任务，选择 Codex Cut 后验证宿主加载。该宿主新任务验收未冒充完成。

使用示例：选择 Codex Cut 插件，输入「打开 Codex Cut，读取当前项目，告诉我有哪些段落待确认。先不要修改。」

## 更新

编辑本目录源码，检查后同步到个人插件源。按 plugin-creator 的更新流程运行官方 `update_plugin_cachebuster.py ~/plugins/codex-cut`，然后 `codex plugin add codex-cut@personal`。不要手改 marketplace 或 config.toml，不靠重启旧任务推断工具已更新。

本地插件服务器使用 `cwd: "."` 与相对脚本路径，参照 OpenAI 官方插件示例：
https://github.com/openai/plugins/blob/main/plugins/openai-developers/.mcp.json

## 边界与卸载

这是本机连接插件，依赖已安装的工作台引擎和 local-config.json 中的路径，不是把整个剪辑引擎复制进插件。7 个工具通过现有 API 工作，无任意 URL 或 shell 执行入口，无内置模型/远程上传/收费服务。

`codex plugin remove codex-cut@personal` 用于用户要求卸载时。卸载插件不删除工作台、素材、渲染成果、确认记录或个人插件源码。
