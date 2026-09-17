import React, { useEffect, useState, useRef } from "react";
import { Player } from "@remotion/player";
import {
  componentMediaRequirement,
  validateComponentInterval,
  type ComponentMediaBinding,
  type ComponentMedia,
} from "./component-media";
import { ComplexParameter, emptyValue } from "./ComplexParameter";
import {AnimationTemplates} from "./AnimationTemplates";
const LibraryThumbnail = React.lazy(() => import("./LibraryThumbnail").then(m => ({default:m.LibraryThumbnail})));
import { ComponentSurface } from "./ComponentSurface";
class PreviewBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.error ? (
      <div className="empty">
        组件预览失败：{this.state.error}
        <br />
        已保留目录条目，请让 Codex 修复依赖或适配。
      </div>
    ) : (
      this.props.children
    );
  }
}
const labels: Record<string, string> = {
  text: "文字",
  title: "标题",
  subtitle: "副标题",
  beforeLabel: "对比前标签",
  afterLabel: "对比后标签",
  intensity: "动效强度",
  reducedMotion: "减少动效",
  accentColor: "强调色",
  divider: "分界位置（%）",
  startFrame: "动画开始（帧）",
  transitionFrames: "转场时长（帧）",
  throughBlack: "经过黑场",
  startDelay: "开始延迟（帧）",
  color: "颜色",
  fontSize: "字号",
  duration: "时长",
  speed: "速度",
  colors: "渐变颜色",
  thresholds: "阈值",
  direction: "方向",
};
const draftKey = "workbench.component-drafts.v1";
function readDrafts(): any {
  try { return JSON.parse(sessionStorage.getItem(draftKey) || '{"items":{}}'); }
  catch { return {items:{}}; }
}
function writeDraft(value: any) {
  const saved = readDrafts();
  saved.active = value.key;
  saved.items[value.key] = value;
  sessionStorage.setItem(draftKey, JSON.stringify(saved));
}
export function ComponentLibrary({
  api,
  onDirtyChange,
  onOpenScene,
}: {
  api: (path: string, body?: any) => Promise<any>;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenScene?: () => void;
}) {
  const [restored] = useState(() => { const saved = readDrafts(); return saved.items[saved.active]; });
  const lastScene = useRef(restored?.sceneId);
  const pickTicket = useRef(0);
  const [animations,setAnimations]=useState(false);
  const [previewPlacement, setPreviewPlacement] = useState(false);
  const baseline = useRef<string | null>(restored?.baseline ?? null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [mediaBindings, setMediaBindings] = useState<ComponentMediaBinding[]>(
    restored?.mediaBindings ?? [],
  );
  const [assetItems, setAssetItems] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [catalog, setCatalog] = useState<any>(),
    [query, setQuery] = useState(""),
    [personal, setPersonal] = useState(false),
    [favoritesOnly, setFavoritesOnly] = useState(false),
    [favoriteBusy, setFavoriteBusy] = useState(""),
    [presetName, setPresetName] = useState(""),
    [source, setSource] = useState(""),
    [page, setPage] = useState(0),
    [detail, setDetail] = useState<any>(restored?.detail),
    [renderer, setRenderer] = useState<any>(),
    [values, setValues] = useState<any>(restored?.values ?? {}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false),
    [reference, setReference] = useState(false),
    [production, setProduction] = useState<any>(),
    [sceneId, setSceneId] = useState(restored?.sceneId ?? ""),
    [start, setStart] = useState(restored?.start ?? ""),
    [end, setEnd] = useState(restored?.end ?? ""),
    [scale, setScale] = useState(restored?.scale ?? 0.5),
    [x, setX] = useState(restored?.x ?? 960),
    [y, setY] = useState(restored?.y ?? 220),
    [opacity, setOpacity] = useState(restored?.opacity ?? 1),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState(restored?.editing ?? "");
  const fingerprint = JSON.stringify({
    id: detail?.id,
    values,
    mediaBindings,
    sceneId,
    start,
    end,
    x,
    y,
    scale,
    opacity,
  });
  useEffect(() => {
    if (loading || !detail) {
      setDraftDirty(false);
      onDirtyChange?.(false);
      return;
    }
    if (baseline.current === null) baseline.current = fingerprint;
    const changed = baseline.current !== fingerprint;
    setDraftDirty(changed);
    try {
      writeDraft({key: editing || detail.id, detail, values, mediaBindings, sceneId, start, end, x, y, scale, opacity, editing, baseline:baseline.current});
      onDirtyChange?.(false);
    } catch { onDirtyChange?.(changed); setError("浏览器暂存失败，请保存当前调整后再切换。"); }
  }, [fingerprint, loading, detail, editing, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!draftDirty || readDrafts().items[editing || detail?.id]) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftDirty]);
  useEffect(() => {
    if (restored?.detail?.runtime) {
      void import(/* @vite-ignore */ restored.detail.moduleUrl).then(mod => setRenderer(() => mod[restored.detail.exportName])).catch(e => setError(e.message));
    }
    void Promise.all([
      api("library"),
      api("production"),
      api("production/component-assets"),
    ])
      .then(([c, p, a]) => {
        setAssetItems(a.items);
        setCatalog(c);
        setProduction(p);
        if (!restored?.sceneId) setSceneId(p.plan.scenes.some((s: any) => s.id === p.selection?.sceneId) ? p.selection.sceneId : p.plan.scenes[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  const scene = production?.plan.scenes.find((s: any) => s.id === sceneId);
  const favoriteIds = new Set<string>(catalog?.favorites || []);
  const componentIdOf = (entry: any): string => entry.componentId || entry.id;
  useEffect(() => {
    if (lastScene.current === sceneId) return;
    lastScene.current = sceneId;
    setStart(scene?.startWordId || "");
    setEnd(scene?.endWordId || "");
    setEditing("");
  }, [sceneId]);
  const pick = async (id: string, instance?: any) => {
    const cached = readDrafts().items[instance?.id || id];
    baseline.current = cached?.baseline ?? null;
    const ticket = ++pickTicket.current;
    setDetail(undefined);
    setRenderer(undefined);
    setError("");
    setMessage("");
    setFailed(false);
    setLoading(true);
    setEditing(instance?.id || "");
    try {
      const d = await api("library/detail/" + encodeURIComponent(id));
      if (ticket !== pickTicket.current) return;
      if (cached?.sceneId) { lastScene.current = cached.sceneId; setSceneId(cached.sceneId); }
      setDetail(d);
      setMediaBindings(
        cached?.mediaBindings ?? instance?.mediaBindings ??
          (d.mediaSlots.length === 1 ? [{ source: "cut" }] : []),
      );
      setValues(
        cached?.values ?? instance?.props ??
          Object.fromEntries(
            d.fields
              .filter((f: any) => f.value !== undefined)
              .map((f: any) => [f.name, f.value]),
          ),
      );
      setX(cached?.x ?? instance?.x ?? (d.mount === "OBJECT" ? 960 : 0));
      setY(cached?.y ?? instance?.y ?? (d.mount === "OBJECT" ? 220 : 0));
      setScale(
        cached?.scale ?? instance?.scale ??
          (d.mount === "OBJECT" ? Math.min(760 / d.width, 500 / d.height) : 1),
      );
      setOpacity(cached?.opacity ?? instance?.opacity ?? 1);
      setStart(cached?.start ?? instance?.startWordId ?? scene?.startWordId ?? "");
      setEnd(cached?.end ?? instance?.endWordId ?? scene?.endWordId ?? "");
      setReference(!d.runtime);
      if (d.runtime) {
        const mod = await import(/* @vite-ignore */ d.moduleUrl);
        if (ticket !== pickTicket.current) return;
        if (typeof mod[d.exportName] !== "function")
          throw Error("未找到可渲染组件");
        setRenderer(() => mod[d.exportName]);
      }
    } catch (e: any) {
      if (ticket !== pickTicket.current) return;
      setError(e.message);
      setFailed(true);
    } finally {
      if (ticket === pickTicket.current) setLoading(false);
    }
  };
  const toggleFavorite = async (componentId: string) => {
    if (favoriteBusy === componentId) return;
    setFavoriteBusy(componentId);
    setError("");
    try {
      const result = await api("library/favorites", {
        componentId,
        favorite: !favoriteIds.has(componentId),
      });
      const next = result.favorites || result.favoriteIds || [];
      setCatalog((old: any) => old ? {
        ...old,
        favorites: next,
        counts: { ...old.counts, favorites: next.length },
      } : old);
      if (favoritesOnly) setPage(0);
      setMessage(next.includes(componentId) ? "已收藏该组件。" : "已取消收藏。" );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFavoriteBusy("");
    }
  };
  const refresh = async () => {
    const p = await api("production");
    setProduction(p);
    return p;
  };
  const save = async () => {
    setLoading(true);
    setError("");
    try {
      const selection = {
        id: editing || crypto.randomUUID(),
        componentId: detail.id,
        props: values,
        mediaBindings: mediaBindings.slice(0, requirement?.count ?? 0),
        startWordId: start,
        endWordId: end,
        x,
        y,
        scale,
        opacity,
      };
      await api("production/scenes", {
        expectedRevision: production.plan.revision,
        source: production.plan.source,
        scenes: production.plan.scenes.map((s: any) =>
          s.id === sceneId
            ? {
                ...s,
                components: editing
                  ? (s.components || []).map((v: any) =>
                      v.id === editing ? selection : v,
                    )
                  : [...(s.components || []), selection],
              }
            : s,
        ),
      });
      await refresh();
      baseline.current = fingerprint;
      setEditing(selection.id);
      setMessage(`已${editing ? "更新" : "添加到"}「${scene?.title || "当前段落"}」。可以返回画面查看。`);
      setDraftDirty(false); onDirtyChange?.(false);
    } catch (e: any) {
      setError(e.message + "；请刷新方案后重试。");
    } finally {
      setLoading(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await api("production/scenes", {
        expectedRevision: production.plan.revision,
        source: production.plan.source,
        scenes: production.plan.scenes.map((s: any) => ({
          ...s,
          components: (s.components || []).filter((v: any) => v.id !== id),
        })),
      });
      await refresh();
      setMessage("已移除，旧视频保留。");
      setEditing("");
    } catch (e: any) {
      setError(e.message);
    }
  };
  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      await api(
        "production/component-assets?name=" + encodeURIComponent(file.name),
        file,
      );
      setAssetItems((await api("production/component-assets")).items);
      setMessage("素材已导入，请在对应位置选择。");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };
  let requirement: ReturnType<typeof componentMediaRequirement> | undefined;
  let parameterError = "";
  if (detail) {
    try {
      requirement = componentMediaRequirement(detail.id, values);
    } catch {
      parameterError = "请先补齐内容，并检查参数范围。";
    }
  }
  if (!catalog)
    return <div className="loading">{error || "读取完整组件目录…"}</div>;
  const displayedItems = personal ? (catalog.presets || []).map((preset:any) => {
    const original = catalog.items.find((i:any) => i.id === preset.componentId);
    return original ? {...original,id:preset.id,componentId:preset.componentId,name:preset.name,thumbnailProps:preset.props,preset} : null;
  }).filter(Boolean) : catalog.items;
  const filtered = displayedItems.filter(
    (e: any) =>
      (!source || e.category === source) &&
      (!favoritesOnly || favoriteIds.has(componentIdOf(e))) &&
      `${e.name} ${e.description} ${e.category} ${e.id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const words =
    production?.resolved.words.filter((w: any) => {
      const r = production.resolved.scenes.find((s: any) => s.id === sceneId);
      return r && w.startMs >= r.startMs && w.endMs <= r.endMs;
    }) || [];
  const startWord = words.find((w: any) => w.sourceId === start),
    endWord = words.find((w: any) => w.sourceId === end);
  const previewDuration =
    startWord && endWord
      ? Math.max(
          1,
          Math.round((endWord.endMs * 30) / 1000) -
            Math.round((startWord.startMs * 30) / 1000),
        )
      : 180;
  if (requirement) {
    try {
      validateComponentInterval(
        requirement.mount,
        requirement.parameters,
        previewDuration,
      );
    } catch (e: any) {
      parameterError = e.message;
    }
  }
  const mediaSources: ComponentMedia[] = [];
  let mediaError = "";
  if (requirement)
    for (let i = 0; i < requirement.count; i++) {
      const b = mediaBindings[i];
      if (!b) {
        mediaError = "请为每个位置选择素材。";
        break;
      }
      if (b.source === "cut") {
        if (!production?.cut.preview?.url) {
          mediaError = "请先生成当前粗剪预览。";
          break;
        }
        mediaSources.push({
          src: production.cut.preview.url,
          kind: "video",
          startFrame: Math.round(((startWord?.startMs ?? 0) * 30) / 1000),
        });
      } else {
        const a = assetItems.find((v) => v.id === b.assetId);
        if (!a) {
          mediaError = "素材未找到，请重新选择。";
          break;
        }
        if (
          a.kind === "video" &&
          b.startFrame + previewDuration > a.durationFrames
        ) {
          mediaError = `素材 ${i + 1} 时长不足，请调早起点或缩短组件区间。`;
          break;
        }
        mediaSources.push({
          src: a.url,
          kind: a.kind,
          startFrame: a.kind === "image" ? 0 : b.startFrame,
        });
      }
    }
  const previewParameters = parameterError ? detail?.thumbnailProps : values;
  let previewMedia = mediaError ? [] : mediaSources;
  let usingDemoMedia = false;
  if (detail) {
    try {
      const needed = componentMediaRequirement(detail.id, previewParameters).count;
      if (previewMedia.length < needed) {
        usingDemoMedia = true;
        previewMedia = Array.from({length:needed},(_,i)=>({src:`/thumbnail-media-${i%2}.svg`,kind:"image" as const,startFrame:0}));
      }
    } catch { /* The preview renderer reports invalid parameters. */ }
  }
  const presentationDuration = !previewPlacement && (previewMedia.length === 0 || usingDemoMedia) ? Math.max(180, previewDuration) : previewDuration;
  const updateBinding = (i: number, b: ComponentMediaBinding) =>
    setMediaBindings((old) => {
      const next = [...old];
      next[i] = b;
      return next;
    });
  if(animations) return <AnimationTemplates api={api} onBack={()=>setAnimations(false)} onOpenScene={onOpenScene}/>;
  return (
    <div className="library-workspace">
      <aside className="left">
        <div className="eyebrow">画面素材</div>
        <h2>
          组件库 <small>{catalog.counts.total}</small>
        </h2>
        <div className="mode-segment library-scope"><button aria-pressed={!personal && !favoritesOnly} disabled={loading} onClick={() => {setPersonal(false);setFavoritesOnly(false);setPage(0);}}>全部组件</button><button aria-pressed={favoritesOnly} disabled={loading} onClick={() => {setPersonal(false);setFavoritesOnly(true);setPage(0);}}>已收藏</button><button aria-pressed={personal} disabled={loading} onClick={() => {setPersonal(true);setFavoritesOnly(false);setPage(0);}}>我的预设</button></div>
        <button className="animation-entry" disabled={loading} onClick={()=>setAnimations(true)}>我的动画 →</button>
        <input
          aria-label="搜索组件"
          placeholder="搜索名称、效果或用途"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="组件用途"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(0);
          }}
        >
          <option value="">全部用途</option>
          {Array.from(new Set(catalog.items.map((e: any) => e.category)))
            .sort()
            .map((s: any) => (
              <option key={s}>{s}</option>
            ))}
        </select>
        <p className="hint">{filtered.length} 项 · 点击预览，添加后进入画面</p>
        <div className="library-list">
          {filtered.slice(page * 12, (page + 1) * 12).map((e: any) => {
            const componentId = componentIdOf(e);
            const isFavorite = favoriteIds.has(componentId);
            return (
              <div
                key={e.id}
                className={"library-card" + (detail?.id === e.id ? " selected" : "")}
              >
                <button
                  type="button"
                  className="library-card-open"
                  onClick={() => void pick(componentId, e.preset ? {...e.preset,id:undefined} : undefined)}
                  disabled={loading}
                  title={e.name}
                >
                  <React.Suspense fallback={<div className="component-thumbnail thumbnail-fallback">加载预览…</div>}><LibraryThumbnail item={{...e,id:componentId}} /></React.Suspense>
                  <b>{e.name}</b>
                  <small>{e.category}</small>
                  <span>
                    {e.runtime ? "预览与调整" : e.preview ? "参考视频" : "待适配"}
                  </span>
                </button>
                <button
                  type="button"
                  className="library-card-favorite"
                  aria-label={isFavorite ? "取消收藏" : "收藏"}
                  aria-pressed={isFavorite}
                  data-favorite={isFavorite ? "true" : "false"}
                  disabled={loading || favoriteBusy === componentId}
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleFavorite(componentId);
                  }}
                >
                  {favoriteBusy === componentId ? "处理中…" : isFavorite ? "★ 已收藏" : "☆ 收藏"}
                </button>
              </div>
            );
          })}
        </div>
        {!filtered.length && <p className="hint">{favoritesOnly ? (favoriteIds.size ? "当前筛选条件下没有匹配的收藏组件。" : "还没有收藏组件。点击组件卡片下方的“收藏”即可加入。") : personal ? "调整好一个组件后，在右侧保存为预设。" : "没有匹配的组件，试试其他关键词。"}</p>}
        <div className="library-pages">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil(filtered.length / 12))}
          </span>
          <button
            disabled={(page + 1) * 12 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
      </aside>
      <main className="production-center">
        <div className="production-toolbar">
          <h2>{detail?.name || "选一个组件，看看实际效果"}</h2>
          {detail?.runtime && <div className="mode-segment" aria-label="组件预览方式">
            <button aria-pressed={!previewPlacement} onClick={()=>setPreviewPlacement(false)}>查看效果</button>
            <button aria-pressed={previewPlacement} onClick={()=>setPreviewPlacement(true)}>画布位置</button>
          </div>}
          {detail?.preview && detail?.runtime && (
            <button onClick={() => setReference(!reference)}>
              {reference ? "修改后预览" : "参考视频"}
            </button>
          )}
        </div>
        <div className={"library-preview" + (!detail ? " library-welcome" : "")}>
          {loading && !renderer ? (
            <div className="empty">加载当前组件…</div>
          ) : reference && detail?.preview ? (
            <video key={detail.id} src={detail.preview} controls loop />
          ) : renderer ? (
            <PreviewBoundary key={detail.id} onError={() => setFailed(true)}>
              <Player
                key={detail.id}
                component={ComponentSurface}
                inputProps={{
                  renderer,
                  appAdapter: detail.appAdapter,
                  componentId: detail.id,
                  mediaSources: previewMedia,
                  values: previewParameters,
                  width: detail.width,
                  height: detail.height,
                  x: previewPlacement ? x : 0,
                  y: previewPlacement ? y : 0,
                  scale: previewPlacement ? scale : 1,
                  opacity,
                }}
                durationInFrames={presentationDuration}
                initialFrame={Math.min(120, presentationDuration - 1)}
                loop
                compositionWidth={1920}
                compositionHeight={1080}
                fps={30}
                controls
                style={{ width: "100%" }}
              />
            </PreviewBoundary>
          ) : (
            <div className="empty">
              {detail?.reason || <div><strong>为画面添加一个表达</strong><p>从左侧选择文字、图形或转场，先看效果，再加入段落。</p><small>目标：{scene?.title || "请先完成段落设计"}</small></div>}
            </div>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        {message && <div className="notice" role="status">{message}{!draftDirty && onOpenScene && <button onClick={async () => {try { await api("production/selection", {sceneId, objectId:null,timeSeconds:(production.resolved.scenes.find((s:any)=>s.id===sceneId)?.startMs || 0)/1000,view:"scene",baseRevision:production.plan.revision,hasUnsavedChanges:false}); onOpenScene(); } catch(e:any) {setError(e.message);} }}>查看段落画面 →</button>}</div>}
        {detail && (
          <p className="hint">
            {detail.runtime
              ? (parameterError || usingDemoMedia ? "正在展示示例内容。填写右侧内容或选择素材后显示你的效果，示例不会自动加入成片。" : previewPlacement ? "按成片画布显示位置和大小。" : "放大查看组件效果；位置和缩放请切换到「画布位置」查看。")
              : "这是原效果的参考视频，需由 Codex 适配后才能加入段落。"}
          </p>
        )}
        <h2>已添加到「{scene?.title || "当前段落"}」</h2>
        {(scene?.components || []).map((c: any) => (
          <div className="feedback-row" key={c.id}>
            <span>
              {catalog.items.find((i: any) => i.id === c.componentId)?.name ||
                c.componentId}
            </span>
            <button onClick={() => void pick(c.componentId, c)}>调整</button>
            <button onClick={() => void remove(c.id)}>移除</button>
          </div>
        ))}
        {!scene?.components?.length && (
          <p className="hint">还没有添加组件。左侧选中后，点击“添加到段落”。</p>
        )}
        {detail && (
          <details>
            <summary>来源与授权信息</summary>
            <p>{detail.description}</p>
            <p>
              {detail.source} · {detail.license}
            </p>
            {detail.sourceUrl && (
              <a href={detail.sourceUrl} target="_blank" rel="noreferrer">
                查看来源
              </a>
            )}
            <p>{detail.id}</p>
          </details>
        )}
      </main>
      <aside className="right">
        <div className="eyebrow">选用与调整</div>
        <h2>组件属性</h2>
        {draftDirty && (
          <div className="hint">
            草稿已暂存，可以切换页面；添加到段落后才会进入成片。
            <button
              onClick={() => {
                const saved = readDrafts();
                delete saved.items[editing || detail.id];
                delete saved.active;
                sessionStorage.setItem(draftKey, JSON.stringify(saved));
                ++pickTicket.current;
                baseline.current = null;
                setDetail(undefined);
                setRenderer(undefined);
                setDraftDirty(false);
                onDirtyChange?.(false);
                setMessage("已放弃未保存调整，已保存的组件保持不变。");
              }}
            >
              放弃调整
            </button>
          </div>
        )}
        {detail && !detail.runtime && (
          <p className="hint">
            这是参考条目。当前没有可直接编辑的实现，需要 Codex
            根据设计适配后使用。
          </p>
        )}
        {detail?.runtime && (
          <>
            <p className="hint">
              修改参数即可预览。组件中的视频保持静音，成片保留口播声音。
            </p>
            {(requirement?.count ?? 0) > 0 && (
              <section className="component-media-fields">
                <h3>使用的素材</h3>
                {requirement?.mount === "TRANSITION" && (
                  <p className="hint">
                    前后画面由你指定，效果作用于下方选择的时间区间；不会自动连接整段包装镜头。
                  </p>
                )}
                {requirement?.labels.map((label, i) => {
                  const b = mediaBindings[i];
                  const a =
                    b?.source === "asset"
                      ? assetItems.find((v) => v.id === b.assetId)
                      : null;
                  return (
                    <div key={i} className="field">
                      <label>
                        {label}
                        <select
                          aria-label={label}
                          value={
                            b?.source === "cut"
                              ? "cut"
                              : b?.source === "asset"
                                ? b.assetId
                                : ""
                          }
                          onChange={(e) => {
                            if (e.target.value)
                              updateBinding(
                                i,
                                e.target.value === "cut"
                                  ? { source: "cut" }
                                  : {
                                      source: "asset",
                                      assetId: e.target.value,
                                      startFrame: 0,
                                    },
                              );
                          }}
                        >
                          <option value="">选择素材…</option>
                          <option value="cut">当前粗剪 · 跟随口播时间</option>
                          {assetItems.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} · {v.kind === "image" ? "图片" : "视频"}
                            </option>
                          ))}
                        </select>
                      </label>
                      {a?.kind === "video" && b?.source === "asset" && (
                        <label>
                          素材起点（秒）
                          <input
                            aria-label={`${label} 起点（秒）`}
                            type="number"
                            min="0"
                            step={1 / 30}
                            value={b.startFrame / 30}
                            onChange={(e) =>
                              updateBinding(i, {
                                ...b,
                                startFrame: Math.max(
                                  0,
                                  Math.round(Number(e.target.value) * 30),
                                ),
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
                <label className="field">
                  {uploading ? "正在导入…" : "导入图片或视频"}
                  <input
                    aria-label="导入组件素材"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>
            )}
            {(parameterError || mediaError) && (
              <p role="status" className="hint">
                {parameterError || mediaError}
              </p>
            )}
            {detail.fields.map((f: any) => (
              <label className="field" key={f.name}>
                {labels[f.name] || f.label || f.name}
                {f.type === "json" ? (
                  <>
                  {!f.required && <span className="optional-parameter"><input type="checkbox" checked={values[f.name] !== undefined} onChange={e=>{
                    const next={...values};
                    if(e.target.checked) next[f.name]=emptyValue(f.sample);
                    else delete next[f.name];
                    setValues(next);
                  }}/>自定义（可选）</span>}
                  {(f.required || values[f.name] !== undefined) && <ComplexParameter
                    value={values[f.name]}
                    sample={f.sample}
                    onChange={(v) => setValues({ ...values, [f.name]: v })}
                  />}
                  {!f.required && values[f.name] === undefined && <span className="hint">使用组件默认效果</span>}
                  </>
                ) : f.type === "select" ? (
                  <select
                    value={values[f.name]}
                    onChange={(e) =>
                      setValues({ ...values, [f.name]: e.target.value })
                    }
                  >
                    {f.options?.map((v: string) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : f.type === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={!!values[f.name]}
                    onChange={(e) =>
                      setValues({ ...values, [f.name]: e.target.checked })
                    }
                  />
                ) : (
                  <input
                    aria-label={labels[f.name] || f.label || f.name}
                    type={
                      f.type === "color"
                        ? "color"
                        : f.type === "number"
                          ? "number"
                          : "text"
                    }
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={values[f.name] ?? ""}
                    onChange={(e) => {
                      const next = { ...values };
                      if (f.type === "number" && e.target.value === "")
                        delete next[f.name];
                      else
                        next[f.name] =
                          f.type === "number"
                            ? Number(e.target.value)
                            : e.target.value;
                      setValues(next);
                    }}
                  />
                )}
              </label>
            ))}
            {!detail.fields.length && (
              <p className="hint">
                此源码没有可直接修改的简单参数。文字或内部配色需由 Codex
                修改适配。
              </p>
            )}
            {(
              [
                ["横向位置", x, setX],
                ["纵向位置", y, setY],
                ["缩放", scale, setScale],
                ["不透明度", opacity, setOpacity],
              ] as const
            ).map(([label, value, change]) => (
              <label className="field" key={label}>
                {label}
                <input
                  type="number"
                  step={label === "缩放" || label === "不透明度" ? 0.05 : 10}
                  value={value}
                  onChange={(e) => change(Number(e.target.value))}
                />
              </label>
            ))}
            <label className="field">
              用于哪个段落
              <select
                value={sceneId}
                onChange={(e) => setSceneId(e.target.value)}
              >
                {production?.plan.scenes.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              从哪个词出现
              <select value={start} onChange={(e) => setStart(e.target.value)}>
                {words.map((w: any) => (
                  <option value={w.sourceId} key={w.sourceId}>
                    {(w.startMs / 1000).toFixed(2)}s · {w.text}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              到哪个词结束
              <select value={end} onChange={(e) => setEnd(e.target.value)}>
                {words.map((w: any) => (
                  <option value={w.sourceId} key={w.sourceId}>
                    {(w.endMs / 1000).toFixed(2)}s · {w.text}
                  </option>
                ))}
              </select>
            </label>
            <details className="preset-save"><summary>保存为我的预设</summary><label className="field">预设名称<input value={presetName} onChange={e=>setPresetName(e.target.value)} maxLength={60} placeholder="例如：蓝色重点标题"/></label><p className="hint">保存样式和内容；再次使用时选择素材和出现时间。</p><button disabled={!presetName.trim() || loading || !!parameterError} onClick={async()=>{setLoading(true);setError("");try {await api("library/presets",{name:presetName,componentId:detail.id,props:values,x,y,scale,opacity});setCatalog(await api("library"));setMessage("预设已保存，可在左侧“我的预设”再次使用。当前段落尚未改变。");setPresetName("");} catch(e:any){setError(e.message);} finally{setLoading(false);}}}>保存预设</button></details>
            <button
              className="primary component-save"
              disabled={
                loading ||
                uploading ||
                failed ||
                !renderer ||
                !sceneId ||
                !!parameterError ||
                !!mediaError
              }
              onClick={() => void save()}
            >
              {loading ? "正在保存…" : editing ? "保存组件调整" : "添加到段落"}
            </button>
          </>
        )}
        <details className="library-advanced"><summary>更多操作</summary><button disabled={draftDirty || loading} onClick={() => void refresh()}>重新读取项目</button></details>
      </aside>
    </div>
  );
}
