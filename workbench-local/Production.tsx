import React, { useCallback, useEffect, useRef, useState } from "react";
import { SceneModulePreview } from "./SceneModulePreview";
import {ActionReview} from "./ActionReview";
import {reviewActions, localPlaybackTime} from "./action-review";
import { CreativeDesignPanel } from "./CreativeDesignPanel";
import { ObjectPreview } from "./ObjectPreview";
import { ObjectProperties } from "./ObjectProperties";
import { LegacyProgramPreview } from "./LegacyProgramPreview";
import { SaveAnimation } from "./AnimationTemplates";
import {productionContextIdentityMatches, scenePreviewReadiness} from "./preview-readiness";
import {FilmStoryboard} from './FilmStoryboard';
import {StyleCoverage} from './StyleCoverage';
import {sceneEntry,completedReview,type ReviewRequest} from './review-navigation';
import type {PlayerRef} from '@remotion/player';
import {applyEditorCommand, objectTransformFor, type CanvasTransform, type EditorChange, type EditorCommand, type EditorReplayRequest} from './editor-commands';
import {transformChanges} from './canvas-geometry';
import {CanvasTransformProperties} from './CanvasTransformProperties';

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
    [parameterDirty, setDirty] = useState(false),
    [feedback, setFeedback] = useState(""),
    [requestText, setRequestText] = useState(""),
    [requestReason, setRequestReason] = useState(""),
    [substitute, setSubstitute] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [time, setTime] = useState(0),
    [entryFrame, setEntryFrame] = useState(0),
    [seekVersion, setSeekVersion] = useState(0),
    [samplePlayback, setSamplePlayback] = useState("latest"),
    [viewedSampleId, setViewedSampleId] = useState(""),
    [view, setView] = useState<
      "cut" | "review" | "scene" | "sample" | "previous"
    >("cut");
  const [canvasDraft, setCanvasDraft] = useState<{id: string; transform?: CanvasTransform; text?: {key: string; value: string}} | null>(null);
  const [canvasActive, setCanvasActive] = useState(false);
  const [canvasSaving, setCanvasSaving] = useState(false);
  const scenePlayer = useRef<PlayerRef>(null);
  const canvasInFlight = useRef(false);
  const canvasInteracting = useRef(false);
  const canvasCommand = useRef<EditorCommand | null>(null);
  const canvasReplay = useRef<{direction: 'undo' | 'redo'; request: EditorReplayRequest; sceneId: string} | null>(null);
  const canvasPending = !!canvasCommand.current || !!canvasReplay.current;
  const dirty = parameterDirty || canvasActive || canvasSaving || !!canvasDraft || canvasPending;
  const draftEditorBase = useRef<{values: Record<string, unknown>; overrides: Record<string, unknown>; locks: string[]} | null>(null);
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
  const pendingReview=useRef<ReviewRequest|null>(null);
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
          canvasInFlight.current || canvasInteracting.current ||
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
    setScopedState(previous => previous.sceneId === sceneId && productionContextIdentityMatches(data, previous.context)
      ? previous : {sceneId, context: null, loading: true, error: ""});
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
    if (canvasInFlight.current || canvasInteracting.current) return null;
    const d = await api("production");
    if (canvasInFlight.current || canvasInteracting.current) return null;
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
  useEffect(() => {
    const events = new EventSource('/api/production/editor/events');
    const changed = (event: MessageEvent) => {
      try {
        const next = JSON.parse(event.data);
        if (typeof next.revision === 'number' && next.revision > (latestDataRevision.current ?? -1))
          void refresh().catch(error => setError(error.message));
      } catch { /* Polling remains the fallback for unsupported or interrupted streams. */ }
    };
    events.addEventListener('revision', changed as EventListener);
    events.onmessage = changed;
    events.onopen = () => {void refresh().catch(error => setError(error.message));};
    return () => events.close();
  }, []);
  const scene = data?.plan.scenes.find((s: any) => s.id === selected),
    scopedCandidate =
      scopedState.sceneId === selected &&
      // A transition preview includes its preceding exit scene as a dependency.
      // The requested incoming scene remains last in this scoped plan.
      scopedState.context?.plan?.scenes?.at(-1)?.id === selected &&
      productionContextIdentityMatches(data, scopedState.context)
        ? scopedState.context
        : null,
    scopedLoaded = Boolean(scopedCandidate),
    scopedLoading = scopedState.sceneId === selected && scopedState.loading,
    scopedError = scopedState.sceneId === selected ? scopedState.error : "",
    scopedProps = scopedCandidate?.props || null,
    scopedProgramError = scopedCandidate?.programError || "",
    previewReadiness = scenePreviewReadiness(data, scopedCandidate || undefined),
    resolved = scopedCandidate?.resolved?.scenes?.find(
      (s: any) => s.id === selected,
    ),
    sceneEditor =
      scopedCandidate?.sceneEditors?.[selected] || data?.sceneEditors?.[selected];
  const canvasAvailable = sceneEditor?.objects?.some((object: any) => object.canvas);
  const canvasTransforms = {...scene?.editor?.objectTransforms,
    ...(canvasDraft?.transform ? {[canvasDraft.id]: canvasDraft.transform} : {})};
  const canvasValues = {...parameters, ...(canvasDraft?.text ? {[canvasDraft.text.key]: canvasDraft.text.value} : {})};
  const selectedCanvasObject = sceneEditor?.objects?.find((object: any) => object.id === selectedObject && object.canvas);
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
  const commitEditorResult = async (saved: any, sceneId: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const scoped = await api('production/context?sceneId=' + encodeURIComponent(sceneId));
      if (!mounted.current) return;
      // Adopt a coherent pair together. Polls started before the gesture are
      // superseded, so they cannot replace this Player with a stale snapshot.
      if (productionContextIdentityMatches(saved, scoped)) {
        scopedSequence.current += 1;
        if (scopedSelection.current === sceneId) setScopedState({sceneId, context: scoped, loading: false, error: ''});
        if (!commitGlobalContext(saved)) throw Error('编辑响应版本较旧，请重新读取工程');
        return;
      }
      saved = await api('production');
    }
    throw Error('工程持续变化，暂时无法读取一致画面；调整已保留，可重试读取');
  };
  const persistCanvasCommand = async (command: EditorCommand) => {
    if (canvasInFlight.current) return;
    canvasCommand.current = command;
    canvasInFlight.current = true; setCanvasSaving(true); setBusy(true); setError('');
    try {
      const saved = await api('production/editor/command', command);
      await commitEditorResult(saved, command.sceneId);
      if (!mounted.current) return;
      canvasCommand.current = null; setCanvasDraft(null);
      setNotice('画面调整已保存；审阅样片需重新生成。');
      return saved;
    } catch (error: any) {
      if (mounted.current) setError('保存结果尚未确认：' + error.message + '。可以重试，或放弃本地调整并重新读取已保存结果。');
      return null;
    } finally {
      canvasInFlight.current = false;
      if (mounted.current) {setCanvasSaving(false); setBusy(false);}
    }
  };
  const editCanvas = (objectId: string, changes: EditorChange[]) => {
    if (!changes.length) {setCanvasDraft(null); return;}
    const command: EditorCommand = {operationId: crypto.randomUUID(), expectedRevision: data.plan.revision,
      sceneId: selected, objectId, actor: 'user', changes};
    try {
      applyEditorCommand(scene.editor, {objects: sceneEditor.objects, controls: sceneEditor.controls,
        resolvedParameters: sceneEditor.parameters}, command);
      void persistCanvasCommand(command);
    } catch (error: any) {setCanvasDraft(null); setError('无法应用画面调整：' + error.message);}
  };
  const replayCanvas = async (direction: 'undo' | 'redo') => {
    if (canvasInFlight.current) return;
    const target = data.editorHistory?.[direction]?.[0];
    if (!canvasReplay.current) {
      if (!target) return;
      canvasReplay.current = {direction, sceneId: selected, request: {operationId: crypto.randomUUID(),
        targetOperationId: target.operationId, expectedRevision: data.plan.revision, actor: 'user'}};
    }
    const pending = canvasReplay.current;
    canvasInFlight.current = true; setCanvasSaving(true); setBusy(true); setError('');
    try {
      const saved = await api('production/editor/' + pending.direction, pending.request);
      await commitEditorResult(saved, pending.sceneId);
      canvasReplay.current = null;
      setNotice(pending.direction === 'undo' ? '已撤销这次画面调整，其他修改保留。' : '已重做这次画面调整。');
    } catch (error: any) {setError('操作结果尚未确认：' + error.message + '。请重试同一次操作，或重新读取已保存结果。');}
    finally {canvasInFlight.current = false; if (mounted.current) {setCanvasSaving(false); setBusy(false);}}
  };
  const save = async () => {
    if (canvasReplay.current) {await replayCanvas(canvasReplay.current.direction); return;}
    if (canvasCommand.current) {if (!await persistCanvasCommand(canvasCommand.current) || !parameterDirty) return;}
    if (canvasActive || canvasSaving || canvasDraft) return;
    if (canvasAvailable && data.capabilities?.objectCommands && draftEditorBase.current) {
      const base = draftEditorBase.current;
      let latest = await api('production');
      const assigned = new Set<string>();
      for (const object of sceneEditor.objects) {
        const changes: EditorChange[] = [];
        for (const key of object.parameters) {
          if (assigned.has(key)) continue;
          assigned.add(key);
          const before = base.values[key], after = parameters[key], wasLocked = base.locks.includes(key), isLocked = locks.includes(key);
          const currentValues = latest.sceneEditors?.[selected]?.parameters || {};
          if ((JSON.stringify(before) !== JSON.stringify(after) || (isLocked && !wasLocked && !Object.hasOwn(base.overrides, key))) &&
            (JSON.stringify(currentValues[key]) !== JSON.stringify(after) || !Object.hasOwn(latest.plan.scenes.find((item: any) => item.id === selected)?.editor?.overrides || {}, key)))
            changes.push({kind: 'parameter', key, before, after});
          if (wasLocked !== isLocked && !!latest.plan.scenes.find((item: any) => item.id === selected)?.editor?.locks.includes(key) !== isLocked)
            changes.push({kind: 'parameterLock', key, before: wasLocked, after: isLocked});
        }
        if (changes.length) {
          const command: EditorCommand = {operationId: crypto.randomUUID(), expectedRevision: latest.plan.revision,
            sceneId: selected, objectId: object.id, actor: 'user', changes};
          const currentEditor = latest.sceneEditors[selected];
          applyEditorCommand(latest.plan.scenes.find((item: any) => item.id === selected).editor,
            {objects: currentEditor.objects, controls: currentEditor.controls, resolvedParameters: currentEditor.parameters}, command);
          const saved = await persistCanvasCommand(command);
          if (!saved) return;
          latest = saved;
        }
      }
      draftEditorBase.current = null; draftRevision.current = null; setDirty(false);
      return;
    }
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
  const enterScene=useCallback((entry:NonNullable<ReturnType<typeof sceneEntry>>)=>{
    pendingReview.current=null;
    video.current?.pause();
    restoreVideoTime.current=entry.view==='sample'?entry.seconds:null;
    setSelected(entry.sceneId);setTime(entry.seconds);setEntryFrame(entry.frame);
    setSelectedObject(""); setSamplePlayback("latest"); setViewedSampleId("");
    setView(entry.view); setNotice("");
    setSeekVersion(v => v + 1);
  },[]);
  const chooseScene = useCallback((id:string,frame?:number)=>{
    if(dirty||busy||!data)return;
    const entry=sceneEntry(data,id,frame);if(entry)enterScene(entry);
  },[dirty,busy,data,enterScene]);
  useEffect(()=>{
    const request=pendingReview.current;
    if(!request||!data)return;
    if(dirty){pendingReview.current=null;return;}
    if(busy||(request.kind==='segment'&&!scopedLoaded))return;
    const next=completedReview(request,data,selected);
    if(next.state==='waiting')return;
    pendingReview.current=null;
    if(next.state!=='ready'){setNotice('');return;}
    video.current?.pause();
    const seconds=(next.task.from??0)/30;
    restoreVideoTime.current=seconds;
    setTime(seconds);setEntryFrame(Math.round(seconds*30));setSamplePlayback('latest');setViewedSampleId('');setView(next.view);
    setNotice(next.view==='review'?'整片已合成，可以播放检查并下载。':'本段样片已就绪，播放后可确认。');
  },[data,selected,dirty,busy,scopedLoaded]);
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

  function openSample() {
    pendingReview.current=null;
    video.current?.pause();
    restoreVideoTime.current = (selectedReview?.from || 0) / 30;
    setSamplePlayback("latest"); setView("sample"); setViewedSampleId("");
  }
  const canApprove = scopedLoaded && !scopedProgramError && !scopedError && !busy && !dirty && !!currentLatest && view === "sample" &&
    playbackKind === "latest" && currentLatestViewed && !currentLatest.pendingMaterials && feedbackOpen === 0 && !approvedCurrent;
  const renderSegment = () => {
    if (!scopedLoaded || scopedProgramError || scopedError) return;
    return run(async()=>{
      const intent:ReviewRequest={kind:'segment',sceneId:selected,id:'',key:''};
      pendingReview.current=intent;
      const next=await api('production/render',{sceneId:selected,expectedRevision:scopedCandidate?.plan?.revision??data.plan.revision}).catch(error=>{if(pendingReview.current===intent)pendingReview.current=null;throw error;});
      if(pendingReview.current!==intent)return;
      if(next.sample?.id&&next.sample.sceneId===selected)pendingReview.current={kind:'segment',sceneId:selected,id:next.sample.id,key:next.sample.key};
      setNotice('正在制作本段样片，完成后会自动打开。');
    });
  };
  const beginAssembly=async(context:any)=>{
    const intent:ReviewRequest={kind:'assembly',id:'',key:''};
    pendingReview.current=intent;
    const next=await api('production/assemble',{expectedRevision:context.plan.revision}).catch(error=>{if(pendingReview.current===intent)pendingReview.current=null;throw error;});
    if(pendingReview.current!==intent)return;
    if(next.job?.id)pendingReview.current={kind:'assembly',id:next.job.id,key:next.job.key};
    setNotice('正在合成整片，完成后会自动打开。');
  };
  const approveSegment = () => run(async () => {
    if (!scopedLoaded || scopedProgramError || scopedError || !selectedLatest)
      throw Error("当前段落尚未读取完成，暂不能确认");
    const next=await api("production/approve-sample", {sceneId: selected, key: selectedLatest.key, renderId: selectedLatest.id});
    if(nextScene){const entry=sceneEntry(next,nextScene.id);if(entry)enterScene(entry);setNotice('上一段已确认，继续查看这一段。');}
    else if(next.assemblyReady)await beginAssembly(next);
    else setNotice('本段已确认，其余段落仍有待处理事项。');
  });
  const statusHint = (scopedError && "当前段落读取失败") || (scopedLoaded && scopedProgramError && "请补齐本段素材") || (scopedLoading && "正在读取当前段落…") || (!scopedLoaded && "正在读取当前段落…") || (dirty ? "有未保存修改" : selectedRendering ? "正在生成本段样片" : approvedCurrent ? "本段已确认" :
    currentLatest ? (feedbackOpen ? `${feedbackOpen} 条反馈待处理` : currentLatest.pendingMaterials ? "补齐素材后可确认" : "样片已就绪，播放后确认") :
    selectedLatest?.status === "failed" ? "生成失败，可以重试" : selectedLatest ? "画面已更新，请重新生成样片" : "编辑满意后，生成带原声的本段样片");
  return (
    <div className="production-workspace">
      <aside className="left">
        <div className="eyebrow">制作方案</div>
        <h2>视觉段落</h2>
        {data.stylePackInfo&&<p className="production-style-pack"><strong>{data.stylePackInfo.name}</strong><small>{data.stylePackInfo.unavailable?'风格文件待恢复':'全片风格'}</small></p>}
        <StyleCoverage coverage={data.stylePackInfo?.coverage} compact selectedSceneId={selected} disabled={dirty||busy||rendering} onFollow={()=>run(()=>api("production/follow-style",{expectedRevision:data.plan.revision,sceneId:selected,actor:"user"}))}/>
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
                  : ""}
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
            onClick={()=>run(()=>beginAssembly(data))}
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
        </div>
        </details>

      </aside>
      <main>
        {data.capabilities?.filmDirection&&<FilmStoryboard api={api} data={data} selected={selected} disabled={dirty||busy||rendering} onSelect={chooseScene}/>}
        <div className="workflow-strip"><strong>{scene?.title || '包装与审阅'}</strong><span>段落 {data.plan.scenes.findIndex((s: any) => s.id === selected) + 1} · {resolved?.startMs != null && resolved?.endMs != null ? ((resolved.endMs - resolved.startMs) / 1000).toFixed(1) : "—"} 秒</span></div>
        <div className="editor-modebar">
          <div className="mode-segment" aria-label="段落工作模式">
            <button aria-pressed={editingView} disabled={!scene || !scopedLoaded} onClick={() => { pendingReview.current=null;video.current?.pause(); setEntryFrame(Math.round(time * 30)); setView("scene"); }}>编辑画面</button>
            <button aria-pressed={view === "sample"} disabled={!scopedLoaded || !reviewHasPlayback(selectedReview) || dirty} onClick={openSample}>审阅样片</button>
          </div>
          <span className="preview-state">{dirty ? "未保存" : !scopedLoaded && (view === "scene" || view === "sample") ? "正在读取" : editingView ? "实时预览" : view === "sample" ? playbackTask?.current ? "最新样片" : "历史样片" : view === "previous" ? "历史成片" : view === "review" ? "整片预览" : "粗剪预览"}</span>
          <details className="version-menu"><summary>版本与对照</summary><div>
            {reviewHasPlayback(selectedReview)&&<button disabled={busy||dirty||rendering||!scopedLoaded} onClick={renderSegment}>重新制作本段</button>}
            <button disabled={dirty} onClick={() => {pendingReview.current=null;setView("cut");}}>查看粗剪</button>
            {data.previousReview && <button disabled={dirty} onClick={() => {pendingReview.current=null;setView("previous");}}>查看上次成片</button>}
            {currentReview && <button disabled={dirty} onClick={() => {pendingReview.current=null;setView("review");}}>查看最新整片</button>}
            {!data.editorSnapshot?.hasCommands && <button disabled={busy || dirty} onClick={() => run(() => api("production/undo", {expectedRevision: data.plan.revision}))}>撤销上次方案修改</button>}
          </div></details>
        </div>
        {canvasAvailable && editingView && <div className="canvas-edit-toolbar">
          <button disabled={busy || dirty || !data.editorHistory?.undo?.length} onClick={() => void replayCanvas('undo')} title={data.editorHistory?.undo?.[0]?.label}>撤销画面调整</button>
          <button disabled={busy || dirty || !data.editorHistory?.redo?.length} onClick={() => void replayCanvas('redo')}>重做</button>
          <span className="hint">{canvasSaving ? '正在保存画面调整…' : canvasPending ? '操作结果待确认，可重试' : '拖动位置 · 角点缩放 · 圆点旋转 · 双击改字'}</span>
        </div>}
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
                  pendingReview.current=null;
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
                    pendingReview.current=null;
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
                      pendingReview.current=null;
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
            canvas={canvasAvailable && editingView ? {
              transforms: canvasTransforms, locks: scene?.editor?.objectLocks || [], values: canvasValues,
              disabled: busy || parameterDirty || (canvasPending && !canvasSaving),
              onInteractionStart: () => {pendingReview.current = null; scenePlayer.current?.pause();},
              onActiveChange: active => {canvasInteracting.current = active; setCanvasActive(active);},
              onTransformPreview: (id, transform) => setCanvasDraft(transform ? {id, transform} : null),
              onTransformCommit: (id, before, after) => editCanvas(id, transformChanges(before, after)),
              onTextPreview: (id, key, value) => setCanvasDraft(value === null ? null : {id, text: {key, value}}),
              onTextCommit: (id, key, before, after) => editCanvas(id, [{kind: 'parameter', key, before, after}]),
            } : undefined}
          >
            {(view === "scene" || view === "sample") && !scopedLoaded ? (
              <div className="empty">
                {scopedError || "正在读取当前段落…"}
              </div>
            ) : view === "scene" && scopedProgramError ? (
              <div className="empty" role="alert">当前段落暂不可预览：{scopedProgramError}</div>
            ) : view === "scene" && !previewReadiness.ready ? (
              <div className="empty" role={previewReadiness.kind === "error" ? "alert" : "status"}>{previewReadiness.message}</div>
            ) : view === "scene" && !scene?.program && scopedProps && !scopedProps.scenePrograms ? (
              <LegacyProgramPreview
                props={{
                  ...scopedProps,
                  mediaSrc: previewReadiness.ready ? previewReadiness.mediaUrl : "",
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
                    mediaSrc:previewReadiness.ready?previewReadiness.mediaUrl:'',
                    mediaSources:(l.mediaSources||[]).map((m:any)=>({...m,src:m.assetId?'/api/production/component-assets/file/'+m.assetId:previewReadiness.ready?previewReadiness.mediaUrl:""}))})),
                  mediaSrc:previewReadiness.ready?previewReadiness.mediaUrl:"",materials:s.materials.map((m:any)=>({...m,src:'/production-media/assets/'+m.src}))});
                const outgoingInput=input?.transitionFromSceneId && scopedProps.scenePrograms.find((s:any)=>s.id===input.transitionFromSceneId);
                const outgoingModule=outgoingInput && data.sceneModules.find((m:any)=>m.id===outgoingInput.moduleId);
                return module && input ? (
                  <SceneModulePreview
                    playerRef={scenePlayer}
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
                      parameters: { ...input.parameters, ...canvasValues },
                      objectTransforms: canvasTransforms,

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
            {dirty ? <><button onClick={() => {draftRevision.current = null; draftEditorBase.current = null; canvasCommand.current = null; canvasReplay.current = null; setCanvasDraft(null); setDirty(false); setNotice(""); setError(''); void refresh().catch(error => setError(error.message));}} disabled={busy || canvasActive}>{canvasPending ? '重新读取已保存结果' : '放弃修改'}</button><button className="primary" disabled={busy || canvasActive} onClick={() => void save().catch(error => setError(error.message))}>{canvasPending ? '重试这次操作' : '保存修改'}</button></> :
             !scopedLoaded ? <button className="primary" disabled>读取当前段落…</button> :
             scopedError || scopedProgramError ? <button className="primary" disabled>当前段落不可用</button> :
             selectedRendering ? <span role="status">{Math.round((selectedLatest.progress || 0) * 100)}%</span> :
             approvedCurrent ? nextScene ? <button className="primary" onClick={() => chooseScene(nextScene.id)}>看下一段 →</button> : <span>本段已确认</span> :
             currentLatest ? view !== "sample" || playbackKind !== "latest" ? <button className="primary" disabled={busy} onClick={openSample}>看本段样片</button> : <button className="primary" disabled={!canApprove} onClick={approveSegment}>{currentLatestViewed ? nextScene?'确认并看下一段':'确认并合成整片' : "播放后确认"}</button> :
             <button className="primary" disabled={busy || rendering || !scene} onClick={renderSegment}>{selectedLatest?.status === "failed" ? "重试生成样片" : "生成本段样片"}</button>}
          </div>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
        {scene&&<details className="scene-plan"><summary>设计与口播说明</summary>
          <CreativeDesignPanel design={design} beats={scene.beats}/>
          <details><summary>口播与动作定位（高级）</summary>
          <ActionReview key={`actions:${selected}`} disabledReason={view === 'previous' || (view === 'sample' && !playbackTask?.current) || (view === 'review' && !currentReview) ? '正在查看历史视频；切到编辑画面或当前版本后检查动作。' : undefined} actions={reviewActions(design, resolved?.beats || [], resolved?.startMs ?? null, resolved?.endMs ?? null, scopedCandidate?.resolved?.words || [])} onSeek={(frame, objectId) => {
              pendingReview.current=null;
              setEntryFrame(frame);
              setSeekVersion(v => v + 1);
              if (objectId && sceneEditor?.objects.some((o: any) => o.id === objectId)) setSelectedObject(objectId);
              if (view === 'scene') { setTime(frame / 30); return; }
              if (video.current) {
                video.current.pause();
                video.current.currentTime = localPlaybackTime(frame, view === 'sample' ? playbackOffset : 0, video.current.duration || duration);
                setTime(video.current.currentTime + (view === 'sample' ? playbackOffset : 0));
              }
            }}/></details></details>}
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
        {scene && (
          <>
            <div className="transcript-head">
              <h2>这段怎么改</h2>
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
                留下修改意见
              </button>
            </div>
            {comments.map((f: any) => (
              <div className="feedback-row" key={f.id}>
                <span>
                  {(f.timeMs / 1000).toFixed(2)}s · {f.text}
                  <small>
                    {f.status === "resolved" ? "已处理" : "待 Codex 处理"}
                  </small>
                </span>
              </div>
            ))}
          </>
        )}
      </main>
      <aside className="right">
        <div className="eyebrow">当前段落</div>
        {scene ? (
          <>
            <h2>画面属性</h2>
            <p className="hint">选中对象可直接调整。构图或动作的修改交给 Codex。</p>
            {selectedCanvasObject?.canvas.transform && <CanvasTransformProperties
              value={objectTransformFor({objectTransforms: canvasTransforms}, selectedObject)}
              locked={scene?.editor?.objectLocks?.includes(selectedObject) || false}
              disabled={busy || parameterDirty || canvasSaving || !!canvasDraft || canvasPending}
              onActiveChange={active => {canvasInteracting.current = active; setCanvasActive(active);}}
              onLock={() => editCanvas(selectedObject, [{kind: 'objectLock', key: 'locked', before: !!scene?.editor?.objectLocks?.includes(selectedObject), after: !scene?.editor?.objectLocks?.includes(selectedObject)}])}
              onChange={(key, value) => {
                pendingReview.current = null;
                if (view !== 'scene') {setEntryFrame(Math.round(time * 30)); setView('scene');}
                scenePlayer.current?.pause();
                const before = objectTransformFor(scene.editor, selectedObject), after = {...before, [key]: value};
                setCanvasDraft({id: selectedObject, transform: after});
                editCanvas(selectedObject, transformChanges(before, after));
              }}/>}
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
              disabled={canvasActive || canvasSaving || !!canvasDraft || busy || canvasPending}
              editor={sceneEditor}
              selected={selectedObject}
              values={parameters}
              locks={locks}
              onSelect={(id) => {
                pendingReview.current=null;
                setSelectedObject(id);
                setView("scene");
              }}
              onChange={(key, value) => {
                if (canvasActive || canvasSaving || canvasDraft || busy || canvasPending) return;
                if (!parameterDirty) draftEditorBase.current = {values: {...parameters}, overrides: {...overrides}, locks: [...locks]};
                if (view !== "scene") {setEntryFrame(Math.round(time * 30)); setView("scene");}
                setParameters((p) => ({ ...p, [key]: value }));
                setOverrides((p) => ({ ...p, [key]: value }));
                if (!dirty) draftRevision.current = data.plan.revision;
                setDirty(true);
              }}
              onLock={(key) => {
                if (canvasActive || canvasSaving || canvasDraft || busy || canvasPending) return;
                if (!parameterDirty) draftEditorBase.current = {values: {...parameters}, overrides: {...overrides}, locks: [...locks]};
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
