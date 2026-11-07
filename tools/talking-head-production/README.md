# 真人与真实素材 · 制作源码 1.0.0

将真人表演、真实图片／视频、原始资料局部和解释图形放在同一条讲解中。先按[真人制作方法](../../workbench-local/methods/TALKING_HEAD.md)判断观众需要看什么，再选择素材、加工和交接。美术独立于 dots；以下三种起点不要求铺满全片。

## 已实现的入口

工作台原生场景 **`talking-head-media`（真人与真实素材）** 可绑定实际素材、编辑标题／出处、调整人像焦点和圆角、选择材料填充方式与重点区域，并保留画布对象的移动、缩放、显隐与顺序覆盖。旧 `talking-head-story` 保留。

| `treatment` | 画面过程 | 适合什么材料 |
|---|---|---|
| `handoff` | 全幅讲者 → 人物与材料并列 → 材料占主画面、讲者小窗 → 回到讲者 | 实拍、操作录屏、照片；按内容选择 contain 或 cover |
| `evidence` | 先看完整截图 → 原图中的指定区域放大 → 整页退淡保留上下文 | 网页、报告、界面截图；必须有准确原图尺寸 |
| `backdrop` | 材料先独立出现 → 暗化、灰化、模糊后承载解释 → 回到讲者 | 与本段真正相关的现场或操作材料 |

人物、材料、重点、标题和出处是独立可编辑对象。重点阶段可隐藏人物，给证据留足空间。复杂关系图、多个材料的比较、透视、跟踪与主体分离仍按具体段落制作，不由三种起点自动完成。

## 接入当前工程

1. 先做带原声粗剪和段落设计，取当前实际 `words / beats`。不要使用旧片的词 ID。
2. 按现有素材请求流程绑定真实文件，`materialId` 与传入 `materials[].id` 一致。默认值 `evidence` 只是绑定 ID，不会自动寻找、生成或替代文件。无需更改工程格式。
3. 对主粗剪和选中的素材运行探测；所有帧值使用本期 composition FPS：

   ```bash
   node tools/talking-head-production/cli.mjs probe /path/to/rough-cut.mp4 --fps 30
   node tools/talking-head-production/cli.mjs probe /path/to/evidence.png --fps 30
   ```

   将主粗剪的 `durationFrames` 填入 `personDurationFrames`，将素材 `parameters` 填入场景。视频素材另填 `materialTrimBefore`；默认从源的第 0 帧开始，长度不足会报错，不会偷偷循环。探测记录只读文件，输出尺寸、视频时长、组成帧数、音轨情况和 SHA-256；它不验证出处或授权。
4. 绑定 `revealCue / focusCue / returnCue`，值可为准确词 ID 或唯一 beat label。默认名称为 `material-in / material-focus / return-person`。动作优先采用该 beat 的 `durationFrames`，没有时使用 `transitionFrames`。缺锚点、重名、越界和动作重叠会明确报错。
5. `evidence` 的 `cropX / cropY / cropWidth / cropHeight` 使用相对原图的 0–1 区域。先提取真正的截图再裁切；不是把概括文字重排后充当原文。不同目标框按原始宽高比留边，不拉伸文字。
6. 用当前原声看起态、交接中段、落点和阅读停留。原生主音轨由工作台统一混音；本组件所有视频层静音，避免重复口播或素材噪声。补充素材原声若有解释作用，走工程的声音轨并单独检查。

本模块的逻辑画布为 1920×1080，其他画幅等比留边。不同画幅、多人、特殊安全区或长标题应使用下面的源码按任务重排，不能靠缩小整个横版解决竖屏阅读。

## 自由编排，而非固定套片

在新的本期原生 TSX 中静态导入固定版本：

```tsx
import {
  FrameMedia, EvidenceCrop, makeMediaView, viewAt, requireBeat,
} from '../../tools/talking-head-production/releases/1.0.0';

const frame = useCurrentFrame();
const beat = requireBeat(beats, '本期实际词ID');
const initial = makeMediaView({x: 80, y: 180, width: 1760, height: 800});
const view = viewAt(initial, [
  {at: beat.frame, duration: beat.durationFrames ?? 18,
   to: {rect: {x: 1100, y: 600, width: 700, height: 390}, radius: 24}},
], frame);
return <FrameMedia source={actualSource} view={view}
  timelineStart={0} timelineEnd={duration} fit="contain" />;
```

`actualSource` 包含 `id / src / kind`，视频还需实际 `durationFrames / trimBefore`；图片局部抽取还需 `width / height`。`src` 使用浏览器能访问的 URL 或 public 目录文件名，不传本机绝对文件路径。片段媒体只在 `timelineStart` 建立一次源时间；位置、透明度、滤镜变化不重置视频。视图在父场景帧时间计算，不能移到内部 Sequence 后再算。

`makeMediaView / viewAt` 处理位置、大小、圆角、旋转、透明度、焦点、缩放、模糊、饱和度和亮度。`EvidenceCrop` 按源像素区域统一缩放。先保留源，再按职责做加工；透明 PNG 可作为对象，但圆形裁切不等于背景抠像，组件不提供自动动态抠像。

固定版本目录发布后保留。需要改变行为时新增版本并让本期明确采用；旧原生模块和实际工程继续受 sourceHash、参数、锁与样片确认保护。私人素材和验证输出留在项目目录，不随源码提交。

## 验证

```bash
npx vitest run --config workbench-local/vitest.config.ts workbench-local/talking-head-media.test.ts workbench-local/talking-head-media-integration.test.ts
npm run typecheck
```

单元检查覆盖媒体时钟、裁切几何、时长与锚点失败、原生清单加载和参数连接。实际素材渲染、替换素材、可编辑覆盖和画面阅读还需检查；技术通过与用户审美认可分别记录。使用记录见[本次实现](../../docs/implementation/2026-11-07-talking-head-media.md)。
