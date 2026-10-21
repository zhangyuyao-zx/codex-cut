import React, { useCallback, useEffect, useRef, useState } from "react";
import { SceneModulePreview } from "./SceneModulePreview";

export function SaveAnimation({
  api,
  scene,
  revision,
  sourceHash,
  disabled,
}: {
  api: (p: string, b?: any) => Promise<any>;
  scene: any;
  revision: number;
  sourceHash?: string;
  disabled: boolean;
}) {
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setName(scene.title);
    setMessage("");
  }, [scene.id]);
  return (
    <details className="save-animation">
      <summary>保存为我的动画</summary>
      <p className="hint">
        保留这版动画、组件、已补充的素材和可编辑参数。用于新段落时由 Codex 适配内容与时机。
      </p>
      <label>
        动画名称
        <input
          aria-label="动画名称"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        disabled={disabled || busy || !name.trim()}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            await api("production/animation-templates/save", {
              name,
              sceneId: scene.id,
              expectedRevision: revision,
              expectedSourceHash: sourceHash,
            });
            setMessage("已保存，可在资源页的「我的动画」再次使用。");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在保存动画…" : "保存动画"}
      </button>
      {disabled && <p className="hint">先保存当前修改，再保存动画。</p>}
      {message && <p role="status">{message}</p>}
    </details>
  );
}

