import React, { useEffect, useRef, useState } from "react";
import {
  expandRangeToFrame,
  wordIdsBetween,
  wordIdsFromDomSelection,
} from "./roughcut-selection";
import { MultiAssetCut } from "./MultiAssetCut";
import "./roughcut-interaction.css";

type Word = { id: string; text: string; startMs: number; endMs: number };
type Range = { startMs: number; endMs: number };
type SelectionMenu = { left: number; top: number };

function formatSeconds(valueMs: number): string {
  return `${(valueMs / 1000).toFixed(2)}s`;
}

function formatRange(range: Range): string {
  return `${formatSeconds(range.startMs)} — ${formatSeconds(range.endMs)}`;
}

function shouldEndParagraph(word: Word, next: Word | undefined, size: number): boolean {
  const text = word.text.trim();
  const sentenceEnd = /[。！？!?；;.。]$/u.test(text);
  const pause = next !== undefined && next.startMs - word.endMs >= 1_100;
  return sentenceEnd || pause || size >= 42;
}

function transcriptParagraphs(words: readonly Word[]): Word[][] {
  const paragraphs: Word[][] = [];
  let current: Word[] = [];
  words.forEach((word, index) => {
    current.push(word);
    if (shouldEndParagraph(word, words[index + 1], current.length)) {
      paragraphs.push(current);
      current = [];
    }
  });
  if (current.length) paragraphs.push(current);
  return paragraphs;
}

