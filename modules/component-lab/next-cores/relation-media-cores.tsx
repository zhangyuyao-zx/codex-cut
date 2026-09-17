import { type ReactNode } from "react";
import { interpolate } from "remotion";
import type { SmartPackagingNextCoreId } from "../../shared/smart-packaging-component-next-core.js";
import {
  CoreKicker,
  LabOnly,
  NEXT_COLORS,
  NextCoreStage,
  clamp01,
  ensureArray,
  runtimeFontSize,
  runtimeTextColor,
  useNextCoreMotion,
  type NextCoreMotionProps,
} from "./shared.js";

type RelationCoreId = Extract<
  SmartPackagingNextCoreId,
  | "card-deck"
  | "card-flip"
  | "card-stack"
  | "clone-depth-echo"
  | "connection-flyline"
  | "flow-diagram"
  | "list-sequence"
  | "panel-grid"
  | "time-relation"
>;

type MediaCoreId = Extract<
  SmartPackagingNextCoreId,
  "before-after" | "media-carousel" | "media-tour"
>;

interface RelationItem {
  id: string;
  title: string;
  detail?: string;
  content?: ReactNode;
}

interface RelationNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
}

interface RelationEdge {
  from: string;
  to: string;
  label?: string;
}

interface TimelineEvent {
  id: string;
  label: string;
  time: number;
  detail?: string;
}

interface RelationCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  coreId: RelationCoreId;
  items?: RelationItem[];
  panels?: RelationItem[];
  nodes?: RelationNode[];
  edges?: RelationEdge[];
  events?: TimelineEvent[];
  title?: string;
  front?: ReactNode;
  back?: ReactNode;
  content?: ReactNode;
  count?: number;
  depth?: number;
  fanAngle?: number;
  spread?: number;
  axis?: "x" | "y";
  showDirection?: boolean;
  direction?: "horizontal" | "vertical";
  numbered?: boolean;
  columns?: number;
  activeId?: string;
  timeUnit?: string;
  conclusion?: string;
  accentColor?: string;
}

interface MediaItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface FocusRegion {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MediaCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  title?: string;
  coreId: MediaCoreId;
  before?: ReactNode;
  after?: ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  divider?: number;
  items?: MediaItem[];
  activeId?: string;
  content?: ReactNode;
  focusRegions?: FocusRegion[];
  activeRegionId?: string;
  accentColor?: string;
}

const defaultItems: RelationItem[] = [
  { id: "brief", title: "Brief", detail: "Confirmed intent" },
  { id: "evidence", title: "Evidence", detail: "Bound sources" },
  { id: "layout", title: "Layout", detail: "Capacity fit" },
  { id: "motion", title: "Motion", detail: "Reason stated" },
];

const defaultNodes: RelationNode[] = [
  { id: "transcript", label: "Transcript", x: 14, y: 50 },
  { id: "agent", label: "Agent decision", x: 43, y: 24 },
  { id: "host", label: "Host validation", x: 43, y: 76 },
  { id: "preview", label: "Real preview", x: 78, y: 50 },
];

const defaultEdges: RelationEdge[] = [
  { from: "transcript", to: "agent", label: "meaning" },
  { from: "transcript", to: "host", label: "identity" },
  { from: "agent", to: "preview", label: "plan" },
  { from: "host", to: "preview", label: "safe apply" },
];

const RelationHeader = ({ title, label, accent }: { title: string; label: string; accent: string }) => (
  <div style={{ position: "absolute", left: 96, top: 76, right: 96 }}>
    <LabOnly><CoreKicker accent={accent}>{label}</CoreKicker></LabOnly>
    <div style={{ marginTop: 14, fontSize: runtimeFontSize(49), fontWeight: 850 }}>{title}</div>
  </div>
);

