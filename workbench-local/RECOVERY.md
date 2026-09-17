> 独立版本补充：当前代码快照包含 `workbench-local/`、`modules/`、`public/`、根 package/lock、README 与源码迁移映射，不包含旧 App 目录。`runtime/remotion/` 需单独保留或配置。下文历史验证发生于原项目；本次迁移检查见根目录 MIGRATION.md。

# 工程备份与安全恢复

本说明适用于当前代码版本下的本地工程恢复。跨机器安装和任意旧 App 工程迁移仍需独立验证，不能只复制一个 JSON 就称为可恢复。

## 工作台里的操作入口

打开右上角「外观与工具」→「工程」→「备份与恢复」。先保存当前参数与剪辑调整；有未保存草稿或生成任务时，备份入口会提示先处理。备份、校验和恢复期间暂停其他工程写入，完成后恢复操作。

- 「创建备份」同时捕获当前代码、场景实现、依赖锁、工程数据和媒体，保存到仓库旁的 `<仓库名>-备份/`，不会写进素材箱。
- 选中备份后可「校验文件」。界面显示时间、文件数量、体积、运行状态与失败原因；Codex 发起的同类任务也会同步到面板。
- 「恢复副本」先校验，再生成新的 `恢复副本-UUID/code/` 与 `project/` 配对目录。它不覆盖当前工程，也不自动切换项目；面板显示恢复位置，供 Codex 在独立端口启动检查。

文件按流读取、复制和计算 SHA-256，避免一次把视频读入内存；捕获结束后重新核对目录和文件身份。目标目录先独占预留，文件全部发布后最后写入 `checkpoint.json` 完成标记；这不是整个目录一次原子替换。失败清理仅针对本任务创建的内容，已有目标拒绝覆盖。

当前增量通过153项工作台检查及类型检查。隔离界面完成1499文件/约283MB的创建、校验与恢复；从恢复出的配对目录重新启动，实际重新生成36帧1080p H.264/AAC视频，完整解码与鼠标播放通过，目标文字与锁保留，未点击用户确认。证据见 `qa/checkpoint-evidence/`。该验证使用本机已安装依赖与浏览器运行时，不代表跨机器重装或磁盘故障恢复。

## 要保留什么

- 项目工作数据 `projects/local-workbench/`：粗剪、转写、素材副本、制作方案、参数与锁、历史、素材需求、样片、逐段记录、动画目录、参数预设及交付档案。排除根层 `qa/`、`verification/` 和 `runtime/`；旧QA环境有指向完整依赖的链接，不应递归打入工程备份。
- `workbench-local/scenes/`：场景实现、参数声明与 `saved-*` 动画快照。仅备份项目目录会漏掉这些源码。
- 与工程匹配的工作台代码及依赖锁文件。工作台源码已纳入本轮定版提交，以`codex-cut-workbench-v0.1.0`标签保存；工程与媒体仍不由Git保存。历史Git HEAD不包含此前未提交的工作台成果，不要运行reset/clean/checkout代替代码与工程配对备份。
- 外部引用素材的原文件。项目中的导入副本应一并保留；若有软链接，备份需复制实际内容或另行保留目标文件。

`runtime/` 中的运行锁不能作为新实例的启动状态。导出的缓存可再生成，但保留已认可成片、上一次成功视频和渲染快照，有助于源码失败时继续审阅。

## 同机恢复检查

1. 先保存当前调整。将备份恢复到一个**新目录**，例如 `projects/local-workbench-restored/`，不覆盖现有工程。
2. 保留与备份匹配的场景源码；若当前源码已经继续开发，应使用独立代码副本验证，不能把旧源码覆盖回当前目录。
3. 在对应仓库根目录直接启动隔离服务：

```sh
WORKBENCH_PROJECT_DIR="$PWD/projects/local-workbench-restored" WORKBENCH_PORT=4341 \
node node_modules/tsx/dist/cli.mjs workbench-local/server.ts
```

