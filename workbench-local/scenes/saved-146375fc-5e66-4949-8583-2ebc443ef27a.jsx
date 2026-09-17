// workbench-local/scenes/DirectedNarration.tsx
import React2 from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var ease = Easing.bezier(0.22, 1, 0.36, 1);
var pos = (left, top, width, height) => ({ position: "absolute", left, top, width, height });
var blend = (a, b, t) => a + (b - a) * t;
function DirectedNarration({ id, parameters: v, beats, mediaSrc, materials, from }) {
  const f = useCurrentFrame(), n = Number(id.split("-").at(-1));
  const bg = String(v.background), ink = String(v.textColor), accent = String(v.accent), muted = "#a9b5ad", scale = Number(v.typeScale);
  const words = String(v.labels).split("|");
  const cue = (i) => {
    const b = beats.find((b2) => b2.wordId === "dji-word-" + i);
    if (!b) throw Error("Missing directed cue " + i);
    return b.frame;
  };
  const ramp = (a, b) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const p = (i, d = 10) => ramp(cue(i), cue(i) + d);
  const reveal = (i, d = 10) => ({ opacity: p(i, d), transform: `translateY(${18 * (1 - p(i, d))}px)` });
  const src = (s) => s.startsWith("/") ? s : staticFile(s);
  const fullPerson = () => /* @__PURE__ */ jsx("div", { "data-editable-object": "person", style: { ...pos(0, 0, 1920, 1080), transform: `translate(${Number(v.personX)}px,${Number(v.personY)}px) scale(${Number(v.personScale)})` }, children: /* @__PURE__ */ jsx(OffthreadVideo, { src: src(mediaSrc), trimBefore: from, muted: true, style: { width: "100%", height: "100%", objectFit: "contain" } }) });
  const shade = (opacity = 1) => /* @__PURE__ */ jsx(AbsoluteFill, { style: { pointerEvents: "none", opacity, background: "linear-gradient(90deg,rgba(0,0,0,.44),transparent 43%)" } });
  const eyebrow = (t) => /* @__PURE__ */ jsx("div", { style: { ...pos(110, 100), fontSize: 27, color: muted }, children: t });
  let body;
  if (n === 1) {
    const cues = [23, 28, 31, 36];
    let active = -1;
    cues.forEach((i, j) => {
      if (f >= cue(i)) active = j;
    });
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      fullPerson(),
      shade(p(23)),
      /* @__PURE__ */ jsx("div", { "data-editable-object": "graphics", style: pos(95, 254, 675), children: words.map((t, i) => /* @__PURE__ */ jsx("div", { style: { ...reveal(cues[i]), fontSize: (i === 3 ? 64 : 55) * scale, lineHeight: 1.25, marginBottom: 54, color: active === i ? accent : ink, opacity: p(cues[i]) * (active === i ? 1 : 0.75) }, children: t }, i)) })
    ] });
  } else if (n === 2) {
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      eyebrow("\u4E00\u4E2A\u89E3\u51B3\u65B9\u6848"),
      /* @__PURE__ */ jsxs("div", { "data-editable-object": "headline", style: { ...pos(110, 352, 1700), textAlign: "center" }, children: [
        /* @__PURE__ */ jsx("div", { style: { ...reveal(49, 8), fontSize: 172 * scale, fontWeight: 600, letterSpacing: -7 }, children: "Codex Cut" }),
        /* @__PURE__ */ jsx("div", { style: { ...reveal(52, 8), fontSize: 62 * scale, color: accent, marginTop: 34 }, children: String(v.headline) })
      ] })
    ] });
  } else if (n === 4) {
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      fullPerson(),
      shade(p(124)),
      /* @__PURE__ */ jsxs("div", { "data-editable-object": "headline", style: { ...pos(105, 245, 650), ...reveal(124), fontSize: 74 * scale, lineHeight: 1.45 }, children: [
        words[0],
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("span", { style: { fontSize: 98 * scale, color: accent }, children: words[1] })
      ] })
    ] });
  } else if (n === 5) {
    body = fullPerson();
  } else if (n === 6) {
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      eyebrow("\u6587\u5B57\u8868\u8FBE\u793A\u610F"),
      /* @__PURE__ */ jsxs("div", { "data-editable-object": "headline", style: pos(210, 350, 1500), children: [
        /* @__PURE__ */ jsx("div", { style: { ...reveal(142, 6), fontSize: 125 * scale }, children: words[0] }),
        /* @__PURE__ */ jsx("div", { style: { ...reveal(145, 6), fontSize: 166 * scale, color: accent, marginTop: 34 }, children: words[1] })
      ] })
    ] });
  } else if (n === 7) {
    const compact = p(156, 6), current = f >= cue(161) ? 3 : f >= cue(158) ? 2 : f >= cue(156) ? 1 : 0;
    const material = materials.find((m) => m.kind === "video");
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      eyebrow("\u4E0D\u540C\u4FE1\u606F\uFF0C\u4F7F\u7528\u4E0D\u540C\u8F7D\u4F53"),
      /* @__PURE__ */ jsx("div", { "data-editable-object": "headline", style: { ...pos(110, 178, 1700), fontSize: 82 * scale }, children: String(v.headline) }),
      /* @__PURE__ */ jsxs("div", { "data-editable-object": "graphics", children: [
        /* @__PURE__ */ jsxs("div", { style: { ...pos(blend(480, 110, compact), blend(345, 455, compact), blend(960, 380, compact), 330), textAlign: "center", opacity: p(153, 6) * (current === 0 ? 1 : 0.72) }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: blend(42, 23, compact), color: muted, marginBottom: 18 }, children: "1 \u5206\u949F \xD7 60 fps" }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: blend(254, 86, compact) * scale, color: accent, fontWeight: 600, lineHeight: 1.13 }, children: "3,600" }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: blend(51, 28, compact), marginTop: 19 }, children: "\u5F20\u753B\u9762" })
        ] }),
        [0, 1, 2, 3].map((i) => /* @__PURE__ */ jsx("div", { style: { ...pos(110 + i * 440, 385), fontSize: 34, color: current === i ? accent : muted, opacity: i === 0 ? compact : p([153, 156, 158, 161][i], 6) }, children: words[i] }, i)),
        /* @__PURE__ */ jsxs("div", { style: { ...pos(550, 455, 380, 330), ...reveal(156, 6), opacity: p(156, 6) * (current === 1 ? 1 : 0.7), background: "#26352f", borderRadius: 12, overflow: "hidden" }, children: [
          /* @__PURE__ */ jsxs("svg", { width: "380", height: "270", viewBox: "0 0 380 270", children: [
            /* @__PURE__ */ jsx("circle", { cx: "302", cy: "67", r: "25", fill: accent }),
            /* @__PURE__ */ jsx("path", { d: "M0 270L122 55 265 270M173 270L300 135 380 270", fill: "#8d9c81" })
          ] }),
          /* @__PURE__ */ jsx("div", { style: { padding: 10, fontSize: 21, color: muted, textAlign: "center" }, children: "\u539F\u521B\u56FE\u7247\u793A\u610F" })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { ...pos(990, 455, 380, 330), ...reveal(158, 6), opacity: p(158, 6) * (current === 2 ? 1 : 0.75), background: "#25322b", borderRadius: 12, overflow: "hidden" }, children: [
          material ? /* @__PURE__ */ jsx(Sequence, { from: cue(158), layout: "none", children: /* @__PURE__ */ jsx(OffthreadVideo, { src: src(material.src), muted: true, style: { width: 380, height: 270, objectFit: "contain" } }) }) : null,
          /* @__PURE__ */ jsx("div", { style: { ...pos(20, 285), fontSize: 22, color: muted }, children: "\u672C\u673A\u5DE5\u4F5C\u53F0\u5F55\u5C4F" })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { ...pos(1430, 455, 380, 330), ...reveal(161, 6), background: "#2c392e", borderRadius: 12, padding: 26 }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 25, color: muted }, children: "AI \u5BF9\u8BDD\u793A\u610F" }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 27, marginTop: 26 }, children: "\u8FD9\u91CC\u5F3A\u8C03\u4EC0\u4E48\uFF1F" }),
          /* @__PURE__ */ jsxs("div", { style: { fontSize: 31, lineHeight: 1.6, color: accent, marginTop: 31 }, children: [
            "\u5148\u627E\u5230\u91CD\u70B9\uFF0C",
            /* @__PURE__ */ jsx("br", {}),
            "\u518D\u51B3\u5B9A\u753B\u9762\u3002"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { ...pos(110, 940), fontSize: 21, color: muted, opacity: p(153, 6) }, children: "\u6570\u5B57\u4E0E\u5A92\u4F53\u8868\u8FBE\u793A\u610F" })
      ] })
    ] });
  } else if (n === 8) {
    const k = cue(191), bad = f >= k && f < k + 12, returning = f >= k ? ramp(k + 12, k + 24) : 1;
    const move = bad ? 1 : f >= k + 12 ? 1 - returning : 0;
    const visibility = p(189, 8), boundary = p(196, 6) * (1 - ramp(cue(196) + 18, cue(196) + 28));
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      fullPerson(),
      shade(visibility * (1 - move)),
      /* @__PURE__ */ jsxs("div", { "data-editable-object": "graphics", style: { ...pos(blend(100, 670, move), blend(256, 230, move), 720), opacity: visibility, background: move > 0.4 ? "#f2f0e9" : "transparent", borderRadius: 12, padding: move > 0.4 ? 22 : 0, color: move > 0.4 ? "#202820" : ink }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 72 * scale }, children: words[0] }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 86 * scale, color: move > 0.4 ? "#202820" : accent, marginTop: 8 }, children: words[1] }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 28, marginTop: 32, color: bad ? "#df8278" : ink, opacity: f >= k ? 1 : 0 }, children: bad ? "\xD7 \u906E\u6321\u4EBA\u7269 \xB7 \u9519\u8BEF\u4F4D\u7F6E\u793A\u610F" : "\u2713 \u907F\u5F00\u4EBA\u7269\u4E0E\u52A8\u4F5C" })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { ...pos(44, 44, 1832, 992), border: `3px solid ${accent}`, borderRadius: 8, opacity: boundary, pointerEvents: "none" } })
    ] });
  } else if (n === 9) {
    const changed = p(209, 6), adjust = p(211, 8), gone = p(214, 6);
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      fullPerson(),
      shade(1 - gone),
      /* @__PURE__ */ jsxs("div", { "data-editable-object": "graphics", style: { ...pos(100, 256, 650), opacity: 1 - gone, transform: `scale(${1 - adjust * 0.12})`, transformOrigin: "top left" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 72 * scale }, children: changed > 0.5 ? words[0] : "\u8BA9\u6548\u679C" }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 86 * scale, marginTop: 8, color: accent }, children: changed > 0.5 ? words[1] : "\u670D\u52A1\u5185\u5BB9\u3002" }),
        /* @__PURE__ */ jsx("div", { style: { ...pos(-22, -22, 660, 280), border: `3px solid ${accent}`, opacity: adjust * (1 - gone) }, children: [[0, 0], [660, 0], [0, 280], [660, 280]].map(([x, y], i) => /* @__PURE__ */ jsx("div", { style: { ...pos(x - 7, y - 7, 14, 14), background: accent } }, i)) })
      ] })
    ] });
  } else if (n === 10) {
    const lab = p(235, 12), cues = [241, 243, 245, 248, 279];
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      eyebrow("\u7EC4\u4EF6\u7B5B\u9009 \xB7 \u6D41\u7A0B\u8BF4\u660E"),
      /* @__PURE__ */ jsx("div", { "data-editable-object": "headline", style: { ...pos(110, 191, 1700), fontSize: 100 * scale }, children: String(v.headline) }),
      /* @__PURE__ */ jsxs("div", { "data-editable-object": "graphics", children: [
        /* @__PURE__ */ jsxs("div", { style: { ...pos(110, 435, 1700), opacity: 1 - lab }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 60, marginBottom: 48 }, children: "\u6536\u96C6\u7684\u7EC4\u4EF6" }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 35 }, children: [
            ["\u6587\u5B57", "\u4FE1\u606F", "\u5BF9\u6BD4"].map((t) => /* @__PURE__ */ jsx("div", { style: { padding: "28px 42px", background: "#2b362f", borderRadius: 14, fontSize: 38, color: accent }, children: t }, t)),
            /* @__PURE__ */ jsx("span", { style: { fontSize: 65, color: accent }, children: "\u2192" }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: 50 }, children: "\u89C6\u89C9\u5B9E\u9A8C\u5BA4" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { opacity: lab }, children: [
          /* @__PURE__ */ jsx("div", { style: { ...pos(110, 387), fontSize: 27, color: muted }, children: "\u8FD0\u884C\u3001\u5206\u7C7B\u3001\u9002\u914D\u4E0E\u8BC4\u5BA1\uFF0C\u7F3A\u4E00\u4E0D\u53EF" }),
          cues.map((c, i) => {
            const active = p(c, 10), x = 110 + i * 350;
            return /* @__PURE__ */ jsxs(React2.Fragment, { children: [
              i < 4 && /* @__PURE__ */ jsxs("svg", { style: pos(x + 230, 552, 120, 80), viewBox: "0 0 120 80", children: [
                /* @__PURE__ */ jsx("path", { d: "M0 40H104M94 31L107 40 94 49", fill: "none", stroke: "#46544a", strokeWidth: "3" }),
                /* @__PURE__ */ jsx("path", { d: "M0 40H104", fill: "none", stroke: accent, strokeWidth: "4", pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p(cues[i + 1], 12) })
              ] }),
              /* @__PURE__ */ jsx("div", { style: { ...pos(x, 485, 230, 210), borderRadius: 16, background: i === 4 && active > 0.5 ? accent : "#29352d", display: "flex", justifyContent: "center", alignItems: "center", fontSize: (i === 3 ? 37 : 44) * scale, color: i === 4 && active > 0.5 ? "#202820" : active > 0.5 ? accent : muted, opacity: 0.45 + 0.55 * active }, children: words[i] })
            ] }, c);
          }),
          /* @__PURE__ */ jsx("div", { style: { ...pos(110, 803), fontSize: 45 * scale, ...reveal(279, 6) }, children: "\u5B8C\u6210\u68C0\u67E5\uFF0C\u624D\u8FDB\u5165\u751F\u4EA7\u5E93\u3002" })
        ] })
      ] })
    ] });
  } else if (n === 11) {
    const vis = p(327, 10) * (1 - p(343, 6));
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      fullPerson(),
      /* @__PURE__ */ jsx(AbsoluteFill, { style: { background: "linear-gradient(transparent 68%,rgba(0,0,0,.62))", opacity: vis } }),
      /* @__PURE__ */ jsx("div", { "data-editable-object": "headline", style: { ...pos(110, 871, 1700), textAlign: "center", fontSize: 78 * scale, opacity: vis }, children: String(v.headline) })
    ] });
  } else if (n === 12) {
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { style: { ...pos(110, 245, 1700), textAlign: "center", fontSize: 44, color: muted }, children: "\u628A\u66F4\u591A\u65F6\u95F4\u7559\u7ED9" }),
      /* @__PURE__ */ jsxs("div", { "data-editable-object": "headline", style: { ...pos(110, 408, 1700), display: "flex", alignItems: "baseline", justifyContent: "center", gap: 60 }, children: [
        /* @__PURE__ */ jsx("span", { style: { ...reveal(345, 4), fontSize: 200 * scale, color: accent }, children: words[0] }),
        /* @__PURE__ */ jsx("span", { style: { ...reveal(348, 4), fontSize: 72 }, children: "\u4E0E" }),
        /* @__PURE__ */ jsx("span", { style: { ...reveal(348, 4), fontSize: 200 * scale, color: accent }, children: words[1] })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { ...pos(110, 880, 1700), textAlign: "center", fontSize: 34, color: muted }, children: "Codex Cut" })
    ] });
  } else {
    throw Error("Unknown directed scene " + id);
  }
  return /* @__PURE__ */ jsx(AbsoluteFill, { style: { background: bg, color: ink, fontFamily: "PingFang SC, sans-serif" }, children: body });
}

// workbench-local/scenes/__saved_animation_wrapper.tsx
var __savedSourceSceneId = "dji-redo-10";
var __savedSourceCueIds = ["dji-word-218", "dji-word-235", "dji-word-241", "dji-word-243", "dji-word-245", "dji-word-248", "dji-word-279"];
function SavedAnimation(props) {
  const mappedBeats = __savedSourceCueIds.map((sourceWordId, index) => {
    const beat = props.beats?.[index];
    if (!beat) throw new Error(`Missing saved animation cue ${index}`);
    return { ...beat, wordId: sourceWordId };
  });
  return /* @__PURE__ */ React.createElement(DirectedNarration, { ...props, id: __savedSourceSceneId, beats: mappedBeats });
}
export {
  SavedAnimation
};
