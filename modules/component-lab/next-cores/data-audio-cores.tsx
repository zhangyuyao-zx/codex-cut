import { interpolate } from "remotion";
import type { SmartPackagingNextCoreId } from "../../shared/smart-packaging-component-next-core.js";
import {
  CoreKicker,
  LabOnly,
  NEXT_COLORS,
  NextCoreStage,
  arcPath,
  clamp01,
  ensureArray,
  pointsToPath,
  runtimeFontSize,
  runtimeTextColor,
  useNextCoreMotion,
  type NextCoreMotionProps,
} from "./shared.js";

type DataCoreId = Extract<
  SmartPackagingNextCoreId,
  | "bar-chart"
  | "chart-axis-rescale"
  | "gauge-arc"
  | "line-chart"
  | "numeric-counter"
  | "progress-bar"
  | "stream-line-chart"
  | "unit-chart"
>;

type AudioCoreId = Extract<
  SmartPackagingNextCoreId,
  "audio-spectrum" | "audio-waveform"
>;

interface DataPoint {
  label: string;
  value: number;
}

interface DataCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  coreId: DataCoreId;
  data?: DataPoint[];
  beforeData?: DataPoint[];
  afterData?: DataPoint[];
  title?: string;
  unit?: string;
  label?: string;
  value?: number;
  startValue?: number;
  minimum?: number;
  maximum?: number;
  progress?: number;
  total?: number;
  precision?: number;
  segments?: number;
  columns?: number;
  windowSize?: number;
  accentColor?: string;
}

interface AudioCoreProps extends Omit<NextCoreMotionProps, "coreId"> {
  coreId: AudioCoreId;
  samples: number[];
  label: string;
  bands?: number;
  windowSize?: number;
  accentColor?: string;
}

const defaultData: DataPoint[] = [
  { label: "HOOK", value: 72 },
  { label: "PROOF", value: 88 },
  { label: "METHOD", value: 64 },
  { label: "RESULT", value: 94 },
  { label: "CTA", value: 78 },
];

const DataHeader = ({
  eyebrow,
  title,
  unit,
  accent,
}: {
  eyebrow: string;
  title: string;
  unit?: string;
  accent: string;
}) => (
  <div style={{ position: "absolute", left: 96, top: 78, right: 96 }}>
    <LabOnly><CoreKicker accent={accent}>{eyebrow}</CoreKicker></LabOnly>
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 32,
        marginTop: 16,
      }}
    >
      <div style={{ fontSize: runtimeFontSize(52), fontWeight: 840, lineHeight: 1.08 }}>
        {title}
      </div>
      {unit ? (
        <div style={{ color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(22) }}>
          UNIT · {unit}
        </div>
      ) : null}
    </div>
  </div>
);

const ChartGrid = ({ accent }: { accent: string }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage:
        "linear-gradient(rgba(145,168,168,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(145,168,168,.1) 1px, transparent 1px)",
      backgroundSize: "100% 25%, 20% 100%",
      borderLeft: `2px solid ${accent}55`,
      borderBottom: `2px solid ${accent}55`,
    }}
  />
);

