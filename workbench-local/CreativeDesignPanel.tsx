import React, { useState } from "react";
export function CreativeDesignPanel({
  design,
  beats,
  onChange,
}: {
  design: any;
  beats: any[];
  onChange: (value: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const field = (label: string, value: string, change: (v: string) => void) => (
    <label className="field">
      {label}
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
  if (!design)
    return (
      <section className="creative-design">
        <h3>这段怎么呈现</h3>
        <p>
          这里可以记录主副视觉、构图和动画顺序，供后续讨论和修改参考。留空也能预览和导出。
        </p>
        <button
          onClick={() => {
            setEditing(true);
            onChange({
              message: "",
              relationship: "",
              rationale: "",
              objects: [],
              actions: [],
            });
          }}
        >
          添加设计笔记
        </button>
      </section>
    );
  if (!editing)
    return (
      <details className="creative-design">
        <summary>这段怎么呈现 · 展开视觉方案</summary>
        <p>
          <b>核心表达：</b>
          {design.message}
        </p>
        <p>
          <b>信息关系：</b>
          {design.relationship}
        </p>
        <div className="design-summary-grid">
          {design.objects.map((o: any) => (
            <article key={o.id}>
              <small>{o.role === "main" ? "主视觉" : "副视觉"}</small>
              <h4>{o.content}</h4>
              <p>{o.layout}</p>
              <small>素材：{o.source}</small>
            </article>
          ))}
        </div>
        {!!design.actions.length && (
          <ol>
            {design.actions.map((a: any, i: number) => (
              <li key={i}>
                <b>{beats.find((b) => b.wordId === a.wordId)?.label}</b>：
                {design.objects.find((o: any) => o.id === a.objectId)?.content}{" "}
                · {a.action}
                {(a.before || a.after) && <p>{a.before || '未记录起态'} → {a.after || '未记录终态'}</p>}
                <p className="hint">{a.purpose}{a.durationMs !== undefined ? ` · 动作 ${(a.durationMs / 1000).toFixed(2)} 秒` : ''}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="hint">{design.rationale}</p>
        <button onClick={() => setEditing(true)}>修改视觉方案</button>
      </details>
    );
  const update = (key: string, value: any) =>
    onChange({ ...design, [key]: value });
  const object = (i: number, key: string, value: any) =>
    update(
      "objects",
      design.objects.map((o: any, n: number) =>
        n === i ? { ...o, [key]: value } : o,
      ),
    );
  const action = (i: number, key: string, value: any) =>
    update(
      "actions",
      design.actions.map((a: any, n: number) =>
        n === i ? { ...a, [key]: value } : a,
      ),
    );
  return (
    <details className="creative-design" open>
      <summary>这段怎么呈现 · 视觉方案</summary>
      {field("让观众记住什么", design.message, (v) => update("message", v))}
      {field("信息之间的关系", design.relationship, (v) =>
        update("relationship", v),
      )}
      <h4>主副视觉与构图</h4>
      {design.objects.map((o: any, i: number) => (
        <div className="design-object" key={o.id}>
          <label className="field">
            视觉职责
            <select
              aria-label={`对象${i + 1}职责`}
              value={o.role}
              onChange={(e) => object(i, "role", e.target.value)}
            >
              <option value="main">主视觉</option>
              <option value="support">副视觉</option>
            </select>
          </label>
          {field(`对象${i + 1}内容`, o.content, (v) => object(i, "content", v))}
          {field(`对象${i + 1}素材来源`, o.source, (v) =>
            object(i, "source", v),
          )}
          {field(`对象${i + 1}位置与层级`, o.layout, (v) =>
            object(i, "layout", v),
          )}
          <button
            onClick={() => {
              onChange({
                ...design,
                objects: design.objects.filter((_: any, n: number) => n !== i),
                actions: design.actions.filter((a: any) => a.objectId !== o.id),
              });
            }}
          >
            移除对象
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          update("objects", [
            ...design.objects,
            {
              id: crypto.randomUUID(),
              role: design.objects.length ? "support" : "main",
              content: "",
              source: "",
              layout: "",
            },
          ])
        }
      >
        添加视觉对象
      </button>
      <h4>动作设计</h4><p className="hint">起态 → 动作 → 终态。时间相对绑定口播词，填写后用于检查定位；动画代码须按同一时间实现。</p>
      {design.actions.map((a: any, i: number) => (
        <div className="design-object" key={i}>
          <label className="field">
            作用对象
            <select
              value={a.objectId}
              onChange={(e) => action(i, "objectId", e.target.value)}
            >
              <option value="">选择对象</option>
              {design.objects.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.content || "未填写内容"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            跟随哪句口播
            <select
              value={a.wordId}
              onChange={(e) => action(i, "wordId", e.target.value)}
            >
              <option value="">选择口播节拍</option>
              {beats.map((b) => (
                <option key={b.wordId} value={b.wordId}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          {field(`动作${i + 1}起态`, a.before || "", (v) => action(i, "before", v || undefined))}
          {field(`动作${i + 1}终态`, a.after || "", (v) => action(i, "after", v || undefined))}
          <label className="field">相对口播偏移（毫秒）<input type="number" min={-5000} max={60000} value={a.offsetMs ?? ''} onChange={e => action(i, 'offsetMs', e.target.value === '' ? undefined : e.target.valueAsNumber)}/></label>
          <label className="field">动作时长（毫秒）<input type="number" min={1} max={60000} value={a.durationMs ?? ''} onChange={e => action(i, 'durationMs', e.target.value === '' ? undefined : e.target.valueAsNumber)}/></label>
          {field(`动作${i + 1}如何变化`, a.action, (v) =>
            action(i, "action", v),
          )}
          {field(`动作${i + 1}为什么这样做`, a.purpose, (v) =>
            action(i, "purpose", v),
          )}
          <button
            onClick={() =>
              update(
                "actions",
                design.actions.filter((_: any, n: number) => n !== i),
              )
            }
          >
            移除动作
          </button>
        </div>
      ))}
      <button
        disabled={!design.objects.length || !beats.length}
        onClick={() =>
          update("actions", [
            ...design.actions,
            {
              objectId: design.objects[0]?.id || "",
              wordId: beats[0]?.wordId || "",
              action: "",
              purpose: "",
            },
          ])
        }
      >
        添加包装动作
      </button>
      {field("整体设计理由", design.rationale, (v) => update("rationale", v))}
      <p className="hint">
        保存方案不会自动改动画。Codex
        读取这些决定后实现画面；最终以实际样片为准。
      </p>
    </details>
  );
}
