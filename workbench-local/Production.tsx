import React, { useEffect, useRef, useState } from "react";
import { SceneModulePreview } from "./SceneModulePreview";
import {ActionReview} from "./ActionReview";
import {reviewActions, localPlaybackTime} from "./action-review";
import { CreativeDesignPanel } from "./CreativeDesignPanel";
import { ObjectPreview } from "./ObjectPreview";
import { ObjectProperties } from "./ObjectProperties";
import { LegacyProgramPreview } from "./LegacyProgramPreview";
import { SaveAnimation } from "./AnimationTemplates";

const segmentStatusLabels: Record<string, string> = {
  unrendered: "待制作",
  pending: "待确认",
  changes: "需修改",
  approved: "已确认",
};

function taskIsPlayable(task: any) {
  return Boolean(
    task?.url && (!task.status || task.status === "done"),
  );
}

function segmentReviewsFor(context: any): any[] {
  return Array.isArray(context?.segmentReviews) ? context.segmentReviews : [];
}

function reviewHasPlayback(review: any) {
  return Boolean(
    taskIsPlayable(review?.latest) ||
      taskIsPlayable(review?.approved) ||
      review?.history?.some((task: any) => taskIsPlayable(task)),
  );
}

function segmentStatusText(review: any) {
  const latestStatus = review?.latest?.status;
  if (latestStatus === "rendering") return "制作中";
  if (latestStatus === "cancelling") return "停止中";
  if (latestStatus === "failed" && !review?.approved?.current)
    return "制作失败";
  return segmentStatusLabels[review?.status] || "待制作";
}