const CardFace = ({ item, accent, active = false }: { item: RelationItem; accent: string; active?: boolean }) => (
  <div style={{ position: "absolute", inset: 0, padding: 42, borderRadius: 30, border: `3px solid ${active ? accent : NEXT_COLORS.muted}55`, background: active ? `linear-gradient(145deg, ${accent}22, #13272b)` : "linear-gradient(145deg, #183137, #091416)", boxShadow: "0 35px 70px #0008", overflow: "hidden" }}>
    <div style={{ position: "absolute", width: 180, height: 180, right: -55, top: -55, borderRadius: "50%", background: `${accent}22` }} />
    <div style={{ color: runtimeTextColor(active ? accent : NEXT_COLORS.muted), fontSize: runtimeFontSize(18), fontWeight: 850, letterSpacing: 3 }}>{item.id.toUpperCase()}</div>
    <div style={{ marginTop: 28, fontSize: runtimeFontSize(49), fontWeight: 890, lineHeight: 1.05 }}>{item.title}</div>
    <div style={{ marginTop: 18, color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(24), lineHeight: 1.42 }}>{item.detail}</div>
    {item.content ? <div style={{ position: "absolute", left: 34, right: 34, bottom: 34, height: 110, borderRadius: 16, overflow: "hidden" }}>{item.content}</div> : null}
  </div>
);

