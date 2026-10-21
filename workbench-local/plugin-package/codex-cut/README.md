# Codex Cut 插件 · 0.2.2

可按当前内容直接编写原创场景，使用已声明的 SVG/Canvas/Three.js 能力；必要参数在工作台调节，认可后再按价值提炼资产。风格包读取包含创作指导和逐段覆盖范围，保留已有设置，不把选择模板作为制作前提。代码与功能检查不代替用户审美认可。

新增共同样式持续继承、逐段实际值与偏差，以及全片真实关键帧总览。read_project 的 storyboard 可读取画面与观察；update_project 可提取关键帧、跟随样式和记录真实观察，均不代替用户确认。字体、线条、圆角和运动参数走同一映射机制；新增段落自动继承，用户覆盖和锁继续保护。

本地视频工作台的 Codex 插件。组成：一个制作 Skill、7 个本地 MCP 工具、同源命令行入口。连接现有工作台，不复制或重建剪辑器，不包含视频素材、API 密钥、内置模型或付费服务。

使用：在安装插件后的新 Codex 任务中选择 Codex Cut，说「打开 Codex Cut，继续当前视频」或提供制作要求。插件读取当前工程，Codex 负责六步创作与动画，用户在工作台逐段审阅确认，最后合成整片。

视觉库支持新组件、特效、recipe 与固定版本风格包；旧 194 组件库只兼容历史工程。Codex 可导入参考、记录实际观察、重建候选，生成原效果和换当前内容的样片，并记录视觉/复用检查。用户在工作台明确选定具体资产或风格包为可用；模型检查、测试通过和渲染完成都不会代替用户确认。新资产可先在目标段落试用，整片仍逐段带原声审阅。

风格包是当前机器上的固定资产版本集合，当前没有可跨机器安装的风格包文件。已有独立成员样片也不代表连续演示已完成；需实际生成并检查整包演示。

新库默认为空。需要通用示例时，在配置仓库根目录显式运行 `node examples/paper-style/import.mjs`，导入五项原创几何候选；不自动安装或设置 ready。源码、语义 cue、素材槽、内容参数及完整约束见配置工程的 `docs/REFERENCE_LIBRARY.md`。

新 SCENE 可沿用现有保存动画链路，复用时重绑定目标词和素材。含新库 OBJECT 的嵌套 `.cutanimation` 暂时拒绝保存/打包；工程与视觉库应配对备份。插件安装成功与新任务实际加载是不同结果，均不能替代用户视听和审美确认。

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

修订号分属 cut、production、visual-library 三个域。库操作读库 revision，独立于生产 revision，并保留现有本地草稿；production 操作继续检查未保存选择和用户参数锁。`read_project` 新增 visual-library、visual-asset、style-pack、references；旧 library 仅返回新库可用资源，component 明确为历史兼容。具体字段与允许的 update_project 操作见 Skill 的 `references/operations.md`。

默认桥接测试使用模拟服务检查协议、修订隔离及用户确认边界；在线时另运行实际项目只读/旧版本拒绝检查，服务离线时明确跳过该项，不自动启动或改动用户工程。

源码保存在工作台仓库 `workbench-local/plugin-package/codex-cut`；个人插件源安装到 `~/plugins/codex-cut`，由默认个人市场 `~/.agents/plugins/marketplace.json` 引用。安装和更新使用官方插件脚手架及 `codex plugin add`，不手改 Codex config.toml。

卸载插件不会删除工作台或用户工程。测试、安装、当前任务工具是否加载、用户实际验收分别记录；新任务加载前不能宣称本对话已接入新工具。
