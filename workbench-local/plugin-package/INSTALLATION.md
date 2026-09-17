# Codex Cut 插件安装记录 · 2026-09-17

- 插件：`codex-cut@personal`，版本 `0.1.0`。
- 源码：本目录 `codex-cut/`。
- 个人插件源：`/Users/zhangxin/plugins/codex-cut`。
- 个人市场：`/Users/zhangxin/.agents/plugins/marketplace.json`，由官方脚手架新建，没有覆盖既有市场。
- 实际安装缓存：`/Users/zhangxin/.codex/plugins/cache/personal/codex-cut/0.1.0`。
- `codex plugin list --json` 回读：installed=true、enabled=true，source=local。
- 插件 manifest 与 Skill 校验通过。5 项桥接测试从源码和安装缓存分别通过：7 个工具发现、MCP initialize/stdio 实际状态读取、真实项目读取且无修改、过期修订拒绝、错误服务身份和未保存草稿保护。
- `open_workbench` 实际复用 PID 5175，未重启或覆盖视频工程；服务仍为 http://127.0.0.1:4340/。
- 本轮未在正式工程写入确认、修改剪辑或重新制作视频。
- 当前任务不会因安装而自动重新加载工具；需新建用户任务，选择 Codex Cut 后验证宿主加载。该宿主新任务验收未冒充完成。

使用示例：选择 Codex Cut 插件，输入「打开 Codex Cut，读取当前项目，告诉我有哪些段落待确认。先不要修改。」

## 更新

编辑本目录源码，检查后同步到个人插件源。按 plugin-creator 的更新流程运行官方 `update_plugin_cachebuster.py /Users/zhangxin/plugins/codex-cut`，然后 `codex plugin add codex-cut@personal`。不要手改 marketplace 或 config.toml，不靠重启旧任务推断工具已更新。

本地插件服务器使用 `cwd: "."` 与相对脚本路径，参照 OpenAI 官方插件示例：
https://github.com/openai/plugins/blob/main/plugins/openai-developers/.mcp.json

## 边界与卸载

这是本机连接插件，依赖已安装的工作台引擎和 local-config.json 中的路径，不是把整个剪辑引擎复制进插件。7 个工具通过现有 API 工作，无任意 URL 或 shell 执行入口，无内置模型/远程上传/收费服务。

`codex plugin remove codex-cut@personal` 用于用户要求卸载时。卸载插件不删除工作台、素材、渲染成果、确认记录或个人插件源码。