const BarChart = ({
  points,
  reveal,
  accent,
}: {
  points: DataPoint[];
  reveal: number;
  accent: string;
}) => {
  const maximum = Math.max(...points.map((point) => point.value), 1);
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        right: 96,
        top: 260,
        bottom: 94,
        display: "flex",
        alignItems: "flex-end",
        gap: 28,
      }}
    >
      {points.map((point, index) => {
        const stagger = clamp01(reveal * 1.3 - index * 0.08);
        const height = (point.value / maximum) * 100 * stagger;
        return (
          <div
            key={`${point.label}-${index}`}
            style={{
              flex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              minWidth: 0,
            }}
          >
            <div
              style={{
                marginBottom: 14,
                color: runtimeTextColor(accent),
                fontSize: runtimeFontSize(27),
                fontWeight: 850,
                opacity: stagger,
              }}
            >
              {Math.round(point.value * stagger)}
            </div>
            <div
              style={{
                height: `${height}%`,
                minHeight: stagger > 0 ? 6 : 0,
                borderRadius: "18px 18px 4px 4px",
                background: `linear-gradient(180deg, ${accent}, ${accent}3d)`,
                boxShadow: `0 0 38px ${accent}33`,
              }}
            />
            <div
              style={{
                height: 58,
                paddingTop: 16,
                color: runtimeTextColor(NEXT_COLORS.muted),
                fontSize: runtimeFontSize(17),
                fontWeight: 760,
                letterSpacing: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {point.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LineChart = ({
  points,
  reveal,
  accent,
  streamOffset = 0,
}: {
  points: DataPoint[];
  reveal: number;
  accent: string;
  streamOffset?: number;
}) => {
  const width = 1450;
  const height = 500;
  const values = points.map((point, index) =>
    point.value + Math.sin(index * 1.73 + streamOffset) * streamOffset * 2,
  );
  const path = pointsToPath(values, width, height, 32);
  const dash = 2500;
  return (
    <div
      style={{
        position: "absolute",
        left: 116,
        right: 116,
        top: 280,
        bottom: 122,
      }}
    >
      <ChartGrid accent={accent} />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="next-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L ${width - 32} ${height} L 32 ${height} Z`}
          fill="url(#next-line-fill)"
          opacity={reveal}
        />
        <path
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dash}
          strokeDashoffset={dash * (1 - reveal)}
        />
        {points.map((point, index) => {
          const maximum = Math.max(...values, 1);
          const minimum = Math.min(...values, 0);
          const span = Math.max(1, maximum - minimum);
          const x = 32 + (index / Math.max(1, points.length - 1)) * (width - 64);
          const y = 32 + (1 - (values[index] - minimum) / span) * (height - 64);
          return (
            <circle
              key={`${point.label}-${index}`}
              cx={x}
              cy={y}
              r={12}
              fill={NEXT_COLORS.background}
              stroke={accent}
              strokeWidth={7}
              opacity={clamp01(reveal * 1.4 - index * 0.05)}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -46,
          display: "flex",
          justifyContent: "space-between",
          color: runtimeTextColor(NEXT_COLORS.muted),
          fontSize: runtimeFontSize(17),
          fontWeight: 700,
        }}
      >
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
};

const GaugeArc = ({
  value,
  minimum,
  maximum,
  unit,
  label,
  reveal,
  accent,
}: {
  value: number;
  minimum: number;
  maximum: number;
  unit: string;
  label: string;
  reveal: number;
  accent: string;
}) => {
  const ratio = clamp01((value - minimum) / Math.max(1, maximum - minimum));
  const shownRatio = ratio * reveal;
  const shownValue = minimum + (value - minimum) * reveal;
  return (
    <div
      style={{
        position: "absolute",
        inset: "210px 0 50px",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg width="920" height="570" viewBox="0 0 920 570">
        <path
          d={arcPath(460, 455, 350, -125, 125)}
          fill="none"
          stroke={NEXT_COLORS.panelRaised}
          strokeWidth={50}
          strokeLinecap="round"
        />
        <path
          d={arcPath(460, 455, 350, -125, -125 + shownRatio * 250)}
          fill="none"
          stroke={accent}
          strokeWidth={50}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 18px ${accent}88)` }}
        />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const point = arcPath(460, 455, 300, -125 + tick * 250, -124 + tick * 250);
          return <path key={tick} d={point} stroke={NEXT_COLORS.muted} strokeWidth={7} />;
        })}
      </svg>
      <div style={{ position: "absolute", top: 170, textAlign: "center" }}>
        <div style={{ color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(24), letterSpacing: 3 }}>
          {label}
        </div>
        <div style={{ marginTop: 16, fontSize: runtimeFontSize(134), fontWeight: 920, lineHeight: 1 }}>
          {Math.round(shownValue)}
          <span style={{ marginLeft: 12, color: runtimeTextColor(accent), fontSize: runtimeFontSize(42) }}>{unit}</span>
        </div>
        <div style={{ marginTop: 26, color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(19) }}>
          {minimum} — {maximum} {unit}
        </div>
      </div>
    </div>
  );
};

const AxisRescale = ({
  before,
  after,
  reveal,
  phase,
  accent,
}: {
  before: DataPoint[];
  after: DataPoint[];
  reveal: number;
  phase: number;
  accent: string;
}) => {
  const blend = clamp01(interpolate(phase, [0.12, 0.48], [0, 1]));
  const values = after.map((point, index) => {
    const from = before[index]?.value ?? point.value;
    return from + (point.value - from) * blend;
  });
  const oldMax = Math.max(...before.map((point) => point.value), 1);
  const newMax = Math.max(...after.map((point) => point.value), 1);
  const scaleMax = oldMax + (newMax - oldMax) * blend;
  const width = 1380;
  const height = 480;
  const path = pointsToPath(values.map((value) => (value / scaleMax) * 100), width, height, 32);
  return (
    <div style={{ position: "absolute", left: 150, right: 100, top: 285, bottom: 110 }}>
      <ChartGrid accent={accent} />
      <div
        style={{
          position: "absolute",
          left: -105,
          top: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: runtimeTextColor(NEXT_COLORS.muted),
          fontSize: runtimeFontSize(17),
          textAlign: "right",
        }}
      >
        {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
          <span key={ratio}>{Math.round(scaleMax * ratio)}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        <path
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={reveal}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          right: 28,
          top: 24,
          padding: "14px 20px",
          borderRadius: 999,
          background: `${accent}22`,
          color: runtimeTextColor(accent),
          fontSize: runtimeFontSize(20),
          fontWeight: 800,
        }}
      >
        AXIS {Math.round(oldMax)} → {Math.round(newMax)}
      </div>
    </div>
  );
};

const UnitChart = ({
  value,
  total,
  columns,
  reveal,
  accent,
}: {
  value: number;
  total: number;
  columns: number;
  reveal: number;
  accent: string;
}) => {
  const safeTotal = Math.max(1, Math.min(100, Math.round(total)));
  const active = Math.round(Math.min(value, safeTotal) * reveal);
  const safeColumns = Math.max(2, Math.min(20, Math.round(columns)));
  const rows = Math.ceil(safeTotal / safeColumns);
  // Fit square cells in both dimensions of the 1920x1080 design surface.
  const gap = Math.min(15, 690 / rows / 4, 1704 / safeColumns / 4);
  const cellSize = Math.min(
    (1704 - gap * (safeColumns - 1)) / safeColumns,
    (690 - gap * (rows - 1)) / rows,
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 108,
        right: 108,
        top: 285,
        bottom: 105,
        display: "grid",
        gridTemplateColumns: `repeat(${safeColumns}, ${cellSize}px)`,
        gridAutoRows: `${cellSize}px`,
        gap,
        justifyContent: "center",
        alignContent: "center",
      }}
    >
      {Array.from({ length: safeTotal }, (_, index) => (
        <div
          key={index}
          style={{
            aspectRatio: "1",
            borderRadius: index % 3 === 0 ? "50%" : 12,
            background: index < active ? accent : NEXT_COLORS.panelRaised,
            boxShadow: "none",
            transform: `scale(${index < active ? 1 : 0.78})`,
            opacity: index < active ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
};

export const DataCore = (props: DataCoreProps) => {
  const {
    coreId,
    title = "Evidence, measured",
    unit = "%",
    label = "CONFIRMED VALUE",
    accentColor = NEXT_COLORS.cyan,
  } = props;
  const motion = useNextCoreMotion(props);
  const points = ensureArray(props.data, defaultData, coreId === "stream-line-chart" ? 32 : 16);
  const reveal = motion.reveal;

  if (coreId === "gauge-arc") {
    return (
      <NextCoreStage coreId={coreId}>
        <DataHeader eyebrow="GAUGE ARC" title={label} unit={unit} accent={accentColor} />
        <GaugeArc
          value={props.value ?? 84}
          minimum={props.minimum ?? 0}
          maximum={props.maximum ?? 100}
          unit={unit}
          label="CURRENT READING"
          reveal={reveal}
          accent={accentColor}
        />
      </NextCoreStage>
    );
  }

  if (coreId === "numeric-counter") {
    const start = props.startValue ?? 0;
    const end = props.value ?? 128;
    const shown = start + (end - start) * reveal;
    const precision = Math.max(0, Math.min(2, props.precision ?? 0));
    return (
      <NextCoreStage coreId={coreId}>
        <div style={{ position: "absolute", left: 110, top: 92 }}>
          <LabOnly><CoreKicker accent={accentColor}>NUMERIC COUNTER</CoreKicker></LabOnly>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(30), letterSpacing: 5 }}>
              {label}
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: runtimeFontSize(238),
                fontWeight: 940,
                lineHeight: 0.9,
                letterSpacing: -12,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {shown.toFixed(precision)}
              <span style={{ marginLeft: 24, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(68), letterSpacing: 0 }}>
                {unit}
              </span>
            </div>
            <div
              style={{
                width: 720 * reveal,
                height: 8,
                margin: "54px auto 0",
                borderRadius: 99,
                background: accentColor,
                boxShadow: `0 0 32px ${accentColor}88`,
              }}
            />
          </div>
        </div>
      </NextCoreStage>
    );
  }

  if (coreId === "progress-bar") {
    const progress = clamp01(props.progress ?? 0.72) * reveal;
    const segments = Math.max(1, Math.min(12, props.segments ?? 1));
    return (
      <NextCoreStage coreId={coreId}>
        <DataHeader eyebrow="PROGRESS BAR" title={label} unit={unit} accent={accentColor} />
        <div
          style={{
            position: "absolute",
            left: 130,
            right: 130,
            top: 460,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(26) }}>Verified completion</div>
            <div style={{ fontSize: runtimeFontSize(112), fontWeight: 920, fontVariantNumeric: "tabular-nums" }}>
              {Math.round(progress * 100)}
              <span style={{ marginLeft: 8, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(40) }}>{unit}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 44 }}>
            {Array.from({ length: segments }, (_, index) => {
              const segmentProgress = clamp01(progress * segments - index);
              return (
                <div key={index} style={{ flex: 1, height: 42, borderRadius: 12, background: NEXT_COLORS.panelRaised, overflow: "hidden" }}>
                  <div style={{ width: `${segmentProgress * 100}%`, height: "100%", background: `linear-gradient(90deg, ${accentColor}88, ${accentColor})`, boxShadow: `0 0 28px ${accentColor}66` }} />
                </div>
              );
            })}
          </div>
        </div>
      </NextCoreStage>
    );
  }

  if (coreId === "unit-chart") {
    const value = props.value ?? 37;
    const total = props.total ?? 50;
    return (
      <NextCoreStage coreId={coreId}>
        <DataHeader eyebrow="UNIT CHART" title={label} unit={unit} accent={accentColor} />
        <div style={{ position: "absolute", right: 104, top: 96, fontSize: runtimeFontSize(72), fontWeight: 900 }}>
          {Math.round(value * reveal)}<span style={{ color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(30) }}> / {total}</span>
        </div>
        <UnitChart value={value} total={total} columns={props.columns ?? 10} reveal={reveal} accent={accentColor} />
      </NextCoreStage>
    );
  }

  if (coreId === "chart-axis-rescale") {
    const before = ensureArray(props.beforeData, defaultData.map((point) => ({ ...point, value: point.value * 0.45 })), 12);
    const after = ensureArray(props.afterData, defaultData, 12);
    return (
      <NextCoreStage coreId={coreId}>
        <DataHeader eyebrow="AXIS RESCALE" title={title} unit={unit} accent={accentColor} />
        <AxisRescale before={before} after={after} reveal={reveal} phase={motion.phase} accent={accentColor} />
      </NextCoreStage>
    );
  }

  if (coreId === "bar-chart") {
    return (
      <NextCoreStage coreId={coreId}>
        <DataHeader eyebrow="BAR CHART" title={title} unit={unit} accent={accentColor} />
        <BarChart points={points.slice(0, 10)} reveal={reveal} accent={accentColor} />
      </NextCoreStage>
    );
  }

  const streamPhase = coreId === "stream-line-chart" ? motion.phase * 3.4 : 0;
  return (
    <NextCoreStage coreId={coreId}>
      <DataHeader
        eyebrow={coreId === "stream-line-chart" ? "STREAM LINE CHART" : "LINE CHART"}
        title={title}
        unit={unit}
        accent={accentColor}
      />
      <LineChart
        points={points.slice(-(props.windowSize ?? points.length))}
        reveal={reveal}
        accent={accentColor}
        streamOffset={streamPhase}
      />
      {coreId === "stream-line-chart" ? (
        <div style={{ position: "absolute", right: 110, top: 92, display: "flex", alignItems: "center", gap: 12, color: runtimeTextColor(accentColor), fontSize: runtimeFontSize(20), fontWeight: 850 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: accentColor, boxShadow: `0 0 ${14 + motion.pulse * 5}px ${accentColor}` }} />
          LIVE WINDOW
        </div>
      ) : null}
    </NextCoreStage>
  );
};

const Spectrum = ({ samples, bands, reveal, phase, accent }: { samples: number[]; bands: number; reveal: number; phase: number; accent: string }) => {
  const values = Array.from({ length: bands }, (_, index) => {
    const sample = Math.abs(samples[index % samples.length] ?? 0.4);
    return clamp01(sample * 0.86 + 0.08 + Math.sin(index * 0.77 + phase * Math.PI * 2) * 0.06);
  });
  return (
    <div style={{ position: "absolute", left: 112, right: 112, top: 300, bottom: 150, display: "flex", alignItems: "center", justifyContent: "center", gap: 13 }}>
      {values.map((value, index) => (
        <div key={index} style={{ flex: 1, height: "100%", display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", height: `${Math.max(4, value * reveal * 100)}%`, borderRadius: 999, background: `linear-gradient(180deg, ${NEXT_COLORS.amber}, ${accent}, ${NEXT_COLORS.violet})`, boxShadow: index % 4 === 0 ? `0 0 28px ${accent}66` : "none" }} />
        </div>
      ))}
    </div>
  );
};

const Waveform = ({ samples, reveal, accent }: { samples: number[]; reveal: number; accent: string }) => {
  const width = 1600;
  const height = 430;
  const waveform = samples.map((sample) => 50 + Math.max(-1, Math.min(1, sample)) * 42);
  const top = pointsToPath(waveform, width, height, 12);
  return (
    <div style={{ position: "absolute", left: 96, right: 96, top: 332, height: 430 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: `${NEXT_COLORS.muted}55` }} />
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        <path d={top} fill="none" stroke={accent} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={2600} strokeDashoffset={2600 * (1 - reveal)} style={{ filter: `drop-shadow(0 0 12px ${accent}88)` }} />
      </svg>
      <div style={{ position: "absolute", left: `${reveal * 100}%`, top: -18, bottom: -18, width: 3, background: NEXT_COLORS.amber, boxShadow: `0 0 20px ${NEXT_COLORS.amber}` }} />
    </div>
  );
};

export const AudioCore = (props: AudioCoreProps) => {
  const { coreId, label, accentColor = NEXT_COLORS.cyan } = props;
  const motion = useNextCoreMotion(props);
  const samples = ensureArray(props.samples, [0.2, 0.55, -0.36, 0.8], props.windowSize ?? 256);
  return (
    <NextCoreStage coreId={coreId}>
      <DataHeader eyebrow={coreId === "audio-spectrum" ? "AUDIO SPECTRUM" : "AUDIO WAVEFORM"} title={label} unit="HOST SAMPLES" accent={accentColor} />
      {coreId === "audio-spectrum" ? (
        <Spectrum samples={samples} bands={Math.max(8, Math.min(48, props.bands ?? 28))} reveal={motion.reveal} phase={motion.phase} accent={accentColor} />
      ) : (
        <Waveform samples={samples} reveal={motion.reveal} accent={accentColor} />
      )}
      <div style={{ position: "absolute", left: 112, right: 112, bottom: 92, display: "flex", justifyContent: "space-between", color: runtimeTextColor(NEXT_COLORS.muted), fontSize: runtimeFontSize(19), fontVariantNumeric: "tabular-nums" }}>
        <span>00:00.000</span><span>{samples.length} deterministic samples</span><span>00:05.000</span>
      </div>
    </NextCoreStage>
  );
};
