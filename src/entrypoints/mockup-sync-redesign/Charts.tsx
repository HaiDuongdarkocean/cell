/** Hand-rolled inline-SVG charts — no dependencies, tokens via CSS classes. */

import type { JSX } from 'react';

export function Sparkline({
  values,
  tone = 'primary',
  label,
}: {
  readonly values: readonly number[];
  readonly tone?: 'primary' | 'error';
  readonly label: string;
}): JSX.Element {
  const W = 100;
  const H = 28;
  const PAD = 2;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = PAD + i * step;
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `M ${PAD},${H - PAD} L ${line.replaceAll(' ', ' L ')} L ${W - PAD},${H - PAD} Z`;
  return (
    <svg
      className={`msrSpark msrSpark-${tone}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path className="msrSparkArea" d={area} />
      <polyline className="msrSparkLine" points={line} fill="none" />
      {pts.length > 0 && (
        <circle
          className="msrSparkDot"
          cx={pts[pts.length - 1][0]}
          cy={pts[pts.length - 1][1]}
          r={2}
        />
      )}
    </svg>
  );
}

export interface DonutSegment {
  readonly value: number;
  readonly tone: 'primary' | 'success' | 'warning' | 'error' | 'muted';
  readonly label: string;
}

export function Donut({
  segments,
  center,
  caption,
}: {
  readonly segments: readonly DonutSegment[];
  readonly center: string;
  readonly caption: string;
}): JSX.Element {
  const R = 15.915; // circumference ≈ 100
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 25; // start at 12 o'clock
  const ariaSummary = segments.map((s) => `${s.label}: ${s.value}`).join(', ');
  return (
    <svg
      className="msrDonut"
      viewBox="0 0 42 42"
      role="img"
      aria-label={`${caption} — ${ariaSummary}`}
    >
      <circle className="msrDonutTrack" cx={21} cy={21} r={R} fill="none" />
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const pct = (s.value / total) * 100;
            const el = (
              <circle
                key={s.label}
                className={`msrDonutSeg msrDonut-${s.tone}`}
                cx={21}
                cy={21}
                r={R}
                fill="none"
                strokeDasharray={`${Math.max(pct - 1.2, 0.4)} ${100 - Math.max(pct - 1.2, 0.4)}`}
                strokeDashoffset={offset}
              />
            );
            offset -= pct;
            return el;
          })}
      <text className="msrDonutCenter" x={21} y={20} textAnchor="middle">
        {center}
      </text>
      <text className="msrDonutCaption" x={21} y={26} textAnchor="middle">
        {caption}
      </text>
    </svg>
  );
}

export function Bars({
  values,
  highlightLast = true,
  label,
}: {
  readonly values: readonly number[];
  readonly highlightLast?: boolean;
  readonly label: string;
}): JSX.Element {
  const W = 100;
  const H = 30;
  const max = Math.max(...values, 1);
  const n = values.length;
  const gap = 2;
  const barW = (W - gap * (n - 1)) / n;
  return (
    <svg
      className="msrBars"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {values.map((v, i) => {
        const h = Math.max((v / max) * (H - 3), v > 0 ? 3 : 1.5);
        const last = i === n - 1;
        return (
          <rect
            key={i}
            className={`msrBar ${last && highlightLast ? 'msrBar-last' : ''} ${v === 0 ? 'msrBar-zero' : ''}`}
            x={i * (barW + gap)}
            y={H - h}
            width={barW}
            height={h}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
