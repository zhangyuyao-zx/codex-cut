import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {EditableCanvasObject} from '../EditableCanvasObject';
import type {SceneModuleInput} from '../SceneModuleSurface';
import {
  EvidenceCrop, FrameMedia, makeMediaView, requireBeat, validateChanges, viewAt,
  assertMediaSpan, type MediaSource, type MediaView, type Rect, type ViewChange,
} from '../../tools/talking-head-production/releases/1.0.0';

const FULL: Rect = {x: 0, y: 0, width: 1920, height: 1080};
const SIDE: Rect = {x: 80, y: 220, width: 600, height: 680};
const MATERIAL: Rect = {x: 740, y: 220, width: 1100, height: 680};
const PIP: Rect = {x: 1510, y: 720, width: 300, height: 300};
const CROP: Rect = {x: 790, y: 300, width: 980, height: 500};
const objectStyle = (rect: Rect): React.CSSProperties => ({position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height});
const localView = (view: MediaView): MediaView => ({...view, rect: {...view.rect, x: 0, y: 0}});

/** Three starting arrangements. Custom compositions can use the versioned primitives directly. */
export function buildTalkingHeadMediaPlan(scene: SceneModuleInput) {
  const p = scene.parameters;
  const number = (key: string, fallback?: number) => {
    const value = p[key] ?? fallback;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`真人素材讲解：${key} 需要实际数值`);
    return value;
  };
  const text = (key: string, fallback = '') => String(p[key] ?? fallback);
  const treatment = text('treatment', 'handoff');
  if (!['handoff', 'evidence', 'backdrop'].includes(treatment)) throw new Error('未知素材处理方式');
  const transition = number('transitionFrames', 18);
  const cue = (key: string, fallback: string) => {
    const beat = requireBeat(scene.beats, text(key, fallback));
    return {at: beat.frame, duration: beat.durationFrames ?? transition};
  };
  const show = cue('revealCue', 'material-in');
  const focus = cue('focusCue', 'material-focus');
  const back = cue('returnCue', 'return-person');
  validateChanges([show, focus, back].map((v) => ({...v, to: {opacity: 1}})), scene.duration);
  if (!(show.at < focus.at && focus.at < back.at)) throw new Error('素材进入、重点、回到人物的词锚点必须依次排列');
  const end = back.at + back.duration;
  const id = text('materialId', 'evidence');
  const matches = scene.materials.filter((m) => m.id === id);
  if (matches.length !== 1) throw new Error(`真人素材讲解需要唯一素材 ${id}，请按请求 ID 绑定实际文件`);
  const material: MediaSource = {...matches[0],
    width: number('materialWidth'), height: number('materialHeight'),
    ...(matches[0].kind === 'video' ? {durationFrames: number('materialDurationFrames'), trimBefore: number('materialTrimBefore', 0)} : {}),
  };
  if (!Number.isInteger(material.width) || !Number.isInteger(material.height) || material.width! <= 0 || material.height! <= 0) {
    throw new Error('素材尺寸须来自实际文件的正整数像素尺寸');
  }
  const person: MediaSource = {id: 'person-source', src: scene.mediaSrc, kind: 'video',
    trimBefore: scene.from, durationFrames: number('personDurationFrames')};
  assertMediaSpan(person, 0, scene.duration);
  assertMediaSpan(material, show.at, end);
  if (treatment === 'evidence' && material.kind !== 'image') throw new Error('原文抽取需要实际截图图片；视频请先在选定时间提取证据帧');
  const crop = {x: number('cropX', .1), y: number('cropY', .25), width: number('cropWidth', .8), height: number('cropHeight', .25)};
  if (treatment === 'evidence' && (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 1 || crop.y + crop.height > 1)) {
    throw new Error('原文裁切区域必须位于原图内');
  }
  const personInitial = makeMediaView(FULL, {focalX: number('personFocalX', .5), focalY: number('personFocalY', .5)});
  const hidePerson = text('focusPerson', 'pip') === 'hidden';
  const personChanges: ViewChange[] = [
    {...show, to: {rect: SIDE, radius: 28}},
    {...focus, to: {rect: treatment === 'evidence' ? {x: 1490, y: 810, width: 210, height: 210} : PIP, radius: number('personRadius', 150), opacity: hidePerson ? 0 : 1}},
    {...back, to: {...personInitial}},
  ];
  const materialInitial = makeMediaView(MATERIAL, {opacity: 0, radius: 24, focalX: number('materialFocalX', .5), focalY: number('materialFocalY', .5)});
  const focused: Partial<MediaView> = treatment === 'evidence'
    ? {rect: {x: 80, y: 200, width: 650, height: 700}, opacity: .34, saturation: .25, blur: 1}
    : treatment === 'backdrop'
      ? {rect: FULL, radius: 0, brightness: number('backgroundBrightness', .32), saturation: number('backgroundSaturation', .2), blur: number('backgroundBlur', 5)}
      : {rect: {x: 80, y: 175, width: 1760, height: 800}, radius: 28};
  const materialChanges: ViewChange[] = [
    {...show, to: {opacity: 1}}, {...focus, to: focused}, {...back, to: {opacity: 0}},
  ];
  // The floating crop begins over the exact source area in the whole-page view.
  const scale = Math.min(MATERIAL.width / material.width!, MATERIAL.height / material.height!);
  const cropOrigin: Rect = {
    x: MATERIAL.x + (MATERIAL.width - material.width! * scale) / 2 + crop.x * material.width! * scale,
    y: MATERIAL.y + (MATERIAL.height - material.height! * scale) / 2 + crop.y * material.height! * scale,
    width: crop.width * material.width! * scale,
    height: crop.height * material.height! * scale,
  };
  const cropInitial = makeMediaView(cropOrigin, {opacity: 0, radius: 0});
  const cropChanges: ViewChange[] = [{...focus, to: {rect: CROP, opacity: 1}}, {...back, to: {opacity: 0}}];
  for (const changes of [personChanges, materialChanges, cropChanges]) validateChanges(changes, scene.duration);
  return {treatment, show, focus, back, end, person, material, crop, personInitial, personChanges, materialInitial, materialChanges, cropInitial, cropChanges};
}

