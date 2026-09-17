import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Player, PlayerRef } from "@remotion/player";
import { TranscriptAnimation } from "./Scene";
import "./style.css";
import "./glass.css";
import "./product-interaction.css";
import {ChromeIcon, useWorkbenchAppearance} from "./WorkbenchChrome";
import { ComponentLibrary } from "./ComponentLibrary";
import { Production } from "./Production";
import { Roughcut } from "./Roughcut";
import {CheckpointPanel} from './CheckpointPanel';
function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const {solid, setSolid} = useWorkbenchAppearance();
  const [mode, setMode] = useState(() => {
    try { const saved = localStorage.getItem("workbench.workspace");
      return saved && ["cut", "production", "library", "sample"].includes(saved) ? saved : "cut";
    } catch { return "cut"; }
  });
  useEffect(() => { try { localStorage.setItem("workbench.workspace", mode); } catch {} }, [mode]);
  const [productionDirty, setProductionDirty] = useState(false);
  const [cutDirty,setCutDirty]=useState(false),[checkpointOpen,setCheckpointOpen]=useState(false),[checkpointSupport,setCheckpointSupport]=useState(false);
  const [p, setP] = useState<any>(),
    [base, setBase] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("文字"),
    [job, setJob] = useState<any>(),
    [dirty, setDirty] = useState(false);
  const player = useRef<PlayerRef>(null);
  const token = useRef("");
  async function api(path: string, body?: any) {
    const r = await fetch("/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type":
          body instanceof File
            ? "application/octet-stream"
            : "application/json",
        "X-Workbench-Token": token.current,
      },
      body:
        body instanceof File ? body : body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  useEffect(() => {
    api("bootstrap")
      .then((d) => {
        token.current = d.token;
        setP(d.project);
        setBase(d.base);
        setJob(d.job);
        setCheckpointSupport(d.capabilities?.checkpoints===true);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!p || dirty || busy) return;
    const timer = setInterval(
      () =>
        api("project")
          .then((d) =>
            setP((old: any) => (old.revision === d.revision ? old : d)),
          )
          .catch((e) => setError(e.message)),
      1500,
    );
    return () => clearInterval(timer);
  }, [!!p, dirty, busy]);
  async function action(kind: string) {
    setBusy(true);
    setError("");
    try {
      const d = await api(kind, {
        expectedRevision: p.revision,
        ...(kind === "patch"
          ? { patch: { values: p.values, locks: p.locks }, actor: "user" }
          : {}),
      });
      setP(d);
      setDirty(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!job || job.status === "done" || job.status === "failed") return;
    const t = setInterval(
      () =>
        api("export")
          .then(setJob)
          .catch((e) => setError(e.message)),
      1000,
    );
    return () => clearInterval(t);
  }, [job?.status]);
  function change(key: string, value: any) {
    setP({ ...p, values: { ...p.values, [key]: value } });
    setDirty(true);
  }
  function lock(key: string) {
    const id = "values." + key;
    setP({
      ...p,
      locks: p.locks.includes(id)
        ? p.locks.filter((x: string) => x !== id)
        : [...p.locks, id],
    });
    setDirty(true);
  }
  if (!p || !base)
    return <div className="loading">{error || "正在打开工作台…"}</div>;
  const range = (
    key: string,
    name: string,
    min: number,
    max: number,
    step: number,
  ) => (
    <label className="field">
      {name}
      <output>{p.values[key]}</output>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={p.values[key]}
        onChange={(e) => change(key, +e.target.value)}
      />
    </label>
  );
  return (
    <div className="app" data-mode={mode} data-left-collapsed={leftCollapsed} data-right-collapsed={rightCollapsed} data-solid={solid}>
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">C</span><div><strong>Codex Cut</strong><small>你的本地创作空间</small></div></div>
        <nav className="workspace-tabs" aria-label="工作区">
          {([['cut', '剪辑'], ['production', '包装与审阅'], ['library', '组件']] as const).map(([id,label]) =>
            <button key={id} aria-current={mode === id ? 'page' : undefined} disabled={productionDirty || dirty || cutDirty} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>{label}</button>
          )}
        </nav>
        <div className="shell-tools">
          {(productionDirty || dirty || cutDirty) && <span className="draft-indicator">未保存</span>}
          <button className="shell-icon" title={leftCollapsed ? '展开资源栏' : '收起资源栏'} aria-label="切换资源栏" aria-pressed={!leftCollapsed} onClick={() => setLeftCollapsed(!leftCollapsed)}><ChromeIcon kind="left"/></button>
          <button className="shell-icon" title={rightCollapsed ? '展开属性栏' : '收起属性栏'} aria-label="切换属性栏" aria-pressed={!rightCollapsed} onClick={() => setRightCollapsed(!rightCollapsed)}><ChromeIcon kind="right"/></button>
          <details className="appearance-menu" onKeyDown={e => { if (e.key === "Escape") e.currentTarget.open = false; }}><summary title="外观与工具" aria-label="外观与工具"><ChromeIcon kind="glass"/></summary><div className="appearance-popover">
            <b>工作台外观</b>
            <label><input type="checkbox" checked={solid} onChange={e => setSolid(e.target.checked)}/>减少透明度</label>
            <p>仅改变工作台，不影响成片。</p>
            {checkpointSupport && <div className="checkpoint-menu-entry"><b>工程</b><button disabled={productionDirty || dirty || cutDirty} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');setCheckpointOpen(true);}}>备份与恢复</button></div>}
            <details><summary>开发工具</summary><button disabled={productionDirty || dirty} onClick={() => setMode('sample')}>动画实验页</button></details>
          </div></details>
        </div>
        {mode === 'sample' && <div className="sample-actions">
          <span>{dirty ? '有未保存的调整' : `已保存 · 版本 ${p.revision}`}</span>
          <button disabled={busy || dirty} onClick={() => action('undo')}>撤销</button>
          <button disabled={busy || dirty} onClick={() => action('redo')}>重做</button>
          <button disabled={!dirty || busy} onClick={() => action('patch')}>保存调整</button>
          <button className="primary" disabled={dirty || busy || job?.status === 'rendering'} onClick={() => api('export', {}).then(setJob).catch(e => setError(e.message))}>导出视频</button>
        </div>}
      </header>
      {checkpointOpen && <CheckpointPanel api={api} hasDraft={productionDirty || dirty || cutDirty} onClose={()=>setCheckpointOpen(false)}/>}
      {mode === "library" ? (
        <ComponentLibrary onOpenScene={() => setMode("production")} api={api} onDirtyChange={setProductionDirty} />
      ) : mode === "production" ? (
        <Production
          api={api}
          token={token.current}
          onDirtyChange={setProductionDirty}
        />
      ) : mode === "cut" ? (
        <Roughcut api={api} token={token.current} onDirtyChange={setCutDirty} />
      ) : (
        <div className="workspace">
          <aside className="left">
            <div className="eyebrow">当前项目</div>
            <h2>场景</h2>
            <button className="scene" onClick={() => player.current?.seekTo(0)}>
              <span className="thumb">
                Aa <i>→</i> ▥
              </span>
              <b>01　从口播到时间线</b>
              <small>00:00 — 00:11.37</small>
            </button>
            <div className="eyebrow objects">画面对象</div>
            {["文字", "人物", "样式"].map((x) => (
              <button
                className={"object " + (tab === x ? "selected" : "")}
                onClick={() => setTab(x)}
                key={x}
              >
                {x === "文字" ? "T" : x === "人物" ? "▣" : "◐"}　{x}
              </button>
            ))}
            <div className="note">
              与 Codex 对话提出修改。
              <br />
              这里查看画面、调整细节。
              <br />
              锁定的参数会受到保护。
            </div>
          </aside>
          <main>
            <div className="canvas-title">
              <span>成片预览</span>
              <small>1920 × 1080 · 30 fps</small>
            </div>
            <div className="canvas">
              <Player
                ref={player}
                component={TranscriptAnimation}
                inputProps={{ ...base, values: p.values, motion: p.motion }}
                compositionWidth={1920}
                compositionHeight={1080}
                durationInFrames={341}
                fps={30}
                controls
                style={{ width: "100%", aspectRatio: "16 / 9" }}
              />
            </div>
            <div className="timeline">
              <div className="eyebrow">
                叙事节奏 <span>点击跳转</span>
              </div>
              <div className="beats">
                {[
                  ["01", "导入口播", 0],
                  ["02", "生成逐字稿", 190],
                  ["03", "文字对齐时间线", 280],
                ].map(([n, label, f]) => (
                  <button key={n} onClick={() => player.current?.seekTo(+f)}>
                    <small>{n}</small>
                    {label}
                    <span>{(+f / 30).toFixed(2)} s</span>
                  </button>
                ))}
              </div>
              <p>
                动画依据原始口播推进，手动调节立即预览，保存后进入项目版本。
              </p>
            </div>
            {error && (
              <div className="error">
                {error}{" "}
                <button
                  onClick={() =>
                    api("bootstrap").then((d) => {
                      setP(d.project);
                      setDirty(false);
                      setError("");
                    })
                  }
                >
                  重新载入已保存版本
                </button>
              </div>
            )}
            {job && (
              <div className="export">
                {job.status === "done" ? (
                  <a href={job.url}>下载版本 {job.revision} 的 MP4</a>
                ) : job.status === "failed" ? (
                  job.error
                ) : (
                  `正在导出版本 ${job.revision} · ${Math.round((job.progress || 0) * 100)}%`
                )}
              </div>
            )}
          </main>
          <aside className="right">
            <div className="eyebrow">属性</div>
            <h2>{tab}</h2>
            {tab === "文字" ? (
              <>
                <label className="field">
                  对齐阶段标题
                  <input
                    value={p.values.title}
                    maxLength={80}
                    onChange={(e) => change("title", e.target.value)}
                  />
                </label>
                {range("titleScale", "文字大小", 0.5, 1.5, 0.01)}
                <button onClick={() => lock("title")}>
                  {p.locks.includes("values.title")
                    ? "🔒 已锁定标题"
                    : "锁定标题，保留我的文案"}
                </button>
                <p className="hint">此标题在约 8.5 秒后出现。</p>
                <button onClick={() => player.current?.seekTo(300)}>
                  查看标题所在画面 ↗
                </button>
              </>
            ) : tab === "人物" ? (
              <>
                {range("personScale", "画面大小", 0.5, 1.5, 0.01)}
                {range("personX", "水平位置", -300, 300, 1)}
                {range("personY", "垂直位置", -300, 300, 1)}
                <button onClick={() => lock("personScale")}>
                  {p.locks.includes("values.personScale")
                    ? "🔒 已锁定大小"
                    : "锁定人物大小"}
                </button>
              </>
            ) : (
              <>
                <label className="field">
                  强调色
                  <input
                    type="color"
                    value={p.values.accent}
                    onChange={(e) => change("accent", e.target.value)}
                  />
                </label>
                <button onClick={() => lock("accent")}>
                  {p.locks.includes("values.accent")
                    ? "🔒 已锁定颜色"
                    : "锁定强调色"}
                </button>
              </>
            )}
            <div className="hint bottom">
              这是一段真实可编辑样片。
              <br />
              素材导入和整片剪辑将在后续接入。
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