function wordSeparator(previous: string, next: string): string {
  const left = previous.trim();
  const right = next.trim();
  if (!left || !right) return "";
  if (/^[,.;!?，。！？；：、）》』」】]/u.test(right)) return "";
  if (/[([{“‘《「『【]$/u.test(left)) return "";
  if (/[\u3400-\u9fff]$/u.test(left) && /^[\u3400-\u9fff]/u.test(right)) return "";
  return " ";
}

function mergeRanges(ranges: readonly Range[], additions: readonly Range[]): Range[] {
  const ordered = [...ranges, ...additions]
    .map((range) => ({ startMs: range.startMs, endMs: range.endMs }))
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  return ordered.reduce<Range[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.startMs > previous.endMs) {
      merged.push(range);
    } else {
      previous.endMs = Math.max(previous.endMs, range.endMs);
    }
    return merged;
  }, []);
}

export function Roughcut({
  api,
  token,
  onDirtyChange,
}: {
  api: (path: string, body?: any) => Promise<any>;
  token: string;
  onDirtyChange?: (dirty:boolean)=>void;
}) {
  const [correction, setCorrection] = useState("");
  const [s, setS] = useState<any>(),
    [error, setError] = useState(""),
    [working, setWorking] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [selectionAnchor, setSelectionAnchor] = useState<string | null>(null),
    [selectionMenu, setSelectionMenu] = useState<SelectionMenu | null>(null),
    [selectedSegment, setSelectedSegment] = useState<number | null>(null),
    [start, setStart] = useState("0"),
    [end, setEnd] = useState(""),
    [mode, setMode] = useState<"source" | "cut">("source"),
    [time, setTime] = useState(0),
    [showClipEditor, setShowClipEditor] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const shiftClickPending = useRef(false);
  const restoredAsset = useRef<string | null>(null);

  const refresh = () =>
    api("cut").then((next: any) => {
      if (next.asset?.url && restoredAsset.current !== next.asset.url) {
        restoredAsset.current = next.asset.url;
        setSelected([]);
        setSelectionAnchor(null);
        setSelectionMenu(null);
        setSelectedSegment(null);
        setTime(0);
        let target: "source" | "cut" = "source";
        try {
          const saved = JSON.parse(
            localStorage.getItem("workbench.cut-position") || "null",
          );
          if (
            saved?.asset === next.asset.url &&
            saved.mode === "cut" &&
            saved.url === next.preview?.url &&
            next.preview?.revision === next.revision
          )
            target = "cut";
        } catch {}
        setMode(target);
      }
      setS(next);
    });

  function rememberTime(value: number) {
    setTime(value);
    if (!s?.asset) return;
    try {
      localStorage.setItem(
        "workbench.cut-position",
        JSON.stringify({
          asset: s.asset.url,
          url: mode === "cut" ? s.preview?.url : s.asset.url,
          mode,
          time: value,
        }),
      );
    } catch {}
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const t = setInterval(
      () => refresh().catch((e) => setError(e.message)),
      2000,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (
      selectedSegment !== null &&
      s?.ranges &&
      selectedSegment >= s.ranges.length
    ) {
      setSelectedSegment(null);
    }
  }, [selectedSegment, s?.ranges?.length]);

  async function run(label: string, fn: () => Promise<any>) {
    setWorking(label);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking("");
    }
  }

  async function upload(file: File) {
    await run("正在导入素材…", async () => {
      const append = !!s?.asset;
      if (append && (s?.capabilities?.multiAsset !== true || s?.capabilities?.clipTransforms !== true)) {
        throw Error("当前工作台服务尚未启用多素材追加，请更新服务后再导入第二个视频。");
      }
      const query = `cut/upload?name=${encodeURIComponent(file.name)}${append ? `&mode=append&expectedRevision=${s.revision}` : ""}`;
      const r = await fetch(
        "/api/" + query,
        {
          method: "POST",
          headers: {
            "X-Workbench-Token": token,
            "Content-Type": "application/octet-stream",
          },
          body: file,
        },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMode("source");
      clearSelection();
    });
  }

  function remove(ranges: Range[], a: number, b: number) {
    return ranges.flatMap((r) =>
      b <= r.startMs || a >= r.endMs
        ? [r]
        : [
            ...(a > r.startMs ? [{ startMs: r.startMs, endMs: a }] : []),
            ...(b < r.endMs ? [{ startMs: b, endMs: r.endMs }] : []),
          ],
    );
  }

  if (!s) return <div className="loading">{error || "正在读取剪辑工程…"}</div>;

  if (s.timeline && s.capabilities?.multiAsset === true && s.capabilities?.clipTransforms === true) {
    return <MultiAssetCut state={s} api={api} onRefresh={refresh} onDirtyChange={onDirtyChange} />;
  }

  const pending = !!working || s.busy || s.transcribing;
  const kept = (w: Word) =>
    s.ranges.some((r: Range) => w.endMs > r.startMs && w.startMs < r.endMs);
  const selectedSet = new Set(selected);
  const selectedWords = s.words.filter((w: Word) => selectedSet.has(w.id));
  const selectedKeptWords = selectedWords.filter(kept);
  const selectedRemovedWords = selectedWords.filter((w: Word) => !kept(w));
  const selectedInterval = selectedWords.length
    ? {
        startMs: Math.min(...selectedWords.map((w: Word) => w.startMs)),
        endMs: Math.max(...selectedWords.map((w: Word) => w.endMs)),
      }
    : null;
  const selectedSegmentRange =
    selectedSegment === null ? null : (s.ranges[selectedSegment] as Range | undefined);
  const totalRangeMs = s.ranges.reduce(
    (total: number, range: Range) => total + range.endMs - range.startMs,
    0,
  );
  const paragraphs = transcriptParagraphs(s.words);

  function clearSelection() {
    setSelected([]);
    setSelectionAnchor(null);
    setSelectionMenu(null);
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }

  function menuPosition(rect: DOMRect | null): SelectionMenu | null {
    if (!rect || typeof window === "undefined") return null;
    return {
      left: Math.max(16, Math.min(window.innerWidth - 16, rect.left + rect.width / 2)),
      top: Math.max(10, rect.top - 52),
    };
  }

  function syncNativeSelection() {
    if (shiftClickPending.current) {
      shiftClickPending.current = false;
      return;
    }
    const native = window.getSelection();
    const ids = wordIdsFromDomSelection(transcriptRef.current, native);
    if (!ids.length) return;
    setSelected(ids);
    setSelectionAnchor(ids[0]);
    const rect = native?.rangeCount ? native.getRangeAt(0).getBoundingClientRect() : null;
    setSelectionMenu(menuPosition(rect));
  }

  function jump(w: Word) {
    if (!video.current) return;
    if (mode === "source") {
      video.current.currentTime = w.startMs / 1000;
      return;
    }
    const mapped = s.mappedWords?.find((x: Word) => x.id === w.id);
    if (mapped) video.current.currentTime = mapped.startMs / 1000;
  }

  function segmentStartMs(index: number): number {
    return mode === "source"
      ? s.ranges[index].startMs
      : s.ranges
          .slice(0, index)
          .reduce((n: number, range: Range) => n + range.endMs - range.startMs, 0);
  }

  function handleWordClick(
    word: Word,
    event: React.MouseEvent<HTMLSpanElement>,
  ) {
    if (event.shiftKey && selectionAnchor) {
      const ids = wordIdsBetween(s.words, selectionAnchor, word.id);
      if (ids.length) {
        setSelected(ids);
        setSelectionMenu(menuPosition(event.currentTarget.getBoundingClientRect()));
        window.getSelection()?.removeAllRanges();
        return;
      }
    }
    const native = window.getSelection();
    if (native && !native.isCollapsed && native.toString().trim()) return;
    if (selected.length) {
      setSelected([]);
      setSelectionMenu(null);
    }
    setSelectionAnchor(word.id);
    jump(word);
  }

  function handleWordKeyDown(
    word: Word,
    event: React.KeyboardEvent<HTMLSpanElement>,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      jump(word);
      setSelectionAnchor(word.id);
    }
  }

  async function cutSelection() {
    const wordsToRemove = selectedKeptWords;
    if (!wordsToRemove.length) return;
    let ranges = s.ranges;
    for (const word of wordsToRemove) ranges = remove(ranges, word.startMs, word.endMs);
    await api("cut/ranges", { expectedRevision: s.revision, ranges });
    clearSelection();
  }

  async function restoreSelection() {
    const wordsToRestore = selectedRemovedWords;
    if (!wordsToRestore.length || !s.asset) return;
    const ranges = mergeRanges(
      s.ranges,
      wordsToRestore.map((word: Word) =>
        expandRangeToFrame(
          { startMs: word.startMs, endMs: word.endMs },
          s.asset.durationMs,
        ),
      ),
    );
    await api("cut/ranges", { expectedRevision: s.revision, ranges });
    clearSelection();
  }

  const current = s.preview?.revision === s.revision;
  const activeIds = new Set(
    (mode === "source" ? s.words : s.mappedWords || [])
      .filter((w: Word) => time * 1000 >= w.startMs && time * 1000 < w.endMs)
      .map((w: Word) => w.id),
  );

  return (
    <div className="cut-workspace">
      <aside className="left">
        <div className="eyebrow">素材箱</div>
        <h2>口播粗剪</h2>
        <label className="upload">
          ＋ 导入视频
          <input
            disabled={pending}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {s.asset && (
          <div className="asset-name">
            <b className="roughcut-file-name" title={s.asset.name}>
              {s.asset.name}
            </b>
            <p>{(s.asset.durationMs / 1000).toFixed(2)} 秒</p>
          </div>
        )}
        <p className="hint">原始文件保持不变。每次导入会开启独立的粗剪记录。</p>
        <div className="objects eyebrow">工作方式</div>
        <p className="hint">
          点击词跳转，拖拽文字即可预览选择范围。
          <br />
          确认后再删除，剪后预览单独生成。
        </p>
      </aside>
      <main>
        <div className="canvas-title">
          <span>
            {mode === "source" ? "原始素材" : "剪后预览"} · {time.toFixed(2)}s
          </span>
          <div>
            <button
              onClick={() => {
                setMode("source");
                setTime(0);
              }}
            >
              原片
            </button>{" "}
            <button
              disabled={!s.preview || !current}
              onClick={() => {
                setMode("cut");
                setTime(0);
              }}
            >
              剪后
            </button>
          </div>
        </div>
        <div className="cut-canvas">
          {s.asset ? (
            <video
              ref={video}
              key={mode === "source" ? s.asset.url : s.preview?.url}
              src={mode === "source" ? s.asset.url : s.preview?.url}
              controls
              onLoadedMetadata={(e) => {
                try {
                  const saved = JSON.parse(
                    localStorage.getItem("workbench.cut-position") || "null",
                  );
                  const url = mode === "cut" ? s.preview.url : s.asset.url;
                  if (saved?.url === url && Number.isFinite(saved.time))
                    e.currentTarget.currentTime = Math.max(
                      0,
                      Math.min(e.currentTarget.duration, saved.time),
                    );
                } catch {}
                rememberTime(e.currentTarget.currentTime);
              }}
              onTimeUpdate={(e) => rememberTime(e.currentTarget.currentTime)}
            />
          ) : (
            <div className="empty">导入一段口播，开始剪辑</div>
          )}
        </div>
        <div className="cut-segments roughcut-segment-strip" aria-label="保留片段">
          {s.ranges.map((r: Range, i: number) => (
            <button
              className={
                "roughcut-segment " +
                (selectedSegment === i ? "selected" : "")
              }
              key={i}
              style={{
                flex: `0 0 ${((r.endMs - r.startMs) / totalRangeMs) * 100}%`,
              }}
              aria-pressed={selectedSegment === i}
              title={`片段 ${i + 1} · ${formatRange(r)}`}
              onClick={() => {
                setSelectedSegment(i);
                if (video.current) video.current.currentTime = segmentStartMs(i) / 1000;
              }}
            >
              <b className="roughcut-segment-index">{String(i + 1).padStart(2, "0")}</b>
              <span className="roughcut-segment-time">{formatRange(r)}</span>
            </button>
          ))}
        </div>
        <div className="transcript-head">
          <h2>
            逐字稿 <small>{s.words.length ? `${s.words.length} 个词` : "尚未转写"}</small>
          </h2>
          <details className="roughcut-tools">
            <summary>导入或转写</summary>
            <div className="roughcut-tools-popover">
              <button
                disabled={pending || !s.asset}
                onClick={() =>
                  run("正在启动本地转写…", () => api("cut/transcribe", {}))
                }
              >
                本地转写（低频）
              </button>
              <label className="upload compact">
                导入转写 JSON
                <input
                  disabled={pending || !s.asset}
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void run("正在读取转写…", async () =>
                        api("cut/transcript", {
                          expectedRevision: s.revision,
                          transcript: JSON.parse(await f.text()),
                        }),
                      );
                    e.target.value = "";
                  }}
                />
              </label>
              <small>Whisper small 或已有词级时间 JSON</small>
            </div>
          </details>
        </div>
        <div
          ref={transcriptRef}
          className="transcript roughcut-transcript"
          aria-label="逐字稿文字选择区"
          onMouseUp={syncNativeSelection}
          onKeyUp={syncNativeSelection}
        >
          {paragraphs.length ? (
            paragraphs.map((paragraph, paragraphIndex) => (
              <p className="roughcut-paragraph" key={`paragraph-${paragraphIndex}`}>
                {paragraph.map((w: Word, wordIndex: number) => {
                  const previous = paragraph[wordIndex - 1];
                  return (
                    <React.Fragment key={w.id}>
                      {previous && wordSeparator(previous.text, w.text)}
                      <span
                        className={
                          "word roughcut-word " +
                          (!kept(w) ? "removed " : "") +
                          (activeIds.has(w.id) ? "speaking " : "") +
                          (selectedSet.has(w.id) ? "chosen" : "")
                        }
                        data-word-id={w.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedSet.has(w.id)}
                        aria-label={`${w.text}，${formatSeconds(w.startMs)}`}
                        title={formatSeconds(w.startMs)}
                        onMouseDown={(e) => {
                          if (e.shiftKey && selectionAnchor) shiftClickPending.current = true;
                        }}
                        onClick={(e) => handleWordClick(w, e)}
                        onKeyDown={(e) => handleWordKeyDown(w, e)}
                      >
                        {w.text.trim()}
                      </span>
                    </React.Fragment>
                  );
                })}
              </p>
            ))
          ) : (
            <p className="hint">
              本地转写使用已安装的 Whisper small 模型。也可导入已有的 Whisper JSON
              或带词级时间的 JSON。
            </p>
          )}
        </div>
        {selectionMenu && selected.length > 0 && (
          <div
            className="roughcut-selection-menu"
            style={{ left: selectionMenu.left, top: selectionMenu.top }}
            role="toolbar"
            aria-label="选中文字操作"
          >
            <span>
              预览 {selectedKeptWords.length} 词 · {selectedInterval ? formatRange(selectedInterval) : ""}
            </span>
            <button
              disabled={pending || !selectedKeptWords.length}
              onClick={() => void run("正在保存剪辑…", cutSelection)}
            >
              删除选择
            </button>
            {selectedRemovedWords.length > 0 && (
              <button
                disabled={pending}
                onClick={() => void run("正在恢复剪辑…", restoreSelection)}
              >
                恢复已删
              </button>
            )}
            <button onClick={clearSelection}>清除</button>
          </div>
        )}
        {(working || s.busy || s.transcribing) && (
          <p className="status">
            {working ||
              (s.transcribing
                ? "本地转写中，完成后会自动显示。"
                : "正在生成连续预览…")}
          </p>
        )}
        {(error || s.error || s.transcriptionError) && (
          <div className="error">{error || s.error || s.transcriptionError}</div>
        )}
      </main>
      <aside className="right">
        <div className="eyebrow">剪辑</div>
        <h2>保留与删除</h2>
        {selected.length > 0 ? (
          <section className="roughcut-selection-preview" aria-label="删除预览">
            <div className="roughcut-inspector-heading">
              <strong>选择预览</strong>
              <button onClick={clearSelection}>清除</button>
            </div>
            <p>
              {selectedKeptWords.length} 个保留词 · {selectedRemovedWords.length} 个已删除词
              <br />
              原片区间 {selectedInterval ? formatRange(selectedInterval) : "—"}
            </p>
            <button
              disabled={pending || !selectedKeptWords.length}
              onClick={() => void run("正在保存剪辑…", cutSelection)}
            >
              删除选中的 {selectedKeptWords.length} 个词
            </button>
            {selectedRemovedWords.length > 0 && (
              <button
                disabled={pending}
                onClick={() => void run("正在恢复剪辑…", restoreSelection)}
              >
                恢复选中的 {selectedRemovedWords.length} 个词
              </button>
            )}
            <small>确认后写入粗剪范围。</small>
          </section>
        ) : (
          <p className="hint">拖拽选择一段文字查看删除预览。点击词只会跳转播放头。</p>
        )}
        {selectedKeptWords.length === 1 && (
          <>
            <label className="field">
              纠正选中词的文字
              <input
                value={correction}
                placeholder="输入正确文字"
                onChange={(e) => setCorrection(e.target.value)}
              />
            </label>
            <button
              disabled={pending || !correction.trim()}
              onClick={() =>
                void run("正在保存文稿…", async () => {
                  await api("cut/transcript", {
                    expectedRevision: s.revision,
                    transcript: s.words.map((w: Word) =>
                      w.id === selectedKeptWords[0].id
                        ? { ...w, text: correction.trim() }
                        : w,
                    ),
                  });
                  setCorrection("");
                  clearSelection();
                })
              }
            >
              保存文字修正
            </button>
          </>
        )}
        {selectedSegmentRange && (
          <section className="roughcut-segment-inspector" aria-label="选中片段时间">
            <div className="roughcut-inspector-heading">
              <strong>选中片段 {String((selectedSegment ?? 0) + 1).padStart(2, "0")}</strong>
              <button onClick={() => setSelectedSegment(null)}>清除</button>
            </div>
            <b>{formatRange(selectedSegmentRange)}</b>
            <small>原片精确区间 · 按片段比例显示</small>
          </section>
        )}
        <section className="roughcut-clip-entry">
          <button
            type="button"
            disabled={pending || !s.asset || s.capabilities?.multiAsset !== true || s.capabilities?.clipTransforms !== true}
            onClick={() => setShowClipEditor(!showClipEditor)}
          >
            {showClipEditor ? "收起片段属性" : "打开片段属性"}
          </button>
          {s.capabilities?.multiAsset !== true || s.capabilities?.clipTransforms !== true ? (
            <small>当前服务未启用多素材片段编辑，更新服务后可用。</small>
          ) : (
            <small>可从单素材旧片段进入属性编辑，保存后迁移为时间线。</small>
          )}
          {showClipEditor && s.capabilities?.multiAsset === true && s.capabilities?.clipTransforms === true && (
            <MultiAssetCut state={s} api={api} onRefresh={refresh} compact onDirtyChange={onDirtyChange} />
          )}
        </section>
        <details className="roughcut-precise-delete">
          <summary>精确裁剪</summary>
          <div className="roughcut-precise-delete-body">
            <p className="hint">输入原片时间，适合处理没有对应文字的片段。</p>
            <label className="field">
              删除区间 · 起点（秒）
              <input
                type="number"
                min="0"
                step="0.01"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="field">
              终点（秒）
              <input
                type="number"
                min="0"
                step="0.01"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <button
              disabled={pending || !s.asset}
              onClick={() =>
                void run("正在保存剪辑…", async () => {
                  const a = Number(start) * 1000,
                    b = Number(end) * 1000;
                  if (!end || a < 0 || b <= a || b > s.asset.durationMs)
                    throw Error("请输入素材范围内的有效起止时间");
                  await api("cut/ranges", {
                    expectedRevision: s.revision,
                    ranges: remove(s.ranges, a, b),
                  });
                })
              }
            >
              删除这段
            </button>
          </div>
        </details>{" "}
        <button
          disabled={pending || !s.asset}
          onClick={() =>
            void run("正在撤销…", () =>
              api("cut/undo", { expectedRevision: s.revision }),
            )
          }
        >
          撤销
        </button>
        <p className="hint">
          保留 {s.ranges.length} 段 · {(
            s.ranges.reduce(
              (n: number, r: Range) => n + r.endMs - r.startMs,
              0,
            ) / 1000
          ).toFixed(2)} 秒
        </p>
        <button
          className="primary"
          disabled={pending || !s.asset}
          onClick={() => void run("正在启动连续预览…", () => api("cut/render", {}))}
        >
          生成剪后预览
        </button>
        {s.preview && (
          <p className="hint">
            {current ? "预览已与当前剪辑同步。" : "剪辑已更新，请重新生成预览。"}
            <br />
            {current && (
              <a href={s.preview.url} download>
                下载粗剪 MP4
              </a>
            )}
          </p>
        )}
        <p className="hint bottom">
          粗剪与动画样片目前独立保存。
          <br />
          在「包装与审阅」查看当前剪辑对应的场景设计。
        </p>
      </aside>
    </div>
  );
}
