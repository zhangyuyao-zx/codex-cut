# Dots 制作与参考复用

**新工程唯一流程入口：[WORKFLOW.md](WORKFLOW.md)。** 采用原生分镜、真实材料和代表样片逐步推进；实际对照后再扩展，不先写齐全片逐段脚本。

- 具体画面与部件：[CRAFT.md](studio/CRAFT.md)，连接真实页面取景、已认可实例和固定源码。
- 完整采用标准：[standards.json](studio/standards.json)，唯一维护13条导演学习、9项美术及后续用户决定；`studio standards/resume`直接读取，capture带入实际比较。
- 导演与美术判断：[DIRECTING.md](DIRECTING.md)，按本期难点查阅。
- 原生协议与已有工程：[NATIVE_AUTHORING.md](NATIVE_AUTHORING.md)，按保存版本读取，不强迁移影片。
- 独立参考研究：[reference-study](../reference-study/README.md)，制作时复用已整理结论，不重复全量研究。
- 固定源码 1.0—1.3 与历史工具：[技术说明](legacy/SOURCE_TOOLS_1_3.md)。原发布文件及哈希保持不变。

新流程的最小工具入口：

```sh
npm run dots -- studio standards
npm run dots -- studio sync --project /path/to/project
npm run dots -- studio resume --project /path/to/project
npm run dots -- studio capture --project /path/to/project --scene s01 --render actual-render-id --out /path/to/new-review
```

实际材料与参考选择、原生场景实现、原速观看和声音听辨仍由作者完成。命令只整理和核对证据，不生成通过结论，不代写用户验收。

历史创建命令位于显式`legacy`命名空间，不能把新工程降级绑定为schema 1。新片不从旧`prepare/init`起步；固定视觉部件可继续复用。对话审阅使用capture返回的实际媒体和chatMarkdown，网页不作为手机审阅的唯一交付。

开发验证：`npm run typecheck`、`npm run test:direction`；插件改动运行 `npm run test:plugin`。这些检查覆盖流程、版本和素材身份，不评分美感。
