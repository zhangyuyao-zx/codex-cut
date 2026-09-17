import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CUT_FPS,
  type ClipTransform,
  type CutTimeline,
  type TimelineClip,
} from "./cut-timeline";
import { cutPreviewGeometry } from "./cut-preview-geometry";

type CutState = {
  revision: number;
  capabilities?: { multiAsset?: boolean; clipTransforms?: boolean };
  timeline?: CutTimeline;
  asset: { name: string; durationMs: number; durationFrames?: number; url: string } | null;
  words: Array<{ id: string; text: string; startMs: number; endMs: number }>;
  ranges: Array<{ startMs: number; endMs: number }>;
  preview: { url: string; revision: number } | null;
  busy?: boolean;
  transcribing?: boolean;
  transcriptionError?: string;
  error?: string;
};

type MultiAssetCutProps = {
  state: CutState;
  api: (path: string, body?: any) => Promise<any>;
  onRefresh: () => Promise<void>;
  compact?: boolean;
  onDirtyChange?: (dirty:boolean)=>void;
};

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

function defaultTransform(): ClipTransform {
  return {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    crop: { left: 0, right: 0, top: 0, bottom: 0 },
    volume: 1,
  };
}

function cloneClip(clip: TimelineClip): TimelineClip {
  return {
    ...clip,
    transform: {
      ...defaultTransform(),
      ...clip.transform,
      crop: { ...defaultTransform().crop, ...(clip.transform?.crop || {}) },
    },
  };
}

function mediaFileName(url: string): string {
  const prefix = "/cut-media/";
  return url.startsWith(prefix) ? url.slice(prefix.length) : url.split("/").pop() || "";
}

function legacyTimeline(state: CutState): CutTimeline | null {
  if (!state.asset) return null;
  const proxyFileName = mediaFileName(state.asset.url);
  const durationFrames = Math.max(
    1,
    Number.isSafeInteger(state.asset.durationFrames)
      ? state.asset.durationFrames as number
      : Math.ceil(state.asset.durationMs * CUT_FPS / 1000),
  );
  const ranges = state.ranges.length
    ? state.ranges
    : [{ startMs: 0, endMs: state.asset.durationMs }];
  return {
    schemaVersion: 1,
    assets: [{
      id: proxyFileName,
      name: state.asset.name,
      durationFrames,
      sourceFileName: proxyFileName,
      proxyFileName,
      words: state.words,
    }],
    clips: ranges.map((range, index) => ({
      id: `legacy-${index}`,
      assetId: proxyFileName,
      inFrame: Math.max(0, Math.min(durationFrames - 1, Math.round(range.startMs * CUT_FPS / 1000))),
      outFrame: Math.max(1, Math.min(durationFrames, Math.round(range.endMs * CUT_FPS / 1000))),
      transform: defaultTransform(),
      legacyWordIds: true,
    })),
  };
}

function timelineForState(state: CutState): CutTimeline | null {
  if (state.timeline) {
    return {
      ...state.timeline,
      assets: state.timeline.assets.map((asset) => ({ ...asset, words: [...asset.words] })),
      clips: state.timeline.clips.map(cloneClip),
    };
  }
  return legacyTimeline(state);
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function frameLabel(frame: number): string {
  return `${(frame / CUT_FPS).toFixed(2)}s`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function jsonTranscript(input: unknown): unknown {
  return input;
}

function NumericField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field multi-asset-number-field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : min}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(clamp(next, min, max));
        }}
      />
    </label>
  );
}