export function AnimationTemplates({
  api,
  onBack,
  onOpenScene,
  onDirtyChange,
  onBusyChange,
  active = true,
}: {
  api: (p: string, b?: any) => Promise<any>;
  onBack: () => void;
  onOpenScene?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  active?: boolean;
}) {
  const [items, setItems] = useState<any[]>([]),
    [data, setData] = useState<any>(),
    [selected, setSelected] = useState<any>(),
    [sceneId, setSceneId] = useState(""),
    [bindings, setBindings] = useState<string[]>([]),
    [preview, setPreview] = useState<any>(),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [applied, setApplied] = useState(false);
  const [loading,setLoading]=useState(true);
  const [packageNotice,setPackageNotice]=useState("");
  const [packageSupport,setPackageSupport]=useState(false);
  const onTime = useCallback(() => {}, []);
  const dirty = bindings.some(Boolean) && !applied;
  const onDirtyRef = useRef(onDirtyChange), onBusyRef = useRef(onBusyChange);
  onDirtyRef.current = onDirtyChange;
  onBusyRef.current = onBusyChange;
  useEffect(() => { onDirtyRef.current?.(dirty); }, [dirty]);
  useEffect(() => { onBusyRef.current?.(busy); }, [busy]);
  useEffect(() => () => { onDirtyRef.current?.(false); onBusyRef.current?.(false); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const canDiscardBindings = () => !dirty || window.confirm("当前口播绑定尚未应用。放弃这些绑定并切换？");
  useEffect(() => {
    let active = true;
    Promise.all([api("production/animation-templates"), api("production")])
      .then(([a, p]) => {
        if (!active) return;
        setItems(a.items);
        setPackageSupport(a.packageSupport === true);
        setData(p);
        setSceneId(
          p.plan.scenes.some((s: any) => s.id === p.selection?.sceneId)
            ? p.selection.sceneId
            : p.plan.scenes[0]?.id || "",
        );
      })
      .catch((e) => {
        if (active) setError(e.message);
      }).finally(()=>{if(active)setLoading(false);});
    return () => {
      active = false;
    };
  }, []);
  const range = data?.resolved.scenes.find((s: any) => s.id === sceneId);
  const words =
    data?.resolved.words.filter(
      (w: any) => range && w.startMs >= range.startMs && w.endMs <= range.endMs,
    ) || [];
  const reset = () => {
    setPreview(undefined);
    setReady(false);
    setError("");
    setApplied(false);
  };
  const complete =
    !!selected &&
    bindings.length === selected.cues.length &&
    bindings.every(Boolean);
  const request = () => ({
    id: selected.id,
    sceneId,
    bindings,
    expectedRevision: data.plan.revision,
  });
  return (
    <div className="library-workspace animation-library">
      <aside className="left">
        <span className="eyebrow">我的创作</span>
        <h2>我的动画</h2>
        <button onClick={onBack} disabled={busy}>
          返回资源页
        </button>
        <p className="hint">
          保存满意的动画，在新内容中继续使用。Codex 负责适配内容与时机；手动绑定在高级控制中。
        </p>
        {packageSupport && <label className="upload animation-package-import">
          导入动画包
          <input aria-label="导入动画包" type="file" accept=".cutanimation" disabled={busy || loading}
            onChange={async(event)=>{
              const file=event.target.files?.[0];
              event.target.value="";
              if(!file)return;
              if(file.size>1024**3){setError("动画包上限1GB");return;}
              setBusy(true);setError("");setPackageNotice("");
              try {
                const result=await api("production/animation-templates/import",file);
                setItems(result.items);
                setPackageNotice(result.alreadyPresent?"这份动画已在库中，无需重复导入。":"动画已导入，可交给 Codex 适配到目标段落。");
              } catch(error){setError((error as Error).message);}
              finally {setBusy(false);}
            }}/>
        </label>}
        {packageNotice && <p role="status" className="hint">{packageNotice}</p>}
        {loading && <p role="status" className="hint">正在读取保存的动画…</p>}
        {!loading && !error && !items.length && (
          <p className="empty">
            在包装页打开「保存为我的动画」，把满意的段落收进来。
          </p>
        )}
        {items.map((item) => (
          <button
            className={
              selected?.id === item.id
                ? "animation-item selected"
                : "animation-item"
            }
            key={item.id}
            disabled={busy}
            onClick={() => {
              if (selected?.id === item.id || !canDiscardBindings()) return;
              setSelected(item);
              setBindings(item.cues.map(() => ""));
              reset();
            }}
          >
            <strong>{item.name}</strong>
            <small>
              {new Date(item.createdAt).toLocaleDateString()}
            </small>
          </button>
        ))}
      </aside>
      <main className="production-center">
        <h2>{selected?.name || "把好动画用到下一段"}</h2>
        {packageSupport && selected && !busy && <a className="animation-package-export" href={"/api/production/animation-templates/export/"+encodeURIComponent(selected.id)} download="animation.cutanimation">导出动画包</a>}
        <div className="library-preview">
          {preview && active ? (
            <SceneModulePreview
              key={JSON.stringify(bindings) + sceneId + selected.id}
              module={preview.module}
              scene={preview.input}
              onTime={onTime}
              onReady={() => setReady(true)}
              onError={(message) => {
                setReady(false);
                setError(message);
              }}
            />
          ) : (
            <div className="empty">
              {selected
                ? "请 Codex 将这份动画适配到目标段落，或展开高级控制手动预览。"
                : "先从左侧选择一段已保存的动画。"}
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {selected && (
          <>
            <p className="hint">选好目标段落后，把动画交给 Codex 适配。手动绑定是可选的高级控制。</p>
            <div className="vl-command">请将我的动画「{selected.name}」适配到「{data?.plan.scenes.find((scene: any) => scene.id === sceneId)?.title || "目标段落"}」，根据真实内容安排出现时机。</div>
            <button disabled={busy} onClick={async () => {
              try {
                await navigator.clipboard.writeText(`请将我的动画 ${selected.id} 适配到段落 ${sceneId}，根据真实内容设计画面并安排出现时机。`);
                setPackageNotice("适配指令已复制，可交给 Codex。");
              } catch (error) { setError((error as Error).message); }
            }}>复制给 Codex</button>
            <details className="vl-advanced"><summary>手动预览与应用（高级）</summary>
            <p className="hint">
              应用会替换目标段落的动画并加入保存的组件，保留兼容的用户参数、锁定和已有组件。保存的补充素材随动画带入；支持替换的素材会出现在包装页右侧，可分别更换。新内容是否适合沿用这些素材需要你检查；操作可撤销。
            </p>
            {!!selected.contents?.materials?.length && selected.contents.materialSlotsVersion !== 1 && <p className="hint">这份旧动画的补充素材是固定快照。要逐份替换，需要先由 Codex 更新原动画并重新保存。</p>}
            <div className="animation-actions">
              <button
                disabled={busy || !complete || applied}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setReady(false);
                  setPreview(undefined);
                  try {
                    setPreview(
                      await api(
                        "production/animation-templates/preview",
                        request(),
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "处理中…" : "预览新段落"}
              </button>
              <button
                className="primary"
                disabled={busy || !ready || applied}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const p = await api(
                      "production/animation-templates/apply",
                      request(),
                    );
                    setData(p);
                    setApplied(true);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                应用到当前段落
              </button>
            </div>
            </details>
            {applied && (
              <div className="notice" role="status">
                已应用。可以返回包装页修改文字、样式、替换补充素材并生成样片。
                <button
                  onClick={async () => {
                    try {
                      await api("production/selection", {
                        sceneId,
                        objectId: null,
                        timeSeconds: range.startMs / 1000,
                        view: "scene",
                        baseRevision: data.plan.revision,
                        hasUnsavedChanges: false,
                      });
                      onOpenScene?.();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  进入段落编辑
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <aside className="right">
        <span className="eyebrow">用于新内容</span>
        <h2>用于哪个段落</h2>
        <label>
          目标段落
          <select
            aria-label="动画目标段落"
            value={sceneId}
            disabled={busy}
            onChange={(e) => {
              if (!canDiscardBindings()) return;
              setSceneId(e.target.value);
              setBindings(selected?.cues.map(() => "") || []);
              reset();
            }}
          >
            {data?.plan.scenes.map((s: any, i: number) => (
              <option value={s.id} key={s.id}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
        </label>
        {selected && <details className="vl-advanced"><summary>手动口播绑定（高级）</summary>
        <p className="hint">仅在手动预览或应用时填写。Codex 可直接按真实内容完成适配。</p>
        {selected?.cues.map((cue: any, i: number) => (
          <label className="animation-cue" key={i}>
            <span>
              {i + 1}. {cue.label}
            </span>
            <select
              aria-label={`出现点 ${i + 1}`}
              value={bindings[i] || ""}
              disabled={busy || applied}
              onChange={(e) => {
                const next = [...bindings];
                next[i] = e.target.value;
                setBindings(next);
                reset();
              }}
            >
              <option value="">选择说到哪个词时出现</option>
              {words.map((w: any, j: number) => (
                <option key={w.sourceId} value={w.sourceId}>
                  {(w.startMs / 1000).toFixed(2)}s ·{" "}
                  {words
                    .slice(Math.max(0, j - 2), j)
                    .map((x: any) => x.text)
                    .join("")}
                  【{w.text}】
                  {words
                    .slice(j + 1, j + 4)
                    .map((x: any) => x.text)
                    .join("")}
                </option>
              ))}
            </select>
          </label>
        ))}
        {selected && (
          <p className="hint">
            按口播顺序选择。只保存动作的对应关系，不沿用旧视频的时间。
          </p>
        )}
        </details>}
        {dirty && <p className="hint" role="status">有尚未应用的手动绑定。切换资源范围会保留本次会话草稿。</p>}
      </aside>
    </div>
  );
}
