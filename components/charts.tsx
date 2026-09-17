// Small dependency-free SVG charts for the Stats tab -- the app has no charting library, and
// these are simple enough (a handful of bars, a short trend line) not to warrant adding one.

export interface BarDatum {
  label: string;
  value: number | null; // null renders as "—" with an empty track (no decided picks yet)
  color?: string;
  sublabel?: string; // e.g. a "W-L" count shown next to the percentage
}

export function BarChart({
  data,
  maxValue = 100,
  valueSuffix = "%",
}: {
  data: BarDatum[];
  maxValue?: number;
  valueSuffix?: string;
}) {
  if (data.length === 0) return <p className="muted">No picks in this filter.</p>;
  return (
    <div className="bar-chart">
      {data.map((d) => {
        const pct = d.value === null ? 0 : Math.max(0, Math.min(100, (d.value / maxValue) * 100));
        return (
          <div className="bar-chart-row" key={d.label}>
            <div className="bar-chart-label">{d.label}</div>
            <div className="bar-chart-track">
              <div className="bar-chart-fill" style={{ width: `${pct}%`, background: d.color ?? "var(--accent)" }} />
            </div>
            <div className="bar-chart-value">
              {d.value === null ? "—" : `${d.value.toFixed(1)}${valueSuffix}`}
              {d.sublabel && <span className="muted"> ({d.sublabel})</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface LinePoint {
  x: number;
  label: string;
  y: number | null;
  sublabel?: string;
}

export function LineChart({
  points,
  maxY = 100,
  height = 180,
  ySuffix = "%",
  color = "var(--accent)",
}: {
  points: LinePoint[];
  maxY?: number;
  height?: number;
  ySuffix?: string;
  color?: string;
}) {
  if (points.length === 0) return <p className="muted">No picks in this filter.</p>;

  const width = Math.max(points.length * 48, 240);
  const padding = 24;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    ...p,
    cx: padding + i * xStep,
    cy: p.y === null ? null : padding + plotHeight - (Math.max(0, Math.min(maxY, p.y)) / maxY) * plotHeight,
  }));

  // Break the line into separate segments at any gap (a position with no decided picks yet)
  // instead of interpolating across missing data.
  const segments: string[] = [];
  let current: string[] = [];
  for (const c of coords) {
    if (c.cy === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
    } else {
      current.push(`${c.cx},${c.cy}`);
    }
  }
  if (current.length > 1) segments.push(current.join(" "));

  return (
    <div className="line-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="xMinYMid meet">
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="var(--border)" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" />
        {segments.map((seg, i) => (
          <polyline key={i} points={seg} fill="none" stroke={color} strokeWidth={2} />
        ))}
        {coords.map(
          (c, i) =>
            c.cy !== null && (
              <g key={`pt-${i}`}>
                <circle cx={c.cx} cy={c.cy} r={3} fill={color} />
                <title>{`${c.label}: ${c.y!.toFixed(1)}${ySuffix}${c.sublabel ? ` (${c.sublabel})` : ""}`}</title>
              </g>
            )
        )}
        {coords.map((c, i) => (
          <text key={`lbl-${i}`} x={c.cx} y={height - padding + 14} fontSize={9} fill="var(--text-dim)" textAnchor="middle">
            {c.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
