# Codex Cut 独立工作台

本地视频制作工具，由 Codex 负责内容理解与动画实现，工作台负责预览、手动编辑、逐段确认和合成。开发基线 v0.1.0 已定版；本目录是从旧 App 项目提取的独立运行版本，不再引用旧项目源码、依赖或渲染环境。

## 使用

双击本目录的 **打开工作台.command**。地址仍为 http://127.0.0.1:4340/ 。先保存页面修改再停止服务。

命令行也可在本目录运行：

```sh
npm start
npm run status
npm run stop
```

六步制作方法保留：粗剪 → 划分视觉段落 → 决定视觉对象 → 决定视觉布局 → 决定包装对象 → 调用组件或编写动画完成包装。逐段带原声渲染、用户认可后合成；没有内置 Agent，没有付费服务依赖。

## 目录

- `workbench-local/`：界面、本地服务、CLI、原创场景、插件包与操作说明。
- `modules/components/`、`modules/component-lab/`：194 项最终盘点组件的实现。
- `modules/contracts/`、`modules/shared/`：运行所需的数据协议；保留的旧命名仅为兼容类型，不运行旧 Agent。
- `modules/server/transcription.ts`：粗剪转写实现。
- `runtime/remotion/`：本目录自己的浏览器与合成器，不链接旧 App。
- `public/`：原创动画公共素材位置；未带入已舍弃的研究组件目录。
- `projects/local-workbench/`：当前工程、媒体、参数、逐字稿、审阅和交付物；Git 不保存媒体和工程。
- `MIGRATION.json`：原定版提交与源码提取映射。
- `docs/COMPONENT_LICENSES.md`：原项目授权来源记录；历史来源路径是审计记录，不是运行依赖。

## 当前工程与素材

当前视频工程在 `projects/local-workbench/productions/dji-20260820-20260917/`，其 README 指向当前成片、认可样片和历史版本。迁移保持原有审核与确认状态，不自动确认新视频。

原始素材仍保留于 `/Users/zhangxin/Desktop/dji_mimo_20260820_160000_20260820160001_1787213054796_video.MP4`；工程中的导入副本已复制，不要求旧项目目录存在。

## 依赖与恢复

需要 Node.js >=22.13.0；在本目录 `npm ci` 可按 `package-lock.json` 安装独立依赖。视频工具 FFmpeg/ffprobe、Whisper 和模型继续使用本机安装，或通过 `WORKBENCH_*` 指定；Whisper 模型默认 `~/.cache/whisper/small.pt`。这不等于在全新机器上零依赖运行。

源码、运行时和工程需一起备份：Git 保存源码与锁文件；`runtime/` 与 `projects/` 不进 Git。页面“备份与恢复”捕获代码与工程，但不包含浏览器/合成器，恢复时还须保留或配置 `runtime/remotion`。

迁移的必要检查记录见 [独立迁移记录](MIGRATION.md)。后续仅按使用反馈局部维护，不恢复批量测试和旧 App 开发。

## 插件图标

插件卡片和输入框使用黑白视频画框与斜切口图标，深浅界面共用浅色底资源。原始资产、生成说明和本机安装记录见 [图标说明](assets/branding/ICON.md)；分发插件包也包含该图标。
