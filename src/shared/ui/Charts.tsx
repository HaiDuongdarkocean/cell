import type { JSX } from 'react';
import styles from './Charts.module.css';

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
      className={`${styles.spark} ${styles[`spark-${tone}`]}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path className={styles.sparkArea} d={area} />
      <polyline className={styles.sparkLine} points={line} fill="none" />
      {pts.length > 0 && (
        <circle
          className={styles.sparkDot}
          cx={pts[pts.length - 1]![0]}
          cy={pts[pts.length - 1]![1]}
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
  const R = 15.915;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 25;
  const ariaSummary = segments.map((s) => `${s.label}: ${s.value}`).join(', ');
  return (
    <svg
      className={styles.donut}
      viewBox="0 0 42 42"
      role="img"
      aria-label={`${caption} — ${ariaSummary}`}
    >
      <circle className={styles.donutTrack} cx={21} cy={21} r={R} fill="none" />
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const pct = (s.value / total) * 100;
            const arc = Math.max(pct - 1.2, 0.4);
            const el = (
              <circle
                key={s.label}
                className={`${styles.donutSeg} ${styles[`donut-${s.tone}`]}`}
                cx={21}
                cy={21}
                r={R}
                fill="none"
                strokeDasharray={`${arc} ${100 - arc}`}
                strokeDashoffset={offset}
              />
            );
            offset -= pct;
            return el;
          })}
      <text className={styles.donutCenter} x={21} y={20} textAnchor="middle">
        {center}
      </text>
      <text className={styles.donutCaption} x={21} y={26} textAnchor="middle">
        {caption}
      </text>
    </svg>
  );
}

export interface BarPoint {
  readonly value: number;
  readonly label: string;
}

export function Bars({
  points,
  label,
  selectedIndex,
  onSelect,
}: {
  readonly points: readonly BarPoint[];
  readonly label: string;
  readonly selectedIndex?: number;
  readonly onSelect?: (index: number) => void;
}): JSX.Element {
  const W = 100;
  const H = 30;
  const max = Math.max(...points.map((p) => p.value), 1);
  const n = Math.max(points.length, 1);
  const gap = 2;
  const barW = (W - gap * (n - 1)) / n;
  return (
    <svg
      className={styles.bars}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {points.map((p, i) => {
        const h = Math.max((p.value / max) * (H - 3), p.value > 0 ? 3 : 1.5);
        const cls = `${styles.bar} ${i === selectedIndex ? styles.barSelected : ''} ${
          p.value === 0 ? styles.barZero : ''
        } ${onSelect !== undefined ? styles.barClickable : ''}`;
        const rect = (
          <rect
            className={cls}
            x={i * (barW + gap)}
            y={H - h}
            width={barW}
            height={h}
            rx={1}
          >
            <title>{p.label}</title>
          </rect>
        );
        if (onSelect === undefined) return <g key={i}>{rect}</g>;
        return (
          <g
            key={i}
            role="button"
            tabIndex={0}
            aria-label={p.label}
            className={styles.barHit}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(i);
              }
            }}
          >
            {rect}
          </g>
        );
      })}
    </svg>
  );
}