const CardDeck = ({ items, reveal, fanAngle, accent }: { items: RelationItem[]; reveal: number; fanAngle: number; accent: string }) => (
  <div style={{ position: "absolute", left: 130, right: 130, top: 260, bottom: 90, display: "grid", placeItems: "center" }}>
    <div style={{ position: "relative", width: 500, height: 590 }}>
      {items.map((item, index) => {
        const center = (items.length - 1) / 2;
        const slot = index - center;
        const local = clamp01(reveal * 1.25 - index * 0.06);
        const x = slot * 220 * local;
        const y = Math.abs(slot) * 34 * local;
        const rotation = slot * fanAngle * local;
        return <div key={item.id} style={{ position: "absolute", inset: 0, transformOrigin: "50% 110%", transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${0.84 + local * 0.16})`, opacity: local, zIndex: index }}><CardFace item={item} accent={accent} active={index === Math.floor(items.length / 2)} /></div>;
      })}
    </div>
  </div>
);

const CardFlip = ({ front, back, phase, reveal, axis, accent }: { front: ReactNode; back: ReactNode; phase: number; reveal: number; axis: string; accent: string }) => {
  const turn = clamp01(interpolate(phase, [0.08, 0.52], [0, 1]));
  const showBack = turn >= 0.5;
  const angle = showBack ? (1 - turn) * 180 : turn * 180;
  return (
    <div style={{ position: "absolute", inset: "230px 430px 110px", perspective: 1400, opacity: reveal }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", borderRadius: 34, border: `3px solid ${accent}88`, background: "linear-gradient(145deg, #19343a, #081113)", boxShadow: `0 40px 100px #000b, 0 0 70px ${accent}22`, transform: axis === "x" ? `rotateX(${showBack ? angle : -angle}deg)` : `rotateY(${showBack ? angle : -angle}deg)`, overflow: "hidden" }}>
        {showBack ? back : front}
        <div style={{ position: "absolute", left: 30, bottom: 26, color: runtimeTextColor(accent), fontSize: runtimeFontSize(18), fontWeight: 850, letterSpacing: 3 }}>{showBack ? "BACK · RELATION" : "FRONT · CLAIM"}</div>
      </div>
    </div>
  );
};

const CardStack = ({ items, reveal, spread, accent }: { items: RelationItem[]; reveal: number; spread: number; accent: string }) => (
  <div style={{ position: "absolute", inset: "260px 360px 100px", display: "grid", placeItems: "center" }}>
    <div style={{ position: "relative", width: 760, height: 500 }}>
      {[...items].reverse().map((item, reverseIndex) => {
        const index = items.length - 1 - reverseIndex;
        const local = clamp01(reveal * 1.3 - reverseIndex * 0.06);
        const offset = index * spread;
        return <div key={item.id} style={{ position: "absolute", inset: 0, transform: `translate(${offset * 0.75}px, ${-offset}px) scale(${1 - index * 0.035})`, opacity: local, zIndex: reverseIndex }}><CardFace item={item} accent={accent} active={reverseIndex === items.length - 1} /></div>;
      })}
    </div>
  </div>
);

const CloneDepth = ({ content, count, reveal, depth, accent }: { content: ReactNode; count: number; reveal: number; depth: number; accent: string }) => (
  <div style={{ position: "absolute", inset: "230px 270px 90px", perspective: 1600 }}>
    {Array.from({ length: count }, (_, index) => {
      const local = clamp01(reveal * 1.35 - index * 0.08);
      const rear = count - 1 - index;
      return <div key={index} style={{ position: "absolute", inset: 0, borderRadius: 30, overflow: "hidden", border: `3px solid ${index === 0 ? accent : NEXT_COLORS.muted}55`, transform: `translate(${rear * depth}px, ${-rear * depth * 0.55}px) scale(${1 - rear * 0.045})`, opacity: local * (1 - rear * 0.09), filter: `brightness(${1 - rear * 0.1})`, boxShadow: `0 30px 65px #0009`, zIndex: index }}>{content}</div>;
    })}
  </div>
);

const NetworkGraph = ({ nodes, edges, reveal, phase, accent, showDirection, flow }: { nodes: RelationNode[]; edges: RelationEdge[]; reveal: number; phase: number; accent: string; showDirection: boolean; flow: boolean }) => {
  const nodeMap = new Map(nodes.map((node, index) => [node.id, { ...node, x: node.x ?? 15 + (index % 3) * 35, y: node.y ?? 24 + Math.floor(index / 3) * 48 }]));
  return (
    <div style={{ position: "absolute", left: 115, right: 115, top: 250, bottom: 85 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        <defs><marker id="next-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill={accent} /></marker></defs>
        {edges.map((edge, index) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const bend = flow ? (index % 2 === 0 ? -10 : 10) : 0;
          const path = `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2 + bend} ${to.x} ${to.y}`;
          const dash = 160;
          return <path key={`${edge.from}-${edge.to}`} d={path} fill="none" stroke={accent} strokeWidth={flow ? 0.9 : 0.65} strokeDasharray={flow ? "3 2" : dash} strokeDashoffset={flow ? -phase * 26 : dash * (1 - reveal)} opacity={clamp01(reveal * 1.2 - index * 0.07)} markerEnd={showDirection ? "url(#next-arrow)" : undefined} />;
        })}
      </svg>
      {nodes.map((node, index) => {
        const resolved = nodeMap.get(node.id)!;
        const local = clamp01(reveal * 1.3 - index * 0.08);
        return <div key={node.id} style={{ position: "absolute", left: `${resolved.x}%`, top: `${resolved.y}%`, width: 240, minHeight: 104, marginLeft: -120, marginTop: -52, display: "grid", placeItems: "center", padding: 16, borderRadius: 22, border: `3px solid ${index === nodes.length - 1 ? accent : NEXT_COLORS.muted}66`, background: index === nodes.length - 1 ? `${accent}1f` : "#102326", textAlign: "center", fontSize: runtimeFontSize(24), fontWeight: 820, opacity: local, transform: `scale(${0.82 + local * 0.18})`, boxShadow: index === nodes.length - 1 ? `0 0 40px ${accent}44` : "none" }}>{node.label}</div>;
      })}
    </div>
  );
};

const ListSequence = ({ items, reveal, accent, numbered }: { items: RelationItem[]; reveal: number; accent: string; numbered: boolean }) => (
  <div style={{ position: "absolute", left: 180, right: 180, top: 255, bottom: 80, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
    {items.map((item, index) => {
      const local = clamp01(reveal * 1.4 - index * 0.1);
      return <div key={item.id} style={{ display: "grid", gridTemplateColumns: "92px 1fr auto", alignItems: "center", gap: 24, padding: "18px 28px", borderRadius: 18, background: index === items.length - 1 ? `${accent}14` : NEXT_COLORS.panel, border: `2px solid ${index === items.length - 1 ? accent : NEXT_COLORS.muted}33`, opacity: local, transform: `translateX(${(1 - local) * 90}px)` }}><div style={{ color: runtimeTextColor(accent), fontSize: runtimeFontSize(28), fontWeight: 920 }}>{numbered ? String(index + 1).padStart(2, "0") : "◆"}</div><div><div style={{ fontSize: runtimeFontSize(31), fontWeight: 850 }}>{item.title}</div><div style={{ marginTop: 5, color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(19) }}>{item.detail}</div></div><div style={{ color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(18) }}>{index < items.length - 1 ? "THEN" : "DONE"}</div></div>;
    })}
  </div>
);

const PanelGrid = ({ panels, reveal, columns, activeId, accent }: { panels: RelationItem[]; reveal: number; columns: number; activeId?: string; accent: string }) => (
  <div style={{ position: "absolute", left: 100, right: 100, top: 240, bottom: 80, display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 20 }}>
    {panels.map((panel, index) => {
      const local = clamp01(reveal * 1.5 - index * 0.08);
      const active = panel.id === activeId;
      return <div key={panel.id} style={{ position: "relative", minHeight: 180, padding: 30, borderRadius: 24, border: `3px solid ${active ? accent : NEXT_COLORS.muted}44`, background: active ? `${accent}19` : NEXT_COLORS.panel, overflow: "hidden", opacity: local, transform: `scale(${0.9 + local * 0.1})` }}><div style={{ color: runtimeTextColor(active ? accent : NEXT_COLORS.muted), fontSize: runtimeFontSize(17), fontWeight: 850, letterSpacing: 2 }}>{panel.id.toUpperCase()}</div><div style={{ marginTop: 18, fontSize: runtimeFontSize(34), fontWeight: 880 }}>{panel.title}</div><div style={{ marginTop: 12, color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(20), lineHeight: 1.4 }}>{panel.detail}</div>{panel.content ? <div style={{ position: "absolute", left: 24, right: 24, bottom: 24, height: 94, overflow: "hidden", borderRadius: 12 }}>{panel.content}</div> : null}</div>;
    })}
  </div>
);

const TimeRelation = ({ events, reveal, accent, unit, conclusion }: { events: TimelineEvent[]; reveal: number; accent: string; unit: string; conclusion?: string }) => {
  const minimum = Math.min(...events.map((event) => event.time));
  const maximum = Math.max(...events.map((event) => event.time));
  const span = Math.max(1, maximum - minimum);
  return (
    <div style={{ position: "absolute", left: 130, right: 130, top: 300, bottom: 100 }}>
      <div style={{ position: "absolute", left: 40, right: 40, top: "48%", height: 8, borderRadius: 99, background: NEXT_COLORS.panelRaised }}><div style={{ width: `${reveal * 100}%`, height: "100%", borderRadius: 99, background: accent, boxShadow: `0 0 30px ${accent}55` }} /></div>
      {events.map((event, index) => {
        const x = 4 + ((event.time - minimum) / span) * 92;
        const local = clamp01(reveal * 1.35 - index * 0.08);
        const above = index % 2 === 0;
        return <div key={event.id} style={{ position: "absolute", left: `${x}%`, top: above ? "17%" : "49%", width: 250, marginLeft: -125, opacity: local }}><div style={{ width: 26, height: 26, margin: above ? "auto auto 18px" : "-13px auto 18px", borderRadius: "50%", border: `5px solid ${accent}`, background: NEXT_COLORS.background, boxShadow: `0 0 24px ${accent}` }} /><div style={{ padding: "16px 18px", borderRadius: 16, border: `2px solid ${accent}55`, background: NEXT_COLORS.panel, textAlign: "center" }}><div style={{ color: runtimeTextColor(accent), fontSize: runtimeFontSize(17), fontWeight: 850 }}>{event.time} {unit}</div><div style={{ marginTop: 8, fontSize: runtimeFontSize(24), fontWeight: 850 }}>{event.label}</div><div style={{ marginTop: 6, color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(16) }}>{event.detail}</div></div></div>;
      })}
      {conclusion ? <div style={{ position: "absolute", left: "50%", bottom: -44, transform: "translateX(-50%)", padding: "14px 24px", borderRadius: 999, background: `${accent}1b`, color: runtimeTextColor(accent), fontSize: runtimeFontSize(20), fontWeight: 850, whiteSpace: "nowrap" }}>{conclusion}</div> : null}
    </div>
  );
};

export const RelationCore = (props: RelationCoreProps) => {
  const { coreId, accentColor = NEXT_COLORS.cyan, title = "Structure makes the idea legible" } = props;
  const motion = useNextCoreMotion(props);
  const items = ensureArray(props.items, defaultItems, 8);
  if (coreId === "card-deck") return <NextCoreStage coreId={coreId}><RelationHeader title={title} label="CARD DECK" accent={accentColor} /><CardDeck items={items} reveal={motion.reveal} fanAngle={props.fanAngle ?? 7.5} accent={accentColor} /></NextCoreStage>;
  if (coreId === "card-flip") return <NextCoreStage coreId={coreId}><RelationHeader title={title} label="CARD FLIP" accent={accentColor} /><CardFlip front={props.front ?? <div style={{ fontSize: runtimeFontSize(72), fontWeight: 920 }}>CLAIM</div>} back={props.back ?? <div style={{ fontSize: runtimeFontSize(72), fontWeight: 920, color: runtimeTextColor(accentColor) }}>PROOF</div>} phase={motion.phase} reveal={motion.reveal} axis={props.axis ?? "y"} accent={accentColor} /></NextCoreStage>;
  if (coreId === "card-stack") return <NextCoreStage coreId={coreId}><RelationHeader title={title} label="CARD STACK" accent={accentColor} /><CardStack items={items.slice(0, 7)} reveal={motion.reveal} spread={props.spread ?? 26} accent={accentColor} /></NextCoreStage>;
  if (coreId === "clone-depth-echo") return <NextCoreStage coreId={coreId}><RelationHeader title={title} label="CLONE DEPTH ECHO" accent={accentColor} /><CloneDepth content={props.content} count={Math.max(2, Math.min(6, props.count ?? 4))} reveal={motion.reveal} depth={props.depth ?? 38} accent={accentColor} /></NextCoreStage>;
  if (coreId === "connection-flyline" || coreId === "flow-diagram") {
    const nodes = ensureArray(props.nodes, defaultNodes, coreId === "flow-diagram" ? 9 : 10);
    const edges = ensureArray(props.edges, defaultEdges, 14);
    return <NextCoreStage coreId={coreId}><RelationHeader title={title} label={coreId === "flow-diagram" ? "FLOW DIAGRAM" : "CONNECTION FLYLINE"} accent={accentColor} /><NetworkGraph nodes={nodes} edges={edges} reveal={motion.reveal} phase={motion.phase} accent={accentColor} showDirection={props.showDirection ?? true} flow={coreId === "connection-flyline"} /></NextCoreStage>;
  }
  if (coreId === "list-sequence") return <NextCoreStage coreId={coreId}><RelationHeader title={title} label="LIST SEQUENCE" accent={accentColor} /><ListSequence items={items} reveal={motion.reveal} accent={accentColor} numbered={props.numbered ?? true} /></NextCoreStage>;
  if (coreId === "panel-grid") {
    const panels = ensureArray(props.panels, defaultItems, 9);
    return <NextCoreStage coreId={coreId}><RelationHeader title={title} label="PANEL GRID" accent={accentColor} /><PanelGrid panels={panels} reveal={motion.reveal} columns={Math.max(2, Math.min(3, props.columns ?? 2))} activeId={props.activeId ?? panels[0]?.id} accent={accentColor} /></NextCoreStage>;
  }
  const events = ensureArray(props.events, [{ id: "a", label: "Hook", time: 0, detail: "Question" }, { id: "b", label: "Method", time: 12, detail: "Steps" }, { id: "c", label: "Evidence", time: 28, detail: "Proof" }, { id: "d", label: "Result", time: 43, detail: "Conclusion" }], 8);
  return <NextCoreStage coreId={coreId}><RelationHeader title={title} label="TIME RELATION" accent={accentColor} /><TimeRelation events={events} reveal={motion.reveal} accent={accentColor} unit={props.timeUnit ?? "s"} conclusion={props.conclusion} /></NextCoreStage>;
};

const MediaFrame = ({ children, label, accent, labelSide = "left" }: { children: ReactNode; label: string; accent: string; labelSide?: "left" | "right" }) => (
  <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: NEXT_COLORS.panel }}>
    {children}
    <div style={{ position: "absolute", [labelSide]: 22, bottom: 20, padding: "10px 15px", borderRadius: 9, background: `${NEXT_COLORS.background}df`, color: runtimeTextColor(accent), fontSize: runtimeFontSize(17), fontWeight: 850, letterSpacing: 2 }}>{label}</div>
  </div>
);

const BeforeAfter = ({ before, after, beforeLabel, afterLabel, divider, reveal, accent }: { before: ReactNode; after: ReactNode; beforeLabel: string; afterLabel: string; divider: number; reveal: number; accent: string }) => {
  const resolvedDivider = 50 + (divider - 50) * reveal;
  return (
    <div style={{ position: "absolute", left: 120, right: 120, top: 205, bottom: 90, borderRadius: 30, overflow: "hidden", border: `3px solid ${NEXT_COLORS.muted}44`, boxShadow: "0 40px 100px #000a" }}>
      <div style={{ position: "absolute", inset: 0 }}><MediaFrame label={beforeLabel} accent={NEXT_COLORS.amber}>{before}</MediaFrame></div>
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${resolvedDivider}%)` }}><MediaFrame label={afterLabel} accent={accent} labelSide="right">{after}</MediaFrame></div>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${resolvedDivider}%`, width: 6, marginLeft: -3, background: accent, boxShadow: `0 0 30px ${accent}` }}><div style={{ position: "absolute", left: -34, top: "50%", width: 74, height: 74, marginTop: -37, display: "grid", placeItems: "center", borderRadius: "50%", border: `5px solid ${accent}`, background: NEXT_COLORS.background, color: runtimeTextColor(accent), fontSize: runtimeFontSize(28) }}>↔</div></div>
    </div>
  );
};

const MediaCarousel = ({ items, activeId, reveal, phase, accent }: { items: MediaItem[]; activeId: string; reveal: number; phase: number; accent: string }) => {
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const drift = Math.sin(phase * Math.PI * 2) * 10;
  return (
    <div style={{ position: "absolute", inset: "240px 80px 85px", display: "grid", placeItems: "center", perspective: 1400 }}>
      {items.map((item, index) => {
        const offset = index - activeIndex;
        const local = clamp01(reveal * 1.3 - Math.abs(offset) * 0.06);
        return <div key={item.id} style={{ position: "absolute", width: 820, height: 560, borderRadius: 28, overflow: "hidden", border: `4px solid ${offset === 0 ? accent : NEXT_COLORS.muted}55`, transform: `translateX(${offset * 520 + (offset === 0 ? drift : 0)}px) translateZ(${-Math.abs(offset) * 180}px) rotateY(${offset * -12}deg) scale(${offset === 0 ? 1 : 0.82})`, opacity: local * (offset === 0 ? 1 : 0.62), zIndex: 20 - Math.abs(offset), boxShadow: offset === 0 ? `0 45px 110px #000b, 0 0 65px ${accent}22` : "0 30px 70px #0009" }}><MediaFrame label={item.label} accent={offset === 0 ? accent : NEXT_COLORS.muted}>{item.content}</MediaFrame></div>;
      })}
    </div>
  );
};

const MediaTour = ({ content, regions, activeId, reveal, accent }: { content: ReactNode; regions: FocusRegion[]; activeId: string; reveal: number; accent: string }) => (
  <div style={{ position: "absolute", left: 120, right: 120, top: 205, bottom: 85, borderRadius: 30, overflow: "hidden", border: `3px solid ${NEXT_COLORS.muted}44`, boxShadow: "0 40px 100px #000a" }}>
    {content}
    {regions.map((region, index) => {
      const local = clamp01(reveal * 1.35 - index * 0.08);
      const active = region.id === activeId;
      return <div key={region.id} style={{ position: "absolute", left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%`, borderRadius: 16, border: `${active ? 5 : 3}px solid ${active ? accent : NEXT_COLORS.amber}`, background: active ? `${accent}15` : "transparent", opacity: local, boxShadow: active ? `0 0 38px ${accent}66` : "none" }}><div style={{ position: "absolute", left: 10, top: 10, minWidth: 34, height: 34, display: "grid", placeItems: "center", padding: "0 8px", borderRadius: 8, background: active ? accent : NEXT_COLORS.amber, color: runtimeTextColor(NEXT_COLORS.background), fontSize: runtimeFontSize(16), fontWeight: 900 }}>{index + 1}</div><div style={{ position: "absolute", left: 10, bottom: 9, padding: "7px 10px", borderRadius: 8, background: `${NEXT_COLORS.background}df`, color: runtimeTextColor(active ? accent : NEXT_COLORS.amber), fontSize: runtimeFontSize(15), fontWeight: 820 }}>{region.label}</div></div>;
    })}
  </div>
);

export const MediaCore = (props: MediaCoreProps) => {
  const { coreId, accentColor = NEXT_COLORS.cyan } = props;
  const motion = useNextCoreMotion(props);
  if (coreId === "before-after") {
    return <NextCoreStage coreId={coreId}><RelationHeader title={props.title ?? ""} label="BEFORE / AFTER" accent={accentColor} /><BeforeAfter before={props.before} after={props.after} beforeLabel={props.beforeLabel ?? "BEFORE"} afterLabel={props.afterLabel ?? "AFTER"} divider={Math.max(20, Math.min(80, props.divider ?? 58))} reveal={motion.reveal} accent={accentColor} /></NextCoreStage>;
  }
  if (coreId === "media-carousel") {
    const items = ensureArray(props.items, [], 9);
    return <NextCoreStage coreId={coreId}><RelationHeader title="One focus, adjacent evidence retained" label="MEDIA CAROUSEL" accent={accentColor} /><MediaCarousel items={items} activeId={props.activeId ?? items[1]?.id ?? items[0]?.id ?? ""} reveal={motion.reveal} phase={motion.phase} accent={accentColor} /></NextCoreStage>;
  }
  const regions = ensureArray(props.focusRegions, [{ id: "a", label: "Toolbar", x: 6, y: 7, width: 88, height: 15 }, { id: "b", label: "Primary control", x: 56, y: 34, width: 31, height: 31 }, { id: "c", label: "Result", x: 14, y: 72, width: 72, height: 18 }], 6);
  return <NextCoreStage coreId={coreId}><RelationHeader title="Guide attention without replacing the source" label="MEDIA TOUR" accent={accentColor} /><MediaTour content={props.content} regions={regions} activeId={props.activeRegionId ?? regions[1]?.id ?? regions[0]?.id ?? ""} reveal={motion.reveal} accent={accentColor} /></NextCoreStage>;
};