正式启动器默认使用4340；隔离服务直接使用独立端口，不需要关闭正式工作台。操作恢复副本的CLI时设置 `WORKBENCH_URL=http://127.0.0.1:4341`，避免请求正式服务。

4. 用浏览器打开 `http://127.0.0.1:4341/`。核对项目、段落数量、用户文字/样式/锁；检查粗剪与上一成功样片能否播放，再用一个测试段落验证实际导出。只读接口包括 `/api/health`、`/api/cut`、`/api/production`、`/api/production/animation-templates`。
5. 确认恢复副本可用后再决定如何迁移。当前没有一键切换正式项目的入口，不应在原路径直接覆盖试错。

## 本轮恢复证据与限制

已建立独立备份：`99-临时区/Codex-Cut恢复备份-20260917/`（工作台根目录下），包含实际项目文件、场景源码、公共资源、转写服务源码与依赖锁文件；`manifest.json` 记录逐文件 SHA-256。项目素材为实际文件，不依赖原项目媒体软链接。

已复制到 `/private/tmp/codex-cut-independent-restore-20260917/`，从恢复的代码以4341端口启动，界面显示12段及已保存参数，重新导出第5段得到67帧/1920×1080 H.264与AAC原声，并通过完整解码。实际浏览器中已看到导出画面。恢复证据保存在备份目录 `recovery-evidence/`。正式制作与粗剪文件哈希不变。

此验证复用本机已安装的 node_modules、Chromium/Remotion运行环境和FFmpeg；不是跨机器安装验证。未删除原始素材，不宣称离线重装、整机故障恢复或完整源码历史一键回退已验收。备份位置在同一磁盘，不能抵抗磁盘损坏。

## 可执行版本快照

不再只依赖手工复制。仓库根目录可运行：

```sh
node node_modules/tsx/dist/cli.mjs workbench-local/checkpoint-cli.ts create "$PWD" "$PWD/projects/local-workbench" /绝对路径/新的快照目录
node node_modules/tsx/dist/cli.mjs workbench-local/checkpoint-cli.ts verify /绝对路径/新的快照目录
node node_modules/tsx/dist/cli.mjs workbench-local/checkpoint-cli.ts restore /绝对路径/新的快照目录 /绝对路径/新的恢复目录
```

快照同时保存可编辑源码、依赖锁、公共资源、工程与媒体，并记录SHA-256；任一文件校验失败不能恢复。已有目标目录拒绝覆盖，软链接明确拒绝，源文件在捕获期间变化则失败重试。恢复到`code/`和`project/`配对目录，以后使用对应代码和`WORKBENCH_PROJECT_DIR`启动。运行中的未落盘浏览器草稿不在文件快照内。

工具验收：对之前独立备份的4094个真实文件执行create→verify→restore完成；恢复位置`/private/tmp/codex-cut-checkpoint-cli-restored-20260917`。新运行路径代码在该隔离工程成功重新导出67帧1080p H.264/AAC段落，完整解码通过。尚未在另一台机器重装依赖验收。

## 可配置的运行环境

快照工具后续补齐可执行权限保存和捕获结束时的双目录复查；新快照 `99-临时区/Codex-Cut版本快照工具验收-20260917-r2` 已校验并恢复4094文件至 `/private/tmp/codex-cut-checkpoint-restored-r2`。此为同机恢复证据，运行依赖仍需按锁文件安装。

视频与转写命令优先读取`WORKBENCH_FFMPEG`、`WORKBENCH_FFPROBE`、`WORKBENCH_WHISPER`，然后查找PATH。Whisper模型可通过`WORKBENCH_WHISPER_MODEL`设置实际文件。渲染浏览器及合成器可用`WORKBENCH_CHROME`和`WORKBENCH_COMPOSITOR`显式指定；只有当前平台确实是Apple Silicon macOS才复用原桌面运行时，否则交由匹配版本的Remotion依赖查找其平台运行环境。这是移植基础，不等于跨机器整体验收完成。