export function TalkingHeadMedia(scene: SceneModuleInput) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const plan = buildTalkingHeadMediaPlan(scene);
  const p = scene.parameters;
  const color = String(p.textColor ?? '#f5f2ed');
  const accent = String(p.accent ?? '#ffcb69');
  const personView = viewAt(plan.personInitial, plan.personChanges, frame);
  const materialView = viewAt(plan.materialInitial, plan.materialChanges, frame);
  const cropView = viewAt(plan.cropInitial, plan.cropChanges, frame);
  const titleView = viewAt(makeMediaView(FULL, {opacity: 0}), [
    {...plan.show, to: {opacity: 1}}, {...plan.back, to: {opacity: 0}},
  ], frame);
  const focusOpacity = viewAt(makeMediaView(FULL, {opacity: 0}), [
    {...plan.focus, to: {opacity: 1}}, {...plan.back, to: {opacity: 0}},
  ], frame).opacity;
  const fit = p.materialFit === 'cover' ? 'cover' : 'contain';
  return <AbsoluteFill style={{background: String(p.background ?? '#18252b'), overflow: 'hidden'}}>
    <div style={{position: 'absolute', width: 1920, height: 1080, left: (width - 1920 * Math.min(width / 1920, height / 1080)) / 2, top: (height - 1080 * Math.min(width / 1920, height / 1080)) / 2, transform: `scale(${Math.min(width / 1920, height / 1080)})`, transformOrigin: 'top left', color, fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif'}}>
      <EditableCanvasObject id="material" style={objectStyle(materialView.rect)}>
        <FrameMedia source={plan.material} view={localView(materialView)} timelineStart={plan.show.at} timelineEnd={plan.end} fit={plan.treatment === 'evidence' ? 'contain' : fit}/>
      </EditableCanvasObject>
      <EditableCanvasObject id="focus" style={objectStyle(plan.treatment === 'evidence' ? cropView.rect : {x: 130, y: 350, width: 1220, height: 500})}>
        {plan.treatment === 'evidence' ? <EvidenceCrop source={plan.material} crop={plan.crop} view={localView(cropView)} borderColor={accent} borderWidth={3} shadow/> : null}
        <div style={{position: 'absolute', left: 0, top: plan.treatment === 'evidence' ? -70 : 0, width: plan.treatment === 'evidence' ? cropView.rect.width : 1220, opacity: focusOpacity}}>
          {plan.treatment !== 'handoff' && <div style={{fontSize: 36, color: accent, marginBottom: 32}}>{String(p.focusLabel ?? '')}</div>}
          {plan.treatment === 'backdrop' && <><div style={{fontSize: Number(p.focusSize ?? 90), lineHeight: 1.25, fontWeight: 600, whiteSpace: 'pre-wrap'}}>{String(p.focusText ?? '')}</div><div style={{height: 5, width: 100, background: accent, margin: '35px 0'}}/><div style={{fontSize: 38, lineHeight: 1.5, whiteSpace: 'pre-wrap'}}>{String(p.focusDetail ?? '')}</div></>}
        </div>
      </EditableCanvasObject>
      <EditableCanvasObject id="person" style={objectStyle(personView.rect)}>
        <FrameMedia source={plan.person} view={localView(personView)} timelineStart={0} timelineEnd={scene.duration} fit="cover"/>
      </EditableCanvasObject>
      <EditableCanvasObject id="headline" style={objectStyle({x: 80, y: 65, width: 1760, height: 120})}>
        <div style={{fontSize: Number(p.titleSize ?? 62), fontWeight: 600, lineHeight: 1.2, opacity: titleView.opacity}}>{String(p.headline ?? '')}</div>
      </EditableCanvasObject>
      <EditableCanvasObject id="source" style={objectStyle({x: 80, y: 1014, width: 1350, height: 40})}>
        <div style={{fontSize: 23, lineHeight: 1.4, opacity: titleView.opacity * .8}}>{String(p.sourceLabel ?? '')}</div>
      </EditableCanvasObject>
    </div>
  </AbsoluteFill>;
}
