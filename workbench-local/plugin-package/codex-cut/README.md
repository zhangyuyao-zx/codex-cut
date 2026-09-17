# Codex Cut 插件

本地视频工作台的 Codex 插件。组成：一个制作 Skill、7 个本地 MCP 工具、同源命令行入口。连接现有工作台，不复制或重建剪辑器，不包含视频素材、API 密钥、内置模型或付费服务。

使用：在安装插件后的新 Codex 任务中选择 Codex Cut，说「打开 Codex Cut，继续当前视频」或提供制作要求。插件读取当前工程，Codex 负责六步创作与动画，用户在工作台逐段审阅确认，最后合成整片。

## 文件

- `.codex-plugin/plugin.json`：插件元数据。
- `.mcp.json`：以插件目录为 cwd 启动 `scripts/bridge.mjs --mcp`。
- `skills/video-workbench/SKILL.md`：制作与审阅方法，详细接口按需读取。
- `local-config.json`：已有工作台路径；支持 CODEX_CUT_ROOT 覆盖。
- `local-config.example.json`：可提交的配置样例；首次从Git获取源码时先复制为`local-config.json`并填写实际仓库路径。本机配置不纳入Git；设置环境变量时也需保留这个配置文件。
- `scripts/bridge.mjs`：只连接 127.0.0.1:4340，核对 appId、根目录、就绪状态；令牌在内部获取，不返回给模型。

这是当前机器的连接版，需已有工作台仓库及其依赖。移动到其他机器后先配置路径和运行时，不是包含视频引擎的独立安装包。当前一个活动工程；不要直接导入新片覆盖正在制作的工程。

## 验证与维护

`node --test scripts/bridge.test.mjs`

`node scripts/bridge.mjs workbench_status`

`node scripts/bridge.mjs read_project '{"section":"summary"}'`

制作工具保存时要求调用者提供刚读取的 revision；有草稿会拒绝覆盖。批准工具只记录用户明确认可，不替用户判断。后台渲染通过读取任务状态查询，插件不另建调度器。

源码保存在工作台仓库 `workbench-local/plugin-package/codex-cut`；个人插件源安装到 `~/plugins/codex-cut`，由默认个人市场 `~/.agents/plugins/marketplace.json` 引用。安装和更新使用官方插件脚手架及 `codex plugin add`，不手改 Codex config.toml。

卸载插件不会删除工作台或用户工程。测试、安装、当前任务工具是否加载、用户实际验收分别记录；新任务加载前不能宣称本对话已接入新工具。