export function MultiAssetCut({ state, api, onRefresh, compact = false, onDirtyChange }: MultiAssetCutProps) {
  const timeline = useMemo(
    () => timelineForState(state),
    [state.timeline, state.asset, state.words, state.ranges],
  );
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedClipId, setSelectedClipId] = useState("");
  const [draft, setDraft] = useState<TimelineClip | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  useEffect(()=>{onDirtyChange?.(draftDirty);},[draftDirty,onDirtyChange]);
  useEffect(()=>()=>{onDirtyChange?.(false);},[onDirtyChange]);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState<{ source: string; width: number; height: number } | null>(null);
  const draftRevision = useRef(state.revision);
  const pendingSelection = useRef<{ assetId: string; clipId: string; revision: number } | null>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);

  const assets = timeline?.assets || [];
  const clips = timeline?.clips || [];
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || assets[0];
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const draftAsset = assets.find((asset) => asset.id === draft?.assetId);
  const pending = !!working || !!state.busy || !!state.transcribing;
  const previewCurrent = state.preview?.revision === state.revision;
  const draftValid = !!draft && draft.outFrame > draft.inFrame && !!draftAsset;
  const supportsTimeline = state.capabilities?.multiAsset === true && state.capabilities?.clipTransforms === true;

  useEffect(() => {
    if (!timeline) {
      setSelectedAssetId("");
      setSelectedClipId("");
      setDraft(null);
      return;
    }
    const pending = pendingSelection.current;
    if (pending) {
      const pendingAsset = assets.find((asset) => asset.id === pending.assetId);
      const pendingClip = clips.find((clip) => clip.id === pending.clipId);
      if (state.revision < pending.revision) return;
      pendingSelection.current = null;
      if (pendingClip && pendingAsset) {
        setSelectedAssetId(pending.assetId);
        setSelectedClipId(pending.clipId);
        if (!draftDirty) {
          setDraft(cloneClip(pendingClip));
          draftRevision.current = state.revision;
        }
        return;
      }
      setError("目标片段已被其他操作移除，请重新选择当前片段。未保存草稿已保留。");
    }
    const nextAsset = assets.find((asset) => asset.id === selectedAssetId) || assets[0];
    const nextClip = clips.find((clip) => clip.id === selectedClipId && clip.assetId === nextAsset?.id) ||
      (nextAsset ? clips.find((clip) => clip.assetId === nextAsset.id) : undefined);
    if (nextAsset && nextAsset.id !== selectedAssetId) setSelectedAssetId(nextAsset.id);
    if (nextClip && nextClip.id !== selectedClipId) setSelectedClipId(nextClip.id);
    if (!draftDirty) {
      if (nextClip) {
        setDraft(cloneClip(nextClip));
        draftRevision.current = state.revision;
      } else {
        setSelectedClipId("");
        setDraft(null);
        draftRevision.current = state.revision;
      }
    }
  }, [timeline, assets, clips, selectedAssetId, selectedClipId, draftDirty, state.revision]);

  useEffect(() => {
    if (!draftDirty || state.revision === draftRevision.current) return;
    setError("工程已在其他操作中更新；请先检查当前草稿，再按当前版本保存。草稿已保留。");
  }, [draftDirty, state.revision]);

  useEffect(() => {
    const video = previewVideo.current;
    if (!video || !draft) return;
    video.volume = clamp(draft.transform.volume, 0, 1);
  }, [draft?.id, draft?.assetId, draft?.transform.volume]);

  useEffect(() => {
    const video = previewVideo.current;
    if (!video || !draft) return;
    video.pause();
    setPreviewPlaying(false);
    setPreviewProgress(0);
    try {
      const start = draft.inFrame / CUT_FPS;
      if (!Number.isFinite(video.currentTime) || video.currentTime < start || video.currentTime >= draft.outFrame / CUT_FPS) {
        video.currentTime = start;
      }
    } catch {}
  }, [draft?.id, draft?.inFrame, draft?.outFrame, draft?.assetId]);

  useEffect(() => {
    setPreviewDimensions(null);
    setPreviewProgress(0);
    setPreviewPlaying(false);
  }, [draftAsset?.proxyFileName]);

  function togglePreviewPlayback() {
    const video = previewVideo.current;
    if (!video || !draft) return;
    if (video.paused) {
      void video.play().then(() => setPreviewPlaying(true)).catch(() => setError("浏览器阻止了预览播放，请再次点击播放。"));
    } else {
      video.pause();
      setPreviewPlaying(false);
    }
  }

  function seekPreview(progress: number) {
    const video = previewVideo.current;
    if (!video || !draft) return;
    const start = draft.inFrame / CUT_FPS;
    const end = draft.outFrame / CUT_FPS;
    const next = clamp(progress, 0, 1);
    setPreviewProgress(next);
    try { video.currentTime = start + (end - start) * next; } catch {}
  }

  function selectClip(clip: TimelineClip) {
    if (draftDirty) {
      setError("当前片段有未保存属性，请先保存或重置草稿。");
      return;
    }
    pendingSelection.current = null;
    setSelectedAssetId(clip.assetId);
    setSelectedClipId(clip.id);
    setDraft(cloneClip(clip));
    draftRevision.current = state.revision;
    setMessage("");
    setError("");
  }

  function selectAsset(assetId: string) {
    if (draftDirty) {
      setError("当前片段有未保存属性，请先保存或重置草稿。");
      return;
    }
    pendingSelection.current = null;
    const firstClip = clips.find((clip) => clip.assetId === assetId);
    setSelectedAssetId(assetId);
    setSelectedClipId(firstClip?.id || "");
    setDraft(firstClip ? cloneClip(firstClip) : null);
    draftRevision.current = state.revision;
    setMessage("");
    setError("");
  }

  function patchDraft(patch: Partial<TimelineClip>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setDraftDirty(true);
    setMessage("");
    setError("");
  }

  function patchTransform(patch: Partial<ClipTransform>) {
    if (!draft) return;
    patchDraft({ transform: { ...draft.transform, ...patch } });
  }

  function patchCrop(key: keyof ClipTransform["crop"], value: number) {
    if (!draft) return;
    patchTransform({ crop: { ...draft.transform.crop, [key]: value } });
  }

  function resetDraft() {
    const source = clips.find((clip) => clip.id === selectedClipId) || selectedClip;
    pendingSelection.current = null;
    if (!source) {
      setDraft(null);
      setDraftDirty(false);
      setSelectedClipId("");
      draftRevision.current = state.revision;
      setError("");
      setMessage("片段已移除，已放弃此草稿。请选择当前片段继续编辑。");
      return;
    }
    setDraft(cloneClip(source));
    setDraftDirty(false);
    draftRevision.current = state.revision;
    setError("");
    setMessage("已载入当前保存版本。");
  }

  async function run(label: string, action: () => Promise<void>, afterRefresh?: () => void) {
    setWorking(label);
    setError("");
    setMessage("");
    try {
      await action();
      await onRefresh();
      afterRefresh?.();
    } catch (reason: any) {
      const detail = reason?.message || String(reason);
      if (/revision|版本|更新/i.test(detail)) {
        setError(`保存冲突：${detail} 当前草稿已保留，请检查后重试。`);
      } else {
        setError(detail);
      }
    } finally {
      setWorking("");
    }
  }

  async function saveClips(nextClips: readonly TimelineClip[], selectedAfter?: TimelineClip) {
    if (!supportsTimeline) throw Error("当前工作台服务尚未启用多素材片段编辑，请更新服务后重试。");
    const prepared = nextClips.map((clip) => cloneClip(clip));
    if (prepared.some((clip) => clip.outFrame <= clip.inFrame)) {
      throw Error("每个片段的入点必须小于出点。");
    }
    await api("cut/clips", { expectedRevision: state.revision, clips: prepared });
    if (selectedAfter) {
      pendingSelection.current = {
        assetId: selectedAfter.assetId,
        clipId: selectedAfter.id,
        revision: state.revision + 1,
      };
      setSelectedAssetId(selectedAfter.assetId);
      setSelectedClipId(selectedAfter.id);
    }
  }

  async function saveDraft() {
    if (!draft || !draftValid || !timeline) return;
    if (!clips.some(clip => clip.id === draft.id && clip.assetId === draft.assetId)) {
      setError("该片段已不在当前时间线，草稿尚未保存。请点击“还原已保存”放弃此草稿，再选择片段。");
      return;
    }
    if (state.revision !== draftRevision.current) {
      setError("保存冲突：工程版本已变化，当前草稿不会自动覆盖远端修改。请点击“还原已保存”载入当前版本后再编辑。");
      return;
    }
    await run("正在保存片段属性…", async () => {
      await saveClips(clips.map((clip) => clip.id === draft.id ? draft : clip), draft);
      setMessage("片段属性已保存。");
    }, () => {
      setDraftDirty(false);
      draftRevision.current = state.revision + 1;
    });
  }

  async function addClip(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset || !timeline || draftDirty) return;
    const clip: TimelineClip = {
      id: newId("clip"),
      assetId,
      inFrame: 0,
      outFrame: asset.durationFrames,
      transform: defaultTransform(),
      legacyWordIds: false,
    };
    await run("正在添加片段…", async () => {
      await saveClips([...clips, clip], clip);
      setMessage("已添加到时间线。");
    }, () => {
      setDraftDirty(false);
      draftRevision.current = state.revision + 1;
    });
  }

  async function duplicateClip() {
    if (!draft || !timeline || draftDirty) return;
    const copy: TimelineClip = { ...cloneClip(draft), id: newId("clip"), legacyWordIds: false };
    const index = clips.findIndex((clip) => clip.id === draft.id);
    const next = [...clips];
    next.splice(index + 1, 0, copy);
    await run("正在复制片段…", async () => {
      await saveClips(next, copy);
      setMessage("已复制片段并生成新的片段 ID。");
    }, () => {
      setDraftDirty(false);
      draftRevision.current = state.revision + 1;
    });
  }

  async function removeClip() {
    if (!draft || !timeline || draftDirty) return;
    const next = clips.filter((clip) => clip.id !== draft.id);
    const fallback = next[Math.max(0, clips.findIndex((clip) => clip.id === draft.id) - 1)];
    await run("正在移除片段…", async () => {
      await saveClips(next, fallback);
      setMessage(next.length ? "片段已移除。" : "时间线已清空；仍可从素材箱添加素材。");
    }, () => {
      setDraftDirty(false);
      draftRevision.current = state.revision + 1;
    });
  }

  async function moveClip(direction: -1 | 1, sourceClip?: TimelineClip) {
    const subject = sourceClip || draft;
    if (!subject || !timeline || draftDirty) return;
    const index = clips.findIndex((clip) => clip.id === subject.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= clips.length) return;
    const next = [...clips];
    [next[index], next[target]] = [next[target], next[index]];
    await run("正在调整片段顺序…", async () => {
      await saveClips(next, subject);
      setMessage("片段顺序已更新。");
    }, () => {
      setDraftDirty(false);
      draftRevision.current = state.revision + 1;
    });
  }

  async function upload(file: File) {
    if (draftDirty) {
      setError("当前片段有未保存属性，请先保存或重置后再导入素材。");
      return;
    }
    const append = !!state.asset;
    if (append && !supportsTimeline) {
      setError("当前工作台服务尚未启用多素材追加，请更新服务后再导入第二个视频。");
      return;
    }
    const query = `cut/upload?name=${encodeURIComponent(file.name)}${append ? `&mode=append&expectedRevision=${state.revision}` : ""}`;
    await run(append ? "正在追加素材…" : "正在导入素材…", async () => {
      await api(query, file);
      setMessage(append ? "素材已追加到时间线。" : "素材已导入。");
    });
  }

  async function transcribeAsset() {
    if (!selectedAsset || !timeline) return;
    await run("正在启动逐素材转写…", async () => {
      await api("cut/transcribe", { assetId: selectedAsset.id });
    });
  }

  async function importTranscript(file: File) {
    if (!selectedAsset || !timeline) return;
    await run("正在保存逐素材转写…", async () => {
      const parsed = JSON.parse(await file.text());
      await api("cut/transcript", {
        expectedRevision: state.revision,
        assetId: selectedAsset.id,
        transcript: jsonTranscript(parsed),
      });
    });
  }

  async function render() {
    await run("正在生成连续粗剪…", async () => {
      await api("cut/render", {});
    });
  }

  const selectedWords = selectedAsset?.words || [];
  const crop = draft?.transform.crop || defaultTransform().crop;
  const previewSource = draftAsset ? `/cut-media/${draftAsset.proxyFileName}` : "";
  const previewGeometry = draft && previewDimensions?.source === previewSource
    ? cutPreviewGeometry(previewDimensions.width, previewDimensions.height, crop)
    : null;
  const previewTransformStyle = draft ? {
    left: `calc(50% + ${(draft.transform.x / CANVAS_WIDTH) * 100}%)`,
    top: `calc(50% + ${(draft.transform.y / CANVAS_HEIGHT) * 100}%)`,
    width: "100%",
    height: "100%",
    transform: `translate(-50%, -50%) scale(${draft.transform.scale}) rotate(${draft.transform.rotation}deg)`,
  } : undefined;
  const previewCropStyle = draft ? {
    left: "50%",
    top: "50%",
    width: `${previewGeometry?.widthPercent ?? 100}%`,
    height: `${previewGeometry?.heightPercent ?? 100}%`,
    transform: "translate(-50%, -50%)",
  } : undefined;
  const previewMediaStyle = draft ? {
    left: `${previewGeometry?.mediaLeftPercent ?? 0}%`,
    top: `${previewGeometry?.mediaTopPercent ?? 0}%`,
    width: `${previewGeometry?.mediaWidthPercent ?? 100}%`,
    height: `${previewGeometry?.mediaHeightPercent ?? 100}%`,
  } : undefined;
  const selectedIndex = draft ? clips.findIndex((clip) => clip.id === draft.id) : -1;

  const assetBin = (
    <section className="multi-asset-library" aria-label="多素材箱">
      <div className="eyebrow">素材箱</div>
      <h2>多素材粗剪 <small>{assets.length} 个素材</small></h2>
      <label className="upload multi-asset-upload">
        ＋ {state.asset ? "追加视频" : "导入视频"}
        <input
          disabled={pending || draftDirty}
          type="file"
          accept="video/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>
      <p className="hint">新增视频默认追加到原工程，原素材文件保持不变。</p>
      <div className="multi-asset-list">
        {assets.map((asset) => {
          const assetClips = clips.filter((clip) => clip.assetId === asset.id);
          return (
            <div className={"multi-asset-row" + (selectedAsset?.id === asset.id ? " selected" : "")} key={asset.id}>
              <button
                type="button"
                className="multi-asset-select"
                aria-pressed={selectedAsset?.id === asset.id}
                disabled={pending}
                onClick={() => selectAsset(asset.id)}
              >
                <b title={asset.name}>{asset.name}</b>
                <small>{(asset.durationFrames / CUT_FPS).toFixed(2)} 秒 · {asset.words.length} 词 · {assetClips.length} 段</small>
              </button>
              <button
                type="button"
                className="multi-asset-add"
                aria-label={`添加 ${asset.name} 到时间线`}
                title="添加到时间线"
                disabled={pending || draftDirty}
                onClick={() => void addClip(asset.id)}
              >
                ＋
              </button>
            </div>
          );
        })}
        {!assets.length && <p className="hint">还没有素材。导入视频后即可添加片段。</p>}
      </div>
      {selectedAsset && (
        <div className="multi-asset-transcript-actions">
          <b>素材转写</b>
          <small>{selectedAsset.words.length ? `${selectedAsset.words.length} 个词` : "尚未转写"}</small>
          <button type="button" disabled={pending} onClick={() => void transcribeAsset()}>
            本地转写
          </button>
          <label className="upload compact">
            导入 JSON
            <input
              disabled={pending}
              type="file"
              accept=".json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importTranscript(file).catch((reason) => setError(reason?.message || String(reason)));
                event.target.value = "";
              }}
            />
          </label>
        </div>
      )}
    </section>
  );

  const preview = (
    <section className="multi-asset-preview-panel" aria-label="单片段属性预览">
      <div className="canvas-title">
        <span>单片段属性预览{draftAsset ? ` · ${draftAsset.name}` : ""}</span>
        <small>1920 × 1080 · 30 fps</small>
      </div>
      <div className="multi-asset-preview-stage">
        {previewSource && draft ? (
          <div
            className={previewGeometry ? "multi-asset-preview-transform" : "multi-asset-preview-measure"}
            style={previewGeometry ? previewTransformStyle : { inset: 0 }}
          >
            <div
              className={previewGeometry ? "multi-asset-preview-crop" : "multi-asset-preview-measure-crop"}
              style={previewGeometry ? previewCropStyle : undefined}
            >
              <video
                ref={previewVideo}
                key={`${draft.id}-${previewSource}`}
                src={previewSource}
                style={previewGeometry ? previewMediaStyle : { visibility: "hidden", width: "100%", height: "100%" }}
                onLoadedMetadata={(event) => {
                  const width = event.currentTarget.videoWidth;
                  const height = event.currentTarget.videoHeight;
                  if (width >= 2 && height >= 2) {
                    setPreviewDimensions({ source: previewSource, width, height });
                  } else {
                    setError("素材画面尺寸尚未就绪，无法显示准确的裁剪预览。");
                  }
                  event.currentTarget.volume = clamp(draft.transform.volume, 0, 1);
                  setPreviewProgress(0);
                  setPreviewPlaying(false);
                  try { event.currentTarget.currentTime = draft.inFrame / CUT_FPS; } catch {}
                }}
                onPlay={() => setPreviewPlaying(true)}
                onPause={() => setPreviewPlaying(false)}
                onTimeUpdate={(event) => {
                  const start = draft.inFrame / CUT_FPS;
                  const end = draft.outFrame / CUT_FPS;
                  if (event.currentTarget.currentTime >= end) {
                    event.currentTarget.pause();
                    setPreviewProgress(0);
                    try { event.currentTarget.currentTime = draft.inFrame / CUT_FPS; } catch {}
                  } else {
                    setPreviewProgress(clamp((event.currentTarget.currentTime - start) / Math.max(0.001, end - start), 0, 1));
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="empty">从素材箱选择或添加一个片段</div>
        )}
        {previewSource && draft && !previewGeometry && <div className="multi-asset-preview-loading">正在读取素材画面尺寸…</div>}
      </div>
      <div className="multi-asset-preview-controls" aria-label="单片段预览控制">
        <button type="button" disabled={!draft || !previewSource} onClick={togglePreviewPlayback}>
          {previewPlaying ? "暂停" : "播放"}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={previewProgress}
          disabled={!draft || !previewSource}
          aria-label="单片段预览进度"
          onChange={(event) => seekPreview(Number(event.target.value))}
        />
        <span>{draft ? `${(draft.inFrame / CUT_FPS + ((draft.outFrame - draft.inFrame) / CUT_FPS) * previewProgress).toFixed(2)}s / ${(draft.outFrame / CUT_FPS).toFixed(2)}s` : "—"}</span>
      </div>
      <p className="hint multi-asset-preview-note">
        这里预览单个素材的裁剪、位置、缩放、旋转和音量；片段连续顺序请生成剪后预览。
      </p>
      {state.preview && (
        <p className={previewCurrent ? "hint" : "warning multi-asset-preview-warning"}>
          {previewCurrent ? "连续粗剪预览与当前版本同步。" : "当前剪辑已更新，旧预览对应旧版本，请重新生成。"}
          {previewCurrent && <><br /><a href={state.preview.url} download>下载粗剪 MP4</a></>}
        </p>
      )}
    </section>
  );

  const clipList = (
    <section className="multi-asset-clips" aria-label="片段顺序">
      <div className="multi-asset-section-heading">
        <div>
          <h2>剪辑顺序 <small>{clips.length} 段</small></h2>
          <p className="hint">列表顺序就是连续粗剪顺序。</p>
        </div>
        <div className="multi-asset-clip-actions">
          <button type="button" disabled={pending || draftDirty || !clips.length} onClick={() => void render()}>
            生成连续粗剪
          </button>
          <button type="button" title={draftDirty ? "请先保存或放弃当前草稿" : "撤销最近一次粗剪修改"} disabled={pending || draftDirty || state.revision <= 0} onClick={() => void run("正在撤销…", () => api("cut/undo", { expectedRevision: state.revision }))}>
            撤销
          </button>
        </div>
        {draftDirty && <p className="hint multi-asset-undo-hint">当前草稿未保存；请先保存或放弃修改，再执行撤销。</p>}
      </div>
      <div className="multi-asset-clip-list">
        {clips.map((clip, index) => {
          const asset = assets.find((item) => item.id === clip.assetId);
          return (
            <div className={"multi-asset-clip-row" + (selectedClipId === clip.id ? " selected" : "")} key={clip.id}>
              <button type="button" className="multi-clip-select" disabled={pending} onClick={() => selectClip(clip)}>
                <b>{String(index + 1).padStart(2, "0")} · {asset?.name || "未知素材"}</b>
                <small>{frameLabel(clip.inFrame)} — {frameLabel(clip.outFrame)} · 时长 {((clip.outFrame - clip.inFrame) / CUT_FPS).toFixed(2)} 秒</small>
              </button>
              <div className="multi-clip-order-actions">
                <button type="button" aria-label="片段上移" title="上移" disabled={pending || draftDirty || index === 0} onClick={() => { selectClip(clip); void moveClip(-1, clip); }}>↑</button>
                <button type="button" aria-label="片段下移" title="下移" disabled={pending || draftDirty || index === clips.length - 1} onClick={() => { selectClip(clip); void moveClip(1, clip); }}>↓</button>
              </div>
            </div>
          );
        })}
        {!clips.length && <p className="hint">时间线为空。点击素材箱中素材右侧的“＋”添加已有素材。</p>}
      </div>
    </section>
  );

  const inspector = (
    <section className="multi-asset-inspector" aria-label="片段属性">
      <div className="multi-asset-section-heading">
        <div>
          <div className="eyebrow">片段属性</div>
          <h2>{draftAsset?.name || "选择片段"}</h2>
        </div>
        {draft && <button type="button" disabled={pending} onClick={resetDraft}>还原已保存</button>}
      </div>
      {draft && draftAsset ? (
        <>
          <p className="hint">{selectedIndex >= 0 ? `第 ${selectedIndex + 1} 段` : "已移除片段的草稿"} · 素材总长 {(draftAsset.durationFrames / CUT_FPS).toFixed(2)} 秒</p>
          <div className="multi-asset-number-grid">
            <NumericField label="入点（帧）" value={draft.inFrame} min={0} max={Math.max(0, draftAsset.durationFrames - 1)} step={1} onChange={(value) => patchDraft({ inFrame: Math.min(Math.round(value), draft.outFrame - 1) })} />
            <NumericField label="出点（帧）" value={draft.outFrame} min={1} max={draftAsset.durationFrames} step={1} onChange={(value) => patchDraft({ outFrame: Math.max(Math.round(value), draft.inFrame + 1) })} />
          </div>
          {!draftValid && <p className="error">入点必须小于出点，且范围不能超过素材长度。</p>}
          <div className="multi-asset-number-grid">
            <NumericField label="位置 X（px）" value={draft.transform.x} min={-3840} max={3840} step={1} onChange={(value) => patchTransform({ x: value })} />
            <NumericField label="位置 Y（px）" value={draft.transform.y} min={-2160} max={2160} step={1} onChange={(value) => patchTransform({ y: value })} />
            <NumericField label="缩放" value={draft.transform.scale} min={0.05} max={8} step={0.01} onChange={(value) => patchTransform({ scale: value })} />
            <NumericField label="旋转（°）" value={draft.transform.rotation} min={-360} max={360} step={1} onChange={(value) => patchTransform({ rotation: value })} />
            <NumericField label="音量（%）" value={draft.transform.volume * 100} min={0} max={100} step={1} onChange={(value) => patchTransform({ volume: value / 100 })} />
          </div>
          {draft.transform.volume > 1 && <p className="hint">当前片段音量超过 100%；单片段预览按 100% 播放，请生成连续粗剪后核验实际增益。</p>}
          <div className="multi-asset-crop-grid">
            <b>裁剪（%）</b>
            <NumericField label="左" value={draft.transform.crop.left * 100} min={0} max={99} step={1} onChange={(value) => patchCrop("left", value / 100)} />
            <NumericField label="右" value={draft.transform.crop.right * 100} min={0} max={99} step={1} onChange={(value) => patchCrop("right", value / 100)} />
            <NumericField label="上" value={draft.transform.crop.top * 100} min={0} max={99} step={1} onChange={(value) => patchCrop("top", value / 100)} />
            <NumericField label="下" value={draft.transform.crop.bottom * 100} min={0} max={99} step={1} onChange={(value) => patchCrop("bottom", value / 100)} />
          </div>
          {(crop.left + crop.right >= 1 || crop.top + crop.bottom >= 1) && <p className="error">裁剪后必须保留画面。</p>}
          <div className="multi-asset-inspector-actions">
            <button type="button" className="primary" disabled={pending || !draftDirty || !draftValid || crop.left + crop.right >= 1 || crop.top + crop.bottom >= 1} onClick={() => void saveDraft()}>保存片段属性</button>
            <button type="button" disabled={pending || !draftDirty} onClick={resetDraft}>还原已保存</button>
            <button type="button" disabled={pending || draftDirty} onClick={() => void duplicateClip()}>复制</button>
            <button type="button" disabled={pending || draftDirty} onClick={() => void removeClip()}>移除</button>
            <button type="button" disabled={pending || draftDirty || selectedIndex <= 0} onClick={() => void moveClip(-1)}>上移</button>
            <button type="button" disabled={pending || draftDirty || selectedIndex < 0 || selectedIndex >= clips.length - 1} onClick={() => void moveClip(1)}>下移</button>
          </div>
          {draftDirty && <p className="hint">草稿尚未保存；轮询不会覆盖当前输入。</p>}
        </>
      ) : (
        <p className="hint">从素材箱添加或从列表选择片段后编辑入出点和画面属性。</p>
      )}
    </section>
  );

  const transcript = (
    <section className="multi-asset-transcript" aria-label="素材逐字稿">
      <div className="multi-asset-section-heading">
        <h2>素材逐字稿 <small>{selectedWords.length ? `${selectedWords.length} 个词` : "尚未转写"}</small></h2>
      </div>
      {selectedWords.length ? (
        <p>{selectedWords.map((word) => <span key={word.id} title={frameLabel(Math.round(word.startMs * CUT_FPS / 1000))}>{word.text} </span>)}</p>
      ) : (
        <p className="hint">先选择素材，再使用本地转写或导入词级 JSON。</p>
      )}
      {state.transcribing && <p className="status">正在转写当前素材…</p>}
      {state.transcriptionError && <p className="error">{state.transcriptionError}</p>}
    </section>
  );

  return (
    <div className={compact ? "multi-asset-editor compact" : "multi-asset-editor"}>
      {assetBin}
      <div className="multi-asset-center">
        {preview}
        {clipList}
        {transcript}
      </div>
      <div className="multi-asset-right">
        {inspector}
        {(error || state.error) && <div className="error multi-asset-error">{error || state.error}</div>}
        {(working || state.busy) && <p className="status multi-asset-message">{working || "正在生成连续预览…"}</p>}
        {message && <p className="status multi-asset-message">{message}</p>}
      </div>
    </div>
  );
}