export function Production({
  api,
  token,
  onDirtyChange,
}: {
  api: (path: string, body?: any) => Promise<any>;
  token: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [data, setData] = useState<any>(),
    [selected, setSelected] = useState(""),
    [title, setTitle] = useState(""),
    [intent, setIntent] = useState(""),
    [design, setDesign] = useState<any>(),
    [parameters, setParameters] = useState<Record<string, unknown>>({}),
    [overrides, setOverrides] = useState<Record<string, unknown>>({}),
    [locks, setLocks] = useState<string[]>([]),
    [selectedObject, setSelectedObject] = useState(""),
    [dirty, setDirty] = useState(false),
    [feedback, setFeedback] = useState(""),
    [requestText, setRequestText] = useState(""),
    [requestReason, setRequestReason] = useState(""),
    [substitute, setSubstitute] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [panel, setPanel] = useState<"feedback" | "actions" | "design">("feedback"),
    [notice, setNotice] = useState(""),
    [time, setTime] = useState(0),
    [entryFrame, setEntryFrame] = useState(0),
    [seekVersion, setSeekVersion] = useState(0),
    [samplePlayback, setSamplePlayback] = useState("latest"),
    [viewedSampleId, setViewedSampleId] = useState(""),
    [view, setView] = useState<
      "cut" | "review" | "scene" | "sample" | "previous"
    >("cut");
  const [scopedState, setScopedState] = useState<{
    sceneId: string;
    context: any;
    loading: boolean;
    error: string;
  }>({sceneId: "", context: null, loading: false, error: ""});
  const [scopedReload, setScopedReload] = useState(0);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const video = useRef<HTMLVideoElement>(null);
  const draftRevision = useRef<number | null>(null);
  const restoredSelection = useRef(false);
  const restoreVideoTime = useRef<number | null>(null);
  const scopedSequence = useRef(0);
  const scopedSelection = useRef("");
  const mounted = useRef(false);
  const latestDataRevision = useRef<number | null>(null);
  scopedSelection.current = selected;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      scopedSequence.current += 1;
    };
  }, []);
  useEffect(() => {
    if (!data || !selected) {
      setScopedState({sceneId: "", context: null, loading: false, error: ""});
      return;
    }
    const sceneId = selected;
    let disposed = false;
    let inFlight = false;
    const requestContext = async () => {
      if (inFlight) return;
      inFlight = true;
      const sequence = ++scopedSequence.current;
      try {
        const context = await api(
          "production/context?sceneId=" + encodeURIComponent(sceneId),
        );
        if (
          disposed ||
          sequence !== scopedSequence.current ||
          !mounted.current ||
          scopedSelection.current !== sceneId
        )
          return;
        setScopedState({sceneId, context, loading: false, error: ""});
      } catch (e: any) {
        if (
          disposed ||
          sequence !== scopedSequence.current ||
          !mounted.current ||
          scopedSelection.current !== sceneId
        )
          return;
        setScopedState({
          sceneId,
          context: null,
          loading: false,
          error: e?.message || "当前段落读取失败",
        });
      } finally {
        inFlight = false;
      }
    };
    setScopedState({sceneId, context: null, loading: true, error: ""});
    void requestContext();
    const timer = setInterval(() => void requestContext(), 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
      scopedSequence.current += 1;
    };
  }, [selected, data?.plan.revision, scopedReload]);
  const latestSelection = useRef<any>(null);
  latestSelection.current = data
    ? {
        sceneId: selected || null,
        objectId: selectedObject || null,
        timeSeconds: Math.max(
          0,
          Math.min(time, data.resolved.durationMs / 1000),
        ),
        view: view === "previous" ? "review" : view,
        baseRevision: data.plan.revision,
        hasUnsavedChanges: dirty,
      }
    : null;
  const selectionQueue = useRef<Promise<any>>(Promise.resolve());
  const selectionSent = useRef("");
  const publishSelection = () => {
    const value = latestSelection.current;
    if (!value || !restoredSelection.current) return;
    const text = JSON.stringify(value);
    if (text === selectionSent.current) return;
    selectionSent.current = text;
    selectionQueue.current = selectionQueue.current
      .then(() => api("production/selection", value))
      .catch((e) => {
        selectionSent.current = "";
        setError("当前位置未保存：" + e.message);
      });
  };
  useEffect(() => {
    const t = setInterval(publishSelection, 800);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    publishSelection();
  }, [selected, selectedObject, dirty, view, data?.plan.revision]);
  const commitGlobalContext = (next: any): boolean => {
    const revisionValue = next?.plan?.revision;
    const revision =
      typeof revisionValue === "number" && Number.isFinite(revisionValue)
        ? revisionValue
        : null;
    const knownRevision = latestDataRevision.current;
    if (revision !== null && knownRevision !== null && revision < knownRevision)
      return false;
    if (revision !== null) latestDataRevision.current = revision;
    setData((current: any) => {
      const currentRevision = current?.plan?.revision;
      if (
        revision !== null &&
        typeof currentRevision === "number" &&
        Number.isFinite(currentRevision) &&
        currentRevision > revision
      )
        return current;
      return next;
    });
    return true;
  };
  const refresh = async () => {
    const d = await api("production");
    if (!commitGlobalContext(d)) return null;
    if (!restoredSelection.current) {
      const saved = d.selection;
      if (
        saved?.sceneId &&
        d.plan.scenes.some((s: any) => s.id === saved.sceneId)
      ) {
        setSelected(saved.sceneId);
        setSelectedObject(
          d.sceneEditors?.[saved.sceneId]?.objects.some(
            (o: any) => o.id === saved.objectId,
          )
            ? saved.objectId
            : "",
        );
        setTime(saved.timeSeconds);
        setEntryFrame(Math.round(saved.timeSeconds * 30));
        if (saved.view === "scene") setView("scene");
        else {
          restoreVideoTime.current = saved.timeSeconds;
          if (saved.view === "review") setView(d.job?.current && d.job?.status === "done" ? "review" : d.previousReview ? "previous" : "cut");
          else if (
            saved.view === "sample" &&
            reviewHasPlayback(
              segmentReviewsFor(d).find(
                (review: any) => review.sceneId === saved.sceneId,
              ),
            )
          )
            setView("sample");
        }
      }
      restoredSelection.current = true;
    }
    setSelected((s) =>
      d.plan.scenes.some((x: any) => x.id === s)
        ? s
        : d.plan.scenes[0]?.id || "",
    );
    return d;
  };
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    const t = setInterval(
      () => refresh().catch((e) => setError(e.message)),
      2000,
    );
    return () => clearInterval(t);
  }, []);
  const scene = data?.plan.scenes.find((s: any) => s.id === selected),
    scopedCandidate =
      scopedState.sceneId === selected &&
      // A transition preview includes its preceding exit scene as a dependency.
      // The requested incoming scene remains last in this scoped plan.
      scopedState.context?.plan?.scenes?.at(-1)?.id === selected &&
      scopedState.context.plan.revision === data?.plan?.revision
        ? scopedState.context
        : null,
    scopedLoaded = Boolean(scopedCandidate),
    scopedLoading = scopedState.sceneId === selected && scopedState.loading,
    scopedError = scopedState.sceneId === selected ? scopedState.error : "",
    scopedProps = scopedCandidate?.props || null,
    scopedProgramError = scopedCandidate?.programError || "",
    resolved = scopedCandidate?.resolved?.scenes?.find(
      (s: any) => s.id === selected,
    ),
    sceneEditor =
      scopedCandidate?.sceneEditors?.[selected] || data?.sceneEditors?.[selected];
  useEffect(() => {
    if (!dirty) {
      setTitle(scene?.title || "");
      setIntent(scene?.intent || "");
      setDesign(scene?.design);
      setParameters(data?.sceneEditors?.[selected]?.parameters || {});
      setOverrides(scene?.editor?.overrides || {});
      setLocks(scene?.editor?.locks || []);
    }
  }, [selected, data?.plan.revision, dirty]);
  useEffect(() => {
    if (view === "review" && !data?.job?.current) {
      setView(data?.previousReview ? "previous" : "cut");
      setTime(0);
    }
    if (view === "sample" && scopedLoaded) {
      const review = segmentReviewsFor(data).find(
        (item: any) => item.sceneId === selected,
      );
      if (!reviewHasPlayback(review)) {
        setView("cut");
        setTime(0);
      }
    }
  }, [data?.job?.current, data?.segmentReviews, data?.sample, selected, view, scopedLoaded]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setScopedReload((value) => value + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const saved = await api("production/scene-edit", {
        expectedRevision: draftRevision.current ?? data.plan.revision,
        sceneId: selected,
        patch: {
          title,
          intent,
          ...(design ? {design} : {}),
          editor: {overrides, locks},
        },
      });
      if (!commitGlobalContext(saved))
        throw Error("保存响应版本较旧，请重新读取当前段落后再试");
      setDirty(false);
      setNotice("修改已保存，编辑画面已更新；审阅样片需重新生成。");
      setScopedReload((value) => value + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  async function material(id: string, file: File) {
    await run(async () => {
      const r = await fetch(
        "/api/production/material?requestId=" +
          encodeURIComponent(id) +
          "&revision=" +
          data.plan.revision +
          "&name=" +
          encodeURIComponent(file.name),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Workbench-Token": token,
          },
          body: file,
        },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
    });
  }
  if (!data)
    return <div className="loading">{error || "正在读取制作方案…"}</div>;
  const segmentReviews = segmentReviewsFor(data),
    scopedReviews = Array.isArray(scopedCandidate?.segmentReviews)
      ? scopedCandidate.segmentReviews
      : null,
    selectedReview = scopedLoaded
      ? (scopedReviews || segmentReviews).find(
          (review: any) => review.sceneId === selected,
        )
      : null,
    selectedLatest = selectedReview?.latest || null,
    selectedApproved = selectedReview?.approved || null,
    historyTasks = Array.isArray(selectedReview?.history)
      ? selectedReview.history
      : [],
    historyPlayback = samplePlayback.startsWith("history:")
      ? historyTasks.find(
          (task: any) => task.id === samplePlayback.slice("history:".length),
        )
      : null,
    playbackTask =
      samplePlayback === "approved" && taskIsPlayable(selectedApproved)
        ? selectedApproved
        : historyPlayback && taskIsPlayable(historyPlayback)
          ? historyPlayback
          : taskIsPlayable(selectedLatest)
            ? selectedLatest
            : taskIsPlayable(selectedApproved)
              ? selectedApproved
              : historyTasks.find((task: any) => taskIsPlayable(task)) || null,
    playbackKind = playbackTask
      ? playbackTask.id === selectedLatest?.id
        ? "latest"
        : playbackTask.id === selectedApproved?.id
          ? "approved"
          : "history"
      : null,
    currentLatest =
      selectedLatest?.status === "done" &&
      selectedLatest.current === true &&
      taskIsPlayable(selectedLatest)
        ? selectedLatest
        : null,
    currentLatestViewed =
      Boolean(currentLatest) && viewedSampleId === currentLatest?.id,
    selectedRendering = ["rendering", "cancelling"].includes(
      selectedLatest?.status,
    ),
    selectedApprovedStale = Boolean(
      selectedApproved && selectedApproved.current === false,
    ),
    feedbackOpen = Number(selectedReview?.feedbackOpen || 0),
    playbackOffset = playbackTask
      ? (Number.isFinite(playbackTask.from)
          ? playbackTask.from
          : selectedReview?.from || 0) / 30
      : 0,
    duration = data.resolved.durationMs / 1000,
    requests = (scopedCandidate?.plan?.requests || data.plan.requests).filter(
      (r: any) => r.sceneId === selected,
    ),
    comments = data.plan.feedback.filter((r: any) => r.sceneId === selected),
    currentReview = data.job?.status === "done" && data.job.current,
    renderTasks = Array.from(new Map([
      data.job,
      data.sample,
      ...segmentReviews.map((review: any) => review.latest),
    ].filter(Boolean).map((task: any) => [task.id, task])).values()),
    rendering = renderTasks.some((task: any) =>
      ["rendering", "cancelling"].includes(task?.status),
    ),
    activeRender = renderTasks.find((task: any) =>
      ["rendering", "cancelling"].includes(task?.status),
    ),
    confirmedCount = segmentReviews.filter(
      (review: any) =>
        review.status === "approved" &&
        review.approved &&
        review.approved.current !== false,
    ).length,
    assemblyReady = data.assemblyReady === true,
    videoSrc =
      view === "previous"
        ? data.previousReview?.url
        : view === "sample"
          ? playbackTask?.url
          : view === "review"
            ? data.job?.url
            : data.cut.preview?.url;
  const feedbackInScene =
    selectedReview &&
    time >= selectedReview.from / 30 - 0.001 &&
    time <= selectedReview.end / 30 + 0.001;
  const sceneIndex = data.resolved.scenes.findIndex((s: any) => s.id === selected);
  const nextScene = data.resolved.scenes[sceneIndex + 1];
  const editingView = view === "scene";
  const approvedCurrent = selectedReview?.status === "approved" && selectedApproved?.current !== false;
  function chooseScene(id: string) {
    if (dirty || busy) return;
    const item = data.resolved.scenes.find((s: any) => s.id === id);
    if (!item) return;
    const seconds = (item.startMs || 0) / 1000;
    video.current?.pause();
    setSelected(id); setTime(seconds); setEntryFrame(Math.round(seconds * 30));
    setSelectedObject(""); setSamplePlayback("latest"); setViewedSampleId("");
    setView("scene"); setNotice("");
    setSeekVersion(v => v + 1);
  }
  function openSample() {
    video.current?.pause();
    restoreVideoTime.current = (selectedReview?.from || 0) / 30;
    setSamplePlayback("latest"); setView("sample"); setViewedSampleId("");
  }
  const canApprove = scopedLoaded && !scopedProgramError && !scopedError && !busy && !dirty && !!currentLatest && view === "sample" &&
    playbackKind === "latest" && currentLatestViewed && !currentLatest.pendingMaterials && feedbackOpen === 0 && !approvedCurrent;
  const renderSegment = () => {
    if (!scopedLoaded || scopedProgramError || scopedError) return;
    return run(() => api("production/render", {
      sceneId: selected,
      expectedRevision: scopedCandidate?.plan?.revision ?? data.plan.revision,
    }));
  };
  const approveSegment = () => run(async () => {
    if (!scopedLoaded || scopedProgramError || scopedError || !selectedLatest)
      throw Error("当前段落尚未读取完成，暂不能确认");
    await api("production/approve-sample", {sceneId: selected, key: selectedLatest.key, renderId: selectedLatest.id});
    setNotice("本段已确认。可以继续审阅下一段。");
  });
  const statusHint = (scopedError && "当前段落读取失败") || (scopedLoaded && scopedProgramError && "请补齐本段素材") || (scopedLoading && "正在读取当前段落…") || (!scopedLoaded && "正在读取当前段落…") || (dirty ? "有未保存修改" : selectedRendering ? "正在生成本段样片" : approvedCurrent ? "本段已确认" :
    currentLatest ? (feedbackOpen ? `${feedbackOpen} 条反馈待处理` : currentLatest.pendingMaterials ? "补齐素材后可确认" : "样片已就绪，播放后确认") :
    selectedLatest?.status === "failed" ? "生成失败，可以重试" : selectedLatest ? "画面已更新，请重新生成样片" : "编辑满意后，生成带原声的本段样片");
  return (
    <div className="production-workspace">
      <aside className="left">
        <div className="eyebrow">制作方案</div>
        <h2>视觉段落</h2>
        <div className="segment-progress">
          已确认 {confirmedCount} / {segmentReviews.length} 段
        </div>
        {data.resolved.scenes.map((s: any, i: number) => {
          const review = segmentReviews.find(
            (item: any) => item.sceneId === s.id,
          );
          return (
            <button
              key={s.id}
              disabled={dirty}
              className={
                "production-scene " + (selected === s.id ? "selected" : "")
              }
              onClick={() => chooseScene(s.id)}
            >
              <small>
                {(i + 1).toString().padStart(2, "0")} · {" "}
                {s.startMs !== null
                  ? (s.startMs / 1000).toFixed(2) + "s"
                  : "待重新定位"}
              </small>
              <b>{s.title}</b>
              <em className={"segment-badge status-" + (review?.status || "unrendered")}>
                {segmentStatusText(review)}
              </em>
              <span>
                {data.plan.requests.filter(
                  (r: any) => r.sceneId === s.id && r.status === "missing",
                ).length
                  ? "有素材待补"
                  : data.designStatus?.[s.id]?.complete
                    ? "视觉方案已保存"
                    : "未写设计笔记"}
              </span>
            </button>
          );
        })}
        {!scene && (
          <p className="hint">
            请在 Codex 对话中提出设计要求。Codex
            读取当前文稿后，将设计提交到这里。
          </p>
        )}
        <details className="project-export"><summary>整片导出 <span>{confirmedCount}/{segmentReviews.length}</span></summary>
          <p className="hint">逐段确认后合成；未确认的段落不会被自动认可。</p>
        <div className="production-toolbar assembly-toolbar">
          <button
            className="primary"
            disabled={busy || dirty || rendering || !assemblyReady}
            onClick={() =>
              run(() =>
                api("production/assemble", {
                  expectedRevision: data.plan.revision,
                }),
              )
            }
          >
            合成已确认段落
          </button>
          <span className="assembly-status">
            已确认 {confirmedCount} / {segmentReviews.length} 段
            {!assemblyReady && segmentReviews.length > confirmedCount
              ? " · 仍有段落待确认"
              : ""}
          </span>
          {currentReview && (
            <a href={data.job.url} download>
              {data.job.pendingMaterials
                ? "下载带待补标记的草稿"
                : "下载包装 MP4"}
            </a>
          )}
          {currentReview && <button
            disabled={
              busy ||
              dirty ||
              !currentReview ||
              data.job.pendingMaterials ||
              !!data.approval
            }
            onClick={() =>
              run(() => api("production/approve", { key: data.key }))
            }
          >
            {data.approval ? "整片已认可" : "确认整片版本"}
          </button>}
        </div>
        </details>

      </aside>
      <main>
        <div className="workflow-strip"><strong>{scene?.title || '包装与审阅'}</strong><span>段落 {data.plan.scenes.findIndex((s: any) => s.id === selected) + 1} · {resolved?.startMs !== null && resolved?.endMs !== null ? (((resolved?.endMs || 0) - (resolved?.startMs || 0)) / 1000).toFixed(1) : "—"} 秒</span></div>
        <div className="editor-modebar">
          <div className="mode-segment" aria-label="段落工作模式">
            <button aria-pressed={editingView} disabled={!scene || !scopedLoaded} onClick={() => { video.current?.pause(); setEntryFrame(Math.round(time * 30)); setView("scene"); }}>编辑画面</button>
            <button aria-pressed={view === "sample"} disabled={!scopedLoaded || !reviewHasPlayback(selectedReview) || dirty} onClick={openSample}>审阅样片</button>
          </div>
          <span className="preview-state">{dirty ? "未保存" : editingView ? "实时预览" : view === "sample" ? playbackTask?.current ? "最新样片" : "历史样片" : view === "previous" ? "历史成片" : view === "review" ? "整片预览" : "粗剪预览"}</span>
          <details className="version-menu"><summary>版本与对照</summary><div>
            <button disabled={dirty} onClick={() => setView("cut")}>查看粗剪</button>
            {data.previousReview && <button disabled={dirty} onClick={() => setView("previous")}>查看上次成片</button>}
            {currentReview && <button disabled={dirty} onClick={() => setView("review")}>查看最新整片</button>}
            <button disabled={busy || dirty} onClick={() => run(() => api("production/undo", {expectedRevision: data.plan.revision}))}>撤销上次方案修改</button>
          </div></details>
        </div>
        {view === "previous" && (
          <p className="notice">
            正在播放上一次成功导出的版本，尚未包含当前修改。
          </p>
        )}
        {selectedApprovedStale && (
          <p className="notice">
            已确认版本基于旧方案，仍可观看；当前段落需要重新制作并确认。
          </p>
        )}
        {feedbackOpen > 0 && (
          <p className="notice">
            当前段落有 {feedbackOpen} 条待处理反馈，处理后才能确认新样片。
          </p>
        )}
        {view === "sample" && playbackTask && (
          <div className="sample-review-bar">
            <span>
              {playbackKind === "latest"
                ? "当前最新样片"
                : playbackKind === "approved"
                  ? selectedApprovedStale
                    ? "已确认版本（基于旧方案）"
                    : "已确认版本"
                  : "历史样片"}
            </span>
            <details className="sample-review-choices"><summary>样片历史</summary>
              <button
                className={playbackKind === "latest" ? "active" : ""}
                disabled={!taskIsPlayable(selectedLatest)}
                onClick={() => {
                  setSamplePlayback("latest");
                  setViewedSampleId("");
                }}
              >
                当前最新
              </button>
              {taskIsPlayable(selectedApproved) && (
                <button
                  className={playbackKind === "approved" ? "active" : ""}
                  onClick={() => {
                    setSamplePlayback("approved");
                    setViewedSampleId("");
                  }}
                >
                  {selectedApprovedStale ? "已确认（旧版）" : "已确认版本"}
                </button>
              )}
              {historyTasks
                .map((task: any, index: number) => ({...task, version: index + 1}))
                .filter((task: any) => taskIsPlayable(task) && task.id !== selectedLatest?.id && task.id !== selectedApproved?.id)
                .map((task: any, index: number) => (
                  <button
                    key={task.id || index}
                    className={
                      playbackKind === "history" &&
                      playbackTask?.id === task.id
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setSamplePlayback("history:" + task.id);
                      setViewedSampleId("");
                    }}
                  >
                    历史版本 {task.version}
                  </button>
                ))}
            </details>
          </div>
        )}
        <div className="cut-canvas">
          <ObjectPreview
            objects={editingView ? sceneEditor?.objects || [] : []}
            selected={selectedObject}
            onSelect={setSelectedObject}
          >
            {view === "scene" && !scopedLoaded ? (
              <div className="empty">
                {scopedError || "正在读取当前段落…"}
              </div>
            ) : view === "scene" && scopedProgramError ? (
              <div className="empty">请补齐本段素材后再预览。</div>
            ) : view === "scene" && !scene?.program && scopedProps && !scopedProps.scenePrograms ? (
              <LegacyProgramPreview
                props={{
                  ...scopedProps,
                  mediaSrc: data.cut.preview.url,
                  sceneEdits: (scopedProps.sceneEdits || []).map((e: any) =>
                    e.id === selected ? { ...e, overrides } : e,
                  ),
                }}
                seekVersion={seekVersion}
                startFrame={Math.min(entryFrame, Math.max(0, scopedProps.duration - 1))}
                onTime={setTime}
              />
            ) : view === "scene" &&
              scene?.program &&
              scopedProps?.scenePrograms ? (
              (() => {
                const module = data.sceneModules.find(
                  (m: any) => m.id === scene.program.moduleId,
                );
                const input = scopedProps.scenePrograms.find(
                  (s: any) => s.id === selected,
                );
                const previewScene=(s:any)=>({...s,
                  componentLayers:(scopedProps.componentLayers||[]).filter((l:any)=>l.from>=s.from && l.from+l.duration<=s.from+(s.transitionSpanFrames??s.duration)).map((l:any)=>({...l,
                    mediaSources:(l.mediaSources||[]).map((m:any)=>({...m,src:m.assetId?'/api/production/component-assets/file/'+m.assetId:data.cut.preview.url}))})),
                  mediaSrc:data.cut.preview.url,materials:s.materials.map((m:any)=>({...m,src:'/production-media/assets/'+m.src}))});
                const outgoingInput=input?.transitionFromSceneId && scopedProps.scenePrograms.find((s:any)=>s.id===input.transitionFromSceneId);
                const outgoingModule=outgoingInput && data.sceneModules.find((m:any)=>m.id===outgoingInput.moduleId);
                return module && input ? (
                  <SceneModulePreview
                    seekVersion={seekVersion}
                    module={module}
                    fallbackUrl={data.previousReview?.url}
                    initialFrame={Math.min(
                      input.duration - 1,
                      Math.max(0, entryFrame - input.from),
                    )}
                    onTime={setTime}
                    outgoing={outgoingInput&&outgoingModule?{module:outgoingModule,scene:previewScene(outgoingInput),frame:input.transitionOutgoingFrame}:undefined}
                    scene={{
                      ...previewScene(input),
                      title,
                      parameters: { ...input.parameters, ...parameters },

                    }}
                  />
                ) : (
                  <div className="empty">这段还未制作包装，可以切换到粗剪查看。</div>
                );
              })()
            ) : view === "scene" ? (
              <div className="empty">当前段落尚无可用预览。</div>
            ) : videoSrc ? (
              <video
                ref={video}
                controls
                key={videoSrc}
                src={videoSrc}
                onLoadedMetadata={(e) => {
                  const offset = view === "sample" ? playbackOffset : 0;
                  if (restoreVideoTime.current !== null) {
                    e.currentTarget.currentTime = Math.max(
                      0,
                      Math.min(
                        e.currentTarget.duration,
                        restoreVideoTime.current - offset,
                      ),
                    );
                    restoreVideoTime.current = null;
                  }
                  setTime(e.currentTarget.currentTime + offset);
                }}
                onPlay={() => {
                  if (view === "sample" && playbackTask?.id)
                    setViewedSampleId(playbackTask.id);
                }}
                onTimeUpdate={(e) => {
                  if (
                    view === "sample" &&
                    playbackTask?.id &&
                    e.currentTarget.currentTime > 0
                  )
                    setViewedSampleId(playbackTask.id);
                  setTime(
                    e.currentTarget.currentTime +
                      (view === "sample" ? playbackOffset : 0),
                  );
                }}
              />
            ) : (
              <div className="empty">请先在剪辑页生成连续预览</div>
            )}
          </ObjectPreview>
        </div>
        {(scopedError || scopedProgramError) && (
          <p className="error">
            当前段落暂不可用：{scopedError || scopedProgramError}
            。可以通过“上一版视频”继续查看已有结果。
          </p>
        )}
        {scopedLoaded && scopedCandidate?.resolved?.stale && (
          <div className="notice">
            粗剪已变化，原有审阅不再代表当前画面。
            <button
              disabled={busy || dirty || (scopedCandidate?.resolved?.issues || []).length > 0}
              onClick={() =>
                run(() =>
                  api("production/rebase", {
                    expectedRevision: data.plan.revision,
                  }),
                )
              }
            >
              同步剪辑时间
            </button>
          </div>
        )}
        {(scopedCandidate?.resolved?.issues || []).map((s: string) => (
          <p className="error" key={s}>
            {s}
          </p>
        ))}
        <div className="segment-command-bar" aria-label="当前段落操作">
          <div><strong>{statusHint}</strong><small>第 {sceneIndex + 1} / {data.resolved.scenes.length} 段 · {Math.max(0, time - (resolved?.startMs || 0) / 1000).toFixed(1)} 秒</small></div>
          <div className="segment-command-buttons">
            {dirty ? <><button onClick={() => {draftRevision.current = null; setDirty(false); setNotice("");}} disabled={busy}>放弃修改</button><button className="primary" disabled={busy} onClick={save}>保存修改</button></> :
             !scopedLoaded ? <button className="primary" disabled>读取当前段落…</button> :
             scopedError || scopedProgramError ? <button className="primary" disabled>当前段落不可用</button> :
             selectedRendering ? <span role="status">{Math.round((selectedLatest.progress || 0) * 100)}%</span> :
             approvedCurrent ? <><button disabled={busy || rendering} onClick={renderSegment}>重新生成</button>{nextScene && <button className="primary" onClick={() => chooseScene(nextScene.id)}>下一段 →</button>}</> :
             currentLatest ? <><button disabled={busy || rendering} onClick={renderSegment}>重新生成</button>{view !== "sample" || playbackKind !== "latest" ? <button className="primary" disabled={busy} onClick={openSample}>审阅本段</button> : <button className="primary" disabled={!canApprove} onClick={approveSegment}>{currentLatestViewed ? "确认本段" : "播放后确认"}</button>}</> :
             <button className="primary" disabled={busy || rendering || !scene} onClick={renderSegment}>{selectedLatest?.status === "failed" ? "重试生成样片" : "生成本段样片"}</button>}
          </div>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
        <nav className="detail-tabs" aria-label="段落详情">{([['feedback','反馈'],['actions','口播与动作'],['design','设计说明']] as const).map(([id,label]) => <button key={id} aria-pressed={panel === id} onClick={() => setPanel(id)}>{label}{id === 'feedback' && comments.length ? ` · ${comments.length}` : ''}</button>)}</nav>
        {scene && panel === "actions" && (<ActionReview key={`actions:${selected}`} disabledReason={view === 'previous' || (view === 'sample' && !playbackTask?.current) || (view === 'review' && !currentReview) ? '正在查看历史视频；切到编辑画面或当前版本后检查动作。' : undefined} actions={reviewActions(design, resolved?.beats || [], resolved?.startMs ?? null, resolved?.endMs ?? null, scopedCandidate?.resolved?.words || [])} onSeek={(frame, objectId) => {
              setEntryFrame(frame);
              setSeekVersion(v => v + 1);
              if (objectId && sceneEditor?.objects.some((o: any) => o.id === objectId)) setSelectedObject(objectId);
              if (view === 'scene') { setTime(frame / 30); return; }
              if (video.current) {
                video.current.pause();
                video.current.currentTime = localPlaybackTime(frame, view === 'sample' ? playbackOffset : 0, video.current.duration || duration);
                setTime(video.current.currentTime + (view === 'sample' ? playbackOffset : 0));
              }
            }}/>)}
        {selectedLatest?.status === "done" && !selectedLatest.current && (
          <p className="hint">
            当前段落样片来自旧方案，请重新制作后再确认。
          </p>
        )}
        {activeRender && (
          <div className="production-toolbar">
            <span>
              {activeRender.kind === "assembly"
                ? "整片合成："
                : activeRender.sceneId
                  ? "段落样片："
                  : "整片审阅："}
              {activeRender.status === "cancelling"
                ? "正在停止，请稍候…"
                : activeRender.stage}
            </span>
            <button
              disabled={busy || activeRender.status === "cancelling"}
              onClick={() =>
                run(() =>
                  api("production/cancel-render", { id: activeRender.id }),
                )
              }
            >
              取消渲染
            </button>
          </div>
        )}
        {renderTasks
          .filter((task: any) => task?.status === "cancelled")
          .map((task: any) => (
            <p className="hint" key={task.id}>
              {task.kind === "assembly"
                ? "整片合成"
                : task.sceneId
                  ? "段落样片"
                  : "整片审阅"}
              已取消，可重新制作。上一版视频仍然保留。
            </p>
          ))}
        {(selectedLatest?.status === "failed") && (
          <p className="error">
            样片失败：{selectedLatest?.error}
          </p>
        )}
        {(view === "previous" || view === "review") && data.job && !data.job.current && data.previousReview && (
          <p className="hint">旧审阅已保留，当前修改需要重新渲染。</p>
        )}
        {(error || data.job?.status === "failed") && (
          <p className="error">{error || data.job.error}</p>
        )}
        {scene && panel === "design" && (
          <CreativeDesignPanel
            key={`design:${selected}`}
            design={design}
            beats={scene.beats}
            onChange={(v) => {
              setDesign(v);
              if (!dirty) draftRevision.current = data.plan.revision;
              setDirty(true);
            }}
          />
        )}
        {scene && panel === "feedback" && (
          <>
            <div className="transcript-head">
              <h2>对这段的反馈</h2>
              <small>
                {feedbackInScene
                  ? `记录在当前 ${time.toFixed(2)} 秒`
                  : "请点击本段的时间点后记录反馈"}
              </small>
            </div>
            <div className="feedback-compose">
              <input
                aria-label="本段反馈"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="例如：第二个信息出现太早，人物再大一点"
              />
              <button
                disabled={busy || dirty || !feedbackInScene || !feedback.trim()}
                onClick={() =>
                  run(async () => {
                    await api("production/feedback", {
                      expectedRevision: data.plan.revision,
                      feedback: {
                        sceneId: selected,
                        timeMs: Math.round(time * 1000),
                        text: feedback,
                      },
                    });
                    setFeedback("");
                  })
                }
              >
                记录反馈
              </button>
            </div>
            {comments.map((f: any) => (
              <div className="feedback-row" key={f.id}>
                <span>
                  {(f.timeMs / 1000).toFixed(2)}s · {f.text}
                  <small>
                    方案版本 {f.revision} ·{" "}
                    {f.status === "resolved" ? "已处理" : "待处理"}
                  </small>
                </span>
                {f.status === "open" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        api("production/resolve-feedback", {
                          expectedRevision: data.plan.revision,
                          id: f.id,
                        }),
                      )
                    }
                  >
                    标记已处理
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </main>
      <aside className="right">
        <div className="eyebrow">当前段落</div>
        {scene ? (
          <>
            <h2>检查器</h2>
            <details className="scene-notes"><summary>段落标题与说明</summary>
            <label className="field">
              画面标题
              <input
                value={title}
                maxLength={80}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!dirty) draftRevision.current = data.plan.revision;
                  setDirty(true);
                }}
              />
            </label>
            <label className="field">
              设计说明
              <textarea
                value={intent}
                onChange={(e) => {
                  setIntent(e.target.value);
                  if (!dirty) draftRevision.current = data.plan.revision;
                  setDirty(true);
                }}
              />
            </label>
            </details>
            {scene.program && data.capabilities?.sceneTransitions && <details className="scene-notes"><summary>段落衔接</summary>
              <label className="field">进入方式<select aria-label="段落进入方式" disabled={busy||dirty||data.plan.scenes[0]?.id===selected}
                value={scene.entryTransition?.type||'cut'} onChange={(e)=>run(()=>api('production/scene-edit',{expectedRevision:data.plan.revision,sceneId:selected,
                  patch:{entryTransition:e.target.value==='cut'?null:{type:e.target.value,frames:scene.entryTransition?.frames||8}}}))}>
                <option value="cut">直接切换</option><option value="dissolve">淡入衔接</option><option value="slide-left">向左推进</option>
              </select></label>
              {scene.entryTransition && <label className="field">衔接时长（秒）<input aria-label="段落衔接时长" type="number" min="0.07" max="1" step="0.1" disabled={busy||dirty}
                key={`transition-duration:${selected}:${scene.entryTransition.frames}`} defaultValue={Number((scene.entryTransition.frames/30).toFixed(2))}
                onBlur={(e)=>{const seconds=Number(e.target.value);if(!Number.isFinite(seconds)||seconds<0.07||seconds>1){e.target.value=(scene.entryTransition.frames/30).toFixed(2);return;}
                  if(Math.round(seconds*30)===scene.entryTransition.frames)return;
                  e.target.value=(scene.entryTransition.frames/30).toFixed(2);
                  void run(()=>api('production/scene-edit',{expectedRevision:data.plan.revision,sceneId:selected,patch:{entryTransition:{...scene.entryTransition,frames:Math.max(2,Math.min(30,Math.round(seconds*30)))}}}));}}/></label>}
              <p className="hint">{data.plan.scenes[0]?.id===selected?'首段直接开始。':dirty?'先保存画面调整，再修改衔接。':'衔接在本段样片中审阅，不改变口播时间。'}</p>
            </details>}
            <ObjectProperties
              editor={sceneEditor}
              selected={selectedObject}
              values={parameters}
              locks={locks}
              onSelect={(id) => {
                setSelectedObject(id);
                setView("scene");
              }}
              onChange={(key, value) => {
                if (view !== "scene") {setEntryFrame(Math.round(time * 30)); setView("scene");}
                setParameters((p) => ({ ...p, [key]: value }));
                setOverrides((p) => ({ ...p, [key]: value }));
                if (!dirty) draftRevision.current = data.plan.revision;
                setDirty(true);
              }}
              onLock={(key) => {
                setLocks((l) =>
                  l.includes(key) ? l.filter((k) => k !== key) : [...l, key],
                );
                setOverrides((o) => ({ ...o, [key]: parameters[key] }));
                if (!dirty) draftRevision.current = data.plan.revision;
                setDirty(true);
              }}
            />
            <p className="inspector-save-state" role="status">{dirty ? "修改即时预览 · 在画面下方保存" : "所有修改已保存"}</p>
            <hr />
            {scene.program && <SaveAnimation api={api} scene={scene} revision={data.plan.revision} sourceHash={data.sceneModules.find((m:any)=>m.id===scene.program.moduleId)?.sourceHash} disabled={dirty||busy}/>}
            <h2>需要的素材</h2>
            {dirty && requests.length > 0 && <p className="hint">先保存当前画面调整，再替换素材。</p>}
            {requests.map((r: any) => (
              <div className="material-request" key={r.id}>
                <b>{r.description}</b>
                <p>{r.reason}</p>
                <small>
                  {r.status === "missing"
                    ? "待补充"
                    : r.status === "provided"
                      ? "素材已绑定"
                      : "已接受替代"}
                </small>
                {r.note && <p>{r.note}</p>}
                <label className="upload compact">
                  {r.status === "provided" ? "替换素材" : "补充图片 / 视频"}
                  <input
                    disabled={busy || dirty}
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void material(r.id, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {r.status === "missing" && (
                  <>
                    <input
                      placeholder="接受哪种替代方式"
                      value={substitute}
                      onChange={(e) => setSubstitute(e.target.value)}
                    />
                    <button
                      disabled={busy || !substitute.trim()}
                      onClick={() =>
                        run(() =>
                          api("production/request", {
                            expectedRevision: data.plan.revision,
                            request: {
                              ...r,
                              status: "waived",
                              note: substitute,
                            },
                          }),
                        )
                      }
                    >
                      接受这个替代
                    </button>
                  </>
                )}
              </div>
            ))}
            {!requests.length && (
              <p className="hint">这段尚未提出补充素材需求。</p>
            )}
            <details>
              <summary>添加素材需求</summary>
              <input
                placeholder="需要什么素材"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
              />
              <textarea
                placeholder="为什么需要，配合哪句口播"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
              />
              <button
                disabled={busy || !requestText.trim() || !requestReason.trim()}
                onClick={() =>
                  run(async () => {
                    await api("production/request", {
                      expectedRevision: data.plan.revision,
                      request: {
                        id: crypto.randomUUID(),
                        sceneId: selected,
                        description: requestText,
                        reason: requestReason,
                        status: "missing",
                      },
                    });
                    setRequestText("");
                    setRequestReason("");
                  })
                }
              >
                添加需求
              </button>
            </details>
          </>
        ) : (
          <p className="hint">提交场景设计后可修改标题、补充素材并反馈。</p>
        )}
      </aside>
    </div>
  );
}
